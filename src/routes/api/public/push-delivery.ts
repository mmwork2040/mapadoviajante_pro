import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const AckSchema = z.object({
  traceId: z.string().uuid(),
  ackSecret: z.string().min(20).max(200),
  deviceState: z.string().max(40).optional(),
});

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export const Route = createFileRoute("/api/public/push-delivery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof AckSchema>;
        try {
          body = AckSchema.parse(await request.json());
        } catch {
          return json({ ok: false }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const key = `push_delivery:${body.traceId}`;
        const { data: row } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", key)
          .maybeSingle();

        const value = (row?.value ?? {}) as { ackSecret?: string; [key: string]: unknown };
        if (!value.ackSecret || value.ackSecret !== body.ackSecret) {
          return json({ ok: false }, { status: 401 });
        }

        const receivedAt = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("system_settings")
          .update({
            value: {
              ...value,
              status: "received",
              receivedAt,
              deviceState: body.deviceState ?? "received",
              message: "Dispositivo confirmou recebimento.",
            } as never,
            updated_at: receivedAt,
          })
          .eq("key", key);

        if (error) return json({ ok: false }, { status: 500 });
        return json({ ok: true });
      },
    },
  },
});