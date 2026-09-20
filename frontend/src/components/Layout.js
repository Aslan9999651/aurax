import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Bell, Wallet, ShieldCheck, LogOut, User, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCrypto, fmtPrice } from "../context/CryptoContext";
import { toast } from "sonner";
import api from "../lib/api";

const NAV = [
  { to: "/", label: "الرئيسية" },
  { to: "/markets", label: "الأسواق" },
  { to: "/spot", label: "التداول الفوري" },
  { to: "/futures", label: "العقود الآجلة" },
  { to: "/wallet", label: "الأصول" },
];

function Ticker() {
  const { markets } = useCrypto();
  const items = markets.slice(0, 18);
  const row = [...items, ...items];
  return (
    <div className="ticker-wrap overflow-hidden border-b border-[var(--ax-border)] bg-[var(--ax-s1)]" data-testid="price-ticker">
      <div className="ticker-track py-2">
        {row.map((m, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-5 text-sm">
            <span className="font-heading font-semibold">{m.symbol.toUpperCase()}</span>
            <span className="mono text-[var(--ax-text2)]">${fmtPrice(m.live_price)}</span>
            <span className={`mono text-xs ${(m.price_change_percentage_24h || 0) >= 0 ? "text-green" : "text-red"}`}>
              {(m.price_change_percentage_24h || 0) >= 0 ? "+" : ""}{(m.price_change_percentage_24h || 0).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  // live notifications via WebSocket
  useEffect(() => {
    const wsUrl = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws") + "/api/ws";
    let ws; let closed = false; let retry;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data);
            if (d.type === "notification") {
              toast(d.message, { description: new Date().toLocaleTimeString("ar-EG"), className: "font-heading" });
            }
          } catch { /* ignore */ }
        };
        ws.onclose = () => { if (!closed) retry = setTimeout(connect, 4000); };
        ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
      } catch { /* noop */ }
    };
    connect();
    return () => { closed = true; clearTimeout(retry); try { ws && ws.close(); } catch { /* noop */ } };
  }, []);

  const isActive = (to) => (to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--ax-bg)]/95 backdrop-blur border-b border-[var(--ax-border)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 flex items-center gap-6 h-16">
          <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-heading font-extrabold text-[#041016] text-lg" style={{ background: "linear-gradient(135deg,#00E5FF,#00B8CC)" }}>A</div>
            <span className="font-heading text-xl font-extrabold tracking-tight">Aura<span className="text-cyan">X</span></span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} data-testid={`nav-${n.to === "/" ? "home" : n.to.slice(1)}`}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(n.to) ? "text-cyan bg-[var(--ax-s2)]" : "text-[var(--ax-text2)] hover:text-[var(--ax-text)]"}`}>
                {n.label}
              </Link>
            ))}
            <Link to="/verification-fees" data-testid="nav-verification"
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${isActive("/verification-fees") ? "text-[var(--ax-amber)] bg-[var(--ax-s2)]" : "text-[var(--ax-amber)] hover:opacity-80"}`}>
              <ShieldCheck size={15} /> رسوم التحقق
            </Link>
          </nav>

          <div className="mr-auto flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button onClick={() => setMenu((v) => !v)} data-testid="user-menu-btn"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ax-s2)] hover:bg-[var(--ax-s3)] text-sm">
                  <User size={16} className="text-cyan" />
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.name || user.email}</span>
                  <ChevronDown size={14} />
                </button>
                {menu && (
                  <div className="absolute left-0 mt-2 w-52 panel p-1 z-50 bg-[var(--ax-s1)]" onMouseLeave={() => setMenu(false)}>
                    <Link to="/wallet" onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ax-s2)] text-sm" data-testid="menu-wallet"><Wallet size={15} /> الأصول والمحفظة</Link>
                    <Link to="/verification-fees" onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ax-s2)] text-sm text-[var(--ax-amber)]"><ShieldCheck size={15} /> رسوم التحقق</Link>
                    {user.role === "admin" && (
                      <Link to="/admin" onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ax-s2)] text-sm text-cyan" data-testid="menu-admin"><ShieldCheck size={15} /> لوحة الآدمن</Link>
                    )}
                    <button onClick={() => { setMenu(false); logout(); nav("/"); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--ax-s2)] text-sm text-red" data-testid="logout-btn"><LogOut size={15} /> تسجيل الخروج</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" data-testid="login-nav-btn" className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--ax-text)] hover:text-cyan">تسجيل الدخول</Link>
                <Link to="/register" data-testid="register-nav-btn" className="px-4 py-2 rounded-lg text-sm font-semibold btn-cyan">إنشاء حساب</Link>
              </>
            )}
            <button className="lg:hidden p-2" onClick={() => setOpen((v) => !v)} data-testid="mobile-menu-btn">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden border-t border-[var(--ax-border)] bg-[var(--ax-s1)] px-4 py-2">
            {[...NAV, { to: "/verification-fees", label: "رسوم التحقق" }].map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm text-[var(--ax-text2)] hover:bg-[var(--ax-s2)]">{n.label}</Link>
            ))}
            {user?.role === "admin" && <Link to="/admin" onClick={() => setOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-cyan">لوحة الآدمن</Link>}
          </div>
        )}
      </header>

      <Ticker />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--ax-border)] bg-[var(--ax-s1)] mt-10">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <div className="font-heading text-lg font-extrabold mb-2">Aura<span className="text-cyan">X</span></div>
            <p className="text-[var(--ax-text3)] leading-relaxed">منصة تداول العملات الرقمية الأسرع. تداول فوري وعقود آجلة بأمان تام.</p>
          </div>
          <div>
            <div className="font-semibold mb-3">المنتجات</div>
            <ul className="space-y-2 text-[var(--ax-text2)]">
              <li><Link to="/spot">التداول الفوري</Link></li>
              <li><Link to="/futures">العقود الآجلة</Link></li>
              <li><Link to="/markets">الأسواق</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-3">الحساب</div>
            <ul className="space-y-2 text-[var(--ax-text2)]">
              <li><Link to="/wallet">الأصول</Link></li>
              <li><Link to="/verification-fees">رسوم التحقق</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-3">الدعم</div>
            <p className="text-[var(--ax-text3)]">© 2026 AuraX. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
