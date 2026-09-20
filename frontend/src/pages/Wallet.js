import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Repeat, Plus, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { apiErr } from "../lib/api";
import { fmtPrice } from "../context/CryptoContext";

export default function Wallet() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [hideZero, setHideZero] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [w, o] = await Promise.all([api.get("/wallet"), api.get("/orders")]);
      setData(w.data); setOrders(o.data);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const refill = async () => {
    setBusy(true);
    try { await api.post("/wallet/demo-refill"); toast.success("تم إضافة 10,000 USDT تجريبي"); await Promise.all([load(), refresh()]); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const assets = (data?.assets || []).filter((a) => !hideZero || a.amount > 0);

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-6 py-8">
      <h1 className="font-heading text-2xl lg:text-3xl font-extrabold mb-6">الأصول والمحفظة</h1>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="panel p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-44 h-44 rounded-full" style={{ background: "radial-gradient(circle,rgba(0,229,255,0.12),transparent 70%)" }} />
          <div className="text-sm text-[var(--ax-text3)]">إجمالي قيمة الأصول</div>
          <div className="font-heading text-4xl font-extrabold mono mt-1">${fmtPrice(data?.total_usdt || 0)}</div>
          <div className="text-[var(--ax-text2)] text-sm mono mt-1">≈ {fmtPrice(data?.total_usdt || 0)} USDT</div>
          <div className="flex flex-wrap gap-2 mt-6">
            <Link to="/verification-fees" data-testid="wallet-deposit-btn" className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-cyan text-sm font-semibold"><ArrowDownToLine size={16} /> إيداع</Link>
            <Link to="/verification-fees" data-testid="wallet-withdraw-btn" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ax-s2)] hover:bg-[var(--ax-s3)] text-sm font-semibold"><ArrowUpFromLine size={16} /> سحب</Link>
            <Link to="/spot" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ax-s2)] hover:bg-[var(--ax-s3)] text-sm font-semibold"><Repeat size={16} /> تحويل</Link>
            <button onClick={refill} disabled={busy} data-testid="wallet-demo-refill" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ax-s2)] hover:bg-[var(--ax-s3)] text-sm font-semibold disabled:opacity-60"><Plus size={16} /> رصيد تجريبي</button>
          </div>
        </div>
        <div className="panel p-6 flex flex-col justify-center gap-3" style={{ background: "linear-gradient(135deg,rgba(255,184,0,0.06),transparent)" }}>
          <ShieldCheck className="text-[var(--ax-amber)]" />
          <div className="font-heading font-bold">تفعيل السحب الكامل</div>
          <p className="text-sm text-[var(--ax-text2)]">أكمل رسوم التحقق لتفعيل عمليات السحب على حسابك.</p>
          <Link to="/verification-fees" data-testid="wallet-verify-link" className="text-cyan text-sm font-semibold">اذهب إلى رسوم التحقق ←</Link>
        </div>
      </div>

      <div className="panel overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ax-border)]">
          <div className="font-semibold text-sm">أصولي</div>
          <button onClick={() => setHideZero((v) => !v)} data-testid="toggle-zero" className="flex items-center gap-1.5 text-xs text-[var(--ax-text3)]">
            {hideZero ? <EyeOff size={14} /> : <Eye size={14} />} إخفاء الأرصدة الصفرية
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--ax-text3)] text-xs border-b border-[var(--ax-border)]">
            <th className="text-right font-medium px-4 py-2.5">العملة</th>
            <th className="text-left font-medium px-4 py-2.5">الرصيد</th>
            <th className="text-left font-medium px-4 py-2.5">القيمة (USDT)</th>
          </tr></thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.currency} className="border-b border-[var(--ax-border)]" data-testid={`asset-${a.currency}`}>
                <td className="px-4 py-3 font-heading font-semibold">{a.currency}</td>
                <td className="px-4 py-3 text-left mono">{a.amount}</td>
                <td className="px-4 py-3 text-left mono text-[var(--ax-text2)]">${fmtPrice(a.value_usdt)}</td>
              </tr>
            ))}
            {!assets.length && <tr><td colSpan="3" className="text-center py-8 text-[var(--ax-text3)]">لا توجد أصول بعد</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--ax-border)] font-semibold text-sm">سجل الأوامر</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[var(--ax-text3)] text-xs border-b border-[var(--ax-border)]">
              <th className="text-right font-medium px-4 py-2.5">الزوج</th><th className="text-right font-medium px-4 py-2.5">النوع</th>
              <th className="text-right font-medium px-4 py-2.5">الجهة</th><th className="text-left font-medium px-4 py-2.5">السعر</th>
              <th className="text-left font-medium px-4 py-2.5">الكمية</th><th className="text-left font-medium px-4 py-2.5">الوقت</th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[var(--ax-border)]">
                  <td className="px-4 py-3 font-heading font-semibold">{o.pair}</td>
                  <td className="px-4 py-3 text-[var(--ax-text2)]">{o.market === "spot" ? "فوري" : `آجل ${o.leverage}x`}</td>
                  <td className={`px-4 py-3 ${["buy", "long"].includes(o.side) ? "text-green" : "text-red"}`}>{{ buy: "شراء", sell: "بيع", long: "Long", short: "Short" }[o.side]}</td>
                  <td className="px-4 py-3 text-left mono">${fmtPrice(o.price)}</td>
                  <td className="px-4 py-3 text-left mono">{o.amount}</td>
                  <td className="px-4 py-3 text-left mono text-xs text-[var(--ax-text3)]">{new Date(o.created_at).toLocaleString("en-GB")}</td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan="6" className="text-center py-8 text-[var(--ax-text3)]">لا توجد أوامر بعد</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
