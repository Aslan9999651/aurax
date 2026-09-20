import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { useCrypto, fmtPrice, fmtNum } from "../context/CryptoContext";

const TABS = ["الكل", "USDT", "Layer 1", "Meme", "DeFi"];
const CATS = {
  "Layer 1": ["bitcoin", "ethereum", "solana", "cardano", "avalanche-2", "near", "aptos", "tron", "polkadot"],
  Meme: ["dogecoin", "shiba-inu", "pepe"],
  DeFi: ["uniswap", "chainlink", "aave"],
};

function Spark({ data }) {
  if (!data?.length) return <div className="w-24 h-8" />;
  const pts = data.slice(-24);
  const min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
  const up = pts[pts.length - 1] >= pts[0];
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 96},${32 - ((v - min) / rng) * 30}`).join(" ");
  return (
    <svg width="96" height="32" className="hidden sm:block">
      <polyline points={d} fill="none" stroke={up ? "#00C076" : "#FF3B5C"} strokeWidth="1.5" />
    </svg>
  );
}

export default function Markets() {
  const { markets } = useCrypto();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("الكل");
  const nav = useNavigate();

  let list = markets;
  if (CATS[tab]) list = markets.filter((m) => CATS[tab].includes(m.id));
  if (q) list = list.filter((m) => m.symbol.toLowerCase().includes(q.toLowerCase()) || m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-heading text-2xl lg:text-3xl font-extrabold">الأسواق</h1>
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ax-text3)]" />
          <input data-testid="markets-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن عملة…"
            className="w-full bg-[var(--ax-s1)] border border-[var(--ax-border)] rounded-xl py-2.5 pr-9 pl-3 text-sm focus:border-[var(--ax-cyan)] outline-none" />
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} data-testid={`market-tab-${t}`}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${tab === t ? "btn-cyan font-semibold" : "bg-[var(--ax-s1)] text-[var(--ax-text2)] hover:bg-[var(--ax-s2)]"}`}>{t}</button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--ax-text3)] text-xs border-b border-[var(--ax-border)]">
                <th className="text-right font-medium px-4 py-3">#</th>
                <th className="text-right font-medium px-4 py-3">الزوج</th>
                <th className="text-left font-medium px-4 py-3">السعر</th>
                <th className="text-left font-medium px-4 py-3">تغير 24س</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">أعلى/أدنى 24س</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">حجم 24س</th>
                <th className="text-center font-medium px-4 py-3 hidden sm:table-cell">مخطط</th>
                <th className="text-center font-medium px-4 py-3">تداول</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, i) => {
                const chg = m.price_change_percentage_24h || 0;
                return (
                  <tr key={m.id} className="border-b border-[var(--ax-border)] hover:bg-[var(--ax-s2)] transition-colors" data-testid={`market-row-${m.id}`}>
                    <td className="px-4 py-3 text-[var(--ax-text3)]">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <img src={m.image} alt="" className="w-7 h-7 rounded-full" />
                        <div>
                          <div className="font-heading font-semibold">{m.symbol.toUpperCase()}<span className="text-[var(--ax-text3)] text-xs">/USDT</span></div>
                          <div className="text-xs text-[var(--ax-text3)]">{m.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left mono">${fmtPrice(m.live_price)}</td>
                    <td className={`px-4 py-3 text-left mono ${chg >= 0 ? "text-green" : "text-red"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-left mono text-xs text-[var(--ax-text2)] hidden md:table-cell">${fmtPrice(m.high_24h)}<br />${fmtPrice(m.low_24h)}</td>
                    <td className="px-4 py-3 text-left mono text-[var(--ax-text2)] hidden lg:table-cell">${fmtNum(m.total_volume)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="flex justify-center"><Spark data={m.sparkline_in_7d?.price} /></div></td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => nav(`/spot?coin=${m.id}`)} data-testid={`trade-btn-${m.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-cyan">تداول</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <div className="text-center py-12 text-[var(--ax-text3)]">لا توجد نتائج</div>}
      </div>
    </div>
  );
}
