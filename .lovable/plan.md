# Mobile, PWA, Notificações (Firebase) e E-mail (Gmail)

## 1. PWA instalável
- Adicionar `public/manifest.webmanifest` (nome, short_name, theme/background color, `display: standalone`, ícones 192/512).
- Gerar ícones do app (maskable + normal) em `public/`.
- Inserir tags `<link rel="manifest">`, `theme-color` e `apple-touch-icon` no head de `src/routes/__root.tsx`.
- Sem service worker / offline (conforme escolhido: apenas instalável).

## 2. Responsividade mobile geral
- Revisar e ajustar as páginas principais para telas pequenas: Início, Leads, Roteiros, Biblioteca, Financeiro, Admin.
- Aplicar padrões responsivos: grids que colapsam (`grid-cols-1 sm:grid-cols-...`), `min-w-0`/`truncate` em cabeçalhos, tabelas com scroll horizontal, paddings reduzidos no mobile.
- Ajustar o `AppLayout` (header/main) para respiro adequado no mobile e espaço para a barra inferior.

## 3. Barra de navegação inferior (mobile)
- Em `src/components/layout/AppLayout.tsx`, substituir a navegação horizontal do header no mobile por uma **bottom navigation** fixa (`fixed bottom-0`, `md:hidden`).
- Itens (derivados do menu atual): Início, Leads (com badge contador), Roteiros, Financeiro, Admin. Biblioteca fica acessível pelas telas internas para não sobrecarregar a barra.
- Adicionar `padding-bottom` no conteúdo para não ficar atrás da barra; respeitar safe-area do iOS.

## 4. Notificações push via Firebase (FCM)
- Nova seção "Notificações" na página Administração (mesmo estilo `CollapsibleSection`, ícone `Bell`, subtítulo descritivo).
- UI para: habilitar/desabilitar, solicitar permissão do navegador, registrar token do dispositivo e enviar notificação de teste.
- Adicionar `firebase` (web SDK) e `public/firebase-messaging-sw.js` (service worker de mensagens, isolado do PWA).
- Tabela `device_tokens` (user_id, token, created_at) com RLS + GRANTs para guardar tokens.
- Server function para enviar push via FCM HTTP v1.

## 5. Envio de e-mail via Gmail API (conta única)
- Conectar o connector **Gmail** (`google_mail`) — conta única do dono, via gateway.
- Nova seção "E-mail (Gmail)" em Administração: status da conexão, remetente, e botão de envio de teste.
- Server function que monta o e-mail (RFC 2822, base64url) e envia via gateway `users/me/messages/send`.

## Segredos necessários (Firebase)
Para o push funcionar, você precisará fornecer as credenciais do seu projeto Firebase:
- Config web (apiKey, authDomain, projectId, messagingSenderId, appId) e a **VAPID key**.
- A **service account** do Firebase (para a server function enviar push).
O Gmail é conectado pelo fluxo de connector (sem colar chaves).

## Detalhes técnicos
- Stack: TanStack Start; server logic em `createServerFn` (não edge functions).
- Realtime do badge de leads já existente é mantido.
- Service worker de mensagens FCM é exceção à regra de "sem service worker" do PWA e não registra cache de app.

```text
mobile layout
+------------------+
|     conteúdo     |
|                  |
+------------------+
| 🏠  👥  🗺️  💰  🛡️ |  <- bottom nav (md:hidden)
+------------------+
```

## Ordem de execução
1. PWA (manifest + ícones + head)
2. Bottom nav + responsividade do layout
3. Responsividade das páginas
4. Seção Gmail + connector + server fn
5. Seção Notificações + Firebase + tabela + server fn

Observação: por ser uma entrega extensa, posso executar por etapas. As notificações Firebase dependem das credenciais do seu projeto Firebase para ficarem 100% funcionais.