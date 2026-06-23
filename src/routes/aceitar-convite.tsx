import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getInviteInfo, acceptInvite, type InviteInfo } from "@/lib/invites";

export const Route = createFileRoute("/aceitar-convite")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  head: () => ({ meta: [{ title: "Aceitar convite — O Segredo do Viajante" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { session, refreshMember } = useAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) sessionStorage.setItem("invite_token", token);
    getInviteInfo(token).then((i) => {
      setInfo(i);
      if (i.name) setName(i.name);
      setLoadingInfo(false);
    });
  }, [token]);

  // Se já estiver logado com o e-mail certo, aceita direto.
  useEffect(() => {
    if (!session || !info?.valid) return;
    (async () => {
      const res = await acceptInvite(token);
      sessionStorage.removeItem("invite_token");
      if (res.ok) {
        await refreshMember();
        navigate({ to: "/", replace: true });
      } else {
        setError(res.error ?? "Não foi possível aceitar o convite.");
      }
    })();
  }, [session, info, token, refreshMember, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!info?.email) return;
    setError("");
    setBusy(true);
    sessionStorage.setItem("invite_token", token);
    try {
      if (mode === "signup") {
        const { error: signErr } = await supabase.auth.signUp({
          email: info.email,
          password,
          options: { data: { name }, emailRedirectTo: `${window.location.origin}/aceitar-convite?token=${token}` },
        });
        if (signErr) {
          if (signErr.message.includes("already registered")) {
            setMode("login");
            setError("Este e-mail já tem conta. Faça login para aceitar.");
          } else setError(signErr.message);
          setBusy(false);
          return;
        }
      } else {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        });
        if (signErr) {
          setError("E-mail ou senha inválidos.");
          setBusy(false);
          return;
        }
      }
      // O aceite ocorre no efeito acima quando a sessão é estabelecida.
      const res = await acceptInvite(token);
      sessionStorage.removeItem("invite_token");
      if (res.ok) {
        await refreshMember();
        navigate({ to: "/", replace: true });
      } else if (res.error) {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--accent)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <RouteIcon className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">O Segredo do Viajante</span>
        </div>

        {loadingInfo ? (
          <p className="text-sm text-muted-foreground">Carregando convite…</p>
        ) : !info?.valid ? (
          <div>
            <h1 className="text-xl font-bold">Convite inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este convite não existe ou já foi utilizado. Peça um novo convite ao administrador.
            </p>
          </div>
        ) : session ? (
          <p className="text-sm text-muted-foreground">Confirmando seu convite…</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Você foi convidado!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Participe da equipe da agência <strong>{info.agency_name}</strong>.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">E-mail do convite</span>
                <input
                  className="w-full rounded-xl border border-input bg-muted px-3.5 py-2.5 text-sm text-muted-foreground"
                  value={info.email ?? ""}
                  disabled
                  readOnly
                />
              </label>
              {mode === "signup" && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Seu nome</span>
                  <input
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  {mode === "signup" ? "Crie uma senha" : "Sua senha"}
                </span>
                <input
                  type="password"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Aguarde…" : mode === "signup" ? "Aceitar e criar conta" : "Aceitar e entrar"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setError("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                {mode === "signup" ? "Entrar" : "Criar conta"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
