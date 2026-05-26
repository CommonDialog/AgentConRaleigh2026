import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { FileUploader } from "../components/FileUploader";
import { useJobStream } from "../hooks/useSSE";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/cn";

const STYLES = [
  { key: "modern", label: "Modern" },
  { key: "scandinavian", label: "Scandinavian" },
  { key: "industrial", label: "Industrial" },
  { key: "mid-century", label: "Mid-Century" },
  { key: "coastal", label: "Coastal" },
  { key: "traditional", label: "Traditional" },
  { key: "minimalist", label: "Minimalist" },
  { key: "bohemian", label: "Bohemian" },
];

export function Staging() {
  const { refresh } = useAuth();
  const { push } = useToast();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [style, setStyle] = useState("modern");
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stream = useJobStream(jobId);

  const submit = async () => {
    if (!imageBase64) return;
    setBusy(true);
    try {
      const r = await api<{ jobId: string; projectId: string }>("/api/staging", {
        method: "POST",
        body: { imageBase64, style },
      });
      setJobId(r.jobId);
    } catch {
      push({ variant: "error", title: "Could not start job" });
    } finally {
      setBusy(false);
    }
  };

  const finished = stream.update?.status === "COMPLETE";
  const failed = stream.update?.status === "FAILED";
  const result = stream.update?.data as { generatedUrl?: string } | undefined;

  if (finished && result?.generatedUrl) refresh();

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Virtual Staging</h1>

      {!jobId && (
        <>
          <div className="card p-5">
            <h2 className="font-semibold mb-3">1. Upload an empty room</h2>
            <FileUploader onFileSelected={(_, b64) => setImageBase64(b64)} label="Drop empty-room photo here" />
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-3">2. Pick a style</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key)}
                  className={cn("rounded-lg border px-3 py-3 text-sm transition", style === s.key ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" disabled={!imageBase64 || busy} onClick={submit}>
              {busy ? "Starting…" : "Generate (5 credits)"}
            </button>
          </div>
        </>
      )}

      {jobId && (
        <>
          <ProgressIndicator update={stream.update} elapsedSec={stream.elapsedSec} etaSec={stream.etaSec} />
          {finished && result?.generatedUrl && imageBase64 && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold">Result</h2>
              <BeforeAfterSlider before={imageBase64} after={result.generatedUrl} />
              <div className="flex gap-2">
                <a href={result.generatedUrl} download className="btn-primary">Download</a>
                <button className="btn-secondary" onClick={() => { setJobId(null); setImageBase64(null); }}>Stage another</button>
                <Link to="/projects" className="btn-ghost">View in Projects</Link>
              </div>
            </div>
          )}
          {failed && (
            <div className="card p-5">
              <p className="text-sm text-red-600">Generation failed. Credits have been refunded.</p>
              <button className="btn-secondary mt-3" onClick={() => setJobId(null)}>Try again</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
