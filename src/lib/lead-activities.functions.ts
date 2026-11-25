import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/appwrite/auth-middleware";

/**
 * Exclui uma atividade da viagem. O cliente de dados do servidor já vem
 * limitado à agência do usuário, então só remove atividade da própria agência.
 */
export const deleteLeadActivityFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  // O ID pode ser um UUID (registros migrados) ou o ID curto do Appwrite.
  .inputValidator((data) => z.object({ id: z.string().trim().regex(/^[A-Za-z0-9._-]{1,36}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    // Confirma que a atividade é da agência do usuário.
    const { data: row, error: selErr } = await context.db
      .from("crm_lead_activities")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error("Falha ao verificar a atividade.");
    if (!row) throw new Error("Atividade não encontrada.");

    const { error } = await context.db
      .from("crm_lead_activities")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(`Falha ao excluir a atividade: ${error.message}`);
    return { ok: true };
  });
