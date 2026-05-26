import { useEffect, useRef, useState, MouseEvent } from "react";
import { cn } from "../lib/cn";

interface Props {
  imageSrc: string;
  onMaskExport: (base64Png: string) => void;
}

type Tool = "brush" | "eraser";

export function MaskPainter({ imageSrc, onMaskExport }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [tool, setTool] = useState<Tool>("brush");
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [dim, setDim] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const onLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setDim({ w: img.naturalWidth, h: img.naturalHeight });
    [overlayRef.current, previewRef.current].forEach((c) => {
      if (!c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
    });
  };

  const getPos = (e: MouseEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    const sx = overlayRef.current!.width / r.width;
    const sy = overlayRef.current!.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const overlay = overlayRef.current!.getContext("2d")!;
    const preview = previewRef.current!.getContext("2d")!;
    const radius = brushSize / 2;
    [overlay, preview].forEach((ctx) => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      void radius;
    });
  };

  const setupContexts = () => {
    const overlay = overlayRef.current!.getContext("2d")!;
    const preview = previewRef.current!.getContext("2d")!;
    if (tool === "brush") {
      overlay.globalCompositeOperation = "source-over";
      overlay.strokeStyle = "rgba(220, 38, 38, 0.45)";
      preview.globalCompositeOperation = "source-over";
      preview.strokeStyle = "white";
    } else {
      overlay.globalCompositeOperation = "destination-out";
      overlay.strokeStyle = "rgba(0,0,0,1)";
      preview.globalCompositeOperation = "destination-out";
      preview.strokeStyle = "rgba(0,0,0,1)";
    }
  };

  const onDown = (e: MouseEvent) => {
    drawing.current = true;
    setupContexts();
    last.current = getPos(e);
    const p = last.current!;
    stroke(p, p);
  };
  const onMove = (e: MouseEvent) => {
    if (!drawing.current) return;
    const p = getPos(e);
    if (last.current) stroke(last.current, p);
    last.current = p;
  };
  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    overlayRef.current?.getContext("2d")?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    previewRef.current?.getContext("2d")?.clearRect(0, 0, previewRef.current.width, previewRef.current.height);
  };

  const exportMask = () => {
    const out = document.createElement("canvas");
    out.width = dim.w;
    out.height = dim.h;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, out.width, out.height);
    if (previewRef.current) {
      ctx.drawImage(previewRef.current, 0, 0);
    }
    onMaskExport(out.toDataURL("image/png"));
  };

  useEffect(() => setupContexts(), [tool, brushSize]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setTool("brush")} className={cn("px-3 py-1.5 text-sm", tool === "brush" ? "bg-brand-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50")}>Brush</button>
          <button onClick={() => setTool("eraser")} className={cn("px-3 py-1.5 text-sm", tool === "eraser" ? "bg-brand-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50")}>Eraser</button>
        </div>
        <label className="text-sm flex items-center gap-2">
          Size
          <input type="range" min={10} max={120} value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} />
          <span className="text-xs text-slate-500 w-8">{brushSize}</span>
        </label>
        <button onClick={clear} className="btn-secondary text-xs">Clear</button>
        <button onClick={exportMask} className="btn-primary text-xs ml-auto">Use this mask</button>
      </div>
      <div className="relative inline-block w-full">
        <img ref={imgRef} src={imageSrc} alt="source" onLoad={onLoad} className="block w-full select-none pointer-events-none" />
        <canvas
          ref={overlayRef}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
        <canvas ref={previewRef} className="hidden" />
      </div>
    </div>
  );
}
