import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Plus, X, UserPlus, User, Plane, Gift, Hotel, ArrowRight, ArrowLeft, Check, Info, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { createLead, fetchLeads, updateLead } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, maskCurrency, parseCurrency, maskPhone, maskCpfCnpj, maskMiles } from "@/lib/ui";
import type { Lead, LeadStatus } from "@/lib/types";
import { QueryError } from "@/components/QueryError";
import { LeadDetailDrawer } from "@/components/LeadDetailDrawer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/leads")({
  component: LeadsRoute,
});

function LeadsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/leads" ? <LeadsPage /> : <Outlet />;
}

const COLUMNS: { key: LeadStatus; label: string; dot: string }[] = [
  { key: "new", label: "Novo", dot: "bg-blue-500" },
  { key: "contacted", label: "Contatado", dot: "bg-sky-500" },
  { key: "negotiating", label: "Em Negociação", dot: "bg-amber-400" },
  { key: "closed", label: "Fechado", dot: "bg-emerald-500" },
  { key: "lost", label: "Perdido", dot: "bg-red-500" },
];

function LeadsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  const { data: leads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", { search }],
    queryFn: () => fetchLeads({ search: search || undefined }),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // Realtime: novos leads (ex.: criados via webhook do n8n) atualizam a lista.
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_leads" },
        () => {
          qc.invalidateQueries({ queryKey: ["leads"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);


  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const updated = await updateLead(id, { status });
      if (!updated) throw new Error("Não foi possível mover o lead.");
      return updated;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      const prev = qc.getQueryData<Lead[]>(["leads", { search }]);
      qc.setQueryData<Lead[]>(["leads", { search }], (old) =>
        (old ?? []).map((l) => (l.id === id ? { ...l, status } : l)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["leads", { search }], ctx.prev);
      toast.error("Não foi possível mover o lead.");
    },
    onSuccess: (_res, vars) => {
      dispatchWebhook("lead.status_changed", { id: vars.id, status: vars.status });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  function onDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    setOverCol(null);
    setDragId(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) {
      const current = leads.find((l) => l.id === id);
      if (current && current.status !== status) move.mutate({ id, status });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Funil de vendas (arraste para mover).</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, e-mail, destino…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-56"
          />
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Novo Lead
          </button>
        </div>
      </div>


      {isError ? (
        <QueryError message="Não foi possível carregar os leads." onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = leads.filter((l) => l.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overCol !== col.key) setOverCol(col.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
                }}
                onDrop={(e) => onDrop(e, col.key)}
                className="flex flex-col"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                    {col.label}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="mb-3 h-px bg-border" />
                <div
                  className={`flex-1 space-y-2 rounded-2xl p-1 transition ${
                    overCol === col.key ? "bg-primary/10 ring-2 ring-primary/40" : ""
                  }`}
                >
                  {items.length === 0 ? (
                    <div className="flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-4 text-center text-sm font-medium text-primary">
                      {overCol === col.key ? "Solte aqui" : "Nenhum lead nesta etapa"}
                    </div>
                  ) : (
                    items.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        dragging={dragId === l.id}
                        onDragStart={() => setDragId(l.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverCol(null);
                        }}
                        onMove={(status) => move.mutate({ id: l.id, status })}
                        onOpen={() => setDetailId(l.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>


      )}

      {open && (
        <NewLeadModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}

      {detailId && <LeadDetailDrawer leadId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function LeadCard({
  lead,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
}: {
  lead: Lead;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (status: LeadStatus) => void;
  onOpen: () => void;
}) {
  


  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.setData("application/x-lead-id", lead.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative cursor-grab rounded-xl border border-border bg-card p-3 pr-16 shadow-sm transition hover:shadow-md hover:border-primary/40 active:cursor-grabbing ${
        dragging ? "opacity-50 ring-2 ring-primary" : ""
      }`}
    >
      <div className="absolute right-2 top-2 flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Ver detalhes do lead"
          title="Ver detalhes"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          <Info className="h-4 w-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Mover lead"
              title="Mover para outra etapa"
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLUMNS.filter((c) => c.key !== lead.status).map((c) => (
              <DropdownMenuItem
                key={c.key}
                onSelect={() => onMove(c.key)}
                className="gap-2"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="font-medium">{lead.name}</p>
      <p className="text-xs text-muted-foreground">{lead.destination || "Sem destino"}</p>
      <p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(lead.value)}</p>
    </div>
  );
}

type WizardForm = {
  name: string;
  email: string;
  phone: string;
  value: string;
  origin: string;
  origin_other: string;
  destination: string;
  travel_dates: string;
  passengers: string;
  trip_type: string;
  trip_notes: string;
  loyalty_programs: string;
  points_miles: string;
  has_passport: string;
  preferences: string;
  flight_class: string;
  airline_pref: string;
  hotel_category: string;
  room_type: string;
  hotel_notes: string;
};

const EMPTY_FORM: WizardForm = {
  name: "",
  email: "",
  phone: "",
  value: "",
  origin: "",
  origin_other: "",
  destination: "",
  travel_dates: "",
  passengers: "",
  trip_type: "",
  trip_notes: "",
  loyalty_programs: "",
  points_miles: "",
  has_passport: "",
  preferences: "",
  flight_class: "",
  airline_pref: "",
  hotel_category: "",
  room_type: "",
  hotel_notes: "",
};

const STEPS = [
  { label: "Pessoal", icon: User },
  { label: "Viagem", icon: Plane },
  { label: "Benefícios", icon: Gift },
  { label: "Voos & Hotel", icon: Hotel },
];

const ORIGINS = ["Indicação", "Instagram", "Facebook", "Google", "WhatsApp", "Site", "Outro"];

const AIRLINES = [
  "LATAM",
  "GOL",
  "Azul",
  "American Airlines",
  "Delta Air Lines",
  "United Airlines",
  "Emirates",
  "Qatar Airways",
  "Air France",
  "KLM",
  "Lufthansa",
  "TAP Air Portugal",
  "Iberia",
  "British Airways",
  "Turkish Airlines",
  "Copa Airlines",
  "Avianca",
  "Aerolíneas Argentinas",
  "Air Canada",
  "Etihad Airways",
];

const LOYALTY_PROGRAMS = [
  "Smiles (GOL)",
  "LATAM Pass",
  "TudoAzul (Azul)",
  "Livelo",
  "Esfera",
  "Latam Pass + Multiplus",
  "American Airlines AAdvantage",
  "Delta SkyMiles",
  "United MileagePlus",
  "Emirates Skywards",
  "TAP Miles&Go",
  "Iberia Plus",
  "Air France-KLM Flying Blue",
];

function leadToForm(lead: Lead): WizardForm {
  const p = (lead.profile || {}) as Record<string, string>;
  return {
    name: lead.name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    value: lead.value ? maskCurrency(String(Math.round(Number(lead.value) * 100))) : "",
    origin: ORIGINS.includes(lead.origin || "") ? lead.origin || "" : lead.origin ? "Outro" : "",
    origin_other: ORIGINS.includes(lead.origin || "") ? "" : lead.origin || "",
    destination: lead.destination || "",
    travel_dates: p.travel_dates || "",
    passengers: p.passengers || "",
    trip_type: p.trip_type || "",
    trip_notes: p.trip_notes || "",
    loyalty_programs: p.loyalty_programs || "",
    points_miles: p.points_miles || "",
    has_passport: p.has_passport || "",
    preferences: p.preferences || "",
    flight_class: p.flight_class || "",
    airline_pref: p.airline_pref || "",
    hotel_category: p.hotel_category || "",
    room_type: p.room_type || "",
    hotel_notes: p.hotel_notes || "",
  };
}

export function NewLeadModal({
  onClose,
  onCreated,
  lead,
}: {
  onClose: () => void;
  onCreated: () => void;
  lead?: Lead;
}) {
  const editing = !!lead;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(lead ? leadToForm(lead) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<WizardForm>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function next() {
    if (step === 0 && !form.name.trim()) {
      toast.error("Informe o nome completo.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Informe o nome completo.");
      setStep(0);
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      destination: form.destination || null,
      value: parseCurrency(form.value),
      origin: (form.origin === "Outro" ? form.origin_other.trim() : form.origin) || "direto",
      profile: {
        travel_dates: form.travel_dates,
        passengers: form.passengers,
        trip_type: form.trip_type,
        trip_notes: form.trip_notes,
        loyalty_programs: form.loyalty_programs,
        points_miles: form.points_miles,
        has_passport: form.has_passport,
        preferences: form.preferences,
        flight_class: form.flight_class,
        airline_pref: form.airline_pref,
        hotel_category: form.hotel_category,
        room_type: form.room_type,
        hotel_notes: form.hotel_notes,
      },
    };
    const res = editing
      ? await updateLead(lead!.id, payload)
      : await createLead({ ...payload, status: "new" });
    setSaving(false);
    if (res) {
      dispatchWebhook(editing ? "lead.updated" : "lead.created", res);
      toast.success(editing ? "Viajante atualizado!" : "Viajante criado!");
      onCreated();
    } else toast.error(editing ? "Erro ao atualizar viajante." : "Erro ao criar viajante.");
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-xl">
        <div className="bg-[var(--accent)] px-6 pb-5 pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{editing ? "Editar Viajante" : "Novo Viajante"}</h2>
                <p className="text-sm text-muted-foreground">
                  {editing
                    ? "Revise e atualize todos os dados do cliente"
                    : "Preencha os dados para criar o perfil completo do cliente"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 flex items-center">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                      i <= step
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground"
                    }`}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={`mt-1 text-xs font-semibold uppercase tracking-wide ${
                      i <= step ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 0 && (
            <Section icon={User} title="Dados de Contato">
              <ModalField label="Nome Completo" required placeholder="Ex: Família Santos" value={form.name} onChange={(v) => set({ name: v })} full />
              <ModalField label="E-mail" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(v) => set({ email: v })} />
              <ModalField label="WhatsApp" format="phone" placeholder="(11) 99999-9999" value={form.phone} onChange={(v) => set({ phone: v })} />
              <ModalField label="Orçamento Estimado (R$)" format="currency" placeholder="R$ 0,00" value={form.value} onChange={(v) => set({ value: v })} />
              <ModalSelect label="Como nos encontrou?" value={form.origin} onChange={(v) => set({ origin: v })} options={ORIGINS} />
              {form.origin === "Outro" && (
                <ModalField label="Especifique" placeholder="Digite como nos encontrou" value={form.origin_other} onChange={(v) => set({ origin_other: v })} />
              )}
            </Section>
          )}

          {step === 1 && (
            <Section icon={Plane} title="Detalhes da Viagem">
              <ModalField label="Destino" placeholder="Ex: Paris, França" value={form.destination} onChange={(v) => set({ destination: v })} />
              <ModalField label="Datas / Período" placeholder="Ex: Jul/2026, 10 dias" value={form.travel_dates} onChange={(v) => set({ travel_dates: v })} />
              <ModalField label="Nº de Passageiros" type="number" placeholder="0" value={form.passengers} onChange={(v) => set({ passengers: v })} />
              <ModalSelect label="Tipo de Viagem" value={form.trip_type} onChange={(v) => set({ trip_type: v })} options={["Lazer", "Lua de mel", "Negócios", "Família", "Aventura", "Cruzeiro"]} />
              <ModalTextarea label="Observações da viagem" placeholder="Preferências, ocasião especial…" value={form.trip_notes} onChange={(v) => set({ trip_notes: v })} />
            </Section>
          )}

          {step === 2 && (
            <Section icon={Gift} title="Benefícios & Fidelidade">
              <ModalField label="Programas de Fidelidade" placeholder="Ex: Smiles, LATAM Pass" value={form.loyalty_programs} onChange={(v) => set({ loyalty_programs: v })} suggestions={LOYALTY_PROGRAMS} />
              <ModalField label="Pontos / Milhas" placeholder="Ex: 80.000" value={form.points_miles} onChange={(v) => set({ points_miles: maskMiles(v) })} />
              <ModalSelect label="Possui Passaporte?" value={form.has_passport} onChange={(v) => set({ has_passport: v })} options={["Sim", "Não", "Vencido"]} />
              <ModalTextarea label="Preferências do cliente" placeholder="Assento, alimentação, acessibilidade…" value={form.preferences} onChange={(v) => set({ preferences: v })} />
            </Section>
          )}

          {step === 3 && (
            <Section icon={Hotel} title="Voos & Hotel">
              <ModalSelect label="Classe de Voo" value={form.flight_class} onChange={(v) => set({ flight_class: v })} options={["Econômica", "Premium Economy", "Executiva", "Primeira Classe"]} />
              <ModalField label="Companhia preferida" placeholder="Ex: LATAM, Emirates" value={form.airline_pref} onChange={(v) => set({ airline_pref: v })} suggestions={AIRLINES} />
              <ModalSelect label="Categoria de Hotel" value={form.hotel_category} onChange={(v) => set({ hotel_category: v })} options={["Econômico / 2 estrelas", "3 estrelas", "4 estrelas", "5 estrelas", "Resort", "Boutique", "All Inclusive", "Pousada", "Apart-hotel / Flat", "Hostel", "Hotel Fazenda", "Cassino"]} />
              <ModalSelect label="Tipo de Quarto" value={form.room_type} onChange={(v) => set({ room_type: v })} options={["Standard", "Superior", "Luxo / Deluxe", "Suíte", "Suíte Master", "Suíte Presidencial", "Família", "Quarto Conectado", "Single", "Duplo (Twin)", "Casal (King)", "Quarto Acessível"]} />
              <ModalTextarea label="Observações de hospedagem" placeholder="Vista, café da manhã, localização…" value={form.hotel_notes} onChange={(v) => set({ hotel_notes: v })} />
            </Section>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                className="flex items-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            )}
            {isLast ? (
              <button
                onClick={submit}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Salvando…" : editing ? "Salvar Alterações" : "Criar Viajante"} <Check className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={next}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function ModalField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  full,
  format,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  full?: boolean;
  format?: "currency" | "phone" | "cpfcnpj";
  suggestions?: string[];
}) {
  const listId = suggestions ? `dl-${label.replace(/\s+/g, "-")}` : undefined;
  const masks = {
    currency: maskCurrency,
    phone: maskPhone,
    cpfcnpj: maskCpfCnpj,
  } as const;
  const handleChange = (raw: string) => {
    onChange(format ? masks[format](raw) : raw);
  };
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-semibold">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      <input
        type={format ? "text" : type}
        inputMode={format ? "numeric" : undefined}
        required={required}
        value={value}
        placeholder={placeholder}
        list={listId}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </label>
  );
}

function ModalSelect({
  label,
  value,
  onChange,
  options,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
      >
        <option value="">Selecionar…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModalTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block sm:col-span-2">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <textarea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
      />
    </label>
  );
}
