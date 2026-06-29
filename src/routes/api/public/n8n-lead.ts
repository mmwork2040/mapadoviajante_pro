import { createFileRoute } from "@tanstack/react-router";

// Endpoint público para o n8n enviar leads (HTTP Request node).
//   POST /api/public/n8n-lead
//   Header: x-webhook-secret: <N8N_LEAD_WEBHOOK_SECRET>
//   Body: JSON do formulário (campos em português, conforme webhook do n8n).
//
// A rota /api/public/* não exige autenticação; por isso validamos o segredo
// compartilhado e usamos a service role key para gravar, já que o n8n não
// possui sessão de usuário.

function s(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
}

function num(v: unknown): number | undefined {
  const t = s(v);
  if (!t) return undefined;
  const n = Number(t.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  });
}

function text(body: string, init?: ResponseInit) {
  return new Response(body, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  });
}

export const Route = createFileRoute("/api/public/n8n-lead")({
  server: {
    handlers: {
      OPTIONS: async () => text(null as unknown as string, { status: 204 }),
      GET: async ({ request }) => {
        // Diagnóstico opcional: ?diag=1 verifica se o cliente admin lê agencies.
        if (new URL(request.url).searchParams.get("diag")) {
          try {
            const { supabaseAdmin } = await import(
              "@/integrations/supabase/client.server"
            );
            const { data, error } = await (supabaseAdmin as any)
              .from("agencies")
              .select("id", { count: "exact", head: false })
              .limit(5);
            return json({
              diag: true,
              agenciesReadable: Array.isArray(data) ? data.length : 0,
              error: error?.message ?? null,
            });
          } catch (e) {
            return json({
              diag: true,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
        return json({
          ok: true,
          endpoint: "/api/public/n8n-lead",
          method: "POST",
          requiredHeaders: ["content-type: application/json", "x-webhook-secret"],
        });
      },

      POST: async ({ request }) => {
        try {
          const envSecret = s(process.env.N8N_LEAD_WEBHOOK_SECRET);
          const provided = s(
            request.headers.get("x-webhook-secret") ??
              new URL(request.url).searchParams.get("secret"),
          );
          if (!provided) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }
          // O segredo pode vir do env (global) ou da configuração da agência
          // (Administração → Integração n8n). A validação por banco acontece
          // após carregar o supabaseAdmin, pois identifica também a agência.
          const envMatch = Boolean(envSecret) && provided === envSecret;


          // Lê o corpo como texto e tenta parsear de forma tolerante:
          // remove BOM/espaços, aceita JSON puro, ou form-urlencoded.
          let raw: any;
          const body = (await request.text()).replace(/^\uFEFF/, "").trim();
          if (!body) {
            return json({ error: "Empty body" }, { status: 400 });
          }
          try {
            raw = JSON.parse(body);
          } catch {
            const ct = request.headers.get("content-type") ?? "";
            if (ct.includes("application/x-www-form-urlencoded")) {
              raw = Object.fromEntries(new URLSearchParams(body));
            } else {
              // Tenta extrair o primeiro bloco JSON de um texto misto.
              const m = body.match(/[{[][\s\S]*[}\]]/);
              if (m) {
                try {
                  raw = JSON.parse(m[0]);
                } catch {
                  return json({ error: "Invalid JSON" }, { status: 400 });
                }
              } else {
                return json({ error: "Invalid JSON" }, { status: 400 });
              }
            }
          }

          // Aceita o payload direto, dentro de { body } ou como array [{...}].
          const p: any = Array.isArray(raw) ? raw[0] : raw;
          const d: any = p?.body ?? p ?? {};

          const name = s(d.nome) ?? s(d.name);
          if (!name) {
            return json({ error: "Missing 'nome'" }, { status: 400 });
          }

          let supabaseAdmin: (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
          try {
            ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
          } catch (error) {
            console.error("n8n-lead: supabase admin client unavailable", error);
            return json(
              {
                error: "Server not configured: missing SUPABASE_SERVICE_ROLE_KEY",
              },
              { status: 503 },
            );
          }

          // Valida o segredo pela configuração da agência, quando não bate com o env.
          // A chave em system_settings é "agency_cfg:{agencyId}:n8n" e o valor
          // contém { secret }. O segredo também identifica a agência.
          let secretAgencyId: string | undefined;
          if (!envMatch) {
            const { data: rows, error: cfgErr } = await (supabaseAdmin as any)
              .from("system_settings")
              .select("key,value")
              .like("key", "agency_cfg:%:n8n");
            if (cfgErr) {
              console.error("n8n-lead secret-lookup error", cfgErr);
              return json({ error: "Auth lookup failed" }, { status: 500 });
            }
            const match = (rows ?? []).find(
              (r: any) => s(r?.value?.secret) && s(r.value.secret) === provided,
            );
            if (!match) {
              return json({ error: "Unauthorized" }, { status: 401 });
            }
            const parts = String(match.key).split(":");
            secretAgencyId = parts[1];
          }

          // Resolve a agência: pelo segredo, por id, por slug, ou a primeira cadastrada.
          let agencyId = secretAgencyId ?? s(d.agency_id);
          if (!agencyId) {
            const slug = s(d.agency_slug) ?? s(d.agency);
            if (slug) {
              const { data: ag, error: agErr } = await (supabaseAdmin as any)
                .from("agencies")
                .select("id")
                .eq("slug", slug)
                .maybeSingle();
              if (agErr) {
                console.error("n8n-lead agency-by-slug error", agErr);
                return json({ error: `Agency lookup failed: ${agErr.message}` }, { status: 500 });
              }
              agencyId = ag?.id ?? undefined;
            }
          }
          if (!agencyId) {
            const { data: ag, error: agErr } = await (supabaseAdmin as any)
              .from("agencies")
              .select("id")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (agErr) {
              console.error("n8n-lead agency-first error", agErr);
              return json({ error: `Agency lookup failed: ${agErr.message}` }, { status: 500 });
            }
            agencyId = ag?.id ?? undefined;
          }
          if (!agencyId) {
            return json({ error: "No agency found" }, { status: 422 });
          }

          // Aceita "período" (ex: "2026-10-01 à 2026-10-11") além de data_ida/data_volta.
          const periodo = s(d["período"]) ?? s(d.periodo);
          let dataIda = s(d.data_ida);
          let dataVolta = s(d.data_volta);
          if ((!dataIda || !dataVolta) && periodo) {
            const parts = periodo.split(/\s*(?:à|a|até|-|—|–)\s*/i).map((x) => x.trim());
            dataIda = dataIda ?? parts[0];
            dataVolta = dataVolta ?? parts[1];
          }
          const travelDates =
            dataIda || dataVolta
              ? [dataIda, dataVolta].filter(Boolean).join(" a ")
              : (periodo ?? s(d.travel_dates));
          const passengers = num(d.viajantes) ?? num(d.passageiros);


          const notesParts = [s(d.observacoes), s(d.nao_abre_mao)].filter(Boolean);

          // Monta o profile (jsonb) reaproveitando o máximo de campos.
          const profile: Record<string, unknown> = {
            travel_dates: travelDates,
            passengers,
            trip_type: s(d.tipo_viajante) ?? s(d.perfil_viajante),
            loyalty_programs: s(d.milhas_programa),
            points_miles: s(d.conhecimento_milhas),
            hotel_category: s(d.hospedagem) ?? s(d.tipo_hospedagem),
            preferences: [
              s(d.restaurantes) && `Restaurantes: ${s(d.restaurantes)}`,
              s(d.sala_vip) && `Sala VIP: ${s(d.sala_vip)}`,
              (s(d.mala) ?? s(d.despachar_mala)) && `Mala: ${s(d.mala) ?? s(d.despachar_mala)}`,
              s(d.flexibilidade) && `Flexibilidade: ${s(d.flexibilidade)}`,
            ]

              .filter(Boolean)
              .join(" | ") || undefined,
            departure_airport: s(d.aeroporto_partida),
            arrival_airport: s(d.aeroporto_chegada),
            home_city: s(d.cidade_mora),
            utm: {
              source: s(d.utm_source),
              medium: s(d.utm_medium),
              campaign: s(d.utm_campaign),
              content: s(d.utm_content),
              term: s(d.utm_term),
            },
            page_url: s(d.page_url),
          };
          // Remove chaves vazias.
          Object.keys(profile).forEach((k) => profile[k] === undefined && delete profile[k]);

          const value = num(d.orcamento_total) ?? num(d.orcamento_passagem_valor);
          const destination = s(d.destino) ?? s(d.destination);
          const email = s(d.email);

          // Verifica se o lead já existe (mesma agência, mesmo e-mail).
          if (email) {
            const { data: existing } = await (supabaseAdmin as any)
              .from("crm_leads")
              .select("id")
              .eq("agency_id", agencyId)
              .ilike("email", email)
              .maybeSingle();
            if (existing?.id) {
              return json({
                ok: true,
                lead_id: existing.id,
                itinerary_id: null,
                ready_for_itinerary: false,
                already_exists: true,
              });
            }
          }

          const { data: lead, error } = await (supabaseAdmin as any)
            .from("crm_leads")
            .insert({
              agency_id: agencyId,
              name,
              email,
              phone: s(d.whatsapp) ?? s(d.telefone) ?? s(d.phone),
              destination,
              value: value ?? 0,
              origin: s(d.utm_source) ?? s(d.servico) ?? "n8n",
              status: "new",
              notes: notesParts.length ? notesParts.join("\n\n") : undefined,
              profile,
            })
            .select("id")
            .single();

          if (error) {
            console.error("n8n-lead insert error", error);
            return json({ error: `Insert failed: ${error.message}` }, { status: 500 });
          }


          // Cria um roteiro em rascunho se houver dados mínimos.
          const readyForItinerary = Boolean(destination && travelDates && passengers);
          let itineraryId: string | null = null;
          if (readyForItinerary) {
            const { data: it, error: itineraryError } = await (supabaseAdmin as any)
              .from("crm_itineraries")
              .insert({
                agency_id: agencyId,
                lead_id: lead.id,
                title: `Roteiro ${destination}`,
                client_name: name,
                destination,
                start_date: dataIda ?? null,
                end_date: dataVolta ?? null,
                passengers: passengers ?? 1,
                budget: value ?? 0,
                status: "draft",
              })
              .select("id")
              .single();
            if (itineraryError) {
              console.error("n8n-lead itinerary insert error", itineraryError);
              return json({ error: `Itinerary insert failed: ${itineraryError.message}` }, { status: 500 });
            }
            itineraryId = it?.id ?? null;
          }

          return json({
            ok: true,
            lead_id: lead.id,
            itinerary_id: itineraryId,
            ready_for_itinerary: readyForItinerary,
          });
        } catch (error) {
          console.error("n8n-lead unhandled error", error);
          return json(
            { error: error instanceof Error ? error.message : "Unexpected webhook error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
