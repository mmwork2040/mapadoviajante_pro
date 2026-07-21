import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, User, Mail, Phone, MessageCircle, X, Trash2, Plane, Save, IdCard, MapPin, StickyNote, Sparkles, Users, UserPlus, MoreVertical, Pencil, Link2, Heart, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { ScrollLock } from "@/components/ScrollLock";
import { ModalField, ModalTextarea, Section, NewLeadModal } from "@/routes/_app.leads";

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

export const Route = createFileRoute("/_app/clientes/")({
  component: ClientesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
  }),
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

export type Tab = "contato" | "documentos" | "endereco" | "membros" | "preferencias" | "notas";

export interface ClientMember {
  id: string;
  name: string;
  relationship: string;
  client_id?: string | null;
}

export function extractMembers(prefs: unknown): ClientMember[] {
  if (!prefs || typeof prefs !== "object") return [];
  const raw = (prefs as Record<string, unknown>).members;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      if (!m || typeof m !== "object") return null;
      const o = m as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      if (!name) return null;
      return {
        id: typeof o.id === "string" && o.id ? o.id : (globalThis.crypto?.randomUUID?.() ?? String(Math.random())),
        name,
        relationship: typeof o.relationship === "string" ? o.relationship : "",
        client_id: typeof o.client_id === "string" ? o.client_id : null,
      } as ClientMember;
    })
    .filter((m): m is ClientMember => !!m);
}

function ClientesPage() {
  const qc = useQueryClient();
  
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const editParam = Route.useSearch().edit as string | undefined;

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => fetchClients(search),
  });

  const navigate = useNavigate();
  useEffect(() => {
    if (!editParam) return;
    const c = clients.find((x) => x.id === editParam);
    if (c) {
      setEditing(c);
      setOpenForm(true);
      navigate({ to: "/clientes", search: {}, replace: true });
    }
  }, [editParam, clients, navigate]);


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

  const [newProposalClient, setNewProposalClient] = useState<Client | null>(null);

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
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              onCreateTrip={() => setNewProposalClient(c)}
              creating={false}
            />
          ))}
        </div>
      )}



      {newProposalClient && (
        <NewLeadModal
          onClose={() => setNewProposalClient(null)}
          onCreated={() => {
            setNewProposalClient(null);
            qc.invalidateQueries({ queryKey: ["leads"] });
            qc.invalidateQueries({ queryKey: ["client-trips"] });
            qc.invalidateQueries({ queryKey: ["clients"] });
          }}
          clientId={newProposalClient.id}
          initialForm={{
            name: newProposalClient.name || "",
            email: newProposalClient.email || "",
            phone: newProposalClient.phone || "",
          }}
        />
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
  onOpenTrip?: (leadId: string) => void;
  creating: boolean;
}) {
  const tripsQ = useQuery({
    queryKey: ["client-trips", client.id],
    queryFn: () => fetchLeadsByClient(client.id),
  });
  const tripCount = tripsQ.data?.length ?? 0;
  const memberCount = extractMembers(client.preferences).length;




  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <Link to="/clientes/$id" params={{ id: client.id }} className="flex flex-1 items-center gap-3 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-semibold">{client.name}</span>
              {memberCount > 0 && (
                <span
                  title={`${memberCount} ${memberCount === 1 ? "membro cadastrado" : "membros cadastrados"}`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                >
                  <Users className="h-3 w-3" />+{memberCount}
                </span>
              )}
              {tripCount > 0 && (
                <span
                  title={`${tripCount} ${tripCount === 1 ? "viagem" : "viagens"}`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300"
                >
                  <Plane className="h-3 w-3" />
                  {tripCount}
                </span>
              )}
            </div>
            {client.cpf && <div className="truncate text-xs text-muted-foreground">CPF {client.cpf}</div>}
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Mais opções"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/clientes/$id" params={{ id: client.id }}>
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCreateTrip} disabled={creating}>
              <Plane className="mr-2 h-4 w-4" /> Nova proposta
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Editar cadastro
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
            <Mail className="h-3.5 w-3.5 shrink-0 text-sky-500" />
            <span className="truncate">{client.email}</span>
          </a>
        )}
        {client.phone && (
          <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-blue-500" />{client.phone}</div>
        )}
        {client.whatsapp && (() => {
          const href = waLink(client.whatsapp, client.name);
          const cls = "flex items-center gap-1.5 hover:text-primary hover:underline";
          return href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={cls}>
              <MessageCircle className="h-3.5 w-3.5 text-green-500" />{client.whatsapp}
            </a>
          ) : (
            <div className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-green-500" />{client.whatsapp}</div>
          );
        })()}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {tripCount} {tripCount === 1 ? "viagem" : "viagens"}
        </span>
        <Link
          to="/clientes/$id"
          params={{ id: client.id }}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Abrir perfil <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}


export function ClientFormDrawer({
  initial,
  isEdit,
  saving,
  onClose,
  onSubmit,
  initialTab,
}: {
  initial: Partial<Client>;
  isEdit: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Client>) => void;
  initialTab?: Tab;
}) {
  const [form, setForm] = useState<Partial<Client>>(initial);
  const [tab, setTab] = useState<Tab>(initialTab ?? "contato");
  const [members, setMembers] = useState<ClientMember[]>(() => extractMembers(initial.preferences));
  const [prefText, setPrefText] = useState<string>(() => {
    const src = (initial.preferences && typeof initial.preferences === "object")
      ? (initial.preferences as Record<string, unknown>)
      : {};
    const { members: _m, ...rest } = src;
    return JSON.stringify(rest, null, 2);
  });
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
    const email = form.email?.trim() ?? "";
    if (!email) return toast.error("Informe o e-mail");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("E-mail inválido");
    let preferences: Record<string, unknown> = {};
    try {
      preferences = prefText.trim() ? JSON.parse(prefText) : {};
    } catch {
      toast.error("Preferências: JSON inválido");
      return;
    }
    // Membros são gerenciados pela aba dedicada; salvos dentro de preferences.
    preferences.members = members;
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
    { key: "membros", label: "Membros", icon: Users },
    { key: "preferencias", label: "Preferências", icon: Sparkles },
    { key: "notas", label: "Anotações", icon: StickyNote },
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

          {tab === "membros" && (
            <MembersTab
              currentClientId={(initial as Client).id}
              members={members}
              onChange={setMembers}
            />
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
            <Section icon={StickyNote} title="Anotações">
              <ModalTextarea
                label="Anotações"
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

function MembersTab({
  currentClientId,
  members,
  onChange,
}: {
  currentClientId?: string;
  members: ClientMember[];
  onChange: (m: ClientMember[]) => void;
}) {
  const confirm = useConfirm();
  const { data: allClients = [] } = useQuery({
    queryKey: ["clients", ""],
    queryFn: () => fetchClients(""),
  });
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRel, setEditRel] = useState("");

  const norm = (s: string) => s.trim().toLowerCase();

  const excludedIds = new Set<string>();
  if (currentClientId) excludedIds.add(currentClientId);
  members.forEach((m) => m.client_id && excludedIds.add(m.client_id));
  const availableClients = allClients.filter((c) => !excludedIds.has(c.id));

  const addMember = () => {
    const rel = relationship.trim();
    if (!rel) return toast.error("Informe o grau de parentesco");
    const id = globalThis.crypto?.randomUUID?.() ?? String(Math.random());
    if (mode === "existing") {
      if (!selectedClientId) return toast.error("Selecione um cliente");
      if (currentClientId && selectedClientId === currentClientId)
        return toast.error("O cliente principal não pode ser adicionado como membro");
      if (members.some((m) => m.client_id === selectedClientId))
        return toast.error("Este cliente já é um membro");
      const c = allClients.find((x) => x.id === selectedClientId);
      if (!c) return;
      onChange([...members, { id, name: c.name, relationship: rel, client_id: c.id }]);
      setSelectedClientId("");
    } else {
      const nm = newName.trim();
      if (!nm) return toast.error("Informe o nome");
      if (members.some((m) => !m.client_id && norm(m.name) === norm(nm)))
        return toast.error("Já existe um membro com esse nome");
      onChange([...members, { id, name: nm, relationship: rel, client_id: null }]);
      setNewName("");
    }
    setRelationship("");
  };

  const startEdit = (m: ClientMember) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditRel(m.relationship);
  };

  const saveEdit = (id: string) => {
    const rel = editRel.trim();
    if (!rel) return toast.error("Informe o grau de parentesco");
    const target = members.find((m) => m.id === id);
    if (!target) return;
    let nextName = target.name;
    if (!target.client_id) {
      const nm = editName.trim();
      if (!nm) return toast.error("Informe o nome");
      if (members.some((m) => m.id !== id && !m.client_id && norm(m.name) === norm(nm)))
        return toast.error("Já existe um membro com esse nome");
      nextName = nm;
    }
    onChange(members.map((m) => (m.id === id ? { ...m, name: nextName, relationship: rel } : m)));
    setEditingId(null);
    toast.success("Membro atualizado");
  };

  const remove = async (m: ClientMember) => {
    const ok = await confirm({
      title: "Remover membro?",
      description: `${m.name} será removido da lista de membros.`,
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!ok) return;
    onChange(members.filter((x) => x.id !== m.id));
    if (editingId === m.id) setEditingId(null);
    toast.success("Membro removido");
  };

  return (
    <Section icon={Users} title="Membros da viagem">
      <div className="sm:col-span-2 space-y-4">
        <p className="text-xs text-muted-foreground">
          Adicione familiares ou acompanhantes. Podem ser clientes já cadastrados ou nomes livres com o grau de parentesco.
        </p>

        {members.length > 0 && (
          <ul className="space-y-2">
            {members.map((m) => {
              const isEditing = editingId === m.id;
              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-border bg-background px-3 py-2"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      {!m.client_id && (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nome"
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      )}
                      <input
                        value={editRel}
                        onChange={(e) => setEditRel(e.target.value)}
                        placeholder="Grau de parentesco"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(m.id)}
                          className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {m.client_id ? <Link2 className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{m.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {m.relationship}
                            {m.client_id && <span className="ml-1 text-primary">· cliente vinculado</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                          title="Editar membro"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(m)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="Remover membro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                mode === "existing" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Link2 className="mr-1 inline h-3.5 w-3.5" /> Cliente existente
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                mode === "new" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <UserPlus className="mr-1 inline h-3.5 w-3.5" /> Nome livre
            </button>
          </div>

          {mode === "existing" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Selecionar cliente</span>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">— escolha —</option>
                {availableClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {availableClients.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Nenhum cliente disponível para vincular.</p>
              )}
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Nome</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: João Silva"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Grau de parentesco</span>
            <input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="Ex.: Cônjuge, Filho(a), Pai, Mãe, Amigo(a)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <button
            type="button"
            onClick={addMember}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Adicionar membro
          </button>
        </div>
      </div>
    </Section>
  );
}


