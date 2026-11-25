# Plano de implementação — CRM Mapa do Viajante PRO

Documento de execução para o dev. Baseado na auditoria do commit `b2593ae`
(os números de linha citados são desse commit; se o arquivo mudou, procure pelo
nome da função).

**Objetivo final:** um sistema seguro, sem perda de dados, com design no padrão
OSV, onde a IA interna (Thay) e o Claude/agentes via MCP executam as mesmas
ações, e os roteiros são gerados seguindo a Skill de guias.

---

## 0. Antes de começar

### 0.1 Regras do projeto (leia antes de qualquer commit)

1. **Nunca reescreva histórico já publicado.** Sem `git push --force`, sem
   `rebase`/`amend`/`squash` em commits que já subiram. O projeto é sincronizado
   com o Lovable e isso apaga o histórico de lá.
2. **A branch `main` precisa estar sempre funcionando.** Tudo que entra em
   `main` aparece no editor do Lovable. Trabalhe em branch (`feat/...`,
   `fix/...`) e abra PR.
3. **Não edite arquivos gerados:**
   `src/integrations/supabase/types.ts`,
   `src/integrations/supabase/auth-middleware.ts`,
   `src/integrations/supabase/client.ts`, `client.server.ts`,
   `src/routeTree.gen.ts`.
4. **Não mexa nos plugins do `vite.config.ts`** (o comentário no topo do arquivo
   explica o motivo).
5. **Rotas:** só arquivos em `src/routes/` no padrão do TanStack Start
   (veja `src/routes/README.md`).
6. **Mudança de banco = arquivo de migração** em `supabase/migrations/`.
   Nunca altere o banco de produção à mão. Confirme com o responsável como a
   migração é aplicada (Lovable Cloud) **antes** de fazer merge de código que
   depende dela.
7. **Segredos nunca vão para o git nem para o navegador.** Chaves de API ficam
   em variável de ambiente do servidor.
8. **O Supabase deste projeto é compartilhado com outros apps** (há tabelas
   `financial_*`, `dream_boxes`, `forms`, `trips`). Só toque em tabelas `crm_*`,
   `agencies`, `agency_members`, `agency_payment_settings` e nas chaves
   `agency_cfg:*`, `push_*` de `system_settings`.

### 0.2 Como rodar e verificar

```bash
npm install
```

```bash
npm run dev
```

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

- O lint hoje acusa ~5.000 erros, quase todos de formatação (prettier). Não
  rode `npm run format` no meio de uma tarefa: isso gera um diff gigante. Há
  uma tarefa só para isso (F6-T1).
- Não existem testes automatizados hoje. A tarefa F1-T0 cria a base.

### 0.3 Definição de pronto (vale para toda tarefa)

- [ ] `npx tsc --noEmit` sem erros novos.
- [ ] Sem erros novos de lint nos arquivos tocados.
- [ ] Critérios de aceite da tarefa testados à mão (descreva no PR o que testou).
- [ ] Testes automatizados quando a tarefa pedir.
- [ ] PR pequeno: uma tarefa por PR.
- [ ] Nada de segredo, `console.log` de dados de cliente ou código comentado.

### 0.4 Decisões

| # | Decisão | Situação | Afeta |
|---|---|---|---|
| D1 | Skill de guias | **Decidido.** Skills `guia-osv-completo` (Modo 2) e `guia-osv-diagramacao` (Modo 1) em `docs/skills/`. **Faltam os arquivos de referência** que elas citam (ver Fase 4, "Pendente") | Fase 4 |
| D2 | IA da Thay | **Decidido.** API da OpenAI ou qualquer outro provedor configurado no Vercel (Vercel AI Gateway), com a chave **só em variável de ambiente do servidor** e o **controle de tokens feito na plataforma** (cota por agência, definida pelo super admin) | F0-T6, F3-T4 |
| D3 | Material do padrão OSV (tokens, tipografia, componentes, logo) | Pendente | Fase 5, etapas B e C |
| D4 | Asaas e plataforma de assinatura | **Decidido: não agora.** Esconder telas e desligar o webhook do Asaas; não configurar cobrança. Push e vouchers continuam pendentes | F0-T12, F6-T4 |
| D5 | Cadastro aberto ou fechado | **Decidido.** Acesso é comprado na **Hotmart**. O cadastro continua existindo, mas a conta só ganha agência depois que o **super admin libera**: automaticamente pelo webhook da Hotmart ou manualmente no painel | F0-T7, F0-T11 |
| D6 | Onde o servidor do app roda (Lovable/Cloudflare ou Vercel) | Pendente. Define onde ficam as variáveis de ambiente (`AI_GATEWAY_API_KEY`, `OPENAI_API_KEY`, `HOTMART_HOTTOK`, `APP_URL`). O AI Gateway funciona nos dois casos | F0-T6, F0-T11 |

### 0.5 Ordem e dependências

```
Fase 0 Segurança ──► Fase 1 Integridade ──► Fase 2 Camada de servidor ──► Fase 3 MCP + Thay agente ──► Fase 4 Skill de guias
                                                   │
Fase 5 Design OSV: etapa A pode começar em paralelo com a Fase 1;
                   etapas B/C dependem de D3 e ficam mais baratas depois da Fase 2.
Fase 6 Limpeza: por último.
```

Estimativa grosseira para um dev júnior com revisão: Fase 0 = 2 semanas (inclui Hotmart e cota de IA),
Fase 1 = 2 semanas, Fase 2 = 2 a 3 semanas, Fase 3 = 2 a 3 semanas,
Fase 4 = 2 semanas, Fase 5 = 3 a 4 semanas, Fase 6 = 1 semana.

---

## Fase 0 — Segurança (urgente)

Contexto que explica quase tudo: **o cadastro é aberto** e cada novo usuário
ganha uma agência própria como admin (`src/lib/auth.tsx:84-90`). Então
"usuário autenticado" significa "qualquer pessoa da internet". Toda função de
servidor precisa checar **agência e papel**, não só o login.

Com a decisão D5, o cadastro deixa de dar acesso: a conta só vira agência quando
o super admin libera (Hotmart ou manual). Mesmo assim, toda função de servidor
continua checando agência e papel, porque um cliente da Hotmart também não pode
ver dados de outra agência.

Outro ponto: o **super admin hoje só existe no navegador**
(`SUPER_ADMIN_EMAILS` em `src/lib/auth.tsx:35-38`, usado em `isAdminUser`).
Isso esconde ou mostra telas, mas não protege nada no servidor, e os e-mails
ficam expostos no código do site.

### F0-T1 — Helper de autorização no servidor

**Criar** `src/lib/server/authz.ts` com:

- `getMembership(context)`: busca em `agency_members` a linha do
  `context.userId` com `is_active = true`. Se houver mais de uma, usa a mais
  antiga (`order("created_at")`), nunca `.limit(1)` sem ordem. Lança
  `Error("Sem agência ativa")` se não houver.
- `requireAdmin(context)`: chama `getMembership` e lança
  `Error("Sem permissão")` se `role !== "admin"`.
- `requireSuperAdmin(context)`: lança `Error("Sem permissão")` se o
  `context.userId` não estiver na tabela `platform_admins`.

Retorno: `{ agencyId, memberId, role }`.

Migração: `platform_admins (user_id uuid primary key references auth.users,
created_at)`, com RLS que **não permite leitura nem escrita pelo navegador**
(só o servidor, com o cliente admin). Inserir os dois super admins atuais pelo
e-mail na própria migração.

No navegador, trocar `SUPER_ADMIN_EMAILS` por uma server function
`getMyPlatformRole()` → `{ isSuperAdmin: boolean }`, e apagar a lista de e-mails
do código. `isAdminUser` passa a receber esse booleano.

**Aceite:** teste unitário cobrindo: sem membership, membership inativo,
consultor, admin, super admin. A busca por `celiogomesalves` no bundle do site
não encontra nada.

### F0-T2 — Fechar o Google Drive

**Arquivo:** `src/lib/gdrive.functions.ts` (funções nas linhas 59, 77, 135, 156, 235).

Passos:
1. Em todas as funções, chamar `getMembership`.
2. Ler a config da agência **no servidor** (chave `agency_cfg:<agencyId>` em
   `system_settings`, mesma leitura de `src/lib/settings.functions.ts`). Se
   `gdrive.enabled` for falso ou não houver `folderId`, lançar erro.
3. **Ignorar** o `folderId` enviado pelo navegador para a pasta raiz; usar o da
   config. Para subpastas e arquivos, antes de listar/baixar, consultar os
   `parents` do item na API do Drive e confirmar que ele descende da pasta da
   agência.
4. Escapar `\` e `'` em todo valor interpolado na query do Drive (linhas 168 e 170).
5. Não devolver o corpo de erro bruto do Google (linhas 53, 179, 261); devolver
   mensagem genérica e registrar o detalhe com `console.error`.

**Aceite:**
- Usuário de outra agência (crie um cadastro novo) recebe erro ao chamar
  qualquer função do Drive.
- Com a pasta configurada, não é possível baixar um arquivo de fora dela
  trocando o `fileId` na requisição (teste pelas DevTools).

### F0-T3 — Fechar o envio de e-mail (Gmail)

**Arquivo:** `src/lib/gmail.functions.ts:48-85` (`sendGmail`).

Passos:
1. `requireAdmin`.
2. Ler `gmail.enabled` da config no servidor; recusar se desligado.
3. Validar entrada com zod: `to` e-mail válido, `subject` até 200 caracteres,
   `body` até 20 KB.
4. Aplicar `senderName` e `replyTo` da config (hoje são salvos e ignorados).
5. Limite simples: no máximo 30 envios por agência por hora. Guarde o contador
   em uma tabela nova `crm_rate_limits (agency_id, key, window_start, count)`.

**Aceite:** consultor recebe "Sem permissão"; admin de outra agência sem Gmail
habilitado recebe erro; o 31º envio na hora é recusado.

### F0-T4 — Corrigir convites de equipe

**Arquivo:** `src/lib/invites.functions.ts:68-199`.

Passos:
1. `requireAdmin` no início.
2. `role` vira enum zod com os papéis que existem no sistema (veja
   `src/lib/types.ts`); qualquer outro valor é erro.
3. Remover `appUrl` da entrada. A URL base vem de variável de ambiente
   `APP_URL` do servidor. Trocar também os valores fixos em
   `src/routes/_app.admin.tsx:118,718` e `src/routes/aceitar-convite.tsx:8`.
4. Criar `escapeHtml()` e aplicar em `name`, nome de quem convida e nome da
   agência antes de montar o HTML (linhas 39-45).
5. Trocar `.ilike("email", email).maybeSingle()` (linha 105) por
   `.eq("email", email.toLowerCase())`. Gravar e-mails sempre em minúsculas.
6. Em `src/lib/agency.ts:126`, limitar o nome da agência a 80 caracteres.

**Aceite:** nome de agência `<img src=x onerror=alert(1)>` chega no e-mail como
texto; consultor não consegue convidar; convite para `joao_silva@x.com` não
altera `joaoXsilva@x.com`.

### F0-T5 — Configurações e segredos

**Arquivos:** `src/lib/settings.functions.ts:37-52` e `:71-100`,
`src/lib/webhook.ts`, `src/routes/_app.admin.tsx`.

Passos:
1. `saveAgencyConfig`: `requireAdmin`.
2. `getAgencyConfig`: nunca devolver segredos. Para cada segredo (webhook
   `secret`, n8n `secret`), devolver `hasSecret: boolean`. Ao salvar, campo de
   segredo vazio significa "manter o atual".
3. Mover o disparo de webhook para o servidor: criar
   `dispatchWebhookFn` (server function) que lê URL e segredo no servidor e faz
   o `fetch`. O `dispatchWebhook` do navegador (`webhook.ts:49-73`) passa a só
   chamar essa função.
4. Corrigir o botão salvar do webhook, que fica desabilitado quando
   `enabled` é falso (`_app.admin.tsx:877,990`): tem de ser possível desligar.

**Aceite:** resposta de `getAgencyConfig` no Network do navegador não contém
nenhum segredo; consultor não salva config; webhook pode ser desligado e
continua desligado após recarregar.

### F0-T6 — Chave da IA só no servidor + controle de tokens (decisão D2)

**Arquivos:** `src/lib/services.ts:2321-2340` (`fetchAiConfig`/`saveAiConfig`),
`src/lib/ai.functions.ts`, `src/lib/ai.server.ts`,
`src/lib/checklist-templates.functions.ts:407-434`,
`src/lib/destination-image.functions.ts:137-157`, `src/routes/_app.admin.tsx:1984-2060`.

**Mudança de modelo:** hoje cada agência cola a própria chave de IA na tela, e
essa chave vai para o navegador. Passa a existir **uma chave da plataforma**,
em variável de ambiente do servidor. As agências não veem nem digitam chave.

Variáveis de ambiente (servidor):
- `AI_GATEWAY_API_KEY`: Vercel AI Gateway, que dá acesso à OpenAI e a outros
  provedores com a mesma chave. Modelo no formato `openai/<modelo>`.
- `OPENAI_API_KEY`: alternativa, chamada direta à OpenAI, se não usar o Gateway.
- `AI_DEFAULT_MODEL`: modelo padrão da plataforma.

Passos:
1. Criar `src/lib/server/ai/provider.ts` que monta o modelo a partir das
   variáveis acima (Gateway tem prioridade; sem nenhuma, erro claro "IA não
   configurada"). Usar o Vercel AI SDK (`ai`), que já fala com o Gateway e com a
   OpenAI. Esse arquivo é a única porta de entrada para chamar IA.
2. Trocar os três `fetch` manuais de `ai.server.ts` por esse provedor. Os
   pontos que leem `crm_ai_config` (~12) passam a usar só os campos que
   continuam por agência: orientações da agência e, se o super admin permitir,
   escolha de modelo dentro de uma lista liberada.
3. Migração: remover a coluna de chave de `crm_ai_config` (antes, confirmar que
   nenhum outro app do Supabase compartilhado lê essa tabela). RLS: leitura e
   escrita só por admin da agência.
4. Criar server function `getAiStatus()` → `{ enabled, model, quota: { used, limit, resetsAt } }`
   e trocar as chamadas de `fetchAiConfig` no cliente (`_app.leads.tsx:816`,
   `_app.biblioteca.tsx:797`, `_app.roteiros.$id.tsx:478,607`,
   `_app.checklist-templates.tsx:119`).
5. **Controle de tokens:**
   - Migração: `ai_usage_logs` ganha `agency_id` (hoje só tem `user_id`) e
     `cost_usd numeric`. Índice `(agency_id, created_at)`.
   - Tabela `agency_ai_quotas (agency_id, monthly_token_limit, hard_block boolean,
     updated_by, updated_at)`. Sem linha = cota padrão da plataforma
     (`AI_DEFAULT_MONTHLY_TOKENS`).
   - Toda chamada de IA passa por `withAiQuota(ctx, feature, fn)`: antes, soma o
     uso do mês da agência e recusa com "Limite mensal de IA atingido" se passou
     do limite; depois, grava em `ai_usage_logs` os tokens que o SDK devolve
     (`usage.inputTokens`/`outputTokens`). Nenhuma chamada de IA fora desse wrapper.
   - Tela do super admin: uso por agência no mês, editar cota.
   - Tela do admin da agência: barra "X de Y tokens usados este mês".
6. Na tela de admin da agência, remover os campos de provedor, chave e
   "conectar". Ficam: orientações da Thay e tamanho máximo da resposta.
   Isso também resolve o bug de `_app.admin.tsx:2020-2026` (editar orientações
   desconectava a IA).

**Aceite:**
- Procurar `sk-` e a chave do Gateway no Network e no HTML de todas as telas:
  não aparece.
- Agência com cota de 1.000 tokens recebe "Limite mensal de IA atingido" na
  chamada seguinte; o uso aparece no painel do super admin.
- Trocar `AI_DEFAULT_MODEL` no servidor muda o modelo sem mexer no código.

### F0-T7 — Provisionamento de agência só com acesso liberado (decisão D5)

**Arquivos:** `src/lib/auth.tsx:61-107`, `src/lib/services.ts:125-142`.

**Regra nova:** criar conta não dá acesso. A agência só é criada para quem tem
uma **liberação ativa** em `platform_access_grants` (F0-T11). Quem entra por
convite de uma agência já liberada não precisa de liberação própria.

Passos:
1. `loadAgencyContext` deve diferenciar "erro de rede" de "sem agência"
   (lançar no erro, devolver `null` só quando a consulta deu certo e veio vazia).
2. Garantir uma única execução de `hydrateMember` por vez (guardar a Promise em
   um `ref` e reutilizar).
3. O provisionamento sai do navegador: `autoProvisionAgency` vira server function
   `provisionMyAgency()` que, no servidor, confere a liberação ativa pelo e-mail
   **confirmado** do usuário (`email_confirmed_at` preenchido) e só então chama
   `provision_agency`. Sem liberação → `{ status: "pending" }`.
4. Não provisionar agência nova se o usuário tem **qualquer** linha em
   `agency_members`, inclusive inativa. Membro bloqueado vê tela "Acesso bloqueado".
5. Tela nova **"Aguardando liberação"** para conta sem agência e sem liberação:
   explica que o acesso é liberado após a compra, mostra o e-mail da conta
   ("use o mesmo e-mail da compra na Hotmart"), botão "Já comprei, verificar de
   novo" e contato de suporte.
6. Pedir ao responsável pelo banco para confirmar que a função SQL
   `provision_agency` é idempotente por usuário; se não for, migração corrigindo.
   A política de RLS de `agencies`/`agency_members` não pode permitir que o
   navegador crie agência diretamente (senão o passo 3 é contornado).
7. Agência com liberação suspensa (reembolso, chargeback, cancelamento, ou
   manual): admin e consultores veem "Acesso suspenso" e o servidor recusa
   operações (`getMembership` confere a liberação da agência). Os dados **não
   são apagados**.

**Aceite:**
- Conta nova sem compra fica em "Aguardando liberação" e não cria agência,
  nem chamando `provision_agency` direto pelo console do navegador.
- Bloquear um membro e logar com ele não cria agência nova; derrubar a rede
  durante o login não cria agência nova.
- Suspender a liberação de uma agência bloqueia todos os membros dela na hora;
  reativar devolve o acesso com os dados intactos.

### F0-T8 — Webhook de entrada do n8n

**Arquivo:** `src/routes/api/public/n8n-lead.ts`.

Passos:
1. Segredo só por header (remover `?secret=`, linhas 84 e 148).
2. Remover os "chutes" de agência (linhas 241-252 e 270-282). Sem agência
   identificada = resposta 400.
3. Segredo por agência com no mínimo 24 caracteres, guardado como hash SHA-256;
   comparação em tempo constante. Não carregar os segredos de todas as agências
   a cada requisição: indexar pelo hash.
4. Remover `GET ?diag=1` e o `Access-Control-Allow-Origin: *`.
5. Remover o modo `public_insert_fallback` (linhas 107, 364): sem service role
   configurada, responder 500.
6. Validar o corpo com zod.
7. Corrigir `num()` (linhas 20-25): "2 adultos e 1 criança" hoje vira 21. Pegar
   só o primeiro número.
8. Normalizar datas para `AAAA-MM-DD` antes de gravar; se não der, gravar nulo e
   manter o texto original em `profile.travel_dates`.
9. Deduplicação por `.eq` em e-mail minúsculo com `.limit(1)`, ignorando leads
   arquivados.
10. Lead e roteiro devem ser criados juntos (uma função SQL/RPC) para um erro no
    roteiro não deixar lead duplicado a cada nova tentativa do n8n.

**Aceite:** testes automatizados do parser (números, datas BR, texto livre) e
teste manual com `curl` para: sem segredo, segredo errado, lead duplicado.

### F0-T9 — Push, formulário público e itens menores

- `src/lib/push.functions.ts`: `sendTestPush` e `listDeviceTokens` com
  `requireAdmin` e sempre filtrados por agência (hoje, sem agência, a linha 207
  devolve tokens de todas).
- `src/lib/form-embed.functions.ts:14-51`: usar o cliente admin de verdade,
  selecionar só a chave do formulário e exigir `?a=<slug>` válido (sem cair na
  agência mais antiga).
- `src/routes/api/public/push-delivery.ts:38`: comparação em tempo constante.
- `.env` está versionado apesar do `.gitignore`. Só tem valores públicos, mas
  remova do índice (`git rm --cached .env`) e crie `.env.example`. Combine
  antes com o responsável, porque o Lovable pode recriar o arquivo.
- `xlsx@0.18.5` tem alertas de segurança conhecidos; avaliar troca de versão.

### F0-T10 — Auditoria de RLS (com o responsável pelo banco)

Não dá para ver as políticas pelo repositório. Testar com a chave pública e com
o token de um usuário de **outra** agência:

| Tabela | O que não pode acontecer |
|---|---|
| `system_settings` | ler qualquer linha `agency_cfg:<outra>`, `push_token:*`, `push_delivery:*` |
| `agency_payment_settings` | consultor ler `asaas_api_key` |
| `agency_members` | consultor mudar `role`; ler `invite_token` |
| `crm_leads` | inserir sem login |
| `crm_*` em geral | ler/escrever linhas de outra agência |

Incluir também as tabelas novas desta fase: `platform_admins`,
`platform_access_grants`, `hotmart_events`, `agency_ai_quotas`: nenhuma pode
ser lida ou alterada pelo navegador de um usuário comum.

Para cada falha, uma migração de política. Registrar o resultado em
`docs/AUDITORIA_RLS.md`.

### F0-T11 — Liberação de acesso: webhook da Hotmart + painel do super admin (decisão D5)

Não é um sistema de assinatura: a plataforma só guarda **quem tem acesso
liberado**. A Hotmart avisa; o super admin pode sempre liberar, suspender ou
corrigir à mão.

**Migrações:**
- `platform_access_grants (id, email citext unique, status ['active','suspended'],
  source ['hotmart','manual'], override ['none','force_active','force_suspended'] default 'none',
  hotmart_product_id, hotmart_transaction, hotmart_subscriber_code,
  agency_id nullable, note, granted_by, created_at, updated_at)`.
  E-mail sempre em minúsculas. `agency_id` é preenchido quando a agência é
  provisionada (F0-T7).
- `hotmart_events (id text primary key, event, email, transaction, payload jsonb,
  received_at, result ['applied','ignored','error'], result_detail)`.
  `id` é o identificador do evento que vem no corpo; repetir o mesmo evento não
  aplica duas vezes.
- Ação do super admin entra em `crm_audit_log` (ou, até a Fase 2, em uma
  `platform_audit_log` simples).

**Rota `src/routes/api/public/hotmart-webhook.ts`** (só `POST`):
1. Autenticar pelo header `X-HOTMART-HOTTOK` comparado em tempo constante com
   `HOTMART_HOTTOK` (variável de ambiente). Errado ou ausente → 401. Nunca
   aceitar o token pela URL.
2. Validar o corpo com zod (`.passthrough()`), lendo: `id`, `event`,
   `data.buyer.email`, `data.product.id`, `data.purchase.transaction`,
   `data.subscription.subscriber.code`. **Conferir os nomes dos campos e dos
   eventos na documentação atual da Hotmart (webhook versão 2.0) antes de
   codificar**, e salvar um exemplo real de cada evento em
   `docs/hotmart-exemplos/` (sem dados pessoais) para os testes.
3. Ignorar produto que não esteja em `HOTMART_PRODUCT_IDS` (lista separada por
   vírgula) → grava em `hotmart_events` com `result = 'ignored'` e responde 200.
4. Aplicar o evento na liberação do e-mail do comprador:

   | Evento Hotmart | Efeito |
   |---|---|
   | `PURCHASE_APPROVED`, `PURCHASE_COMPLETE` | cria ou reativa a liberação (`status = active`, `source = hotmart`) |
   | `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK` | `status = suspended` |
   | `PURCHASE_CANCELED`, `SUBSCRIPTION_CANCELLATION` | `status = suspended` |
   | `PURCHASE_PROTEST`, `PURCHASE_DELAYED`, outros | só registra; aparece no painel para o super admin decidir |

   Se `override` não for `none`, o webhook registra o evento mas **não muda o
   status**: a decisão manual do super admin vale até ele removê-la.
5. Responder 200 rápido em todo evento aceito (mesmo ignorado), para a Hotmart
   não reenviar; 500 só em erro real de banco, para ela tentar de novo.
6. Não devolver dados no corpo da resposta e não usar `Access-Control-Allow-Origin: *`.

**Painel do super admin** — rota `src/routes/_app.plataforma.tsx`, visível só
para super admin, com **todas** as ações em server functions com
`requireSuperAdmin`:
- Lista de liberações: e-mail, status, origem, produto, transação, agência
  vinculada, datas; busca por e-mail.
- **Liberar manualmente:** e-mail + observação → cria liberação
  `source = manual`.
- **Suspender / Reativar:** grava `override` (`force_suspended`/`force_active`).
  Botão **"Voltar a seguir a Hotmart"** zera o `override`.
- **Trocar e-mail:** para quem comprou com um e-mail e criou a conta com outro.
- Eventos recentes da Hotmart com o resultado, filtro por "precisa de decisão".
- Uso de IA por agência e cota (de F0-T6).
- Mostrar a URL do webhook e o passo a passo para cadastrar na Hotmart
  (Ferramentas → Webhook → URL + eventos acima). O `hottok` não aparece na tela.

**Opcional (depois):** e-mail automático na compra aprovada: "Seu acesso foi
liberado. Crie sua conta em <APP_URL> com este e-mail."

**Aceite:**
- `curl` sem `X-HOTMART-HOTTOK` ou com valor errado → 401 e nada muda.
- Evento `PURCHASE_APPROVED` de exemplo → liberação ativa; a pessoa cria conta
  com o mesmo e-mail e entra direto, já com agência.
- Mesmo evento enviado duas vezes → uma linha em `hotmart_events` aplicada,
  a segunda ignorada.
- `PURCHASE_REFUNDED` → agência suspensa; com `force_active` antes, continua ativa.
- Produto fora de `HOTMART_PRODUCT_IDS` → ignorado.
- Consultor ou admin de agência chamando qualquer função do painel → "Sem permissão".
- Testes automatizados do mapeamento evento → status, incluindo `override`.

### F0-T12 — Desligar o Asaas por enquanto (decisão D4)

- `src/routes/api/public/asaas-webhook.ts`: responder 404 em todo método
  (hoje aceita token pela URL e só registra log). Manter o arquivo para
  reativar depois, com um comentário curto explicando.
- `src/routes/_app.admin.tsx`: esconder o card "Pagamentos (Asaas)" (linha ~448)
  e o formulário dele (linhas ~1820-1940). Não apagar dados de
  `agency_payment_settings`. (Atenção: o campo "Assinatura" da linha ~1500 é a
  assinatura do e-mail do Gmail, não tem relação com cobrança; fica.)
- O item da F0-T10 sobre `asaas_api_key` continua: mesmo desligada, a chave
  salva não pode ser lida por consultor.

**Aceite:** nenhuma tela mostra Asaas ou assinatura; `POST` na rota do Asaas
responde 404.

---

## Fase 1 — Integridade de dados e bugs visíveis

### F1-T0 — Base de testes

Instalar `vitest`. Criar `npm run test`. Primeiros testes: os helpers das
tarefas F1-T1 e F1-T4.

### F1-T1 — Metadados da atividade em coluna própria (o bug mais grave)

**Problema:** moeda, conversão, hotéis, sugestões, custos por passageiro e
imagens ficam como JSON dentro da coluna de texto `duration`
(`src/lib/services.ts:1975-2045`). Uma atualização parcial apaga tudo.

Passos:
1. Migração: `crm_itinerary_activities` ganha `meta jsonb not null default '{}'`
   e `done boolean not null default false`.
2. Migração de dados (SQL): para cada linha cujo `duration` é JSON válido,
   copiar para `meta` e deixar em `duration` só o valor de `dur`. Para linhas com
   `type = 'done'`, marcar `done = true` e `type = 'activity'`.
3. Reescrever `mapActivityPayload` e o decodificador para ler/gravar `meta`.
   Manter leitura do formato antigo por uma versão, como proteção.
4. `updateItineraryActivity` passa a **mesclar**: lê o `meta` atual, aplica só
   as chaves enviadas e grava.
5. Checkbox "concluído" (`_app.roteiros.$id.tsx:2818-2821`) passa a gravar `done`.
6. `RoteiroPdfExport.tsx:183` deixa de filtrar por `type === "done"`.

**Aceite:**
- Atividade com hotel, moeda USD e imagem: editar só o título mantém tudo.
- Marcar e desmarcar "concluído" mantém o tipo (voo continua voo).
- Teste automatizado do merge de `meta`.

### F1-T2 — Duplicar roteiro, dia e atividade sem perder dados

**Arquivos:** `src/lib/services.ts:1828-1903`, `_app.roteiros.$id.tsx:1250-1265`.

Copiar todos os campos (inclusive `meta`, `maps_url`, `date` do dia). Depois de
duplicar ou excluir um dia, renumerar `day_number`/`sort_order` de 1 a N.

**Aceite:** roteiro em USD duplicado continua em USD, com hotéis e imagens;
excluir o dia 2 de 3 deixa "Dia 1, Dia 2".

### F1-T3 — Editar lead sem apagar o perfil

**Arquivo:** `src/routes/_app.leads.tsx:1115-1141`.

Trocar a montagem do `profile` por `{ ...lead.profile, ...camposDoFormulario }`.
Em `LeadDetailDrawer.tsx:289-322`, `buildItineraryPayload` só envia datas e
passageiros quando conseguiu interpretá-los; nunca envia `null` por falha de
leitura.

**Aceite:** lead com taxa de consultoria e status "Contatado": editar o telefone
mantém os dois. "Salvar Roteiro" não apaga datas já definidas.

### F1-T4 — Datas e fuso horário

**Problema:** `new Date("2026-12-10")` é meia-noite UTC; no Brasil vira dia 9.

Passos:
1. Criar `src/lib/dates.ts` com `parseLocalDate(str)`, `formatDateBR(str)`,
   `todayISO()` (data local) e `monthKey(str)` (`str.slice(0, 7)`).
2. `src/lib/ui.ts:139-144` (`formatDate`) e `_app.clientes.$id.tsx:123-128`
   passam a usar o helper.
3. Agrupamento por mês: `services.ts:2371-2372` e `_app.financeiro.tsx:94-95`
   usam `monthKey`.
4. Trocar todo `new Date().toISOString().slice(0, 10)` por `todayISO()`
   (`services.ts:2556`, `LeadDetailDrawer.tsx:2618`, `_app.financeiro.tsx:306`,
   `ai.server.ts:364,427`).
5. `CreateTaskModal.tsx:108,165`: editar tarefa não pode mudar dia nem hora.

**Aceite:** com o computador em `America/Sao_Paulo`, viagem de 10/12 aparece
como 10/12 em todas as telas; transação de 01/12 conta em dezembro. Testes
automatizados rodando com `TZ=America/Sao_Paulo`.

### F1-T5 — Fim dos "falsos sucessos"

**Regra nova:** função de serviço que falha **lança erro**; não devolve
`null`/`false`. Os `useMutation` mostram sucesso no `onSuccess` e erro no `onError`.

Pontos conhecidos: `LeadDetailDrawer.tsx:185-215, 2348-2351`;
`_app.roteiros.index.tsx:169-177`; `_app.roteiros.$id.tsx:1013-1027, 2010-2021, 4177`;
`_app.clientes.index.tsx:257-262`; `_app.clientes.$id.tsx:296-302, 598-601`;
`_app.tarefas.tsx:56-63`; `_app.biblioteca.tsx:121-132, 186, 311`.

Também: `fetchItineraryById` (`services.ts:1741, 1757`) deve propagar erro em vez
de mostrar roteiro vazio.

**Aceite:** com a rede desligada (DevTools → Offline), nenhuma ação mostra toast
de sucesso.

### F1-T6 — "Completar com IA" e chat

**Arquivo:** `src/routes/_app.roteiros.$id.tsx`.

- Linhas 4793-4803 e 5090-5098: a condição de sucesso ignora `createdActs`.
  Incluir e sempre chamar `onDone()` para atualizar a tela.
- Linhas 1887, 1978-1983: o título do dia fica desatualizado e sobrescreve o
  novo. Sincronizar o estado local quando o dado do servidor mudar.
- `src/lib/ai.functions.ts` ~905 e ~375: as consultas usam colunas que não
  existem (`notes`, `title`, `description`, `time`). As corretas são `label` e
  `time_start`. Hoje o bloco "outros roteiros do lead" vem sempre vazio.

(O chat sem histórico e o JSON truncado são resolvidos na Fase 3.)

### F1-T7 — Busca e paginação

- Criar `escapeOrValue()` e usar em todo `.or()` montado com texto do usuário
  (`services.ts:343-346, 2162, 2247, 2418`). Buscar "Paris, França" não pode dar erro.
- Debounce de 300 ms nas buscas (`_app.leads.tsx:107-113`).
- Paginação com `.range()` em `fetchLeads`, `fetchTasks`, `fetchTransactions`,
  `fetchClients`, `fetchLibraryItems`, `fetchItineraries`.
- Totais do painel e do financeiro calculados no banco (função SQL), não somando
  listas no navegador.
- `AppLayout.tsx:60-62`: os contadores do menu usam `count`, não baixam tudo.
- `_app.clientes.index.tsx:416`: uma consulta para todos os cards, não uma por card.

### F1-T8 — Exclusões seguras

- `deleteItinerary` (`services.ts:1814-1826`) vira uma função SQL única
  (tudo ou nada), incluindo documentos e tarefas ligados.
- "Limpar roteiro" (`_app.roteiros.$id.tsx:1013-1020`) deixa de apagar os
  documentos do cliente; apaga só dias e atividades, como o texto de confirmação diz.
- Biblioteca (`services.ts:1229-1284`): apagar primeiro a linha, depois o arquivo.
- "Trocar template" de checklist (`LeadDetailDrawer.tsx:1765`): avisar que os
  itens extras serão perdidos.

### F1-T9 — Fluxos quebrados

| Onde | Problema | Correção |
|---|---|---|
| `_app.roteiros.index.tsx:595-605, 468-474` | "Nova Proposta" na aba Viagens cria lead e nenhum card aparece | Criar o roteiro junto e vincular |
| `_app.leads.tsx:1103-1113` | Cliente existente é barrado por "e-mail já cadastrado" | Pular a checagem quando o lead foi escolhido no autocomplete |
| `_app.leads.tsx:1497-1531` | Período digitado se perde sem "Apurar" | Salvar o texto mesmo sem IA |
| `_app.roteiros.$id.tsx:3823` | Busca de hotel exige tipo de quarto | Tornar opcional, como a tela diz |
| `CreateTaskModal.tsx:110, 152-158` | Editar tarefa quebra o vínculo `[atv:id]` | Preservar a marca, como já é feito com `[chk:]` |
| `_app.index.tsx:155` | Tarefa criada no painel fica sem responsável | Atribuir ao usuário logado |
| `AppLayout.tsx:45-51, 255-282` | Biblioteca sem link no celular | Adicionar |
| `AppLayout.tsx:151-158` | Item "Thay IA" não faz nada | Esconder até a Fase 3 |
| `_app.admin.tsx:1046, 1141` | Push não pode ser desligado | Respeitar o toggle |
| `_app.admin.tsx:~283` | Admin pode rebaixar a si mesmo | Bloquear se for o último admin |
| `_app.financeiro.tsx:76-81` | Totais incluem pendentes; painel não | Mesmo critério nas duas telas |
| `_app.financeiro.tsx` | Sem editar/excluir transação | Criar |

### F1-T10 — Invalidação de cache

Criar `src/lib/query-keys.ts` com todas as chaves do React Query e trocar as
strings soltas. Corrigir as lacunas conhecidas: `["client-tasks", id]` após criar
tarefa; `["tasks"]`/`["dashboard"]` no toggle da página do cliente;
`["team"]` e `["team-members"]` (unificar); `["itineraries"]` em
`_app.roteiros.$id.tsx:1029-1040`.

---

## Fase 2 — Camada de operações no servidor

**Por quê:** hoje a lógica de dados roda no navegador (`src/lib/services.ts`,
2.595 linhas). Para a Thay e o MCP executarem as mesmas ações que a tela,
cada ação precisa existir **uma vez**, no servidor.

### Estrutura

```
src/server/
  authz.ts                 (F0-T1)
  audit.ts                 registro de quem fez o quê
  ops/
    leads.ts               searchLeads, getLead, createLead, updateLead, setLeadStatus, addLeadNote
    clients.ts             searchClients, getClient
    itineraries.ts         listItineraries, getItinerary, createItinerary, applyItineraryPlan,
                           addDay, updateDay, removeDay,
                           addActivity, updateActivity, moveActivity, removeActivity
    tasks.ts               listTasks, createTask, completeTask
    checklist.ts           getChecklist, setChecklistItem
    library.ts             searchLibrary, getLibraryItem
    documents.ts           listLeadDocuments, getDocumentText
  ops/index.ts             registro central (nome, descrição, schema zod, escopo, função)
```

### Regras de cada operação

1. Assinatura única: `(ctx, input) => resultado`, onde
   `ctx = { supabase, userId, agencyId, role, actor }` e
   `actor` é `"user" | "thay" | "mcp"`.
2. Entrada validada com **zod**. O mesmo schema vira o formulário de entrada da
   ferramenta da Thay e do MCP.
3. Usa o `supabase` do usuário (RLS vale). Cliente admin só onde for inevitável,
   e com filtro explícito de `agency_id`.
4. Operação de escrita chama `audit.log()` no final.
5. Lança erro com mensagem em português pronta para mostrar.
6. Nada de exclusão definitiva: `remove*` arquiva (ver migração abaixo).

### Migrações

- `crm_audit_log (id, agency_id, actor_type, actor_id, action, entity_type, entity_id, summary, payload jsonb, created_at)`.
- `archived_at` em `crm_itineraries`, `crm_itinerary_days`, `crm_itinerary_activities`
  (a de `crm_leads` já existe).
- `crm_itinerary_proposals (id, agency_id, itinerary_id, actor_type, status
  ['pending','applied','discarded'], plan jsonb, created_at)` para o modo proposta.
- Função SQL `apply_itinerary_plan(itinerary_id, plan jsonb)` que cria/atualiza
  dias e atividades em **uma transação**.

### Ordem de migração (um PR por domínio)

1. `itineraries` (é o que a IA mais usa).
2. `leads` e `clients`.
3. `tasks` e `checklist`.
4. `library` e `documents`.

Para cada domínio: criar as operações → criar as server functions
(`createServerFn` + `requireSupabaseAuth`) que as chamam → trocar as chamadas das
telas → apagar a função antiga de `services.ts`.

### Tela ao vivo

Assinar o Supabase Realtime nas telas de roteiro e de vendas e invalidar as
chaves do React Query quando chegar mudança. Assim o que um agente altera aparece
sem recarregar.

**Aceite da fase:** `services.ts` não tem mais escrita em tabelas `crm_*`;
toda escrita aparece em `crm_audit_log`; duas abas abertas no mesmo roteiro se
atualizam sozinhas.

---

## Fase 3 — Servidor MCP e Thay como agente

A Thay e o MCP são duas portas para o **mesmo registro** `ops/index.ts`.

### F3-T1 — Tokens de acesso

- Tabela `crm_api_tokens (id, agency_id, member_id, name, token_hash, scopes text[],
  last_used_at, revoked_at, created_at)`.
- Escopos: `read`, `write`.
- Tela no admin (e no perfil do usuário): criar, ver uma única vez, revogar.
- O token age **como o membro que o criou**, com o papel dele.

### F3-T2 — Rota `/api/mcp`

- Arquivo `src/routes/api/mcp.ts`, transporte HTTP (Streamable HTTP, sem estado),
  usando o SDK oficial `@modelcontextprotocol/sdk`. Consulte a documentação da
  versão instalada; o deploy é em ambiente tipo Cloudflare Workers, então evite
  APIs exclusivas do Node.
- Autenticação: header `Authorization: Bearer <token>`; busca pelo hash; monta o `ctx`.
- Publica como ferramentas todas as operações do registro que o escopo permite.
- Publica a Skill de guias como recurso/prompt (Fase 4).
- Limite de requisições por token e registro em `crm_audit_log` com `actor_type = 'mcp'`.

**Entrega em duas etapas:** primeiro só leitura (escopo `read`), validada em
produção; depois escrita.

### F3-T3 — Modo proposta

Toda escrita de roteiro feita por `thay` ou `mcp` grava em
`crm_itinerary_proposals` em vez de alterar o roteiro, a menos que a chamada peça
aplicação direta e o usuário tenha permissão. Na tela do roteiro: faixa
"Proposta da IA pendente" com **Ver diferenças**, **Aplicar** e **Descartar**.

### F3-T4 — Thay como agente

Substitui `itineraryPlanner` e o chat atual (`ai.functions.ts:616-1094`).

- Camada única `src/server/ai/agent.ts`: recebe mensagens + ferramentas (do
  registro) e roda o ciclo "modelo pede ferramenta → servidor executa → devolve
  resultado" até terminar, com limite de passos.
- Usa o provedor único de F0-T6 (`src/lib/server/ai/provider.ts`, Vercel AI
  SDK com AI Gateway ou OpenAI direto) e o ciclo de ferramentas do próprio SDK
  (`tools` + limite de passos). Nada de `fetch` manual para provedor.
- Saída estruturada por schema zod (`generateObject`/`Output.object` do SDK).
  Remover todos os `indexOf("{")` / `JSON.parse` manuais.
- Histórico: tabelas `crm_ai_threads` e `crm_ai_messages` (por roteiro ou lead).
- Resposta em streaming para a tela.
- **Controle de tokens:** toda execução do agente passa por `withAiQuota`
  (F0-T6), somando os tokens de **todos os passos** do ciclo, não só o último.
  Limite de passos por conversa (ex.: 8) e de tokens por pedido, configuráveis
  pelo super admin.
- Tempo limite e nova tentativa em erro de rede.
- Painel da Thay acessível em qualquer tela (o item do menu que hoje não faz nada).

### F3-T5 — Dados reais no lugar de dados inventados

- **Câmbio** (`convertCurrencyToBRL`, `ai.server.ts:422`): trocar o "pergunte ao
  modelo" por uma API de cotação, com cache diário.
- **Hotéis, restaurantes, passeios** (`searchHotels`, `searchSuggestions`): o
  modelo não pesquisa na web; nomes, preços e links podem ser inventados. Opções:
  usar busca na web do provedor, ou manter só os links de busca prontos e rotular
  o resto como "sugestão a validar". Nunca exibir link gerado pelo modelo sem
  checar que responde. A solução definitiva é o catálogo por destino da F4-T3:
  a Thay só recomenda o que está nele.

**Aceite da fase:**
- Conectar o Claude ao `/api/mcp` com um token e pedir "liste as viagens em
  rascunho" funciona.
- Pedir "monte o dia 3 da viagem X" cria uma proposta visível na tela em tempo real.
- A Thay faz o mesmo pedido pelo painel, com o mesmo resultado.
- Token revogado para de funcionar na hora.

---

## Fase 4 — Roteiros pelas Skills de guias OSV (D1 decidido)

### O que são as skills

Estão em `docs/skills/` (versão 1, copiadas como vieram):

- `guia-osv-diagramacao` (**Modo 1**): dá forma a um texto pronto do time, sem
  reescrever. Tem a seção **"Guia de cliente"**: viagem com datas, voos e hotéis
  já comprados, que é exatamente o que o CRM guarda.
- `guia-osv-completo` (**Modo 2**): pesquisa e cria um guia genérico do zero e
  gera a base `thay-<destino>.md` (catálogo do destino para a Thay).

As duas foram escritas para rodar **no Claude** (lendo o Drive, pesquisando na
web e gerando PDF + site com o `site.py` da skill `roteiro-osv`), não dentro do
CRM. Por isso o desenho da fase é: **a skill roda no Claude e o CRM entra como
fonte e destino dos dados, pelo MCP (Fase 3)**. O CRM não reimplementa o
gerador de PDF/site.

### Pendente para fechar esta fase

As skills citam arquivos que ainda não estão no repositório. Sem eles, as
tarefas F4-T2 a F4-T5 não podem ser detalhadas:

| Arquivo | Para quê |
|---|---|
| `METODO-OSV.md` | Como montar cada dia (chegada leve, um dia por região, folga no último dia, plano B...). **O mais importante.** |
| `REGRAS-GUIA-GENERICO.md` | Núcleo, módulos, voos, afiliados, critérios de qualidade |
| `REGRAS-DE-CONTEUDO.md` | Limites de conteúdo por página |
| Skill `roteiro-osv` (com o formato do JSON e o `site.py`) | Formato de exportação (F4-T5) |
| `DS/parceiros.json` | Links de afiliado, cupons, WhatsApp do seguro, senha do site (F4-T3) |
| `CONTEXTO-OSV.md` | Tom de voz da Thay |

Copiar para `docs/skills/referencias/` quando chegarem (sem dados de clientes).

### F4-T1 — Skills dentro do sistema

- Tabela `crm_skills (id, agency_id nullable, slug, version, title, body, assets jsonb,
  is_active, created_at)`. `agency_id` nulo = skill padrão da plataforma
  (editável só pelo super admin).
- Importar as duas skills e os arquivos de referência como versão 1.
- Tela do super admin: ver, editar, criar nova versão, voltar versão.
- Entregues (a) como instrução de sistema da Thay e (b) como prompts/recursos
  do MCP (`guia-osv-diagramacao`, `guia-osv-completo`, `metodo-osv`).

### F4-T2 — Briefing da viagem pelo MCP

Operação `getTripBriefing(itineraryId)` (escopo `read`) que devolve os dados no
formato que o "Guia de cliente" pede, e lista o que falta:

- Voos: companhia, número, horários, terminais, franquia de bagagem,
  **incluindo o trecho da cidade de saída** (ex.: BH → GRU).
- Hospedagens: nome, **endereço exato**, check-in e check-out.
- Ingressos e reservas já comprados: data, local e quando ficam disponíveis.
- Links das pastas do Drive do cliente (Passeios, Transportes, Hotéis, geral),
  usando a integração de Drive da agência (F0-T2).
- Perfil dos viajantes: idades, restrições, malas, cartões/status com benefício.
- `faltando: [...]`: cada item acima que não está no CRM, para o Claude
  perguntar ou listar no `relatorio-lacunas.md`.

**Nunca** devolver números de documento (passaporte, visto, apólice).

Para isso caber no CRM: voos, hospedagens e ingressos viram tipos de atividade
com campos próprios no `meta` (F1-T1): `flight { airline, number, from, to,
terminal, departs_at, arrives_at, baggage }`, `stay { name, address, check_in,
check_out }`, `ticket { venue, available_at, drive_folder }`. O consultor
preenche na tela do roteiro; a IA não inventa esses dados.

### F4-T3 — Catálogo por destino e parceiros

**Catálogo** (substitui o "a IA inventa hotel e restaurante" da F3-T5):
- Tabela `crm_destination_catalog (id, agency_id nullable, destination, name,
  kind ['atracao','restaurante','hospedagem'], region, price_range, duration,
  best_time, needs_booking boolean, link, maps_url, checked_at, source)`.
  `agency_id` nulo = catálogo OSV da plataforma.
- Importador do `thay-<destino>.md` gerado pelo Modo 2 (uma linha do catálogo =
  uma linha da tabela). Tabela de regiões e tempos de deslocamento junto.
- A Thay e o MCP **só recomendam itens do catálogo**. Item de fora entra
  marcado `unverified = true` e aparece na tela como "Sugestão não verificada".

**Parceiros:**
- Tabela `crm_partner_links (key, label, url, coupon, agency_id nullable)`
  carregada do `parceiros.json`.
- A IA grava só o prefixo (`gyg:<url>`, `trip:<url>`, `parceiro:gettransfer`...);
  o servidor resolve para o link de afiliado na hora de exibir/exportar. Link de
  afiliado nunca é digitado pela IA.
- Regra do guia de cliente: **item já comprado aponta para a pasta do Drive**,
  não para afiliado. Afiliado só no que ainda vai ser comprado.

### F4-T4 — Geração do roteiro no formato do Método OSV

Operação `generateItineraryFromSkill(itineraryId)`:

1. **Briefing:** `getTripBriefing`. Se faltar dado essencial, devolve as
   perguntas e para.
2. **Esqueleto:** lista de dias com data, cidade/região e tema. Um dia por data,
   sem pular nem repetir (validação em código, não no prompt).
3. **Detalhamento:** um pedido por dia (ou bloco de 2 a 3 dias). Formato do dia
   da skill, guardado no `meta` do dia: Manhã / Tarde / Noite, Onde comer perto,
   Reserve antes, Plano B, Dica. Itens vindos do catálogo (F4-T3).
4. **Revisão em código** (não pelo modelo), com as regras das skills:
   - todo passeio pago tem link (`gyg:`/`trip:`/pasta do Drive se já comprado);
   - todo lugar tem mapa;
   - moeda em todo custo (hoje os custos da IA entram sem moeda e aparecem como R$);
   - guia de cliente sem pendência interna: o texto não pode conter
     `a definir|a confirmar|confirmem|perguntem|combinem|[CONFIRMAR]`
     (mesmo regex da skill); o que falta vai para a lista de lacunas;
   - nenhum número de documento.
5. **Proposta:** grava em `crm_itinerary_proposals` para o consultor aprovar,
   com a lista de lacunas ao lado.

O mesmo fluxo pode rodar de dois jeitos: pela Thay dentro do CRM (passos 1 a 5
no servidor) ou pelo Claude com a skill + MCP (o Claude faz 2 a 4 e chama
`applyItineraryPlan` em modo proposta). As validações do passo 4 rodam no
servidor nos dois casos.

### F4-T5 — PDF, site e página do viajante

- **Exportação no formato do `roteiro-osv`:** operação
  `exportGuideJson(itineraryId)` que gera o JSON que o `site.py` já entende
  (`meta.modo`, `meta.tema`, `meta.inicio` com a data do dia 1, dias, links com
  prefixo). Com isso o PDF e o site saem do gerador que a OSV já usa. Detalhar
  quando o formato do JSON chegar (Pendente).
- `RoteiroPdfExport.tsx` vira o "PDF rápido" interno. Corrigir só o essencial:
  textos comerciais fixos (linhas 45-58), páginas de passaporte/visto em viagem
  nacional (29-43, 636-671), marca fixa na contracapa (860-861), corte de texto
  (161-179, 281-287). O visual OSV fica com o gerador oficial.
- Ativar `/viajante/:id` usando `share_token` (não o id), com "Copiar link" e
  "Revogar link" no roteiro, sem custos internos.
- **Atenção à senha única `segredo`** dos sites gerados pela skill: ela é igual
  para todos os guias, e um guia de cliente tem nome, datas, voos e endereço do
  hotel. Recomendação para o dono do produto: guias de cliente com senha
  própria (`meta.senha`) ou publicados só pelo link com `share_token` do CRM.

### F4-T6 — Avaliação

Montar 8 a 10 casos reais (lead + roteiro considerado bom) e um script que gera
o roteiro e confere: número de dias = período, todas as datas presentes, moeda
em todo custo, formato do dia completo, regex de pendências = 0, todo passeio
pago com link, todo lugar com mapa. Rodar a cada mudança de prompt, skill ou
modelo, registrando tokens gastos por caso.

---

## Fase 5 — Design system no padrão OSV

### Como está hoje

- Tailwind v4 com variáveis em `src/styles.css` (cores em hexadecimal, embora o
  comentário do arquivo exija oklch). Tema claro e escuro definidos.
- Fontes carregadas em `src/routes/__root.tsx:117`: Inter, Fredoka, Dancing Script.
- **A interface quase não usa componentes compartilhados:** 513 `<button>`,
  `<input>`, `<select>` e `<textarea>` escritos direto nas telas, cada um com
  suas classes. Dos 46 arquivos em `src/components/ui/`, 36 nunca são importados.
- 206 usos de cores fixas do Tailwind (`bg-red-500`, `text-emerald-600`...).
- 110 `style={{...}}` e cores em hexadecimal em `_app.admin.tsx` (23),
  `RoteiroPdfExport.tsx` (15), `_app.perfil.tsx` (9).

Por isso, trocar só as variáveis **não** basta: boa parte da tela ignora os tokens.

### Etapa A — Preparação (não depende do material OSV; pode começar já)

**F5-A1 — Inventário.** Gerar `docs/DS_INVENTARIO.md` com a lista de cores
fixas, estilos inline e elementos crus por arquivo.

```bash
grep -rnoE '\b(bg|text|border|ring|from|to)-(red|blue|green|amber|emerald|slate|gray|zinc|orange|yellow|purple|rose|sky|indigo|teal)-[0-9]{2,3}' src --include=*.tsx | grep -v components/ui
```

**F5-A2 — Tokens semânticos completos.** Em `src/styles.css`, garantir que
existem (e estão registrados no `@theme inline`): `success`, `warning`, `info` e
seus `-foreground`; tokens de status de venda e de roteiro (hoje espalhados em
`src/lib/ui.ts`); sombras; espaçamentos e tipografia, se o padrão OSV os definir.

**F5-A3 — Trocar cores fixas por tokens.** Arquivo por arquivo, substituir as
206 classes de paleta e os hexadecimais por tokens (`bg-red-500` → `bg-destructive`,
`text-emerald-600` → `text-success`...). Sem mudar a aparência nesta etapa.
Exceção: `RoteiroPdfExport.tsx` fica para a etapa C.

**F5-A4 — Componentes base.** Padronizar o conjunto mínimo em
`src/components/ui/`: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`,
`Switch`, `Badge`, `Card`, `Dialog`, `Tabs`, `Tooltip`, `Skeleton`, `EmptyState`,
`PageHeader`, `FormField` (rótulo + campo + erro). Apagar os arquivos de `ui/`
que não serão usados.

**F5-A5 — Migrar telas para os componentes base.** Um PR por tela, nesta ordem
(da menor para a maior): `auth`, `aceitar-convite`, `intake`, `perfil`,
`notificacoes`, `tarefas`, `financeiro`, `index` (painel), `clientes`,
`biblioteca`, `checklist-templates`, `leads`, `LeadDetailDrawer`, `admin`,
`roteiros.index`, `roteiros.$id`.

Em cada PR: capturas de tela antes/depois no claro e no escuro, em 375 px e 1440 px.

**F5-A6 — Trava no lint.** Regra que proíbe classes de paleta fixa e
hexadecimais em `.tsx` fora de `src/components/ui/` e do PDF.

**Aceite da etapa A:** o comando do F5-A1 não retorna nada; mudar `--primary` em
`styles.css` muda a cor de marca em **todas** as telas.

### Etapa B — Aplicar o padrão OSV (depende de D3)

Material necessário: paleta (com tema escuro, se houver), tipografia (famílias,
pesos, escala), raios, sombras, espaçamento, ícones, logo e variações,
especificação de componentes (estados: normal, hover, foco, desabilitado, erro)
e telas de referência.

1. **F5-B1 — Mapeamento.** Tabela `docs/DS_OSV_MAPA.md`: token OSV → variável do
   sistema. O que não tiver correspondência vira token novo; não improvise valor.
2. **F5-B2 — Tokens.** Atualizar `:root` e `.dark` em `src/styles.css`.
3. **F5-B3 — Tipografia.** Trocar as fontes em `__root.tsx:117` e `--font-sans`;
   remover as que saírem de uso.
4. **F5-B4 — Componentes.** Ajustar os componentes base (etapa A4) à
   especificação OSV, um por PR.
5. **F5-B5 — Marca.** Logo, favicon, ícones do PWA (`public/`), `manifest.webmanifest`
   (cores de tema), tela de login, e-mail de convite (`invites.functions.ts:39-45`).
6. **F5-B6 — Página de referência.** Rota `/_app/design` (só admin) mostrando
   todos os tokens e componentes, para revisão visual.

### Etapa C — Superfícies especiais

- **PDF do roteiro** (`RoteiroPdfExport.tsx`): tem cores e fontes próprias em
  estilo inline porque o gerador de PDF não lê as variáveis CSS do app. Criar um
  objeto `pdfTheme` derivado dos tokens OSV e usar em todo o arquivo. Fazer junto
  com F4-T3.
- **Página do viajante** (`viajante.$id.tsx`) e **formulário público** (`intake.tsx`).
- **Gráficos** (`_app.financeiro.tsx`): ler as cores dos tokens `--chart-*`.
- **Notificações push:** ícone e badge próprios (hoje usa um PNG de 915 KB).

### Aceite da fase

- [ ] Revisão visual tela a tela contra as referências OSV, aprovada pelo dono do produto.
- [ ] Contraste mínimo AA (4,5:1 texto normal) em claro e escuro.
- [ ] Foco visível em todo elemento interativo; navegação por teclado nos modais.
- [ ] Nenhuma cor, fonte ou raio fora dos tokens (lint do F5-A6 passando).
- [ ] Sem regressão em 375 px, 768 px e 1440 px.

---

## Fase 6 — Limpeza

- **F6-T1 — Formatação.** Um único PR só com `npm run format`, sem nenhuma outra
  mudança, combinado com o time para não conflitar com PRs abertos.
- **F6-T2 — Dependências sem uso.** Remover `date-fns`, `@hookform/resolvers` e as
  que só serviam aos componentes `ui/` apagados (`recharts`, `embla-carousel-react`,
  `input-otp`, `react-resizable-panels`, `vaul`, `cmdk`, `react-day-picker`,
  vários `@radix-ui/*`). Confirme com `grep` antes de cada remoção.
- **F6-T3 — Código morto.** `itineraryCopilot`, `findDuplicateLibraryImage`,
  `createPublicLead`, `createLeadFromClient`, `CornerBlobs`, o ramo
  `new:document` (`_app.roteiros.$id.tsx:1123-1139`), `formatBRL`, imports sem uso
  em `_app.roteiros.index.tsx`, as quatro cópias de `mapActivityType`.
- **F6-T4 — Decisão D4.** Asaas e assinatura: desligados na F0-T12; quando
  voltar, reativar a rota com o token só por header. Push (só o envio de teste
  existe; nenhum evento dispara) e vouchers (sem tela) continuam pendentes:
  terminar ou remover tela e código.
- **F6-T5 — Quebrar arquivos gigantes.** `_app.roteiros.$id.tsx` (5.720 linhas),
  `LeadDetailDrawer.tsx` (2.904), `_app.admin.tsx` (2.677), `_app.leads.tsx` (2.010):
  um componente por arquivo, em pastas por funcionalidade.
- **F6-T6 — Tipos.** Remover os `as any` em consultas ao Supabase; regenerar
  `types.ts` pelo fluxo oficial após as migrações.
- **F6-T7 — CI.** GitHub Actions rodando typecheck, lint e testes em todo PR.

---

## Apêndice — Riscos conhecidos e como lidar

| Risco | Como lidar |
|---|---|
| Migração aplicada fora de ordem com o código | Migração primeiro, código compatível com o formato antigo e o novo por uma versão |
| Lovable sobrescrever mudanças | Trabalhar em branch, PRs pequenos, nunca reescrever histórico |
| Mudança de RLS derrubar o app | Testar cada política com usuário de duas agências antes do merge |
| MCP ampliar uma falha de permissão | Fase 0 e 2 antes; MCP começa só com leitura; tudo via RLS do usuário |
| Custo de IA disparar com agente | Limite de passos por conversa, registro em `ai_usage_logs`, teto mensal por agência |
| Mudança visual quebrar telas grandes | Etapa A sem mudança de aparência; capturas antes/depois em cada PR |
