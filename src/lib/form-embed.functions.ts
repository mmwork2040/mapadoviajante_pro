import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Leitura pública (sem autenticação) do código de formulário configurado na
 * Administração. Usada pela página de captação `/intake`. Retorna apenas a URL
 * do formulário (não há PII envolvida). Usa a chave do servidor no Appwrite,
 * pois a página é aberta por visitantes sem conta.
 */
export const getPublicFormEmbed = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ agency: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }): Promise<{ src: string | null }> => {
    const { appwriteServerConfig, getServerBridge } = await import("@/integrations/appwrite/server");
    if (!appwriteServerConfig().key) {
      console.error("[intake] APPWRITE_API_KEY não configurada: sem acesso ao formulário da agência.");
      return { src: null };
    }
    const dbAdmin = getServerBridge() as any;

    // Resolve a agência: por slug (param `a`) ou a primeira cadastrada.
    let agencyId: string | null = null;
    if (data.agency) {
      const { data: ag } = await dbAdmin
        .from("agencies")
        .select("id")
        .eq("slug", data.agency)
        .limit(1)
        .maybeSingle();
      agencyId = ag?.id ?? null;
    }
    if (!agencyId) {
      const { data: ag } = await dbAdmin
        .from("agencies")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      agencyId = ag?.id ?? null;
    }
    if (!agencyId) return { src: null };

    const { data: row } = await dbAdmin
      .from("system_settings")
      .select("value")
      .eq("key", `agency_cfg:${agencyId}:form`)
      .maybeSingle();

    const embedCode = (row?.value as { embedCode?: string } | null)?.embedCode ?? "";
    const m = embedCode.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
    return { src: m ? m[1] : null };
  });
