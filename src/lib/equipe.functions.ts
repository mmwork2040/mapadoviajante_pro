// Alterações na equipe, sempre pelo servidor. As linhas da equipe só podem ser
// lidas pelo time da agência; ninguém grava nelas pelo navegador. Assim ninguém
// muda o próprio cargo nem mexe na linha de outra pessoa sem ser administrador.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CARGOS = ["admin", "gerente", "consultor", "comercial", "financeiro", "agent"] as const;

/** O próprio cadastro: nome, telefone, cor e as preferências "só minhas". */
export const alterarMeuCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(1).max(120).optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      avatar_color: z.string().trim().max(20).nullable().optional(),
      pref_leads_mine: z.boolean().optional(),
      pref_tasks_mine: z.boolean().optional(),
      pref_agenda_mine: z.boolean().optional(),
    }).strict().parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getMembership } = await import("@/lib/server/authz");
    const { updateDoc } = await import("@/lib/server/teams");
    const m = await getMembership(context);
    await updateDoc("agency_members", m.memberId, { ...data, updated_at: new Date().toISOString() });
    return { ok: true };
  });

/** Ações do administrador sobre outra pessoa da equipe. */
export const alterarMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().min(1).max(64),
      acao: z.enum(["cargo", "bloquear", "desbloquear", "revogar", "remover"]),
      role: z.enum(CARGOS).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("@/lib/server/authz");
    const { listDocs, updateDoc, syncAgencyTeam, query, apagarDoc, contar } = await import("@/lib/server/teams");
    const adm = await requireAdmin(context);
    const [alvo] = await listDocs("agency_members", [query("equal", [data.id], "$id")]);
    if (!alvo || alvo.agency_id !== adm.agencyId) return { ok: false, error: "Pessoa não encontrada na sua equipe." };
    if (alvo.$id === adm.memberId && data.acao !== "cargo") return { ok: false, error: "Você não pode fazer isso com o seu próprio acesso." };
    if (alvo.$id === adm.memberId && data.role !== "admin") return { ok: false, error: "Peça a outro administrador para mudar o seu cargo." };

    const agora = new Date().toISOString();
    let action: "blocked" | "deleted" | undefined;
    if (data.acao === "cargo") {
      if (!data.role) return { ok: false, error: "Escolha o cargo." };
      await updateDoc("agency_members", alvo.$id, { role: data.role, updated_at: agora });
    } else if (data.acao === "bloquear") {
      await updateDoc("agency_members", alvo.$id, { is_active: false, status: "blocked", invite_token: null, updated_at: agora });
    } else if (data.acao === "desbloquear") {
      await updateDoc("agency_members", alvo.$id, { is_active: true, status: "active", updated_at: agora });
    } else if (data.acao === "revogar") {
      if (alvo.status !== "pending") return { ok: false, error: "Só dá para revogar convite ainda não aceito." };
      await apagarDoc("agency_members", alvo.$id);
    } else {
      // Quem tem histórico em seu nome é bloqueado, para manter o histórico; os demais saem de vez.
      const id = alvo.$id;
      const historico =
        (await contar("crm_lead_activities", "author_id", id)) + (await contar("crm_lead_activities", "assigned_to_id", id)) +
        (await contar("crm_leads", "assigned_to", id)) + (await contar("crm_tasks", "assigned_to", id)) +
        (await contar("crm_tasks", "created_by", id)) + (await contar("crm_transactions", "created_by", id));
      if (historico > 0) {
        await updateDoc("agency_members", id, { is_active: false, status: "blocked", invite_token: null, updated_at: agora });
        action = "blocked";
      } else {
        await apagarDoc("agency_members", id);
        action = "deleted";
      }
    }
    await syncAgencyTeam(adm.agencyId);
    return { ok: true, action };
  });
