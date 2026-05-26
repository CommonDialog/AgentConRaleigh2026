import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { FileUploader } from "../components/FileUploader";
import { useToast } from "../components/Toast";
import { cn } from "../lib/cn";

interface FormatPreset {
  key: string;
  label: string;
  category: "social" | "listing" | "print";
  width: number;
  height: number;
  dpi?: number;
}

interface ResizeResult {
  format: string;
  label: string;
  assetId: string;
  downloadUrl: string;
  width: number;
  height: number;
  safeMarginWarning: boolean;
}

export function Resize() {
  const { push } = useToast();
  const [formats, setFormats] = useState<FormatPreset[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [results, setResults] = useState<ResizeResult[] | null>(null);
  const [outputFormat, setOutputFormat] = useState<"jpeg" | "png">("jpeg");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<FormatPreset[]>("/api/resize/formats").then(setFormats); }, []);

  const upload = async (file: File) => {
    const project = await api<{ id: string }>("/api/projects", { method: "POST", body: { name: `Resize ${new Date().toISOString().slice(0, 10)}`, type: "RESIZE" } });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", project.id);
    fd.append("type", "SOURCE_IMAGE");
    const a = await api<{ id: string }>("/api/assets/upload", { method: "POST", body: fd });
    setAssetId(a.id);
  };

  const submit = async () => {
    if (!assetId || selected.size === 0) return;
    setBusy(true);
    try {
      const r = await api<{ items: ResizeResult[] }>("/api/resize", {
        method: "POST",
        body: { assetId, formats: Array.from(selected), outputFormat },
      });
      setResults(r.items);
      push({ variant: "success", title: "Resize complete", description: `${r.items.length} format(s) ready` });
    } finally {
      setBusy(false);
    }
  };

  const downloadZip = async () => {
    if (!results) return;
    const res = await fetch("/api/resize/zip", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds: results.map((r) => r.assetId) }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "propvision-resized.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = formats ? {
    social: formats.filter((f) => f.category === "social"),
    listing: formats.filter((f) => f.category === "listing"),
    print: formats.filter((f) => f.category === "print"),
  } : null;

  const toggle = (key: string) => {
    const ns = new Set(selected);
    ns.has(key) ? ns.delete(key) : ns.add(key);
    setSelected(ns);
  };
  const toggleAll = (cat: keyof typeof grouped) => {
    if (!grouped) return;
    const items = grouped[cat as keyof typeof grouped] as FormatPreset[];
    const allSelected = items.every((i) => selected.has(i.key));
    const ns = new Set(selected);
    items.forEach((i) => allSelected ? ns.delete(i.key) : ns.add(i.key));
    setSelected(ns);
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Multi-Format Resize</h1>

      {!assetId && (
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Upload source image</h2>
          <FileUploader onFileSelected={(f, b64) => { setImageBase64(b64); upload(f); }} />
        </div>
      )}

      {assetId && imageBase64 && (
        <>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Source image</h2>
              <button className="text-sm text-slate-500 hover:underline" onClick={() => { setAssetId(null); setImageBase64(null); setResults(null); setSelected(new Set()); }}>Replace</button>
            </div>
            <img src={imageBase64} alt="" className="max-h-64 w-auto rounded" />
          </div>

          {grouped && !results && (
            <div className="card p-5 space-y-5">
              {(["social", "listing", "print"] as const).map((cat) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold capitalize">{cat === "social" ? "Social Media" : cat === "listing" ? "Listing Sites" : "Print"}</h3>
                    <button className="text-xs text-brand-600" onClick={() => toggleAll(cat)}>Toggle all</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {grouped[cat].map((f) => {
                      const isSel = selected.has(f.key);
                      const ratio = f.width / f.height;
                      return (
                        <button key={f.key} onClick={() => toggle(f.key)} className={cn("rounded-lg border p-3 text-left", isSel ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50")}>
                          <div className="bg-slate-200 rounded mb-2" style={{ aspectRatio: String(ratio) }} />
                          <div className="text-sm font-medium">{f.label}</div>
                          <div className="text-xs text-slate-500">{f.width}×{f.height}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm text-slate-600">{selected.size} selected · output: {outputFormat.toUpperCase()}</div>
                <div className="flex gap-2">
                  <select className="input w-auto" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as "jpeg" | "png")}>
                    <option value="jpeg">JPEG</option>
                    <option value="png">PNG</option>
                  </select>
                  <button className="btn-primary" disabled={selected.size === 0 || busy} onClick={submit}>{busy ? "Generating…" : "Generate All Sizes"}</button>
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{results.length} resized images</h2>
                <button className="btn-primary" onClick={downloadZip}>Download All (ZIP)</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {results.map((r) => (
                  <div key={r.assetId} className="rounded-lg border border-slate-200 p-2">
                    <div className="bg-slate-100 rounded overflow-hidden flex items-center justify-center" style={{ aspectRatio: String(r.width / r.height) }}>
                      <img src={r.downloadUrl} alt={r.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="mt-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{r.label}</span>
                        {r.safeMarginWarning && <span className="badge bg-amber-100 text-amber-700">!</span>}
                      </div>
                      <div className="text-xs text-slate-500">{r.width}×{r.height}</div>
                    </div>
                    <a href={r.downloadUrl} download className="btn-secondary text-xs mt-2 w-full">Download</a>
                  </div>
                ))}
              </div>
              <button className="btn-ghost text-sm" onClick={() => { setResults(null); setSelected(new Set()); }}>Pick different formats</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
