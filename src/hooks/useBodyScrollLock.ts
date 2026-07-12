import { useEffect } from "react";

let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

/**
 * Bloqueia o scroll do body enquanto `active` for true.
 * Suporta múltiplos modais empilhados via contador de referências.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;

    const body = document.body;
    if (lockCount === 0) {
      savedOverflow = body.style.overflow;
      savedPaddingRight = body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
      body.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = savedOverflow;
        body.style.paddingRight = savedPaddingRight;
      }
    };
  }, [active]);
}
