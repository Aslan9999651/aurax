import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, Zap, ShieldCheck, Layers, Flame, Sparkles } from "lucide-react";
import { useCrypto, fmtPrice, fmtNum } from "../context/CryptoContext";

function StatRow({ m }) {
  const chg = m.price_change_percentage_24h || 0;
  return (
    <Link to={`/spot?coin=${m.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--ax-s2)] transition-colors" data-testid={`home-coin-${m.id}`}>
      <div className="flex items-center gap-3">
        <img src={m.image} alt="" className="w-7 h-7 rounded-full" />
        <div>
          <div className="font-heading font-semibold text-sm">{m.symbol.toUpperCase()}<span className="text-[var(--ax-text3)]">/USDT</span></div>
          <div className="text-xs text-[var(--ax-text3)]">{m.name}</div>
        </div>
      </div>
      <div className="text-left">
        <div className="mono text-sm">${fmtPrice(m.live_price)}</div>
        <div className={`mono text-xs ${chg >= 0 ? "text-green" : "text-red"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { markets } = useCrypto();
  const gainers = [...markets].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 6);
  const hot = markets.slice(0, 6);
  const listings = [...markets].slice(6, 12);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--ax-border)]">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?crop=entropy&cs=srgb&fm=jpg&q=85)", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle,rgba(0,229,255,0.15),transparent 70%)" }} />
        <div className="relative max-w-[1400px] mx-auto px-4 lg:px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--ax-s2)] border border-[var(--ax-border)] text-xs mb-5">
              <Sparkles size={13} className="text-cyan" /> منصة التداول الأسرع لعام 2026
            </div>
            <h1 className="font-heading text-4xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              تداول العملات الرقمية<br /><span className="text-cyan">بثقة وسرعة</span> فائقة
            </h1>
            <p className="text-[var(--ax-text2)] mt-5 text-base lg:text-lg max-w-lg leading-relaxed">
              انضم إلى AuraX لتداول فوري وعقود آجلة على مئات العملات، مع أسعار حية ومخططات شموع لحظية وأمان من الطراز العالمي.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/register" data-testid="hero-register-btn" className="px-6 py-3 rounded-xl font-semibold btn-cyan flex items-center gap-2">ابدأ التداول الآن <ArrowLeft size={18} /></Link>
              <Link to="/markets" data-testid="hero-markets-btn" className="px-6 py-3 rounded-xl font-semibold bg-[var(--ax-s2)] hover:bg-[var(--ax-s3)]">استكشف الأسواق</Link>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-10 max-w-md">
              {[["+700", "عملة رقمية"], ["$4.2B", "حجم يومي"], ["24/7", "دعم فوري"]].map(([a, b]) => (
                <div key={b}>
                  <div className="font-heading text-2xl font-extrabold text-cyan mono">{a}</div>
                  <div className="text-xs text-[var(--ax-text3)]">{b}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel overflow-hidden fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="px-4 py-3 border-b border-[var(--ax-border)] flex items-center gap-2 text-sm font-semibold">
              <Flame size={16} className="text-[var(--ax-amber)]" /> العملات الأكثر تداولاً
            </div>
            <div className="divide-y divide-[var(--ax-border)]">
              {hot.map((m) => <StatRow key={m.id} m={m} />)}
            </div>
          </div>
        </div>
      </section>

      {/* Market columns */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-12 grid md:grid-cols-3 gap-5">
        {[["الأكثر ارتفاعاً", <TrendingUp size={16} className="text-green" key="a" />, gainers],
          ["الأزواج الساخنة", <Flame size={16} className="text-[var(--ax-amber)]" key="b" />, hot],
          ["إدراجات جديدة", <Sparkles size={16} className="text-cyan" key="c" />, listings]].map(([title, icon, list], idx) => (
          <div key={idx} className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--ax-border)] flex items-center gap-2 text-sm font-semibold">{icon} {title}</div>
            <div className="divide-y divide-[var(--ax-border)]">
              {list.map((m) => <StatRow key={m.id} m={m} />)}
            </div>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          [<Zap key="1" />, "عقود آجلة برافعة", "تداول بعقود آجلة مع رافعة تصل حتى 125x على أهم الأزواج."],
          [<TrendingUp key="2" />, "تداول فوري لحظي", "تنفيذ فوري وأسعار حية مع مخططات شموع احترافية."],
          [<ShieldCheck key="3" />, "أمان مؤسسي", "طبقات حماية متعددة لأصولك ومعلوماتك على مدار الساعة."],
          [<Layers key="4" />, "مئات العملات", "وصول فوري لأكبر تشكيلة عملات وشبكات إيداع وسحب."],
        ].map(([icon, t, d], i) => (
          <div key={i} className="panel p-5 hover:border-[var(--ax-cyan)] transition-colors">
            <div className="w-11 h-11 rounded-xl bg-[var(--ax-s2)] flex items-center justify-center text-cyan mb-4">{icon}</div>
            <div className="font-heading font-bold mb-1">{t}</div>
            <p className="text-sm text-[var(--ax-text2)] leading-relaxed">{d}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-6 pb-16">
        <div className="panel p-8 lg:p-12 text-center glow-cyan" style={{ background: "linear-gradient(135deg,rgba(0,229,255,0.06),rgba(0,229,255,0.01))" }}>
          <h2 className="font-heading text-2xl lg:text-4xl font-extrabold">جاهز لبدء رحلتك في التداول؟</h2>
          <p className="text-[var(--ax-text2)] mt-3">أنشئ حسابك خلال دقيقة وابدأ التداول على AuraX.</p>
          <Link to="/register" className="inline-flex items-center gap-2 mt-6 px-7 py-3 rounded-xl font-semibold btn-cyan">إنشاء حساب مجاني <ArrowLeft size={18} /></Link>
        </div>
      </section>
    </div>
  );
}
