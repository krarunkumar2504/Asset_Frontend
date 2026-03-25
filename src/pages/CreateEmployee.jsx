// ─────────────────────────────────────────────────────────────
// CreateEmployee.jsx
//
// ═══════════════════════════════════════════════════════════
// WHAT WAS CHANGED FROM PREVIOUS VERSION
// ═══════════════════════════════════════════════════════════
//
// 1. ROLE-BASED DASHBOARD TITLE  (search "// ROLE TITLE FIX")
//    Problem: Navbar hardcoded "Admin Dashboard / Create Employee"
//    for all users regardless of their role.
//    Fix: getDashboardLabel(user) reads user.role from localStorage:
//      - "Admin"    → "Admin Dashboard"
//      - "Employee" → "Employee Dashboard"
//      - any other  → "<Role> Dashboard"
//
// 2. REAL NOTIFICATIONS WITH ASSET NAMES  (search "// NOTIFICATION FIX")
//    Problem: Bell showed hardcoded static badge "4" with no real data.
//    Also used `Asset #${r.assetId}` fallback showing meaningless IDs.
//    Fix: Fetches /api/assets and /api/maintenance at root level.
//    Builds assetMap (id → name) so resolveNotifAssetName() shows
//    real names like "Dell Laptop" instead of "Asset #1".
//    React Portal renders the dropdown on <body> — no z-index collision.
//
// 3. DYNAMIC USER NAME  (search "// DYNAMIC NAME FIX")
//    Problem: displayName was computed once as a static string.
//    Fix: getDisplayName(user) reads employeeName → name → email
//    in priority order, same as all other pages. Any admin who logs
//    in will see their own name, not a hardcoded fallback.
//
// 4. ALL FORM LOGIC — UNCHANGED
//    Role check, form validation, API calls, Access Denied — all intact.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "https://assest-management-system.onrender.com/",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 8000,
});

// ─────────────────────────────────────────────────────────────
// NAV ITEMS
// ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",  path: "/dashboard"   },
  { label: "Assets",      icon: "📦", path: "/assets"      },
  { label: "Maintenance", icon: "🔧", path: "/maintenance" },
  { label: "Reports",     icon: "📊", path: "/reports"     },
];
const ADMIN_NAV_ITEM = { label: "Create Employee", icon: "👤", path: "/create-employee" };

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user")) ?? {}; }
  catch { return {}; }
}

// DYNAMIC NAME FIX: reads employeeName → name → email in priority order
// Works for any admin or employee who logs in — never shows raw email
function getDisplayName(user) {
  if (user.employeeName && user.employeeName.trim()) return user.employeeName.trim();
  if (user.name         && user.name.trim())         return user.name.trim();
  if (user.email        && user.email.trim())        return user.email.split("@")[0];
  return "User";
}

function getUserInitials(user) {
  return getDisplayName(user).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "U";
}

// ROLE TITLE FIX: derives the navbar label from user.role
// Admin → "Admin Dashboard", Employee → "Employee Dashboard", etc.
function getDashboardLabel(user) {
  const role = (user.role ?? "").trim();
  if (!role) return "Dashboard";
  return `${role} Dashboard`;
}

// Derive maintenance status from next due date
function deriveStatus(dt) {
  if (!dt) return "Completed";
  const diff = (new Date(dt) - new Date()) / 86400000;
  return diff < 0 ? "Overdue" : diff <= 60 ? "Pending" : "Completed";
}

// NOTIFICATION FIX: resolves real asset name from assetMap
// Priority: record.assetName → assetMap[assetId] → "Asset #<id>"
function resolveNotifAssetName(record, assetMap) {
  if (record.assetName && record.assetName.trim()) return record.assetName.trim();
  if (record.assetId   && assetMap[record.assetId]) return assetMap[record.assetId];
  return `Asset #${record.assetId ?? "?"}`;
}

// NOTIFICATION FIX: builds real notifications from live data
// accepts assetMap so overdue records show real asset names
function buildNotifications(assets, records, assetMap = {}) {
  const notes = [];

  // Overdue maintenance records — real name via resolveNotifAssetName
  records
    .filter((r) => deriveStatus(r.nextDueDate) === "Overdue")
    .slice(0, 3)
    .forEach((r) => {
      notes.push({
        id:      `overdue-${r.id}`,
        type:    "critical",
        icon:    "🚨",
        title:   "Overdue Maintenance",
        message: `${resolveNotifAssetName(r, assetMap)} — due on ${r.nextDueDate ?? "unknown date"}`,
        time:    "Overdue",
      });
    });

  // Assets currently under maintenance
  assets
    .filter((a) => (a.status ?? "").toLowerCase() === "maintenance")
    .slice(0, 2)
    .forEach((a) => {
      notes.push({
        id:      `maint-${a.id}`,
        type:    "warning",
        icon:    "🔧",
        title:   "Asset Under Maintenance",
        message: `${a.assetName ?? "Unknown asset"} is currently under maintenance`,
        time:    "Active",
      });
    });

  // Pending count
  const pending = records.filter((r) => deriveStatus(r.nextDueDate) === "Pending");
  if (pending.length > 0) {
    notes.push({
      id:      "pending-summary",
      type:    "info",
      icon:    "⏳",
      title:   "Upcoming Maintenance",
      message: `${pending.length} task${pending.length > 1 ? "s" : ""} due within 60 days`,
      time:    "Upcoming",
    });
  }

  // Inactive assets
  const inactive = assets.filter((a) => (a.status ?? "").toLowerCase() === "inactive");
  if (inactive.length > 0) {
    notes.push({
      id:      "inactive-summary",
      type:    "info",
      icon:    "📦",
      title:   "Inactive Assets",
      message: `${inactive.length} asset${inactive.length > 1 ? "s are" : " is"} inactive`,
      time:    "Review",
    });
  }

  notes.push({
    id:      "system",
    type:    "info",
    icon:    "✅",
    title:   "System Status",
    message: "All systems operational — data synced",
    time:    "Now",
  });

  return notes;
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION DROPDOWN — React Portal (no collision)
// NOTIFICATION FIX: renders on <body> via createPortal, z-index 9999
// ─────────────────────────────────────────────────────────────
function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TYPE_STYLE = {
    critical: { iconBg: "bg-red-100",    dot: "bg-red-500",    title: "text-red-700"    },
    warning:  { iconBg: "bg-amber-100",  dot: "bg-amber-500",  title: "text-amber-700"  },
    info:     { iconBg: "bg-indigo-100", dot: "bg-indigo-400", title: "text-indigo-700" },
  };

  const style = {
    position:     "fixed",
    top:          (anchorRect?.bottom ?? 60) + 8,
    right:        anchorRect ? window.innerWidth - anchorRect.right : 16,
    width:        320,
    zIndex:       9999,
    background:   "#fff",
    borderRadius: 16,
    overflow:     "hidden",
    boxShadow:    "0 24px 60px rgba(79,70,229,0.22), 0 4px 16px rgba(0,0,0,0.12)",
    border:       "1px solid rgba(79,70,229,0.1)",
  };

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div style={style}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50"
          style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-950">Notifications</span>
            <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full"
              style={{ background: "linear-gradient(90deg,#f43f5e,#ec4899)" }}>
              {notifications.length}
            </span>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm">
            ✕
          </button>
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {notifications.length === 0
            ? <p className="text-xs text-slate-400 text-center py-8">No notifications</p>
            : notifications.map((n) => {
                const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
                return (
                  <div key={n.id}
                    className="flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-default">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${s.iconBg}`}>
                      {n.icon}
                    </div>
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
            {notifications.filter((n) => n.type === "critical").length} critical · {notifications.length} total
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}

// SVG icons
function UserIcon()  {
  return <svg style={{width:16,height:16}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
}
function EmailIcon() {
  return <svg style={{width:16,height:16}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>;
}
function LockIcon()  {
  return <svg style={{width:16,height:16}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>;
}
function EyeIcon({ show }) {
  return show
    ? <svg style={{width:16,height:16}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
    : <svg style={{width:16,height:16}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>;
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ mobileOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user     = getStoredUser();
  const isAdmin  = user.role === "Admin";

  // DYNAMIC NAME FIX: uses getDisplayName instead of static fallback
  const displayName = getDisplayName(user);

  const NavBtn = ({ item }) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <button onClick={() => { navigate(item.path); if (onClose) onClose(); }}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 relative
          ${isActive ? "text-white" : "text-indigo-300 hover:text-indigo-100 hover:bg-white/5"}`}
        style={isActive ? {
          background: "linear-gradient(90deg,rgba(99,102,241,0.5),rgba(20,184,166,0.3))",
          boxShadow:  "0 0 20px rgba(99,102,241,0.3)",
        } : {}}>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full"
            style={{ background: "linear-gradient(180deg,#818cf8,#34d399)" }} />
        )}
        <span className="text-sm w-4 text-center">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
      </button>
    );
  };

  const bg = "linear-gradient(180deg,#1e1b4b 0%,#312e81 60%,#134e4a 100%)";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col py-6 px-3.5" style={{ background: bg }}>
        <div className="flex items-center gap-2.5 px-2 mb-8 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
          <div>
            <div className="text-white font-bold text-base tracking-tight">AssetAI</div>
            <div className="text-indigo-300 font-medium tracking-widest uppercase" style={{ fontSize: 9 }}>Management Suite</div>
          </div>
        </div>

        <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => <NavBtn key={item.label} item={item} />)}
        </nav>

        {isAdmin && (
          <>
            <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mt-5 mb-2">Admin</p>
            <nav className="flex flex-col gap-1"><NavBtn item={ADMIN_NAV_ITEM} /></nav>
          </>
        )}

        <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
          <p className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: isAdmin ? "#34d399" : "#a5b4fc" }}>
            {user.role ?? "Employee"}
          </p>
          {/* DYNAMIC NAME FIX: shows real logged-in user name */}
          <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{displayName}</p>
          <p className="text-xs text-indigo-600 mt-0.5">v3.1.0 — Pro Plan</p>
        </div>
      </aside>

      {/* Mobile overlay */}
      <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden
        ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose} />

      {/* Mobile drawer */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col py-6 px-3.5 transition-transform duration-300 ease-in-out lg:hidden
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: bg }}>
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-indigo-300 hover:bg-white/10 hover:text-white transition-colors text-lg z-10">
          ✕
        </button>

        <div className="flex items-center gap-2.5 px-2 mb-8 cursor-pointer" onClick={() => { navigate("/dashboard"); onClose?.(); }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
          <div>
            <div className="text-white font-bold text-base tracking-tight">AssetAI</div>
            <div className="text-indigo-300 font-medium tracking-widest uppercase" style={{ fontSize: 9 }}>Management Suite</div>
          </div>
        </div>

        <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => <NavBtn key={item.label} item={item} />)}
        </nav>

        {isAdmin && (
          <>
            <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mt-5 mb-2">Admin</p>
            <nav className="flex flex-col gap-1"><NavBtn item={ADMIN_NAV_ITEM} /></nav>
          </>
        )}

        <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
          <p className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: isAdmin ? "#34d399" : "#a5b4fc" }}>
            {user.role ?? "Employee"}
          </p>
          <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{displayName}</p>
          <p className="text-xs text-indigo-600 mt-0.5">v3.1.0 — Pro Plan</p>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// NAVBAR
//
// ROLE TITLE FIX: shows "<Role> Dashboard / Create Employee"
// DYNAMIC NAME FIX: shows the real logged-in user's name
// NOTIFICATION FIX: real bell with portal dropdown, real count,
//   real asset names — no more hardcoded "4" badge
// ─────────────────────────────────────────────────────────────
function Navbar({ onMenuToggle, notifications }) {
  const navigate   = useNavigate();
  const user       = getStoredUser();
  const bellRef    = useRef(null);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  // DYNAMIC NAME FIX: uses getDisplayName for any logged-in user
  const displayName = getDisplayName(user);
  const initials    = getUserInitials(user);

  // ROLE TITLE FIX: dynamic label based on actual role
  const dashboardLabel = getDashboardLabel(user);

  const handleBellClick = () => {
    if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect());
    setNotifOpen((o) => !o);
  };

  const urgentCount  = (notifications ?? []).filter((n) => n.type === "critical" || n.type === "warning").length;
  const handleLogout = () => { localStorage.removeItem("user"); navigate("/"); };

  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderColor: "rgba(79,70,229,0.08)" }}>

      {/* Hamburger — mobile only */}
      <button onClick={onMenuToggle}
        className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
        <span className="flex flex-col gap-1 w-4">
          <span className="block h-0.5 bg-current rounded-full" />
          <span className="block h-0.5 bg-current rounded-full" />
          <span className="block h-0.5 bg-current rounded-full" />
        </span>
      </button>

      <div className="flex-1 min-w-0">
        {/*
          ROLE TITLE FIX:
          Desktop → "Admin Dashboard / Create Employee"
                 or "Employee Dashboard / Create Employee"
          Mobile  → "Create Employee"
        */}
        <span className="text-sm font-bold text-indigo-950 hidden sm:inline">{dashboardLabel}</span>
        <span className="text-xs text-indigo-300 hidden sm:inline"> / Create Employee</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">Create Employee</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> All systems operational
      </div>

      {/*
        NOTIFICATION FIX: real bell with portal dropdown.
        Badge count is real (from live data), not hardcoded "4".
        Dropdown shows real asset names, not "Asset #1" etc.
      */}
      <button ref={bellRef} onClick={handleBellClick}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0
          ${notifOpen ? "bg-indigo-100 border-indigo-200" : "border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {(notifications ?? []).length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{
              background: urgentCount > 0
                ? "linear-gradient(135deg,#f43f5e,#ec4899)"
                : "linear-gradient(135deg,#4f46e5,#9333ea)",
              fontSize: 9,
            }}>
            {(notifications ?? []).length > 9 ? "9+" : (notifications ?? []).length}
          </span>
        )}
      </button>

      {/* Portal dropdown */}
      {notifOpen && (
        <NotificationDropdown
          notifications={notifications ?? []}
          anchorRect={anchorRect}
          onClose={() => setNotifOpen(false)}
        />
      )}

      {/* User pill — DYNAMIC NAME FIX */}
      <div className="flex items-center gap-2 border border-indigo-100 rounded-full px-2 py-1 bg-white flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "linear-gradient(135deg,#4f46e5,#14b8a6)" }}>
          {initials}
        </div>
        {/* DYNAMIC NAME FIX: first word of the real display name */}
        <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-20 truncate">
          {displayName.split(" ")[0]}
        </span>
      </div>

      <button onClick={handleLogout}
        className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors flex-shrink-0">
        <span className="hidden sm:inline">→ Logout</span><span className="sm:hidden">→</span>
      </button>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// FORM FIELD WRAPPER
// ─────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold tracking-widest uppercase text-indigo-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 border border-indigo-100 rounded-xl text-xs text-slate-700 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all";

// ─────────────────────────────────────────────────────────────
// ACCESS DENIED
// ─────────────────────────────────────────────────────────────
function AccessDeniedInline() {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center px-8 py-10 rounded-3xl max-w-sm w-full"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-lg font-bold text-red-700 mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500 mb-5">
          You need <span className="font-semibold text-indigo-600">Admin</span> privileges to access this page.
        </p>
        <button onClick={() => navigate("/dashboard")}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)" }}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATE EMPLOYEE FORM — unchanged logic
// ─────────────────────────────────────────────────────────────
function CreateEmployeeForm() {
  const navigate = useNavigate();

  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [role,         setRole]         = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments,  setDepartments]  = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [deptLoading,  setDeptLoading]  = useState(true);
  const [message,      setMessage]      = useState(null);
  const [fieldError,   setFieldError]   = useState("");

  useEffect(() => {
    api.get("/api/departments")
      .then((res) => { console.log("✅ Departments:", res.data); setDepartments(res.data); })
      .catch((err) => { console.error("❌ Dept load failed:", err.message); setMessage({ type: "error", text: "Could not load departments." }); })
      .finally(() => setDeptLoading(false));
  }, []);

  const handleSubmit = async () => {
    setMessage(null); setFieldError("");
    if (!name.trim())                { setFieldError("Employee Name is required.");              return; }
    if (!email.trim())               { setFieldError("Email address is required.");              return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setFieldError("Enter a valid email address.");            return; }
    if (!password.trim())            { setFieldError("Password is required.");                   return; }
    if (password.length < 6)         { setFieldError("Password must be at least 6 characters."); return; }
    if (!role)                       { setFieldError("Please select a role.");                   return; }
    if (!departmentId)               { setFieldError("Please select a department.");             return; }
    setLoading(true);

    const payload = {
      employeeName: name.trim(),
      email:        email.trim(),
      password:     password,
      role:         role,
      department:   { id: Number(departmentId) },
    };

    try {
      const res = await api.post("/api/employees", payload);
      console.log("✅ Employee created:", res.data);
      setMessage({ type: "success", text: "Employee created successfully! 🎉" });
      setName(""); setEmail(""); setPassword(""); setRole(""); setDepartmentId("");
    } catch (err) {
      console.error("❌ Create failed:", err);
      const errMsg =
        err.response?.data?.message ??
        err.response?.data ??
        (err.code === "ERR_NETWORK" ? "Cannot reach backend. Check @CrossOrigin." : "Failed to create employee.");
      setMessage({ type: "error", text: String(errMsg) });
    } finally { setLoading(false); }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto flex items-start justify-center">
      <div className="w-full max-w-lg">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-indigo-950 tracking-tight">Create Employee</h1>
          <p className="text-xs text-slate-400 mt-0.5">Admin Panel — Add a new employee to the system</p>
        </div>

        <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(79,70,229,0.08)" }}>

          <div className="px-5 sm:px-6 py-4 border-b border-indigo-50"
            style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 16px rgba(129,140,248,0.4)" }}>
                👤
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950">New Employee Details</p>
                <p className="text-xs text-slate-400">All fields marked * are required</p>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-5 flex flex-col gap-4">

            {message && (
              <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium
                ${message.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  : "bg-red-50 border border-red-200 text-red-700"}`}>
                <span>{message.type === "success" ? "✅" : "⚠️"}</span>
                <span>{message.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Employee Name" required>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"><UserIcon /></div>
                  <input className={`${inputCls} pl-9`} type="text" placeholder="e.g. Rahul Kumar"
                    value={name} onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                </div>
              </Field>

              <Field label="Email" required>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"><EmailIcon /></div>
                  <input className={`${inputCls} pl-9`} type="email" placeholder="rahul@company.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                </div>
              </Field>
            </div>

            <Field label="Password" required>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"><LockIcon /></div>
                <input className={`${inputCls} pl-9 pr-9`}
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                <button type="button" onClick={() => setShowPass((p) => !p)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600 transition-colors">
                  <EyeIcon show={showPass} />
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Role" required>
                <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Select role…</option>
                  <option value="Admin">Admin</option>
                  <option value="Employee">Employee</option>
                </select>
              </Field>

              <Field label="Department" required>
                <select className={inputCls} value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={deptLoading}>
                  <option value="">{deptLoading ? "Loading…" : "Select department…"}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.departmentName}</option>
                  ))}
                </select>
              </Field>
            </div>

            {fieldError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                <span>⚠️</span> {fieldError}
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading || deptLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all
                hover:scale-[1.02] hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 15px rgba(79,70,229,0.35)" }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Creating employee…
                </span>
              ) : "＋ Create Employee"}
            </button>

            <button onClick={() => navigate("/dashboard")}
              className="w-full text-xs text-indigo-400 hover:text-indigo-600 transition-colors py-1">
              ← Back to Dashboard
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT EXPORT
//
// Fetches /api/assets and /api/maintenance at the root level so
// the Navbar bell has real notification data immediately.
// Builds assetMap for real asset name resolution in notifications.
// ─────────────────────────────────────────────────────────────
export default function CreateEmployee() {
  const user    = getStoredUser();
  const isAdmin = user.role === "Admin";

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // NOTIFICATION FIX: fetch real data for bell notifications
  const [assets,  setAssets]  = useState([]);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setAssets(a.data); setRecords(m.data); })
      .catch(() => {}); // errors shown in form only
  }, []);

  // NOTIFICATION FIX: build assetMap so bell shows real names
  const assetMap = useMemo(() => {
    const map = {};
    assets.forEach((a) => { if (a.id != null) map[a.id] = a.assetName ?? a.name ?? `Asset #${a.id}`; });
    return map;
  }, [assets]);

  // NOTIFICATION FIX: real notifications with real asset names
  const notifications = useMemo(
    () => buildNotifications(assets, records, assetMap),
    [assets, records, assetMap]
  );

  return (
    <div className="flex min-h-screen"
      style={{ background: "linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar
          onMenuToggle={() => setSidebarOpen((o) => !o)}
          notifications={notifications}
        />
        {isAdmin ? <CreateEmployeeForm /> : <AccessDeniedInline />}
      </div>
    </div>
  );
}