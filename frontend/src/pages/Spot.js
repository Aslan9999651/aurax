import React, { useState } from "react";
import { useCrypto, fmtPrice } from "../context/CryptoContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { TrendingUp, ArrowDownUp, ChevronDown, X, Search } from "lucide-react";

export default function Spot() {
  const { markets } = useCrypto();
  const { user } = useAuth();
  const [selectedCoin, setSelectedCoin] = useState(markets[0] || { symbol: "btc", live_price: 86009.40, price_change_percentage_24h: 0.51 });
  const [side, setSide] = useState("buy"); // buy or sell
  const [orderType, setOrderType] = useState("Market"); // Market or Limit
  const [amount, setAmount] = useState("");
  const [priceInput, setPriceInput] = useState(selectedCoin.live_price || 86009.40);
  
  // Modals
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Bottom Tabs & Orders state
  const [activeTab, setActiveTab] = useState("open");
  const [openOrders, setOpenOrders] = useState([]);

  const currentPrice = selectedCoin.live_price || 86009.40;
  const chg = selectedCoin.price_change_percentage_24h || 0.51;

  // Filtered markets for search
  const filteredMarkets = markets.filter(m => 
    m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const asks = [
    { price: currentPrice * 1.0005, amount: 0.15169 },
    { price: currentPrice * 1.0004, amount: 0.31689 },
    { price: currentPrice * 1.0003, amount: 1.06523 },
    { price: currentPrice * 1.0002, amount: 0.00012 },
    { price: currentPrice * 1.0001, amount: 9.82684 },
  ].reverse();

  const bids = [
    { price: currentPrice * 0.9999, amount: 0.47684 },
    { price: currentPrice * 0.9998, amount: 0.00049 },
    { price: currentPrice * 0.9997, amount: 0.04959 },
    { price: currentPrice * 0.9996, amount: 0.00007 },
    { price: currentPrice * 0.9995, amount: 0.00007 },
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

    const newOrder = {
      id: Date.now(),
      symbol: selectedCoin.symbol.toUpperCase() + "/USDT",
      side: side === "buy" ? "شراء" : "بيع",
      type: orderType,
      price: orderType === "Limit" ? priceInput : currentPrice,
      amount,
      time: new Date().toLocaleTimeString("ar-EG")
    };

    setOpenOrders([newOrder, ...openOrders]);
    toast.success("تم تقديم طلب التداول الفوري بنجاح!");
    setAmount("");
  };

  return (
    <div dir="rtl" className="max-w-[1400px] mx-auto px-2 lg:px-4 py-4 text-right">
      {/* Top Bar / Pair Selector */}
      <div className="panel p-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowCoinModal(true)}>
          <div className="font-heading font-bold text-lg flex items-center gap-1">
            {selectedCoin.symbol ? selectedCoin.symbol.toUpperCase() : "BTC"}/USDT <ChevronDown size={16} />
          </div>
          <span className={`text-xs mono ${chg >= 0 ? "text-green" : "text-red"}`}>
            {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-[var(--ax-s2)] text-xs font-semibold text-cyan">التداول الفوري</button>
        </div>
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
                <span>{ask.price.toFixed(2)}</span>
                <span>{ask.amount.toFixed(5)}</span>
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
                <span>{bid.price.toFixed(2)}</span>
                <span>{bid.amount.toFixed(5)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right / Order Form (7 cols) */}
        <div className="lg:col-span-7 panel p-4">
          {/* Buy / Sell Tabs */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSide("buy")}
              className={`py-2 rounded-xl font-semibold text-sm transition-colors ${side === "buy" ? "bg-green text-black" : "bg-[var(--ax-s2)] text-[var(--ax-text2)]"}`}
            >
              شراء
            </button>
            <button
              type="button"
              onClick={() => setSide("sell")}
              className={`py-2 rounded-xl font-semibold text-sm transition-colors ${side === "sell" ? "bg-red text-black" : "bg-[var(--ax-s2)] text-[var(--ax-text2)]"}`}
            >
              بيع
            </button>
          </div>

          {/* Order Type */}
          <div className="mb-4">
            <div className="text-xs text-[var(--ax-text3)] mb-1">نوع الطلب</div>
            <div onClick={() => setShowOrderTypeModal(true)} className="p-2 rounded-xl bg-[var(--ax-s2)] text-sm flex justify-between items-center cursor-pointer hover:border-cyan border border-transparent">
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
              {user ? (side === "buy" ? "شراء" : "بيع") : "تسجيل الدخول"}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Section: Open Orders & Assets */}
      <div className="panel p-4">
        <div className="flex border-b border-[var(--ax-border)] gap-6 text-sm font-semibold mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("open")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "open" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            الطلبات المفتوحة ({openOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "assets" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            الأرصدة (0)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bots")}
            className={`pb-2 border-b-2 transition-colors ${activeTab === "bots" ? "border-cyan text-cyan" : "border-transparent text-[var(--ax-text3)]"}`}
          >
            بوتات
          </button>
        </div>

        {activeTab === "open" && openOrders.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-sm text-[var(--ax-text3)] mb-2">لا توجد طلبات مفتوحة</div>
            <div className="text-xs text-[var(--ax-text3)]">دع أفضل المتداولين يتداولون من أجلك</div>
          </div>
        ) : activeTab === "open" ? (
          <div className="space-y-2">
            {openOrders.map((ord) => (
              <div key={ord.id} className="p-3 rounded-xl bg-[var(--ax-s2)] flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-sm mb-1">{ord.symbol} <span className={ord.side === "شراء" ? "text-green" : "text-red"}>{ord.side}</span></div>
                  <div className="text-[var(--ax-text3)]">النوع: {ord.type} | السعر: ${fmtPrice(ord.price)} | الكمية: {ord.amount}</div>
                </div>
                <div className="text-left">
                  <button onClick={() => setOpenOrders(openOrders.filter(o => o.id !== ord.id))} className="px-2.5 py-1 rounded bg-red/20 text-red hover:bg-red/30">إلغاء</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-[var(--ax-text3)]">لا توجد بيانات</div>
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

      {/* 2. Order Type Modal */}
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
