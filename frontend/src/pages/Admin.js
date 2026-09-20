import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LayoutDashboard, Users, Settings, Receipt, Megaphone, LogOut, ShieldCheck, Search, X, ScrollText } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { apiErr } from "../lib/api";
import { fmtPrice } from "../context/CryptoContext";

const TABS = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "users", label: "المستخدمون", icon: Users },
  { id: "settings", label: "الإعدادات العامة", icon: Settings },
  { id: "fees", label: "طلبات الرسوم", icon: Receipt },
  { id: "broadcast", label: "الإشعارات", icon: Megaphone },
  { id: "logs", label: "سجل العمليات", icon: ScrollText },
];

function Field({ label, children }) {
  return <label className="block"><span className="text-xs text-[var(--ax-text3)]">{label}</span>{children}</label>;
}
const inputCls = "w-full mt-1 bg-[var(--ax-s2)] border border-[var(--ax-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--ax-cyan)]";

export default function Admin() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [fees, setFees] = useState([]);
  const [logs, setLogs] = useState([]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");

  const loadAll = async () => {
    try {
      const [s, u, st, f, l] = await Promise.all([
        api.get("/admin/stats"), api.get("/admin/users"),
        api.get("/admin/settings"), api.get("/admin/fee-submissions"),
        api.get("/admin/logs"),
      ]);
      setStats(s.data); setUsers(u.data); setSettings(st.data); setFees(f.data); setLogs(l.data);
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
  };
  useEffect(() => { loadAll(); }, []);

  const filtered = users.filter((u) => u.email.toLowerCase().includes(q.toLowerCase()) || (u.name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* sidebar */}
      <aside className="w-60 shrink-0 border-l border-[var(--ax-border)] bg-[var(--ax-s1)] flex flex-col fixed lg:static h-full z-20">
        <div className="px-5 py-5 border-b border-[var(--ax-border)] flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-heading font-extrabold text-[#041016]" style={{ background: "linear-gradient(135deg,#00E5FF,#00B8CC)" }}>A</div>
          <div><div className="font-heading font-extrabold">Aura<span className="text-cyan">X</span></div><div className="text-[10px] text-[var(--ax-amber)] flex items-center gap-1"><ShieldCheck size={10} /> لوحة التحكم</div></div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} data-testid={`admin-tab-${t.id}`}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${tab === t.id ? "bg-[var(--ax-s3)] text-cyan" : "text-[var(--ax-text2)] hover:bg-[var(--ax-s2)]"}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-[var(--ax-border)]">
          <button onClick={() => nav("/")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--ax-text2)] hover:bg-[var(--ax-s2)]">→ المنصة</button>
          <button onClick={() => { logout(); nav("/login"); }} data-testid="admin-logout" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red hover:bg-[var(--ax-s2)]"><LogOut size={16} /> خروج</button>
        </div>
      </aside>

      <main className="flex-1 lg:mr-0 mr-60 p-4 lg:p-8 overflow-auto">
        <h1 className="font-heading text-2xl font-extrabold mb-1">{TABS.find((t) => t.id === tab)?.label}</h1>
        <p className="text-xs text-[var(--ax-text3)] mb-6">مرحباً {user?.name} — تحكّم كامل بمنصة AuraX</p>

        {/* OVERVIEW */}
        {tab === "overview" && stats && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[["إجمالي المستخدمين", stats.total_users], ["حسابات مفعّلة", stats.verified_users], ["طلبات رسوم معلّقة", stats.pending_fees], ["إجمالي الأوامر", stats.total_orders]].map(([l, v]) => (
              <div key={l} className="panel p-5"><div className="text-sm text-[var(--ax-text3)]">{l}</div><div className="font-heading text-3xl font-extrabold mono text-cyan mt-1">{v}</div></div>
            ))}
          </div>
        )}

        {/* USERS */}
        {tab === "users" && (
          <>
            <div className="relative w-full sm:w-80 mb-4">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ax-text3)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالبريد أو الاسم…" data-testid="admin-user-search" className="w-full bg-[var(--ax-s1)] border border-[var(--ax-border)] rounded-xl py-2.5 pr-9 pl-3 text-sm outline-none focus:border-[var(--ax-cyan)]" />
            </div>
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-[var(--ax-text3)] text-xs border-b border-[var(--ax-border)]">
                    <th className="text-right font-medium px-4 py-3">المستخدم</th><th className="text-right font-medium px-4 py-3">الحالة</th>
                    <th className="text-left font-medium px-4 py-3">رصيد USDT</th><th className="text-center font-medium px-4 py-3">إجراء</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.user_id} className="border-b border-[var(--ax-border)] hover:bg-[var(--ax-s2)]" data-testid={`admin-user-${u.user_id}`}>
                        <td className="px-4 py-3"><div className="font-semibold">{u.name || "—"}</div><div className="text-xs text-[var(--ax-text3)]">{u.email}</div></td>
                        <td className="px-4 py-3">
                          {u.role === "admin" && <span className="text-[10px] bg-[var(--ax-s3)] text-cyan px-2 py-0.5 rounded mr-1">آدمن</span>}
                          {u.is_verified ? <span className="text-[10px] text-green">مفعّل</span> : <span className="text-[10px] text-[var(--ax-amber)]">غير مفعّل</span>}
                          {u.frozen && <span className="text-[10px] text-red mr-1">مجمّد</span>}
                        </td>
                        <td className="px-4 py-3 text-left mono">{fmtPrice(u.balances?.USDT || 0)}</td>
                        <td className="px-4 py-3 text-center"><button onClick={() => setSel(u)} data-testid={`admin-edit-${u.user_id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-cyan">إدارة</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* SETTINGS */}
        {tab === "settings" && settings && (
          <SettingsPanel settings={settings} onSaved={(s) => { setSettings(s); toast.success("تم حفظ الإعدادات"); }} />
        )}

        {/* FEES */}
        {tab === "fees" && (
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-[var(--ax-text3)] text-xs border-b border-[var(--ax-border)]">
                <th className="text-right font-medium px-4 py-3">المستخدم</th><th className="text-right font-medium px-4 py-3">الشبكة</th>
                <th className="text-right font-medium px-4 py-3">TXID</th><th className="text-right font-medium px-4 py-3">الحالة</th><th className="text-center font-medium px-4 py-3">إجراء</th>
              </tr></thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--ax-border)]">
                    <td className="px-4 py-3 text-xs">{f.email}</td>
                    <td className="px-4 py-3">{f.network}</td>
                    <td className="px-4 py-3 mono text-xs break-all max-w-[200px]">{f.txid}</td>
                    <td className={`px-4 py-3 text-xs ${f.status === "verified" ? "text-green" : f.status === "rejected" ? "text-red" : "text-[var(--ax-amber)]"}`}>{{ pending: "معلّق", verified: "تم التحقق", rejected: "مرفوض" }[f.status]}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={async () => { await api.patch(`/admin/fee-submissions/${f.id}?status=verified`); toast.success("تم التحقق"); loadAll(); }} className="px-2 py-1 rounded text-[10px] bg-[var(--ax-green)] text-[#041016]">قبول</button>
                        <button onClick={async () => { await api.patch(`/admin/fee-submissions/${f.id}?status=rejected`); toast("تم الرفض"); loadAll(); }} className="px-2 py-1 rounded text-[10px] bg-[var(--ax-red)] text-white">رفض</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!fees.length && <tr><td colSpan="5" className="text-center py-8 text-[var(--ax-text3)]">لا توجد طلبات</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* BROADCAST */}
        {tab === "broadcast" && <BroadcastPanel />}

        {/* LOGS */}
        {tab === "logs" && (
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-[var(--ax-text3)] text-xs border-b border-[var(--ax-border)]">
                <th className="text-right font-medium px-4 py-3">الوقت</th>
                <th className="text-right font-medium px-4 py-3">الإجراء</th>
                <th className="text-right font-medium px-4 py-3">المستخدم المستهدف</th>
                <th className="text-right font-medium px-4 py-3">التفاصيل</th>
              </tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--ax-border)]" data-testid={`log-${l.id}`}>
                    <td className="px-4 py-3 mono text-xs text-[var(--ax-text3)] whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-GB")}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-[var(--ax-s3)] text-cyan px-2 py-0.5 rounded">{l.action}</span></td>
                    <td className="px-4 py-3 text-xs text-[var(--ax-text2)]">{l.target_email || "—"}</td>
                    <td className="px-4 py-3 mono text-[11px] text-[var(--ax-text3)] break-all max-w-[380px]">{JSON.stringify(l.details)}</td>
                  </tr>
                ))}
                {!logs.length && <tr><td colSpan="4" className="text-center py-8 text-[var(--ax-text3)]">لا توجد عمليات مسجّلة</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {sel && <UserDrawer u={sel} settings={settings} onClose={() => setSel(null)} onSaved={() => { loadAll(); setSel(null); }} />}
    </div>
  );
}

function SettingsPanel({ settings, onSaved }) {
  const [fee, setFee] = useState(settings.verification_fee_amount);
  const [cur, setCur] = useState(settings.verification_currency);
  const [msg, setMsg] = useState(settings.verification_message);
  const [wallets, setWallets] = useState({ ...settings.wallet_addresses });
  const [autoEnabled, setAutoEnabled] = useState(!!settings.auto_verify_enabled);
  const [autoDelay, setAutoDelay] = useState(settings.auto_verify_delay ?? 20);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", { verification_fee_amount: parseFloat(fee), verification_currency: cur, verification_message: msg, wallet_addresses: wallets, auto_verify_enabled: autoEnabled, auto_verify_delay: parseInt(autoDelay) || 20 });
      onSaved(data);
    } catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="panel p-5 space-y-3">
        <div className="font-semibold text-sm">رسوم التحقق الافتراضية</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ"><input value={fee} onChange={(e) => setFee(e.target.value)} data-testid="settings-fee-amount" className={inputCls} /></Field>
          <Field label="العملة"><input value={cur} onChange={(e) => setCur(e.target.value)} data-testid="settings-fee-currency" className={inputCls} /></Field>
        </div>
        <Field label="الرسالة التوضيحية"><textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} data-testid="settings-fee-message" className={inputCls} /></Field>
        <div className="mt-2 rounded-lg bg-[var(--ax-s2)] p-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium">التحقق التلقائي من الإيداع</span>
            <button type="button" onClick={() => setAutoEnabled((v) => !v)} data-testid="settings-auto-verify-toggle"
              className={`relative w-11 h-6 rounded-full transition-colors ${autoEnabled ? "bg-[var(--ax-cyan)]" : "bg-[var(--ax-s3)]"}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${autoEnabled ? "left-0.5" : "left-[22px]"}`} />
            </button>
          </label>
          <p className="text-[11px] text-[var(--ax-text3)] mt-2">عند التفعيل يتم قبول طلبات الرسوم وتفعيل الحساب تلقائياً بعد المهلة المحددة (فحص محاكاة — لا يوجد اتصال شبكة فعلي بالعناوين التجريبية).</p>
          {autoEnabled && (
            <Field label="مهلة التحقق (ثواني)"><input value={autoDelay} onChange={(e) => setAutoDelay(e.target.value)} data-testid="settings-auto-verify-delay" className={inputCls} /></Field>
          )}
        </div>
      </div>
      <div className="panel p-5 space-y-3">
        <div className="font-semibold text-sm">عناوين المحافظ حسب الشبكة</div>
        <div className="space-y-2 max-h-[360px] overflow-auto pl-1">
          {(settings.networks || []).map((n) => (
            <Field key={n.id} label={n.name}>
              <input value={wallets[n.id] || ""} onChange={(e) => setWallets({ ...wallets, [n.id]: e.target.value })} data-testid={`settings-wallet-${n.id}`} placeholder={`عنوان ${n.id}`} className={`${inputCls} mono text-xs`} />
            </Field>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2">
        <button onClick={save} disabled={busy} data-testid="settings-save" className="px-6 py-2.5 rounded-xl btn-cyan font-semibold disabled:opacity-60">{busy ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>
      </div>
    </div>
  );
}

function BroadcastPanel() {
  const [ntype, setNtype] = useState("market");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!message.trim()) { toast.error("أدخل نص الإشعار"); return; }
    setBusy(true);
    try { await api.post("/admin/notifications", { ntype, message }); toast.success("تم بث الإشعار"); setMessage(""); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div className="panel p-5 max-w-xl space-y-3">
      <Field label="نوع الإشعار">
        <select value={ntype} onChange={(e) => setNtype(e.target.value)} data-testid="broadcast-type" className={inputCls}>
          <option value="market">إشعار سوق</option><option value="deposit">إشعار إيداع</option><option value="withdraw">إشعار سحب</option><option value="system">إشعار نظام</option>
        </select>
      </Field>
      <Field label="النص"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} data-testid="broadcast-message" className={inputCls} placeholder="اكتب نص الإشعار للبث…" /></Field>
      <button onClick={send} disabled={busy} data-testid="broadcast-send" className="px-6 py-2.5 rounded-xl btn-cyan font-semibold disabled:opacity-60">{busy ? "جارٍ البث…" : "بث الإشعار"}</button>
    </div>
  );
}

function UserDrawer({ u, settings, onClose, onSaved }) {
  const [addCur, setAddCur] = useState("USDT");
  const [addAmt, setAddAmt] = useState("");
  const [fee, setFee] = useState(u.verification_fee_amount ?? "");
  const [msg, setMsg] = useState(u.verification_message ?? "");
  const [wallets, setWallets] = useState({ ...(u.wallet_addresses || {}) });
  const [frozen, setFrozen] = useState(u.frozen);
  const [verified, setVerified] = useState(u.is_verified);
  const [busy, setBusy] = useState(false);

  const patch = async (body, note) => {
    setBusy(true);
    try { await api.patch(`/admin/users/${u.user_id}`, body); toast.success(note || "تم الحفظ"); onSaved(); }
    catch (e) { toast.error(apiErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mr-auto w-full max-w-md h-full bg-[var(--ax-s1)] border-l border-[var(--ax-border)] overflow-auto p-5" onClick={(e) => e.stopPropagation()} data-testid="user-drawer">
        <div className="flex items-center justify-between mb-4">
          <div><div className="font-heading font-bold">{u.name || u.email}</div><div className="text-xs text-[var(--ax-text3)]">{u.email}</div></div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--ax-s2)] rounded-lg"><X size={18} /></button>
        </div>

        <Section title="إضافة رصيد">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <Field label="العملة"><input value={addCur} onChange={(e) => setAddCur(e.target.value.toUpperCase())} data-testid="drawer-add-currency" className={inputCls} /></Field>
            <Field label="المبلغ"><input value={addAmt} onChange={(e) => setAddAmt(e.target.value)} data-testid="drawer-add-amount" className={inputCls} /></Field>
            <button disabled={busy} onClick={() => { patch({ add_balance_currency: addCur, add_balance_amount: parseFloat(addAmt) }, "تم إضافة الرصيد"); setAddAmt(""); }} data-testid="drawer-add-balance-btn" className="py-2 px-3 rounded-lg btn-cyan text-sm font-semibold mb-[1px]">إضافة</button>
          </div>
          <div className="text-xs text-[var(--ax-text3)] mt-1">الرصيد الحالي: <span className="mono">{JSON.stringify(u.balances || {})}</span></div>
        </Section>

        <Section title="رسوم التحقق الخاصة بهذا المستخدم">
          <Field label="المبلغ (اتركه فارغاً لاستخدام الافتراضي)"><input value={fee} onChange={(e) => setFee(e.target.value)} data-testid="drawer-fee" placeholder={`${settings?.verification_fee_amount} (افتراضي)`} className={inputCls} /></Field>
          <Field label="الرسالة التوضيحية"><textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} data-testid="drawer-message" placeholder="اتركها فارغة للرسالة الافتراضية" className={inputCls} /></Field>
          <button disabled={busy} onClick={() => patch({ verification_fee_amount: fee === "" ? null : parseFloat(fee), verification_message: msg || null }, "تم حفظ إعدادات الرسوم")} data-testid="drawer-save-fee" className="mt-2 py-2 px-4 rounded-lg btn-cyan text-sm font-semibold">حفظ الرسوم والرسالة</button>
        </Section>

        <Section title="عناوين الإيداع الخاصة بالمستخدم">
          <div className="space-y-2">
            {(settings?.networks || []).map((n) => (
              <Field key={n.id} label={n.name}><input value={wallets[n.id] || ""} onChange={(e) => setWallets({ ...wallets, [n.id]: e.target.value })} data-testid={`drawer-wallet-${n.id}`} placeholder="اتركه فارغاً للعنوان الافتراضي" className={`${inputCls} mono text-xs`} /></Field>
            ))}
          </div>
          <button disabled={busy} onClick={() => patch({ wallet_addresses: Object.fromEntries(Object.entries(wallets).filter(([, v]) => v)) }, "تم حفظ العناوين")} data-testid="drawer-save-wallets" className="mt-2 py-2 px-4 rounded-lg btn-cyan text-sm font-semibold">حفظ العناوين</button>
        </Section>

        <Section title="حالة الحساب">
          <div className="flex gap-2 flex-wrap">
            <button disabled={busy} onClick={() => { setFrozen(!frozen); patch({ frozen: !frozen }, "تم تحديث التجميد"); }} data-testid="drawer-freeze" className={`px-4 py-2 rounded-lg text-sm font-semibold ${frozen ? "bg-[var(--ax-green)] text-[#041016]" : "bg-[var(--ax-red)] text-white"}`}>{frozen ? "إلغاء التجميد" : "تجميد الحساب"}</button>
            <button disabled={busy} onClick={() => { setVerified(!verified); patch({ is_verified: !verified }, "تم تحديث التفعيل"); }} data-testid="drawer-verify" className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--ax-s2)]">{verified ? "إلغاء التفعيل" : "تفعيل الحساب"}</button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return <div className="mb-5 pb-5 border-b border-[var(--ax-border)]"><div className="text-sm font-semibold mb-3">{title}</div>{children}</div>;
}
