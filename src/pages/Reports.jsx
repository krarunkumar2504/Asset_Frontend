// ─────────────────────────────────────────────────────────────
// Reports.jsx — Fixed Version
//
// FIXES APPLIED:
// 1. ADMIN SIDEBAR ITEMS — Create Employee, Manage Employees, Audit Logs
//    now visible immediately on Reports page without needing to
//    navigate to Dashboard first. Added ADMIN_NAV_ITEMS constant
//    and admin section in SidebarContent (mirrors Dashboard.jsx).
//
// 2. MOBILE NOTIFICATION DROPDOWN — no longer cut off on the left.
//    Uses left-anchored positioning (same strategy as Assets.jsx v4):
//    computedLeft = Math.max(MARGIN, bellRight - dropW)
//    so it never overflows the screen edge on any phone.
//
// 3. REAL ASSET NAMES IN NOTIFICATIONS — assetMap passed to
//    buildNotifications so bell shows "Dell Laptop" not "Asset #1".
//    (Logic was already written; wiring confirmed intact.)
//
// ALL OTHER LOGIC UNCHANGED.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

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

// ── FIX 1: Admin nav items (same as Dashboard.jsx) ──────────
const ADMIN_NAV_ITEMS = [
  { label: "Create Employee",  icon: "👤", path: "/create-employee"  },
  { label: "Manage Employees", icon: "🏢", path: "/admin/employees"  },
  { label: "Audit Logs",       icon: "📜", path: "/audit-logs"       },
];

const BAR_GRADIENTS = [
  "linear-gradient(90deg,#4f46e5,#818cf8)",
  "linear-gradient(90deg,#9333ea,#c084fc)",
  "linear-gradient(90deg,#14b8a6,#5eead4)",
  "linear-gradient(90deg,#f59e0b,#fcd34d)",
  "linear-gradient(90deg,#ec4899,#f9a8d4)",
  "linear-gradient(90deg,#10b981,#6ee7b7)",
];

const DONUT_COLORS = ["#4f46e5","#9333ea","#14b8a6","#f59e0b","#ec4899","#10b981","#f43f5e"];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function fmt(val) {
  if (val == null || val === "") return "—";
  const n = Number(String(val).replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return String(val);
  return "$" + n.toLocaleString("en-US");
}

function parseCost(val) {
  if (val == null) return 0;
  return Number(String(val).replace(/[^0-9.]/g, "")) || 0;
}

function deriveStatus(dt) {
  if (!dt) return "Completed";
  const diff = (new Date(dt) - new Date()) / 86400000;
  return diff < 0 ? "Overdue" : diff <= 60 ? "Pending" : "Completed";
}

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user")) ?? {}; }
  catch { return {}; }
}

function getDisplayName(user) {
  if (user.employeeName && user.employeeName.trim()) return user.employeeName.trim();
  if (user.name         && user.name.trim())         return user.name.trim();
  if (user.email        && user.email.trim())        return user.email.split("@")[0];
  return "User";
}

function getUserInitials(user) {
  return getDisplayName(user).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "U";
}

function getDashboardLabel(user) {
  const role = (user.role ?? "").trim();
  if (!role) return "Dashboard";
  return `${role} Dashboard`;
}

function resolveAssetName(record, assetMap) {
  if (record.assetName && record.assetName.trim()) return record.assetName.trim();
  if (record.assetId   && assetMap[record.assetId]) return assetMap[record.assetId];
  return `Asset #${record.assetId ?? "?"}`;
}

function resolveNotifAssetName(record, assetMap) {
  if (record.assetName && record.assetName.trim()) return record.assetName.trim();
  if (record.assetId   && assetMap[record.assetId]) return assetMap[record.assetId];
  return `Asset #${record.assetId ?? "?"}`;
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION BUILDER
// ─────────────────────────────────────────────────────────────
function buildNotifications(assets, records, assetMap = {}) {
  const notes = [];

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
// NOTIFICATION DROPDOWN
// FIX 2: Mobile left-overflow fixed — mirrors Assets.jsx v4 strategy.
// Uses left-anchored positioning clamped to screen margins.
// ─────────────────────────────────────────────────────────────
function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TYPE_STYLE = {
    critical: { iconBg: "bg-red-100",    dot: "bg-red-500",    title: "text-red-700"    },
    warning:  { iconBg: "bg-amber-100",  dot: "bg-amber-500",  title: "text-amber-700"  },
    info:     { iconBg: "bg-indigo-100", dot: "bg-indigo-400", title: "text-indigo-700" },
  };

  const screenW    = window.innerWidth;
  const MARGIN     = 8;
  const dropW      = Math.min(300, screenW - MARGIN * 2);
  const bellRight  = anchorRect ? anchorRect.right : screenW - MARGIN;
  const computedLeft = Math.max(MARGIN, bellRight - dropW);

  const style = {
    position:     "fixed",
    top:          (anchorRect?.bottom ?? 60) + 8,
    left:         computedLeft,
    width:        dropW,
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
// DOWNLOAD: CSV
// ─────────────────────────────────────────────────────────────
function downloadCSV(assets, maintenance) {
  const today = new Date().toISOString().split("T")[0];
  const assetHeaders = ["ID","Asset Name","Type","Location","Department","Status","Current Value","Purchase Date","Description"];
  const assetRows = assets.map((a) => [
    a.id ?? "",
    `"${(a.assetName ?? "").replace(/"/g, '""')}"`,
    a.assetType ?? "",
    `"${(a.location ?? "").replace(/"/g, '""')}"`,
    `"${(a.department ?? "").replace(/"/g, '""')}"`,
    a.status ?? "",
    a.currentValue ?? "",
    a.purchaseDate ?? "",
    `"${(a.description ?? "").replace(/"/g, '""')}"`,
  ].join(","));
  const maintHeaders = ["ID","Asset ID","Asset Name","Date","Type","Cost","Performed By","Vendor","Next Due","Status"];
  const maintRows = maintenance.map((r) => [
    r.id ?? "", r.assetId ?? "",
    `"${(r.assetName ?? "").replace(/"/g, '""')}"`,
    r.maintenanceDate ?? "", r.maintenanceType ?? "", r.cost ?? "",
    `"${(r.performedBy ?? "").replace(/"/g, '""')}"`,
    `"${(r.vendorName ?? "").replace(/"/g, '""')}"`,
    r.nextDueDate ?? "", deriveStatus(r.nextDueDate),
  ].join(","));
  const csv = [`AssetAI Management Report — Generated ${today}`,"","=== ASSETS ===",assetHeaders.join(","),...assetRows,"","=== MAINTENANCE RECORDS ===",maintHeaders.join(","),...maintRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `AssetAI_Report_${today}.csv`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// DOWNLOAD: PDF
// ─────────────────────────────────────────────────────────────
function downloadPDF(assets, maintenance, kpiCards) {
  const today     = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const totalCost = maintenance.reduce((s, r) => s + parseCost(r.cost), 0);
  const assetTableRows = assets.slice(0, 50).map((a, i) => `<tr style="background:${i%2===0?"#f8f8ff":"#fff"}"><td>${a.assetName??"—"}</td><td>${a.assetType??"—"}</td><td>${a.location??"—"}</td><td>${a.department??"—"}</td><td><span class="badge badge-${(a.status??"").toLowerCase()}">${a.status??"—"}</span></td><td>${a.currentValue?"$"+Number(a.currentValue).toLocaleString("en-US"):"—"}</td></tr>`).join("");
  const maintTableRows = maintenance.slice(0, 50).map((r, i) => { const status = deriveStatus(r.nextDueDate); return `<tr style="background:${i%2===0?"#f8f8ff":"#fff"}"><td>${r.assetName??"—"}</td><td>${r.maintenanceDate??"—"}</td><td>${r.maintenanceType??"—"}</td><td>${r.cost?"$"+Number(r.cost).toLocaleString("en-US"):"—"}</td><td>${r.performedBy??"—"}</td><td>${r.nextDueDate??"—"}</td><td><span class="badge badge-${status.toLowerCase()}">${status}</span></td></tr>`; }).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>AssetAI Report — ${today}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;color:#1e1b4b;padding:32px;background:#fff}.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:2px solid #4f46e5;margin-bottom:24px}.logo{font-size:22px;font-weight:800;color:#4f46e5}.logo span{color:#14b8a6}.meta{text-align:right;font-size:11px;color:#64748b}.meta strong{display:block;font-size:14px;color:#1e1b4b;margin-bottom:2px}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}.kpi-card{background:linear-gradient(135deg,#f8f8ff,#f0fdfa);border:1px solid #e0e7ff;border-radius:10px;padding:12px}.kpi-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}.kpi-value{font-size:20px;font-weight:800;color:#1e1b4b}.kpi-sub{font-size:9px;color:#94a3b8;margin-top:2px}.summary-bar{background:linear-gradient(135deg,#1e1b4b,#312e81);color:#e0e7ff;border-radius:10px;padding:12px 16px;margin-bottom:28px;display:flex;gap:32px}.summary-bar div{font-size:11px}.summary-bar strong{font-size:16px;display:block;color:#fff}.section-title{font-size:13px;font-weight:700;color:#1e1b4b;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e0e7ff}table{width:100%;border-collapse:collapse;margin-bottom:28px;font-size:11px}th{background:linear-gradient(90deg,#f8f8ff,#f0fdfa);color:#64748b;text-transform:uppercase;font-size:9px;letter-spacing:.05em;padding:8px 10px;text-align:left;border-bottom:1px solid #e0e7ff}td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#1e1b4b}.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase}.badge-active{background:#ecfdf5;color:#059669}.badge-maintenance{background:#fffbeb;color:#d97706}.badge-inactive{background:#fef2f2;color:#dc2626}.badge-completed{background:#ecfdf5;color:#059669}.badge-pending{background:#fffbeb;color:#d97706}.badge-overdue{background:#fef2f2;color:#dc2626}.footer{margin-top:20px;padding-top:12px;border-top:1px solid #e0e7ff;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}@media print{body{padding:20px}@page{margin:1cm;size:A4 landscape}}</style></head><body><div class="header"><div><div class="logo">Asset<span>AI</span></div><div style="font-size:10px;color:#64748b;margin-top:2px;">Management Suite — Analytics Report</div></div><div class="meta"><strong>Asset Management Report</strong>Generated on ${today}<br/>Total Assets: ${assets.length} | Total Records: ${maintenance.length}</div></div><div class="kpi-grid"><div class="kpi-card"><div class="kpi-label">Total Assets</div><div class="kpi-value">${assets.length.toLocaleString()}</div><div class="kpi-sub">All departments</div></div><div class="kpi-card"><div class="kpi-label">Active Assets</div><div class="kpi-value">${assets.filter((a)=>(a.status??"").toLowerCase()==="active").length}</div><div class="kpi-sub">Currently operational</div></div><div class="kpi-card"><div class="kpi-label">Total Maint. Cost</div><div class="kpi-value">$${totalCost.toLocaleString("en-US")}</div><div class="kpi-sub">All maintenance records</div></div><div class="kpi-card"><div class="kpi-label">Maintenance Records</div><div class="kpi-value">${maintenance.length}</div><div class="kpi-sub">Total logged entries</div></div></div><div class="summary-bar"><div><strong>${assets.filter((a)=>(a.status??"").toLowerCase()==="active").length}</strong>Active</div><div><strong>${assets.filter((a)=>(a.status??"").toLowerCase()==="maintenance").length}</strong>Under Maintenance</div><div><strong>${assets.filter((a)=>(a.status??"").toLowerCase()==="inactive").length}</strong>Inactive</div><div><strong>${maintenance.filter((r)=>deriveStatus(r.nextDueDate)==="Overdue").length}</strong>Overdue</div><div><strong>${maintenance.filter((r)=>deriveStatus(r.nextDueDate)==="Pending").length}</strong>Pending</div></div><div class="section-title">📦 Assets (${Math.min(assets.length,50)} of ${assets.length})</div><table><thead><tr><th>Asset Name</th><th>Type</th><th>Location</th><th>Department</th><th>Status</th><th>Value</th></tr></thead><tbody>${assetTableRows||'<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No assets found</td></tr>'}</tbody></table><div class="section-title">🔧 Maintenance Records (${Math.min(maintenance.length,50)} of ${maintenance.length})</div><table><thead><tr><th>Asset</th><th>Date</th><th>Type</th><th>Cost</th><th>Performed By</th><th>Next Due</th><th>Status</th></tr></thead><tbody>${maintTableRows||'<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No records</td></tr>'}</tbody></table><div class="footer"><span>AssetAI Management Suite · Confidential</span><span>${today}</span></div><script>window.onload=function(){window.print()}</script></body></html>`;
  const newTab = window.open("", "_blank");
  if (newTab) { newTab.document.write(html); newTab.document.close(); }
  else {
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `AssetAI_Report_${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    alert("Popup was blocked. Report downloaded as HTML. Open it in your browser and press Ctrl+P to save as PDF.");
  }
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR CONTENT
// FIX 1: Admin section now rendered in Reports page sidebar.
// ─────────────────────────────────────────────────────────────
function SidebarContent({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user     = getStoredUser();
  const isAdmin  = user.role === "Admin";
  const handleNav = (path) => { navigate(path); if (onNavigate) onNavigate(); };

  const NavBtn = ({ item }) => {
    const isActive = location.pathname === item.path ||
      (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
    return (
      <button
        onClick={() => handleNav(item.path)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 relative
          ${isActive ? "text-white" : "text-indigo-300 hover:bg-white/5 hover:text-indigo-100"}`}
        style={isActive ? { background: "linear-gradient(90deg,rgba(99,102,241,.5),rgba(20,184,166,.3))", boxShadow: "0 0 20px rgba(99,102,241,.3)" } : {}}>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full"
            style={{ background: "linear-gradient(180deg,#818cf8,#34d399)" }} />
        )}
        <span className="text-sm w-4 text-center">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {item.badge && <span className="text-xs bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded-full">{item.badge}</span>}
      </button>
    );
  };

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
        {NAV_ITEMS.map((item) => <NavBtn key={item.label} item={item} />)}
      </nav>

      {/* FIX 1: Admin section — visible on Reports page for Admin role */}
      {isAdmin && (
        <>
          <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mt-5 mb-2">Admin</p>
          <nav className="flex flex-col gap-1">
            {ADMIN_NAV_ITEMS.map((item) => <NavBtn key={item.label} item={item} />)}
          </nav>
        </>
      )}

      <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: isAdmin ? "#34d399" : "#a5b4fc" }}>
          {user.role ?? "Administrator"}
        </p>
        <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{getDisplayName(user)}</p>
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
      <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col" style={{ background: bg }}><SidebarContent /></aside>
      <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden
        ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-300 ease-in-out lg:hidden
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ background: bg }}>
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
// ─────────────────────────────────────────────────────────────
function Navbar({ onMenuToggle, notifications }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const user        = getStoredUser();
  const bellRef     = useRef(null);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const TITLES    = { "/dashboard": "Dashboard", "/assets": "Assets", "/maintenance": "Maintenance", "/reports": "Reports" };
  const pageTitle = TITLES[location.pathname] ?? "Reports";
  const dashboardLabel = getDashboardLabel(user);
  const initials    = getUserInitials(user);
  const displayName = getDisplayName(user);

  const handleBellClick = () => {
    if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect());
    setNotifOpen((o) => !o);
  };

  const urgentCount  = (notifications ?? []).filter((n) => n.type === "critical" || n.type === "warning").length;
  const handleLogout = () => { localStorage.removeItem("user"); navigate("/"); };

  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b"
      style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderColor: "rgba(79,70,229,.08)" }}>

      <button onClick={onMenuToggle}
        className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
        <span className="flex flex-col gap-1 w-4">
          <span className="block h-0.5 bg-current rounded-full" />
          <span className="block h-0.5 bg-current rounded-full" />
          <span className="block h-0.5 bg-current rounded-full" />
        </span>
      </button>

      <div className="flex-1 min-w-0">
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
        {(notifications ?? []).length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{ background: urgentCount > 0 ? "linear-gradient(135deg,#f43f5e,#ec4899)" : "linear-gradient(135deg,#4f46e5,#9333ea)", fontSize: 9 }}>
            {(notifications ?? []).length > 9 ? "9+" : (notifications ?? []).length}
          </span>
        )}
      </button>

      {notifOpen && (
        <NotificationDropdown
          notifications={notifications ?? []}
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
// KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, trend, ok, accent, iconBg }) {
  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-indigo-50 relative overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-default"
      style={{ boxShadow: "0 2px 12px rgba(79,70,229,.07)" }}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base sm:text-lg bg-gradient-to-br ${iconBg}`}>{icon}</div>
        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{trend}</span>
      </div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1 leading-tight">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-indigo-950 leading-none tracking-tight">{value}</p>
      <p className="text-xs text-slate-300 mt-1.5 hidden sm:block">{sub}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden" style={{ boxShadow: "0 2px 14px rgba(79,70,229,.06)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50">
        <span className="text-xs font-bold text-indigo-950">{title}</span>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function LineChartSVG({ costTrend }) {
  const W = 320, H = 110, PAD = { top: 8, right: 8, bottom: 22, left: 36 };
  const iW = W - PAD.left - PAD.right, iH = H - PAD.top - PAD.bottom;
  if (!costTrend || costTrend.length === 0) return <div className="flex items-center justify-center h-28 text-xs text-slate-400">No trend data yet</div>;
  const yMax = Math.ceil(Math.max(...costTrend.map((d) => d.cost), 1) / 1000) * 1000 || 1000;
  const yTicks = [0, Math.round(yMax / 3), Math.round((yMax * 2) / 3), yMax];
  const pts = costTrend.map((d, i) => ({ x: PAD.left + (costTrend.length > 1 ? (i / (costTrend.length - 1)) : 0.5) * iW, y: PAD.top + iH - (d.cost / yMax) * iH, ...d }));
  const lp  = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const ap  = lp + ` L${pts[pts.length-1].x.toFixed(1)},${(PAD.top+iH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.top+iH).toFixed(1)} Z`;
  const peak = costTrend.reduce((a, b) => b.cost > a.cost ? b : a, costTrend[0]);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 115 }}>
        <defs>
          <linearGradient id="lgArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18"/><stop offset="100%" stopColor="#4f46e5" stopOpacity="0"/></linearGradient>
          <linearGradient id="lgLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#4f46e5"/><stop offset="100%" stopColor="#9333ea"/></linearGradient>
        </defs>
        {yTicks.map((t) => { const y = PAD.top + iH - (t / yMax) * iH; return <g key={t}><line x1={PAD.left} y1={y} x2={PAD.left+iW} y2={y} stroke="#f1f5f9" strokeWidth="1"/><text x={PAD.left-4} y={y+3} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="sans-serif">${(t/1000).toFixed(0)}K</text></g>; })}
        <path d={ap} fill="url(#lgArea)"/>
        <path d={lp} fill="none" stroke="url(#lgLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p) => <g key={p.month}><circle cx={p.x} cy={p.y} r="4" fill="#9333ea" stroke="#fff" strokeWidth="1.5"/><text x={p.x} y={H-3} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="sans-serif">{p.month}</text></g>)}
      </svg>
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-4 h-0.5 rounded-full inline-block" style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)" }}/>Cost ($)</div>
        <span className="ml-auto text-xs text-slate-400">Peak: <span className="text-purple-600 font-semibold">{fmt(peak.cost)}</span> in {peak.month}</span>
      </div>
    </>
  );
}

function DonutChartSVG({ assetTypeCounts, totalAssets }) {
  const CX = 70, CY = 70, R = 44, STROKE = 16, CIRC = 2 * Math.PI * R;
  if (!assetTypeCounts || assetTypeCounts.length === 0) return <div className="flex items-center justify-center h-28 text-xs text-slate-400">No asset data yet</div>;
  let offset = 0;
  const segments = assetTypeCounts.map((item, i) => { const pct = totalAssets > 0 ? (item.count / totalAssets) * 100 : 0; const dash = (pct / 100) * CIRC; const seg = { ...item, pct: pct.toFixed(1), color: DONUT_COLORS[i % DONUT_COLORS.length], dash, offset: -offset }; offset += dash; return seg; });
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 140" style={{ width: 130, height: 130 }}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE}/>
        {segments.map((seg) => <circle key={seg.type} cx={CX} cy={CY} r={R} fill="none" stroke={seg.color} strokeWidth={STROKE} strokeDasharray={`${seg.dash} ${CIRC-seg.dash}`} strokeDashoffset={seg.offset} transform={`rotate(-90 ${CX} ${CY})`}/>)}
        <text x={CX} y={CY-4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e1b4b" fontFamily="sans-serif">{totalAssets.toLocaleString()}</text>
        <text x={CX} y={CY+10} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="sans-serif">Assets</text>
      </svg>
      <div className="w-full flex flex-col gap-1.5 mt-1">
        {segments.map((item) => <div key={item.type} className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }}/><span className="flex-1 truncate">{item.type || "Other"}</span><span className="font-semibold text-indigo-950">{item.pct}%</span></div>)}
      </div>
    </div>
  );
}

function BarChartCSS({ deptValues }) {
  if (!deptValues || deptValues.length === 0) return <p className="text-xs text-slate-400 text-center py-4">No department data</p>;
  const maxVal = Math.max(...deptValues.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {deptValues.map((item, i) => (
        <div key={item.dept} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 text-right flex-shrink-0" style={{ width: 54, fontSize: 11 }}>{item.dept}</span>
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.value / maxVal) * 100}%`, background: BAR_GRADIENTS[i % BAR_GRADIENTS.length] }}/></div>
          <span className="text-xs font-semibold text-indigo-950 flex-shrink-0 text-right" style={{ width: 46 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = { Active: "bg-emerald-50 text-emerald-700 border border-emerald-200", Maintenance: "bg-amber-50 text-amber-700 border border-amber-200", Inactive: "bg-red-50 text-red-700 border border-red-200" };
  const d = { Active: "bg-emerald-500", Maintenance: "bg-amber-500", Inactive: "bg-red-500" };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s[status] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}><span className={`w-1 h-1 rounded-full ${d[status] ?? "bg-gray-400"}`}/>{status ?? "Unknown"}</span>;
}

function TableRow({ row, isEven }) {
  const color = { high: "text-red-600", medium: "text-amber-600", ok: "text-emerald-600" };
  return (
    <tr className={`hover:bg-indigo-50/50 transition-colors cursor-pointer ${isEven ? "bg-slate-50/70" : ""}`}>
      <td className="px-3 sm:px-4 py-2.5 text-sm font-semibold text-indigo-950 whitespace-nowrap">{row.name}</td>
      <td className={`px-3 sm:px-4 py-2.5 text-sm font-bold ${color[row.level]}`}>{fmt(row.totalCost)}</td>
      <td className="px-3 sm:px-4 py-2.5 text-sm text-slate-600 hidden sm:table-cell">{fmt(row.assetValue) ?? "—"}</td>
      <td className={`px-3 sm:px-4 py-2.5 text-xs font-semibold hidden md:table-cell ${color[row.level]}`}>{row.ratio}</td>
      <td className="px-3 sm:px-4 py-2.5"><StatusBadge status={row.status}/></td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// AI INSIGHTS PANEL
// ─────────────────────────────────────────────────────────────
function ReportsAiPanel({ assets, maintenance, topAssets, underperforming, assetTypeCounts, costTrend, kpiCards }) {
  const [aiText,      setAiText]      = useState("");
  const [displayText, setDisplayText] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [aiError,     setAiError]     = useState("");
  const [done,        setDone]        = useState(false);
  const timerRef = useRef(null);

  const runTypewriter = useCallback((text) => {
    setDisplayText(""); let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++; setDisplayText(text.slice(0, i));
      if (i >= text.length) { clearInterval(timerRef.current); setDone(true); }
    }, 14);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (assets.length > 0 || maintenance.length > 0) generateInsights(); }, []);

  const generateInsights = async () => {
    setLoading(true); setAiError(""); setAiText(""); setDisplayText(""); setDone(false);
    const totalCost       = maintenance.reduce((s, r) => s + parseCost(r.cost), 0);
    const activeCount     = assets.filter((a) => (a.status ?? "").toLowerCase() === "active").length;
    const underMaintCount = assets.filter((a) => (a.status ?? "").toLowerCase() === "maintenance").length;
    const overdueCount    = maintenance.filter((r) => deriveStatus(r.nextDueDate) === "Overdue").length;
    const pendingCount    = maintenance.filter((r) => deriveStatus(r.nextDueDate) === "Pending").length;
    const topSubject      = topAssets[0] ?? null;
    const subjectAsset    = topSubject ? assets.find((a) => (a.assetName ?? a.name ?? "") === topSubject.name) ?? assets[0] : assets[0];
    if (!subjectAsset && assets.length === 0) { setAiError("No assets found. Add assets to generate AI insights."); setLoading(false); return; }
    const subjectVal  = parseCost(subjectAsset?.currentValue ?? 0);
    const subjectCost = topSubject?.totalCost ?? Math.round(subjectVal * 0.3);
    const payload = {
      assetName:       `${subjectAsset?.assetName ?? "Top Asset"} [Fleet: ${assets.length} assets, $${totalCost.toLocaleString()} total maint cost, ${overdueCount} overdue, ${pendingCount} pending, ${activeCount} active, ${underMaintCount} under maintenance]`,
      assetType:       subjectAsset?.assetType ?? subjectAsset?.type ?? "General",
      purchaseCost:    parseCost(subjectAsset?.purchaseCost ?? subjectAsset?.currentValue ?? 0),
      currentValue:    subjectVal,
      usefulLifeYears: Number(subjectAsset?.usefulLifeYears) || 5,
      maintenanceCost: subjectCost,
    };
    try {
      const response = await api.post("/api/ai/recommendation", payload);
      const text = typeof response.data === "string" ? response.data : response.data?.recommendation ?? response.data?.result ?? response.data?.message ?? JSON.stringify(response.data);
      setAiText(text); runTypewriter(text);
    } catch (err) {
      if      (err.code === "ERR_NETWORK")       setAiError("Cannot reach backend — is Spring Boot running on port 8080?");
      else if (err.response?.status === 404)     setAiError("Endpoint not found — check /api/ai/recommendation in your backend.");
      else setAiError(err.response?.data?.message ?? err.message ?? "Request failed. Check console.");
    } finally { setLoading(false); }
  };

  const insightLines = useMemo(() => {
    if (!displayText) return [];
    return displayText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  }, [displayText]);

  return (
    <div className="rounded-2xl p-4 flex items-start gap-3 sm:gap-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#134e4a 100%)" }}>
      <div className="absolute -top-5 right-20 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(99,102,241,.45),transparent 70%)" }}/>
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(20,184,166,.35),transparent 70%)" }}/>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 14px rgba(129,140,248,.5)" }}>★</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-400 font-semibold tracking-widest uppercase mb-2">AI Analytics Insights</p>
        {loading && (
          <div className="flex items-center gap-3 rounded-xl p-2.5 border mb-2"
            style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.08)" }}>
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
            <span className="text-xs text-indigo-300">Analysing {assets.length} assets and {maintenance.length} maintenance records…</span>
          </div>
        )}
        {aiError && !loading && (
          <div className="flex gap-2 items-start rounded-xl p-2.5 text-xs border mb-2"
            style={{ background: "rgba(239,68,68,.12)", borderColor: "rgba(239,68,68,.25)", color: "#fca5a5" }}>
            <span className="flex-shrink-0">⚠️</span><span>{aiError}</span>
          </div>
        )}
        {insightLines.length > 0 && (
          <div className="flex flex-col gap-2">
            {insightLines.map((text, i) => (
              <div key={i} className="flex gap-2 items-start rounded-xl p-2.5 text-xs text-indigo-200 leading-relaxed border"
                style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.08)" }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }}/>
                {text}
                {!done && i === insightLines.length - 1 && <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse"/>}
              </div>
            ))}
          </div>
        )}
        {(done || aiError) && !loading && (
          <button onClick={generateInsights}
            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(99,102,241,.25)", color: "#a5b4fc", border: "1px solid rgba(129,140,248,.3)" }}>
            🔄 Regenerate Insights
          </button>
        )}
      </div>
      <span className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 border mt-0.5 hidden sm:inline-flex"
        style={{ background: "rgba(99,102,241,.25)", color: "#a5b4fc", borderColor: "rgba(129,140,248,.3)" }}>
        {loading ? "Analysing…" : done ? `${insightLines.length} Insights` : aiError ? "Error" : "AI ✓"}
      </span>
    </div>
  );
}

function UnderperformingCard({ items }) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden lg:w-56 flex-shrink-0"
      style={{ borderColor: "rgba(239,68,68,.15)", boxShadow: "0 2px 14px rgba(239,68,68,.07)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "rgba(239,68,68,.1)", background: "linear-gradient(90deg,#fef2f2,#fff)" }}>
        <span>⚠️</span><span className="text-xs font-bold text-red-700">Underperforming</span>
      </div>
      {items.length === 0
        ? <p className="text-xs text-slate-400 text-center py-6">No data</p>
        : items.map((item) => (
          <div key={item.name} className="px-4 py-2.5 border-b border-red-50 hover:bg-red-50/30 transition-colors cursor-pointer last:border-b-0">
            <p className="text-xs font-semibold text-indigo-950 truncate">{item.name}</p>
            <p className="text-xs text-red-600 font-semibold mt-0.5">{fmt(item.totalCost)} maintenance</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.ratio} of asset value</p>
            <div className="h-1 bg-red-100 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(item.ratioPct, 100)}%`, background: "linear-gradient(90deg,#f87171,#fca5a5)" }}/>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REPORTS — main page
// ─────────────────────────────────────────────────────────────
function Reports() {
  const [assets,      setAssets]      = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [dateFilter,  setDateFilter]  = useState("");
  const [csvLoading,  setCsvLoading]  = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);

  const assetMap = useMemo(() => {
    const map = {};
    assets.forEach((a) => { if (a.id != null) map[a.id] = a.assetName ?? a.name ?? `Asset #${a.id}`; });
    return map;
  }, [assets]);

  const fetchAll = () => {
    setLoading(true); setError(null);
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setAssets(a.data); setMaintenance(m.data); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchAll(); }, []);

  const filteredMaint = useMemo(() =>
    !dateFilter ? maintenance : maintenance.filter((r) => (r.maintenanceDate ?? "").startsWith(dateFilter)),
    [maintenance, dateFilter]
  );

  const kpiCards = useMemo(() => {
    const total = assets.length, under = assets.filter((a) => (a.status ?? "").toLowerCase() === "maintenance").length;
    const tmc = maintenance.reduce((s, r) => s + parseCost(r.cost), 0);
    const va  = assets.filter((a) => parseCost(a.currentValue) > 0);
    const avg = va.length > 0 ? Math.round(va.reduce((s, a) => s + parseCost(a.currentValue), 0) / va.length) : 0;
    return [
      { label: "Total Assets",      value: total.toLocaleString(),   sub: `${total} records in DB`,       icon: "🗂️", trend: "Live",          ok: true,  accent: "from-indigo-500 to-indigo-400", iconBg: "from-indigo-50 to-indigo-100" },
      { label: "Maintenance Cost",  value: fmt(tmc),                 sub: "All maintenance records",      icon: "💸", trend: "Total",         ok: false, accent: "from-purple-500 to-purple-400", iconBg: "from-purple-50 to-purple-100" },
      { label: "Avg Asset Value",   value: avg > 0 ? fmt(avg) : "—", sub: "Per asset average",            icon: "📈", trend: "Avg",           ok: true,  accent: "from-teal-400 to-emerald-400",  iconBg: "from-teal-50 to-emerald-100"  },
      { label: "Under Maintenance", value: String(under),            sub: `${total > 0 ? ((under/total)*100).toFixed(1) : 0}% of fleet`, icon: "🔧", trend: `${under} active`, ok: false, accent: "from-amber-400 to-yellow-300", iconBg: "from-amber-50 to-yellow-100" },
    ];
  }, [assets, maintenance]);

  const costTrend = useMemo(() => {
    const map = {};
    filteredMaint.forEach((r) => {
      if (!r.maintenanceDate) return;
      const k = new Date(r.maintenanceDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      map[k] = (map[k] ?? 0) + parseCost(r.cost);
    });
    return Object.entries(map).sort((a, b) => new Date("1 " + a[0]) - new Date("1 " + b[0])).map(([month, cost]) => ({ month, cost }));
  }, [filteredMaint]);

  const { assetTypeCounts } = useMemo(() => {
    const map = {};
    assets.forEach((a) => { const t = a.assetType ?? "Other"; map[t] = (map[t] ?? 0) + 1; });
    return { assetTypeCounts: Object.entries(map).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count) };
  }, [assets]);

  const deptValues = useMemo(() => {
    const map = {};
    assets.forEach((a) => { const d = a.department ?? a.location ?? "Other"; map[d] = (map[d] ?? 0) + 1; });
    return Object.entries(map).map(([dept, value]) => ({ dept, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [assets]);

  const topAssets = useMemo(() => {
    const cm = {};
    filteredMaint.forEach((r) => {
      const key = resolveAssetName(r, assetMap);
      cm[key] = (cm[key] ?? 0) + parseCost(r.cost);
    });
    return Object.entries(cm).map(([name, totalCost]) => {
      const asset = assets.find((a) => (a.assetName ?? a.name ?? "") === name);
      const av    = parseCost(asset?.currentValue ?? 0);
      const rp    = av > 0 ? (totalCost / av) * 100 : 0;
      return { name, totalCost, assetValue: av, ratio: av > 0 ? `${rp.toFixed(1)}%` : "—", ratioPct: rp, status: asset?.status ?? "Unknown", level: rp >= 60 ? "high" : rp >= 30 ? "medium" : "ok" };
    }).sort((a, b) => b.totalCost - a.totalCost).slice(0, 6);
  }, [filteredMaint, assets, assetMap]);

  const underperforming = useMemo(() => topAssets.filter((a) => a.ratioPct >= 40).slice(0, 4), [topAssets]);

  // FIX 3: assetMap passed to buildNotifications → real names in bell
  const notifications = useMemo(
    () => buildNotifications(assets, maintenance, assetMap),
    [assets, maintenance, assetMap]
  );

  const handleCSV = () => {
    setCsvLoading(true);
    setTimeout(() => { try { downloadCSV(assets, maintenance); } catch (e) { console.error(e); alert("CSV export failed."); } finally { setCsvLoading(false); } }, 100);
  };
  const handlePDF = () => {
    setPdfLoading(true);
    setTimeout(() => { try { downloadPDF(assets, maintenance, kpiCards); } catch (e) { console.error(e); alert("PDF export failed."); } finally { setPdfLoading(false); } }, 100);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-indigo-950 tracking-tight">Reports & Analytics</h1>
          <p className="text-xs text-slate-400 mt-0.5">Analyze asset performance and maintenance trends</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="month" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-indigo-100 rounded-xl text-xs bg-white text-slate-600 outline-none focus:border-indigo-300"/>
          {dateFilter && <button onClick={() => setDateFilter("")} className="text-xs text-slate-400 hover:text-indigo-500 underline">Clear</button>}
          <button onClick={handlePDF} disabled={loading || pdfLoading}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105 hover:shadow-xl disabled:opacity-60"
            style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 15px rgba(79,70,229,.35)" }}>
            {pdfLoading ? <><span className="animate-spin">⟳</span><span className="hidden sm:inline"> Preparing…</span></> : <>⬇ <span className="hidden sm:inline">Download Report</span><span className="sm:hidden">Download</span></>}
          </button>
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-20 text-indigo-400 text-sm gap-2"><span className="animate-spin text-lg">⟳</span> Loading analytics data…</div>}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-red-100/60 border-b border-red-200">
            <span>⚠️</span>
            <span className="text-xs sm:text-sm font-semibold text-red-800 flex-1">
              {error.code === "ERR_NETWORK" ? "Network error — check Spring Boot and @CrossOrigin." : `Error ${error.response?.status ?? ""}: ${error.message}`}
            </span>
            <button onClick={fetchAll} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg flex-shrink-0"
              style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)" }}>↺ Retry</button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpiCards.map((card) => <KpiCard key={card.label} {...card}/>)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ChartCard title="Maintenance Cost Trend" subtitle={dateFilter || "All records"}><LineChartSVG costTrend={costTrend}/></ChartCard>
            <ChartCard title="Asset Type Distribution"><DonutChartSVG assetTypeCounts={assetTypeCounts} totalAssets={assets.length}/></ChartCard>
            <ChartCard title="Assets by Location / Dept." subtitle="Count"><BarChartCSS deptValues={deptValues}/></ChartCard>
          </div>

          <ReportsAiPanel assets={assets} maintenance={filteredMaint} topAssets={topAssets} underperforming={underperforming} assetTypeCounts={assetTypeCounts} costTrend={costTrend} kpiCards={kpiCards}/>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 bg-white rounded-2xl border border-indigo-50 overflow-hidden" style={{ boxShadow: "0 2px 14px rgba(79,70,229,.06)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50">
                <span className="text-sm font-bold text-indigo-950">Top Assets by Maintenance Cost</span>
                <span className="text-xs text-slate-400">Sorted by cost ↓</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
                      {[{l:"Asset Name",c:""},{l:"Maint. Cost",c:""},{l:"Asset Value",c:"hidden sm:table-cell"},{l:"Cost Ratio",c:"hidden md:table-cell"},{l:"Status",c:""}].map((h) => (
                        <th key={h.l} className={`px-3 sm:px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${h.c}`}>{h.l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topAssets.length > 0
                      ? topAssets.map((row, i) => <TableRow key={row.name} row={row} isEven={i % 2 !== 0}/>)
                      : <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">No maintenance records found.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <UnderperformingCard items={underperforming}/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-indigo-50 p-4 flex items-center gap-3 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer"
              style={{ boxShadow: "0 2px 10px rgba(79,70,229,.05)" }} onClick={pdfLoading ? undefined : handlePDF}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br from-red-50 to-rose-100 flex-shrink-0">📄</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-950">Download PDF Report</p>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Opens print dialog → Save as PDF</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handlePDF(); }} disabled={pdfLoading || loading}
                className="text-xs font-semibold text-white px-3 sm:px-4 py-2 rounded-lg hover:scale-105 transition-all flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed min-w-16 text-center"
                style={{ background: "linear-gradient(90deg,#f43f5e,#ec4899)", boxShadow: "0 3px 10px rgba(244,63,94,.3)" }}>
                {pdfLoading ? <span className="animate-spin inline-block">⟳</span> : "PDF ↓"}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-indigo-50 p-4 flex items-center gap-3 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer"
              style={{ boxShadow: "0 2px 10px rgba(79,70,229,.05)" }} onClick={csvLoading ? undefined : handleCSV}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br from-emerald-50 to-teal-100 flex-shrink-0">📊</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-indigo-950">Download CSV Data</p>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Downloads raw asset + maintenance data</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleCSV(); }} disabled={csvLoading || loading}
                className="text-xs font-semibold text-white px-3 sm:px-4 py-2 rounded-lg hover:scale-105 transition-all flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed min-w-16 text-center"
                style={{ background: "linear-gradient(90deg,#10b981,#14b8a6)", boxShadow: "0 3px 10px rgba(16,185,129,.3)" }}>
                {csvLoading ? <span className="animate-spin inline-block">⟳</span> : "CSV ↓"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assets,      setAssets]      = useState([]);
  const [records,     setRecords]     = useState([]);

  useEffect(() => {
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => { setAssets(a.data); setRecords(m.data); })
      .catch(() => {});
  }, []);

  const assetMap = useMemo(() => {
    const map = {};
    assets.forEach((a) => { if (a.id != null) map[a.id] = a.assetName ?? a.name ?? `Asset #${a.id}`; });
    return map;
  }, [assets]);

  const notifications = useMemo(
    () => buildNotifications(assets, records, assetMap),
    [assets, records, assetMap]
  );

  return (
    <div className="flex min-h-screen" style={{ background: "linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}/>
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} notifications={notifications}/>
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <Reports/>
        </main>
      </div>
    </div>
  );
}