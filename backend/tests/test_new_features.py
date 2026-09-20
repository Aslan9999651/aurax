"""AuraX new features tests - positions PnL, admin logs, auto-verify, WebSocket."""
import os
import re
import time
import uuid
import json
import asyncio
import subprocess
import pytest
import requests
import websockets

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://aurax-trading.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

ADMIN_EMAIL = "admin@aurax.io"
ADMIN_PASSWORD = "AuraX@Admin2026"


def _grep_code(email: str) -> str:
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


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_headers(session):
    r = session.post(f"{API}/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def user_ctx(session):
    email = f"newf_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    r = session.post(f"{API}/auth/register",
                     json={"name": "NF User", "email": email, "password": password})
    assert r.status_code == 200
    time.sleep(0.6)
    code = _grep_code(email)
    assert code
    v = session.post(f"{API}/auth/verify", json={"email": email, "code": code})
    assert v.status_code == 200
    return {"email": email, "token": v.json()["token"], "user_id": v.json()["user"]["user_id"]}


@pytest.fixture(scope="module")
def user_headers(user_ctx):
    return {"Authorization": f"Bearer {user_ctx['token']}", "Content-Type": "application/json"}


# ==================================================== POSITIONS / FUTURES CLOSE
class TestPositions:
    def test_open_long_position_and_response_shape(self, session, user_headers):
        session.post(f"{API}/wallet/demo-refill", headers=user_headers)
        r = session.post(f"{API}/orders", headers=user_headers, json={
            "pair": "ETH/USDT", "market": "futures", "side": "long",
            "order_type": "market", "amount": 0.2, "leverage": 20})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "filled"
        pos = body.get("position")
        assert pos is not None
        for k in ("id", "entry_price", "margin", "side", "amount"):
            assert k in pos
        assert pos["side"] == "long"

    def test_list_open_positions(self, session, user_headers):
        r = session.get(f"{API}/positions", headers=user_headers)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        assert all(p["status"] == "open" for p in rows)

    def test_close_long_credits_margin_and_pnl(self, session, user_headers):
        # Open fresh long
        session.post(f"{API}/wallet/demo-refill", headers=user_headers)
        w_before = session.get(f"{API}/wallet", headers=user_headers).json()
        usdt_before = next((a["amount"] for a in w_before["assets"] if a["currency"] == "USDT"), 0)

        r = session.post(f"{API}/orders", headers=user_headers, json={
            "pair": "BTC/USDT", "market": "futures", "side": "long",
            "order_type": "market", "amount": 0.01, "leverage": 10})
        assert r.status_code == 200
        pos = r.json()["position"]
        pos_id = pos["id"]

        # After open, USDT should have decreased by margin
        w_mid = session.get(f"{API}/wallet", headers=user_headers).json()
        usdt_mid = next((a["amount"] for a in w_mid["assets"] if a["currency"] == "USDT"), 0)
        assert usdt_mid == pytest.approx(usdt_before - pos["margin"], rel=1e-4)

        # Close
        c = session.post(f"{API}/positions/{pos_id}/close", headers=user_headers)
        assert c.status_code == 200, c.text
        d = c.json()
        assert d["status"] == "closed"
        assert "pnl" in d and "returned" in d and "close_price" in d

        # USDT should be back roughly at usdt_before +/- small pnl
        w_after = session.get(f"{API}/wallet", headers=user_headers).json()
        usdt_after = next((a["amount"] for a in w_after["assets"] if a["currency"] == "USDT"), 0)
        assert usdt_after == pytest.approx(usdt_mid + d["returned"], rel=1e-4)

    def test_open_and_close_short(self, session, user_headers):
        session.post(f"{API}/wallet/demo-refill", headers=user_headers)
        r = session.post(f"{API}/orders", headers=user_headers, json={
            "pair": "ETH/USDT", "market": "futures", "side": "short",
            "order_type": "market", "amount": 0.05, "leverage": 5})
        assert r.status_code == 200, r.text
        pos = r.json()["position"]
        assert pos["side"] == "short"

        c = session.post(f"{API}/positions/{pos['id']}/close", headers=user_headers)
        assert c.status_code == 200
        assert c.json()["status"] == "closed"

    def test_positions_history_lists_closed(self, session, user_headers):
        r = session.get(f"{API}/positions/history", headers=user_headers)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert any(p.get("status") == "closed" for p in rows)

    def test_close_non_existent_returns_404(self, session, user_headers):
        r = session.post(f"{API}/positions/pos_nonexistent/close", headers=user_headers)
        assert r.status_code == 404


# ==================================================== ADMIN AUDIT LOGS
class TestAdminLogs:
    def test_logs_endpoint(self, session, admin_headers):
        r = session.get(f"{API}/admin/logs", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_actions_create_logs(self, session, admin_headers, user_ctx):
        # 1) update user (add balance)
        r = session.patch(f"{API}/admin/users/{user_ctx['user_id']}", headers=admin_headers,
                          json={"add_balance_currency": "USDT", "add_balance_amount": 10})
        assert r.status_code == 200

        # 2) put settings
        s_get = session.get(f"{API}/admin/settings", headers=admin_headers).json()
        r = session.put(f"{API}/admin/settings", headers=admin_headers,
                        json={"verification_fee_amount": s_get["verification_fee_amount"]})
        assert r.status_code == 200

        # 3) broadcast
        marker = f"AUDIT_TEST_{uuid.uuid4().hex[:6]}"
        r = session.post(f"{API}/admin/notifications", headers=admin_headers,
                         json={"ntype": "system", "message": marker})
        assert r.status_code == 200

        logs = session.get(f"{API}/admin/logs", headers=admin_headers).json()
        assert len(logs) >= 3
        actions = [l["action"] for l in logs[:20]]
        assert "update_user" in actions
        assert "update_settings" in actions
        assert "broadcast" in actions
        # newest first
        assert any(l["action"] == "broadcast" and marker in json.dumps(l.get("details", {}))
                   for l in logs[:10])
        # ensure required fields
        for l in logs[:5]:
            for k in ("admin_email", "action", "created_at"):
                assert k in l
            assert l["admin_email"] == ADMIN_EMAIL


# ==================================================== AUTO DEPOSIT VERIFICATION
class TestAutoVerify:
    def test_auto_verify_flow(self, session, admin_headers, user_headers, user_ctx):
        # Enable auto verify with short delay
        r = session.put(f"{API}/admin/settings", headers=admin_headers,
                        json={"auto_verify_enabled": True, "auto_verify_delay": 4})
        assert r.status_code == 200
        st = r.json()
        assert st["auto_verify_enabled"] is True
        assert st["auto_verify_delay"] == 4

        try:
            # submit as user
            r = session.post(f"{API}/verification/submit", headers=user_headers,
                             json={"network": "TRC20", "txid": "0xabc_auto_test"})
            assert r.status_code == 200
            body = r.json()
            assert body["status"] == "pending"
            assert body["auto"] is True
            sub_id = body["submission"]["id"]

            # wait for auto-verify
            time.sleep(7)

            cfg = session.get(f"{API}/verification/config", headers=user_headers).json()
            assert cfg["submission"]["id"] == sub_id
            assert cfg["submission"]["status"] == "verified", cfg["submission"]

            me = session.get(f"{API}/auth/me", headers=user_headers).json()
            assert me["fee_verified"] is True

            # Manual path: create new sub with auto disabled, verify via admin patch
        finally:
            # ALWAYS restore auto verify to false so we don't affect other tests
            session.put(f"{API}/admin/settings", headers=admin_headers,
                        json={"auto_verify_enabled": False})

    def test_manual_verify_path(self, session, admin_headers, session_fixture=None):
        # Register a new user to test manual verify (previous user already fee_verified)
        # Ensure auto is off
        r = session.put(f"{API}/admin/settings", headers=admin_headers,
                        json={"auto_verify_enabled": False})
        assert r.status_code == 200

        email = f"manv_{uuid.uuid4().hex[:8]}@example.com"
        s = session.post(f"{API}/auth/register",
                        json={"name": "Manual User", "email": email, "password": "Pass1234!"})
        assert s.status_code == 200
        time.sleep(0.6)
        code = _grep_code(email)
        v = session.post(f"{API}/auth/verify", json={"email": email, "code": code})
        assert v.status_code == 200
        uhdr = {"Authorization": f"Bearer {v.json()['token']}", "Content-Type": "application/json"}
        uid = v.json()["user"]["user_id"]

        r = session.post(f"{API}/verification/submit", headers=uhdr,
                         json={"network": "ERC20", "txid": "manual_tx"})
        assert r.status_code == 200
        body = r.json()
        assert body["auto"] is False
        sub_id = body["submission"]["id"]

        r = session.patch(f"{API}/admin/fee-submissions/{sub_id}?status=verified",
                          headers=admin_headers)
        assert r.status_code == 200

        me = session.get(f"{API}/auth/me", headers=uhdr).json()
        assert me["fee_verified"] is True


# ==================================================== WEBSOCKET
@pytest.mark.asyncio
async def test_websocket_receives_broadcast():
    # Get admin token synchronously first
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    ah = {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}

    try:
        async with websockets.connect(WS_URL, open_timeout=15) as ws:
            # trigger broadcast
            marker = f"WS_TEST_{uuid.uuid4().hex[:6]}"
            await asyncio.sleep(0.5)
            resp = requests.post(f"{API}/admin/notifications", headers=ah,
                                 json={"ntype": "system", "message": marker})
            assert resp.status_code == 200

            # try to receive our marker within a short window
            got = False
            end = time.time() + 8
            while time.time() < end:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=8)
                    data = json.loads(msg)
                    if data.get("type") == "notification" and marker in data.get("message", ""):
                        got = True
                        break
                except asyncio.TimeoutError:
                    break
            assert got, "WebSocket did not receive admin broadcast within window"
    except Exception as e:
        pytest.fail(f"WebSocket connect/receive failed: {e}")
