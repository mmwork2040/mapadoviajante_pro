# Multi-tenant: billing e taxas por agência

## Situação atual (verificada no código)
O sistema **já é multi-tenant** no essencial:
- Dados do CRM isolados por `agency_id` com RLS via `get_user_agency_id()`.
- Webhook, Notificações e Gmail já salvos por agência em `system_settings` (`agency_cfg:{agencyId}:scope`).
- IA por agência em `crm_ai_config`.

O que falta de verdade: **pagamentos por agência**. As tabelas globais `settings` (taxas) e `payment_settings` (Asaas) existem mas **não são usadas** no app.

## Objetivo
Cada agência passa a ter suas próprias credenciais Asaas e suas próprias taxas, isoladas das demais.

## 1. Banco de dados (migration)
- Adicionar `scope` `"payment"` e `"rates"` ao fluxo de config por agência (mesma tabela `system_settings`, sem mudança de schema), **ou** criar tabela dedicada `agency_payment_settings`:
  - `id`, `agency_id` (unique, FK lógica), `asaas_api_key_encrypted`, `asaas_environment` (`sandbox`/`production`), `asaas_webhook_token`, `monthly_price`, `yearly_price`, `trial_days`, `grace_period_days`, `first_layer_rate`, `second_layer_rate`, `is_active`, timestamps.
  - GRANTs para `authenticated` e `service_role`.
  - RLS: SELECT/UPDATE só `agency_id = get_user_agency_id()` + `user_has_role('admin')` para escrita.
- A chave Asaas **não** fica legível no client: leitura/uso só via server function (admin), nunca exposta ao browser.

## 2. Server functions
- Estender `settings.functions.ts` com scopes `payment` e `rates` (ou criar `payments.functions.ts`):
  - `getAgencyPaymentConfig` / `saveAgencyPaymentConfig` (admin-only via `requireSupabaseAuth` + checagem de cargo).
  - Para chamadas reais ao Asaas (criar cobrança/assinatura), uma server function que lê a chave da agência no servidor e chama a API Asaas.
- Webhook do Asaas: rota pública `src/routes/api/public/asaas-webhook.ts`, identifica a agência pelo `asaas_webhook_token`, valida e grava com `supabaseAdmin`.

## 3. UI (página Admin)
- Nova seção "Pagamentos (Asaas)" em `_app.admin.tsx`: ambiente, API key (write-only), preços, trial, período de carência, taxas (`first/second layer`).
- Visível apenas para admin da agência.

## 4. Taxas
- Mover `first_layer_rate`/`second_layer_rate` para a config por agência (scope `rates`) e usar nos cálculos financeiros onde necessário.

## Detalhes técnicos
- Reusar o padrão existente de `getAgencyConfig`/`saveAgencyConfig`.
- Asaas API key tratada como segredo por-agência no banco (criptografada), nunca enviada ao client.
- Webhook em `/api/public/*` com verificação de token por agência.

## Confirmar antes de executar
1. Prefere reusar `system_settings` (mais simples) ou tabela dedicada `agency_payment_settings` (mais limpo)?
2. Já tem credenciais Asaas para testar, ou começamos só com a estrutura?
