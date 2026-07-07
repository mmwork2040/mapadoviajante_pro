import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DownloadInput = { destination: string };

async function wikipediaImage(lang: string, query: string): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OSegredoDoViajante/1.0" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
      type?: string;
    };
    return json.originalimage?.source ?? json.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

// Baixa (localiza) uma imagem representativa do destino usando fontes abertas.
// Só é permitido quando a IA da agência está configurada e conectada.
export const downloadDestinationImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: DownloadInput) => {
    if (!d?.destination?.trim()) throw new Error("Informe o destino.");
    return { destination: d.destination.trim() };
  })
  .handler(async ({ data, context }): Promise<{ imageUrl: string }> => {
    const { data: cfg, error } = await context.supabase
      .from("crm_ai_config")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a configuração de IA.");
    if (!cfg || !cfg.api_key_encrypted) throw new Error("IA não configurada.");
    const ks = (cfg.knowledge_sources as { status?: string } | null) ?? null;
    if (ks?.status !== "connected") {
      throw new Error("A IA precisa estar ativa e conectada nas configurações.");
    }

    const dest = data.destination;
    const variants = [dest, dest.split(",")[0].trim()].filter(Boolean);
    for (const lang of ["pt", "en"]) {
      for (const q of variants) {
        const img = await wikipediaImage(lang, q);
        if (img) return { imageUrl: img };
      }
    }
    throw new Error("Nenhuma imagem encontrada para este destino.");
  });
