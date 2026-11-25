// Agenda: tarefas, contatos e datas automáticas num lugar só.
// Tarefas vêm de `crm_tasks`. O tipo (ligação, WhatsApp...) vem da atividade
// ligada à tarefa ou da marca "[tp:...]" na descrição de tarefas sem viagem.
// Datas automáticas (aniversários, passaportes, embarques) não são gravadas:
// são calculadas a partir das pessoas e das viagens.
import type { Client, Itinerary, Lead, Task } from "@/lib/types";
import { diasAte, parseData } from "./viagens";

export type TipoAgenda = "tarefa" | "call" | "whatsapp" | "meeting" | "email" | "checklist" | "auto";
export const TIPO_LABEL: Record<TipoAgenda, string> = { tarefa: "Tarefa", call: "Ligação", whatsapp: "WhatsApp", meeting: "Reunião", email: "E-mail", checklist: "Checklist", auto: "Automático" };
export const TIPOS_NOVOS: TipoAgenda[] = ["tarefa", "call", "whatsapp", "meeting", "email"];
export type FiltroAgenda = "todos" | "tarefas" | "contatos" | "auto";

export type ItemAgenda = {
  id: string;
  tarefa?: Task; // ausente nos automáticos
  tipo: TipoAgenda;
  titulo: string;
  dia: Date; // meia-noite local
  hora: string | null; // "14:00"
  feito: boolean;
  atrasado: boolean;
  prioridadeAlta: boolean;
  viagem?: Lead;
  roteiro?: Itinerary;
  pessoa?: string;
  nota?: string; // linha de apoio dos automáticos ("Mandar parabéns")
};

const DIA = 86_400_000;
export const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const hoje = () => meiaNoite(new Date());
export const mesmoDia = (a: Date, b: Date) => a.getTime() === b.getTime();
export const somaDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Hora explícita da tarefa. 00:00 e 12:00 são tratados como "sem hora": é assim que datas sem hora foram gravadas. */
export function horaDe(due?: string | null): string | null {
  if (!due || !/T\d{2}:\d{2}/.test(due)) return null;
  const d = parseData(due);
  if (!d || (d.getMinutes() === 0 && (d.getHours() === 0 || d.getHours() === 12))) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function tipoDa(t: Task, tiposAtividade: Record<string, string>): TipoAgenda {
  const desc = t.description || "";
  if (/\[chk:/.test(desc)) return "checklist";
  const marca = /\[tp:([a-z]+)\]/.exec(desc)?.[1];
  const atv = /\[atv:([^\]]+)\]/.exec(desc)?.[1];
  const tipo = marca || (atv ? tiposAtividade[atv] : undefined);
  return tipo === "call" || tipo === "whatsapp" || tipo === "meeting" || tipo === "email" ? tipo : "tarefa";
}

export function itensDasTarefas(tarefas: Task[], viagens: Map<string, Lead>, roteiros: Map<string, Itinerary>, tiposAtividade: Record<string, string>): ItemAgenda[] {
  const h = hoje();
  return tarefas.flatMap((t) => {
    const d = parseData(t.due_date);
    if (!d) return [];
    const dia = meiaNoite(d);
    const viagem = t.lead_id ? viagens.get(t.lead_id) : undefined;
    const roteiro = t.itinerary_id ? roteiros.get(t.itinerary_id) : undefined;
    return [{
      id: t.id, tarefa: t, tipo: tipoDa(t, tiposAtividade), titulo: t.title, dia, hora: horaDe(t.due_date),
      feito: !!t.completed, atrasado: !t.completed && dia < h, prioridadeAlta: t.priority === "high",
      viagem, roteiro, pessoa: viagem?.name || roteiro?.client_name || t.lead?.name || undefined,
    }];
  });
}

/** Aniversários (próximos 60 dias), passaportes vencendo de quem tem viagem e embarques. */
export function datasAutomaticas(clientes: Client[], roteiros: Itinerary[], viagensAtivasPorCliente: Set<string>): ItemAgenda[] {
  const h = hoje();
  const out: ItemAgenda[] = [];
  for (const c of clientes) {
    const br = /^(\d{2})\/(\d{2})\/\d{4}$/.exec(c.birth_date?.trim() || "");
    const nasc = br ? new Date(2000, Number(br[2]) - 1, Number(br[1])) : parseData(c.birth_date);
    if (nasc) {
      let prox = new Date(h.getFullYear(), nasc.getMonth(), nasc.getDate());
      if (prox < h) prox = new Date(h.getFullYear() + 1, nasc.getMonth(), nasc.getDate());
      if ((prox.getTime() - h.getTime()) / DIA <= 60) out.push({ id: `aniv:${c.id}`, tipo: "auto", titulo: `Aniversário de ${c.name}`, dia: prox, hora: null, feito: false, atrasado: false, prioridadeAlta: false, pessoa: c.name, nota: "Mandar parabéns" });
    }
    const dias = diasAte(c.passport_expiry);
    if (dias !== null && dias < 183 && viagensAtivasPorCliente.has(c.id)) {
      const meses = Math.max(0, Math.round(dias / 30));
      out.push({ id: `pass:${c.id}`, tipo: "auto", titulo: dias < 0 ? `Passaporte de ${c.name} venceu` : `Passaporte de ${c.name} vence em ${meses <= 1 ? "menos de 2 meses" : `${meses} meses`}`, dia: h, hora: null, feito: false, atrasado: false, prioridadeAlta: dias < 60, pessoa: c.name, nota: "Avisar o viajante" });
    }
  }
  for (const r of roteiros) {
    const d = parseData(r.start_date);
    if (!d || meiaNoite(d) < h) continue;
    out.push({ id: `emb:${r.id}`, tipo: "auto", titulo: `Embarque para ${r.destination || r.title}`, dia: meiaNoite(d), hora: null, feito: false, atrasado: false, prioridadeAlta: false, roteiro: r, pessoa: r.client_name || undefined, nota: "Desejar boa viagem" });
  }
  return out;
}

export function filtrarAgenda(itens: ItemAgenda[], filtro: FiltroAgenda) {
  if (filtro === "tarefas") return itens.filter((i) => i.tipo === "tarefa" || i.tipo === "checklist");
  if (filtro === "contatos") return itens.filter((i) => ["call", "whatsapp", "meeting", "email"].includes(i.tipo));
  if (filtro === "auto") return itens.filter((i) => i.tipo === "auto");
  return itens;
}

export const ordenar = (a: ItemAgenda, b: ItemAgenda) => a.dia.getTime() - b.dia.getTime() || (a.hora ?? "99").localeCompare(b.hora ?? "99");

/** Grupos da Lista: Atrasadas, Hoje, Amanhã, Esta semana (até domingo) e Mais adiante. */
export function gruposDaLista(itens: ItemAgenda[]) {
  const h = hoje();
  const amanha = somaDias(h, 1);
  const domingo = somaDias(h, (7 - h.getDay()) % 7);
  const abertos = itens.filter((i) => !i.feito || mesmoDia(i.dia, h));
  return [
    { id: "atrasadas", titulo: "Atrasadas", itens: abertos.filter((i) => i.atrasado) },
    { id: "hoje", titulo: `Hoje · ${rotuloDia(h)}`, itens: abertos.filter((i) => !i.atrasado && mesmoDia(i.dia, h)) },
    { id: "amanha", titulo: `Amanhã · ${rotuloDia(amanha)}`, itens: abertos.filter((i) => mesmoDia(i.dia, amanha)) },
    { id: "semana", titulo: "Esta semana", itens: abertos.filter((i) => i.dia > amanha && i.dia <= domingo) },
    { id: "adiante", titulo: "Mais adiante", itens: abertos.filter((i) => i.dia > domingo && i.dia <= somaDias(h, 60)) },
  ].map((g) => ({ ...g, itens: g.itens.sort(ordenar) })).filter((g) => g.itens.length);
}

export function rotuloDia(d: Date, comMes = true) {
  const sem = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return comMes ? `${sem}, ${d.getDate()} ${mes}` : sem;
}

/** Segunda-feira da semana de `d`. */
export const inicioDaSemana = (d: Date) => somaDias(meiaNoite(d), -((d.getDay() + 6) % 7));
