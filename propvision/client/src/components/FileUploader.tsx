import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../lib/cn";

interface Props {
  onFileSelected: (file: File, base64: string) => void;
  accept?: string;
  maxBytes?: number;
  label?: string;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,image/tiff,application/pdf,image/svg+xml";
const DEFAULT_MAX = 50 * 1024 * 1024;

export function FileUploader({ onFileSelected, accept = DEFAULT_ACCEPT, maxBytes = DEFAULT_MAX, label = "Drop image here" }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    setError(null);
    if (file.size > maxBytes) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > ${(maxBytes / 1024 / 1024).toFixed(0)} MB max)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      onFileSelected(file, result);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handle(f);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handle(f);
  };

  const reset = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      {!preview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition",
            dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400 bg-white",
          )}
        >
          <Upload className="mx-auto mb-2 text-slate-400" size={28} />
          <div className="font-medium text-slate-700">{label}</div>
          <div className="text-xs text-slate-500 mt-1">
            JPEG, PNG, WebP, TIFF, PDF · up to {(maxBytes / 1024 / 1024).toFixed(0)} MB
          </div>
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <img src={preview} alt="upload preview" className="w-full max-h-96 object-contain" />
          <button onClick={reset} className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow hover:bg-white">
            <X size={16} />
          </button>
        </div>
      )}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
