import { Camera, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  value: File | null;
  onChange: (file: File | null) => void;
}

export function PhotoDropzone({ value, onChange }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (previewUrl) {
    return (
      <div className="surface-panel relative overflow-hidden rounded-xl border border-white/8">
        <img src={previewUrl} alt={t("photoDropzone.imageAlt")} className="h-56 w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label={t("photoDropzone.removePhoto")}
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
      className="surface-panel flex h-56 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent-400/30 text-accent-400 transition hover:bg-white/[0.04]"
    >
      <Camera size={32} />
      <span className="font-medium">{t("photoDropzone.addPhotoPrompt")}</span>
      <span className="text-xs text-accent-400/70">JPG, PNG</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </button>
  );
}
