import { type ReactNode, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Route as RouteIcon,
  Images,
  Wallet,
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, initials } from "@/lib/ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/roteiros", label: "Roteiros", icon: RouteIcon },
  { to: "/biblioteca", label: "Biblioteca", icon: Images },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin", label: "Administração", icon: ShieldCheck },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { member, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

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
            <span className="text-lg font-extrabold tracking-tight">
              Mapa<span className="text-primary">PRO</span>
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && label}
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
            {!collapsed && "Thay IA"}
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur">
          <nav className="flex items-center gap-1 overflow-x-auto md:hidden">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  className={`rounded-lg p-2 ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted md:block"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
