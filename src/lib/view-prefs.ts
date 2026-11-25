// Modo de visualização que cada pessoa escolhe em cada tela (Quadro, Lista,
// Capas...). A escolha fica gravada na conta dela (preferências do Appwrite),
// então acompanha a pessoa em qualquer aparelho. Uma cópia local evita piscar.
import { useCallback, useEffect, useState } from "react";
import { account } from "@/integrations/appwrite/client";

const CACHE_KEY = "mv-views";
type Views = Record<string, string>;

function readLocal(): Views {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Views;
  } catch {
    return {};
  }
}
function writeLocal(v: Views) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(v));
  } catch {
    /* sem armazenamento local */
  }
}

let remote: Promise<Views> | null = null;
function loadRemote(): Promise<Views> {
  if (!remote) {
    remote = account
      .getPrefs()
      .then((prefs) => {
        const views = (prefs as { views?: unknown }).views;
        return views && typeof views === "object" ? (views as Views) : {};
      })
      .catch(() => {
        remote = null; // sem sessão ou sem rede: tenta de novo depois
        return {};
      });
  }
  return remote;
}

async function saveRemote(key: string, value: string) {
  try {
    const prefs = (await account.getPrefs()) as Record<string, unknown>;
    const views = { ...((prefs.views as Views | undefined) ?? {}), [key]: value };
    await account.updatePrefs({ ...prefs, views });
    remote = Promise.resolve(views);
  } catch (err) {
    console.warn("[view-prefs] não foi possível gravar a preferência na conta:", err);
  }
}

/**
 * Modo de visualização de uma tela. `key` identifica a tela (ex.: "viagens-comercial").
 * Valores fora de `allowed` são ignorados.
 */
export function useViewPref<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const pick = (v: unknown): T | null => (allowed as readonly unknown[]).includes(v) ? (v as T) : null;
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let active = true;
    const local = pick(readLocal()[key]);
    if (local) setValue(local);
    loadRemote().then((views) => {
      const saved = pick(views[key]);
      if (active && saved) {
        setValue(saved);
        writeLocal({ ...readLocal(), [key]: saved });
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      writeLocal({ ...readLocal(), [key]: next });
      void saveRemote(key, next);
    },
    [key],
  );

  return [value, set];
}
