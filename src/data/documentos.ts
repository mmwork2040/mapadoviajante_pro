// Orçamento, contrato e pagamento de uma viagem.
//
// Ficam dentro de `lead.profile` (campos `orcamento`, `contrato` e `pagamento`),
// então não precisam de tabela nova. O modelo do contrato é da agência e fica
// nas configurações (`agency_cfg:{agência}:contrato`).
import type { Client, Lead } from "@/lib/types";
import { campoDoPerfil, dinheiro, passageirosTexto, quandoTexto } from "@/data/viagens";

// ── Orçamento ──────────────────────────────────────────────────────
export type ItemOrcamento = { id: string; descricao: string; valor: number };
export type Orcamento = {
  itens: ItemOrcamento[];
  /** Condições de pagamento, em texto livre ("50% na reserva e 50% em 30 dias"). */
  condicoes: string;
  /** Validade da proposta (AAAA-MM-DD). */
  validade: string;
  observacoes: string;
  atualizado_em?: string | null;
  /** Quando foi marcado como enviado ao cliente. */
  enviado_em?: string | null;
};

const perfil = (v: Lead) => (v.profile ?? {}) as Record<string, unknown>;
const objeto = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
const textoDe = (x: unknown) => (typeof x === "string" ? x : "");

export function novoItem(descricao = "", valor = 0): ItemOrcamento {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, descricao, valor };
}

export function lerOrcamento(v: Lead): Orcamento {
  const o = objeto(perfil(v).orcamento);
  const itens = Array.isArray(o.itens)
    ? (o.itens as unknown[]).map((i) => {
        const it = objeto(i);
        return {
          id: textoDe(it.id) || novoItem().id,
          descricao: textoDe(it.descricao),
          valor: Number(it.valor) || 0,
        };
      })
    : [];
  return {
    itens,
    condicoes: textoDe(o.condicoes),
    validade: textoDe(o.validade),
    observacoes: textoDe(o.observacoes),
    atualizado_em: textoDe(o.atualizado_em) || null,
    enviado_em: textoDe(o.enviado_em) || null,
  };
}

export const totalOrcamento = (o: Pick<Orcamento, "itens">) =>
  o.itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
export const temOrcamento = (o: Orcamento) =>
  o.itens.some((i) => i.descricao.trim() && i.valor > 0);

/** Validade padrão: 7 dias a partir de hoje. */
export function validadePadrao(dias = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ── Contrato e pagamento ───────────────────────────────────────────
export type EstadoContrato = {
  gerado_em: string | null;
  assinado_em: string | null;
  documento_id: string | null;
};
export type EstadoPagamento = { recebido_em: string | null; observacao: string };

export function lerContrato(v: Lead): EstadoContrato {
  const c = objeto(perfil(v).contrato);
  return {
    gerado_em: textoDe(c.gerado_em) || null,
    assinado_em: textoDe(c.assinado_em) || null,
    documento_id: textoDe(c.documento_id) || null,
  };
}

export function lerPagamento(v: Lead): EstadoPagamento {
  const p = objeto(perfil(v).pagamento);
  return { recebido_em: textoDe(p.recebido_em) || null, observacao: textoDe(p.observacao) };
}

// ── Modelo de contrato ─────────────────────────────────────────────
/** Campos que o modelo aceita, entre chaves duplas: {{cliente_nome}}. */
export const CAMPOS_CONTRATO: { chave: string; descricao: string }[] = [
  { chave: "agencia", descricao: "Nome da agência" },
  { chave: "agencia_cnpj", descricao: "CNPJ da agência" },
  { chave: "agencia_endereco", descricao: "Endereço da agência" },
  { chave: "agencia_email", descricao: "E-mail da agência" },
  { chave: "agencia_telefone", descricao: "Telefone da agência" },
  { chave: "cliente_nome", descricao: "Nome do cliente" },
  { chave: "cliente_cpf", descricao: "CPF do cliente" },
  { chave: "cliente_rg_passaporte", descricao: "Passaporte do cliente" },
  { chave: "cliente_endereco", descricao: "Endereço completo do cliente" },
  { chave: "cliente_email", descricao: "E-mail do cliente" },
  { chave: "cliente_telefone", descricao: "WhatsApp ou telefone do cliente" },
  { chave: "destino", descricao: "Destino da viagem" },
  { chave: "datas", descricao: "Datas ou período da viagem" },
  { chave: "passageiros", descricao: "Quantidade de viajantes" },
  { chave: "itens", descricao: "Lista dos itens do orçamento, com valores" },
  { chave: "valor_total", descricao: "Valor total do orçamento" },
  { chave: "condicoes_pagamento", descricao: "Condições de pagamento do orçamento" },
  { chave: "cidade", descricao: "Cidade do cliente" },
  { chave: "data_hoje", descricao: "Data de hoje, por extenso" },
];

export const MODELO_CONTRATO_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INTERMEDIAÇÃO E CONSULTORIA DE VIAGEM

CONTRATADA: {{agencia}}, CNPJ {{agencia_cnpj}}, com sede em {{agencia_endereco}}, e-mail {{agencia_email}}, telefone {{agencia_telefone}}.

CONTRATANTE: {{cliente_nome}}, CPF {{cliente_cpf}}, residente em {{cliente_endereco}}, e-mail {{cliente_email}}, telefone {{cliente_telefone}}.

1. OBJETO
1.1. A CONTRATADA prestará ao CONTRATANTE serviços de planejamento, consultoria e intermediação na compra dos serviços turísticos descritos abaixo, para a viagem com destino a {{destino}}, no período de {{datas}}, para {{passageiros}}.

1.2. Serviços contratados:
{{itens}}

2. PREÇO E FORMA DE PAGAMENTO
2.1. O valor total dos serviços é de {{valor_total}}.
2.2. Condições de pagamento: {{condicoes_pagamento}}.
2.3. Valores de passagens, hospedagens e demais serviços de terceiros estão sujeitos à disponibilidade e às regras de cada fornecedor até a efetiva emissão ou reserva.

3. OBRIGAÇÕES DA CONTRATADA
3.1. Prestar informações claras sobre os serviços, documentos de viagem exigidos e regras de cada fornecedor.
3.2. Efetuar as reservas e emissões após a confirmação do pagamento, conforme as condições acima.

4. OBRIGAÇÕES DO CONTRATANTE
4.1. Fornecer dados corretos e completos de todos os viajantes.
4.2. Providenciar passaporte, vistos, vacinas e demais documentos exigidos para a viagem, dentro da validade.
4.3. Efetuar os pagamentos nas datas combinadas.

5. ALTERAÇÕES E CANCELAMENTOS
5.1. Alterações e cancelamentos seguem as regras de cada fornecedor (companhias aéreas, hotéis, operadoras), que podem cobrar multas e taxas, repassadas ao CONTRATANTE.
5.2. Os honorários de consultoria referentes ao serviço já prestado não são reembolsáveis.

6. RESPONSABILIDADES
6.1. A CONTRATADA atua como intermediária e não responde por atrasos, cancelamentos ou falhas na prestação de serviços pelos fornecedores, sem prejuízo de prestar todo o apoio ao CONTRATANTE.

7. FORO
7.1. Fica eleito o foro da comarca de {{cidade}} para dirimir eventuais dúvidas deste contrato.

E, por estarem de acordo, as partes assinam este contrato.

{{cidade}}, {{data_hoje}}.`;

/** Dados da agência usados no contrato (vêm de Configurações › Dados da Agência). */
export type AgenciaContrato = {
  nome: string;
  cnpj?: string;
  endereco?: string;
  email?: string;
  telefone?: string;
};

/** Dados de uma viagem já formatados para os campos do contrato. */
export function dadosDoContrato(
  v: Lead,
  cliente: Client | null,
  agencia: AgenciaContrato,
): Record<string, string> {
  const orc = lerOrcamento(v);
  const itens = orc.itens.filter((i) => i.descricao.trim());
  const endereco = cliente
    ? [
        [cliente.address_street, cliente.address_number].filter(Boolean).join(", "),
        cliente.address_complement,
        cliente.address_neighborhood,
        [cliente.address_city, cliente.address_state].filter(Boolean).join(" - "),
        cliente.address_zip ? `CEP ${cliente.address_zip}` : "",
      ]
        .map((x) => (x ?? "").trim())
        .filter(Boolean)
        .join(", ")
    : "";
  const vazio = "____________________";
  return {
    agencia: agencia.nome || vazio,
    agencia_cnpj: agencia.cnpj || vazio,
    agencia_endereco: agencia.endereco || vazio,
    agencia_email: agencia.email || vazio,
    agencia_telefone: agencia.telefone || vazio,
    cliente_nome: cliente?.name || v.name || vazio,
    cliente_cpf: cliente?.cpf || textoDe(perfil(v).cpf) || vazio,
    cliente_rg_passaporte: cliente?.passport_number || vazio,
    cliente_endereco: endereco || vazio,
    cliente_email: cliente?.email || v.email || vazio,
    cliente_telefone: cliente?.whatsapp || cliente?.phone || v.phone || vazio,
    destino: v.destination || vazio,
    datas: quandoTexto(v) || vazio,
    passageiros: passageirosTexto(v) || vazio,
    itens: itens.length
      ? itens.map((i) => `- ${i.descricao.trim()}: ${dinheiro(i.valor)}`).join("\n")
      : vazio,
    valor_total: itens.length ? dinheiro(totalOrcamento(orc)) : vazio,
    condicoes_pagamento: orc.condicoes.trim() || vazio,
    cidade: cliente?.address_city || campoDoPerfil(v, "departure") || vazio,
    data_hoje: new Date().toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

export function preencherContrato(modelo: string, dados: Record<string, string>): string {
  return modelo.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (todo, chave: string) =>
    chave in dados ? dados[chave] : todo,
  );
}

/** Dados do cliente que o contrato usa e ainda faltam. */
export function faltasNoCliente(cliente: Client | null): string[] {
  if (!cliente) return ["cadastro do viajante"];
  const falta: string[] = [];
  if (!cliente.cpf) falta.push("CPF");
  if (!cliente.address_street || !cliente.address_city) falta.push("endereço");
  if (!cliente.email) falta.push("e-mail");
  return falta;
}
