// ─────────────────────────────────────────────────────────────
// AdminEmployeeManagement.jsx
// Enterprise-grade Admin-Only Employee Management Dashboard
// Schema: employees (id, employee_name, email, role, department_id,
//         created_at, password), departments (id, department_name, location)
// API: /api/employees, /api/departments, /api/assets/assigned/:employeeId
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

const api = axios.create({
  baseURL: "https://assest-management-system.onrender.com/",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 10000,
});

// ─── Helpers ────────────────────────────────────────────────
function getStoredUser() { try { return JSON.parse(localStorage.getItem("user")) ?? {}; } catch { return {}; } }
function getDisplayName(u) { if (u.employeeName?.trim()) return u.employeeName.trim(); if (u.name?.trim()) return u.name.trim(); if (u.email?.trim()) return u.email.split("@")[0]; return "User"; }
function getUserInitials(u) { return getDisplayName(u).split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)||"U"; }
function empInitials(name) { return (name || "?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0, 2); }
function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

const AVATAR_COLORS = [
  "linear-gradient(135deg,#4f46e5,#7c3aed)",
  "linear-gradient(135deg,#0d9488,#14b8a6)",
  "linear-gradient(135deg,#dc2626,#f97316)",
  "linear-gradient(135deg,#7c3aed,#ec4899)",
  "linear-gradient(135deg,#0369a1,#0891b2)",
  "linear-gradient(135deg,#059669,#84cc16)",
];
function avatarColor(name) { const h = (name||"A").charCodeAt(0) % AVATAR_COLORS.length; return AVATAR_COLORS[h]; }

// ─── NAV ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",   path: "/dashboard"   },
  { label: "Assets",      icon: "📦",  path: "/assets"      },
  { label: "Maintenance", icon: "🔧",  path: "/maintenance" },
  { label: "Reports",     icon: "📊",  path: "/reports"     },
];
const ADMIN_NAV_ITEMS = [
  { label: "Create Employee",   icon: "👤", path: "/create-employee"   },
  { label: "Manage Employees",  icon: "🏢", path: "/admin/employees"   },
];

// ═══════════════════════════════════════════════════════════
// TOAST SYSTEM (same as Dashboard.jsx)
// ═══════════════════════════════════════════════════════════
const ToastCtx = createContext(null);
export function useToast() { return useContext(ToastCtx); }

const T_CFG = {
  success: { icon:"✅", gradient:"linear-gradient(135deg,#10b981,#059669)", bar:"linear-gradient(90deg,#10b981,#34d399,#6ee7b7)", border:"rgba(16,185,129,0.35)", bg:"rgba(240,253,244,0.98)", glow:"0 0 0 1px rgba(16,185,129,0.2),0 20px 60px rgba(16,185,129,0.18),0 4px 16px rgba(0,0,0,0.12)", titleC:"#064e3b", msgC:"#065f46", iconBg:"linear-gradient(135deg,#10b981,#059669)", tagBg:"rgba(16,185,129,0.12)", tagC:"#047857", tag:"SUCCESS", dur:4000 },
  error:   { icon:"❌", gradient:"linear-gradient(135deg,#ef4444,#dc2626)", bar:"linear-gradient(90deg,#ef4444,#f87171,#fca5a5)", border:"rgba(239,68,68,0.35)", bg:"rgba(255,241,241,0.98)", glow:"0 0 0 1px rgba(239,68,68,0.2),0 20px 60px rgba(239,68,68,0.18),0 4px 16px rgba(0,0,0,0.12)", titleC:"#7f1d1d", msgC:"#991b1b", iconBg:"linear-gradient(135deg,#ef4444,#dc2626)", tagBg:"rgba(239,68,68,0.12)", tagC:"#b91c1c", tag:"ERROR", dur:6000 },
  warning: { icon:"⚠️", gradient:"linear-gradient(135deg,#f59e0b,#d97706)", bar:"linear-gradient(90deg,#f59e0b,#fcd34d,#fef08a)", border:"rgba(245,158,11,0.35)", bg:"rgba(255,251,235,0.98)", glow:"0 0 0 1px rgba(245,158,11,0.2),0 20px 60px rgba(245,158,11,0.15),0 4px 16px rgba(0,0,0,0.12)", titleC:"#78350f", msgC:"#92400e", iconBg:"linear-gradient(135deg,#f59e0b,#d97706)", tagBg:"rgba(245,158,11,0.12)", tagC:"#b45309", tag:"WARNING", dur:5000 },
  info:    { icon:"ℹ️", gradient:"linear-gradient(135deg,#4f46e5,#7c3aed)", bar:"linear-gradient(90deg,#4f46e5,#818cf8,#a5b4fc)", border:"rgba(79,70,229,0.35)", bg:"rgba(245,243,255,0.98)", glow:"0 0 0 1px rgba(79,70,229,0.2),0 20px 60px rgba(79,70,229,0.15),0 4px 16px rgba(0,0,0,0.12)", titleC:"#1e1b4b", msgC:"#3730a3", iconBg:"linear-gradient(135deg,#4f46e5,#7c3aed)", tagBg:"rgba(79,70,229,0.12)", tagC:"#4338ca", tag:"INFO", dur:4000 },
};

function ToastCard({ t, remove }) {
  const c = T_CFG[t.type] ?? T_CFG.info;
  const [vis, setVis] = useState(false), [w, setW] = useState(100);
  const iv = useRef(null);
  const isMob = typeof window !== "undefined" && window.innerWidth < 640;
  useEffect(() => { const id = setTimeout(() => setVis(true), 20); return () => clearTimeout(id); }, []);
  useEffect(() => {
    const step = 100 / (c.dur / 50);
    iv.current = setInterval(() => setW(p => { if (p <= 0) { clearInterval(iv.current); return 0; } return p - step; }), 50);
    return () => clearInterval(iv.current);
  }, [c.dur]);
  useEffect(() => { if (w <= 0) close(); }, [w]);
  const close = () => { setVis(false); setTimeout(() => remove(t.id), 380); };
  return (
    <div style={{ transform: vis ? "translateY(0) scale(1)" : isMob ? "translateY(80px) scale(0.92)" : "translateX(110%) scale(0.92)", opacity: vis ? 1 : 0, transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.4s ease", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 18, overflow: "hidden", boxShadow: c.glow, width: "100%", pointerEvents: "auto", position: "relative" }}>
      <div style={{ height: 3, background: c.bar, position: "absolute", top: 0, left: 0, right: 0 }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 14px 14px 14px" }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: `0 4px 12px ${c.border}` }}>{c.icon}</div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", background: c.tagBg, color: c.tagC, borderRadius: 5, padding: "2px 6px", textTransform: "uppercase" }}>{c.tag}</span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: c.titleC, marginBottom: 3, lineHeight: 1.3 }}>{t.title}</p>
          {t.message && <p style={{ fontSize: 12, color: c.msgC, lineHeight: 1.55, margin: 0, opacity: 0.85 }}>{t.message}</p>}
        </div>
        <button onClick={close} style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#64748b", flexShrink: 0, marginTop: 2 }} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.14)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.06)"}>✕</button>
      </div>
      <div style={{ height: 4, background: "rgba(0,0,0,0.07)", borderRadius: "0 0 18px 18px" }}>
        <div style={{ height: "100%", width: `${w}%`, background: c.bar, transition: "width 0.05s linear", borderRadius: "0 0 0 18px" }} />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, remove }) {
  const isMob = typeof window !== "undefined" && window.innerWidth < 640;
  return createPortal(
    <div style={{ position: "fixed", zIndex: 99999, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 10, ...(isMob ? { bottom: 16, left: 12, right: 12, alignItems: "stretch" } : { top: 72, right: 20, width: 380, alignItems: "flex-end" }) }}>
      {toasts.map(t => <ToastCard key={t.id} t={t} remove={remove} />)}
    </div>,
    document.body
  );
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, title, message) => {
    const id = Date.now() + Math.random();
    setToasts(p => { const n = [...p, { id, type, title, message }]; return n.length > 4 ? n.slice(-4) : n; });
  }, []);
  const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  const toast = useMemo(() => ({ success:(t,m)=>add("success",t,m), error:(t,m)=>add("error",t,m), warning:(t,m)=>add("warning",t,m), info:(t,m)=>add("info",t,m) }), [add]);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} remove={remove} />
    </ToastCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATION DROPDOWN (matches Dashboard.jsx fix)
// ═══════════════════════════════════════════════════════════
function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TS = {
    critical: { iconBg:"bg-red-100", dot:"bg-red-500", title:"text-red-700" },
    warning:  { iconBg:"bg-amber-100", dot:"bg-amber-500", title:"text-amber-700" },
    info:     { iconBg:"bg-indigo-100", dot:"bg-indigo-400", title:"text-indigo-700" },
  };
  const screenW = typeof window !== "undefined" ? window.innerWidth : 768;
  const isMobile = screenW < 480;
  const topOffset = (anchorRect?.bottom ?? 60) + 8;
  const style = isMobile
    ? { position:"fixed", top:topOffset, left:12, right:12, zIndex:9999, background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 24px 60px rgba(79,70,229,.22),0 4px 16px rgba(0,0,0,.12)", border:"1px solid rgba(79,70,229,.1)" }
    : { position:"fixed", top:topOffset, right: anchorRect ? Math.max(8, window.innerWidth - anchorRect.right) : 16, width:320, zIndex:9999, background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 24px 60px rgba(79,70,229,.22),0 4px 16px rgba(0,0,0,.12)", border:"1px solid rgba(79,70,229,.1)" };
  return createPortal(
    <>
      <div style={{ position:"fixed", inset:0, zIndex:9998 }} onClick={onClose} />
      <div style={style}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50" style={{ background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-950">Notifications</span>
            <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background:"linear-gradient(90deg,#f43f5e,#ec4899)" }}>{notifications.length}</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm">✕</button>
        </div>
        <div style={{ maxHeight:320, overflowY:"auto" }}>
          {notifications.length === 0
            ? <p className="text-xs text-slate-400 text-center py-8">No notifications</p>
            : notifications.map(n => {
                const s = TS[n.type] ?? TS.info;
                return (
                  <div key={n.id} className="flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-default">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${s.iconBg}`}>{n.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs font-bold truncate ${s.title}`}>{n.title}</span>
                        <span className="text-xs text-slate-300 flex-shrink-0 ml-2">{n.time}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
                  </div>
                );
              })
          }
        </div>
        <div className="px-4 py-2.5 border-t border-indigo-50 text-center">
          <span className="text-xs text-indigo-500 font-medium">
            {notifications.filter(n=>n.type==="critical").length} critical · {notifications.length} total
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR (Admin-enhanced)
// ═══════════════════════════════════════════════════════════
function SidebarContent({ onNavigate }) {
  const navigate = useNavigate(), location = useLocation(), user = getStoredUser();
  const isAdmin = user.role === "Admin";
  const go = (p) => { navigate(p); if (onNavigate) onNavigate(); };
  const NavBtn = ({ item }) => {
    const on = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
    return (
      <button onClick={() => go(item.path)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 relative ${on ? "text-white" : "text-indigo-300 hover:text-indigo-100 hover:bg-white/5"}`}
        style={on ? { background:"linear-gradient(90deg,rgba(99,102,241,.5),rgba(20,184,166,.3))", boxShadow:"0 0 20px rgba(99,102,241,.3)" } : {}}>
        {on && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full" style={{ background:"linear-gradient(180deg,#818cf8,#34d399)" }} />}
        <span className="text-sm w-4 text-center">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
      </button>
    );
  };
  return (
    <div className="flex flex-col h-full py-6 px-3.5">
      <div className="flex items-center gap-2.5 px-2 mb-8 cursor-pointer" onClick={() => go("/dashboard")}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background:"linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
        <div>
          <div className="text-white font-bold text-base tracking-tight">AssetAI</div>
          <div className="text-indigo-300 font-medium tracking-widest uppercase" style={{ fontSize:9 }}>Management Suite</div>
        </div>
      </div>
      <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>
      <nav className="flex flex-col gap-1">{NAV_ITEMS.map(i => <NavBtn key={i.label} item={i} />)}</nav>
      {isAdmin && (
        <>
          <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mt-5 mb-2">Admin</p>
          <nav className="flex flex-col gap-1">{ADMIN_NAV_ITEMS.map(i => <NavBtn key={i.label} item={i} />)}</nav>
        </>
      )}
      <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: isAdmin ? "#34d399" : "#a5b4fc" }}>{user.role ?? "Employee"}</p>
        <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{getDisplayName(user)}</p>
        <p className="text-xs text-indigo-600 mt-0.5">v3.1.0 — Pro Plan</p>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen, onClose }) {
  const bg = "linear-gradient(180deg,#1e1b4b 0%,#312e81 60%,#134e4a 100%)";
  return (
    <>
      <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col" style={{ background:bg }}><SidebarContent /></aside>
      <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${mobileOpen?"opacity-100 pointer-events-auto":"opacity-0 pointer-events-none"}`} onClick={onClose} />
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileOpen?"translate-x-0":"-translate-x-full"}`} style={{ background:bg }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-indigo-300 hover:bg-white/10 hover:text-white transition-colors text-lg z-10">✕</button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════
function Navbar({ onMenuToggle, notifications }) {
  const navigate = useNavigate(), user = getStoredUser(), { toast } = useToast();
  const bellRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false), [anchorRect, setAnchorRect] = useState(null);
  const dName = getDisplayName(user), ini = getUserInitials(user);
  const urgent = notifications.filter(n => n.type === "critical" || n.type === "warning").length;
  const handleBell = () => { if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect()); setNotifOpen(o=>!o); };
  const logout = () => { localStorage.removeItem("user"); toast.info("Signed Out","You have been logged out successfully."); setTimeout(()=>navigate("/"),600); };
  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b"
      style={{ background:"rgba(255,255,255,.85)", backdropFilter:"blur(12px)", borderColor:"rgba(79,70,229,.08)" }}>
      <button onClick={onMenuToggle} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
        <span className="flex flex-col gap-1 w-4"><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /></span>
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-indigo-950 hidden sm:inline">Admin Dashboard</span>
        <span className="text-xs text-indigo-300 font-normal hidden sm:inline"> / Employee Management</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">Employees</span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Admin Portal
      </div>
      <button ref={bellRef} onClick={handleBell}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0 ${notifOpen?"bg-indigo-100 border-indigo-200":"border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{ background: urgent>0?"linear-gradient(135deg,#f43f5e,#ec4899)":"linear-gradient(135deg,#4f46e5,#9333ea)", fontSize:9 }}>
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>
      {notifOpen && <NotificationDropdown notifications={notifications} anchorRect={anchorRect} onClose={() => setNotifOpen(false)} />}
      <div className="flex items-center gap-2 border border-indigo-100 rounded-full px-2 py-1 bg-white cursor-pointer flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background:"linear-gradient(135deg,#4f46e5,#14b8a6)" }}>{ini}</div>
        <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-20 truncate">{dName.split(" ")[0]}</span>
      </div>
      <button onClick={logout} className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors flex-shrink-0">
        <span className="hidden sm:inline">→ Logout</span><span className="sm:hidden">→</span>
      </button>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════
// STAT CARDS
// ═══════════════════════════════════════════════════════════
function StatCard({ icon, label, value, sub, gradient, glowColor, trend, trendUp }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 cursor-default group transition-all duration-300 hover:-translate-y-1"
      style={{ background: gradient, boxShadow: `0 4px 24px ${glowColor}` }}>
      <div className="absolute inset-0 opacity-10" style={{ background:"radial-gradient(circle at top right,white,transparent 60%)" }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{icon}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30`}>{trend}</span>
        </div>
        <p className="text-3xl font-black text-white tracking-tight leading-none">{value}</p>
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mt-1">{label}</p>
        <p className="text-xs text-white/50 mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════
function RoleBadge({ role }) {
  const isAdmin = role === "Admin";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${isAdmin ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
      {isAdmin ? "🔐" : "👤"} {role}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    Active:   { cls:"bg-emerald-50 text-emerald-700 border-emerald-200", dot:"bg-emerald-500" },
    Inactive: { cls:"bg-amber-50 text-amber-700 border-amber-200", dot:"bg-amber-400" },
    Removed:  { cls:"bg-red-50 text-red-600 border-red-200", dot:"bg-red-500" },
  };
  const s = cfg[status] ?? { cls:"bg-slate-100 text-slate-500 border-slate-200", dot:"bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status ?? "Unknown"}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[1,2,3,4,5,6,7].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded-full" style={{ width: `${60 + (i*13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════
// CONFIRM DELETE MODAL
// ═══════════════════════════════════════════════════════════
function ConfirmDeleteModal({ employee, onConfirm, onCancel, loading }) {
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.7)", backdropFilter:"blur(6px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl" style={{ boxShadow:"0 32px 80px rgba(239,68,68,0.2),0 8px 32px rgba(0,0,0,0.15)" }}>
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:"linear-gradient(135deg,#fee2e2,#fecaca)" }}>
            <span className="text-3xl">🗑️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Remove Employee?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Are you sure you want to permanently remove{" "}
            <span className="font-semibold text-red-600">{employee?.employeeName || employee?.employee_name || "this employee"}</span>?
            <br />
            <span className="text-red-500 font-medium">They will lose all system access immediately.</span>
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", boxShadow:"0 4px 14px rgba(239,68,68,.4)" }}>
            {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Removing…</> : "❌ Remove"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════
// EDIT MODAL
// ═══════════════════════════════════════════════════════════
function EditModal({ employee, departments, onSave, onClose, loading }) {
  const [form, setForm] = useState({
    employeeName: employee?.employeeName || employee?.employee_name || "",
    email: employee?.email || "",
    role: employee?.role || "Employee",
    departmentId: employee?.departmentId || employee?.department_id || "",
    status: employee?.status || "Active",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.7)", backdropFilter:"blur(6px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-indigo-50 flex items-center justify-between" style={{ background:"linear-gradient(90deg,#f0f0ff,#f0fdfa)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0" style={{ background: avatarColor(form.employeeName) }}>
              {empInitials(form.employeeName)}
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-950">Edit Employee</h3>
              <p className="text-xs text-indigo-400">Update employee information</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {[
            { label:"Full Name", key:"employeeName", type:"text", placeholder:"Enter full name" },
            { label:"Email Address", key:"email", type:"email", placeholder:"Enter email" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
              <select value={form.role} onChange={e=>set("role",e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition-all">
                <option>Admin</option><option>Employee</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition-all">
                <option>Active</option><option>Inactive</option><option>Removed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
            <select value={form.departmentId} onChange={e=>set("departmentId",e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white transition-all">
              <option value="">— No Department —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.departmentName || d.department_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            style={{ background:"linear-gradient(90deg,#4f46e5,#7c3aed)", boxShadow:"0 4px 14px rgba(79,70,229,.4)" }}>
            {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : "✓ Save Changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════
// VIEW MODAL
// ═══════════════════════════════════════════════════════════
function ViewModal({ employee, departments, assignedAssets, onClose }) {
  const deptName = useMemo(() => {
    const d = departments.find(d => d.id === (employee?.departmentId || employee?.department_id));
    return d ? (d.departmentName || d.department_name) : "—";
  }, [departments, employee]);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.7)", backdropFilter:"blur(6px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="relative px-6 py-6 text-white" style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81,#134e4a)" }}>
          <div className="absolute inset-0 opacity-20" style={{ background:"radial-gradient(circle at top right,white,transparent 60%)" }} />
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">✕</button>
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0 border-2 border-white/20"
              style={{ background: avatarColor(employee?.employeeName || employee?.employee_name || "") }}>
              {empInitials(employee?.employeeName || employee?.employee_name || "")}
            </div>
            <div>
              <h3 className="text-lg font-black">{employee?.employeeName || employee?.employee_name || "—"}</h3>
              <p className="text-sm text-white/70">{employee?.email || "—"}</p>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={employee?.role || "Employee"} />
                <StatusBadge status={employee?.status || "Active"} />
              </div>
            </div>
          </div>
        </div>
        {/* Details */}
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:"Department", value:deptName },
              { label:"Joined Date", value:fmtDate(employee?.createdAt || employee?.created_at) },
              { label:"Employee ID", value:`#${employee?.id || "—"}` },
              { label:"Role Level", value:employee?.role || "—" },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{f.label}</p>
                <p className="text-sm font-bold text-slate-800">{f.value}</p>
              </div>
            ))}
          </div>
          {/* Assigned Assets */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Assigned Assets</p>
            {assignedAssets.length === 0
              ? <p className="text-xs text-slate-400 italic py-2">No assets assigned</p>
              : <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {assignedAssets.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2">
                      <span className="text-sm">📦</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-indigo-800 truncate">{a.assetName || a.asset_name || `Asset #${a.assetId || a.asset_id}`}</p>
                        {a.assignmentStatus && <p className="text-xs text-indigo-400">{a.assignmentStatus}</p>}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════
// ACCESS DENIED
// ═══════════════════════════════════════════════════════════
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8" style={{ background:"linear-gradient(135deg,#f0f0ff,#f5f9ff,#f0fff8)" }}>
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl" style={{ background:"linear-gradient(135deg,#fee2e2,#fecaca)", boxShadow:"0 8px 32px rgba(239,68,68,.2)" }}>🔒</div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm max-w-xs">You do not have permission to view this page. Admin access is required.</p>
      </div>
      <button onClick={() => navigate("/dashboard")} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background:"linear-gradient(90deg,#4f46e5,#7c3aed)", boxShadow:"0 4px 14px rgba(79,70,229,.4)" }}>
        ← Return to Dashboard
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BULK SELECTION CHECKBOX
// ═══════════════════════════════════════════════════════════
function Checkbox({ checked, onChange, indeterminate }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN CONTENT
// ═══════════════════════════════════════════════════════════
function EmployeeManagementContent() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDept, setFilterDept] = useState("All");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [viewEmp, setViewEmp] = useState(null);
  const [editEmp, setEditEmp] = useState(null);
  const [deleteEmp, setDeleteEmp] = useState(null);
  const [assignedAssets, setAssignedAssets] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [bulkDelLoading, setBulkDelLoading] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const PAGE_SIZE = 8;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        api.get("/api/employees"),
        api.get("/api/departments"),
      ]);
      // Normalise keys (snake_case vs camelCase)
      const normalise = (e) => ({
        ...e,
        employeeName: e.employeeName || e.employee_name,
        departmentId: e.departmentId || e.department_id,
        createdAt: e.createdAt || e.created_at,
        status: e.status || "Active",
      });
      setEmployees((empRes.data || []).map(normalise));
      const normDept = (d) => ({ ...d, departmentName: d.departmentName || d.department_name });
      setDepartments((deptRes.data || []).map(normDept));
    } catch (err) {
      toast.error("Failed to Load", err.message || "Could not fetch employee data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const deptMap = useMemo(() => {
    const m = {};
    departments.forEach(d => { m[d.id] = d.departmentName || d.department_name; });
    return m;
  }, [departments]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const q = search.toLowerCase();
      const matchQ = !q || (e.employeeName||"").toLowerCase().includes(q) || (e.email||"").toLowerCase().includes(q);
      const matchR = filterRole === "All" || e.role === filterRole;
      const matchS = filterStatus === "All" || (e.status || "Active") === filterStatus;
      const matchD = filterDept === "All" || String(e.departmentId) === filterDept;
      return matchQ && matchR && matchS && matchD;
    });
  }, [employees, search, filterRole, filterStatus, filterDept]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, filterRole, filterStatus, filterDept]);

  // Stats
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => (e.status||"Active") === "Active").length;
    const removed = employees.filter(e => e.status === "Removed").length;
    const admins = employees.filter(e => e.role === "Admin").length;
    return { total, active, removed, admins };
  }, [employees]);

  // Notifications for navbar
  const notifications = useMemo(() => {
    const n = [];
    if (stats.removed > 0) n.push({ id:"rem", type:"warning", icon:"❌", title:"Removed Employees", message:`${stats.removed} employee${stats.removed>1?"s have":" has"} been removed`, time:"Review" });
    n.push({ id:"total", type:"info", icon:"👥", title:"Employee Count", message:`${stats.total} employees registered in system`, time:"Now" });
    if (stats.admins > 1) n.push({ id:"adm", type:"info", icon:"🔐", title:"Admin Accounts", message:`${stats.admins} admin accounts active`, time:"Info" });
    n.push({ id:"sys", type:"info", icon:"✅", title:"System Status", message:"Employee data synced successfully", time:"Now" });
    return n;
  }, [stats]);

  // Load assigned assets for view modal
  const openView = async (emp) => {
    setViewEmp(emp); setAssignedAssets([]);
    try {
      const r = await api.get(`/api/asset-assignments/employee/${emp.id}`);
      setAssignedAssets(r.data || []);
    } catch { setAssignedAssets([]); }
  };

  const handleEdit = async (form) => {
    setActionLoading(true);
    try {
      await api.put(`/api/employees/${editEmp.id}`, {
        employeeName: form.employeeName,
        email: form.email,
        role: form.role,
        departmentId: form.departmentId || null,
        status: form.status,
      });
      toast.success("Employee Updated", `${form.employeeName} has been updated successfully.`);
      setEditEmp(null);
      fetchAll();
    } catch (err) {
      toast.error("Update Failed", err.response?.data?.message || err.message);
    } finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/api/employees/${deleteEmp.id}`);
      toast.success("Employee Removed", `${deleteEmp.employeeName || deleteEmp.employee_name} has been permanently removed.`);
      setDeleteEmp(null);
      fetchAll();
    } catch (err) {
      toast.error("Delete Failed", err.response?.data?.message || err.message);
    } finally { setActionLoading(false); }
  };

  const handleBulkDelete = async () => {
    setBulkDelLoading(true);
    try {
      await Promise.all([...selected].map(id => api.delete(`/api/employees/${id}`)));
      toast.success("Bulk Remove Done", `${selected.size} employee${selected.size>1?"s":""} removed successfully.`);
      setSelected(new Set()); setShowBulkConfirm(false);
      fetchAll();
    } catch (err) {
      toast.error("Bulk Delete Failed", err.message);
    } finally { setBulkDelLoading(false); }
  };

  const exportCSV = () => {
    const headers = ["ID","Name","Email","Role","Department","Status","Joined"];
    const rows = filtered.map(e => [e.id, e.employeeName, e.email, e.role, deptMap[e.departmentId]||"—", e.status||"Active", fmtDate(e.createdAt)]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "employees.csv"; a.click();
    toast.success("Export Complete", `${filtered.length} records exported as CSV.`);
  };

  const toggleSelect = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (paged.every(e => selected.has(e.id))) setSelected(p => { const n = new Set(p); paged.forEach(e=>n.delete(e.id)); return n; });
    else setSelected(p => { const n = new Set(p); paged.forEach(e=>n.add(e.id)); return n; });
  };
  const allPageSelected = paged.length > 0 && paged.every(e => selected.has(e.id));
  const somePageSelected = paged.some(e => selected.has(e.id)) && !allPageSelected;

  // Unique depts for filter
  const deptOptions = useMemo(() => departments.map(d => ({ id:d.id, name:d.departmentName||d.department_name })), [departments]);

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="👥" label="Total Employees" value={stats.total} sub="All registered users" gradient="linear-gradient(135deg,#4f46e5,#7c3aed)" glowColor="rgba(79,70,229,.25)" trend="All" />
        <StatCard icon="✅" label="Active" value={stats.active} sub="Currently active" gradient="linear-gradient(135deg,#059669,#0d9488)" glowColor="rgba(5,150,105,.25)" trend="Live" trendUp />
        <StatCard icon="❌" label="Removed" value={stats.removed} sub="Deactivated accounts" gradient="linear-gradient(135deg,#dc2626,#f97316)" glowColor="rgba(220,38,38,.2)" trend={stats.removed > 0 ? "⚠" : "✓"} />
        <StatCard icon="🔐" label="Admin Count" value={stats.admins} sub="Admin-level users" gradient="linear-gradient(135deg,#7c3aed,#ec4899)" glowColor="rgba(124,58,237,.25)" trend="Admin" />
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl border border-indigo-50 p-4" style={{ boxShadow:"0 2px 12px rgba(79,70,229,.06)" }}>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
          </div>
          {[
            { label:"Role", value:filterRole, set:setFilterRole, opts:["All","Admin","Employee"] },
            { label:"Status", value:filterStatus, set:setFilterStatus, opts:["All","Active","Inactive","Removed"] },
          ].map(f => (
            <select key={f.label} value={f.value} onChange={e=>f.set(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white text-slate-700 transition-all">
              {f.opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          <select value={filterDept} onChange={e=>setFilterDept(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white text-slate-700 transition-all">
            <option value="All">All Departments</option>
            {deptOptions.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-2 whitespace-nowrap">
            📥 Export CSV
          </button>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <span className="text-xs font-semibold text-red-700">{selected.size} employee{selected.size>1?"s":""} selected</span>
            <button onClick={() => setShowBulkConfirm(true)} className="ml-auto text-xs font-bold text-white px-3 py-1.5 rounded-lg flex items-center gap-1" style={{ background:"linear-gradient(90deg,#ef4444,#dc2626)" }}>
              🗑️ Delete Selected
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden" style={{ boxShadow:"0 2px 12px rgba(79,70,229,.06)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-indigo-50/80" style={{ background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
          <span className="text-sm font-bold text-indigo-950">Employee Directory</span>
          <span className="text-xs text-slate-400">{filtered.length} result{filtered.length!==1?"s":""}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allPageSelected} onChange={toggleAll} indeterminate={somePageSelected} />
                </th>
                {["Profile","Email","Role","Department","Status","Joined","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({length:6}).map((_,i) => <SkeletonRow key={i} />)
                : paged.length === 0
                  ? <tr><td colSpan={8} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-4xl">🔍</span>
                        <p className="text-sm font-semibold text-slate-400">No employees found</p>
                        <p className="text-xs text-slate-300">Try adjusting your search or filters</p>
                      </div>
                    </td></tr>
                  : paged.map((emp, idx) => {
                      const dept = deptMap[emp.departmentId] || "—";
                      const isChecked = selected.has(emp.id);
                      return (
                        <tr key={emp.id} className={`hover:bg-indigo-50/40 transition-colors border-b border-slate-50 ${isChecked ? "bg-indigo-50/60" : idx%2===1 ? "bg-slate-50/40" : ""}`}>
                          <td className="px-4 py-3">
                            <Checkbox checked={isChecked} onChange={() => toggleSelect(emp.id)} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                                style={{ background: avatarColor(emp.employeeName || "") }}>
                                {empInitials(emp.employeeName || "")}
                              </div>
                              <span className="font-semibold text-slate-800 whitespace-nowrap">{emp.employeeName || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{emp.email || "—"}</td>
                          <td className="px-4 py-3"><RoleBadge role={emp.role || "Employee"} /></td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">{dept}</span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={emp.status || "Active"} /></td>
                          <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(emp.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openView(emp)} title="View" className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">👁</button>
                              <button onClick={() => setEditEmp(emp)} title="Edit" className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-violet-100 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors">✏️</button>
                              <button onClick={() => setDeleteEmp(emp)} title="Delete" className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-indigo-50">
            <span className="text-xs text-slate-400">Page {page} of {totalPages} · {filtered.length} total</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="w-7 h-7 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">←</button>
              {Array.from({length:Math.min(5,totalPages)}).map((_,i) => {
                const pg = Math.max(1, Math.min(page-2,totalPages-4)) + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${pg===page ? "text-white border-0" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    style={pg===page ? { background:"linear-gradient(135deg,#4f46e5,#7c3aed)" } : {}}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="w-7 h-7 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">→</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {deleteEmp && <ConfirmDeleteModal employee={deleteEmp} onConfirm={handleDelete} onCancel={() => setDeleteEmp(null)} loading={actionLoading} />}
      {editEmp && <EditModal employee={editEmp} departments={departments} onSave={handleEdit} onClose={() => setEditEmp(null)} loading={actionLoading} />}
      {viewEmp && <ViewModal employee={viewEmp} departments={departments} assignedAssets={assignedAssets} onClose={() => setViewEmp(null)} />}

      {/* Bulk Delete Confirm */}
      {showBulkConfirm && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.7)", backdropFilter:"blur(6px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center" style={{ boxShadow:"0 32px 80px rgba(239,68,68,.2)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:"linear-gradient(135deg,#fee2e2,#fecaca)" }}>
              <span className="text-3xl">🗑️</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Bulk Remove {selected.size} Employee{selected.size>1?"s":""}?</h3>
            <p className="text-sm text-slate-500 mb-6">This action is permanent. All selected employees will lose system access immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBulkConfirm(false)} disabled={bulkDelLoading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDelLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", boxShadow:"0 4px 14px rgba(239,68,68,.4)" }}>
                {bulkDelLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Removing…</> : "❌ Confirm Remove"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAGE WRAPPER
// ═══════════════════════════════════════════════════════════
function AdminEmployeeInner() {
  const user = getStoredUser();
  const [open, setOpen] = useState(false);

  // Admin guard
  if (user.role !== "Admin") return <AccessDenied />;

  // Notifications (static for now — could extend to pull from API)
  const notifications = [
    { id:"sys", type:"info", icon:"✅", title:"System Status", message:"Employee data synced", time:"Now" },
    { id:"adm", type:"info", icon:"🔐", title:"Admin Portal", message:"You have full admin access", time:"Info" },
  ];

  return (
    <div className="flex min-h-screen" style={{ background:"linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={() => setOpen(o=>!o)} notifications={notifications} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <EmployeeManagementContent />
        </main>
      </div>
    </div>
  );
}

export default function AdminEmployeeManagement() {
  return <ToastProvider><AdminEmployeeInner /></ToastProvider>;
}