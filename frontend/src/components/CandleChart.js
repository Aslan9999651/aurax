import React, { useMemo } from "react";

// candles: [[t,o,h,l,c], ...]
export default function CandleChart({ candles = [], height = 360 }) {
  const data = useMemo(() => candles.slice(-80), [candles]);
  if (!data.length) {
    return <div className="flex items-center justify-center text-[var(--ax-text3)]" style={{ height }}>جاري تحميل المخطط…</div>;
  }
  const W = 900, H = height, padL = 8, padR = 62, padT = 12, padB = 22;
  const highs = data.map((d) => d[2]);
  const lows = data.map((d) => d[3]);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const cw = plotW / data.length;
  const bodyW = Math.max(2, cw * 0.6);

  const yOf = (v) => padT + (1 - (v - min) / range) * plotH;
  const fmt = (v) => (v >= 1000 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(6));

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const val = min + range * (1 - p);
    return { y: padT + p * plotH, val };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="#1E293B" strokeWidth="1" strokeDasharray="2 4" />
          <text x={W - padR + 4} y={g.y + 3} fill="#64748B" fontSize="10" fontFamily="JetBrains Mono">{fmt(g.val)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const [, o, h, l, c] = d;
        const x = padL + i * cw + cw / 2;
        const up = c >= o;
        const color = up ? "#00C076" : "#FF3B5C";
        const yO = yOf(o), yC = yOf(c);
        const top = Math.min(yO, yC);
        const bh = Math.max(1, Math.abs(yC - yO));
        return (
          <g key={i}>
            <line x1={x} y1={yOf(h)} x2={x} y2={yOf(l)} stroke={color} strokeWidth="1" />
            <rect x={x - bodyW / 2} y={top} width={bodyW} height={bh} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
