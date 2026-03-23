// ─────────────────────────────────────────────────────────────
// Assets.jsx — Role Title Fix + Asset Names in Notifications + Working Pagination
//
// ═══════════════════════════════════════════════════════════
// WHAT WAS CHANGED FROM PREVIOUS VERSION
// ═══════════════════════════════════════════════════════════
//
// 1. ROLE-BASED DASHBOARD TITLE  (search "// ROLE TITLE FIX")
//    Problem: Navbar always hardcoded "Admin Dashboard" for everyone.
//    Fix: getDashboardLabel(user) reads user.role from localStorage
//    and returns "<Role> Dashboard" e.g. "Employee Dashboard".
//
// 2. REAL ASSET NAMES IN NOTIFICATIONS  (search "// ASSET NAME FIX")
//    Problem: buildNotifications used `Asset #${r.assetId}` as a
//    fallback which showed meaningless IDs in the notification dropdown.
//    Fix: buildNotifications now accepts assetMap (id → name).
//    resolveNotifAssetName(record, assetMap) resolves the real name:
//      1. record.assetName  — if already present in the record
//      2. assetMap[assetId] — looked up from the fetched assets list
//      3. "Asset #<id>"     — only absolute last resort
//
// 3. WORKING PAGINATION  (search "// PAGINATION")
//    Problem: Page buttons 1 / 2 / 3 were decorative — clicking them
//    did nothing because there was no page state or slicing logic.
//    Fix: Added currentPage state + ITEMS_PER_PAGE = 10 constant.
//    pagedAssets = filtered.slice(start, end) — only current page shown.
//    Pagination bar renders the correct number of page buttons
//    dynamically based on filtered.length, highlights the active page,
//    and resets to page 1 whenever filters/search change.
//
// 4. ALL OTHER LOGIC — UNCHANGED
//    Real notifications, real AI per asset, user name fix — all intact.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "https://asset-management-system.onrender.com",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 8000,
});

const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",  badge: null, path: "/dashboard"   },
  { label: "Assets",      icon: "📦", badge: null, path: "/assets"      },
  { label: "Maintenance", icon: "🔧", badge: null, path: "/maintenance" },
  { label: "Reports",     icon: "📊", badge: null, path: "/reports"     },
];

const EMPTY_FORM = {
  assetName: "", assetType: "", location: "", status: "Active",
  currentValue: "", description: "", department: "", purchaseDate: "",
};

// PAGINATION: how many rows / cards per page
const ITEMS_PER_PAGE = 10;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function parseCost(val) {
  if (val == null) return 0;
  return Number(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user")) ?? {}; } catch { return {}; }
}

function getUserDisplayName(user) {
  if (user.employeeName?.trim()) return user.employeeName.trim();
  if (user.name?.trim())         return user.name.trim();
  if (user.email?.trim())        return user.email.split("@")[0];
  return "User";
}

function getUserInitials(user) {
  return getUserDisplayName(user).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "U";
}

function deriveStatus(dt) {
  if (!dt) return "Completed";
  const diff = (new Date(dt) - new Date()) / 86400000;
  return diff < 0 ? "Overdue" : diff <= 60 ? "Pending" : "Completed";
}

// ─────────────────────────────────────────────────────────────
// ROLE TITLE FIX — derives the navbar label from user.role
//
// Admin    → "Admin Dashboard"
// Employee → "Employee Dashboard"
// Manager  → "Manager Dashboard"
// (none)   → "Dashboard"
// ─────────────────────────────────────────────────────────────
function getDashboardLabel(user) {
  const role = (user.role ?? "").trim();
  if (!role) return "Dashboard";
  return `${role} Dashboard`;
}

// ─────────────────────────────────────────────────────────────
// ASSET NAME FIX — resolve real name for notifications
//
// buildNotifications previously showed "Asset #1" because it only
// had assetId from the maintenance record, not the asset name.
//
// Fix: pass assetMap (built from fetched assets: { id → name })
// resolveNotifAssetName checks:
//   1. record.assetName  — if backend already includes it
//   2. assetMap[assetId] — looked up from the full assets list
//   3. "Asset #<id>"     — only as absolute last resort
// ─────────────────────────────────────────────────────────────
function resolveNotifAssetName(record, assetMap) {
  if (record.assetName && record.assetName.trim()) return record.assetName.trim();
  if (record.assetId   && assetMap[record.assetId]) return assetMap[record.assetId];
  return `Asset #${record.assetId ?? "?"}`;
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION BUILDER — now uses assetMap for real names
// ASSET NAME FIX: assetMap passed in so overdue records show
// the actual asset name instead of "Asset #1" etc.
// ─────────────────────────────────────────────────────────────
function buildNotifications(assets, maintenance, assetMap = {}) {
  const notes = [];

  // Overdue maintenance records — ASSET NAME FIX: real name via assetMap
  maintenance
    .filter((r) => deriveStatus(r.nextDueDate) === "Overdue")
    .slice(0, 3)
    .forEach((r) => {
      notes.push({
        id:      `overdue-${r.id}`,
        type:    "critical",
        icon:    "🚨",
        title:   "Overdue Maintenance",
        // ASSET NAME FIX: resolveNotifAssetName instead of raw `Asset #${r.assetId}`
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

  // Pending maintenance count
  const pending = maintenance.filter((r) => deriveStatus(r.nextDueDate) === "Pending");
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
// NOTIFICATION DROPDOWN — React Portal
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

// ─────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    Active:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
    Inactive:    "bg-red-50     text-red-700     border border-red-200",
    Maintenance: "bg-amber-50   text-amber-700   border border-amber-200",
  };
  const dots = { Active: "bg-emerald-500", Inactive: "bg-red-500", Maintenance: "bg-amber-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? "bg-gray-400"}`} />
      {status ?? "Unknown"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR CONTENT
// ─────────────────────────────────────────────────────────────
function SidebarContent({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user     = getStoredUser();
  const handleNav = (path) => { navigate(path); if (onNavigate) onNavigate(); };

  return (
    <div className="flex flex-col h-full py-6 px-3.5">
      <div className="flex items-center gap-2.5 px-2 mb-8 cursor-pointer" onClick={() => handleNav("/dashboard")}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
        <div>
          <div className="text-white font-bold text-base">AssetAI</div>
          <div className="text-indigo-300 font-medium tracking-widest uppercase" style={{ fontSize: 9 }}>Management Suite</div>
        </div>
      </div>

      <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button key={item.label} onClick={() => handleNav(item.path)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 relative
                ${isActive ? "text-white" : "text-indigo-300 hover:bg-white/5 hover:text-indigo-100"}`}
              style={isActive ? { background: "linear-gradient(90deg,rgba(99,102,241,0.5),rgba(20,184,166,0.3))", boxShadow: "0 0 20px rgba(99,102,241,0.3)" } : {}}>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full"
                  style={{ background: "linear-gradient(180deg,#818cf8,#34d399)" }} />
              )}
              <span className="text-sm w-4 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">{user.role ?? "Administrator"}</p>
        <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{getUserDisplayName(user)}</p>
        <p className="text-xs text-indigo-600 mt-0.5">v3.1.0 — Pro Plan</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ mobileOpen, onClose }) {
  const bg = "linear-gradient(180deg,#1e1b4b 0%,#312e81 60%,#134e4a 100%)";
  return (
    <>
      <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col" style={{ background: bg }}>
        <SidebarContent />
      </aside>
      <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden
        ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose} />
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-300 ease-in-out lg:hidden
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: bg }}>
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-indigo-300 hover:bg-white/10 hover:text-white transition-colors text-lg z-10">
          ✕
        </button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// NAVBAR
// ROLE TITLE FIX: shows "<Role> Dashboard / <Page>" based on
// the logged-in user's role, not hardcoded "Admin Dashboard"
// ─────────────────────────────────────────────────────────────
function Navbar({ onMenuToggle, notifications }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const user        = getStoredUser();
  const bellRef     = useRef(null);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const TITLES = {
    "/dashboard":   "Dashboard",
    "/assets":      "Assets",
    "/maintenance": "Maintenance",
    "/reports":     "Reports",
  };
  const pageTitle = TITLES[location.pathname] ?? "Assets";

  // ROLE TITLE FIX: dynamic label from user.role
  const dashboardLabel = getDashboardLabel(user);

  const displayName = getUserDisplayName(user);
  const initials    = getUserInitials(user);

  const handleBellClick = () => {
    if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect());
    setNotifOpen((o) => !o);
  };

  const urgentCount  = notifications.filter((n) => n.type === "critical" || n.type === "warning").length;
  const handleLogout = () => { localStorage.removeItem("user"); navigate("/"); };

  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderColor: "rgba(79,70,229,0.08)" }}>

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
          Desktop → "Employee Dashboard / Assets"  or  "Admin Dashboard / Reports"
          Mobile  → just "Assets" (space-efficient, unchanged)
        */}
        <span className="text-sm font-bold text-indigo-950 hidden sm:inline">{dashboardLabel}</span>
        <span className="text-xs text-indigo-300 hidden sm:inline"> / {pageTitle}</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">{pageTitle}</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs text-indigo-600 bg-indigo-50/80 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> All systems operational
      </div>

      <button ref={bellRef} onClick={handleBellClick}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0
          ${notifOpen ? "bg-indigo-100 border-indigo-200" : "border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{ background: urgentCount > 0 ? "linear-gradient(135deg,#f43f5e,#ec4899)" : "linear-gradient(135deg,#4f46e5,#9333ea)", fontSize: 9 }}>
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {notifOpen && (
        <NotificationDropdown
          notifications={notifications}
          anchorRect={anchorRect}
          onClose={() => setNotifOpen(false)}
        />
      )}

      <div className="flex items-center gap-2 border border-indigo-100 rounded-full px-2 py-1 bg-white flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "linear-gradient(135deg,#4f46e5,#14b8a6)" }}>{initials}</div>
        <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-20 truncate">{displayName.split(" ")[0]}</span>
      </div>

      <button onClick={handleLogout}
        className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors flex-shrink-0">
        <span className="hidden sm:inline">→ Logout</span><span className="sm:hidden">→</span>
      </button>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// AI PANEL — per-asset AI recommendation
// ─────────────────────────────────────────────────────────────
function AssetAiPanel({ asset, maintenance, onClear }) {
  const [aiResult,    setAiResult]    = useState("");
  const [loading,     setLoading]     = useState(false);
  const [aiError,     setAiError]     = useState("");
  const [displayText, setDisplayText] = useState("");
  const [done,        setDone]        = useState(false);
  const timerRef = useRef(null);

  const runTypewriter = useCallback((text) => {
    setDisplayText(""); let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++; setDisplayText(text.slice(0, i));
      if (i >= text.length) { clearInterval(timerRef.current); setDone(true); }
    }, 18);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    if (!asset) return;
    callBackend(asset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  const callBackend = async (a) => {
    setLoading(true); setAiError(""); setAiResult(""); setDisplayText(""); setDone(false);
    const assetName = a.assetName ?? a.name ?? "";
    const realCost  = maintenance
      .filter((r) => {
        const nameMatch = (r.assetName ?? "").toLowerCase() === assetName.toLowerCase();
        const idMatch   = r.assetId !== undefined && r.assetId === a.id;
        return nameMatch || idMatch;
      })
      .reduce((sum, r) => sum + parseCost(r.cost), 0);
    const currentVal      = parseCost(a.currentValue ?? 0);
    const maintenanceCost = realCost > 0 ? realCost : Math.round(currentVal * 0.3);
    const payload = {
      assetName:       assetName || "Unknown Asset",
      assetType:       a.assetType ?? a.type ?? "General",
      purchaseCost:    parseCost(a.purchaseCost ?? a.currentValue ?? 0),
      currentValue:    currentVal,
      usefulLifeYears: Number(a.usefulLifeYears) || 5,
      maintenanceCost: maintenanceCost,
    };
    console.log("AssetAI payload →", payload);
    try {
      const res  = await api.post("/api/ai/recommendation", payload);
      const text = typeof res.data === "string"
        ? res.data
        : res.data?.recommendation ?? res.data?.result ?? res.data?.message ?? JSON.stringify(res.data);
      setAiResult(text);
      runTypewriter(text);
    } catch (err) {
      console.error("AI error:", err);
      if      (err.code === "ERR_NETWORK")       setAiError("Cannot reach backend — is Spring Boot running on port 8080?");
      else if (err.response?.status === 404)     setAiError("Endpoint not found — check /api/ai/recommendation in your backend.");
      else setAiError(err.response?.data?.message ?? err.message ?? "Request failed.");
    } finally { setLoading(false); }
  };

  const decision = useMemo(() => {
    if (!aiResult) return null;
    const t = aiResult.toLowerCase();
    if (t.includes("replace")) return { icon: "⚠️", label: "Replace Recommended", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", textColor: "#fca5a5" };
    if (t.includes("repair"))  return { icon: "✔️", label: "Repair Recommended",   color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", textColor: "#6ee7b7" };
    return null;
  }, [aiResult]);

  if (!asset) return null;

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 65%,#134e4a 100%)" }}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(99,102,241,0.5),transparent 70%)" }} />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(20,184,166,0.4),transparent 70%)" }} />

      <div className="flex items-center gap-2 mb-3 relative z-10">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 14px rgba(129,140,248,0.6)" }}>★</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-none">AI Intelligence</p>
          <p className="text-xs text-indigo-400 mt-0.5 truncate">{asset.assetName ?? asset.name}</p>
        </div>
        <span className="font-semibold tracking-widest uppercase rounded-full px-2 py-0.5 border flex-shrink-0"
          style={{ background: done ? "rgba(52,211,153,0.2)" : "rgba(52,211,153,0.12)", color: "#6ee7b7", borderColor: "rgba(52,211,153,0.3)", fontSize: 9 }}>
          {done ? "AI ✓" : loading ? "..." : "Live"}
        </span>
        <button onClick={onClear}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-indigo-400 hover:text-white hover:bg-white/10 transition-colors text-sm flex-shrink-0">
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-3 relative z-10">
        {loading && (
          <div className="flex items-center gap-3 rounded-xl p-3 border"
            style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-indigo-300">Analysing {asset.assetName ?? asset.name}…</span>
          </div>
        )}
        {displayText && (
          <div className="rounded-xl p-3 border"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" }}>
            <p className="text-xs text-indigo-100 leading-relaxed whitespace-pre-wrap">
              {displayText}
              {!done && <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse" />}
            </p>
          </div>
        )}
        {aiError && (
          <div className="flex gap-2 items-start rounded-xl p-2.5 text-xs border"
            style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5" }}>
            <span className="flex-shrink-0">⚠️</span><span>{aiError}</span>
          </div>
        )}
      </div>

      {decision && done && (
        <div className="rounded-xl p-3 mb-3 border relative z-10"
          style={{ background: decision.bg, borderColor: decision.border }}>
          <div className="flex items-center gap-2">
            <span className="text-base">{decision.icon}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: decision.color }}>Recommendation</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: decision.textColor }}>{decision.label}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <button onClick={() => callBackend(asset)}
          className="w-full px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all relative z-10"
          style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)", boxShadow: "0 4px 14px rgba(79,70,229,0.4)" }}>
          🔄 Re-analyse
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FORM FIELD
// ─────────────────────────────────────────────────────────────
function FormField({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
const inputCls = "px-3 py-2 border border-indigo-100 rounded-xl text-xs bg-white text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all w-full";

// ─────────────────────────────────────────────────────────────
// ADD / EDIT ASSET MODAL
// ─────────────────────────────────────────────────────────────
function AssetModal({ editAsset, onClose, onSaved }) {
  const isEdit = Boolean(editAsset);
  const [form,      setForm]      = useState(editAsset ?? EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.assetName.trim()) { setFormError("Asset Name is required."); return; }
    if (!form.assetType.trim()) { setFormError("Asset Type is required."); return; }
    if (!form.location.trim())  { setFormError("Location is required.");   return; }
    setFormError(""); setSaving(true);
    try {
      isEdit ? await api.put(`/api/assets/${editAsset.id}`, form) : await api.post("/api/assets", form);
      onSaved(); onClose();
    } catch (err) {
      setFormError(err.response?.data?.message ?? err.response?.data ?? "Failed to save. Check your Spring Boot console.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(15,10,40,0.55)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ boxShadow: "0 24px 60px rgba(79,70,229,0.22)" }} onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-indigo-50"
          style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
          <div>
            <h2 className="text-sm font-bold text-indigo-950">{isEdit ? "Edit Asset" : "Add New Asset"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? "Update the asset details below." : "Fill in the details to add a new asset."}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors text-base">
            ✕
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Asset Name" required>
              <input className={inputCls} placeholder="e.g. MacBook Pro 16" value={form.assetName} onChange={(e) => set("assetName", e.target.value)} />
            </FormField>
            <FormField label="Asset Type" required>
              <select className={inputCls} value={form.assetType} onChange={(e) => set("assetType", e.target.value)}>
                <option value="">Select type…</option>
                {["Laptop","Desktop","Mobile","Server","Network","Printer","Display","Hardware","Vehicle","Furniture","Other"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Location" required>
              <input className={inputCls} placeholder="e.g. HQ — Floor 2" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </FormField>
            <FormField label="Department">
              <input className={inputCls} placeholder="e.g. IT, Sales, HR" value={form.department} onChange={(e) => set("department", e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {["Active","Maintenance","Inactive"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Current Value ($)">
              <input className={inputCls} placeholder="e.g. 2400" type="number" min="0" value={form.currentValue} onChange={(e) => set("currentValue", e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Purchase Date">
              <input className={inputCls} type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Optional notes…" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </FormField>
          {formError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <span>⚠️</span> {formError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-indigo-50 bg-slate-50/60">
          <button onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 15px rgba(79,70,229,0.35)" }}>
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : isEdit ? "💾 Update Asset" : "＋ Add Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ASSET ROW
// ─────────────────────────────────────────────────────────────
function AssetRow({ asset, isEven, onEdit, onDelete, onAI }) {
  return (
    <tr className={`hover:bg-indigo-50/50 transition-colors cursor-pointer ${isEven ? "bg-slate-50/70" : ""}`}>
      <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-indigo-950 whitespace-nowrap">{asset.assetName}</td>
      <td className="px-4 sm:px-5 py-3 hidden sm:table-cell">
        <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">{asset.assetType}</span>
      </td>
      <td className="px-4 sm:px-5 py-3 text-xs text-slate-400 hidden md:table-cell">{asset.location}</td>
      <td className="px-4 sm:px-5 py-3"><StatusBadge status={asset.status} /></td>
      <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-indigo-950 hidden sm:table-cell">{asset.currentValue ?? "—"}</td>
      <td className="px-4 sm:px-5 py-3">
        <div className="flex gap-1.5">
          <button onClick={() => onAI(asset)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:scale-110 bg-purple-50 text-purple-500 hover:bg-purple-100 border border-purple-100"
            title="AI Recommendation">🤖</button>
          <button onClick={() => onEdit(asset)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:scale-110 bg-indigo-50 text-indigo-500 hover:bg-indigo-100 border border-indigo-100"
            title="Edit asset">✏️</button>
          <button onClick={() => onDelete(asset)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:scale-110 bg-red-50 text-red-400 hover:bg-red-100 border border-red-100"
            title="Delete asset">🗑️</button>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// ASSET CARD
// ─────────────────────────────────────────────────────────────
function AssetCard({ asset, onEdit, onDelete, onAI }) {
  return (
    <div className="rounded-2xl p-4 border relative overflow-hidden transition-all duration-250 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", borderColor: "rgba(79,70,229,0.1)" }}>
      <div className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#14b8a6)" }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br from-indigo-50 to-indigo-100">📦</div>
        <StatusBadge status={asset.status} />
      </div>
      <p className="text-sm font-bold text-indigo-950 mb-0.5">{asset.assetName}</p>
      <p className="text-xs text-slate-400">{asset.assetType}</p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-indigo-50">
        <span className="text-sm font-bold text-indigo-600">{asset.currentValue ?? "—"}</span>
        <span className="text-xs text-slate-300">{asset.location}</span>
      </div>
      <div className="flex gap-1.5 mt-3">
        <button onClick={() => onAI(asset)}
          className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-purple-100 text-purple-500 bg-purple-50 hover:bg-purple-100 transition-colors">
          🤖 AI
        </button>
        <button onClick={() => onEdit(asset)}
          className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-indigo-100 text-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-colors">
          ✏️ Edit
        </button>
        <button onClick={() => onDelete(asset)}
          className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-red-100 text-red-400 bg-red-50 hover:bg-red-100 transition-colors">
          🗑️
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DELETE CONFIRM
// ─────────────────────────────────────────────────────────────
function DeleteConfirm({ asset, onCancel, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,10,40,0.55)", backdropFilter: "blur(4px)" }} onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: "0 24px 60px rgba(239,68,68,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 text-center">
          <div className="text-3xl mb-3">🗑️</div>
          <h3 className="text-sm font-bold text-indigo-950 mb-1">Delete Asset?</h3>
          <p className="text-xs text-slate-500">
            This will permanently remove{" "}
            <span className="font-semibold text-indigo-950">{asset.assetName}</span>{" "}
            from the database. This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-2.5 text-xs font-semibold rounded-xl text-white transition-all hover:shadow-lg disabled:opacity-60"
            style={{ background: "linear-gradient(90deg,#ef4444,#f87171)" }}>
            {deleting ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGINATION COMPONENT
//
// PAGINATION: Renders page number buttons dynamically.
// - totalPages derived from filtered.length / ITEMS_PER_PAGE
// - Active page highlighted with gradient
// - Shows prev (‹) and next (›) arrow buttons
// - Ellipsis (…) when page count is large, keeping up to 5 visible pages
// ─────────────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  // Build visible page numbers — max 5 shown with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "…", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const btnBase  = "w-7 h-7 rounded-lg text-xs font-medium border transition-all flex items-center justify-center";
  const activeStyle = { background: "linear-gradient(90deg,#4f46e5,#9333ea)", border: "transparent" };

  return (
    <div className="flex items-center gap-1">
      {/* Prev arrow */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} border-indigo-100 text-indigo-400 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed`}>
        ‹
      </button>

      {pageNumbers.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${btnBase} ${currentPage === p ? "text-white" : "border-indigo-100 text-indigo-400 hover:bg-indigo-50"}`}
            style={currentPage === p ? activeStyle : {}}>
            {p}
          </button>
        )
      )}

      {/* Next arrow */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} border-indigo-100 text-indigo-400 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed`}>
        ›
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ASSETS — main page
// ─────────────────────────────────────────────────────────────
function Assets() {
  const [assets,       setAssets]       = useState([]);
  const [maintenance,  setMaintenance]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view,         setView]         = useState("table");
  const [modalMode,    setModalMode]    = useState(null);
  const [editAsset,    setEditAsset]    = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [aiAsset,      setAiAsset]      = useState(null);

  // PAGINATION: current page state — resets to 1 on filter change
  const [currentPage, setCurrentPage] = useState(1);

  // ASSET NAME FIX: build assetMap for notification name resolution
  const assetMap = useMemo(() => {
    const map = {};
    assets.forEach((a) => { if (a.id != null) map[a.id] = a.assetName ?? a.name ?? `Asset #${a.id}`; });
    return map;
  }, [assets]);

  const fetchAll = () => {
    setLoading(true); setError(null);
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setAssets(a.data); setMaintenance(m.data); })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const h = () => { if (window.innerWidth < 640) setView("card"); };
    h(); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);

  const openAdd    = () => { setEditAsset(null); setModalMode("add");  };
  const openEdit   = (a) => { setEditAsset(a);   setModalMode("edit"); };
  const closeModal = () => { setModalMode(null); setEditAsset(null);   };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/assets/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete asset.");
    } finally { setDeleting(false); }
  };

  // PAGINATION: reset to page 1 whenever filters or search change
  const filtered = useMemo(() => {
    setCurrentPage(1);
    return assets.filter((a) => {
      const name = (a.assetName ?? "").toLowerCase();
      const type = (a.assetType ?? "").toLowerCase();
      return (
        (!search       || name.includes(search.toLowerCase()) || type.includes(search.toLowerCase())) &&
        (!typeFilter   || a.assetType === typeFilter) &&
        (!statusFilter || (a.status ?? "") === statusFilter)
      );
    });
  }, [assets, search, typeFilter, statusFilter]);

  // PAGINATION: total pages + current page slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pagedAssets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const uniqueTypes = useMemo(() => [...new Set(assets.map((a) => a.assetType).filter(Boolean))], [assets]);

  // ASSET NAME FIX: pass assetMap to buildNotifications so real names appear
  const notifications = useMemo(
    () => buildNotifications(assets, maintenance, assetMap),
    [assets, maintenance, assetMap]
  );

  return (
    <>
      {(modalMode === "add" || modalMode === "edit") && (
        <AssetModal editAsset={modalMode === "edit" ? editAsset : null} onClose={closeModal} onSaved={fetchAll} />
      )}
      {deleteTarget && (
        <DeleteConfirm
          asset={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-indigo-950 tracking-tight">Assets Management</h1>
            <p className="text-xs text-slate-400 mt-0.5">Manage and monitor all your organisation's assets</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              <input
                className="pl-8 pr-3 py-2 border border-indigo-100 rounded-xl text-xs bg-white/90 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 w-full sm:w-48 text-slate-700"
                placeholder="Search assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105 hover:shadow-xl whitespace-nowrap"
              style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 15px rgba(79,70,229,0.35)" }}>
              ＋ <span className="hidden sm:inline">Add Asset</span><span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* AI Panel */}
        {aiAsset && (
          <AssetAiPanel
            asset={aiAsset}
            maintenance={maintenance}
            onClear={() => setAiAsset(null)}
          />
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="px-3 py-2 text-xs border border-indigo-100 rounded-xl bg-white text-slate-600 outline-none focus:border-indigo-300 flex-1 sm:flex-none sm:min-w-32"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {uniqueTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select
            className="px-3 py-2 text-xs border border-indigo-100 rounded-xl bg-white text-slate-600 outline-none focus:border-indigo-300 flex-1 sm:flex-none sm:min-w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {["Active","Maintenance","Inactive"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex-1 hidden sm:block" />
          <div className="flex border border-indigo-100 rounded-xl overflow-hidden bg-white ml-auto sm:ml-0">
            {["table","card"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 sm:px-4 py-2 text-xs font-medium transition-all ${view === v ? "text-white" : "text-slate-400 hover:text-slate-600"}`}
                style={view === v ? { background: "linear-gradient(90deg,#4f46e5,#9333ea)" } : {}}>
                {v === "table" ? "≡ Table" : "⊞ Cards"}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-indigo-400 text-sm gap-2">
            <span className="animate-spin text-lg inline-block">⟳</span> Loading assets…
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-red-100/60 border-b border-red-200">
              <span>⚠️</span>
              <span className="text-xs sm:text-sm font-semibold text-red-800 flex-1">
                {error.code === "ERR_NETWORK"
                  ? "Network error — check Spring Boot and @CrossOrigin."
                  : `Error ${error.response?.status ?? ""}: ${error.message}`}
              </span>
              <button onClick={fetchAll}
                className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)" }}>
                ↺ Retry
              </button>
            </div>
            <p className="px-4 sm:px-5 py-3 text-xs text-red-600">
              Add <code className="bg-red-100 px-1 rounded">@CrossOrigin(origins = "http://localhost:3000")</code> to your{" "}
              <code className="bg-red-100 px-1 rounded">AssetController</code>.
            </p>
          </div>
        )}

        {/* ── TABLE VIEW ─────────────────────────────────────── */}
        {!loading && !error && view === "table" && (
          <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden"
            style={{ boxShadow: "0 4px 24px rgba(79,70,229,0.07)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
                    {["Asset Name","Type","Location","Status","Value","Actions"].map((h, i) => (
                      <th key={h}
                        className={`px-4 sm:px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap
                          ${i === 1 ? "hidden sm:table-cell" : ""}
                          ${i === 2 ? "hidden md:table-cell" : ""}
                          ${i === 4 ? "hidden sm:table-cell" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedAssets.length > 0 ? (
                    // PAGINATION: render only pagedAssets (current page slice)
                    pagedAssets.map((asset, i) => (
                      <AssetRow
                        key={asset.id ?? i}
                        asset={asset}
                        isEven={i % 2 !== 0}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onAI={(a) => setAiAsset(a)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                        No assets match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION: footer with real page buttons */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-indigo-50">
              <span className="text-xs text-slate-400">
                Showing{" "}
                {filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}
                –{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} assets
              </span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}

        {/* ── CARD VIEW ──────────────────────────────────────── */}
        {!loading && !error && view === "card" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {pagedAssets.length > 0 ? (
                // PAGINATION: cards also use pagedAssets
                pagedAssets.map((asset, i) => (
                  <AssetCard
                    key={asset.id ?? i}
                    asset={asset}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                    onAI={(a) => setAiAsset(a)}
                  />
                ))
              ) : (
                <p className="col-span-4 text-center text-sm text-slate-400 py-10">
                  No assets match your filters.
                </p>
              )}
            </div>

            {/* PAGINATION: footer for card view */}
            {filtered.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-slate-400">
                  Showing{" "}
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                  –{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} assets
                </span>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assets,      setAssets]      = useState([]);
  const [maintenance, setMaintenance] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setAssets(a.data); setMaintenance(m.data); })
      .catch(() => {});
  }, []);

  // ASSET NAME FIX: assetMap at root level for Navbar notifications
  const assetMap = useMemo(() => {
    const map = {};
    assets.forEach((a) => { if (a.id != null) map[a.id] = a.assetName ?? a.name ?? `Asset #${a.id}`; });
    return map;
  }, [assets]);

  // ASSET NAME FIX: pass assetMap into buildNotifications
  const notifications = useMemo(
    () => buildNotifications(assets, maintenance, assetMap),
    [assets, maintenance, assetMap]
  );

  return (
    <div className="flex min-h-screen"
      style={{ background: "linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} notifications={notifications} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <Assets />
        </main>
      </div>
    </div>
  );
}