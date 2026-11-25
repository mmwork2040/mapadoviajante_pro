import { createFileRoute } from "@tanstack/react-router";

// Webhook público do Asaas — um por agência, identificado pelo token na URL:
//   /api/public/asaas-webhook?token=<asaas_webhook_token da agência>
// Configure essa URL no painel do Asaas de cada agência.
// A rota /api/public/* não exige autenticação, por isso validamos o token.

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return new Response("Missing token", { status: 401 });

        const body = await request.text();
        let event: any;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Identifica a agência pelo token do webhook.
        const { data: cfg } = await (supabaseAdmin as any)
          .from("agency_payment_settings")
          .select("agency_id, is_active")
          .eq("asaas_webhook_token", token)
          .maybeSingle();

        if (!cfg?.agency_id) return new Response("Unknown token", { status: 401 });

        // Evento válido e atribuído a uma agência. Aqui pode-se atualizar
        // assinaturas/transações da agência conforme event.event / event.payment.
        // Mantemos idempotente e tolerante a falhas para não reenfileirar no Asaas.
        console.info("Asaas webhook", {
          agency_id: cfg.agency_id,
          event: event?.event,
          paymentId: event?.payment?.id,
          status: event?.payment?.status,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
