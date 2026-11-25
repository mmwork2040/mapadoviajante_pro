// Viagem é o registro único, da negociação à volta. Enquanto os dados não
// migram para o modelo novo, a fase comercial vive em `crm_leads` e a
// preparação em `crm_itineraries`. Este arquivo é a única ponte entre esses
// nomes antigos e os termos da interface: as telas falam só em viagem,
// viajante, etapa e próximo passo.
import type { Itinerary, Lead, LeadStatus, Task } from "@/lib/types";

export type Etapa = LeadStatus;

export const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "new", label: "Novo" },
  { id: "contacted", label: "Contatado" },
  { id: "negotiating", label: "Negociando" },
  { id: "closed", label: "Fechado" },
  { id: "lost", label: "Perdido" },
];
export const etapaLabel = (e: string | null | undefined) => ETAPAS.find((x) => x.id === e)?.label ?? "Novo";
export const ABERTAS: Etapa[] = ["new", "contacted", "negotiating"];
export const estaAberta = (v: Lead) => ABERTAS.includes(v.status) && !v.archived_at;

const DIA = 86_400_000;
const inicioDoDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function parseData(value?: string | null): Date | null {
  if (!value) return null;
  // Datas sem hora ("2027-03-01") são do dia local, não de UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dias inteiros desde o último contato registrado. `null` se nunca houve registro. */
export function diasSemContato(v: Lead): number | null {
  const d = parseData(v.last_activity_at || v.created_at);
  return d ? Math.max(0, Math.floor((inicioDoDia() - inicioDoDia(d)) / DIA)) : null;
}

/** Dias que faltam para uma data (negativo = já passou). */
export function diasAte(value?: string | null): number | null {
  const d = parseData(value);
  return d ? Math.round((inicioDoDia(d) - inicioDoDia()) / DIA) : null;
}

export const valorDe = (v: Lead) => Number(v.value) || 0;

/** "R$ 48,3 mil", "R$ 1,2 mi", "R$ 950". Para números de destaque. */
export function dinheiroCurto(n: number): string {
  const f = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (n >= 1_000_000) return `R$ ${f(n / 1_000_000)} mi`;
  if (n >= 1_000) return `R$ ${f(n / 1_000)} mil`;
  return `R$ ${f(n)}`;
}
export const dinheiro = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ── Próximo passo ──────────────────────────────────────────────────
// O próximo passo de uma viagem é a tarefa aberta mais próxima ligada a ela.
export type ProximoPasso = { tarefa: Task; atrasado: boolean; dias: number | null };

export function proximosPassos(tarefas: Task[]): Map<string, ProximoPasso> {
  const map = new Map<string, ProximoPasso>();
  const abertas = tarefas.filter((t) => t.lead_id && !t.completed);
  abertas.sort((a, b) => (parseData(a.due_date)?.getTime() ?? Infinity) - (parseData(b.due_date)?.getTime() ?? Infinity));
  for (const t of abertas) {
    if (map.has(t.lead_id!)) continue;
    const dias = diasAte(t.due_date);
    map.set(t.lead_id!, { tarefa: t, atrasado: dias !== null && dias < 0, dias });
  }
  return map;
}

// ── Agenda ─────────────────────────────────────────────────────────
export type Periodo = "hoje" | "amanha" | "semana";

/** Itens da agenda de um período. "Hoje" inclui o que está atrasado e ainda aberto. */
export function agendaDo(tarefas: Task[], periodo: Periodo): Task[] {
  const hoje = inicioDoDia();
  const naJanela = (t: Task) => {
    const d = parseData(t.due_date);
    if (!d) return false;
    const dia = inicioDoDia(d);
    if (periodo === "hoje") return dia === hoje || (dia < hoje && !t.completed);
    if (periodo === "amanha") return dia === hoje + DIA;
    return dia >= hoje && dia < hoje + 7 * DIA;
  };
  return tarefas.filter(naJanela).sort((a, b) => (parseData(a.due_date)?.getTime() ?? 0) - (parseData(b.due_date)?.getTime() ?? 0));
}

export const estaAtrasada = (t: Task) => {
  const d = parseData(t.due_date);
  return !!d && !t.completed && inicioDoDia(d) < inicioDoDia();
};

// ── Números do mês ─────────────────────────────────────────────────
// A data do fechamento ainda não é gravada à parte: usamos a última
// atualização da viagem fechada, que é quando ela mudou de etapa.
function fechadasEntre(viagens: Lead[], de: number, ate: number) {
  return viagens.filter((v) => {
    if (v.status !== "closed") return false;
    const t = parseData(v.updated_at || v.last_activity_at || v.created_at)?.getTime();
    return t !== undefined && t >= de && t < ate;
  });
}

export function numerosDoMes(viagens: Lead[], roteiros: Itinerary[]) {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
  const inicioAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).getTime();
  const soma = (l: Lead[]) => l.reduce((s, v) => s + valorDe(v), 0);

  const vendido = soma(fechadasEntre(viagens, inicioMes, Infinity));
  const vendidoAnterior = soma(fechadasEntre(viagens, inicioAnterior, inicioMes));
  const variacao = vendidoAnterior > 0 ? Math.round(((vendido - vendidoAnterior) / vendidoAnterior) * 100) : null;

  const ativas = viagens.filter((v) => !v.archived_at);
  const negociando = ativas.filter((v) => v.status === "negotiating");
  const abertas = ativas.filter(estaAberta);

  const d90 = Date.now() - 90 * DIA;
  const criadas90 = ativas.filter((v) => (parseData(v.created_at)?.getTime() ?? 0) >= d90);
  const fechadas90 = criadas90.filter((v) => v.status === "closed").length;
  const conversao = criadas90.length ? Math.round((fechadas90 / criadas90.length) * 100) : null;

  const embarques = proximosEmbarques(roteiros, 60);

  return {
    vendido, variacao, mesAnterior: new Date(inicioAnterior).toLocaleDateString("pt-BR", { month: "long" }),
    mes: agora.toLocaleDateString("pt-BR", { month: "long" }),
    emNegociacao: soma(negociando), negociando: negociando.length, abertas: abertas.length,
    conversao, fechadas90, criadas90: criadas90.length,
    embarques: embarques.length, diasProximo: embarques[0]?.dias ?? null,
  };
}

// ── Funil ──────────────────────────────────────────────────────────
export function funil(viagens: Lead[]) {
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const noMes = (v: Lead) => (parseData(v.updated_at || v.created_at)?.getTime() ?? 0) >= inicioMes;
  const ativas = viagens.filter((v) => !v.archived_at);
  return ETAPAS.map((e) => {
    const doMes = e.id === "closed" || e.id === "lost";
    const lista = ativas.filter((v) => v.status === e.id && (!doMes || noMes(v)));
    return { id: e.id, label: doMes ? `${e.label} no mês` : e.label, count: lista.length, valor: lista.reduce((s, v) => s + valorDe(v), 0), muted: e.id === "lost" };
  });
}

// ── Negociações sem resposta ───────────────────────────────────────
export function semResposta(viagens: Lead[], minimoDias = 3) {
  return viagens
    .filter(estaAberta)
    .map((v) => ({ viagem: v, dias: diasSemContato(v) }))
    .filter((x): x is { viagem: Lead; dias: number } => x.dias !== null && x.dias >= minimoDias)
    .sort((a, b) => b.dias - a.dias);
}

// ── Embarques ──────────────────────────────────────────────────────
export function proximosEmbarques(roteiros: Itinerary[], dentroDeDias: number) {
  return roteiros
    .map((r) => ({ roteiro: r, dias: diasAte(r.start_date) }))
    .filter((x): x is { roteiro: Itinerary; dias: number } => x.dias !== null && x.dias >= 0 && x.dias <= dentroDeDias)
    .sort((a, b) => a.dias - b.dias);
}

/** "1 a 10 mar", "28 fev a 5 mar". Vazio se não houver data de ida. */
export function periodoCurto(ida?: string | null, volta?: string | null): string {
  const a = parseData(ida), b = parseData(volta);
  if (!a) return "";
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  if (!b) return `${a.getDate()} ${mes(a)}`;
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? `${a.getDate()} a ${b.getDate()} ${mes(b)}` : `${a.getDate()} ${mes(a)} a ${b.getDate()} ${mes(b)}`;
}

/** Itens feitos e total do checklist de uma viagem. `null` se ela não tem checklist. */
export function progressoChecklist(raw: unknown): { feitos: number; total: number } | null {
  let c = raw;
  if (typeof c === "string") {
    try { c = JSON.parse(c); } catch { return null; }
  }
  const items = (c as { items?: unknown } | null)?.items;
  if (!items || typeof items !== "object") return null;
  const valores = Object.values(items as Record<string, unknown>);
  if (!valores.length) return null;
  return { feitos: valores.filter(Boolean).length, total: valores.length };
}

// ── Comece por aqui ────────────────────────────────────────────────
export type Foco =
  | { tipo: "passo-atrasado"; viagem: Lead; passo: ProximoPasso }
  | { tipo: "sem-contato"; viagem: Lead; dias: number }
  | { tipo: "nova"; viagem: Lead };

/**
 * O item mais urgente do dia: primeiro o próximo passo atrasado da viagem de
 * maior valor; depois a negociação de maior valor parada há 3 dias ou mais;
 * por fim a viagem nova mais antiga, que ainda não teve contato.
 */
export function comecePorAqui(viagens: Lead[], tarefas: Task[]): Foco | null {
  const abertas = viagens.filter(estaAberta);
  const passos = proximosPassos(tarefas);
  const atrasados = abertas.filter((v) => passos.get(v.id)?.atrasado).sort((a, b) => valorDe(b) - valorDe(a));
  if (atrasados[0]) return { tipo: "passo-atrasado", viagem: atrasados[0], passo: passos.get(atrasados[0].id)! };
  const paradas = semResposta(abertas).sort((a, b) => valorDe(b.viagem) - valorDe(a.viagem));
  if (paradas[0]) return { tipo: "sem-contato", viagem: paradas[0].viagem, dias: paradas[0].dias };
  const novas = abertas.filter((v) => v.status === "new").sort((a, b) => (parseData(a.created_at)?.getTime() ?? 0) - (parseData(b.created_at)?.getTime() ?? 0));
  return novas[0] ? { tipo: "nova", viagem: novas[0] } : null;
}

export function whatsappLink(phone?: string | null): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

// ── Dados da ficha ─────────────────────────────────────────────────
type Perfil = Record<string, unknown>;
const perfil = (v: Lead): Perfil => (v.profile ?? {}) as Perfil;
const texto = (x: unknown) => (typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "");

/** "12 a 24 mar de 2027" quando há datas; senão o texto livre ("julho"). */
export function quandoTexto(v: Lead): string {
  const raw = texto(perfil(v).travel_dates);
  const m = /^(\d{4}-\d{2}-\d{2})\s*a\s*(\d{4}-\d{2}-\d{2})$/.exec(raw) || /^(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (!m) return raw;
  const curto = periodoCurto(m[1], m[2]);
  const ano = parseData(m[2] || m[1])?.getFullYear();
  return ano && ano !== new Date().getFullYear() ? `${curto} de ${ano}` : curto;
}

/** "2 adultos e 1 criança", ou "3 viajantes" quando só há o total. */
export function passageirosTexto(v: Lead): string {
  const p = perfil(v);
  const total = Number(p.passengers) || 0;
  const criancas = Number(p.children) || 0;
  if (!total) return "";
  if (!criancas) return `${total} ${total === 1 ? "viajante" : "viajantes"}`;
  const adultos = Math.max(0, total - criancas);
  return `${adultos} ${adultos === 1 ? "adulto" : "adultos"} e ${criancas} ${criancas === 1 ? "criança" : "crianças"}`;
}

export const ORIGENS = ["Instagram", "Indicação", "WhatsApp", "Site", "Google", "Formulário", "Outro"] as const;
const ORIGEM_LABEL: Record<string, string> = { direto: "Direto", form: "Formulário", formulario: "Formulário", n8n: "Formulário", instagram: "Instagram", whatsapp: "WhatsApp", site: "Site", google: "Google", indicacao: "Indicação", "indicação": "Indicação" };
export const origemTexto = (o?: string | null) => (o ? ORIGEM_LABEL[o.toLowerCase()] ?? o : "");

export const TIPOS_VIAGEM = ["Lazer", "Família", "Lua de mel", "Negócios", "Aventura", "Cruzeiro"] as const;

/** Campo de texto do perfil da viagem (saída, tipo, preferências...). */
export const campoDoPerfil = (v: Lead, chave: string) => texto(perfil(v)[chave]);

/** Situação do passaporte pela validade: vencido, vence em menos de 6 meses ou ok. */
export function situacaoPassaporte(validade?: string | null): { texto: string; tom: "ok" | "warn" | "bad" } | null {
  const d = parseData(validade);
  if (!d) return null;
  const dias = diasAte(validade) ?? 0;
  const mesAno = d.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
  if (dias < 0) return { texto: `Venceu em ${mesAno}`, tom: "bad" };
  if (dias < 183) return { texto: `Vence em ${mesAno}`, tom: "warn" };
  return { texto: `Válido até ${mesAno}`, tom: "ok" };
}

/** Data de quando fazer a partir de "hoje", "amanha", "semana" ou de uma data escolhida. */
export function dataDoPasso(quando: string, data?: string): string {
  if (quando === "data" && data) return data;
  const d = new Date();
  if (quando === "amanha") d.setDate(d.getDate() + 1);
  if (quando === "semana") {
    // Até sexta desta semana; de sexta a sábado, fica para dois dias depois.
    const ate = (5 - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + (ate === 0 || d.getDay() === 6 ? 2 : ate));
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Hoje", "Amanhã", "Ontem", "Venceu há 3 dias", "Sex, 27 nov". */
export function quandoPasso(due?: string | null): string {
  const dias = diasAte(due);
  if (dias === null) return "Sem data";
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias === -1) return "Ontem";
  if (dias < 0) return `Venceu há ${-dias} dias`;
  const d = parseData(due)!;
  const sem = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${diaMes(due)}`;
}

/** "27 nov", ou "27 nov 2027" fora do ano corrente. Sem o "de" do formato longo. */
export function diaMes(iso?: string | null): string {
  const d = parseData(iso);
  if (!d) return "";
  const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${d.getDate()} ${mes}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}
