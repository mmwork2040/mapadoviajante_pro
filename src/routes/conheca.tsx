import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AddressBook,
  AirplaneTilt,
  ArrowRight,
  CalendarBlank,
  Check,
  CheckSquare,
  Clock,
  FilePdf,
  House,
  Images,
  Kanban,
  LinkSimple,
  MapPin,
  Play,
  Robot,
  ShareNetwork,
  Sparkle,
  UsersThree,
  Wallet,
  Warning,
  WhatsappLogo,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { BrandLogo } from "@/components/BrandLogo";
import { applyBrandColor, PRODUCT } from "@/lib/brand";

/**
 * Página pública de apresentação: mostra como o sistema ajuda o planejador de
 * viagens, apresenta as funcionalidades e oferece um modo demonstração com
 * dados fictícios (nada é salvo). Todas as chamadas levam ao cadastro.
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

const SIGNUP = { to: "/auth", search: { mode: "signup" } } as const;

function ConhecaPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  // Página do produto: usa a cor padrão, não a de uma agência em cache.
  useEffect(() => {
    applyBrandColor(null);
  }, []);

  return (
    <div className="min-h-screen">
      <Header onDemo={() => setDemoOpen(true)} />
      <main>
        <Hero onDemo={() => setDemoOpen(true)} />
        <Dores />
        <Funcionalidades />
        <ComoFunciona />
        <DemoTeaser onDemo={() => setDemoOpen(true)} />
        <Faq />
        <CtaFinal onDemo={() => setDemoOpen(true)} />
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {PRODUCT.name} · {PRODUCT.tagline}
      </footer>
      {demoOpen && <Demo onClose={() => setDemoOpen(false)} />}
    </div>
  );
}

// ── Peças de layout ───────────────────────────────────────────────────

function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16 sm:py-24 ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
      {children}
    </p>
  );
}

function CtaButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Link
      {...SIGNUP}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 active:scale-[0.99] ${className}`}
    >
      {children}
    </Link>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-3 font-semibold backdrop-blur transition hover:bg-muted active:scale-[0.99]"
    >
      {children}
    </button>
  );
}

function Header({ onDemo }: { onDemo: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[var(--glass)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <Link to="/conheca" className="flex items-center gap-2.5">
          <BrandLogo heightClass="h-8" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#funcionalidades" className="hover:text-foreground">
            Funcionalidades
          </a>
          <a href="#como-funciona" className="hover:text-foreground">
            Como funciona
          </a>
          <a href="#perguntas" className="hover:text-foreground">
            Perguntas
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDemo}
            className="hidden rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted sm:block"
          >
            Ver demonstração
          </button>
          <Link to="/auth" className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
            Entrar
          </Link>
          <Link
            {...SIGNUP}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Criar conta
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Seções ────────────────────────────────────────────────────────────

function Hero({ onDemo }: { onDemo: () => void }) {
  return (
    <Section className="pb-10 pt-14 sm:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-line)] bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Sparkle weight="fill" /> Feito para planejadores e agências de viagem
          </span>
          <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Menos planilha e WhatsApp perdido.{" "}
            <span className="text-primary">Mais viagens bem planejadas.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--foreground-soft)]">
            O {PRODUCT.name} organiza cada viagem do primeiro contato ao embarque: viajantes,
            roteiro dia a dia, checklist de preparação, agenda e financeiro. Você entrega um
            trabalho mais profissional e seu cliente sente a diferença.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaButton>
              Criar minha conta grátis <ArrowRight weight="bold" />
            </CtaButton>
            <GhostButton onClick={onDemo}>
              <Play weight="fill" className="text-primary" /> Testar o modo demo
            </GhostButton>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            A demonstração usa dados fictícios. Não precisa de cadastro para experimentar.
          </p>
        </div>
        <HeroPreview />
      </div>
    </Section>
  );
}

function HeroPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,var(--glow-input),transparent)]" />
      <div className="rounded-[var(--r4)] border border-border bg-card p-4 shadow-2xl sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Hoje</p>
            <p className="font-display text-lg font-bold">Bom dia, Carla</p>
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            3 tarefas para hoje
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Em negociação", "8"],
            ["Fechadas no mês", "R$ 46 mil"],
            ["Embarques em 30 dias", "4"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-[var(--r2)] bg-muted p-3">
              <p className="text-[11px] leading-tight text-muted-foreground">{l}</p>
              <p className="mt-1 font-display text-lg font-bold">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <PreviewRow
            icon={AirplaneTilt}
            title="Lua de mel em Portugal"
            sub="Embarca em 12 dias · checklist 80%"
            tone="ok"
          />
          <PreviewRow
            icon={WhatsappLogo}
            title="Família Souza · Orlando"
            sub="Sem resposta há 4 dias"
            tone="warn"
          />
          <PreviewRow
            icon={Robot}
            title="Roteiro de 10 dias na Itália"
            sub="Rascunho gerado com IA"
            tone="info"
          />
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  ok: "bg-[var(--success-soft)] text-[var(--success)]",
  warn: "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]",
  info: "bg-[color-mix(in_srgb,var(--info)_14%,transparent)] text-[var(--info)]",
  brand: "bg-accent text-accent-foreground",
};

function PreviewRow({
  icon: I,
  title,
  sub,
  tone,
}: {
  icon: Icon;
  title: string;
  sub: string;
  tone: keyof typeof TONE;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--r2)] border border-border p-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r1)] ${TONE[tone]}`}
      >
        <I size={18} weight="duotone" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

const DORES = [
  {
    antes: "Informações do cliente espalhadas entre WhatsApp, e-mail e caderno.",
    depois: "Cada viajante com perfil, família, documentos e histórico de viagens em um só lugar.",
  },
  {
    antes: "Orçamentos esquecidos e clientes que somem sem retorno.",
    depois:
      "Funil de viagens que avisa quem está sem resposta há dias, com atalho para o WhatsApp.",
  },
  {
    antes: "Roteiro montado no Word, refeito a cada mudança e enviado em PDF desatualizado.",
    depois: "Roteiro dia a dia com a sua marca, link para o viajante e PDF sempre atualizado.",
  },
  {
    antes: "Medo de esquecer um seguro, um visto ou um check-in antes do embarque.",
    depois: "Checklist de preparação por viagem e agenda que monta as datas sozinha.",
  },
];

function Dores() {
  return (
    <Section className="pt-6">
      <div className="max-w-2xl">
        <Eyebrow>Por que usar</Eyebrow>
        <h2 className="text-3xl sm:text-4xl">
          Seu talento é planejar viagens, não caçar informação.
        </h2>
        <p className="mt-4 text-[var(--foreground-soft)]">
          O planejador gasta horas em tarefas repetitivas que não aparecem para o cliente. O sistema
          assume essa parte para você focar no que encanta: a experiência da viagem.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {DORES.map((d) => (
          <div key={d.antes} className="rounded-[var(--r3)] border border-border bg-card p-5">
            <p className="flex gap-2.5 text-sm text-muted-foreground">
              <X size={18} weight="bold" className="mt-0.5 shrink-0 text-destructive" />
              <span className="line-through decoration-muted-foreground/40">{d.antes}</span>
            </p>
            <p className="mt-3 flex gap-2.5 font-medium">
              <Check size={18} weight="bold" className="mt-0.5 shrink-0 text-[var(--success)]" />
              {d.depois}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

const FUNCS: { icon: Icon; titulo: string; texto: string; ganho: string }[] = [
  {
    icon: Kanban,
    titulo: "Viagens do contato ao embarque",
    texto:
      "Acompanhe cada viagem pelas etapas Novo, Contatado, Negociando e Fechado, em lista ou quadro. Depois do fechamento, a preparação continua no mesmo lugar.",
    ganho: "Nenhum orçamento fica esquecido.",
  },
  {
    icon: AddressBook,
    titulo: "Viajantes, famílias e grupos",
    texto:
      "Cadastre pessoas, monte famílias e grupos e veja tudo o que cada viajante já fez com você: preferências, documentos e viagens anteriores.",
    ganho: "Atendimento personalizado sem depender da memória.",
  },
  {
    icon: MapPin,
    titulo: "Roteiros dia a dia",
    texto:
      "Monte o roteiro com dias, atividades, horários, hotéis e fotos do destino. Reaproveite trechos da sua biblioteca em novas viagens.",
    ganho: "Roteiros bonitos em minutos, não em horas.",
  },
  {
    icon: Robot,
    titulo: "Thay, sua assistente com IA",
    texto:
      "Peça um rascunho de roteiro, sugestões de passeios ou um texto para o cliente. Você revisa e ajusta, a IA faz o trabalho braçal.",
    ganho: "Ponto de partida pronto para cada destino.",
  },
  {
    icon: ShareNetwork,
    titulo: "Link e PDF para o viajante",
    texto:
      "Envie ao cliente um link do roteiro com a identidade da sua agência ou gere o PDF para impressão. Mudou algo? O link já mostra a versão nova.",
    ganho: "Entrega profissional que fideliza.",
  },
  {
    icon: CheckSquare,
    titulo: "Checklist de preparação",
    texto:
      "Modelos de checklist por tipo de viagem: passaporte, visto, seguro, vacinas, check-in. Acompanhe o progresso de cada viagem até o embarque.",
    ganho: "Zero esquecimentos antes da partida.",
  },
  {
    icon: CalendarBlank,
    titulo: "Agenda que se monta sozinha",
    texto:
      "Retornos, pagamentos e embarques viram compromissos com datas automáticas. Veja o dia, a semana ou o mês e receba lembretes no celular.",
    ganho: "Você sabe o que fazer assim que abre o sistema.",
  },
  {
    icon: Wallet,
    titulo: "Financeiro da viagem",
    texto:
      "Registre valores, pagamentos e comissões de cada viagem e veja o resultado do mês. Você decide quem da equipe pode ver os números.",
    ganho: "Clareza sobre quanto cada viagem rende.",
  },
  {
    icon: UsersThree,
    titulo: "Equipe e marca própria",
    texto:
      "Convide consultores, defina permissões e use a logo e a cor da sua agência. Cada agência tem seus dados separados e protegidos.",
    ganho: "Cresça sem perder o controle.",
  },
];

function Funcionalidades() {
  return (
    <Section id="funcionalidades">
      <div className="max-w-2xl">
        <Eyebrow>Funcionalidades</Eyebrow>
        <h2 className="text-3xl sm:text-4xl">Tudo o que o planejador precisa, conectado.</h2>
        <p className="mt-4 text-[var(--foreground-soft)]">
          Cada parte conversa com a outra: o viajante leva à viagem, a viagem ao roteiro, o roteiro
          à agenda. Você cadastra uma vez e usa em todo lugar.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FUNCS.map((f) => (
          <article
            key={f.titulo}
            className="group flex flex-col rounded-[var(--r3)] border border-border bg-card p-6 transition hover:border-[var(--accent-line)]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-[var(--r2)] bg-accent text-accent-foreground">
              <f.icon size={22} weight="duotone" />
            </span>
            <h3 className="mt-4 text-lg">{f.titulo}</h3>
            <p className="mt-2 flex-1 text-sm text-[var(--foreground-soft)]">{f.texto}</p>
            <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm font-semibold">
              <Check size={16} weight="bold" className="text-primary" /> {f.ganho}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}

const PASSOS = [
  {
    n: "1",
    t: "O pedido chega",
    d: "Pelo formulário de captação, WhatsApp ou indicação. Vira uma viagem com o viajante já vinculado.",
  },
  {
    n: "2",
    t: "Você negocia",
    d: "Registra conversas, envia proposta e o sistema lembra de cobrar o retorno.",
  },
  {
    n: "3",
    t: "Monta o roteiro",
    d: "Dia a dia, com ajuda da Thay e da sua biblioteca. Envia por link ou PDF.",
  },
  {
    n: "4",
    t: "Prepara o embarque",
    d: "Checklist, pagamentos e datas na agenda até o viajante partir tranquilo.",
  },
];

function ComoFunciona() {
  return (
    <Section id="como-funciona">
      <div className="max-w-2xl">
        <Eyebrow>Como funciona</Eyebrow>
        <h2 className="text-3xl sm:text-4xl">Um caminho claro para cada viagem.</h2>
      </div>
      <ol className="mt-10 grid gap-4 md:grid-cols-4">
        {PASSOS.map((p) => (
          <li key={p.n} className="relative rounded-[var(--r3)] border border-border bg-card p-5">
            <span className="font-display text-4xl font-bold text-primary">{p.n}</span>
            <h3 className="mt-2 text-lg">{p.t}</h3>
            <p className="mt-1.5 text-sm text-[var(--foreground-soft)]">{p.d}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function DemoTeaser({ onDemo }: { onDemo: () => void }) {
  return (
    <Section className="py-8 sm:py-12">
      <div className="relative overflow-hidden rounded-[var(--r4)] border border-[var(--accent-line)] bg-card p-8 sm:p-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,var(--glow-input),transparent)]" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <Eyebrow>Modo demonstração</Eyebrow>
            <h2 className="text-3xl sm:text-4xl">Experimente antes de se cadastrar.</h2>
            <p className="mt-4 text-[var(--foreground-soft)]">
              Abra uma agência de exemplo, mova viagens no funil, marque itens do checklist, gere um
              roteiro com a Thay e veja o que o seu cliente recebe. Tudo com dados fictícios.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <GhostButton onClick={onDemo}>
              <Play weight="fill" className="text-primary" /> Abrir a demonstração
            </GhostButton>
            <CtaButton>
              Ou criar minha conta <ArrowRight weight="bold" />
            </CtaButton>
          </div>
        </div>
      </div>
    </Section>
  );
}

const FAQ = [
  {
    q: "Funciona para quem trabalha sozinho?",
    a: "Sim. O sistema serve tanto para o planejador autônomo quanto para agências com equipe. Você começa sozinho e convida pessoas quando quiser.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. Funciona no navegador do computador e do celular, e pode ser instalado como aplicativo na tela inicial, com notificações.",
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
    q: "O que acontece com o que eu fizer no modo demo?",
    a: "Nada é salvo. A demonstração roda só no seu navegador. Para guardar suas viagens de verdade, crie sua conta.",
  },
];

function Faq() {
  return (
    <Section id="perguntas">
      <div className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
        <div>
          <Eyebrow>Perguntas frequentes</Eyebrow>
          <h2 className="text-3xl sm:text-4xl">Ficou alguma dúvida?</h2>
        </div>
        <div className="divide-y divide-border rounded-[var(--r3)] border border-border bg-card">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span className="text-xl text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-[var(--foreground-soft)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CtaFinal({ onDemo }: { onDemo: () => void }) {
  return (
    <Section className="text-center">
      <h2 className="mx-auto max-w-3xl text-3xl sm:text-5xl">
        Pronto para planejar viagens com{" "}
        <span className="text-primary">mais tempo e menos correria</span>?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[var(--foreground-soft)]">
        Crie sua conta em menos de um minuto, com e-mail ou com o Google.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <CtaButton>
          Criar minha conta <ArrowRight weight="bold" />
        </CtaButton>
        <GhostButton onClick={onDemo}>
          <Play weight="fill" className="text-primary" /> Ver demonstração
        </GhostButton>
      </div>
    </Section>
  );
}

// ── Modo demonstração ────────────────────────────────────────────────
// Uma agência de exemplo que roda só no navegador. Nada é enviado ao servidor.

type DemoTab = "hoje" | "viagens" | "roteiro" | "preparacao" | "viajante";
const DEMO_TABS: { id: DemoTab; label: string; icon: Icon; dica: string }[] = [
  {
    id: "hoje",
    label: "Hoje",
    icon: House,
    dica: "O que pede sua atenção hoje, assim que você abre o sistema.",
  },
  {
    id: "viagens",
    label: "Viagens",
    icon: AirplaneTilt,
    dica: "Avance as viagens pelas etapas e veja o valor em negociação mudar.",
  },
  {
    id: "roteiro",
    label: "Roteiro",
    icon: MapPin,
    dica: "Peça um rascunho à Thay e veja o roteiro dia a dia aparecer.",
  },
  {
    id: "preparacao",
    label: "Preparação",
    icon: CheckSquare,
    dica: "Marque os itens do checklist até a viagem ficar pronta para o embarque.",
  },
  {
    id: "viajante",
    label: "Visão do viajante",
    icon: LinkSimple,
    dica: "É isto que seu cliente recebe: o roteiro com a sua marca.",
  },
];

type Etapa = "new" | "contacted" | "negotiating" | "closed";
const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "new", label: "Novo" },
  { id: "contacted", label: "Contatado" },
  { id: "negotiating", label: "Negociando" },
  { id: "closed", label: "Fechado" },
];
type DemoTrip = {
  id: number;
  titulo: string;
  viajante: string;
  valor: number;
  etapa: Etapa;
  quando: string;
};
const TRIPS_INICIAIS: DemoTrip[] = [
  {
    id: 1,
    titulo: "Lua de mel em Portugal",
    viajante: "Ana e Pedro",
    valor: 28000,
    etapa: "negotiating",
    quando: "mai/27",
  },
  {
    id: 2,
    titulo: "Disney em família",
    viajante: "Família Souza",
    valor: 42000,
    etapa: "contacted",
    quando: "jul/27",
  },
  {
    id: 3,
    titulo: "Itália clássica · 10 dias",
    viajante: "Marina Lopes",
    valor: 19500,
    etapa: "new",
    quando: "set/27",
  },
  {
    id: 4,
    titulo: "Patagônia de aventura",
    viajante: "Grupo Trilheiros",
    valor: 36000,
    etapa: "new",
    quando: "nov/27",
  },
  {
    id: 5,
    titulo: "Réveillon em Fernando de Noronha",
    viajante: "Rafael Dias",
    valor: 14800,
    etapa: "closed",
    quando: "dez/26",
  },
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Demo({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<DemoTab>("hoje");
  const [trips, setTrips] = useState(TRIPS_INICIAIS);
  const [checks, setChecks] = useState<Record<string, boolean>>({
    Passaporte: true,
    "Seguro viagem": true,
  });
  const [roteiroPronto, setRoteiroPronto] = useState(false);
  const atual = DEMO_TABS.find((t) => t.id === tab)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--scrim)] backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Demonstração do sistema"
    >
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-background shadow-2xl sm:h-[min(92vh,820px)] sm:rounded-[var(--r4)] sm:border sm:border-border">
        {/* Faixa do modo demo */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-accent px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-accent-foreground">
            <Play weight="fill" /> Modo demonstração
          </span>
          <span className="hidden text-muted-foreground md:inline">
            Agência de exemplo · dados fictícios · nada é salvo
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              {...SIGNUP}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Criar minha conta
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar demonstração"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Menu */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-sidebar p-2 md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3">
            <div className="mb-3 hidden items-center gap-2 px-2 md:flex">
              <BrandLogo heightClass="h-7" nameClass="text-[13px]" />
            </div>
            {DEMO_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-[var(--r1)] px-3 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-muted"
                }`}
              >
                <t.icon
                  size={18}
                  weight={tab === t.id ? "fill" : "regular"}
                  className={tab === t.id ? "text-primary" : ""}
                />
                {t.label}
              </button>
            ))}
          </nav>

          {/* Conteúdo */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex items-start gap-2.5 border-b border-border bg-card/50 px-5 py-3 text-sm text-[var(--foreground-soft)]">
              <Sparkle weight="fill" className="mt-0.5 shrink-0 text-primary" />
              {atual.dica}
            </div>
            <div className="p-5 sm:p-6">
              {tab === "hoje" && <DemoHoje trips={trips} checks={checks} goTo={setTab} />}
              {tab === "viagens" && <DemoViagens trips={trips} setTrips={setTrips} />}
              {tab === "roteiro" && (
                <DemoRoteiro
                  pronto={roteiroPronto}
                  onGerar={() => setRoteiroPronto(true)}
                  goTo={setTab}
                />
              )}
              {tab === "preparacao" && <DemoPreparacao checks={checks} setChecks={setChecks} />}
              {tab === "viajante" && <DemoViajante pronto={roteiroPronto} goTo={setTab} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--r3)] border border-border bg-card p-4 ${className}`}>
      {children}
    </div>
  );
}

function DemoHoje({
  trips,
  checks,
  goTo,
}: {
  trips: DemoTrip[];
  checks: Record<string, boolean>;
  goTo: (t: DemoTab) => void;
}) {
  const abertas = trips.filter((t) => t.etapa !== "closed");
  const fechadas = trips.filter((t) => t.etapa === "closed");
  const feitos = CHECKLIST.filter((c) => checks[c]).length;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Quarta-feira</p>
        <h3 className="text-2xl">Bom dia, Carla</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Em negociação" valor={brl(abertas.reduce((s, t) => s + t.valor, 0))} />
        <Kpi label="Fechadas" valor={brl(fechadas.reduce((s, t) => s + t.valor, 0))} />
        <Kpi label="Viagens abertas" valor={String(abertas.length)} />
        <Kpi
          label="Checklist Portugal"
          valor={`${Math.round((feitos / CHECKLIST.length) * 100)}%`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h4 className="mb-3 flex items-center gap-2 text-base">
            <Clock weight="duotone" className="text-primary" /> Agenda de hoje
          </h4>
          <ul className="space-y-2 text-sm">
            <AgendaItem hora="09:30" texto="Retornar Família Souza sobre os parques" />
            <AgendaItem hora="14:00" texto="Enviar roteiro da Itália para Marina" />
            <AgendaItem hora="17:00" texto="Cobrar 2ª parcela · Lua de mel em Portugal" />
          </ul>
        </Card>
        <Card>
          <h4 className="mb-3 flex items-center gap-2 text-base">
            <Warning weight="duotone" className="text-[var(--warning)]" /> Sem resposta
          </h4>
          <div className="flex items-center justify-between gap-3 rounded-[var(--r2)] bg-muted p-3 text-sm">
            <div>
              <p className="font-semibold">Família Souza · Disney</p>
              <p className="text-xs text-muted-foreground">Último contato há 4 dias</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white">
              <WhatsappLogo weight="fill" /> Chamar
            </span>
          </div>
          <button
            type="button"
            onClick={() => goTo("viagens")}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Ver todas as viagens <ArrowRight />
          </button>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-[var(--r2)] border border-border bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{valor}</p>
    </div>
  );
}

function AgendaItem({ hora, texto }: { hora: string; texto: string }) {
  const [feito, setFeito] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setFeito((f) => !f)}
        className="flex w-full items-center gap-3 rounded-[var(--r1)] p-1.5 text-left hover:bg-muted"
      >
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${feito ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
        >
          {feito && <Check size={12} weight="bold" />}
        </span>
        <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">{hora}</span>
        <span className={feito ? "text-muted-foreground line-through" : ""}>{texto}</span>
      </button>
    </li>
  );
}

function DemoViagens({
  trips,
  setTrips,
}: {
  trips: DemoTrip[];
  setTrips: (f: (t: DemoTrip[]) => DemoTrip[]) => void;
}) {
  const avancar = (id: number) =>
    setTrips((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const i = ETAPAS.findIndex((e) => e.id === t.etapa);
        return { ...t, etapa: ETAPAS[Math.min(i + 1, ETAPAS.length - 1)].id };
      }),
    );
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl">Viagens</h3>
        <button
          type="button"
          onClick={() => setTrips(() => TRIPS_INICIAIS)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Recomeçar
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {ETAPAS.map((e) => {
          const col = trips.filter((t) => t.etapa === e.id);
          return (
            <div key={e.id} className="rounded-[var(--r3)] bg-muted/60 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1 text-sm">
                <span className="font-semibold">{e.label}</span>
                <span className="text-xs text-muted-foreground">
                  {brl(col.reduce((s, t) => s + t.valor, 0))}
                </span>
              </div>
              <div className="space-y-2">
                {col.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-[var(--r2)] border border-border bg-card p-3 shadow-sm"
                  >
                    <p className="text-sm font-semibold leading-snug">{t.titulo}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.viajante} · {t.quando}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">{brl(t.valor)}</span>
                      {t.etapa !== "closed" ? (
                        <button
                          type="button"
                          onClick={() => avancar(t.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground hover:opacity-80"
                        >
                          Avançar <ArrowRight size={12} weight="bold" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)]">
                          <Check weight="bold" /> Fechada
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {!col.length && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                    Nenhuma viagem
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ROTEIRO = [
  {
    dia: 1,
    titulo: "Chegada a Lisboa",
    itens: [
      "Transfer do aeroporto ao hotel no Chiado",
      "Fim de tarde no Miradouro de Santa Luzia",
      "Jantar com fado em Alfama",
    ],
  },
  {
    dia: 2,
    titulo: "Belém e Lisboa histórica",
    itens: [
      "Torre de Belém e Mosteiro dos Jerónimos",
      "Pastéis de Belém",
      "Pôr do sol no rio Tejo",
    ],
  },
  {
    dia: 3,
    titulo: "Sintra",
    itens: ["Palácio da Pena", "Quinta da Regaleira", "Cabo da Roca no fim da tarde"],
  },
  {
    dia: 4,
    titulo: "Rumo ao Porto",
    itens: [
      "Trem para o Porto",
      "Ribeira e Ponte Luís I",
      "Degustação em uma cave de vinho do Porto",
    ],
  },
];

function DemoRoteiro({
  pronto,
  onGerar,
  goTo,
}: {
  pronto: boolean;
  onGerar: () => void;
  goTo: (t: DemoTab) => void;
}) {
  const [gerando, setGerando] = useState(false);
  const gerar = () => {
    setGerando(true);
    window.setTimeout(() => {
      setGerando(false);
      onGerar();
    }, 1400);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Ana e Pedro · 8 noites</p>
          <h3 className="text-xl">Lua de mel em Portugal</h3>
        </div>
        {pronto && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goTo("viajante")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              <ShareNetwork /> Enviar ao viajante
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground">
              <FilePdf /> PDF
            </span>
          </div>
        )}
      </div>

      <Card className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Robot weight="duotone" size={20} />
        </span>
        <div className="flex-1 text-sm">
          <p className="font-semibold">Thay</p>
          {!pronto && !gerando && (
            <>
              <p className="mt-1 text-[var(--foreground-soft)]">
                Quer que eu monte um rascunho de roteiro romântico por Lisboa, Sintra e Porto?
              </p>
              <button
                type="button"
                onClick={gerar}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Sparkle weight="fill" /> Gerar rascunho com IA
              </button>
            </>
          )}
          {gerando && (
            <p className="mt-1 animate-pulse text-muted-foreground">
              Montando os dias, passeios e horários…
            </p>
          )}
          {pronto && (
            <p className="mt-1 text-[var(--foreground-soft)]">
              Pronto! Revise os dias abaixo e ajuste o que quiser. Você tem a palavra final.
            </p>
          )}
        </div>
      </Card>

      {pronto && (
        <ol className="grid gap-3 md:grid-cols-2">
          {ROTEIRO.map((d) => (
            <li key={d.dia} className="rounded-[var(--r3)] border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Dia {d.dia}
              </p>
              <p className="mt-0.5 font-display text-lg font-bold">{d.titulo}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-[var(--foreground-soft)]">
                {d.itens.map((i) => (
                  <li key={i} className="flex gap-2">
                    <MapPin className="mt-0.5 shrink-0 text-muted-foreground" /> {i}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const CHECKLIST = [
  "Passaporte",
  "Seguro viagem",
  "Passagens emitidas",
  "Reserva dos hotéis",
  "Trem Lisboa–Porto",
  "Check-in online",
  "Enviar roteiro final",
];

function DemoPreparacao({
  checks,
  setChecks,
}: {
  checks: Record<string, boolean>;
  setChecks: (f: (c: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const feitos = CHECKLIST.filter((c) => checks[c]).length;
  const pct = Math.round((feitos / CHECKLIST.length) * 100);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Embarque em 12 dias</p>
        <h3 className="text-xl">Preparação · Lua de mel em Portugal</h3>
      </div>
      <Card>
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold">
            {feitos} de {CHECKLIST.length} itens
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct === 100 && (
          <p className="mt-3 text-sm font-semibold text-[var(--success)]">
            Tudo pronto. Boa viagem para Ana e Pedro!
          </p>
        )}
      </Card>
      <ul className="divide-y divide-border rounded-[var(--r3)] border border-border bg-card">
        {CHECKLIST.map((c) => (
          <li key={c}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
              <input
                type="checkbox"
                checked={!!checks[c]}
                onChange={(e) => setChecks((prev) => ({ ...prev, [c]: e.target.checked }))}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <span className={checks[c] ? "text-muted-foreground line-through" : ""}>{c}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemoViajante({ pronto, goTo }: { pronto: boolean; goTo: (t: DemoTab) => void }) {
  if (!pronto) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <Images size={40} weight="duotone" className="mx-auto text-muted-foreground" />
        <p className="mt-3 font-semibold">O roteiro ainda está vazio.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere o rascunho com a Thay para ver o que o viajante recebe.
        </p>
        <button
          type="button"
          onClick={() => goTo("roteiro")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          Ir para o roteiro <ArrowRight />
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-sm">
      <div className="overflow-hidden rounded-[32px] border-[6px] border-[var(--chip)] bg-card shadow-xl">
        <div className="relative h-40 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand)_70%,#000),#2a78d6)] p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
            Sua Agência de Viagens
          </p>
          <p className="absolute bottom-4 left-4 right-4 font-display text-2xl font-bold leading-tight">
            Lua de mel em Portugal
          </p>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Ana e Pedro · 12 a 20 de maio</p>
          {ROTEIRO.slice(0, 3).map((d) => (
            <div key={d.dia} className="rounded-[var(--r2)] bg-muted p-3">
              <p className="text-[11px] font-semibold uppercase text-primary">Dia {d.dia}</p>
              <p className="text-sm font-semibold">{d.titulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{d.itens.join(" · ")}</p>
            </div>
          ))}
          <p className="text-center text-xs text-muted-foreground">
            Link sempre atualizado · também em PDF
          </p>
        </div>
      </div>
      <div className="mt-6 text-center">
        <p className="font-semibold">Gostou? Faça isso com os seus clientes.</p>
        <CtaButton className="mt-3">
          Criar minha conta <ArrowRight weight="bold" />
        </CtaButton>
      </div>
    </div>
  );
}
