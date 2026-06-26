import { createFileRoute } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";

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

function IntakePage() {
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

        <iframe
          src="https://vibeform-studio.vercel.app/f/demo-form-token-123"
          title="Formulário de captação"
          width="100%"
          height="600"
          className="mt-6 w-full rounded-[10px] border-none"
          style={{ overflow: "hidden" }}
        />
      </div>
    </div>
  );
}
