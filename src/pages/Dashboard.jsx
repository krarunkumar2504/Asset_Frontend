// ─────────────────────────────────────────────────────────────
// Dashboard.jsx — Updated Version
//
// CHANGES FROM PREVIOUS VERSION:
// 1. Stat cards redesigned to match AdminEmployeeManagement.jsx:
//    Full gradient backgrounds, glow shadows, radial shine overlays,
//    white decorative circle, large emoji icon, bold value, and
//    hover lift animation. All four cards have distinct color identities.
// 2. Admin sidebar now shows THREE items under "Admin":
//    - Create Employee  (/create-employee)
//    - Manage Employees (/admin/employees)
//    - Audit Logs       (/audit-logs)   ← NEW
// 3. All previous fixes retained.
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

// ─── Nav items ───────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",   path: "/dashboard"   },
  { label: "Assets",      icon: "📦",  path: "/assets"      },
  { label: "Maintenance", icon: "🔧",  path: "/maintenance" },
  { label: "Reports",     icon: "📊",  path: "/reports"     },
];

// Updated with Audit Logs entry
const ADMIN_NAV_ITEMS = [
  { label: "Create Employee",  icon: "👤", path: "/create-employee"  },
  { label: "Manage Employees", icon: "🏢", path: "/admin/employees"  },
  { label: "Audit Logs",       icon: "📜", path: "/audit-logs"       },
];

// ─── Helpers ────────────────────────────────────────────────
function parseCost(val) { if (val == null) return 0; return Number(String(val).replace(/[^0-9.]/g, "")) || 0; }
function fmtValue(n) { if (!n) return "$0"; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`; return `$${n.toLocaleString("en-US")}`; }
function getStoredUser() { try { return JSON.parse(localStorage.getItem("user")) ?? {}; } catch { return {}; } }
function getDisplayName(u) { if (u.employeeName?.trim()) return u.employeeName.trim(); if (u.name?.trim()) return u.name.trim(); if (u.email?.trim()) return u.email.split("@")[0]; return "User"; }
function getUserInitials(u) { return getDisplayName(u).split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)||"U"; }
function deriveStatus(dt) { if (!dt) return "Completed"; const d=(new Date(dt)-new Date())/86400000; return d<0?"Overdue":d<=60?"Pending":"Completed"; }
function getDashboardLabel(u) { const r=(u.role??"").trim(); return r?`${r} Dashboard`:"Dashboard"; }

function resolveNotifAssetName(rec, map) {
  if (rec.assetName?.trim()) return rec.assetName.trim();
  if (rec.assetId && map[rec.assetId]) return map[rec.assetId];
  return `Asset #${rec.assetId??"?"}`;
}

function buildNotifications(assets, maint, assetMap={}) {
  const n=[];
  maint.filter(r=>deriveStatus(r.nextDueDate)==="Overdue").slice(0,3).forEach(r=>{
    n.push({id:`ov-${r.id}`,type:"critical",icon:"🚨",title:"Overdue Maintenance",message:`${resolveNotifAssetName(r,assetMap)} — due on ${r.nextDueDate??"unknown date"}`,time:"Overdue"});
  });
  assets.filter(a=>(a.status??"").toLowerCase()==="maintenance").slice(0,2).forEach(a=>{
    n.push({id:`mt-${a.id}`,type:"warning",icon:"🔧",title:"Asset Under Maintenance",message:`${a.assetName??"Unknown asset"} is currently under maintenance`,time:"Active"});
  });
  const p=maint.filter(r=>deriveStatus(r.nextDueDate)==="Pending");
  if(p.length>0) n.push({id:"pend",type:"info",icon:"⏳",title:"Upcoming Maintenance",message:`${p.length} task${p.length>1?"s":""} due within 60 days`,time:"Upcoming"});
  const i=assets.filter(a=>(a.status??"").toLowerCase()==="inactive");
  if(i.length>0) n.push({id:"inact",type:"info",icon:"📦",title:"Inactive Assets",message:`${i.length} asset${i.length>1?"s are":" is"} inactive`,time:"Review"});
  n.push({id:"sys",type:"info",icon:"✅",title:"System Status",message:"All systems operational — data synced",time:"Now"});
  return n;
}

// ═══════════════════════════════════════════════════════════
// TOAST SYSTEM
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
        <button onClick={close} style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#64748b", flexShrink: 0, marginTop: 2 }}>✕</button>
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

// ─── Notification Dropdown ───────────────────────────────────
function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TS = {
    critical: { iconBg:"bg-red-100",    dot:"bg-red-500",    title:"text-red-700"    },
    warning:  { iconBg:"bg-amber-100",  dot:"bg-amber-500",  title:"text-amber-700"  },
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
          <span className="text-xs text-indigo-500 font-medium">{notifications.filter(n=>n.type==="critical").length} critical · {notifications.length} total</span>
        </div>
      </div>
    </>, document.body
  );
}

// ─── StatusBadge ────────────────────────────────────────────
function StatusBadge({ status }) {
  const S = { Active:"bg-emerald-50 text-emerald-700 border border-emerald-200", Inactive:"bg-slate-100 text-slate-500 border border-slate-200", Maintenance:"bg-amber-50 text-amber-700 border border-amber-200" };
  const D = { Active:"bg-emerald-500", Inactive:"bg-slate-400", Maintenance:"bg-amber-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${S[status]??"bg-gray-100 text-gray-600 border border-gray-200"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${D[status]??"bg-gray-400"}`} />
      {status ?? "Unknown"}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR — Updated with Audit Logs nav item
// ═══════════════════════════════════════════════════════════
function SidebarContent({ onNavigate }) {
  const navigate = useNavigate(), location = useLocation(), user = getStoredUser();
  const isAdmin = user.role === "Admin";
  const go = (p) => { navigate(p); if (onNavigate) onNavigate(); };
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
        <p className="text-xs text-indigo-600 mt-0.5">v3.2.0 — Pro Plan</p>
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

// ─── Navbar ──────────────────────────────────────────────────
function Navbar({ onMenuToggle, notifications }) {
  const navigate = useNavigate(), location = useLocation(), user = getStoredUser(), { toast } = useToast();
  const bellRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false), [anchorRect, setAnchorRect] = useState(null);
  const PT = { "/dashboard":"Dashboard","/assets":"Assets","/maintenance":"Maintenance","/reports":"Reports","/create-employee":"Create Employee","/admin/employees":"Manage Employees","/audit-logs":"Audit Logs" };
  const pageTitle = PT[location.pathname] ?? "Dashboard";
  const dashLabel = getDashboardLabel(user);
  const dName = getDisplayName(user), ini = getUserInitials(user);
  const handleBell = () => { if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect()); setNotifOpen(o=>!o); };
  const urgent = notifications.filter(n=>n.type==="critical"||n.type==="warning").length;
  const logout = () => { localStorage.removeItem("user"); toast.info("Signed Out","You have been logged out successfully."); setTimeout(()=>navigate("/"),600); };
  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b"
      style={{ background:"rgba(255,255,255,.85)", backdropFilter:"blur(12px)", borderColor:"rgba(79,70,229,.08)" }}>
      <button onClick={onMenuToggle} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
        <span className="flex flex-col gap-1 w-4"><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /><span className="block h-0.5 bg-current rounded-full" /></span>
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-indigo-950 hidden sm:inline">{dashLabel}</span>
        <span className="text-xs text-indigo-300 font-normal hidden sm:inline"> / {pageTitle}</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">{pageTitle}</span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> All systems operational
      </div>
      <button ref={bellRef} onClick={handleBell}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0 ${notifOpen?"bg-indigo-100 border-indigo-200":"border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{ background:urgent>0?"linear-gradient(135deg,#f43f5e,#ec4899)":"linear-gradient(135deg,#4f46e5,#9333ea)", fontSize:9 }}>
            {notifications.length>9?"9+":notifications.length}
          </span>
        )}
      </button>
      {notifOpen && <NotificationDropdown notifications={notifications} anchorRect={anchorRect} onClose={()=>setNotifOpen(false)} />}
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
// REDESIGNED STAT CARD — matches AdminEmployeeManagement.jsx
// Full gradient background, radial shine, decorative circle,
// large emoji, bold 3xl number, uppercase label, glow shadow.
// ═══════════════════════════════════════════════════════════
function StatCard({ label, value, sub, icon, trend, gradient, glowColor, route }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => route && navigate(route)}
      className="relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{ background: gradient, boxShadow: `0 4px 24px ${glowColor}` }}>
      {/* Radial shine overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle at top right, white, transparent 60%)" }} />
      {/* Decorative background circle */}
      <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10 pointer-events-none"
        style={{ background: "white" }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
            {trend}
          </span>
        </div>
        <p className="text-3xl font-black text-white tracking-tight leading-none">{value}</p>
        <p className="text-xs font-semibold text-white/70 uppercase tracking-widest mt-1">{label}</p>
        <p className="text-xs text-white/50 mt-1">{sub}</p>
      </div>
    </div>
  );
}

function TableRow({ asset, isEven }) {
  return (
    <tr className={`hover:bg-indigo-50/50 transition-colors ${isEven?"bg-slate-50/60":""}`}>
      <td className="px-4 sm:px-5 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{asset.assetName??asset.name??"—"}</td>
      <td className="px-4 sm:px-5 py-3 hidden sm:table-cell"><span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">{asset.assetType??asset.type??"—"}</span></td>
      <td className="px-4 sm:px-5 py-3"><StatusBadge status={asset.status??"Unknown"} /></td>
      <td className="px-4 sm:px-5 py-3 text-xs text-slate-400 hidden md:table-cell">{asset.location??"—"}</td>
    </tr>
  );
}

function QuickActions() {
  const navigate = useNavigate(), user = getStoredUser(), isAdmin = user.role === "Admin";
  return (
    <div className="bg-white rounded-2xl p-4 border border-indigo-50" style={{ boxShadow:"0 2px 12px rgba(79,70,229,.06)" }}>
      <p className="text-sm font-bold text-indigo-950 mb-3">Quick Actions</p>
      <button onClick={()=>navigate("/assets")} className="w-full py-2.5 mb-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background:"linear-gradient(90deg,#4f46e5,#7c3aed)", boxShadow:"0 4px 14px rgba(79,70,229,.35)" }}>+ Add Asset</button>
      <button onClick={()=>navigate("/maintenance")} className="w-full py-2.5 mb-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background:"linear-gradient(90deg,#0d9488,#14b8a6)", boxShadow:"0 4px 14px rgba(20,184,166,.35)" }}>🔧 Schedule Maintenance</button>
      {isAdmin && (
        <>
          <button onClick={()=>navigate("/create-employee")} className="w-full py-2.5 mb-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background:"linear-gradient(90deg,#7c3aed,#ec4899)", boxShadow:"0 4px 14px rgba(147,51,234,.35)" }}>👤 Create Employee</button>
          <button onClick={()=>navigate("/admin/employees")} className="w-full py-2.5 mb-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background:"linear-gradient(90deg,#0369a1,#0891b2)", boxShadow:"0 4px 14px rgba(3,105,161,.35)" }}>🏢 Manage Employees</button>
          <button onClick={()=>navigate("/audit-logs")} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5" style={{ background:"linear-gradient(90deg,#4f46e5,#6366f1)", boxShadow:"0 4px 14px rgba(79,70,229,.35)" }}>📜 Audit Logs</button>
        </>
      )}
    </div>
  );
}

function AiInsights({ staticInsights, healthScore, assets, maintenance }) {
  const { toast } = useToast();
  const [aiResult, setAiResult] = useState(""), [loading, setLoading] = useState(false), [aiError, setAiError] = useState("");
  const [displayText, setDisplayText] = useState(""), [showAi, setShowAi] = useState(false), [selectedAsset, setSelectedAsset] = useState(null);
  useEffect(() => { if (assets.length > 0 && !selectedAsset) setSelectedAsset(assets[0]); }, [assets]);
  const twRef = useRef(null);
  const typewrite = useCallback(txt => {
    setDisplayText(""); let i = 0; clearInterval(twRef.current);
    twRef.current = setInterval(() => { i++; setDisplayText(txt.slice(0,i)); if(i>=txt.length) clearInterval(twRef.current); }, 20);
  }, []);
  useEffect(() => () => clearInterval(twRef.current), []);
  const decision = useMemo(() => {
    if (!aiResult) return null;
    const t = aiResult.toLowerCase();
    if (t.includes("replace")) return { icon:"⚠️", label:"Replace Recommended", color:"#ef4444", bg:"rgba(239,68,68,.12)", border:"rgba(239,68,68,.3)", textColor:"#fca5a5" };
    if (t.includes("repair"))  return { icon:"✔️", label:"Repair Recommended",  color:"#10b981", bg:"rgba(16,185,129,.12)", border:"rgba(16,185,129,.3)", textColor:"#6ee7b7" };
    return null;
  }, [aiResult]);
  const risk = useMemo(() => {
    if (healthScore >= 70) return { label:"Low Risk",    color:"#34d399", bg:"rgba(52,211,153,.15)", border:"rgba(52,211,153,.3)", glow:"0 0 10px rgba(52,211,153,.4)" };
    if (healthScore >= 40) return { label:"Medium Risk", color:"#fbbf24", bg:"rgba(251,191,36,.15)", border:"rgba(251,191,36,.3)", glow:"0 0 10px rgba(251,191,36,.4)" };
    return { label:"High Risk", color:"#f87171", bg:"rgba(248,113,113,.15)", border:"rgba(248,113,113,.3)", glow:"0 0 10px rgba(248,113,113,.4)" };
  }, [healthScore]);
  const gen = async (asset) => {
    if (!asset) { setAiError("Please select an asset first."); return; }
    setLoading(true); setAiError(""); setAiResult(""); setDisplayText(""); setShowAi(false);
    try {
      const name = asset.assetName ?? asset.name ?? "";
      const rc = maintenance.filter(r => { const nm=(r.assetName??"").toLowerCase()===name.toLowerCase(); const id=r.assetId!==undefined&&r.assetId===asset.id; return nm||id; }).reduce((s,r)=>s+parseCost(r.cost),0);
      const cv = parseCost(asset.currentValue??0), mc = rc>0?rc:Math.round(cv*.3);
      const pl = { assetName:name||"Unknown Asset", assetType:asset.assetType??asset.type??"General", purchaseCost:parseCost(asset.purchaseCost??asset.currentValue??0), currentValue:cv, usefulLifeYears:Number(asset.usefulLifeYears)||5, maintenanceCost:mc };
      const r = await api.post("/api/ai/recommendation", pl);
      const txt = typeof r.data==="string"?r.data:r.data?.recommendation??r.data?.result??r.data?.message??JSON.stringify(r.data);
      setAiResult(txt); setShowAi(true); typewrite(txt);
      toast.success("AI Analysis Complete", `Recommendation ready for ${name||"selected asset"}.`);
    } catch (err) {
      const m = err.code==="ERR_NETWORK"?"Cannot reach server. Check your backend connection.":err.response?.status===404?"AI endpoint not found — check /api/ai/recommendation.":err.response?.data?.message??err.message??"Request failed.";
      setAiError(m); toast.error("AI Analysis Failed", m);
    } finally { setLoading(false); }
  };
  const reset = () => { clearInterval(twRef.current); setAiResult(""); setDisplayText(""); setAiError(""); setShowAi(false); };
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 65%,#134e4a 100%)" }}>
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none" style={{ background:"radial-gradient(circle,rgba(99,102,241,.5),transparent 70%)" }} />
      <div className="absolute -bottom-5 -left-5 w-24 h-24 rounded-full pointer-events-none" style={{ background:"radial-gradient(circle,rgba(20,184,166,.4),transparent 70%)" }} />
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background:"linear-gradient(135deg,#818cf8,#34d399)", boxShadow:"0 0 14px rgba(129,140,248,.6)" }}>★</div>
        <span className="text-sm font-bold text-white">AI Intelligence</span>
        <span className="font-semibold tracking-widest uppercase rounded-full px-2 py-0.5 border" style={{ background:showAi?"rgba(52,211,153,.2)":"rgba(52,211,153,.12)", color:"#6ee7b7", borderColor:"rgba(52,211,153,.3)", fontSize:9 }}>{showAi?"AI ✓":"Live"}</span>
        <span className="ml-auto font-bold rounded-full px-2 py-0.5 border" style={{ background:risk.bg, color:risk.color, borderColor:risk.border, fontSize:9, boxShadow:risk.glow }}>{risk.label}</span>
      </div>
      {assets.length > 0 && (
        <div className="mb-3 relative z-10">
          <label className="block text-xs text-indigo-400 font-semibold mb-1 uppercase tracking-wider">Analyse asset</label>
          <select value={selectedAsset?.id??""} onChange={e=>{ const p=assets.find(a=>String(a.id)===e.target.value); setSelectedAsset(p??null); reset(); }}
            className="w-full text-xs rounded-xl px-3 py-2 outline-none font-medium"
            style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.18)", color:"#e0e7ff" }}>
            {assets.map(a=><option key={a.id} value={a.id} style={{ background:"#312e81", color:"#e0e7ff" }}>{a.assetName??a.name??`Asset #${a.id}`}{a.assetType?` — ${a.assetType}`:""}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2 mb-3 relative z-10">
        {!showAi && !loading && staticInsights.map((t,i)=>(
          <div key={i} className="flex gap-2 items-start rounded-xl p-2.5 text-indigo-200 text-xs leading-relaxed border" style={{ background:"rgba(255,255,255,.06)", borderColor:"rgba(255,255,255,.08)" }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background:"linear-gradient(135deg,#818cf8,#34d399)" }} />{t}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 rounded-xl p-3 border" style={{ background:"rgba(255,255,255,.06)", borderColor:"rgba(255,255,255,.08)" }}>
            <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs text-indigo-300">Analysing {selectedAsset?.assetName??"asset"}…</span>
          </div>
        )}
        {showAi && !loading && (
          <div className="rounded-xl p-3 border" style={{ background:"rgba(255,255,255,.08)", borderColor:"rgba(255,255,255,.14)" }}>
            <p className="text-xs text-indigo-400 font-semibold mb-1.5 uppercase tracking-wide">{selectedAsset?.assetName??"Asset"} · {selectedAsset?.assetType??""}</p>
            <p className="text-xs text-indigo-100 leading-relaxed whitespace-pre-wrap">
              {displayText}{displayText.length<aiResult.length&&<span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse" />}
            </p>
          </div>
        )}
        {aiError && (
          <div className="flex gap-2 items-start rounded-xl p-2.5 text-xs border" style={{ background:"rgba(239,68,68,.12)", borderColor:"rgba(239,68,68,.25)", color:"#fca5a5" }}>
            <span className="flex-shrink-0">⚠️</span><span>{aiError}</span>
          </div>
        )}
      </div>
      {decision && !loading && (
        <div className="rounded-xl p-3 mb-3 border relative z-10" style={{ background:decision.bg, borderColor:decision.border }}>
          <div className="flex items-center gap-2">
            <span className="text-base">{decision.icon}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color:decision.color }}>Recommendation</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color:decision.textColor }}>{decision.label}</p>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-xl p-2.5 mb-3 relative z-10" style={{ background:"rgba(255,255,255,.05)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400 font-medium">Asset Health Score</span>
          <span className="text-xs text-indigo-300 font-bold">{healthScore}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,.1)" }}>
          <div className="h-full rounded-full" style={{ width:`${healthScore}%`, background:"linear-gradient(90deg,#818cf8,#34d399)", transition:"width 1.2s cubic-bezier(.4,0,.2,1)", boxShadow:"0 0 8px rgba(129,140,248,.5)" }} />
        </div>
      </div>
      <button onClick={()=>gen(selectedAsset)} disabled={loading||!selectedAsset}
        className="w-full px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 relative z-10 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background:loading?"rgba(99,102,241,.4)":"linear-gradient(90deg,#4f46e5,#9333ea)", boxShadow:loading?"none":"0 4px 14px rgba(79,70,229,.4)" }}>
        {loading?<><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>:<>🤖 Generate AI Insight</>}
      </button>
      {showAi&&!loading&&<button onClick={reset} className="w-full text-center text-xs text-indigo-400 hover:text-indigo-200 mt-2 transition-colors relative z-10">↺ Reset to default insights</button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD CONTENT
// ═══════════════════════════════════════════════════════════
function DashboardContent({ assets, maintenance, loading, error, onRetry }) {
  const navigate = useNavigate(), { toast } = useToast();
  const [viewMode, setViewMode] = useState("table");

  // ── Redesigned cards data with gradient + glow ──────────
  const cards = useMemo(() => {
    const tot=assets.length, act=assets.filter(a=>(a.status??"").toLowerCase()==="active").length, mc=assets.filter(a=>(a.status??"").toLowerCase()==="maintenance").length;
    const tv=assets.reduce((s,a)=>s+parseCost(a.currentValue??a.value),0), ar=tot>0?((act/tot)*100).toFixed(1):"0";
    return [
      {
        label: "Total Assets",    value: tot.toLocaleString(),
        sub: "Across all departments", icon: "🗂️",
        trend: `${tot} total`,
        gradient: "linear-gradient(135deg,#4f46e5,#7c3aed)",
        glowColor: "rgba(79,70,229,.25)",
        route: "/assets",
      },
      {
        label: "Active Assets",   value: act.toLocaleString(),
        sub: `${ar}% utilization`, icon: "✅",
        trend: `↑ ${ar}%`,
        gradient: "linear-gradient(135deg,#059669,#0d9488)",
        glowColor: "rgba(5,150,105,.25)",
        route: "/assets",
      },
      {
        label: "Maintenance Due", value: mc.toLocaleString(),
        sub: mc > 0 ? "Requires attention" : "All clear", icon: "🔧",
        trend: mc > 0 ? "⚠ Due" : "✓ Clear",
        gradient: mc > 0
          ? "linear-gradient(135deg,#d97706,#f97316)"
          : "linear-gradient(135deg,#059669,#0d9488)",
        glowColor: mc > 0 ? "rgba(217,119,6,.25)" : "rgba(5,150,105,.2)",
        route: "/maintenance",
      },
      {
        label: "Total Value",     value: fmtValue(tv),
        sub: `${tot} assets tracked`, icon: "💰",
        trend: "Live",
        gradient: "linear-gradient(135deg,#7c3aed,#ec4899)",
        glowColor: "rgba(124,58,237,.25)",
        route: "/reports",
      },
    ];
  }, [assets]);

  const recent = useMemo(() => assets.slice(0, 6), [assets]);

  const { staticInsights, healthScore } = useMemo(() => {
    const tot=assets.length, act=assets.filter(a=>(a.status??"").toLowerCase()==="active").length,
      im=assets.filter(a=>(a.status??"").toLowerCase()==="maintenance").length,
      ia=assets.filter(a=>(a.status??"").toLowerCase()==="inactive").length;
    const sc=tot>0?Math.round((act/tot)*100):0;
    const ts=maintenance.reduce((s,r)=>s+parseCost(r.cost),0);
    const ln=[];
    if(tot>0) ln.push(`Fleet has ${tot} assets — ${act} active, ${im} in maintenance, ${ia} inactive.`);
    if(im>0)  ln.push(`${im} asset${im>1?"s require":" requires"} maintenance — visit the Maintenance page.`);
    if(ts>0)  ln.push(`Total maintenance spend: $${ts.toLocaleString("en-US")} across all records.`);
    if(ln.length===0) ln.push("Connect your backend to see real-time insights.");
    return { staticInsights:ln, healthScore:sc };
  }, [assets, maintenance]);

  const loadShown = useRef(false);
  useEffect(() => {
    if (!loading && !error && assets.length > 0 && !loadShown.current) {
      loadShown.current = true;
      toast.success("Dashboard Ready", `${assets.length} asset${assets.length!==1?"s":""} loaded and synced successfully.`);
    }
  }, [loading, error, assets.length]);

  useEffect(() => {
    if (!loading && error) {
      const m = error.code==="ERR_NETWORK"?"Cannot reach the server. Please check your backend connection.":`Server error ${error.response?.status??""}:  ${error.message}`;
      toast.error("Failed to Load Data", m);
    }
  }, [loading, error]);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-indigo-400 text-sm gap-2">
      <span className="animate-spin text-lg">⟳</span> Loading dashboard data…
    </div>
  );

  if (error) return (
    <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 bg-red-100/60 border-b border-red-200">
        <span>⚠️</span>
        <span className="text-xs sm:text-sm font-semibold text-red-800 flex-1">
          {error.code==="ERR_NETWORK"?"Network error — check Spring Boot and @CrossOrigin.":`Error ${error.response?.status??""}:  ${error.message}`}
        </span>
        <button onClick={onRetry} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background:"linear-gradient(90deg,#4f46e5,#9333ea)" }}>↺ Retry</button>
      </div>
      <div className="px-4 sm:px-5 py-4 text-xs text-red-600">
        <p>Add to your Spring Boot controllers:</p>
        <code className="bg-red-100 px-2 py-1 rounded block w-fit mt-1">@CrossOrigin(origins = "http://localhost:3000")</code>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Stat Cards — redesigned ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            sub={c.sub}
            icon={c.icon}
            trend={c.trend}
            gradient={c.gradient}
            glowColor={c.glowColor}
            route={c.route}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Asset table / cards */}
        <div className="flex-1 bg-white rounded-2xl border border-indigo-50 overflow-hidden" style={{ boxShadow:"0 2px 12px rgba(79,70,229,.06)" }}>
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-indigo-50/80">
            <span className="text-sm font-bold text-indigo-950">Recent Assets</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-indigo-50 rounded-lg p-0.5 border border-indigo-100">
                <button onClick={()=>setViewMode("table")} className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${viewMode==="table"?"bg-white text-indigo-700 shadow-sm":"text-indigo-400 hover:text-indigo-600"}`}>☰ Table</button>
                <button onClick={()=>setViewMode("cards")} className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${viewMode==="cards"?"bg-white text-indigo-700 shadow-sm":"text-indigo-400 hover:text-indigo-600"}`}>⊞ Cards</button>
              </div>
              <button onClick={()=>navigate("/assets")} className="text-xs text-indigo-500 font-medium hover:underline whitespace-nowrap">View all →</button>
            </div>
          </div>

          {viewMode === "table" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
                    {[{l:"Asset Name",c:""},{l:"Type",c:"hidden sm:table-cell"},{l:"Status",c:""},{l:"Location",c:"hidden md:table-cell"}].map(h=>(
                      <th key={h.l} className={`px-4 sm:px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider ${h.c}`}>{h.l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.length>0
                    ?recent.map((a,i)=><TableRow key={a.id??i} asset={a} isEven={i%2!==0} />)
                    :<tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">No assets found.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          )}

          {viewMode === "cards" && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.length>0
                ?recent.map((a,i)=>(
                    <div key={a.id??i} className="border border-indigo-50 rounded-xl p-3 hover:shadow-md hover:border-indigo-100 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{a.assetName??a.name??"—"}</p>
                        <StatusBadge status={a.status??"Unknown"} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {(a.assetType??a.type)&&<span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-medium">{a.assetType??a.type}</span>}
                        {a.location&&<span>📍 {a.location}</span>}
                      </div>
                    </div>
                  ))
                :<p className="col-span-2 text-center text-sm text-slate-400 py-8">No assets found.</p>
              }
            </div>
          )}

          <div className="px-4 sm:px-5 py-2.5 border-t border-indigo-50">
            <span className="text-xs text-slate-400">Showing {recent.length} of {assets.length} assets</span>
          </div>
        </div>

        {/* Sidebar widgets */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-4 w-full lg:w-56">
          <div className="flex-1 lg:flex-none"><QuickActions /></div>
          <div className="flex-1 lg:flex-none"><AiInsights staticInsights={staticInsights} healthScore={healthScore} assets={assets} maintenance={maintenance} /></div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Inner ──────────────────────────────────────────
function DashboardInner() {
  const [assets, setAssets] = useState([]), [maint, setMaint] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(null), [open, setOpen] = useState(false);
  const fetchData = () => {
    setLoading(true); setError(null);
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a,m])=>{ setAssets(a.data); setMaint(m.data); })
      .catch(e=>setError(e))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{ fetchData(); },[]);
  const assetMap = useMemo(()=>{ const m={}; assets.forEach(a=>{ if(a.id!=null) m[a.id]=a.assetName??a.name??`Asset #${a.id}`; }); return m; },[assets]);
  const notifs = useMemo(()=>buildNotifications(assets,maint,assetMap),[assets,maint,assetMap]);
  return (
    <div className="flex min-h-screen" style={{ background:"linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar mobileOpen={open} onClose={()=>setOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={()=>setOpen(o=>!o)} notifications={notifs} />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <DashboardContent assets={assets} maintenance={maint} loading={loading} error={error} onRetry={fetchData} />
        </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return <ToastProvider><DashboardInner /></ToastProvider>;
}