import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, Users } from "lucide-react";
import { fetchItineraryById } from "@/lib/services";
import { formatDate } from "@/lib/ui";

export const Route = createFileRoute("/viajante/$id")({
  ssr: false,
  component: TravelerView,
});

function TravelerView() {
  const { id } = useParams({ from: "/viajante/$id" });
  const { data: it, isLoading } = useQuery({
    queryKey: ["traveler-itinerary", id],
    queryFn: () => fetchItineraryById(id),
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

  return (
    <div className="min-h-screen bg-[var(--accent)]">
      <header className="bg-primary px-6 py-12 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wide opacity-90">Seu roteiro de viagem</p>
          <h1 className="mt-1 text-3xl font-extrabold">{it.title}</h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {it.destination && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {it.destination}
              </span>
            )}
            {it.start_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" /> {formatDate(it.start_date)} – {formatDate(it.end_date)}
              </span>
            )}
            {it.passengers ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> {it.passengers} viajante(s)
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-10">
        {(it.days || []).length === 0 && (
          <p className="text-center text-muted-foreground">O roteiro está sendo preparado. Volte em breve!</p>
        )}
        {(it.days || []).map((day) => (
          <div key={day.id} className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                {day.day_number}
              </span>
              {day.title || `Dia ${day.day_number}`}
            </h2>
            <ul className="space-y-3 border-l-2 border-accent pl-5">
              {(day.activities || []).map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary" />
                  {a.time && <span className="text-sm font-semibold text-primary">{a.time}</span>}
                  <p className="font-medium">{a.title}</p>
                  {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                  {a.location && <p className="text-xs text-muted-foreground">📍 {a.location}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        Powered by Mapa do Viajante PRO
      </footer>
    </div>
  );
}
