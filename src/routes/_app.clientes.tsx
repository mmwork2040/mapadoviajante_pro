import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, User, Mail, Phone, MessageCircle, X, Trash2, Plane, Save, IdCard, MapPin, StickyNote, Sparkles } from "lucide-react";
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
import { maskPhone, maskCpfCnpj } from "@/lib/ui";
import { lookupCep } from "@/lib/agency";
import { useConfirm } from "@/components/ConfirmDialog";

function maskCep(v: string): string {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
});

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
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro completo dos viajantes. Crie uma nova viagem com um clique.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpenForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail, CPF ou telefone"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

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
        <button onClick={onDelete} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remover">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {client.email && (
          <div className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5" />{client.email}</div>
        )}
        {client.phone && (
          <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{client.phone}</div>
        )}
        {client.whatsapp && (
          <div className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{client.whatsapp}</div>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {tripCount} {tripCount === 1 ? "viagem" : "viagens"}
          </span>
          <button
            onClick={onCreateTrip}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Plane className="h-3.5 w-3.5" /> Nova viagem
          </button>
        </div>
        {tripCount > 0 && (
          <ul className="space-y-1">
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
    setForm((f) => ({
      ...f,
      address_street: res.street || f.address_street || "",
      address_neighborhood: res.district || f.address_neighborhood || "",
      address_city: res.city || "",
      address_state: res.state || "",
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{isEdit ? "Editar cliente" : "Novo cliente"}</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-border px-5">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {tab === "contato" && (
            <>
              <Field label="Nome completo *">
                <input
                  value={form.name ?? ""}
                  onChange={(e) => set("name", e.target.value)}
                  className="input"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="E-mail">
                  <input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    value={form.phone ?? ""}
                    onChange={(e) => set("phone", maskPhone(e.target.value))}
                    className="input"
                  />
                </Field>
                <Field label="WhatsApp">
                  <input
                    value={form.whatsapp ?? ""}
                    onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
                    className="input"
                  />
                </Field>
                <Field label="Data de nascimento">
                  <input
                    type="date"
                    value={form.birth_date ?? ""}
                    onChange={(e) => set("birth_date", e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
            </>
          )}

          {tab === "documentos" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CPF">
                  <input
                    value={form.cpf ?? ""}
                    onChange={(e) => set("cpf", maskCpfCnpj(e.target.value))}
                    className="input"
                  />
                </Field>
                <Field label="País emissor do passaporte">
                  <input
                    value={form.passport_country ?? ""}
                    onChange={(e) => set("passport_country", e.target.value)}
                    className="input"
                    placeholder="Ex.: Brasil"
                  />
                </Field>
                <Field label="Número do passaporte">
                  <input
                    value={form.passport_number ?? ""}
                    onChange={(e) => set("passport_number", e.target.value.toUpperCase())}
                    className="input"
                  />
                </Field>
                <Field label="Validade do passaporte">
                  <input
                    type="date"
                    value={form.passport_expiry ?? ""}
                    onChange={(e) => set("passport_expiry", e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
            </>
          )}

          {tab === "endereco" && (
            <>
              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <Field label="Rua / Logradouro">
                  <input
                    value={form.address_street ?? ""}
                    onChange={(e) => set("address_street", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Número">
                  <input
                    value={form.address_number ?? ""}
                    onChange={(e) => set("address_number", e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Complemento">
                  <input
                    value={form.address_complement ?? ""}
                    onChange={(e) => set("address_complement", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Bairro">
                  <input
                    value={form.address_neighborhood ?? ""}
                    onChange={(e) => set("address_neighborhood", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Cidade">
                  <input
                    value={form.address_city ?? ""}
                    onChange={(e) => set("address_city", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="Estado / UF">
                  <input
                    value={form.address_state ?? ""}
                    onChange={(e) => set("address_state", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label={cepLoading ? "CEP (buscando...)" : "CEP"}>
                  <input
                    value={form.address_zip ?? ""}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className="input"
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="País">
                  <input
                    value={form.address_country ?? ""}
                    onChange={(e) => set("address_country", e.target.value)}
                    className="input"
                    placeholder="Ex.: Brasil"
                  />
                </Field>
              </div>
            </>
          )}

          {tab === "preferencias" && (
            <Field label="Preferências base (JSON)">
              <p className="mb-2 text-xs text-muted-foreground">
                Preferências que serão copiadas para o perfil de cada nova viagem. Ex.: alimentação, hospedagem, tipo de viagem.
              </p>
              <textarea
                value={prefText}
                onChange={(e) => setPrefText(e.target.value)}
                rows={12}
                className="input font-mono text-xs"
                spellCheck={false}
              />
            </Field>
          )}

          {tab === "notas" && (
            <Field label="Observações">
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={10}
                className="input"
                placeholder="Anotações gerais sobre o cliente..."
              />
            </Field>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </div>

      <style>{`.input{width:100%;border:1px solid hsl(var(--input));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:8px 12px;font-size:14px;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
