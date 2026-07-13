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
  status?: string | null; // pending | active
  pref_leads_mine?: boolean;
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
  updated_at?: string;
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
  due_date?: string | null;
  completed?: boolean | null;
  created_at?: string;
  author?: { id: string; name: string; avatar_color?: string | null; role?: string } | null;
  assigned?: { id: string; name: string; avatar_color?: string | null } | null;
}

export interface AppNotification {
  id: string;
  agency_id: string;
  recipient_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  lead_id?: string | null;
  read: boolean;
  created_at: string;
  actor?: { id: string; name: string; avatar_color?: string | null } | null;
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
  description?: string | null;
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

export type LibraryItemType = "experience" | "package" | "image" | "itinerary";

export interface LibraryItem {
  id: string;
  agency_id: string;
  type: LibraryItemType;
  title: string;
  description?: string | null;
  content?: string | null;
  location?: string | null;
  image_url?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  price?: number | null;
  days?: number | null;
  tags?: string[] | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
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
  cover_image?: string | null;
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
  /** Moeda do valor informado (ex.: BRL, USD, EUR). */
  currency?: string | null;
  /** Valor convertido em Real (informativo, calculado pela IA). */
  cost_brl?: number | null;
  /** Cotação usada na conversão (quantos BRL vale 1 unidade da moeda). */
  cost_brl_rate?: number | null;
  /** Sugestões de hospedagem (somente para itens do tipo "hotel"). */
  hotel_options?: HotelOption[] | null;
  /** Sugestões genéricas (transfer, restaurante, passeio) buscadas pela IA. */
  suggestion_options?: HotelOption[] | null;
  /** Valores por passageiro (nome + valor), quando o custo varia por pessoa. */
  passenger_costs?: PassengerCost[] | null;
  /** Imagens sortidas do local/atração exibidas na página do dia. */
  images?: ActivityImage[] | null;
  duration?: string | null;
  maps_url?: string | null;
  sort_order?: number;
}

export interface ActivityImage {
  url: string;
  description?: string | null;
}


export interface PassengerCost {
  name: string;
  amount?: number | null;
  currency?: string | null;
  amount_brl?: number | null;
  amount_brl_rate?: number | null;
}

export interface HotelOption {
  name: string;
  address?: string | null;
  room_type?: string | null;
  daily_rate?: number | null;
  currency?: string | null;
  /** Valor da diária convertido em Real (informativo, calculado na busca da IA). */
  daily_rate_brl?: number | null;
  /** Cotação usada na conversão (quantos BRL vale 1 unidade da moeda). */
  daily_rate_brl_rate?: number | null;
  /** Classificação em estrelas (1 a 5). */
  stars?: number | null;
  url?: string | null;
  /** Origem da sugestão: "ai" (não editável) ou "user" (adicionada manualmente). */
  source?: "ai" | "user" | null;
  /** Links de reserva/promoções (Booking, Trivago, Airbnb...). */
  links?: { label: string; url: string }[] | null;
}


export interface AiConfig {
  id?: string;
  agency_id?: string;
  provider: string;
  model: string;
  api_key_encrypted?: string | null;
  system_prompt?: string | null;
  max_tokens?: number | null;
  knowledge_sources?: {
    status?: string;
    last_tested_at?: string;
    data_sources?: { library?: boolean; leads?: boolean; finance?: boolean };
    documents?: KnowledgeDoc[];
  } | null;
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  size?: number;
  text: string;
}

export interface ExtractedDocData {
  type?: string;
  title?: string;
  date?: string;
  time?: string;
  duration?: string;
  location?: string;
  city?: string;
  transport?: string;
  time_suggested?: boolean;
  description?: string;
  flight_number?: string;
  hotel_name?: string;
  room?: string;
  provider?: string;
  code?: string;
  cost?: number;
  people?: number;
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
