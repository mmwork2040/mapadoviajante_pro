// Tipos centrais espelhando o schema do Supabase do repositório.

export interface AgencyMember {
  id: string;
  agency_id: string;
  user_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string; // admin | agent | ...
  avatar_color?: string | null;
  is_active?: boolean;
}

export type LeadStatus = "new" | "contacted" | "negotiating" | "closed" | "lost";

export interface Lead {
  id: string;
  agency_id: string;
  assigned_to?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  destination?: string | null;
  value?: number;
  status: LeadStatus;
  origin?: string | null;
  notes?: string | null;
  profile?: Record<string, unknown>;
  checklists?: Record<string, unknown>;
  last_activity_at?: string;
  created_at?: string;
  assigned_member?: { name: string; avatar_color?: string | null } | null;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  author_id?: string | null;
  assigned_to_id?: string | null;
  type: string;
  title: string;
  details?: string | null;
  mentions?: string[];
  created_at?: string;
  author?: { id: string; name: string; avatar_color?: string | null; role?: string } | null;
  assigned?: { id: string; name: string; avatar_color?: string | null } | null;
}

export interface Task {
  id: string;
  agency_id: string;
  assigned_to?: string | null;
  created_by?: string | null;
  lead_id?: string | null;
  title: string;
  priority: string;
  due_date?: string | null;
  completed?: boolean;
  completed_at?: string | null;
  assigned?: { name: string; avatar_color?: string | null } | null;
  lead?: { name: string } | null;
}

export type TxType = "income" | "expense";

export interface Transaction {
  id: string;
  agency_id: string;
  lead_id?: string | null;
  type: TxType;
  amount: number;
  description?: string | null;
  category?: string | null;
  transaction_date: string;
  status: string;
  created_by?: string | null;
  lead?: { name: string } | null;
}

export interface Destination {
  id: string;
  agency_id: string;
  title?: string;
  name?: string;
  country?: string | null;
  category?: string | null;
  base_price?: number;
  days?: number;
  description?: string | null;
  image_url?: string | null;
}

export interface Itinerary {
  id: string;
  agency_id: string;
  created_by?: string | null;
  lead_id?: string | null;
  title: string;
  client_name?: string | null;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  passengers?: number;
  budget?: number;
  spent?: number;
  status: string;
  created_at?: string;
  lead?: { name: string } | null;
  days?: ItineraryDay[];
  vouchers?: Voucher[];
}

export interface ItineraryDay {
  id: string;
  itinerary_id: string;
  day_number?: number;
  title?: string | null;
  date?: string | null;
  sort_order?: number;
  activities?: ItineraryActivity[];
}

export interface ItineraryActivity {
  id: string;
  day_id: string;
  time?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  type?: string | null;
  cost?: number | null;
  duration?: string | null;
  maps_url?: string | null;
  sort_order?: number;
}

export interface AiConfig {
  id?: string;
  agency_id?: string;
  provider: string;
  model: string;
  api_key_encrypted?: string | null;
  system_prompt?: string | null;
  max_tokens?: number | null;
  knowledge_sources?: { status?: string; last_tested_at?: string } | null;
}

export interface ExtractedDocData {
  type?: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  flight_number?: string;
  hotel_name?: string;
  room?: string;
  provider?: string;
  code?: string;
}

export interface Voucher {
  id: string;
  itinerary_id: string;
  type?: string | null;
  title?: string | null;
  provider?: string | null;
  code?: string | null;
  details?: string | null;
  notes?: string | null;
}

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  negotiating: number;
  closed: number;
  lost: number;
  totalSales: number;
  totalPipeline: number;
  pendingTasks: number;
  leads: Lead[];
  tasks: Task[];
  transactions: Transaction[];
  chartData: { labels: string[]; revenue: number[]; count: number[] };
}
