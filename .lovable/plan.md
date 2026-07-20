## Objetivo

Renomear rótulos e restringir visibilidade por papel:

- Página atual **"Viagens"** (rota `/leads`) → **"Vendas"**.
- Página atual **"Roteiros"** (rota `/roteiros`) → **"Viagens"**.
- **Vendas**: apenas o gestor (`role = admin` ou `gerente`) vê todas; demais membros veem apenas as vendas atribuídas a eles.
- **Viagens (ex-Roteiros)**: gestor vê todas; demais membros veem apenas as viagens cujo lead está atribuído a eles, com um filtro/toggle "Minhas / Todas" análogo ao já existente em `/leads`.

Rotas e nomes de arquivos permanecem (`/leads`, `/roteiros`) para evitar quebra de links salvos, roteiros existentes e imports do `routeTree.gen.ts`. Alteração é apenas de rótulos visíveis + filtro de dados.

## Mudanças

### 1. Rótulos (UI apenas)
- `src/components/layout/AppLayout.tsx`: item de menu `/leads` label `"Vendas"`; `/roteiros` label `"Viagens"`.
- `src/routes/_app.leads.tsx`: `PageHeader` title `"Vendas"` + subtítulo/ícone coerente; textos internos ("Nova Viagem" etc.) → "Nova Venda"/equivalentes onde referem-se à entidade.
- `src/routes/_app.roteiros.index.tsx`: `PageHeader` title `"Viagens"`; "Novo Roteiro" → "Nova Viagem"; textos correlatos (toasts, placeholders, modal `NewItineraryModal`).
- `src/routes/_app.roteiros.$id.tsx`: títulos/breadcrumb.
- Ajustes menores de texto em `_app.index.tsx` (dashboard), `_app.admin.tsx`, `_app.checklist-templates.tsx`, `_app.biblioteca.tsx`, `auth.tsx`, `__root.tsx` (head/meta) onde aparecem "Roteiros"/"Viagens" com a semântica antiga.

Nenhuma rota, tabela ou chave de query renomeada.

### 2. Filtro por papel em Vendas (`/leads`)
Hoje `_app.leads.tsx` já tem toggle `onlyMine`. Ajuste:
- Se o membro atual **não é gestor** (`role !== 'admin' && role !== 'gerente'`), forçar `onlyMine = true` e ocultar o toggle.
- Gestor mantém toggle "Minhas / Todas" como hoje.

### 3. Filtro por papel em Viagens (`/roteiros`)
- Em `fetchItineraries` (`src/lib/services.ts`), quando o membro atual não é gestor, filtrar via join no lead: `crm_leads.assigned_to = <memberId>`. Alternativa: buscar todos e filtrar no cliente por `it.lead?.assigned_to` — para isso incluir `assigned_to` no `select` do relacionamento (`lead:crm_leads!...(name, profile, assigned_to)`) e filtrar em memória.
- Adicionar toggle "Minhas / Todas" em `_app.roteiros.index.tsx` (apenas visível para gestor), padrão "Todas" para gestor e "Minhas" fixo para demais.
- Ajustar tipo `Itinerary["lead"]` (ou tipo local) para incluir `assigned_to`.

### 4. Sem migração de banco
Papéis já existem em `agency_members.role`. Nenhuma coluna nova. RLS existente segue válida.

## Verificação
- Logar como membro comum: `/leads` mostra só atribuídas, sem toggle; `/roteiros` mostra só viagens de leads dele.
- Logar como admin/gerente: ambos toggles disponíveis, "Todas" lista tudo.
- Menu lateral mostra "Vendas" e "Viagens" nos lugares corretos.