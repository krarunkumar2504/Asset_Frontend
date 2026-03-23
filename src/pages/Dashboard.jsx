// ─────────────────────────────────────────────────────────────
// Dashboard.jsx — Asset Name Fix in Notifications
//
// CHANGE: buildNotifications now accepts assetMap (id → name).
// resolveNotifAssetName resolves overdue record names as:
//   1. record.assetName   — if backend provides it
//   2. assetMap[assetId]  — looked up from fetched assets
//   3. "Asset #<id>"      — only last resort
// assetMap is built in the root Dashboard component and passed in.
// All other logic unchanged.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

const api = axios.create({
  baseURL: "https://asset-management-system.onrender.com",              
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 10000,
});

const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",  path: "/dashboard"   },
  { label: "Assets",      icon: "📦", path: "/assets"      },
  { label: "Maintenance", icon: "🔧", path: "/maintenance" },
  { label: "Reports",     icon: "📊", path: "/reports"     },
];
const ADMIN_NAV_ITEM = { label: "Create Employee", icon: "👤", path: "/create-employee" };

function parseCost(val) { if (val == null) return 0; return Number(String(val).replace(/[^0-9.]/g, "")) || 0; }
function fmtValue(n) { if (!n) return "$0"; if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if (n >= 1_000) return `$${(n/1_000).toFixed(0)}K`; return `$${n.toLocaleString("en-US")}`; }
function getStoredUser() { try { return JSON.parse(localStorage.getItem("user")) ?? {}; } catch { return {}; } }
function getDisplayName(user) { if (user.employeeName?.trim()) return user.employeeName.trim(); if (user.name?.trim()) return user.name.trim(); if (user.email?.trim()) return user.email.split("@")[0]; return "User"; }
function getUserInitials(user) { return getDisplayName(user).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "U"; }
function deriveStatus(dt) { if (!dt) return "Completed"; const diff = (new Date(dt) - new Date()) / 86400000; return diff < 0 ? "Overdue" : diff <= 60 ? "Pending" : "Completed"; }
function getDashboardLabel(user) { const role = (user.role ?? "").trim(); if (!role) return "Dashboard"; return `${role} Dashboard`; }

// ASSET NAME FIX: resolves real name for notification messages
function resolveNotifAssetName(record, assetMap) {
  if (record.assetName && record.assetName.trim()) return record.assetName.trim();
  if (record.assetId   && assetMap[record.assetId]) return assetMap[record.assetId];
  return `Asset #${record.assetId ?? "?"}`;
}

// ASSET NAME FIX: assetMap accepted as third arg
function buildNotifications(assets, maintenance, assetMap = {}) {
  const notes = [];
  maintenance.filter((r) => deriveStatus(r.nextDueDate) === "Overdue").slice(0, 3).forEach((r) => {
    notes.push({
      id: `overdue-${r.id}`, type: "critical", icon: "🚨",
      title:   "Overdue Maintenance",
      // ASSET NAME FIX: real name, not "Asset #1"
      message: `${resolveNotifAssetName(r, assetMap)} — due on ${r.nextDueDate ?? "unknown date"}`,
      time: "Overdue",
    });
  });
  assets.filter((a) => (a.status ?? "").toLowerCase() === "maintenance").slice(0, 2).forEach((a) => {
    notes.push({ id: `maint-${a.id}`, type: "warning", icon: "🔧", title: "Asset Under Maintenance", message: `${a.assetName ?? "Unknown asset"} is currently under maintenance`, time: "Active" });
  });
  const pending = maintenance.filter((r) => deriveStatus(r.nextDueDate) === "Pending");
  if (pending.length > 0) notes.push({ id: "pending-summary", type: "info", icon: "⏳", title: "Upcoming Maintenance", message: `${pending.length} task${pending.length > 1 ? "s" : ""} due within 60 days`, time: "Upcoming" });
  const inactive = assets.filter((a) => (a.status ?? "").toLowerCase() === "inactive");
  if (inactive.length > 0) notes.push({ id: "inactive-summary", type: "info", icon: "📦", title: "Inactive Assets", message: `${inactive.length} asset${inactive.length > 1 ? "s are" : " is"} inactive`, time: "Review" });
  notes.push({ id: "system", type: "info", icon: "✅", title: "System Status", message: "All systems operational — data synced", time: "Now" });
  return notes;
}

function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TYPE_STYLE = {
    critical: { iconBg: "bg-red-100",    dot: "bg-red-500",    title: "text-red-700"    },
    warning:  { iconBg: "bg-amber-100",  dot: "bg-amber-500",  title: "text-amber-700"  },
    info:     { iconBg: "bg-indigo-100", dot: "bg-indigo-400", title: "text-indigo-700" },
  };
  const style = { position: "fixed", top: (anchorRect?.bottom ?? 60) + 8, right: anchorRect ? window.innerWidth - anchorRect.right : 16, width: 320, zIndex: 9999, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(79,70,229,0.22), 0 4px 16px rgba(0,0,0,0.12)", border: "1px solid rgba(79,70,229,0.1)" };
  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div style={style}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50" style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-950">Notifications</span>
            <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: "linear-gradient(90deg,#f43f5e,#ec4899)" }}>{notifications.length}</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-sm">✕</button>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {notifications.length === 0
            ? <p className="text-xs text-slate-400 text-center py-8">No notifications</p>
            : notifications.map((n) => {
                const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
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
          <span className="text-xs text-indigo-500 font-medium">{notifications.filter((n) => n.type === "critical").length} critical · {notifications.length} total</span>
        </div>
      </div>
    </>,
    document.body
  );
}

function StatusBadge({ status }) {
  const styles = { Active: "bg-emerald-50 text-emerald-700 border border-emerald-200", Inactive: "bg-slate-100 text-slate-500 border border-slate-200", Maintenance: "bg-amber-50 text-amber-700 border border-amber-200" };
  const dots   = { Active: "bg-emerald-500", Inactive: "bg-slate-400", Maintenance: "bg-amber-500" };
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}><span className={`w-1.5 h-1.5 rounded-full ${dots[status] ?? "bg-gray-400"}`} />{status ?? "Unknown"}</span>;
}

function SidebarContent({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user     = getStoredUser();
  const isAdmin  = user.role === "Admin";
  const handleNav = (path) => { navigate(path); if (onNavigate) onNavigate(); };
  const NavButton = ({ item }) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <button onClick={() => handleNav(item.path)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 relative ${isActive ? "text-white" : "text-indigo-300 hover:text-indigo-100 hover:bg-white/5"}`}
        style={isActive ? { background: "linear-gradient(90deg,rgba(99,102,241,0.5),rgba(20,184,166,0.3))", boxShadow: "0 0 20px rgba(99,102,241,0.3)" } : {}}>
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full" style={{ background: "linear-gradient(180deg,#818cf8,#34d399)" }} />}
        <span className="text-sm w-4 text-center">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
      </button>
    );
  };
  return (
    <div className="flex flex-col h-full py-6 px-3.5">
      <div className="flex items-center gap-2.5 px-2 mb-8 cursor-pointer" onClick={() => handleNav("/dashboard")}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
        <div><div className="text-white font-bold text-base tracking-tight">AssetAI</div><div className="text-indigo-300 font-medium tracking-widest uppercase" style={{ fontSize: 9 }}>Management Suite</div></div>
      </div>
      <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>
      <nav className="flex flex-col gap-1">{NAV_ITEMS.map((item) => <NavButton key={item.label} item={item} />)}</nav>
      {isAdmin && (<><p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mt-5 mb-2">Admin</p><nav className="flex flex-col gap-1"><NavButton item={ADMIN_NAV_ITEM} /></nav></>)}
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
      <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col" style={{ background: bg }}><SidebarContent /></aside>
      <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ background: bg }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-indigo-300 hover:bg-white/10 hover:text-white transition-colors text-lg z-10">✕</button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}

function Navbar({ onMenuToggle, notifications }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const user       = getStoredUser();
  const bellRef    = useRef(null);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const PAGE_TITLES = { "/dashboard": "Dashboard", "/assets": "Assets", "/maintenance": "Maintenance", "/reports": "Reports", "/create-employee": "Create Employee" };
  const pageTitle      = PAGE_TITLES[location.pathname] ?? "Dashboard";
  const dashboardLabel = getDashboardLabel(user);
  const displayName    = getDisplayName(user);
  const initials       = getUserInitials(user);
  const handleBellClick = () => { if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect()); setNotifOpen((o) => !o); };
  const urgentCount  = notifications.filter((n) => n.type === "critical" || n.type === "warning").length;
  const handleLogout = () => { localStorage.removeItem("user"); navigate("/"); };
  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderColor: "rgba(79,70,229,0.08)" }}>
      <button onClick={onMenuToggle} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
        <span className="flex flex-col gap-1 w-4"><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /></span>
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-indigo-950 hidden sm:inline">{dashboardLabel}</span>
        <span className="text-xs text-indigo-300 font-normal hidden sm:inline"> / {pageTitle}</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">{pageTitle}</span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> All systems operational
      </div>
      <button ref={bellRef} onClick={handleBellClick}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0 ${notifOpen ? "bg-indigo-100 border-indigo-200" : "border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{ background: urgentCount > 0 ? "linear-gradient(135deg,#f43f5e,#ec4899)" : "linear-gradient(135deg,#4f46e5,#9333ea)", fontSize: 9 }}>
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>
      {notifOpen && <NotificationDropdown notifications={notifications} anchorRect={anchorRect} onClose={() => setNotifOpen(false)} />}
      <div className="flex items-center gap-2 border border-indigo-100 rounded-full px-2 py-1 bg-white cursor-pointer flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg,#4f46e5,#14b8a6)" }}>{initials}</div>
        <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-20 truncate">{displayName.split(" ")[0]}</span>
      </div>
      <button onClick={handleLogout} className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors flex-shrink-0">
        <span className="hidden sm:inline">→ Logout</span><span className="sm:hidden">→</span>
      </button>
    </header>
  );
}

function StatCard({ label, value, sub, icon, trend, trendColor, topBorder, iconBg }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-50 relative overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default" style={{ boxShadow: "0 2px 12px rgba(79,70,229,0.07)" }}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${topBorder}`} />
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl bg-gradient-to-br ${iconBg}`}>{icon}</div>
        <span className={`text-xs font-semibold border rounded-full px-2 sm:px-2.5 py-0.5 ${trendColor}`}>{trend}</span>
      </div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 leading-tight">{label}</p>
      <p className="text-2xl sm:text-3xl font-bold text-indigo-950 leading-none tracking-tight">{value}</p>
      <p className="text-xs text-slate-300 mt-1.5 hidden sm:block">{sub}</p>
    </div>
  );
}

function TableRow({ asset, isEven }) {
  return (
    <tr className={`hover:bg-indigo-50/50 transition-colors ${isEven ? "bg-slate-50/60" : ""}`}>
      <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{asset.assetName ?? asset.name ?? "—"}</td>
      <td className="px-4 sm:px-5 py-3 hidden sm:table-cell"><span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">{asset.assetType ?? asset.type ?? "—"}</span></td>
      <td className="px-4 sm:px-5 py-3"><StatusBadge status={asset.status ?? "Unknown"} /></td>
      <td className="px-4 sm:px-5 py-3 text-xs text-slate-400 hidden md:table-cell">{asset.location ?? "—"}</td>
    </tr>
  );
}

function QuickActions() {
  const navigate = useNavigate();
  const user     = getStoredUser();
  const isAdmin  = user.role === "Admin";
  return (
    <div className="bg-white rounded-2xl p-4 border border-indigo-50" style={{ boxShadow: "0 2px 12px rgba(79,70,229,0.06)" }}>
      <p className="text-sm font-bold text-indigo-950 mb-3">Quick Actions</p>
      <button onClick={() => navigate("/assets")} className="w-full py-2.5 mb-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background: "linear-gradient(90deg,#4f46e5,#7c3aed)", boxShadow: "0 4px 14px rgba(79,70,229,0.35)" }}>+ Add Asset</button>
      <button onClick={() => navigate("/maintenance")} className="w-full py-2.5 mb-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background: "linear-gradient(90deg,#0d9488,#14b8a6)", boxShadow: "0 4px 14px rgba(20,184,166,0.35)" }}>🔧 Schedule Maintenance</button>
      {isAdmin && <button onClick={() => navigate("/create-employee")} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background: "linear-gradient(90deg,#7c3aed,#ec4899)", boxShadow: "0 4px 14px rgba(147,51,234,0.35)" }}>👤 Create Employee</button>}
    </div>
  );
}

function AiInsights({ staticInsights, healthScore, assets, maintenance }) {
  const [aiResult,      setAiResult]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [aiError,       setAiError]       = useState("");
  const [displayText,   setDisplayText]   = useState("");
  const [showAi,        setShowAi]        = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => { if (assets.length > 0 && !selectedAsset) setSelectedAsset(assets[0]); }, [assets]);

  const typewriterRef = useRef(null);
  const runTypewriter = useCallback((fullText) => {
    setDisplayText(""); let i = 0; clearInterval(typewriterRef.current);
    typewriterRef.current = setInterval(() => { i++; setDisplayText(fullText.slice(0, i)); if (i >= fullText.length) clearInterval(typewriterRef.current); }, 20);
  }, []);
  useEffect(() => () => clearInterval(typewriterRef.current), []);

  const decision = useMemo(() => {
    if (!aiResult) return null;
    const t = aiResult.toLowerCase();
    if (t.includes("replace")) return { icon: "⚠️", label: "Replace Recommended", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", textColor: "#fca5a5" };
    if (t.includes("repair"))  return { icon: "✔️", label: "Repair Recommended",   color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", textColor: "#6ee7b7" };
    return null;
  }, [aiResult]);

  const risk = useMemo(() => {
    if (healthScore >= 70) return { label: "Low Risk",    color: "#34d399", bg: "rgba(52,211,153,0.15)",  border: "rgba(52,211,153,0.3)",  glow: "0 0 10px rgba(52,211,153,0.4)"  };
    if (healthScore >= 40) return { label: "Medium Risk", color: "#fbbf24", bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.3)",  glow: "0 0 10px rgba(251,191,36,0.4)"  };
    return                        { label: "High Risk",   color: "#f87171", bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.3)", glow: "0 0 10px rgba(248,113,113,0.4)" };
  }, [healthScore]);

  const generateAI = async (asset) => {
    if (!asset) { setAiError("Please select an asset first."); return; }
    setLoading(true); setAiError(""); setAiResult(""); setDisplayText(""); setShowAi(false);
    try {
      const assetName = asset.assetName ?? asset.name ?? "";
      const realMaintenanceCost = maintenance.filter((r) => { const nm = (r.assetName ?? "").toLowerCase() === assetName.toLowerCase(); const id = r.assetId !== undefined && r.assetId === asset.id; return nm || id; }).reduce((sum, r) => sum + parseCost(r.cost), 0);
      const currentVal = parseCost(asset.currentValue ?? 0);
      const maintenanceCost = realMaintenanceCost > 0 ? realMaintenanceCost : Math.round(currentVal * 0.3);
      const payload = { assetName: assetName || "Unknown Asset", assetType: asset.assetType ?? asset.type ?? "General", purchaseCost: parseCost(asset.purchaseCost ?? asset.currentValue ?? 0), currentValue: currentVal, usefulLifeYears: Number(asset.usefulLifeYears) || 5, maintenanceCost };
      const response = await api.post("/api/ai/recommendation", payload);
      const resultText = typeof response.data === "string" ? response.data : response.data?.recommendation ?? response.data?.result ?? response.data?.message ?? JSON.stringify(response.data);
      setAiResult(resultText); setShowAi(true); runTypewriter(resultText);
    } catch (err) {
      if      (err.code === "ERR_NETWORK")       setAiError("Cannot reach backend. Is Spring Boot running on port 8080?");
      else if (err.response?.status === 404)     setAiError("Endpoint not found. Check /api/ai/recommendation in your backend.");
      else setAiError(err.response?.data?.message ?? err.message ?? "Request failed.");
    } finally { setLoading(false); }
  };

  const handleReset = () => { clearInterval(typewriterRef.current); setAiResult(""); setDisplayText(""); setAiError(""); setShowAi(false); };

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 65%,#134e4a 100%)" }}>
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(99,102,241,0.5),transparent 70%)" }} />
      <div className="absolute -bottom-5 -left-5 w-24 h-24 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(20,184,166,0.4),transparent 70%)" }} />
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 14px rgba(129,140,248,0.6)" }}>★</div>
        <span className="text-sm font-bold text-white">AI Intelligence</span>
        <span className="font-semibold tracking-widest uppercase rounded-full px-2 py-0.5 border" style={{ background: showAi ? "rgba(52,211,153,0.2)" : "rgba(52,211,153,0.12)", color: "#6ee7b7", borderColor: "rgba(52,211,153,0.3)", fontSize: 9 }}>{showAi ? "AI ✓" : "Live"}</span>
        <span className="ml-auto font-bold rounded-full px-2 py-0.5 border" style={{ background: risk.bg, color: risk.color, borderColor: risk.border, fontSize: 9, boxShadow: risk.glow }}>{risk.label}</span>
      </div>
      {assets.length > 0 && (
        <div className="mb-3 relative z-10">
          <label className="block text-xs text-indigo-400 font-semibold mb-1 uppercase tracking-wider">Analyse asset</label>
          <select value={selectedAsset?.id ?? ""} onChange={(e) => { const picked = assets.find((a) => String(a.id) === e.target.value); setSelectedAsset(picked ?? null); handleReset(); }} className="w-full text-xs rounded-xl px-3 py-2 outline-none font-medium" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "#e0e7ff" }}>
            {assets.map((a) => <option key={a.id} value={a.id} style={{ background: "#312e81", color: "#e0e7ff" }}>{a.assetName ?? a.name ?? `Asset #${a.id}`}{a.assetType ? ` — ${a.assetType}` : ""}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2 mb-3 relative z-10">
        {!showAi && !loading && staticInsights.map((text, i) => (
          <div key={i} className="flex gap-2 items-start rounded-xl p-2.5 text-indigo-200 text-xs leading-relaxed border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }} />{text}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 rounded-xl p-3 border" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }}>
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-indigo-300">Analysing {selectedAsset?.assetName ?? "asset"}…</span>
          </div>
        )}
        {showAi && !loading && (
          <div className="rounded-xl p-3 border" style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.14)" }}>
            <p className="text-xs text-indigo-400 font-semibold mb-1.5 uppercase tracking-wide">{selectedAsset?.assetName ?? "Asset"} · {selectedAsset?.assetType ?? ""}</p>
            <p className="text-xs text-indigo-100 leading-relaxed whitespace-pre-wrap">{displayText}{displayText.length < aiResult.length && <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse" />}</p>
          </div>
        )}
        {aiError && <div className="flex gap-2 items-start rounded-xl p-2.5 text-xs border" style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.25)", color: "#fca5a5" }}><span className="flex-shrink-0">⚠️</span><span>{aiError}</span></div>}
      </div>
      {decision && !loading && (
        <div className="rounded-xl p-3 mb-3 border relative z-10" style={{ background: decision.bg, borderColor: decision.border }}>
          <div className="flex items-center gap-2"><span className="text-base">{decision.icon}</span><div><p className="text-xs font-bold uppercase tracking-wide" style={{ color: decision.color }}>Recommendation</p><p className="text-xs font-semibold mt-0.5" style={{ color: decision.textColor }}>{decision.label}</p></div></div>
        </div>
      )}
      <div className="rounded-xl p-2.5 mb-3 relative z-10" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-slate-400 font-medium">Asset Health Score</span><span className="text-xs text-indigo-300 font-bold">{healthScore}%</span></div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}><div className="h-full rounded-full" style={{ width: `${healthScore}%`, background: "linear-gradient(90deg,#818cf8,#34d399)", transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 0 8px rgba(129,140,248,0.5)" }} /></div>
      </div>
      <button onClick={() => generateAI(selectedAsset)} disabled={loading || !selectedAsset} className="w-full px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 relative z-10 disabled:opacity-60 disabled:cursor-not-allowed" style={{ background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(90deg,#4f46e5,#9333ea)", boxShadow: loading ? "none" : "0 4px 14px rgba(79,70,229,0.4)" }} onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "scale(1.03)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
        {loading ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</> : <>🤖 Generate AI Insight</>}
      </button>
      {showAi && !loading && <button onClick={handleReset} className="w-full text-center text-xs text-indigo-400 hover:text-indigo-200 mt-2 transition-colors relative z-10">↺ Reset to default insights</button>}
    </div>
  );
}

function DashboardContent({ assets, maintenance, loading, error, onRetry }) {
  const navigate = useNavigate();
  const summaryCards = useMemo(() => {
    const total = assets.length, active = assets.filter((a) => (a.status ?? "").toLowerCase() === "active").length, mCnt = assets.filter((a) => (a.status ?? "").toLowerCase() === "maintenance").length;
    const totalVal = assets.reduce((s, a) => s + parseCost(a.currentValue ?? a.value), 0), activeRate = total > 0 ? ((active / total) * 100).toFixed(1) : "0";
    return [
      { label: "Total Assets",    value: total.toLocaleString(),  sub: "Across all departments",    icon: "🗂️", trend: `${total} total`,      trendColor: "text-indigo-600 bg-indigo-50 border-indigo-200",   topBorder: "from-indigo-500 to-indigo-400", iconBg: "from-indigo-50 to-indigo-100",  route: "/assets"      },
      { label: "Active Assets",   value: active.toLocaleString(), sub: `${activeRate}% utilization`, icon: "✅", trend: `↑ ${activeRate}%`,    trendColor: "text-emerald-600 bg-emerald-50 border-emerald-200", topBorder: "from-teal-400 to-emerald-400",  iconBg: "from-teal-50 to-emerald-100",   route: "/assets"      },
      { label: "Maintenance Due", value: mCnt.toLocaleString(),   sub: mCnt > 0 ? "Requires attention" : "All clear", icon: "🔧", trend: mCnt > 0 ? "⚠ Due" : "✓ Clear", trendColor: mCnt > 0 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-emerald-600 bg-emerald-50 border-emerald-200", topBorder: "from-amber-400 to-yellow-300", iconBg: "from-amber-50 to-yellow-100", route: "/maintenance" },
      { label: "Total Value",     value: fmtValue(totalVal),      sub: `${total} assets tracked`,   icon: "💰", trend: "Live",                trendColor: "text-emerald-600 bg-emerald-50 border-emerald-200", topBorder: "from-violet-500 to-purple-400", iconBg: "from-violet-50 to-purple-100",  route: "/reports"     },
    ];
  }, [assets]);
  const recentAssets = useMemo(() => assets.slice(0, 6), [assets]);
  const { staticInsights, healthScore } = useMemo(() => {
    const total = assets.length, active = assets.filter((a) => (a.status ?? "").toLowerCase() === "active").length, inMaint = assets.filter((a) => (a.status ?? "").toLowerCase() === "maintenance").length, inactive = assets.filter((a) => (a.status ?? "").toLowerCase() === "inactive").length;
    const score = total > 0 ? Math.round((active / total) * 100) : 0, totalSpend = maintenance.reduce((s, r) => s + parseCost(r.cost), 0);
    const lines = [];
    if (total > 0)      lines.push(`Fleet has ${total} assets — ${active} active, ${inMaint} in maintenance, ${inactive} inactive.`);
    if (inMaint > 0)    lines.push(`${inMaint} asset${inMaint > 1 ? "s require" : " requires"} maintenance — visit the Maintenance page.`);
    if (totalSpend > 0) lines.push(`Total maintenance spend: $${totalSpend.toLocaleString("en-US")} across all records.`);
    if (lines.length === 0) lines.push("Connect your backend to see real-time insights.");
    return { staticInsights: lines, healthScore: score };
  }, [assets, maintenance]);

  if (loading) return <div className="flex items-center justify-center py-24 text-indigo-400 text-sm gap-2"><span className="animate-spin text-lg">⟳</span> Loading dashboard data…</div>;
  if (error) return (
    <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-red-100/60 border-b border-red-200">
        <span>⚠️</span>
        <span className="text-xs sm:text-sm font-semibold text-red-800 flex-1">{error.code === "ERR_NETWORK" ? "Network error — check Spring Boot and @CrossOrigin." : `Error ${error.response?.status ?? ""}: ${error.message}`}</span>
        <button onClick={onRetry} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)" }}>↺ Retry</button>
      </div>
      <div className="px-4 sm:px-5 py-4 text-xs text-red-600"><p>Add to your Spring Boot controllers:</p><code className="bg-red-100 px-2 py-1 rounded block w-fit mt-1">@CrossOrigin(origins = "http://localhost:3000")</code></div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => <div key={card.label} onClick={() => card.route && navigate(card.route)} className="cursor-pointer"><StatCard label={card.label} value={card.value} sub={card.sub} icon={card.icon} trend={card.trend} trendColor={card.trendColor} topBorder={card.topBorder} iconBg={card.iconBg} /></div>)}
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 bg-white rounded-2xl border border-indigo-50 overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(79,70,229,0.06)" }}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-indigo-50/80">
            <span className="text-sm font-bold text-indigo-950">Recent Assets</span>
            <button onClick={() => navigate("/assets")} className="text-xs text-indigo-500 font-medium hover:underline">View all →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>{[{l:"Asset Name",c:""},{l:"Type",c:"hidden sm:table-cell"},{l:"Status",c:""},{l:"Location",c:"hidden md:table-cell"}].map((h) => <th key={h.l} className={`px-4 sm:px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider ${h.c}`}>{h.l}</th>)}</tr></thead>
              <tbody>{recentAssets.length > 0 ? recentAssets.map((a, i) => <TableRow key={a.id ?? i} asset={a} isEven={i % 2 !== 0} />) : <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">No assets found.</td></tr>}</tbody>
            </table>
          </div>
          <div className="px-4 sm:px-5 py-2.5 border-t border-indigo-50"><span className="text-xs text-slate-400">Showing {recentAssets.length} of {assets.length} assets</span></div>
        </div>
        <div className="flex flex-col sm:flex-row lg:flex-col gap-4 w-full lg:w-56">
          <div className="flex-1 lg:flex-none"><QuickActions /></div>
          <div className="flex-1 lg:flex-none"><AiInsights staticInsights={staticInsights} healthScore={healthScore} assets={assets} maintenance={maintenance} /></div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [assets,      setAssets]      = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchAll = () => {
    setLoading(true); setError(null);
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setAssets(a.data); setMaintenance(m.data); })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchAll(); }, []);

  // ASSET NAME FIX: build assetMap so bell shows real names
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
    <div className="flex min-h-screen" style={{ background: "linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} notifications={notifications} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <DashboardContent assets={assets} maintenance={maintenance} loading={loading} error={error} onRetry={fetchAll} />
        </main>
      </div>
    </div>
  );
}