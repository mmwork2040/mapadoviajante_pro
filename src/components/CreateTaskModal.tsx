import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ListPlus,
  Pencil,
  Phone,
  MessageCircle,
  Mail,
  Video,
  StickyNote,
  FileText,
  ClipboardList,
  X,
  Save,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createTask, updateTask, fetchLeads, fetchTeamMembers, fetchItinerariesByLead, cleanTaskDescription, CHECKLIST_ITEM_MARK } from "@/lib/services";
import type { Task } from "@/lib/types";


const PRIORITIES = [
  { value: "low", label: "Baixa", dot: "bg-emerald-500" },
  { value: "normal", label: "Média", dot: "bg-amber-500" },
  { value: "high", label: "Alta", dot: "bg-red-500" },
];

const ACTIVITY_TYPES = [
  { key: "call", label: "Ligação", icon: Phone },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "meeting", label: "Reunião", icon: Video },
  { key: "note", label: "Observação", icon: StickyNote },
  { key: "document", label: "Documento", icon: FileText },
  { key: "outros", label: "Outros", icon: ClipboardList },
];

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
      {hint && <span className="ml-1 lowercase text-muted-foreground/70">{hint}</span>}
    </label>
  );
}

export function CreateTaskModal({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: Task | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!task;
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [itineraryId, setItineraryId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<string>("outros");


  const leadsQ = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}), enabled: open });

  const membersQ = useQuery({ queryKey: ["team-members"], queryFn: fetchTeamMembers, enabled: open });
  const itinerariesQ = useQuery({
    queryKey: ["itineraries-by-lead", leadId],
    queryFn: () => fetchItinerariesByLead(leadId),
    enabled: open && !!leadId,
  });

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title ?? "");
      setLeadId(task.lead_id ?? "");
      setItineraryId(task.itinerary_id ?? "");
      setAssignedTo(task.assigned_to ?? "");
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
      setPriority(task.priority ?? "normal");
      setDescription(task.description ?? "");
      setActivityType("outros");
      // Se a tarefa está ligada a uma atividade, busca o tipo atual.
      const m = (task.description ?? "").match(/\[atv:([0-9a-f-]+)\]/i);
      if (m) {
        supabase
          .from("crm_lead_activities")
          .select("type")
          .eq("id", m[1])
          .maybeSingle()
          .then(({ data }) => {
            const t = (data as { type?: string } | null)?.type;
            if (t && ACTIVITY_TYPES.some((a) => a.key === t)) setActivityType(t);
          });
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  function reset() {
    setTitle("");
    setLeadId("");
    setItineraryId("");
    setAssignedTo("");
    setDueDate("");
    setPriority("normal");
    setDescription("");
    setActivityType("outros");
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        lead_id: leadId || null,
        itinerary_id: itineraryId || null,
        assigned_to: assignedTo || null,
        priority,
        due_date: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : null,
        description: description.trim() || null,
        activity_type: activityType,
      } as Partial<Task> & { activity_type: string };
      return isEdit ? updateTask(task!.id, payload) : createTask(payload);
    },

    onSuccess: (res) => {
      if (!res) return toast.error(isEdit ? "Erro ao atualizar tarefa." : "Erro ao criar tarefa.");
      toast.success(isEdit ? "Tarefa atualizada!" : "Tarefa criada!");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error(isEdit ? "Erro ao atualizar tarefa." : "Erro ao criar tarefa."),
  });

  function submit() {
    if (!title.trim()) return toast.error("Informe o título.");
    if (!dueDate) return toast.error("Informe a data de vencimento.");
    mutation.mutate();
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg sm:rounded-3xl [&>button.absolute]:hidden">
        {/* Header */}
        <div className="flex items-start justify-between bg-[var(--accent)] px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              {isEdit ? <Pencil className="h-5 w-5" /> : <ListPlus className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {isEdit ? "Editar Tarefa" : "Nova Tarefa"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {isEdit ? "Atualize as informações da tarefa" : "Preencha todos os campos para criar a tarefa"}
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>



        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <FieldLabel>Título *</FieldLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Emitir bilhete, Enviar voucher, Confirmar reserva…"
            />
          </div>

          <div>
            <FieldLabel>Tipo</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map((t) => {
                const Icon = t.icon;
                const active = activityType === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActivityType(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>



          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Cliente</FieldLabel>
              <Select
                value={leadId}
                onValueChange={(v) => {
                  setLeadId(v);
                  setItineraryId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(leadsQ.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <FieldLabel hint="(opcional)">Atribuído a</FieldLabel>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione responsável" />
                </SelectTrigger>
                <SelectContent>
                  {(membersQ.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {leadId && (
            <div>
              <FieldLabel hint="(opcional)">Roteiro vinculado</FieldLabel>
              <Select
                value={itineraryId || "__none__"}
                onValueChange={(v) => setItineraryId(v === "__none__" ? "" : v)}
                disabled={itinerariesQ.isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      itinerariesQ.isLoading ? "Carregando roteiros…" : "Selecione um roteiro"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {(itinerariesQ.data ?? []).map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.title}
                      {it.destination ? ` — ${it.destination}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!itinerariesQ.isLoading && (itinerariesQ.data ?? []).length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Este cliente ainda não possui roteiros.
                </p>
              )}
            </div>
          )}


          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Data de Vencimento *</FieldLabel>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Prioridade</FieldLabel>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${p.dot}`} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel hint="(opcional)">Descrição</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas adicionais sobre a tarefa…"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {mutation.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar Tarefa"}
          </Button>

        </div>
      </DialogContent>
    </Dialog>

  );
}
