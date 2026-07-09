import { useEffect, useRef } from "react";

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

    window.history.pushState({ __modal: true }, "");

    const handler = () => onCloseRef.current();
    window.addEventListener("popstate", handler);

    return () => {
      window.removeEventListener("popstate", handler);
      // Fechado programaticamente (não pelo botão voltar): remove a entrada extra.
      if (window.history.state?.__modal) {
        window.history.back();
      }
    };
  }, [open]);
}
