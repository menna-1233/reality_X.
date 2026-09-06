import { Camera, X } from "lucide-react";
import { useRef } from "react";

interface Props {
  imageDataUrl: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function PhotoDropzone({ imageDataUrl, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  if (imageDataUrl) {
    return (
      <div className="glass-panel relative overflow-hidden rounded-3xl border border-white/10">
        <img src={imageDataUrl} alt="الصورة المرفقة" className="h-56 w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label="إزالة الصورة"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="glass-panel flex h-56 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-400/30 text-brand-300 transition hover:bg-white/[0.08]"
    >
      <Camera size={32} />
      <span className="font-medium">اضغط لإضافة صورة المشكلة</span>
      <span className="text-xs text-brand-400/70">JPG, PNG</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </button>
  );
}
