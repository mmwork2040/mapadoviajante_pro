import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getPublicFormEmbed } from "@/lib/form-embed.functions";
import { getPublicBrand } from "@/lib/brand.functions";
import { BrandLogo } from "@/components/BrandLogo";
import { applyBrandColor, PRODUCT, type Brand } from "@/lib/brand";

export const Route = createFileRoute("/intake")({
  ssr: false,
  validateSearch: (s: { a?: unknown }): { a?: string } => (typeof s.a === "string" ? { a: s.a } : {}),
  head: () => ({
    meta: [
      { title: `Solicite seu orçamento — ${PRODUCT.name}` },
      { name: "description", content: "Conte sobre a viagem dos seus sonhos e receba uma proposta." },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  const { a } = Route.useSearch();
  // undefined = carregando; null = a agência ainda não configurou o formulário.
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  const [brand, setBrand] = useState<Brand | null>(null);

  // Carrega o formulário configurado na Administração (com cache-buster),
  // recriando o iframe do zero a cada abertura.
  useEffect(() => {
    let active = true;
    setSrc(undefined);
    getPublicFormEmbed({ data: { agency: a || undefined } })
      .then((r) => {
        if (!active) return;
        setSrc(r.src ? `${r.src}${r.src.includes("?") ? "&" : "?"}_t=${Date.now()}` : null);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [a]);

  // Página do cliente da agência: usa a logo e a cor dela quando o link traz a agência.
  useEffect(() => {
    let active = true;
    applyBrandColor(null);
    if (!a) {
      setBrand(null);
      return;
    }
    getPublicBrand({ data: { agency: a } })
      .then((b) => {
        if (!active) return;
        setBrand(b);
        applyBrandColor(b?.primary);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [a]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-[28px] border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandLogo brand={brand} heightClass="h-10" nameClass="text-xl" />
        </div>

        <h1 className="text-2xl font-bold">Vamos planejar sua viagem</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preencha e receba uma proposta personalizada.</p>

        {src === undefined ? (
          <div className="mt-6 flex h-[600px] w-full items-center justify-center rounded-[18px] bg-muted/40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : src ? (
          <iframe
            key={src}
            src={src}
            title="Formulário de captação"
            width="100%"
            height="600"
            className="mt-6 w-full rounded-[18px] border-none"
            style={{ overflow: "hidden" }}
          />
        ) : (
          <div className="mt-6 rounded-[18px] border border-dashed border-border px-6 py-12 text-center">
            <p className="font-semibold">Formulário indisponível no momento</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Fale com a agência pelo contato que você recebeu. Se você é da equipe, configure o formulário em
              Equipe e configurações.
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
