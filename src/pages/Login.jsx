// ─────────────────────────────────────────────────────────────
// Login.jsx — Fully Responsive (Mobile + Tablet + Desktop)
//
// ═══════════════════════════════════════════════════════════
// RESPONSIVE CHANGES APPLIED  (search "// RESPONSIVE" to jump)
// ═══════════════════════════════════════════════════════════
//
// RESPONSIVE 1 — Root container padding
//   Mobile:  p-3   (tight edges on small phones)
//   Tablet:  p-6   (comfortable breathing room)
//   Desktop: p-8   (original generous padding)
//
// RESPONSIVE 2 — Main layout direction
//   Mobile + Tablet (< lg):  column (card centred, no left panel)
//   Desktop (lg+):           row (left panel + right card side by side)
//
// RESPONSIVE 3 — Left info panel
//   Hidden on mobile + tablet (< lg)
//   Visible on desktop (lg+) — unchanged content
//
// RESPONSIVE 4 — Glass card sizing + padding
//   Mobile:  full width, p-6, rounded-2xl (smaller radius feels better)
//   Tablet:  max-w-sm centred, p-7
//   Desktop: max-w-md, p-8, rounded-3xl (original)
//
// RESPONSIVE 5 — Heading sizes
//   Mobile:  text-xl
//   Tablet:  text-2xl
//   Desktop: text-2xl (original)
//
// RESPONSIVE 6 — Input fields
//   Slightly reduced vertical padding on mobile (py-2.5 vs py-3)
//   to keep the form above the keyboard on small screens
//
// RESPONSIVE 7 — Logo on mobile
//   Logo badge shown on all screens < lg (was already correct)
//   Size scaled: mobile w-10 h-10, tablet w-12 h-12
//
// RESPONSIVE 8 — Decorative orbs
//   Scaled down on mobile so they don't dominate the small screen
//
// ALL LOGIN LOGIC (API call, validation, localStorage, routing) — UNCHANGED
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// AXIOS INSTANCE (unchanged)
// ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "https://asset-management-system.onrender.com",
  headers: { "Content-Type": "application/json" },
  timeout: 8000,
});

// ─────────────────────────────────────────────────────────────
// ICONS — pure SVG (unchanged)
// ─────────────────────────────────────────────────────────────
function EmailIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function EyeIcon({ show }) {
  return show ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();

  // ── STATE (unchanged) ──────────────────────────────────────
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // ── HANDLE LOGIN (unchanged) ───────────────────────────────
  const handleLogin = async () => {
    setError("");
    if (!email.trim())    { setError("Please enter your email address."); return; }
    if (!password.trim()) { setError("Please enter your password.");       return; }
    setLoading(true);
    try {
      const response = await api.post("/api/login", { email, password });
      const user     = response.data;
      localStorage.setItem("user", JSON.stringify(user));
      if (user.role === "Admin") { navigate("/dashboard"); }
      else                       { navigate("/assets");    }
    } catch (err) {
      if      (err.response?.status === 401 || err.response?.status === 403) setError("Invalid email or password. Please try again.");
      else if (err.code === "ERR_NETWORK") setError("Cannot reach the server. Is Spring Boot running?");
      else    setError("Login failed. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleLogin(); };

  // ── Shared input focus/blur handlers ──────────────────────
  const onFocus = (e) => {
    e.target.style.border    = "1px solid rgba(99,102,241,0.7)";
    e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.05)";
  };
  const onBlur = (e) => {
    e.target.style.border    = "1px solid rgba(255,255,255,0.12)";
    e.target.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";
  };

  // ── UI ────────────────────────────────────────────────────
  return (
    // RESPONSIVE 1: padding scales with screen size
    <div
      className="min-h-screen flex items-center justify-center p-3 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #134e4a 100%)" }}
    >

      {/*
        RESPONSIVE 8: Decorative orbs
        Scaled down on mobile (w-48 h-48) → full size on desktop (w-96 h-96)
        so they don't cover the login card on small screens
      */}
      <div className="absolute top-0 left-0 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
      <div className="absolute bottom-0 right-0 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />
      <div className="absolute top-1/2 left-1/4 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%)" }} />

      {/*
        RESPONSIVE 2: Layout direction
        Mobile + Tablet: flex-col, items centred (left panel hidden, card takes full width)
        Desktop (lg+):   flex-row, left panel + card side by side
      */}
      <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center gap-6 lg:gap-8 relative z-10">

        {/*
          RESPONSIVE 3: Left panel
          Hidden below lg, fully visible at lg+
          Content unchanged — only visibility changed
        */}
        <div className="hidden lg:flex flex-col flex-1 px-4">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #818cf8, #34d399)", boxShadow: "0 0 24px rgba(129,140,248,0.5)" }}>
              ⚙
            </div>
            <div>
              <div className="text-white font-bold text-xl tracking-tight">AssetAI</div>
              <div className="text-indigo-300 text-xs tracking-widest uppercase font-medium">Management Suite</div>
            </div>
          </div>

          {/* Welcome heading */}
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Manage Your Assets<br />
            <span style={{ background: "linear-gradient(90deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Smarter & Faster
            </span>
          </h1>
          <p className="text-indigo-300 text-sm leading-relaxed mb-10 max-w-sm">
            Track, monitor, and optimise your organisation's assets in real time.
            Role-based access. Full audit trail. AI-powered insights.
          </p>

          {/* Feature bullets */}
          <div className="flex flex-col gap-3">
            {[
              { icon: "📦", text: "Real-time asset tracking"        },
              { icon: "🔧", text: "Automated maintenance scheduling" },
              { icon: "📊", text: "Advanced analytics & reports"     },
              { icon: "★",  text: "AI-driven cost insights"          },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  {f.icon}
                </div>
                <span className="text-indigo-200 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/*
          RESPONSIVE 4: Glass card
          Mobile:  w-full, max-w-none,  p-6,  rounded-2xl
          Tablet:  w-full, max-w-sm,    p-7,  rounded-2xl
          Desktop: w-full, max-w-md,    p-8,  rounded-3xl
        */}
        <div
          className="w-full max-w-sm sm:max-w-sm lg:max-w-md flex-shrink-0
            rounded-2xl lg:rounded-3xl
            p-6 sm:p-7 lg:p-8"
          style={{
            background:           "rgba(255, 255, 255, 0.07)",
            backdropFilter:       "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border:               "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow:            "0 32px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >

          {/* ── Card header ── */}
          <div className="text-center mb-6 sm:mb-8">
            {/*
              RESPONSIVE 7: Logo — shown on all screens < lg
              Size: w-10 h-10 on mobile, w-12 h-12 on tablet+
            */}
            <div className="flex lg:hidden justify-center mb-4">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl"
                style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 24px rgba(129,140,248,0.5)" }}
              >⚙</div>
            </div>

            {/* RESPONSIVE 5: Heading scales with screen */}
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
              AssetAI Management System
            </h2>
            <p className="text-indigo-300 text-xs tracking-widest uppercase font-medium">
              🔒 Secure Login Portal
            </p>
          </div>

          {/* ── Email input ── */}
          <div className="mb-3 sm:mb-4">
            <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1.5 sm:mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400">
                <EmailIcon />
              </div>
              {/*
                RESPONSIVE 6: Reduced vertical padding on mobile (py-2.5)
                so more of the form is visible above the keyboard
              */}
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl text-sm text-white placeholder-indigo-400 outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border:     error && !email ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              />
            </div>
          </div>

          {/* ── Password input ── */}
          <div className="mb-5 sm:mb-6">
            <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1.5 sm:mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400">
                <LockIcon />
              </div>
              {/* RESPONSIVE 6: Same reduced padding on mobile */}
              <input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                className="w-full pl-10 pr-11 py-2.5 sm:py-3 rounded-xl text-sm text-white placeholder-indigo-400 outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border:     error && !password ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-200 transition-colors"
                tabIndex={-1}
              >
                <EyeIcon show={showPass} />
              </button>
            </div>
          </div>

          {/* ── Error message (unchanged) ── */}
          {error && (
            <div className="flex items-center gap-2 mb-4 sm:mb-5 px-3 py-2.5 rounded-xl text-xs text-red-300 font-medium"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <span className="text-sm flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── Login button ── */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 sm:py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-250 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(90deg, #4f46e5, #9333ea, #ec4899)",
              boxShadow:  loading ? "none" : "0 4px 20px rgba(79,70,229,0.45)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = "scale(1.02) translateY(-1px)";
                e.target.style.boxShadow = "0 8px 30px rgba(79,70,229,0.6)";
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 4px 20px rgba(79,70,229,0.45)";
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Signing in…
              </span>
            ) : (
              "Sign In →"
            )}
          </button>

          {/* ── Feature bullets — visible on mobile only (replaces hidden left panel) ── */}
          {/*
            RESPONSIVE 3 (supplement): On mobile/tablet, show a compact
            feature list INSIDE the card so users understand the product.
            Hidden on desktop (lg+) because the full left panel shows it there.
          */}
          <div className="mt-5 pt-5 border-t border-white/10 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "📦", text: "Asset Tracking"    },
                { icon: "🔧", text: "Maintenance"       },
                { icon: "📊", text: "Analytics"         },
                { icon: "★",  text: "AI Insights"       },
              ].map((f) => (
                <div key={f.text} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)" }}>
                  <span className="text-sm flex-shrink-0">{f.icon}</span>
                  <span className="text-indigo-300 text-xs font-medium">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer note ── */}
          <p className="text-center text-indigo-400 text-xs mt-5 sm:mt-6">
            Protected by AssetAI · Role-based access control
          </p>

        </div>
        {/* end glass card */}

      </div>
      {/* end layout */}

    </div>
  );
}