import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
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
  Calendar,
  ChevronDown,
  FileText,
  FolderOpen,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  fetchClientById,
  fetchLeadsByClient,
  fetchItineraries,
  deleteClient,
} from "@/lib/services";
import type { Client, Itinerary, Lead, LeadStatus } from "@/lib/types";
import { LeadDetailDrawer } from "@/components/LeadDetailDrawer";
import { NewLeadModal } from "@/routes/_app.leads";
import { extractMembers, type ClientMember } from "@/routes/_app.clientes";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDate, initials } from "@/lib/ui";
import { useResolvedImageUrl } from "@/hooks/useResolvedImageUrl";
import itineraryPlaceholder from "@/assets/itinerary-placeholder.jpg";
import { supabase } from "@/integrations/supabase/client";
import { isImageDoc, isLinkDoc, type LeadDocument } from "@/lib/lead-documents";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
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

  const tripIds = trips.map((t) => t.id);
  const { data: itineraries = [] } = useQuery({
    queryKey: ["client-itineraries", id, tripIds.join(",")],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const all = await fetchItineraries();
      const set = new Set(tripIds);
      return all.filter((it) => it.lead_id && set.has(it.lead_id));
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", id, tripIds.join(",")],
    enabled: tripIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (
        supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
      )
        .from("crm_lead_documents")
        .select("*")
        .in("lead_id", tripIds)
        .order("created_at", { ascending: false });
      if (error) return [] as LeadDocument[];
      return (data as unknown as LeadDocument[]) || [];
    },
  });

  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openNewProposal, setOpenNewProposal] = useState(false);
  const [tab, setTab] = useState<"viagens" | "documentos">("viagens");
  const [previewDoc, setPreviewDoc] = useState<LeadDocument | null>(null);

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
    <div className="space-y-4">
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

      <Collapsible icon={UserIcon} title="Contato">
        <div className="space-y-2">
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
        </div>
      </Collapsible>

      <Collapsible icon={IdCard} title="Documentos pessoais">
        <div className="space-y-2">
          <InfoRow label="CPF">{client.cpf || "—"}</InfoRow>
          <InfoRow label="Passaporte">{client.passport_number || "—"}</InfoRow>
          <InfoRow icon={Globe2} label="País emissor">{client.passport_country || "—"}</InfoRow>
          <InfoRow label="Validade">{fmtDate(client.passport_expiry)}</InfoRow>
        </div>
      </Collapsible>

      <Collapsible icon={MapPin} title="Endereço">
        {(() => {
          const line1 = [client.address_street, client.address_number].filter(Boolean).join(", ");
          const line2 = [client.address_neighborhood, client.address_complement].filter(Boolean).join(" • ");
          const line3 = [
            [client.address_city, client.address_state].filter(Boolean).join(" - "),
            client.address_zip,
          ].filter(Boolean).join(" · ");
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
      </Collapsible>

      <Collapsible icon={Users} title="Membros da viagem" badge={members.length}>
        {members.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum membro cadastrado.
          </p>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
            {members.map((m: ClientMember) => (
              <div
                key={m.id}
                className="flex w-[220px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-border bg-background p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[240px]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials(m.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.name}</div>
                    {m.relationship && (
                      <div className="truncate text-xs text-muted-foreground">{m.relationship}</div>
                    )}
                  </div>
                </div>
                {m.client_id ? (
                  <Link
                    to="/clientes/$id"
                    params={{ id: m.client_id }}
                    className="mt-auto inline-flex items-center justify-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-semibold text-primary hover:bg-muted"
                  >
                    Abrir perfil
                  </Link>
                ) : (
                  <span className="mt-auto inline-flex items-center justify-center rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    Sem cadastro
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Collapsible>

      <Collapsible icon={Sparkles} title="Preferências base">
        <PreferencesView prefs={client.preferences} />
      </Collapsible>

      <Collapsible icon={StickyNote} title="Observações">
        {client.notes?.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{client.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
        )}
      </Collapsible>

      {/* Última sessão: Viagens + Documentos em abas */}
      <Collapsible icon={FolderOpen} title="Histórico do cliente" defaultOpen>
        <div className="mb-3 -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1">
          <TabPill active={tab === "viagens"} onClick={() => setTab("viagens")} icon={Plane}>
            Viagens
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {itineraries.length || trips.length}
            </span>
          </TabPill>
          <TabPill active={tab === "documentos"} onClick={() => setTab("documentos")} icon={FileText}>
            Documentos
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {documents.length}
            </span>
          </TabPill>
        </div>

        {tab === "viagens" ? (
          <TripsCarousel
            itineraries={itineraries}
            trips={trips}
            clientId={client.id}
            onOpenLead={(lid) => setOpenLeadId(lid)}
            onNew={() => setOpenNewProposal(true)}
          />
        ) : (
          <DocumentsCarousel documents={documents} onPreview={setPreviewDoc} />
        )}
      </Collapsible>

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

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}

function Collapsible({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {typeof badge === "number" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function TabPill({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function TripsCarousel({
  itineraries,
  trips,
  onOpenLead,
  onNew,
}: {
  itineraries: Itinerary[];
  trips: Lead[];
  onOpenLead: (id: string) => void;
  onNew: () => void;
}) {
  if (itineraries.length === 0 && trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="text-sm text-muted-foreground">Nenhuma viagem registrada.</p>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> Nova proposta
        </button>
      </div>
    );
  }
  if (itineraries.length > 0) {
    return (
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {itineraries.map((it) => (
          <Link
            key={it.id}
            to="/roteiros/$id"
            params={{ id: it.id }}
            search={{ from: `/clientes/${client.id}` } as any}
            className="group flex w-[280px] shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-background shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[300px]"
          >
            <div className="relative flex w-24 shrink-0 flex-col justify-end overflow-hidden bg-muted/60 p-3">
              {it.cover_image ? (
                <CoverImage value={it.cover_image} alt={it.destination || "Destino"} />
              ) : (
                <img
                  src={itineraryPlaceholder}
                  alt="Destino sem imagem"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="relative flex items-center gap-1 text-xs font-bold text-white">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{it.destination || "—"}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                  {initials(it.client_name || it.title)}
                </span>
                <span className="truncate text-sm font-semibold">{it.client_name || it.title}</span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {it.start_date ? formatDate(it.start_date) : "—"}
                    {it.end_date ? ` – ${formatDate(it.end_date)}` : ""}
                  </span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  {it.passengers || 1} {(it.passengers || 1) > 1 ? "viajantes" : "viajante"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  }
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
      {trips.map((t) => {
        const meta = LEAD_STATUS_META[t.status] ?? { label: t.status, cls: "bg-muted" };
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenLead(t.id)}
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
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DocumentsCarousel({
  documents,
  onPreview,
}: {
  documents: LeadDocument[];
  onPreview: (d: LeadDocument) => void;
}) {
  if (documents.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum documento anexado às viagens deste cliente.
      </p>
    );
  }
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
      {documents.map((d) => {
        const link = isLinkDoc(d);
        const img = isImageDoc(d);
        const Icon = link ? Globe2 : img ? FileText : FileText;
        const handleClick = () => {
          if (link) window.open(d.file_path, "_blank", "noopener,noreferrer");
          else onPreview(d);
        };
        return (
          <button
            key={d.id}
            type="button"
            onClick={handleClick}
            className="group flex w-[220px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-border bg-background p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md sm:w-[240px]"
          >
            <div className="flex h-24 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" title={d.name}>{d.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                {d.category && <span className="rounded bg-muted px-1.5 py-0.5">{d.category}</span>}
                {d.created_at && <span>{fmtDate(d.created_at)}</span>}
              </div>
            </div>
          </button>
        );
      })}
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

function CoverImage({ value, alt }: { value: string; alt?: string }) {
  const { url, failed, onError } = useResolvedImageUrl(value);
  if (!url || failed) return null;
  return (
    <>
      <img
        src={url}
        alt=""
        aria-hidden
        loading="lazy"
        onError={onError}
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl opacity-60"
      />
      <img
        src={url}
        alt={alt || "Imagem do destino"}
        loading="lazy"
        onError={onError}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </>
  );
}

// keep Client type referenced for TS consumers of this file
export type { Client };
