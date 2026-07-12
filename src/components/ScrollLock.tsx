import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

/**
 * Renderize dentro de um overlay de modal para travar o scroll do body
 * enquanto o modal estiver montado. Suporta modais empilhados.
 */
export function ScrollLock() {
  useBodyScrollLock(true);
  return null;
}
