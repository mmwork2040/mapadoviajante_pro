import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

const DISMISS_KEY = "pwa-install-dismissed";

export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setDeferred(null));

    // iOS não dispara beforeinstallprompt — mostramos instrução manual.
    if (isIos() && !isStandalone()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed) return null;
  if (!deferred && !showIosHint) return null;

  function close() {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    close();
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl md:inset-x-auto md:bottom-6 md:right-6 md:left-auto">
      <button
        onClick={close}
        aria-label="Fechar"
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Download className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Instale o MapaPRO</p>
          {showIosHint ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Toque em <Share className="inline h-3.5 w-3.5" /> e depois em{" "}
              <strong>"Adicionar à Tela de Início"</strong>.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Acesse rápido direto da tela inicial do seu celular.
              </p>
              <button
                onClick={install}
                className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Instalar app
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
