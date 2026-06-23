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
    .order("last_activity_at", { ascending: false });

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
  return (data as LeadActivity[]) || [];
}

export async function createLeadActivity(
  leadId: string,
  activityData: Partial<LeadActivity>,
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
  await supabase
    .from("crm_leads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", leadId);
  return data as LeadActivity;
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

// ── Itineraries ────────────────────────────────────────────────
export async function fetchItineraries(): Promise<Itinerary[]> {
  if (!_agencyId) return [];
  const { data, error } = await supabase
    .from("crm_itineraries")
    .select("*, lead:crm_leads!crm_itineraries_lead_id_fkey(name)")
    .eq("agency_id", _agencyId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchItineraries:", error);
    throw new Error("Não foi possível carregar os roteiros.");
  }
  return (data as Itinerary[]) || [];
}

export async function fetchItineraryById(id: string): Promise<Itinerary | null> {
  let itQuery = supabase.from("crm_itineraries").select("*").eq("id", id);
  if (_agencyId) itQuery = itQuery.eq("agency_id", _agencyId);
  const { data: itinerary, error: itErr } = await itQuery.maybeSingle();
  if (itErr) {
    console.error("fetchItineraryById:", itErr);
    throw new Error("Não foi possível carregar o roteiro.");
  }
  if (!itinerary) return null;
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
  return { ...(itinerary as Itinerary), days: (days as ItineraryDay[]) || [], vouchers: (vouchers as Voucher[]) || [] };
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

// A tabela usa a coluna `label`; a UI usa `title`.
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
  const { data, error } = await supabase.from("crm_vouchers").insert(voucherData).select().single();
  if (error) {
    console.error("createVoucher:", error);
    return null;
  }
  return data as Voucher;
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

// ── AI config ──────────────────────────────────────────────────
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
