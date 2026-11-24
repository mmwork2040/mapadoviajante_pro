import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Webhook da Hotmart (versão 2.0). Cadastre na Hotmart:
//   URL: https://<seu domínio>/api/public/hotmart-webhook
//   Eventos: compra aprovada/completa, reembolso, chargeback, cancelamento
// Variáveis no servidor (Vercel):
//   HOTMART_HOTTOK       token "hottok" exibido na configuração do webhook
//   HOTMART_PRODUCT_IDS  (opcional) IDs dos produtos que liberam acesso, separados por vírgula
//
// Antes de ligar em produção, confira os nomes dos campos e eventos na
// documentação atual da Hotmart.

const PayloadSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    event: z.string().min(1).max(80),
    data: z
      .object({
        buyer: z.object({ email: z.string().optional() }).passthrough().optional(),
        product: z.object({ id: z.union([z.string(), z.number()]).optional() }).passthrough().optional(),
        purchase: z.object({ transaction: z.string().optional() }).passthrough().optional(),
        subscription: z
          .object({ subscriber: z.object({ code: z.string().optional() }).passthrough().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** Comparação em tempo constante, para não vazar o token por tempo de resposta. */
function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hotmart-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = (process.env.HOTMART_HOTTOK || "").trim();
        const received = (request.headers.get("x-hotmart-hottok") || "").trim();
        if (!expected || !received || !safeEqual(received, expected)) {
          return json({ ok: false }, 401);
        }

        let payload: z.infer<typeof PayloadSchema>;
        try {
          payload = PayloadSchema.parse(await request.json());
        } catch {
          return json({ ok: false }, 400);
        }

        const access = await import("@/lib/server/access");
        const email = payload.data?.buyer?.email ? access.normEmail(payload.data.buyer.email) : null;
        const productId = payload.data?.product?.id != null ? String(payload.data.product.id) : null;
        const transaction = payload.data?.purchase?.transaction ?? null;
        const subscriberCode = payload.data?.subscription?.subscriber?.code ?? null;
        const eventId = String(payload.id ?? `${payload.event}:${transaction ?? email ?? Date.now()}`)
          .replace(/[^a-zA-Z0-9:_-]/g, "")
          .slice(0, 120);

        const log = async (result: "applied" | "ignored" | "error", detail: string) =>
          access.saveHotmartEvent({
            id: eventId,
            event: payload.event,
            email,
            productId,
            transaction,
            result,
            detail,
            receivedAt: new Date().toISOString(),
          });

        try {
          // Mesmo evento enviado de novo: não aplica duas vezes.
          const seen = await access.getHotmartEvent(eventId);
          if (seen && seen.result !== "error") return json({ ok: true, duplicate: true });

          const allowed = (process.env.HOTMART_PRODUCT_IDS || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (allowed.length && (!productId || !allowed.includes(productId))) {
            await log("ignored", "Produto fora da lista HOTMART_PRODUCT_IDS.");
            return json({ ok: true });
          }
          if (!email) {
            await log("ignored", "Evento sem e-mail do comprador.");
            return json({ ok: true });
          }

          const effect = access.hotmartEffect(payload.event);
          if (effect === "none") {
            await log("ignored", "Evento sem efeito automático — avalie no painel.");
            return json({ ok: true });
          }

          const current = await access.getGrant(email);
          const base = current ?? access.newGrant(email, "hotmart");
          const next = {
            ...base,
            status: effect === "activate" ? ("active" as const) : ("suspended" as const),
            productId: productId ?? base.productId ?? null,
            transaction: transaction ?? base.transaction ?? null,
            subscriberCode: subscriberCode ?? base.subscriberCode ?? null,
            lastEvent: payload.event,
          };
          await access.saveGrant(next);
          const overridden = base.override !== "none";
          await log(
            "applied",
            effect === "activate"
              ? `Acesso liberado${overridden ? " (decisão manual do super admin continua valendo)" : ""}.`
              : `Acesso suspenso${overridden ? " (decisão manual do super admin continua valendo)" : ""}.`,
          );
          return json({ ok: true });
        } catch (err) {
          console.error("hotmart-webhook:", err);
          try {
            await log("error", "Falha ao gravar; a Hotmart vai reenviar.");
          } catch {
            /* sem log */
          }
          // 500 faz a Hotmart tentar de novo.
          return json({ ok: false }, 500);
        }
      },
    },
  },
});
