import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Route as RouteIcon,
  Images,
  Wallet,
  ShieldCheck,
  ListChecks,
  Moon,
  Sun,
  LogOut,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth, isSuperAdminEmail } from "@/lib/auth";
import { useTheme, initials } from "@/lib/ui";
import { fetchLeads } from "@/lib/services";
import { InstallPWA } from "@/components/InstallPWA";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/roteiros", label: "Roteiros", icon: RouteIcon },
  { to: "/biblioteca", label: "Biblioteca", icon: Images },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin", label: "Administração", icon: ShieldCheck },
] as const;

// Itens principais exibidos na barra de navegação inferior (mobile)
const MOBILE_NAV = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/tarefas", label: "Tarefas", icon: ListChecks },
  { to: "/roteiros", label: "Roteiros", icon: RouteIcon },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { session, member, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const qc = useQueryClient();
  const leadsQ = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}) });
  const leadsCount = leadsQ.data?.length ?? 0;
  const showAdmin = isSuperAdminEmail(session?.user?.email);
  const nav = showAdmin ? NAV : NAV.filter((i) => i.to !== "/admin");
  const mobileNav = showAdmin ? MOBILE_NAV : MOBILE_NAV.filter((i) => i.to !== "/admin");

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
        <div className={`flex items-center gap-2 py-5 ${collapsed ? "justify-center px-2" : "px-5"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <RouteIcon className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="animate-fade-in whitespace-nowrap text-lg font-extrabold tracking-tight">
              Mapa<span className="text-primary">PRO</span>
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
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
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 px-3 pb-4">
          <div
            className={`flex items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Bot className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="animate-fade-in whitespace-nowrap">Thay IA</span>}
          </div>
          {collapsed ? (
            <div
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: member?.avatar_color || "#ff7a1a" }}
              title={member?.name || "Usuário"}
            >
              {initials(member?.name)}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-sidebar-border px-3 py-2.5">
              <div className="flex items-center gap-2 overflow-hidden">
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
              </div>
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <RouteIcon className="h-4 w-4" />
            </div>
            <span className="text-base font-extrabold tracking-tight">
              Mapa<span className="text-primary">PRO</span>
            </span>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted md:block"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              aria-label="Alternar tema"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-5 pb-24 sm:px-5 sm:py-6 md:pb-6">
          {children}
        </main>
      </div>

      {/* Barra de navegação inferior (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {mobileNav.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
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
