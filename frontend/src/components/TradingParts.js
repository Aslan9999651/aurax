import React, { useEffect, useMemo, useState } from "react";
import { fmtPrice } from "../context/CryptoContext";

export function useOrderBook(price) {
  return useMemo(() => {
    if (!price) return { asks: [], bids: [] };
    const mk = (base, sign) => Array.from({ length: 12 }).map((_, i) => {
      const p = base * (1 + sign * (i + 1) * 0.0006 + (Math.random() - 0.5) * 0.0002);
      const amt = Math.random() * 4 + 0.05;
      return { price: p, amount: amt, total: p * amt };
    });
    return { asks: mk(price, 1).reverse(), bids: mk(price, -1) };
  }, [price ? Math.round(price * 100) : 0]);
}

export function OrderBook({ price, onPick }) {
  const { asks, bids } = useOrderBook(price);
  const maxTotal = Math.max(...[...asks, ...bids].map((r) => r.total), 1);
  const Row = ({ r, side, i }) => (
    <button onClick={() => onPick?.(r.price)} data-testid={`orderbook-${side}-row-${i}`}
      className="relative w-full grid grid-cols-3 text-xs py-[3px] px-3 hover:bg-[var(--ax-s2)]">
      <span className="absolute inset-y-0 left-0" style={{ width: `${(r.total / maxTotal) * 100}%`, background: side === "ask" ? "rgba(255,59,92,0.10)" : "rgba(0,192,118,0.10)" }} />
      <span className={`relative mono text-right ${side === "ask" ? "text-red" : "text-green"}`}>{fmtPrice(r.price)}</span>
      <span className="relative mono text-left text-[var(--ax-text2)]">{r.amount.toFixed(4)}</span>
      <span className="relative mono text-left text-[var(--ax-text3)]">{r.total.toFixed(2)}</span>
    </button>
  );
  return (
    <div className="panel overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[var(--ax-border)] text-xs font-semibold">سجل الأوامر</div>
      <div className="grid grid-cols-3 text-[10px] text-[var(--ax-text3)] px-3 py-1.5 border-b border-[var(--ax-border)]">
        <span className="text-right">السعر</span><span className="text-left">الكمية</span><span className="text-left">الإجمالي</span>
      </div>
      <div>{asks.map((r, i) => <Row key={i} r={r} side="ask" i={i} />)}</div>
      <div className="py-2 px-3 text-center mono font-bold text-cyan border-y border-[var(--ax-border)]">${fmtPrice(price)}</div>
      <div>{bids.map((r, i) => <Row key={i} r={r} side="bid" i={i} />)}</div>
    </div>
  );
}

export function RecentTrades({ price }) {
  const [trades, setTrades] = useState([]);
  useEffect(() => {
    setTrades([]);
    const iv = setInterval(() => {
      if (!price) return;
      const buy = Math.random() > 0.5;
      const t = { price: price * (1 + (Math.random() - 0.5) * 0.001), amount: Math.random() * 2 + 0.01, buy, time: new Date().toLocaleTimeString("en-GB") };
      setTrades((p) => [t, ...p].slice(0, 22));
    }, 1200);
    return () => clearInterval(iv);
  }, [price ? Math.round(price) : 0]);
  return (
    <div className="panel overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[var(--ax-border)] text-xs font-semibold">أحدث الصفقات</div>
      <div className="grid grid-cols-3 text-[10px] text-[var(--ax-text3)] px-3 py-1.5 border-b border-[var(--ax-border)]">
        <span className="text-right">السعر</span><span className="text-left">الكمية</span><span className="text-left">الوقت</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {trades.map((t, i) => (
          <div key={i} className="grid grid-cols-3 text-xs py-[3px] px-3">
            <span className={`mono text-right ${t.buy ? "text-green" : "text-red"}`}>{fmtPrice(t.price)}</span>
            <span className="mono text-left text-[var(--ax-text2)]">{t.amount.toFixed(4)}</span>
            <span className="mono text-left text-[var(--ax-text3)]">{t.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
