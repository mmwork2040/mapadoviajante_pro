# Segurança — versão Appwrite (produção)

Este documento substitui, para o código em produção (`mapadoviajante_pro`,
Vercel + Appwrite), as partes de banco do `PLANO_IMPLEMENTACAO.md`, que foi
escrito para a versão Supabase (`crmosegredodoviajante`). Lá, o RLS do Supabase
separava as agências; **no Appwrite essa proteção não existe** e precisa ser
feita pelas permissões das coleções e pelo servidor.

## Como o sistema funciona hoje

- O navegador fala direto com o Appwrite (`appwrite.agenc-ia.net`) por uma
  "ponte" que imita o cliente do Supabase (`src/integrations/appwrite/bridge.ts`).
  Quase toda leitura e escrita de leads, roteiros, tarefas etc. acontece assim
  (`src/lib/services.ts`).
- As server functions (`src/lib/*.functions.ts`) fazem IA, e-mail, convites,
  Drive, push e pagamentos.

## Corrigido (branch `seguranca-autenticacao-servidor`)

| Problema | Correção |
|---|---|
| Server functions aceitavam qualquer pessoa: o middleware devolvia sempre o usuário fixo `admin_server_user` e o navegador mandava o texto `appwrite_session_active` no lugar de um token | Navegador envia o JWT do Appwrite; o servidor confere em `/account` e recusa sem sessão |
| Servidor acessava o banco como visitante anônimo | Servidor usa `APPWRITE_API_KEY` em um cliente próprio (a chave nunca vai ao navegador) |
| Consultas do servidor pegavam o primeiro registro de qualquer agência (`crm_ai_config.select("*").maybeSingle()`, `resolveAgencyId` de pagamentos sem filtro de usuário) | Cliente do servidor limitado à agência do usuário (`createAgencyScopedBridge`): filtra por `agency_id` e grava `agency_id` |
| Agência fixa `2a0f9141-…` usada quando a agência não era encontrada (convites, Gmail, push) | Removida; sem agência = erro |
| Configurações da agência (com senha do Gmail e chave do Appwrite de e-mail) lidas e gravadas pelo navegador | Passam pelo servidor; senhas nunca voltam; só admin salva |
| Webhook disparado pelo navegador com o segredo | Disparado pelo servidor |
| Convites: qualquer usuário convidava, papel livre, HTML sem escape | Só admin; papel validado; HTML escapado |
| Push: lista de aparelhos de todas as agências quando sem agência | Só admin, só da própria agência |

## Variáveis de ambiente na Vercel

| Variável | Obrigatória | Para quê |
|---|---|---|
| `APPWRITE_API_KEY` | **Sim** | Acesso do servidor ao banco. Escopos: `databases.read`, `databases.write`, `documents.read`, `documents.write`, `files.read`. Sem ela, o servidor continua anônimo (como antes) e registra aviso no log |
| `APP_URL` | Recomendada | Endereço público usado nos links de convite (ex.: `https://mapadoviajante-pro.vercel.app`) |
| `SUPER_ADMIN_EMAILS` | Opcional | Super admins, separados por vírgula. Sem ela, valem os dois e-mails atuais |
| `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` | Opcional | Usam os `VITE_APPWRITE_*` se ausentes |

## O que falta — e precisa do console do Appwrite

**1. Permissões das coleções (urgente).** As server functions agora estão
protegidas, mas o navegador continua lendo e gravando direto no Appwrite. Quem
protege isso são as permissões de cada coleção. Conferir em
*Console → Databases → (banco) → cada coleção → Settings → Permissions*:

- Se aparecer **`Any`** com leitura ou escrita: **qualquer pessoa na internet**
  lê ou altera os dados (o ID do projeto está no código do site). Remover já.
- Se aparecer **`Users`**: qualquer pessoa que crie uma conta lê os dados de
  **todas** as agências. Ainda é um vazamento entre agências.

Teste rápido (sem login), de um computador qualquer — se responder com
`"total"`, a coleção está aberta para qualquer pessoa:

```bash
curl -s -H "X-Appwrite-Project: 6abdb8190017d98565f5" "https://appwrite.agenc-ia.net/v1/databases/6abdb82f002c563b2ad3/collections/crm_leads/documents?queries%5B0%5D=%7B%22method%22%3A%22limit%22%2C%22values%22%3A%5B1%5D%7D"
```

Repetir trocando `crm_leads` por `agencies`, `agency_members`, `system_settings`,
`crm_ai_config`, `crm_clients`.

**2. Separação por agência no navegador.** Duas saídas:

- **(a) Times do Appwrite + segurança por documento** (mais rápida): um Team por
  agência; ligar *Document Security* nas coleções `crm_*`; cada documento criado
  recebe permissão `team:<agência>`; coleção sem permissão para `Users`.
  Exige um script para dar permissão aos documentos que já existem.
- **(b) Fase 2 do plano** (mais sólida): mover as leituras e escritas de
  `services.ts` para server functions, que já usam o cliente limitado à agência,
  e fechar as coleções para o navegador.

Recomendação: (a) agora para estancar, (b) ao longo da Fase 2.

**3. Outros pontos encontrados (próximas tarefas):**

- `rpc("has_role")` na ponte **sempre devolve verdadeiro**.
- A criação de agência (`provision_agency`) roda no navegador, sem controle.
  Com a decisão de liberar acesso pela Hotmart (F0-T7/F0-T11 do plano), isso
  passa para o servidor.
- `SUPER_ADMIN_EMAILS` também existe no navegador
  (`src/services/appwriteAuthService.ts`), e o login grava `role: "admin"` para
  todo usuário no `localStorage`. Só afeta telas, mas engana a interface.
- Rotas públicas (`/api/public/n8n-lead`, `push-delivery`, `asaas-webhook`)
  ainda seguem o desenho antigo: ver F0-T8, F0-T9 e F0-T12 do plano.
- Google Drive ainda usa o conector do Lovable (`LOVABLE_API_KEY`).

## Como testar a branch na prévia da Vercel

1. Configure `APPWRITE_API_KEY` (e `APP_URL`) no ambiente *Preview* da Vercel.
2. Abra a prévia da branch, faça login e teste: IA (completar roteiro), envio de
   teste de e-mail na Administração, convite de membro, salvar configurações de
   webhook/e-mail, push de teste.
3. Logado como consultor: Administração deve recusar salvar configurações e
   convidar.
4. Sem login, qualquer chamada a `/_serverFn/...` responde
   "Sessão expirada. Faça login novamente."
