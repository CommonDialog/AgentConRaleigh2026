import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider, useToast } from "./components/Toast";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { onApiError } from "./lib/api";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Staging } from "./pages/Staging";
import { Environmental } from "./pages/Environmental";
import { Declutter } from "./pages/Declutter";
import { Sketch } from "./pages/Sketch";
import { Optimize } from "./pages/Optimize";
import { Resize } from "./pages/Resize";
import { Billing } from "./pages/Billing";
import { Profile } from "./pages/Profile";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function GlobalErrorBridge() {
  const { push } = useToast();
  useEffect(() => {
    return onApiError((err) => {
      if (err.status === 401) {
        if (location.pathname !== "/login") {
          push({ variant: "warning", title: "Session expired", description: "Please log in again." });
          setTimeout(() => (window.location.href = "/login"), 800);
        }
      } else if (err.status === 402) {
        push({ variant: "warning", title: "Not enough credits", description: "Visit Billing to top up." });
      } else if (err.status === 429) {
        push({ variant: "warning", title: "Too many requests", description: "Please wait a moment." });
      } else if (err.status >= 500) {
        push({ variant: "error", title: "Server error", description: err.message });
      }
    });
  }, [push]);
  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <GlobalErrorBridge />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<Protected><AppShell><Dashboard /></AppShell></Protected>} />
              <Route path="/projects" element={<Protected><AppShell><Projects /></AppShell></Protected>} />
              <Route path="/projects/:id" element={<Protected><AppShell><ProjectDetail /></AppShell></Protected>} />
              <Route path="/staging" element={<Protected><AppShell><Staging /></AppShell></Protected>} />
              <Route path="/environmental" element={<Protected><AppShell><Environmental /></AppShell></Protected>} />
              <Route path="/declutter" element={<Protected><AppShell><Declutter /></AppShell></Protected>} />
              <Route path="/sketch" element={<Protected><AppShell><Sketch /></AppShell></Protected>} />
              <Route path="/optimize" element={<Protected><AppShell><Optimize /></AppShell></Protected>} />
              <Route path="/resize" element={<Protected><AppShell><Resize /></AppShell></Protected>} />
              <Route path="/billing" element={<Protected><AppShell><Billing /></AppShell></Protected>} />
              <Route path="/profile" element={<Protected><AppShell><Profile /></AppShell></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
