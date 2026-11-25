// Novo na agenda: tipo, o que fazer, quando, horário opcional, viajante ou
// viagem, prioridade e responsável. A mesma janela edita e exclui.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AirplaneTilt, Kanban, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, Field, Janela, Seg, SelectField } from "@/components/ds";
import { TIPOS_NOVOS, TIPO_LABEL, hoje, ymd, type TipoAgenda } from "@/data/agenda";
import { estaAberta, parseData } from "@/data/viagens";
import { createTask, deleteTask, fetchItineraries, fetchLeads, fetchTeamMembers, getMemberId, getMemberRole, updateTask } from "@/lib/services";
import type { Task } from "@/lib/types";

type Vinculo = { tipo: "viagem" | "roteiro"; id: string; nome: string };

export type NovoNaAgendaProps = {
  aberto: boolean;
  tarefa?: Task | null; // editar
  dia?: string; // "aaaa-mm-dd" para criar já naquele dia
  tipoInicial?: TipoAgenda;
  onFechar: () => void;
};

export function NovoNaAgenda(props: NovoNaAgendaProps) {
  return (
    <Janela open={props.aberto} onOpenChange={(o) => !o && props.onFechar()} eyebrow="Agenda" title={props.tarefa ? "Editar na agenda" : "Novo na agenda"}>
      {props.aberto && <Form {...props} />}
    </Janela>
  );
}

const marcaTipo = (desc: string | null | undefined, tipo: TipoAgenda) =>
  [(desc || "").replace(/\s*\[tp:[a-z]+\]\s*/gi, "").trim(), tipo === "tarefa" ? "" : `[tp:${tipo}]`].filter(Boolean).join("\n\n") || null;

function tipoInicialDa(t?: Task | null): TipoAgenda {
  const m = /\[tp:([a-z]+)\]/.exec(t?.description || "")?.[1];
  return (TIPOS_NOVOS as string[]).includes(m ?? "") ? (m as TipoAgenda) : "tarefa";
}

function Form({ tarefa, dia, tipoInicial, onFechar }: NovoNaAgendaProps) {
  const qc = useQueryClient();
  const gestor = ["admin", "gerente"].includes(getMemberRole() ?? "");
  const { data: viagens = [] } = useQuery({ queryKey: ["leads", { search: "", archived: false }], queryFn: () => fetchLeads({ archived: "active" }) });
  const { data: roteiros = [] } = useQuery({ queryKey: ["itineraries"], queryFn: fetchItineraries });
  const { data: equipe = [] } = useQuery({ queryKey: ["team-members"], queryFn: fetchTeamMembers, enabled: gestor });

  const due = parseData(tarefa?.due_date);
  const horaInicial = tarefa?.due_date && /T\d{2}:\d{2}/.test(tarefa.due_date) && due && !(due.getMinutes() === 0 && [0, 12].includes(due.getHours()))
    ? `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}` : "";

  const [tipo, setTipo] = useState<TipoAgenda>(tarefa ? tipoInicialDa(tarefa) : tipoInicial ?? "tarefa");
  const [titulo, setTitulo] = useState(tarefa?.title ?? "");
  const [quando, setQuando] = useState(due ? ymd(due) : dia ?? ymd(hoje()));
  const [hora, setHora] = useState(horaInicial);
  const [prioridade, setPrioridade] = useState<"low" | "normal" | "high">((tarefa?.priority as "low" | "normal" | "high") ?? "normal");
  const [resp, setResp] = useState(tarefa?.assigned_to ?? getMemberId() ?? "");
  const [busca, setBusca] = useState("");
  const [vinculo, setVinculo] = useState<Vinculo | null>(() => {
    if (tarefa?.lead_id) return { tipo: "viagem", id: tarefa.lead_id, nome: tarefa.lead?.name ?? "Viagem" };
    if (tarefa?.itinerary_id) return { tipo: "roteiro", id: tarefa.itinerary_id, nome: tarefa.itinerary?.title ?? "Viagem" };
    return null;
  });
  const [tentou, setTentou] = useState(false);

  const opcoes = useMemo(() => {
    const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (q.length < 2) return [];
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const vs: (Vinculo & { sub: string })[] = viagens.filter((v) => estaAberta(v) && norm(`${v.name} ${v.destination ?? ""}`).includes(q)).slice(0, 4)
      .map((v) => ({ tipo: "viagem", id: v.id, nome: v.name, sub: `${v.destination || "Destino a definir"} · comercial` }));
    const rs: (Vinculo & { sub: string })[] = roteiros.filter((r) => norm(`${r.client_name ?? ""} ${r.destination ?? ""} ${r.title}`).includes(q)).slice(0, 4)
      .map((r) => ({ tipo: "roteiro", id: r.id, nome: r.client_name || r.title, sub: `${r.destination || r.title} · preparação` }));
    return [...vs, ...rs];
  }, [busca, viagens, roteiros]);

  const salvar = useMutation({
    mutationFn: async () => {
      const due_date = hora ? `${quando}T${hora}:00` : quando;
      const base = {
        title: titulo.trim(), due_date, priority: prioridade, assigned_to: resp || null,
        lead_id: vinculo?.tipo === "viagem" ? vinculo.id : null, itinerary_id: vinculo?.tipo === "roteiro" ? vinculo.id : null,
        activity_type: tipo === "tarefa" ? "outros" : tipo,
      } as Partial<Task>;
      const r = tarefa
        ? await updateTask(tarefa.id, { ...base, description: marcaTipo(tarefa.description, tipo) })
        : await createTask({ ...base, description: marcaTipo(null, tipo) });
      if (!r) throw new Error("falhou");
    },
    onSuccess: () => {
      for (const k of [["tasks"], ["dashboard"], ["lead-activities"]]) qc.invalidateQueries({ queryKey: k });
      toast(tarefa ? "Agenda atualizada" : "Salvo na agenda");
      onFechar();
    },
    onError: () => toast.error("Não foi possível salvar. Tente de novo."),
  });

  const excluir = useMutation({
    mutationFn: async () => { if (!tarefa || !(await deleteTask(tarefa.id))) throw new Error("falhou"); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast("Removido da agenda"); onFechar(); },
    onError: () => toast.error("Não foi possível excluir."),
  });

  const erroTitulo = tentou && !titulo.trim() ? "Diga o que precisa ser feito." : undefined;
  const erroData = tentou && !quando ? "Escolha o dia." : undefined;

  return (
    <form
      className="ds-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTentou(true);
        if (titulo.trim() && quando) salvar.mutate();
      }}
    >
      <div className="ds-stack" style={{ gap: 8 }}>
        <span className="ds-mono">Tipo</span>
        <div className="ds-chips" role="radiogroup" aria-label="Tipo">
          {TIPOS_NOVOS.map((t) => (
            <label key={t} className="ds-opcao ds-opcao-chip">
              <input type="radio" name="ag-tipo" checked={tipo === t} onChange={() => setTipo(t)} />
              <span>{TIPO_LABEL[t]}</span>
            </label>
          ))}
        </div>
      </div>
      <Field label="O que fazer" placeholder="Ex.: Enviar proposta revisada" value={titulo} onChange={(e) => setTitulo(e.target.value)} error={erroTitulo} autoFocus={!tarefa} />
      <div className="ds-linha">
        <Field label="Quando" type="date" value={quando} onChange={(e) => setQuando(e.target.value)} error={erroData} />
        <Field label="Horário (opcional)" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </div>

      <div>
        {vinculo ? (
          <div className="ds-stack" style={{ gap: 6 }}>
            <span className="ds-mono">Viajante ou viagem</span>
            <div className="ds-row" style={{ gap: 8 }}>
              <span className="ds-opcao ds-opcao-chip" style={{ cursor: "default" }}>
                {vinculo.tipo === "viagem" ? <Kanban aria-hidden /> : <AirplaneTilt aria-hidden />} {vinculo.nome}
              </span>
              <button type="button" className="ds-link" onClick={() => setVinculo(null)}><X aria-hidden /> Trocar</button>
            </div>
          </div>
        ) : (
          <>
            <Field label="Viajante ou viagem (opcional)" placeholder="Busque pelo nome ou destino" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {opcoes.length > 0 && (
              <div className="ds-sugestoes" role="listbox" aria-label="Viagens">
                {opcoes.map((o) => (
                  <button key={`${o.tipo}:${o.id}`} type="button" role="option" aria-selected={false} onClick={() => { setVinculo(o); setBusca(""); }}>
                    <span>{o.nome}</span>
                    <small>{o.sub}</small>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className={gestor ? "ds-linha" : undefined}>
        <div className="ds-stack" style={{ gap: 8 }}>
          <span className="ds-mono">Prioridade</span>
          <Seg label="Prioridade" value={prioridade} onChange={setPrioridade} options={[{ value: "low", label: "Baixa" }, { value: "normal", label: "Normal" }, { value: "high", label: "Alta" }]} />
        </div>
        {gestor && (
          <SelectField label="Responsável" value={resp} onChange={(e) => setResp(e.target.value)}>
            {equipe.filter((m) => m.is_active !== false && m.status !== "pending").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </SelectField>
        )}
      </div>

      <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        {tarefa ? (
          <Button type="button" variant="link" icon={<Trash aria-hidden />} loading={excluir.isPending} onClick={() => excluir.mutate()}>Excluir</Button>
        ) : <span />}
        <div className="ds-row" style={{ gap: 8 }}>
          <Button type="button" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={salvar.isPending}>Salvar</Button>
        </div>
      </div>
    </form>
  );
}
