import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, ExternalLink, Pencil, Ticket, FileUp, Loader2, Check, Send, MessageCircle, X, Paperclip, Bot, Eraser, ArrowRight } from "lucide-react";
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
import { extractDocumentData, itineraryPlanner } from "@/lib/ai.functions";
import { formatCurrency, maskCurrency, parseCurrency } from "@/lib/ui";
import { QueryError } from "@/components/QueryError";
import { useConfirm } from "@/components/ConfirmDialog";
import type { Itinerary, ItineraryDay, Voucher } from "@/lib/types";

export const Route = createFileRoute("/_app/roteiros/$id")({
  component: ItineraryDetailPage,
});

const STATUS_OPTIONS = ["draft", "active", "completed", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function ItineraryDetailPage() {
  const { id } = useParams({ from: "/_app/roteiros/$id" });
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: it, isLoading, isError, refetch } = useQuery({
    queryKey: ["itinerary", id],
    queryFn: () => fetchItineraryById(id),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["itinerary", id] });

  const confirm = useConfirm();

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

  const clearItinerary = useMutation({
    mutationFn: async () => {
      for (const day of it?.days || []) {
        await deleteItineraryDay(day.id);
      }
    },
    onSuccess: () => {
      toast.success("Roteiro limpo. Comece novamente!");
      refresh();
    },
    onError: () => toast.error("Erro ao limpar o roteiro."),
  });

  const advanceStatus = useMutation({
    mutationFn: async (next: string) => updateItinerary(id, { status: next }),
    onSuccess: () => {
      toast.success("Status atualizado!");
      refresh();
    },
    onError: () => toast.error("Erro ao atualizar o status."),
  });

  async function handleClear() {
    const ok = await confirm({
      title: "Limpar roteiro?",
      description: "Todos os dias e atividades serão removidos para você refazer o roteiro. Esta ação não pode ser desfeita.",
      confirmLabel: "Limpar tudo",
      destructive: true,
    });
    if (ok) clearItinerary.mutate();
  }

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
            {it.destination} · {it.client_name} · {formatCurrency(it.budget)} · <span>{STATUS_LABELS[it.status || "draft"] || it.status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const idx = STATUS_OPTIONS.indexOf(it.status || "draft");
            const next = idx >= 0 && idx < STATUS_OPTIONS.length - 1 ? STATUS_OPTIONS[idx + 1] : null;
            const hasCompleteDay = (it.days || []).some((d) => (d.activities?.length || 0) > 0);
            return next && it.status !== "cancelled" && hasCompleteDay ? (
              <button
                onClick={() => advanceStatus.mutate(next)}
                disabled={advanceStatus.isPending}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <ArrowRight className="h-4 w-4" /> Avançar para <span>{STATUS_LABELS[next] || next}</span>
              </button>
            ) : null;
          })()}
          {it.status === "draft" && (it.days?.length || 0) > 0 && (
            <button
              onClick={handleClear}
              disabled={clearItinerary.isPending}
              className="flex items-center gap-1 rounded-lg border border-destructive px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <Eraser className="h-4 w-4" /> Limpar roteiro
            </button>
          )}
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

      <ItineraryChat it={it} onChange={refresh} />

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
  const confirm = useConfirm();

  async function addActivity() {
    if (!title.trim()) return;
    try {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar atividade.");
    }
  }


  function mapActivityType(t?: string): string {
    const v = (t || "").toLowerCase();
    const allowed = ["flight", "hotel", "activity", "transfer", "restaurant", "note"];
    if (allowed.includes(v)) return v;
    const aliases: Record<string, string> = {
      voo: "flight", voos: "flight", aviao: "flight", passagem: "flight",
      hospedagem: "hotel", hotel: "hotel", pousada: "hotel",
      transfer: "transfer", traslado: "transfer", carro: "transfer", transporte: "transfer",
      restaurante: "restaurant", gastronomia: "restaurant", refeicao: "restaurant",
      ingresso: "activity", passeio: "activity", tour: "activity", parque: "activity",
    };
    return aliases[v] || "activity";
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
      const parsedCost = data.cost != null ? Number(String(data.cost).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) : NaN;
      const created = await createItineraryActivity({
        day_id: day.id,
        title: data.title || data.hotel_name || data.flight_number || "Item importado",
        time: data.time || null,
        duration: data.duration || null,
        location: data.location || null,
        cost: Number.isFinite(parsedCost) ? parsedCost : null,
        description: descParts.join(" · ") || null,
        type: mapActivityType(data.type),
        sort_order: (day.activities?.length || 0) + 1,
      });
      if (!created) throw new Error("Não foi possível salvar a atividade.");
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
    const ok = await confirm({
      title: "Excluir este dia?",
      description: "Todas as atividades deste dia serão removidas. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
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
        {[...(day.activities || [])]
          .sort((a, b) => {
            const ta = a.time ? a.time.slice(0, 5) : "99:99";
            const tb = b.time ? b.time.slice(0, 5) : "99:99";
            return ta.localeCompare(tb);
          })
          .map((a) => (
            <ActivityRow key={a.id} activity={a} onChange={onChange} />
          ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-28 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
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
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28 rounded border border-input bg-background px-2 py-1 text-sm outline-none" />
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
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractDocumentData);
  const confirm = useConfirm();

  const VOUCHER_TYPES = ["hotel", "voo", "transfer", "passeio", "ingresso", "carro", "seguro", "outro"];

  function mapType(t?: string): string {
    const v = (t || "").toLowerCase();
    if (VOUCHER_TYPES.includes(v)) return v;
    if (v === "voos") return "voo";
    return "outro";
  }

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
      const notes = [
        data.hotel_name,
        data.room && `Quarto ${data.room}`,
        data.flight_number && `Voo ${data.flight_number}`,
        data.location,
        data.date,
        data.time,
        data.people ? `${data.people} pessoa(s)` : "",
        data.cost ? `Valor ${formatCurrency(Number(data.cost))}` : "",
        data.description,
      ]
        .filter(Boolean)
        .join(" · ");
      setForm({
        type: mapType(data.type),
        title: data.title || data.hotel_name || data.flight_number || "Voucher importado",
        provider: data.provider || "",
        code: data.code || "",
        notes,
      });
      toast.success("Documento lido — revise e adicione o voucher.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler documento.");
    } finally {
      setExtracting(false);
    }
  }

  async function removeVoucher(v: Voucher) {
    const ok = await confirm({
      title: "Excluir voucher?",
      description: `"${v.title || "Voucher"}" será removido permanentemente.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    await deleteVoucher(v.id);
    onChange();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Ticket className="h-4 w-4" /> Vouchers
        </h2>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={extracting}
          title="Enviar PDF/imagem (ingresso, passagem, hospedagem, reserva de carro) para a IA preencher"
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          Importar com IA
        </button>
      </div>
      {vouchers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum voucher.</p>}
      <div className="space-y-4">
        {Object.entries(
          vouchers.reduce<Record<string, Voucher[]>>((acc, v) => {
            const key = (v.type || "outro").toLowerCase();
            (acc[key] ||= []).push(v);
            return acc;
          }, {}),
        ).map(([type, items]) => (
          <div key={type}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="capitalize">{type}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{items.length}</span>
            </h3>
            <ul className="space-y-2">
              {items.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[v.provider, v.code, v.notes || v.details].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <button onClick={() => removeVoucher(v)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={form.type || ""}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm capitalize outline-none focus:border-primary"
        >
          {VOUCHER_TYPES.map((t) => (
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


type ChatMsg = { role: "user" | "assistant"; text: string; files?: string[] };

function ItineraryChat({ it, onChange }: { it: Itinerary; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Olá! Envie passagens aéreas, reservas ou imagens com informações da viagem e eu monto os dias do roteiro automaticamente. Você também pode pedir sugestões.",
    },
  ]);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const plan = useServerFn(itineraryPlanner);

  function buildContext(): string {
    const dias = (it.days || [])
      .map((d) => {
        const acts = (d.activities || [])
          .map((a) => `  - ${[a.time, a.title, a.location].filter(Boolean).join(" ")}`)
          .join("\n");
        return `${d.title || `Dia ${d.day_number}`}\n${acts || "  (sem atividades)"}`;
      })
      .join("\n");
    return `Roteiro: ${it.title}
Destino: ${it.destination || "—"}
Cliente: ${it.client_name || it.lead?.name || "—"}
Datas: ${it.start_date || "—"} a ${it.end_date || "—"}
Quantidade de passageiros: ${it.passengers ?? "—"}
Orçamento: ${formatCurrency(it.budget)}
Dias atuais:
${dias || "(nenhum dia ainda)"}`;
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function mapType(t?: string): string {
    const v = (t || "").toLowerCase();
    const allowed = ["flight", "hotel", "activity", "transfer", "restaurant", "note"];
    if (allowed.includes(v)) return v;
    const aliases: Record<string, string> = {
      voo: "flight", aviao: "flight", passagem: "flight",
      hospedagem: "hotel", pousada: "hotel",
      traslado: "transfer", carro: "transfer", transporte: "transfer",
      restaurante: "restaurant", refeicao: "restaurant",
      ingresso: "activity", passeio: "activity", tour: "activity",
    };
    return aliases[v] || "activity";
  }

  async function send() {
    const text = input.trim();
    if (!text && pending.length === 0) return;
    const fileNames = pending.map((f) => f.name);
    setMessages((m) => [...m, { role: "user", text: text || "(documentos enviados)", files: fileNames }]);
    setInput("");
    setLoading(true);
    try {
      const files = await Promise.all(
        pending.map(async (f) => ({ base64: await fileToBase64(f), mime: f.type, name: f.name })),
      );
      setPending([]);
      const res = await plan({ data: { message: text, context: buildContext(), files } });

      let createdDays = 0;
      let createdActs = 0;
      const baseCount = it.days?.length || 0;
      for (let i = 0; i < res.days.length; i++) {
        const d = res.days[i];
        const day = await createItineraryDay({
          itinerary_id: it.id,
          day_number: baseCount + i + 1,
          title: d.title || `Dia ${baseCount + i + 1}`,
          date: d.date || null,
          sort_order: baseCount + i + 1,
        });
        if (!day) continue;
        createdDays++;
        for (let j = 0; j < d.activities.length; j++) {
          const a = d.activities[j];
          try {
            await createItineraryActivity({
              day_id: day.id,
              title: a.title,
              time: a.time || null,
              location: a.location || null,
              duration: a.duration || null,
              cost: typeof a.cost === "number" && a.cost > 0 ? a.cost : null,
              description: a.description || null,
              type: mapType(a.type),
              sort_order: j + 1,
            });
            createdActs++;
          } catch {
            /* ignora atividade individual com erro */
          }
        }
      }

      const summary =
        createdDays > 0
          ? `${res.reply}\n\n✓ ${createdDays} dia(s) e ${createdActs} atividade(s) adicionados ao roteiro.`
          : res.reply || "Não encontrei informações suficientes para montar os dias.";
      setMessages((m) => [...m, { role: "assistant", text: summary }]);
      if (createdDays > 0) onChange();
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: err instanceof Error ? err.message : "Erro ao gerar o roteiro." },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (list.length) setPending((p) => [...p, ...list]);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
        title="Assistente de roteiro"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[32rem] w-[min(24rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Assistente de Roteiro</p>
              <p className="text-xs text-muted-foreground">Gera os dias a partir dos seus documentos</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {m.text}
                  {m.files && m.files.length > 0 && (
                    <div className="mt-1 space-y-0.5 text-xs opacity-80">
                      {m.files.map((f, k) => (
                        <div key={k} className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
                </div>
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-border px-3 py-2">
              {pending.map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" /> {f.name}
                  <button onClick={() => setPending((p) => p.filter((_, k) => k !== i))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 border-t border-border p-3">
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" onChange={onPick} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              title="Anexar documentos/imagens"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-60"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Peça ajuda ou envie documentos…"
              className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={send}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
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
