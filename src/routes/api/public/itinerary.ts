import { createFileRoute } from "@tanstack/react-router";
import { Query } from "appwrite";

type Document = Record<string, unknown> & { $id: string };
type Page = { documents: Document[]; total: number };

const response = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

function config() {
  const endpoint = (
    process.env.APPWRITE_ENDPOINT ||
    process.env.VITE_APPWRITE_ENDPOINT ||
    ""
  ).replace(/\/$/, "");
  const project = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
  const database = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID;
  const key = process.env.APPWRITE_API_KEY;
  if (!endpoint || !project || !database || !key) return null;
  return { endpoint, project, database, key };
}

function clean(doc: Document) {
  const result: Record<string, unknown> = { ...doc, id: doc.$id };
  for (const field of ["images", "hotel_options", "suggestion_options", "passenger_costs"]) {
    if (typeof result[field] === "string") {
      try {
        result[field] = JSON.parse(result[field] as string);
      } catch {
        /* keep original text */
      }
    }
  }
  return result;
}

async function list(
  cfg: NonNullable<ReturnType<typeof config>>,
  collection: string,
  filter: string,
): Promise<Document[]> {
  const found: Document[] = [];
  let offset = 0;
  do {
    const url = new URL(
      `${cfg.endpoint}/databases/${encodeURIComponent(cfg.database)}/collections/${collection}/documents`,
    );
    url.searchParams.append("queries[]", filter);
    url.searchParams.append("queries[]", Query.limit(100));
    url.searchParams.append("queries[]", Query.offset(offset));
    const res = await fetch(url, {
      headers: { "X-Appwrite-Project": cfg.project, "X-Appwrite-Key": cfg.key },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Appwrite returned ${res.status}`);
    const page = (await res.json()) as Page;
    found.push(...page.documents);
    offset += page.documents.length;
    if (!page.documents.length || offset >= page.total) break;
    if (offset >= 1000) throw new Error("Itinerary exceeds the public view limit");
  } while (offset < 1000);
  return found;
}

export const Route = createFileRoute("/api/public/itinerary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id") || "";
        const token = url.searchParams.get("token") || "";
        if (!/^[a-zA-Z0-9_-]{1,36}$/.test(id) || !/^[a-f0-9-]{36}$/i.test(token)) {
          return response({ error: "invalid_link" }, 400);
        }
        const cfg = config();
        if (!cfg) return response({ error: "sharing_not_configured" }, 503);
        try {
          const itinerary = (await list(cfg, "crm_itineraries", Query.equal("$id", id)))[0];
          if (!itinerary || itinerary.share_token !== token)
            return response({ error: "not_found" }, 404);

          const days = await list(cfg, "crm_itinerary_days", Query.equal("itinerary_id", id));
          const dayIds = new Set(days.map((day) => day.$id));
          const activities = await Promise.all(
            days.map((day) =>
              list(cfg, "crm_itinerary_activities", Query.equal("day_id", day.$id)),
            ),
          );
          const byDay = new Map<string, Document[]>();
          for (const activity of activities.flat()) {
            if (!dayIds.has(String(activity.day_id))) continue;
            const key = String(activity.day_id);
            byDay.set(key, [...(byDay.get(key) || []), activity]);
          }

          return response({
            id: itinerary.$id,
            title: itinerary.title,
            destination: itinerary.destination,
            client_name: itinerary.client_name,
            start_date: itinerary.start_date,
            end_date: itinerary.end_date,
            passengers: itinerary.passengers,
            status: itinerary.status,
            cover_image: itinerary.cover_image,
            days: days
              .sort(
                (a, b) =>
                  Number(a.sort_order ?? a.day_number ?? 0) -
                  Number(b.sort_order ?? b.day_number ?? 0),
              )
              .map((day) => ({
                ...clean(day),
                activities: (byDay.get(day.$id) || [])
                  .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                  .map(clean),
              })),
          });
        } catch (error) {
          console.error("public itinerary lookup failed", error);
          return response({ error: "unavailable" }, 503);
        }
      },
    },
  },
});
