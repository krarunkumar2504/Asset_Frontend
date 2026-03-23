// ─────────────────────────────────────────────────────────────
// Reports.jsx — ZERO external chart dependencies
// All 3 charts are built with pure SVG + CSS divs.
// Only React's useState is imported — nothing else needed.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";

// ─────────────────────────────────────────────────────────────
// MOCK DATA — swap with API calls in production
// ─────────────────────────────────────────────────────────────

const COST_TREND = [
  { month: "Jan", cost: 6200  },
  { month: "Feb", cost: 9800  },
  { month: "Mar", cost: 7400  },
  { month: "Apr", cost: 12400 },
  { month: "May", cost: 10100 },
  { month: "Jun", cost: 8700  },
];

const DEPT_VALUES = [
  { dept: "IT",      value: 920, color: "#4f46e5" },
  { dept: "DevOps",  value: 762, color: "#9333ea" },
  { dept: "Finance", value: 648, color: "#14b8a6" },
  { dept: "Sales",   value: 578, color: "#f59e0b" },
  { dept: "HR",      value: 440, color: "#ec4899" },
  { dept: "Ops",     value: 350, color: "#10b981" },
];

const ASSET_TYPES = [
  { name: "Laptops", value: 36, color: "#4f46e5" },
  { name: "Servers", value: 24, color: "#9333ea" },
  { name: "Network", value: 20, color: "#14b8a6" },
  { name: "Mobile",  value: 12, color: "#f59e0b" },
  { name: "Other",   value: 8,  color: "#ec4899" },
];

const TOP_ASSETS = [
  { name: "Dell Server R740", cost: "$2,840", value: "$8,200", ratio: "34.6%", level: "high",   status: "Active"      },
  { name: 'MacBook Pro 16"',  cost: "$1,920", value: "$2,400", ratio: "80.0%", level: "high",   status: "Active"      },
  { name: "Cisco Router X1",  cost: "$1,640", value: "$3,600", ratio: "45.6%", level: "medium", status: "Maintenance" },
  { name: "UPS Power Backup", cost: "$1,230", value: "$2,100", ratio: "58.6%", level: "medium", status: "Maintenance" },
  { name: "HP LaserJet Pro",  cost: "$540",   value: "$1,200", ratio: "45.0%", level: "ok",     status: "Inactive"    },
];

const UNDERPERFORMING = [
  { name: 'MacBook Pro 16"',  cost: "$1,920", ratio: 80,   label: "80% of asset value"   },
  { name: "UPS Power Backup", cost: "$1,230", ratio: 58.6, label: "58.6% of asset value" },
  { name: "Cisco Router X1",  cost: "$1,640", ratio: 45.6, label: "45.6% of asset value" },
  { name: "HP LaserJet Pro",  cost: "$540",   ratio: 45,   label: "45.0% of asset value" },
];

const AI_INSIGHTS = [
  "IT equipment accounts for 62% of total maintenance spend — consider a refresh cycle to reduce costs.",
  'MacBook Pro fleet shows a cost-to-value ratio of 80% — significantly above the 15% benchmark.',
  "Q2 maintenance cost peaked 34% above Q1 — proactive servicing in Mar–Apr recommended next cycle.",
];

const KPI_CARDS = [
  { label: "Total Assets",      value: "1,284", sub: "Across all departments", icon: "🗂️", trend: "↑ 4.2%",   ok: true,  accent: "from-indigo-500 to-indigo-400", iconBg: "from-indigo-50 to-indigo-100"  },
  { label: "Maintenance Cost",  value: "$48.6K",sub: "This quarter",           icon: "💸", trend: "↑ 12.4%",  ok: false, accent: "from-purple-500 to-purple-400", iconBg: "from-purple-50 to-purple-100" },
  { label: "Avg Asset Value",   value: "$1,870",sub: "Per asset average",      icon: "📈", trend: "↑ 2.8%",   ok: true,  accent: "from-teal-400 to-emerald-400",  iconBg: "from-teal-50 to-emerald-100"  },
  { label: "Under Maintenance", value: "38",    sub: "3.0% of total fleet",   icon: "🔧", trend: "38 active", ok: false, accent: "from-amber-400 to-yellow-300",  iconBg: "from-amber-50 to-yellow-100"  },
];

const NAV_ITEMS = [
  { label: "Dashboard",   icon: "▪",  badge: null    },
  { label: "Assets",      icon: "📦", badge: "1,284" },
  { label: "Maintenance", icon: "🔧", badge: "38"    },
  { label: "Reports",     icon: "📊", badge: null    },
];

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ active, setActive }) {
  return (
    <aside
      className="w-52 flex-shrink-0 hidden md:flex flex-col py-6 px-3.5"
      style={{ background: "linear-gradient(180deg,#1e1b4b 0%,#312e81 60%,#134e4a 100%)" }}
    >
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }}>⚙</div>
        <div>
          <div className="text-white font-bold text-base">AssetAI</div>
          <div className="text-indigo-300 font-medium tracking-widest uppercase" style={{ fontSize: 9 }}>
            Management Suite
          </div>
        </div>
      </div>

      <p className="text-indigo-500 text-xs font-semibold tracking-widest uppercase px-2 mb-2">Main</p>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const on = active === item.label;
          return (
            <button key={item.label} onClick={() => setActive(item.label)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium w-full
                text-left transition-all duration-200 relative
                ${on ? "text-white" : "text-indigo-300 hover:bg-white/5 hover:text-indigo-100"}`}
              style={on ? {
                background: "linear-gradient(90deg,rgba(99,102,241,.5),rgba(20,184,166,.3))",
                boxShadow: "0 0 20px rgba(99,102,241,.3)",
              } : {}}
            >
              {on && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 rounded-r-full"
                  style={{ background: "linear-gradient(180deg,#818cf8,#34d399)" }} />
              )}
              <span className="text-sm w-4 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-xs bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3 rounded-xl border border-white/10 bg-white/5">
        <p className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">Administrator</p>
        <p className="text-sm text-indigo-100 font-medium mt-0.5">Alex Morgan</p>
        <p className="text-xs text-indigo-600 mt-0.5">v3.1.0 — Pro Plan</p>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────
function Navbar({ activePage }) {
  return (
    <header className="h-14 flex items-center px-6 gap-3 flex-shrink-0 border-b"
      style={{ background: "rgba(255,255,255,.85)", backdropFilter: "blur(12px)", borderColor: "rgba(79,70,229,.08)" }}>
      <div className="flex-1">
        <span className="text-sm font-bold text-indigo-950">Admin Dashboard</span>
        <span className="text-xs text-indigo-300"> / {activePage}</span>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 border border-indigo-100 rounded-full px-3 py-1
        text-xs text-indigo-600 bg-indigo-50/80 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        All systems operational
      </div>
      <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-sm
        border border-indigo-100 bg-indigo-50/60">
        🔔
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
          style={{ background: "linear-gradient(135deg,#f43f5e,#ec4899)", fontSize: 9 }}>4</span>
      </button>
      <div className="flex items-center gap-2 border border-indigo-100 rounded-full px-2 py-1 bg-white">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "linear-gradient(135deg,#4f46e5,#14b8a6)" }}>AM</div>
        <span className="text-xs font-medium text-slate-700 hidden sm:block">Alex M.</span>
      </div>
      <button className="text-xs text-indigo-500 border border-indigo-200 bg-indigo-50
        px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors">
        → Logout
      </button>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, trend, ok, accent, iconBg }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-indigo-50 relative overflow-hidden
      hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 cursor-default"
      style={{ boxShadow: "0 2px 12px rgba(79,70,229,.07)" }}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br ${iconBg}`}>
          {icon}
        </div>
        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5
          ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200"
               : "bg-amber-50 text-amber-700 border-amber-200"}`}>
          {trend}
        </span>
      </div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-indigo-950 leading-none tracking-tight">{value}</p>
      <p className="text-xs text-slate-300 mt-1.5">{sub}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART CARD WRAPPER
// ─────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-indigo-50 overflow-hidden"
      style={{ boxShadow: "0 2px 14px rgba(79,70,229,.06)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50">
        <span className="text-xs font-bold text-indigo-950">{title}</span>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART 1 — Line chart (pure SVG, NO recharts / NO library)
// Maps COST_TREND data points to x/y pixel coordinates,
// draws an area fill + gradient stroke line.
// ─────────────────────────────────────────────────────────────
function LineChartSVG() {
  const W = 320, H = 110;
  const PAD = { top: 8, right: 8, bottom: 22, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxCost = Math.max(...COST_TREND.map((d) => d.cost));
  const yTicks  = [0, 4000, 8000, 12000];

  // Convert each data point to SVG pixel coords
  const pts = COST_TREND.map((d, i) => ({
    x: PAD.left + (i / (COST_TREND.length - 1)) * innerW,
    y: PAD.top  + innerH - (d.cost / maxCost) * innerH,
    ...d,
  }));

  // Polyline string for the line
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // Area fill (close path to bottom)
  const areaPath =
    linePath +
    ` L${pts[pts.length - 1].x},${PAD.top + innerH}` +
    ` L${pts[0].x},${PAD.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 115 }}>
      <defs>
        <linearGradient id="lgArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4f46e5" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="lgLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>

      {/* Y-axis grid + labels */}
      {yTicks.map((t) => {
        const y = PAD.top + innerH - (t / maxCost) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
              stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end"
              fontSize="8" fill="#94a3b8" fontFamily="sans-serif">
              ${t / 1000}K
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#lgArea)" />

      {/* Line stroke */}
      <path d={linePath} fill="none"
        stroke="url(#lgLine)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots + X-axis labels */}
      {pts.map((p) => (
        <g key={p.month}>
          <circle cx={p.x} cy={p.y} r="4" fill="#9333ea" stroke="#fff" strokeWidth="1.5" />
          <text x={p.x} y={H - 3} textAnchor="middle"
            fontSize="8" fill="#94a3b8" fontFamily="sans-serif">
            {p.month}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART 2 — Donut chart (pure SVG, NO library)
// Uses SVG stroke-dasharray trick to draw arc segments.
// ─────────────────────────────────────────────────────────────
function DonutChartSVG() {
  const CX = 70, CY = 70, R = 44, STROKE = 16;
  const CIRC = 2 * Math.PI * R; // full circumference ≈ 276.5

  // Calculate each segment's dash length and cumulative offset
  let offset = 0;
  const segments = ASSET_TYPES.map((item) => {
    const dash = (item.value / 100) * CIRC;
    const seg  = { ...item, dash, offset: -offset };
    offset    += dash;
    return seg;
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 140" style={{ width: 130, height: 130 }}>
        {/* Grey background ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />

        {/* One circle per segment — rotate so arc starts at top (−90°) */}
        {segments.map((seg) => (
          <circle key={seg.name} cx={CX} cy={CY} r={R} fill="none"
            stroke={seg.color} strokeWidth={STROKE}
            strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ))}

        {/* Centre text */}
        <text x={CX} y={CY - 4} textAnchor="middle"
          fontSize="13" fontWeight="700" fill="#1e1b4b" fontFamily="sans-serif">
          1,284
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle"
          fontSize="8" fill="#94a3b8" fontFamily="sans-serif">
          Assets
        </text>
      </svg>

      {/* Colour legend */}
      <div className="w-full flex flex-col gap-1.5 mt-1">
        {ASSET_TYPES.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="flex-1">{item.name}</span>
            <span className="font-semibold text-indigo-950">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CHART 3 — Horizontal bar chart (pure CSS divs, NO library)
// Renders a labelled track + filled bar for each department.
// ─────────────────────────────────────────────────────────────
function BarChartCSS() {
  const maxVal = Math.max(...DEPT_VALUES.map((d) => d.value));

  return (
    <div className="flex flex-col gap-2.5">
      {DEPT_VALUES.map((item) => (
        <div key={item.dept} className="flex items-center gap-2">
          {/* Department label */}
          <span className="text-xs text-slate-500 text-right flex-shrink-0" style={{ width: 50 }}>
            {item.dept}
          </span>

          {/* Grey track + coloured fill */}
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.value / maxVal) * 100}%`, background: item.color }}
            />
          </div>

          {/* Dollar value */}
          <span className="text-xs font-semibold text-indigo-950 flex-shrink-0 text-right" style={{ width: 42 }}>
            ${item.value}K
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    Active:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
    Maintenance: "bg-amber-50   text-amber-700   border border-amber-200",
    Inactive:    "bg-red-50     text-red-700     border border-red-200",
  };
  const dots = { Active: "bg-emerald-500", Maintenance: "bg-amber-500", Inactive: "bg-red-500" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      <span className={`w-1 h-1 rounded-full ${dots[status]}`} />
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// TABLE ROW
// ─────────────────────────────────────────────────────────────
function TableRow({ row, isEven }) {
  const color = { high: "text-red-600", medium: "text-amber-600", ok: "text-emerald-600" };
  return (
    <tr className={`hover:bg-indigo-50/50 transition-colors cursor-pointer ${isEven ? "bg-slate-50/70" : ""}`}>
      <td className="px-4 py-2.5 text-sm font-semibold text-indigo-950">{row.name}</td>
      <td className={`px-4 py-2.5 text-sm font-bold ${color[row.level]}`}>{row.cost}</td>
      <td className="px-4 py-2.5 text-sm text-slate-600">{row.value}</td>
      <td className={`px-4 py-2.5 text-xs font-semibold ${color[row.level]}`}>{row.ratio}</td>
      <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// AI INSIGHTS PANEL
// ─────────────────────────────────────────────────────────────
function AiPanel() {
  return (
    <div className="rounded-2xl p-4 flex items-start gap-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#134e4a 100%)" }}>
      {/* Decorative glow orbs */}
      <div className="absolute -top-5 right-20 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(99,102,241,.45),transparent 70%)" }} />
      <div className="absolute -bottom-5 right-0 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(20,184,166,.35),transparent 70%)" }} />

      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
        style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 14px rgba(129,140,248,.5)" }}>
        ★
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-400 font-semibold tracking-widest uppercase mb-2">AI Analytics Insights</p>
        <div className="flex flex-col gap-2">
          {AI_INSIGHTS.map((text, i) => (
            <div key={i}
              className="flex gap-2 items-start rounded-xl p-2.5 text-xs text-indigo-200 leading-relaxed border"
              style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.08)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                style={{ background: "linear-gradient(135deg,#818cf8,#34d399)" }} />
              {text}
            </div>
          ))}
        </div>
      </div>

      <span className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 border mt-0.5"
        style={{ background: "rgba(99,102,241,.25)", color: "#a5b4fc", borderColor: "rgba(129,140,248,.3)" }}>
        5 Insights
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UNDERPERFORMING ASSETS CARD
// ─────────────────────────────────────────────────────────────
function UnderperformingCard() {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden w-56 flex-shrink-0"
      style={{ borderColor: "rgba(239,68,68,.15)", boxShadow: "0 2px 14px rgba(239,68,68,.07)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "rgba(239,68,68,.1)", background: "linear-gradient(90deg,#fef2f2,#fff)" }}>
        <span>⚠️</span>
        <span className="text-xs font-bold text-red-700">Underperforming</span>
      </div>

      {UNDERPERFORMING.map((item) => (
        <div key={item.name}
          className="px-4 py-2.5 border-b border-red-50 hover:bg-red-50/30 transition-colors cursor-pointer last:border-b-0">
          <p className="text-xs font-semibold text-indigo-950">{item.name}</p>
          <p className="text-xs text-red-600 font-semibold mt-0.5">{item.cost} maintenance</p>
          <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
          <div className="h-1 bg-red-100 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full rounded-full"
              style={{ width: `${item.ratio}%`, background: "linear-gradient(90deg,#f87171,#fca5a5)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DOWNLOAD SECTION
// ─────────────────────────────────────────────────────────────
const DOWNLOADS = [
  {
    label: "Download PDF Report", desc: "Full analytics summary, charts & insights",
    icon: "📄", btnText: "PDF ↓", iconBg: "from-red-50 to-rose-100",
    btnStyle: { background: "linear-gradient(90deg,#f43f5e,#ec4899)", boxShadow: "0 3px 10px rgba(244,63,94,.3)" },
  },
  {
    label: "Download CSV Data", desc: "Raw asset and maintenance records",
    icon: "📊", btnText: "CSV ↓", iconBg: "from-emerald-50 to-teal-100",
    btnStyle: { background: "linear-gradient(90deg,#10b981,#14b8a6)", boxShadow: "0 3px 10px rgba(16,185,129,.3)" },
  },
];

function DownloadSection() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {DOWNLOADS.map((b) => (
        <div key={b.label}
          className="bg-white rounded-2xl border border-indigo-50 p-4 flex items-center gap-3
            hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer"
          style={{ boxShadow: "0 2px 10px rgba(79,70,229,.05)" }}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br ${b.iconBg} flex-shrink-0`}>
            {b.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-950">{b.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{b.desc}</p>
          </div>
          <button className="text-xs font-semibold text-white px-4 py-2 rounded-lg hover:scale-105 transition-all"
            style={b.btnStyle}>
            {b.btnText}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REPORTS — main page, assembles all sections
// ─────────────────────────────────────────────────────────────
function Reports() {
  const [dateFilter, setDateFilter] = useState("2026-03");

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-indigo-950 tracking-tight">Reports & Analytics</h1>
          <p className="text-xs text-slate-400 mt-0.5">Analyze asset performance and maintenance trends</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-indigo-100 rounded-xl text-xs bg-white text-slate-600 outline-none
              focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50" />
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white
              transition-all duration-250 hover:scale-105 hover:shadow-xl"
            style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea,#ec4899)", boxShadow: "0 4px 15px rgba(79,70,229,.35)" }}>
            ⬇ Download Report
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map((card) => <KpiCard key={card.label} {...card} />)}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Chart 1 — Line chart */}
        <ChartCard title="Maintenance Cost Trend" subtitle="Jan – Jun 2026">
          <LineChartSVG />
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-4 h-0.5 rounded-full inline-block"
                style={{ background: "linear-gradient(90deg,#4f46e5,#9333ea)" }} />
              Cost ($)
            </div>
            <span className="ml-auto text-xs text-slate-400">
              Peak: <span className="text-purple-600 font-semibold">$12.4K</span> in Apr
            </span>
          </div>
        </ChartCard>

        {/* Chart 2 — Donut chart */}
        <ChartCard title="Asset Type Distribution">
          <DonutChartSVG />
        </ChartCard>

        {/* Chart 3 — Bar chart */}
        <ChartCard title="Dept. Asset Value" subtitle="$K">
          <BarChartCSS />
        </ChartCard>

      </div>

      {/* ── AI Insights ── */}
      <AiPanel />

      {/* ── Bottom row: Table + Underperforming ── */}
      <div className="flex flex-col lg:flex-row gap-3">

        {/* Top assets table */}
        <div className="flex-1 bg-white rounded-2xl border border-indigo-50 overflow-hidden"
          style={{ boxShadow: "0 2px 14px rgba(79,70,229,.06)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-50">
            <span className="text-sm font-bold text-indigo-950">Top Assets by Maintenance Cost</span>
            <span className="text-xs text-slate-400">Sorted by cost ↓</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "linear-gradient(90deg,#f8f8ff,#f0fdfa)" }}>
                  {["Asset Name", "Maint. Cost", "Current Value", "Cost Ratio", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOP_ASSETS.map((row, i) => (
                  <TableRow key={row.name} row={row} isEven={i % 2 !== 0} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <UnderperformingCard />
      </div>

      {/* ── Download Section ── */}
      <DownloadSection />

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT — layout wrapper (Sidebar + Navbar + Page)
// ─────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [activePage, setActivePage] = useState("Reports");

  return (
    <div className="flex min-h-screen"
      style={{ background: "linear-gradient(135deg,#f0f0ff 0%,#f5f9ff 50%,#f0fff8 100%)" }}>
      <Sidebar active={activePage} setActive={setActivePage} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar activePage={activePage} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Reports />
        </main>
      </div>
    </div>
  );
}