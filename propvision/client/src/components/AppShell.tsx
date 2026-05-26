import { ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Menu, X, Sparkles, LogOut, CreditCard, User as UserIcon } from "lucide-react";
import { cn } from "../lib/cn";

const TOOLS = [
  { to: "/staging", label: "Virtual Staging" },
  { to: "/environmental", label: "Environmental" },
  { to: "/declutter", label: "Declutter" },
  { to: "/sketch", label: "Sketch to Render" },
  { to: "/optimize", label: "Optimization" },
  { to: "/resize", label: "Multi-Format Resize" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
              <Sparkles size={18} className="text-brand-500" />
              PropVision
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <NavLink to="/" end className={({ isActive }) => cn("px-3 py-1.5 rounded-md", isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100")}>
                Dashboard
              </NavLink>
              <NavLink to="/projects" className={({ isActive }) => cn("px-3 py-1.5 rounded-md", isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100")}>
                Projects
              </NavLink>
              <div className="relative">
                <button onClick={() => setToolsOpen((o) => !o)} className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100">
                  Tools
                </button>
                {toolsOpen && (
                  <div onMouseLeave={() => setToolsOpen(false)} className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                    {TOOLS.map((t) => (
                      <NavLink
                        key={t.to}
                        to={t.to}
                        onClick={() => setToolsOpen(false)}
                        className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {t.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Link to="/billing" className="hidden sm:inline-flex badge bg-brand-50 text-brand-700 hover:bg-brand-100">
                {user.creditsBalance} credits
              </Link>
            )}
            <div className="relative">
              <button onClick={() => setUserOpen((o) => !o)} className="h-8 w-8 rounded-full bg-brand-500 text-white text-sm font-semibold flex items-center justify-center">
                {user?.name?.[0]?.toUpperCase() || "?"}
              </button>
              {userOpen && (
                <div onMouseLeave={() => setUserOpen(false)} className="absolute top-full right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                  <div className="px-3 py-2 text-xs text-slate-500 truncate">{user?.email}</div>
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><UserIcon size={14} />Profile</Link>
                  <Link to="/billing" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><CreditCard size={14} />Billing</Link>
                  <button onClick={onLogout} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><LogOut size={14} />Logout</button>
                </div>
              )}
            </div>
            <button className="md:hidden btn-ghost p-2" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)}>
            <div className="absolute right-0 top-0 h-full w-72 bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">Menu</span>
                <button onClick={() => setMobileOpen(false)} className="btn-ghost p-2"><X size={18} /></button>
              </div>
              <nav className="flex flex-col gap-1 text-sm">
                <NavLink to="/" end onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded hover:bg-slate-100">Dashboard</NavLink>
                <NavLink to="/projects" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded hover:bg-slate-100">Projects</NavLink>
                <div className="mt-2 mb-1 text-xs uppercase tracking-wide text-slate-400 px-3">Tools</div>
                {TOOLS.map((t) => (
                  <NavLink key={t.to} to={t.to} onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded hover:bg-slate-100">
                    {t.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
