## Objetivo

Permitir montar roteiros a partir de um lead, com etapas (ex.: Dia 1, Dia 2) e itens/checklists dentro de cada etapa, suportar múltiplos roteiros por lead, visualizar como kanban e fazer upload de documentos que a IA interpreta para preencher dados (voo, hotel, dia, hora).**configurada pela própria agência** (não Lovable AI), que só funciona depois de testada/conectada no admin.

A base já existe no banco: `crm_itineraries` (tem `lead_id`), `crm_itinerary_days` (etapas) e `crm_itinerary_activities` (itens). Vamos aproveitar e ampliar.`crm_ai_config` (provider, model, api_key, system_prompt, max_tokens).

## 1. Criar roteiro a partir de um lead

- No modal "Novo Roteiro" (`src/routes/_app.roteiros.tsx`), substituir o campo livre "Cliente" por um seletor de Lead (busca em 
  - Selecionar provider (OpenAI, Anthropic, Google Gemini, etc.), model, API key e prompt do sistema.
  - Botão "Testar conexão" que faz uma chamada simples à LLM escolhida via server function e só marca como "conectada" se passar.
  - Salvar em `crm_ai_config`. A API key fica no banco (campo `api_key_encrypted`) por agência.
- Ao escolher o lead, preencher automaticamente 

### Detalhe técnico

- Migração: adicionar coluna `checklist jsonb default '[]'` em `crm_itinerary_activities` (formato 
  - `testAiConnection`: chama o endpoint do provider configurado com a credencial da agência.
  - `extractDocumentData`: envia o documento para o provider e retorna JSON estruturado.
- Migração: adicionar `status text default 'disconnected'` (e `last_tested_at`) em `crm_ai_config` para registrar se foi testada.

## 3. Múltiplos roteiros por lead + Kanban

- Na página de detalhe do lead (`_app.leads.$leadId.tsx`), nova seção "Roteiros" listando todos os roteiros daquele lead com botão "Novo Roteiro" já pré-vinculado.`fetchLeads`), preenchendo `lead_id`, `client_name`, `destination`, `budget`.
- Visão Kanban dos roteiros do lead por 

## 4. Upload de documento + leitura por IA

- Criar bucket de storage privado `itinerary-docs` para anexos do roteiro.`crm_itinerary_activity`.
- Botão "Enviar documento" na etapa/roteiro: faz upload e chama uma server function que envia o arquivo para a Lovable AI (Gemini, multimodal) com um prompt que extrai dados estruturados (tipo: voo/hotel/transfer; número do voo, data, hora, hotel, quarto, etc.).`src/routes/_app.roteiros.$id.tsx`), adicionar checklist dentro de cada item.
- Retornar os campos extraídos e abrir um formulário pré-preenchido para o usuário confirmar antes de criar o item na etapa correspondente.`checklist jsonb default '[]'` em `crm_itinerary_activities` (formato `[{text, done}]`).

## 4. Múltiplos roteiros por lead + Kanban

- Na página do lead (`_app.leads.$leadId.tsx`), seção "Roteiros" listando todos os roteiros do lead, com botão "Novo Roteiro" já vinculado.
- Visão kanban por `status` (rascunho / em andamento / confirmado / concluído) com drag-and-drop (mesmo padrão dos leads).

## 5. Upload de documento + leitura pela LLM configurada

- Bucket de storage privado `itinerary-docs`.
- Botão "Enviar documento" na etapa: faz upload, chama `extractDocumentData` (usando a LLM da agência) que extrai tipo (voo/hotel/transfer), número do voo, data, hora, hotel, quarto, etc.
- Retorno abre um item pré-preenchido para o usuário confirmar antes de salvar na etapa. Se a IA não estiver conectada, o botão fica desabilitado com aviso.

## Ordem de entrega

1. Migração (checklist nas atividades) + bucket de storage.
2. Seletor de lead no modal de criação de roteiro.
3. Seção "Roteiros" + Kanban na página do lead.
4. Checklists nos itens das etapas.
5. Upload de documento + extração por IA com confirmação.
6. Upload de documento + extração pela LLM com confirmação.

## Pergunta

1. Quais providers de LLM devo oferecer inicialmente (OpenAI, Anthropic, Google Gemini)?
2. A IA deve apenas sugerir os dados extraídos para você confirmar antes de criar o item (recomendado), certo?