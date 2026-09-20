import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { useCrypto, fmtPrice, fmtNum } from "../context/CryptoContext";
import { useAuth } from "../context/AuthContext";
import api, { apiErr } from "../lib/api";
import CandleChart from "../components/CandleChart";
import { OrderBook, RecentTrades } from "../components/TradingParts";

export default function Futures() {
  const { markets, getCoin, getBySymbol } = useCrypto();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const coinId = new URLSearchParams(loc.search).get("coin") || "bitcoin";
  const coin = getCoin(coinId) || markets[0];

  const [candles, setCandles] = useState([]);
  const [margin, setMargin] = useState("cross");
  const [leverage, setLeverage] = useState(20);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(3600);
  const [positions, setPositions] = useState([]);

  const loadPositions = async () => { try { const { data } = await api.get("/positions"); setPositions(data); } catch { /* noop */ } };
  useEffect(() => { if (user) loadPositions(); }, [user]);

  const closePos = async (id) => {
    try {
      const { data } = await api.post(`/positions/${id}/close`);
      const win = data.pnl >= 0;
      toast[win ? "success" : "error"](`تم إغلاق المركز — ${win ? "ربح" : "خسارة"} ${fmtPrice(Math.abs(data.pnl))} USDT`);
      await Promise.all([loadPositions(), refresh()]);
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };

  const pnlOf = (p) => {
    const cur = getBySymbol(p.symbol)?.live_price ?? p.entry_price;
    const raw = p.side === "long" ? (cur - p.entry_price) * p.amount : (p.entry_price - cur) * p.amount;
    return { pnl: raw, cur, roe: p.margin ? (raw / p.margin) * 100 : 0 };
  };

  useEffect(() => {
    if (!coin) return;
    let on = true;
    (async () => { try { const { data } = await api.get(`/crypto/ohlc/${coin.id}?days=1`); if (on) setCandles(data); } catch {} })();
    return () => { on = false; };
  }, [coin?.id]);

  useEffect(() => { const iv = setInterval(() => setCountdown((c) => (c <= 0 ? 3600 : c - 1)), 1000); return () => clearInterval(iv); }, []);

  const live = coin?.live_price;
  const sym = coin?.symbol?.toUpperCase() || "";
  const chg = coin?.price_change_percentage_24h || 0;
  const usdt = user?.balances?.USDT || 0;

  const openPos = async (dir) => {
    if (!user) { nav("/login"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("أدخل حجم العقد"); return; }
    setBusy(true);
    try {
      await api.post("/orders", { pair: `${sym}/USDT`, market: "futures", side: dir, order_type: "market", amount: parseFloat(amount), leverage });
      toast.success(`تم فتح صفقة ${dir === "long" ? "شراء (Long)" : "بيع (Short)"} برافعة ${leverage}x`);
      setAmount(""); await refresh(); await loadPositions();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const liqLong = live ? live * (1 - 1 / leverage) : 0;
  const liqShort = live ? live * (1 + 1 / leverage) : 0;
  const mm = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(countdown % 60).padStart(2, "0")}`;

  if (!coin) return <div className="p-10 text-center text-[var(--ax-text3)]">جاري التحميل…</div>;

  return (
    <div className="max-w-[1400px] mx-auto px-2 lg:px-4 py-4">
      <div className="panel px-4 py-3 mb-2 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="flex items-center gap-2.5">
          <img src={coin.image} alt="" className="w-8 h-8 rounded-full" />
          <div><div className="font-heading font-bold">{sym}/USDT <span className="text-[10px] bg-[var(--ax-s3)] px-1.5 py-0.5 rounded text-[var(--ax-amber)]">دائم</span></div><div className="text-xs text-[var(--ax-text3)]">عقود آجلة</div></div>
        </div>
        <div><div className="text-[10px] text-[var(--ax-text3)]">السعر</div><div className={`mono font-bold ${chg >= 0 ? "text-green" : "text-red"}`}>${fmtPrice(live)}</div></div>
        <div><div className="text-[10px] text-[var(--ax-text3)]">تغير 24س</div><div className={`mono ${chg >= 0 ? "text-green" : "text-red"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</div></div>
        <div className="flex items-center gap-1.5 text-[var(--ax-amber)]"><Timer size={15} /><div><div className="text-[10px] text-[var(--ax-text3)]">التمويل القادم</div><div className="mono text-sm">{mm}</div></div></div>
        <select value={coin.id} onChange={(e) => nav(`/futures?coin=${e.target.value}`)} data-testid="futures-pair-select" className="mr-auto bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-3 py-2 text-sm outline-none">
          {markets.slice(0, 60).map((m) => <option key={m.id} value={m.id}>{m.symbol.toUpperCase()}/USDT</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-2">
        <div className="space-y-2">
          <div className="panel p-3"><CandleChart candles={candles} height={360} /></div>
          <div className="panel p-4">
            <div className="flex gap-2 mb-3">
              {[["cross", "متقاطع"], ["isolated", "منفصل"]].map(([v, l]) => (
                <button key={v} onClick={() => setMargin(v)} data-testid={`futures-margin-${v}`} className={`px-3 py-1.5 rounded text-xs ${margin === v ? "bg-[var(--ax-s2)] text-cyan" : "text-[var(--ax-text3)]"}`}>{l}</button>
              ))}
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1"><span className="text-[var(--ax-text3)]">الرافعة المالية</span><span className="mono text-cyan font-bold">{leverage}x</span></div>
              <input type="range" min="1" max="125" value={leverage} onChange={(e) => setLeverage(+e.target.value)} data-testid="futures-leverage" className="w-full accent-[var(--ax-cyan)]" />
              <div className="flex justify-between text-[10px] text-[var(--ax-text3)] mono mt-1"><span>1x</span><span>25x</span><span>50x</span><span>75x</span><span>125x</span></div>
            </div>
            <label className="block mb-3">
              <span className="text-xs text-[var(--ax-text3)]">حجم العقد ({sym})</span>
              <input data-testid="futures-amount-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full mt-1 bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-3 py-2 mono text-sm outline-none focus:border-[var(--ax-cyan)]" />
            </label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
              <div className="flex justify-between"><span className="text-[var(--ax-text3)]">تصفية Long</span><span className="mono text-red">${fmtPrice(liqLong)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--ax-text3)]">تصفية Short</span><span className="mono text-red">${fmtPrice(liqShort)}</span></div>
              <div className="flex justify-between col-span-2"><span className="text-[var(--ax-text3)]">هامش متاح</span><span className="mono">{fmtPrice(usdt)} USDT</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openPos("long")} disabled={busy} data-testid="futures-long-btn" className="py-2.5 rounded-lg font-semibold text-sm bg-[var(--ax-green)] text-[#041016] disabled:opacity-60">فتح شراء / Long</button>
              <button onClick={() => openPos("short")} disabled={busy} data-testid="futures-short-btn" className="py-2.5 rounded-lg font-semibold text-sm bg-[var(--ax-red)] text-white disabled:opacity-60">فتح بيع / Short</button>
            </div>
          </div>
        </div>
        <div className="grid grid-rows-2 gap-2" style={{ minHeight: 560 }}>
          <OrderBook price={live} />
          <RecentTrades price={live} />
        </div>
      </div>

      {/* Open positions */}
      <div className="panel overflow-hidden mt-2" data-testid="positions-panel">
        <div className="px-4 py-3 border-b border-[var(--ax-border)] text-sm font-semibold flex items-center justify-between">
          <span>المراكز المفتوحة</span>
          <span className="text-xs text-[var(--ax-text3)] mono">{positions.length} مركز</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[var(--ax-text3)] text-xs border-b border-[var(--ax-border)]">
              <th className="text-right font-medium px-4 py-2.5">الزوج</th>
              <th className="text-right font-medium px-4 py-2.5">الجهة</th>
              <th className="text-left font-medium px-4 py-2.5">حجم</th>
              <th className="text-left font-medium px-4 py-2.5">سعر الدخول</th>
              <th className="text-left font-medium px-4 py-2.5">السعر الحالي</th>
              <th className="text-left font-medium px-4 py-2.5">الهامش</th>
              <th className="text-left font-medium px-4 py-2.5">الربح/الخسارة (لحظي)</th>
              <th className="text-center font-medium px-4 py-2.5">إغلاق</th>
            </tr></thead>
            <tbody>
              {positions.map((p) => {
                const { pnl, cur, roe } = pnlOf(p);
                const win = pnl >= 0;
                return (
                  <tr key={p.id} className="border-b border-[var(--ax-border)]" data-testid={`position-${p.id}`}>
                    <td className="px-4 py-3 font-heading font-semibold">{p.pair} <span className="text-[10px] text-[var(--ax-amber)]">{p.leverage}x</span></td>
                    <td className={`px-4 py-3 ${p.side === "long" ? "text-green" : "text-red"}`}>{p.side === "long" ? "Long" : "Short"}</td>
                    <td className="px-4 py-3 text-left mono">{p.amount}</td>
                    <td className="px-4 py-3 text-left mono text-[var(--ax-text2)]">${fmtPrice(p.entry_price)}</td>
                    <td className="px-4 py-3 text-left mono text-[var(--ax-text2)]">${fmtPrice(cur)}</td>
                    <td className="px-4 py-3 text-left mono text-[var(--ax-text2)]">{fmtPrice(p.margin)}</td>
                    <td className={`px-4 py-3 text-left mono ${win ? "text-green" : "text-red"}`}>{win ? "+" : ""}{fmtPrice(pnl)} <span className="text-xs">({win ? "+" : ""}{roe.toFixed(1)}%)</span></td>
                    <td className="px-4 py-3 text-center"><button onClick={() => closePos(p.id)} data-testid={`close-position-${p.id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--ax-s3)] hover:bg-[var(--ax-border-active)]">إغلاق</button></td>
                  </tr>
                );
              })}
              {!positions.length && <tr><td colSpan="8" className="text-center py-8 text-[var(--ax-text3)]">لا توجد مراكز مفتوحة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
