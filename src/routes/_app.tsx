import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmProvider } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { session, loading, member, pendingInvite, acceptPendingInvite, signOut, accessStatus, refreshMember } =
    useAuth();
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
            className="mt-5 w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {accepting ? "Aguarde…" : "Aceitar convite"}
          </button>
          <button
            onClick={() => signOut()}
            className="mt-3 w-full rounded-lg border border-input py-2.5 text-sm font-medium hover:bg-muted"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  // Sem agência liberada: explica o motivo e o que fazer.
  if (!member && accessStatus && accessStatus !== "ok") {
    return (
      <AccessGate
        status={accessStatus}
        email={session.user?.email ?? ""}
        onRetry={refreshMember}
        onSignOut={signOut}
      />
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

const SUPPORT_TEXT = "Se precisar de ajuda, fale com o suporte do Mapa do Viajante PRO.";

function AccessGate({
  status,
  email,
  onRetry,
  onSignOut,
}: {
  status: string;
  email: string;
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  const content: Record<string, { title: string; text: React.ReactNode }> = {
    pending: {
      title: "Aguardando liberação",
      text: (
        <>
          Sua conta foi criada, mas o acesso ao Mapa do Viajante PRO é liberado após a compra. Use o{" "}
          <strong>mesmo e-mail da compra na Hotmart</strong>: <strong>{email}</strong>. Se você já comprou, a
          liberação pode levar alguns minutos.
        </>
      ),
    },
    verify_email: {
      title: "Confirme seu e-mail",
      text: (
        <>
          Seu acesso está liberado. Para segurança, confirme que o e-mail <strong>{email}</strong> é seu: enviamos um
          link de confirmação ao clicar no botão abaixo.
        </>
      ),
    },
    blocked: {
      title: "Acesso bloqueado",
      text: "Seu acesso a esta agência foi bloqueado pelo administrador. Fale com o administrador da sua agência.",
    },
    suspended: {
      title: "Acesso suspenso",
      text: "O acesso da sua agência está suspenso. Os dados continuam guardados e voltam assim que o acesso for reativado.",
    },
    invite: {
      title: "Convite pendente",
      text: "Você tem um convite para entrar em uma equipe. Abra o link do convite que chegou no seu e-mail para aceitar.",
    },
    error: {
      title: "Não foi possível carregar sua agência",
      text: "Verifique sua conexão e tente de novo.",
    },
  };
  const c = content[status] ?? content.error;

  async function sendVerification() {
    setBusy(true);
    setInfo("");
    try {
      const { account } = await import("@/integrations/appwrite/client");
      await account.createVerification(`${window.location.origin}/auth?mode=verify`);
      setInfo("Enviamos o link de confirmação. Confira sua caixa de entrada e o spam.");
    } catch (err) {
      setInfo(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--accent)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{c.text}</p>
        {info && <p className="mt-3 text-sm font-medium text-foreground">{info}</p>}
        {status === "verify_email" && (
          <button
            disabled={busy}
            onClick={sendVerification}
            className="mt-5 w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Enviar link de confirmação"}
          </button>
        )}
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onRetry();
            setBusy(false);
          }}
          className={`${status === "verify_email" ? "mt-3 border border-input hover:bg-muted" : "mt-5 bg-primary text-primary-foreground hover:opacity-90"} w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60`}
        >
          {status === "pending" ? "Já comprei, verificar de novo" : "Verificar de novo"}
        </button>
        <button
          onClick={() => onSignOut()}
          className="mt-3 w-full rounded-lg border border-input py-2.5 text-sm font-medium hover:bg-muted"
        >
          Sair
        </button>
        <p className="mt-5 text-xs text-muted-foreground">{SUPPORT_TEXT}</p>
      </div>
    </div>
  );
}
