import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { FileUploader } from "../components/FileUploader";
import { MaskPainter } from "../components/MaskPainter";
import { useJobStream } from "../hooks/useSSE";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { cn } from "../lib/cn";

interface DetectedItem {
  label: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  category: string;
}

export function Declutter() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stream = useJobStream(jobId);

  const detected = (stream.update?.data as { detected?: DetectedItem[] } | undefined)?.detected;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (detected && selected.size === 0) {
      setSelected(new Set(detected.filter((d) => d.confidence > 0.7).map((d) => d.label)));
    }
  }, [detected]);

  const submit = async () => {
    if (!imageBase64) return;
    if (mode === "MANUAL" && !maskBase64) return;
    setBusy(true);
    try {
      const r = await api<{ jobId: string }>("/api/declutter", {
        method: "POST",
        body: { imageBase64, mode, maskBase64: maskBase64 || undefined },
      });
      setJobId(r.jobId);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!jobId) return;
    await api(`/api/jobs/${jobId}/confirm`, { method: "PUT", body: { removeItems: Array.from(selected) } });
  };

  const result = stream.update?.data as { generatedUrl?: string } | undefined;
  const finished = stream.update?.status === "COMPLETE";
  const awaitingConfirm = stream.update?.step === "awaiting_confirmation";

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Declutter & Remove</h1>

      {!jobId && (
        <>
          <div className="card p-5">
            <h2 className="font-semibold mb-3">1. Upload photo</h2>
            <FileUploader onFileSelected={(_, b64) => setImageBase64(b64)} />
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-3">2. How should we remove things?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setMode("AUTO")}
                className={cn("rounded-xl border p-4 text-left", mode === "AUTO" ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50")}
              >
                <div className="font-semibold">Auto-detect clutter</div>
                <div className="text-xs text-slate-500 mt-1">AI scans the photo and suggests what to remove. You confirm.</div>
              </button>
              <button
                onClick={() => setMode("MANUAL")}
                className={cn("rounded-xl border p-4 text-left", mode === "MANUAL" ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50")}
              >
                <div className="font-semibold">I&apos;ll mark what to remove</div>
                <div className="text-xs text-slate-500 mt-1">Paint over areas you want gone.</div>
              </button>
            </div>
          </div>

          {mode === "MANUAL" && imageBase64 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-3">Paint mask</h2>
              <MaskPainter imageSrc={imageBase64} onMaskExport={setMaskBase64} />
              {maskBase64 && <p className="text-xs text-emerald-600 mt-2">Mask ready.</p>}
            </div>
          )}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={!imageBase64 || busy || (mode === "MANUAL" && !maskBase64)} onClick={submit}>
              {busy ? "Starting…" : "Run (4 credits)"}
            </button>
          </div>
        </>
      )}

      {jobId && (
        <>
          <ProgressIndicator update={stream.update} elapsedSec={stream.elapsedSec} etaSec={stream.etaSec} />

          {awaitingConfirm && detected && imageBase64 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-3">We found {detected.length} items. Pick what to remove.</h2>
              <div className="relative inline-block w-full">
                <img src={imageBase64} alt="" className="w-full block" />
                {detected.map((d) => (
                  <div
                    key={d.label}
                    className={cn("absolute border-2", selected.has(d.label) ? "border-red-500 bg-red-500/20" : "border-emerald-500 bg-emerald-500/10")}
                    style={{
                      left: `${d.boundingBox.x}%`,
                      top: `${d.boundingBox.y}%`,
                      width: `${d.boundingBox.width}%`,
                      height: `${d.boundingBox.height}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 text-xs bg-white px-1 rounded shadow">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {detected.map((d) => (
                  <label key={d.label} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(d.label)}
                      onChange={(e) => {
                        const ns = new Set(selected);
                        e.target.checked ? ns.add(d.label) : ns.delete(d.label);
                        setSelected(ns);
                      }}
                    />
                    <span>{d.label}</span>
                    <span className="text-xs text-slate-500 ml-auto">{Math.round(d.confidence * 100)}%</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => api(`/api/jobs/${jobId}/cancel`, { method: "POST" }).then(() => setJobId(null))}>Cancel</button>
                <button className="btn-primary" onClick={confirm}>Remove Selected</button>
              </div>
            </div>
          )}

          {finished && result?.generatedUrl && imageBase64 && (
            <div className="card p-5 space-y-3">
              <BeforeAfterSlider before={imageBase64} after={result.generatedUrl} />
              <div className="flex gap-2">
                <a href={result.generatedUrl} download className="btn-primary">Download</a>
                <button className="btn-secondary" onClick={() => { setJobId(null); setImageBase64(null); setMaskBase64(null); setSelected(new Set()); }}>Try another</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
