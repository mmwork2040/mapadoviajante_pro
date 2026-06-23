import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmProvider } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { session, loading, member, pendingInvite, acceptPendingInvite, signOut } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!session) return null;

  // Usuário com convite pendente: não acessa o sistema até aceitar.
  if (!member && pendingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--accent)] px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold">Convite pendente</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você foi convidado para participar da equipe da agência{" "}
            <strong>{pendingInvite.agency_name}</strong>. Aceite o convite para acessar o sistema.
          </p>
          {acceptError && <p className="mt-3 text-sm text-destructive">{acceptError}</p>}
          <button
            disabled={accepting}
            onClick={async () => {
              setAcceptError("");
              setAccepting(true);
              const res = await acceptPendingInvite();
              setAccepting(false);
              if (!res.ok) setAcceptError(res.error ?? "Não foi possível aceitar.");
            }}
            className="mt-5 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {accepting ? "Aguarde…" : "Aceitar convite"}
          </button>
          <button
            onClick={() => signOut()}
            className="mt-3 w-full rounded-xl border border-input py-2.5 text-sm font-medium hover:bg-muted"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <ConfirmProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
      <Toaster richColors position="top-right" />
    </ConfirmProvider>
  );
}
