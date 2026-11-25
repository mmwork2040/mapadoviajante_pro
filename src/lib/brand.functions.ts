import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Brand, BrandConfig } from "@/lib/brand";

// Marca da agência (white-label): logo e cor principal. Qualquer membro lê a
// marca da própria agência; só o admin altera.

/** Marca da agência do usuário logado. */
export const getMyBrand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Brand | null> => {
    const { getMembership } = await import("@/lib/server/authz");
    const { readBrand } = await import("@/lib/server/brand");
    const m = await getMembership(context);
    return readBrand(m.agencyId);
  });

/** Configuração de marca para a tela de edição. */
export const getMyBrandConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrandConfig> => {
    const { getMembership } = await import("@/lib/server/authz");
    const { readBrandConfig } = await import("@/lib/server/brand");
    const m = await getMembership(context);
    return readBrandConfig(m.agencyId);
  });

/** Salva a marca da agência. Só admin. Devolve a marca já pronta para a tela. */
export const saveMyBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        primary: z.string().max(9).nullable().optional(),
        logoFileId: z.string().max(36).nullable().optional(),
        logoDarkFileId: z.string().max(36).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<Brand | null> => {
    const { requireAdmin } = await import("@/lib/server/authz");
    const { sanitizeBrandConfig } = await import("@/lib/brand");
    const { writeAgencyConfigServer } = await import("@/lib/settings.functions");
    const { readBrand } = await import("@/lib/server/brand");
    const m = await requireAdmin(context);
    if (data.primary && !sanitizeBrandConfig({ primary: data.primary }).primary) {
      throw new Error("Cor inválida. Use o formato #rrggbb.");
    }
    const clean = sanitizeBrandConfig(data);
    await writeAgencyConfigServer(m.agencyId, "brand", { ...clean });
    return readBrand(m.agencyId);
  });

/** Marca de uma agência para páginas públicas (captação), pelo endereço curto. */
export const getPublicBrand = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ agency: z.string().max(100).optional() }).parse(data ?? {}))
  .handler(async ({ data }): Promise<Brand | null> => {
    if (!data.agency) return null;
    try {
      const { readBrandBySlug } = await import("@/lib/server/brand");
      return await readBrandBySlug(data.agency);
    } catch (err) {
      console.error("[brand] falha ao ler a marca pública:", err);
      return null;
    }
  });
