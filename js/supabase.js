/* ══════════════════════════════════════════════════════════════
   SUPABASE.JS — Client Initialization & Service Layer
   ══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://daosxeeukdqfssxjsmil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb3N4ZWV1a2RxZnNzeGpzbWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3OTU5OTMsImV4cCI6MjA3ODM3MTk5M30.sv6bBr9440PrVMrXiCZWvW4OLPuoZnkFEKnU9fdAB2Y';

// Initialize Supabase client — overwrites window.supabase (SDK) with the client instance
try {
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Supabase SDK não disponível — verifique a conexão:', e);
  window.supabase = null;
}

// ── Agency context cache ────────────────────────────────────
let _agencyId = null;
let _memberId = null;
let _memberRole = null;
let _teamMembers = [];

async function loadAgencyContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: members, error } = await supabase
    .from('agency_members')
    .select('id, agency_id, name, role, avatar_color')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  if (error || !members || members.length === 0) return null;
  const member = members[0];

  _agencyId = member.agency_id;
  _memberId = member.id;
  _memberRole = member.role;

  return member;
}

function getAgencyId() { return _agencyId; }
function getMemberId() { return _memberId; }
function getMemberRole() { return _memberRole; }

// ══════════════════════════════════════════════════════════════
// TEAM MEMBERS SERVICE
// ══════════════════════════════════════════════════════════════

async function fetchTeamMembers() {
  const { data, error } = await supabase
    .from('agency_members')
    .select('id, name, email, phone, role, avatar_color, is_active, user_id')
    .eq('agency_id', _agencyId)
    .order('name');

  if (error) { console.error('fetchTeamMembers:', error); return []; }
  _teamMembers = data || [];
  return _teamMembers;
}

function getCachedTeamMembers() { return _teamMembers; }

// ══════════════════════════════════════════════════════════════
// LEADS SERVICE
// ══════════════════════════════════════════════════════════════

async function fetchLeads(filters = {}) {
  let query = supabase
    .from('crm_leads')
    .select('*, assigned_member:agency_members!crm_leads_assigned_to_fkey(name, avatar_color)')
    .eq('agency_id', _agencyId)
    .order('last_activity_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.destination) query = query.eq('destination', filters.destination);
  if (filters.search) query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,destination.ilike.%${filters.search}%`);

  const { data, error } = await query;
  if (error) { console.error('fetchLeads:', error); return []; }
  return data || [];
}

async function fetchLeadById(leadId) {
  const { data, error } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error) { console.error('fetchLeadById:', error); return null; }
  return data;
}

async function createLead(leadData) {
  const { data, error } = await supabase
    .from('crm_leads')
    .insert({
      agency_id: _agencyId,
      assigned_to: leadData.assigned_to || _memberId,
      name: leadData.name,
      email: leadData.email || null,
      phone: leadData.phone || null,
      destination: leadData.destination || null,
      value: leadData.value || 0,
      status: leadData.status || 'new',
      origin: leadData.origin || 'direto',
      notes: leadData.notes || null,
      profile: leadData.profile || {},
      checklists: leadData.checklists || {},
    })
    .select()
    .single();

  if (error) { console.error('createLead:', error); return null; }
  return data;
}

async function updateLead(leadId, updates) {
  const { data, error } = await supabase
    .from('crm_leads')
    .update({ ...updates, last_activity_at: new Date().toISOString() })
    .eq('id', leadId)
    .select()
    .single();

  if (error) { console.error('updateLead:', error); return null; }
  return data;
}

async function deleteLead(leadId) {
  const { error } = await supabase
    .from('crm_leads')
    .delete()
    .eq('id', leadId);

  if (error) { console.error('deleteLead:', error); return false; }
  return true;
}

// ══════════════════════════════════════════════════════════════
// LEAD ACTIVITIES SERVICE
// ══════════════════════════════════════════════════════════════

async function fetchLeadActivities(leadId) {
  const { data, error } = await supabase
    .from('crm_lead_activities')
    .select('*, author:agency_members!crm_lead_activities_author_id_fkey(id, name, avatar_color, role), assigned:agency_members!crm_lead_activities_assigned_to_id_fkey(id, name, avatar_color)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) { console.error('fetchLeadActivities:', error); return []; }
  return data || [];
}

async function createLeadActivity(leadId, activityData) {
  const { data, error } = await supabase
    .from('crm_lead_activities')
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
    .select('*, author:agency_members!crm_lead_activities_author_id_fkey(id, name, avatar_color, role), assigned:agency_members!crm_lead_activities_assigned_to_id_fkey(id, name, avatar_color)')
    .single();

  if (error) { console.error('createLeadActivity:', error); return null; }

  // Also update lead's last_activity_at
  await supabase.from('crm_leads').update({ last_activity_at: new Date().toISOString() }).eq('id', leadId);

  return data;
}

// ══════════════════════════════════════════════════════════════
// TASKS SERVICE
// ══════════════════════════════════════════════════════════════

async function fetchTasks(filters = {}) {
  let query = supabase
    .from('crm_tasks')
    .select('*, assigned:agency_members!crm_tasks_assigned_to_fkey(name, avatar_color), lead:crm_leads!crm_tasks_lead_id_fkey(name)')
    .eq('agency_id', _agencyId)
    .order('due_date', { ascending: true });

  if (filters.completed !== undefined) query = query.eq('completed', filters.completed);
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

  const { data, error } = await query;
  if (error) { console.error('fetchTasks:', error); return []; }
  return data || [];
}

async function createTask(taskData) {
  const { data, error } = await supabase
    .from('crm_tasks')
    .insert({
      agency_id: _agencyId,
      assigned_to: taskData.assigned_to || null,
      created_by: _memberId,
      lead_id: taskData.lead_id || null,
      title: taskData.title,
      priority: taskData.priority || 'normal',
      due_date: taskData.due_date || null,
    })
    .select()
    .single();

  if (error) { console.error('createTask:', error); return null; }
  return data;
}

async function updateTask(taskId, updates) {
  if (updates.completed === true && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('crm_tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) { console.error('updateTask:', error); return null; }
  return data;
}

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS SERVICE
// ══════════════════════════════════════════════════════════════

async function fetchTransactions(filters = {}) {
  let query = supabase
    .from('crm_transactions')
    .select('*, lead:crm_leads!crm_transactions_lead_id_fkey(name)')
    .eq('agency_id', _agencyId)
    .order('transaction_date', { ascending: false });

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.from) query = query.gte('transaction_date', filters.from);
  if (filters.to) query = query.lte('transaction_date', filters.to);

  const { data, error } = await query;
  if (error) { console.error('fetchTransactions:', error); return []; }
  return data || [];
}

async function createTransaction(txData) {
  const { data, error } = await supabase
    .from('crm_transactions')
    .insert({
      agency_id: _agencyId,
      lead_id: txData.lead_id || null,
      type: txData.type,
      amount: txData.amount,
      description: txData.description || null,
      category: txData.category || null,
      transaction_date: txData.transaction_date,
      status: txData.status || 'pending',
      created_by: _memberId,
    })
    .select()
    .single();

  if (error) { console.error('createTransaction:', error); return null; }
  return data;
}

// ══════════════════════════════════════════════════════════════
// LIBRARY SERVICE
// ══════════════════════════════════════════════════════════════

async function fetchDestinations() {
  const { data, error } = await supabase
    .from('crm_library_destinations')
    .select('*')
    .eq('agency_id', _agencyId)
    .order('name');

  if (error) { console.error('fetchDestinations:', error); return []; }
  return data || [];
}

// ══════════════════════════════════════════════════════════════
// ITINERARIES SERVICE
// ══════════════════════════════════════════════════════════════

async function fetchItineraries() {
  const { data, error } = await supabase
    .from('crm_itineraries')
    .select('*, lead:crm_leads!crm_itineraries_lead_id_fkey(name)')
    .eq('agency_id', _agencyId)
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchItineraries:', error); return []; }
  return data || [];
}

async function fetchItineraryById(id) {
  const { data: itinerary, error: itErr } = await supabase
    .from('crm_itineraries')
    .select('*')
    .eq('id', id)
    .single();
  if (itErr || !itinerary) { console.error('fetchItineraryById:', itErr); return null; }

  // Get days with their activities
  const { data: days, error: dayErr } = await supabase
    .from('crm_itinerary_days')
    .select('*, activities:crm_itinerary_activities(*)')
    .eq('itinerary_id', id)
    .order('sort_order', { ascending: true });
  if (dayErr) console.error('fetchItineraryDays:', dayErr);

  // Sort activities within each day
  (days || []).forEach(day => {
    if (day.activities) day.activities.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  });

  // Get vouchers
  const { data: vouchers, error: vErr } = await supabase
    .from('crm_vouchers')
    .select('*')
    .eq('itinerary_id', id);
  if (vErr) console.error('fetchVouchers:', vErr);

  return { ...itinerary, days: days || [], vouchers: vouchers || [] };
}

async function createItinerary(itineraryData) {
  const { data, error } = await supabase
    .from('crm_itineraries')
    .insert({
      agency_id: _agencyId,
      created_by: _memberId,
      lead_id: itineraryData.lead_id || null,
      title: itineraryData.title,
      client_name: itineraryData.client_name || null,
      destination: itineraryData.destination || null,
      start_date: itineraryData.start_date || null,
      end_date: itineraryData.end_date || null,
      passengers: itineraryData.passengers || 1,
      budget: itineraryData.budget || 0,
      spent: itineraryData.spent || 0,
      status: itineraryData.status || 'draft',
    })
    .select()
    .single();
  if (error) { console.error('createItinerary:', error); return null; }
  return data;
}

async function updateItinerary(id, updates) {
  const { data, error } = await supabase
    .from('crm_itineraries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updateItinerary:', error); return null; }
  return data;
}

async function deleteItinerary(id) {
  // Get day IDs for cascading delete
  const { data: days } = await supabase.from('crm_itinerary_days').select('id').eq('itinerary_id', id);
  const dayIds = (days || []).map(d => d.id);
  if (dayIds.length) await supabase.from('crm_itinerary_activities').delete().in('day_id', dayIds);
  await supabase.from('crm_itinerary_days').delete().eq('itinerary_id', id);
  await supabase.from('crm_vouchers').delete().eq('itinerary_id', id);
  const { error } = await supabase.from('crm_itineraries').delete().eq('id', id);
  if (error) { console.error('deleteItinerary:', error); return false; }
  return true;
}

async function createItineraryDay(dayData) {
  const { data, error } = await supabase.from('crm_itinerary_days').insert(dayData).select().single();
  if (error) { console.error('createItineraryDay:', error); return null; }
  return data;
}

async function updateItineraryDay(id, updates) {
  const { data, error } = await supabase.from('crm_itinerary_days').update(updates).eq('id', id).select().single();
  if (error) { console.error('updateItineraryDay:', error); return null; }
  return data;
}

async function deleteItineraryDay(id) {
  await supabase.from('crm_itinerary_activities').delete().eq('day_id', id);
  const { error } = await supabase.from('crm_itinerary_days').delete().eq('id', id);
  if (error) { console.error('deleteItineraryDay:', error); return false; }
  return true;
}

async function createItineraryActivity(activityData) {
  const { data, error } = await supabase.from('crm_itinerary_activities').insert(activityData).select().single();
  if (error) { console.error('createItineraryActivity:', error); return null; }
  return data;
}

async function updateItineraryActivity(id, updates) {
  const { data, error } = await supabase.from('crm_itinerary_activities').update(updates).eq('id', id).select().single();
  if (error) { console.error('updateItineraryActivity:', error); return null; }
  return data;
}

async function deleteItineraryActivity(id) {
  const { error } = await supabase.from('crm_itinerary_activities').delete().eq('id', id);
  if (error) { console.error('deleteItineraryActivity:', error); return false; }
  return true;
}

async function createVoucher(voucherData) {
  const { data, error } = await supabase.from('crm_vouchers').insert(voucherData).select().single();
  if (error) { console.error('createVoucher:', error); return null; }
  return data;
}

async function updateVoucher(id, updates) {
  const { data, error } = await supabase.from('crm_vouchers').update(updates).eq('id', id).select().single();
  if (error) { console.error('updateVoucher:', error); return null; }
  return data;
}

async function deleteVoucher(id) {
  const { error } = await supabase.from('crm_vouchers').delete().eq('id', id);
  if (error) { console.error('deleteVoucher:', error); return false; }
  return true;
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD AGGREGATES
// ══════════════════════════════════════════════════════════════

async function fetchDashboardStats() {
  const [leads, tasks, transactions] = await Promise.all([
    fetchLeads(),
    fetchTasks(),
    fetchTransactions(),
  ]);

  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const negotiating = leads.filter(l => l.status === 'negotiating').length;
  const closed = leads.filter(l => l.status === 'closed').length;
  const lost = leads.filter(l => l.status === 'lost').length;

  const confirmedIncome = transactions
    .filter(t => t.type === 'income' && t.status === 'confirmed');

  const totalSales = confirmedIncome
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalPipeline = leads
    .filter(l => l.status === 'negotiating')
    .reduce((sum, l) => sum + Number(l.value), 0);

  // ── Aggregate monthly chart data (last 6 months) ──────────
  const chartData = buildMonthlyChartData(confirmedIncome);

  return {
    totalLeads, newLeads, negotiating, closed, lost,
    totalSales, totalPipeline,
    pendingTasks: tasks.filter(t => !t.completed).length,
    leads, tasks, transactions,
    chartData,
  };
}

function buildMonthlyChartData(incomeTransactions) {
  const months = [];
  const monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const now = new Date();

  // Build last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: monthLabels[d.getMonth()],
      revenue: 0,
      count: 0,
    });
  }

  // Aggregate
  incomeTransactions.forEach(t => {
    const txDate = new Date(t.transaction_date);
    const bucket = months.find(m => m.year === txDate.getFullYear() && m.month === txDate.getMonth());
    if (bucket) {
      bucket.revenue += Number(t.amount);
      // Only count "pacote" transactions as sales (not commissions)
      if (t.category === 'pacote' || !t.category) {
        bucket.count += 1;
      }
    }
  });

  return {
    labels: months.map(m => m.label),
    revenue: months.map(m => m.revenue),
    count: months.map(m => m.count),
  };
}

console.log('✅ Supabase client initialized');
