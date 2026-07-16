import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListPlus } from "lucide-react";
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
import { createTask, fetchLeads, fetchTeamMembers, fetchItinerariesByLead } from "@/lib/services";

const PRIORITIES = [
  { value: "low", label: "Baixa", dot: "bg-emerald-500" },
  { value: "normal", label: "Média", dot: "bg-amber-500" },
  { value: "high", label: "Alta", dot: "bg-red-500" },
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");

  const leadsQ = useQuery({ queryKey: ["leads", {}], queryFn: () => fetchLeads({}), enabled: open });
  const membersQ = useQuery({ queryKey: ["team-members"], queryFn: fetchTeamMembers, enabled: open });

  function reset() {
    setTitle("");
    setLeadId("");
    setAssignedTo("");
    setDueDate("");
    setPriority("normal");
    setDescription("");
  }

  const mutation = useMutation({
    mutationFn: () =>
      createTask({
        title: title.trim(),
        lead_id: leadId || null,
        assigned_to: assignedTo || null,
        priority,
        due_date: dueDate ? new Date(`${dueDate}T09:00:00`).toISOString() : null,
        description: description.trim() || null,
      }),
    onSuccess: (res) => {
      if (!res) return toast.error("Erro ao criar tarefa.");
      toast.success("Tarefa criada!");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao criar tarefa."),
  });

  function submit() {
    if (!title.trim()) return toast.error("Informe o título.");
    if (!dueDate) return toast.error("Informe a data de vencimento.");
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <ListPlus className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">Criar Tarefa</DialogTitle>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <div>
            <FieldLabel>Título *</FieldLabel>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Emitir bilhete, Enviar voucher, Confirmar reserva…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Cliente</FieldLabel>
              <Select value={leadId} onValueChange={setLeadId}>
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
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "+ Criar Tarefa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
