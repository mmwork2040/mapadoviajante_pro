# Modelo de dados no Appwrite · CRM OSV

Modelo **alvo**. Na Fase 0 (F0-T2) ele é comparado com o que já existe no projeto Appwrite, e o resultado vai para `inventario-appwrite.md` como a tabela "coleção atual → coleção alvo". Onde já existir uma coleção equivalente, ela é ajustada em vez de duplicada.

Convenções:
- banco: `crm`; IDs de coleção em inglês, minúsculas e com underscore (ex.: `trip_items`); atributos em camelCase;
- todo documento tem `agencyId` (string, indexado) e usa os campos de sistema do Appwrite (`$id`, `$createdAt`, `$updatedAt`);
- datas em ISO 8601 (`datetime`); dinheiro em centavos (`integer`) com `currency` (padrão `BRL`);
- listas curtas e estruturas pequenas em atributos JSON (`string` grande com JSON), e o que precisa de filtro em atributo próprio;
- relacionamentos por ID (`string`) com índice. Relationship attributes do Appwrite só onde a exclusão em cascata for desejada.

## 1. Agência, equipe e acesso

**Agência = Team do Appwrite.** Os papéis do Team são os cargos: `admin`, `gerente`, `comercial`, `consultoria`. Uma pessoa pode ter mais de um.

| Coleção | Atributos principais | Observações |
|---|---|---|
| `agencies` | `teamId`, `name`, `cnpj`, `whatsapp`, `instagram`, `logoFileId`, `pdfFooter`, `status` (`ativa`/`bloqueada`), `aiQuota`, `hotmartBuyerEmail` | Um por Team. O super admin edita `status` e `aiQuota` |
| `members` | `agencyId`, `userId`, `name`, `email`, `roles[]`, `avatarColor`, `status` (`ativo`/`convite`/`bloqueado`), `prefs` (JSON: tema e modos de visualização por tela, A6), `lastSeenAt` | Perfil do usuário na agência. Os papéis reais ficam no Team; `roles[]` é cópia para exibir |
| `invites` | `agencyId`, `email`, `roles[]`, `token`, `expiresAt`, `status` | Convite de equipe (o Team do Appwrite pode substituir; decidir na F0) |

## 2. Viajantes

| Coleção | Atributos principais | Índices |
|---|---|---|
| `households` | `agencyId`, `name`, `kind` (`familia`/`casal`/`grupo`), `notes`, `legacyId` | `agencyId` |
| `people` | `agencyId`, `householdId?`, `relation` (titular, cônjuge, filha, filho, noivo, organizadora, participante...), `name`, `birthDate?`, `cpf?`, `email?`, `phone?`, `whatsapp?`, `passportNumber?`, `passportExpiry?`, `passportCountry?`, `visas` (JSON), `preferences` (JSON: assento, alimentação, estilo, hospedagem, acessibilidade), `notes?`, `appAccess` (`sem`/`convite`/`ativo`/`menor`), `appUserId?`, `legacyId?`, `createdBy` | `agencyId`; `householdId`; texto em `name`; `passportExpiry` (para as datas automáticas) |

Regras: documento de identidade e passaporte **nunca** vão para páginas públicas nem para a IA. Menores (`appAccess = menor`) acompanham pela conta do responsável.

## 3. Viagens

**Uma viagem é um documento só, da negociação à volta.** Ele substitui o par antigo venda + roteiro.

| Coleção | Atributos principais | Índices |
|---|---|---|
| `trips` | `agencyId`; `title`; `destination`; `coverFileId?`; `phase` (`comercial`/`preparacao`/`concluida`/`perdida`); `stage` (comercial: `novo`/`contatado`/`negociando`/`fechado`; preparação: `montando`/`com_cliente`/`emitindo`/`pronta`/`em_viagem`); `startDate?`; `endDate?`; `whenText?` (ex.: "julho, 10 dias"); `paxText`; `tripType` (lazer, família, lua de mel, negócios, aventura, cruzeiro); `origin` (Instagram, Indicação, Site, WhatsApp, Google, Formulário, Base de viajantes...); `budgetCents?`; `ownerId` (comercial); `consultantId?` (preparação); `nextStepText?`; `nextStepDue?`; `lastContactAt?`; `lostReason?`; `archivedAt?`; `serviceType?` (os quatro tipos de serviço); `profile` (JSON: saída, classe de voo, companhia preferida, hotel, quarto, milhas e programas, observações); `shareToken?`; `legacyLeadId?`; `legacyItineraryId?` | `agencyId+phase+stage`; `ownerId`; `nextStepDue`; `startDate`; `lastContactAt`; texto em `title` e `destination` |
| `trip_travelers` | `agencyId`, `tripId`, `personId`, `isMain` | `tripId`; `personId`; único `tripId+personId` |
| `trip_days` | `agencyId`, `tripId`, `dayNumber`, `date?`, `title`, `meta` (JSON no formato do dia do Método OSV: manhã, tarde, noite, onde comer, reserve antes, plano B, dica) | `tripId+dayNumber` |
| `trip_items` | `agencyId`, `tripId`, `dayId`, `order`, `time?`, `kind` (`voo`/`hospedagem`/`atividade`/`transfer`/`restaurante`/`ingresso`), `title`, `details?`, `place?`, `mapsUrl?`, `link?` (com prefixo de parceiro `gyg:`/`trip:`/`parceiro:`), `status` (`pendente`/`reservado`), `costCents?`, `currency`, `costBrlCents?`, `paidWith?`, `kindData` (JSON por tipo: voo {companhia, número, origem, destino, terminal, partida, chegada, bagagem}; hospedagem {nome, endereço, checkIn, checkOut, quarto}; ingresso {local, disponívelEm, pastaDrive}), `imageFileIds[]`, `aiDraft` (bool) | `tripId+dayId+order` |
| `checklist_items` | `agencyId`, `tripId`, `section`, `text`, `done`, `dueDate?`, `assigneeId?`, `templateId?`, `order` | `tripId`; `dueDate` |
| `trip_expenses` | `agencyId`, `tripId`, `category` (passagem, hospedagem, seguro, alimentação, transporte, passeio, taxa, outro), `description`, `amountCents`, `paidWith` (dinheiro/pix, cartão, milhas/pontos, cortesia, a pagar), `savingsCents`, `date` | `tripId` |
| `trip_documents` | `agencyId`, `tripId?`, `personId?`, `fileId`, `bucket`, `name`, `mime`, `sizeBytes`, `kind` (voucher, passagem, seguro, contrato, roteiro, outro), `uploadedBy` | `tripId`; `personId` |
| `history` | `agencyId`, `tripId?`, `personId?`, `kind` (whatsapp, ligação, e-mail, reunião, observação, etapa, proposta, contrato, pagamento, sistema), `text`, `meta` (JSON), `authorId?`, `at` | `tripId+at`; `personId+at` |

## 4. Agenda

| Coleção | Atributos | Índices |
|---|---|---|
| `agenda_items` | `agencyId`, `kind` (tarefa, ligação, whatsapp, reunião, e-mail, checklist, automático), `title`, `date`, `time?`, `tripId?`, `personId?`, `checklistItemId?`, `assigneeId`, `priority` (baixa/normal/alta), `done`, `doneAt?`, `remindMinutes?`, `autoKey?` (para datas automáticas não duplicarem, ex.: `niver:personId:2026`) | `agencyId+date`; `assigneeId+date`; único `autoKey` |

Datas automáticas (Function `datas-automaticas`, diária): aniversário de pessoa, passaporte vencendo (6 meses e 3 meses), embarque (D-30, D-7, D-1) e item de checklist com prazo.

## 5. Proposta, contrato e pagamento

| Coleção | Atributos | Observações |
|---|---|---|
| `proposal_templates` | `agencyId?` (vazio = padrão da plataforma), `serviceType`, `name`, `assistanceLevel`, `assistanceSummary`, `included[]`, `notIncluded[]`, `clientDuties[]`, `agencyDuties[]`, `assistance[]` | Os quatro tipos começam com os textos de `docs/prototipo-crm/js/termos.js` (revisar, P9) |
| `proposals` | `agencyId`, `tripId`, `status` (`rascunho`/`enviada`/`aceita`/`recusada`/`expirada`), `message`, `coverFileId?`, `datesText`, `serviceType`, `terms` (JSON com as cinco seções e quais estão personalizadas), `paymentOptions[]`, `validUntil`, `shareToken`, `sentAt?`, `views`, `lastViewAt?`, `acceptedOptionId?`, `acceptedAt?` | Uma proposta ativa por viagem; versões antigas ficam guardadas |
| `proposal_options` | `agencyId`, `proposalId`, `name`, `subtitle`, `items[]`, `priceCents`, `savingsCents`, `recommended`, `order` | |
| `contract_templates` | `agencyId`, `name`, `body` (texto com marcadores) , `version` | Modelo jurídico (P9) |
| `contracts` | `agencyId`, `tripId`, `proposalId`, `optionId`, `templateVersion`, `renderedText`, `status` (`enviado`/`assinado`/`cancelado`), `signerName?`, `signedAt?`, `signerIp?`, `signerUserAgent?`, `documentHash`, `pdfFileId?` | A assinatura é gravada só pela Function `assinar-contrato` |
| `payments` | `agencyId`, `tripId`, `contractId?`, `method` (pix, cartão, entrada e parcelas), `amountCents`, `dueDate?`, `status` (`pendente`/`recebido`/`cancelado`), `receivedAt?`, `provider?` (manual agora; Asaas depois) | |

## 6. Biblioteca, modelos e IA

| Coleção | Atributos | Observações |
|---|---|---|
| `library_items` | `agencyId`, `kind` (roteiro modelo, experiência, pacote, documento), `title`, `destination`, `days?`, `tags[]`, `coverFileId?`, `content` (JSON: dias, itens, dicas), `priceText?`, `origin` (`pdf`/`ia`/`manual`), `status` (`rascunho`/`publicado`), `usedCount`, `sourceFileId?` | Alimenta o Assistente |
| `library_imports` | `agencyId`, `mode` (`pdf`/`ia`), `input` (JSON: arquivo ou pedido), `status` (`processando`/`revisar`/`salvo`/`erro`), `result` (JSON), `warnings[]` | Uma por criação; a tela de revisão lê daqui |
| `checklist_templates` | `agencyId`, `name`, `isDefault`, `active`, `sections` (JSON: [{título, itens[]}]), `usedCount` | Editor por item |
| `skills` | `agencyId?`, `slug`, `version`, `title`, `body`, `assets` (JSON), `active` | `guia-osv-diagramacao`, `guia-osv-completo`, `metodo-osv` |
| `destination_catalog` | `agencyId?`, `destination`, `name`, `kind`, `region`, `priceRange`, `duration`, `bestTime`, `needsBooking`, `link`, `mapsUrl`, `checkedAt`, `source`, `unverified` | Do plano anterior, F4-T3 |
| `partner_links` | `agencyId?`, `key`, `label`, `url`, `coupon?` | Resolvidos no servidor |
| `guides` | `agencyId`, `tripId`, `status` (`gerando`/`revisar`/`aprovado`/`enviado`), `skillSlug`, `skillVersion`, `json` (formato `roteiro-osv`), `gaps[]`, `pdfFileId?`, `siteUrl?`, `sentAt?` | Aba Guia |
| `ai_usage` | `agencyId`, `userId`, `feature`, `model`, `inputTokens`, `outputTokens`, `costCents`, `at` | Cota por agência (D2) |

## 7. Gestão, configuração e comunicação

| Coleção | Atributos | Observações |
|---|---|---|
| `transactions` | `agencyId`, `type` (`receita`/`despesa`), `description`, `category` (pacote, comissão, operacional, marketing), `amountCents`, `date`, `status` (`confirmado`/`pendente`), `tripId?`, `memberId?` | Financeiro da agência (só admin) |
| `settings` | `agencyId`, `key`, `value` (JSON) | Assistente (provedor, modelo, orientações), formulário de captação, distribuição de viagens novas, notificações por evento |
| `integrations` | `agencyId`, `provider` (gmail, drive, whatsapp, asaas, n8n, webhook), `status`, `config` (JSON sem segredo) | **Tokens e segredos ficam só nas Functions** (variáveis ou coleção sem permissão de leitura para usuários) |
| `notifications` | `agencyId`, `userId`, `kind`, `title`, `body`, `link`, `readAt?` | Sino e e-mail |
| `share_links` | `agencyId`, `kind` (proposta, contrato, roteiro, guia, formulário), `targetId`, `token`, `expiresAt?`, `revokedAt?`, `views` | Páginas públicas leem por aqui, pela Function `links-publicos` |
| `intake_submissions` | `agencyId`, `answers` (JSON), `tripId?`, `personId?`, `at` | Formulário "Planejar minha viagem" |

## 8. Storage (buckets)

| Bucket | Conteúdo | Regras |
|---|---|---|
| `documentos` | Vouchers, passagens, seguros, documentos de viajantes | Privado por agência; até 20 MB; PDF e imagem |
| `biblioteca` | Capas, fotos e PDFs da Biblioteca | Privado por agência |
| `capas` | Fotos de destino para proposta e viagem | Leitura pública só por link assinado |
| `contratos` | PDF do contrato assinado | Privado; gravação só pela Function |
| `guias` | PDF e site do guia gerado | Privado; publicação por link com token |

## 9. Functions

| Function | Gatilho | Faz |
|---|---|---|
| `ia-assistente` | HTTP (usuário logado) | Pedidos do Assistente e da Biblioteca, com a chave no servidor, a cota e o registro de uso |
| `ia-ler-pdf` | Evento de upload ou HTTP | Lê o PDF, separa dias, experiências e fotos e grava em `library_imports` para revisão |
| `gerar-guia` | HTTP | Briefing da viagem, skill, validações em código, `guides` |
| `links-publicos` | HTTP público | Entrega proposta, contrato, roteiro ou guia pelo token, sem dados internos |
| `assinar-contrato` | HTTP público (token) | Grava a assinatura, gera o PDF, muda a viagem para Fechado e cria o pagamento |
| `datas-automaticas` | Agendada (diária) | Cria e atualiza os itens automáticos da agenda |
| `notificacoes` | Eventos de banco | Sino, e-mail e push |
| `hotmart-webhook` | HTTP público (hottok) | Libera ou bloqueia a agência (D5) |
| `n8n-entrada` | HTTP público (assinatura) | Cria viagem em Novo a partir de outra ferramenta |
| `captacao` | HTTP público | Formulário "Planejar minha viagem": cria pessoa e viagem e distribui para a equipe |
| `migracao` | Manual | Migração dos dados atuais (seção 10), idempotente, com relatório |

## 10. Migração dos dados atuais

Se os dados antigos já estiverem no Appwrite em outro formato (P4), a Function `migracao` faz a reorganização. Regras:

1. **Cliente → pessoa titular** (`people.relation = titular`, `legacyId` = id antigo). Se o cliente tinha membros da família, cria um `households` com o sobrenome.
2. **Membro da família → pessoa** da mesma família, com a relação (`relationship`). Membro que já tinha virado cliente (`client_id`) não é duplicado: o titular dele entra na família.
3. **Venda (lead) → viagem** (`trips`): `phase` e `stage` vêm do status (`new` → novo, `contacted` → contatado, `negotiating` → negociando, `closed` → fechado, `lost` → perdida). O perfil vai para `profile`, e o valor para `budgetCents`.
4. **Roteiro → mesma viagem** (pelo `lead_id`). Se a venda está fechada e tem roteiro: `phase = preparacao`, com o `stage` vindo do status do roteiro (`draft` → montando, `active` → emitindo, `completed` → concluída, `cancelled` → perdida). Roteiro sem venda vira viagem em preparação com o titular pelo `client_name`.
5. **Dias e atividades → `trip_days` e `trip_items`**, com o tipo e os metadados. Valores em centavos, com a moeda.
6. **Titular de cada venda → `trip_travelers` (isMain).** Os membros listados na venda também entram.
7. **Tarefas → `agenda_items`**; **atividades e notas → `history`**; **checklists da venda → `checklist_items`**; **gastos → `trip_expenses`**; **documentos → `trip_documents`** (os arquivos são copiados para o bucket `documentos`); **transações → `transactions`**; **biblioteca → `library_items`** (`origin = manual`); **modelos de checklist → `checklist_templates`**.
8. Relatório: contagem por coleção antes e depois, e lista do que não foi migrado e o motivo. Rodar primeiro numa cópia.
