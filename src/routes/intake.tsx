import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Route as RouteIcon, ArrowLeft, Loader2 } from "lucide-react";
import { getPublicFormEmbed } from "@/lib/form-embed.functions";

export const Route = createFileRoute("/intake")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ a: typeof s.a === "string" ? s.a : "" }),
  head: () => ({
    meta: [
      { title: "Solicite seu orçamento — Mapa do Viajante PRO" },
      { name: "description", content: "Conte sobre a viagem dos seus sonhos e receba uma proposta." },
    ],
  }),
  component: IntakePage,
});

// Formulário padrão caso nenhum tenha sido configurado na Administração.
const FORM_SRC =
  "https://vibeform-studio.vercel.app/f/5c10e7f7-7ee1-48bc-a138-0ac0d9a79844?db=https%3A%2F%2Fddulmdacvcnkdkzwmsbz.supabase.co&key=sb_publishable_YDG_GPuhlQSsI5PAtkNDYQ_2ti_rODr";

function IntakePage() {
  const { a } = Route.useSearch();
  const [freshSrc, setFreshSrc] = useState<string | null>(null);

  // Sempre carrega o formulário configurado na Administração (com cache-buster),
  // recriando o iframe do zero a cada abertura. Cai no padrão se não houver config.
  useEffect(() => {
    let active = true;
    getPublicFormEmbed({ data: { agency: a || undefined } })
      .then((r) => {
        const base = r.src || FORM_SRC;
        if (active) setFreshSrc(`${base}${base.includes("?") ? "&" : "?"}_t=${Date.now()}`);
      })
      .catch(() => {
        if (active) setFreshSrc(`${FORM_SRC}&_t=${Date.now()}`);
      });
    return () => {
      active = false;
    };
  }, [a]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--accent)] px-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <RouteIcon className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            Mapa<span className="text-primary">PRO</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold">Vamos planejar sua viagem ✈️</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preencha e receba uma proposta personalizada.</p>

        {freshSrc ? (
          <iframe
            key={freshSrc}
            src={freshSrc}
            title="Formulário de captação"
            width="100%"
            height="600"
            className="mt-6 w-full rounded-[10px] border-none"
            style={{ overflow: "hidden" }}
          />
        ) : (
          <div className="mt-6 flex h-[600px] w-full items-center justify-center rounded-[10px] bg-muted/40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <Link
          to="/auth"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à página de Login
        </Link>
      </div>
    </div>
  );
}
