import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, UserPlus, User, Plane, Gift, Hotel, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { createLead, fetchLeads, updateLead } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";
import { formatCurrency, maskCurrency, parseCurrency, maskPhone, maskCpfCnpj } from "@/lib/ui";
import type { Lead, LeadStatus } from "@/lib/types";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/leads")({
  component: LeadsPage,
});

const COLUMNS: { key: LeadStatus; label: string }[] = [
  { key: "new", label: "Novos" },
  { key: "contacted", label: "Contatados" },
  { key: "negotiating", label: "Negociando" },
  { key: "closed", label: "Fechados" },
  { key: "lost", label: "Perdidos" },
];

function LeadsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: leads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", { search }],
    queryFn: () => fetchLeads({ search: search || undefined }),
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      updateLead(id, { status }),
    onSuccess: (_res, vars) => {
      dispatchWebhook("lead.status_changed", { id: vars.id, status: vars.status });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  function onDrop(e: React.DragEvent, status: LeadStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) move.mutate({ id, status });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Funil de vendas (arraste para mover).</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, e-mail, destino…"
            className="w-56 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, col.key)}
                className="flex flex-col rounded-2xl border border-border bg-muted/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="rounded-full bg-card px-2 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((l) => (
                    <LeadCard key={l.id} lead={l} />
                  ))}
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
    </div>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      to="/leads/$leadId"
      params={{ leadId: lead.id }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
      className="block cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <p className="font-medium">{lead.name}</p>
      <p className="text-xs text-muted-foreground">{lead.destination || "Sem destino"}</p>
      <p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(lead.value)}</p>
    </Link>
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

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<WizardForm>) => setForm((f) => ({ ...f, ...patch }));

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
    const res = await createLead({
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      destination: form.destination || null,
      value: parseCurrency(form.value),
      status: "new",
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
    });
    setSaving(false);
    if (res) {
      dispatchWebhook("lead.created", res);
      toast.success("Viajante criado!");
      onCreated();
    } else toast.error("Erro ao criar viajante.");
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
                <h2 className="text-xl font-bold">Novo Viajante</h2>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados para criar o perfil completo do cliente
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
              <ModalField label="Pontos / Milhas" placeholder="Ex: 80.000 milhas" value={form.points_miles} onChange={(v) => set({ points_miles: v })} />
              <ModalSelect label="Possui Passaporte?" value={form.has_passport} onChange={(v) => set({ has_passport: v })} options={["Sim", "Não", "Vencido"]} />
              <ModalTextarea label="Preferências do cliente" placeholder="Assento, alimentação, acessibilidade…" value={form.preferences} onChange={(v) => set({ preferences: v })} />
            </Section>
          )}

          {step === 3 && (
            <Section icon={Hotel} title="Voos & Hotel">
              <ModalSelect label="Classe de Voo" value={form.flight_class} onChange={(v) => set({ flight_class: v })} options={["Econômica", "Premium Economy", "Executiva", "Primeira Classe"]} />
              <ModalField label="Companhia preferida" placeholder="Ex: LATAM, Emirates" value={form.airline_pref} onChange={(v) => set({ airline_pref: v })} />
              <ModalSelect label="Categoria de Hotel" value={form.hotel_category} onChange={(v) => set({ hotel_category: v })} options={["3 estrelas", "4 estrelas", "5 estrelas", "Resort", "Boutique"]} />
              <ModalSelect label="Tipo de Quarto" value={form.room_type} onChange={(v) => set({ room_type: v })} options={["Standard", "Luxo", "Suíte", "Família"]} />
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
                className="flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            )}
            {isLast ? (
              <button
                onClick={submit}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Criar Viajante"} <Check className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={next}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
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
