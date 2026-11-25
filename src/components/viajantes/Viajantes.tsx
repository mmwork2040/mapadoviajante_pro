// Tela Viajantes: a base de pessoas da agência, por família ou grupo, com
// todas as viagens de cada pessoa. Três visões: Pessoas, Famílias e grupos,
// Lista e perfil. Edição completa do cadastro continua no formulário antigo.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AirplaneTilt, ArrowRight, Cake, GlobeHemisphereWest, MagnifyingGlass, PencilSimple, Plus, Rows, SidebarSimple, User, UsersThree, WhatsappLogo,
} from "@phosphor-icons/react";
import {
  Avatar, Button, Card, Chip, DataTable, Empty, ErrorBox, PageTitle, SearchInput, Seg, Skeleton, ViewSwitcher, type Column,
} from "@/components/ds";
import {
  FASE_LABEL, FASE_TOM, cpfMascarado, filtrar, montarBase, preferenciasDe, type Familia, type Filtro, type Pessoa, type ViagemResumo,
} from "@/data/viajantes";
import { whatsappLink } from "@/data/viagens";
import { fetchClients, fetchItineraries, fetchLeads } from "@/lib/services";
import { useViewPref } from "@/lib/view-prefs";
import type { Client } from "@/lib/types";
import { NovaPessoa } from "./NovaPessoa";
import { PlanejarViagem } from "./PlanejarViagem";

const CORES = ["#4e3b31", "#2f4858", "#5b3a52", "#3d5a40", "#5a4a2f"];
const corDe = (id: string) => CORES[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function ViajantesPage({ selecionada, onSelecionar, novo, onNovoAberto, onEditar, onRemover }: {
  selecionada?: string;
  onSelecionar: (id: string | undefined) => void;
  novo: boolean;
  onNovoAberto: () => void;
  onEditar: (c: Client) => void;
  onRemover: (c: Client) => void;
}) {
  const navigate = useNavigate();
  const clientsQ = useQuery({ queryKey: ["clients", ""], queryFn: () => fetchClients() });
  const leadsQ = useQuery({ queryKey: ["leads", "all-for-clients"], queryFn: () => fetchLeads({}) });
  const roteirosQ = useQuery({ queryKey: ["itineraries"], queryFn: fetchItineraries });

  const [vista, setVista] = useViewPref("viajantes", ["perfil", "pessoas", "familias"] as const, "perfil");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [novaPessoa, setNovaPessoa] = useState<{ familiaId?: string; completar?: Pessoa } | null>(null);
  const [planejar, setPlanejar] = useState<Pessoa | null>(null);

  useEffect(() => {
    if (novo) {
      setNovaPessoa({});
      onNovoAberto();
    }
  }, [novo, onNovoAberto]);

  const base = useMemo(() => montarBase(clientsQ.data ?? [], leadsQ.data ?? [], roteirosQ.data ?? []), [clientsQ.data, leadsQ.data, roteirosQ.data]);
  const familias = useMemo(() => new Map(base.familias.map((f) => [f.id, f])), [base.familias]);
  const visiveis = useMemo(() => filtrar(base.pessoas, base.familias, busca, filtro), [base, busca, filtro]);
  const atual = base.pessoas.find((p) => p.id === selecionada) ?? visiveis[0];

  const abrirPerfil = (id: string) => {
    onSelecionar(id);
    if (vista !== "perfil") setVista("perfil");
  };
  const abrirViagem = (v: ViagemResumo) =>
    v.fase === "neg" || !v.roteiroId ? navigate({ to: "/leads", search: { lead: v.id } }) : navigate({ to: "/roteiros/$id", params: { id: v.roteiroId } });

  const carregando = clientsQ.isLoading || leadsQ.isLoading;
  const resumo = carregando
    ? "Carregando…"
    : `${plural(base.pessoas.length, "pessoa", "pessoas")} em ${plural(base.grupos, "família, grupo ou individual", "famílias, grupos e individuais")}`;

  return (
    <>
      <PageTitle
        title="Viajantes"
        summary={resumo}
        actions={<Button variant="primary" icon={<Plus weight="bold" aria-hidden />} onClick={() => setNovaPessoa({})}>Nova pessoa</Button>}
      />

      <div className="ds-filtros">
        <SearchInput icon={<MagnifyingGlass aria-hidden />} label="Buscar viajantes" placeholder="Nome, família ou destino" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Seg
          label="Filtro"
          value={filtro}
          onChange={setFiltro}
          options={[{ value: "todos", label: "Todos" }, { value: "neg", label: "Em negociação" }, { value: "breve", label: "Viajam em breve" }, { value: "doc", label: "Documento pendente" }]}
        />
        <span className="ds-filtros-sp" />
        <ViewSwitcher
          value={vista}
          onChange={setVista}
          options={[
            { value: "pessoas", label: "Pessoas", icon: <Rows aria-hidden /> },
            { value: "familias", label: "Famílias e grupos", icon: <UsersThree aria-hidden /> },
            { value: "perfil", label: "Lista e perfil", icon: <SidebarSimple aria-hidden /> },
          ]}
        />
      </div>

      {clientsQ.isError ? (
        <ErrorBox onRetry={() => clientsQ.refetch()}>Não foi possível carregar os viajantes.</ErrorBox>
      ) : carregando ? (
        <div className="ds-stack"><Skeleton height={56} radius={14} /><Skeleton height={56} radius={14} /><Skeleton height={56} radius={14} /></div>
      ) : base.pessoas.length === 0 ? (
        <Empty title="Nenhum viajante ainda" action={<Button variant="primary" onClick={() => setNovaPessoa({})}>Nova pessoa</Button>}>
          Cada pessoa cadastrada aqui guarda documentos, preferências e todas as viagens que fez com a agência.
        </Empty>
      ) : visiveis.length === 0 ? (
        <Empty title="Ninguém com esse filtro">
          {filtro === "doc" ? "Nenhuma pessoa com viagem em andamento está com o passaporte pendente." : filtro === "breve" ? "Ninguém viaja nos próximos 90 dias." : filtro === "neg" ? "Nenhuma pessoa com viagem em negociação." : `Nada encontrado para “${busca}”.`}
        </Empty>
      ) : vista === "pessoas" ? (
        <TabelaPessoas pessoas={visiveis} familias={familias} onAbrir={abrirPerfil} />
      ) : vista === "familias" ? (
        <CartoesFamilias pessoas={visiveis} base={base} onAbrir={abrirPerfil} onViagem={abrirViagem} onPlanejar={setPlanejar} onAdicionar={(familiaId) => setNovaPessoa({ familiaId })} />
      ) : (
        <div className="ds-md">
          <div className="ds-md-l" role="list" aria-label="Pessoas">
            {visiveis.map((p) => (
              <button key={p.id} type="button" role="listitem" className="ds-md-i" aria-current={p.id === atual?.id ? "true" : undefined} onClick={() => onSelecionar(p.id)}>
                <Avatar name={p.nome} size="sm" color={corDe(p.id)} />
                <span>
                  <b>{p.nome}</b>
                  <small>{p.familiaId ? familias.get(p.familiaId)?.nome : p.rel}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="ds-md-r">
            {atual && (
              <Perfil
                key={atual.id}
                p={atual}
                familia={atual.familiaId ? familias.get(atual.familiaId) : undefined}
                onAbrir={onSelecionar}
                onViagem={abrirViagem}
                onPlanejar={() => setPlanejar(atual)}
                onAdicionar={() => setNovaPessoa({ familiaId: atual.familiaId ?? (atual.client ? atual.id : undefined) })}
                onEditar={() => atual.client && onEditar(atual.client)}
                onCompletar={() => setNovaPessoa({ completar: atual, familiaId: atual.familiaId ?? undefined })}
                onRemover={() => atual.client && onRemover(atual.client)}
              />
            )}
          </div>
        </div>
      )}

      <NovaPessoa
        aberta={!!novaPessoa}
        familiaId={novaPessoa?.familiaId}
        completar={novaPessoa?.completar}
        clientes={clientsQ.data ?? []}
        familias={base.familias}
        onFechar={() => setNovaPessoa(null)}
        onSalva={(id) => { setNovaPessoa(null); abrirPerfil(id); }}
      />
      <PlanejarViagem pessoa={planejar} base={base} onFechar={() => setPlanejar(null)} />
    </>
  );
}

function ChipViagem({ v }: { v?: ViagemResumo }) {
  if (!v) return <span className="ds-muted">—</span>;
  return <Chip tone={FASE_TOM[v.fase] === "neutral" ? "neutral" : FASE_TOM[v.fase]}>{v.destino} · {FASE_LABEL[v.fase].toLowerCase()}</Chip>;
}

function ChipPassaporte({ p }: { p: Pessoa }) {
  return <Chip tone={p.passaporte.tom}>{p.passaporte.texto}</Chip>;
}

const relIdade = (p: Pessoa) => [p.rel, p.idade !== null ? `${p.idade} anos` : null].filter(Boolean).join(" · ");

function TabelaPessoas({ pessoas, familias, onAbrir }: { pessoas: Pessoa[]; familias: Map<string, Familia>; onAbrir: (id: string) => void }) {
  const cols: Column<Pessoa>[] = [
    {
      id: "pessoa", header: "Pessoa", sortValue: (p) => p.nome,
      cell: (p) => (
        <span className="ds-row" style={{ gap: 10 }}>
          <Avatar name={p.nome} size="sm" color={corDe(p.id)} />
          <span>{p.nome}<br /><small className="ds-muted">{relIdade(p)}</small></span>
        </span>
      ),
    },
    { id: "familia", header: "Família ou grupo", sortValue: (p) => (p.familiaId ? familias.get(p.familiaId)?.nome : "") ?? "", cell: (p) => (p.familiaId ? familias.get(p.familiaId)?.nome : <span className="ds-muted">—</span>) },
    { id: "agora", header: "Agora", cell: (p) => <ChipViagem v={p.agora} /> },
    { id: "viagens", header: "Viagens", numeric: true, sortValue: (p) => p.viagens.length, cell: (p) => p.viagens.length },
    { id: "passaporte", header: "Passaporte", sortValue: (p) => ({ bad: 0, warn: 1, ok: 2 })[p.passaporte.tom], cell: (p) => <ChipPassaporte p={p} /> },
  ];
  return <DataTable caption="Pessoas da base de viajantes" columns={cols} rows={pessoas} rowKey={(p) => p.id} onRowClick={(p) => onAbrir(p.id)} initialSort={{ id: "pessoa", dir: "asc" }} />;
}

function CartoesFamilias({ pessoas, base, onAbrir, onViagem, onPlanejar, onAdicionar }: {
  pessoas: Pessoa[];
  base: ReturnType<typeof montarBase>;
  onAbrir: (id: string) => void;
  onViagem: (v: ViagemResumo) => void;
  onPlanejar: (p: Pessoa) => void;
  onAdicionar: (familiaId: string) => void;
}) {
  // Um cartão por família ou grupo e um por pessoa que viaja sem família, na ordem dos visíveis.
  const ids = [...new Set(pessoas.map((p) => p.familiaId ?? p.id))];
  const famMap = new Map(base.familias.map((f) => [f.id, f]));
  return (
    <div className="ds-clis">
      {ids.map((id) => {
        const f = famMap.get(id);
        const membros = f ? f.membros : base.pessoas.filter((p) => p.id === id);
        const viagens = f ? f.viagens : membros[0]?.viagens ?? [];
        const agora = f ? f.agora : membros[0]?.agora;
        const titular = membros[0];
        if (!titular) return null;
        return (
          <Card key={id} className="ds-cli">
            <header className="ds-stack" style={{ gap: 2 }}>
              <span className="ds-mono">{f ? f.tipo : "Individual"} · {plural(membros.length, "pessoa", "pessoas")}</span>
              <b className="ds-h2">{f ? f.nome : titular.nome}</b>
            </header>
            <div className="ds-membros">
              {membros.map((p) => (
                <button key={p.id} type="button" className="ds-membro" onClick={() => onAbrir(p.id)}>
                  <Avatar name={p.nome} size="sm" color={corDe(p.id)} />
                  <span><b>{p.nome.split(" ")[0]}</b><small>{p.rel}</small></span>
                </button>
              ))}
            </div>
            {agora ? (
              <button type="button" className="ds-cli-prox" onClick={() => onViagem(agora)}>
                {agora.capa ? <img src={agora.capa} alt="" className="ds-trip-img" /> : <span className="ds-trip-img"><AirplaneTilt aria-hidden /></span>}
                <div>
                  <small className="ds-mono">{FASE_LABEL[agora.fase]}</small>
                  <b>{agora.destino}</b>
                  <span>{agora.quando}</span>
                </div>
              </button>
            ) : (
              <div className="ds-cli-prox ds-vazio"><span>Nenhuma viagem em andamento</span></div>
            )}
            <span className="ds-muted" style={{ fontSize: 13 }}>{plural(viagens.length, "viagem", "viagens")} com a agência</span>
            <footer>
              <Button icon={<Plus aria-hidden />} onClick={() => onPlanejar(titular)}>Planejar viagem</Button>
              <Button icon={<User aria-hidden />} onClick={() => onAdicionar(f ? f.id : titular.id)} disabled={!f && !titular.client}>Adicionar pessoa</Button>
            </footer>
          </Card>
        );
      })}
    </div>
  );
}

function Perfil({ p, familia, onAbrir, onViagem, onPlanejar, onAdicionar, onEditar, onCompletar, onRemover }: {
  p: Pessoa;
  familia?: Familia;
  onAbrir: (id: string) => void;
  onViagem: (v: ViagemResumo) => void;
  onPlanejar: () => void;
  onAdicionar: () => void;
  onEditar: () => void;
  onCompletar: () => void;
  onRemover: () => void;
}) {
  const outros = familia ? familia.membros.filter((x) => x.id !== p.id) : [];
  const wa = whatsappLink(p.tel);
  const prefs = preferenciasDe(p.client);
  const cpf = cpfMascarado(p.client?.cpf);
  return (
    <div className="ds-stack" style={{ gap: 26 }}>
      <header className="ds-perfil-h">
        <Avatar name={p.nome} color={corDe(p.id)} className="ds-xl" />
        <div className="ds-perfil-t">
          <span className="ds-mono">{[familia?.nome, p.rel].filter(Boolean).join(" · ")}</span>
          <h2 className="ds-h1" style={{ fontSize: 28 }}>{p.nome}</h2>
          <span className="ds-muted">{[p.idade !== null ? `${p.idade} anos` : null, p.tel || null].filter(Boolean).join(" · ") || "Sem idade e telefone"}</span>
        </div>
        <div className="ds-row" style={{ flexWrap: "wrap", gap: 8, minWidth: 0 }}>
          {wa && <a className="ds-btn" href={wa} target="_blank" rel="noreferrer"><WhatsappLogo aria-hidden /> WhatsApp</a>}
          {p.client ? (
            <Button icon={<PencilSimple aria-hidden />} onClick={onEditar}>Editar</Button>
          ) : (
            <Button icon={<PencilSimple aria-hidden />} onClick={onCompletar}>Completar cadastro</Button>
          )}
          <Button variant="primary" icon={<Plus weight="bold" aria-hidden />} onClick={onPlanejar}>Planejar viagem</Button>
        </div>
      </header>

      {!p.client && (
        <div className="ds-tip">
          <User size={20} aria-hidden />
          <span>Esta pessoa está na família só com o nome. Complete o cadastro para guardar documentos e preferências.</span>
        </div>
      )}

      <section className="ds-stack" style={{ gap: 8 }}>
        <div className="ds-row" style={{ justifyContent: "space-between" }}>
          <h3 className="ds-h2">Viagens</h3>
          <span className="ds-muted">{p.viagens.length}</span>
        </div>
        {p.viagens.length ? (
          <div>
            {p.viagens.map((v) => (
              <button key={v.id} type="button" className="ds-trip" onClick={() => onViagem(v)}>
                {v.capa ? <img src={v.capa} alt="" className="ds-trip-img" /> : <span className="ds-trip-img"><GlobeHemisphereWest aria-hidden /></span>}
                <div><b>{v.destino}</b><span>{v.quando}</span></div>
                <div className="ds-trip-d"><Chip tone={FASE_TOM[v.fase] === "neutral" ? "neutral" : FASE_TOM[v.fase]}>{FASE_LABEL[v.fase]}</Chip></div>
              </button>
            ))}
          </div>
        ) : (
          <span className="ds-muted">Nenhuma viagem ainda. Use Planejar viagem para começar uma.</span>
        )}
      </section>

      <div className="ds-two">
        <section className="ds-stack" style={{ gap: 10 }}>
          <span className="ds-mono">{familia ? (familia.tipo === "Grupo" ? "Grupo" : familia.tipo === "Casal" ? "Casal" : "Família") : "Viaja com"}</span>
          {outros.length ? (
            outros.map((x) => (
              <button key={x.id} type="button" className="ds-membro ds-l" onClick={() => onAbrir(x.id)}>
                <Avatar name={x.nome} size="sm" color={corDe(x.id)} />
                <span><b>{x.nome}</b><small>{relIdade(x)}</small></span>
              </button>
            ))
          ) : (
            <span className="ds-muted">Ninguém cadastrado junto ainda.</span>
          )}
          {(p.client || familia) && (
            <button type="button" className="ds-link" style={{ alignSelf: "flex-start" }} onClick={onAdicionar}>
              <Plus aria-hidden /> Adicionar pessoa
            </button>
          )}
        </section>

        <section className="ds-stack" style={{ gap: 10 }}>
          <span className="ds-mono">Documentos e preferências</span>
          <dl className="ds-dados">
            <dt>Passaporte</dt>
            <dd><Chip tone={p.passaporte.tom}>{p.passaporte.texto}</Chip></dd>
            <dt>CPF</dt>
            <dd className={cpf ? undefined : "ds-nd"}>{cpf || "Não informado"}</dd>
            {p.aniversario && (<><dt>Aniversário</dt><dd>{p.aniversario} <Cake aria-hidden /></dd></>)}
            <dt>Preferências</dt>
            <dd className={prefs.length ? undefined : "ds-nd"}>{prefs.length ? prefs.join(" · ") : "Nenhuma registrada"}</dd>
          </dl>
          {p.client && (
            <button type="button" className="ds-link" style={{ alignSelf: "flex-start" }} onClick={onEditar}>
              Documentos, endereço e notas <ArrowRight aria-hidden />
            </button>
          )}
        </section>
      </div>
      {p.client && (
        <button type="button" className="ds-perder" onClick={onRemover}>Remover da base</button>
      )}
    </div>
  );
}
