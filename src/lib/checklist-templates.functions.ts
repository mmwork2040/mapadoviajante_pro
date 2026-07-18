import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Templates de checklist são armazenados na tabela `system_settings` sob a chave
// `agency_cfg:{agencyId}:checklists`. Isso evita a necessidade de uma nova
// tabela e mantém o padrão já usado por outras configurações da agência.

export type ChecklistItem = { id: string; label: string };
export type ChecklistGroup = { id: string; title: string; items: ChecklistItem[] };
export type ChecklistSection = { id: string; title: string; groups: ChecklistGroup[] };
export type ChecklistTemplate = {
  id: string;
  name: string;
  description?: string;
  sections: ChecklistSection[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type StoredValue = {
  templates: ChecklistTemplate[];
  defaultId: string | null;
};

const KEY = (agencyId: string) => `agency_cfg:${agencyId}:checklists`;

const DEFAULT_TEMPLATE: ChecklistTemplate = {
  id: "consultoria-completa",
  name: "Consultoria completa",
  description: "Checklist padrão para consultorias completas.",
  sections: [
    {
      id: "s1",
      title: "Reunião de Briefing",
      groups: [
        {
          id: "s1g1",
          title: "Informações iniciais",
          items: [
            { id: "s1g1i1", label: "Reunião briefing" },
            { id: "s1g1i2", label: "Preenchimento formulário" },
          ],
        },
        {
          id: "s1g2",
          title: "Definição da viagem",
          items: [
            { id: "s1g2i1", label: "Definição de datas" },
            { id: "s1g2i2", label: "Definição de locais" },
            { id: "s1g2i3", label: "Definir preferências de hospedagens" },
            { id: "s1g2i4", label: "Definir passeios" },
            { id: "s1g2i5", label: "Orçamento" },
          ],
        },
        {
          id: "s1g3",
          title: "Orientações iniciais",
          items: [
            { id: "s1g3i1", label: "Checklist de documentos para o cliente" },
            { id: "s1g3i2", label: "Orientações sobre cartões" },
          ],
        },
      ],
    },
    {
      id: "s2",
      title: "Planejamento da Viagem",
      groups: [
        {
          id: "s2g1",
          title: "Transporte",
          items: [
            { id: "s2g1i1", label: "Passagem IDA" },
            { id: "s2g1i2", label: "Passagem VOLTA" },
            { id: "s2g1i3", label: "Passagem Interna 01" },
          ],
        },
        {
          id: "s2g2",
          title: "Hospedagem",
          items: [
            { id: "s2g2i1", label: "Sugestão de hospedagens" },
            { id: "s2g2i2", label: "Fechamento hospedagens" },
          ],
        },
        {
          id: "s2g3",
          title: "Passeios",
          items: [{ id: "s2g3i1", label: "Reserva de passeios" }],
        },
      ],
    },
    {
      id: "s3",
      title: "Construção do Material",
      groups: [
        {
          id: "s3g1",
          title: "Organização",
          items: [
            { id: "s3g1i1", label: "Drive com comprovantes de reserva" },
            { id: "s3g1i2", label: "Planilha com prévia do roteiro" },
            { id: "s3g1i3", label: "Prévia do roteiro no Gamma" },
            { id: "s3g1i4", label: "Criar My Maps" },
          ],
        },
        {
          id: "s3g2",
          title: "Cartilha",
          items: [
            { id: "s3g2i1", label: "Prévia da cartilha" },
            { id: "s3g2i2", label: "Cartilha" },
          ],
        },
        {
          id: "s3g3",
          title: "Envio de informações",
          items: [
            { id: "s3g3i1", label: "Enviar para ele principalmente o checklist do que vai precisar" },
            { id: "s3g3i2", label: "Conta Wise" },
            { id: "s3g3i3", label: "Seguro viagem" },
          ],
        },
      ],
    },
    {
      id: "s4",
      title: "Reunião de Entrega",
      groups: [
        {
          id: "s4g1",
          title: "Material",
          items: [{ id: "s4g1i1", label: "Cartilha pronta" }],
        },
        {
          id: "s4g2",
          title: "Orientações",
          items: [
            { id: "s4g2i1", label: "Orientações sobre câmbio e internet" },
            { id: "s4g2i2", label: "Dicas de aeroporto" },
            { id: "s4g2i3", label: "Sala Vip" },
            { id: "s4g2i4", label: "Orientações sobre o destino" },
          ],
        },
        {
          id: "s4g3",
          title: "Brinde",
          items: [
            { id: "s4g3i1", label: "Bilhete personalizado para incluir no brinde" },
            { id: "s4g3i2", label: "Fazer e enviar brinde" },
          ],
        },
        {
          id: "s4g4",
          title: "Encerramento",
          items: [{ id: "s4g4i1", label: "Reunião final" }],
        },
      ],
    },
  ],
};

async function resolveMember(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<{ agencyId: string; role: string } | null> {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data?.agency_id) return null;
  return { agencyId: data.agency_id as string, role: (data.role as string) || "user" };
}

type SupaLike = { from: (t: string) => any };

async function readValue(supabase: SupaLike, agencyId: string): Promise<StoredValue> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", KEY(agencyId))
    .maybeSingle();
  const raw = (data?.value ?? null) as StoredValue | null;
  if (!raw || !Array.isArray(raw.templates) || raw.templates.length === 0) {
    return { templates: [DEFAULT_TEMPLATE], defaultId: DEFAULT_TEMPLATE.id };
  }
  return raw;
}

async function writeValue(supabase: SupaLike, agencyId: string, value: StoredValue): Promise<void> {
  const { error } = await supabase.from("system_settings").upsert(
    {
      key: KEY(agencyId),
      value: value as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}

/** Lista templates de checklist da agência do usuário (qualquer membro ativo). */
export const listChecklistTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StoredValue> => {
    const m = await resolveMember(context.supabase, context.userId);
    if (!m) return { templates: [DEFAULT_TEMPLATE], defaultId: DEFAULT_TEMPLATE.id };
    return await readValue(context.supabase, m.agencyId);
  });

/** Contagem de leads que usam cada template (por templateId). */
export const getChecklistTemplatesUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, number>> => {
    const m = await resolveMember(context.supabase, context.userId);
    if (!m) return {};
    const { data, error } = await context.supabase
      .from("crm_leads")
      .select("checklists")
      .eq("agency_id", m.agencyId)
      .not("checklists", "is", null);
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { checklists: unknown }[]) {
      const c = row.checklists as { templateId?: string } | null;
      const tid = c && typeof c.templateId === "string" ? c.templateId : null;
      if (tid) counts[tid] = (counts[tid] ?? 0) + 1;
    }
    return counts;
  });

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sections: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      groups: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          items: z.array(
            z.object({ id: z.string().min(1), label: z.string().min(1) }),
          ),
        }),
      ),
    }),
  ),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** Salva um template (upsert por id). Apenas admin. */
export const saveChecklistTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ template: templateSchema }).parse(data))
  .handler(async ({ data, context }): Promise<StoredValue> => {
    const m = await resolveMember(context.supabase, context.userId);
    if (!m) throw new Error("Agência não encontrada.");
    if (m.role !== "admin") throw new Error("Sem permissão.");
    const current = await readValue(context.supabase, m.agencyId);
    const now = new Date().toISOString();
    const idx = current.templates.findIndex((t) => t.id === data.template.id);
    const incoming: ChecklistTemplate = { ...data.template, updatedAt: now };
    if (idx >= 0) current.templates[idx] = { ...current.templates[idx], ...incoming };
    else current.templates.push({ ...incoming, createdAt: now });
    if (!current.defaultId) current.defaultId = current.templates[0]?.id ?? null;
    await writeValue(context.supabase, m.agencyId, current);
    return current;
  });

/** Remove um template. Apenas admin. */
export const deleteChecklistTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }): Promise<StoredValue> => {
    const m = await resolveMember(context.supabase, context.userId);
    if (!m) throw new Error("Agência não encontrada.");
    if (m.role !== "admin") throw new Error("Sem permissão.");
    // Bloqueia exclusão se algum lead já usa este template
    const { count, error: countErr } = await context.supabase
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", m.agencyId)
      .filter("checklists->>templateId", "eq", data.id);
    if (countErr) throw new Error("Não foi possível validar uso do template.");
    if ((count ?? 0) > 0) {
      throw new Error(
        `Este template já foi aplicado em ${count} lead(s) e não pode ser excluído.`,
      );
    }
    const current = await readValue(context.supabase, m.agencyId);
    current.templates = current.templates.filter((t) => t.id !== data.id);
    if (current.defaultId === data.id) current.defaultId = current.templates[0]?.id ?? null;
    if (current.templates.length === 0) {
      current.templates = [DEFAULT_TEMPLATE];
      current.defaultId = DEFAULT_TEMPLATE.id;
    }
    await writeValue(context.supabase, m.agencyId, current);
    return current;
  });

/** Define o template padrão. Apenas admin. */
export const setDefaultChecklistTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }): Promise<StoredValue> => {
    const m = await resolveMember(context.supabase, context.userId);
    if (!m) throw new Error("Agência não encontrada.");
    if (m.role !== "admin") throw new Error("Sem permissão.");
    const current = await readValue(context.supabase, m.agencyId);
    if (!current.templates.some((t) => t.id === data.id)) {
      throw new Error("Template não encontrado.");
    }
    current.defaultId = data.id;
    await writeValue(context.supabase, m.agencyId, current);
    return current;
  });

/** Gera estrutura de checklist (formato Markdown ##/###/-) via IA. */
export const generateChecklistStructureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ context: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const { data: cfg, error } = await context.supabase
      .from("crm_ai_config")
      .select("*")
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a configuração de IA.");
    if (!cfg || !cfg.api_key_encrypted) throw new Error("IA não configurada.");
    const ks = (cfg.knowledge_sources as { status?: string } | null) ?? null;
    if (ks?.status !== "connected") {
      throw new Error("A IA precisa ser testada e conectada nas configurações.");
    }
    const { askCopilot } = await import("./ai.server");
    const prompt = `Você é um especialista em consultoria de viagens. Gere uma estrutura de checklist em Markdown para o seguinte contexto:

"${data.context}"

Formato ESTRITO da resposta (sem explicações, sem código, sem cabeçalhos extras):
- Use "## Título da Seção" para seções (etapas principais).
- Use "### Título do Grupo" para subgrupos dentro de uma seção.
- Use "- item" para cada tarefa/verificação.
- Cubra de forma prática e objetiva as etapas relevantes.
- Português do Brasil, tom profissional e conciso.

Responda apenas com o Markdown do checklist.`;
    const text = await askCopilot(
      {
        provider: cfg.provider ?? "openai",
        model: cfg.model ?? "",
        apiKey: cfg.api_key_encrypted,
        maxTokens: cfg.max_tokens,
      },
      prompt,
    );
    // Remove fences se a IA envolver em ```
    const cleaned = text
      .replace(/^```(?:markdown|md)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return { text: cleaned + "\n" };
  });
