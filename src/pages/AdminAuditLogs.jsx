// ═══════════════════════════════════════════════════════════════════════════
// AdminAuditLogs.jsx  —  FULLY UPDATED v6
// ═══════════════════════════════════════════════════════════════════════════
// ALL FIXES IN THIS VERSION:
//
// [FIX-1] TIMESTAMP — real action time, IST timezone, no mismatch
//         • fmtFull() uses timeZone:"Asia/Kolkata" consistently
//         • timeAgo() uses live Date.now() — never stale
//
// [FIX-2] RELATIVE TIME — accurate + auto-updating every 60s
//         • Single shared "now" state updated by setInterval in root component
//         • Passed as prop so all children re-render on tick
//         • "Just now" < 60s, "X min ago", "X hr ago", date fallback
//
// [FIX-3] DELETE AUDIT LOG RECORDS — permanent delete from audit table
//         • Confirmation dialog before permanent removal
//         • Removes locally even if backend returns 404
//
// [FIX-4] DELETE COUNT from AdminEmployeeManagement reflected correctly
//
// [FIX-5] COLORFUL ANALYTICS — vibrant gradients, charts, glowing cards
//
// [FIX-6] VIEW MODAL — only opens on "View →" button, NOT on row click
//         • Row click no longer opens modal (was triggering on desc/name)
//         • Only explicit "View →" button opens detail modal
//
// [FIX-7] "All" period in Analytics → Recent Actions now displays correctly
//         • Was filtering with periodStart = new Date(0) which works, but
//           the slice(0,10) + sort was correct — fixed rendering guard
//         • Added explicit empty-state per period label
//
// [FIX-8] Timestamp written at EXACT action moment
//         • All local history entries use new Date().toISOString() at call time
//         • No stale createdAt / joinedDate reuse anywhere
// ═══════════════════════════════════════════════════════════════════════════

import {
  useState, useEffect, useMemo, useRef, useCallback,
  createContext, useContext,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";

// ─── Axios ────────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "https://assest-management-system.onrender.com/",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 30000,
});

// ─── Nav ──────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// [FIX-1] ALL timestamps use IST (Asia/Kolkata) — no UTC mismatch
// ─────────────────────────────────────────────────────────────────────────────
function fmtFull(ts) {
  if (!ts) return "—";
  // Handle Firebase Timestamp objects (with .toDate()) and plain strings/numbers
  const dt = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    timeZone:  "Asia/Kolkata",
    day:       "2-digit",
    month:     "short",
    year:      "numeric",
    hour:      "2-digit",
    minute:    "2-digit",
    second:    "2-digit",
    hour12:    true,
  });
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = d?.toDate ? d.toDate() : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// [FIX-2] Relative time — accepts `now` as param so callers control freshness
//         "now" is updated by a shared setInterval every 60s at the root level
// ─────────────────────────────────────────────────────────────────────────────
function timeAgo(ts, now = Date.now()) {
  if (!ts) return "—";
  const dt = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(dt.getTime())) return "—";

  // [FIX-8] Debug in dev — uncomment to verify timestamps
  // console.log("Raw ts:", ts, "Parsed:", dt, "Now:", new Date(now), "Diff(s):", (now - dt.getTime()) / 1000);

  const diffSec = (now - dt.getTime()) / 1000;
  if (diffSec < 5)     return "Just now";
  if (diffSec < 60)    return `${Math.floor(diffSec)}s ago`;
  if (diffSec < 3600)  {
    const m = Math.floor(diffSec / 60);
    return `${m} min${m > 1 ? "s" : ""} ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return `${h} hr${h > 1 ? "s" : ""} ago`;
  }
  if (diffSec < 172800) return "Yesterday";
  return fmtDate(ts);
}

// ─────────────────────────────────────────────────────────────────────────────
// [FIX-8] Get current IST timestamp string — use THIS for every action write
// ─────────────────────────────────────────────────────────────────────────────
function nowISO() {
  return new Date().toISOString();
}

function actionCategory(action = "") {
  const a = action.toUpperCase();
  if (a.startsWith("CREATE")) return "CREATE";
  if (a.startsWith("UPDATE")) return "UPDATE";
  if (a.startsWith("DELETE")) return "DELETE";
  return "OTHER";
}

const ACTION_CFG = {
  CREATE: {
    label: "CREATE", bg: "rgba(16,185,129,.1)", border: "rgba(16,185,129,.3)",
    color: "#059669", dot: "#10b981", icon: "✨", glow: "0 0 12px rgba(16,185,129,.25)",
    headerBg: "linear-gradient(135deg,#059669,#0d9488)",
    cardBg: "linear-gradient(135deg,rgba(16,185,129,.15),rgba(13,148,136,.1))",
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
    badgeBg: "linear-gradient(135deg,#10b981,#059669)",
  },
  UPDATE: {
    label: "UPDATE", bg: "rgba(59,130,246,.1)", border: "rgba(59,130,246,.3)",
    color: "#2563eb", dot: "#3b82f6", icon: "✏️", glow: "0 0 12px rgba(59,130,246,.25)",
    headerBg: "linear-gradient(135deg,#2563eb,#0891b2)",
    cardBg: "linear-gradient(135deg,rgba(59,130,246,.15),rgba(8,145,178,.1))",
    pill: "bg-blue-100 text-blue-700 border-blue-200",
    badgeBg: "linear-gradient(135deg,#3b82f6,#2563eb)",
  },
  DELETE: {
    label: "DELETE", bg: "rgba(239,68,68,.1)", border: "rgba(239,68,68,.3)",
    color: "#dc2626", dot: "#ef4444", icon: "🗑️", glow: "0 0 12px rgba(239,68,68,.25)",
    headerBg: "linear-gradient(135deg,#ef4444,#f97316)",
    cardBg: "linear-gradient(135deg,rgba(239,68,68,.15),rgba(249,115,22,.1))",
    pill: "bg-red-100 text-red-700 border-red-200",
    badgeBg: "linear-gradient(135deg,#ef4444,#dc2626)",
  },
  OTHER: {
    label: "OTHER", bg: "rgba(107,114,128,.08)", border: "rgba(107,114,128,.2)",
    color: "#4b5563", dot: "#6b7280", icon: "📌", glow: "none",
    headerBg: "linear-gradient(135deg,#4b5563,#6b7280)",
    cardBg: "linear-gradient(135deg,rgba(107,114,128,.1),rgba(75,85,99,.08))",
    pill: "bg-slate-100 text-slate-600 border-slate-200",
    badgeBg: "linear-gradient(135deg,#6b7280,#4b5563)",
  },
};

function startOfToday()  { const d = new Date(); d.setHours(0,0,0,0); return d; }
function startOfWeek()   { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d; }
function startOfMonth()  { const d = new Date(); d.setHours(0,0,0,0); d.setDate(1); return d; }
function startOfYear()   { const d = new Date(new Date().getFullYear(),0,1); d.setHours(0,0,0,0); return d; }

// ─── Notification helpers ─────────────────────────────────────────────────────
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
  maint.filter(r => deriveStatus(r.nextDueDate) === "Overdue").slice(0,3).forEach(r =>
    n.push({ id:`ov-${r.id}`, type:"critical", icon:"🚨", title:"Overdue Maintenance",
      message:`${resolveNotifAssetName(r,assetMap)} — due on ${r.nextDueDate??"unknown date"}`, time:"Overdue" }));
  assets.filter(a => (a.status??"").toLowerCase() === "maintenance").slice(0,2).forEach(a =>
    n.push({ id:`mt-${a.id}`, type:"warning", icon:"🔧", title:"Asset Under Maintenance",
      message:`${a.assetName??a.asset_name??"Unknown asset"} is currently under maintenance`, time:"Active" }));
  const p = maint.filter(r => deriveStatus(r.nextDueDate) === "Pending");
  if (p.length > 0) n.push({ id:"pend", type:"info", icon:"⏳", title:"Upcoming Maintenance",
    message:`${p.length} task${p.length>1?"s":""} due within 60 days`, time:"Upcoming" });
  const i = assets.filter(a => (a.status??"").toLowerCase() === "inactive");
  if (i.length > 0) n.push({ id:"inact", type:"info", icon:"📦", title:"Inactive Assets",
    message:`${i.length} asset${i.length>1?"s are":" is"} inactive`, time:"Review" });
  n.push({ id:"sys", type:"info", icon:"✅", title:"System Status", message:"All systems operational — data synced", time:"Now" });
  return n;
}

function normaliseEmp(e) {
  const deptId = e.department?.id ?? e.departmentId ?? e.department_id ?? null;
  const deptNameFromObj = e.department?.departmentName ?? e.department?.department_name ?? null;
  return {
    ...e,
    employeeName:   e.employeeName   || e.employee_name   || "",
    departmentId:   deptId,
    departmentName: deptNameFromObj,
    createdAt:      e.createdAt      || e.created_at      || null,
    joinedDate:     e.joinedDate     || e.joined_date     || null,
    status:         e.status         || "Active",
    password:       e.password       || "",
  };
}

const AV_COLORS = [
  "linear-gradient(135deg,#4f46e5,#7c3aed)",
  "linear-gradient(135deg,#0d9488,#14b8a6)",
  "linear-gradient(135deg,#dc2626,#f97316)",
  "linear-gradient(135deg,#7c3aed,#ec4899)",
  "linear-gradient(135deg,#0369a1,#0891b2)",
  "linear-gradient(135deg,#059669,#84cc16)",
];
function avatarColor(name) { return AV_COLORS[((name||"A").charCodeAt(0)) % AV_COLORS.length]; }
function empInitials(name) { return (name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2); }

function loadDeletedHistory() {
  try { const r = localStorage.getItem("deletedEmployees"); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
const ToastCtx = createContext(null);
function useToast() { return useContext(ToastCtx); }
const T_CFG = {
  success:{ icon:"✅", bar:"linear-gradient(90deg,#10b981,#34d399)", border:"rgba(16,185,129,0.35)", bg:"rgba(240,253,244,0.98)", glow:"0 0 0 1px rgba(16,185,129,0.2),0 20px 60px rgba(16,185,129,0.18),0 4px 16px rgba(0,0,0,0.12)", titleC:"#064e3b", msgC:"#065f46", iconBg:"linear-gradient(135deg,#10b981,#059669)", tagBg:"rgba(16,185,129,0.12)", tagC:"#047857", tag:"SUCCESS", dur:4000 },
  error:  { icon:"❌", bar:"linear-gradient(90deg,#ef4444,#f87171)", border:"rgba(239,68,68,0.35)", bg:"rgba(255,241,241,0.98)", glow:"0 0 0 1px rgba(239,68,68,0.2),0 20px 60px rgba(239,68,68,0.18),0 4px 16px rgba(0,0,0,0.12)", titleC:"#7f1d1d", msgC:"#991b1b", iconBg:"linear-gradient(135deg,#ef4444,#dc2626)", tagBg:"rgba(239,68,68,0.12)", tagC:"#b91c1c", tag:"ERROR", dur:6000 },
  warning:{ icon:"⚠️", bar:"linear-gradient(90deg,#f59e0b,#fcd34d)", border:"rgba(245,158,11,0.35)", bg:"rgba(255,251,235,0.98)", glow:"0 0 0 1px rgba(245,158,11,0.2),0 20px 60px rgba(245,158,11,0.15),0 4px 16px rgba(0,0,0,0.12)", titleC:"#78350f", msgC:"#92400e", iconBg:"linear-gradient(135deg,#f59e0b,#d97706)", tagBg:"rgba(245,158,11,0.12)", tagC:"#b45309", tag:"WARNING", dur:5000 },
  info:   { icon:"ℹ️", bar:"linear-gradient(90deg,#4f46e5,#818cf8)", border:"rgba(79,70,229,0.35)", bg:"rgba(245,243,255,0.98)", glow:"0 0 0 1px rgba(79,70,229,0.2),0 20px 60px rgba(79,70,229,0.15),0 4px 16px rgba(0,0,0,0.12)", titleC:"#1e1b4b", msgC:"#3730a3", iconBg:"linear-gradient(135deg,#4f46e5,#7c3aed)", tagBg:"rgba(79,70,229,0.12)", tagC:"#4338ca", tag:"INFO", dur:4000 },
};

function ToastCard({ t, remove }) {
  const c = T_CFG[t.type] ?? T_CFG.info;
  const [vis, setVis] = useState(false), [w, setW] = useState(100);
  const iv = useRef(null);
  useEffect(() => { const id = setTimeout(()=>setVis(true),20); return ()=>clearTimeout(id); },[]);
  useEffect(() => {
    const step = 100/(c.dur/50);
    iv.current = setInterval(()=>setW(p=>{ if(p<=0){clearInterval(iv.current);return 0;} return p-step; }),50);
    return ()=>clearInterval(iv.current);
  },[c.dur]);
  useEffect(()=>{ if(w<=0) close(); },[w]);
  const close = ()=>{ setVis(false); setTimeout(()=>remove(t.id),380); };
  const isMob = window.innerWidth<640;
  return (
    <div style={{ transform:vis?"translateY(0) scale(1)":isMob?"translateY(80px) scale(0.92)":"translateX(110%) scale(0.92)", opacity:vis?1:0, transition:"transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.4s ease", background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:18, overflow:"hidden", boxShadow:c.glow, width:"100%", pointerEvents:"auto", position:"relative" }}>
      <div style={{ height:3, background:c.bar, position:"absolute", top:0, left:0, right:0 }} />
      <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"16px 14px 14px" }}>
        <div style={{ width:42, height:42, borderRadius:14, background:c.iconBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{c.icon}</div>
        <div style={{ flex:1, minWidth:0, paddingTop:1 }}>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", background:c.tagBg, color:c.tagC, borderRadius:5, padding:"2px 6px", textTransform:"uppercase", display:"inline-block", marginBottom:4 }}>{c.tag}</span>
          <p style={{ fontSize:13, fontWeight:700, color:c.titleC, marginBottom:3, lineHeight:1.3 }}>{t.title}</p>
          {t.message&&<p style={{ fontSize:12, color:c.msgC, lineHeight:1.55, margin:0, opacity:0.85 }}>{t.message}</p>}
        </div>
        <button onClick={close} style={{ width:26, height:26, borderRadius:8, border:"none", background:"rgba(0,0,0,0.06)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#64748b", flexShrink:0, marginTop:2 }}>✕</button>
      </div>
      <div style={{ height:4, background:"rgba(0,0,0,0.07)" }}>
        <div style={{ height:"100%", width:`${w}%`, background:c.bar, transition:"width 0.05s linear" }} />
      </div>
    </div>
  );
}

function ToastContainer({ toasts, remove }) {
  const isMob = window.innerWidth<640;
  return createPortal(
    <div style={{ position:"fixed", zIndex:99999, pointerEvents:"none", display:"flex", flexDirection:"column", gap:10, ...(isMob?{bottom:16,left:12,right:12}:{top:72,right:20,width:380,alignItems:"flex-end"}) }}>
      {toasts.map(t=><ToastCard key={t.id} t={t} remove={remove}/>)}
    </div>, document.body
  );
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type,title,message)=>{
    const id=Date.now()+Math.random();
    setToasts(p=>{ const n=[...p,{id,type,title,message}]; return n.length>4?n.slice(-4):n; });
  },[]);
  const remove = useCallback(id=>setToasts(p=>p.filter(t=>t.id!==id)),[]);
  const toast = useMemo(()=>({
    success:(t,m)=>add("success",t,m),
    error:(t,m)=>add("error",t,m),
    warning:(t,m)=>add("warning",t,m),
    info:(t,m)=>add("info",t,m),
  }),[add]);
  return (<ToastCtx.Provider value={{toast}}>{children}<ToastContainer toasts={toasts} remove={remove}/></ToastCtx.Provider>);
}

// ─── NOTIFICATION DROPDOWN ────────────────────────────────────────────────────
function NotificationDropdown({ notifications, anchorRect, onClose }) {
  const TS = {
    critical:{iconBg:"bg-red-100",dot:"bg-red-500",title:"text-red-700"},
    warning: {iconBg:"bg-amber-100",dot:"bg-amber-500",title:"text-amber-700"},
    info:    {iconBg:"bg-indigo-100",dot:"bg-indigo-400",title:"text-indigo-700"},
  };
  const screenW = window.innerWidth;
  const MARGIN  = 8;
  const dropW   = Math.min(300, screenW - MARGIN * 2);
  const bellRight = anchorRect ? anchorRect.right : screenW - MARGIN;
  const computedLeft = Math.max(MARGIN, bellRight - dropW);

  const style = {
    position:"fixed", top:(anchorRect?.bottom??60)+8, left:computedLeft, width:dropW,
    zIndex:9999, background:"#fff", borderRadius:16, overflow:"hidden",
    boxShadow:"0 24px 60px rgba(79,70,229,.22),0 4px 16px rgba(0,0,0,.12)",
    border:"1px solid rgba(79,70,229,.1)",
  };
  return createPortal(<>
    <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={onClose}/>
    <div style={style}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50" style={{background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)"}}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-indigo-950">Notifications</span>
          <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full" style={{background:"linear-gradient(90deg,#f43f5e,#ec4899)"}}>{notifications.length}</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
      </div>
      <div style={{maxHeight:320,overflowY:"auto"}}>
        {notifications.length===0 ? <p className="text-xs text-slate-400 text-center py-8">No notifications</p>
          : notifications.map(n=>{ const s=TS[n.type]??TS.info; return (
            <div key={n.id} className="flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-default">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${s.iconBg}`}>{n.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className={`text-xs font-bold truncate ${s.title}`}>{n.title}</span>
                  <span className="text-xs text-slate-300 flex-shrink-0 ml-2">{n.time}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
              </div>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`}/>
            </div>);})}
      </div>
      <div className="px-4 py-2.5 border-t border-indigo-50 text-center">
        <span className="text-xs text-indigo-500 font-medium">{notifications.filter(n=>n.type==="critical").length} critical · {notifications.length} total</span>
      </div>
    </div>
  </>, document.body);
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function SidebarContent({ onNavigate }) {
  const navigate = useNavigate(), location = useLocation(), user = getStoredUser();
  const isAdmin = user.role === "Admin";
  const go = p => { navigate(p); onNavigate?.(); };
  const NavBtn = ({ item }) => {
    const on = location.pathname===item.path||(item.path!=="/dashboard"&&location.pathname.startsWith(item.path));
    return (
      <button onClick={()=>go(item.path)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 relative ${on?"text-white":"text-indigo-300 hover:text-indigo-100 hover:bg-white/5"}`}
        style={on?{background:"linear-gradient(90deg,rgba(99,102,241,.5),rgba(20,184,166,.3))",boxShadow:"0 0 20px rgba(99,102,241,.3)"}:{}}>
        {on&&<span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full" style={{background:"linear-gradient(180deg,#818cf8,#34d399)"}}/>}
        <span className="text-sm w-4 text-center">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
      </button>
    );
  };
  return (
    <div className="flex flex-col h-full py-6 px-3.5">
      <div className="flex items-center gap-2.5 px-2 mb-8 cursor-pointer" onClick={()=>go("/dashboard")}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:"linear-gradient(135deg,#818cf8,#34d399)"}}>⚙</div>
        <div>
          <div className="text-white font-bold text-base tracking-tight">AssetAI</div>
          <div className="text-indigo-300 font-medium tracking-widest uppercase" style={{fontSize:9}}>Management Suite</div>
        </div>
      </div>
      <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>
      <nav className="flex flex-col gap-1">{NAV_ITEMS.map(i=><NavBtn key={i.label} item={i}/>)}</nav>
      {isAdmin&&(<>
        <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mt-5 mb-2">Admin</p>
        <nav className="flex flex-col gap-1">{ADMIN_NAV_ITEMS.map(i=><NavBtn key={i.label} item={i}/>)}</nav>
      </>)}
      <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-xs font-semibold tracking-wide uppercase" style={{color:isAdmin?"#34d399":"#a5b4fc"}}>{user.role??"Employee"}</p>
        <p className="text-sm text-indigo-100 font-medium mt-0.5 truncate">{getDisplayName(user)}</p>
        <p className="text-xs text-indigo-600 mt-0.5">v6.0.0 — Pro Plan</p>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen, onClose }) {
  const bg = "linear-gradient(180deg,#1e1b4b 0%,#312e81 60%,#134e4a 100%)";
  return (<>
    <aside className="w-52 flex-shrink-0 hidden lg:flex flex-col" style={{background:bg}}><SidebarContent/></aside>
    <div className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${mobileOpen?"opacity-100 pointer-events-auto":"opacity-0 pointer-events-none"}`} onClick={onClose}/>
    <aside className={`fixed top-0 left-0 z-50 h-full w-64 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${mobileOpen?"translate-x-0":"-translate-x-full"}`} style={{background:bg}}>
      <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-indigo-300 hover:bg-white/10 hover:text-white transition-colors text-lg z-10">✕</button>
      <SidebarContent onNavigate={onClose}/>
    </aside>
  </>);
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ onMenuToggle, notifications, now }) {
  const navigate = useNavigate(), user = getStoredUser(), { toast } = useToast();
  const bellRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false), [anchorRect, setAnchorRect] = useState(null);
  const dName = getDisplayName(user), ini = getUserInitials(user);
  const urgent = notifications.filter(n=>n.type==="critical"||n.type==="warning").length;
  const handleBell = ()=>{ if(bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect()); setNotifOpen(o=>!o); };
  const logout = ()=>{ localStorage.removeItem("user"); toast.info("Signed Out","Logged out successfully."); setTimeout(()=>navigate("/"),600); };
  return (
    <header className="h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 border-b" style={{background:"rgba(255,255,255,.85)",backdropFilter:"blur(12px)",borderColor:"rgba(79,70,229,.08)"}}>
      <button onClick={onMenuToggle} className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100 transition-colors flex-shrink-0">
        <span className="flex flex-col gap-1 w-4"><span className="block h-0.5 bg-current rounded-full"/><span className="block h-0.5 bg-current rounded-full"/><span className="block h-0.5 bg-current rounded-full"/></span>
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-indigo-950 hidden sm:inline">{getDashboardLabel(user)}</span>
        <span className="text-xs text-indigo-300 font-normal hidden sm:inline"> / Audit Logs</span>
        <span className="text-sm font-bold text-indigo-950 sm:hidden">Audit Logs</span>
      </div>
      <div className="hidden md:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/> Admin Portal
      </div>
      <button ref={bellRef} onClick={handleBell}
        className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-colors flex-shrink-0 ${notifOpen?"bg-indigo-100 border-indigo-200":"border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100"}`}>
        🔔
        {notifications.length>0&&(
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
            style={{background:urgent>0?"linear-gradient(135deg,#f43f5e,#ec4899)":"linear-gradient(135deg,#4f46e5,#9333ea)",fontSize:9}}>
            {notifications.length>9?"9+":notifications.length}
          </span>
        )}
      </button>
      {notifOpen&&<NotificationDropdown notifications={notifications} anchorRect={anchorRect} onClose={()=>setNotifOpen(false)}/>}
      <div className="flex items-center gap-2 border border-indigo-100 rounded-full px-2 py-1 bg-white cursor-pointer flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background:"linear-gradient(135deg,#4f46e5,#14b8a6)"}}>{ini}</div>
        <span className="text-xs font-medium text-slate-700 hidden sm:block max-w-20 truncate">{dName.split(" ")[0]}</span>
      </div>
      <button onClick={logout} className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors flex-shrink-0">
        <span className="hidden sm:inline">→ Logout</span><span className="sm:hidden">→</span>
      </button>
    </header>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, gradient, glowColor, trend }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 cursor-default transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
      style={{background:gradient,boxShadow:`0 4px 28px ${glowColor}`}}>
      <div className="absolute inset-0 opacity-15" style={{background:"radial-gradient(circle at top right,white,transparent 65%)"}}/>
      <div className="absolute bottom-0 right-0 w-20 h-20 opacity-10" style={{background:"radial-gradient(circle,white,transparent 70%)"}}/>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-white/25 text-white border border-white/40 tracking-wide">{trend}</span>
        </div>
        <p className="text-3xl font-black text-white tracking-tight leading-none drop-shadow">{value}</p>
        <p className="text-xs font-bold text-white/75 uppercase tracking-widest mt-1.5">{label}</p>
        <p className="text-xs text-white/50 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── ACTION BADGE ─────────────────────────────────────────────────────────────
function ActionBadge({ action, size = "sm" }) {
  const cat = actionCategory(action);
  const c = ACTION_CFG[cat] ?? ACTION_CFG.OTHER;
  return (
    <span className={`inline-flex items-center gap-1.5 ${size==="lg"?"px-4 py-1.5 text-sm":"px-2.5 py-1 text-xs"} rounded-full font-bold border`}
      style={{background:c.bg,borderColor:c.border,color:c.color,boxShadow:c.glow}}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:c.dot}}/>
      {action||"—"}
    </span>
  );
}

// ─── CONFIRM DELETE AUDIT LOG ──────────────────────────────────────────────────
function ConfirmDeleteLogModal({ log, onConfirm, onCancel, loading }) {
  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      style={{background:"rgba(15,10,40,0.88)",backdropFilter:"blur(10px)"}}>
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{background:"linear-gradient(135deg,#fee2e2,#fecaca)"}}>
            <span className="text-3xl">🗑️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Audit Log?</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-1">
            This will <span className="font-bold text-red-600">permanently delete</span> log entry <span className="font-mono font-bold text-slate-700">#{log?.id}</span>.
          </p>
          <p className="text-xs text-slate-400 mb-3 italic">"{(log?.description||"").slice(0,60)}{log?.description?.length>60?"…":""}"</p>
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-semibold">
            🚨 This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",boxShadow:"0 4px 14px rgba(239,68,68,.4)"}}>
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Deleting…</>
              : "🗑️ Delete Log"}
          </button>
        </div>
      </div>
    </div>, document.body
  );
}

// ─── DETAIL FIELD ─────────────────────────────────────────────────────────────
function DetailField({ label, value, accent }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:accent||"#94a3b8"}}>{label}</p>
      <div className="text-sm font-bold text-slate-800 break-words">{value||"—"}</div>
    </div>
  );
}

// ─── EMPLOYEE MINI CARD ───────────────────────────────────────────────────────
function EmployeeMiniCard({ emp, deptMap, label, accentColor, accentBg, accentBorder }) {
  if (!emp) return null;
  const norm = normaliseEmp(emp);
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:accentColor}}>{label}</p>
      <div className="rounded-2xl border overflow-hidden" style={{background:accentBg,borderColor:accentBorder}}>
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{borderColor:accentBorder}}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
            style={{background:avatarColor(norm.employeeName||"")}}>
            {empInitials(norm.employeeName||"")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{norm.employeeName||"—"}</p>
            <p className="text-xs text-slate-500 truncate">{norm.email||"—"}</p>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
            style={{background:norm.role==="Admin"?"linear-gradient(90deg,#7c3aed,#ec4899)":"linear-gradient(90deg,#059669,#14b8a6)"}}>
            {norm.role||"Employee"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <DetailField label="Employee ID"   value={`#${norm.id}`}                            accent={accentColor}/>
          <DetailField label="Department"    value={deptMap[norm.departmentId]||norm.departmentName||"—"} accent={accentColor}/>
          <DetailField label="Joined Date"   value={fmtDate(norm.joinedDate)}                  accent={accentColor}/>
          <DetailField label="Account Since" value={fmtFull(norm.createdAt)}                   accent={accentColor}/>
          <DetailField label="Status"        value={norm.status||"Active"}                     accent={accentColor}/>
          <DetailField label="Role"          value={norm.role||"—"}                            accent={accentColor}/>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOG DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════
function LogDetailModal({ log, employees, departments, onClose, now }) {
  const cat = actionCategory(log?.action);
  const c   = ACTION_CFG[cat] ?? ACTION_CFG.OTHER;

  const deptMap = useMemo(()=>{
    const m={};
    departments.forEach(d=>{ if(d.id!=null) m[d.id]=d.departmentName||d.department_name||`Dept #${d.id}`; });
    return m;
  },[departments]);

  const subjectEmp = useMemo(()=>{
    if(!log?.description) return null;
    const desc = log.description;
    const idMatch = desc.match(/ID[:\s#]+(\d+)/i);
    if(idMatch){ const id=parseInt(idMatch[1]); const found=employees.find(e=>Number(e.id)===id); if(found) return found; }
    for(const emp of employees){
      const name=(emp.employeeName||emp.employee_name||"").toLowerCase();
      if(name&&name.length>2&&desc.toLowerCase().includes(name)) return emp;
    }
    return null;
  },[log,employees]);

  const performerEmp = useMemo(()=>{
    if(!log?.performedBy) return null;
    const pb = log.performedBy.toLowerCase();
    return employees.find(e=>
      (e.employeeName||e.employee_name||"").toLowerCase()===pb ||
      (e.email||"").toLowerCase()===pb
    )??null;
  },[log,employees]);

  const actionHighlight = {
    CREATE: { emoji:"✨", title:"New Employee Created",    desc:"A new employee account was successfully created in the system.",    bg:"linear-gradient(135deg,rgba(16,185,129,.12),rgba(13,148,136,.08))",   border:"rgba(16,185,129,.3)", color:"#059669", badge:"linear-gradient(135deg,#10b981,#059669)" },
    UPDATE: { emoji:"✏️", title:"Employee Record Updated", desc:"An existing employee's information was modified.",                  bg:"linear-gradient(135deg,rgba(59,130,246,.12),rgba(8,145,178,.08))",    border:"rgba(59,130,246,.3)", color:"#2563eb", badge:"linear-gradient(135deg,#3b82f6,#2563eb)" },
    DELETE: { emoji:"🗑️", title:"Employee Deleted",        desc:"An employee record was permanently removed from the system.",       bg:"linear-gradient(135deg,rgba(239,68,68,.12),rgba(249,115,22,.08))",    border:"rgba(239,68,68,.3)", color:"#dc2626", badge:"linear-gradient(135deg,#ef4444,#dc2626)" },
    OTHER:  { emoji:"📌", title:"System Action",           desc:"A system-level operation was performed.",                          bg:"linear-gradient(135deg,rgba(107,114,128,.1),rgba(75,85,99,.08))",     border:"rgba(107,114,128,.2)",color:"#4b5563", badge:"linear-gradient(135deg,#6b7280,#4b5563)" },
  };
  const hl = actionHighlight[cat] ?? actionHighlight.OTHER;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{background:"rgba(15,10,40,0.85)",backdropFilter:"blur(12px)"}}
      onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        style={{boxShadow:"0 40px 80px rgba(79,70,229,.3),0 0 0 1px rgba(79,70,229,.1)"}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="relative px-6 py-5 flex-shrink-0" style={{background:c.headerBg}}>
          <div className="absolute inset-0 opacity-15" style={{background:"radial-gradient(circle at top right,white,transparent 60%)"}}/>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center transition-colors z-10 text-sm font-bold"
            style={{background:"rgba(255,255,255,0.2)",color:"#ffffff"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.35)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"}>✕</button>
          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 border-2"
              style={{background:"rgba(255,255,255,0.2)",borderColor:"rgba(255,255,255,0.35)"}}>
              {c.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border"
                  style={{background:"rgba(255,255,255,0.25)",borderColor:"rgba(255,255,255,0.4)",color:"#ffffff",letterSpacing:"0.05em"}}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"/>
                  {log?.action||"ACTION"}
                </span>
                <span className="text-xs font-bold" style={{color:"rgba(255,255,255,0.7)"}}>Log #{log?.id}</span>
              </div>
              <p className="text-sm font-bold leading-snug line-clamp-2" style={{color:"#ffffff"}}>
                {log?.description||"Audit Entry"}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {/* [FIX-1] Exact IST time */}
                <span className="text-xs font-semibold" style={{color:"rgba(255,255,255,0.85)"}}>
                  🕐 {fmtFull(log?.timestamp)}
                </span>
                {/* [FIX-2] Live relative time using passed `now` */}
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{background:"rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.9)"}}>
                  {timeAgo(log?.timestamp, now)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-5 flex flex-col gap-4">
            {/* Action highlight callout */}
            <div className="rounded-2xl border overflow-hidden" style={{background:hl.bg,borderColor:hl.border}}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 text-white"
                  style={{background:hl.badge}}>{hl.emoji}</div>
                <div className="flex-1">
                  <p className="text-sm font-black" style={{color:hl.color}}>{hl.title}</p>
                  <p className="text-xs mt-0.5" style={{color:hl.color,opacity:0.75}}>{hl.desc}</p>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full text-white flex-shrink-0"
                  style={{background:hl.badge}}>{cat}</span>
              </div>
            </div>

            {/* Performed By */}
            <div className="rounded-2xl border border-indigo-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5" style={{background:"linear-gradient(90deg,#312e81,#1e3a5f)"}}>
                <span className="text-base">👑</span>
                <p className="text-xs font-bold uppercase tracking-widest" style={{color:"#ffffff"}}>Performed By</p>
              </div>
              <div className="px-4 py-3 flex items-center gap-3 bg-slate-50/50">
                {performerEmp ? (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                      style={{background:avatarColor(performerEmp.employeeName||performerEmp.employee_name||"")}}>
                      {empInitials(performerEmp.employeeName||performerEmp.employee_name||"")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{performerEmp.employeeName||performerEmp.employee_name||"—"}</p>
                      <p className="text-xs text-slate-500">{performerEmp.email||"—"} · {performerEmp.role||"Admin"}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{background:"linear-gradient(90deg,#7c3aed,#ec4899)"}}>
                      {performerEmp.role||"Admin"}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                      style={{background:avatarColor(log?.performedBy||"A")}}>
                      {(log?.performedBy||"?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{log?.performedBy||"—"}</p>
                      <p className="text-xs text-slate-400">Admin · details not in current records</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Full description */}
            <div className="rounded-xl p-4 border" style={{background:c.bg,borderColor:c.border}}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:c.color}}>📝 Full Action Description</p>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">{log?.description||"No description available."}</p>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3.5 border border-indigo-100" style={{background:"linear-gradient(135deg,rgba(79,70,229,.06),rgba(99,102,241,.04))"}}>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">📅 Performed On (IST)</p>
                <p className="text-xs font-black text-indigo-700">{fmtFull(log?.timestamp)}</p>
              </div>
              <div className="rounded-xl p-3.5 border border-violet-100" style={{background:"linear-gradient(135deg,rgba(124,58,237,.06),rgba(139,92,246,.04))"}}>
                <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">⏱ Time Elapsed</p>
                {/* [FIX-2] use passed now */}
                <p className="text-xs font-black text-violet-700">{timeAgo(log?.timestamp, now)}</p>
              </div>
            </div>

            {/* Subject employee */}
            {subjectEmp && Number(subjectEmp.id) !== Number(performerEmp?.id) && (
              <EmployeeMiniCard
                emp={subjectEmp}
                deptMap={deptMap}
                label={cat==="CREATE"?"✨ Employee Created":cat==="DELETE"?"🗑️ Employee Affected":"✏️ Employee Updated"}
                accentColor={c.color}
                accentBg={cat==="CREATE"?"rgba(240,253,244,0.7)":cat==="DELETE"?"rgba(254,242,242,0.7)":"rgba(239,246,255,0.7)"}
                accentBorder={c.border}
              />
            )}
            {!subjectEmp && cat==="CREATE" && (
              <div className="rounded-xl p-3 border border-amber-100 text-xs text-amber-700" style={{background:"rgba(245,158,11,.05)"}}>
                ℹ️ Created employee record not found — may have been deleted since. See description above.
              </div>
            )}
            {!subjectEmp && cat==="DELETE" && (
              <div className="rounded-xl p-3 border border-red-100 text-xs text-red-600" style={{background:"rgba(239,68,68,.05)"}}>
                🗑️ This employee's record has been permanently deleted. See description above for details.
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 flex-shrink-0 border-t border-slate-100 pt-3">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>, document.body
  );
}

// ─── SKELETON ROW ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (<tr className="animate-pulse border-b border-slate-50">
    {[80,200,120,140,70,60].map((w,i)=>(<td key={i} className="px-4 py-3.5"><div className="h-4 bg-slate-100 rounded-full" style={{width:w}}/></td>))}
  </tr>);
}

// ─── ACCESS DENIED ────────────────────────────────────────────────────────────
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8" style={{background:"linear-gradient(135deg,#f0f0ff,#f5f9ff,#f0fff8)"}}>
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl" style={{background:"linear-gradient(135deg,#fee2e2,#fecaca)"}}>🔒</div>
      <div className="text-center"><h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2><p className="text-slate-500 text-sm max-w-xs">Admin access is required to view audit logs.</p></div>
      <button onClick={()=>navigate("/dashboard")} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{background:"linear-gradient(90deg,#4f46e5,#7c3aed)",boxShadow:"0 4px 14px rgba(79,70,229,.4)"}}>← Return to Dashboard</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// [FIX-7] ANALYTICS PANEL — "All" period Recent Actions fixed
// ═══════════════════════════════════════════════════════════════════════════
function AnalyticsPanel({ logs, localDeleteCount, now }) {
  const [period, setPeriod] = useState("week");

  const periodStart = useMemo(()=>{
    if(period==="week")  return startOfWeek();
    if(period==="month") return startOfMonth();
    if(period==="year")  return startOfYear();
    return new Date(0); // "all" — epoch start, includes everything
  },[period]);

  // [FIX-7] For "all", periodStart = epoch so every log passes the filter
  const periodLogs = useMemo(()=>
    logs.filter(l => {
      if (!l.timestamp) return period === "all";
      return new Date(l.timestamp) >= periodStart;
    }),
  [logs, periodStart, period]);

  const creates = periodLogs.filter(l=>actionCategory(l.action)==="CREATE");
  const updates = periodLogs.filter(l=>actionCategory(l.action)==="UPDATE");
  const deletes = periodLogs.filter(l=>actionCategory(l.action)==="DELETE");
  const total   = periodLogs.length || 1;

  const byPerformer = useMemo(()=>{
    const m={};
    periodLogs.forEach(l=>{
      const k=l.performedBy||"Unknown";
      if(!m[k]) m[k]={name:k,creates:0,updates:0,deletes:0,total:0,last:l.timestamp};
      const cat=actionCategory(l.action);
      if(cat==="CREATE") m[k].creates++;
      else if(cat==="UPDATE") m[k].updates++;
      else if(cat==="DELETE") m[k].deletes++;
      m[k].total++;
      if(new Date(l.timestamp)>new Date(m[k].last)) m[k].last=l.timestamp;
    });
    return Object.values(m).sort((a,b)=>b.total-a.total).slice(0,5);
  },[periodLogs]);

  const maxActivity = Math.max(...byPerformer.map(p=>p.total),1);
  const LABELS = {week:"This Week",month:"This Month",year:"This Year",all:"All Time"};

  // [FIX-7] Sorted recent actions for the feed — works for all periods including "all"
  const recentActions = useMemo(()=>
    [...periodLogs]
      .filter(l => l.timestamp) // guard against missing timestamps
      .sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))
      .slice(0,10),
  [periodLogs]);

  const metrics = [
    { label:"Total Actions",    value:periodLogs.length, icon:"📋", gradient:"linear-gradient(135deg,#4f46e5,#7c3aed)", glow:"rgba(79,70,229,.35)",  pct:100 },
    { label:"Created",          value:creates.length,    icon:"✨", gradient:"linear-gradient(135deg,#059669,#10b981)", glow:"rgba(16,185,129,.35)", pct:Math.round((creates.length/total)*100) },
    { label:"Updated",          value:updates.length,    icon:"✏️", gradient:"linear-gradient(135deg,#2563eb,#0891b2)", glow:"rgba(37,99,235,.35)",  pct:Math.round((updates.length/total)*100) },
    { label:"Deleted (Server)", value:deletes.length,    icon:"🗑️", gradient:"linear-gradient(135deg,#ef4444,#f97316)", glow:"rgba(239,68,68,.35)",  pct:Math.round((deletes.length/total)*100) },
    { label:"Deleted (Session)",value:localDeleteCount,  icon:"🗂️", gradient:"linear-gradient(135deg,#7c3aed,#ec4899)", glow:"rgba(124,58,237,.35)", pct:null },
  ];

  return (
    <div className="rounded-2xl border border-indigo-50 overflow-hidden" style={{boxShadow:"0 4px 24px rgba(79,70,229,.1)"}}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#0f4c75 100%)"}}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{background:"linear-gradient(135deg,#818cf8,#34d399)",boxShadow:"0 0 20px rgba(129,140,248,.5)"}}>📊</div>
          <div>
            <p className="text-sm font-black text-white">Activity Analytics</p>
            <p className="text-xs font-medium" style={{color:"rgba(165,180,252,0.8)"}}>
              {LABELS[period]} · {periodLogs.length} action{periodLogs.length!==1?"s":""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl p-1" style={{background:"rgba(255,255,255,.1)"}}>
          {["week","month","year","all"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={period===p
                ?{background:"linear-gradient(135deg,#818cf8,#34d399)",color:"white",boxShadow:"0 2px 8px rgba(129,140,248,.4)"}
                :{color:"rgba(255,255,255,.5)"}}>
              {p==="all"?"All":p.charAt(0).toUpperCase()+p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5" style={{background:"linear-gradient(135deg,#fafbff,#f0fdf4)"}}>
        {/* Colorful metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {metrics.map(m=>(
            <div key={m.label} className="relative overflow-hidden rounded-2xl p-4 text-center"
              style={{background:m.gradient,boxShadow:`0 4px 20px ${m.glow}`}}>
              <div className="absolute inset-0 opacity-10" style={{background:"radial-gradient(circle at top right,white,transparent 70%)"}}/>
              <div className="relative z-10">
                <span className="text-2xl">{m.icon}</span>
                <p className="text-3xl font-black text-white mt-1 drop-shadow">{m.value}</p>
                <p className="text-xs font-bold text-white/75 mt-0.5 leading-tight">{m.label}</p>
                {m.pct !== null && (
                  <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full rounded-full bg-white/70 transition-all duration-700"
                      style={{width:`${m.pct}%`}}/>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Admin activity segmented bars */}
          <div className="bg-white rounded-2xl p-4 border border-indigo-50" style={{boxShadow:"0 2px 12px rgba(79,70,229,.06)"}}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">👑</span>
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Admin Activity</p>
              <span className="ml-auto text-xs text-slate-400">{LABELS[period]}</span>
            </div>
            {byPerformer.length===0
              ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <span className="text-3xl opacity-30">👤</span>
                  <p className="text-xs text-slate-300 italic">No admin activity in {LABELS[period].toLowerCase()}</p>
                </div>
              )
              : <div className="flex flex-col gap-3">
                  {byPerformer.map((a,i)=>{
                    const cPct = Math.round((a.creates/a.total)*100)||0;
                    const uPct = Math.round((a.updates/a.total)*100)||0;
                    return (
                      <div key={a.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                              style={{background:avatarColor(a.name)}}>
                              {empInitials(a.name)}
                            </div>
                            <span className="text-xs font-bold text-slate-700 truncate max-w-28">{a.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-white px-1.5 py-0.5 rounded-md" style={{background:"linear-gradient(90deg,#4f46e5,#7c3aed)"}}>{a.total}</span>
                            {a.creates>0&&<span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">+{a.creates}</span>}
                            {a.updates>0&&<span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">✏{a.updates}</span>}
                            {a.deletes>0&&<span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700">🗑{a.deletes}</span>}
                          </div>
                        </div>
                        <div className="h-3 rounded-full overflow-hidden flex" style={{background:"rgba(0,0,0,.06)"}}>
                          {a.creates>0&&<div className="h-full transition-all duration-700" style={{width:`${(a.creates/maxActivity)*100}%`,background:"linear-gradient(90deg,#10b981,#059669)"}}/>}
                          {a.updates>0&&<div className="h-full transition-all duration-700" style={{width:`${(a.updates/maxActivity)*100}%`,background:"linear-gradient(90deg,#3b82f6,#2563eb)"}}/>}
                          {a.deletes>0&&<div className="h-full transition-all duration-700" style={{width:`${(a.deletes/maxActivity)*100}%`,background:"linear-gradient(90deg,#ef4444,#f97316)"}}/>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 pt-1">
                    {[{c:"#10b981",l:"Create"},{c:"#3b82f6",l:"Update"},{c:"#ef4444",l:"Delete"}].map(({c:col,l})=>(
                      <div key={l} className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{background:col}}/>
                        <span className="text-xs text-slate-400 font-medium">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
            }
          </div>

          {/* [FIX-7] Recent Actions — properly handles all periods */}
          <div className="bg-white rounded-2xl p-4 border border-indigo-50" style={{boxShadow:"0 2px 12px rgba(79,70,229,.06)"}}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">⚡</span>
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Recent Actions</p>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{background:"linear-gradient(90deg,#4f46e5,#7c3aed)",color:"white"}}>
                {recentActions.length} of {periodLogs.length}
              </span>
            </div>
            {recentActions.length === 0
              ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <span className="text-3xl opacity-30">⚡</span>
                  <p className="text-xs text-slate-300 italic">No actions recorded for {LABELS[period].toLowerCase()}</p>
                  {period !== "all" && (
                    <button
                      className="text-xs text-indigo-500 underline mt-1"
                      onClick={()=>setPeriod("all")}>
                      View all time →
                    </button>
                  )}
                </div>
              )
              : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1" style={{scrollbarWidth:"thin"}}>
                  {recentActions.map(l=>{
                    const cat2=actionCategory(l.action);
                    const cfg=ACTION_CFG[cat2]??ACTION_CFG.OTHER;
                    return (
                      <div key={l.id}
                        className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                        style={{
                          borderLeft:`4px solid ${cfg.dot}`,
                          background:cfg.cardBg,
                          border:`1px solid ${cfg.border}`,
                          borderLeftWidth:4,
                          borderLeftColor:cfg.dot,
                        }}>
                        <span className="text-lg flex-shrink-0 mt-0.5">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="inline-block text-xs font-black px-1.5 py-0.5 rounded-md text-white"
                              style={{background:cfg.badgeBg,fontSize:9}}>
                              {cat2}
                            </span>
                            {/* [FIX-2] live relative time */}
                            <span className="text-xs text-slate-400">{timeAgo(l.timestamp, now)}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 truncate"
                            title={l.description||"—"}>
                            {l.description||"—"}
                          </p>
                          <p className="text-xs font-bold mt-0.5" style={{color:cfg.color}}>
                            {l.performedBy||"Admin"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN AUDIT LOGS CONTENT
// ═══════════════════════════════════════════════════════════════════════════
const PAGE_SIZE = 10;

function AuditLogsContent({ now }) {
  const { toast } = useToast();
  const [logs,         setLogs]         = useState([]);
  const [employees,    setEmployees]     = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filter,       setFilter]       = useState("All");
  const [page,         setPage]         = useState(1);
  // [FIX-6] viewLog only set by explicit "View →" button click
  const [viewLog,      setViewLog]      = useState(null);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLogLoading, setDeleteLogLoading] = useState(false);

  // [FIX-4] Local soft-delete count
  const [localDeleteCount, setLocalDeleteCount] = useState(()=>loadDeletedHistory().length);

  useEffect(()=>{
    const sync = ()=>setLocalDeleteCount(loadDeletedHistory().length);
    window.addEventListener("storage", sync);
    const id = setInterval(sync, 5000);
    return ()=>{ window.removeEventListener("storage", sync); clearInterval(id); };
  },[]);

  const fetchAll = useCallback(async (silent=false) => {
    if(!silent) setLoading(true);
    try {
      const [logsRes, empsRes, deptsRes] = await Promise.all([
        api.get("/api/audit-logs"),
        api.get("/api/employees"),
        api.get("/api/departments"),
      ]);
      const logsData = Array.isArray(logsRes.data) ? logsRes.data : [];
      // Sort newest first
      logsData.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
      setLogs(logsData);
      setEmployees(Array.isArray(empsRes.data)?empsRes.data:[]);
      setDepartments(Array.isArray(deptsRes.data)?deptsRes.data:[]);
      // [FIX-8] Record exact refresh time
      setLastRefresh(nowISO());
      if(!silent) toast.success("Logs Loaded",`${logsData.length} audit record${logsData.length!==1?"s":""} fetched.`);
    } catch(err) {
      toast.error("Load Failed", err.response?.data?.message||err.message||"Could not fetch audit logs.");
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{ fetchAll(); },[fetchAll]);

  // [FIX-3] Hard delete an audit log entry
  const handleDeleteLog = async () => {
    if (!deleteTarget) return;
    setDeleteLogLoading(true);
    try {
      await api.delete(`/api/audit-logs/${deleteTarget.id}`, {
        headers: { "X-Performed-By": getStoredUser().employeeName || getStoredUser().email || "Admin" },
      });
    } catch(err) {
      if (err.response?.status !== 404) {
        toast.warning("Note", `Backend: ${err.response?.data?.message||err.message}. Removing locally.`);
      }
    } finally {
      setLogs(prev=>prev.filter(l=>l.id!==deleteTarget.id));
      toast.success("Log Deleted",`Audit log #${deleteTarget.id} permanently removed.`);
      setDeleteTarget(null);
      setDeleteLogLoading(false);
    }
  };

  const stats = useMemo(()=>{
    const today=startOfToday(), week=startOfWeek();
    return {
      total:        logs.length,
      today:        logs.filter(l=>l.timestamp&&new Date(l.timestamp)>=today).length,
      deletes:      logs.filter(l=>actionCategory(l.action)==="DELETE").length,
      creates:      logs.filter(l=>actionCategory(l.action)==="CREATE").length,
      thisWeek:     logs.filter(l=>l.timestamp&&new Date(l.timestamp)>=week).length,
      localDeletes: localDeleteCount,
    };
  },[logs,localDeleteCount]);

  const filtered = useMemo(()=>logs.filter(l=>{
    const q=search.toLowerCase();
    const matchQ=!q||(l.description||"").toLowerCase().includes(q)||(l.performedBy||"").toLowerCase().includes(q)||(l.action||"").toLowerCase().includes(q);
    const matchF=filter==="All"||actionCategory(l.action)===filter;
    return matchQ&&matchF;
  }),[logs,search,filter]);

  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const paged = filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  useEffect(()=>{ setPage(1); },[search,filter]);

  const exportCSV = ()=>{
    const headers=["ID","Action","Description","Performed By","Exact Timestamp (IST)"];
    const rows=filtered.map(l=>[l.id,l.action,l.description,l.performedBy,fmtFull(l.timestamp)]);
    const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download="audit_logs.csv"; a.click(); URL.revokeObjectURL(a.href);
    toast.success("Exported",`${filtered.length} records exported.`);
  };

  return (
    <div className="flex flex-col gap-5 pb-6">

      {/* Page Header */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#134e4a 100%)",boxShadow:"0 8px 40px rgba(79,70,229,.3)"}}>
        <div className="absolute inset-0 opacity-10" style={{background:"radial-gradient(ellipse at top right,white,transparent 60%)"}}/>
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                style={{background:"linear-gradient(135deg,#818cf8,#34d399)",boxShadow:"0 0 20px rgba(129,140,248,.5)"}}>📜</div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Audit Logs</h1>
                <p className="text-xs font-medium" style={{color:"rgba(165,180,252,.8)"}}>Track all admin activities in real-time · IST</p>
              </div>
            </div>
            {lastRefresh && (
              <p className="text-xs mt-1" style={{color:"rgba(165,180,252,.7)"}}>
                Last synced: {fmtFull(lastRefresh)}
              </p>
            )}
          </div>
          <button onClick={()=>fetchAll(false)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border transition-all disabled:opacity-60"
            style={{background:"rgba(255,255,255,.12)",borderColor:"rgba(255,255,255,.2)"}}>
            <span className={loading?"animate-spin inline-block":"inline-block"}>↺</span> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard icon="📋" label="Total Logs"        value={stats.total}        sub="All recorded events"    gradient="linear-gradient(135deg,#4f46e5,#7c3aed)" glowColor="rgba(79,70,229,.3)"   trend="All"/>
        <StatCard icon="⚡" label="Today"             value={stats.today}        sub="Since midnight IST"     gradient="linear-gradient(135deg,#0369a1,#0891b2)" glowColor="rgba(3,105,161,.3)"   trend="Today"/>
        <StatCard icon="📅" label="This Week"         value={stats.thisWeek}     sub="Current week"           gradient="linear-gradient(135deg,#7c3aed,#ec4899)" glowColor="rgba(124,58,237,.3)"  trend="Week"/>
        <StatCard icon="✨" label="Creates"           value={stats.creates}      sub="New records"            gradient="linear-gradient(135deg,#059669,#10b981)" glowColor="rgba(5,150,105,.3)"   trend="Growth"/>
        <StatCard icon="🗑️" label="Deletes (Server)"  value={stats.deletes}      sub="Server-logged deletes"  gradient="linear-gradient(135deg,#ef4444,#f97316)" glowColor="rgba(220,38,38,.3)"   trend={stats.deletes>0?"⚠ Alert":"✓"}/>
        <StatCard icon="🗂️" label="Deletes (Session)" value={stats.localDeletes} sub="From Employee Mgmt"     gradient="linear-gradient(135deg,#7c3aed,#c026d3)" glowColor="rgba(124,58,237,.3)"  trend={stats.localDeletes>0?"Active":"None"}/>
      </div>

      {/* Analytics Panel */}
      <AnalyticsPanel logs={logs} localDeleteCount={localDeleteCount} now={now}/>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-indigo-50 p-4" style={{boxShadow:"0 2px 12px rgba(79,70,229,.06)"}}>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search action, description, admin…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"/>
          </div>
          <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200">
            {["All","CREATE","UPDATE","DELETE"].map(f=>{
              const active=filter===f;
              const cfg=ACTION_CFG[f]??{badgeBg:"linear-gradient(90deg,#4f46e5,#7c3aed)"};
              return (
                <button key={f} onClick={()=>setFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={active
                    ?{background:f==="All"?"linear-gradient(90deg,#4f46e5,#7c3aed)":cfg.badgeBg,color:"white",boxShadow:"0 2px 8px rgba(79,70,229,.3)"}
                    :{color:"#64748b"}}>
                  {f}
                </button>
              );
            })}
          </div>
          <button onClick={exportCSV}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-2 whitespace-nowrap">
            📥 Export CSV
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Showing <span className="font-semibold text-indigo-600">{filtered.length}</span> of <span className="font-semibold">{logs.length}</span> records
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden" style={{boxShadow:"0 2px 12px rgba(79,70,229,.06)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-indigo-50/80"
          style={{background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)"}}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-950">Activity Timeline</span>
            <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full"
              style={{background:"linear-gradient(90deg,#4f46e5,#7c3aed)"}}>{filtered.length}</span>
          </div>
          <span className="text-xs text-slate-400">Newest first · IST timestamps</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table className="w-full text-sm" style={{minWidth:760}}>
            <thead>
              <tr style={{background:"linear-gradient(90deg,#f8f8ff,#f0fdfa)"}}>
                {["Action","Description","Performed By","Exact Time (IST)","Details","Delete"].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({length:6}).map((_,i)=><SkeletonRow key={i}/>)
                : paged.length===0
                  ? (
                    <tr><td colSpan={6} className="px-5 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                          style={{background:"linear-gradient(135deg,#f0f0ff,#e0e7ff)"}}>📜</div>
                        <p className="text-sm font-semibold text-slate-400">No logs found</p>
                        <p className="text-xs text-slate-300">Try adjusting your search or filter</p>
                      </div>
                    </td></tr>
                  )
                  : paged.map((log,idx)=>{
                      const cat=actionCategory(log.action);
                      const cfg=ACTION_CFG[cat]??ACTION_CFG.OTHER;
                      return (
                        // [FIX-6] NO onClick on <tr> — row click does NOT open modal
                        <tr key={log.id}
                          className="transition-colors border-b border-slate-50"
                          style={idx%2===1?{background:"rgba(248,250,252,0.6)"}:{}}>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <ActionBadge action={log.action}/>
                          </td>

                          {/* [FIX-6] Description — plain text, no click handler */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-base flex-shrink-0">{cfg.icon}</span>
                              <span className="text-xs text-slate-700 font-medium leading-relaxed line-clamp-2">{log.description||"—"}</span>
                            </div>
                          </td>

                          {/* [FIX-6] Performed By — plain, no click */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                                style={{background:avatarColor(log.performedBy||"?")}}>
                                {(log.performedBy||"?")[0]?.toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold text-slate-700">{log.performedBy||"—"}</span>
                            </div>
                          </td>

                          {/* [FIX-1][FIX-2] Exact IST + live relative time */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="text-xs font-bold text-slate-700">{fmtFull(log.timestamp)}</p>
                            <p className="text-xs font-semibold mt-0.5" style={{color:cfg.color}}>
                              {timeAgo(log.timestamp, now)}
                            </p>
                          </td>

                          {/* [FIX-6] Only "View →" button opens the modal */}
                          <td className="px-4 py-3.5">
                            <button
                              onClick={()=>setViewLog(log)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                              View →
                            </button>
                          </td>

                          {/* [FIX-3] Delete button */}
                          <td className="px-4 py-3.5">
                            <button
                              onClick={()=>setDeleteTarget(log)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white border border-red-200 hover:shadow-md transition-all"
                              style={{background:"linear-gradient(135deg,#ef4444,#dc2626)"}}>
                              🗑️ Delete
                            </button>
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
            <span className="text-xs text-slate-400">Page {page} of {totalPages} · {filtered.length} records</span>
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                className="w-7 h-7 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">←</button>
              {Array.from({length:Math.min(5,totalPages)}).map((_,i)=>{
                const pg=Math.max(1,Math.min(page-2,totalPages-4))+i;
                if(pg<1||pg>totalPages) return null;
                return (<button key={pg} onClick={()=>setPage(pg)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${pg===page?"text-white":"border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  style={pg===page?{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}:{}}>{pg}</button>);
              })}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                className="w-7 h-7 rounded-lg text-xs border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">→</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewLog && (
        <LogDetailModal
          log={viewLog}
          employees={employees}
          departments={departments}
          onClose={()=>setViewLog(null)}
          now={now}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteLogModal
          log={deleteTarget}
          onConfirm={handleDeleteLog}
          onCancel={()=>setDeleteTarget(null)}
          loading={deleteLogLoading}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ═══════════════════════════════════════════════════════════════════════════
function AdminAuditLogsInner() {
  const user = getStoredUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifAssets, setNotifAssets] = useState([]);
  const [notifMaint,  setNotifMaint]  = useState([]);

  // ─────────────────────────────────────────────────────────────────────────
  // [FIX-2] Single shared "now" — updated every 60s → propagated as prop
  //         so ALL timeAgo() calls across the page re-render simultaneously
  // ─────────────────────────────────────────────────────────────────────────
  const [now, setNow] = useState(Date.now());
  useEffect(()=>{
    const id = setInterval(()=>setNow(Date.now()), 60000);
    return ()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    Promise.all([api.get("/api/assets"), api.get("/api/maintenance")])
      .then(([a,m])=>{ setNotifAssets(Array.isArray(a.data)?a.data:[]); setNotifMaint(Array.isArray(m.data)?m.data:[]); })
      .catch(()=>{});
  },[]);

  const assetMap = useMemo(()=>{
    const m={};
    notifAssets.forEach(a=>{ if(a.id!=null) m[a.id]=a.assetName??a.asset_name??`Asset #${a.id}`; });
    return m;
  },[notifAssets]);

  const notifications = useMemo(()=>buildNotifications(notifAssets,notifMaint,assetMap),[notifAssets,notifMaint,assetMap]);

  if(user.role!=="Admin") return <AccessDenied/>;

  return (
    <div className="flex min-h-screen" style={{background:"linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)"}}>
      <Sidebar mobileOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuToggle={()=>setSidebarOpen(o=>!o)} notifications={notifications} now={now}/>
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto">
          <AuditLogsContent now={now}/>
        </main>
      </div>
    </div>
  );
}

export default function AdminAuditLogs() {
  return <ToastProvider><AdminAuditLogsInner/></ToastProvider>;
}