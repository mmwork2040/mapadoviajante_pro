// Viajantes: a base de pessoas da agência, por família ou grupo.
// Enquanto o modelo novo (pessoas e famílias à parte) não existe, cada pessoa
// é um registro de `crm_clients` e a família vive no titular: a lista
// `preferences.members` (quem viaja com ele) e `preferences.household`
// (nome e tipo). Quem está na lista só com o nome aparece como pessoa
// "só com o nome", até alguém completar o cadastro.
import type { Client, Itinerary, Lead } from "@/lib/types";
import { diasAte, estaAberta, parseData, periodoCurto, quandoTexto, situacaoPassaporte } from "./viagens";

export type Membro = { id: string; name: string; relationship: string; client_id?: string | null };
export type TipoFamilia = "Família" | "Casal" | "Grupo";
export type Fase = "neg" | "prep" | "feita";
export const FASE_LABEL: Record<Fase, string> = { neg: "Em negociação", prep: "Em preparação", feita: "Concluída" };
export const FASE_TOM: Record<Fase, "now" | "info" | "neutral"> = { neg: "now", prep: "info", feita: "neutral" };

export const RELACOES = ["Titular", "Cônjuge", "Filha", "Filho", "Mãe", "Pai", "Irmã", "Irmão", "Avó", "Avô", "Noiva", "Noivo", "Amiga", "Amigo", "Organizadora", "Organizador", "Participante", "Outra relação"] as const;

export type ViagemResumo = {
  id: string; // viagem comercial (crm_leads)
  roteiroId?: string; // viagem em preparação (crm_itineraries)
  destino: string;
  quando: string;
  fase: Fase;
  capa?: string | null;
  inicio?: string | null;
};

export type Pessoa = {
  id: string; // id do cadastro, ou "m:<id do membro>" para quem só tem o nome
  client: Client | null;
  nome: string;
  familiaId: string | null;
  rel: string;
  idade: number | null;
  aniversario: string | null; // "28 nov"
  tel: string;
  passaporte: { texto: string; tom: "ok" | "warn" | "bad" };
  viagens: ViagemResumo[];
  agora?: ViagemResumo;
};

export type Familia = {
  id: string; // id do titular
  nome: string;
  tipo: TipoFamilia;
  titularId: string;
  membros: Pessoa[];
  viagens: ViagemResumo[];
  agora?: ViagemResumo;
};

const prefs = (c: Client) => (c.preferences && typeof c.preferences === "object" ? (c.preferences as Record<string, unknown>) : {});

export function membrosDe(c: Client): Membro[] {
  const raw = prefs(c).members;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    if (!m || typeof m !== "object") return [];
    const o = m as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) return [];
    return [{ id: typeof o.id === "string" && o.id ? o.id : name, name, relationship: typeof o.relationship === "string" ? o.relationship : "", client_id: typeof o.client_id === "string" ? o.client_id : null }];
  });
}

function householdDe(c: Client): { name?: string; type?: TipoFamilia } {
  const h = prefs(c).household;
  if (!h || typeof h !== "object") return {};
  const o = h as Record<string, unknown>;
  return { name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : undefined, type: o.type === "Família" || o.type === "Casal" || o.type === "Grupo" ? o.type : undefined };
}

const sobrenome = (n: string) => n.trim().split(/\s+/).slice(-1)[0] ?? "";
const primeiro = (n: string) => n.trim().split(/\s+/)[0] ?? n;

function tipoPorRelacoes(rels: string[]): TipoFamilia {
  const r = rels.map((x) => x.toLowerCase());
  if (r.some((x) => /filh|m[aã]e|pai|irm|av[oóô]|net|sobrinh|tia|tio|primo|prima/.test(x))) return "Família";
  if (r.length === 1 && /c[oô]njuge|espos|marido|noiv|namorad|companheir/.test(r[0])) return "Casal";
  return "Grupo";
}

export function nomeDaFamilia(titular: Client, membros: Membro[], tipo: TipoFamilia): string {
  const h = householdDe(titular);
  if (h.name) return h.name;
  const nomes = [titular.name, ...membros.map((m) => m.name)];
  const sob = sobrenome(titular.name);
  if (tipo === "Família" && sob && nomes.filter((n) => sobrenome(n) === sob).length >= 2) return `Família ${sob}`;
  if (nomes.length <= 3) return nomes.map(primeiro).join(nomes.length === 2 ? " e " : ", ").replace(/, ([^,]*)$/, " e $1");
  return `Grupo de ${primeiro(titular.name)}`;
}

/** Idade a partir de "aaaa-mm-dd" ou "dd/mm/aaaa". */
export function idadeDe(nasc?: string | null): number | null {
  if (!nasc) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(nasc.trim());
  const d = br ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])) : parseData(nasc);
  if (!d || Number.isNaN(d.getTime())) return null;
  const h = new Date();
  let i = h.getFullYear() - d.getFullYear();
  if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) i--;
  return i >= 0 && i < 120 ? i : null;
}

function aniversarioDe(nasc?: string | null): string | null {
  if (!nasc) return null;
  const br = /^(\d{2})\/(\d{2})\/\d{4}$/.exec(nasc.trim());
  const d = br ? new Date(2000, Number(br[2]) - 1, Number(br[1])) : parseData(nasc);
  return d ? `${d.getDate()} ${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}` : null;
}

export function passaporteDe(c: Client | null): Pessoa["passaporte"] {
  if (!c) return { texto: "Não informado", tom: "warn" };
  const s = situacaoPassaporte(c.passport_expiry);
  if (s) return s;
  return c.passport_number ? { texto: "Validade não informada", tom: "warn" } : { texto: "Sem passaporte", tom: "bad" };
}

/** As viagens de cada cadastro (titular da viagem), com a fase de cada uma. */
function viagensPorCliente(viagens: Lead[], roteiros: Itinerary[]): Map<string, ViagemResumo[]> {
  const porLead = new Map<string, Itinerary>();
  for (const r of roteiros) if (r.lead_id && !porLead.has(r.lead_id)) porLead.set(r.lead_id, r);
  const map = new Map<string, ViagemResumo[]>();
  for (const v of viagens) {
    if (!v.client_id || v.archived_at || v.status === "lost") continue;
    const r = porLead.get(v.id);
    let fase: Fase = "neg";
    if (!estaAberta(v)) {
      const fim = diasAte(r?.end_date ?? r?.start_date);
      fase = fim !== null && fim < 0 ? "feita" : "prep";
    }
    const quandoRoteiro = r?.start_date ? `${periodoCurto(r.start_date, r.end_date)} ${parseData(r.start_date)?.getFullYear() ?? ""}`.trim() : "";
    const item: ViagemResumo = { id: v.id, roteiroId: r?.id, destino: v.destination || r?.destination || "Destino a definir", quando: quandoRoteiro || quandoTexto(v) || "Datas a definir", fase, capa: r?.cover_image ?? null, inicio: r?.start_date ?? null };
    map.set(v.client_id, [...(map.get(v.client_id) ?? []), item]);
  }
  const ordem: Record<Fase, number> = { neg: 0, prep: 1, feita: 2 };
  for (const l of map.values()) l.sort((a, b) => ordem[a.fase] - ordem[b.fase] || (parseData(b.inicio)?.getTime() ?? 0) - (parseData(a.inicio)?.getTime() ?? 0));
  return map;
}

const emAndamento = (l: ViagemResumo[]) => l.find((v) => v.fase !== "feita");
const semRepetir = (l: ViagemResumo[]) => [...new Map(l.map((v) => [v.id, v])).values()];

export function montarBase(clientes: Client[], viagens: Lead[], roteiros: Itinerary[]) {
  const porCliente = viagensPorCliente(viagens, roteiros);
  const porId = new Map(clientes.map((c) => [c.id, c]));

  // Famílias: todo titular com pelo menos um acompanhante.
  const familias: Familia[] = [];
  const familiaDe = new Map<string, { familiaId: string; rel: string }>();
  for (const c of clientes) {
    const ms = membrosDe(c);
    if ((!ms.length && !householdDe(c).name) || familiaDe.has(c.id)) continue;
    const tipo = householdDe(c).type ?? tipoPorRelacoes(ms.map((m) => m.relationship));
    familias.push({ id: c.id, nome: nomeDaFamilia(c, ms, tipo), tipo, titularId: c.id, membros: [], viagens: [] });
    familiaDe.set(c.id, { familiaId: c.id, rel: "Titular" });
    for (const m of ms) if (m.client_id && porId.has(m.client_id) && !familiaDe.has(m.client_id)) familiaDe.set(m.client_id, { familiaId: c.id, rel: m.relationship || "Acompanhante" });
  }

  const pessoa = (c: Client | null, extra: { id: string; nome: string; familiaId: string | null; rel: string }): Pessoa => {
    const proprias = c ? porCliente.get(c.id) ?? [] : [];
    return {
      id: extra.id, client: c, nome: extra.nome, familiaId: extra.familiaId, rel: extra.rel,
      idade: idadeDe(c?.birth_date), aniversario: aniversarioDe(c?.birth_date),
      tel: (c?.whatsapp || c?.phone || "").trim(), passaporte: passaporteDe(c), viagens: proprias,
    };
  };

  const pessoas: Pessoa[] = clientes.map((c) => {
    const f = familiaDe.get(c.id);
    return pessoa(c, { id: c.id, nome: c.name, familiaId: f?.familiaId ?? null, rel: f?.rel ?? "Individual" });
  });
  // Acompanhantes que só têm o nome.
  for (const f of familias) {
    for (const m of membrosDe(porId.get(f.titularId)!)) {
      if (m.client_id && porId.has(m.client_id)) continue;
      pessoas.push(pessoa(null, { id: `m:${f.titularId}:${m.id}`, nome: m.name, familiaId: f.id, rel: m.relationship || "Acompanhante" }));
    }
  }

  // A família viaja junta: as viagens do grupo valem para cada pessoa dele.
  for (const f of familias) {
    f.membros = pessoas.filter((p) => p.familiaId === f.id).sort((a, b) => Number(b.id === f.titularId) - Number(a.id === f.titularId));
    f.viagens = semRepetir(f.membros.flatMap((p) => p.viagens));
    f.agora = emAndamento(f.viagens);
    for (const p of f.membros) p.viagens = semRepetir([...p.viagens, ...f.viagens]);
  }
  for (const p of pessoas) p.agora = emAndamento(p.viagens);
  pessoas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const individuais = pessoas.filter((p) => !p.familiaId).length;
  return { pessoas, familias, grupos: familias.length + individuais };
}

export type Filtro = "todos" | "neg" | "breve" | "doc";

/** Documento pendente: passaporte vencido, vencendo ou ausente em quem tem viagem em andamento. */
export const documentoPendente = (p: Pessoa) => !!p.agora && p.passaporte.tom !== "ok";
/** Viaja em breve: viagem em preparação que começa nos próximos 90 dias (ou sem data ainda). */
export const viajaEmBreve = (p: Pessoa) => p.viagens.some((v) => v.fase === "prep" && (() => { const d = diasAte(v.inicio); return d === null || (d >= 0 && d <= 90); })());

export function filtrar(pessoas: Pessoa[], familias: Familia[], busca: string, filtro: Filtro) {
  const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const fam = new Map(familias.map((f) => [f.id, f]));
  return pessoas.filter((p) => {
    if (q) {
      const alvo = [p.nome, fam.get(p.familiaId ?? "")?.nome ?? "", ...p.viagens.map((v) => v.destino)].join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    if (filtro === "neg") return p.viagens.some((v) => v.fase === "neg");
    if (filtro === "breve") return viajaEmBreve(p);
    if (filtro === "doc") return documentoPendente(p);
    return true;
  });
}

export function cpfMascarado(cpf?: string | null): string {
  const d = (cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf ? "Informado" : "";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function preferenciasDe(c: Client | null): string[] {
  if (!c) return [];
  const t = prefs(c).tags;
  return Array.isArray(t) ? t.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
}

/** Grava o acompanhante na família do titular (cria ou atualiza o vínculo). */
export function comMembro(titular: Client, membro: Membro): Record<string, unknown> {
  const p = prefs(titular);
  const lista = membrosDe(titular).filter((m) => m.id !== membro.id);
  return { ...p, members: [...lista, membro] };
}

export function comFamilia(c: Client, nome: string, tipo: TipoFamilia): Record<string, unknown> {
  return { ...prefs(c), household: { name: nome, type: tipo } };
}
