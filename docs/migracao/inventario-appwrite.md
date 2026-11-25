# Inventário do Appwrite · Fase 0 (F0-T2)

Feito em 25/11/2026, **somente leitura**. Nada foi criado, alterado ou apagado no Appwrite.

| Item | Valor |
|---|---|
| Servidor | `https://appwrite.agenc-ia.net/v1` (próprio, versão 2.3.0) |
| Projeto | `6abdb8190017d98565f5` ("Mapa do Viajante PRO") |
| Banco | `6abdb82f002c563b2ad3` |
| Bucket em uso | `trip-attachments` |

## Como este inventário foi feito, e o que ainda falta

A chave do Appwrite guardada no ambiente da sessão ("Appwrite - chave de configuração") **foi recusada pelo servidor**. Sem uma chave válida, não dá para listar atributos, índices, permissões, functions, teams nem contar documentos.

Por isso este inventário vem de duas fontes:

1. **O código do app** (`src/`): toda coleção, bucket e canal de tempo real que o app usa, e os campos que ele lê e grava.
2. **Testes sem login** no servidor: uma leitura de 1 registro por coleção, que mostra se a coleção existe (404 quando não existe) e se está aberta para visitantes.

**Falta confirmar com uma chave de leitura** (seção 6): atributos e tipos reais, índices, permissões de cada coleção, quantidade de documentos, functions, teams e usuários.

## 1. Alerta de segurança (resolver antes de qualquer outra coisa)

Dois recursos respondem **sem login**, para qualquer pessoa na internet que tenha o ID do projeto (ele está no código do site):

| Recurso | O que o teste mostrou | Risco |
|---|---|---|
| Coleção `crm_clients` | Lista os 5 clientes cadastrados sem login. A coleção tem leitura para `any`. Três documentos também têm `update("any")` e `delete("any")` | Dados pessoais (CPF, passaporte, endereço, telefone) expostos. Se a segurança por documento estiver ligada, esses três também podem ser alterados ou apagados por qualquer pessoa |
| Bucket `trip-attachments` | Lista o arquivo guardado (um PDF) sem login. O bucket tem leitura para `any` | Anexos de viagem (vouchers, documentos) expostos |

No teste só foram lidos o ID, as permissões e a agência de cada registro. Nenhum dado pessoal foi baixado.

As outras 15 coleções testadas recusam o visitante (401), como devem.

**Plano proposto para fechar (aguardando aprovação, nada foi aplicado):**

1. Criar no console do Appwrite uma chave temporária com os escopos `collections.read`, `collections.write`, `buckets.read` e `buckets.write`.
2. Rodar `node scripts/fechar-banco-appwrite.mjs` **sem** `--aplicar`. Ele só mostra o que mudaria em cada coleção e no bucket.
3. Conferir a lista. Rodar de novo com `--aplicar`: cada coleção e o bucket passam a aceitar só usuários logados, e a segurança por documento é desligada (para as permissões `any` gravadas nos registros antigos deixarem de valer).
4. Repetir o teste sem login. Tudo deve responder 401.
5. Apagar a chave temporária.

Isso estanca o vazamento para fora. A separação **entre agências** (um usuário logado de uma agência não ler os dados de outra) continua pendente e é a tarefa F2-T2 do plano.

## 2. Coleções: o que existe hoje e para onde vai

"Existe" vem do teste no servidor. "Campos" vem do código, e precisa ser conferido com a chave de leitura.

| Coleção atual | Existe | Visitante lê | Campos que o app usa | Coleção alvo (`MODELO-DE-DADOS-APPWRITE.md`) |
|---|---|---|---|---|
| `agencies` | sim | não | name, slug, email, phone, cnpj, logo_url, settings (JSON) | `agencies` + um Team por agência |
| `agency_members` | sim | não | agency_id, user_id, name, email, phone, role, status, is_active, avatar_color, invite_token, pref_leads_mine, pref_tasks_mine, pref_agenda_mine | `members` + participação no Team. `invite_token` vira `invites` (ou convite do próprio Team) |
| `crm_clients` | sim | **sim** | agency_id, created_by, name, email, phone, whatsapp, cpf, birth_date, passport_number, passport_expiry, passport_country, address_*, preferences (JSON, **guarda também os familiares**), notes | `people` (titular). Os familiares dentro de `preferences` viram `people` da mesma `households` |
| `crm_leads` | sim | não | agency_id, assigned_to, client_id, name, email, phone, destination, value, status, origin, notes, profile (JSON), checklists (JSON), benefits (JSON), budget_total, budget_client, budget_osv, last_activity_at, archived_at | `trips` (fase comercial) + `trip_travelers`. `checklists` vira `checklist_items`; `profile` e `benefits` vão para `trips.profile` |
| `crm_lead_activities` | sim | não | agency_id, lead_id, author_id, assigned_to_id, type, title, details, mentions, due_date, completed_at | `history`. Atividade com `due_date` também vira `agenda_items` |
| `crm_lead_documents` | **não existe** | — | agency_id, lead_id, itinerary_id, activity_id, name, file_path, mime_type, size, category, content | `trip_documents`. **Hoje a tela de documentos da viagem não tem onde gravar** |
| `crm_itineraries` | sim | não | agency_id, lead_id, created_by, title, client_name, destination, start_date, end_date, passengers, budget, spent, status, cover_image, share_token | A **mesma** `trips` da venda (fase preparação). `share_token` vira `share_links` |
| `crm_itinerary_days` | sim | não | itinerary_id, day_number, date, label/title, sort_order | `trip_days` |
| `crm_itinerary_activities` | sim | não | day_id, type, title, description, location, maps_url, time_start, duration, cost, sort_order, images, hotel_options, suggestion_options, passenger_costs | `trip_items` |
| `crm_vouchers` | sim | não | itinerary_id, name, category, confirmation_code, file_url, notes | `trip_documents` |
| `crm_trip_expenses` | sim | não | agency_id, lead_id, activity_id, category, description, amount, paid_with, savings, occurred_at, created_by | `trip_expenses` |
| `crm_transactions` | sim | não | agency_id, lead_id, itinerary_id, type, category, description, amount, status, transaction_date, created_by | `transactions` |
| `crm_tasks` | sim | não | agency_id, assigned_to, created_by, lead_id, itinerary_id, title, description, due_date, priority, completed, completed_at | `agenda_items` |
| `crm_notifications` | sim | não | agency_id, recipient_id, actor_id, lead_id, type, title, body, link, read | `notifications` |
| `crm_library_destinations` | sim | não | agency_id, name, country, category, description, attractions, best_season, climate, currency, avg_budget, visa_required, timezone, tags, image_url, operational_notes | `destination_catalog` (e `library_items` quando for conteúdo pronto) |
| `crm_library_items` | sim | não | agency_id, created_by, type, title, description, content, days, location, price, tags, file_name, file_url, image_url | `library_items` |
| `crm_ai_config` | sim | não | agency_id, provider, model, system_prompt, max_tokens, knowledge_sources, api_key_encrypted | `settings` (Assistente). A chave sai da coleção e fica só no servidor |
| `system_settings` | sim | não | key, value (JSON) | Ver seção 3 |
| `agency_payment_settings` | **não existe** | — | agency_id, asaas_api_key, asaas_webhook_token, … | Nenhuma por enquanto (Asaas desligado, D4). O webhook do Asaas responde "token desconhecido" |

Nenhuma coleção do modelo alvo existe ainda (testadas: `people`, `households`, `trips`, `trip_travelers`, `trip_days`, `trip_items`, `checklist_items`, `trip_documents`, `history`, `agenda_items`, `proposals`, `proposal_options`, `proposal_templates`, `contracts`, `contract_templates`, `payments`, `library_items`, `library_imports`, `checklist_templates`, `skills`, `destination_catalog`, `partner_links`, `guides`, `ai_usage`, `transactions`, `integrations`, `notifications`, `share_links`, `intake_submissions`, `members`, `invites`). A Fase 2 cria todas do zero, sem conflito de nomes.

## 3. O que está guardado em `system_settings`

Uma coleção de chave e valor que faz o papel de várias. Na Fase 2, cada grupo vai para o seu lugar.

| Chave | Conteúdo | Destino |
|---|---|---|
| `agency_cfg:{agência}:gmail` | E-mail de envio (com senha do Gmail) | `integrations` + segredo só no servidor |
| `agency_cfg:{agência}:notifications` | Push (inclui a conta de serviço do Firebase) e eventos | `settings` + segredo só no servidor |
| `agency_cfg:{agência}:n8n` | Segredo do webhook do n8n | `integrations` + segredo só no servidor |
| `agency_cfg:{agência}:webhook` | Webhook de saída | `integrations` |
| `agency_cfg:{agência}:form` | Código do formulário de captação | `settings` (formulário nativo na F12) |
| `agency_cfg:{agência}:gdrive` | Pasta do Google Drive | `integrations` |
| `agency_cfg:{agência}:checklists` | Modelos de checklist | `checklist_templates` |
| `agency_cfg:{agência}:trip_types` | Tipos de viagem | `settings` |
| `agency_cfg:{agência}:permissions` | Quem vê e edita o financeiro | Papéis do Team (F2-T2) |
| `agency_cfg:{agência}:payments` | Configuração de pagamento | `settings` (Asaas desligado) |
| `ai_usage:{agência}:{AAAA-MM}` | Tokens de IA usados no mês | `ai_usage` |
| `platform_cfg:ai_quota` | Cota padrão de IA | `agencies.aiQuota` |
| `push_token:{usuário}:{aparelho}` | Aparelhos que recebem push | Coleção própria de aparelhos (ou Appwrite Messaging) |
| `push_delivery:{id}` | Confirmação de entrega de push | Descartar depois de migrar |

Atenção: há **segredos dentro de documentos** (senha do Gmail, conta de serviço do Firebase, segredo do n8n, chave de IA em `crm_ai_config`). Hoje só o servidor os lê, mas quem protege é a permissão da coleção. Regra 1 da arquitetura: passam para variáveis do servidor ou coleção sem leitura para usuários.

## 4. Arquivos, tempo real, login e funções

| Tema | Hoje | Alvo |
|---|---|---|
| Bucket `trip-attachments` | Existe. **Aberto para visitantes.** Guarda os anexos da viagem | `documentos`, privado por agência |
| Bucket `library-assets` | **Não existe**, mas o código da Biblioteca grava nele. Envio de arquivo e de foto na Biblioteca falha | `biblioteca` (criar na F2-T3) |
| Tempo real | 4 inscrições: `crm_leads` (contador do menu e quadro) e `crm_notifications` (sino e página) | Viagens, agenda e notificações (F2-T7) |
| Login | Conta do Appwrite: e-mail e senha, Google, recuperação de senha | Mantém |
| Equipe por agência | Coleção `agency_members` (campo `role`). **Não usa Teams do Appwrite.** O login marca todo usuário como admin no navegador (só afeta o que a tela mostra) e `has_role` sempre responde verdadeiro | Um Team por agência, papéis = cargos (A5), permissão no documento |
| Criação de agência | Feita pelo navegador quando o usuário não tem agência (`provision_agency`) | Pelo servidor, com acesso liberado pela Hotmart (D5) |
| Functions do Appwrite | O app não chama nenhuma. Toda lógica de servidor roda na Vercel (`src/lib/*.functions.ts`) | Decidir na F2: manter na Vercel ou mover para Functions (ver P3 no plano) |
| Super admin | Lista de e-mails no código e em `SUPER_ADMIN_EMAILS` | Painel próprio (F13) |

## 5. O que ainda aponta para fora do Appwrite

Depois da limpeza desta fase, não há mais nenhuma referência a Supabase ou Lovable no código. O que continua falando com outros serviços, por desenho:

| Serviço | Para quê | Situação |
|---|---|---|
| Vercel | Hospedagem e funções de servidor | Mantém (P3) |
| Provedores de IA (gateway da Vercel, OpenAI, Anthropic, Google) | Thay IA, roteiro, checklist | Chave só no servidor (D2) |
| Firebase Cloud Messaging | Push no celular | Mantém. O Appwrite Messaging também usa o FCM por baixo |
| Google Drive | Importar documentos no roteiro | Reescrito para a API do Google com conta de serviço. **Falta configurar e testar** |
| Gmail (SMTP) | Convites e e-mails | Mantém |
| Asaas | Pagamento | Desligado (D4) |
| n8n | Entrada de viagens | Agora grava no Appwrite. **Falta testar com um envio real** |
| Fontes do Google, Wikimedia, Nominatim, ViaCEP, IBGE | Fontes, fotos, mapas, CEP | Serviços públicos, sem conta |

## 6. Para completar o inventário

Criar no console do Appwrite uma chave **só de leitura** com os escopos `databases.read`, `collections.read`, `attributes.read`, `indexes.read`, `documents.read`, `buckets.read`, `files.read`, `functions.read`, `teams.read` e `users.read`, e guardar no ambiente da sessão para o host `appwrite.agenc-ia.net`, **no cabeçalho `X-Appwrite-Key`** (sem a palavra `Bearer`).

Com ela, a próxima rodada preenche: tipo e tamanho de cada atributo, índices, permissões exatas, quantidade de documentos por coleção e por agência, e se existem functions, teams ou usuários órfãos.
