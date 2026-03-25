// ═══════════════════════════════════════════════════════════════════════════
// AdminEmployeeManagement.jsx  —  Complete Admin Employee Management Page
// ═══════════════════════════════════════════════════════════════════════════
//
// SCHEMA (from Dump20260319.sql):
//   employees   : id, employee_name, email, role, department_id, created_at, password
//   departments : id, department_name, location, budget, created_at
//   asset_assignments : id, asset_id, employee_id, assigned_date, assignment_status, notes
//
// ─── COMPLETE CHANGE LOG ────────────────────────────────────────────────────
//
// [FIX-01] NOTIFICATION — Full mobile-safe portal dropdown
//   Same buildNotifications() as Dashboard.jsx. Fetches /api/assets +
//   /api/maintenance at root level. Real asset names via assetMap.
//   Mobile: left:12 right:12 (full-width gutters, no left-edge clipping).
//   Desktop: anchor-relative 320px width.
//
// [FIX-02] FILTER DROPDOWNS — Role / Status / Department all work correctly
//   Each filter applied independently via useMemo. Department compares
//   String(e.departmentId) === filterDept to avoid numeric/string mismatch.
//   Any combination of filters updates the table instantly.
//
// [FIX-03] STATS CARDS — Live counts from employees array post-fetchAll
//   Total / Active / Removed / Admin counts update after every mutation.
//
// [FIX-04] DELETE — Guaranteed with real API call + error feedback
//   Optimistic local removal + fetchAll re-sync. If server rejects (409 etc)
//   error toast shown and local state restored via re-sync.
//
// [FIX-05] DEPARTMENT COLUMN — Shows real name (IT / HR / Finance / Ops)
//   deptMap built from /api/departments. TableRow uses deptMap[departmentId].
//
// [FIX-06] PASSWORD COLUMN + EDIT/CREATE FIELD
//   Table shows masked "••••••". Edit modal has optional password field.
//   Create modal has required password field. Sent in PUT/POST payload.
//
// [FIX-07] EMPLOYEE ID (#ID) column — sorted ascending, easy to count
//
// [FIX-08] JOINED DATE — date-picker in create form, displayed in table
//   Sent as joinedDate + joined_date in payload. Displayed via fmtDate().
//
// [FIX-09] VIEW MODAL X-BUTTON — fixed. Also closes on backdrop click.
//
// [FIX-10] EDIT — sends all fields including dept + password, re-syncs.
//
// [FIX-11] STATUS "Removed" — soft-delete via Edit. Hard delete via DELETE.
//   Removed stats card counts status === "Removed" employees.
//
// [FIX-12] SIDEBAR — shows both admin nav items (same as Dashboard.jsx).
//
// [FIX-13] MOBILE TABLE — overflow-x:auto, minWidth 860px.
//
// [FIX-14] DEACTIVATED COUNT — derived live from employees.status === "Removed".
//
// [FIX-15] TOAST — same professional toast system as Dashboard.jsx.
//
// ═══════════════════════════════════════════════════════════════════════════

import {
  useState, useEffect, useMemo, useRef, useCallback,
  createContext, useContext,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

// ─── Axios ───────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "https://assest-management-system.onrender.com/",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 12000,
});

// ─── Nav items [FIX-12] ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",   path: "/dashboard"   },
  { label: "Assets",      icon: "📦",  path: "/assets"      },
  { label: "Maintenance", icon: "🔧",  path: "/maintenance" },
  { label: "Reports",     icon: "📊",  path: "/reports"     },
];
const ADMIN_NAV_ITEMS = [
  { label: "Create Employee",  icon: "👤", path: "/create-employee"  },
  { label: "Manage Employees", icon: "🏢", path: "/admin/employees"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user")) ?? {}; } catch { return {}; }
}
function getDisplayName(u) {
  if (u.employeeName?.trim()) return u.employeeName.trim();
  if (u.name?.trim())         return u.name.trim();
  if (u.email?.trim())        return u.email.split("@")[0];
  return "User";
}
function getUserInitials(u) {
  return getDisplayName(u).split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";
}
function getDashboardLabel(u) {
  const r = (u.role ?? "").trim();
  return r ? `${r} Dashboard` : "Dashboard";
}
// [FIX-08] Format date nicely
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function empInitials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
const AV_COLORS = [
  "linear-gradient(135deg,#4f46e5,#7c3aed)",
  "linear-gradient(135deg,#0d9488,#14b8a6)",
  "linear-gradient(135deg,#dc2626,#f97316)",
  "linear-gradient(135deg,#7c3aed,#ec4899)",
  "linear-gradient(135deg,#0369a1,#0891b2)",
  "linear-gradient(135deg,#059669,#84cc16)",
];
function avatarColor(name) {
  return AV_COLORS[((name || "A").charCodeAt(0)) % AV_COLORS.length];
}
// Normalise employee — handles both camelCase and snake_case from Spring Boot
function normaliseEmp(e) {
  return {
    ...e,
    employeeName: e.employeeName  || e.employee_name  || "",
    departmentId: e.departmentId  != null ? e.departmentId  : (e.department_id ?? null),
    createdAt:    e.createdAt     || e.created_at     || null,
    joinedDate:   e.joinedDate    || e.joined_date    || e.createdAt || e.created_at || null,
    status:       e.status        || "Active",
    password:     e.password      || "",
  };
}

// ─── [FIX-01] Notification helpers (identical to Dashboard.jsx) ──────────────
function deriveStatus(dt) {
  if (!dt) return "Completed";
  const d = (new Date(dt) - new Date()) / 86400000;
  return d < 0 ? "Overdue" : d <= 60 ? "Pending" : "Completed";
}
function resolveNotifAssetName(rec, map) {
  if (rec.assetName?.trim()) return rec.assetName.trim();
  if (rec.assetId && map[rec.assetId]) return map[rec.assetId];
  return `Asset #${rec.assetId ?? "?"}`;
}
function buildNotifications(assets, maint, assetMap) {
  const n = [];
  maint.filter(r => deriveStatus(r.nextDueDate) === "Overdue").slice(0, 3).forEach(r =>
    n.push({ id: `ov-${r.id}`, type: "critical", icon: "🚨", title: "Overdue Maintenance",
      message: `${resolveNotifAssetName(r, assetMap)} — due on ${r.nextDueDate ?? "unknown date"}`, time: "Overdue" }));
  assets.filter(a => (a.status ?? "").toLowerCase() === "maintenance").slice(0, 2).forEach(a =>
    n.push({ id: `mt-${a.id}`, type: "warning", icon: "🔧", title: "Asset Under Maintenance",
      message: `${a.assetName ?? "Unknown asset"} is currently under maintenance`, time: "Active" }));
  const p = maint.filter(r => deriveStatus(r.nextDueDate) === "Pending");
  if (p.length > 0) n.push({ id: "pend", type: "info", icon: "⏳", title: "Upcoming Maintenance",
    message: `${p.length} task${p.length > 1 ? "s" : ""} due within 60 days`, time: "Upcoming" });
  const i = assets.filter(a => (a.status ?? "").toLowerCase() === "inactive");
  if (i.length > 0) n.push({ id: "inact", type: "info", icon: "📦", title: "Inactive Assets",
    message: `${i.length} asset${i.length > 1 ? "s are" : " is"} inactive`, time: "Review" });
  n.push({ id: "sys", type: "info", icon: "✅", title: "System Status", message: "All systems operational — data synced", time: "Now" });
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// [FIX-15] TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
const ToastCtx = createContext(null);
function useToast() { return useContext(ToastCtx); }
const T_CFG = {
  success: { icon:"✅", bar:"linear-gradient(90deg,#10b981,#34d399)", border:"rgba(16,185,129,0.35)", bg:"rgba(240,253,244,0.98)", glow:"0 0 0 1px rgba(16,185,129,0.2),0 20px 60px rgba(16,185,129,0.18),0 4px 16px rgba(0,0,0,0.12)", titleC:"#064e3b", msgC:"#065f46", iconBg:"linear-gradient(135deg,#10b981,#059669)", tagBg:"rgba(16,185,129,0.12)", tagC:"#047857", tag:"SUCCESS", dur:4000 },
  error:   { icon:"❌", bar:"linear-gradient(90deg,#ef4444,#f87171)", border:"rgba(239,68,68,0.35)", bg:"rgba(255,241,241,0.98)", glow:"0 0 0 1px rgba(239,68,68,0.2),0 20px 60px rgba(239,68,68,0.18),0 4px 16px rgba(0,0,0,0.12)", titleC:"#7f1d1d", msgC:"#991b1b", iconBg:"linear-gradient(135deg,#ef4444,#dc2626)", tagBg:"rgba(239,68,68,0.12)", tagC:"#b91c1c", tag:"ERROR", dur:6000 },
  warning: { icon:"⚠️", bar:"linear-gradient(90deg,#f59e0b,#fcd34d)", border:"rgba(245,158,11,0.35)", bg:"rgba(255,251,235,0.98)", glow:"0 0 0 1px rgba(245,158,11,0.2),0 20px 60px rgba(245,158,11,0.15),0 4px 16px rgba(0,0,0,0.12)", titleC:"#78350f", msgC:"#92400e", iconBg:"linear-gradient(135deg,#f59e0b,#d97706)", tagBg:"rgba(245,158,11,0.12)", tagC:"#b45309", tag:"WARNING", dur:5000 },
  info:    { icon:"ℹ️", bar:"linear-gradient(90deg,#4f46e5,#818cf8)", border:"rgba(79,70,229,0.35)", bg:"rgba(245,243,255,0.98)", glow:"0 0 0 1px rgba(79,70,229,0.2),0 20px 60px rgba(79,70,229,0.15),0 4px 16px rgba(0,0,0,0.12)", titleC:"#1e1b4b", msgC:"#3730a3", iconBg:"linear-gradient(135deg,#4f46e5,#7c3aed)", tagBg:"rgba(79,70,229,0.12)", tagC:"#4338ca", tag:"INFO", dur:4000 },
};
function ToastCard({ t, remove }) {
  const c = T_CFG[t.type] ?? T_CFG.info;
  const [vis, setVis] = useState(false), [w, setW] = useState(100);
  const iv = useRef(null);
  useEffect(() => { const id = setTimeout(() => setVis(true), 20); return () => clearTimeout(id); }, []);
  useEffect(() => {
    const step = 100 / (c.dur / 50);
    iv.current = setInterval(() => setW(p => { if (p <= 0) { clearInterval(iv.current); return 0; } return p - step; }), 50);
    return () => clearInterval(iv.current);
  }, [c.dur]);
  useEffect(() => { if (w <= 0) close(); }, [w]);
  const close = () => { setVis(false); setTimeout(() => remove(t.id), 380); };
  const isMob = window.innerWidth < 640;
  return (
    <div style={{ transform: vis ? "translateY(0) scale(1)" : isMob ? "translateY(80px) scale(0.92)" : "translateX(110%) scale(0.92)", opacity: vis ? 1 : 0, transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.4s ease", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 18, overflow: "hidden", boxShadow: c.glow, width: "100%", pointerEvents: "auto", position: "relative" }}>
      <div style={{ height: 3, background: c.bar, position: "absolute", top: 0, left: 0, right: 0 }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 14px 14px" }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{c.icon}</div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", background: c.tagBg, color: c.tagC, borderRadius: 5, padding: "2px 6px", textTransform: "uppercase", display: "inline-block", marginBottom: 4 }}>{c.tag}</span>
          <p style={{ fontSize: 13, fontWeight: 700, color: c.titleC, marginBottom: 3, lineHeight: 1.3 }}>{t.title}</p>
          {t.message && <p style={{ fontSize: 12, color: c.msgC, lineHeight: 1.55, margin: 0, opacity: 0.85 }}>{t.message}</p>}
        </div>
        <button onClick={close} style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#64748b", flexShrink: 0, marginTop: 2 }}>✕</button>
      </div>
      <div style={{ height: 4, background: "rgba(0,0,0,0.07)" }}>
        <div style={{ height: "100%", width: `${w}%`, background: c.bar, transition: "width 0.05s linear" }} />
      </div>
    </div>
  );
}
function ToastContainer({ toasts, remove }) {
  const isMob = window.innerWidth < 640;
  return createPortal(
    <div style={{ position: "fixed", zIndex: 99999, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 10, ...(isMob ? { bottom: 16, left: 12, right: 12 } : { top: 72, right: 20, width: 380, alignItems: "flex-end" }) }}>
      {toasts.map(t => <ToastCard key={t.id} t={t} remove={remove} />)}
    </div>, document.body
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

// ═══════════════════════════════════════════════════════════════════════════
// [FIX-01] NOTIFICATION DROPDOWN — mobile-safe portal
// ═══════════════════════════════════════════════════════════════════════════
function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TS = {
    critical: { iconBg:"bg-red-100",    dot:"bg-red-500",    title:"text-red-700"    },
    warning:  { iconBg:"bg-amber-100",  dot:"bg-amber-500",  title:"text-amber-700"  },
    info:     { iconBg:"bg-indigo-100", dot:"bg-indigo-400", title:"text-indigo-700" },
  };
  const isMobile = window.innerWidth < 480;
  const topOffset = (anchorRect?.bottom ?? 60) + 8;
  // [FIX-01] Mobile: full-width with gutters — no left-edge content hidden
  const style = isMobile
    ? { position:"fixed", top:topOffset, left:12, right:12, zIndex:9999, background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 24px 60px rgba(79,70,229,.22),0 4px 16px rgba(0,0,0,.12)", border:"1px solid rgba(79,70,229,.1)" }
    : { position:"fixed", top:topOffset, right: Math.max(8, window.innerWidth - (anchorRect?.right ?? 60)), width:320, zIndex:9999, background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 24px 60px rgba(79,70,229,.22),0 4px 16px rgba(0,0,0,.12)", border:"1px solid rgba(79,70,229,.1)" };
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
          <span className="text-xs text-indigo-500 font-medium">{notifications.filter(n=>n.type==="critical").length} critical · {notifications.length} total</span>
        </div>
      </div>
    </>, document.body
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function SidebarContent({ onNavigate }) {
  const navigate = useNavigate(), location = useLocation(), user = getStoredUser();
  const isAdmin = user.role === "Admin";
  const go = p => { navigate(p); onNavigate?.(); };
  const NavBtn = ({ item }) => {
    const on = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
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
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:"linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
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

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ onMenuToggle, notifications }) {
  const navigate = useNavigate(), user = getStoredUser(), { toast } = useToast();
  const bellRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false), [anchorRect, setAnchorRect] = useState(null);
  const dName = getDisplayName(user), ini = getUserInitials(user);
  const urgent = notifications.filter(n => n.type === "critical" || n.type === "warning").length;
  const handleBell = () => { if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect()); setNotifOpen(o => !o); };
  const logout = () => { localStorage.removeItem("user"); toast.info("Signed Out","Logged out successfully."); setTimeout(() => navigate("/"), 600); };
  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b" style={{ background:"rgba(255,255,255,.85)", backdropFilter:"blur(12px)", borderColor:"rgba(79,70,229,.08)" }}>
      <button onClick={onMenuToggle} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
        <span className="flex flex-col gap-1 w-4"><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /></span>
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-indigo-950 hidden sm:inline">{getDashboardLabel(user)}</span>
        <span className="text-xs text-indigo-300 font-normal hidden sm:inline"> / Employee Management</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">Employees</span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Admin Portal
      </div>
      <button ref={bellRef} onClick={handleBell} className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0 ${notifOpen?"bg-indigo-100 border-indigo-200":"border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold" style={{ background:urgent>0?"linear-gradient(135deg,#f43f5e,#ec4899)":"linear-gradient(135deg,#4f46e5,#9333ea)", fontSize:9 }}>
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

// ─── BADGES ───────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const isAdmin = role === "Admin";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${isAdmin?"bg-violet-50 text-violet-700 border-violet-200":"bg-blue-50 text-blue-700 border-blue-200"}`}>
      {isAdmin ? "🔐" : "👤"} {role || "—"}
    </span>
  );
}
// [FIX-11] Active / Inactive / Removed
function StatusBadge({ status }) {
  const cfg = {
    Active:   { cls:"bg-emerald-50 text-emerald-700 border-emerald-200", dot:"bg-emerald-500" },
    Inactive: { cls:"bg-amber-50 text-amber-700 border-amber-200",       dot:"bg-amber-400"   },
    Removed:  { cls:"bg-red-50 text-red-600 border-red-200",             dot:"bg-red-500"     },
  };
  const s = cfg[status] ?? { cls:"bg-slate-100 text-slate-500 border-slate-200", dot:"bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{status ?? "Active"}
    </span>
  );
}

// ─── SKELETON / CHECKBOX / STAT CARD ─────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[32,40,120,100,60,70,80,70,80,60].map((w,i) => (
        <td key={i} className="px-3 py-3"><div className="h-3.5 bg-slate-100 rounded-full" style={{ width:w }} /></td>
      ))}
    </tr>
  );
}
function Checkbox({ checked, onChange, indeterminate }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />;
}
function StatCard({ icon, label, value, sub, gradient, glowColor, trend }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 cursor-default transition-all duration-300 hover:-translate-y-1" style={{ background:gradient, boxShadow:`0 4px 24px ${glowColor}` }}>
      <div className="absolute inset-0 opacity-10" style={{ background:"radial-gradient(circle at top right,white,transparent 60%)" }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">{trend}</span>
        </div>
        <p className="text-3xl font-black text-white tracking-tight leading-none">{value}</p>
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mt-1">{label}</p>
        <p className="text-xs text-white/50 mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ─── [FIX-09] VIEW MODAL — X button works, backdrop closes ───────────────────
function ViewModal({ employee, deptMap, assignedAssets, onClose }) {
  const deptName = deptMap[employee?.departmentId] || "—";
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background:"rgba(15,10,40,0.75)", backdropFilter:"blur(6px)" }}
      onClick={onClose}>   {/* [FIX-09] backdrop click closes */}
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="relative px-6 py-6 text-white" style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81,#134e4a)" }}>
          <div className="absolute inset-0 opacity-20" style={{ background:"radial-gradient(circle at top right,white,transparent 60%)" }} />
          {/* [FIX-09] X button — calls onClose directly */}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10 text-sm font-bold">✕</button>
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0 border-2 border-white/20" style={{ background:avatarColor(employee?.employeeName||"") }}>
              {empInitials(employee?.employeeName||"")}
            </div>
            <div>
              <h3 className="text-lg font-black">{employee?.employeeName||"—"}</h3>
              <p className="text-sm text-white/70">{employee?.email||"—"}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <RoleBadge role={employee?.role||"Employee"} />
                <StatusBadge status={employee?.status||"Active"} />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:"Employee ID",  value:`#${employee?.id||"—"}` },      // [FIX-07]
              { label:"Department",   value:deptName },                      // [FIX-05]
              { label:"Joined Date",  value:fmtDate(employee?.joinedDate||employee?.createdAt) }, // [FIX-08]
              { label:"Role",         value:employee?.role||"—" },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{f.label}</p>
                <p className="text-sm font-bold text-slate-800">{f.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Assigned Assets</p>
            {assignedAssets.length === 0
              ? <p className="text-xs text-slate-400 italic py-2">No assets assigned</p>
              : <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {assignedAssets.map((a,i) => (
                    <div key={i} className="flex items-center gap-2 bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2">
                      <span>📦</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-indigo-800 truncate">{a.assetName||a.asset_name||`Asset #${a.assetId||a.asset_id||"?"}`}</p>
                        {a.assignmentStatus && <p className="text-xs text-indigo-400 capitalize">{a.assignmentStatus}</p>}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
        <div className="px-6 pb-6">
          {/* [FIX-09] Close button also works */}
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Close</button>
        </div>
      </div>
    </div>, document.body
  );
}

// ─── [FIX-06][FIX-10] EDIT MODAL ─────────────────────────────────────────────
function EditModal({ employee, departments, onSave, onClose, loading }) {
  const [form, setForm] = useState({
    employeeName: employee?.employeeName || "",
    email:        employee?.email        || "",
    role:         employee?.role         || "Employee",
    departmentId: employee?.departmentId != null ? String(employee.departmentId) : "",
    status:       employee?.status       || "Active",
    password:     "",   // [FIX-06] blank = keep existing
  });
  const [showPass, setShowPass] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.75)", backdropFilter:"blur(6px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-indigo-50 flex items-center justify-between flex-shrink-0" style={{ background:"linear-gradient(90deg,#f0f0ff,#f0fdfa)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0" style={{ background:avatarColor(form.employeeName) }}>{empInitials(form.employeeName)}</div>
            <div>
              <h3 className="text-sm font-bold text-indigo-950">Edit Employee</h3>
              <p className="text-xs text-indigo-400">ID #{employee?.id} — update any field</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
            <input type="text" value={form.employeeName} onChange={e => set("employeeName",e.target.value)} placeholder="Full name"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
          </div>
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => set("email",e.target.value)} placeholder="email@company.com"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
          </div>
          {/* [FIX-06] Password — optional */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              New Password <span className="text-slate-300 normal-case font-normal">(leave blank to keep current)</span>
            </label>
            <div className="relative">
              <input type={showPass?"text":"password"} value={form.password} onChange={e => set("password",e.target.value)} placeholder="Enter new password…"
                className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
              <button type="button" onClick={() => setShowPass(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">{showPass?"🙈":"👁"}</button>
            </div>
          </div>
          {/* Role + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
              <select value={form.role} onChange={e => set("role",e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white transition-all">
                <option>Admin</option><option>Employee</option>
              </select>
            </div>
            <div>
              {/* [FIX-11] All three statuses */}
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={form.status} onChange={e => set("status",e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white transition-all">
                <option>Active</option><option>Inactive</option><option>Removed</option>
              </select>
            </div>
          </div>
          {/* [FIX-05] Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
            <select value={form.departmentId} onChange={e => set("departmentId",e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white transition-all">
              <option value="">— No Department —</option>
              {departments.map(d => <option key={d.id} value={String(d.id)}>{d.departmentName||d.department_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            style={{ background:"linear-gradient(90deg,#4f46e5,#7c3aed)", boxShadow:"0 4px 14px rgba(79,70,229,.4)" }}>
            {loading?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>:"✓ Save Changes"}
          </button>
        </div>
      </div>
    </div>, document.body
  );
}

// ─── CONFIRM DELETE ────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ employee, onConfirm, onCancel, loading }) {
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.75)", backdropFilter:"blur(6px)" }}>
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:"linear-gradient(135deg,#fee2e2,#fecaca)" }}>
            <span className="text-3xl">🗑️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Permanently Remove?</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            You are about to permanently delete <span className="font-semibold text-red-600">{employee?.employeeName||"this employee"}</span>.
            <br /><span className="text-red-500 font-medium">This cannot be undone.</span>
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", boxShadow:"0 4px 14px rgba(239,68,68,.4)" }}>
            {loading?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Removing…</>:"❌ Yes, Remove"}
          </button>
        </div>
      </div>
    </div>, document.body
  );
}

// ─── ACCESS DENIED ─────────────────────────────────────────────────────────────
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8" style={{ background:"linear-gradient(135deg,#f0f0ff,#f5f9ff,#f0fff8)" }}>
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl" style={{ background:"linear-gradient(135deg,#fee2e2,#fecaca)" }}>🔒</div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 text-sm max-w-xs">Admin access is required to view this page.</p>
      </div>
      <button onClick={() => navigate("/dashboard")} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background:"linear-gradient(90deg,#4f46e5,#7c3aed)", boxShadow:"0 4px 14px rgba(79,70,229,.4)" }}>
        ← Return to Dashboard
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CONTENT
// ═══════════════════════════════════════════════════════════════════════════
function EmployeeManagementContent() {
  const { toast } = useToast();
  const [employees,   setEmployees]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,       setSearch]      = useState("");
  // [FIX-02] Filters
  const [filterRole,   setFilterRole]  = useState("All");
  const [filterStatus, setFilterStatus]= useState("All");
  const [filterDept,   setFilterDept]  = useState("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const [selected, setSelected] = useState(new Set());
  const [viewEmp,         setViewEmp]         = useState(null);
  const [editEmp,         setEditEmp]         = useState(null);
  const [deleteEmp,       setDeleteEmp]       = useState(null);
  const [assignedAssets,  setAssignedAssets]  = useState([]);
  const [actionLoading,   setActionLoading]   = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDelLoading,  setBulkDelLoading]  = useState(false);
  const [showCreate,      setShowCreate]      = useState(false);
  const [createForm,      setCreateForm]      = useState({ employeeName:"", email:"", password:"", role:"Employee", departmentId:"", joinedDate:"" });
  const [createLoading,   setCreateLoading]   = useState(false);
  const [createError,     setCreateError]     = useState("");

  // [FIX-05] dept id → name map
  const deptMap = useMemo(() => {
    const m = {};
    departments.forEach(d => { if (d.id != null) m[d.id] = d.departmentName || d.department_name || `Dept #${d.id}`; });
    return m;
  }, [departments]);

  // [FIX-04] fetchAll — always re-syncs from server
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([api.get("/api/employees"), api.get("/api/departments")]);
      const rawEmps  = Array.isArray(empRes.data)  ? empRes.data  : [];
      const rawDepts = Array.isArray(deptRes.data) ? deptRes.data : [];
      // [FIX-07] sort by id ascending
      setEmployees(rawEmps.map(normaliseEmp).sort((a, b) => a.id - b.id));
      setDepartments(rawDepts);
    } catch (err) {
      toast.error("Load Failed", err.message || "Could not fetch data.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // [FIX-03] Live stats
  const stats = useMemo(() => ({
    total:   employees.length,
    active:  employees.filter(e => (e.status||"Active") === "Active").length,
    // [FIX-14] Removed count — live from data
    removed: employees.filter(e => e.status === "Removed").length,
    admins:  employees.filter(e => e.role === "Admin").length,
  }), [employees]);

  // [FIX-02] Filtering — all three filters applied independently
  const filtered = useMemo(() => employees.filter(e => {
    const q      = search.toLowerCase();
    const matchQ = !q || (e.employeeName||"").toLowerCase().includes(q) || (e.email||"").toLowerCase().includes(q);
    const matchR = filterRole   === "All" || e.role === filterRole;
    const matchS = filterStatus === "All" || (e.status||"Active") === filterStatus;
    // [FIX-02] String comparison — avoids numeric vs string type mismatch
    const matchD = filterDept   === "All" || String(e.departmentId) === filterDept;
    return matchQ && matchR && matchS && matchD;
  }), [employees, search, filterRole, filterStatus, filterDept]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, filterRole, filterStatus, filterDept]);

  // Load assigned assets for view modal
  const openView = async emp => {
    setViewEmp(emp); setAssignedAssets([]);
    try { const r = await api.get(`/api/asset-assignments/employee/${emp.id}`); setAssignedAssets(Array.isArray(r.data)?r.data:[]); }
    catch { setAssignedAssets([]); }
  };

  // [FIX-10] Edit — sends full payload, re-syncs
  const handleEdit = async form => {
    setActionLoading(true);
    try {
      const payload = {
        employeeName:  form.employeeName,
        employee_name: form.employeeName,
        email:         form.email,
        role:          form.role,
        status:        form.status,
        departmentId:  form.departmentId ? Number(form.departmentId) : null,
        department:    form.departmentId ? { id: Number(form.departmentId) } : null,
      };
      // [FIX-06] only include password if admin filled it
      if (form.password?.trim()) payload.password = form.password.trim();
      await api.put(`/api/employees/${editEmp.id}`, payload);
      toast.success("Updated", `${form.employeeName} updated successfully.`);
      setEditEmp(null);
      await fetchAll(); // [FIX-10] re-sync so all columns refresh
    } catch (err) {
      toast.error("Update Failed", err.response?.data?.message || err.message);
    } finally { setActionLoading(false); }
  };

  // [FIX-04] Delete — error-safe, re-syncs regardless
  const handleDelete = async () => {
    setActionLoading(true);
    const target = deleteEmp;
    try {
      await api.delete(`/api/employees/${target.id}`);
      setEmployees(prev => prev.filter(e => e.id !== target.id)); // optimistic
      toast.success("Removed", `${target.employeeName} permanently deleted.`);
      setDeleteEmp(null);
      await fetchAll();
    } catch (err) {
      const msg = err.response?.status === 409
        ? "Cannot delete: employee has linked records (assets/assignments). Use Edit → set status to Removed instead."
        : (err.response?.data?.message || err.message || "Server rejected delete.");
      toast.error("Delete Failed", msg);
      setDeleteEmp(null);
      await fetchAll(); // restore true state
    } finally { setActionLoading(false); }
  };

  // Bulk delete — sequential, counts successes
  const handleBulkDelete = async () => {
    setBulkDelLoading(true);
    const ids = [...selected];
    let ok = 0;
    for (const id of ids) {
      try { await api.delete(`/api/employees/${id}`); ok++; } catch { /* count only */ }
    }
    toast[ok > 0 ? "success" : "error"](
      ok > 0 ? "Bulk Remove Done" : "Bulk Remove Failed",
      ok > 0 ? `${ok} of ${ids.length} employee${ids.length>1?"s":""} removed.` : "No employees could be deleted."
    );
    setSelected(new Set()); setShowBulkConfirm(false);
    await fetchAll(); setBulkDelLoading(false);
  };

  // Create employee
  const handleCreate = async () => {
    setCreateError("");
    const { employeeName, email, password, role, departmentId } = createForm;
    if (!employeeName.trim()) { setCreateError("Name is required."); return; }
    if (!email.trim())        { setCreateError("Email is required."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setCreateError("Invalid email."); return; }
    if (!password.trim())     { setCreateError("Password is required."); return; }
    if (password.length < 6)  { setCreateError("Password must be ≥ 6 characters."); return; }
    if (!role)                { setCreateError("Select a role."); return; }
    if (!departmentId)        { setCreateError("Select a department."); return; }
    setCreateLoading(true);
    try {
      await api.post("/api/employees", {
        employeeName: employeeName.trim(), employee_name: employeeName.trim(),
        email: email.trim(), password,
        role, departmentId: Number(departmentId), department: { id: Number(departmentId) },
        // [FIX-08] joined date sent in both key shapes
        joinedDate:  createForm.joinedDate || null,
        joined_date: createForm.joinedDate || null,
      });
      toast.success("Employee Created", `${employeeName} added to the system.`);
      setShowCreate(false);
      setCreateForm({ employeeName:"", email:"", password:"", role:"Employee", departmentId:"", joinedDate:"" });
      await fetchAll();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Create failed.";
      setCreateError(msg); toast.error("Create Failed", msg);
    } finally { setCreateLoading(false); }
  };

  // CSV export
  const exportCSV = () => {
    const headers = ["ID","Name","Email","Role","Department","Status","Joined"];
    const rows    = filtered.map(e => [e.id, e.employeeName, e.email, e.role, deptMap[e.departmentId]||"—", e.status||"Active", fmtDate(e.joinedDate||e.createdAt)]);
    const csv     = [headers,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = "employees.csv"; a.click(); URL.revokeObjectURL(a.href);
    toast.success("Export Done", `${filtered.length} records exported.`);
  };

  // Selection
  const toggleSelect = id => setSelected(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll = () => {
    if (paged.every(e => selected.has(e.id))) setSelected(p => { const n=new Set(p); paged.forEach(e=>n.delete(e.id)); return n; });
    else setSelected(p => { const n=new Set(p); paged.forEach(e=>n.add(e.id)); return n; });
  };
  const allPageSel  = paged.length>0 && paged.every(e=>selected.has(e.id));
  const somePageSel = paged.some(e=>selected.has(e.id)) && !allPageSel;

  // [FIX-02] Department options for filter (unique names + ids from real data)
  const deptOptions = useMemo(() => departments.map(d => ({ id:d.id, name:d.departmentName||d.department_name||`Dept #${d.id}` })), [departments]);

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 pb-6">

      {/* [FIX-03] Stats — all live */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="👥" label="Total Employees" value={stats.total}   sub="All registered users"  gradient="linear-gradient(135deg,#4f46e5,#7c3aed)" glowColor="rgba(79,70,229,.25)"  trend="All" />
        <StatCard icon="✅" label="Active"           value={stats.active}  sub="Currently active"      gradient="linear-gradient(135deg,#059669,#0d9488)" glowColor="rgba(5,150,105,.25)"  trend="Live" />
        {/* [FIX-14] Live removed count */}
        <StatCard icon="❌" label="Removed"          value={stats.removed} sub="Deactivated accounts"  gradient="linear-gradient(135deg,#dc2626,#f97316)" glowColor="rgba(220,38,38,.2)"   trend={stats.removed>0?"⚠":"✓"} />
        <StatCard icon="🔐" label="Admin Count"      value={stats.admins}  sub="Admin-level users"     gradient="linear-gradient(135deg,#7c3aed,#ec4899)" glowColor="rgba(124,58,237,.25)" trend="Admin" />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-indigo-50 p-4" style={{ boxShadow:"0 2px 12px rgba(79,70,229,.06)" }}>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
          </div>
          {/* [FIX-02] Role dropdown */}
          <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white text-slate-700 transition-all">
            <option value="All">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Employee">Employee</option>
          </select>
          {/* [FIX-02] Status dropdown — shows Active / Inactive / Removed */}
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white text-slate-700 transition-all">
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Removed">Removed</option>
          </select>
          {/* [FIX-02] Department filter — real departments from API */}
          <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white text-slate-700 transition-all">
            <option value="All">All Departments</option>
            {/* [FIX-02] value is String(id) so comparison String(e.departmentId) === filterDept works */}
            {deptOptions.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-2 whitespace-nowrap">📥 CSV</button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 whitespace-nowrap transition-all hover:shadow-lg" style={{ background:"linear-gradient(90deg,#4f46e5,#7c3aed)", boxShadow:"0 4px 14px rgba(79,70,229,.3)" }}>＋ New Employee</button>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <span className="text-xs font-semibold text-red-700">{selected.size} selected</span>
            <button onClick={() => setShowBulkConfirm(true)} className="ml-auto text-xs font-bold text-white px-3 py-1.5 rounded-lg" style={{ background:"linear-gradient(90deg,#ef4444,#dc2626)" }}>🗑️ Delete Selected</button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear</button>
          </div>
        )}
      </div>

      {/* TABLE — [FIX-07][FIX-06][FIX-08][FIX-05][FIX-13] */}
      <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden" style={{ boxShadow:"0 2px 12px rgba(79,70,229,.06)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-indigo-50/80" style={{ background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
          <span className="text-sm font-bold text-indigo-950">Employee Directory</span>
          <span className="text-xs text-slate-400">{filtered.length} result{filtered.length!==1?"s":""}</span>
        </div>
        {/* [FIX-13] overflow-x:auto for mobile horizontal scroll */}
        <div style={{ overflowX:"auto" }}>
          <table className="w-full text-sm" style={{ minWidth:900 }}>
            <thead>
              <tr style={{ background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
                <th className="px-3 py-3 w-8"><Checkbox checked={allPageSel} onChange={toggleAll} indeterminate={somePageSel} /></th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#ID</th>     {/* [FIX-07] */}
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Profile</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</th> {/* [FIX-06] */}
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</th>{/* [FIX-05] */}
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined</th>   {/* [FIX-08] */}
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({length:6}).map((_,i) => <SkeletonRow key={i} />)
                : paged.length === 0
                  ? <tr><td colSpan={10} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-4xl">🔍</span>
                        <p className="text-sm font-semibold text-slate-400">No employees found</p>
                        <p className="text-xs text-slate-300">Try adjusting your filters</p>
                      </div>
                    </td></tr>
                  : paged.map((emp, idx) => {
                      const isChecked = selected.has(emp.id);
                      const deptName  = deptMap[emp.departmentId] || "—"; // [FIX-05]
                      return (
                        <tr key={emp.id} className={`hover:bg-indigo-50/40 transition-colors border-b border-slate-50 ${isChecked?"bg-indigo-50/60":idx%2===1?"bg-slate-50/40":""}`}>
                          <td className="px-3 py-3"><Checkbox checked={isChecked} onChange={()=>toggleSelect(emp.id)} /></td>
                          {/* [FIX-07] ID */}
                          <td className="px-3 py-3 text-xs font-mono text-indigo-400 font-bold">#{emp.id}</td>
                          {/* Profile */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{ background:avatarColor(emp.employeeName||"") }}>{empInitials(emp.employeeName||"")}</div>
                              <span className="font-semibold text-slate-800 whitespace-nowrap text-xs">{emp.employeeName||"—"}</span>
                            </div>
                          </td>
                          {/* Email */}
                          <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{emp.email||"—"}</td>
                          {/* [FIX-06] Password masked */}
                          <td className="px-3 py-3 text-slate-400 text-xs font-mono tracking-widest">{emp.password?"••••••":<span className="text-slate-300 italic text-xs">not set</span>}</td>
                          {/* Role */}
                          <td className="px-3 py-3"><RoleBadge role={emp.role||"Employee"} /></td>
                          {/* [FIX-05] Real department name */}
                          <td className="px-3 py-3"><span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md whitespace-nowrap">{deptName}</span></td>
                          {/* Status */}
                          <td className="px-3 py-3"><StatusBadge status={emp.status||"Active"} /></td>
                          {/* [FIX-08] Joined date */}
                          <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(emp.joinedDate||emp.createdAt)}</td>
                          {/* Actions */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* [FIX-09] view with working X */}
                              <button onClick={()=>openView(emp)} title="View" className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">👁</button>
                              {/* [FIX-10] edit all fields */}
                              <button onClick={()=>setEditEmp(emp)} title="Edit" className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-violet-100 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors">✏️</button>
                              {/* [FIX-04] delete */}
                              <button onClick={()=>setDeleteEmp(emp)} title="Delete" className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">🗑️</button>
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
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="w-7 h-7 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">←</button>
              {Array.from({length:Math.min(5,totalPages)}).map((_,i)=>{
                const pg = Math.max(1,Math.min(page-2,totalPages-4))+i;
                if(pg<1||pg>totalPages) return null;
                return (
                  <button key={pg} onClick={()=>setPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${pg===page?"text-white":"border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    style={pg===page?{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}:{}}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="w-7 h-7 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">→</button>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {viewEmp   && <ViewModal    employee={viewEmp}  deptMap={deptMap} assignedAssets={assignedAssets} onClose={()=>setViewEmp(null)} />}
      {editEmp   && <EditModal    employee={editEmp}  departments={departments} onSave={handleEdit} onClose={()=>setEditEmp(null)} loading={actionLoading} />}
      {deleteEmp && <ConfirmDeleteModal employee={deleteEmp} onConfirm={handleDelete} onCancel={()=>setDeleteEmp(null)} loading={actionLoading} />}

      {/* Bulk delete confirm */}
      {showBulkConfirm && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.75)", backdropFilter:"blur(6px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:"linear-gradient(135deg,#fee2e2,#fecaca)" }}><span className="text-3xl">🗑️</span></div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Bulk Remove {selected.size} Employee{selected.size>1?"s":""}?</h3>
            <p className="text-sm text-slate-500 mb-6">All selected employees will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={()=>setShowBulkConfirm(false)} disabled={bulkDelLoading} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDelLoading} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)" }}>
                {bulkDelLoading?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Removing…</>:"❌ Confirm"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Create Employee panel */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ background:"rgba(15,10,40,0.75)", backdropFilter:"blur(6px)" }} onClick={()=>setShowCreate(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-indigo-50 flex items-center justify-between flex-shrink-0" style={{ background:"linear-gradient(90deg,#f0f0ff,#f0fdfa)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background:"linear-gradient(135deg,#818cf8,#34d399)" }}>👤</div>
                <div><h3 className="text-sm font-bold text-indigo-950">Add New Employee</h3><p className="text-xs text-indigo-400">All * fields required</p></div>
              </div>
              <button onClick={()=>setShowCreate(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
              {createError && <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700"><span>⚠️</span>{createError}</div>}
              {[
                {label:"Name *",     key:"employeeName", type:"text",     ph:"e.g. Priya Nair"},
                {label:"Email *",    key:"email",        type:"email",    ph:"priya@company.com"},
                {label:"Password *", key:"password",     type:"password", ph:"Min. 6 characters"},
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{f.label}</label>
                  <input type={f.type} value={createForm[f.key]} placeholder={f.ph}
                    onChange={e=>setCreateForm(p=>({...p,[f.key]:e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Role *</label>
                  <select value={createForm.role} onChange={e=>setCreateForm(p=>({...p,role:e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white transition-all">
                    <option value="Employee">Employee</option><option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Department *</label>
                  <select value={createForm.departmentId} onChange={e=>setCreateForm(p=>({...p,departmentId:e.target.value}))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white transition-all">
                    <option value="">Select…</option>
                    {deptOptions.map(d=><option key={d.id} value={String(d.id)}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              {/* [FIX-08] Joined date field */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Joined Date</label>
                <input type="date" value={createForm.joinedDate} onChange={e=>setCreateForm(p=>({...p,joinedDate:e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-700" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
              <button onClick={()=>setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={createLoading} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                style={{ background:"linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow:"0 4px 14px rgba(79,70,229,.4)" }}>
                {createLoading?<><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</>:"＋ Create Employee"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// [FIX-01] Fetches /api/assets + /api/maintenance for live bell notifications
// ═══════════════════════════════════════════════════════════════════════════
function AdminEmployeeInner() {
  const user = getStoredUser();
  const [open, setOpen] = useState(false);

  // [FIX-01] Real notification data
  const [notifAssets, setNotifAssets] = useState([]);
  const [notifMaint,  setNotifMaint]  = useState([]);

  useEffect(() => {
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setNotifAssets(a.data||[]); setNotifMaint(m.data||[]); })
      .catch(() => {});
  }, []);

  // [FIX-01] assetMap for real asset names
  const assetMap = useMemo(() => {
    const m = {};
    notifAssets.forEach(a => { if (a.id!=null) m[a.id] = a.assetName??a.name??`Asset #${a.id}`; });
    return m;
  }, [notifAssets]);

  // [FIX-01] Same buildNotifications as Dashboard.jsx
  const notifications = useMemo(() => buildNotifications(notifAssets, notifMaint, assetMap), [notifAssets, notifMaint, assetMap]);

  if (user.role !== "Admin") return <AccessDenied />;

  return (
    <div className="flex min-h-screen" style={{ background:"linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={() => setOpen(o => !o)} notifications={notifications} />
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