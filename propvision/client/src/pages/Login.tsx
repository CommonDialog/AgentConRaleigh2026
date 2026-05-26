import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function Login() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("agent@propvision.local");
  const [password, setPassword] = useState("agent123");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      await refresh();
      nav("/");
    } catch (e) {
      setErr(e instanceof ApiError ? e.code : "login_failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="card p-8 w-full max-w-md">
        <div className="flex items-center gap-2 font-semibold text-lg mb-1"><Sparkles size={18} className="text-brand-500" />PropVision</div>
        <h1 className="text-xl font-bold mb-6">Welcome back</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <div className="text-sm text-red-600">{err === "invalid_credentials" ? "Email or password incorrect." : err}</div>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="text-sm text-slate-500 mt-4 text-center">
          New here? <Link to="/register" className="text-brand-600 font-medium">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
