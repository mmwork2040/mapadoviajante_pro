import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * A página de apresentação do produto é um HTML estático e autônomo:
 * public/conheca.html (HTML, CSS e JavaScript puros, sem React).
 * Esta rota só leva o endereço /conheca até ela.
 */
const PAGINA = "/conheca.html";

export const Route = createFileRoute("/conheca")({
  beforeLoad: () => {
    throw redirect({ href: PAGINA, reloadDocument: true });
  },
  component: IrParaPagina,
});

// Garantia para navegação feita no navegador: troca o documento inteiro.
function IrParaPagina() {
  useEffect(() => {
    window.location.replace(PAGINA);
  }, []);
  return null;
}
