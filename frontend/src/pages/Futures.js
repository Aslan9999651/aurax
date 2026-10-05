import React, { useState } from "react";
import { useCrypto, fmtPrice } from "../context/CryptoContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { TrendingUp, ArrowDownUp, ChevronDown, X, Search } from "lucide-react";

export default function Futures() {
  const { markets } = useCrypto();
  const { user } = useAuth();
  const [selectedCoin, setSelectedCoin] = useState(markets[0] || { symbol: "btc", live_price: 85887.10, price_change_percentage_24h: -0.46 });
  const [side, setSide] = useState("buy"); // buy (Long) or sell (Short)
  const [marginType, setMarginType] = useState("Cross"); // Cross or Isolated
  const [leverage, setLeverage] = useState("20x");
  const [orderType, setOrderType] = useState("Market");
  const [amount, setAmount] = useState("");
  const [priceInput, setPriceInput] = useState(selectedCoin.live_price || 85887.10);
  
  // Modals
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [showLeverageModal, setShowLeverageModal] = useState(false);
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Bottom Tabs & Positions state
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);

  const currentPrice = selectedCoin.live_price || 85887.10;
  const chg = selectedCoin.price_change_percentage_24h || -0.46;

  // Filtered markets for search
  const filteredMarkets = markets.filter(m => 
    m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }

    const newPosition = {
      id: Date.now(),
      symbol: selectedCoin.symbol.toUpperCase() + "USDT",
      side: side === "buy" ? "شراء (طويل)" : "بيع (قصير)",
      leverage,
      marginType,
      entryPrice: currentPrice,
      amount,
      pnl: "+0.00 USDT (0.00%)"
    };

    setPositions([newPosition, ...positions]);
    toast.success("تم فتح صفقة العقود الآجلة بنجاح!");
    setAmount("");
  };

  return (
    <div dir="rtl" className="max-w-[1400px] mx-auto px-2 lg:px-4 py-4 text-right">
      {/* Top Bar / Futures Info */}
      <div className="panel p-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowCoinModal(true)}>
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
            <div onClick={() => setShowMarginModal(true)} className="p-2 rounded-xl bg-[var(--ax-s2)] text-xs flex justify-between items-center cursor-pointer hover:border-cyan border border-transparent">
              <span>{marginType === "Cross" ? "معزول (Cross)" : "متبادل (Isolated)"}</span>
              <ChevronDown size={14} />
            </div>
            <div onClick={() => setShowLeverageModal(true)} className="p-2 rounded-xl bg-[var(--ax-s2)] text-xs flex justify-between items-center cursor-pointer font-bold text-cyan hover:border-cyan border border-transparent">
              <span>الرافعة: {leverage}</span>
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Order Type */}
          <div className="mb-4">
            <div className="text-xs text-[var(--ax-text3)] mb-1">نوع الطلب</div>
            <div onClick={() => setShowOrderTypeModal(true)} className="p-2 rounded-xl bg-[var(--ax-s2)] text-sm flex justify-between items-center cursor-pointer">
              <span>{orderType === "Market" ? "طلب السوق (Market)" : "طلب حدي (Limit)"}</span>
              <ChevronDown size={15} />
            </div>
          </div>

          {/* Form Inputs */}
          <form onSubmit={handleTrade} className="space-y-3">
            {orderType === "Limit" && (
              <div>
                <div className="text-xs text-[var(--ax-text3)] mb-1">السعر (USDT)</div>
                <input
                  type="number"
                  step="any"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-xl px-3 py-2 text-sm mono focus:outline-none focus:border-cyan text-right"
                />
              </div>
            )}

            <div>
              <div className="text-xs text-[var(--ax-text3)] mb-1">المبلغ</div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-xl px-3 py-2.5 text-sm mono focus:outline-none focus:border-cyan text-right pl-12"
                />
                <span className="absolute left-3 top-2.5 text-xs text-[var(--ax-text3)]">{selectedCoin.symbol ? selectedCoin.symbol.toUpperCase() : "BTC"}</span>
              </div>
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
            الصفقات ({positions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("open")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "open" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            الطلبات المفتوحة ({openOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bots")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "bots" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            البوتات (0)
          </button>
        </div>

        {activeTab === "positions" && positions.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-sm text-[var(--ax-text3)] mb-2">ليس لديك أي صفقات</div>
            <div className="text-xs text-[var(--ax-text3)]">ابدأ التداول بالرافعة المالية الآن</div>
          </div>
        ) : activeTab === "positions" ? (
          <div className="space-y-2">
            {positions.map((pos) => (
              <div key={pos.id} className="p-3 rounded-xl bg-[var(--ax-s2)] flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-sm mb-1">{pos.symbol} <span className={pos.side.includes("شراء") ? "text-green" : "text-red"}>{pos.side}</span></div>
                  <div className="text-[var(--ax-text3)]">الرافعة: {pos.leverage} | الدخول: ${fmtPrice(pos.entryPrice)} | الحجم: {pos.amount}</div>
                </div>
                <div className="text-left">
                  <div className="mono font-bold text-green">{pos.pnl}</div>
                  <button onClick={() => setPositions(positions.filter(p => p.id !== pos.id))} className="mt-1 px-2 py-1 rounded bg-red/20 text-red hover:bg-red/30">إغلاق</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-[var(--ax-text3)]">لا توجد طلبات مفتوحة</div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Coin Selector Modal */}
      {showCoinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="panel w-full max-w-md p-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-heading font-bold text-base">اختر العملة</h3>
              <button onClick={() => setShowCoinModal(false)} className="p-1"><X size={18} /></button>
            </div>
            <div className="relative mb-3">
              <Search size={16} className="absolute right-3 top-3 text-[var(--ax-text3)]" />
              <input
                type="text"
                placeholder="ابحث عن عملة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-xl py-2 pr-9 pl-3 text-sm focus:outline-none focus:border-cyan text-right"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 divide-y divide-[var(--ax-border)]">
              {filteredMarkets.map((m) => (
                <div
                  key={m.id}
                  onClick={() => { setSelectedCoin(m); setShowCoinModal(false); }}
                  className="flex justify-between items-center py-2.5 px-2 hover:bg-[var(--ax-s2)] cursor-pointer rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <img src={m.image} alt="" className="w-6 h-6 rounded-full" />
                    <span className="font-bold text-sm">{m.symbol.toUpperCase()}<span className="text-[var(--ax-text3)] text-xs">/USDT</span></span>
                  </div>
                  <div className="text-left mono text-sm">
                    <div>${fmtPrice(m.live_price)}</div>
                    <div className={`text-xs ${(m.price_change_percentage_24h || 0) >= 0 ? "text-green" : "text-red"}`}>
                      {(m.price_change_percentage_24h || 0) >= 0 ? "+" : ""}{(m.price_change_percentage_24h || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Leverage Selector Modal */}
      {showLeverageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="panel w-full max-w-xs p-5 text-center">
            <h3 className="font-heading font-bold text-base mb-4">اختر الرافعة المالية</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["5x", "10x", "20x", "50x", "75x", "100x", "125x"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => { setLeverage(lvl); setShowLeverageModal(false); }}
                  className={`py-2 rounded-xl text-sm font-bold border transition-colors ${leverage === lvl ? "border-cyan bg-cyan/10 text-cyan" : "border-[var(--ax-border)] bg-[var(--ax-s2)] hover:border-cyan"}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <button onClick={() => setShowLeverageModal(false)} className="w-full py-2.5 rounded-xl bg-[var(--ax-s2)] text-sm font-semibold">إلغاء</button>
          </div>
        </div>
      )}

      {/* 3. Margin Type Modal */}
      {showMarginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="panel w-full max-w-xs p-5 text-center">
            <h3 className="font-heading font-bold text-base mb-4">اختر وضع الهامش</h3>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => { setMarginType("Cross"); setShowMarginModal(false); }}
                className={`w-full py-3 rounded-xl text-sm font-bold border transition-colors ${marginType === "Cross" ? "border-cyan bg-cyan/10 text-cyan" : "border-[var(--ax-border)] bg-[var(--ax-s2)]"}`}
              >
                معزول (Cross)
              </button>
              <button
                onClick={() => { setMarginType("Isolated"); setShowMarginModal(false); }}
                className={`w-full py-3 rounded-xl text-sm font-bold border transition-colors ${marginType === "Isolated" ? "border-cyan bg-cyan/10 text-cyan" : "border-[var(--ax-border)] bg-[var(--ax-s2)]"}`}
              >
                متبادل (Isolated)
              </button>
            </div>
            <button onClick={() => setShowMarginModal(false)} className="w-full py-2.5 rounded-xl bg-[var(--ax-s2)] text-sm font-semibold">إلغاء</button>
          </div>
        </div>
      )}

      {/* 4. Order Type Modal */}
      {showOrderTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="panel w-full max-w-xs p-5 text-center">
            <h3 className="font-heading font-bold text-base mb-4">اختر نوع الطلب</h3>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => { setOrderType("Market"); setShowOrderTypeModal(false); }}
                className={`w-full py-3 rounded-xl text-sm font-bold border transition-colors ${orderType === "Market" ? "border-cyan bg-cyan/10 text-cyan" : "border-[var(--ax-border)] bg-[var(--ax-s2)]"}`}
              >
                طلب السوق (Market)
              </button>
              <button
                onClick={() => { setOrderType("Limit"); setShowOrderTypeModal(false); }}
                className={`w-full py-3 rounded-xl text-sm font-bold border transition-colors ${orderType === "Limit" ? "border-cyan bg-cyan/10 text-cyan" : "border-[var(--ax-border)] bg-[var(--ax-s2)]"}`}
              >
                طلب حدي (Limit)
              </button>
            </div>
            <button onClick={() => setShowOrderTypeModal(false)} className="w-full py-2.5 rounded-xl bg-[var(--ax-s2)] text-sm font-semibold">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
