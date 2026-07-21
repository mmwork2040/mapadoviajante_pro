import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  User as UserIcon,
  IdCard,
  MapPin,
  StickyNote,
  Sparkles,
  Users,
  Plane,
  Pencil,
  Plus,
  Cake,
  Globe2,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  fetchClientById,
  fetchLeadsByClient,
  
  deleteClient,
} from "@/lib/services";
import type { Client, Lead, LeadStatus } from "@/lib/types";
import { LeadDetailDrawer } from "@/components/LeadDetailDrawer";
import { NewLeadModal } from "@/routes/_app.leads";
import { extractMembers, type ClientMember } from "@/routes/_app.clientes";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/clientes/$id")({
  component: ClientProfilePage,
  head: () => ({
    meta: [
      { title: "Perfil do Viajante" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const LEAD_STATUS_META: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "Novo", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  contacted: { label: "Contatado", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  negotiating: { label: "Em Negociação", cls: "bg-amber-500/20 text-amber-800 dark:text-amber-300" },
  closed: { label: "Fechado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  lost: { label: "Perdido", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

function normalizeWhatsPhone(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12) return "";
  return d;
}
function waLink(phone: string | null | undefined, name: string | null | undefined) {
  const p = normalizeWhatsPhone(phone);
  if (!p) return null;
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const text = encodeURIComponent(`Olá, ${first}! Tudo bem?`);
  return `https://wa.me/${p}?text=${text}`;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ClientProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClientById(id),
  });

  const { data: trips = [] } = useQuery({
    queryKey: ["client-trips", id],
    queryFn: () => fetchLeadsByClient(id),
  });

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openNewProposal, setOpenNewProposal] = useState(false);

  const delMut = useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clientes" });
    },
  });

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando perfil…</div>;
  }
  if (!client) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        <Link to="/clientes" className="text-sm font-semibold text-primary hover:underline">
          Voltar para clientes
        </Link>
      </div>
    );
  }

  const members = extractMembers(client.preferences);
  const wa = waLink(client.whatsapp, client.name);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserIcon}
        title={client.name}
        subtitle="Perfil do Viajante — informações reutilizáveis em todas as viagens"
        actions={
          <>
            <Link
              to="/clientes"
              className="flex items-center justify-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <button
              onClick={() => setOpenNewProposal(true)}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nova proposta
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Mais opções"
                  className="rounded-md border border-input p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={() =>
                    navigate({ to: "/clientes", search: { edit: client.id } as never })
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" /> Editar cadastro
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={async () => {
                    const ok = await confirm({
                      title: "Remover cliente?",
                      description: `Deseja remover ${client.name}? As viagens vinculadas serão desvinculadas.`,
                      confirmLabel: "Remover",
                      destructive: true,
                    });
                    if (ok) delMut.mutate();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contato */}
        <Card icon={UserIcon} title="Contato">
          <InfoRow icon={Mail} label="E-mail">
            {client.email ? (
              <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                {client.email}
              </a>
            ) : "—"}
          </InfoRow>
          <InfoRow icon={Phone} label="Telefone">{client.phone || "—"}</InfoRow>
          <InfoRow icon={MessageCircle} label="WhatsApp">
            {client.whatsapp ? (
              wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {client.whatsapp}
                </a>
              ) : client.whatsapp
            ) : "—"}
          </InfoRow>
          <InfoRow icon={Cake} label="Nascimento">{fmtDate(client.birth_date)}</InfoRow>
        </Card>

        {/* Documentos */}
        <Card icon={IdCard} title="Documentos">
          <InfoRow label="CPF">{client.cpf || "—"}</InfoRow>
          <InfoRow label="Passaporte">{client.passport_number || "—"}</InfoRow>
          <InfoRow icon={Globe2} label="País emissor">{client.passport_country || "—"}</InfoRow>
          <InfoRow label="Validade">{fmtDate(client.passport_expiry)}</InfoRow>
        </Card>

        {/* Endereço */}
        <Card icon={MapPin} title="Endereço">
          {(() => {
            const line1 = [client.address_street, client.address_number]
              .filter(Boolean)
              .join(", ");
            const line2 = [client.address_neighborhood, client.address_complement]
              .filter(Boolean)
              .join(" • ");
            const line3 = [
              [client.address_city, client.address_state].filter(Boolean).join(" - "),
              client.address_zip,
            ]
              .filter(Boolean)
              .join(" · ");
            const hasAny = line1 || line2 || line3 || client.address_country;
            if (!hasAny) return <p className="text-sm text-muted-foreground">Endereço não cadastrado.</p>;
            return (
              <div className="space-y-1 text-sm">
                {line1 && <div>{line1}</div>}
                {line2 && <div className="text-muted-foreground">{line2}</div>}
                {line3 && <div className="text-muted-foreground">{line3}</div>}
                {client.address_country && <div className="text-muted-foreground">{client.address_country}</div>}
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Viagens */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Viagens</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {trips.length}
            </span>
          </div>
          <button
            onClick={() => setOpenNewProposal(true)}
            className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Nova
          </button>
        </div>
        {trips.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma viagem registrada.
          </p>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
            {trips.map((t: Lead) => {
              const meta = LEAD_STATUS_META[t.status] ?? { label: t.status, cls: "bg-muted" };
              const start = (t as unknown as { travel_start_date?: string | null }).travel_start_date;
              const end = (t as unknown as { travel_end_date?: string | null }).travel_end_date;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenLeadId(t.id)}
                  className="group flex min-h-[120px] w-[240px] shrink-0 snap-start flex-col justify-between gap-2 rounded-xl border border-border bg-background p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[260px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Plane className="h-4 w-4" />
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.name || "Viagem sem título"}</div>
                    {t.destination && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{t.destination}</span>
                      </div>
                    )}
                    {(start || end) && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {fmtDate(start)}{end ? ` — ${fmtDate(end)}` : ""}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Membros */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Membros da viagem</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {members.length}
          </span>
        </div>
        {members.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum membro cadastrado.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {members.map((m: ClientMember) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.name}</div>
                  {m.relationship && (
                    <div className="truncate text-xs text-muted-foreground">{m.relationship}</div>
                  )}
                </div>
                {m.client_id && (
                  <Link
                    to="/clientes/$id"
                    params={{ id: m.client_id }}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    Abrir
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Preferências */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Preferências base</h2>
        </div>
        <PreferencesView prefs={client.preferences} />
      </section>

      {/* Notas */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Observações</h2>
        </div>
        {client.notes?.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{client.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
        )}
      </section>

      {openLeadId && (
        <LeadDetailDrawer
          leadId={openLeadId}
          onClose={() => {
            setOpenLeadId(null);
            qc.invalidateQueries({ queryKey: ["client-trips", id] });
          }}
        />
      )}

      {openNewProposal && (
        <NewLeadModal
          onClose={() => setOpenNewProposal(false)}
          onCreated={() => {
            setOpenNewProposal(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
            qc.invalidateQueries({ queryKey: ["client-trips", id] });
          }}
          clientId={client.id}
          initialForm={{
            name: client.name || "",
            email: client.email || "",
            phone: client.phone || "",
          }}
        />
      )}

    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="min-w-0 text-right text-sm">{children}</div>
    </div>
  );
}

function PreferencesView({ prefs }: { prefs: unknown }) {
  if (!prefs || typeof prefs !== "object") {
    return <p className="text-sm text-muted-foreground">Nenhuma preferência cadastrada.</p>;
  }
  const src = prefs as Record<string, unknown>;
  const { members: _m, ...rest } = src;
  const entries = Object.entries(rest);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma preferência cadastrada.</p>;
  }
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-border bg-background px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 break-words text-sm">
            {typeof v === "string" || typeof v === "number" || typeof v === "boolean"
              ? String(v)
              : (
                <code className="text-xs">{JSON.stringify(v)}</code>
              )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
