import { useRef, useState, MouseEvent, TouchEvent } from "react";

interface Props {
  before: string;
  after: string;
  className?: string;
}

export function BeforeAfterSlider({ before, after, className }: Props) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromX = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(0, Math.min(100, x)));
  };

  const onDown = (e: MouseEvent | TouchEvent) => {
    dragging.current = true;
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    updateFromX(x);
  };
  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging.current) return;
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    updateFromX(x);
  };
  const onUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={ref}
      className={`relative select-none rounded-xl overflow-hidden border border-slate-200 bg-slate-100 ${className || ""}`}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchMove={onMove}
      onTouchEnd={onUp}
    >
      <img src={after} alt="after" className="block w-full" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={before} alt="before" className="block w-full h-full object-cover" style={{ minWidth: ref.current?.offsetWidth || "100%" }} />
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-ew-resize"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        onMouseDown={onDown}
        onTouchStart={onDown}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white shadow flex items-center justify-center text-xs font-bold text-slate-700">
          ⇆
        </div>
      </div>
      <div className="absolute top-2 left-2 badge bg-black/60 text-white">Before</div>
      <div className="absolute top-2 right-2 badge bg-black/60 text-white">After</div>
    </div>
  );
}
