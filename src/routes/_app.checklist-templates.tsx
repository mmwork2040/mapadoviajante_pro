import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  deleteChecklistTemplate,
  generateChecklistStructureFn,
  listChecklistTemplates,
  saveChecklistTemplate,
  setDefaultChecklistTemplate,
  type ChecklistSection,
  type ChecklistTemplate,
} from "@/lib/checklist-templates.functions";
import { fetchAiConfig } from "@/lib/services";
import { useAuth, isAdminUser } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_app/checklist-templates")({
  component: ChecklistTemplatesPage,
});

function ChecklistTemplatesPage() {
  const { member, session, loading } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isAdmin = isAdminUser(member, session?.user?.email);

  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyDefaultId, setBusyDefaultId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const [res, cfg] = await Promise.all([
          listChecklistTemplates(),
          fetchAiConfig().catch(() => null),
        ]);
        setTemplates(res.templates);
        setDefaultId(res.defaultId);
        const ks = (cfg?.knowledge_sources as { status?: string } | null) ?? null;
        setAiEnabled(!!cfg?.api_key_encrypted && ks?.status === "connected");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar templates");
      } finally {
        setLoadingList(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTemplate(t: ChecklistTemplate) {
    setSelectedId(t.id);
    setIsNew(false);
    setEditMode(false);
    setName(t.name);
    setDescription(t.description || "");
    setText(sectionsToText(t.sections));
  }

  function newTemplate() {
    setSelectedId(null);
    setIsNew(true);
    setEditMode(true);
    setName("Novo template");
    setDescription("");
    setText("## Seção\n### Grupo\n- Item exemplo\n");
  }

  function duplicateTemplate(t: ChecklistTemplate) {
    const baseName = `${t.name} (cópia)`;
    const uniqueName = ensureUniqueName(baseName, templates, null);
    setSelectedId(null);
    setIsNew(true);
    setEditMode(true);
    setName(uniqueName);
    setDescription(t.description || "");
    setText(sectionsToText(t.sections));
    toast.info("Cópia carregada. Ajuste e salve para criar o novo template.");
  }

  function cancelEdit() {
    if (isNew) {
      // Volta para nada selecionado
      setSelectedId(null);
      setIsNew(false);
      setEditMode(false);
      setName("");
      setDescription("");
      setText("");
      return;
    }
    const original = templates.find((t) => t.id === selectedId);
    if (original) selectTemplate(original);
    else setEditMode(false);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Informe um nome para o template.");
      return;
    }
    // Nome único (case-insensitive), ignorando o próprio quando editando
    const dup = templates.some(
      (t) =>
        t.name.trim().toLowerCase() === trimmed.toLowerCase() &&
        t.id !== (selectedId ?? ""),
    );
    if (dup) {
      toast.error("Já existe um template com esse nome.");
      return;
    }
    let sections: ChecklistSection[];
    try {
      sections = textToSections(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Formato inválido");
      return;
    }
    setSaving(true);
    const tid = toast.loading("Salvando template…");
    try {
      const id = selectedId || slugify(trimmed) + "-" + Date.now().toString(36);
      const tpl: ChecklistTemplate = {
        id,
        name: trimmed,
        description: description.trim() || undefined,
        sections,
      };
      const res = await saveChecklistTemplate({ data: { template: tpl } });
      setTemplates(res.templates);
      setDefaultId(res.defaultId);
      setSelectedId(id);
      setIsNew(false);
      setEditMode(false);
      toast.success("Template salvo", { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar", { id: tid });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Excluir template?",
      description: "Leads que já aplicaram este template continuarão com o checklist atual.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    setBusyDeleteId(id);
    const tid = toast.loading("Excluindo template…");
    try {
      const res = await deleteChecklistTemplate({ data: { id } });
      setTemplates(res.templates);
      setDefaultId(res.defaultId);
      if (selectedId === id) {
        setSelectedId(null);
        setIsNew(false);
        setEditMode(false);
        setName("");
        setDescription("");
        setText("");
      }
      toast.success("Template excluído", { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro", { id: tid });
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function makeDefault(id: string) {
    setBusyDefaultId(id);
    const tid = toast.loading("Definindo como padrão…");
    try {
      const res = await setDefaultChecklistTemplate({ data: { id } });
      setDefaultId(res.defaultId);
      toast.success("Template definido como padrão", { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro", { id: tid });
    } finally {
      setBusyDefaultId(null);
    }
  }

  async function runAiGenerate() {
    const ctx = aiContext.trim();
    if (!ctx) {
      toast.error("Descreva o contexto para a IA gerar a estrutura.");
      return;
    }
    setAiBusy(true);
    try {
      const res = await generateChecklistStructureFn({ data: { context: ctx } });
      // Valida antes de sobrescrever
      try {
        textToSections(res.text);
      } catch {
        toast.error("A IA retornou um formato inválido. Tente novamente.");
        return;
      }
      setText(res.text);
      setAiOpen(false);
      setAiContext("");
      toast.success("Estrutura gerada pela IA");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar com IA");
    } finally {
      setAiBusy(false);
    }
  }

  const parsedPreview = useMemo(() => {
    try {
      return textToSections(text);
    } catch {
      return null;
    }
  }, [text]);

  const hasSelection = isNew || !!selectedId;
  const locked = !editMode;

  if (loading || loadingList) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4">
        <Link
          to="/admin"
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Administração
        </Link>
        <PageHeader
          icon={ListChecks}
          title="Templates de Checklist"
          subtitle="Crie e edite templates de checklist. O template padrão será pré-selecionado ao aplicar um checklist em novos leads."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* Lista */}
        <aside className="rounded-xl border border-border p-3">
          <button
            onClick={newTemplate}
            className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo template
          </button>
          <ul className="space-y-1">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-1">
                <button
                  onClick={() => selectTemplate(t)}
                  className={`flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm ${
                    selectedId === t.id && !isNew
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  {t.name}
                  {t.id === defaultId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(padrão)</span>
                  )}
                </button>
                <button
                  onClick={() => duplicateTemplate(t)}
                  title="Duplicar"
                  className="p-1 text-muted-foreground hover:text-primary"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => makeDefault(t.id)}
                  disabled={busyDefaultId === t.id || busyDeleteId === t.id}
                  title="Definir como padrão"
                  className={`p-1 disabled:opacity-60 ${
                    t.id === defaultId
                      ? "text-amber-500"
                      : "text-muted-foreground hover:text-amber-500"
                  }`}
                >
                  {busyDefaultId === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4" fill={t.id === defaultId ? "currentColor" : "none"} />
                  )}
                </button>
                <button
                  onClick={() => remove(t.id)}
                  disabled={busyDeleteId === t.id || busyDefaultId === t.id}
                  title="Excluir"
                  className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-60"
                >
                  {busyDeleteId === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor / visualização */}
        <div className="rounded-xl border border-border p-4">
          {!hasSelection ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <ListChecks className="h-8 w-8 opacity-50" />
              <p>Selecione um template à esquerda para visualizar</p>
              <p className="text-xs">ou clique em “Novo template” para criar um novo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Barra de ações */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {isNew ? "Novo template" : locked ? "Detalhes do template" : "Editando template"}
                </span>
                <div className="flex items-center gap-2">
                  {locked ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </button>
                  ) : (
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={locked}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Descrição (opcional)
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={locked}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              {/* Estrutura recolhível */}
              <details className="group rounded-lg border border-border" open={!locked}>
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <ChevronDown className="h-4 w-4 -rotate-90 transition-transform group-open:rotate-0" />
                    Estrutura
                  </span>
                  {parsedPreview ? (
                    <span className="text-xs text-muted-foreground">
                      {parsedPreview.reduce(
                        (n, s) => n + s.groups.reduce((m, g) => m + g.items.length, 0),
                        0,
                      )}{" "}
                      itens · {parsedPreview.length} seção(ões)
                    </span>
                  ) : (
                    <span className="text-xs text-destructive">Formato inválido</span>
                  )}
                </summary>
                <div className="space-y-2 border-t border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Use <code>## Seção</code>, <code>### Grupo</code> e <code>- item</code>.
                    </p>
                    {!locked && aiEnabled && (
                      <button
                        onClick={() => setAiOpen(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
                      </button>
                    )}
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={18}
                    spellCheck={false}
                    disabled={locked}
                    className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </details>

              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={saving || locked}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal IA */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Gerar estrutura com IA
              </h3>
              <button
                onClick={() => setAiOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Descreva o tipo de consultoria/viagem ou os pontos que a checklist deve cobrir. A
              estrutura atual será substituída.
            </p>
            <textarea
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              rows={6}
              placeholder="Ex.: Consultoria completa para viagem internacional em família com crianças, foco em documentação, hospedagem, passeios e entrega do material."
              className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setAiOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={runAiGenerate}
                disabled={aiBusy}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" /> {aiBusy ? "Gerando…" : "Gerar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureUniqueName(
  base: string,
  templates: ChecklistTemplate[],
  ignoreId: string | null,
): string {
  const taken = new Set(
    templates
      .filter((t) => t.id !== ignoreId)
      .map((t) => t.name.trim().toLowerCase()),
  );
  if (!taken.has(base.trim().toLowerCase())) return base;
  let i = 2;
  while (taken.has(`${base} ${i}`.toLowerCase())) i += 1;
  return `${base} ${i}`;
}

function sectionsToText(sections: ChecklistSection[]): string {
  const lines: string[] = [];
  for (const s of sections) {
    lines.push(`## ${s.title}`);
    for (const g of s.groups) {
      lines.push(`### ${g.title}`);
      for (const it of g.items) lines.push(`- ${it.label}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function textToSections(text: string): ChecklistSection[] {
  const sections: ChecklistSection[] = [];
  let curSection: ChecklistSection | null = null;
  let curGroup: import("@/lib/checklist-templates.functions").ChecklistGroup | null = null;
  let sIdx = 0;
  let gIdx = 0;
  let iIdx = 0;

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      sIdx += 1;
      gIdx = 0;
      iIdx = 0;
      curSection = {
        id: `s${sIdx}`,
        title: line.slice(3).trim(),
        groups: [],
      };
      curGroup = null;
      sections.push(curSection);
    } else if (line.startsWith("### ")) {
      if (!curSection) throw new Error("Grupo antes de uma seção.");
      gIdx += 1;
      iIdx = 0;
      curGroup = {
        id: `s${sIdx}g${gIdx}`,
        title: line.slice(4).trim(),
        items: [],
      };
      curSection.groups.push(curGroup);
    } else if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("☐")) {
      if (!curSection) throw new Error("Item antes de uma seção.");
      if (!curGroup) {
        gIdx += 1;
        curGroup = { id: `s${sIdx}g${gIdx}`, title: "Itens", items: [] };
        curSection.groups.push(curGroup);
      }
      iIdx += 1;
      const label = line.replace(/^[-*☐]\s*/, "").trim();
      if (label) curGroup.items.push({ id: `s${sIdx}g${gIdx}i${iIdx}`, label });
    }
  }
  if (sections.length === 0) throw new Error("Adicione ao menos uma seção (## Título).");
  return sections;
}
