import { supabase } from "@/integrations/supabase/client";
import type {
  AgencyMember,
  AiConfig,
  DashboardStats,
  Destination,
  Itinerary,
  ItineraryActivity,
  ItineraryDay,
  Lead,
  LibraryItem,
  LibraryItemType,
  LeadActivity,
  Task,
  Transaction,
  Voucher,
} from "@/lib/types";

// ── Cache de contexto da agência ───────────────────────────────
let _agencyId: string | null = null;
let _memberId: string | null = null;
let _memberRole: string | null = null;

export function getAgencyId() {
  return _agencyId;
}
export function getMemberId() {
  return _memberId;
}
export function getMemberRole() {
  return _memberRole;
}
export function setAgencyContext(member: AgencyMember | null) {
  _agencyId = member?.agency_id ?? null;
  _memberId = member?.id ?? null;
  _memberRole = member?.role ?? null;
}

export async function loadAgencyContext(): Promise<AgencyMember | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: members, error } = await supabase
    .from("agency_members")
    .select("id, agency_id, name, email, phone, role, avatar_color, is_active, user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (error || !members || members.length === 0) return null;
  setAgencyContext(members[0] as AgencyMember);
  return members[0] as AgencyMember;
}

// ── Auto provisionamento de agência (novo usuário) ─────────────
export async function autoProvisionAgency(
  userId: string,
  userName: string,
  userEmail: string,
): Promise<AgencyMember | null> {
  const agencyName = `Agência de ${userName || "Novo Usuário"}`;
  const slug =
    (userName || "novo-usuario")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36);

  // Provisionamento atômico via RPC SECURITY DEFINER (cria agência + membro admin
  // numa única transação, evitando agências órfãs e escalonamento de privilégio).
  const { data: member, error } = await supabase
    .rpc("provision_agency", {
      _name: agencyName,
      _slug: slug,
      _email: userEmail,
      _user_name: userName || "Novo Usuário",
      _avatar_color: "#ff7a1a",
    })
    .single();
  if (error || !member) {
    console.error("autoProvisionAgency — provision_agency:", error);
    return null;
  }

  setAgencyContext(member as AgencyMember);
  return member as AgencyMember;
}

// ── Team members ───────────────────────────────────────────────
export async function fetchTeamMembers(): Promise<AgencyMember[]> {
  if (!_agencyId) return [];
  const { data, error } = await supabase
    .from("agency_members")
    .select("id, name, email, phone, role, avatar_color, is_active, user_id, agency_id, status")
    .eq("agency_id", _agencyId)
    .order("name");
  if (error) {
    console.error("fetchTeamMembers:", error);
    throw new Error("Não foi possível carregar a equipe.");
  }
  return (data as AgencyMember[]) || [];
}


export async function updateMemberRole(id: string, role: string): Promise<boolean> {
  const { error } = await supabase.from("agency_members").update({ role }).eq("id", id);
  if (error) {
    console.error("updateMemberRole:", error);
    return false;
  }
  return true;
}

/** Revoke a still-pending invite by removing the member row. The person loses
 * access until they are invited again (which creates a fresh row + token). */
export async function revokeMember(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("agency_members")
    .delete()
    .eq("id", id)
    .eq("status", "pending");
  if (error) {
    console.error("revokeMember:", error);
    return false;
  }
  return true;
}

/** Conta quantos registros de atividade existem em nome de um membro. */
async function countMemberActivity(id: string): Promise<number> {
  const checks = [
    supabase.from("crm_lead_activities").select("id", { count: "exact", head: true }).eq("author_id", id),
    supabase.from("crm_lead_activities").select("id", { count: "exact", head: true }).eq("assigned_to_id", id),
    supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("assigned_to", id),
    supabase.from("crm_tasks").select("id", { count: "exact", head: true }).eq("assigned_to", id),
    supabase.from("crm_tasks").select("id", { count: "exact", head: true }).eq("created_by", id),
    supabase.from("crm_transactions").select("id", { count: "exact", head: true }).eq("created_by", id),
  ];
  const results = await Promise.all(checks);
  return results.reduce((sum, r) => sum + (r.count ?? 0), 0);
}

/**
 * Remove um membro da equipe. Se houver registros de atividade em seu nome,
 * apenas bloqueia o acesso (mantém o histórico). Caso contrário, exclui o
 * membro completamente da agência.
 */
export async function removeMember(
  id: string,
): Promise<{ ok: boolean; action?: "blocked" | "deleted"; error?: string }> {
  const activity = await countMemberActivity(id);

  if (activity > 0) {
    const { error } = await supabase
      .from("agency_members")
      .update({ is_active: false, status: "blocked", invite_token: null })
      .eq("id", id);
    if (error) {
      console.error("removeMember (block):", error);
      return { ok: false, error: "Não foi possível bloquear o membro." };
    }
    return { ok: true, action: "blocked" };
  }

  const { error } = await supabase.from("agency_members").delete().eq("id", id);
  if (error) {
    console.error("removeMember (delete):", error);
    return { ok: false, error: "Não foi possível excluir o membro." };
  }
  return { ok: true, action: "deleted" };
}

/** Bloqueia ou desbloqueia o acesso de um membro (somente admins, via RLS). */
export async function setMemberBlocked(id: string, blocked: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("agency_members")
    .update(
      blocked
        ? { is_active: false, status: "blocked", invite_token: null }
        : { is_active: true, status: "active" },
    )
    .eq("id", id);
  if (error) {
    console.error("setMemberBlocked:", error);
    return false;
  }
  return true;
}

/** Atualiza os dados do próprio perfil (nome, telefone, cor). Não altera cargo. */
export async function updateMyProfile(updates: {
  name?: string;
  phone?: string | null;
  avatar_color?: string | null;
}): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from("agency_members")
    .update(updates)
    .eq("user_id", user.id);
  if (error) {
    console.error("updateMyProfile:", error);
    return false;
  }
  return true;
}

/** Altera a senha do usuário logado. */
export async function updateMyPassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}





// ── Leads ──────────────────────────────────────────────────────
const CONTACTED_PROFILE_STATUS_KEY = "__crm_status";

function normalizeLead(lead: Lead): Lead {
  const profile = (lead.profile || {}) as Record<string, unknown>;
  return profile[CONTACTED_PROFILE_STATUS_KEY] === "contacted"
    ? { ...lead, status: "contacted" }
    : lead;
}

export async function fetchLeads(filters: {
  status?: string;
  destination?: string;
  search?: string;
} = {}): Promise<Lead[]> {
  if (!_agencyId) return [];
  let query = supabase
    .from("crm_leads")
    .select("*, assigned_member:agency_members!crm_leads_assigned_to_fkey(name, avatar_color)")
    .eq("agency_id", _agencyId)
    .order("name", { ascending: true });

  if (filters.status && filters.status !== "contacted") query = query.eq("status", filters.status);
  if (filters.destination) query = query.eq("destination", filters.destination);
  if (filters.search)
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,destination.ilike.%${filters.search}%`,
    );

  const { data, error } = await query;
  if (error) {
    console.error("fetchLeads:", error);
    throw new Error("Não foi possível carregar os leads.");
  }
  const normalized = ((data as Lead[]) || []).map(normalizeLead);
  return filters.status ? normalized.filter((lead) => lead.status === filters.status) : normalized;
}

export async function fetchLeadById(leadId: string): Promise<Lead | null> {
  let query = supabase.from("crm_leads").select("*").eq("id", leadId);
  if (_agencyId) query = query.eq("agency_id", _agencyId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("fetchLeadById:", error);
    throw new Error("Não foi possível carregar o lead.");
  }
  return data ? normalizeLead(data as Lead) : null;
}

export async function createLead(leadData: Partial<Lead>): Promise<Lead | null> {
  if (!_agencyId) await loadAgencyContext();

  const payload = {
    agency_id: _agencyId,
    assigned_to: leadData.assigned_to || _memberId,
    name: leadData.name,
    email: leadData.email || null,
    phone: leadData.phone || null,
    destination: leadData.destination || null,
    value: leadData.value || 0,
    status: leadData.status || "new",
    origin: leadData.origin || "direto",
    notes: leadData.notes || null,
    profile: leadData.profile || {},
    checklists: leadData.checklists || {},
  };

  const { data, error } = await supabase
    .from("crm_leads")
    .insert(payload)
    .select()
    .single();
  if (error) {
    if (leadData.status === "contacted" && error.code === "23514") {
      const fallbackProfile = { ...(leadData.profile || {}) } as Record<string, unknown>;
      fallbackProfile[CONTACTED_PROFILE_STATUS_KEY] = "contacted";
      const { data: fallback, error: fallbackError } = await supabase
        .from("crm_leads")
        .insert({ ...payload, status: "new", profile: fallbackProfile })
        .select()
        .single();
      if (fallbackError) {
        console.error("createLead fallback:", fallbackError);
        return null;
      }
      return normalizeLead(fallback as Lead);
    }
    console.error("createLead:", error);
    return null;
  }
  return normalizeLead(data as Lead);
}

export async function updateLead(leadId: string, updates: Partial<Lead>): Promise<Lead | null> {
  const normalizedUpdates = { ...updates } as Partial<Lead>;

  if (updates.status && updates.status !== "contacted") {
    const { data: current, error: currentError } = await supabase
      .from("crm_leads")
      .select("profile")
      .eq("id", leadId)
      .maybeSingle();

    if (currentError) {
      console.error("updateLead profile:", currentError);
      return null;
    }

    const profile = { ...((current?.profile || {}) as Record<string, unknown>) };
    delete profile[CONTACTED_PROFILE_STATUS_KEY];
    normalizedUpdates.profile = profile;
  }

  const { data, error } = await supabase
    .from("crm_leads")
    .update({ ...normalizedUpdates, last_activity_at: new Date().toISOString() })
    .eq("id", leadId)
    .select()
    .single();
  if (error) {
    if (updates.status === "contacted" && error.code === "23514") {
      const { data: current, error: currentError } = await supabase
        .from("crm_leads")
        .select("profile")
        .eq("id", leadId)
        .maybeSingle();

      if (currentError) {
        console.error("updateLead fallback profile:", currentError);
        return null;
      }

      const profile = { ...((current?.profile || {}) as Record<string, unknown>) };
      profile[CONTACTED_PROFILE_STATUS_KEY] = "contacted";

      const { data: fallback, error: fallbackError } = await supabase
        .from("crm_leads")
        .update({ ...updates, status: "new", profile, last_activity_at: new Date().toISOString() })
        .eq("id", leadId)
        .select()
        .single();

      if (fallbackError) {
        console.error("updateLead fallback:", fallbackError);
        return null;
      }

      return normalizeLead(fallback as Lead);
    }
    console.error("updateLead:", error);
    return null;
  }
  return normalizeLead(data as Lead);
}

export async function deleteLead(leadId: string): Promise<boolean> {
  const { error } = await supabase.from("crm_leads").delete().eq("id", leadId);
  if (error) {
    console.error("deleteLead:", error);
    return false;
  }
  return true;
}

// Captação pública (intake) — sem contexto de agência autenticado.
export async function createPublicLead(agencyId: string, leadData: Partial<Lead>): Promise<boolean> {
  const { error } = await supabase.from("crm_leads").insert({
    agency_id: agencyId,
    name: leadData.name,
    email: leadData.email || null,
    phone: leadData.phone || null,
    destination: leadData.destination || null,
    value: leadData.value || 0,
    status: "new",
    origin: "intake",
    notes: leadData.notes || null,
    profile: leadData.profile || {},
  });
  if (error) {
    console.error("createPublicLead:", error);
    return false;
  }
  return true;
}

// ── Lead activities ────────────────────────────────────────────
export async function fetchLeadActivities(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await supabase
    .from("crm_lead_activities")
    .select(
      "*, author:agency_members!crm_lead_activities_author_id_fkey(id, name, avatar_color, role), assigned:agency_members!crm_lead_activities_assigned_to_id_fkey(id, name, avatar_color)",
    )
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchLeadActivities:", error);
    throw new Error("Não foi possível carregar o histórico.");
  }
  const activities = (data as LeadActivity[]) || [];

  // Enriquece cada atividade com a data de execução e o status da tarefa vinculada.
  const { data: tasks } = await supabase
    .from("crm_tasks")
    .select("due_date, completed, description")
    .eq("lead_id", leadId);
  if (tasks) {
    for (const a of activities) {
      const linked = (tasks as { due_date?: string | null; completed?: boolean | null; description?: string | null }[])
        .find((t) => (t.description || "").includes(ACTIVITY_TASK_MARK(a.id)));
      if (linked) {
        a.due_date = linked.due_date ?? a.due_date;
        a.completed = linked.completed ?? false;
      }
    }
  }
  return activities;
}


// Marca invisível que liga uma tarefa de agenda à atividade que a originou.
const ACTIVITY_TASK_MARK = (id: string) => `[atv:${id}]`;

/** Uma tarefa/atividade é considerada expirada (atrasada) quando a data de
 * execução já passou e ainda não foi concluída pelo usuário. */
export function isOverdue(due_date?: string | null, completed?: boolean | null): boolean {
  if (!due_date || completed) return false;
  const due = new Date(due_date);
  if (Number.isNaN(due.getTime())) return false;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return dueDay < todayStart.getTime();
}


/** Remove a marca de vínculo interna da descrição de uma tarefa. */
export function cleanTaskDescription(desc?: string | null): string {
  if (!desc) return "";
  return desc.replace(/\s*\[atv:[0-9a-f-]+\]\s*/gi, "").trim();
}

export async function deleteLeadActivity(id: string): Promise<boolean> {
  try {
    // Remove a tarefa de agenda vinculada (se houver), limpando tudo referente.
    await supabase
      .from("crm_tasks")
      .delete()
      .ilike("description", `%${ACTIVITY_TASK_MARK(id)}%`);
    const { deleteLeadActivityFn } = await import("@/lib/lead-activities.functions");
    await deleteLeadActivityFn({ data: { id } });
    return true;
  } catch (error) {
    console.error("deleteLeadActivity:", error);
    return false;
  }
}



/** Marca/desmarca a atividade como concluída, atualizando a tarefa vinculada. */
export async function setLeadActivityCompleted(
  activityId: string,
  completed: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("crm_tasks")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .ilike("description", `%${ACTIVITY_TASK_MARK(activityId)}%`);
  if (error) {
    console.error("setLeadActivityCompleted:", error);
    return false;
  }
  return true;
}

/** Atualiza uma atividade e a tarefa de agenda vinculada. */
export async function updateLeadActivity(
  activityId: string,
  activityData: Partial<LeadActivity> & { due_date?: string | null },
): Promise<boolean> {
  const { error } = await supabase
    .from("crm_lead_activities")
    .update({
      type: activityData.type,
      title: activityData.title,
      details: activityData.details || null,
      assigned_to_id: activityData.assigned_to_id || null,
    })
    .eq("id", activityId);
  if (error) {
    console.error("updateLeadActivity:", error);
    return false;
  }

  // Atualiza a tarefa de agenda vinculada (se houver).
  const desc = [activityData.details?.trim(), ACTIVITY_TASK_MARK(activityId)]
    .filter(Boolean)
    .join("\n\n");
  const { error: taskErr } = await supabase
    .from("crm_tasks")
    .update({
      title: activityData.title,
      description: desc,
      assigned_to: activityData.assigned_to_id || null,
      ...(activityData.due_date ? { due_date: activityData.due_date } : {}),
    })
    .ilike("description", `%${ACTIVITY_TASK_MARK(activityId)}%`);
  if (taskErr) console.error("updateLeadActivity(task):", taskErr);
  return true;
}

export async function createLeadActivity(
  leadId: string,
  activityData: Partial<LeadActivity> & { due_date?: string | null },
): Promise<LeadActivity | null> {
  const { data, error } = await supabase
    .from("crm_lead_activities")
    .insert({
      agency_id: _agencyId,
      lead_id: leadId,
      author_id: _memberId,
      assigned_to_id: activityData.assigned_to_id || null,
      type: activityData.type,
      title: activityData.title,
      details: activityData.details || null,
      mentions: activityData.mentions || [],
    })
    .select(
      "*, author:agency_members!crm_lead_activities_author_id_fkey(id, name, avatar_color, role), assigned:agency_members!crm_lead_activities_assigned_to_id_fkey(id, name, avatar_color)",
    )
    .single();
  if (error) {
    console.error("createLeadActivity:", error);
    return null;
  }
  const activity = data as LeadActivity;

  // Se houver data de execução, cria uma tarefa vinculada para a agenda.
  if (activityData.due_date) {
    const desc = [activityData.details?.trim(), ACTIVITY_TASK_MARK(activity.id)]
      .filter(Boolean)
      .join("\n\n");
    const { error: taskErr } = await supabase.from("crm_tasks").insert({
      agency_id: _agencyId,
      created_by: _memberId,
      lead_id: leadId,
      assigned_to: activityData.assigned_to_id || null,
      title: activity.title,
      priority: "normal",
      due_date: activityData.due_date,
      description: desc,
    });
    if (taskErr) console.error("createLeadActivity(task):", taskErr);
  }

  await supabase
    .from("crm_leads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", leadId);

  // Notifica o membro atribuído (se for diferente do autor).
  if (activityData.assigned_to_id && activityData.assigned_to_id !== _memberId) {
    const { data: leadRow } = await supabase.from("crm_leads").select("name").eq("id", leadId).maybeSingle();
    const leadName = (leadRow as { name?: string } | null)?.name || "um lead";
    await createNotification({
      recipientId: activityData.assigned_to_id,
      type: "activity_assigned",
      title: "Nova atividade atribuída a você",
      body: `${activity.title} — ${leadName}`,
      link: `/leads?lead=${leadId}`,
      leadId,
    });
  }
  return activity;
}

// ── Tasks ──────────────────────────────────────────────────────
export async function fetchTasks(filters: { completed?: boolean; assigned_to?: string } = {}): Promise<
  Task[]
> {
  if (!_agencyId) return [];
  let query = supabase
    .from("crm_tasks")
    .select(
      "*, assigned:agency_members!crm_tasks_assigned_to_fkey(name, avatar_color), lead:crm_leads!crm_tasks_lead_id_fkey(name)",
    )
    .eq("agency_id", _agencyId)
    .order("due_date", { ascending: true });
  if (filters.completed !== undefined) query = query.eq("completed", filters.completed);
  if (filters.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  const { data, error } = await query;
  if (error) {
    console.error("fetchTasks:", error);
    throw new Error("Não foi possível carregar as tarefas.");
  }
  return (data as Task[]) || [];
}

export async function createTask(taskData: Partial<Task>): Promise<Task | null> {
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      agency_id: _agencyId,
      assigned_to: taskData.assigned_to || null,
      created_by: _memberId,
      lead_id: taskData.lead_id || null,
      title: taskData.title,
      priority: taskData.priority || "normal",
      due_date: taskData.due_date || null,
      description: taskData.description ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("createTask:", error);
    return null;
  }
  return data as Task;
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const patch = { ...updates };
  if (patch.completed === true && !patch.completed_at) {
    patch.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("crm_tasks")
    .update(patch)
    .eq("id", taskId)
    .select()
    .single();
  if (error) {
    console.error("updateTask:", error);
    return null;
  }
  return data as Task;
}

// ── Transactions ───────────────────────────────────────────────
export async function fetchTransactions(filters: {
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  lead_id?: string;
} = {}): Promise<Transaction[]> {
  if (!_agencyId) return [];
  let query = supabase
    .from("crm_transactions")
    .select("*, lead:crm_leads!crm_transactions_lead_id_fkey(name)")
    .eq("agency_id", _agencyId)
    .order("transaction_date", { ascending: false });
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.lead_id) query = query.eq("lead_id", filters.lead_id);
  if (filters.from) query = query.gte("transaction_date", filters.from);
  if (filters.to) query = query.lte("transaction_date", filters.to);
  const { data, error } = await query;
  if (error) {
    console.error("fetchTransactions:", error);
    throw new Error("Não foi possível carregar as transações.");
  }
  return (data as Transaction[]) || [];
}

export async function createTransaction(txData: Partial<Transaction>): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from("crm_transactions")
    .insert({
      agency_id: _agencyId,
      lead_id: txData.lead_id || null,
      type: txData.type,
      amount: txData.amount,
      description: txData.description || null,
      category: txData.category || null,
      transaction_date: txData.transaction_date,
      status: txData.status || "pending",
      created_by: _memberId,
    })
    .select()
    .single();
  if (error) {
    console.error("createTransaction:", error);
    return null;
  }
  return data as Transaction;
}

// ── Library ────────────────────────────────────────────────────
export async function fetchDestinations(): Promise<Destination[]> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId) return [];
  const { data, error } = await supabase
    .from("crm_library_destinations")
    .select("*")
    .eq("agency_id", _agencyId)
    .order("title", { ascending: true });
  if (error) {
    console.error("fetchDestinations:", error);
    throw new Error("Não foi possível carregar os destinos.");
  }
  return (data as Destination[]) || [];
}

export async function updateDestination(
  id: string,
  updates: Partial<Destination>,
): Promise<Destination | null> {
  const patch: Partial<Destination> = { ...updates };
  if (updates.title !== undefined) patch.name = updates.title;
  const { data, error } = await supabase
    .from("crm_library_destinations")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("updateDestination:", error);
    return null;
  }
  return data as Destination;
}

export async function deleteDestination(id: string): Promise<boolean> {
  const { error } = await supabase.from("crm_library_destinations").delete().eq("id", id);
  if (error) {
    console.error("deleteDestination:", error);
    return false;
  }
  return true;
}

export async function createDestination(destData: Partial<Destination>): Promise<Destination | null> {
  if (!_agencyId) await loadAgencyContext();
  const { data, error } = await supabase
    .from("crm_library_destinations")
    .insert({
      agency_id: _agencyId,
      title: destData.title,
      name: destData.title,
      country: destData.country || null,
      category: destData.category || "praia",
      base_price: destData.base_price || 0,
      days: destData.days || 1,
      description: destData.description || null,
      image_url: destData.image_url || null,
    })
    .select()
    .single();
  if (error) {
    console.error("createDestination:", error);
    return null;
  }
  return data as Destination;
}

// ── Biblioteca (repositório de conhecimento) ───────────────────
const LIBRARY_BUCKET = "library-assets";

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function fetchLibraryItems(type?: LibraryItemType): Promise<LibraryItem[]> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId) return [];
  let q = (supabase as any)
    .from("crm_library_items")
    .select("*")
    .eq("agency_id", _agencyId)
    .order("created_at", { ascending: false });
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) {
    console.error("fetchLibraryItems:", error);
    throw new Error("Não foi possível carregar a biblioteca.");
  }
  return (data as LibraryItem[]) || [];
}

export async function uploadLibraryAsset(file: File): Promise<{ path: string; name: string } | null> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId) return null;
  const path = `${_agencyId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) {
    console.error("uploadLibraryAsset:", error);
    throw new Error("Não foi possível enviar o arquivo.");
  }
  return { path, name: file.name };
}

export async function getLibraryAssetUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(LIBRARY_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function createLibraryItem(item: Partial<LibraryItem>): Promise<LibraryItem | null> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId) return null;
  const { data, error } = await (supabase as any)
    .from("crm_library_items")
    .insert({
      agency_id: _agencyId,
      type: item.type || "experience",
      title: item.title,
      description: item.description ?? null,
      content: item.content ?? null,
      location: item.location ?? null,
      image_url: item.image_url ?? null,
      file_url: item.file_url ?? null,
      file_name: item.file_name ?? null,
      price: item.price ?? 0,
      days: item.days ?? null,
      tags: item.tags ?? [],
      created_by: _memberId,
    })
    .select()
    .single();
  if (error) {
    console.error("createLibraryItem:", error);
    return null;
  }
  return data as LibraryItem;
}

export async function updateLibraryItem(id: string, updates: Partial<LibraryItem>): Promise<LibraryItem | null> {
  const { data, error } = await (supabase as any)
    .from("crm_library_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("updateLibraryItem:", error);
    return null;
  }
  return data as LibraryItem;
}

export async function deleteLibraryItem(item: LibraryItem): Promise<boolean> {
  if (item.file_url) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([item.file_url]);
  }
  const { error } = await (supabase as any).from("crm_library_items").delete().eq("id", item.id);
  if (error) {
    console.error("deleteLibraryItem:", error);
    return false;
  }
  await cleanupImageReferences([item]);
  return true;
}

// Remove referências das imagens excluídas dos perfis de leads (profile.cover_image).
// Roteiros resolvem a capa dinamicamente da biblioteca, portanto se limpam sozinhos.
async function cleanupImageReferences(items: LibraryItem[]): Promise<void> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId) return;
  const refs = items
    .flatMap((i) => [i.file_url, i.image_url])
    .filter((v): v is string => !!v);
  if (refs.length === 0) return;
  try {
    const { data: leads } = await (supabase as any)
      .from("crm_leads")
      .select("id, profile")
      .eq("agency_id", _agencyId);
    for (const lead of (leads || []) as { id: string; profile: Record<string, unknown> | null }[]) {
      const cover = (lead.profile as Record<string, string> | null)?.cover_image;
      if (!cover) continue;
      const hit = refs.some((r) => cover === r || cover.includes(r));
      if (!hit) continue;
      const newProfile = { ...(lead.profile || {}) };
      delete (newProfile as Record<string, unknown>).cover_image;
      await (supabase as any).from("crm_leads").update({ profile: newProfile }).eq("id", lead.id);
    }
  } catch (e) {
    console.error("cleanupImageReferences:", e);
  }
}

// Exclusão em massa de itens da biblioteca (com limpeza de referências).
export async function bulkDeleteLibraryItems(items: LibraryItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const paths = items.map((i) => i.file_url).filter((v): v is string => !!v);
  if (paths.length > 0) {
    await supabase.storage.from(LIBRARY_BUCKET).remove(paths);
  }
  const ids = items.map((i) => i.id);
  const { error } = await (supabase as any).from("crm_library_items").delete().in("id", ids);
  if (error) {
    console.error("bulkDeleteLibraryItems:", error);
    return 0;
  }
  await cleanupImageReferences(items);
  return items.length;
}

// Resolve um valor de imagem: URL http(s) direto ou caminho no bucket da biblioteca.
export async function resolveDisplayImageUrl(value?: string | null): Promise<string | null> {
  if (!value) return null;
  // URLs assinadas do bucket expiram (token). Extrai o caminho e re-assina.
  const signMatch = value.match(/\/object\/sign\/library-assets\/([^?]+)/);
  if (signMatch?.[1]) {
    const path = decodeURIComponent(signMatch[1]);
    return (await getLibraryAssetUrl(path)) ?? value;
  }
  // URL pública do bucket (sem token) também pode ser normalizada para assinada.
  const pubMatch = value.match(/\/object\/public\/library-assets\/([^?]+)/);
  if (pubMatch?.[1]) {
    const path = decodeURIComponent(pubMatch[1]);
    return (await getLibraryAssetUrl(path)) ?? value;
  }
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return getLibraryAssetUrl(value);
}

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Encontra, entre destinos e itens já carregados, a imagem da biblioteca
// relacionada ao destino informado (função pura, sem I/O).
export function matchLibraryImage(
  destination: string,
  destinations: Destination[],
  items: LibraryItem[],
): string | null {
  const term = normalizeText(destination);
  if (!term) return null;
  const tokens = term.split(/[\s,/]+/).filter((t) => t.length >= 3);
  const matches = (haystack?: string | null) => {
    if (!haystack) return false;
    const h = normalizeText(haystack);
    return h.includes(term) || tokens.some((t) => h.includes(t));
  };

  const destHit = destinations.find(
    (d) => d.image_url && (matches(d.title) || matches(d.name) || matches(d.country)),
  );
  if (destHit?.image_url) return destHit.image_url;

  const itemHit = items.find(
    (i) =>
      i.image_url &&
      (matches(i.title) || matches(i.location) || matches((i.tags || []).join(" "))),
  );
  if (itemHit?.image_url) return itemHit.image_url;
  return null;
}

// Procura na biblioteca (destinos e itens) uma imagem relacionada ao destino informado.
export async function searchLibraryImageForDestination(destination: string): Promise<string | null> {
  if (!normalizeText(destination)) return null;
  try {
    const [destinations, items] = await Promise.all([
      fetchDestinations().catch(() => [] as Destination[]),
      fetchLibraryItems().catch(() => [] as LibraryItem[]),
    ]);
    return matchLibraryImage(destination, destinations, items);
  } catch (e) {
    console.error("searchLibraryImageForDestination:", e);
    return null;
  }
 }


// Baixa uma imagem externa, salva no bucket da biblioteca e cria um item "image"
// reutilizável. Retorna uma URL exibível (assinada) ou a própria URL externa em caso de falha.
export async function saveExternalImageToLibrary(
  imageUrl: string,
  destination: string,
): Promise<string> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return imageUrl;
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
    const safeDest = sanitizeFileName(destination) || "destino";
    const file = new File([blob], `${safeDest}.${ext}`, { type: blob.type || "image/jpeg" });
    const up = await uploadLibraryAsset(file);
    if (!up) return imageUrl;
    await createLibraryItem({
      type: "image",
      title: destination,
      location: destination,
      file_url: up.path,
      file_name: up.name,
      tags: [normalizeText(destination)].filter(Boolean),
    });
    return (await getLibraryAssetUrl(up.path)) ?? imageUrl;
  } catch (e) {
    console.error("saveExternalImageToLibrary:", e);
    return imageUrl;
  }
}

// Envia uma imagem escolhida pelo usuário para a biblioteca, associada ao
// destino, e retorna uma URL exibível. Lança erro em caso de falha.
export async function uploadImageToLibraryForDestination(
  imageFile: File,
  destination: string,
): Promise<string> {
  const ext = (imageFile.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const safeDest = sanitizeFileName(destination) || "destino";
  const file = new File([imageFile], `${safeDest}.${ext}`, {
    type: imageFile.type || "image/jpeg",
  });
  const up = await uploadLibraryAsset(file);
  if (!up) throw new Error("Não foi possível enviar a imagem.");
  await createLibraryItem({
    type: "image",
    title: destination,
    location: destination,
    file_url: up.path,
    file_name: up.name,
    tags: [normalizeText(destination)].filter(Boolean),
  });
  return (await getLibraryAssetUrl(up.path)) ?? up.path;
}





export async function fetchItineraries(): Promise<Itinerary[]> {
  if (!_agencyId) return [];
  const { data, error } = await supabase
    .from("crm_itineraries")
    .select("*, lead:crm_leads!crm_itineraries_lead_id_fkey(name, profile)")
    .eq("agency_id", _agencyId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchItineraries:", error);
    throw new Error("Não foi possível carregar os roteiros.");
  }
  const items = (data as (Itinerary & { lead?: { name?: string; profile?: Record<string, unknown> } })[]) || [];

  // Carrega no card a foto do destino: prioriza a imagem já configurada no lead
  // (profile.cover_image) e, se não houver, tenta casar com a biblioteca.
  try {
    const [destinations, libItems] = await Promise.all([
      fetchDestinations().catch(() => [] as Destination[]),
      fetchLibraryItems().catch(() => [] as LibraryItem[]),
    ]);
    for (const it of items) {
      const leadCover = (it.lead?.profile as Record<string, string> | undefined)?.cover_image;
      if (leadCover) {
        it.cover_image = leadCover;
      } else if (it.destination) {
        it.cover_image = matchLibraryImage(it.destination, destinations, libItems);
      }
    }
  } catch (e) {
    console.error("fetchItineraries cover:", e);
  }


  return items.sort((a, b) =>
    ((a.lead?.name ?? "").localeCompare(b.lead?.name ?? "", "pt", { sensitivity: "base" })),
  );

}

export async function fetchPublicItinerary(id: string): Promise<Itinerary | null> {
  const { data, error } = await supabase.rpc("get_shared_itinerary", { _id: id });
  if (error) {
    console.error("fetchPublicItinerary:", error);
    return null;
  }
  if (!data) return null;
  return data as unknown as Itinerary;
}

export async function fetchItineraryById(id: string): Promise<Itinerary | null> {
  let itQuery = supabase
    .from("crm_itineraries")
    .select("*, lead:crm_leads!crm_itineraries_lead_id_fkey(profile)")
    .eq("id", id);
  if (_agencyId) itQuery = itQuery.eq("agency_id", _agencyId);
  const { data: itinerary, error: itErr } = await itQuery.maybeSingle();
  if (itErr) {
    console.error("fetchItineraryById:", itErr);
    throw new Error("Não foi possível carregar o roteiro.");
  }
  if (!itinerary) return null;

  // Resolve a imagem de capa: prioriza a foto configurada no lead.
  const itAny = itinerary as Itinerary & { lead?: { profile?: Record<string, unknown> } };
  const leadCover = (itAny.lead?.profile as Record<string, string> | undefined)?.cover_image;
  if (leadCover) {
    itAny.cover_image = leadCover;
  } else if (itAny.destination && !itAny.cover_image) {
    itAny.cover_image = await searchLibraryImageForDestination(itAny.destination);
  }

  const { data: days } = await supabase
    .from("crm_itinerary_days")
    .select("*, activities:crm_itinerary_activities(*)")
    .eq("itinerary_id", id)
    .order("sort_order", { ascending: true });
  (days || []).forEach((day: ItineraryDay & { label?: string | null }) => {
    if (day.title == null && day.label != null) day.title = day.label;
    if (day.activities) {
      day.activities.forEach((a) => {
        const raw = a as ItineraryActivity & { time_start?: string | null };
        if (raw.time == null && raw.time_start != null) raw.time = raw.time_start;
      });
      day.activities.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
  });
  const { data: vouchers } = await supabase.from("crm_vouchers").select("*").eq("itinerary_id", id);
  const mappedVouchers: Voucher[] = (vouchers || []).map((v: Record<string, unknown>) => ({
    id: v.id as string,
    itinerary_id: v.itinerary_id as string,
    type: (v.category as string) ?? null,
    title: (v.name as string) ?? null,
    provider: null,
    code: (v.confirmation_code as string) ?? null,
    details: (v.file_url as string) ?? null,
    notes: (v.notes as string) ?? null,
  }));
  return { ...(itinerary as Itinerary), days: (days as ItineraryDay[]) || [], vouchers: mappedVouchers };
}

export async function createItinerary(d: Partial<Itinerary>): Promise<Itinerary | null> {
  if (!_agencyId) await loadAgencyContext();
  const { data, error } = await supabase
    .from("crm_itineraries")
    .insert({
      agency_id: _agencyId,
      created_by: _memberId,
      lead_id: d.lead_id || null,
      title: d.title,
      client_name: d.client_name || null,
      destination: d.destination || null,
      start_date: d.start_date || null,
      end_date: d.end_date || null,
      passengers: d.passengers || 1,
      budget: d.budget || 0,
      spent: d.spent || 0,
      status: d.status || "draft",
      share_token: crypto.randomUUID(),
    })
    .select()
    .single();
  if (error) {
    console.error("createItinerary:", error);
    return null;
  }
  return data as Itinerary;
}

export async function updateItinerary(id: string, updates: Partial<Itinerary>): Promise<Itinerary | null> {
  const { data, error } = await supabase
    .from("crm_itineraries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("updateItinerary:", error);
    return null;
  }
  return data as Itinerary;
}

export async function deleteItinerary(id: string): Promise<boolean> {
  const { data: days } = await supabase.from("crm_itinerary_days").select("id").eq("itinerary_id", id);
  const dayIds = (days || []).map((d: { id: string }) => d.id);
  if (dayIds.length) await supabase.from("crm_itinerary_activities").delete().in("day_id", dayIds);
  await supabase.from("crm_itinerary_days").delete().eq("itinerary_id", id);
  await supabase.from("crm_vouchers").delete().eq("itinerary_id", id);
  const { error } = await supabase.from("crm_itineraries").delete().eq("id", id);
  if (error) {
    console.error("deleteItinerary:", error);
    return false;
  }
  return true;
}

export async function duplicateItinerary(id: string): Promise<Itinerary | null> {
  const source = await fetchItineraryById(id);
  if (!source) return null;
  const copy = await createItinerary({
    lead_id: source.lead_id,
    title: `${source.title} (cópia)`,
    client_name: source.client_name,
    destination: source.destination,
    start_date: source.start_date,
    end_date: source.end_date,
    passengers: source.passengers,
    budget: source.budget,
    spent: source.spent,
    status: "draft",
  });
  if (!copy) return null;
  for (const day of source.days || []) {
    const newDay = await createItineraryDay({
      itinerary_id: copy.id,
      day_number: day.day_number,
      title: day.title,
      sort_order: day.sort_order,
    });
    if (!newDay) continue;
    for (const a of day.activities || []) {
      await createItineraryActivity({
        day_id: newDay.id,
        title: a.title,
        type: a.type,
        time: a.time ?? null,
        duration: a.duration ?? null,
        location: a.location ?? null,
        cost: a.cost ?? null,
        description: a.description ?? null,
        sort_order: a.sort_order,
      });
    }
  }
  return copy;
}

// Duplica um único dia (com suas atividades) dentro do mesmo roteiro.
export async function duplicateItineraryDay(
  dayId: string,
  targetPosition?: number,
): Promise<ItineraryDay | null> {
  const { data: src, error } = await supabase
    .from("crm_itinerary_days")
    .select("*, activities:crm_itinerary_activities(*)")
    .eq("id", dayId)
    .single();
  if (error || !src) {
    console.error("duplicateItineraryDay:", error);
    return null;
  }
  const source = src as unknown as ItineraryDay & { itinerary_id: string; label?: string | null };

  // Carrega todos os dias do roteiro para remanejar a numeração.
  const { data: allDaysRaw } = await supabase
    .from("crm_itinerary_days")
    .select("id, day_number")
    .eq("itinerary_id", source.itinerary_id)
    .order("day_number", { ascending: true });
  const allDays = (allDaysRaw as { id: string; day_number: number }[]) || [];

  const insertAt = targetPosition ?? allDays.length + 1;

  // Abre espaço: incrementa o day_number/sort_order dos dias iguais ou posteriores.
  const toShift = allDays.filter((d) => d.day_number >= insertAt);
  for (const d of toShift.sort((a, b) => b.day_number - a.day_number)) {
    await updateItineraryDay(d.id, {
      day_number: d.day_number + 1,
      sort_order: d.day_number + 1,
    });
  }

  const newDay = await createItineraryDay({
    itinerary_id: source.itinerary_id,
    day_number: insertAt,
    title: source.title || source.label || `Dia ${insertAt}`,
    sort_order: insertAt,
  });
  if (!newDay) return null;
  const activities = [...(source.activities || [])].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999),
  );
  for (const a of activities) {
    const raw = a as unknown as { time_start?: string | null };
    await createItineraryActivity({
      day_id: newDay.id,
      title: a.title,
      type: a.type,
      time: raw.time_start ?? a.time ?? null,
      duration: a.duration ?? null,
      location: a.location ?? null,
      cost: a.cost ?? null,
      description: a.description ?? null,
      sort_order: a.sort_order,
    });
  }
  return newDay;
}

function mapDayPayload(data: Partial<ItineraryDay>): Record<string, unknown> {
  const { title, ...rest } = data;
  const payload: Record<string, unknown> = { ...rest };
  if (title !== undefined) payload.label = title;
  return payload;
}

export async function createItineraryDay(dayData: Partial<ItineraryDay>): Promise<ItineraryDay | null> {
  const { data, error } = await supabase
    .from("crm_itinerary_days")
    .insert(mapDayPayload(dayData))
    .select()
    .single();
  if (error) {
    console.error("createItineraryDay:", error);
    return null;
  }
  return data as ItineraryDay;
}

export async function updateItineraryDay(
  id: string,
  updates: Partial<ItineraryDay>,
): Promise<ItineraryDay | null> {
  const { data, error } = await supabase
    .from("crm_itinerary_days")
    .update(mapDayPayload(updates))
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("updateItineraryDay:", error);
    return null;
  }
  return data as ItineraryDay;
}

export async function deleteItineraryDay(id: string): Promise<boolean> {
  await supabase.from("crm_itinerary_activities").delete().eq("day_id", id);
  const { error } = await supabase.from("crm_itinerary_days").delete().eq("id", id);
  return !error;
}

// Mapeia o campo de UI `time` para a coluna real `time_start`.
function mapActivityPayload(data: Partial<ItineraryActivity>): Record<string, unknown> {
  const { time, ...rest } = data;
  const payload: Record<string, unknown> = { ...rest };
  if (time !== undefined) payload.time_start = time;
  return payload;
}

export async function updateItineraryActivity(
  id: string,
  updates: Partial<ItineraryActivity>,
): Promise<ItineraryActivity | null> {
  const { data, error } = await supabase
    .from("crm_itinerary_activities")
    .update(mapActivityPayload(updates))
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("updateItineraryActivity:", error);
    return null;
  }
  return data as ItineraryActivity;
}

export async function createItineraryActivity(
  activityData: Partial<ItineraryActivity>,
): Promise<ItineraryActivity | null> {
  const { data, error } = await supabase
    .from("crm_itinerary_activities")
    .insert({ type: "activity", ...mapActivityPayload(activityData) })
    .select()
    .single();
  if (error) {
    console.error("createItineraryActivity:", error);
    throw new Error(error.message || "Erro ao salvar atividade.");
  }

  return data as ItineraryActivity;
}


export async function deleteItineraryActivity(id: string): Promise<boolean> {
  const { error } = await supabase.from("crm_itinerary_activities").delete().eq("id", id);
  return !error;
}

export async function createVoucher(voucherData: Partial<Voucher>): Promise<Voucher | null> {
  const row = {
    itinerary_id: voucherData.itinerary_id,
    name: voucherData.title || "Voucher",
    category: voucherData.type ?? null,
    confirmation_code: voucherData.code ?? null,
    notes: voucherData.notes ?? null,
  };
  const { data, error } = await supabase.from("crm_vouchers").insert(row).select().single();
  if (error) {
    console.error("createVoucher:", error);
    return null;
  }
  return {
    id: data.id,
    itinerary_id: data.itinerary_id,
    type: data.category,
    title: data.name,
    provider: null,
    code: data.confirmation_code,
    details: data.file_url,
    notes: data.notes,
  } as Voucher;
}

export async function deleteVoucher(id: string): Promise<boolean> {
  const { error } = await supabase.from("crm_vouchers").delete().eq("id", id);
  return !error;
}

export async function fetchItinerariesByLead(leadId: string): Promise<Itinerary[]> {
  const { data, error } = await supabase
    .from("crm_itineraries")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchItinerariesByLead:", error);
    return [];
  }
  return (data as Itinerary[]) || [];
}

/** Retorna o status do roteiro mais recente por lead que possui roteiro. */
export async function fetchLeadItineraryStatuses(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("crm_itineraries")
    .select("lead_id, status, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchLeadItineraryStatuses:", error);
    return {};
  }
  const map: Record<string, string> = {};
  for (const r of (data as { lead_id: string | null; status: string | null }[]) || []) {
    if (r.lead_id && !map[r.lead_id]) map[r.lead_id] = r.status || "draft";
  }
  return map;
}

// ── Notificações ───────────────────────────────────────────────
export async function fetchNotifications(): Promise<import("@/lib/types").AppNotification[]> {
  if (!_memberId) await loadAgencyContext();
  if (!_memberId) return [];
  const { data, error } = await supabase
    .from("crm_notifications")
    .select("*, actor:agency_members!crm_notifications_actor_id_fkey(id, name, avatar_color)")
    .eq("recipient_id", _memberId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("fetchNotifications:", error);
    return [];
  }
  return (data as import("@/lib/types").AppNotification[]) || [];
}

export async function fetchNotificationsPage(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  filter?: "all" | "unread" | "read";
  order?: "desc" | "asc";
}): Promise<{ items: import("@/lib/types").AppNotification[]; total: number }> {
  if (!_memberId) await loadAgencyContext();
  if (!_memberId) return { items: [], total: 0 };
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 15;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("crm_notifications")
    .select("*, actor:agency_members!crm_notifications_actor_id_fkey(id, name, avatar_color)", {
      count: "exact",
    })
    .eq("recipient_id", _memberId);

  if (opts.filter === "unread") query = query.eq("read", false);
  else if (opts.filter === "read") query = query.eq("read", true);

  const term = opts.search?.trim();
  if (term) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);

  query = query.order("created_at", { ascending: opts.order === "asc" }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("fetchNotificationsPage:", error);
    return { items: [], total: 0 };
  }
  return { items: (data as import("@/lib/types").AppNotification[]) || [], total: count ?? 0 };
}

  const { error } = await supabase.from("crm_notifications").update({ read }).eq("id", id);
  if (error) {
    console.error("markNotificationRead:", error);
    return false;
  }
  return true;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  if (!_memberId) return false;
  const { error } = await supabase
    .from("crm_notifications")
    .update({ read: true })
    .eq("recipient_id", _memberId)
    .eq("read", false);
  if (error) {
    console.error("markAllNotificationsRead:", error);
    return false;
  }
  return true;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const { error } = await supabase.from("crm_notifications").delete().eq("id", id);
  if (error) {
    console.error("deleteNotification:", error);
    return false;
  }
  return true;
}

/** Cria uma notificação para outro membro. Ignora se o destinatário for o próprio autor. */
export async function createNotification(input: {
  recipientId: string;
  title: string;
  body?: string | null;
  link?: string | null;
  leadId?: string | null;
  type?: string;
}): Promise<boolean> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId || !input.recipientId) return false;
  if (input.recipientId === _memberId) return false; // não notifica a si mesmo
  const { error } = await supabase.from("crm_notifications").insert({
    agency_id: _agencyId,
    recipient_id: input.recipientId,
    actor_id: _memberId,
    type: input.type || "info",
    title: input.title,
    body: input.body || null,
    link: input.link || null,
    lead_id: input.leadId || null,
  });
  if (error) {
    console.error("createNotification:", error);
    return false;
  }
  return true;
}


export async function fetchAiConfig(): Promise<AiConfig | null> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId) return null;
  const { data, error } = await supabase
    .from("crm_ai_config")
    .select("*")
    .eq("agency_id", _agencyId)
    .maybeSingle();
  if (error) {
    console.error("fetchAiConfig:", error);
    return null;
  }
  return data as AiConfig | null;
}

export async function saveAiConfig(updates: Partial<AiConfig>): Promise<AiConfig | null> {
  if (!_agencyId) await loadAgencyContext();
  if (!_agencyId) return null;
  const existing = await fetchAiConfig();
  const payload = {
    agency_id: _agencyId,
    provider: updates.provider ?? existing?.provider ?? "openai",
    model: updates.model ?? existing?.model ?? "",
    api_key_encrypted: updates.api_key_encrypted ?? existing?.api_key_encrypted ?? null,
    system_prompt: updates.system_prompt ?? existing?.system_prompt ?? null,
    max_tokens: updates.max_tokens ?? existing?.max_tokens ?? 1024,
    knowledge_sources: updates.knowledge_sources ?? existing?.knowledge_sources ?? null,
  };
  const query = existing?.id
    ? supabase.from("crm_ai_config").update(payload).eq("id", existing.id)
    : supabase.from("crm_ai_config").insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    console.error("saveAiConfig:", error);
    return null;
  }
  return data as AiConfig;
}

// ── Dashboard ──────────────────────────────────────────────────

function buildMonthlyChartData(incomeTransactions: Transaction[]) {
  const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const now = new Date();
  const months: { year: number; month: number; label: string; revenue: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: monthLabels[d.getMonth()], revenue: 0, count: 0 });
  }
  incomeTransactions.forEach((t) => {
    const txDate = new Date(t.transaction_date);
    const bucket = months.find((m) => m.year === txDate.getFullYear() && m.month === txDate.getMonth());
    if (bucket) {
      bucket.revenue += Number(t.amount);
      if (t.category === "pacote" || !t.category) bucket.count += 1;
    }
  });
  return {
    labels: months.map((m) => m.label),
    revenue: months.map((m) => m.revenue),
    count: months.map((m) => m.count),
  };
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [leads, tasks, transactions] = await Promise.all([fetchLeads(), fetchTasks(), fetchTransactions()]);
  const confirmedIncome = transactions.filter((t) => t.type === "income" && t.status === "confirmed");
  const totalSales = confirmedIncome.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalPipeline = leads
    .filter((l) => l.status === "negotiating")
    .reduce((sum, l) => sum + Number(l.value || 0), 0);
  return {
    totalLeads: leads.length,
    newLeads: leads.filter((l) => l.status === "new").length,
    negotiating: leads.filter((l) => l.status === "negotiating").length,
    closed: leads.filter((l) => l.status === "closed").length,
    lost: leads.filter((l) => l.status === "lost").length,
    totalSales,
    totalPipeline,
    pendingTasks: tasks.filter((t) => !t.completed).length,
    leads,
    tasks,
    transactions,
    chartData: buildMonthlyChartData(confirmedIncome),
  };
}
