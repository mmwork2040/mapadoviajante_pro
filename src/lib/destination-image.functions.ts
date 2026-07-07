import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DownloadInput = { destination: string; exclude?: string[] };

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
  // Aceita JPG e PNG (fotos), descartando SVG/mapas/bandeiras/logos por termo.
  return (
    (lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".png")) &&
    !isBadImage(url)
  );
}

// Busca fotos reais no Wikimedia Commons relacionadas ao destino.
// Retorna várias candidatas (para permitir alternar entre imagens).
async function commonsPhotos(query: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6", // File:
    gsrlimit: "40",
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
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            index?: number;
            title?: string;
            imageinfo?: { url?: string; thumburl?: string; mime?: string }[];
          }
        >;
      };
    };
    const pages = json.query?.pages ? Object.values(json.query.pages) : [];
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const out: string[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      if (info.mime && !info.mime.startsWith("image/")) continue;
      const full = info.url ?? "";
      const title = p.title ?? "";
      if (full && isPhoto(full) && !isBadImage(title)) {
        out.push(info.thumburl ?? full);
      }
    }
    return out;
  } catch {
    return [];
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
    const exclude = Array.isArray(d.exclude)
      ? d.exclude.filter((x): x is string => typeof x === "string")
      : [];
    return { destination: d.destination.trim(), exclude };
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
        maxTokens: 600,
      },
      `Você é um especialista em turismo. Dado o texto abaixo, identifique o local real (país, estado, região ou cidade).
Determine o PRINCIPAL cartão-postal / atrativo turístico mais icônico e reconhecível desse local (o símbolo nº 1 do lugar, ex: "Cristo Redentor" para o Rio, "Torre Eiffel" para Paris, "Machu Picchu" para o Peru, "Torres del Paine" para o Chile).
Depois liste outros pontos turísticos icônicos como alternativas, em ordem de importância.
Se o texto NÃO corresponder a um destino de viagem real, marque "valid": false.
Responda APENAS com JSON válido, sem texto extra:
{
  "valid": true/false,
  "place": "nome do local reconhecido (cidade, estado, país) em inglês",
  "landmark": "o PRINCIPAL cartão-postal do local em inglês (apenas o nome do atrativo, ex: 'Christ the Redeemer')",
  "queries": ["8 a 12 termos de busca em inglês para FOTOS reais, do MAIS icônico ao menos, sempre incluindo o nome do local para desambiguar (ex: 'Christ the Redeemer Rio de Janeiro', 'Sugarloaf Mountain Rio')"]
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

    // Não rejeitamos por causa de "valid": false — a IA pode errar.

    const first = dest.split(",")[0].trim();
    const landmark = typeof parsed.landmark === "string" ? parsed.landmark.trim() : "";
    const place = typeof parsed.place === "string" ? parsed.place.trim() : "";
    // Combina o cartão-postal com o nome do local para busca mais precisa.
    const landmarkQuery = landmark && place ? `${landmark} ${place}` : landmark;
    const aiQueries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      : [];
    // SEMPRE prioriza o principal cartão-postal, depois os demais atrativos.
    const searchTerms = [
      ...(landmarkQuery ? [landmarkQuery] : []),
      ...(landmark ? [landmark] : []),
      ...aiQueries,
      ...(place ? [place] : []),
      dest,
      first,
    ].filter((v, i, a) => !!v && a.indexOf(v) === i);


    const excluded = new Set(data.exclude);

    // 0) SEMPRE tenta primeiro a foto canônica (cartão-postal) do principal
    // atrativo, via artigo da Wikipedia — é a imagem mais reconhecível do lugar.
    if (landmark) {
      for (const lang of ["en", "pt"]) {
        const img = await wikipediaPhoto(lang, landmark);
        if (img && !excluded.has(img)) return { imageUrl: img };
      }
    }

    // 1) Junta um POOL de fotos reais do Wikimedia Commons de vários pontos
    // turísticos, preservando a ordem de relevância e sem duplicatas.
    const pool: string[] = [];
    const seen = new Set<string>();
    for (const q of searchTerms) {
      const imgs = await commonsPhotos(q);
      for (const img of imgs) {
        if (!seen.has(img)) {
          seen.add(img);
          pool.push(img);
        }
      }
      // já temos candidatos suficientes para variar bastante
      if (pool.filter((u) => !excluded.has(u)).length >= 12) break;
    }
    const fresh = pool.find((u) => !excluded.has(u));
    if (fresh) return { imageUrl: fresh };

    // 2) Foto principal do artigo da Wikipedia (apenas se for foto real).
    for (const lang of ["pt", "en"]) {
      for (const q of searchTerms) {
        const img = await wikipediaPhoto(lang, q);
        if (img && !excluded.has(img)) return { imageUrl: img };
      }
    }

    throw new Error(
      excluded.size
        ? "Não há outras fotos disponíveis para este destino."
        : "Nenhuma foto real do destino foi encontrada.",
    );
  });



