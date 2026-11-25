import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import logoBranco from "@/assets/osv-logo-branco.svg";
import logoPreto from "@/assets/osv-logo-preto.svg";
import { getPublicFormEmbed } from "@/lib/form-embed.functions";

export const Route = createFileRoute("/intake")({
  ssr: false,
  validateSearch: (s: { a?: unknown }): { a?: string } => (typeof s.a === "string" ? { a: s.a } : {}),
  head: () => ({
    meta: [
      { title: "Solicite seu orçamento — Mapa do Viajante PRO" },
      { name: "description", content: "Conte sobre a viagem dos seus sonhos e receba uma proposta." },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  const { a } = Route.useSearch();
  // undefined = carregando; null = a agência ainda não configurou um formulário.
  const [freshSrc, setFreshSrc] = useState<string | null | undefined>(undefined);

  // Sempre carrega o formulário configurado na Administração (com cache-buster),
  // recriando o iframe do zero a cada abertura.
  useEffect(() => {
    let active = true;
    getPublicFormEmbed({ data: { agency: a || undefined } })
      .then((r) => {
        if (!active) return;
        setFreshSrc(r.src ? `${r.src}${r.src.includes("?") ? "&" : "?"}_t=${Date.now()}` : null);
      })
      .catch(() => {
        if (active) setFreshSrc(null);
      });
    return () => {
      active = false;
    };
  }, [a]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-[28px] border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <img src={logoBranco} alt="O Segredo do Viajante" className="hidden h-11 w-auto dark:block" />
          <img src={logoPreto} alt="O Segredo do Viajante" className="block h-11 w-auto dark:hidden" />
        </div>

        <h1 className="text-2xl font-bold">Vamos planejar a sua viagem</h1>
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
        ) : freshSrc === undefined ? (
          <div className="mt-6 flex h-[600px] w-full items-center justify-center rounded-[10px] bg-muted/40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 rounded-[18px] border border-dashed border-border px-6 py-12 text-center">
            <p className="font-semibold">O formulário ainda não está disponível</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fale com a sua consultora para planejar a viagem.
            </p>
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
