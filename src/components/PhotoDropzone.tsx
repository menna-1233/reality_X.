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
      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        <img src={imageDataUrl} alt="الصورة المرفقة" className="h-56 w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink-950/70 text-mist-100 backdrop-blur"
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
      className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ember-500/30 bg-white/[0.03] text-mist-300 backdrop-blur-xl transition hover:border-ember-500/50 hover:bg-white/[0.06]"
    >
      <Camera size={32} className="text-ember-400" />
      <span className="font-medium text-mist-100">اضغط لإضافة صورة المشكلة</span>
      <span className="text-xs text-mist-500">JPG, PNG</span>
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
