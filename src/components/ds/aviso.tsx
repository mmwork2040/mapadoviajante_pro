import { Toaster } from "sonner";

/**
 * Aviso curto: aparece embaixo, no centro, por 2,6 s. Para mostrar um, use
 * `toast("texto")` do sonner em qualquer tela.
 */
export function Avisos() {
  return (
    <Toaster
      position="bottom-center"
      duration={2600}
      offset={28}
      mobileOffset={96}
      toastOptions={{ unstyled: true, classNames: { toast: "ds-aviso" } }}
    />
  );
}
