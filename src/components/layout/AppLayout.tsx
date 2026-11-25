import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  Plane,
  Contact,
  CalendarDays,
  Images,
  Wallet,
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  ChevronLeft,
  UserCog,
  Gauge,
  Bot,
} from "lucide-react";
import { useAuth, isAdminUser, isSuperAdminEmail } from "@/lib/auth";
import { useFinanceAccess } from "@/lib/finance-access";
import { useTheme, initials } from "@/lib/ui";
import { fetchLeads, fetchTasks } from "@/lib/services";
import { InstallPWA } from "@/components/InstallPWA";
import { NotifPrompt } from "@/components/NotifPrompt";
import { NotificationBell } from "@/components/NotificationBell";
import { ThayPanel } from "@/components/ThayPanel";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrand } from "@/hooks/useBrand";

// Menu agrupado: trabalho do dia, recursos e gestão.
// Viagens reúne a fase comercial (/leads) e a preparação (/roteiros); Viajantes é a base de pessoas (/clientes).
type NavItem = { to: string; label: string; icon: typeof Home; match: string[]; group: "Trabalho" | "Recursos" | "Gestão" };
const NAV: NavItem[] = [
  { to: "/", label: "Hoje", icon: Home, match: ["/"], group: "Trabalho" },
  { to: "/leads", label: "Viagens", icon: Plane, match: ["/leads", "/roteiros"], group: "Trabalho" },
  { to: "/clientes", label: "Viajantes", icon: Contact, match: ["/clientes"], group: "Trabalho" },
  { to: "/tarefas", label: "Agenda", icon: CalendarDays, match: ["/tarefas"], group: "Trabalho" },
  { to: "/biblioteca", label: "Biblioteca", icon: Images, match: ["/biblioteca"], group: "Recursos" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, match: ["/financeiro"], group: "Gestão" },
  { to: "/admin", label: "Equipe e configurações", icon: ShieldCheck, match: ["/admin", "/checklist-templates"], group: "Gestão" },
  // Só para super admin (liberação de acesso e cota de IA das agências).
  { to: "/plataforma", label: "Plataforma", icon: Gauge, match: ["/plataforma"], group: "Gestão" },
];

// Barra inferior (mobile)
const MOBILE_NAV = NAV.filter((i) => ["/", "/leads", "/clientes", "/tarefas"].includes(i.to));

const isActive = (item: NavItem, pathname: string) =>
  item.match.some((m) => (m === "/" ? pathname === "/" : pathname.startsWith(m)));

export function AppLayout({ children }: { children: ReactNode }) {
  const { session, member, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const brand = useBrand();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const qc = useQueryClient();
  const leadsQ = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}) });
  const leadsCount = (leadsQ.data ?? []).filter((l) => l.status === "new").length;
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const todayTasksCount = (tasksQ.data ?? []).filter((t) => {
    if (!t.due_date || t.completed) return false;
    return new Date(t.due_date).toDateString() === new Date().toDateString();
  }).length;
  const isAdmin = isAdminUser(member, session?.user?.email);
  const showAdmin = isAdmin;
  // Financeiro aparece para quem o admin liberou (Administração → Permissões de acesso).
  const [thayOpen, setThayOpen] = useState(false);
  const { canView: showFinance } = useFinanceAccess();
  const nav = NAV.filter((i) => {
    if (i.to === "/admin") return isAdmin;
    if (i.to === "/plataforma") return isSuperAdminEmail(session?.user?.email);
    if (i.to === "/financeiro") return showFinance;
    return true;
  });
  const mobileNav = MOBILE_NAV;

  useEffect(() => {
    const channel = supabase
      .channel("leads-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_leads" },
        () => {
          qc.invalidateQueries({ queryKey: ["leads"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);



  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out md:flex ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className={`flex items-center gap-3 py-6 ${collapsed ? "justify-center px-2" : "px-6"}`}>
          <BrandLogo brand={brand} compact={collapsed} heightClass={collapsed ? "h-8" : "h-9"} />
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item, idx) => {
            const { to, label, icon: Icon } = item;
            const active = isActive(item, pathname);
            const header = !collapsed && (idx === 0 || nav[idx - 1].group !== item.group);
            return (
              <div key={to}>
              {header && (
                <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                  {item.group}
                </p>
              )}
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm transition-colors ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground"
                    : "font-medium text-sidebar-foreground hover:bg-muted"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-accent-foreground" : "text-muted-foreground"}`} />
                {!collapsed && <span className="animate-fade-in whitespace-nowrap">{label}</span>}
                {to === "/leads" && leadsCount > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground ${
                      collapsed ? "absolute right-1.5 top-1.5" : "ml-auto"
                    }`}
                  >
                    {leadsCount}
                  </span>
                )}
                {to === "/tarefas" && todayTasksCount > 0 && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground ${
                      collapsed ? "absolute right-1.5 top-1.5" : "ml-auto"
                    }`}
                  >
                    {todayTasksCount}
                  </span>
                )}
              </Link>
              </div>
            );
          })}
        </nav>

        <div className="space-y-3 px-3 pb-4">
          <button
            type="button"
            onClick={() => setThayOpen(true)}
            title="Conversar com a Thay"
            className={`flex w-full items-center gap-2 rounded-full bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Bot className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="animate-fade-in whitespace-nowrap">Thay IA</span>}
          </button>
          {collapsed ? (
            <Link
              to="/perfil"
              aria-label="Meu perfil"
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: member?.avatar_color || "#ff7a1a" }}
              title={member?.name || "Meu perfil"}
            >
              {initials(member?.name)}
            </Link>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-sidebar-border px-3 py-2.5">
              <Link to="/perfil" title="Meu perfil" className="flex min-w-0 items-center gap-2 overflow-hidden">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: member?.avatar_color || "#ff7a1a" }}
                >
                  {initials(member?.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{member?.name || "Usuário"}</p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {member?.role || "agente"}
                  </p>
                </div>
              </Link>
              <button
                onClick={toggle}
                aria-label="Alternar tema"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-5">
          {/* Marca no mobile (a navegação fica na barra inferior) */}
          <div className="flex items-center gap-2 md:hidden">
            <BrandLogo brand={brand} heightClass="h-7" nameClass="text-sm" />
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="group hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform duration-300 ease-in-out group-hover:scale-110 ${
                collapsed ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={toggle}
              aria-label="Alternar tema"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>


            {/* Menu do usuário (mobile) */}
            <div className="relative md:hidden">
              <button
                onClick={() => setMobileMenu((o) => !o)}
                aria-label="Menu do usuário"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: member?.avatar_color || "var(--primary)" }}
                >
                  {initials(member?.name || session?.user?.email || "?")}
                </span>
                <span className="max-w-[110px] truncate text-sm font-medium">
                  {member?.name || session?.user?.email}
                </span>
              </button>
              {mobileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                    <div className="border-b border-border px-3 py-2.5">
                      <p className="truncate text-sm font-semibold">{member?.name || "Usuário"}</p>
                      <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenu(false);
                        setThayOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    >
                      <Bot className="h-4 w-4" />
                      Thay IA
                    </button>
                    <Link
                      to="/perfil"
                      onClick={() => setMobileMenu(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted"
                    >
                      <UserCog className="h-4 w-4" />
                      Meu Perfil
                    </Link>
                    {showFinance && (
                      <Link
                        to="/financeiro"
                        onClick={() => setMobileMenu(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted"
                      >
                        <Wallet className="h-4 w-4" />
                        Financeiro
                      </Link>
                    )}
                    {showAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setMobileMenu(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Equipe e configurações
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setMobileMenu(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => signOut()}
              className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted md:flex"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-5 pb-24 sm:px-5 sm:py-6 md:pb-6">
          <NotifPrompt />
          {children}
        </main>
      </div>

      <ThayPanel open={thayOpen} onClose={() => setThayOpen(false)} />

      {/* Barra de navegação inferior (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {mobileNav.map((item) => {
          const { to, label, icon: Icon } = item;
          const active = isActive(item, pathname);
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {to === "/leads" && leadsCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {leadsCount}
                  </span>
                )}
                {to === "/tarefas" && todayTasksCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {todayTasksCount}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <InstallPWA />
    </div>
  );
}
