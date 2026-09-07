import { useEffect, useRef } from "react";

/**
 * Drives the `.glass-surface` specular highlight (see index.css) by
 * writing the pointer position into `--glass-x`/`--glass-y` custom
 * properties on the element, so the glint drifts under the cursor —
 * approximating the motion-reactive highlight of Apple's Liquid Glass
 * material. No-ops under `prefers-reduced-motion` and on touch-only input
 * (no hover), leaving the static highlight position from the CSS.
 *
 * Usage: `const ref = useGlassPointer<HTMLDivElement>(); <div ref={ref} className="glass-surface" />`
 */
export function useGlassPointer<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    function handleMove(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el!.style.setProperty("--glass-x", `${x}%`);
      el!.style.setProperty("--glass-y", `${y}%`);
    }

    function handleLeave() {
      el!.style.removeProperty("--glass-x");
      el!.style.removeProperty("--glass-y");
    }

    el.addEventListener("pointermove", handleMove);
    el.addEventListener("pointerleave", handleLeave);
    return () => {
      el.removeEventListener("pointermove", handleMove);
      el.removeEventListener("pointerleave", handleLeave);
    };
  }, []);

  return ref;
}
