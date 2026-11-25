# Inventário do Appwrite

Atualizado em 25/11/2026 com leitura direta do servidor. **Única mudança feita no Appwrite, com aprovação:** a coleção `crm_lead_documents` foi criada e seis limites de texto foram ampliados (seção 3). Nenhum registro foi alterado ou apagado.

| Item | Valor |
|---|---|
| Servidor | `https://appwrite.agenc-ia.net/v1` (próprio, versão 2.3.0) |
| Projeto | `6abdb8190017d98565f5` ("Mapa do Viajante PRO") |
| Banco | `6abdb82f002c563b2ad3` (`mapa_viajante_pro`) |
| Coleções | 18 (17 que já existiam e `crm_lead_documents`, criada nesta fase) |
| Bucket | `trip-attachments` (1 arquivo) |
| Usuários | 5 |
| Functions | nenhuma |
| Teams | nenhum |
| Índices | nenhum, em nenhuma coleção |

## 1. Segurança

**Situação hoje:** as 18 coleções e o bucket aceitam só usuários logados, e a segurança por documento está desligada. Visitante sem login não lê nada. `crm_transactions` não tem nenhuma permissão para usuários: só o servidor acessa, como deve ser.

No primeiro teste desta fase, feito sem chave, `crm_clients` e o bucket responderam sem login. Na leitura seguinte as permissões já estavam corretas. Para conferir a qualquer momento: `node scripts/appwrite/fechar-banco.mjs` (sem `--aplicar` ele só mostra).

**O que continua aberto:** qualquer pessoa com conta lê e grava os dados de **todas** as agências, porque a permissão é "usuários logados" e não "equipe da agência". O app filtra por agência, mas quem protege de verdade é o Appwrite. Isso é a tarefa F2-T2 do plano (um Team por agência).

## 2. Coleções

`*` marca campo obrigatório. O número entre colchetes é o limite de caracteres que o campo tinha na leitura inicial; os ampliados estão na seção 3.

| Coleção | Registros | Quem acessa | Campos | Coleção alvo |
|---|---|---|---|---|
| `agencies` | 8 | usuários logados | name*, slug*, cnpj, phone, email, logo_url, settings, created_at, updated_at | `agencies` + um Team por agência |
| `agency_members` | 13 | usuários logados | agency_id*, user_id, name*, email, phone, role*, status*, avatar_color, invite_token, is_active, pref_agenda_mine, pref_leads_mine, pref_tasks_mine, created_at, updated_at | `members` + participação no Team |
| `crm_clients` | 5 | usuários logados | agency_id*, name*, email, phone, whatsapp, cpf, birth_date, passport_number, passport_country, passport_expiry, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_country, notes [10000], created_by, created_at, updated_at, preferences | `people` (titular); familiares em `preferences` viram `people` da mesma `households` |
| `crm_leads` | 8 | usuários logados | agency_id*, name*, email, phone, status*, origin, destination, value, budget_total, budget_client, budget_osv, assigned_to, client_id, notes [4000], last_activity_at, archived_at, created_at, updated_at, checklists [8000], profile | `trips` (fase comercial) + `trip_travelers`; `checklists` vira `checklist_items` |
| `crm_lead_activities` | 0 | usuários logados | agency_id*, lead_id*, author_id*, type*, title*, details, due_date, completed_at, assigned_to_id, mentions, created_at | `history`; com data, também `agenda_items` |
| `crm_itineraries` | 6 | usuários logados | agency_id*, title*, destination, client_name, lead_id, status, start_date, end_date, passengers, budget, spent, cover_image, share_token, created_by, created_at, updated_at | a mesma `trips` da venda (fase preparação); `share_token` vira `share_links` |
| `crm_itinerary_days` | 83 | usuários logados | itinerary_id*, day_number*, date, label, sort_order, created_at | `trip_days` |
| `crm_itinerary_activities` | 45 | usuários logados | day_id*, title*, type*, time_start, duration [50], location, maps_url, description, cost, sort_order, created_at | `trip_items` (os dados extras ganham campo próprio, `kindData`) |
| `crm_vouchers` | 1 | usuários logados | itinerary_id*, name*, category, confirmation_code, file_url, notes [5000], created_at | `trip_documents` |
| `crm_trip_expenses` | 0 | usuários logados | agency_id*, lead_id*, activity_id, category*, description, amount*, paid_with*, savings, occurred_at, created_by, created_at | `trip_expenses` |
| `crm_transactions` | 0 | só o servidor | agency_id*, type*, amount*, category, description, transaction_date*, status, lead_id, itinerary_id, created_by, created_at, updated_at | `transactions` |
| `crm_tasks` | 0 | usuários logados | agency_id*, title*, description, due_date, priority, completed, completed_at, assigned_to, lead_id, itinerary_id, created_by, created_at, updated_at | `agenda_items` |
| `crm_notifications` | 1 | usuários logados | agency_id*, recipient_id*, title*, body, type*, link, lead_id, actor_id, read, created_at | `notifications` |
| `crm_library_destinations` | 7 | usuários logados | agency_id*, name*, country, category, climate, currency, timezone, best_season, visa_required, description, avg_budget, image_url, attractions, tags, created_at, updated_at, operational_notes | `destination_catalog` |
| `crm_library_items` | 19 | usuários logados | agency_id*, title*, type*, location, price, days, description, file_url, file_name, image_url, tags, created_by, created_at, updated_at, content [1500] | `library_items` |
| `crm_ai_config` | 1 | usuários logados | agency_id*, provider, model, api_key_encrypted, system_prompt [10000], max_tokens, created_at, updated_at, knowledge_sources [3000] | `settings` (Assistente); a chave sai da coleção |
| `system_settings` | 33 | usuários logados | key*, value [10000], created_at, updated_at | ver seção 4 |

Nenhuma coleção do modelo alvo existe ainda. A Fase 2 cria todas do zero, sem conflito de nomes.

## 3. O que o app usa e não existe no Appwrite

| O que falta | Efeito | Como resolver |
|---|---|---|
| Coleção `crm_lead_documents` | Anexos dos itens do roteiro, documentos da viagem e do cliente e a aba Documentos da Biblioteca não gravavam | **Criada em 25/11/2026** por `scripts/appwrite/estrutura-que-falta.mjs`: 11 campos (agency_id*, lead_id, itinerary_id, activity_id, name*, category, file_path, mime_type, size, content, created_at), só usuários logados |
| Bucket `library-assets` | Não é mais necessário: o app passou a usar o bucket `trip-attachments` para a Biblioteca também | Nada a fazer |
| Limites de texto pequenos | Modelos de checklist acima de 10 mil caracteres, materiais de referência da IA acima de 3 mil e conteúdo da Biblioteca acima de 1.500 eram recusados | **Ampliados em 25/11/2026:** `system_settings.value` e `crm_ai_config.knowledge_sources` para 1 milhão; `crm_library_items.content` e `crm_leads.checklists` para 100 mil; `crm_ai_config.system_prompt` e `crm_leads.notes` para 20 mil |
| Campos para os dados extras do item do roteiro | Resolvido no código: moeda, valor em reais, sugestões, valores por pessoa, fotos e "feito" vão junto da observação (`description`) | Na Fase 2 ganham campo próprio |
| Campo `benefits` em `crm_leads` | Resolvido no código: os benefícios ficam dentro de `profile` | Na Fase 2 ganham campo próprio |

## 4. O que está guardado em `system_settings`

Uma coleção de chave e valor (33 registros) que faz o papel de várias.

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
| `push_token:{usuário}:{aparelho}` | Aparelhos que recebem push | Coleção própria de aparelhos |
| `push_delivery:{id}` | Confirmação de entrega de push | Descartar depois de migrar |
| `free_plan_*`, `trial_config`, `ai_models_config`, `flight_apis_config`, `feature_settings`, `ai_token_limits` | Configurações de um sistema anterior; o app atual não lê | Conferir e descartar na migração |

Há **segredos dentro de documentos** (senha do Gmail, conta de serviço do Firebase, segredo do n8n, chave de IA em `crm_ai_config`), e a coleção é legível por qualquer usuário logado. Regra 1 da arquitetura: passam para variáveis do servidor ou para coleção sem leitura para usuários (F2 e F13).

## 5. O que os dados mostram

Achados da leitura. **Nenhum foi corrigido nos dados**; a limpeza precisa de aprovação e entra na migração da Fase 2.

| Achado | Detalhe | O que fazer |
|---|---|---|
| Uma agência concentra tudo | A agência da OSV tem todos os clientes, vendas, roteiros e a Biblioteca, com 2 administradores | É a agência a migrar |
| Agências e membros repetidos | 8 agências e 13 membros para 5 usuários. Contas de teste ganharam 2 a 4 agências cada | Causa corrigida no código. Apagar as repetidas na migração |
| Fotos da Biblioteca sem arquivo | 19 imagens cadastradas apontam para arquivos que não estão no bucket (não vieram do sistema anterior). Aparecem sem foto | Enviar as fotos de novo, ou recuperar do sistema anterior se ainda houver cópia |
| Capa apontando para fora | 1 roteiro tem a capa num endereço do Supabase, que não existe mais | Trocar a capa |
| Roteiro com 47 dias | 1 roteiro tem dias repetidos e a data de fim antes do início | Conferir com a consultora |
| Venda apontando para cliente que não existe | 1 venda fechada cita um cliente apagado | Revincular na migração |
| Tarefas, atividades, gastos e transações zerados | 0 registros nas quatro coleções | Normal se ainda não usaram; as gravações foram testadas e funcionam |
| Sem índices | Nenhuma coleção tem índice. Funciona com o volume de hoje | A Fase 2 cria os índices do modelo novo |

## 6. Arquivos, tempo real, login e funções

| Tema | Hoje | Alvo |
|---|---|---|
| Bucket `trip-attachments` | Único bucket, 30 MB por arquivo, só usuários logados. Passou a guardar também os arquivos da Biblioteca | `documentos`, `biblioteca`, `capas`, `contratos` e `guias`, privados por agência |
| Tempo real | 4 inscrições: `crm_leads` (contador do menu e quadro) e `crm_notifications` (sino e página) | Viagens, agenda e notificações (F2-T7) |
| Login | Conta do Appwrite: e-mail e senha, Google, recuperação de senha | Mantém |
| Equipe por agência | Coleção `agency_members` (campo `role`). Não usa Teams | Um Team por agência, papéis = cargos (A5) |
| Criação de agência | Pelo navegador, quando o usuário entra sem agência e sem convite | Pelo servidor, com acesso liberado pela Hotmart (D5) |
| Functions do Appwrite | Nenhuma. A lógica de servidor roda na Vercel (`src/lib/*.functions.ts`) | Decidir na F2 |

## 7. Scripts de manutenção

Ficam em `scripts/appwrite/`. Todos pedem `APPWRITE_ADMIN_KEY` e, sem `--aplicar`, só mostram o que fariam.

| Script | O que faz | Altera o Appwrite? |
|---|---|---|
| `fechar-banco.mjs` | Confere e fecha coleções e bucket para visitantes | Só com `--aplicar` |
| `estrutura-que-falta.mjs` | Cria `crm_lead_documents` e amplia seis limites de texto | Só com `--aplicar` |
| `gerar-schema.mjs` | Lê os campos reais e reescreve `src/integrations/appwrite/schema.ts` | Não (só lê) |
