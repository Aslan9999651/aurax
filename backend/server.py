from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import random
import asyncio
import logging
import ipaddress
from datetime import datetime, timezone, timedelta
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from typing import Optional, List

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ------------------------------------------------------------------ DB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ------------------------------------------------------------------ App
app = FastAPI(title="AuraX API")
api_router = APIRouter(prefix="/api")


class WSManager:
    def __init__(self):
        self.active = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in list(self.active):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


ws_manager = WSManager()

SIM_SAMPLES = [
    {"ntype": "deposit", "message": "قام مستخدم بإيداع 3,200 USDT عبر شبكة TRC20"},
    {"ntype": "withdraw", "message": "تمت معالجة سحب بقيمة 1,500 USDT عبر شبكة ERC20"},
    {"ntype": "market", "message": "ارتفاع حاد في حجم التداول على BTC/USDT"},
    {"ntype": "deposit", "message": "إيداع 0.45 BTC تم تأكيده بنجاح"},
    {"ntype": "market", "message": "إدراج جديد متاح الآن على منصة AuraX"},
]


async def sim_events():
    while True:
        await asyncio.sleep(12)
        try:
            await ws_manager.broadcast({"type": "notification", **random.choice(SIM_SAMPLES)})
        except Exception:
            pass


async def log_admin(admin: dict, action: str, target_user_id=None, target_email=None, details=None):
    await db.admin_logs.insert_one({
        "id": f"log_{uuid.uuid4().hex[:10]}", "admin_email": admin.get("email"),
        "action": action, "target_user_id": target_user_id, "target_email": target_email,
        "details": details or {}, "created_at": datetime.now(timezone.utc).isoformat()})

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("aurax")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "AuraX")

# ================================================================== EMAIL GATE
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY missing; skipping email send")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return None


def verification_email_html(code: str) -> str:
    return (
        f'<table role="presentation" width="100%" style="background:#0B0E14;padding:32px 0">'
        f'<tr><td align="center">'
        f'<table role="presentation" width="480" style="background:#121721;border-radius:16px;'
        f'font-family:Arial,Helvetica,sans-serif;overflow:hidden">'
        f'<tr><td style="padding:28px 32px;background:#0f1420;border-bottom:1px solid #1E293B">'
        f'<span style="color:#00E5FF;font-size:26px;font-weight:800;letter-spacing:1px">AuraX</span></td></tr>'
        f'<tr><td style="padding:32px">'
        f'<h2 style="color:#F8FAFC;margin:0 0 12px;font-size:20px">رمز تأكيد حسابك</h2>'
        f'<p style="color:#94A3B8;font-size:14px;line-height:1.7;margin:0 0 24px">'
        f'استخدم الرمز التالي لتفعيل حسابك على منصة AuraX. الرمز صالح لمدة 15 دقيقة.</p>'
        f'<div style="text-align:center;margin:0 0 24px">'
        f'<span style="display:inline-block;background:#0B0E14;border:1px solid #00E5FF;'
        f'color:#00E5FF;font-size:34px;font-weight:800;letter-spacing:10px;padding:16px 28px;'
        f'border-radius:12px">{escape(code)}</span></div>'
        f'<p style="color:#64748B;font-size:12px;line-height:1.6;margin:0">'
        f'إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة. لن نطلب منك كلمة المرور أو أي بيانات حساسة عبر البريد.</p>'
        f'</td></tr>'
        f'<tr><td style="padding:18px 32px;background:#0f1420;border-top:1px solid #1E293B">'
        f'<span style="color:#64748B;font-size:11px">تم الإرسال بواسطة AuraX</span></td></tr>'
        f'</table></td></tr></table>'
    )


# ================================================================== AUTH HELPERS
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "user"),
        "is_verified": u.get("is_verified", False),
        "frozen": u.get("frozen", False),
        "balances": u.get("balances", {}),
        "picture": u.get("picture"),
        "fee_verified": u.get("fee_verified", False),
        "created_at": u.get("created_at"),
    }


async def _user_from_token(token: str) -> Optional[dict]:
    # try JWT
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") == "access":
            u = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
            if u:
                return u
    except jwt.InvalidTokenError:
        pass
    # try session token (google)
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess.get("expires_at")
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if not exp or exp > datetime.now(timezone.utc):
            return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    return None


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token") or request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="غير مصرح")
    u = await _user_from_token(token)
    if not u:
        raise HTTPException(status_code=401, detail="الجلسة منتهية أو غير صالحة")
    return u


async def get_admin_user(request: Request) -> dict:
    u = await get_current_user(request)
    if u.get("role") != "admin":
        raise HTTPException(status_code=403, detail="صلاحيات الآدمن مطلوبة")
    return u


# ================================================================== MODELS
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str


class VerifyIn(BaseModel):
    email: EmailStr
    code: str


class ResendIn(BaseModel):
    email: EmailStr


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class OrderIn(BaseModel):
    pair: str
    market: str = "spot"          # spot | futures
    side: str                      # buy | sell | long | short
    order_type: str = "market"     # market | limit
    price: Optional[float] = None
    amount: float
    leverage: int = 1


class SubmitFeeIn(BaseModel):
    network: str
    txid: str


class AdminUserUpdate(BaseModel):
    add_balance_currency: Optional[str] = None
    add_balance_amount: Optional[float] = None
    set_balance_currency: Optional[str] = None
    set_balance_amount: Optional[float] = None
    verification_fee_amount: Optional[float] = None
    verification_currency: Optional[str] = None
    verification_message: Optional[str] = None
    wallet_addresses: Optional[dict] = None
    frozen: Optional[bool] = None
    is_verified: Optional[bool] = None
    fee_verified: Optional[bool] = None
    role: Optional[str] = None


class SettingsUpdate(BaseModel):
    verification_fee_amount: Optional[float] = None
    verification_currency: Optional[str] = None
    verification_message: Optional[str] = None
    wallet_addresses: Optional[dict] = None
    networks: Optional[list] = None
    auto_verify_enabled: Optional[bool] = None
    auto_verify_delay: Optional[int] = None


class BroadcastIn(BaseModel):
    ntype: str = "market"   # market | deposit | withdraw | system
    message: str


# ================================================================== DEFAULTS
DEFAULT_NETWORKS = [
    {"id": "TRC20", "name": "Tron (TRC20)"},
    {"id": "ERC20", "name": "Ethereum (ERC20)"},
    {"id": "BEP20", "name": "BNB Smart Chain (BEP20)"},
    {"id": "SOL", "name": "Solana"},
    {"id": "BTC", "name": "Bitcoin"},
    {"id": "POLYGON", "name": "Polygon"},
]

DEFAULT_WALLETS = {
    "TRC20": "TXk9QhpzY4aurAX00DemoAddr1122334455",
    "ERC20": "0xAuRaX00Demo00Ethereum00Address00112233",
    "BEP20": "0xAuRaX00Demo00Bsc00Address00445566778899",
    "SOL": "AuraXSoLDemoAddr9911223344556677889900zz",
    "BTC": "bc1qaurax00demo00btc00address00998877665544",
    "POLYGON": "0xAuRaX00Demo00Polygon00Addr00223344556677",
}

DEFAULT_MESSAGE = ("لإتمام عملية التحقق من حسابك وتفعيل السحب الكامل، يرجى دفع رسوم التحقق "
                   "لمرة واحدة. بعد الدفع أرسل رقم عملية التحويل (TXID) وسيتم تفعيل حسابك خلال دقائق.")


async def get_settings() -> dict:
    s = await db.settings.find_one({"_id": "global"})
    if not s:
        s = {
            "_id": "global",
            "verification_fee_amount": 50.0,
            "verification_currency": "USDT",
            "verification_message": DEFAULT_MESSAGE,
            "wallet_addresses": DEFAULT_WALLETS,
            "networks": DEFAULT_NETWORKS,
            "auto_verify_enabled": False,
            "auto_verify_delay": 20,
        }
        await db.settings.insert_one(s)
    s.pop("_id", None)
    s.setdefault("auto_verify_enabled", False)
    s.setdefault("auto_verify_delay", 20)
    return s


# ================================================================== CRYPTO DATA
_CACHE: dict = {}
CG_BASE = "https://api.coingecko.com/api/v3"

FALLBACK_MARKETS = [
    {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "current_price": 67250.0, "market_cap": 1320000000000, "market_cap_rank": 1, "price_change_percentage_24h": 1.85, "total_volume": 28000000000, "high_24h": 68100, "low_24h": 66200, "image": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"},
    {"id": "ethereum", "symbol": "eth", "name": "Ethereum", "current_price": 3480.0, "market_cap": 418000000000, "market_cap_rank": 2, "price_change_percentage_24h": 2.4, "total_volume": 15000000000, "high_24h": 3550, "low_24h": 3390, "image": "https://assets.coingecko.com/coins/images/279/large/ethereum.png"},
    {"id": "tether", "symbol": "usdt", "name": "Tether", "current_price": 1.0, "market_cap": 112000000000, "market_cap_rank": 3, "price_change_percentage_24h": 0.01, "total_volume": 45000000000, "high_24h": 1.001, "low_24h": 0.999, "image": "https://assets.coingecko.com/coins/images/325/large/Tether.png"},
    {"id": "binancecoin", "symbol": "bnb", "name": "BNB", "current_price": 605.0, "market_cap": 89000000000, "market_cap_rank": 4, "price_change_percentage_24h": -0.75, "total_volume": 1800000000, "high_24h": 615, "low_24h": 598, "image": "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png"},
    {"id": "solana", "symbol": "sol", "name": "Solana", "current_price": 168.5, "market_cap": 78000000000, "market_cap_rank": 5, "price_change_percentage_24h": 4.2, "total_volume": 3200000000, "high_24h": 172, "low_24h": 160, "image": "https://assets.coingecko.com/coins/images/4128/large/solana.png"},
    {"id": "ripple", "symbol": "xrp", "name": "XRP", "current_price": 0.612, "market_cap": 34000000000, "market_cap_rank": 6, "price_change_percentage_24h": 1.1, "total_volume": 1100000000, "high_24h": 0.62, "low_24h": 0.6, "image": "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png"},
    {"id": "usd-coin", "symbol": "usdc", "name": "USD Coin", "current_price": 1.0, "market_cap": 33000000000, "market_cap_rank": 7, "price_change_percentage_24h": 0.0, "total_volume": 5000000000, "high_24h": 1.001, "low_24h": 0.999, "image": "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png"},
    {"id": "dogecoin", "symbol": "doge", "name": "Dogecoin", "current_price": 0.158, "market_cap": 22000000000, "market_cap_rank": 8, "price_change_percentage_24h": 5.6, "total_volume": 1400000000, "high_24h": 0.164, "low_24h": 0.149, "image": "https://assets.coingecko.com/coins/images/5/large/dogecoin.png"},
    {"id": "cardano", "symbol": "ada", "name": "Cardano", "current_price": 0.452, "market_cap": 16000000000, "market_cap_rank": 9, "price_change_percentage_24h": -1.3, "total_volume": 420000000, "high_24h": 0.46, "low_24h": 0.445, "image": "https://assets.coingecko.com/coins/images/975/large/cardano.png"},
    {"id": "tron", "symbol": "trx", "name": "TRON", "current_price": 0.128, "market_cap": 11000000000, "market_cap_rank": 10, "price_change_percentage_24h": 0.9, "total_volume": 320000000, "high_24h": 0.13, "low_24h": 0.126, "image": "https://assets.coingecko.com/coins/images/1094/large/tron-logo.png"},
    {"id": "avalanche-2", "symbol": "avax", "name": "Avalanche", "current_price": 36.2, "market_cap": 14000000000, "market_cap_rank": 11, "price_change_percentage_24h": 3.1, "total_volume": 480000000, "high_24h": 37, "low_24h": 35, "image": "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png"},
    {"id": "chainlink", "symbol": "link", "name": "Chainlink", "current_price": 14.8, "market_cap": 9000000000, "market_cap_rank": 12, "price_change_percentage_24h": 2.2, "total_volume": 380000000, "high_24h": 15.1, "low_24h": 14.3, "image": "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png"},
    {"id": "polkadot", "symbol": "dot", "name": "Polkadot", "current_price": 6.05, "market_cap": 8600000000, "market_cap_rank": 13, "price_change_percentage_24h": -0.6, "total_volume": 210000000, "high_24h": 6.2, "low_24h": 5.95, "image": "https://assets.coingecko.com/coins/images/12171/large/polkadot.png"},
    {"id": "matic-network", "symbol": "matic", "name": "Polygon", "current_price": 0.545, "market_cap": 5400000000, "market_cap_rank": 14, "price_change_percentage_24h": 1.7, "total_volume": 190000000, "high_24h": 0.56, "low_24h": 0.53, "image": "https://assets.coingecko.com/coins/images/4713/large/polygon.png"},
    {"id": "shiba-inu", "symbol": "shib", "name": "Shiba Inu", "current_price": 0.0000172, "market_cap": 10000000000, "market_cap_rank": 15, "price_change_percentage_24h": 6.8, "total_volume": 520000000, "high_24h": 0.0000181, "low_24h": 0.0000161, "image": "https://assets.coingecko.com/coins/images/11939/large/shiba.png"},
    {"id": "litecoin", "symbol": "ltc", "name": "Litecoin", "current_price": 72.4, "market_cap": 5400000000, "market_cap_rank": 16, "price_change_percentage_24h": 0.4, "total_volume": 340000000, "high_24h": 74, "low_24h": 71, "image": "https://assets.coingecko.com/coins/images/2/large/litecoin.png"},
    {"id": "uniswap", "symbol": "uni", "name": "Uniswap", "current_price": 7.85, "market_cap": 4700000000, "market_cap_rank": 17, "price_change_percentage_24h": 2.9, "total_volume": 160000000, "high_24h": 8.1, "low_24h": 7.6, "image": "https://assets.coingecko.com/coins/images/12504/large/uniswap-logo.png"},
    {"id": "pepe", "symbol": "pepe", "name": "Pepe", "current_price": 0.0000098, "market_cap": 4100000000, "market_cap_rank": 18, "price_change_percentage_24h": 8.4, "total_volume": 900000000, "high_24h": 0.0000105, "low_24h": 0.0000089, "image": "https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg"},
    {"id": "aptos", "symbol": "apt", "name": "Aptos", "current_price": 8.9, "market_cap": 4000000000, "market_cap_rank": 19, "price_change_percentage_24h": -2.1, "total_volume": 140000000, "high_24h": 9.2, "low_24h": 8.6, "image": "https://assets.coingecko.com/coins/images/26455/large/aptos_round.png"},
    {"id": "near", "symbol": "near", "name": "NEAR Protocol", "current_price": 5.2, "market_cap": 5600000000, "market_cap_rank": 20, "price_change_percentage_24h": 3.4, "total_volume": 230000000, "high_24h": 5.4, "low_24h": 5.0, "image": "https://assets.coingecko.com/coins/images/10365/large/near.jpg"},
]


async def fetch_markets() -> List[dict]:
    now = datetime.now(timezone.utc).timestamp()
    cached = _CACHE.get("markets")
    if cached and now - cached["ts"] < 45:
        return cached["data"]
    try:
        params = {"vs_currency": "usd", "order": "market_cap_desc", "per_page": 100,
                  "page": 1, "sparkline": "true", "price_change_percentage": "1h,24h,7d"}
        headers = {}
        key = os.environ.get("COINGECKO_API_KEY")
        if key:
            headers["x-cg-demo-api-key"] = key
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{CG_BASE}/coins/markets", params=params, headers=headers)
        if r.status_code == 200:
            data = r.json()
            _CACHE["markets"] = {"ts": now, "data": data}
            return data
        logger.warning(f"CoinGecko markets status {r.status_code}, using fallback/cache")
    except Exception as e:
        logger.warning(f"CoinGecko markets error {e}")
    if cached:
        return cached["data"]
    return FALLBACK_MARKETS


def gen_ohlc(base: float, days: int) -> List[list]:
    # deterministic-ish synthetic candles as fallback
    points = 60
    now = datetime.now(timezone.utc)
    step = max(1, days) * 24 * 3600 * 1000 // points
    out = []
    price = base * 0.96
    t = int(now.timestamp() * 1000) - step * points
    for _ in range(points):
        o = price
        change = (random.random() - 0.48) * base * 0.01
        c = max(0.0000001, o + change)
        h = max(o, c) * (1 + random.random() * 0.004)
        l = min(o, c) * (1 - random.random() * 0.004)
        out.append([t, round(o, 8), round(h, 8), round(l, 8), round(c, 8)])
        price = c
        t += step
    return out


async def fetch_ohlc(coin_id: str, days: int) -> List[list]:
    now = datetime.now(timezone.utc).timestamp()
    ck = f"ohlc:{coin_id}:{days}"
    cached = _CACHE.get(ck)
    if cached and now - cached["ts"] < 120:
        return cached["data"]
    try:
        headers = {}
        key = os.environ.get("COINGECKO_API_KEY")
        if key:
            headers["x-cg-demo-api-key"] = key
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{CG_BASE}/coins/{coin_id}/ohlc",
                            params={"vs_currency": "usd", "days": days}, headers=headers)
        if r.status_code == 200:
            data = r.json()
            if data:
                _CACHE[ck] = {"ts": now, "data": data}
                return data
    except Exception as e:
        logger.warning(f"CoinGecko ohlc error {e}")
    # fallback
    base = 100.0
    for m in (_CACHE.get("markets", {}).get("data") or FALLBACK_MARKETS):
        if m["id"] == coin_id:
            base = m["current_price"]
            break
    data = gen_ohlc(base, days)
    _CACHE[ck] = {"ts": now, "data": data}
    return data


# ================================================================== AUTH ROUTES
def gen_code() -> str:
    return f"{random.randint(0, 999999):06d}"


@api_router.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing and existing.get("is_verified"):
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مسجّل بالفعل")
    if not existing:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": body.name,
            "password_hash": hash_password(body.password), "role": "user",
            "is_verified": False, "frozen": False, "balances": {},
            "auth_provider": "password",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        await db.users.update_one({"email": email}, {"$set": {
            "name": body.name, "password_hash": hash_password(body.password)}})
    code = gen_code()
    await db.verification_codes.delete_many({"email": email})
    await db.verification_codes.insert_one({
        "email": email, "code": code,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
    })
    await send_email(to=email, subject="رمز تأكيد حسابك في AuraX",
                     html=verification_email_html(code))
    logger.info(f"Verification code for {email}: {code}")
    return {"status": "code_sent", "email": email}


@api_router.post("/auth/verify")
async def verify(body: VerifyIn):
    email = body.email.lower()
    rec = await db.verification_codes.find_one({"email": email}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="لا يوجد رمز، أعد الإرسال")
    exp = datetime.fromisoformat(rec["expires_at"])
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="انتهت صلاحية الرمز")
    if rec["code"] != body.code.strip():
        raise HTTPException(status_code=400, detail="رمز غير صحيح")
    await db.users.update_one({"email": email}, {"$set": {"is_verified": True}})
    await db.verification_codes.delete_many({"email": email})
    u = await db.users.find_one({"email": email}, {"_id": 0})
    token = create_access_token(u["user_id"], u["email"])
    return {"token": token, "user": public_user(u)}


@api_router.post("/auth/resend-code")
async def resend_code(body: ResendIn):
    email = body.email.lower()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    code = gen_code()
    await db.verification_codes.delete_many({"email": email})
    await db.verification_codes.insert_one({
        "email": email, "code": code,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()})
    await send_email(to=email, subject="رمز تأكيد حسابك في AuraX",
                     html=verification_email_html(code))
    logger.info(f"Resent code for {email}: {code}")
    return {"status": "code_sent"}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u or not u.get("password_hash") or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    if not u.get("is_verified"):
        raise HTTPException(status_code=403, detail="الحساب غير مفعّل، فعّل بريدك أولاً")
    if u.get("frozen"):
        raise HTTPException(status_code=403, detail="تم تجميد الحساب، تواصل مع الدعم")
    token = create_access_token(u["user_id"], u["email"])
    return {"token": token, "user": public_user(u)}


@api_router.post("/auth/google/session")
async def google_session(body: GoogleSessionIn):
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                            headers={"X-Session-ID": body.session_id})
        r.raise_for_status()
        data = r.json()
    except Exception:
        raise HTTPException(status_code=401, detail="فشل تسجيل الدخول عبر Google")
    email = data["email"].lower()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        u = {"user_id": user_id, "email": email, "name": data.get("name", ""),
             "picture": data.get("picture"), "role": "user", "is_verified": True,
             "frozen": False, "balances": {}, "auth_provider": "google",
             "created_at": datetime.now(timezone.utc).isoformat()}
        await db.users.insert_one(dict(u))
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": u["user_id"], "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()})
    if u.get("frozen"):
        raise HTTPException(status_code=403, detail="تم تجميد الحساب")
    return {"token": session_token, "user": public_user(u)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        await db.user_sessions.delete_many({"session_token": auth[7:]})
    return {"status": "ok"}


# ================================================================== CRYPTO ROUTES
@api_router.get("/crypto/markets")
async def crypto_markets():
    return await fetch_markets()


@api_router.get("/crypto/ticker")
async def crypto_ticker():
    data = await fetch_markets()
    return [{"symbol": m["symbol"].upper(), "id": m["id"], "price": m["current_price"],
             "change": m.get("price_change_percentage_24h") or 0} for m in data[:30]]


@api_router.get("/crypto/coin/{coin_id}")
async def crypto_coin(coin_id: str):
    data = await fetch_markets()
    for m in data:
        if m["id"] == coin_id:
            return m
    raise HTTPException(status_code=404, detail="العملة غير موجودة")


@api_router.get("/crypto/ohlc/{coin_id}")
async def crypto_ohlc(coin_id: str, days: int = 1):
    return await fetch_ohlc(coin_id, days)


# ================================================================== WALLET / ORDERS
@api_router.get("/wallet")
async def wallet(user: dict = Depends(get_current_user)):
    balances = user.get("balances", {})
    markets = await fetch_markets()
    price_map = {m["symbol"].upper(): m["current_price"] for m in markets}
    price_map["USDT"] = 1.0
    total = 0.0
    assets = []
    for cur, amt in balances.items():
        price = price_map.get(cur.upper(), 0)
        value = amt * price
        total += value
        assets.append({"currency": cur.upper(), "amount": amt, "value_usdt": round(value, 2)})
    assets.sort(key=lambda x: x["value_usdt"], reverse=True)
    return {"total_usdt": round(total, 2), "assets": assets}


@api_router.post("/wallet/demo-refill")
async def demo_refill(user: dict = Depends(get_current_user)):
    if user.get("frozen"):
        raise HTTPException(status_code=403, detail="الحساب مجمّد")
    new_amt = user.get("balances", {}).get("USDT", 0) + 10000
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$set": {"balances.USDT": new_amt}})
    return {"status": "ok", "usdt": new_amt}


@api_router.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    if user.get("frozen"):
        raise HTTPException(status_code=403, detail="الحساب مجمّد")
    markets = await fetch_markets()
    base_sym = body.pair.split("/")[0].upper()
    coin = next((m for m in markets if m["symbol"].upper() == base_sym), None)
    price = body.price if (body.order_type == "limit" and body.price) else (coin["current_price"] if coin else 0)
    if price <= 0:
        raise HTTPException(status_code=400, detail="سعر غير صالح")
    balances = user.get("balances", {})
    usdt = balances.get("USDT", 0)
    coin_bal = balances.get(base_sym, 0)
    cost = price * body.amount
    updates = {}
    if body.market == "spot":
        if body.side == "buy":
            if usdt < cost:
                raise HTTPException(status_code=400, detail="رصيد USDT غير كافٍ")
            updates[f"balances.USDT"] = round(usdt - cost, 8)
            updates[f"balances.{base_sym}"] = round(coin_bal + body.amount, 8)
        else:
            if coin_bal < body.amount:
                raise HTTPException(status_code=400, detail=f"رصيد {base_sym} غير كافٍ")
            updates[f"balances.{base_sym}"] = round(coin_bal - body.amount, 8)
            updates[f"balances.USDT"] = round(usdt + cost, 8)
    else:  # futures demo: margin = cost / leverage
        margin = cost / max(1, body.leverage)
        if usdt < margin:
            raise HTTPException(status_code=400, detail="هامش USDT غير كافٍ")
        updates[f"balances.USDT"] = round(usdt - margin, 8)
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    order = {"id": f"ord_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"],
             "pair": body.pair, "market": body.market, "side": body.side,
             "order_type": body.order_type, "price": price, "amount": body.amount,
             "leverage": body.leverage, "status": "filled",
             "created_at": datetime.now(timezone.utc).isoformat()}
    await db.orders.insert_one(dict(order))
    order.pop("_id", None)
    position = None
    if body.market == "futures":
        pmargin = (price * body.amount) / max(1, body.leverage)
        position = {"id": f"pos_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"],
                    "pair": body.pair, "symbol": base_sym, "side": body.side,
                    "entry_price": price, "amount": body.amount, "leverage": body.leverage,
                    "margin": round(pmargin, 8), "status": "open", "pnl": 0.0,
                    "opened_at": datetime.now(timezone.utc).isoformat()}
        await db.positions.insert_one(dict(position))
        position.pop("_id", None)
    return {"status": "filled", "order": order, "position": position}


@api_router.get("/positions")
async def list_positions(user: dict = Depends(get_current_user)):
    return await db.positions.find({"user_id": user["user_id"], "status": "open"}, {"_id": 0}).sort("opened_at", -1).to_list(100)


@api_router.get("/positions/history")
async def positions_history(user: dict = Depends(get_current_user)):
    return await db.positions.find({"user_id": user["user_id"], "status": "closed"}, {"_id": 0}).sort("closed_at", -1).to_list(100)


@api_router.post("/positions/{position_id}/close")
async def close_position(position_id: str, user: dict = Depends(get_current_user)):
    pos = await db.positions.find_one({"id": position_id, "user_id": user["user_id"], "status": "open"}, {"_id": 0})
    if not pos:
        raise HTTPException(status_code=404, detail="المركز غير موجود")
    markets = await fetch_markets()
    coin = next((m for m in markets if m["symbol"].upper() == pos["symbol"]), None)
    close_price = coin["current_price"] if coin else pos["entry_price"]
    if pos["side"] == "long":
        pnl = (close_price - pos["entry_price"]) * pos["amount"]
    else:
        pnl = (pos["entry_price"] - close_price) * pos["amount"]
    returned = max(0.0, pos["margin"] + pnl)
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    new_usdt = round(u.get("balances", {}).get("USDT", 0) + returned, 8)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"balances.USDT": new_usdt}})
    await db.positions.update_one({"id": position_id}, {"$set": {
        "status": "closed", "close_price": close_price, "pnl": round(pnl, 8),
        "closed_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "closed", "pnl": round(pnl, 8), "returned": round(returned, 8), "close_price": close_price}


@api_router.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    rows = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return rows


# ================================================================== VERIFICATION FEES
def effective_config(user: dict, s: dict) -> dict:
    return {
        "fee_amount": user.get("verification_fee_amount", s["verification_fee_amount"]),
        "currency": user.get("verification_currency", s["verification_currency"]),
        "message": user.get("verification_message", s["verification_message"]),
        "wallet_addresses": user.get("wallet_addresses") or s["wallet_addresses"],
        "networks": s["networks"],
    }


@api_router.get("/verification/config")
async def verification_config(user: dict = Depends(get_current_user)):
    s = await get_settings()
    cfg = effective_config(user, s)
    sub = await db.fee_submissions.find_one({"user_id": user["user_id"]}, {"_id": 0},
                                            sort=[("created_at", -1)])
    cfg["submission"] = sub
    return cfg


async def auto_verify_task(sub_id: str, user_id: str, delay: int):
    try:
        await asyncio.sleep(max(3, delay))
        await db.fee_submissions.update_one({"id": sub_id}, {"$set": {"status": "verified"}})
        await db.users.update_one({"user_id": user_id}, {"$set": {"fee_verified": True}})
        await ws_manager.broadcast({"type": "notification", "ntype": "system",
                                    "message": "تمت معالجة طلب تحقق جديد والموافقة عليه تلقائياً"})
    except Exception as e:
        logger.error(f"auto_verify error {e}")


@api_router.post("/verification/submit")
async def submit_fee(body: SubmitFeeIn, user: dict = Depends(get_current_user)):
    rec = {"id": f"fee_{uuid.uuid4().hex[:10]}", "user_id": user["user_id"],
           "email": user["email"], "network": body.network, "txid": body.txid,
           "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.fee_submissions.insert_one(dict(rec))
    rec.pop("_id", None)
    s = await get_settings()
    auto = bool(s.get("auto_verify_enabled"))
    if auto:
        asyncio.create_task(auto_verify_task(rec["id"], user["user_id"], int(s.get("auto_verify_delay", 20))))
    return {"status": "pending", "submission": rec, "auto": auto}


# ================================================================== NOTIFICATIONS
@api_router.get("/notifications")
async def notifications():
    rows = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return rows


@api_router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


# ================================================================== ADMIN
@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    verified = await db.users.count_documents({"is_verified": True})
    pending_fees = await db.fee_submissions.count_documents({"status": "pending"})
    orders = await db.orders.count_documents({})
    s = await get_settings()
    return {"total_users": total_users, "verified_users": verified,
            "pending_fees": pending_fees, "total_orders": orders, "settings": s}


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(get_admin_user)):
    rows = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return rows


@api_router.get("/admin/users/{user_id}")
async def admin_user_detail(user_id: str, admin: dict = Depends(get_admin_user)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    s = await get_settings()
    u["effective_config"] = effective_config(u, s)
    return u


@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdate, admin: dict = Depends(get_admin_user)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    sets = {}
    balances = u.get("balances", {})
    if body.add_balance_currency and body.add_balance_amount is not None:
        cur = body.add_balance_currency.upper()
        sets[f"balances.{cur}"] = round(balances.get(cur, 0) + body.add_balance_amount, 8)
    if body.set_balance_currency and body.set_balance_amount is not None:
        cur = body.set_balance_currency.upper()
        sets[f"balances.{cur}"] = round(body.set_balance_amount, 8)
    for f in ["verification_fee_amount", "verification_currency", "verification_message",
              "wallet_addresses", "frozen", "is_verified", "fee_verified", "role"]:
        val = getattr(body, f)
        if val is not None:
            sets[f] = val
    if sets:
        await db.users.update_one({"user_id": user_id}, {"$set": sets})
    u2 = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    await log_admin(admin, "update_user", user_id, u2.get("email"),
                    {k: str(v)[:120] for k, v in sets.items()})
    return public_user(u2) | {"verification_fee_amount": u2.get("verification_fee_amount"),
                              "verification_message": u2.get("verification_message"),
                              "wallet_addresses": u2.get("wallet_addresses")}


@api_router.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(get_admin_user)):
    return await get_settings()


@api_router.put("/admin/settings")
async def admin_put_settings(body: SettingsUpdate, admin: dict = Depends(get_admin_user)):
    await get_settings()
    sets = {k: v for k, v in body.model_dump().items() if v is not None}
    if sets:
        await db.settings.update_one({"_id": "global"}, {"$set": sets})
    await log_admin(admin, "update_settings", None, None, {k: str(v)[:120] for k, v in sets.items()})
    return await get_settings()


@api_router.get("/admin/fee-submissions")
async def admin_fee_subs(admin: dict = Depends(get_admin_user)):
    return await db.fee_submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.patch("/admin/fee-submissions/{sub_id}")
async def admin_update_fee(sub_id: str, status: str, admin: dict = Depends(get_admin_user)):
    sub = await db.fee_submissions.find_one({"id": sub_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    await db.fee_submissions.update_one({"id": sub_id}, {"$set": {"status": status}})
    if status == "verified":
        await db.users.update_one({"user_id": sub["user_id"]}, {"$set": {"fee_verified": True}})
    await log_admin(admin, f"fee_{status}", sub.get("user_id"), sub.get("email"), {"txid": sub.get("txid")})
    return {"status": "ok"}


@api_router.get("/admin/logs")
async def admin_get_logs(admin: dict = Depends(get_admin_user)):
    return await db.admin_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/notifications")
async def admin_broadcast(body: BroadcastIn, admin: dict = Depends(get_admin_user)):
    rec = {"id": f"ntf_{uuid.uuid4().hex[:10]}", "ntype": body.ntype, "message": body.message,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.notifications.insert_one(dict(rec))
    rec.pop("_id", None)
    await ws_manager.broadcast({"type": "notification", "ntype": rec["ntype"], "message": rec["message"]})
    await log_admin(admin, "broadcast", None, None, {"ntype": body.ntype, "message": body.message[:120]})
    return rec


# ================================================================== STARTUP
@api_router.get("/")
async def root():
    return {"message": "AuraX API", "status": "ok"}


@api_router.get("/download/platform")
async def download_platform():
    path = ROOT_DIR.parent / "aurax-full-platform.zip"
    if not path.exists():
        raise HTTPException(status_code=404, detail="الملف غير متوفر")
    return FileResponse(str(path), media_type="application/zip", filename="aurax-full-platform.zip")


@api_router.get("/download/admin")
async def download_admin():
    path = ROOT_DIR.parent / "aurax-admin-panel.zip"
    if not path.exists():
        raise HTTPException(status_code=404, detail="الملف غير متوفر")
    return FileResponse(str(path), media_type="application/zip", filename="aurax-admin-panel.zip")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token")
    await get_settings()
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@aurax.io").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": admin_email,
            "name": "AuraX Admin", "password_hash": hash_password(admin_pw),
            "role": "admin", "is_verified": True, "frozen": False,
            "balances": {"USDT": 0}, "auth_provider": "password",
            "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info("Admin seeded")
    elif not verify_password(admin_pw, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_pw), "role": "admin"}})
    # seed a couple of market notifications
    if await db.notifications.count_documents({}) == 0:
        seeds = [
            {"ntype": "market", "message": "إدراج جديد: تم إضافة زوج تداول جديد على AuraX"},
            {"ntype": "deposit", "message": "قام مستخدم بإيداع 5,000 USDT عبر شبكة TRC20"},
            {"ntype": "system", "message": "مرحباً بك في منصة AuraX للتداول"},
        ]
        for s in seeds:
            s["id"] = f"ntf_{uuid.uuid4().hex[:10]}"
            s["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.notifications.insert_one(s)
    asyncio.create_task(sim_events())


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
