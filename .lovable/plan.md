## Objetivo
- Clicar em qualquer card de tarefa (dashboard e página Tarefas) abre o painel do lead vinculado.
- O painel do lead ganha um botão para alternar entre **lateral (drawer)** e **tela cheia**.
- Dentro do painel, exibir o **histórico de outras viagens/roteiros do mesmo cliente**.

## Mudanças

### 1. Abrir lead ao clicar em card de tarefa
- `src/routes/_app.index.tsx` (Tarefas do Dia): tornar cada `<li>` clicável — se `t.lead_id` existir, `setDetailLeadId(t.lead_id)`; caso contrário, sem ação (cursor default). Adicionar `role="button"`, hover e foco acessíveis.
- `src/routes/_app.tarefas.tsx`: substituir o botão `ExternalLink` (que hoje vai para `/leads?lead=…`) por clique no próprio card, abrindo o `LeadDetailDrawer` inline. Adicionar estado local `detailLeadId` e renderizar `<LeadDetailDrawer />` no final da página (mesmo padrão do dashboard). Manter o toggle de concluir isolado (stopPropagation).

### 2. Modo tela cheia no painel do lead
- `src/components/LeadDetailDrawer.tsx`:
  - Nova prop opcional `initialFullscreen?: boolean` e estado interno `fullscreen`.
  - Botão no header (ao lado do X) com ícones `Maximize2` / `Minimize2` (lucide) para alternar.
  - Ajustar classes do container:
    - Drawer atual: `right-0 h-full w-full max-w-[560px]` (ou similar).
    - Tela cheia: `inset-0 w-full max-w-none rounded-none`.
  - Preservar `ScrollLock` e `useBackButtonClose`. Persistir preferência do usuário em `localStorage` (`lead-panel-fullscreen`).

### 3. Histórico de viagens do cliente
- Reutilizar `fetchItinerariesByLead` (já importado) apenas para o lead atual. Para trazer viagens **de outros leads do mesmo cliente**, agrupar por `email` (fallback: `phone`) do lead:
  - Nova função em `src/lib/services.ts`: `fetchClientTripHistory(lead: Lead)` que:
    1. Busca leads da agência com mesmo `email` (ou `phone`) diferentes do atual.
    2. Retorna itinerários (`crm_itineraries`) ligados a esses leads + os do lead atual, ordenados por `created_at` desc, com campos: id, title, destination, start_date, end_date, status, budget, lead_name.
- Na aba **Viagem** do `LeadDetailDrawer`, adicionar uma seção "Histórico do cliente" (colapsável) listando as viagens retornadas com link para abrir o roteiro (`/roteiros/$id`). Mostrar "Nenhuma viagem anterior" quando vazio.

## Notas técnicas
- Nenhuma mudança de schema; consulta usa RLS existente (mesma agência).
- Toggle full-screen é puramente CSS + estado, sem rota nova, mantendo compatibilidade com `search={{ lead }}` da página `/leads`.
- Card de tarefa sem `lead_id` continua não clicável (visual normal).
