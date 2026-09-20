import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useCrypto, fmtPrice, fmtNum } from "../context/CryptoContext";
import { useAuth } from "../context/AuthContext";
import api, { apiErr } from "../lib/api";
import CandleChart from "../components/CandleChart";
import { OrderBook, RecentTrades } from "../components/TradingParts";

const TIMEFRAMES = [["1م", 1], ["5د", 1], ["15د", 1], ["1س", 1], ["4س", 7], ["1ي", 30]];

export default function Spot() {
  const { markets, getCoin } = useCrypto();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const coinId = new URLSearchParams(loc.search).get("coin") || "bitcoin";
  const coin = getCoin(coinId) || markets[0];

  const [candles, setCandles] = useState([]);
  const [days, setDays] = useState(1);
  const [tf, setTf] = useState(0);
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("market");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!coin) return;
    let on = true;
    (async () => {
      try { const { data } = await api.get(`/crypto/ohlc/${coin.id}?days=${days}`); if (on) setCandles(data); } catch {}
    })();
    return () => { on = false; };
  }, [coin?.id, days]);

  const live = coin?.live_price;
  useEffect(() => { if (orderType === "market" && live) setPrice(""); }, [orderType]);

  const effPrice = orderType === "limit" && price ? parseFloat(price) : live;
  const chg = coin?.price_change_percentage_24h || 0;
  const sym = coin?.symbol?.toUpperCase() || "";
  const usdt = user?.balances?.USDT || 0;
  const coinBal = user?.balances?.[sym] || 0;

  const setPct = (p) => {
    if (side === "buy") { if (effPrice) setAmount(((usdt * p) / effPrice).toFixed(6)); }
    else setAmount((coinBal * p).toFixed(6));
  };

  const submit = async () => {
    if (!user) { nav("/login"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("أدخل الكمية"); return; }
    setBusy(true);
    try {
      await api.post("/orders", { pair: `${sym}/USDT`, market: "spot", side, order_type: orderType, price: orderType === "limit" ? parseFloat(price) : null, amount: parseFloat(amount) });
      toast.success(`تم تنفيذ أمر ${side === "buy" ? "الشراء" : "البيع"} بنجاح`);
      setAmount(""); await refresh();
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (!coin) return <div className="p-10 text-center text-[var(--ax-text3)]">جاري التحميل…</div>;

  return (
    <div className="max-w-[1400px] mx-auto px-2 lg:px-4 py-4">
      {/* pair header */}
      <div className="panel px-4 py-3 mb-2 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="flex items-center gap-2.5">
          <img src={coin.image} alt="" className="w-8 h-8 rounded-full" />
          <div>
            <div className="font-heading font-bold">{sym}/USDT</div>
            <div className="text-xs text-[var(--ax-text3)]">{coin.name}</div>
          </div>
        </div>
        <div><div className="text-[10px] text-[var(--ax-text3)]">السعر</div><div className={`mono font-bold ${chg >= 0 ? "text-green" : "text-red"}`}>${fmtPrice(live)}</div></div>
        <div><div className="text-[10px] text-[var(--ax-text3)]">تغير 24س</div><div className={`mono ${chg >= 0 ? "text-green" : "text-red"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</div></div>
        <div className="hidden sm:block"><div className="text-[10px] text-[var(--ax-text3)]">أعلى 24س</div><div className="mono text-[var(--ax-text2)]">${fmtPrice(coin.high_24h)}</div></div>
        <div className="hidden sm:block"><div className="text-[10px] text-[var(--ax-text3)]">أدنى 24س</div><div className="mono text-[var(--ax-text2)]">${fmtPrice(coin.low_24h)}</div></div>
        <div className="hidden md:block"><div className="text-[10px] text-[var(--ax-text3)]">حجم 24س</div><div className="mono text-[var(--ax-text2)]">${fmtNum(coin.total_volume)}</div></div>
        <select value={coin.id} onChange={(e) => nav(`/spot?coin=${e.target.value}`)} data-testid="spot-pair-select"
          className="mr-auto bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-3 py-2 text-sm outline-none">
          {markets.slice(0, 60).map((m) => <option key={m.id} value={m.id}>{m.symbol.toUpperCase()}/USDT</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-2">
        <div className="space-y-2">
          {/* chart */}
          <div className="panel p-3">
            <div className="flex gap-1 mb-2">
              {TIMEFRAMES.map(([lbl, d], i) => (
                <button key={i} onClick={() => { setTf(i); setDays(d); }} data-testid={`tf-${i}`}
                  className={`px-2.5 py-1 rounded text-xs ${tf === i ? "bg-[var(--ax-s3)] text-cyan" : "text-[var(--ax-text3)] hover:text-[var(--ax-text)]"}`}>{lbl}</button>
              ))}
            </div>
            <CandleChart candles={candles} height={340} />
          </div>
          {/* trade panel */}
          <div className="panel p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setSide("buy")} data-testid="spot-side-buy" className={`py-2 rounded-lg text-sm font-semibold ${side === "buy" ? "bg-[var(--ax-green)] text-[#041016]" : "bg-[var(--ax-s2)] text-[var(--ax-text2)]"}`}>شراء</button>
              <button onClick={() => setSide("sell")} data-testid="spot-side-sell" className={`py-2 rounded-lg text-sm font-semibold ${side === "sell" ? "bg-[var(--ax-red)] text-white" : "bg-[var(--ax-s2)] text-[var(--ax-text2)]"}`}>بيع</button>
            </div>
            <div className="flex gap-2 mb-3 text-xs">
              {["market", "limit"].map((t) => (
                <button key={t} onClick={() => setOrderType(t)} data-testid={`spot-type-${t}`}
                  className={`px-3 py-1.5 rounded ${orderType === t ? "text-cyan bg-[var(--ax-s2)]" : "text-[var(--ax-text3)]"}`}>{t === "market" ? "سوق" : "محدد"}</button>
              ))}
            </div>
            {orderType === "limit" && (
              <label className="block mb-2">
                <span className="text-xs text-[var(--ax-text3)]">السعر (USDT)</span>
                <input data-testid="spot-price-input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={fmtPrice(live)}
                  className="w-full mt-1 bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-3 py-2 mono text-sm outline-none focus:border-[var(--ax-cyan)]" />
              </label>
            )}
            <label className="block mb-2">
              <span className="text-xs text-[var(--ax-text3)]">الكمية ({sym})</span>
              <input data-testid="spot-amount-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="w-full mt-1 bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-3 py-2 mono text-sm outline-none focus:border-[var(--ax-cyan)]" />
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {[0.25, 0.5, 0.75, 1].map((p) => (
                <button key={p} onClick={() => setPct(p)} data-testid={`spot-pct-${p * 100}`} className="py-1.5 rounded bg-[var(--ax-s2)] hover:bg-[var(--ax-s3)] text-xs mono">{p * 100}%</button>
              ))}
            </div>
            <div className="text-xs text-[var(--ax-text3)] mb-3 flex justify-between">
              <span>الرصيد المتاح</span>
              <span className="mono">{side === "buy" ? `${fmtPrice(usdt)} USDT` : `${coinBal} ${sym}`}</span>
            </div>
            <button onClick={submit} disabled={busy} data-testid="spot-submit-btn"
              className={`w-full py-2.5 rounded-lg font-semibold text-sm ${side === "buy" ? "bg-[var(--ax-green)] text-[#041016]" : "bg-[var(--ax-red)] text-white"} disabled:opacity-60`}>
              {busy ? "جارٍ التنفيذ…" : !user ? "سجّل الدخول للتداول" : `${side === "buy" ? "شراء" : "بيع"} ${sym}`}
            </button>
          </div>
        </div>

        <div className="grid grid-rows-2 gap-2" style={{ minHeight: 560 }}>
          <OrderBook price={live} onPick={(p) => { setOrderType("limit"); setPrice(fmtPrice(p)); }} />
          <RecentTrades price={live} />
        </div>
      </div>
    </div>
  );
}
