import { JobUpdate } from "../hooks/useSSE";
import { cn } from "../lib/cn";

interface Props {
  update: JobUpdate | null;
  elapsedSec: number;
  etaSec: number | null;
}

export function ProgressIndicator({ update, elapsedSec, etaSec }: Props) {
  const pct = update?.progress ?? 0;
  const step = update?.step ?? "queued";
  const status = update?.status ?? "QUEUED";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="font-medium text-slate-800">{prettyStep(step)}</span>
        <span className={cn("badge", status === "FAILED" ? "bg-red-100 text-red-700" : status === "COMPLETE" ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700")}>
          {status}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-slate-500 flex justify-between">
        <span>{pct}% complete</span>
        <span>
          {elapsedSec}s elapsed{etaSec !== null && ` · ~${etaSec}s remaining`}
        </span>
      </div>
    </div>
  );
}

function prettyStep(step: string) {
  return step.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
