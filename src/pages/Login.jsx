// ─────────────────────────────────────────────────────────────
// Login.jsx — Updated with eye-catching animated error popup
// All original responsive behaviour preserved.
// NEW: Animated error toast popup with shake + slide-in effect
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const api = axios.create({
  baseURL: "https://assest-management-system.onrender.com/",
  headers: { "Content-Type": "application/json" },
  timeout: 8000,
});

// ─── Icons ───────────────────────────────────────────────────
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

// ─── Error types → config ────────────────────────────────────
const ERROR_CFG = {
  credentials: {
    icon: "🔐",
    title: "Invalid Credentials",
    color: "#ef4444",
    bg: "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(220,38,38,0.12))",
    border: "rgba(239,68,68,0.45)",
    glow: "0 0 0 1px rgba(239,68,68,0.3), 0 16px 48px rgba(239,68,68,0.25), 0 4px 16px rgba(0,0,0,0.3)",
    bar: "linear-gradient(90deg,#ef4444,#f87171,#fca5a5)",
    accent: "#fca5a5",
  },
  network: {
    icon: "📡",
    title: "Connection Failed",
    color: "#f59e0b",
    bg: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.12))",
    border: "rgba(245,158,11,0.45)",
    glow: "0 0 0 1px rgba(245,158,11,0.3), 0 16px 48px rgba(245,158,11,0.2), 0 4px 16px rgba(0,0,0,0.3)",
    bar: "linear-gradient(90deg,#f59e0b,#fcd34d,#fef08a)",
    accent: "#fde68a",
  },
  validation: {
    icon: "⚠️",
    title: "Missing Fields",
    color: "#a78bfa",
    bg: "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(124,58,237,0.12))",
    border: "rgba(167,139,250,0.45)",
    glow: "0 0 0 1px rgba(167,139,250,0.3), 0 16px 48px rgba(167,139,250,0.2), 0 4px 16px rgba(0,0,0,0.3)",
    bar: "linear-gradient(90deg,#a78bfa,#c4b5fd,#ddd6fe)",
    accent: "#ddd6fe",
  },
  generic: {
    icon: "❌",
    title: "Login Failed",
    color: "#f87171",
    bg: "linear-gradient(135deg, rgba(248,113,113,0.18), rgba(239,68,68,0.12))",
    border: "rgba(248,113,113,0.45)",
    glow: "0 0 0 1px rgba(248,113,113,0.3), 0 16px 48px rgba(248,113,113,0.2), 0 4px 16px rgba(0,0,0,0.3)",
    bar: "linear-gradient(90deg,#f87171,#fca5a5,#fecaca)",
    accent: "#fecaca",
  },
};

// ─── Animated Error Popup ────────────────────────────────────
function ErrorPopup({ error, type, onClose }) {
  const cfg = ERROR_CFG[type] ?? ERROR_CFG.generic;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [shake, setShake] = useState(false);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const DURATION = 5000;

  useEffect(() => {
    if (!error) return;
    setVisible(false);
    setProgress(100);
    clearInterval(progressRef.current);
    clearTimeout(timerRef.current);
    // Trigger shake + slide-in
    requestAnimationFrame(() => {
      setVisible(true);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    });
    // Progress bar drain
    const step = 100 / (DURATION / 50);
    progressRef.current = setInterval(() => {
      setProgress(p => {
        if (p <= 0) { clearInterval(progressRef.current); return 0; }
        return p - step;
      });
    }, 50);
    // Auto-dismiss
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 400);
    }, DURATION);
    return () => { clearInterval(progressRef.current); clearTimeout(timerRef.current); };
  }, [error]);

  const dismiss = () => {
    clearInterval(progressRef.current);
    clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(onClose, 400);
  };

  if (!error) return null;

  return (
    <>
      {/* Inject keyframes */}
      <style>{`
        @keyframes slideDown {
          from { opacity:0; transform: translateY(-24px) scale(0.94); }
          to   { opacity:1; transform: translateY(0)     scale(1);    }
        }
        @keyframes slideUp {
          from { opacity:1; transform: translateY(0)    scale(1);    }
          to   { opacity:0; transform: translateY(-16px) scale(0.96); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-7px); }
          30%      { transform: translateX(7px); }
          45%      { transform: translateX(-5px); }
          60%      { transform: translateX(5px); }
          75%      { transform: translateX(-3px); }
          90%      { transform: translateX(3px); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity:0.7; }
          100% { transform: scale(1.5);  opacity:0;   }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          animation: visible
            ? (shake ? "shake 0.55s ease, slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1)" : "slideDown 0.4s cubic-bezier(0.34,1.56,0.64,1)")
            : "slideUp 0.38s ease forwards",
          background: cfg.bg,
          border: `1.5px solid ${cfg.border}`,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: cfg.glow,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          marginBottom: 20,
          position: "relative",
        }}
      >
        {/* Top shimmer bar */}
        <div style={{ height: 3, background: cfg.bar, position: "absolute", top: 0, left: 0, right: 0 }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 14px 12px 14px" }}>
          {/* Icon with pulse ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              position: "absolute", inset: -4,
              borderRadius: "50%",
              border: `2px solid ${cfg.color}`,
              animation: "pulse-ring 1.4s ease-out infinite",
            }} />
            <div style={{
              width: 40, height: 40, borderRadius: 13,
              background: `linear-gradient(135deg, ${cfg.color}33, ${cfg.color}1a)`,
              border: `1px solid ${cfg.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 19,
              boxShadow: `0 4px 12px ${cfg.color}44`,
            }}>
              {cfg.icon}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                background: `${cfg.color}22`, color: cfg.color,
                borderRadius: 5, padding: "2px 7px",
                border: `1px solid ${cfg.color}44`,
                textTransform: "uppercase",
              }}>
                {type === "network" ? "NETWORK" : type === "validation" ? "VALIDATION" : type === "credentials" ? "AUTH ERROR" : "ERROR"}
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3, lineHeight: 1.3 }}>
              {cfg.title}
            </p>
            <p style={{ fontSize: 12, color: cfg.accent, lineHeight: 1.55, margin: 0, opacity: 0.9 }}>
              {error}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={dismiss}
            style={{
              width: 26, height: 26, borderRadius: 8, border: "none",
              background: "rgba(255,255,255,0.08)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "rgba(255,255,255,0.5)", flexShrink: 0, marginTop: 2,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: cfg.bar,
            transition: "width 0.05s linear",
          }} />
        </div>
      </div>
    </>
  );
}

// ─── Main Login Component ─────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [errType,  setErrType]  = useState("generic");
  const [loading,  setLoading]  = useState(false);
  // Track error "key" so same error re-triggers animation
  const [errKey,   setErrKey]   = useState(0);

  const showError = (msg, type = "generic") => {
    setError(msg);
    setErrType(type);
    setErrKey(k => k + 1);
  };

  const handleLogin = async () => {
    setError("");
    if (!email.trim() && !password.trim()) { showError("Please enter your email and password to continue.", "validation"); return; }
    if (!email.trim())    { showError("Email address is required to sign in.", "validation"); return; }
    if (!password.trim()) { showError("Password cannot be empty. Please enter your password.", "validation"); return; }

    setLoading(true);
    try {
      const response = await api.post("/api/login", { email, password });
      const user = response.data;
      localStorage.setItem("user", JSON.stringify(user));
      if (user.role === "Admin") navigate("/dashboard");
      else                       navigate("/assets");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        showError("The email or password you entered is incorrect. Please check and try again.", "credentials");
      } else if (err.code === "ERR_NETWORK") {
        showError("Unable to reach the server. Please check your internet connection or try again later.", "network");
      } else {
        showError("Something went wrong during login. Please try again in a moment.", "generic");
      }
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleLogin(); };

  const onFocus = (e) => {
    e.target.style.border    = "1px solid rgba(99,102,241,0.7)";
    e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.05)";
  };
  const onBlur = (e) => {
    e.target.style.border    = "1px solid rgba(255,255,255,0.12)";
    e.target.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-3 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #134e4a 100%)" }}
    >
      {/* Decorative orbs */}
      <div className="absolute top-0 left-0 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
      <div className="absolute bottom-0 right-0 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(20,184,166,0.2) 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />
      <div className="absolute top-1/2 left-1/4 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%)" }} />

      <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center gap-6 lg:gap-8 relative z-10">

        {/* Left panel — desktop only */}
        <div className="hidden lg:flex flex-col flex-1 px-4">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #818cf8, #34d399)", boxShadow: "0 0 24px rgba(129,140,248,0.5)" }}>⚙</div>
            <div>
              <div className="text-white font-bold text-xl tracking-tight">AssetAI</div>
              <div className="text-indigo-300 text-xs tracking-widest uppercase font-medium">Management Suite</div>
            </div>
          </div>
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

        {/* Glass card */}
        <div
          className="w-full max-w-sm sm:max-w-sm lg:max-w-md flex-shrink-0 rounded-2xl lg:rounded-3xl p-6 sm:p-7 lg:p-8"
          style={{
            background:           "rgba(255, 255, 255, 0.07)",
            backdropFilter:       "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border:               "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow:            "0 32px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Card header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex lg:hidden justify-center mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl"
                style={{ background: "linear-gradient(135deg,#818cf8,#34d399)", boxShadow: "0 0 24px rgba(129,140,248,0.5)" }}>⚙</div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
              AssetAI Management System
            </h2>
            <p className="text-indigo-300 text-xs tracking-widest uppercase font-medium">
              🔒 Secure Login Portal
            </p>
          </div>

          {/* ── ERROR POPUP ── */}
          {error && (
            <ErrorPopup
              key={errKey}
              error={error}
              type={errType}
              onClose={() => setError("")}
            />
          )}

          {/* Email */}
          <div className="mb-3 sm:mb-4">
            <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1.5 sm:mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400"><EmailIcon /></div>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl text-sm text-white placeholder-indigo-400 outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border:     error && errType === "validation" && !email ? "1px solid rgba(167,139,250,0.6)" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-5 sm:mb-6">
            <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1.5 sm:mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400"><LockIcon /></div>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                onKeyDown={handleKeyDown}
                onFocus={onFocus}
                onBlur={onBlur}
                className="w-full pl-10 pr-11 py-2.5 sm:py-3 rounded-xl text-sm text-white placeholder-indigo-400 outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border:     error && errType === "validation" && !password ? "1px solid rgba(167,139,250,0.6)" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-200 transition-colors" tabIndex={-1}>
                <EyeIcon show={showPass} />
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 sm:py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-250 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(90deg, #4f46e5, #9333ea, #ec4899)",
              boxShadow:  loading ? "none" : "0 4px 20px rgba(79,70,229,0.45)",
            }}
            onMouseEnter={(e) => { if (!loading) { e.target.style.transform = "scale(1.02) translateY(-1px)"; e.target.style.boxShadow = "0 8px 30px rgba(79,70,229,0.6)"; } }}
            onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 20px rgba(79,70,229,0.45)"; }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Signing in…
              </span>
            ) : "Sign In →"}
          </button>

          {/* Mobile feature bullets */}
          <div className="mt-5 pt-5 border-t border-white/10 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {[{ icon:"📦",text:"Asset Tracking"},{icon:"🔧",text:"Maintenance"},{icon:"📊",text:"Analytics"},{icon:"★",text:"AI Insights"}].map((f) => (
                <div key={f.text} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background:"rgba(255,255,255,0.05)" }}>
                  <span className="text-sm flex-shrink-0">{f.icon}</span>
                  <span className="text-indigo-300 text-xs font-medium">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-indigo-400 text-xs mt-5 sm:mt-6">
            Protected by AssetAI · Role-based access control
          </p>
        </div>
      </div>
    </div>
  );
}