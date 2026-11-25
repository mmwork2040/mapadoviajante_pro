import { createFileRoute } from "@tanstack/react-router";

// Entrega a logo da agência (white-label):
//   GET /api/public/brand-logo?agency=<id>&v=light|dark
//
// É pública porque a logo aparece no login do cliente, no roteiro
// compartilhado e nos e-mails. Só entrega o arquivo que a agência configurou
// como logo, nunca outro arquivo do bucket, e só se for imagem.

export const Route = createFileRoute("/api/public/brand-logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const agency = url.searchParams.get("agency") || "";
        const variant = url.searchParams.get("v") === "dark" ? "dark" : "light";
        try {
          const { fetchBrandLogo } = await import("@/lib/server/brand");
          const logo = await fetchBrandLogo(agency, variant);
          if (!logo) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
          return new Response(logo.body, {
            headers: {
              "content-type": logo.type,
              // O endereço muda quando a logo muda (parâmetro f), então pode guardar.
              "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
              "x-content-type-options": "nosniff",
              // Um SVG aberto direto nesta rota não pode rodar script nem carregar nada.
              "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            },
          });
        } catch (err) {
          console.error("brand-logo failed", err);
          return new Response("Unavailable", { status: 503, headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});
