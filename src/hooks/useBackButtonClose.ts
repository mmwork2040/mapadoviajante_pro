import { useEffect, useRef } from "react";

let suppressNextPopstate = 0;

/**
 * Faz o botão "voltar" do dispositivo (ou navegador) fechar o modal aberto
 * em vez de navegar para a página anterior. Enquanto o modal estiver aberto,
 * uma entrada temporária é adicionada ao histórico; ao pressionar voltar,
 * essa entrada é consumida e `onClose` é chamado.
 */
export function useBackButtonClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const marker = `modal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.history.pushState({ ...(window.history.state || {}), __modal: marker }, "");

    const handler = () => {
      if (suppressNextPopstate > 0) {
        suppressNextPopstate -= 1;
        return;
      }
      onCloseRef.current();
    };
    window.addEventListener("popstate", handler);

    return () => {
      window.removeEventListener("popstate", handler);
      // Fechado programaticamente (não pelo botão voltar): remove a entrada extra.
      if (window.history.state?.__modal === marker) {
        suppressNextPopstate += 1;
        window.history.back();
      }
    };
  }, [open]);
}
