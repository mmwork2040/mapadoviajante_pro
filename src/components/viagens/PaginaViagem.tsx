// Página da viagem: topo com foto, situação e card de embarque, e as abas
// Checklist, Financeiro, Documentos e Guia. A aba Roteiro continua sendo o
// editor de dias da própria rota (_app.roteiros.$id.tsx).
import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft, BookOpen, CheckCircle, Copy, DownloadSimple, File, FilePdf, LinkSimple, PaperPlaneTilt, UploadSimple, WhatsappLogo,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, Chip, Empty, Janela, PhotoHero, Skeleton } from "@/components/ds";
import { ChecklistTab, FinanceiroTab } from "@/components/LeadDetailDrawer";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { TOM_SITUACAO, montarPreparacao, pctChecklist, type ViagemPrep } from "@/data/preparacao";
import { whatsappLink } from "@/data/viagens";
import { DOCUMENT_CATEGORIES, fetchItineraryDocuments, fetchLeadDocuments, uploadLeadDocument, type LeadDocument } from "@/lib/lead-documents";
import { fetchLeadById, fetchTasks, getMemberRole, updateLead } from "@/lib/services";
import type { Itinerary, Lead } from "@/lib/types";

export type CompartilharModo = "copiar" | "abrir" | "whatsapp";

/** Resumo da viagem para o topo (mesma regra da lista de preparação). */
export function useResumoViagem(it: Itinerary | null | undefined, viagem: Lead | null | undefined): ViagemPrep | null {
  const { data: tarefas = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  if (!it) return null;
  return montarPreparacao([it], new Map(viagem ? [[viagem.id, viagem]] : []), tarefas)[0] ?? null;
}

export function TopoViagem({ it, viagem, resumo, capa, voltar, clientId, acoes, pdf, compartilhando, onCompartilhar }: {
  it: Itinerary;
  viagem?: Lead | null;
  resumo: ViagemPrep | null;
  capa?: string | null;
  voltar: string;
  clientId?: string | null;
  acoes: ReactNode;
  pdf: ReactNode;
  compartilhando: boolean;
  onCompartilhar: (modo: CompartilharModo) => void;
}) {
  const [enviar, setEnviar] = useState(false);
  const noites = it.start_date && it.end_date ? Math.max(0, Math.round((new Date(`${it.end_date.slice(0, 10)}T12:00:00`).getTime() - new Date(`${it.start_date.slice(0, 10)}T12:00:00`).getTime()) / 86_400_000)) : null;
  const linha = [resumo?.quem, resumo?.datas, noites ? `${noites} ${noites === 1 ? "noite" : "noites"}` : null, resumo ? `${resumo.pessoas} ${resumo.pessoas === 1 ? "pessoa" : "pessoas"}` : null].filter(Boolean).join(" · ");
  const p = resumo ? pctChecklist(resumo) : 0;
  const faltam = resumo?.checklist ? resumo.checklist.total - resumo.checklist.feitos : null;
  const telefone = viagem?.phone;

  return (
    <>
      <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Link to={voltar as "/roteiros"} className="ds-link"><ArrowLeft aria-hidden /> Viagens</Link>
        <div className="ds-row" style={{ gap: 8, flexWrap: "wrap" }}>{acoes}</div>
      </div>

      <PhotoHero
        image={capa}
        alt={it.destination || ""}
        minHeight={360}
        aside={
          <div className="ds-stack" style={{ gap: 14, minWidth: 260 }}>
            <span className="ds-mono">{resumo?.fase === "agora" ? "Em viagem" : resumo?.fase === "feita" ? "Viagem concluída" : "Embarque"}</span>
            <div className="ds-row" style={{ alignItems: "baseline", gap: 6 }}>
              {resumo?.fase === "agora" ? (
                <b style={{ font: "700 26px var(--font-display)" }}>{resumo.diaDaViagem}</b>
              ) : resumo?.dias !== null && resumo?.dias !== undefined ? (
                <><b style={{ font: "700 44px/1 var(--font-display)" }}>{resumo.dias}</b><span className="ds-muted">{resumo.dias === 1 ? "dia para embarcar" : "dias para embarcar"}</span></>
              ) : (
                <span className="ds-muted">{resumo?.fase === "feita" ? "Já voltou" : "Datas a definir"}</span>
              )}
            </div>
            {resumo?.checklist ? (
              <div className="ds-stack" style={{ gap: 6 }}>
                <span className={`ds-bar${p === 100 ? " ds-ok" : ""}`}><i style={{ width: `${p}%` }} /></span>
                <small className="ds-muted">{faltam === 0 ? "Checklist completo" : `Faltam ${faltam} ${faltam === 1 ? "item" : "itens"} do checklist`}</small>
              </div>
            ) : (
              <small className="ds-muted">Sem checklist ainda</small>
            )}
            <div className="ds-row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Button variant="primary" icon={<PaperPlaneTilt aria-hidden />} onClick={() => setEnviar(true)}>Enviar ao cliente</Button>
              {pdf}
            </div>
          </div>
        }
      >
        {resumo && <span><Chip tone={TOM_SITUACAO(resumo.situacao)}>{resumo.situacao}</Chip></span>}
        <h1 className="ds-h1">{it.destination || it.title}</h1>
        <p style={{ margin: 0, color: "#e7e1da" }}>{linha}</p>
        {clientId && (
          <Link to="/clientes" search={{ p: clientId }} className="ds-link" style={{ color: "#fafaf9" }}>Ver os viajantes</Link>
        )}
        {resumo?.alerta && <span style={{ color: "#ffb4a8", fontSize: 13.5 }}>{resumo.alerta}</span>}
      </PhotoHero>

      <Janela
        open={enviar}
        onOpenChange={setEnviar}
        eyebrow="Enviar ao cliente"
        title="Página da viagem para o cliente"
        description="Um link sem senha que sempre mostra a versão mais nova do roteiro. Quem tiver o link consegue ver; mande só para os viajantes."
      >
        <div className="ds-stack" style={{ gap: 10 }}>
          <Button icon={<Copy aria-hidden />} loading={compartilhando} onClick={() => onCompartilhar("copiar")}>Copiar link</Button>
          <Button icon={<WhatsappLogo aria-hidden />} disabled={!whatsappLink(telefone)} onClick={() => onCompartilhar("whatsapp")}>
            {whatsappLink(telefone) ? "Mandar pelo WhatsApp" : "WhatsApp (sem telefone na viagem)"}
          </Button>
          <Button icon={<LinkSimple aria-hidden />} onClick={() => onCompartilhar("abrir")}>Ver como o cliente vê</Button>
        </div>
      </Janela>
    </>
  );
}

// ── Abas ligadas à viagem comercial ───────────────────────────────
function useViagemDaAba(leadId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["lead", leadId], queryFn: () => fetchLeadById(leadId!), enabled: !!leadId });
  const salvar = useMutation({
    mutationFn: async (u: Partial<Lead>) => { if (!(await updateLead(leadId!, u))) throw new Error("falhou"); },
    onSuccess: () => { for (const k of [["lead", leadId], ["leads"], ["itinerary-lead", leadId]]) qc.invalidateQueries({ queryKey: k }); },
    onError: () => toast.error("Não foi possível salvar."),
  });
  return { viagem: q.data, carregando: q.isLoading, salvar: (u: Partial<Lead>) => salvar.mutate(u) };
}

const SemViagem = () => (
  <Empty title="Roteiro sem viagem ligada">Este roteiro foi criado antes da viagem única. Checklist e financeiro ficam na viagem comercial; crie a viagem pela ficha em Viagens · Comercial.</Empty>
);

export function AbaChecklist({ leadId }: { leadId: string | null }) {
  const { viagem, carregando, salvar } = useViagemDaAba(leadId);
  if (!leadId) return <SemViagem />;
  if (carregando || !viagem) return <Skeleton height={200} radius={18} />;
  return <ChecklistTab leadId={leadId} checklists={viagem.checklists as unknown} onSave={(c) => salvar({ checklists: c as unknown as Record<string, unknown> })} />;
}

export function AbaFinanceiro({ leadId }: { leadId: string | null }) {
  const { viagem, carregando, salvar } = useViagemDaAba(leadId);
  if (!leadId) return <SemViagem />;
  if (carregando || !viagem) return <Skeleton height={200} radius={18} />;
  return <FinanceiroTab lead={viagem} isAdmin={["admin", "gerente"].includes(getMemberRole() ?? "")} onUpdate={salvar} />;
}

const nomeCategoria = (c?: string | null) => DOCUMENT_CATEGORIES.find((x) => x.value === c)?.label ?? "Documento";

export function AbaDocumentos({ it }: { it: Itinerary }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const [aberto, setAberto] = useState<LeadDocument | null>(null);
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["trip-docs", it.id, it.lead_id],
    queryFn: async () => {
      const [a, b] = await Promise.all([fetchItineraryDocuments(it.id), it.lead_id ? fetchLeadDocuments(it.lead_id) : Promise.resolve([])]);
      return [...new Map([...a, ...b].map((d) => [d.id, d])).values()];
    },
  });
  const enviar = useMutation({
    mutationFn: async (files: File[]) => {
      let ok = 0;
      for (const file of files) if (await uploadLeadDocument({ file, agencyId: it.agency_id, leadId: it.lead_id ?? null, itineraryId: it.id })) ok++;
      if (!ok) throw new Error("falhou");
      return ok;
    },
    onSuccess: (n) => { toast(`${n} ${n === 1 ? "arquivo enviado" : "arquivos enviados"}`); qc.invalidateQueries({ queryKey: ["trip-docs", it.id] }); },
    onError: () => toast.error("Não foi possível enviar. Arquivos até 30 MB."),
  });

  return (
    <div className="ds-stack" style={{ gap: 18 }}>
      {isLoading ? <Skeleton height={120} radius={16} /> : docs.length ? (
        <div>
          {docs.map((d) => (
            <button key={d.id} type="button" className="ds-trip" onClick={() => setAberto(d)}>
              <span className="ds-trip-img">{d.mime_type === "application/pdf" ? <FilePdf aria-hidden /> : <File aria-hidden />}</span>
              <div><b>{d.name}</b><span>{nomeCategoria(d.category)}{d.size ? ` · ${(d.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : ""}</span></div>
              <div className="ds-trip-d"><DownloadSimple aria-label="Abrir" /></div>
            </button>
          ))}
        </div>
      ) : (
        <p className="ds-muted" style={{ margin: 0 }}>Nenhum documento ainda. Vouchers, passagens e seguros ficam aqui e no guia do cliente.</p>
      )}
      <div
        className={`ds-col-vazia${sobre ? " ds-over" : ""}`}
        style={{ minHeight: 120, cursor: "pointer", borderColor: sobre ? "var(--accent-line)" : undefined }}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); const f = [...e.dataTransfer.files]; if (f.length) enviar.mutate(f); }}
      >
        <span className="ds-stack" style={{ gap: 6, alignItems: "center" }}>
          <UploadSimple size={22} aria-hidden />
          {enviar.isPending ? "Enviando…" : "Solte arquivos aqui ou clique para escolher"}
        </span>
      </div>
      <input ref={input} type="file" multiple hidden accept="application/pdf,image/*" onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) enviar.mutate(f); e.target.value = ""; }} />
      <DocumentPreviewModal doc={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

export function AbaGuia({ onCompartilhar, pdf }: { onCompartilhar: (m: CompartilharModo) => void; pdf: ReactNode }) {
  const partes = ["Roteiro dia a dia, com horários e endereços", "Voos e reservas, com os códigos", "Dicas da agência para o destino", "Antes de embarcar: documentos, malas e horários", "Contatos de emergência e da agência"];
  return (
    <div className="ds-stack" style={{ gap: 18, maxWidth: 680 }}>
      <div className="ds-stack" style={{ gap: 8 }}>
        <span className="ds-mono">O que o guia do cliente terá</span>
        {partes.map((p) => <span key={p} className="ds-row" style={{ gap: 8 }}><CheckCircle weight="fill" style={{ color: "var(--success)" }} aria-hidden /> {p}</span>)}
      </div>
      <p className="ds-muted" style={{ margin: 0 }}>
        Hoje o cliente já recebe a página da viagem (sempre atualizada) e o PDF do roteiro. A geração do guia completo com a skill de guias, com revisão antes de enviar, chega na etapa de IA.
      </p>
      <div className="ds-row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Button icon={<BookOpen aria-hidden />} onClick={() => onCompartilhar("abrir")}>Ver a página do cliente</Button>
        {pdf}
      </div>
    </div>
  );
}
