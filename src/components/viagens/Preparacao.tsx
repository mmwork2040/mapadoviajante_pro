// Viagens · Preparação e viagem: Lista (por quando embarca), Capas e Quadro
// (pelo que falta fazer). Cada viagem leva à página dela.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GlobeHemisphereWest, Kanban, ListBullets, MagnifyingGlass, Plus, SquaresFour, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button, Chip, Empty, ErrorBox, PageTitle, SearchInput, Seg, Skeleton, ViewSwitcher } from "@/components/ds";
import { ViagensTabs } from "@/components/ViagensTabs";
import { NovaViagem } from "./NovaViagem";
import { ETAPAS_PREP, TOM_SITUACAO, montarPreparacao, pctChecklist, type EtapaPrep, type ViagemPrep } from "@/data/preparacao";
import { estaAberta } from "@/data/viagens";
import { fetchItineraries, fetchLeads, fetchTasks, getMemberId, getMemberRole, updateItinerary, updateLead } from "@/lib/services";
import { useResolvedImageUrl } from "@/hooks/useResolvedImageUrl";
import { useViewPref } from "@/lib/view-prefs";
import type { Itinerary, Lead } from "@/lib/types";

const pessoas = (n: number) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;

function Capa({ valor, className }: { valor?: string | null; className: string }) {
  const { url, failed, onError } = useResolvedImageUrl(valor);
  return url && !failed ? <img className={className} src={url} alt="" loading="lazy" onError={onError} /> : <span className={className}><GlobeHemisphereWest aria-hidden /></span>;
}

function Checklist({ v }: { v: ViagemPrep }) {
  if (!v.checklist) return <small>Sem checklist</small>;
  const p = pctChecklist(v);
  return (
    <>
      <span className={`ds-bar${p === 100 ? " ds-ok" : ""}`} role="progressbar" aria-label="Checklist" aria-valuenow={v.checklist.feitos} aria-valuemax={v.checklist.total}><i style={{ width: `${p}%` }} /></span>
      <small>Checklist {v.checklist.feitos}/{v.checklist.total}</small>
    </>
  );
}

const Quando = ({ v }: { v: ViagemPrep }) =>
  v.fase === "agora" ? <b className="ds-ok">{v.diaDaViagem}</b> : v.dias !== null ? <><b>{v.dias}</b><small>{v.dias === 1 ? "dia" : "dias"}</small></> : v.fase === "feita" ? <small>Concluída</small> : <small>Sem data</small>;

export function PreparacaoPage() {
  const qc = useQueryClient();
  const gestor = ["admin", "gerente"].includes(getMemberRole() ?? "");
  const eu = getMemberId();
  const roteirosQ = useQuery({ queryKey: ["itineraries"], queryFn: fetchItineraries });
  const viagensQ = useQuery({ queryKey: ["leads", { search: "", archived: false }], queryFn: () => fetchLeads({ archived: "active" }) });
  const tarefasQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });

  const [vista, setVista] = useViewPref("viagens-preparacao", ["lista", "capas", "quadro"] as const, "lista");
  const [busca, setBusca] = useState("");
  const [soMinhas, setSoMinhas] = useState(false);
  const [capasFiltro, setCapasFiltro] = useState<"proximas" | "agora" | "feitas">("proximas");
  const [nova, setNova] = useState(false);

  const mapaViagens = useMemo(() => new Map((viagensQ.data ?? []).map((v) => [v.id, v])), [viagensQ.data]);
  const todas = useMemo(() => montarPreparacao(roteirosQ.data ?? [], mapaViagens, tarefasQ.data ?? []), [roteirosQ.data, mapaViagens, tarefasQ.data]);
  const visiveis = useMemo(() => {
    const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return todas.filter((v) => {
      if ((soMinhas || !gestor) && eu) {
        const dono = v.viagem?.assigned_to ?? v.roteiro.created_by;
        if (dono && dono !== eu) return false;
      }
      return !q || `${v.destino} ${v.quem}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q);
    });
  }, [todas, busca, soMinhas, gestor, eu]);

  const andamento = todas.filter((v) => v.fase === "agora").length;
  const proximo = todas.filter((v) => v.dias !== null && v.dias >= 0).sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))[0];
  const comercial = (viagensQ.data ?? []).filter(estaAberta).length;

  const mover = useMutation({
    mutationFn: async ({ v, etapa }: { v: ViagemPrep; etapa: EtapaPrep }) => {
      if (v.viagem) {
        const ok = await updateLead(v.viagem.id, { profile: { ...(v.viagem.profile ?? {}), prep_stage: etapa } });
        if (!ok) throw new Error("falhou");
      }
      const st = etapa === "montando" ? "draft" : "active";
      if (v.roteiro.status !== st && !(await updateItinerary(v.roteiro.id, { status: st }))) throw new Error("falhou");
    },
    onMutate: async ({ v, etapa }) => {
      await qc.cancelQueries({ queryKey: ["leads"] });
      if (v.viagem) {
        const key = ["leads", { search: "", archived: false }];
        qc.setQueryData<Lead[]>(key, (old) => (old ?? []).map((l) => (l.id === v.viagem!.id ? { ...l, profile: { ...(l.profile ?? {}), prep_stage: etapa } } : l)));
      }
      qc.setQueryData<Itinerary[]>(["itineraries"], (old) => (old ?? []).map((r) => (r.id === v.roteiro.id ? { ...r, status: etapa === "montando" ? "draft" : "active" } : r)));
    },
    onSuccess: (_r, { v, etapa }) => toast(`${v.destino}: ${ETAPAS_PREP.find((e) => e.id === etapa)?.label}`),
    onError: () => toast.error("Não foi possível mudar a etapa."),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["itineraries"] }); },
  });

  const carregando = roteirosQ.isLoading || viagensQ.isLoading;
  const resumo = carregando ? "Carregando…" : [
    `${todas.filter((v) => v.fase !== "feita").length} fechadas e em preparação`,
    andamento ? `${andamento} em andamento` : null,
    proximo ? `próximo embarque ${proximo.dias === 0 ? "hoje" : proximo.dias === 1 ? "amanhã" : `em ${proximo.dias} dias`}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <PageTitle title="Viagens" summary={resumo} actions={<Button variant="primary" icon={<Plus weight="bold" aria-hidden />} onClick={() => setNova(true)}>Nova viagem</Button>} />
      <ViagensTabs ativo="preparacao" comercial={comercial} preparacao={todas.filter((v) => v.fase !== "feita").length} />

      <div className="ds-filtros">
        <SearchInput icon={<MagnifyingGlass aria-hidden />} label="Buscar viagens" placeholder="Viajante ou destino" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {gestor && <Seg label="De quem" value={soMinhas ? "minhas" : "todas"} onChange={(v) => setSoMinhas(v === "minhas")} options={[{ value: "minhas", label: "Minhas" }, { value: "todas", label: "Toda a equipe" }]} />}
        <span className="ds-filtros-sp" />
        <ViewSwitcher value={vista} onChange={setVista} options={[{ value: "lista", label: "Lista", icon: <ListBullets aria-hidden /> }, { value: "capas", label: "Capas", icon: <SquaresFour aria-hidden /> }, { value: "quadro", label: "Quadro", icon: <Kanban aria-hidden /> }]} />
      </div>

      {roteirosQ.isError ? (
        <ErrorBox onRetry={() => roteirosQ.refetch()}>Não foi possível carregar as viagens.</ErrorBox>
      ) : carregando ? (
        <div className="ds-stack"><Skeleton height={80} radius={14} /><Skeleton height={80} radius={14} /><Skeleton height={80} radius={14} /></div>
      ) : todas.length === 0 ? (
        <Empty title="Nenhuma viagem em preparação" action={<Link to="/leads" className="ds-btn ds-p">Ir para Comercial</Link>}>
          Quando uma negociação é fechada, a viagem é criada pela ficha e aparece aqui para montar o roteiro.
        </Empty>
      ) : visiveis.length === 0 ? (
        <Empty title="Nada encontrado">{busca ? `Nenhuma viagem para “${busca}”.` : "Nenhuma viagem sua por aqui."}</Empty>
      ) : vista === "lista" ? (
        <Lista viagens={visiveis} />
      ) : vista === "capas" ? (
        <>
          <Seg
            label="Filtro das capas"
            value={capasFiltro}
            onChange={setCapasFiltro}
            options={[
              { value: "proximas", label: "Próximas", count: visiveis.filter((v) => v.fase === "breve" || v.fase === "adiante").length },
              { value: "agora", label: "Em viagem", count: visiveis.filter((v) => v.fase === "agora").length },
              { value: "feitas", label: "Concluídas", count: visiveis.filter((v) => v.fase === "feita").length },
            ]}
          />
          <Capas viagens={visiveis.filter((v) => (capasFiltro === "agora" ? v.fase === "agora" : capasFiltro === "feitas" ? v.fase === "feita" : v.fase === "breve" || v.fase === "adiante"))} />
        </>
      ) : (
        <Quadro viagens={visiveis.filter((v) => v.fase !== "feita")} onMover={(v, e) => mover.mutate({ v, etapa: e })} />
      )}

      <NovaViagem open={nova} onClose={() => setNova(false)} />
    </>
  );
}

function Lista({ viagens }: { viagens: ViagemPrep[] }) {
  const grupos: [string, string, ViagemPrep[]][] = [
    ["agora", "Em viagem agora", viagens.filter((v) => v.fase === "agora")],
    ["breve", "Embarcam em 30 dias", viagens.filter((v) => v.fase === "breve")],
    ["adiante", "Mais adiante", viagens.filter((v) => v.fase === "adiante")],
    ["feita", "Concluídas", viagens.filter((v) => v.fase === "feita").reverse()],
  ];
  return (
    <div className="ds-stack" style={{ gap: 26 }}>
      {grupos.filter(([, , l]) => l.length).map(([id, titulo, l]) => (
        <section key={id} className="ds-stack" style={{ gap: 4 }}>
          <h2 className="ds-h2">{titulo} <span className="ds-muted">· {l.length}</span></h2>
          <div>
            {l.map((v) => (
              <Link key={v.roteiro.id} to="/roteiros/$id" params={{ id: v.roteiro.id }} className="ds-vrow">
                <Capa valor={v.roteiro.cover_image} className="ds-capa-img" />
                <div className="ds-vrow-b">
                  <b>{v.destino}</b>
                  <span>{v.quem} · {v.datas} · {pessoas(v.pessoas)}</span>
                  {v.alerta && <span className="ds-late"><Warning weight="fill" aria-hidden /> {v.alerta}</span>}
                </div>
                <div className="ds-vrow-c"><Chip tone={TOM_SITUACAO(v.situacao)}>{v.situacao}</Chip></div>
                <div className="ds-vrow-p"><Checklist v={v} /></div>
                <div className="ds-vrow-d"><Quando v={v} /></div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Capas({ viagens }: { viagens: ViagemPrep[] }) {
  if (!viagens.length) return <Empty title="Nenhuma viagem aqui">Troque o filtro acima.</Empty>;
  return (
    <div className="ds-capas">
      {viagens.map((v) => {
        const p = pctChecklist(v);
        return (
          <Link key={v.roteiro.id} to="/roteiros/$id" params={{ id: v.roteiro.id }} className="ds-vcapa">
            <div className="ds-vcapa-m">
              <Capa valor={v.roteiro.cover_image} className="ds-capa-vazia" />
              <span className="ds-vcapa-sombra" />
              <span className="ds-selo">{v.situacao}</span>
              <span className="ds-vcapa-n">{v.fase === "agora" ? <small>{v.diaDaViagem}</small> : v.dias !== null ? <><b>{v.dias}</b><small>{v.dias === 1 ? "dia" : "dias"}</small></> : null}</span>
              {v.checklist && <span className="ds-vcapa-bar"><i className={p === 100 ? "ds-ok" : undefined} style={{ width: `${p}%` }} /></span>}
            </div>
            <div className="ds-vcapa-t">
              <b>{v.destino}</b>
              <span>{v.quem} · {v.datas}</span>
              {v.alerta ? <span className="ds-late"><Warning weight="fill" aria-hidden /> {v.alerta}</span> : v.checklist ? <span>Checklist {v.checklist.feitos}/{v.checklist.total}</span> : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Quadro({ viagens, onMover }: { viagens: ViagemPrep[]; onMover: (v: ViagemPrep, e: EtapaPrep) => void }) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EtapaPrep | null>(null);
  return (
    <div className="ds-quadro ds-q5">
      {ETAPAS_PREP.map((e) => {
        const itens = viagens.filter((v) => v.etapa === e.id);
        const aceita = e.id !== "viajando";
        return (
          <section key={e.id} className="ds-col" aria-label={e.label}>
            <header className="ds-col-h"><b>{e.label}</b><span className="ds-cnt">{itens.length}</span></header>
            <div
              className={`ds-col-b${sobre === e.id ? " ds-over" : ""}`}
              onDragOver={(ev) => { if (!aceita || !arrastando) return; ev.preventDefault(); setSobre(e.id); }}
              onDragLeave={() => setSobre(null)}
              onDrop={(ev) => {
                ev.preventDefault(); setSobre(null);
                const v = viagens.find((x) => x.roteiro.id === arrastando);
                setArrastando(null);
                if (v && aceita && v.etapa !== e.id && v.fase !== "agora") onMover(v, e.id);
              }}
            >
              {itens.map((v) => {
                const p = pctChecklist(v);
                return (
                  <Link
                    key={v.roteiro.id}
                    to="/roteiros/$id"
                    params={{ id: v.roteiro.id }}
                    className="ds-vcard"
                    draggable={v.fase !== "agora"}
                    onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", v.roteiro.id); setArrastando(v.roteiro.id); }}
                    onDragEnd={() => { setArrastando(null); setSobre(null); }}
                  >
                    {v.roteiro.cover_image && <Capa valor={v.roteiro.cover_image} className="ds-vcard-img" />}
                    <div className="ds-vcard-t"><b>{v.destino}</b>{v.dias !== null && <span style={{ font: "700 14px var(--font-display)" }}>{v.dias}d</span>}</div>
                    <span className="ds-vcard-m">{v.quem} · {v.datas}</span>
                    {v.checklist && (
                      <span className="ds-row" style={{ gap: 8 }}>
                        <span className={`ds-bar${p === 100 ? " ds-ok" : ""}`}><i style={{ width: `${p}%` }} /></span>
                        <small className="ds-muted">{v.checklist.feitos}/{v.checklist.total}</small>
                      </span>
                    )}
                    {v.alerta && <span className="ds-vcard-p ds-late"><Warning weight="fill" aria-hidden /> {v.alerta}</span>}
                  </Link>
                );
              })}
              {!itens.length && <div className="ds-col-vazia">{aceita ? "Arraste uma viagem para cá" : "Ninguém viajando agora"}</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
