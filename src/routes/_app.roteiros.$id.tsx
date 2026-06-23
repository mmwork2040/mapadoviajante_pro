import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, ExternalLink, Pencil, Ticket, FileUp, Loader2, Check, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import {
  createItineraryActivity,
  createItineraryDay,
  createVoucher,
  deleteItineraryActivity,
  deleteItineraryDay,
  deleteVoucher,
  fetchItineraryById,
  updateItinerary,
  updateItineraryActivity,
  updateItineraryDay,
} from "@/lib/services";
import { extractDocumentData, itineraryCopilot } from "@/lib/ai.functions";
import { formatCurrency, maskCurrency, parseCurrency } from "@/lib/ui";
import { QueryError } from "@/components/QueryError";
import type { Itinerary, ItineraryDay, Voucher } from "@/lib/types";

export const Route = createFileRoute("/_app/roteiros/$id")({
  component: ItineraryDetailPage,
});

const STATUS_OPTIONS = ["draft", "active", "completed", "cancelled"];

function ItineraryDetailPage() {
  const { id } = useParams({ from: "/_app/roteiros/$id" });
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: it, isLoading, isError, refetch } = useQuery({
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
    onError: () => toast.error("Erro ao adicionar dia."),
  });

  if (isError) return <QueryError message="Não foi possível carregar o roteiro." onRetry={() => refetch()} />;
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
            {it.destination} · {it.client_name} · {formatCurrency(it.budget)} · <span className="capitalize">{it.status}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <a
            href={`/viajante/${it.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" /> Ver como viajante
          </a>
        </div>
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

      <VouchersCard itineraryId={id} vouchers={it.vouchers || []} onChange={refresh} />

      {editing && <EditItineraryModal it={it} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); refresh(); }} />}
    </div>
  );
}

function DayCard({ day, onChange }: { day: ItineraryDay; onChange: () => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [dayTitle, setDayTitle] = useState(day.title || `Dia ${day.day_number}`);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractDocumentData);

  async function addActivity() {
    if (!title.trim()) return;
    await createItineraryActivity({
      day_id: day.id,
      title,
      time: time || null,
      location: location || null,
      sort_order: (day.activities?.length || 0) + 1,
    });
    setTitle("");
    setTime("");
    setLocation("");
    onChange();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtracting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const data = await extract({ data: { fileBase64: base64, mime: file.type } });
      const descParts = [
        data.flight_number && `Voo ${data.flight_number}`,
        data.hotel_name,
        data.room && `Quarto ${data.room}`,
        data.provider,
        data.code && `Localizador ${data.code}`,
        data.people ? `${data.people} pessoa(s)` : "",
        data.description,
      ].filter(Boolean);
      await createItineraryActivity({
        day_id: day.id,
        title: data.title || data.hotel_name || data.flight_number || "Item importado",
        time: data.time || null,
        duration: data.duration || null,
        location: data.location || null,
        cost: data.cost ? Number(data.cost) : null,
        description: descParts.join(" · ") || null,
        type: data.type || "activity",
        sort_order: (day.activities?.length || 0) + 1,
      });
      toast.success("Documento lido — atividade criada!");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler documento.");
    } finally {
      setExtracting(false);
    }
  }


  async function saveDayTitle() {
    if (dayTitle === (day.title || `Dia ${day.day_number}`)) return;
    await updateItineraryDay(day.id, { title: dayTitle });
    toast.success("Dia atualizado.");
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <input
          value={dayTitle}
          onChange={(e) => setDayTitle(e.target.value)}
          onBlur={saveDayTitle}
          className="flex-1 rounded-lg bg-transparent px-2 py-1 font-semibold outline-none hover:bg-muted/50 focus:bg-muted/50"
        />
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={extracting}
          title="Enviar documento para a IA preencher"
          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          IA
        </button>
        <button onClick={removeDay} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <ul className="space-y-2">
        {(day.activities || []).map((a) => (
          <ActivityRow key={a.id} activity={a} onChange={onChange} />
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


function ActivityRow({
  activity,
  onChange,
}: {
  activity: NonNullable<ItineraryDay["activities"]>[number];
  onChange: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [time, setTime] = useState(activity.time || "");
  const [location, setLocation] = useState(activity.location || "");

  async function save() {
    await updateItineraryActivity(activity.id, { title, time: time || null, location: location || null });
    setEdit(false);
    onChange();
  }

  if (edit) {
    return (
      <li className="space-y-2 rounded-lg bg-muted/50 px-3 py-2">
        <div className="flex gap-2">
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Hora" className="w-20 rounded border border-input bg-background px-2 py-1 text-sm outline-none" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm outline-none" />
        </div>
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Local" className="w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none" />
        <div className="flex gap-2">
          <button onClick={save} className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Salvar</button>
          <button onClick={() => setEdit(false)} className="rounded bg-muted px-3 py-1 text-xs">Cancelar</button>
        </div>
      </li>
    );
  }

  const done = activity.type === "done";

  async function toggleDone() {
    await updateItineraryActivity(activity.id, { type: done ? null : "done" });
    onChange();
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <button
          onClick={toggleDone}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
            done ? "border-primary bg-primary text-primary-foreground" : "border-input"
          }`}
        >
          {done && <Check className="h-3 w-3" />}
        </button>
        <span className={done ? "text-muted-foreground line-through" : ""}>
          {activity.time && <strong className="mr-2 text-primary">{activity.time}</strong>}
          {activity.title}
          {activity.location && <span className="ml-2 text-xs text-muted-foreground">· {activity.location}</span>}
        </span>
      </span>
      <span className="flex gap-1">
        <button onClick={() => setEdit(true)} className="text-muted-foreground hover:text-primary">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={async () => {
            await deleteItineraryActivity(activity.id);
            onChange();
          }}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  );
}


function VouchersCard({
  itineraryId,
  vouchers,
  onChange,
}: {
  itineraryId: string;
  vouchers: Voucher[];
  onChange: () => void;
}) {
  const [form, setForm] = useState<Partial<Voucher>>({ type: "hotel" });

  async function add() {
    if (!form.title?.trim()) {
      toast.error("Informe um título para o voucher.");
      return;
    }
    const res = await createVoucher({ ...form, itinerary_id: itineraryId });
    if (res) {
      setForm({ type: "hotel" });
      onChange();
    } else toast.error("Erro ao criar voucher.");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Ticket className="h-4 w-4" /> Vouchers
      </h2>
      <ul className="space-y-2">
        {vouchers.length === 0 && <li className="text-sm text-muted-foreground">Nenhum voucher.</li>}
        {vouchers.map((v) => (
          <li key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <div>
              <p className="font-medium">
                {v.title} {v.type && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs capitalize">{v.type}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {[v.provider, v.code, v.notes || v.details].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <button
              onClick={async () => {
                await deleteVoucher(v.id);
                onChange();
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={form.type || ""}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:border-primary"
        >
          {["hotel", "voo", "transfer", "passeio", "seguro"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.provider || ""} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Fornecedor" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Código/Localizador" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2" />
      </div>
      <button onClick={add} className="mt-3 flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
        <Plus className="h-4 w-4" /> Adicionar voucher
      </button>
    </div>
  );
}

function EditItineraryModal({
  it,
  onClose,
  onSaved,
}: {
  it: Itinerary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Itinerary>>({
    title: it.title,
    client_name: it.client_name || "",
    destination: it.destination || "",
    budget: it.budget || 0,
    status: it.status,
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateItinerary(it.id, form);
    setSaving(false);
    if (res) {
      toast.success("Roteiro atualizado!");
      onSaved();
    } else toast.error("Erro ao salvar.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <h2 className="mb-4 text-lg font-bold">Editar Roteiro</h2>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Título" value={form.title || ""} onChange={(v) => setForm({ ...form, title: v })} />
          <Field label="Cliente" value={form.client_name || ""} onChange={(v) => setForm({ ...form, client_name: v })} />
          <Field label="Destino" value={form.destination || ""} onChange={(v) => setForm({ ...form, destination: v })} />
          <Field label="Orçamento" format="currency" value={String(form.budget ?? "")} onChange={(v) => setForm({ ...form, budget: Number(v) })} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Status</span>
            <select
              value={form.status || ""}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:border-primary"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 font-medium hover:bg-muted">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  format,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  format?: "currency";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type={format ? "text" : type}
        inputMode={format ? "numeric" : undefined}
        value={format === "currency" ? maskCurrency(String(Math.round((Number(value) || 0) * 100))) : value}
        onChange={(e) => onChange(format === "currency" ? String(parseCurrency(e.target.value)) : e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
