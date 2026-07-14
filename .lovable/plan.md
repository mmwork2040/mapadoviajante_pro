# Templates de Checklist para Roteiros

## Objetivo
Permitir que o admin crie e edite templates de checklist (o primeiro será "Consultoria completa" com o conteúdo enviado). Ao iniciar um novo roteiro/lead, o consultor escolhe qual template aplicar — os itens são copiados para o roteiro e podem ser marcados individualmente.

## Estrutura de dados (Supabase)

Nova tabela `crm_checklist_templates` (por agência):
- `id uuid pk`, `agency_id uuid`, `name text`, `description text`, `is_default boolean`, `sections jsonb`, timestamps.
- `sections` é um array: `[{ title, groups: [{ title, items: [{ id, label }] }] }]`.
- RLS: SELECT para membros da agência; INSERT/UPDATE/DELETE apenas admin (`user_has_role('admin')`).
- GRANTs para `authenticated` e `service_role`.
- Seed: inserir template "Consultoria completa" com o conteúdo fornecido pelo usuário, marcado como `is_default = true`.

Nos leads, o checklist marcado já existe no campo `checklists jsonb` — vamos guardar como:
```
{
  templateId: "...",
  templateName: "Consultoria completa",
  items: { "<itemId>": true, ... }
}
```

## Fluxo

### Admin — nova página `/adm/checklists`
- Lista de templates da agência.
- Botão "Novo template" e edição inline de cada seção/grupo/item (add, remover, renomear, reordenar simples).
- Marcar um como padrão (apenas um por agência).
- Somente admin acessa (gate por `isAdminUser`).

### Ao criar/abrir um lead sem checklist
- No `LeadDetailDrawer` (aba Viagem ou nova aba "Checklist"):
  - Se o lead não tem template aplicado, mostrar dropdown "Aplicar template" com os templates disponíveis (default pré-selecionado).
  - Ao aplicar, salvar `templateId` + estrutura no `lead.checklists`.
- Renderizar as seções/grupos/itens como checkboxes; alterações persistem em `crm_leads.checklists`.
- Botão "Trocar template" (confirma antes, pois zera as marcações).

## Arquivos

**Migração**
- Nova migration: cria `crm_checklist_templates`, grants, RLS, seed do template "Consultoria completa" para cada agência existente.

**Backend / serviços**
- `src/lib/checklist-templates.functions.ts`: `listTemplates`, `getTemplate`, `upsertTemplate`, `deleteTemplate`, `setDefault` (com `requireSupabaseAuth`).
- Extender `src/lib/services.ts` (ou novo helper) para salvar `checklists` no lead.

**UI**
- `src/routes/_app.adm.checklists.tsx` — CRUD de templates (admin only).
- `src/components/ChecklistEditor.tsx` — editor de seções/grupos/itens.
- `src/components/LeadChecklistPanel.tsx` — usado no `LeadDetailDrawer` para escolher template e marcar itens.
- Integrar no `LeadDetailDrawer.tsx` (nova aba "Checklist" ou dentro de "Viagem").
- Adicionar link "Checklists" no menu admin.

## Fora do escopo
- Reordenação drag-and-drop refinada (usar botões up/down simples).
- Versionamento de templates (alterar template não retroage em leads existentes).
