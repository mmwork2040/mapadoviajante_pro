## Aba de Clientes

Nova aba **Clientes** com cadastro completo de viajantes e atalho para criar viagens já com os dados pré-preenchidos.

### 1. Banco de dados

Nova tabela `crm_clients` (por agência):
- `id`, `agency_id`, `created_by`
- Dados básicos: `name`, `email`, `phone`, `whatsapp`
- Dados pessoais: `cpf`, `birth_date`, `passport_number`, `passport_expiry`, `passport_country`
- Endereço: `address_street`, `address_number`, `address_complement`, `address_neighborhood`, `address_city`, `address_state`, `address_zip`, `address_country`
- `preferences` (jsonb) — preferências base reutilizáveis (tipo de viagem, alimentação, hospedagem, etc.)
- `notes` (text)
- `created_at`, `updated_at`

RLS: membros da agência podem SELECT/INSERT/UPDATE/DELETE dentro da própria agência. Grants para `authenticated` e `service_role`.

Ligação leads ↔ clientes: adicionar coluna opcional `client_id uuid` em `crm_leads` (FK → `crm_clients.id`, `ON DELETE SET NULL`).

### 2. Backend (server functions)

`src/lib/clients.functions.ts` com `requireSupabaseAuth`:
- `listClients`, `getClient`, `createClient`, `updateClient`, `deleteClient`
- `createLeadFromClient({ clientId })` — cria um novo lead pré-preenchendo nome, contatos e copiando `preferences` para o `profile` do lead.

### 3. UI

- `src/routes/_app.clientes.tsx` — lista de clientes (busca por nome/email/cpf), botão "Novo cliente".
- `src/components/ClientFormDialog.tsx` — formulário com abas: **Contato**, **Documentos**, **Endereço**, **Preferências**, **Observações**.
- `src/components/ClientDetailDrawer.tsx` — visualização/edição + botões:
  - **Criar nova viagem** → chama `createLeadFromClient` e navega para o lead criado.
  - **Ver viagens** → lista de leads vinculados a esse cliente.
- Adicionar link "Clientes" na sidebar principal (ao lado de Leads/Tarefas).

### 4. Integração com leads

- No `LeadDetailDrawer`, no topo, se `lead.client_id` estiver vazio, mostrar botão "Vincular cliente" (busca/seleciona) ou "Salvar como cliente" (cria a partir dos dados do lead).
- Se vinculado, mostrar chip com nome do cliente e link para abrir seu perfil.

### Fora de escopo
- Importação em massa de clientes.
- Histórico de alterações do cliente.
- Mesclagem/deduplicação automática.
