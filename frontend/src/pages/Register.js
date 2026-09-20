import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { apiErr } from "../lib/api";

export default function Register() {
  const { applyAuth } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [stage, setStage] = useState(params.get("verify") ? "verify" : "form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("verify") || "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const doRegister = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/register", { name, email, password });
      toast.success("أرسلنا رمز التأكيد إلى بريدك");
      setStage("verify");
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const doVerify = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/verify", { email, code });
      applyAuth(data);
      toast.success("تم تفعيل حسابك بنجاح");
      nav("/wallet");
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    try { await api.post("/auth/resend-code", { email }); toast.success("تم إرسال رمز جديد"); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "radial-gradient(circle at 70% 20%,rgba(0,229,255,0.06),transparent 40%)" }}>
      <div className="w-full max-w-md panel p-8 fade-up">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-heading font-extrabold text-[#041016]" style={{ background: "linear-gradient(135deg,#00E5FF,#00B8CC)" }}>A</div>
          <span className="font-heading text-xl font-extrabold">Aura<span className="text-cyan">X</span></span>
        </Link>

        {stage === "form" ? (
          <>
            <h1 className="font-heading text-2xl font-bold text-center mb-1">إنشاء حساب</h1>
            <p className="text-sm text-[var(--ax-text3)] text-center mb-6">ابدأ التداول على AuraX خلال دقيقة</p>
            <form onSubmit={doRegister} className="space-y-3">
              <input data-testid="register-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم"
                className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-4 py-3 text-sm outline-none focus:border-[var(--ax-cyan)]" />
              <input data-testid="register-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني"
                className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-4 py-3 text-sm outline-none focus:border-[var(--ax-cyan)]" />
              <input data-testid="register-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور"
                className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-4 py-3 text-sm outline-none focus:border-[var(--ax-cyan)]" />
              <button type="submit" disabled={busy} data-testid="register-submit" className="w-full py-3 rounded-lg btn-cyan font-semibold disabled:opacity-60">
                {busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
              </button>
            </form>
            <p className="text-center text-sm text-[var(--ax-text3)] mt-6">لديك حساب؟ <Link to="/login" className="text-cyan font-semibold">سجّل الدخول</Link></p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-3"><div className="w-12 h-12 rounded-xl bg-[var(--ax-s2)] flex items-center justify-center text-cyan"><MailCheck /></div></div>
            <h1 className="font-heading text-2xl font-bold text-center mb-1">تأكيد البريد</h1>
            <p className="text-sm text-[var(--ax-text3)] text-center mb-6">أدخل الرمز المكوّن من 6 أرقام المُرسل إلى<br /><span className="text-[var(--ax-text2)]">{email}</span></p>
            <form onSubmit={doVerify} className="space-y-3">
              <input data-testid="verify-code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="______" maxLength={6}
                className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-4 py-3 text-center mono text-2xl tracking-[0.5em] outline-none focus:border-[var(--ax-cyan)]" />
              <button type="submit" disabled={busy} data-testid="verify-submit" className="w-full py-3 rounded-lg btn-cyan font-semibold disabled:opacity-60">
                {busy ? "جارٍ التأكيد…" : "تأكيد وتفعيل"}
              </button>
            </form>
            <button onClick={resend} data-testid="resend-code" className="w-full text-center text-sm text-cyan mt-4">إعادة إرسال الرمز</button>
          </>
        )}
      </div>
    </div>
  );
}
