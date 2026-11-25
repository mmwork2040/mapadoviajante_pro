import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AddressBook,
  AirplaneTilt,
  CalendarBlank,
  CheckSquare,
  Gauge,
  House,
  Images,
  Kanban,
  List as ListIcon,
  Moon,
  Plus,
  Robot,
  ShieldCheck,
  SignOut,
  Sun,
  UserCircle,
  UsersThree,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isAdminUser, isSuperAdminEmail } from "@/lib/auth";
import { useFinanceAccess } from "@/lib/finance-access";
import { useTheme } from "@/lib/ui";
import { fetchLeads, fetchTasks } from "@/lib/services";
import { InstallPWA } from "@/components/InstallPWA";
import { NotifPrompt } from "@/components/NotifPrompt";
import { NotificationBell } from "@/components/NotificationBell";
import { ThayPanel } from "@/components/ThayPanel";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { BrandLogo } from "@/components/BrandLogo";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { useBrand } from "@/hooks/useBrand";
import { ActionSheet, Avatar, Button, IconButton, type SheetItem } from "@/components/ds";
import { NewLeadModal } from "@/routes/_app.leads";

// Menu agrupado: trabalho do dia, recursos e gestão.
// Viagens reúne a fase comercial (/leads) e a preparação (/roteiros); Viajantes é a base de pessoas (/clientes).
type Group = "Trabalho" | "Recursos" | "Gestão";
type NavItem = { to: string; label: string; icon: Icon; match: string[]; group: Group; hash?: string };
const NAV: NavItem[] = [
  { to: "/", label: "Hoje", icon: House, match: ["/"], group: "Trabalho" },
  { to: "/leads", label: "Viagens", icon: AirplaneTilt, match: ["/leads", "/roteiros"], group: "Trabalho" },
  { to: "/clientes", label: "Viajantes", icon: AddressBook, match: ["/clientes"], group: "Trabalho" },
  { to: "/tarefas", label: "Agenda", icon: CalendarBlank, match: ["/tarefas"], group: "Trabalho" },
  { to: "/biblioteca", label: "Biblioteca", icon: Images, match: ["/biblioteca"], group: "Recursos" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, match: ["/financeiro"], group: "Gestão" },
  // Equipe e Configurações ainda são a mesma página (/admin); viram telas separadas na fase de Gestão.
  { to: "/admin", label: "Equipe", icon: UsersThree, match: ["/admin"], group: "Gestão" },
  { to: "/admin", hash: "configuracoes", label: "Configurações", icon: ShieldCheck, match: ["/admin", "/checklist-templates"], group: "Gestão" },
  // Só para super admin (liberação de acesso e cota de IA das agências).
  { to: "/plataforma", label: "Plataforma", icon: Gauge, match: ["/plataforma"], group: "Gestão" },
];

// Barra inferior do celular: dois itens, o + no centro, e mais dois.
const TAB_LEFT = ["/", "/leads"];
const TAB_RIGHT = ["/clientes", "/tarefas"];

const isActive = (item: NavItem, pathname: string, hash = "") => {
  if (!item.match.some((m) => (m === "/" ? pathname === "/" : pathname.startsWith(m)))) return false;
  if (pathname.startsWith("/admin")) return item.hash ? hash === item.hash : hash !== "configuracoes";
  return !item.hash || pathname.startsWith("/checklist-templates");
};
const navKey = (i: NavItem) => i.to + (i.hash ? `#${i.hash}` : "");

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  owner: "Administrador",
  gerente: "Gerente",
  consultor: "Consultoria",
  comercial: "Comercial",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { session, member, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const brand = useBrand();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [thayOpen, setThayOpen] = useState(false);
  const [newTrip, setNewTrip] = useState(false);
  const [newTask, setNewTask] = useState<null | { activityType?: string }>(null);

  const leadsQ = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}) });
  const newTrips = (leadsQ.data ?? []).filter((l) => l.status === "new").length;
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const todayItems = (tasksQ.data ?? []).filter((t) => {
    if (!t.due_date || t.completed) return false;
    return new Date(t.due_date).toDateString() === new Date().toDateString();
  }).length;
  const counts: Record<string, number> = { "/leads": newTrips, "/tarefas": todayItems };

  const isAdmin = isAdminUser(member, session?.user?.email);
  // Financeiro aparece para quem o admin liberou (Equipe e configurações → Permissões de acesso).
  const { canView: showFinance } = useFinanceAccess();
  const nav = NAV.filter((i) => {
    if (i.to === "/admin") return isAdmin;
    if (i.to === "/plataforma") return isSuperAdminEmail(session?.user?.email);
    if (i.to === "/financeiro") return showFinance;
    return true;
  });

  useEffect(() => {
    const channel = supabase
      .channel("leads-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => {
        qc.invalidateQueries({ queryKey: ["leads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const userName = member?.name || session?.user?.email || "Usuário";
  const role = ROLE_LABEL[member?.role ?? ""] ?? member?.role ?? "";

  const createItems: SheetItem[] = [
    { id: "viagem", icon: <Kanban aria-hidden />, title: "Nova viagem", hint: "Começa pela negociação comercial", onSelect: () => setNewTrip(true) },
    { id: "pessoa", icon: <AddressBook aria-hidden />, title: "Nova pessoa", hint: "Viajante, família ou grupo", onSelect: () => navigate({ to: "/clientes", search: { novo: "1" } }) },
    { id: "tarefa", icon: <CheckSquare aria-hidden />, title: "Nova tarefa", hint: "Com data, viajante e prioridade", onSelect: () => setNewTask({}) },
    { id: "compromisso", icon: <CalendarBlank aria-hidden />, title: "Novo compromisso", hint: "Ligação, reunião ou retorno", onSelect: () => setNewTask({ activityType: "meeting" }) },
  ];

  // No celular, o que não cabe na barra inferior fica em "Mais".
  const moreItems: SheetItem[] = [
    ...nav
      .filter((i) => ![...TAB_LEFT, ...TAB_RIGHT].includes(i.to))
      .map((i) => ({ id: navKey(i), icon: <i.icon aria-hidden />, title: i.label, onSelect: () => navigate({ to: i.to, hash: i.hash }) })),
    { id: "perfil", icon: <UserCircle aria-hidden />, title: "Minha conta", hint: userName, onSelect: () => navigate({ to: "/perfil" }) },
    { id: "thay", icon: <Robot aria-hidden />, title: "Thay IA", hint: "Assistente", onSelect: () => setThayOpen(true) },
    { id: "sair", icon: <SignOut aria-hidden />, title: "Sair", onSelect: () => signOut() },
  ];

  const tabLink = (to: string) => {
    const item = NAV.find((i) => i.to === to)!;
    const n = counts[to] ?? 0;
    return (
      <Link key={to} to={to} aria-current={isActive(item, pathname) ? "page" : undefined}>
        <item.icon aria-hidden />
        {n > 0 && <span className="ds-badge" aria-label={`${n} ${to === "/leads" ? "novas" : "para hoje"}`}>{n > 9 ? "9+" : n}</span>}
        {item.label}
      </Link>
    );
  };

  return (
    <div className="ds-app">
      <aside className="ds-side" aria-label="Menu principal">
        <Link to="/" className="ds-brand" aria-label="Ir para Hoje">
          <BrandLogo brand={brand} heightClass="h-[38px]" nameClass="text-[15px]" />
        </Link>

        <nav className="ds-navlist">
          {nav.map((item, idx) => {
            const active = isActive(item, pathname, hash);
            const n = item.hash ? 0 : (counts[item.to] ?? 0);
            return (
              <div key={navKey(item)} style={{ display: "contents" }}>
                {(idx === 0 || nav[idx - 1].group !== item.group) && <span className="ds-grp">{item.group}</span>}
                <Link to={item.to} hash={item.hash} className="ds-nav" aria-current={active ? "page" : undefined}>
                  <item.icon aria-hidden />
                  {item.label}
                  {n > 0 && (
                    <span className={`ds-cnt${item.to === "/leads" ? " ds-acc" : ""}`} aria-label={`${n} ${item.to === "/leads" ? "viagens novas" : "itens para hoje"}`}>
                      {n}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="ds-foot">
          <button type="button" className="ds-nav" onClick={() => setThayOpen(true)}>
            <Robot aria-hidden />
            Thay IA
          </button>
          <Link to="/perfil" className="ds-me" title="Minha conta">
            <Avatar name={member?.name || session?.user?.email} color={member?.avatar_color} />
            <div>
              <b>{userName}</b>
              {role && <span>{role}</span>}
            </div>
          </Link>
          <button type="button" className="ds-nav" onClick={() => signOut()}>
            <SignOut aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      <main className={`ds-main${pathname.startsWith("/leads") ? " ds-wide" : ""}`}>
        <div className="ds-top">
          <GlobalSearch />
          <span className="ds-top-sp" />
          <IconButton label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} onClick={toggle}>
            {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </IconButton>
          <NotificationBell />
          <Button className="ds-hide-m" icon={<Plus weight="bold" aria-hidden />} onClick={() => setCreateOpen(true)}>
            Novo
          </Button>
          <IconButton label="Mais opções" className="ds-show-m" onClick={() => setMoreOpen(true)}>
            <ListIcon aria-hidden />
          </IconButton>
        </div>

        <NotifPrompt />
        {children}
      </main>

      <nav className="ds-tabbar" aria-label="Menu do celular">
        {TAB_LEFT.map(tabLink)}
        <button type="button" className="ds-fab" aria-label="Criar novo" onClick={() => setCreateOpen(true)}>
          <span>
            <Plus weight="bold" aria-hidden />
          </span>
        </button>
        {TAB_RIGHT.map(tabLink)}
      </nav>

      <ActionSheet open={createOpen} onOpenChange={setCreateOpen} title="Criar" items={createItems} />
      <ActionSheet open={moreOpen} onOpenChange={setMoreOpen} title="Mais" items={moreItems} />

      {newTrip && (
        <NewLeadModal
          allLeads={leadsQ.data ?? []}
          onClose={() => setNewTrip(false)}
          onCreated={() => {
            setNewTrip(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}
      <CreateTaskModal
        open={newTask !== null}
        onOpenChange={(v) => !v && setNewTask(null)}
        initial={newTask?.activityType ? { activityType: newTask.activityType } : null}
      />

      <ThayPanel open={thayOpen} onClose={() => setThayOpen(false)} />
      <InstallPWA />
    </div>
  );
}
