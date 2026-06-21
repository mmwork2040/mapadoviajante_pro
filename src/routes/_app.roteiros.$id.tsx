import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  createItineraryActivity,
  createItineraryDay,
  deleteItineraryActivity,
  deleteItineraryDay,
  fetchItineraryById,
} from "@/lib/services";
import { formatCurrency } from "@/lib/ui";
import { QueryError } from "@/components/QueryError";

export const Route = createFileRoute("/_app/roteiros/$id")({
  component: ItineraryDetailPage,
});

function ItineraryDetailPage() {
  const { id } = useParams({ from: "/_app/roteiros/$id" });
  const qc = useQueryClient();
  const { data: it, isLoading } = useQuery({
    queryKey: ["itinerary", id],
    queryFn: () => fetchItineraryById(id),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["itinerary", id] });

  const addDay = useMutation({
    mutationFn: () =>
      createItineraryDay({
        itinerary_id: id,
        day_number: (it?.days?.length || 0) + 1,
        title: `Dia ${(it?.days?.length || 0) + 1}`,
        sort_order: (it?.days?.length || 0) + 1,
      }),
    onSuccess: refresh,
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!it) return <p>Roteiro não encontrado.</p>;

  return (
    <div className="space-y-6">
      <Link to="/roteiros" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{it.title}</h1>
          <p className="text-sm text-muted-foreground">
            {it.destination} · {it.client_name} · {formatCurrency(it.budget)}
          </p>
        </div>
        <a
          href={`/viajante/${it.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" /> Ver como viajante
        </a>
      </div>

      <div className="space-y-4">
        {(it.days || []).map((day) => (
          <DayCard key={day.id} day={day} onChange={refresh} />
        ))}
        <button
          onClick={() => addDay.mutate()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" /> Adicionar dia
        </button>
      </div>
    </div>
  );
}

import type { ItineraryDay } from "@/lib/types";

function DayCard({ day, onChange }: { day: ItineraryDay; onChange: () => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");

  async function addActivity() {
    if (!title.trim()) return;
    await createItineraryActivity({
      day_id: day.id,
      title,
      time: time || null,
      sort_order: (day.activities?.length || 0) + 1,
    });
    setTitle("");
    setTime("");
    onChange();
  }

  async function removeDay() {
    if (!confirm("Excluir este dia?")) return;
    await deleteItineraryDay(day.id);
    toast.success("Dia removido.");
    onChange();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{day.title || `Dia ${day.day_number}`}</h3>
        <button onClick={removeDay} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-2">
        {(day.activities || []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span>
              {a.time && <strong className="mr-2 text-primary">{a.time}</strong>}
              {a.title}
            </span>
            <button
              onClick={async () => {
                await deleteItineraryActivity(a.id);
                onChange();
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="09:00"
          className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Atividade…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button onClick={addActivity} className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
