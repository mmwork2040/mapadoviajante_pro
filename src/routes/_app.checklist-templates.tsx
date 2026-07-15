import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Star, Trash2, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import {
  listChecklistTemplates,
  saveChecklistTemplate,
  deleteChecklistTemplate,
  setDefaultChecklistTemplate,
  type ChecklistTemplate,
  type ChecklistSection,
} from "@/lib/checklist-templates.functions";
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const res = await listChecklistTemplates();
        setTemplates(res.templates);
        setDefaultId(res.defaultId);
        if (res.templates[0]) selectTemplate(res.templates[0]);
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
    setName(t.name);
    setDescription(t.description || "");
    setText(sectionsToText(t.sections));
  }

  function newTemplate() {
    setSelectedId(null);
    setName("Novo template");
    setDescription("");
    setText("## Seção\n### Grupo\n- Item exemplo\n");
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Informe um nome para o template.");
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
    try {
      const id = selectedId || slugify(name) + "-" + Date.now().toString(36);
      const tpl: ChecklistTemplate = {
        id,
        name: name.trim(),
        description: description.trim() || undefined,
        sections,
      };
      const res = await saveChecklistTemplate({ data: { template: tpl } });
      setTemplates(res.templates);
      setDefaultId(res.defaultId);
      setSelectedId(id);
      toast.success("Template salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
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
    try {
      const res = await deleteChecklistTemplate({ data: { id } });
      setTemplates(res.templates);
      setDefaultId(res.defaultId);
      if (selectedId === id) {
        if (res.templates[0]) selectTemplate(res.templates[0]);
        else newTemplate();
      }
      toast.success("Template excluído");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function makeDefault(id: string) {
    try {
      const res = await setDefaultChecklistTemplate({ data: { id } });
      setDefaultId(res.defaultId);
      toast.success("Template definido como padrão");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const parsedPreview = useMemo(() => {
    try {
      return textToSections(text);
    } catch {
      return null;
    }
  }, [text]);

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

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
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
                    selectedId === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  {t.name}
                  {t.id === defaultId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(padrão)</span>
                  )}
                </button>
                <button
                  onClick={() => makeDefault(t.id)}
                  title="Definir como padrão"
                  className={`p-1 ${
                    t.id === defaultId ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
                  }`}
                >
                  <Star className="h-4 w-4" fill={t.id === defaultId ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => remove(t.id)}
                  title="Excluir"
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor */}
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Descrição (opcional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Estrutura
            </label>
            <p className="mb-1 text-xs text-muted-foreground">
              Use <code>## Título da seção</code>, <code>### Título do grupo</code>, e
              <code> - item</code> em cada linha.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={20}
              spellCheck={false}
              className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary"
            />
            {parsedPreview ? (
              <p className="mt-1 text-xs text-emerald-600">
                {parsedPreview.reduce(
                  (n, s) => n + s.groups.reduce((m, g) => m + g.items.length, 0),
                  0,
                )}{" "}
                itens em {parsedPreview.length} seção(ões).
              </p>
            ) : (
              <p className="mt-1 text-xs text-destructive">Formato inválido.</p>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Salvar
            </button>
          </div>
        </div>
      </div>
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
      // Grupo implícito se não houver
      if (!curGroup) {
        gIdx += 1;
        curGroup = { id: `s${sIdx}g${gIdx}`, title: "Itens", items: [] };
        curSection.groups.push(curGroup);
      }
      iIdx += 1;
      const label = line.replace(/^[-*☐]\s*/, "").trim();
      if (label)
        curGroup.items.push({ id: `s${sIdx}g${gIdx}i${iIdx}`, label });
    }
  }
  if (sections.length === 0) throw new Error("Adicione ao menos uma seção (## Título).");
  return sections;
}
