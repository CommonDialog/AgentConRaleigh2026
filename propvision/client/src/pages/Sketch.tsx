import { useEffect, useRef, useState, MouseEvent } from "react";
import { Pencil, Eraser, Square, Circle, Minus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useJobStream } from "../hooks/useSSE";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { cn } from "../lib/cn";

type Tool = "pen" | "line" | "rect" | "ellipse" | "eraser";

export function Sketch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [stroke, setStroke] = useState(3);
  const [fidelity, setFidelity] = useState(75);
  const [style, setStyle] = useState<"architectural" | "interior" | "landscape">("architectural");
  const [additions, setAdditions] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stream = useJobStream(jobId);

  const drawing = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const snapshot = useRef<ImageData | null>(null);
  const history = useRef<ImageData[]>([]);
  const future = useRef<ImageData[]>([]);

  useEffect(() => {
    const c = canvasRef.current!;
    c.width = 1024;
    c.height = 768;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const ctx = () => canvasRef.current!.getContext("2d")!;
  const pos = (e: MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvasRef.current!.width,
      y: ((e.clientY - r.top) / r.height) * canvasRef.current!.height,
    };
  };

  const pushHistory = () => {
    const c = canvasRef.current!;
    history.current.push(ctx().getImageData(0, 0, c.width, c.height));
    if (history.current.length > 20) history.current.shift();
    future.current = [];
  };

  const onDown = (e: MouseEvent) => {
    drawing.current = true;
    pushHistory();
    start.current = pos(e);
    if (tool === "pen" || tool === "eraser") {
      const c = ctx();
      c.lineCap = "round";
      c.lineJoin = "round";
      c.lineWidth = stroke;
      c.strokeStyle = tool === "eraser" ? "white" : color;
      c.beginPath();
      c.moveTo(start.current.x, start.current.y);
    } else {
      const c = canvasRef.current!;
      snapshot.current = ctx().getImageData(0, 0, c.width, c.height);
    }
  };
  const onMove = (e: MouseEvent) => {
    if (!drawing.current || !start.current) return;
    const p = pos(e);
    const c = ctx();
    if (tool === "pen" || tool === "eraser") {
      c.lineTo(p.x, p.y);
      c.stroke();
    } else if (snapshot.current) {
      c.putImageData(snapshot.current, 0, 0);
      c.lineWidth = stroke;
      c.strokeStyle = color;
      c.beginPath();
      if (tool === "line") {
        c.moveTo(start.current.x, start.current.y);
        c.lineTo(p.x, p.y);
      } else if (tool === "rect") {
        c.rect(start.current.x, start.current.y, p.x - start.current.x, p.y - start.current.y);
      } else if (tool === "ellipse") {
        const cx = (start.current.x + p.x) / 2;
        const cy = (start.current.y + p.y) / 2;
        c.ellipse(cx, cy, Math.abs(p.x - start.current.x) / 2, Math.abs(p.y - start.current.y) / 2, 0, 0, Math.PI * 2);
      }
      c.stroke();
    }
  };
  const onUp = () => {
    drawing.current = false;
    start.current = null;
    snapshot.current = null;
  };

  const undo = () => {
    const c = canvasRef.current!;
    const last = history.current.pop();
    if (!last) return;
    future.current.push(ctx().getImageData(0, 0, c.width, c.height));
    ctx().putImageData(last, 0, 0);
  };
  const redo = () => {
    const c = canvasRef.current!;
    const next = future.current.pop();
    if (!next) return;
    history.current.push(ctx().getImageData(0, 0, c.width, c.height));
    ctx().putImageData(next, 0, 0);
  };
  const clear = () => {
    pushHistory();
    const c = canvasRef.current!;
    const x = ctx();
    x.fillStyle = "white";
    x.fillRect(0, 0, c.width, c.height);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const sketchBase64 = canvasRef.current!.toDataURL("image/png");
      const r = await api<{ jobId: string }>("/api/sketch", {
        method: "POST",
        body: { sketchBase64, style, fidelity, promptAdditions: additions },
      });
      setJobId(r.jobId);
    } finally {
      setBusy(false);
    }
  };

  const result = stream.update?.data as { generatedUrl?: string } | undefined;

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sketch to Render</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-3">
          <div className="flex flex-wrap gap-1 mb-2">
            {([
              ["pen", Pencil], ["line", Minus], ["rect", Square], ["ellipse", Circle], ["eraser", Eraser],
            ] as const).map(([t, Icon]) => (
              <button key={t} onClick={() => setTool(t)} className={cn("btn-ghost p-2", tool === t && "bg-slate-200")}>
                <Icon size={16} />
              </button>
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="ml-2 h-8 w-8 rounded cursor-pointer" />
            <input type="range" min={1} max={10} value={stroke} onChange={(e) => setStroke(parseInt(e.target.value, 10))} className="ml-2 w-24" />
            <button onClick={undo} className="btn-ghost p-2">↶</button>
            <button onClick={redo} className="btn-ghost p-2">↷</button>
            <button onClick={clear} className="btn-ghost p-2 text-red-500"><Trash2 size={16} /></button>
          </div>
          <canvas
            ref={canvasRef}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            className="border border-slate-200 rounded bg-white w-full aspect-[4/3] cursor-crosshair"
          />
        </div>
        <div className="card p-3">
          <div className="text-sm font-semibold mb-2">Render preview</div>
          <div className="aspect-[4/3] bg-slate-100 rounded overflow-hidden flex items-center justify-center">
            {!jobId && <div className="text-sm text-slate-500 text-center px-6">Draw something and hit Render to see the magic.</div>}
            {jobId && !result?.generatedUrl && <div className="p-4 w-full"><ProgressIndicator update={stream.update} elapsedSec={stream.elapsedSec} etaSec={stream.etaSec} /></div>}
            {result?.generatedUrl && <img src={result.generatedUrl} alt="render" className="w-full h-full object-contain" />}
          </div>
          {result?.generatedUrl && <a href={result.generatedUrl} download className="btn-primary mt-3 w-full">Download</a>}
        </div>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <div className="label">Style</div>
          <select className="input" value={style} onChange={(e) => setStyle(e.target.value as typeof style)}>
            <option value="architectural">Architectural</option>
            <option value="interior">Interior</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div>
          <div className="label">Fidelity: {fidelity}% ({fidelity > 70 ? "Strict" : fidelity > 30 ? "Balanced" : "Creative"})</div>
          <input type="range" min={0} max={100} value={fidelity} onChange={(e) => setFidelity(parseInt(e.target.value, 10))} className="w-full" />
        </div>
        <div>
          <div className="label">Optional details</div>
          <input className="input" placeholder="brick facade, two-story colonial…" value={additions} onChange={(e) => setAdditions(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy} onClick={submit}>
          {busy ? "Starting…" : "Render (5 credits)"}
        </button>
      </div>
    </div>
  );
}
