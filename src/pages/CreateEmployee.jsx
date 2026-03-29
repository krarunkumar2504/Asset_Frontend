// ═══════════════════════════════════════════════════════════════════════════
// CreateEmployee.jsx  —  UPDATED VERSION
// ═══════════════════════════════════════════════════════════════════════════
// CHANGES FROM PREVIOUS VERSION:
// • CREATE FORM: replaced old inline form with the +New Employee modal/panel
//   logic extracted from AdminEmployeeManagement.jsx (same UX, same API call)
// • ADMIN NAV: added all three admin nav items:
//     👤 Create Employee | 🏢 Manage Employees | 📜 Audit Logs
//   (matching AdminEmployeeManagement.jsx exactly)
// • NOTIFICATION MOBILE FIX: dropdown now uses left/right offsets on mobile
//   so it never overflows off-screen — matches the AdminEmployeeManagement fix
// • ROLE TITLE, DYNAMIC NAME, REAL NOTIFICATIONS: all retained from previous fix
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

// ─── Axios ────────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "https://assest-management-system.onrender.com/",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 8000,
});

// ─── Nav items (matching AdminEmployeeManagement.jsx exactly) ─────────────────
const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",   path: "/dashboard"   },
  { label: "Assets",      icon: "📦",  path: "/assets"      },
  { label: "Maintenance", icon: "🔧",  path: "/maintenance" },
  { label: "Reports",     icon: "📊",  path: "/reports"     },
];
const ADMIN_NAV_ITEMS = [
  { label: "Create Employee",  icon: "👤", path: "/create-employee"  },
  { label: "Manage Employees", icon: "🏢", path: "/admin/employees"  },
  { label: "Audit Logs",       icon: "📜", path: "/audit-logs"       },
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
function getPerformedBy() {
  const u = getStoredUser();
  return u.employeeName || u.name || u.email || "Admin";
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────
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
function empInitials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── NOTIFICATION DROPDOWN ────────────────────────────────────────────────────
// FIX: On mobile uses left:12/right:12 so it never clips off-screen.
//      On desktop uses right-anchored fixed positioning like AdminEmployeeManagement.
function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TS = {
    critical: { iconBg: "bg-red-100",    dot: "bg-red-500",    title: "text-red-700"    },
    warning:  { iconBg: "bg-amber-100",  dot: "bg-amber-500",  title: "text-amber-700"  },
    info:     { iconBg: "bg-indigo-100", dot: "bg-indigo-400", title: "text-indigo-700" },
  };

  const isMobile = window.innerWidth < 480;
  const topOffset = (anchorRect?.bottom ?? 60) + 8;

  // MOBILE FIX: span full width with margins instead of right-anchoring,
  // which caused the left half to be hidden off-screen on small devices.
  const style = isMobile
    ? {
        position: "fixed",
        top: topOffset,
        left: 12,
        right: 12,
        zIndex: 9999,
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(79,70,229,.22),0 4px 16px rgba(0,0,0,.12)",
        border: "1px solid rgba(79,70,229,.1)",
      }
    : {
        position: "fixed",
        top: topOffset,
        right: Math.max(8, window.innerWidth - (anchorRect?.right ?? 60)),
        width: 320,
        zIndex: 9999,
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(79,70,229,.22),0 4px 16px rgba(0,0,0,.12)",
        border: "1px solid rgba(79,70,229,.1)",
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
            : notifications.map(n => {
                const s = TS[n.type] ?? TS.info;
                return (
                  <div key={n.id}
                    className="flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-default">
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
              })}
        </div>
        <div className="px-4 py-2.5 border-t border-indigo-50 text-center">
          <span className="text-xs text-indigo-500 font-medium">
            {notifications.filter(n => n.type === "critical").length} critical · {notifications.length} total
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
// FIX: Now renders all three ADMIN_NAV_ITEMS (Create Employee, Manage Employees, Audit Logs)
function SidebarContent({ onNavigate }) {
  const navigate = useNavigate(), location = useLocation(), user = getStoredUser();
  const isAdmin = user.role === "Admin";
  const go = p => { navigate(p); onNavigate?.(); };

  const NavBtn = ({ item }) => {
    const on = location.pathname === item.path ||
      (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
    return (
      <button onClick={() => go(item.path)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 relative
          ${on ? "text-white" : "text-indigo-300 hover:text-indigo-100 hover:bg-white/5"}`}
        style={on ? {
          background: "linear-gradient(90deg,rgba(99,102,241,.5),rgba(20,184,166,.3))",
          boxShadow: "0 0 20px rgba(99,102,241,.3)",
        } : {}}>
        {on && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full"
            style={{ background: "linear-gradient(180deg,#818cf8,#34d399)" }} />
        )}
        <span className="text-sm w-4 text-center">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full py-6 px-3.5">
      <div className="flex items-center gap-2.5 px-2 mb-8 cursor-pointer" onClick={() => go("/dashboard")}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
        <div>
          <div className="text-white font-bold text-base tracking-tight">AssetAI</div>
          <div className="text-indigo-300 font-medium tracking-widest uppercase" style={{ fontSize: 9 }}>Management Suite</div>
        </div>
      </div>

      <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(i => <NavBtn key={i.label} item={i} />)}
      </nav>

      {/* FIX: All three admin nav items rendered */}
      {isAdmin && (
        <>
          <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mt-5 mb-2">Admin</p>
          <nav className="flex flex-col gap-1">
            {ADMIN_NAV_ITEMS.map(i => <NavBtn key={i.label} item={i} />)}
          </nav>
        </>
      )}

      <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: isAdmin ? "#34d399" : "#a5b4fc" }}>
          {user.role ?? "Employee"}
        </p>
        <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{getDisplayName(user)}</p>
        <p className="text-xs text-indigo-600 mt-0.5">v3.2.0 — Pro Plan</p>
      </div>
    </div>
  );
}

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

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ onMenuToggle, notifications }) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const bellRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const dName = getDisplayName(user);
  const ini = getUserInitials(user);
  const dashboardLabel = getDashboardLabel(user);
  const urgent = (notifications ?? []).filter(n => n.type === "critical" || n.type === "warning").length;

  const handleBell = () => {
    if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect());
    setNotifOpen(o => !o);
  };
  const logout = () => { localStorage.removeItem("user"); navigate("/"); };

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
        <span className="text-xs text-indigo-300 font-normal hidden sm:inline"> / Create Employee</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">Create Employee</span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Admin Portal
      </div>

      <button ref={bellRef} onClick={handleBell}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0
          ${notifOpen ? "bg-indigo-100 border-indigo-200" : "border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {(notifications ?? []).length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{
              background: urgent > 0
                ? "linear-gradient(135deg,#f43f5e,#ec4899)"
                : "linear-gradient(135deg,#4f46e5,#9333ea)",
              fontSize: 9,
            }}>
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

      <div className="flex items-center gap-2 border border-indigo-100 rounded-full px-2 py-1 bg-white cursor-pointer flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "linear-gradient(135deg,#4f46e5,#14b8a6)" }}>{ini}</div>
        <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-20 truncate">{dName.split(" ")[0]}</span>
      </div>

      <button onClick={logout}
        className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors flex-shrink-0">
        <span className="hidden sm:inline">→ Logout</span><span className="sm:hidden">→</span>
      </button>
    </header>
  );
}

// ─── ACCESS DENIED ─────────────────────────────────────────────────────────────
function AccessDenied() {
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

// ─── CREATE EMPLOYEE CONTENT ──────────────────────────────────────────────────
// Taken from the +New Employee panel in AdminEmployeeManagement.jsx.
// Same form fields, same validation, same API call, same UX — rendered
// as a full page instead of a modal so it fits the standalone route.
function CreateEmployeeContent() {
  const navigate = useNavigate();

  const [departments,   setDepartments]   = useState([]);
  const [deptLoading,   setDeptLoading]   = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError,   setCreateError]   = useState("");
  const [successMsg,    setSuccessMsg]    = useState("");

  const [createForm, setCreateForm] = useState({
    employeeName: "",
    email:        "",
    password:     "",
    role:         "Employee",
    departmentId: "",
    joinedDate:   "",
  });

  useEffect(() => {
    api.get("/api/departments")
      .then(res => setDepartments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCreateError("Could not load departments."))
      .finally(() => setDeptLoading(false));
  }, []);

  const deptOptions = useMemo(() =>
    departments.map(d => ({ id: d.id, name: d.departmentName || d.department_name || `Dept #${d.id}` })),
  [departments]);

  const set = (k, v) => setCreateForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    setCreateError(""); setSuccessMsg("");
    const { employeeName, email, password, role, departmentId } = createForm;
    if (!employeeName.trim()) { setCreateError("Name is required.");                     return; }
    if (!email.trim())        { setCreateError("Email is required.");                    return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setCreateError("Invalid email address.");        return; }
    if (!password.trim())     { setCreateError("Password is required.");                 return; }
    if (password.length < 6)  { setCreateError("Password must be at least 6 characters."); return; }
    if (!role)                { setCreateError("Please select a role.");                 return; }
    if (!departmentId)        { setCreateError("Please select a department.");           return; }

    setCreateLoading(true);
    try {
      await api.post("/api/employees", {
        employeeName:  employeeName.trim(),
        employee_name: employeeName.trim(),
        email:         email.trim(),
        password,
        role,
        department: { id: Number(departmentId) },
        joinedDate: createForm.joinedDate || null,
      }, {
        headers: { "X-Performed-By": getPerformedBy() },
      });
      setSuccessMsg(`${employeeName.trim()} has been added to the system! 🎉`);
      setCreateForm({ employeeName: "", email: "", password: "", role: "Employee", departmentId: "", joinedDate: "" });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Create failed.";
      setCreateError(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto flex items-start justify-center">
      <div className="w-full max-w-lg">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-indigo-950 tracking-tight">Create Employee</h1>
          <p className="text-xs text-slate-400 mt-0.5">Admin Panel — Add a new employee to the system</p>
        </div>

        <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(79,70,229,.08)" }}>

          {/* Header */}
          <div className="px-6 py-4 border-b border-indigo-50 flex items-center justify-between flex-shrink-0"
            style={{ background: "linear-gradient(90deg,#f0f0ff,#f0fdfa)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 16px rgba(129,140,248,.4)" }}>
                👤
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-950">New Employee Details</p>
                <p className="text-xs text-indigo-400">All * fields required</p>
              </div>
            </div>
          </div>

          {/* Form body */}
          <div className="p-6 flex flex-col gap-4">

            {/* Success */}
            {successMsg && (
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                <span>✅</span><span>{successMsg}</span>
              </div>
            )}

            {/* Error */}
            {createError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                <span>⚠️</span>{createError}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input type="text" value={createForm.employeeName} placeholder="e.g. Priya Nair"
                onChange={e => set("employeeName", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
              <input type="email" value={createForm.email} placeholder="priya@company.com"
                onChange={e => set("email", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Password <span className="text-red-400">*</span>{" "}
                <span className="text-slate-300 normal-case font-normal">(min. 6 characters)</span>
              </label>
              <input type="password" value={createForm.password} placeholder="Min. 6 characters"
                onChange={e => set("password", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
            </div>

            {/* Role + Department */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Role <span className="text-red-400">*</span>
                </label>
                <select value={createForm.role} onChange={e => set("role", e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white transition-all">
                  <option value="Employee">Employee</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Department <span className="text-red-400">*</span>
                </label>
                <select value={createForm.departmentId} onChange={e => set("departmentId", e.target.value)}
                  disabled={deptLoading}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white transition-all disabled:opacity-60">
                  <option value="">{deptLoading ? "Loading…" : "Select…"}</option>
                  {deptOptions.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {/* Joined Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Joined Date</label>
              <input type="date" value={createForm.joinedDate} onChange={e => set("joinedDate", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all text-slate-700" />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => navigate("/dashboard")}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                ← Dashboard
              </button>
              <button onClick={handleCreate} disabled={createLoading || deptLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 14px rgba(79,70,229,.4)" }}>
                {createLoading
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating…</>
                  : "＋ Create Employee"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default function CreateEmployee() {
  const user    = getStoredUser();
  const isAdmin = user.role === "Admin";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifAssets, setNotifAssets] = useState([]);
  const [notifMaint,  setNotifMaint]  = useState([]);

  useEffect(() => {
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a, m]) => {
        setNotifAssets(Array.isArray(a.data) ? a.data : []);
        setNotifMaint(Array.isArray(m.data)  ? m.data  : []);
      })
      .catch(() => {});
  }, []);

  const assetMap = useMemo(() => {
    const m = {};
    notifAssets.forEach(a => { if (a.id != null) m[a.id] = a.assetName ?? a.asset_name ?? `Asset #${a.id}`; });
    return m;
  }, [notifAssets]);

  const notifications = useMemo(() =>
    buildNotifications(notifAssets, notifMaint, assetMap),
  [notifAssets, notifMaint, assetMap]);

  return (
    <div className="flex min-h-screen"
      style={{ background: "linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar
          onMenuToggle={() => setSidebarOpen(o => !o)}
          notifications={notifications}
        />
        {isAdmin ? <CreateEmployeeContent /> : <AccessDenied />}
      </div>
    </div>
  );
}