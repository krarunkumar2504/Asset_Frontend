import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login           from "./pages/Login";
import Dashboard       from "./pages/Dashboard";
import Assets          from "./pages/Assets";
import Maintenance     from "./pages/Maintenance";
import Reports         from "./pages/Reports";
import CreateEmployee  from "./pages/CreateEmployee";
import AdminEmployeeManagement from "./pages/AdminEmployees";

// ─────────────────────────────────────────────────────────────
// HELPER — safely read user object from localStorage
// ─────────────────────────────────────────────────────────────
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// PRIVATE ROUTE
// Any logged-in user can pass.
// Not logged in → redirect to "/" (Login page)
// ─────────────────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const user = getUser();
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTE
// Only Admins can pass.
// Not logged in       → redirect to "/" (Login)
// Logged in, not Admin → show Access Denied page
// Admin               → render the page
// ─────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const user = getUser();

  // Not logged in → go to Login
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Logged in but NOT Admin → show Access Denied
  if (user.role !== "Admin") {
    return <AccessDenied />;
  }

  return children;
}

// ─────────────────────────────────────────────────────────────
// ACCESS DENIED PAGE
// Shown when a non-Admin tries to visit /create-employee
// ─────────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 45%,#134e4a 100%)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "40px 32px",
          borderRadius: "24px",
          maxWidth: "360px",
          width: "100%",
          margin: "0 16px",
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            margin: "0 auto 20px",
            background: "linear-gradient(135deg,#ef4444,#f87171)",
            boxShadow: "0 0 24px rgba(239,68,68,0.4)",
          }}
        >
          🔒
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          Access Denied
        </h1>
        <p style={{ fontSize: 13, color: "#a5b4fc", marginBottom: 24, lineHeight: 1.6 }}>
          You need <strong style={{ color: "#c7d2fe" }}>Admin</strong> privileges
          to access this page.
        </p>

        {/* Back button */}
        <a
          href="/dashboard"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            textDecoration: "none",
            background: "linear-gradient(90deg,#4f46e5,#9333ea)",
            boxShadow: "0 4px 14px rgba(79,70,229,0.4)",
          }}
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP — all routes defined here
// ─────────────────────────────────────────────────────────────
function App() {
  return (
    <Router>
      <Routes>

        {/* Public — Login is the default page */}
        <Route path="/" element={<Login />} />

        {/* Protected — any logged-in user */}
        <Route path="/dashboard" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />

        <Route path="/assets" element={
          <PrivateRoute><Assets /></PrivateRoute>
        } />

        <Route path="/maintenance" element={
          <PrivateRoute><Maintenance /></PrivateRoute>
        } />

        <Route path="/reports" element={
          <PrivateRoute><Reports /></PrivateRoute>
        } />

        {/* Admin-only — role === "Admin" required */}
        <Route path="/create-employee" element={
          <AdminRoute><CreateEmployee /></AdminRoute>
        } />


        <Route path="/admin/employees" element={<AdminEmployeeManagement />} />

        {/* Catch-all — unknown URLs go back to Login */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;