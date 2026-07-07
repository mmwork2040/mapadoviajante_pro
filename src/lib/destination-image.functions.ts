import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DownloadInput = { destination: string };

// Termos que indicam que a imagem NÃO é uma foto real do lugar.
const BAD_TERMS = [
  "flag",
  "bandeira",
  "coat",
  "brasao",
  "brasão",
  "escudo",
  "map",
  "mapa",
  "logo",
  "seal",
  "emblem",
  "icon",
  "ícone",
  "svg",
  "drawing",
  "desenho",
  "illustration",
  "ilustra",
  "diagram",
  "chart",
  "orthographic",
  "locator",
  "location",
  "arms",
];

function isBadImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".png")) {
    // fotos reais quase sempre são JPG; PNG/SVG costumam ser mapas/bandeiras/logos
    if (lower.endsWith(".svg")) return true;
  }
  return BAD_TERMS.some((t) => lower.includes(t));
}

function isPhoto(url: string): boolean {
  const lower = url.toLowerCase();
  return (lower.includes(".jpg") || lower.includes(".jpeg")) && !isBadImage(url);
}

// Busca fotos reais no Wikimedia Commons relacionadas ao destino.
async function commonsPhoto(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${query} landscape city landmark`,
    gsrnamespace: "6", // File:
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "1200",
    origin: "*",
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OSegredoDoViajante/1.0" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; imageinfo?: { url?: string; thumburl?: string; mime?: string }[] }
        >;
      };
    };
    const pages = json.query?.pages ? Object.values(json.query.pages) : [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      if (info.mime && !info.mime.startsWith("image/")) continue;
      const full = info.url ?? "";
      const title = p.title ?? "";
      if (full && isPhoto(full) && !isBadImage(title)) {
        return info.thumburl ?? full;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Foto principal (real) de um artigo da Wikipedia, ignorando bandeiras/mapas/logos.
async function wikipediaPhoto(lang: string, query: string): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "OSegredoDoViajante/1.0" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
    };
    const candidate = json.originalimage?.source ?? json.thumbnail?.source ?? null;
    if (candidate && isPhoto(candidate)) return candidate;
    return null;
  } catch {
    return null;
  }
}

// Baixa (localiza) uma FOTO real do destino usando fontes abertas.
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

    // Usa a IA para identificar o país/estado/cidade e o principal ponto turístico,
    // garantindo que a foto seja realmente de um destino de viagem.
    const { askCopilot } = await import("./ai.server");
    const aiRaw = await askCopilot(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: 300,
      },
      `Você identifica destinos de viagem. Dado o texto abaixo, determine o local real (país, estado ou cidade) e seu PRINCIPAL ponto turístico/cartão-postal (o mais fotografado e reconhecível).
Se o texto NÃO corresponder a um destino de viagem real, marque "valid": false.
Responda APENAS com JSON válido, sem texto extra:
{
  "valid": true/false,
  "place": "nome do local reconhecido (cidade, estado, país)",
  "landmark": "nome do principal ponto turístico/cartão-postal",
  "queries": ["3 a 5 termos de busca em inglês, começando pelo ponto turístico principal, para encontrar uma FOTO real do local"]
}

Texto: "${dest.replace(/"/g, "'")}"`,
    );

    let parsed: { valid?: boolean; place?: string; landmark?: string; queries?: unknown } = {};
    try {
      const cleaned = aiRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const s = cleaned.indexOf("{");
      const e = cleaned.lastIndexOf("}");
      if (s !== -1 && e !== -1) parsed = JSON.parse(cleaned.slice(s, e + 1));
    } catch {
      parsed = {};
    }

    if (parsed.valid === false) {
      throw new Error("O destino informado não parece ser um local de viagem válido.");
    }

    const first = dest.split(",")[0].trim();
    const aiQueries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      : [];
    // Prioriza o ponto turístico principal identificado pela IA.
    const searchTerms = [
      ...(parsed.landmark ? [parsed.landmark] : []),
      ...aiQueries,
      ...(parsed.place ? [parsed.place] : []),
      dest,
      first,
    ].filter((v, i, a) => !!v && a.indexOf(v) === i);

    // 1) Fotos reais no Wikimedia Commons (melhor para pontos turísticos).
    for (const q of searchTerms) {
      const img = await commonsPhoto(q);
      if (img) return { imageUrl: img };
    }

    // 2) Foto principal do artigo da Wikipedia (apenas se for foto real).
    for (const lang of ["pt", "en"]) {
      for (const q of searchTerms) {
        const img = await wikipediaPhoto(lang, q);
        if (img) return { imageUrl: img };
      }
    }

    throw new Error("Nenhuma foto real do destino foi encontrada.");
  });

