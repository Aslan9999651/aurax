import React, { useState } from "react";
import { useCrypto, fmtPrice } from "../context/CryptoContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { TrendingUp, ArrowDownUp, ChevronDown } from "lucide-react";

export default function Futures() {
  const { markets } = useCrypto();
  const { user } = useAuth();
  const [selectedCoin, setSelectedCoin] = useState(markets[0] || { symbol: "btc", live_price: 85887.10, price_change_percentage_24h: -0.46 });
  const [side, setSide] = useState("buy"); // buy or sell
  const [leverage, setLeverage] = useState("20x");
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("positions"); // positions, open, bots
  const [tpSl, setTpSl] = useState(false);

  const currentPrice = selectedCoin.live_price || 85887.10;
  const chg = selectedCoin.price_change_percentage_24h || -0.46;

  // Mock order book data for Futures
  const asks = [
    { price: currentPrice * 1.0005, amount: 0.582 },
    { price: currentPrice * 1.0004, amount: 0.002 },
    { price: currentPrice * 1.0003, amount: 0.583 },
    { price: currentPrice * 1.0002, amount: 0.504 },
    { price: currentPrice * 1.0001, amount: 9.106 },
  ].reverse();

  const bids = [
    { price: currentPrice * 0.9999, amount: 2.182 },
    { price: currentPrice * 0.9998, amount: 0.003 },
    { price: currentPrice * 0.9997, amount: 0.002 },
    { price: currentPrice * 0.9996, amount: 0.004 },
    { price: currentPrice * 0.9995, amount: 0.001 },
  ];

  const handleTrade = (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("يرجى تسجيل الدخول أولاً");
      return;
    }
    toast.success("تم فتح صفقة العقود الآجلة بنجاح");
    setAmount("");
  };

  return (
    <div className="max-w-[1400px] mx-auto px-2 lg:px-4 py-4">
      {/* Top Bar / Futures Info */}
      <div className="panel p-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-heading font-bold text-lg flex items-center gap-1">
            {selectedCoin.symbol ? selectedCoin.symbol.toUpperCase() : "BTC"}USDT <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--ax-s2)] text-[var(--ax-text3)]">دائم</span> <ChevronDown size={16} />
          </div>
          <span className={`text-xs mono ${chg >= 0 ? "text-green" : "text-red"}`}>
            {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-[var(--ax-s2)] text-xs font-semibold text-cyan">USDⓈ-M</button>
        </div>
      </div>

      {/* Funding rate / countdown banner */}
      <div className="panel p-2.5 mb-3 flex justify-between items-center text-xs text-[var(--ax-text3)]">
        <span>التمويل (8 ساعة) / العد التنازلي</span>
        <span className="mono text-cyan">07:05:00 / 0.0159%-</span>
      </div>

      {/* Main Trading Layout: Order Book & Order Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
        {/* Left / Order Book (5 cols) */}
        <div className="lg:col-span-5 panel p-3">
          <div className="text-xs text-[var(--ax-text3)] flex justify-between mb-2">
            <span>السعر (USDT)</span>
            <span>المبلغ ({selectedCoin.symbol ? selectedCoin.symbol.toUpperCase() : "BTC"})</span>
          </div>
          {/* Asks (Red) */}
          <div className="space-y-1 mb-2">
            {asks.map((ask, i) => (
              <div key={i} className="flex justify-between text-xs mono text-red">
                <span>{ask.price.toFixed(1)}</span>
                <span>{ask.amount.toFixed(3)}</span>
              </div>
            ))}
          </div>

          {/* Current Live Price */}
          <div className="py-2 my-1 border-y border-[var(--ax-border)] flex justify-between items-center bg-[var(--ax-s2)] px-2 rounded">
            <span className={`font-heading font-bold text-base mono ${chg >= 0 ? "text-green" : "text-red"}`}>
              ${fmtPrice(currentPrice)}
            </span>
            <span className="text-xs text-[var(--ax-text3)]">≈ ${fmtPrice(currentPrice)}</span>
          </div>

          {/* Bids (Green) */}
          <div className="space-y-1 mt-2">
            {bids.map((bid, i) => (
              <div key={i} className="flex justify-between text-xs mono text-green">
                <span>{bid.price.toFixed(1)}</span>
                <span>{bid.amount.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right / Futures Order Form (7 cols) */}
        <div className="lg:col-span-7 panel p-4">
          {/* Buy / Sell & Leverage Header */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSide("buy")}
              className={`py-2 rounded-xl font-semibold text-sm transition-colors ${side === "buy" ? "bg-green text-black" : "bg-[var(--ax-s2)] text-[var(--ax-text2)]"}`}
            >
              شراء / طويل (Long)
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              className={`py-2 rounded-xl font-semibold text-sm transition-colors ${side === "sell" ? "bg-red text-black" : "bg-[var(--ax-s2)] text-[var(--ax-text2)]"}`}
            >
              بيع / قصير (Short)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-2 rounded-xl bg-[var(--ax-s2)] text-xs flex justify-between items-center cursor-pointer">
              <span>معزول (Cross)</span>
              <ChevronDown size={14} />
            </div>
            <div className="p-2 rounded-xl bg-[var(--ax-s2)] text-xs flex justify-between items-center cursor-pointer font-bold text-cyan">
              <span>الرافعة: {leverage}</span>
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Order Type */}
          <div className="mb-4">
            <div className="text-xs text-[var(--ax-text3)] mb-1">نوع الطلب</div>
            <div className="p-2 rounded-xl bg-[var(--ax-s2)] text-sm flex justify-between items-center">
              <span>طلب حدي (Limit)</span>
              <ChevronDown size={15} />
            </div>
          </div>

          {/* Form Inputs */}
          <form onSubmit={handleTrade} className="space-y-3">
            <div>
              <div className="text-xs text-[var(--ax-text3)] mb-1">السعر (USDT)</div>
              <input
                type="number"
                step="any"
                defaultValue={currentPrice}
                className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-xl px-3 py-2 text-sm mono focus:outline-none focus:border-cyan"
              />
            </div>

            <div>
              <div className="text-xs text-[var(--ax-text3)] mb-1">المبلغ</div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-xl px-3 py-2.5 text-sm mono focus:outline-none focus:border-cyan"
                />
                <span className="absolute left-3 top-2.5 text-xs text-[var(--ax-text3)]">{selectedCoin.symbol ? selectedCoin.symbol.toUpperCase() : "BTC"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--ax-text3)] py-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={tpSl} onChange={() => setTpSl(!tpSl)} className="rounded bg-[var(--ax-s2)] border-[var(--ax-border)] text-cyan" />
                <span>TP / SL</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded bg-[var(--ax-s2)] border-[var(--ax-border)] text-cyan" />
                <span>تخفيض فقط</span>
              </label>
            </div>

            <div className="text-xs text-[var(--ax-text3)] flex justify-between">
              <span>متاح: 0.00 USDT</span>
              <span className="text-cyan cursor-pointer">إيداع</span>
            </div>

            <button
              type="submit"
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${side === "buy" ? "bg-green text-black hover:opacity-90" : "bg-red text-black hover:opacity-90"}`}
            >
              {user ? (side === "buy" ? "فتح صفقة شراء (Long)" : "فتح صفقة بيع (Short)") : "تسجيل الدخول"}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Section: Positions, Open Orders, Bots */}
      <div className="panel p-4">
        <div className="flex border-b border-[var(--ax-border)] gap-6 text-sm font-semibold mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("positions")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "positions" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            الصفقات (0)
          </button>
          <button
            type="button"
            onClick={() => {}}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "open" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            الطلبات المفتوحة (0)
          </button>
          <button
            type="button"
            onClick={() => {}}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "bots" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            البوتات (0)
          </button>
        </div>

        <div className="py-10 text-center">
          <div className="text-sm text-[var(--ax-text3)] mb-2">ليس لديك أي صفقات</div>
          <div className="text-xs text-[var(--ax-text3)]">ابدأ التداول بالرافعة المالية الآن</div>
        </div>
      </div>
    </div>
  );
}
