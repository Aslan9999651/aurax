"""AuraX Backend API tests - covers auth, crypto, wallet, orders, verification, admin."""
import os
import re
import time
import uuid
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://aurax-trading.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@aurax.io"
ADMIN_PASSWORD = "AuraX@Admin2026"

# ----------------------------- helpers
def _grep_code(email: str) -> str:
    """Fetch the latest verification code from backend logs."""
    for path in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
        try:
            out = subprocess.run(["grep", f"Verification code for {email}", path],
                                 capture_output=True, text=True).stdout
            if out:
                lines = out.strip().splitlines()
                m = re.search(r":\s*(\d{6})\s*$", lines[-1])
                if m:
                    return m.group(1)
        except Exception:
            pass
    # fallback: any backend log
    try:
        out = subprocess.run(
            ["bash", "-c", f"grep 'Verification code for {email}' /var/log/supervisor/backend.*.log | tail -n1"],
            capture_output=True, text=True).stdout
        m = re.search(r":\s*(\d{6})", out)
        if m:
            return m.group(1)
    except Exception:
        pass
    return ""


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def user_ctx(session):
    """Register+verify a fresh user, return dict {email, token, user_id}."""
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    r = session.post(f"{API}/auth/register",
                     json={"name": "Test User", "email": email, "password": password})
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "code_sent"

    # Try login before verify -> 403 expected
    lg = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert lg.status_code == 403, f"Expected 403 pre-verification, got {lg.status_code}"

    time.sleep(0.5)
    code = _grep_code(email)
    assert code, f"No verification code found in backend logs for {email}"

    v = session.post(f"{API}/auth/verify", json={"email": email, "code": code})
    assert v.status_code == 200, v.text
    body = v.json()
    assert "token" in body and "user" in body
    return {"email": email, "password": password, "token": body["token"],
            "user_id": body["user"]["user_id"]}


@pytest.fixture(scope="session")
def user_headers(user_ctx):
    return {"Authorization": f"Bearer {user_ctx['token']}", "Content-Type": "application/json"}


# ============================================================ AUTH TESTS
class TestAuth:
    def test_register_verify_and_me(self, session, user_ctx, user_headers):
        r = session.get(f"{API}/auth/me", headers=user_headers)
        assert r.status_code == 200
        assert r.json()["email"] == user_ctx["email"]
        assert r.json()["is_verified"] is True

    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login",
                         json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_requires_auth(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# ============================================================ CRYPTO
class TestCrypto:
    def test_markets(self, session):
        r = session.get(f"{API}/crypto/markets")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 20
        assert "current_price" in data[0]

    def test_ticker(self, session):
        r = session.get(f"{API}/crypto/ticker")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert {"symbol", "price"}.issubset(data[0].keys())

    def test_ohlc(self, session):
        r = session.get(f"{API}/crypto/ohlc/bitcoin?days=1")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert len(data[0]) == 5


# ============================================================ WALLET / ORDERS
class TestWalletOrders:
    def test_wallet_requires_auth(self, session):
        assert session.get(f"{API}/wallet").status_code == 401

    def test_wallet_get_and_refill(self, session, user_headers):
        r = session.get(f"{API}/wallet", headers=user_headers)
        assert r.status_code == 200
        before = r.json()
        assert "total_usdt" in before and "assets" in before

        r = session.post(f"{API}/wallet/demo-refill", headers=user_headers)
        assert r.status_code == 200
        assert r.json()["usdt"] >= 10000

        r2 = session.get(f"{API}/wallet", headers=user_headers)
        usdt_asset = next((a for a in r2.json()["assets"] if a["currency"] == "USDT"), None)
        assert usdt_asset and usdt_asset["amount"] >= 10000

    def test_spot_buy_sell(self, session, user_headers):
        # Ensure balance
        session.post(f"{API}/wallet/demo-refill", headers=user_headers)
        # Buy 0.01 BTC
        r = session.post(f"{API}/orders", headers=user_headers,
                         json={"pair": "BTC/USDT", "market": "spot",
                               "side": "buy", "order_type": "market", "amount": 0.01})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "filled"

        w = session.get(f"{API}/wallet", headers=user_headers).json()
        btc = next((a for a in w["assets"] if a["currency"] == "BTC"), None)
        assert btc and btc["amount"] >= 0.01

        # Sell 0.005 BTC
        r = session.post(f"{API}/orders", headers=user_headers,
                         json={"pair": "BTC/USDT", "market": "spot",
                               "side": "sell", "order_type": "market", "amount": 0.005})
        assert r.status_code == 200, r.text

    def test_futures_long(self, session, user_headers):
        session.post(f"{API}/wallet/demo-refill", headers=user_headers)
        r = session.post(f"{API}/orders", headers=user_headers,
                         json={"pair": "ETH/USDT", "market": "futures",
                               "side": "long", "order_type": "market",
                               "amount": 0.1, "leverage": 10})
        assert r.status_code == 200, r.text

    def test_insufficient_balance(self, session, user_headers):
        r = session.post(f"{API}/orders", headers=user_headers,
                         json={"pair": "BTC/USDT", "market": "spot",
                               "side": "buy", "order_type": "market",
                               "amount": 1000000})
        assert r.status_code == 400


# ============================================================ VERIFICATION FEES
class TestVerification:
    def test_config_requires_auth(self, session):
        assert session.get(f"{API}/verification/config").status_code == 401

    def test_get_config(self, session, user_headers):
        r = session.get(f"{API}/verification/config", headers=user_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("fee_amount", "currency", "message", "wallet_addresses", "networks"):
            assert k in d
        assert isinstance(d["networks"], list) and len(d["networks"]) > 0
        assert "TRC20" in d["wallet_addresses"]

    def test_submit_fee(self, session, user_headers):
        r = session.post(f"{API}/verification/submit", headers=user_headers,
                         json={"network": "TRC20", "txid": f"tx_{uuid.uuid4().hex[:10]}"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "pending"
        assert d["submission"]["network"] == "TRC20"


# ============================================================ ADMIN
class TestAdmin:
    def test_admin_auth_required(self, session, user_headers):
        assert session.get(f"{API}/admin/stats").status_code == 401
        assert session.get(f"{API}/admin/stats", headers=user_headers).status_code == 403

    def test_stats(self, session, admin_headers):
        r = session.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        for k in ("total_users", "verified_users", "pending_fees", "total_orders", "settings"):
            assert k in r.json()

    def test_users_list_and_detail(self, session, admin_headers, user_ctx):
        r = session.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert any(u["user_id"] == user_ctx["user_id"] for u in r.json())

        r = session.get(f"{API}/admin/users/{user_ctx['user_id']}", headers=admin_headers)
        assert r.status_code == 200
        assert "effective_config" in r.json()

    def test_add_balance_reflects(self, session, admin_headers, user_headers, user_ctx):
        before = session.get(f"{API}/wallet", headers=user_headers).json()
        before_usdt = next((a["amount"] for a in before["assets"] if a["currency"] == "USDT"), 0)

        r = session.patch(f"{API}/admin/users/{user_ctx['user_id']}", headers=admin_headers,
                          json={"add_balance_currency": "USDT", "add_balance_amount": 500})
        assert r.status_code == 200

        after = session.get(f"{API}/wallet", headers=user_headers).json()
        after_usdt = next((a["amount"] for a in after["assets"] if a["currency"] == "USDT"), 0)
        assert after_usdt == pytest.approx(before_usdt + 500, rel=1e-4)

    def test_per_user_fee_override(self, session, admin_headers, user_headers, user_ctx):
        new_fee = 123.45
        custom_msg = "رسالة مخصصة للاختبار"
        custom_wallets = {"TRC20": "TCustomAddressForTestingOverride1234"}
        r = session.patch(f"{API}/admin/users/{user_ctx['user_id']}", headers=admin_headers,
                          json={"verification_fee_amount": new_fee,
                                "verification_message": custom_msg,
                                "wallet_addresses": custom_wallets})
        assert r.status_code == 200

        cfg = session.get(f"{API}/verification/config", headers=user_headers).json()
        assert cfg["fee_amount"] == new_fee
        assert cfg["message"] == custom_msg
        assert cfg["wallet_addresses"]["TRC20"] == custom_wallets["TRC20"]

    def test_settings_update(self, session, admin_headers):
        r = session.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        orig = r.json()

        new_fee = float(orig["verification_fee_amount"]) + 1
        r = session.put(f"{API}/admin/settings", headers=admin_headers,
                        json={"verification_fee_amount": new_fee})
        assert r.status_code == 200
        assert r.json()["verification_fee_amount"] == new_fee

        # restore
        session.put(f"{API}/admin/settings", headers=admin_headers,
                    json={"verification_fee_amount": orig["verification_fee_amount"]})

    def test_fee_submissions_and_update(self, session, admin_headers, user_headers):
        sub = session.post(f"{API}/verification/submit", headers=user_headers,
                           json={"network": "ERC20", "txid": "tx_admin_verify_flow"}).json()
        sub_id = sub["submission"]["id"]

        r = session.get(f"{API}/admin/fee-submissions", headers=admin_headers)
        assert r.status_code == 200
        assert any(s["id"] == sub_id for s in r.json())

        r = session.patch(f"{API}/admin/fee-submissions/{sub_id}?status=verified",
                          headers=admin_headers)
        assert r.status_code == 200

    def test_broadcast(self, session, admin_headers):
        r = session.post(f"{API}/admin/notifications", headers=admin_headers,
                         json={"ntype": "system", "message": "TEST broadcast"})
        assert r.status_code == 200
        assert r.json()["message"] == "TEST broadcast"
