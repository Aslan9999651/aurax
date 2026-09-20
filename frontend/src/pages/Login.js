import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import api, { apiErr } from "../lib/api";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function googleLogin() {
  const redirectUrl = window.location.origin + "/wallet";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function Login() {
  const { applyAuth } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      applyAuth(data);
      toast.success("مرحباً بعودتك");
      nav(data.user.role === "admin" ? "/admin" : "/wallet");
    } catch (e) {
      const msg = apiErr(e.response?.data?.detail);
      toast.error(msg);
      if (e.response?.status === 403 && msg.includes("مفعّل")) nav(`/register?verify=${encodeURIComponent(email)}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "radial-gradient(circle at 30% 20%,rgba(0,229,255,0.06),transparent 40%)" }}>
      <div className="w-full max-w-md panel p-8 fade-up">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-heading font-extrabold text-[#041016]" style={{ background: "linear-gradient(135deg,#00E5FF,#00B8CC)" }}>A</div>
          <span className="font-heading text-xl font-extrabold">Aura<span className="text-cyan">X</span></span>
        </Link>
        <h1 className="font-heading text-2xl font-bold text-center mb-1">تسجيل الدخول</h1>
        <p className="text-sm text-[var(--ax-text3)] text-center mb-6">أهلاً بك مجدداً في AuraX</p>
        <form onSubmit={submit} className="space-y-3">
          <input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني"
            className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-4 py-3 text-sm outline-none focus:border-[var(--ax-cyan)]" />
          <input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور"
            className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-4 py-3 text-sm outline-none focus:border-[var(--ax-cyan)]" />
          <button type="submit" disabled={busy} data-testid="login-submit" className="w-full py-3 rounded-lg btn-cyan font-semibold disabled:opacity-60">
            {busy ? "جارٍ الدخول…" : "دخول"}
          </button>
        </form>
        <div className="flex items-center gap-3 my-4 text-xs text-[var(--ax-text3)]"><div className="flex-1 h-px bg-[var(--ax-border)]" />أو<div className="flex-1 h-px bg-[var(--ax-border)]" /></div>
        <button onClick={googleLogin} data-testid="google-login-btn" className="w-full py-3 rounded-lg bg-white text-[#111] font-semibold text-sm flex items-center justify-center gap-2">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4" /> المتابعة عبر Google
        </button>
        <p className="text-center text-sm text-[var(--ax-text3)] mt-6">ليس لديك حساب؟ <Link to="/register" className="text-cyan font-semibold">أنشئ حساباً</Link></p>
      </div>
    </div>
  );
}
