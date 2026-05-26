import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { cn } from "../lib/cn";

interface Toast {
  id: number;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
}

interface ToastContextValue {
  push: (t: Omit<Toast, "id">) => void;
}

const Ctx = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border px-4 py-3 shadow-lg bg-white animate-in slide-in-from-right",
              t.variant === "success" && "border-emerald-200 bg-emerald-50",
              t.variant === "error" && "border-red-200 bg-red-50",
              t.variant === "warning" && "border-amber-200 bg-amber-50",
            )}
          >
            {t.title && <div className="font-semibold text-sm">{t.title}</div>}
            {t.description && <div className="text-sm text-slate-600 mt-0.5">{t.description}</div>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast outside ToastProvider");
  return v;
}
