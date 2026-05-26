import { useState } from "react";
import { Sun, Cloud, Moon } from "lucide-react";
import { api } from "../lib/api";
import { FileUploader } from "../components/FileUploader";
import { useJobStream } from "../hooks/useSSE";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { cn } from "../lib/cn";

const SUBTYPES = [
  { key: "HDR_BLEND", label: "HDR Blend", desc: "Balance interior and exterior exposure.", icon: Sun },
  { key: "SKY_REPLACE", label: "Sky Replace", desc: "Swap drab skies for vibrant ones.", icon: Cloud },
  { key: "DAY_TO_DUSK", label: "Day to Dusk", desc: "Convert daytime to twilight magic.", icon: Moon },
] as const;

const SKY_TYPES = [
  { key: "BLUE_SKY", label: "Blue Sky" },
  { key: "DRAMATIC_CLOUDS", label: "Dramatic Clouds" },
  { key: "GOLDEN_HOUR", label: "Golden Hour" },
  { key: "TWILIGHT", label: "Twilight" },
];

export function Environmental() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [subtype, setSubtype] = useState<typeof SUBTYPES[number]["key"]>("HDR_BLEND");
  const [skyType, setSkyType] = useState("BLUE_SKY");
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stream = useJobStream(jobId);

  const submit = async () => {
    if (!imageBase64) return;
    setBusy(true);
    try {
      const r = await api<{ jobId: string }>("/api/environmental", {
        method: "POST",
        body: { imageBase64, subtype, skyType: subtype === "SKY_REPLACE" ? skyType : undefined },
      });
      setJobId(r.jobId);
    } finally {
      setBusy(false);
    }
  };

  const result = stream.update?.data as { generatedUrl?: string } | undefined;
  const finished = stream.update?.status === "COMPLETE";
  const failed = stream.update?.status === "FAILED";

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Environmental Edit</h1>

      {!jobId && (
        <>
          <div className="card p-5">
            <h2 className="font-semibold mb-3">1. Upload exterior photo</h2>
            <FileUploader onFileSelected={(_, b64) => setImageBase64(b64)} label="Drop property photo here" />
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-3">2. Choose edit type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SUBTYPES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSubtype(s.key)}
                  className={cn("rounded-xl border p-4 text-left transition", subtype === s.key ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50")}
                >
                  <s.icon size={22} className="text-brand-600 mb-2" />
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{s.desc}</div>
                </button>
              ))}
            </div>

            {subtype === "SKY_REPLACE" && (
              <div className="mt-4">
                <div className="label">Sky type</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SKY_TYPES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSkyType(s.key)}
                      className={cn("rounded-lg border px-3 py-2 text-sm", skyType === s.key ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50")}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" disabled={!imageBase64 || busy} onClick={submit}>
              {busy ? "Starting…" : "Generate (3 credits)"}
            </button>
          </div>
        </>
      )}

      {jobId && (
        <>
          <ProgressIndicator update={stream.update} elapsedSec={stream.elapsedSec} etaSec={stream.etaSec} />
          {finished && result?.generatedUrl && imageBase64 && (
            <div className="card p-5 space-y-3">
              <BeforeAfterSlider before={imageBase64} after={result.generatedUrl} />
              <div className="flex gap-2">
                <a href={result.generatedUrl} download className="btn-primary">Download</a>
                <button className="btn-secondary" onClick={() => { setJobId(null); setImageBase64(null); }}>Try again</button>
              </div>
            </div>
          )}
          {failed && (
            <div className="card p-5">
              <p className="text-sm text-red-600">Generation failed. Credits refunded.</p>
              <button className="btn-secondary mt-3" onClick={() => setJobId(null)}>Try again</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
