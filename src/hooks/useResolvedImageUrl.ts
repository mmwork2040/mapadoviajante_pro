import { useCallback, useEffect, useRef, useState } from "react";
import { resolveDisplayImageUrl } from "@/lib/services";

const MAX_RETRIES = 2;

/**
 * Resolve uma URL de imagem (assinada) e re-resolve automaticamente
 * quando o <img> dispara onError (ex.: 403/404 por URL assinada expirada).
 */
export function useResolvedImageUrl(value?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const attemptRef = useRef(0);
  const activeRef = useRef(true);

  const resolve = useCallback(
    async (bust: boolean) => {
      const resolved = await resolveDisplayImageUrl(value);
      if (!activeRef.current) return;
      if (!resolved) {
        setUrl(null);
        return;
      }
      setUrl(bust ? `${resolved}${resolved.includes("?") ? "&" : "?"}_r=${Date.now()}` : resolved);
    },
    [value],
  );

  useEffect(() => {
    activeRef.current = true;
    attemptRef.current = 0;
    setUrl(null);
    setFailed(false);
    void resolve(false);
    return () => {
      activeRef.current = false;
    };
  }, [resolve]);

  const handleError = useCallback(() => {
    if (attemptRef.current >= MAX_RETRIES) {
      setFailed(true);
      return;
    }
    attemptRef.current += 1;
    // Pequeno backoff antes de re-resolver a URL assinada.
    const delay = 250 * attemptRef.current;
    setTimeout(() => {
      if (activeRef.current) void resolve(true);
    }, delay);
  }, [resolve]);

  return { url, failed, onError: handleError };
}
