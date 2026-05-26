import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { FileUploader } from "../components/FileUploader";
import { useJobStream } from "../hooks/useSSE";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { cn } from "../lib/cn";

interface LayoutAnalysis {
  rooms?: { name: string; estimatedSqFt: number; currentFunction: string }[];
  trafficFlow?: string;
  wastedSpace?: { location: string; sqFt: number; description: string }[];
  naturalLight?: { room: string; windowCount: number; orientation: string; lightQuality: string }[];
  complianceNotes?: string[];
}
interface CostEstimate {
  lineItems?: { category: string; description: string; lowEstimate: number; highEstimate: number; unit: string; quantity: number }[];
  totalLowEstimate?: number;
  totalHighEstimate?: number;
  timelineWeeks?: number;
  permitRequirements?: string[];
  assumptions?: string[];
}
interface Sustainability {
  recommendations?: { category: string; description: string; estimatedCost: number; annualSavings: number; roiYears: number; environmentalImpact: number }[];
  currentEstimatedEnergyScore?: number;
  projectedEnergyScore?: number;
}

export function Optimize() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState("");
  const [region, setRegion] = useState("Midwest US");
  const [climateZone, setClimateZone] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stream = useJobStream(jobId);
  const [tab, setTab] = useState<"layout" | "cost" | "sustain">("layout");

  const addGoal = () => {
    const t = goalInput.trim();
    if (!t) return;
    setGoals((g) => [...g, t]);
    setGoalInput("");
  };
  const onGoalKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addGoal();
    }
  };

  const submit = async () => {
    if (!imageBase64) return;
    setBusy(true);
    try {
      const r = await api<{ jobId: string }>("/api/optimize", {
        method: "POST",
        body: { imageBase64, goals, region, climateZone: climateZone || undefined },
      });
      setJobId(r.jobId);
    } finally {
      setBusy(false);
    }
  };

  const result = stream.update?.data as
    | { layoutAnalysis?: LayoutAnalysis; costEstimate?: CostEstimate; sustainability?: Sustainability }
    | undefined;
  const finished = stream.update?.status === "COMPLETE";

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Space Optimization</h1>

      {!jobId && (
        <>
          <div className="card p-5">
            <h2 className="font-semibold mb-3">Upload floor plan or property photo</h2>
            <FileUploader onFileSelected={(_, b64) => setImageBase64(b64)} />
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <div className="label">Renovation goals (press Enter to add)</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {goals.map((g, i) => (
                  <span key={i} className="badge bg-brand-50 text-brand-700 inline-flex items-center gap-1">
                    {g}
                    <button onClick={() => setGoals((arr) => arr.filter((_, j) => j !== i))}><X size={12} /></button>
                  </span>
                ))}
              </div>
              <input className="input" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} onKeyDown={onGoalKey} placeholder="e.g. open kitchen to living room" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="label">Region</div>
                <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option>Northeast US</option>
                  <option>Southeast US</option>
                  <option>Midwest US</option>
                  <option>Southwest US</option>
                  <option>West Coast US</option>
                </select>
              </div>
              <div>
                <div className="label">Climate zone (optional)</div>
                <input className="input" value={climateZone} onChange={(e) => setClimateZone(e.target.value)} placeholder="e.g. cold, mixed, hot-humid" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" disabled={!imageBase64 || busy} onClick={submit}>{busy ? "Starting…" : "Analyze (8 credits)"}</button>
          </div>
        </>
      )}

      {jobId && !finished && <ProgressIndicator update={stream.update} elapsedSec={stream.elapsedSec} etaSec={stream.etaSec} />}

      {finished && result && (
        <div className="card">
          <div className="border-b border-slate-200 px-4 flex gap-1">
            {(["layout", "cost", "sustain"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-3 text-sm border-b-2 -mb-px", tab === t ? "border-brand-500 text-brand-600 font-medium" : "border-transparent text-slate-600")}>
                {t === "layout" ? "Layout" : t === "cost" ? "Cost Estimate" : "Sustainability"}
              </button>
            ))}
          </div>
          <div className="p-5">
            {tab === "layout" && <LayoutTab data={result.layoutAnalysis} />}
            {tab === "cost" && <CostTab data={result.costEstimate} />}
            {tab === "sustain" && <SustainTab data={result.sustainability} />}
          </div>
          <div className="px-5 pb-5">
            <button className="btn-secondary opacity-70" disabled>Export PDF Report (coming soon)</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LayoutTab({ data }: { data?: LayoutAnalysis }) {
  if (!data) return <p className="text-sm text-slate-500">No analysis available.</p>;
  return (
    <div className="space-y-4">
      {data.rooms && (
        <div>
          <h3 className="font-semibold mb-2">Rooms</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.rooms.map((r, i) => (
              <div key={i} className="rounded border border-slate-200 p-3 text-sm">
                <div className="font-medium">{r.name}</div>
                <div className="text-slate-500 text-xs">{r.estimatedSqFt} sq ft · {r.currentFunction}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.trafficFlow && (
        <div>
          <h3 className="font-semibold mb-1">Traffic Flow</h3>
          <p className="text-sm text-slate-700">{data.trafficFlow}</p>
        </div>
      )}
      {data.wastedSpace && data.wastedSpace.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Wasted Space</h3>
          <ul className="text-sm space-y-1">
            {data.wastedSpace.map((w, i) => <li key={i}>• <strong>{w.location}</strong> — {w.sqFt} sq ft · {w.description}</li>)}
          </ul>
        </div>
      )}
      {data.naturalLight && (
        <div>
          <h3 className="font-semibold mb-2">Natural Light</h3>
          <ul className="text-sm space-y-1">
            {data.naturalLight.map((l, i) => <li key={i}>• {l.room} — {l.windowCount} windows facing {l.orientation} ({l.lightQuality})</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function CostTab({ data }: { data?: CostEstimate }) {
  if (!data) return <p className="text-sm text-slate-500">No cost estimate available.</p>;
  return (
    <div className="space-y-4">
      {data.lineItems && (
        <div>
          <h3 className="font-semibold mb-2">Line Items</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 text-xs uppercase">
              <tr><th className="py-2">Category</th><th>Description</th><th>Qty</th><th className="text-right">Low</th><th className="text-right">High</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="py-2 font-medium">{li.category}</td>
                  <td className="text-slate-600">{li.description}</td>
                  <td className="text-slate-500">{li.quantity} {li.unit}</td>
                  <td className="text-right">${li.lowEstimate.toLocaleString()}</td>
                  <td className="text-right">${li.highEstimate.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(data.totalLowEstimate || data.totalHighEstimate) && (
        <div className="rounded-lg bg-slate-50 p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Total estimate</div>
            <div className="text-lg font-semibold">${data.totalLowEstimate?.toLocaleString()} – ${data.totalHighEstimate?.toLocaleString()}</div>
          </div>
          {data.timelineWeeks && <div className="text-sm text-slate-600">{data.timelineWeeks} weeks</div>}
        </div>
      )}
      {data.permitRequirements && data.permitRequirements.length > 0 && (
        <div>
          <h3 className="font-semibold mb-1">Permits</h3>
          <ul className="text-sm">{data.permitRequirements.map((p, i) => <li key={i}>• {p}</li>)}</ul>
        </div>
      )}
      {data.assumptions && (
        <div>
          <h3 className="font-semibold mb-1">Assumptions</h3>
          <ul className="text-sm text-slate-600">{data.assumptions.map((p, i) => <li key={i}>• {p}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function SustainTab({ data }: { data?: Sustainability }) {
  if (!data) return <p className="text-sm text-slate-500">No sustainability data available.</p>;
  return (
    <div className="space-y-4">
      {(data.currentEstimatedEnergyScore || data.projectedEnergyScore) && (
        <div className="grid grid-cols-2 gap-4">
          <ScoreGauge label="Current" score={data.currentEstimatedEnergyScore || 0} />
          <ScoreGauge label="Projected" score={data.projectedEnergyScore || 0} highlight />
        </div>
      )}
      {data.recommendations && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.recommendations.map((r, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="text-xs uppercase text-slate-500">{r.category}</div>
              <div className="font-semibold mt-1">{r.description}</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
                <div>Cost: ${r.estimatedCost.toLocaleString()}</div>
                <div>Savings: ${r.annualSavings.toLocaleString()}/yr</div>
                <div>ROI: {r.roiYears} yrs</div>
                <div>CO₂: {r.environmentalImpact} lbs/yr</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreGauge({ label, score, highlight }: { label: string; score: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg p-4 text-center", highlight ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200")}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-3xl font-bold mt-1">{score}</div>
      <div className="text-xs text-slate-500 mt-1">/ 100</div>
      <div className="mt-2 h-2 bg-white rounded-full overflow-hidden">
        <div className={cn("h-full", highlight ? "bg-emerald-500" : "bg-slate-400")} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
