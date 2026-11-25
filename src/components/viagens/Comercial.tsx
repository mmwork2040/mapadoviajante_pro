// Viagens · Comercial: quadro em cinco colunas, lista e a janela de motivo ao perder.
import { useState } from "react";
import { Archive, ArrowCounterClockwise, CalendarBlank, CheckCircle, DotsThree, Trash, Warning, XCircle } from "@phosphor-icons/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, Button, Chip, DataTable, Janela, SelectField, TextField } from "@/components/ds";
import { ETAPAS, diasSemContato, dinheiro, dinheiroCurto, etapaLabel, parseData, valorDe, type Etapa, type ProximoPasso } from "@/data/viagens";
import type { AgencyMember, Lead } from "@/lib/types";

export const MOTIVOS_PERDA = ["Preço acima do esperado", "Fechou com outra agência", "Adiou a viagem", "Não respondeu mais", "Outro"] as const;

export function motivoDaPerda(v: Lead): string | null {
  const m = (v.profile as { lost_reason?: unknown } | undefined)?.lost_reason;
  return typeof m === "string" && m ? m : null;
}

function quandoViaja(v: Lead): string {
  const p = (v.profile ?? {}) as { travel_dates?: unknown; passengers?: unknown };
  const datas = typeof p.travel_dates === "string" ? p.travel_dates : "";
  const pax = Number(p.passengers) || 0;
  return [datas, pax ? `${pax} ${pax === 1 ? "viajante" : "viajantes"}` : ""].filter(Boolean).join(" · ");
}

const dataCurta = (iso?: string | null) => {
  const d = parseData(iso);
  return d ? d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "") : "";
};

export function SemContato({ dias }: { dias: number | null }) {
  if (dias === null || dias < 3) return null;
  return (
    <Chip tone={dias >= 5 ? "bad" : "warn"} icon={dias >= 5 ? <Warning weight="fill" aria-hidden /> : undefined}>
      {dias} dias sem contato
    </Chip>
  );
}

type CardProps = {
  viagem: Lead;
  passo?: ProximoPasso;
  responsavel?: AgencyMember | null;
  viagemCriada: boolean;
  arquivada: boolean;
  arrastando: boolean;
  onAbrir: () => void;
  onMover: (etapa: Etapa) => void;
  onArquivar: () => void;
  onExcluir: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function CartaoViagem({ viagem: v, passo, responsavel, viagemCriada, arquivada, arrastando, onAbrir, onMover, onArquivar, onExcluir, onDragStart, onDragEnd }: CardProps) {
  const aberta = v.status === "new" || v.status === "contacted" || v.status === "negotiating";
  const dias = aberta ? diasSemContato(v) : null;
  const meta = [v.name, quandoViaja(v)].filter(Boolean).join(" · ");
  return (
    <div
      className={`ds-vcard${arrastando ? " ds-drag" : ""}`}
      role="button"
      tabIndex={0}
      draggable
      aria-label={`${v.destination || "Destino a definir"}, ${v.name}, etapa ${etapaLabel(v.status)}`}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", v.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
    >
      <div className="ds-vcard-t">
        <b>{v.destination || "Destino a definir"}</b>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ds-vcard-menu" aria-label={`Mais ações para a viagem de ${v.name}`} onClick={(e) => e.stopPropagation()}>
              <DotsThree size={20} weight="bold" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {ETAPAS.filter((e) => e.id !== v.status).map((e) => (
              <DropdownMenuItem key={e.id} onSelect={() => onMover(e.id)}>
                Mover para {e.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArquivar}>
              {arquivada ? <ArrowCounterClockwise aria-hidden /> : <Archive aria-hidden />} {arquivada ? "Tirar do arquivo" : "Arquivar"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExcluir} className="text-destructive">
              <Trash aria-hidden /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span className={`ds-vcard-v${valorDe(v) ? "" : " ds-nd"}`}>{valorDe(v) ? dinheiro(valorDe(v)) : "Valor a definir"}</span>
      <span className="ds-vcard-m">{meta}</span>

      {v.status === "closed" ? (
        <span className="ds-vcard-p" style={{ color: "var(--success)" }}>
          <CheckCircle weight="fill" aria-hidden /> {viagemCriada ? "Viagem criada" : "Fechada. Falta criar a viagem"}
        </span>
      ) : v.status === "lost" ? (
        <span className="ds-vcard-p ds-nd">
          <XCircle aria-hidden /> {motivoDaPerda(v) || "Motivo não registrado"}
        </span>
      ) : passo ? (
        <span className={`ds-vcard-p${passo.atrasado ? " ds-bad" : ""}`}>
          {passo.atrasado ? <Warning weight="fill" aria-hidden /> : <CalendarBlank aria-hidden />}
          <span>
            {passo.tarefa.title}
            {passo.tarefa.due_date && ` · ${passo.atrasado ? "atrasado desde " : ""}${dataCurta(passo.tarefa.due_date)}`}
          </span>
        </span>
      ) : (
        <span className="ds-vcard-p ds-nd">
          <CalendarBlank aria-hidden /> Sem próximo passo definido
        </span>
      )}

      {(dias !== null && dias >= 3) || responsavel ? (
        <div className="ds-vcard-f">
          <SemContato dias={dias} />
          {responsavel && <Avatar name={responsavel.name} color={responsavel.avatar_color} size="sm" />}
        </div>
      ) : null}
    </div>
  );
}

type QuadroProps = {
  viagens: Lead[];
  passos: Map<string, ProximoPasso>;
  equipe: AgencyMember[];
  comViagemCriada: Record<string, unknown>;
  arquivadas: boolean;
  onAbrir: (id: string) => void;
  onMover: (viagem: Lead, etapa: Etapa) => void;
  onArquivar: (id: string) => void;
  onExcluir: (id: string) => void;
};

export function QuadroComercial({ viagens, passos, equipe, comViagemCriada, arquivadas, onAbrir, onMover, onArquivar, onExcluir }: QuadroProps) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Etapa | null>(null);
  return (
    <div className="ds-quadro">
      {ETAPAS.map((etapa) => {
        const itens = viagens.filter((v) => v.status === etapa.id);
        const total = itens.reduce((s, v) => s + valorDe(v), 0);
        return (
          <section
            key={etapa.id}
            className={`ds-col${etapa.id === "lost" ? " ds-estreita" : ""}`}
            aria-label={`${etapa.label}, ${itens.length} ${itens.length === 1 ? "viagem" : "viagens"}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (sobre !== etapa.id) setSobre(etapa.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || arrastando;
              setSobre(null);
              setArrastando(null);
              const v = viagens.find((x) => x.id === id);
              if (v && v.status !== etapa.id) onMover(v, etapa.id);
            }}
          >
            <header className="ds-col-h">
              <b>{etapa.label}</b>
              <span className="ds-cnt">{itens.length}</span>
              {total > 0 && <small>{dinheiroCurto(total)}</small>}
            </header>
            <div className={`ds-col-b${sobre === etapa.id ? " ds-over" : ""}`}>
              {itens.length === 0 ? (
                <div className="ds-col-vazia">{sobre === etapa.id ? "Solte aqui" : "Arraste uma viagem para cá"}</div>
              ) : (
                itens.map((v) => (
                  <CartaoViagem
                    key={v.id}
                    viagem={v}
                    passo={passos.get(v.id)}
                    responsavel={equipe.find((m) => m.id === v.assigned_to) || null}
                    viagemCriada={Boolean(comViagemCriada[v.id])}
                    arquivada={arquivadas}
                    arrastando={arrastando === v.id}
                    onAbrir={() => onAbrir(v.id)}
                    onMover={(e) => onMover(v, e)}
                    onArquivar={() => onArquivar(v.id)}
                    onExcluir={() => onExcluir(v.id)}
                    onDragStart={() => setArrastando(v.id)}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const ORDEM_ETAPA: Record<string, number> = { new: 0, contacted: 1, negotiating: 2, closed: 3, lost: 4 };

export function ListaComercial({ viagens, passos, onAbrir }: { viagens: Lead[]; passos: Map<string, ProximoPasso>; onAbrir: (id: string) => void }) {
  return (
    <DataTable
      caption="Viagens na fase comercial"
      rows={viagens}
      rowKey={(v) => v.id}
      onRowClick={(v) => onAbrir(v.id)}
      initialSort={{ id: "etapa", dir: "asc" }}
      columns={[
        { id: "quem", header: "Viajante", sortValue: (v) => v.name, cell: (v) => <span className="ds-row" style={{ gap: 10 }}><Avatar name={v.name} size="sm" />{v.name}</span> },
        { id: "destino", header: "Destino e datas", cell: (v) => [v.destination || "A definir", quandoViaja(v)].filter(Boolean).join(" · ") },
        { id: "etapa", header: "Etapa", sortValue: (v) => ORDEM_ETAPA[v.status] ?? 9, cell: (v) => <Chip tone={v.status === "closed" ? "ok" : v.status === "new" ? "now" : "neutral"}>{etapaLabel(v.status)}</Chip> },
        { id: "valor", header: "Valor", numeric: true, sortValue: (v) => valorDe(v) || null, cell: (v) => (valorDe(v) ? dinheiro(valorDe(v)) : "A definir") },
        {
          id: "passo",
          header: "Próximo passo",
          cell: (v) => {
            const p = passos.get(v.id);
            if (v.status === "lost") return motivoDaPerda(v) || "—";
            if (v.status === "closed") return "—";
            if (!p) return <span className="ds-muted">Sem próximo passo</span>;
            return <span style={p.atrasado ? { color: "var(--destructive)" } : undefined}>{p.tarefa.title}{p.tarefa.due_date ? ` · ${dataCurta(p.tarefa.due_date)}` : ""}</span>;
          },
        },
        {
          id: "dias",
          header: "Sem contato",
          numeric: true,
          sortValue: (v) => (v.status === "closed" || v.status === "lost" ? null : diasSemContato(v)),
          cell: (v) => {
            if (v.status === "closed" || v.status === "lost") return "—";
            const d = diasSemContato(v);
            if (d === null) return "—";
            return d >= 3 ? <SemContato dias={d} /> : `${d} ${d === 1 ? "dia" : "dias"}`;
          },
        },
      ]}
    />
  );
}

/** Perder uma viagem pede o motivo. */
export function JanelaPerder({ viagem, onCancelar, onConfirmar, salvando }: { viagem: Lead | null; onCancelar: () => void; onConfirmar: (motivo: string) => void; salvando: boolean }) {
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [tentou, setTentou] = useState(false);
  const final = motivo === "Outro" ? detalhe.trim() : motivo;
  return (
    <Janela
      open={!!viagem}
      onOpenChange={(o) => {
        if (!o) {
          setMotivo(""); setDetalhe(""); setTentou(false);
          onCancelar();
        }
      }}
      title="Marcar como perdida"
      description={viagem ? `${viagem.name} · ${viagem.destination || "destino a definir"}. O motivo ajuda a entender onde as viagens se perdem.` : undefined}
      footer={
        <>
          <Button onClick={onCancelar}>Cancelar</Button>
          <Button
            variant="primary"
            loading={salvando}
            onClick={() => {
              setTentou(true);
              if (final) onConfirmar(final);
            }}
          >
            Marcar como perdida
          </Button>
        </>
      }
    >
      <SelectField label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={tentou && !motivo ? "Escolha o motivo." : undefined}>
        <option value="" disabled>Escolha o motivo</option>
        {MOTIVOS_PERDA.map((m) => <option key={m}>{m}</option>)}
      </SelectField>
      {motivo === "Outro" && (
        <TextField label="Qual foi o motivo?" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} error={tentou && !detalhe.trim() ? "Escreva o motivo." : undefined} />
      )}
    </Janela>
  );
}
