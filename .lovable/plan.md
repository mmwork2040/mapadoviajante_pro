# Reconstruir o frontend usando o Supabase existente do repositório

O backend (banco, RLS, função `send-email`) já existe no Supabase do repo (`ddulmdacvcnkdkzwmsbz`). Não vou criar Lovable Cloud nem mexer no schema. Vou reconstruir apenas a **interface** na stack do Lovable (TanStack Start + React + Tailwind), apontando um cliente Supabase para esse projeto via URL + anon key (chave pública, ok no código).

## Estratégia
- Adicionar `@supabase/supabase-js` e criar um cliente em `src/integrations/supabase/client.ts` com a URL e a anon key do repo.
- Recriar a camada de serviço (`fetchLeads`, `createItinerary`, etc.) em TypeScript, espelhando `js/supabase.js` — mesmas tabelas e colunas.
- Portar a UI/CSS para componentes React + Tailwind (tokens equivalentes a `css/tokens.css`, fonte Inter).
- Autenticação via `supabase.auth` (login/cadastro) com contexto de agência/membro (`loadAgencyContext`).

## Tabelas usadas (já existentes, sem alteração)
`agencies`, `agency_members`, `crm_leads`, `crm_lead_activities`, `crm_itineraries`, `crm_itinerary_days`, `crm_itinerary_activities`, `crm_vouchers`, `crm_library_destinations`, `crm_tasks`, `crm_transactions`, `crm_ai_config`.

## Rotas (file-based em `src/routes/`)
- `/auth` — login/cadastro (pública)
- `/` (dashboard), `/leads`, `/roteiros`, `/biblioteca`, `/financeiro`, `/admin` — área autenticada (sob `_authenticated`)
- `/intake` — formulário público de captura de lead
- `/viajante/$id` — visão pública do roteiro do viajante

## Entrega em fases
**Fase 1 — Base:** cliente Supabase + auth (login/cadastro) + contexto de agência + layout (sidebar, header, tema claro/escuro, design system).
**Fase 2 — Leads & Dashboard:** CRUD de leads, funil por status, atividades, dashboard com estatísticas; intake público.
**Fase 3 — Roteiros & Biblioteca:** itinerários (dias/atividades/vouchers), visão do viajante, biblioteca de destinos.
**Fase 4 — Financeiro & Admin:** transações, tarefas, equipe, papéis e config de IA.
**Fase 5 — Thay IA & E-mail:** copilot e envio de e-mails reaproveitando a função `send-email` existente.

## Observações
- A anon key é pública por design — segura no código; as RLS do projeto continuam protegendo os dados.
- Para o copilot e e-mail, vou chamar as funções/edge functions que já existem nesse Supabase.
- Detalhes finos de colunas serão confirmados lendo `js/supabase.js` durante a Fase 1.

Posso começar pela Fase 1?