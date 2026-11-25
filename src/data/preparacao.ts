// Viagens · Preparação e viagem. Enquanto não existe a viagem única (F2), a
// preparação vive em `crm_itineraries`, ligada à viagem comercial (`crm_leads`).
// A etapa de preparação fica no perfil da viagem comercial (`profile.prep_stage`);
// roteiro sem viagem ligada tem a etapa deduzida do status.
import type { Itinerary, Lead, Task } from "@/lib/types";
import { diasAte, parseData, periodoCurto, progressoChecklist } from "./viagens";

export type EtapaPrep = "montando" | "enviado" | "emitindo" | "pronta" | "viajando" | "feita";
export const ETAPAS_PREP: { id: EtapaPrep; label: string }[] = [
  { id: "montando", label: "Montando roteiro" },
  { id: "enviado", label: "Com o cliente" },
  { id: "emitindo", label: "Emitindo" },
  { id: "pronta", label: "Pronta para embarcar" },
  { id: "viajando", label: "Em viagem" },
];
const SITUACAO: Record<EtapaPrep, string> = { montando: "Em montagem", enviado: "Enviado ao cliente", emitindo: "Aprovado", pronta: "Aprovado", viajando: "Em viagem", feita: "Concluída" };
export const TOM_SITUACAO = (s: string) => (s === "Aprovado" || s === "Concluída" ? "ok" : s === "Enviado ao cliente" ? "info" : s === "Em viagem" ? "now" : "neutral") as "ok" | "info" | "now" | "neutral";

export type Fase = "agora" | "breve" | "adiante" | "feita";

export type ViagemPrep = {
  roteiro: Itinerary;
  viagem?: Lead;
  destino: string;
  quem: string;
  datas: string;
  pessoas: number;
  etapa: EtapaPrep;
  situacao: string;
  fase: Fase;
  dias: number | null; // até o embarque
  diaDaViagem?: string; // "Dia 3 de 7"
  checklist: { feitos: number; total: number } | null;
  alerta?: string;
};

const etapaGravada = (v?: Lead): EtapaPrep | null => {
  const e = (v?.profile as { prep_stage?: unknown } | undefined)?.prep_stage;
  return e === "montando" || e === "enviado" || e === "emitindo" || e === "pronta" ? e : null;
};

export function montarPreparacao(roteiros: Itinerary[], viagens: Map<string, Lead>, tarefas: Task[]): ViagemPrep[] {
  const atrasadas = new Map<string, Task[]>();
  const hojeMs = new Date(new Date().toDateString()).getTime();
  for (const t of tarefas) {
    if (t.completed) continue;
    const d = parseData(t.due_date);
    if (!d || new Date(d.toDateString()).getTime() >= hojeMs) continue;
    for (const k of [t.itinerary_id, t.lead_id]) if (k) atrasadas.set(k, [...(atrasadas.get(k) ?? []), t]);
  }
  return roteiros
    .filter((r) => r.status !== "cancelled" && !(r.lead_id && viagens.get(r.lead_id)?.archived_at))
    .map((r) => {
      const viagem = r.lead_id ? viagens.get(r.lead_id) : undefined;
      const ini = diasAte(r.start_date);
      const fim = diasAte(r.end_date ?? r.start_date);
      let fase: Fase = ini === null ? "adiante" : ini > 30 ? "adiante" : ini > 0 ? "breve" : fim !== null && fim >= 0 ? "agora" : "feita";
      if (r.status === "completed") fase = "feita";
      let etapa: EtapaPrep = fase === "agora" ? "viajando" : fase === "feita" ? "feita" : etapaGravada(viagem) ?? (r.status === "draft" ? "montando" : "enviado");
      if (ini === 0) etapa = "viajando";
      let diaDaViagem: string | undefined;
      if (fase === "agora" && r.start_date) {
        const total = Math.max(1, (diasAte(r.end_date ?? r.start_date) ?? 0) - (ini ?? 0) + 1);
        diaDaViagem = `Dia ${Math.min(total, 1 - (ini ?? 0))} de ${total}`;
      }
      const late = [...(atrasadas.get(r.id) ?? []), ...(r.lead_id ? atrasadas.get(r.lead_id) ?? [] : [])];
      const unicas = [...new Map(late.map((t) => [t.id, t])).values()];
      return {
        roteiro: r, viagem,
        destino: r.destination || viagem?.destination || r.title,
        quem: r.client_name || viagem?.name || r.lead?.name || "Viajante",
        datas: r.start_date ? periodoCurto(r.start_date, r.end_date) : "Datas a definir",
        pessoas: Number(r.passengers) || Number((viagem?.profile as { passengers?: unknown } | undefined)?.passengers) || 1,
        etapa, situacao: SITUACAO[etapa], fase, dias: fase === "feita" || fase === "agora" ? null : ini, diaDaViagem,
        checklist: progressoChecklist(viagem?.checklists),
        alerta: unicas.length === 1 ? `${unicas[0].title}: atrasada` : unicas.length > 1 ? `${unicas.length} tarefas atrasadas` : undefined,
      };
    })
    .sort((a, b) => (parseData(a.roteiro.start_date)?.getTime() ?? Infinity) - (parseData(b.roteiro.start_date)?.getTime() ?? Infinity));
}

export const pctChecklist = (v: ViagemPrep) => (v.checklist && v.checklist.total ? Math.round((v.checklist.feitos / v.checklist.total) * 100) : 0);
