// Marca da agência no servidor: leitura da configuração e entrega da logo.
import { appwriteServerConfig, getServerBridge } from "@/integrations/appwrite/server";
import { APPWRITE_BUCKET_ID } from "@/integrations/appwrite/client";
import { PRODUCT, sanitizeBrandConfig, toBrand, type Brand, type BrandConfig } from "@/lib/brand";

const AGENCY_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

export function isAgencyId(value: unknown): value is string {
  return typeof value === "string" && AGENCY_ID.test(value);
}

function parse(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readBrandConfig(agencyId: string): Promise<BrandConfig> {
  const db = getServerBridge() as any;
  const { data: row, error } = await db
    .from("system_settings")
    .select("value")
    .eq("key", `agency_cfg:${agencyId}:brand`)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar a marca da agência.");
  return sanitizeBrandConfig(parse(row?.value));
}

async function agencyName(agencyId: string): Promise<string | null> {
  const db = getServerBridge() as any;
  const { data } = await db.from("agencies").select("id, name").eq("id", agencyId).maybeSingle();
  return data ? String(data.name || "") : null;
}

/** Marca de uma agência, pronta para a tela. `null` se a agência não existe. */
export async function readBrand(agencyId: string): Promise<Brand | null> {
  if (!isAgencyId(agencyId) || !appwriteServerConfig().key) return null;
  const name = await agencyName(agencyId);
  if (name === null) return null;
  return toBrand(agencyId, name || PRODUCT.name, await readBrandConfig(agencyId));
}

/** Marca pelo endereço curto da agência (slug), para páginas públicas. */
export async function readBrandBySlug(slug: string): Promise<Brand | null> {
  if (!appwriteServerConfig().key || !/^[a-z0-9][a-z0-9-]{0,99}$/i.test(slug)) return null;
  const db = getServerBridge() as any;
  const { data } = await db.from("agencies").select("id").eq("slug", slug).maybeSingle();
  return data?.id ? readBrand(String(data.id)) : null;
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/** Baixa do bucket a logo configurada da agência. Só entrega imagem. */
export async function fetchBrandLogo(
  agencyId: string,
  variant: "light" | "dark",
): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!isAgencyId(agencyId)) return null;
  const cfg = appwriteServerConfig();
  if (!cfg.key) return null;
  const brand = await readBrandConfig(agencyId);
  const fileId =
    variant === "dark" ? brand.logoDarkFileId || brand.logoFileId : brand.logoFileId || brand.logoDarkFileId;
  if (!fileId) return null;
  const res = await fetch(
    `${cfg.endpoint}/storage/buckets/${encodeURIComponent(APPWRITE_BUCKET_ID)}/files/${encodeURIComponent(fileId)}/view`,
    { headers: { "X-Appwrite-Project": cfg.project, "X-Appwrite-Key": cfg.key } },
  );
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.has(type)) return null;
  return { body: await res.arrayBuffer(), type };
}
