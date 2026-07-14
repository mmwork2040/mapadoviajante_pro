## Objetivo

Reorganizar o CRM em torno do **Cliente**, com **Viagens** aninhadas (cada lead vira uma viagem), checklist ligado a atividades, benefícios e painel financeiro por viagem.

## 1. Modelo de dados

Aproveitar `crm_leads` como a tabela de viagens (rename lógico, sem quebrar dados):

- `crm_leads.client_id` já existe → passa a ser **obrigatório na UI** (leads antigos sem cliente ganham botão "vincular/criar cliente").
- Adicionar em `crm_leads`:
  - `budget_total numeric` (Valor total planejado)
  - `budget_client numeric` (Valor trazido pelo cliente, opcional)
  - `budget_osv numeric` (Valor OSV, opcional)
  - `benefits jsonb` — `{ miles: [{program, amount, notes}], perks: [{type, description}] }`

- Nova tabela `crm_trip_expenses` (gastos reais por viagem):
  `id, lead_id, activity_id (nullable), category (passagem/hospedagem/seguro/extra/outro), description, amount, paid_with (dinheiro/milhas/benefício), savings numeric, occurred_at, created_by, created_at`.
  RLS por agência via `lead_id → agency_id`.

- Ligação checklist ↔ atividades: adicionar coluna `checklist_item_key text` em `crm_itinerary_activities` (ou tabela equivalente de atividades usada hoje). Marcar item do checklist:
  - se o item tem `activity_id` vinculado → marca a atividade como concluída e registra log
  - se não tem → cria atividade automática do tipo `checklist` com o título do item
  - No template de checklist, cada item ganha campo opcional `default_activity_type` para pré-configurar essa vinculação.

## 2. Navegação / UI

- **Aba Clientes** vira ponto de entrada principal:
  - Lista de clientes (já existe)
  - Detalhe do cliente com abas: **Perfil**, **Viagens**, **Preferências**, **Notas**
  - Aba Viagens lista os leads/viagens do cliente + botão **"Nova viagem"** (usa `createLeadFromClient` já existente)

- **Aba Leads** continua existindo como funil de vendas (kanban), mas cada card mostra chip do cliente vinculado; abrir uma viagem leva ao mesmo drawer atual + nova aba **Financeiro**.

- **Drawer da Viagem** (LeadDetailDrawer) ganha abas reorganizadas:
  `Resumo | Roteiro/Atividades | Checklist | Financeiro | Benefícios | Notas`

## 3. Painel Financeiro da viagem

Dentro do drawer, aba **Financeiro**:

- Cards no topo: **Orçamento total**, **Gasto até agora**, **Saldo restante**, **Economia gerada** (soma de `savings` + diferença `budget_client − budget_osv` quando ambos preenchidos).
- Tabela de `crm_trip_expenses` com filtro por categoria, botão **"Adicionar gasto"** (form: categoria, descrição, valor, forma de pagamento, atividade vinculada opcional, economia gerada).
- Barra de progresso orçamento vs gasto.
- Comparativo "Valor trazido pelo cliente" × "Valor OSV" quando ambos existirem.

## 4. Benefícios

Aba **Benefícios** no drawer:

- Seção **Milhas & Pontos**: lista de programas (Smiles, Latam Pass, Livelo…) com saldo disponível e usado nessa viagem.
- Seção **Cortesias & Sala VIP**: lista de perks (ex.: "Sala VIP GRU via Mastercard Black", "Upgrade Latam"), cada um com descrição e status (planejado/utilizado). Ao marcar utilizado, opção de registrar como economia no financeiro.

## 5. Checklist ↔ Atividades

- Ao marcar item do checklist:
  1. Se item tem `activity_id` → toggle conclusão na atividade + entrada na timeline.
  2. Se não tem → cria atividade nova (`type=checklist`, `title=item`, `completed=true`) e vincula o `activity_id` no item para próximos toggles.
- Desmarcar → reverte conclusão.
- Editor de template de checklist (admin) ganha campo opcional "Tipo de atividade padrão" por item.

## 6. Fora do escopo desta rodada

- Import em massa de gastos, integração com contas financeiras da agência, relatório consolidado multi-viagem.

## Ordem de implementação

1. Migration: colunas em `crm_leads`, tabela `crm_trip_expenses`, coluna `checklist_item_key`/`activity_id` em itens.
2. Services + server fns: gastos, benefícios, toggle checklist↔atividade.
3. UI: aba Financeiro, aba Benefícios, reorganização do drawer.
4. Cliente → aba Viagens com "Nova viagem".
5. Editor de template: campo de atividade padrão.
