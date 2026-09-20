import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Copy, Check, Wallet, ChevronLeft, Clock, BadgeCheck } from "lucide-react";
import api, { apiErr } from "../lib/api";

export default function VerificationFees() {
  const [cfg, setCfg] = useState(null);
  const [step, setStep] = useState(1); // 1=info, 2=addresses
  const [network, setNetwork] = useState(null);
  const [txid, setTxid] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => { try { const { data } = await api.get("/verification/config"); setCfg(data); } catch (e) { toast.error(apiErr(e.response?.data?.detail)); } };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const iv = setInterval(() => { api.get("/verification/config").then(({ data }) => setCfg(data)).catch(() => {}); }, 6000);
    return () => clearInterval(iv);
  }, []);

  const networks = cfg?.networks?.filter((n) => cfg.wallet_addresses?.[n.id]) || [];
  const activeAddr = network ? cfg?.wallet_addresses?.[network] : null;

  const copy = () => { navigator.clipboard.writeText(activeAddr || ""); setCopied(true); toast.success("تم نسخ العنوان"); setTimeout(() => setCopied(false), 1500); };

  const submit = async () => {
    if (!network) { toast.error("اختر الشبكة"); return; }
    if (!txid.trim()) { toast.error("أدخل رقم عملية التحويل TXID"); return; }
    setBusy(true);
    try { await api.post("/verification/submit", { network, txid: txid.trim() }); toast.success("تم استلام طلبك، سيتم التحقق قريباً"); setTxid(""); await load(); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (!cfg) return <div className="p-10 text-center text-[var(--ax-text3)]">جاري التحميل…</div>;

  const sub = cfg.submission;

  return (
    <div className="max-w-[820px] mx-auto px-4 lg:px-6 py-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[var(--ax-s2)] flex items-center justify-center text-[var(--ax-amber)]"><ShieldCheck /></div>
        <div>
          <h1 className="font-heading text-2xl font-extrabold">رسوم التحقق</h1>
          <p className="text-xs text-[var(--ax-text3)]">تفعيل الحساب والسحب الكامل</p>
        </div>
      </div>

      {sub && (
        <div className="panel p-4 mb-4 flex items-center gap-3" data-testid="fee-status">
          {sub.status === "verified" ? <BadgeCheck className="text-green" /> : <Clock className="text-[var(--ax-amber)]" />}
          <div className="text-sm">
            <div className="font-semibold">{sub.status === "verified" ? "تم التحقق بنجاح" : "طلبك قيد المراجعة"}</div>
            <div className="text-xs text-[var(--ax-text3)] mono">TXID: {sub.txid} — {sub.network}</div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="panel p-6 fade-up">
          <div className="rounded-xl bg-[var(--ax-s2)] p-5 mb-5">
            <div className="text-sm text-[var(--ax-text3)] mb-1">مبلغ رسوم التحقق المطلوب</div>
            <div className="font-heading text-4xl font-extrabold mono text-[var(--ax-amber)]">
              {cfg.fee_amount} <span className="text-xl text-[var(--ax-text2)]">{cfg.currency}</span>
            </div>
          </div>
          <p className="text-sm text-[var(--ax-text2)] leading-relaxed mb-6 whitespace-pre-line" data-testid="fee-message">{cfg.message}</p>
          <button onClick={() => setStep(2)} data-testid="pay-fees-btn"
            className="w-full py-3 rounded-xl btn-cyan font-semibold flex items-center justify-center gap-2">
            دفع الرسوم <ChevronLeft size={18} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="panel p-6 fade-up">
          <button onClick={() => setStep(1)} className="text-xs text-[var(--ax-text3)] mb-4">→ رجوع</button>
          <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Wallet size={16} className="text-cyan" /> اختر الشبكة والعملة</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
            {networks.map((n) => (
              <button key={n.id} onClick={() => setNetwork(n.id)} data-testid={`network-${n.id}`}
                className={`px-3 py-2.5 rounded-lg text-sm border ${network === n.id ? "border-[var(--ax-cyan)] bg-[var(--ax-s2)] text-cyan" : "border-[var(--ax-border)] text-[var(--ax-text2)] hover:bg-[var(--ax-s2)]"}`}>
                {n.name}
              </button>
            ))}
            {!networks.length && <div className="col-span-3 text-sm text-[var(--ax-text3)]">لم يتم ضبط عناوين المحافظ بعد.</div>}
          </div>

          {activeAddr && (
            <div className="fade-up">
              <div className="flex flex-col items-center gap-3 mb-4">
                <img alt="qr" className="w-40 h-40 rounded-xl bg-white p-2" src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(activeAddr)}`} />
                <div className="text-xs text-[var(--ax-text3)]">امسح الرمز أو انسخ العنوان أدناه</div>
              </div>
              <div className="text-xs text-[var(--ax-text3)] mb-1">عنوان الإيداع ({network})</div>
              <div className="flex items-center gap-2 bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg p-3 mb-1">
                <span className="mono text-xs break-all flex-1" data-testid="deposit-address">{activeAddr}</span>
                <button onClick={copy} data-testid="copy-address-btn" className="p-2 rounded-lg bg-[var(--ax-s3)] hover:bg-[var(--ax-border-active)]">
                  {copied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="text-[11px] text-[var(--ax-amber)] mb-5">أرسل بالضبط {cfg.fee_amount} {cfg.currency} إلى هذا العنوان عبر شبكة {network} فقط.</div>

              <div className="border-t border-[var(--ax-border)] pt-5">
                <div className="text-sm font-semibold mb-2">تأكيد الدفع</div>
                <label className="block mb-3">
                  <span className="text-xs text-[var(--ax-text3)]">رقم عملية التحويل (TXID)</span>
                  <input data-testid="txid-input" value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="ألصق رقم العملية هنا"
                    className="w-full mt-1 bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-3 py-2.5 mono text-sm outline-none focus:border-[var(--ax-cyan)]" />
                </label>
                <button onClick={submit} disabled={busy} data-testid="submit-txid-btn" className="w-full py-3 rounded-xl btn-cyan font-semibold disabled:opacity-60">
                  {busy ? "جارٍ الإرسال…" : "لقد أتممت الدفع"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
