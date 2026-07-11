## Objetivo

Ler documentos de uma **conta Google Drive compartilhada da agência** para alimentar a elaboração do roteiro, com a conexão configurada na página de **Administração** e a importação disponível no **editor de roteiro** (ao lado de "Documento (IA)").

## Arquitetura

Usamos o **connector nativo Google Drive da Lovable** (gateway) — uma única conta Google conectada no nível do workspace, sem gerenciar tokens OAuth manualmente.

```text
Admin (ligar/desligar + pasta padrão)
        │
        ▼
Server functions (createServerFn)  ──►  Gateway Google Drive
  - listar arquivos                      (Bearer LOVABLE_API_KEY +
  - baixar/extrair texto                  X-Connection-Api-Key)
        │
        ▼
Editor de roteiro → "Importar do Drive" → texto → mesmo pipeline do "Documento (IA)"
```

## Etapas

### 1. Conectar o connector
- Vincular o connector `google_drive` ao projeto (fluxo de conexão da Lovable). Você escolhe/autoriza a conta Google da agência.
- Sem isso, as chamadas ao gateway falham por falta de credencial.

### 2. Configuração na Administração (`_app.admin.tsx`)
- Nova seção **"Google Drive"** seguindo o padrão das outras (webhook, gmail, n8n).
- Campos: **ativar/desativar** e **pasta padrão** (ID ou seleção de pasta do Drive).
- Persistir via `settings.functions.ts` adicionando o scope `"gdrive"` (mesma tabela `system_settings`, chave por agência). É a única mudança de "config"; sem alterar schema.

### 3. Server functions novas (`src/lib/gdrive.functions.ts`)
- `listDriveFiles({ folderId?, query? })` → lista arquivos (PDF, DOCX, Google Docs) da pasta configurada, via `GET /files` no gateway.
- `fetchDriveFileText({ fileId, mimeType })` → extrai texto:
  - Google Docs nativo → export como texto simples.
  - PDF/DOCX → baixa o conteúdo (`alt=media`) e reaproveita o parser de documentos já existente no fluxo "Documento (IA)".
- Todas com `requireSupabaseAuth` (só membros logados) e lendo `LOVABLE_API_KEY`/`GOOGLE_DRIVE_API_KEY` do runtime do servidor.

### 4. UI no editor de roteiro (`_app.roteiros.$id.tsx`)
- Novo botão **"Importar do Drive"** junto ao "Documento (IA)".
- Modal simples: lista arquivos da pasta padrão (com busca), você seleciona um, o sistema extrai o texto e o injeta no **mesmo pipeline** que hoje trata o documento importado pela IA.
- Só aparece se a seção Google Drive estiver ativada na Administração.

## Detalhes técnicos

- Escopo do connector = conta compartilhada (não é o Drive pessoal de cada consultor); condiz com a opção escolhida.
- Gateway: `https://connector-gateway.lovable.dev/google_drive/drive/v3/...` — nunca chamamos a API do Google direto.
- Sem mudança de schema no banco; apenas novo scope de settings + novas server functions + UI.
- Reaproveita o parser/pipeline atual de documentos para manter consistência com "Documento (IA)".

## Fora de escopo (por agora)
- OAuth por usuário (Drive pessoal de cada consultor).
- Importar do Drive na Biblioteca ou no chat de IA (só o editor de roteiro nesta entrega).
