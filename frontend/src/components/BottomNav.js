import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, TrendingUp, RefreshCw, FileText, Wallet } from "lucide-react";

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const isActive = (p) => path === p ? "text-cyan font-bold" : "text-[var(--ax-text3)] hover:text-white";

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#041016] border-t border-[var(--ax-border)] px-2 py-2.5 flex justify-around items-center z-50 shadow-lg">
      <Link to="/" className={`flex flex-col items-center text-[11px] transition-colors ${isActive("/")}`}>
        <Home size={20} className="mb-0.5" />
        <span>الرئيسية</span>
      </Link>
      <Link to="/markets" className={`flex flex-col items-center text-[11px] transition-colors ${isActive("/markets")}`}>
        <TrendingUp size={20} className="mb-0.5" />
        <span>الأسواق</span>
      </Link>
      <Link to="/spot" className={`flex flex-col items-center text-[11px] transition-colors ${isActive("/spot")}`}>
        <RefreshCw size={20} className="mb-0.5" />
        <span>تداول</span>
      </Link>
      <Link to="/futures" className={`flex flex-col items-center text-[11px] transition-colors ${isActive("/futures")}`}>
        <FileText size={20} className="mb-0.5" />
        <span>العقود</span>
      </Link>
      <Link to="/wallet" className={`flex flex-col items-center text-[11px] transition-colors ${isActive("/wallet")}`}>
        <Wallet size={20} className="mb-0.5" />
        <span>الأصول</span>
      </Link>
    </div>
  );
}
