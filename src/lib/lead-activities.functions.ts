import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exclui uma atividade de lead usando a sessão autenticada do usuário.
 * A política de RLS no banco restringe a remoção à própria agência.
 */
export const deleteLeadActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Confirma que a atividade é visível para o usuário (mesma agência via RLS).
    const { data: row, error: selErr } = await context.supabase
      .from("crm_lead_activities")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error("Falha ao verificar a atividade.");
    if (!row) throw new Error("Atividade não encontrada.");

    const { error } = await context.supabase
      .from("crm_lead_activities")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(`Falha ao excluir a atividade: ${error.message}`);
    return { ok: true };
  });
