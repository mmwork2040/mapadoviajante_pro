// Server-only helpers that let the AI assistant treat the agency library as a
// memory bank: it searches open sources (Wikimedia / Wikipedia) for real photos
// of the lead's destination and stores them in the library for future reuse.
import type { SupabaseClient } from "@supabase/supabase-js";

const LIBRARY_BUCKET = "library-assets";

const BAD_TERMS = [
  "flag", "bandeira", "coat", "brasao", "brasão", "escudo", "map", "mapa",
  "logo", "seal", "emblem", "icon", "ícone", "svg", "drawing", "desenho",
  "illustration", "ilustra", "diagram", "chart", "orthographic", "locator",
  "location", "arms",
];

function isBadImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg")) return true;
  return BAD_TERMS.some((t) => lower.includes(t));
}

function isPhoto(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    (lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".png")) &&
    !isBadImage(url)
  );
}

interface PhotoCandidate {
  url: string;
  title: string;
}

async function commonsPhotos(query: string): Promise<PhotoCandidate[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "30",
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
          { index?: number; title?: string; imageinfo?: { url?: string; thumburl?: string; mime?: string }[] }
        >;
      };
    };
    const pages = json.query?.pages ? Object.values(json.query.pages) : [];
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const out: PhotoCandidate[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      if (info.mime && !info.mime.startsWith("image/")) continue;
      const full = info.url ?? "";
      const title = (p.title ?? "").replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "").trim();
      if (full && isPhoto(full) && !isBadImage(p.title ?? "")) {
        out.push({ url: info.thumburl ?? full, title: title || query });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Slugify for a friendly file name. */
function slug(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 100) || "imagem";
}

export interface StoredLibraryImage {
  title: string;
}

/**
 * Ensures the agency library has real destination photos. Searches open sources
 * for the given queries, downloads new (non-duplicate) photos and stores them as
 * library items of type "image". Returns the titles of the images it added.
 */
export async function ensureDestinationImages(params: {
  supabase: SupabaseClient;
  agencyId: string;
  memberId: string | null;
  destination: string;
  queries: string[];
  existingTitles: string[];
  maxToAdd?: number;
}): Promise<StoredLibraryImage[]> {
  const { supabase, agencyId, memberId, destination, queries, existingTitles } = params;
  const maxToAdd = params.maxToAdd ?? 4;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const existing = new Set(existingTitles.map(norm));

  // Collect a pool of candidate photos, preserving relevance order, no dupes.
  const pool: PhotoCandidate[] = [];
  const seenUrl = new Set<string>();
  for (const q of queries) {
    const imgs = await commonsPhotos(q);
    for (const img of imgs) {
      if (seenUrl.has(img.url)) continue;
      if (existing.has(norm(img.title))) continue;
      seenUrl.add(img.url);
      pool.push(img);
    }
    if (pool.length >= maxToAdd * 3) break;
  }

  const added: StoredLibraryImage[] = [];
  for (const cand of pool) {
    if (added.length >= maxToAdd) break;
    try {
      const res = await fetch(cand.url, { headers: { "User-Agent": "OSegredoDoViajante/1.0" } });
      if (!res.ok) continue;
      const mime = res.headers.get("content-type") || "image/jpeg";
      if (!mime.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = mime.includes("png") ? "png" : "jpg";
      const title = cand.title.slice(0, 120);
      const path = `${agencyId}/${crypto.randomUUID()}-${slug(title)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LIBRARY_BUCKET)
        .upload(path, buf, { contentType: mime, upsert: false });
      if (upErr) continue;
      const { error: insErr } = await supabase.from("crm_library_items").insert({
        agency_id: agencyId,
        type: "image",
        title,
        location: destination,
        description: `Foto de ${destination} adicionada automaticamente pelo assistente para o acervo da biblioteca.`,
        file_url: path,
        tags: ["auto", "destino", destination].filter(Boolean),
        created_by: memberId,
      });
      if (insErr) {
        await supabase.storage.from(LIBRARY_BUCKET).remove([path]);
        continue;
      }
      added.push({ title });
      existing.add(norm(title));
    } catch {
      /* ignora candidato com falha */
    }
  }
  return added;
}
