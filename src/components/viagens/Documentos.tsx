// Orçamento, contrato e pagamento da viagem, dentro da ficha.
// As etapas comerciais continuam mudando só à mão; aqui ficam os documentos e
// o cartão "O que falta", que aponta o próximo documento com o botão certo.
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CurrencyCircleDollar,
  FilePdf,
  FileText,
  Paperclip,
  Plus,
  Trash,
  Warning,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Chip,
  Field,
  HighlightCard,
  JourneySteps,
  KpiRow,
  TextField,
  type JourneyStep,
} from "@/components/ds";
import { dinheiro, dinheiroCurto, diaMes, valorDe, whatsappLink, type Etapa } from "@/data/viagens";
import {
  faltasNoCliente,
  lerContrato,
  lerOrcamento,
  lerPagamento,
  novoItem,
  temOrcamento,
  totalOrcamento,
  validadePadrao,
  type ItemOrcamento,
} from "@/data/documentos";
import { createLeadActivity, getAgencyId, updateLead } from "@/lib/services";
import {
  fetchLeadDocuments,
  getDocumentUrl,
  uploadLeadDocument,
  type LeadDocument,
} from "@/lib/lead-documents";
import type { Client, Lead } from "@/lib/types";

const hojeISO = () => new Date().toISOString().slice(0, 10);
const agoraISO = () => new Date().toISOString();

/** "1.234,56" ou "1234.56" → 1234.56 */
function lerValor(txt: string): number {
  const limpo = txt.replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? n : 0;
}
const valorTexto = (n: number) =>
  n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

/**
 * Abre o documento em outra aba. A aba abre já no clique (senão o navegador
 * bloqueia) e só recebe o endereço depois que `antes` termina de salvar.
 */
async function abrirDocumento(
  tipo: "orcamento" | "contrato",
  leadId: string,
  antes?: () => Promise<unknown>,
) {
  const aba = window.open("about:blank", "_blank");
  try {
    if (antes) await antes();
  } catch {
    aba?.close();
    return;
  }
  const url = `/documento/${tipo}/${leadId}`;
  if (aba) aba.location.href = url;
  else window.location.href = url;
}

// ── Etapas da venda e o que falta ──────────────────────────────────
export type AbaDoc = "orc" | "contrato";

function jornadaDaVenda(v: Lead, temRoteiro: boolean): JourneyStep[] {
  const orc = lerOrcamento(v);
  const con = lerContrato(v);
  const pag = lerPagamento(v);
  const montado = temOrcamento(orc);
  return [
    {
      title: "Orçamento",
      state: orc.enviado_em ? "done" : montado ? "current" : "todo",
      note: orc.enviado_em
        ? `Enviado ${diaMes(orc.enviado_em)}`
        : montado
          ? "Montado, falta enviar"
          : "Ainda não montado",
    },
    {
      title: "Contrato",
      state: con.assinado_em ? "done" : con.gerado_em ? "current" : "todo",
      note: con.assinado_em
        ? `Assinado ${diaMes(con.assinado_em)}`
        : con.gerado_em
          ? "Gerado, falta assinar"
          : "Ainda não gerado",
    },
    {
      title: "Pagamento",
      state: pag.recebido_em ? "done" : con.assinado_em ? "current" : "todo",
      note: pag.recebido_em ? `Recebido ${diaMes(pag.recebido_em)}` : "Ainda não recebido",
    },
    {
      title: "Roteiro e guia",
      state: temRoteiro ? "current" : "todo",
      note: temRoteiro ? "Roteiro em montagem" : "Depois do fechamento",
    },
  ];
}

/** O próximo documento que falta, com o botão que leva até ele. */
export function OQueFalta({
  viagem: v,
  temRoteiro,
  onIr,
  onMover,
}: {
  viagem: Lead;
  temRoteiro: boolean;
  onIr: (aba: AbaDoc) => void;
  onMover: (v: Lead, etapa: Etapa) => void;
}) {
  const orc = lerOrcamento(v);
  const con = lerContrato(v);
  const pag = lerPagamento(v);
  const falta: { texto: string; botao: string; acao: () => void } | null = !temOrcamento(orc)
    ? {
        texto: "Monte o orçamento com os itens e valores da viagem.",
        botao: "Montar orçamento",
        acao: () => onIr("orc"),
      }
    : !orc.enviado_em
      ? {
          texto: "O orçamento está pronto. Gere o PDF e envie ao cliente.",
          botao: "Enviar orçamento",
          acao: () => onIr("orc"),
        }
      : !con.gerado_em
        ? {
            texto: "Cliente de acordo? Gere o contrato já preenchido com os dados dele.",
            botao: "Gerar contrato",
            acao: () => onIr("contrato"),
          }
        : !con.assinado_em
          ? {
              texto: "Quando o cliente devolver assinado, anexe o contrato aqui.",
              botao: "Anexar contrato assinado",
              acao: () => onIr("contrato"),
            }
          : !pag.recebido_em
            ? {
                texto: "Contrato assinado. Registre o pagamento quando ele entrar.",
                botao: "Registrar pagamento",
                acao: () => onIr("contrato"),
              }
            : v.status !== "closed"
              ? {
                  texto: "Orçamento, contrato e pagamento em dia. Pode fechar a viagem.",
                  botao: "Marcar como fechada",
                  acao: () => onMover(v, "closed"),
                }
              : null;

  return (
    <section className="ds-stack" style={{ gap: 10 }}>
      <span className="ds-mono">Orçamento, contrato e pagamento</span>
      <JourneySteps steps={jornadaDaVenda(v, temRoteiro)} />
      {falta && (
        <div className="ds-tip">
          <ArrowRight size={20} aria-hidden />
          <div style={{ flex: 1 }}>
            <b>O que falta</b>
            <br />
            <span className="ds-muted">{falta.texto}</span>
          </div>
          <Button variant="primary" onClick={falta.acao}>
            {falta.botao}
          </Button>
        </div>
      )}
    </section>
  );
}

// ── Orçamento ──────────────────────────────────────────────────────
type Linha = ItemOrcamento & { texto: string };

export function AbaOrcamento({
  viagem: v,
  viajante,
  onSalvo,
}: {
  viagem: Lead;
  viajante: Client | null;
  onSalvo: () => void;
}) {
  const salvo = useMemo(() => lerOrcamento(v), [v]);
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (salvo.itens.length ? salvo.itens : [novoItem()]).map((i) => ({
      ...i,
      texto: valorTexto(i.valor),
    })),
  );
  const [condicoes, setCondicoes] = useState(salvo.condicoes);
  const [validade, setValidade] = useState(salvo.validade || validadePadrao());
  const [observacoes, setObservacoes] = useState(salvo.observacoes);
  const [mudou, setMudou] = useState(false);

  const itens = linhas.map(({ texto, ...i }) => ({
    ...i,
    descricao: i.descricao,
    valor: lerValor(texto),
  }));
  const total = totalOrcamento({ itens });
  const trouxe = Number(v.budget_client) || valorDe(v);

  const mexer = (id: string, campo: "descricao" | "texto", valor: string) => {
    setMudou(true);
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  };

  const salvar = useMutation({
    mutationFn: async (extra?: { enviado_em?: string | null }) => {
      const validos = itens.filter((i) => i.descricao.trim() || i.valor);
      const orcamento = {
        itens: validos,
        condicoes: condicoes.trim(),
        validade,
        observacoes: observacoes.trim(),
        atualizado_em: agoraISO(),
        enviado_em: extra && "enviado_em" in extra ? extra.enviado_em : (salvo.enviado_em ?? null),
      };
      const r = await updateLead(v.id, {
        budget_osv: totalOrcamento(orcamento),
        profile: { orcamento },
      });
      if (!r) throw new Error("falhou");
      return orcamento;
    },
    onSuccess: () => {
      setMudou(false);
      onSalvo();
    },
    onError: () => toast.error("Não foi possível salvar o orçamento. Tente de novo."),
  });

  const gerarPdf = () =>
    abrirDocumento(
      "orcamento",
      v.id,
      mudou || !salvo.atualizado_em ? () => salvar.mutateAsync(undefined) : undefined,
    );

  const marcarEnviado = async (enviado: boolean) => {
    await salvar.mutateAsync({ enviado_em: enviado ? agoraISO() : null });
    if (enviado) {
      await createLeadActivity(v.id, {
        type: "document",
        title: "Orçamento enviado",
        details: `Total de ${dinheiro(total)}`,
      });
      toast("Orçamento marcado como enviado e registrado no histórico");
    } else toast("Envio desfeito");
  };

  const fone = viajante?.whatsapp || viajante?.phone || v.phone || "";
  const mensagem = [
    `Olá, ${(viajante?.name || v.name || "").split(" ")[0]}! Segue o orçamento da sua viagem${v.destination ? ` para ${v.destination}` : ""}:`,
    "",
    ...itens
      .filter((i) => i.descricao.trim())
      .map((i) => `• ${i.descricao.trim()}: ${dinheiro(i.valor)}`),
    "",
    `Total: ${dinheiro(total)}`,
    condicoes.trim() ? `Pagamento: ${condicoes.trim()}` : "",
    validade ? `Válido até ${new Date(`${validade}T12:00:00`).toLocaleDateString("pt-BR")}.` : "",
  ]
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n");
  const wa = whatsappLink(fone);
  const linkWa = wa ? `${wa}?text=${encodeURIComponent(mensagem)}` : null;

  return (
    <div className="ds-stack" style={{ gap: 20 }}>
      <KpiRow
        items={[
          { label: "Cliente trouxe", value: trouxe ? dinheiroCurto(trouxe) : "A definir" },
          {
            label: "Total do orçamento",
            value: total ? dinheiroCurto(total) : "R$ 0",
            delta:
              trouxe && total
                ? total <= trouxe
                  ? { text: "Dentro do orçamento dele", direction: "up" }
                  : { text: `${dinheiroCurto(total - trouxe)} acima`, direction: "down" }
                : undefined,
          },
        ]}
      />

      <section className="ds-stack" style={{ gap: 8 }}>
        <span className="ds-mono">Itens</span>
        {linhas.map((l, n) => (
          <div
            key={l.id}
            className="ds-fld"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 128px 36px",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              aria-label={`Item ${n + 1}`}
              placeholder="Ex.: Aéreo ida e volta, 2 adultos"
              value={l.descricao}
              onChange={(e) => mexer(l.id, "descricao", e.target.value)}
            />
            <input
              aria-label={`Valor do item ${n + 1}`}
              placeholder="0,00"
              inputMode="decimal"
              value={l.texto}
              onChange={(e) => mexer(l.id, "texto", e.target.value)}
              onBlur={() => mexer(l.id, "texto", valorTexto(lerValor(l.texto)))}
              style={{ textAlign: "right" }}
            />
            <button
              type="button"
              className="ds-mini"
              aria-label={`Remover item ${n + 1}`}
              onClick={() => {
                setMudou(true);
                setLinhas((ls) =>
                  ls.length > 1 ? ls.filter((x) => x.id !== l.id) : [{ ...novoItem(), texto: "" }],
                );
              }}
            >
              <Trash aria-hidden />
            </button>
          </div>
        ))}
        <div className="ds-row" style={{ justifyContent: "space-between" }}>
          <Button
            variant="link"
            icon={<Plus weight="bold" aria-hidden />}
            onClick={() => {
              setMudou(true);
              setLinhas((ls) => [...ls, { ...novoItem(), texto: "" }]);
            }}
          >
            Adicionar item
          </Button>
          <b style={{ fontVariantNumeric: "tabular-nums" }}>Total {dinheiro(total)}</b>
        </div>
      </section>

      <TextField
        label="Condições de pagamento"
        rows={2}
        placeholder="Ex.: 30% na reserva e o restante em até 6x no cartão"
        value={condicoes}
        onChange={(e) => {
          setMudou(true);
          setCondicoes(e.target.value);
        }}
      />
      <Field
        label="Válido até"
        type="date"
        value={validade}
        onChange={(e) => {
          setMudou(true);
          setValidade(e.target.value);
        }}
      />
      <TextField
        label="Observações"
        rows={2}
        placeholder="O que está incluso, regras de cancelamento, etc."
        value={observacoes}
        onChange={(e) => {
          setMudou(true);
          setObservacoes(e.target.value);
        }}
      />

      <div className="ds-row" style={{ flexWrap: "wrap" }}>
        <Button
          variant="primary"
          loading={salvar.isPending}
          disabled={!mudou && !!salvo.atualizado_em}
          onClick={() => salvar.mutate(undefined, { onSuccess: () => toast("Orçamento salvo") })}
        >
          {mudou || !salvo.atualizado_em ? "Salvar orçamento" : "Salvo"}
        </Button>
        <Button icon={<FilePdf aria-hidden />} onClick={gerarPdf}>
          Gerar PDF
        </Button>
        {linkWa && (
          <a
            className="ds-btn ds-s"
            href={linkWa}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              if (!salvo.enviado_em) void marcarEnviado(true);
            }}
          >
            <WhatsappLogo aria-hidden /> Enviar pelo WhatsApp
          </a>
        )}
      </div>

      {temOrcamento({ ...salvo, itens }) &&
        (salvo.enviado_em ? (
          <div className="ds-row" style={{ gap: 10 }}>
            <Chip tone="ok" icon={<Check weight="bold" aria-hidden />}>
              Enviado {diaMes(salvo.enviado_em)}
            </Chip>
            <Button variant="link" onClick={() => marcarEnviado(false)}>
              Desfazer
            </Button>
          </div>
        ) : (
          <Button variant="link" onClick={() => marcarEnviado(true)}>
            Já enviei por outro meio: marcar como enviado
          </Button>
        ))}
    </div>
  );
}

// ── Contrato e pagamento ───────────────────────────────────────────
export function AbaContrato({
  viagem: v,
  viajante,
  isAdmin,
  onEditarCliente,
  onIrOrcamento,
  onSalvo,
}: {
  viagem: Lead;
  viajante: Client | null;
  isAdmin: boolean;
  onEditarCliente: () => void;
  onIrOrcamento: () => void;
  onSalvo: () => void;
}) {
  const con = lerContrato(v);
  const pag = lerPagamento(v);
  const orc = lerOrcamento(v);
  const faltas = faltasNoCliente(viajante);
  const arquivo = useRef<HTMLInputElement>(null);
  const [dataPag, setDataPag] = useState(hojeISO());
  const [obsPag, setObsPag] = useState(pag.observacao);

  const docs = useQuery({ queryKey: ["lead-docs", v.id], queryFn: () => fetchLeadDocuments(v.id) });
  const contratos = (docs.data ?? []).filter((d) => d.category === "contrato");

  const salvarContrato = useMutation({
    mutationFn: async (novo: Partial<typeof con>) => {
      const r = await updateLead(v.id, { profile: { contrato: { ...con, ...novo } } });
      if (!r) throw new Error("falhou");
    },
    onSuccess: onSalvo,
    onError: () => toast.error("Não foi possível salvar. Tente de novo."),
  });

  const salvarPagamento = useMutation({
    mutationFn: async (novo: { recebido_em: string | null; observacao: string }) => {
      const r = await updateLead(v.id, { profile: { pagamento: novo } });
      if (!r) throw new Error("falhou");
      if (novo.recebido_em) {
        await createLeadActivity(v.id, {
          type: "document",
          title: "Pagamento recebido",
          details: novo.observacao || "",
        });
      }
    },
    onSuccess: (_r, novo) => {
      toast(novo.recebido_em ? "Pagamento registrado" : "Pagamento desfeito");
      onSalvo();
    },
    onError: () => toast.error("Não foi possível salvar o pagamento."),
  });

  const anexar = useMutation({
    mutationFn: async (file: File) => {
      const agencyId = getAgencyId();
      if (!agencyId) throw new Error("Sem agência ativa. Entre de novo.");
      const doc = await uploadLeadDocument({
        file,
        agencyId,
        leadId: v.id,
        clientId: v.client_id ?? null,
        category: "contrato",
      });
      if (!doc) throw new Error("Não foi possível enviar o arquivo.");
      const r = await updateLead(v.id, {
        profile: {
          contrato: {
            ...con,
            gerado_em: con.gerado_em ?? agoraISO(),
            assinado_em: agoraISO(),
            documento_id: doc.id,
          },
        },
      });
      if (!r) throw new Error("Arquivo enviado, mas não foi possível marcar como assinado.");
      await createLeadActivity(v.id, {
        type: "document",
        title: "Contrato assinado",
        details: file.name,
      });
    },
    onSuccess: () => {
      toast("Contrato assinado anexado");
      docs.refetch();
      onSalvo();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível anexar."),
  });

  const gerar = () =>
    abrirDocumento(
      "contrato",
      v.id,
      con.gerado_em ? undefined : () => salvarContrato.mutateAsync({ gerado_em: agoraISO() }),
    );

  return (
    <div className="ds-stack" style={{ gap: 22 }}>
      {faltas.length > 0 && (
        <Card className="ds-stack" style={{ gap: 8 }}>
          <span className="ds-row" style={{ gap: 8, color: "var(--warning)" }}>
            <Warning weight="fill" aria-hidden />
            <b>Faltam dados do cliente</b>
          </span>
          <span className="ds-muted">
            O contrato usa {faltas.join(", ")}. Sem isso, os campos saem em branco para preencher à
            mão.
          </span>
          <div className="ds-row">
            <Button onClick={onEditarCliente}>Completar dados do cliente</Button>
          </div>
        </Card>
      )}
      {!temOrcamento(orc) && (
        <div className="ds-tip">
          <FileText size={20} aria-hidden />
          <span style={{ flex: 1 }} className="ds-muted">
            O contrato puxa os itens, o total e as condições do orçamento. Monte o orçamento antes.
          </span>
          <Button variant="link" onClick={onIrOrcamento}>
            Ir para o orçamento
          </Button>
        </div>
      )}

      <section className="ds-stack" style={{ gap: 10 }}>
        <span className="ds-mono">1. Gerar o contrato</span>
        <span className="ds-muted">
          Sai preenchido com os dados do cliente, da viagem e do orçamento. Salve o PDF e envie para
          assinatura (gov.br, assinatura digital ou papel).
        </span>
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <Button variant="primary" icon={<FilePdf aria-hidden />} onClick={gerar}>
            {con.gerado_em ? "Gerar de novo" : "Gerar contrato"}
          </Button>
          {con.gerado_em && <Chip tone="info">Gerado {diaMes(con.gerado_em)}</Chip>}
        </div>
        <span className="ds-muted" style={{ fontSize: 12.5 }}>
          {isAdmin ? (
            <>
              O texto do contrato fica em{" "}
              <Link to="/admin" hash="contrato" className="ds-link" style={{ fontSize: 12.5 }}>
                Configurações › Modelo de contrato
              </Link>
              .
            </>
          ) : (
            "O texto do contrato é definido pelo administrador da agência."
          )}
        </span>
      </section>

      <section className="ds-stack" style={{ gap: 10 }}>
        <span className="ds-mono">2. Contrato assinado</span>
        {con.assinado_em ? (
          <div className="ds-row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Chip tone="ok" icon={<Check weight="bold" aria-hidden />}>
              Assinado {diaMes(con.assinado_em)}
            </Chip>
            <Button
              variant="link"
              onClick={() =>
                salvarContrato.mutate(
                  { assinado_em: null, documento_id: null },
                  { onSuccess: () => toast("Assinatura desfeita") },
                )
              }
            >
              Desfazer
            </Button>
          </div>
        ) : (
          <span className="ds-muted">
            Quando o cliente devolver assinado, anexe o arquivo (PDF ou foto).
          </span>
        )}
        {contratos.length > 0 && (
          <ul className="ds-stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
            {contratos.map((d) => (
              <ArquivoContrato key={d.id} doc={d} />
            ))}
          </ul>
        )}
        <input
          ref={arquivo}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) anexar.mutate(f);
          }}
        />
        <div className="ds-row" style={{ flexWrap: "wrap" }}>
          <Button
            icon={<Paperclip aria-hidden />}
            loading={anexar.isPending}
            onClick={() => arquivo.current?.click()}
          >
            {contratos.length ? "Anexar outro arquivo" : "Anexar contrato assinado"}
          </Button>
          {!con.assinado_em && (
            <Button
              variant="link"
              onClick={() =>
                salvarContrato.mutate(
                  { assinado_em: agoraISO() },
                  { onSuccess: () => toast("Contrato marcado como assinado") },
                )
              }
            >
              Marcar como assinado sem anexo
            </Button>
          )}
        </div>
      </section>

      <HighlightCard className="ds-stack" style={{ gap: 10 }}>
        <span className="ds-mono" style={{ color: "var(--accent-foreground)" }}>
          3. Pagamento
        </span>
        {pag.recebido_em ? (
          <>
            <div className="ds-row" style={{ gap: 10, flexWrap: "wrap" }}>
              <Chip tone="ok" icon={<CurrencyCircleDollar aria-hidden />}>
                Recebido {diaMes(pag.recebido_em)}
              </Chip>
              <Button
                variant="link"
                onClick={() =>
                  salvarPagamento.mutate({ recebido_em: null, observacao: pag.observacao })
                }
              >
                Desfazer
              </Button>
            </div>
            {pag.observacao && <span className="ds-muted">{pag.observacao}</span>}
          </>
        ) : (
          <>
            <span className="ds-muted">
              Registre quando o pagamento (ou a entrada) for recebido
              {orc.condicoes ? `. Combinado: ${orc.condicoes}` : ""}.
            </span>
            <div className="ds-row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <Field
                label="Recebido em"
                type="date"
                value={dataPag}
                onChange={(e) => setDataPag(e.target.value)}
              />
              <Field
                label="Observação"
                placeholder="Ex.: entrada de 30% via Pix"
                value={obsPag}
                onChange={(e) => setObsPag(e.target.value)}
              />
            </div>
            <div className="ds-row">
              <Button
                variant="primary"
                loading={salvarPagamento.isPending}
                disabled={!dataPag}
                onClick={() =>
                  salvarPagamento.mutate({ recebido_em: dataPag, observacao: obsPag.trim() })
                }
              >
                Registrar pagamento recebido
              </Button>
            </div>
          </>
        )}
      </HighlightCard>
    </div>
  );
}

function ArquivoContrato({ doc }: { doc: LeadDocument }) {
  const [abrindo, setAbrindo] = useState(false);
  return (
    <li className="ds-row" style={{ gap: 8 }}>
      <FileText aria-hidden />
      <button
        type="button"
        className="ds-link"
        disabled={abrindo}
        onClick={async () => {
          const aba = window.open("about:blank", "_blank");
          setAbrindo(true);
          const url = await getDocumentUrl(doc.file_path);
          setAbrindo(false);
          if (url && aba) aba.location.href = url;
          else {
            aba?.close();
            toast.error("Não foi possível abrir o arquivo.");
          }
        }}
      >
        {doc.name}
      </button>
      {doc.created_at && <span className="ds-muted">· {diaMes(doc.created_at)}</span>}
    </li>
  );
}
