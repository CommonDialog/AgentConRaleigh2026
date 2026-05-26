import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function Register() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"AGENT" | "ARCHITECT">("AGENT");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/auth/register", { method: "POST", body: { name, email, password, role } });
      await refresh();
      nav("/");
    } catch (e) {
      setErr(e instanceof ApiError ? e.code : "register_failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="card p-8 w-full max-w-md">
        <div className="flex items-center gap-2 font-semibold text-lg mb-1"><Sparkles size={18} className="text-brand-500" />PropVision</div>
        <h1 className="text-xl font-bold mb-6">Create your account</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">I am a</label>
            <div className="flex gap-2">
              {(["AGENT", "ARCHITECT"] as const).map((r) => (
                <label key={r} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm text-center ${role === r ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="hidden" />
                  {r === "AGENT" ? "Real Estate Agent" : "Architect / Designer"}
                </label>
              ))}
            </div>
          </div>
          {err && <div className="text-sm text-red-600">{err === "email_taken" ? "That email is already registered." : err}</div>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <div className="text-sm text-slate-500 mt-4 text-center">
          Already registered? <Link to="/login" className="text-brand-600 font-medium">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
