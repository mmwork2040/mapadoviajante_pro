import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AddressBook,
  AirplaneTilt,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarBlank,
  ChatCircleDots,
  Check,
  CheckCircle,
  CheckSquare,
  CurrencyCircleDollar,
  FilePdf,
  Images,
  Kanban,
  LinkSimple,
  MapPin,
  Note,
  PaperPlaneTilt,
  Play,
  Robot,
  Sparkle,
  Table,
  Wallet,
  WhatsappLogo,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { BrandLogo } from "@/components/BrandLogo";
import { applyBrandColor, PRODUCT, readableOn } from "@/lib/brand";
import {
  Celular,
  CascaApp,
  Escala,
  Navegador,
  Surge,
  type TelaId,
} from "@/components/conheca/molduras";
import {
  DIAS,
  FOTO_DESTINO,
  TelaAgenda,
  TelaBiblioteca,
  TelaFinanceiro,
  TelaHoje,
  TelaPreparacao,
  TelaRoteiro,
  TelaViagens,
  TelaViajantes,
} from "@/components/conheca/telas";
import { Demo } from "@/components/conheca/Demo";

/**
 * Página pública de apresentação do produto para planejadores de viagem.
 * Alterna dobras escuras e claras, mostra prints interativos das telas do
 * sistema e oferece um modo demonstração. Todas as chamadas levam ao cadastro.
 */
export const Route = createFileRoute("/conheca")({
  head: () => ({
    meta: [
      { title: `Conheça o ${PRODUCT.name} — o sistema do planejador de viagens` },
      {
        name: "description",
        content:
          "Viagens, viajantes, roteiros, agenda e financeiro em um só lugar. Veja como o Mapa do Viajante PRO ajuda planejadores de viagem a entregar mais com menos esforço.",
      },
    ],
  }),
  component: ConhecaPage,
});

function ConhecaPage() {
  const [demo, setDemo] = useState(false);
  const abrirDemo = () => setDemo(true);

  // Página do produto: usa a cor padrão, não a de uma agência em cache.
  useEffect(() => {
    applyBrandColor(null);
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip">
      <Topo onDemo={abrirDemo} />
      <main>
        <Hero onDemo={abrirDemo} />
        <AntesDepois />
        <Tour />
        <Thay />
        <MarcaPropria />
        <Jornada />
        <ChamadaDemo onDemo={abrirDemo} />
        <Perguntas />
        <Final onDemo={abrirDemo} />
      </main>
      <footer className="dark border-t border-border bg-background py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {PRODUCT.name} · {PRODUCT.tagline}
      </footer>
      {demo && <Demo onClose={() => setDemo(false)} />}
    </div>
  );
}

// ── Peças comuns ──────────────────────────────────────────────────────

/** Dobra da página. `tom` define se ela usa o tema claro ou o escuro do sistema. */
function Dobra({
  tom,
  id,
  children,
  className = "",
  fundo,
}: {
  tom: "clara" | "escura";
  id?: string;
  children: ReactNode;
  className?: string;
  fundo?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`${tom === "clara" ? "light" : "dark"} relative scroll-mt-16 overflow-hidden bg-background text-foreground`}
    >
      {tom === "escura" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 15% 0%, rgba(200,169,110,.08), transparent 70%), radial-gradient(50% 60% at 90% 100%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 70%)",
          }}
        />
      )}
      {fundo}
      <div className={`relative mx-auto w-full max-w-6xl px-5 py-20 sm:py-28 ${className}`}>
        {children}
      </div>
    </section>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return (
    <p className="ds-mono mb-3" style={{ color: "var(--accent-foreground)" }}>
      {children}
    </p>
  );
}

function Titulo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-3xl leading-[1.08] sm:text-[44px] ${className}`}>{children}</h2>;
}

function Cadastro({ children, grande = false }: { children: ReactNode; grande?: boolean }) {
  return (
    <Link
      to="/auth"
      search={{ mode: "signup" }}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_14px_34px_-12px_color-mix(in_srgb,var(--brand)_80%,transparent)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--brand)_90%,transparent)] ${grande ? "px-7 py-4 text-base" : "px-5 py-3 text-sm"}`}
    >
      {children}
      <ArrowRight weight="bold" className="transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function BotaoDemo({
  onClick,
  children = "Ver demonstração",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-input bg-card/50 px-5 py-3 text-sm font-semibold backdrop-blur transition hover:bg-muted"
    >
      <Play weight="fill" className="text-primary" /> {children}
    </button>
  );
}

// ── Topo ──────────────────────────────────────────────────────────────
function Topo({ onDemo }: { onDemo: () => void }) {
  return (
    <header className="dark sticky top-0 z-40 border-b border-border bg-[var(--glass)] text-foreground backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <Link to="/conheca" className="flex items-center gap-2.5">
          <BrandLogo heightClass="h-8" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          <a href="#funcionalidades" className="hover:text-foreground">
            Funcionalidades
          </a>
          <a href="#thay" className="hover:text-foreground">
            Assistente com IA
          </a>
          <a href="#marca" className="hover:text-foreground">
            Sua marca
          </a>
          <a href="#perguntas" className="hover:text-foreground">
            Perguntas
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDemo}
            className="hidden rounded-full px-3.5 py-2 text-sm font-semibold hover:bg-muted sm:block"
          >
            Demonstração
          </button>
          <Link
            to="/auth"
            className="rounded-full px-3.5 py-2 text-sm font-semibold hover:bg-muted"
          >
            Entrar
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Criar conta
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── 1. Hero (escura) ─────────────────────────────────────────────────
function Hero({ onDemo }: { onDemo: () => void }) {
  return (
    <Dobra tom="escura" className="pb-10 pt-16 sm:pb-16 sm:pt-24">
      <Surge className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-line)] bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground">
          <Sparkle weight="fill" /> O sistema do planejador de viagens
        </span>
        <h1 className="mt-6 text-[40px] leading-[1.02] sm:text-6xl lg:text-[72px]">
          Planeje viagens <span className="text-primary">incríveis</span>.
          <br className="hidden sm:block" /> Deixe a organização com a gente.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--foreground-soft)]">
          Do primeiro contato ao embarque: viajantes, propostas, roteiro dia a dia, checklist,
          agenda e financeiro no mesmo lugar. Menos tempo caçando informação, mais tempo criando
          experiências.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Cadastro grande>Criar minha conta</Cadastro>
          <BotaoDemo onClick={onDemo}>Testar sem cadastro</BotaoDemo>
        </div>
      </Surge>

      <Surge delay={150} className="relative mx-auto mt-16 max-w-5xl">
        <div
          aria-hidden
          className="absolute -inset-x-10 -top-10 bottom-0 -z-0 rounded-[60px] opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--brand) 30%, transparent), transparent)",
          }}
        />
        <Navegador endereco="mapadoviajante-pro.vercel.app" className="relative">
          <Escala altura={770}>
            {(c) => (
              <CascaApp ativa="hoje" compacta={c}>
                <TelaHoje compacta={c} />
              </CascaApp>
            )}
          </Escala>
        </Navegador>

        {/* Avisos flutuando sobre o print */}
        <Aviso
          className="-left-8 top-24"
          icon={WhatsappLogo}
          cor="#25D366"
          titulo="Família Souza respondeu"
          texto="“Pode reservar os ingressos!”"
          atraso={900}
        />
        <Aviso
          className="-right-10 top-[46%]"
          icon={CurrencyCircleDollar}
          cor="var(--success)"
          titulo="Pagamento confirmado"
          texto="2ª parcela · Portugal · R$ 9.300"
          atraso={2200}
        />
        <Aviso
          className="-left-6 bottom-16"
          icon={Bell}
          cor="var(--brand)"
          titulo="Embarque em 12 dias"
          texto="Faltam 2 itens do checklist"
          atraso={3500}
        />
        <p className="relative mt-5 text-center text-sm text-muted-foreground">
          Este é um print interativo: clique nos compromissos para concluir.
        </p>
      </Surge>
    </Dobra>
  );
}

function Aviso({
  icon: I,
  cor,
  titulo,
  texto,
  className,
  atraso,
}: {
  icon: Icon;
  cor: string;
  titulo: string;
  texto: string;
  className: string;
  atraso: number;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(true), atraso);
    return () => window.clearTimeout(t);
  }, [atraso]);
  return (
    <div
      className={`absolute z-10 rounded-[var(--r3)] border border-white/15 bg-[rgba(16,12,9,0.72)] shadow-[0_26px_60px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl hidden w-[260px] items-center gap-3 p-3 transition-all duration-700 conheca-aviso lg:flex ${className} ${on ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      style={{ animation: on ? "conheca-flutua 6s ease-in-out infinite" : undefined }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
        style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)`, color: cor }}
      >
        <I size={20} weight="fill" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold">{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{texto}</p>
      </div>
      <style>{`@keyframes conheca-flutua{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@media (prefers-reduced-motion: reduce){.conheca-aviso{animation:none!important}}`}</style>
    </div>
  );
}

// ── 2. Antes e depois (clara) ────────────────────────────────────────
const CONTRASTE: { icon: Icon; antes: string; depois: string }[] = [
  {
    icon: WhatsappLogo,
    antes: "Pedidos chegam pelo WhatsApp e se perdem entre as conversas.",
    depois: "Cada pedido vira uma viagem no funil, com o próximo passo e quem cuida dela.",
  },
  {
    icon: Table,
    antes: "Dados do cliente em planilhas, e-mails e no caderno.",
    depois: "Viajantes, famílias, documentos e preferências em um perfil só.",
  },
  {
    icon: Note,
    antes: "Roteiro refeito no Word a cada mudança, PDF desatualizado.",
    depois: "Roteiro dia a dia com a sua marca. O link do cliente se atualiza sozinho.",
  },
  {
    icon: Bell,
    antes: "Medo de esquecer visto, seguro, parcela ou check-in.",
    depois: "Checklist por viagem e agenda que lembra você no celular.",
  },
];

function AntesDepois() {
  const [com, setCom] = useState(true);
  return (
    <Dobra tom="clara">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Surge>
          <Rotulo>Por que usar</Rotulo>
          <Titulo>Seu talento é planejar viagens, não caçar informação.</Titulo>
          <p className="mt-5 max-w-lg text-lg text-[var(--foreground-soft)]">
            O planejador perde horas em tarefas que o cliente nem vê. Veja a diferença quando o
            sistema cuida dessa parte.
          </p>
          <div className="ds-seg mt-8 inline-flex" role="group" aria-label="Comparação">
            <button type="button" aria-pressed={!com} onClick={() => setCom(false)}>
              <X weight="bold" aria-hidden /> <span>Sem o sistema</span>
            </button>
            <button type="button" aria-pressed={com} onClick={() => setCom(true)}>
              <Check weight="bold" aria-hidden /> <span>Com o {PRODUCT.shortName}</span>
            </button>
          </div>
        </Surge>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONTRASTE.map((c, i) => (
            <Surge key={c.antes} delay={i * 80}>
              <div
                className={`relative h-full overflow-hidden rounded-[var(--r3)] border p-5 transition-all duration-500 ${
                  com
                    ? "border-border bg-card shadow-[0_20px_40px_-28px_rgba(60,40,20,.35)]"
                    : "border-dashed border-input bg-muted/60"
                }`}
                style={{
                  transform: com ? "rotate(0deg)" : `rotate(${[-1.6, 1.2, 1.8, -1.1][i]}deg)`,
                }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full transition-colors duration-500"
                  style={
                    com
                      ? { background: "var(--accent)", color: "var(--accent-foreground)" }
                      : {
                          background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
                          color: "var(--destructive)",
                        }
                  }
                >
                  {com ? (
                    <CheckCircle size={20} weight="fill" />
                  ) : (
                    <c.icon size={20} weight="duotone" />
                  )}
                </span>
                <p
                  key={String(com)}
                  className={`mt-4 animate-in fade-in slide-in-from-bottom-1 duration-500 ${com ? "font-semibold" : "text-muted-foreground"}`}
                >
                  {com ? c.depois : c.antes}
                </p>
              </div>
            </Surge>
          ))}
        </div>
      </div>
    </Dobra>
  );
}

// ── 3. Tour das funcionalidades (escura) ─────────────────────────────
type Recurso = {
  id: string;
  icon: Icon;
  nome: string;
  tela: TelaId;
  endereco: string;
  resumo: string;
  ganhos: string[];
  render: (c: boolean) => ReactNode;
};
const RECURSOS: Recurso[] = [
  {
    id: "viagens",
    icon: Kanban,
    nome: "Viagens",
    tela: "viagens",
    endereco: "/viagens",
    resumo:
      "Todas as viagens em um funil: Novo, Contatado, Negociando e Fechado. Em quadro ou em lista.",
    ganhos: [
      "Arraste a viagem quando a etapa muda",
      "Veja quanto está em negociação",
      "Saiba qual cliente está sem resposta",
    ],
    render: (c) => <TelaViagens compacta={c} />,
  },
  {
    id: "roteiros",
    icon: MapPin,
    nome: "Roteiros",
    tela: "viagens",
    endereco: "/roteiros/lua-de-mel-portugal",
    resumo: "O roteiro dia a dia com horários, passeios, hotéis e fotos do destino.",
    ganhos: [
      "Monte cada dia em minutos",
      "Envie por link ou PDF com a sua marca",
      "Mudou algo? O link já mostra a versão nova",
    ],
    render: (c) => <TelaRoteiro compacta={c} />,
  },
  {
    id: "preparacao",
    icon: CheckSquare,
    nome: "Preparação",
    tela: "viagens",
    endereco: "/viagens/preparacao",
    resumo:
      "Depois do fechamento, a jornada continua: contrato, pagamento, checklist e roteiro final.",
    ganhos: [
      "Modelos de checklist por tipo de viagem",
      "Progresso de cada viagem até o embarque",
      "Nada esquecido antes da partida",
    ],
    render: () => <TelaPreparacao />,
  },
  {
    id: "viajantes",
    icon: AddressBook,
    nome: "Viajantes",
    tela: "viajantes",
    endereco: "/viajantes/ana-ribeiro",
    resumo: "Pessoas, famílias e grupos com documentos, preferências e todo o histórico.",
    ganhos: [
      "Aviso de passaporte e visto vencendo",
      "Histórico de cada conversa",
      "Atendimento personalizado sem depender da memória",
    ],
    render: (c) => <TelaViajantes compacta={c} />,
  },
  {
    id: "agenda",
    icon: CalendarBlank,
    nome: "Agenda",
    tela: "agenda",
    endereco: "/agenda",
    resumo: "Retornos, prazos, pagamentos e embarques em lista, semana ou mês.",
    ganhos: [
      "Datas criadas a partir da viagem",
      "Lembretes no celular",
      "Você abre o sistema e sabe o que fazer",
    ],
    render: (c) => <TelaAgenda compacta={c} />,
  },
  {
    id: "biblioteca",
    icon: Images,
    nome: "Biblioteca",
    tela: "biblioteca",
    endereco: "/biblioteca",
    resumo: "Passeios, hotéis, transfers e fotos que você já usou, prontos para reaproveitar.",
    ganhos: [
      "Monte roteiros novos a partir dos antigos",
      "Fotos e descrições sempre à mão",
      "Padrão de qualidade em todas as viagens",
    ],
    render: (c) => <TelaBiblioteca compacta={c} />,
  },
  {
    id: "financeiro",
    icon: Wallet,
    nome: "Financeiro",
    tela: "financeiro",
    endereco: "/financeiro",
    resumo: "Vendas, comissões e parcelas a receber, mês a mês e por consultora.",
    ganhos: [
      "Saiba quanto cada viagem rende",
      "Parcelas a receber em um lugar",
      "Você decide quem da equipe vê os números",
    ],
    render: (c) => <TelaFinanceiro compacta={c} />,
  },
];

function Tour() {
  const [ativo, setAtivo] = useState(RECURSOS[0].id);
  const r = RECURSOS.find((x) => x.id === ativo)!;
  const i = RECURSOS.indexOf(r);
  return (
    <Dobra tom="escura" id="funcionalidades">
      <Surge className="max-w-2xl">
        <Rotulo>Funcionalidades</Rotulo>
        <Titulo>Tudo o que o planejador precisa, conectado.</Titulo>
        <p className="mt-5 text-lg text-[var(--foreground-soft)]">
          Escolha uma parte do sistema e mexa no print: arraste viagens, troque de aba, marque o
          checklist.
        </p>
      </Surge>

      {/* Abas no celular */}
      <div className="-mx-5 mt-10 flex gap-2 overflow-x-auto px-5 pb-2 lg:hidden">
        {RECURSOS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setAtivo(x.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
              x.id === ativo
                ? "border-[var(--accent-line)] bg-accent text-accent-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            <x.icon weight={x.id === ativo ? "fill" : "regular"} /> {x.nome}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:mt-12 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ul className="hidden flex-col gap-1.5 lg:flex">
          {RECURSOS.map((x) => {
            const on = x.id === ativo;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setAtivo(x.id)}
                  aria-expanded={on}
                  className={`w-full rounded-[var(--r3)] border p-4 text-left transition ${
                    on
                      ? "border-[var(--accent-line)] bg-card"
                      : "border-transparent hover:bg-card/60"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      <x.icon size={18} weight={on ? "fill" : "regular"} />
                    </span>
                    <b className={on ? "" : "text-[var(--foreground-soft)]"}>{x.nome}</b>
                  </span>
                  {on && <p className="mt-3 text-sm text-[var(--foreground-soft)]">{x.resumo}</p>}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="min-w-0">
          <Navegador endereco={`mapadoviajante-pro.vercel.app${r.endereco}`}>
            <Escala altura={800}>
              {(c) => (
                <CascaApp key={r.id} ativa={r.tela} compacta={c}>
                  <div className="h-full animate-in fade-in duration-500">{r.render(c)}</div>
                </CascaApp>
              )}
            </Escala>
          </Navegador>
          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <p className="text-[var(--foreground-soft)] lg:hidden">{r.resumo}</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 lg:mt-0">
                {r.ganhos.map((g) => (
                  <li key={g} className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle weight="fill" className="text-primary" /> {g}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Funcionalidade anterior"
                onClick={() => setAtivo(RECURSOS[(i - 1 + RECURSOS.length) % RECURSOS.length].id)}
                className="grid h-10 w-10 place-items-center rounded-full border border-input hover:bg-muted"
              >
                <ArrowLeft />
              </button>
              <button
                type="button"
                aria-label="Próxima funcionalidade"
                onClick={() => setAtivo(RECURSOS[(i + 1) % RECURSOS.length].id)}
                className="grid h-10 w-10 place-items-center rounded-full border border-input hover:bg-muted"
              >
                <ArrowRight />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dobra>
  );
}

// ── 4. Thay, assistente com IA (clara) ───────────────────────────────
const PEDIDOS = [
  {
    id: "roteiro",
    pedido: "Monte 4 dias em Portugal para uma lua de mel",
    resposta:
      "Claro! Um ritmo tranquilo e romântico:\n\nDia 1 · Lisboa: chegada, Miradouro de Santa Luzia no fim da tarde e jantar com fado em Alfama.\nDia 2 · Belém: Torre, Jerónimos, pastéis e passeio de barco pelo Tejo.\nDia 3 · Sintra: Palácio da Pena, Quinta da Regaleira e pôr do sol no Cabo da Roca.\nDia 4 · Porto: trem pela manhã, Ribeira e degustação de vinho do Porto.",
    acao: "Inserir no roteiro",
  },
  {
    id: "mensagem",
    pedido: "Escreva uma mensagem para um cliente que não respondeu a proposta",
    resposta:
      "Oi, Juliana! Tudo bem? Passando para saber se você conseguiu ver a proposta da Disney. Os ingressos dos parques costumam subir perto das férias, então, se fizer sentido, consigo segurar as condições até sexta. Quer que eu ajuste algo? 😊",
    acao: "Copiar para o WhatsApp",
  },
  {
    id: "mala",
    pedido: "O que levar para a Patagônia em março?",
    resposta:
      "Março é fim do verão por lá: dias amenos e vento forte.\n\n• Roupas em camadas: segunda pele, fleece e corta-vento impermeável\n• Bota de trilha já amaciada\n• Gorro, luvas finas e óculos de sol\n• Protetor solar e labial\n• Mochila pequena para os passeios no glaciar",
    acao: "Adicionar ao checklist",
  },
];

function Thay() {
  const [sel, setSel] = useState<(typeof PEDIDOS)[number] | null>(null);
  const [texto, setTexto] = useState("");
  const [feito, setFeito] = useState(false);
  const timer = useRef<number | null>(null);

  const pedir = (p: (typeof PEDIDOS)[number]) => {
    if (timer.current) window.clearInterval(timer.current);
    setSel(p);
    setTexto("");
    setFeito(false);
    let n = 0;
    // Pequena pausa de "pensando" e depois a resposta vai aparecendo.
    window.setTimeout(() => {
      timer.current = window.setInterval(() => {
        n += 3;
        setTexto(p.resposta.slice(0, n));
        if (n >= p.resposta.length && timer.current) window.clearInterval(timer.current);
      }, 16);
    }, 700);
  };
  useEffect(() => () => void (timer.current && window.clearInterval(timer.current)), []);
  const pronto = !!sel && texto.length >= sel.resposta.length;

  return (
    <Dobra tom="clara" id="thay">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
        <Surge>
          <Rotulo>Assistente com IA</Rotulo>
          <Titulo>Conheça a Thay, sua parceira de planejamento.</Titulo>
          <p className="mt-5 text-lg text-[var(--foreground-soft)]">
            A Thay faz o trabalho braçal: rascunha roteiros, escreve mensagens e sugere o que levar.
            Você revisa, ajusta e mantém a palavra final, com o seu jeito de atender.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Rascunho de roteiro por destino e perfil",
              "Textos prontos para o WhatsApp e o e-mail",
              "Dicas de bagagem, documentos e clima",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 font-medium">
                <CheckCircle weight="fill" className="text-primary" size={20} /> {t}
              </li>
            ))}
          </ul>
        </Surge>

        <Surge delay={120}>
          <div className="overflow-hidden rounded-[var(--r4)] border border-border bg-card shadow-[0_40px_80px_-40px_rgba(60,40,20,.45)]">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground">
                <Robot size={22} weight="duotone" />
              </span>
              <div>
                <b>Thay</b>
                <p className="text-xs text-muted-foreground">Assistente de planejamento</p>
              </div>
              <span className="ml-auto">
                <span className="ds-chip ds-ok">Online</span>
              </span>
            </div>
            <div className="flex min-h-[340px] flex-col gap-3 bg-background/60 p-5">
              {!sel && (
                <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
                  Escolha um pedido abaixo para ver a Thay em ação.
                </p>
              )}
              {sel && (
                <>
                  <div className="ml-auto max-w-[80%] rounded-[18px] rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {sel.pedido}
                  </div>
                  <div className="max-w-[88%] whitespace-pre-line rounded-[18px] rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed">
                    {texto || (
                      <span className="inline-flex gap-1 py-1">
                        <i className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-.3s]" />
                        <i className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-.15s]" />
                        <i className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                      </span>
                    )}
                  </div>
                  {pronto && (
                    <button
                      type="button"
                      onClick={() => setFeito(true)}
                      className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition animate-in fade-in ${
                        feito
                          ? "bg-[var(--success-soft)] text-[var(--success)]"
                          : "border border-input hover:bg-muted"
                      }`}
                    >
                      {feito ? <Check weight="bold" /> : <PaperPlaneTilt />}
                      {feito ? "Feito! Você pode editar quando quiser." : sel.acao}
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border p-4">
              {PEDIDOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pedir(p)}
                  aria-pressed={sel?.id === p.id}
                  className="ds-chip"
                  style={{
                    height: "auto",
                    padding: "8px 14px",
                    whiteSpace: "normal",
                    textAlign: "left",
                  }}
                >
                  <Sparkle weight="fill" aria-hidden /> {p.pedido}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Respostas de exemplo. No sistema, a Thay responde ao seu pedido.
          </p>
        </Surge>
      </div>
    </Dobra>
  );
}

// ── 5. Marca própria e visão do viajante (escura) ────────────────────
const CORES = ["#f58e26", "#2a78d6", "#177a44", "#d55181", "#6250d6", "#17130f"];

function MarcaPropria() {
  const [cor, setCor] = useState(CORES[0]);
  const [nome, setNome] = useState("Sua Agência de Viagens");
  const [modo, setModo] = useState<"link" | "pdf">("link");
  return (
    <Dobra tom="escura" id="marca">
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_auto]">
        <Surge>
          <Rotulo>O que o seu cliente recebe</Rotulo>
          <Titulo>Um roteiro com a cara da sua agência.</Titulo>
          <p className="mt-5 max-w-xl text-lg text-[var(--foreground-soft)]">
            O viajante recebe um link bonito, que abre no celular e fica sempre atualizado, ou um
            PDF pronto para imprimir. Tudo com o seu nome e a sua cor. Experimente:
          </p>

          <div className="mt-8 max-w-md space-y-6 rounded-[var(--r4)] border border-border bg-card p-6">
            <div className="ds-fld">
              <label htmlFor="conheca-agencia">Nome da agência</label>
              <input
                id="conheca-agencia"
                value={nome}
                maxLength={32}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium">Cor principal</span>
              <div className="flex flex-wrap items-center gap-2.5">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Usar a cor ${c}`}
                    aria-pressed={cor === c}
                    onClick={() => setCor(c)}
                    className="h-9 w-9 rounded-full border-2 transition hover:scale-110"
                    style={{
                      background: c,
                      borderColor: cor === c ? "#fff" : "rgba(255,255,255,.22)",
                      boxShadow: cor === c ? `0 0 0 3px ${c}` : undefined,
                    }}
                  />
                ))}
                <label
                  className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-dashed border-input text-xs text-muted-foreground"
                  title="Outra cor"
                >
                  +
                  <input
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Escolher outra cor"
                  />
                </label>
              </div>
            </div>
            <div className="ds-seg" role="group" aria-label="Formato">
              <button type="button" aria-pressed={modo === "link"} onClick={() => setModo("link")}>
                <LinkSimple aria-hidden /> <span>Link</span>
              </button>
              <button type="button" aria-pressed={modo === "pdf"} onClick={() => setModo("pdf")}>
                <FilePdf aria-hidden /> <span>PDF</span>
              </button>
            </div>
          </div>
        </Surge>

        <Surge delay={150} className="mx-auto">
          <Celular>
            <VisaoViajante cor={cor} agencia={nome || "Sua Agência"} modo={modo} />
          </Celular>
        </Surge>
      </div>
    </Dobra>
  );
}

function VisaoViajante({
  cor,
  agencia,
  modo,
}: {
  cor: string;
  agencia: string;
  modo: "link" | "pdf";
}) {
  const estilo = { "--brand": cor, "--brand-foreground": readableOn(cor) } as CSSProperties;
  if (modo === "pdf") {
    return (
      <div className="light h-full overflow-hidden bg-[#e9e6e2] p-3 pt-12" style={estilo}>
        <div className="h-full overflow-hidden rounded-md bg-white text-[#17130f] shadow-lg">
          <div className="h-2" style={{ background: cor }} />
          <div className="p-5">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: cor }}
            >
              {agencia}
            </p>
            <p className="mt-2 font-display text-2xl font-bold leading-tight">
              Lua de mel em Portugal
            </p>
            <p className="mt-1 text-[11px] text-[#6b645d]">Ana e Pedro · 12 a 20 de maio</p>
            <img src={FOTO_DESTINO} alt="" className="mt-4 h-24 w-full rounded object-cover" />
            {DIAS.slice(0, 3).map((d) => (
              <div key={d.dia} className="mt-3 border-l-2 pl-3" style={{ borderColor: cor }}>
                <p className="text-[10px] font-bold uppercase" style={{ color: cor }}>
                  Dia {d.dia}
                </p>
                <p className="text-[12px] font-semibold">{d.titulo}</p>
                <p className="text-[10px] text-[#6b645d]">{d.itens.map((x) => x[1]).join(" · ")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className="light h-full overflow-y-auto bg-background text-foreground [scrollbar-width:none]"
      style={estilo}
    >
      <div className="relative h-60">
        <img src={FOTO_DESTINO} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
        <p className="absolute left-5 top-12 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
          {agencia}
        </p>
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <p className="font-display text-[26px] font-bold leading-[1.05]">
            Lua de mel em Portugal
          </p>
          <p className="mt-1 text-xs text-white/80">Ana e Pedro · 12 a 20 de maio</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ background: cor, color: readableOn(cor) }}
          >
            8 noites
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-semibold">
            Lisboa · Sintra · Porto
          </span>
        </div>
        {DIAS.map((d) => (
          <div key={d.dia} className="rounded-[16px] border border-border bg-card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cor }}>
              Dia {d.dia}
            </p>
            <p className="text-[14px] font-semibold">{d.titulo}</p>
            <ul className="mt-1.5 space-y-1">
              {d.itens.map(([h, t]) => (
                <li key={t} className="flex gap-2 text-[11.5px] text-[var(--foreground-soft)]">
                  <span className="w-9 shrink-0 font-semibold text-muted-foreground">{h}</span> {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div
          className="rounded-full py-3 text-center text-[13px] font-semibold"
          style={{ background: cor, color: readableOn(cor) }}
        >
          Falar com {agencia.split(" ")[0] === "Sua" ? "a agência" : agencia}
        </div>
      </div>
    </div>
  );
}

// ── 6. Jornada da viagem (clara) ─────────────────────────────────────
const ETAPAS_JORNADA: { icon: Icon; nome: string; voce: string; sistema: string[] }[] = [
  {
    icon: ChatCircleDots,
    nome: "Pedido",
    voce: "Recebe o contato pelo site, WhatsApp ou indicação.",
    sistema: [
      "Formulário público de captação com a sua marca",
      "Pedido vira viagem no funil, já com o viajante",
      "Aviso no celular quando chega pedido novo",
    ],
  },
  {
    icon: Kanban,
    nome: "Negociação",
    voce: "Entende o perfil e apresenta a proposta.",
    sistema: [
      "Próximo passo obrigatório em toda viagem",
      "Alerta de cliente sem resposta há dias",
      "Atalho para o WhatsApp do viajante",
    ],
  },
  {
    icon: Check,
    nome: "Fechamento",
    voce: "O cliente aceita e assina.",
    sistema: [
      "Jornada de proposta, contrato e pagamento",
      "Parcelas registradas no financeiro",
      "Viagem passa para a preparação",
    ],
  },
  {
    icon: MapPin,
    nome: "Roteiro",
    voce: "Monta a experiência dia a dia.",
    sistema: [
      "Rascunho com a Thay e itens da biblioteca",
      "Link e PDF com a identidade da agência",
      "Versão sempre atualizada para o cliente",
    ],
  },
  {
    icon: CheckSquare,
    nome: "Preparação",
    voce: "Cuida dos detalhes antes da partida.",
    sistema: [
      "Checklist pelo tipo de viagem",
      "Prazos de visto, seguro e check-in na agenda",
      "Progresso visível até o embarque",
    ],
  },
  {
    icon: AirplaneTilt,
    nome: "Embarque",
    voce: "O viajante parte tranquilo e volta querendo mais.",
    sistema: [
      "Histórico completo no perfil do viajante",
      "Preferências guardadas para a próxima viagem",
      "Base de clientes pronta para novas ofertas",
    ],
  },
];

function Jornada() {
  const [i, setI] = useState(0);
  const e = ETAPAS_JORNADA[i];
  return (
    <Dobra tom="clara">
      <Surge className="mx-auto max-w-2xl text-center">
        <Rotulo>Como funciona</Rotulo>
        <Titulo>Do primeiro contato ao embarque, um caminho claro.</Titulo>
        <p className="mt-5 text-lg text-[var(--foreground-soft)]">
          Clique em cada etapa para ver o que o sistema faz por você.
        </p>
      </Surge>

      <Surge delay={100} className="mt-12">
        <div className="relative">
          <div className="absolute left-0 right-0 top-6 hidden h-0.5 bg-border sm:block" />
          <div
            className="absolute left-0 top-6 hidden h-0.5 bg-primary transition-all duration-500 sm:block"
            style={{ width: `${(i / (ETAPAS_JORNADA.length - 1)) * 100}%` }}
          />
          <ol className="relative grid grid-cols-3 gap-y-6 sm:grid-cols-6">
            {ETAPAS_JORNADA.map((x, n) => (
              <li key={x.nome} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setI(n)}
                  className="group flex flex-col items-center gap-2"
                  aria-current={n === i ? "step" : undefined}
                >
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-full border-2 transition ${
                      n <= i
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-card text-muted-foreground group-hover:border-[var(--accent-line)]"
                    } ${n === i ? "scale-110 shadow-[0_0_0_6px_var(--accent)]" : ""}`}
                  >
                    <x.icon size={20} weight={n <= i ? "fill" : "regular"} />
                  </span>
                  <span
                    className={`text-sm font-semibold ${n === i ? "" : "text-muted-foreground"}`}
                  >
                    {x.nome}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div
          key={i}
          className="mt-10 grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 md:grid-cols-[1fr_1.4fr]"
        >
          <div className="rounded-[var(--r4)] border border-border bg-card p-7">
            <span className="ds-mono">Você</span>
            <p className="mt-3 font-display text-2xl font-bold leading-snug">{e.voce}</p>
          </div>
          <div className="rounded-[var(--r4)] border border-[var(--accent-line)] bg-card p-7">
            <span className="ds-mono" style={{ color: "var(--accent-foreground)" }}>
              O sistema
            </span>
            <ul className="mt-3 space-y-3">
              {e.sistema.map((s) => (
                <li key={s} className="flex items-start gap-3 text-[15px] font-medium">
                  <CheckCircle weight="fill" size={20} className="mt-0.5 shrink-0 text-primary" />{" "}
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Surge>
    </Dobra>
  );
}

// ── 7. Chamada para a demonstração (escura, com foto) ────────────────
function ChamadaDemo({ onDemo }: { onDemo: () => void }) {
  return (
    <Dobra
      tom="escura"
      fundo={
        <>
          <img src={FOTO_DESTINO} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
        </>
      }
    >
      <Surge className="max-w-2xl text-white">
        <p className="ds-mono mb-3" style={{ color: "rgba(255,255,255,.75)" }}>
          Modo demonstração
        </p>
        <h2 className="text-3xl leading-[1.08] sm:text-[48px]">
          Entre na agência de exemplo e use o sistema agora.
        </h2>
        <p className="mt-5 text-lg text-white/80">
          Navegue pelas telas, mova viagens no funil, abra o perfil de um viajante, veja a agenda e
          o financeiro. Sem cadastro e sem compromisso.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onDemo}
            className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 font-semibold text-[#17130f] transition hover:-translate-y-0.5"
          >
            <Play weight="fill" style={{ color: "var(--brand)" }} /> Abrir a demonstração
          </button>
          <Cadastro grande>Criar minha conta</Cadastro>
        </div>
      </Surge>
    </Dobra>
  );
}

// ── 8. Perguntas (clara) ─────────────────────────────────────────────
const FAQ = [
  {
    q: "Funciona para quem trabalha sozinho?",
    a: "Sim. Serve tanto para o planejador autônomo quanto para agências com equipe. Você começa sozinho e convida pessoas quando quiser.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. Funciona no navegador do computador e do celular e pode ser instalado como aplicativo na tela inicial, com notificações.",
  },
  {
    q: "Posso usar a marca da minha agência?",
    a: "Pode. Configure sua logo e sua cor principal. O roteiro que o viajante recebe, por link ou PDF, sai com a sua identidade.",
  },
  {
    q: "Meus dados ficam separados dos de outras agências?",
    a: "Sim. Cada agência tem seus dados isolados, e as permissões de cada pessoa da equipe são definidas por você.",
  },
  {
    q: "O que acontece com o que eu fizer na demonstração?",
    a: "Nada é salvo. A demonstração roda só no seu navegador, com dados fictícios. Para guardar suas viagens, crie sua conta.",
  },
];

function Perguntas() {
  const [aberta, setAberta] = useState(0);
  return (
    <Dobra tom="clara" id="perguntas">
      <div className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
        <Surge>
          <Rotulo>Perguntas frequentes</Rotulo>
          <Titulo>Ficou alguma dúvida?</Titulo>
        </Surge>
        <Surge delay={100}>
          <div className="divide-y divide-border rounded-[var(--r4)] border border-border bg-card">
            {FAQ.map((f, n) => {
              const on = aberta === n;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setAberta(on ? -1 : n)}
                    aria-expanded={on}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold"
                  >
                    {f.q}
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-primary transition ${on ? "rotate-45" : ""}`}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ${on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <p className="overflow-hidden px-5 text-[var(--foreground-soft)]">
                      <span className="block pb-5">{f.a}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Surge>
      </div>
    </Dobra>
  );
}

// ── 9. Chamada final (escura) ────────────────────────────────────────
function Final({ onDemo }: { onDemo: () => void }) {
  return (
    <Dobra tom="escura" className="text-center">
      <Surge>
        <h2 className="mx-auto max-w-3xl text-4xl leading-[1.05] sm:text-6xl">
          Mais tempo para criar viagens.{" "}
          <span className="text-primary">Menos tempo organizando.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--foreground-soft)]">
          Crie sua conta em menos de um minuto, com e-mail ou com o Google.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Cadastro grande>Criar minha conta</Cadastro>
          <BotaoDemo onClick={onDemo} />
        </div>
      </Surge>
    </Dobra>
  );
}
