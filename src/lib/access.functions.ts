// Acesso à agência. Com os registros visíveis só para o time da agência, quem
// ainda não está no time não consegue nem ler a própria linha da equipe. Por
// isso vincular a conta, aceitar convite e criar agência nova passam por aqui,
// no servidor, que confere o usuário pelo token e acerta o time.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Linha = Record<string, any>;

const membro = (m: Linha) => ({
  id: m.$id, agency_id: m.agency_id, user_id: m.user_id, name: m.name, email: m.email, phone: m.phone ?? "",
  role: m.role, avatar_color: m.avatar_color, is_active: m.is_active, status: m.status, pref_leads_mine: !!m.pref_leads_mine,
});

async function nomeDaAgencia(agencyId: string) {
  const { listDocs, query } = await import("@/lib/server/teams");
  return (await listDocs("agencies", [query("equal", [agencyId], "$id")]))[0]?.name ?? null;
}

/**
 * Garante o acesso de quem acabou de entrar. Na ordem:
 * 1. convite pelo link (token), se vier e o e-mail bater;
 * 2. linha da equipe já ligada à conta;
 * 3. linha ativa com o mesmo e-mail e sem conta válida (contas migradas);
 * 4. convite pendente para o e-mail: devolve o convite para a tela perguntar;
 * 5. ninguém: cria a agência da pessoa, se `provisionar`.
 * Em todos os casos o time da agência é acertado antes de responder.
 */
export const garantirAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().max(200).optional(), provisionar: z.boolean().optional(), nome: z.string().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { listDocs, updateDoc, createDoc, userExists, syncAgencyTeam, query } = await import("@/lib/server/teams");
    const { agencyPermissions } = await import("@/integrations/appwrite/permissions");
    const userId = context.userId;
    const email = (context.userEmail || "").trim().toLowerCase();
    const agora = new Date().toISOString();

    let linha: Linha | undefined;

    if (data.token) {
      const [conv] = await listDocs("agency_members", [query("equal", [data.token], "invite_token")]);
      if (conv && (conv.email || "").toLowerCase() === email) {
        linha = await updateDoc("agency_members", conv.$id, { user_id: userId, status: "active", is_active: true, invite_token: null, updated_at: agora });
      }
    }

    if (!linha) {
      const minhas = await listDocs("agency_members", [query("equal", [userId], "user_id"), query("equal", [true], "is_active")]);
      linha = minhas[0];
    }

    // Ligar por e-mail exige e-mail confirmado: senão qualquer um criaria uma conta
    // com o e-mail de outra pessoa e assumiria o lugar dela na equipe.
    const confirmado = !!context.emailVerified;

    if (!linha && email && confirmado) {
      const porEmail = await listDocs("agency_members", [query("equal", [email], "email"), query("equal", [true], "is_active")]);
      for (const m of porEmail) {
        if (m.user_id && m.user_id !== userId && (await userExists(m.user_id))) continue; // é de outra conta
        linha = await updateDoc("agency_members", m.$id, { user_id: userId, updated_at: agora });
        break;
      }
    }

    if (!linha && email) {
      const [conv] = await listDocs("agency_members", [query("equal", [email], "email"), query("equal", ["pending"], "status")]);
      if (conv) {
        return { member: null, precisaConfirmarEmail: !confirmado, pendingInvite: { id: conv.$id, agency_id: conv.agency_id, name: conv.name, email: conv.email, agency_name: await nomeDaAgencia(conv.agency_id) } };
      }
    }

    if (!linha && data.provisionar) {
      const nome = (data.nome || context.userEmail || "Novo usuário").trim();
      const slug = `${nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
      const agencia = await createDoc("agencies", { name: `Agência de ${nome}`, slug, email, created_at: agora, updated_at: agora }, []);
      const perms = agencyPermissions(agencia.$id);
      linha = await createDoc("agency_members", {
        agency_id: agencia.$id, user_id: userId, name: nome, email, role: "admin", status: "active", is_active: true,
        avatar_color: "#ff7a1a", pref_leads_mine: false, pref_tasks_mine: false, pref_agenda_mine: false, created_at: agora, updated_at: agora,
      }, perms);
    }

    if (!linha) return { member: null, pendingInvite: null };
    await syncAgencyTeam(linha.agency_id);
    return { member: membro(linha), pendingInvite: null };
  });

/** Aceita o convite pendente para o e-mail de quem está logado. */
export const aceitarConviteDoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listDocs, updateDoc, syncAgencyTeam, query } = await import("@/lib/server/teams");
    const email = (context.userEmail || "").trim().toLowerCase();
    if (!context.emailVerified) return { ok: false, error: "Confirme seu e-mail (link enviado na criação da conta) ou abra o link do convite." };
    const [conv] = email ? await listDocs("agency_members", [query("equal", [email], "email"), query("equal", ["pending"], "status")]) : [];
    if (!conv) return { ok: false, error: "Não há convite pendente para o seu e-mail." };
    await updateDoc("agency_members", conv.$id, { user_id: context.userId, status: "active", is_active: true, invite_token: null, updated_at: new Date().toISOString() });
    await syncAgencyTeam(conv.agency_id);
    return { ok: true };
  });

/** Dados do convite pelo token, para a página de aceite (não exige login). */
export const infoDoConvite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(8).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { listDocs, query } = await import("@/lib/server/teams");
    const [conv] = await listDocs("agency_members", [query("equal", [data.token], "invite_token")]);
    if (!conv || conv.status !== "pending") return { valid: false, email: null, name: null, agency_name: null };
    return { valid: true, email: conv.email as string, name: conv.name as string, agency_name: await nomeDaAgencia(conv.agency_id) };
  });

/** Depois de bloquear, remover ou reativar alguém, acerta o time da agência. Só administrador. */
export const sincronizarEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/server/authz");
    const { agencyId } = await requireAdmin(context);
    const { syncAgencyTeam } = await import("@/lib/server/teams");
    await syncAgencyTeam(agencyId);
    return { ok: true };
  });
