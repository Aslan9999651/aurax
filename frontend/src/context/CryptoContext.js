import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import api from "../lib/api";

const CryptoContext = createContext(null);
export const useCrypto = () => useContext(CryptoContext);

// live-ish prices: real base from backend + micro simulation ticks
export function CryptoProvider({ children }) {
  const [markets, setMarkets] = useState([]);
  const baseRef = useRef({}); // id -> real base price
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    try {
      const { data } = await api.get("/crypto/markets");
      const next = {};
      data.forEach((m) => { next[m.id] = m.current_price; });
      baseRef.current = next;
      setMarkets((prev) => {
        // preserve simulated live price direction
        return data.map((m) => {
          const old = prev.find((p) => p.id === m.id);
          return { ...m, live_price: old?.live_price ?? m.current_price, dir: 0 };
        });
      });
      setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const iv = setInterval(fetchMarkets, 30000);
    return () => clearInterval(iv);
  }, [fetchMarkets]);

  // simulation tick
  useEffect(() => {
    const iv = setInterval(() => {
      setMarkets((prev) => prev.map((m) => {
        const base = baseRef.current[m.id] || m.current_price;
        const drift = (Math.random() - 0.5) * base * 0.0018;
        let next = (m.live_price || base) + drift;
        // keep near base within 1.2%
        const maxDev = base * 0.012;
        if (next > base + maxDev) next = base + maxDev;
        if (next < base - maxDev) next = base - maxDev;
        const dir = next > (m.live_price || base) ? 1 : next < (m.live_price || base) ? -1 : 0;
        return { ...m, live_price: next, dir };
      }));
    }, 1500);
    return () => clearInterval(iv);
  }, []);

  const getCoin = useCallback((id) => markets.find((m) => m.id === id), [markets]);
  const getBySymbol = useCallback((sym) =>
    markets.find((m) => m.symbol.toUpperCase() === sym.toUpperCase()), [markets]);

  return (
    <CryptoContext.Provider value={{ markets, loading, getCoin, getBySymbol, refresh: fetchMarkets }}>
      {children}
    </CryptoContext.Provider>
  );
}

export function fmtPrice(v) {
  if (v == null) return "-";
  if (v >= 1000) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (v >= 0.01) return v.toFixed(4);
  return v.toFixed(8);
}
export function fmtNum(v) {
  if (v == null) return "-";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
  return v.toLocaleString("en-US");
}
