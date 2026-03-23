// ─────────────────────────────────────────────────────────────
// Maintenance.jsx — Role Title Fix + Real Asset Names in Notifications
//
// ═══════════════════════════════════════════════════════════
// WHAT WAS CHANGED FROM PREVIOUS VERSION
// ═══════════════════════════════════════════════════════════
//
// 1. ROLE-BASED DASHBOARD TITLE  (search "// ROLE TITLE FIX")
//    Problem: Navbar hardcoded "Admin Dashboard" for all users.
//    Fix: getDashboardLabel(user) reads user.role from localStorage:
//      - "Admin"    → "Admin Dashboard"
//      - "Employee" → "Employee Dashboard"
//      - any other  → "<Role> Dashboard"
//      - no role    → "Dashboard"
//
// 2. REAL ASSET NAMES IN NOTIFICATIONS  (search "// ASSET NAME FIX - NOTIF")
//    Problem: buildNotifications used `Asset #${r.assetId}` as a
//    fallback for overdue records, showing meaningless IDs like
//    "Asset #1" in the notification bell dropdown.
//    Fix: buildNotifications now accepts assetMap (id → name) as
//    a third argument. resolveNotifAssetName(record, assetMap) resolves:
//      1. record.assetName   — if already present
//      2. assetMap[assetId]  — looked up from the fetched assets list
//      3. "Asset #<id>"      — only absolute last resort
//    The assetMap is passed in from both the Maintenance component
//    and the root MaintenancePage so the Navbar bell also gets
//    real names immediately on load.
//
// ALL OTHER LOGIC — UNCHANGED
//   Real notifications, real AI per record, asset name fix in table,
//   working pagination, user name fix — all intact from previous version.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",  badge: null, path: "/dashboard"   },
  { label: "Assets",      icon: "📦", badge: null, path: "/assets"      },
  { label: "Maintenance", icon: "🔧", badge: null, path: "/maintenance" },
  { label: "Reports",     icon: "📊", badge: null, path: "/reports"     },
];

const EMPTY_FORM = {
  assetId: "", maintenanceDate: "", maintenanceType: "", cost: "",
  description: "", vendorName: "", performedBy: "", nextDueDate: "",
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCost(val) {
  if (val == null || val === "") return "—";
  return "$" + Number(val).toLocaleString("en-US");
}

function parseCost(val) {
  if (val == null) return 0;
  return Number(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function deriveStatus(nextDueDateStr) {
  if (!nextDueDateStr) return "Completed";
  const diff = (new Date(nextDueDateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0)   return "Overdue";
  if (diff <= 60) return "Pending";
  return "Completed";
}

const TECH_COLORS = ["#4f46e5", "#9333ea", "#14b8a6", "#f59e0b", "#ec4899", "#10b981"];
function techColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return TECH_COLORS[hash % TECH_COLORS.length];
}

const BAR_GRADIENTS = [
  "linear-gradient(90deg,#4f46e5,#818cf8)",
  "linear-gradient(90deg,#9333ea,#c084fc)",
  "linear-gradient(90deg,#14b8a6,#5eead4)",
  "linear-gradient(90deg,#f59e0b,#fcd34d)",
  "linear-gradient(90deg,#ec4899,#f9a8d4)",
  "linear-gradient(90deg,#10b981,#6ee7b7)",
];

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
// ASSET NAME FIX — resolveAssetName (for table rows, charts, etc.)
// ─────────────────────────────────────────────────────────────
function resolveAssetName(record, assetMap) {
  if (record.assetName && record.assetName.trim()) return record.assetName.trim();
  if (record.assetId   && assetMap[record.assetId]) return assetMap[record.assetId];
  return `Asset #${record.assetId ?? "?"}`;
}

// ─────────────────────────────────────────────────────────────
// ASSET NAME FIX - NOTIF
// resolveNotifAssetName — same logic but named separately for clarity.
// Used inside buildNotifications so the bell dropdown shows real names.
//
// Priority:
//   1. record.assetName   — if the backend already includes it
//   2. assetMap[assetId]  — looked up from the full assets list
//   3. "Asset #<id>"      — only as absolute last resort
// ─────────────────────────────────────────────────────────────
function resolveNotifAssetName(record, assetMap) {
  if (record.assetName && record.assetName.trim()) return record.assetName.trim();
  if (record.assetId   && assetMap[record.assetId]) return assetMap[record.assetId];
  return `Asset #${record.assetId ?? "?"}`;
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION BUILDER
//
// ASSET NAME FIX - NOTIF: now accepts assetMap as third argument.
// Overdue records use resolveNotifAssetName(r, assetMap) instead of
// the old `r.assetName ?? \`Asset #${r.assetId}\`` which showed IDs.
// ─────────────────────────────────────────────────────────────
function buildNotifications(assets, records, assetMap = {}) {
  const notes = [];

  // Overdue maintenance records
  // ASSET NAME FIX - NOTIF: real name via resolveNotifAssetName
  records
    .filter((r) => deriveStatus(r.nextDueDate) === "Overdue")
    .slice(0, 3)
    .forEach((r) => {
      notes.push({
        id:      `overdue-${r.id}`,
        type:    "critical",
        icon:    "🚨",
        title:   "Overdue Maintenance",
        // ASSET NAME FIX - NOTIF: shows "Dell Laptop" not "Asset #1"
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
    Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    Pending:   "bg-amber-50   text-amber-700   border border-amber-200",
    Overdue:   "bg-red-50     text-red-700     border border-red-200",
  };
  const dots = { Completed: "bg-emerald-500", Pending: "bg-amber-500", Overdue: "bg-red-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? "bg-gray-400"}`} />
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// AI PANEL — per-record AI recommendation
// ─────────────────────────────────────────────────────────────
function MaintenanceAiPanel({ record, assetMap, assetList, onClear }) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (record) callBackend(record); }, [record?.id]);

  const callBackend = async (r) => {
    setLoading(true); setAiError(""); setAiResult(""); setDisplayText(""); setDone(false);
    const assetName = resolveAssetName(r, assetMap);
    const fullAsset = assetList.find(
      (a) => a.id === r.assetId || (a.assetName ?? "").toLowerCase() === assetName.toLowerCase()
    );
    const currentVal = parseCost(fullAsset?.currentValue ?? 0);
    const payload = {
      assetName:       assetName,
      assetType:       fullAsset?.assetType ?? r.maintenanceType ?? "General",
      purchaseCost:    parseCost(fullAsset?.purchaseCost ?? fullAsset?.currentValue ?? 0),
      currentValue:    currentVal,
      usefulLifeYears: Number(fullAsset?.usefulLifeYears) || 5,
      maintenanceCost: parseCost(r.cost) > 0 ? parseCost(r.cost) : Math.round(currentVal * 0.3),
    };
    console.log("MaintenanceAI payload →", payload);
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

  if (!record) return null;
  const assetName = resolveAssetName(record, assetMap);

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
          <p className="text-xs text-indigo-400 mt-0.5 truncate">{assetName} · {record.maintenanceType ?? "Maintenance"}</p>
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

      <div className="flex gap-2 mb-3 flex-wrap relative z-10">
        {record.cost && (
          <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)", color: "#a5b4fc" }}>
            Cost: {formatCost(record.cost)}
          </span>
        )}
        {record.maintenanceDate && (
          <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)", color: "#a5b4fc" }}>
            Date: {formatDate(record.maintenanceDate)}
          </span>
        )}
        {record.nextDueDate && (
          <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.15)", color: "#a5b4fc" }}>
            Due: {formatDate(record.nextDueDate)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 mb-3 relative z-10">
        {loading && (
          <div className="flex items-center gap-3 rounded-xl p-3 border"
            style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-indigo-300">Analysing {assetName}…</span>
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
        <button onClick={() => callBackend(record)}
          className="w-full px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all relative z-10"
          style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)", boxShadow: "0 4px 14px rgba(79,70,229,0.4)" }}>
          🔄 Re-analyse
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR CONTENT
// ─────────────────────────────────────────────────────────────
function SidebarContent({ onNavigate }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const user        = getStoredUser();
  const displayName = getUserDisplayName(user);
  const handleNav   = (path) => { navigate(path); if (onNavigate) onNavigate(); };

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
              {item.badge && (
                <span className="text-xs bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">{user.role ?? "Administrator"}</p>
        <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{displayName}</p>
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
//
// ROLE TITLE FIX:
//   Before: hardcoded "Admin Dashboard" for every user
//   After:  getDashboardLabel(user) → "Employee Dashboard / Maintenance"
//           or "Admin Dashboard / Maintenance" based on actual role
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
  const pageTitle = TITLES[location.pathname] ?? "Maintenance";

  // ROLE TITLE FIX: dynamic label instead of hardcoded "Admin Dashboard"
  const dashboardLabel = getDashboardLabel(user);

  const initials    = getUserInitials(user);
  const displayName = getUserDisplayName(user);

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
          Desktop → "Employee Dashboard / Maintenance"
          Mobile  → "Maintenance" (space-efficient, unchanged)
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
        <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-24 truncate">{displayName.split(" ")[0]}</span>
      </div>

      <button onClick={handleLogout}
        className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors flex-shrink-0">
        <span className="hidden sm:inline">→ Logout</span><span className="sm:hidden">→</span>
      </button>
    </header>
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
// MAINTENANCE MODAL
// ─────────────────────────────────────────────────────────────
function MaintenanceModal({ editRecord, onClose, onSaved }) {
  const isEdit = Boolean(editRecord);
  const [form, setForm] = useState(() => {
    if (!editRecord) return EMPTY_FORM;
    const { _status, assetName, ...rest } = editRecord;
    return { ...EMPTY_FORM, ...rest };
  });
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");
  const [assetList, setAssetList] = useState([]);

  useEffect(() => {
    api.get("/api/assets").then((res) => setAssetList(res.data)).catch(() => setAssetList([]));
  }, []);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.assetId)             { setFormError("Please select an asset.");       return; }
    if (!form.maintenanceDate)     { setFormError("Maintenance Date is required."); return; }
    if (!form.maintenanceType)     { setFormError("Maintenance Type is required."); return; }
    if (!form.performedBy?.trim()) { setFormError("Performed By is required.");     return; }
    if (!form.nextDueDate)         { setFormError("Next Due Date is required.");    return; }
    setFormError(""); setSaving(true);
    const payload = { ...form, assetId: Number(form.assetId), cost: form.cost !== "" ? Number(form.cost) : null };
    try {
      isEdit
        ? await api.put(`/api/maintenance/${editRecord.id}`, payload)
        : await api.post("/api/maintenance", payload);
      onSaved(); onClose();
    } catch (err) {
      setFormError((err.response?.data?.message ?? String(err.response?.data ?? "")) || "Failed to save. Check your Spring Boot console.");
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
            <h2 className="text-sm font-bold text-indigo-950">
              {isEdit ? "Edit Maintenance Record" : "Schedule Maintenance"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? "Update the maintenance record below." : "Fill in the details to schedule a new maintenance job."}
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors text-base">
            ✕
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Asset" required>
              <select className={inputCls} value={form.assetId} onChange={(e) => set("assetId", e.target.value)}>
                <option value="">Select asset…</option>
                {assetList.map((a) => (
                  <option key={a.id} value={a.id}>{a.assetName ?? a.name ?? `Asset #${a.id}`}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Maintenance Type" required>
              <select className={inputCls} value={form.maintenanceType} onChange={(e) => set("maintenanceType", e.target.value)}>
                <option value="">Select type…</option>
                {["Repair","Service","Inspection","Replacement","Upgrade","Cleaning"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Maintenance Date" required>
              <input className={inputCls} type="date" value={form.maintenanceDate} onChange={(e) => set("maintenanceDate", e.target.value)} />
            </FormField>
            <FormField label="Next Due Date" required>
              <input className={inputCls} type="date" value={form.nextDueDate} onChange={(e) => set("nextDueDate", e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Cost ($)">
              <input className={inputCls} type="number" min="0" placeholder="e.g. 3000" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
            </FormField>
            <FormField label="Performed By" required>
              <input className={inputCls} placeholder="e.g. Rahul" value={form.performedBy} onChange={(e) => set("performedBy", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Vendor / Service Provider">
            <input className={inputCls} placeholder="e.g. TechFix, AutoCare" value={form.vendorName} onChange={(e) => set("vendorName", e.target.value)} />
          </FormField>
          <FormField label="Description / Notes">
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="e.g. Keyboard replacement…" value={form.description} onChange={(e) => set("description", e.target.value)} />
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
            style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 15px rgba(79,70,229,.35)" }}>
            {saving ? <><span className="animate-spin">⟳</span> Saving…</> : isEdit ? "💾 Update Record" : "＋ Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DELETE CONFIRM
// ─────────────────────────────────────────────────────────────
function DeleteConfirm({ record, assetMap, onCancel, onConfirm, deleting }) {
  const label = resolveAssetName(record, assetMap);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,10,40,0.55)", backdropFilter: "blur(4px)" }} onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: "0 24px 60px rgba(239,68,68,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 text-center">
          <div className="text-3xl mb-3">🗑️</div>
          <h3 className="text-sm font-bold text-indigo-950 mb-1">Delete Record?</h3>
          <p className="text-xs text-slate-500">
            This will permanently remove the maintenance record for{" "}
            <span className="font-semibold text-indigo-950">{label}</span>{" "}
            ({formatDate(record.maintenanceDate)}). This cannot be undone.
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
// MAINTENANCE ROW
// ─────────────────────────────────────────────────────────────
function MaintenanceRow({ record, assetMap, isEven, onEdit, onDelete, onAI }) {
  const status    = deriveStatus(record.nextDueDate);
  const initials  = (record.performedBy ?? "?").split(" ").map((w) => w[0]).join("").toUpperCase();
  const color     = techColor(record.performedBy);
  const assetName = resolveAssetName(record, assetMap);

  return (
    <tr className={`hover:bg-indigo-50/50 transition-colors cursor-pointer ${isEven ? "bg-slate-50/70" : ""}`}>
      <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-indigo-950 whitespace-nowrap">{assetName}</td>
      <td className="px-4 sm:px-5 py-3 text-xs text-slate-500 hidden sm:table-cell">{formatDate(record.maintenanceDate)}</td>
      <td className="px-4 sm:px-5 py-3 text-xs text-slate-500 hidden md:table-cell">{formatDate(record.nextDueDate)}</td>
      <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-indigo-950 hidden sm:table-cell">{formatCost(record.cost)}</td>
      <td className="px-4 sm:px-5 py-3"><StatusBadge status={status} /></td>
      <td className="px-4 sm:px-5 py-3 hidden md:table-cell">
        <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">{record.maintenanceType ?? "—"}</span>
      </td>
      <td className="px-4 sm:px-5 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: color }}>{initials}</div>
          <span className="text-xs text-slate-700">{record.performedBy ?? "—"}</span>
        </div>
      </td>
      <td className="px-4 sm:px-5 py-3 text-xs text-slate-500 hidden xl:table-cell">{record.vendorName ?? "—"}</td>
      <td className="px-4 sm:px-5 py-3">
        <div className="flex gap-1.5">
          <button onClick={() => onAI(record)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:scale-110 bg-purple-50 text-purple-500 hover:bg-purple-100 border border-purple-100"
            title="AI Recommendation">🤖</button>
          <button onClick={() => onEdit(record)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:scale-110 bg-indigo-50 text-indigo-500 hover:bg-indigo-100 border border-indigo-100"
            title="Edit record">✏️</button>
          <button onClick={() => onDelete(record)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:scale-110 bg-red-50 text-red-400 hover:bg-red-100 border border-red-100"
            title="Delete record">🗑️</button>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// COST BAR CHART
// ─────────────────────────────────────────────────────────────
function CostChart({ records, assetMap }) {
  const chartData = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      const label = resolveAssetName(r, assetMap);
      map[label]  = (map[label] ?? 0) + Number(r.cost ?? 0);
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [records, assetMap]);

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden flex-1"
      style={{ boxShadow: "0 4px 24px rgba(79,70,229,.07)" }}>
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-indigo-50">
        <span className="text-sm font-bold text-indigo-950">Maintenance Cost per Asset</span>
        <span className="text-xs text-slate-400">All records</span>
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {chartData.length === 0
          ? <p className="text-xs text-slate-400 text-center py-4">No data yet</p>
          : chartData.map((item, i) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-24 sm:w-28 flex-shrink-0 truncate">{item.label}</span>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(item.value / maxVal) * 100}%`, background: BAR_GRADIENTS[i % BAR_GRADIENTS.length] }} />
              </div>
              <span className="text-xs font-semibold text-indigo-950 w-14 sm:w-16 text-right flex-shrink-0">
                {formatCost(item.value)}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UPCOMING CARD
// ─────────────────────────────────────────────────────────────
function UpcomingCard({ records, assetMap }) {
  const upcoming = useMemo(() => {
    const now = new Date();
    return records
      .filter((r) => r.nextDueDate && new Date(r.nextDueDate) > now)
      .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))
      .slice(0, 4)
      .map((r) => ({
        ...r,
        urgency: Math.ceil((new Date(r.nextDueDate) - now) / 86400000) <= 30 ? "critical" : "warning",
      }));
  }, [records]);

  const urgencyStyles = {
    critical: { icon: "bg-red-50",   text: "text-red-600",   glow: "0 0 10px rgba(239,68,68,.2)"  },
    warning:  { icon: "bg-amber-50", text: "text-amber-600", glow: "0 0 10px rgba(245,158,11,.2)" },
  };

  return (
    <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden lg:w-56 flex-shrink-0"
      style={{ boxShadow: "0 4px 24px rgba(79,70,229,.07)" }}>
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-indigo-50">
        <span className="text-base">⚠️</span>
        <span className="text-sm font-bold text-indigo-950">Upcoming</span>
      </div>
      {upcoming.length === 0
        ? <p className="text-xs text-slate-400 text-center py-6">No upcoming records</p>
        : upcoming.map((item) => {
          const style = urgencyStyles[item.urgency];
          const label = resolveAssetName(item, assetMap);
          return (
            <div key={item.id ?? label}
              className="flex items-start gap-3 px-4 py-3 border-b border-indigo-50/60 hover:bg-indigo-50/30 transition-colors cursor-pointer">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${style.icon}`}
                style={{ boxShadow: style.glow }}>🔧</div>
              <div>
                <p className="text-xs font-semibold text-indigo-950 truncate" style={{ maxWidth: 120 }}>{label}</p>
                <p className="text-xs text-slate-400">Next due</p>
                <p className={`text-xs font-semibold mt-0.5 ${style.text}`}>{formatDate(item.nextDueDate)}</p>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAINTENANCE — main page
// ─────────────────────────────────────────────────────────────
function Maintenance() {
  const [records,      setRecords]      = useState([]);
  const [assetList,    setAssetList]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [assetFilter,  setAssetFilter]  = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter,   setDateFilter]   = useState("");
  const [modalMode,    setModalMode]    = useState(null);
  const [editRecord,   setEditRecord]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [aiRecord,     setAiRecord]     = useState(null);

  const PAGE_SIZE     = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const assetMap = useMemo(() => {
    const map = {};
    assetList.forEach((a) => { if (a.id != null) map[a.id] = a.assetName ?? a.name ?? `Asset #${a.id}`; });
    return map;
  }, [assetList]);

  const fetchAll = () => {
    setLoading(true); setError(null);
    Promise.all([api.get("/api/maintenance"), api.get("/api/assets")])
      .then(([m, a]) => { setRecords(m.data); setAssetList(a.data); })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd    = ()  => { setEditRecord(null); setModalMode("add");  };
  const openEdit   = (r) => { setEditRecord(r);    setModalMode("edit"); };
  const closeModal = ()  => { setModalMode(null);  setEditRecord(null);  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/maintenance/${deleteTarget.id}`);
      setDeleteTarget(null); fetchAll();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not delete record.");
    } finally { setDeleting(false); }
  };

  const recordsWithStatus = useMemo(
    () => records.map((r) => ({ ...r, _status: deriveStatus(r.nextDueDate) })),
    [records]
  );

  const filtered = useMemo(() => {
    return recordsWithStatus.filter((r) => {
      const label = resolveAssetName(r, assetMap).toLowerCase();
      const tech  = (r.performedBy ?? "").toLowerCase();
      return (
        (!search       || label.includes(search.toLowerCase()) || tech.includes(search.toLowerCase())) &&
        (!assetFilter  || resolveAssetName(r, assetMap) === assetFilter) &&
        (!statusFilter || r._status === statusFilter) &&
        (!dateFilter   || (r.maintenanceDate ?? "").startsWith(dateFilter))
      );
    });
  }, [recordsWithStatus, search, assetFilter, statusFilter, dateFilter, assetMap]);

  const uniqueAssets = useMemo(
    () => [...new Set(records.map((r) => resolveAssetName(r, assetMap)).filter(Boolean))],
    [records, assetMap]
  );

  // Reset to page 1 on filter changes
  useEffect(() => { setCurrentPage(1); }, [search, assetFilter, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function buildPageNumbers(total, current) {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    const pages  = new Set([1, total, current, current - 1, current + 1].filter((p) => p >= 1 && p <= total));
    const sorted = [...pages].sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push("…");
      result.push(p);
    });
    return result;
  }

  const statValues = useMemo(() => ({
    total:     records.length,
    completed: recordsWithStatus.filter((r) => r._status === "Completed").length,
    pending:   recordsWithStatus.filter((r) => r._status === "Pending").length,
    overdue:   recordsWithStatus.filter((r) => r._status === "Overdue").length,
  }), [recordsWithStatus]);

  const STAT_CARDS = [
    { label: "Total Records", value: statValues.total,     sub: "All time",               icon: "🗓️", accent: "from-indigo-500 to-indigo-400" },
    { label: "Completed",     value: statValues.completed, sub: "Next due passed",         icon: "✅", accent: "from-emerald-400 to-teal-400"  },
    { label: "Pending",       value: statValues.pending,   sub: "Due within 60 days",     icon: "⏳", accent: "from-amber-400 to-yellow-300"  },
    { label: "Overdue",       value: statValues.overdue,   sub: "Needs immediate action", icon: "🚨", accent: "from-red-500 to-rose-400"      },
  ];

  // ASSET NAME FIX - NOTIF: pass assetMap so bell shows real names
  const notifications = useMemo(
    () => buildNotifications(assetList, records, assetMap),
    [assetList, records, assetMap]
  );

  return (
    <>
      {(modalMode === "add" || modalMode === "edit") && (
        <MaintenanceModal
          editRecord={modalMode === "edit" ? editRecord : null}
          onClose={closeModal}
          onSaved={fetchAll}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          record={deleteTarget}
          assetMap={assetMap}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-indigo-950 tracking-tight">Maintenance Management</h1>
            <p className="text-xs text-slate-400 mt-0.5">Track and manage asset maintenance schedules</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              <input
                className="pl-8 pr-3 py-2 border border-indigo-100 rounded-xl text-xs bg-white/90 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 w-full sm:w-48 text-slate-700"
                placeholder="Search records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105 hover:shadow-xl whitespace-nowrap"
              style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 15px rgba(79,70,229,.35)" }}>
              ＋ <span className="hidden sm:inline">Schedule Maintenance</span><span className="sm:hidden">Schedule</span>
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((card) => (
            <div key={card.label}
              className="bg-white rounded-2xl p-3 sm:p-4 border border-indigo-50 relative overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-250 cursor-default"
              style={{ boxShadow: "0 2px 12px rgba(79,70,229,.07)" }}>
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.accent}`} />
              <div className="text-xl mb-2">{card.icon}</div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 leading-tight">{card.label}</p>
              <p className="text-2xl font-bold text-indigo-950">{card.value}</p>
              <p className="text-xs text-slate-300 mt-1 hidden sm:block">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* AI Panel */}
        {aiRecord && (
          <MaintenanceAiPanel
            record={aiRecord}
            assetMap={assetMap}
            assetList={assetList}
            onClear={() => setAiRecord(null)}
          />
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="px-3 py-2 text-xs border border-indigo-100 rounded-xl bg-white text-slate-600 outline-none focus:border-indigo-300 flex-1 sm:flex-none sm:min-w-36"
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value)}>
            <option value="">All Assets</option>
            {uniqueAssets.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select
            className="px-3 py-2 text-xs border border-indigo-100 rounded-xl bg-white text-slate-600 outline-none focus:border-indigo-300 flex-1 sm:flex-none sm:min-w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {["Completed","Pending","Overdue"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input
            type="date"
            className="px-3 py-2 text-xs border border-indigo-100 rounded-xl bg-white text-slate-600 outline-none focus:border-indigo-300 flex-1 sm:flex-none"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-indigo-400 text-sm gap-2">
            <span className="animate-spin text-lg inline-block">⟳</span> Loading maintenance records…
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
              <code className="bg-red-100 px-1 rounded">MaintenanceController</code>.
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden"
            style={{ boxShadow: "0 4px 24px rgba(79,70,249,.07)" }}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-indigo-50">
              <span className="text-sm font-bold text-indigo-950">Maintenance Records</span>
              <span className="text-xs text-slate-400">Showing {filtered.length} of {records.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
                    {[
                      { label: "Asset",        cls: "" },
                      { label: "Maint. Date",  cls: "hidden sm:table-cell" },
                      { label: "Next Due",     cls: "hidden md:table-cell" },
                      { label: "Cost",         cls: "hidden sm:table-cell" },
                      { label: "Status",       cls: "" },
                      { label: "Type",         cls: "hidden md:table-cell" },
                      { label: "Performed By", cls: "hidden lg:table-cell" },
                      { label: "Vendor",       cls: "hidden xl:table-cell" },
                      { label: "Actions",      cls: "" },
                    ].map((h) => (
                      <th key={h.label}
                        className={`px-4 sm:px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${h.cls}`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length > 0 ? (
                    paginated.map((record, i) => (
                      <MaintenanceRow
                        key={record.id ?? i}
                        record={record}
                        assetMap={assetMap}
                        isEven={i % 2 !== 0}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        onAI={(r) => setAiRecord(r)}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-400">
                        No records match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-indigo-50 flex-wrap gap-2">
              <span className="text-xs text-slate-400">
                {filtered.length === 0
                  ? "No records"
                  : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} record${filtered.length !== 1 ? "s" : ""}`
                }
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-7 h-7 rounded-lg text-xs font-medium border border-indigo-100 text-indigo-400 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    ‹
                  </button>

                  {buildPageNumbers(totalPages, safePage).map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium border transition-all
                          ${p === safePage ? "text-white border-transparent" : "border-indigo-100 text-indigo-400 hover:bg-indigo-50"}`}
                        style={p === safePage ? { background: "linear-gradient(90deg,#4f46e5,#9333ea)" } : {}}>
                        {p}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-7 h-7 rounded-lg text-xs font-medium border border-indigo-100 text-indigo-400 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom row */}
        {!loading && !error && (
          <div className="flex flex-col lg:flex-row gap-4">
            <CostChart records={records} assetMap={assetMap} />
            <UpcomingCard records={records} assetMap={assetMap} />
          </div>
        )}

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assets,      setAssets]      = useState([]);
  const [records,     setRecords]     = useState([]);

  useEffect(() => {
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setAssets(a.data); setRecords(m.data); })
      .catch(() => {});
  }, []);

  // ASSET NAME FIX - NOTIF: assetMap at root level for Navbar bell
  const assetMap = useMemo(() => {
    const map = {};
    assets.forEach((a) => { if (a.id != null) map[a.id] = a.assetName ?? a.name ?? `Asset #${a.id}`; });
    return map;
  }, [assets]);

  // ASSET NAME FIX - NOTIF: pass assetMap so bell shows real names
  const notifications = useMemo(
    () => buildNotifications(assets, records, assetMap),
    [assets, records, assetMap]
  );

  return (
    <div className="flex min-h-screen"
      style={{ background: "linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} notifications={notifications} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <Maintenance />
        </main>
      </div>
    </div>
  );
}