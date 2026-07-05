import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Mapa do Viajante PRO" },
      { name: "description", content: "Acesse o CRM Copilot para agências de viagem." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/", replace: true });
  }, [session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    if (mode === "login") {
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--accent)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <RouteIcon className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            Mapa<span className="text-primary">PRO</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold">{mode === "login" ? "Bem-vindo de volta" : "Criar conta"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Entre para gerenciar leads e roteiros."
            : "Comece a usar o CRM Copilot para sua agência."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <Field label="Senha">
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-[var(--success)]">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setInfo("");
            }}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "login" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
        <p className="mt-4 text-center text-xs text-muted-foreground">
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
