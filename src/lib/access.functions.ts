import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Acesso à plataforma: criação da agência (só com liberação) e painel de
// liberações do super admin. Regras em src/lib/server/access.ts.

export type ProvisionStatus = "ok" | "pending" | "blocked" | "verify_email" | "invite";

type Ctx = {
  userId: string;
  userEmail?: string;
  userEmailVerified?: boolean;
  userName?: string;
  membership?: { agencyId: string; suspended: boolean; isSuperAdmin: boolean } | null;
};

/** Situação de acesso do usuário logado. */
export const getMyAccessStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ status: "ok" | "suspended" | "none" }> => {
    const m = (context as Ctx).membership;
    if (!m) return { status: "none" };
    if (m.suspended && !m.isSuperAdmin) return { status: "suspended" };
    return { status: "ok" };
  });

function slugify(name: string) {
  return (
    (name || "agencia")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    Date.now().toString(36)
  );
}

/**
 * Cria a agência do usuário, se ele tiver liberação. Substitui a criação que
 * acontecia no navegador para qualquer conta nova.
 */
export const provisionMyAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ status: ProvisionStatus }> => {
    const ctx = context as Ctx;
    const email = (ctx.userEmail || "").trim().toLowerCase();
    if (ctx.membership) return { status: "ok" };

    const { getServerBridge } = await import("@/integrations/appwrite/server");
    const { isSuperAdmin } = await import("@/lib/server/authz");
    const access = await import("@/lib/server/access");
    const db = getServerBridge();

    // Já tem (ou teve) vínculo com alguma agência? Não cria outra.
    const { data: byUser } = await db
      .from("agency_members")
      .select("id, agency_id, status, is_active, user_id")
      .eq("user_id", ctx.userId)
      .limit(5);
    const { data: byEmail } = email
      ? await db.from("agency_members").select("id, agency_id, status, is_active, user_id").eq("email", email).limit(5)
      : { data: [] };
    const rows = [...((byUser as any[]) ?? []), ...((byEmail as any[]) ?? [])];
    if (rows.some((r) => r.status === "pending" && !r.is_active)) return { status: "invite" };
    if (rows.some((r) => r.user_id === ctx.userId || r.status === "blocked")) return { status: "blocked" };

    // Precisa de liberação (Hotmart ou manual). Super admin sempre pode.
    const superAdmin = isSuperAdmin(ctx);
    let grant = email ? await access.getGrant(email) : null;
    if (!superAdmin) {
      if (!access.isGrantActive(grant)) return { status: "pending" };
      // A liberação é do e-mail: a conta precisa provar que é dona dele.
      if (!ctx.userEmailVerified) return { status: "verify_email" };
    }

    const now = new Date().toISOString();
    const userName = (ctx.userName || email.split("@")[0] || "Administrador").slice(0, 80);
    const agencyName = `Agência de ${userName}`.slice(0, 80);
    const { data: agency, error: agErr } = await db
      .from("agencies")
      .insert({ name: agencyName, slug: slugify(userName), email, created_at: now, updated_at: now })
      .select()
      .single();
    if (agErr || !agency) {
      console.error("provisionMyAgency agency:", agErr);
      throw new Error("Não foi possível criar a agência. Tente novamente.");
    }
    const { error: memErr } = await db
      .from("agency_members")
      .insert({
        agency_id: (agency as { id: string }).id,
        user_id: ctx.userId,
        name: userName,
        email,
        role: "admin",
        status: "active",
        is_active: true,
        avatar_color: "#ff7a1a",
        pref_leads_mine: false,
        pref_tasks_mine: false,
        pref_agenda_mine: false,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (memErr) {
      console.error("provisionMyAgency member:", memErr);
      throw new Error("Não foi possível criar a agência. Tente novamente.");
    }

    if (grant) {
      grant = await access.saveGrant({ ...grant, agencyId: (agency as { id: string }).id });
    }
    return { status: "ok" };
  });

// ── Painel do super admin ────────────────────────────────────────

async function superAdminOnly(context: unknown) {
  const { requireSuperAdmin } = await import("@/lib/server/authz");
  requireSuperAdmin(context as Ctx);
  return import("@/lib/server/access");
}

export const listAccessGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await superAdminOnly(context);
    const [grants, events] = await Promise.all([access.listGrants(), access.listHotmartEvents(30)]);
    return {
      grants: grants.map((g) => ({ ...g, active: access.isGrantActive(g) })),
      events,
      webhookConfigured: !!process.env.HOTMART_HOTTOK,
      productFilter: (process.env.HOTMART_PRODUCT_IDS || "").trim() || null,
    };
  });

/** Libera um e-mail manualmente (cria ou reativa). */
export const grantAccessManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255), note: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await superAdminOnly(context);
    const current = await access.getGrant(data.email);
    const grant = current
      ? { ...current, override: "force_active" as const, note: data.note ?? current.note ?? null }
      : access.newGrant(data.email, "manual", { note: data.note ?? null });
    await access.saveGrant(grant);
    return { ok: true };
  });

/** Suspende, reativa ou volta a seguir a Hotmart. */
export const setAccessOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ email: z.string().trim().email(), override: z.enum(["none", "force_active", "force_suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const access = await superAdminOnly(context);
    const current = await access.getGrant(data.email);
    if (!current) throw new Error("Liberação não encontrada.");
    await access.saveGrant({ ...current, override: data.override });
    return { ok: true };
  });

/** Troca o e-mail de uma liberação (comprou com um e-mail, criou a conta com outro). */
export const changeGrantEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().trim().email(), to: z.string().trim().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const access = await superAdminOnly(context);
    const current = await access.getGrant(data.from);
    if (!current) throw new Error("Liberação não encontrada.");
    if (await access.getGrant(data.to)) throw new Error("Já existe uma liberação para o novo e-mail.");
    await access.saveGrant({ ...current, email: data.to });
    await access.deleteGrant(data.from);
    return { ok: true };
  });
