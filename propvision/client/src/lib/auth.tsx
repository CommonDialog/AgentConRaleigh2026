import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: "ARCHITECT" | "AGENT" | "ADMIN";
  subscriptionTier: "FREE" | "PRO" | "ENTERPRISE";
  creditsBalance: number;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: CurrentUser | null) => void;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const me = await api<CurrentUser>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, refresh, logout, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
