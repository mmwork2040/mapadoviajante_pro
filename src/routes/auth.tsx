import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { applyBrandColor, PRODUCT } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { appwriteAuthService } from "@/services/appwriteAuthService";

export const Route = createFileRoute("/auth")({
  ssr: false,
  // ?mode=signup abre direto no cadastro (vindo da página /conheca).
  validateSearch: (search: Record<string, unknown>): { mode?: string } =>
    typeof search.mode === "string" ? { mode: search.mode } : {},
  head: () => ({
    meta: [
      { title: `Entrar — ${PRODUCT.name}` },
      { name: "description", content: `Acesse o ${PRODUCT.name}, o CRM para agências de viagem.` },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  // forgot = pedir link por e-mail; reset = criar nova senha pelo link recebido
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">("login");
  const [recovery, setRecovery] = useState<{ userId: string; secret: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // A tela de login é do produto: tira a cor da agência que estava em cache.
  useEffect(() => {
    applyBrandColor(null);
  }, []);

  useEffect(() => {
    if (session && mode !== "reset") navigate({ to: "/", replace: true });
  }, [session, mode, navigate]);

  // O link de recuperação do Appwrite volta para /auth?mode=reset&userId=...&secret=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    const secret = params.get("secret");
    if (params.get("mode") === "reset" && userId && secret) {
      setRecovery({ userId, secret });
      setMode("reset");
    }
    if (params.get("mode") === "signup") setMode("signup");
    if (params.get("error") === "oauth_failed") {
      setError("Não foi possível entrar com o Google. Tente novamente.");
    }
  }, []);

  function switchMode(next: "login" | "signup" | "forgot") {
    setMode(next);
    setError("");
    setInfo("");
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    if (mode === "forgot") {
      try {
        await appwriteAuthService.requestPasswordRecovery(email);
        setInfo("Se este e-mail tiver conta, enviamos um link para criar uma nova senha. Confira também o spam.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
      }
    } else if (mode === "reset") {
      try {
        if (!recovery) throw new Error("Link inválido. Peça um novo link de recuperação.");
        await appwriteAuthService.confirmPasswordRecovery(recovery.userId, recovery.secret, password);
        window.history.replaceState(null, "", "/auth");
        setRecovery(null);
        setMode("login");
        setPassword("");
        setInfo("Senha criada! Agora entre com seu e-mail e a nova senha.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível criar a nova senha.");
      }
    } else if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else navigate({ to: "/", replace: true });
    } else {
      const { error, needsConfirmation } = await signUp(name, email, password);
      if (error) setError(error);
      else if (needsConfirmation)
        setInfo("Conta criada! Verifique seu e-mail para confirmar e depois faça login.");
      else navigate({ to: "/", replace: true });
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo heightClass="h-10" nameClass="text-[30px]" />
        </div>

        <h1 className="text-2xl font-bold">
          {mode === "login"
            ? "Bem-vindo de volta"
            : mode === "signup"
              ? "Criar conta"
              : mode === "forgot"
                ? "Recuperar senha"
                : "Criar nova senha"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Entre para cuidar das viagens e dos viajantes."
            : mode === "signup"
              ? `Comece a usar o ${PRODUCT.name} na sua agência.`
              : mode === "forgot"
                ? "Informe o e-mail da sua conta. Vale também para quem sempre entrou pelo Google e quer uma senha."
                : "Escolha uma senha com pelo menos 8 caracteres."}
        </p>

        {(mode === "login" || mode === "signup") && (<>

        {/* Botão Google OAuth Appwrite */}
        <div className="mt-6">
          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background py-3 font-semibold text-foreground shadow-sm transition hover:bg-muted active:scale-[0.99]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar com o Google</span>
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-3 text-muted-foreground font-medium">ou com e-mail e senha</span>
          </div>
        </div>
        </>)}

        <form onSubmit={handleSubmit} className={`space-y-4 ${mode === "forgot" || mode === "reset" ? "mt-6" : ""}`}>
          {mode === "signup" && (
            <Field label="Nome completo">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Seu nome"
              />
            </Field>
          )}
          {mode !== "reset" && (
          <Field label="E-mail">
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="voce@agencia.com"
            />
          </Field>
          )}
          {mode !== "forgot" && (
          <Field label={mode === "reset" ? "Nova senha" : "Senha"}>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "login" ? 1 : 8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
            />
          </Field>
          )}
          {mode === "login" && (
            <div className="-mt-2 text-right">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Esqueci minha senha / criar senha
              </button>
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          {info && <p className="text-sm font-medium text-[var(--success)]">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-60 active:scale-[0.99]"
          >
            {loading
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : mode === "forgot"
                    ? "Enviar link"
                    : "Salvar nova senha"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Não tem conta?" : mode === "signup" ? "Já tem conta?" : ""}{" "}
          <button
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "login" ? "Cadastre-se" : "Voltar para o login"}
          </button>
        </p>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <a href="/conheca.html" className="font-medium text-primary hover:underline">
            Conheça o sistema e teste a demonstração
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link to="/intake" className="hover:underline">
            Formulário público de captação →
          </Link>
        </p>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--input);
          background: var(--background);
          padding: 0.65rem 0.85rem;
          font-size: 0.9rem;
          outline: none;
        }
        .input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(255,122,26,.15); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
