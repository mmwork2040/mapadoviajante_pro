import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, User, Mail, Phone, MessageCircle, X, Trash2, Plane, Save, IdCard, MapPin, StickyNote, Sparkles, Users, UserPlus, MoreVertical, Pencil, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { ScrollLock } from "@/components/ScrollLock";
import { ModalField, ModalTextarea, Section } from "@/routes/_app.leads";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


import { toast } from "sonner";
import {
  fetchClients,
  createClient as createClientSvc,
  updateClient,
  deleteClient,
  createLeadFromClient,
  fetchLeadsByClient,
} from "@/lib/services";
import type { Client, LeadStatus } from "@/lib/types";

import { lookupCep } from "@/lib/agency";
import { useConfirm } from "@/components/ConfirmDialog";

function maskCep(v: string): string {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Normaliza telefone para o formato E.164 usado pelo wa.me (só dígitos, com DDI).
 * - Remove qualquer caractere não-numérico.
 * - Descarta prefixo internacional "00".
 * - Se vier sem DDI e tiver 10 ou 11 dígitos (DDD + número), assume Brasil (55).
 * - Retorna string vazia se não houver dígitos suficientes (mín. 10).
 */
function normalizeWhatsPhone(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12) return "";
  return d;
}

function waLink(phone: string | null | undefined, name: string | null | undefined): string | null {
  const p = normalizeWhatsPhone(phone);
  if (!p) return null;
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const text = encodeURIComponent(`Olá, ${first}! Tudo bem?`);
  return `https://wa.me/${p}?text=${text}`;
}

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
});

const LEAD_STATUS_META: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "Novo", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  contacted: { label: "Contatado", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  negotiating: { label: "Em Negociação", cls: "bg-amber-500/20 text-amber-800 dark:text-amber-300" },
  closed: { label: "Fechado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  lost: { label: "Perdido", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

const EMPTY: Partial<Client> = {
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  cpf: "",
  birth_date: "",
  passport_number: "",
  passport_expiry: "",
  passport_country: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  address_country: "",
  notes: "",
  preferences: {},
};

type Tab = "contato" | "documentos" | "endereco" | "preferencias" | "notas";

function ClientesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => fetchClients(search),
  });

  const createMut = useMutation({
    mutationFn: (payload: Partial<Client>) => createClientSvc(payload),
    onSuccess: (c) => {
      if (!c) return toast.error("Erro ao criar cliente");
      toast.success("Cliente criado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpenForm(false);
      setEditing(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Client> }) => updateClient(id, patch),
    onSuccess: (c) => {
      if (!c) return toast.error("Erro ao salvar");
      toast.success("Cliente atualizado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpenForm(false);
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const createTripMut = useMutation({
    mutationFn: (clientId: string) => createLeadFromClient(clientId),
    onSuccess: (lead) => {
      if (!lead) return toast.error("Não foi possível criar a viagem");
      toast.success("Viagem criada!");
      qc.invalidateQueries({ queryKey: ["leads"] });
      navigate({ to: "/leads", search: { lead: lead.id } });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Clientes"
        subtitle="Cadastro completo dos viajantes. Crie uma nova viagem com um clique."
        actions={
          <>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar cliente…"
              className="w-full sm:w-64"
            />

            <button
              onClick={() => {
                setEditing(null);
                setOpenForm(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Novo cliente
            </button>
          </>

        }
      />


      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Nenhum cliente cadastrado ainda.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onEdit={() => {
                setEditing(c);
                setOpenForm(true);
              }}
              onDelete={async () => {
                const ok = await confirm({
                  title: "Remover cliente?",
                  description: `Deseja remover ${c.name}? As viagens vinculadas serão desvinculadas.`,
                  confirmLabel: "Remover",
                  destructive: true,
                });
                if (ok) deleteMut.mutate(c.id);
              }}
              onCreateTrip={() => createTripMut.mutate(c.id)}
              creating={createTripMut.isPending}
            />
          ))}
        </div>
      )}

      {openForm && (
        <ClientFormDrawer
          initial={editing ?? EMPTY}
          isEdit={!!editing}
          saving={createMut.isPending || updateMut.isPending}
          onClose={() => {
            setOpenForm(false);
            setEditing(null);
          }}
          onSubmit={(payload) => {
            if (editing) updateMut.mutate({ id: editing.id, patch: payload });
            else createMut.mutate(payload);
          }}
        />
      )}
    </div>
  );
}

function ClientCard({
  client,
  onEdit,
  onDelete,
  onCreateTrip,
  creating,
}: {
  client: Client;
  onEdit: () => void;
  onDelete: () => void;
  onCreateTrip: () => void;
  creating: boolean;
}) {
  const tripsQ = useQuery({
    queryKey: ["client-trips", client.id],
    queryFn: () => fetchLeadsByClient(client.id),
  });
  const tripCount = tripsQ.data?.length ?? 0;
  const [tripsOpen, setTripsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onEdit} className="flex flex-1 items-center gap-3 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold">{client.name}</div>
            {client.cpf && <div className="truncate text-xs text-muted-foreground">CPF {client.cpf}</div>}
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Mais opções"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onCreateTrip} disabled={creating}>
              <Plane className="mr-2 h-4 w-4" /> Nova proposta
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="text-destructive mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 truncate hover:text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.email}</span>
          </a>
        )}
        {client.phone && (
          <a
            href={`https://wa.me/${String(client.phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${(client.name || "").split(" ")[0] || ""}! Tudo bem?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-primary hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />{client.phone}
          </a>
        )}
        {client.whatsapp && (
          <a
            href={`https://wa.me/${String(client.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${(client.name || "").split(" ")[0] || ""}! Tudo bem?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-primary hover:underline"
          >
            <MessageCircle className="h-3.5 w-3.5" />{client.whatsapp}
          </a>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setTripsOpen((v) => !v)}
          disabled={tripCount === 0}
          className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground disabled:cursor-default"
          aria-expanded={tripsOpen}
        >
          <span>
            {tripCount} {tripCount === 1 ? "viagem" : "viagens"}
          </span>
          {tripCount > 0 && (
            <ChevronDown
              className={`h-4 w-4 transition-transform ${tripsOpen ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {tripsOpen && tripCount > 0 && (
          <ul className="mt-2 space-y-1">
            {(tripsQ.data ?? []).map((t) => {
              const meta = LEAD_STATUS_META[t.status] ?? { label: t.status, cls: "bg-muted text-foreground" };
              return (
                <li key={t.id}>
                  <Link
                    to="/leads"
                    search={{ lead: t.id }}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <span className="min-w-0 truncate">{t.name || "Viagem sem título"}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ClientFormDrawer({
  initial,
  isEdit,
  saving,
  onClose,
  onSubmit,
}: {
  initial: Partial<Client>;
  isEdit: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Client>) => void;
}) {
  const [form, setForm] = useState<Partial<Client>>(initial);
  const [tab, setTab] = useState<Tab>("contato");
  const [prefText, setPrefText] = useState<string>(
    typeof initial.preferences === "object" && initial.preferences
      ? JSON.stringify(initial.preferences, null, 2)
      : "{}",
  );
  const [cepLoading, setCepLoading] = useState(false);

  const { data: ibgeCities = [] } = useQuery({
    queryKey: ["ibge-municipios"],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const r = await fetch("https://servicosdados.ibge.gov.br/api/v1/localidades/municipios");
      if (!r.ok) return [] as { name: string; uf: string }[];
      const list = (await r.json()) as Array<{
        nome: string;
        microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
      }>;
      return list
        .map((m) => ({ name: m.nome, uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? "" }))
        .filter((c) => c.name && c.uf);
    },
  });
  const cityOptions = ibgeCities.map((c) => `${c.name} - ${c.uf}`);
  const norm = (s: string) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  const cityDisplay = form.address_city
    ? (() => {
        const uf = form.address_state?.trim().toUpperCase();
        const target = norm(form.address_city);
        const match = ibgeCities.find(
          (c) => norm(c.name) === target && (!uf || c.uf === uf),
        );
        return match ? `${match.name} - ${match.uf}` : (form.address_city ?? "");
      })()
    : "";


  const handleCityChange = (v: string) => {
    const m = /^(.+?)\s-\s([A-Z]{2})$/.exec(v.trim());
    if (m) {
      setForm((f) => ({ ...f, address_city: m[1], address_state: m[2] }));
    } else {
      set("address_city", v);
    }
  };

  const set = <K extends keyof Client>(key: K, value: Client[K]) => setForm((f) => ({ ...f, [key]: value }));


  const handleCepChange = async (raw: string) => {
    const masked = maskCep(raw);
    const digits = masked.replace(/\D/g, "");
    setForm((f) => ({ ...f, address_zip: masked }));
    if (digits.length !== 8) return;
    setCepLoading(true);
    const res = await lookupCep(digits);
    setCepLoading(false);
    if (!res) {
      toast.error("CEP não encontrado");
      return;
    }
    const uf = (res.state || "").toUpperCase();
    const cityMatch = ibgeCities.find(
      (c) => norm(c.name) === norm(res.city || "") && (!uf || c.uf === uf),
    );
    setForm((f) => ({
      ...f,
      address_street: res.street || f.address_street || "",
      address_neighborhood: res.district || f.address_neighborhood || "",
      address_city: cityMatch?.name || res.city || "",
      address_state: cityMatch?.uf || uf,
      address_country: f.address_country?.trim() ? f.address_country : "Brasil",
    }));

  };

  const submit = () => {
    if (!form.name?.trim()) return toast.error("Informe o nome");
    let preferences: Record<string, unknown> = {};
    try {
      preferences = prefText.trim() ? JSON.parse(prefText) : {};
    } catch {
      toast.error("Preferências: JSON inválido");
      return;
    }
    // Normaliza datas vazias para null
    const clean: Partial<Client> = { ...form, preferences };
    (["birth_date", "passport_expiry"] as const).forEach((k) => {
      if (!clean[k]) clean[k] = null;
    });
    onSubmit(clean);
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "contato", label: "Contato", icon: User },
    { key: "documentos", label: "Documentos", icon: IdCard },
    { key: "endereco", label: "Endereço", icon: MapPin },
    { key: "preferencias", label: "Preferências", icon: Sparkles },
    { key: "notas", label: "Observações", icon: StickyNote },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <ScrollLock />
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--accent)] px-6 pb-5 pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{isEdit ? "Editar cliente" : "Novo cliente"}</h2>
                <p className="text-xs text-muted-foreground">
                  {isEdit
                    ? "Revise e atualize os dados do cliente"
                    : "Preencha os dados para criar o cadastro completo do cliente"}
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

          <div className="-mx-6 mt-5 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center sm:justify-between">
              {tabs.map((t, i) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <div key={t.key} className="flex shrink-0 items-center sm:flex-1 sm:last:flex-none">
                    <button
                      type="button"
                      onClick={() => setTab(t.key)}
                      className="flex flex-col items-center"
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                          active
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/25"
                            : "bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span
                        className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${
                          active ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {t.label}
                      </span>
                    </button>
                    {i < tabs.length - 1 && <div className="mx-3 h-0.5 w-8 bg-border sm:w-auto sm:flex-1" />}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {tab === "contato" && (
            <Section icon={User} title="Dados de Contato">
              <ModalField
                label="Nome completo"
                required
                full
                placeholder="Ex: Maria Silva"
                value={form.name ?? ""}
                onChange={(v) => set("name", v)}
              />
              <ModalField
                label="E-mail"
                type="email"
                placeholder="email@exemplo.com"
                value={form.email ?? ""}
                onChange={(v) => set("email", v)}
              />
              <ModalField
                label="Telefone"
                format="phone"
                placeholder="(11) 99999-9999"
                value={form.phone ?? ""}
                onChange={(v) => set("phone", v)}
              />
              <ModalField
                label="WhatsApp"
                format="phone"
                placeholder="(11) 99999-9999"
                value={form.whatsapp ?? ""}
                onChange={(v) => set("whatsapp", v)}
              />
              <ModalField
                label="Data de nascimento"
                type="date"
                value={form.birth_date ?? ""}
                onChange={(v) => set("birth_date", v)}
              />
            </Section>
          )}

          {tab === "documentos" && (
            <Section icon={IdCard} title="Documentos">
              <ModalField
                label="CPF"
                format="cpfcnpj"
                placeholder="000.000.000-00"
                value={form.cpf ?? ""}
                onChange={(v) => set("cpf", v)}
              />
              <ModalField
                label="País emissor do passaporte"
                placeholder="Ex.: Brasil"
                value={form.passport_country ?? ""}
                onChange={(v) => set("passport_country", v)}
              />
              <ModalField
                label="Número do passaporte"
                value={form.passport_number ?? ""}
                onChange={(v) => set("passport_number", v.toUpperCase())}
              />
              <ModalField
                label="Validade do passaporte"
                type="date"
                value={form.passport_expiry ?? ""}
                onChange={(v) => set("passport_expiry", v)}
              />
            </Section>
          )}

          {tab === "endereco" && (
            <Section icon={MapPin} title="Endereço">
              <ModalField
                label={cepLoading ? "CEP (buscando…)" : "CEP"}
                placeholder="00000-000"
                value={form.address_zip ?? ""}
                onChange={handleCepChange}
              />
              <ModalField
                label="País"
                placeholder="Ex.: Brasil"
                value={form.address_country ?? ""}
                onChange={(v) => set("address_country", v)}
              />
              <ModalField
                label="Rua / Logradouro"
                full
                value={form.address_street ?? ""}
                onChange={(v) => set("address_street", v)}
              />
              <ModalField
                label="Número"
                value={form.address_number ?? ""}
                onChange={(v) => set("address_number", v)}
              />
              <ModalField
                label="Complemento"
                value={form.address_complement ?? ""}
                onChange={(v) => set("address_complement", v)}
              />
              <ModalField
                label="Bairro"
                value={form.address_neighborhood ?? ""}
                onChange={(v) => set("address_neighborhood", v)}
              />
              <ModalField
                label="Cidade"
                placeholder="Digite para buscar…"
                value={cityDisplay}
                onChange={handleCityChange}
                suggestions={cityOptions}
              />

              <ModalField
                label="Estado / UF"
                value={form.address_state ?? ""}
                onChange={(v) => set("address_state", v)}
              />
            </Section>
          )}

          {tab === "preferencias" && (
            <Section icon={Sparkles} title="Preferências">
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="mb-1 flex h-8 items-center text-sm font-semibold">
                    Preferências base (JSON)
                  </span>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Preferências copiadas para cada nova viagem. Ex.: alimentação, hospedagem, tipo de viagem.
                  </p>
                  <textarea
                    value={prefText}
                    onChange={(e) => setPrefText(e.target.value)}
                    rows={10}
                    spellCheck={false}
                    className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 font-mono text-xs outline-none focus:border-primary focus:bg-background"
                  />
                </label>
              </div>
            </Section>
          )}

          {tab === "notas" && (
            <Section icon={StickyNote} title="Observações">
              <ModalTextarea
                label="Observações"
                placeholder="Anotações gerais sobre o cliente…"
                value={form.notes ?? ""}
                onChange={(v) => set("notes", v)}
              />
            </Section>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-input px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando…" : isEdit ? "Salvar Alterações" : "Criar Cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

