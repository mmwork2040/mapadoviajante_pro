// Planejar viagem a partir da base: a família já vem marcada, dá para incluir
// outra pessoa da base, e a viagem nasce em Viagens · Comercial › Novo.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, Field, Janela, Seg, SelectField } from "@/components/ds";
import { CamposPasso } from "@/components/viagens/Ficha";
import { dataDoPasso } from "@/data/viagens";
import type { Pessoa, montarBase } from "@/data/viajantes";
import { createLead, createTask, fetchTeamMembers, getMemberId } from "@/lib/services";
import { dispatchWebhook } from "@/lib/webhook";

const reais = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const mascaraReais = (s: string) => (reais(s) ? reais(s).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "");

export function PlanejarViagem({ pessoa, base, onFechar }: { pessoa: Pessoa | null; base: ReturnType<typeof montarBase>; onFechar: () => void }) {
  return (
    <Janela open={!!pessoa} onOpenChange={(o) => !o && onFechar()} eyebrow="Viagens" title="Planejar viagem">
      {pessoa && <Form pessoa={pessoa} base={base} onFechar={onFechar} />}
    </Janela>
  );
}

function Form({ pessoa, base, onFechar }: { pessoa: Pessoa; base: ReturnType<typeof montarBase>; onFechar: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: equipe = [] } = useQuery({ queryKey: ["team-members"], queryFn: fetchTeamMembers });
  const familia = pessoa.familiaId ? base.familias.find((f) => f.id === pessoa.familiaId) : undefined;
  const inicial = familia ? familia.membros : [pessoa];

  const [quem, setQuem] = useState<Pessoa[]>(inicial);
  const [marcados, setMarcados] = useState<Set<string>>(new Set(inicial.map((p) => p.id)));
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState("");
  const [destino, setDestino] = useState("");
  const [modoData, setModoData] = useState<"datas" | "periodo">("periodo");
  const [ida, setIda] = useState("");
  const [volta, setVolta] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [resp, setResp] = useState(getMemberId() ?? "");
  const [passo, setPasso] = useState("Primeiro contato");
  const [quando, setQuando] = useState<string>("hoje");
  const [dataPasso, setDataPasso] = useState("");
  const [tentou, setTentou] = useState(false);

  const outros = useMemo(() => {
    const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (q.length < 2) return [];
    return base.pessoas.filter((p) => !quem.some((x) => x.id === p.id) && p.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q)).slice(0, 5);
  }, [busca, base.pessoas, quem]);

  const vao = quem.filter((p) => marcados.has(p.id));
  const erros = {
    quem: vao.length === 0 ? "Marque quem vai viajar." : undefined,
    destino: !destino.trim() ? "Escreva o destino, mesmo que aproximado." : undefined,
    passo: !passo.trim() ? "Toda viagem nova precisa de um próximo passo." : quando === "data" && !dataPasso ? "Escolha a data." : undefined,
  };

  const criar = useMutation({
    mutationFn: async () => {
      // O titular da viagem é o primeiro marcado que tem cadastro completo.
      const titular = vao.find((p) => p.client) ?? vao[0];
      const mesmaFamilia = familia && vao.every((p) => p.familiaId === familia.id);
      const nome = vao.length > 1 && mesmaFamilia ? familia!.nome : vao.length > 1 ? `${titular.nome.split(" ")[0]} e mais ${vao.length - 1}` : titular.nome;
      const travel_dates = modoData === "datas" ? (ida && volta ? `${ida} a ${volta}` : ida) : periodo.trim();
      const lead = await createLead({
        name: nome,
        phone: titular.tel || null,
        email: titular.client?.email ?? null,
        destination: destino.trim(),
        value: reais(orcamento),
        origin: "Base de viajantes",
        status: "new",
        client_id: titular.client?.id ?? null,
        assigned_to: resp || undefined,
        profile: {
          travel_dates: travel_dates || null,
          passengers: vao.length,
          children: vao.filter((p) => p.idade !== null && p.idade < 12).length,
          travelers: vao.map((p) => ({ name: p.nome, client_id: p.client?.id ?? null, relationship: p.rel })),
        },
      });
      if (!lead) throw new Error("falhou");
      await createTask({ lead_id: lead.id, title: passo.trim(), due_date: dataDoPasso(quando, dataPasso), assigned_to: resp || getMemberId() });
      return lead;
    },
    onSuccess: (lead) => {
      dispatchWebhook("lead.created", lead);
      for (const k of [["leads"], ["tasks"], ["dashboard"]]) qc.invalidateQueries({ queryKey: k });
      toast(`Viagem para ${destino.trim()} criada com ${vao.length} ${vao.length > 1 ? "pessoas" : "pessoa"}`);
      onFechar();
      navigate({ to: "/leads", search: { lead: lead.id } });
    },
    onError: () => toast.error("Não foi possível criar a viagem. Tente de novo."),
  });

  const e = (k: keyof typeof erros) => (tentou ? erros[k] : undefined);

  return (
    <form
      className="ds-form"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        setTentou(true);
        if (!Object.values(erros).some(Boolean)) criar.mutate();
      }}
    >
      <div className="ds-stack" style={{ gap: 8 }}>
        <span className="ds-mono">Quem vai viajar</span>
        <div className="ds-chips" role="group" aria-label="Quem vai viajar">
          {quem.map((p) => (
            <label key={p.id} className="ds-opcao ds-opcao-chip">
              <input
                type="checkbox"
                checked={marcados.has(p.id)}
                onChange={(ev) => setMarcados((s) => { const n = new Set(s); if (ev.target.checked) n.add(p.id); else n.delete(p.id); return n; })}
              />
              <span>{p.nome.split(" ")[0]} · {p.rel.toLowerCase()}</span>
            </label>
          ))}
          {!buscando && (
            <button type="button" className="ds-opcao ds-opcao-chip" onClick={() => setBuscando(true)}><Plus aria-hidden /> Outra pessoa da base</button>
          )}
        </div>
        {buscando && (
          <div>
            <Field label="Buscar na base" placeholder="Digite o nome" value={busca} onChange={(ev) => setBusca(ev.target.value)} autoFocus />
            {outros.length > 0 && (
              <div className="ds-sugestoes" role="listbox" aria-label="Pessoas da base">
                {outros.map((p) => (
                  <button key={p.id} type="button" role="option" aria-selected={false} onClick={() => { setQuem((l) => [...l, p]); setMarcados((s) => new Set(s).add(p.id)); setBusca(""); setBuscando(false); }}>
                    <span>{p.nome}</span>
                    <small>{p.rel}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {e("quem") && <span className="ds-fld-err" role="alert">{e("quem")}</span>}
      </div>

      <Field label="Destino" placeholder="Ex.: Lisboa e Porto" value={destino} onChange={(ev) => setDestino(ev.target.value)} error={e("destino")} />

      <div className="ds-stack" style={{ gap: 10 }}>
        <div className="ds-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <span className="ds-mono">Quando</span>
          <Seg label="Como informar a data" value={modoData} onChange={setModoData} options={[{ value: "periodo", label: "Só o período" }, { value: "datas", label: "Datas certas" }]} />
        </div>
        {modoData === "datas" ? (
          <div className="ds-linha">
            <Field label="Ida" type="date" value={ida} onChange={(ev) => setIda(ev.target.value)} />
            <Field label="Volta" type="date" value={volta} min={ida || undefined} onChange={(ev) => setVolta(ev.target.value)} />
          </div>
        ) : (
          <Field label="Período" placeholder="Ex.: julho, 10 dias" value={periodo} onChange={(ev) => setPeriodo(ev.target.value)} />
        )}
      </div>

      <div className="ds-linha">
        <Field label="Orçamento estimado" inputMode="numeric" placeholder="R$ 0" value={orcamento} onChange={(ev) => setOrcamento(mascaraReais(ev.target.value))} />
        <SelectField label="Responsável comercial" value={resp} onChange={(ev) => setResp(ev.target.value)}>
          {equipe.filter((m) => m.is_active !== false && m.status !== "pending").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </SelectField>
      </div>

      <CamposPasso titulo={passo} setTitulo={setPasso} quando={quando} setQuando={setQuando} data={dataPasso} setData={setDataPasso} erro={e("passo")} />

      <p className="ds-muted" style={{ margin: 0, fontSize: 13 }}>A viagem começa em Viagens › Comercial, na etapa Novo, já com as pessoas marcadas.</p>
      <div className="ds-row" style={{ justifyContent: "flex-end" }}>
        <Button type="button" onClick={onFechar}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={criar.isPending}>Criar viagem</Button>
      </div>
    </form>
  );
}
