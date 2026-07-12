import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, Users, Plane, BedDouble, Car, Utensils, Clock } from "lucide-react";
import { fetchPublicItinerary } from "@/lib/services";
import { formatDate, formatCurrency, formatMoney } from "@/lib/ui";
import type { ItineraryActivity } from "@/lib/types";

export const Route = createFileRoute("/viajante/$id")({
  ssr: false,
  component: TravelerView,
});

const TYPE_ICON: Record<string, typeof Plane> = {
  flight: Plane,
  hotel: BedDouble,
  transfer: Car,
  restaurant: Utensils,
  activity: MapPin,
};

function TravelerView() {
  const { id } = useParams({ from: "/viajante/$id" });
  const { data: it, isLoading } = useQuery({
    queryKey: ["traveler-itinerary", id],
    queryFn: () => fetchPublicItinerary(id),
  });

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  if (!it)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Roteiro não encontrado.
      </div>
    );

  const allActivities: ItineraryActivity[] = (it.days || []).flatMap((d) => d.activities || []);
  const flights = allActivities.filter((a) => a.type === "flight");
  const hotels = allActivities.filter((a) => a.type === "hotel");

  return (
    <div className="min-h-screen bg-[var(--accent)]">
      <header className="relative overflow-hidden bg-primary px-6 py-16 text-primary-foreground">
        <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 80% 20%, white, transparent 60%)" }} />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-90">Seu roteiro de viagem</p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight md:text-5xl">{it.title}</h1>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            {it.destination && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5">
                <MapPin className="h-4 w-4" /> {it.destination}
              </span>
            )}
            {it.start_date && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5">
                <Calendar className="h-4 w-4" /> {formatDate(it.start_date)} – {formatDate(it.end_date)}
              </span>
            )}
            {it.passengers ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5">
                <Users className="h-4 w-4" /> {it.passengers} viajante(s)
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-6 py-12">
        {flights.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Plane className="h-5 w-5 text-primary" /> Voos
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {flights.map((a) => (
                <HighlightCard key={a.id} activity={a} />
              ))}
            </div>
          </section>
        )}

        {hotels.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <BedDouble className="h-5 w-5 text-primary" /> Hospedagem
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {hotels.map((a) => (
                <HighlightCard key={a.id} activity={a} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            <Calendar className="h-5 w-5 text-primary" /> Itinerário dia a dia
          </h2>
          {(it.days || []).length === 0 && (
            <p className="text-center text-muted-foreground">O roteiro está sendo preparado. Volte em breve!</p>
          )}
          <div className="space-y-5">
            {(it.days || []).map((day) => (
              <div key={day.id} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                    {day.day_number}
                  </span>
                  {day.title || `Dia ${day.day_number}`}
                </h3>
                <ul className="space-y-4 border-l-2 border-accent pl-5">
                  {(day.activities || []).map((a) => {
                    const Icon = TYPE_ICON[a.type || "activity"] || MapPin;
                    return (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Icon className="h-2.5 w-2.5" />
                        </span>
                        {a.time && (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                            <Clock className="h-3.5 w-3.5" /> {a.time}
                          </span>
                        )}
                        <p className="font-medium">{a.title}</p>
                        {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                        {a.location && <p className="text-xs text-muted-foreground">📍 {a.location}</p>}
                        {a.cost ? <p className="text-xs font-medium text-foreground">{formatCurrency(a.cost)}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Powered by Mapa do Viajante PRO
      </footer>
    </div>
  );
}

function HighlightCard({ activity: a }: { activity: ItineraryActivity }) {
  const Icon = TYPE_ICON[a.type || "activity"] || MapPin;
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{a.title}</p>
        {a.time && (
          <p className="inline-flex items-center gap-1 text-sm text-primary">
            <Clock className="h-3.5 w-3.5" /> {a.time}
          </p>
        )}
        {a.location && <p className="text-xs text-muted-foreground">📍 {a.location}</p>}
        {a.description && <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>}
        {a.cost ? <p className="mt-1 text-sm font-medium">{formatCurrency(a.cost)}</p> : null}
      </div>
    </div>
  );
}
