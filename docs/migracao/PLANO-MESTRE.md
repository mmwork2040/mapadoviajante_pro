# Plano mestre · CRM OSV novo (identidade OSV + Appwrite)

Documento de execução. Escrito em 24/11/2026 para ser executado em outras sessões, em etapas.

**Objetivo final:** o sistema inteiro fica **exatamente como o protótipo aprovado** (`docs/prototipo-crm/`), com todas as funcionalidades desenhadas, rodando **só no Appwrite**. Nada de Supabase e nada de Lovable.

Documentos deste plano:

| Arquivo | O que tem |
|---|---|
| `PLANO-MESTRE.md` (este) | Situação, decisões, arquitetura, fases e tarefas, definição de pronto, riscos |
| `MODELO-DE-DADOS-APPWRITE.md` | Coleções, atributos, índices, permissões, buckets, funções e a migração dos dados atuais |
| `ESPECIFICACAO-TELAS.md` | Cada tela do protótipo em forma de requisito, com critérios de aceite |
| `INICIAR-PROXIMA-SESSAO.md` | O texto para colar ao abrir a próxima sessão, e o que ela faz primeiro |
| `inventario-appwrite.md` | O que existe hoje no Appwrite e para qual coleção alvo cada coisa vai (Fase 0) |
| `FUNCOES-ATUAIS.md` | Todas as funções do app atual, com a tela e a fase em que cada uma entra no desenho novo (decisão A9) |
| `referencias/plano-anterior-2026-11-19-supabase.md` | Plano anterior, feito para o Supabase. Vale pelas decisões e pelos bugs listados; a parte técnica de banco está superada |

Material de referência no repositório:

| Caminho | O que é |
|---|---|
| `docs/prototipo-crm/` | **O protótipo aprovado. É a especificação visual e de comportamento.** Abra `index.html` no navegador. Publicado também em https://claude.ai/artifact/LWpESGkMdkKVx7YyZTMe8E |
| `docs/identidade/` | Pacote de identidade OSV (24/11/2026): CSS de apps v24, guia de composição, manual de CSS, protótipo do app do aluno, manual de marca e logos oficiais |
| `docs/skills/guia-osv-completo/` e `guia-osv-diagramacao/` | Skills de guia de viagem da OSV (Modo 2 e Modo 1) |

---

## 1. Situação atual

### 1.1 O que foi verificado nesta sessão

- **Este repositório (`mmwork2040/crmosegredodoviajante`)** é um app TanStack Start + React 19 + Tailwind 4 + shadcn/ui. **Todo o acesso a dados ainda é Supabase:**
  - cliente em `src/integrations/supabase/`;
  - 15 tabelas `crm_*` mais `agencies`, `agency_members`, `agency_payment_settings` e `system_settings`;
  - RPCs `get_user_agency_id`, `provision_agency`, `has_role` e `get_shared_itinerary`;
  - buckets de storage (um deles `library-assets`);
  - 3 canais realtime (`leads-badge`, `leads-realtime`, `notifications-realtime`);
  - rotas públicas de API `asaas-webhook`, `n8n-lead` e `push-delivery`;
  - 12 arquivos de funções de servidor (`src/lib/*.functions.ts`).
- **Não há nenhuma referência ao Appwrite neste repositório**, em nenhuma branch.
- O servidor Appwrite responde em `https://appwrite.agenc-ia.net` (versão 2.3.0). A sessão tem credencial para ele, mas **sem o ID do projeto** a credencial entra como visitante, então as coleções não foram listadas.
- Existe outro repositório, `mmwork2040/mapadoviajante_pro`, atualizado em 24/11/2026. Numa branch deste repositório há um patch para remover o Lovable dele. **Provavelmente é a base do app que já usa o Appwrite. Confirmar** (P1).
- A fase 1 visual já foi feita **neste repositório**, na branch `claude/relaxed-mendel-k8rfnz` (commit `9befff1`). Ela inclui cores, fontes, botões em pílula, menu novo, abas de Viagens e logo. São componentes React e CSS, então podem ser levados para o repositório do Appwrite se o código for o mesmo.

### 1.2 O que o dono do produto informou (24/11/2026)

- Tudo o que havia no Supabase e no Lovable **não existe mais**.
- O aplicativo usa o código do **Appwrite**, e toda a estrutura e as conexões apontam para lá.
- **O que ainda aponta para outro lugar está fora e precisa ser corrigido.**

### 1.3 Perguntas abertas (as respostas estão na seção 1.4)

| # | Pergunta | Por que importa |
|---|---|---|
| P1 | Qual repositório e branch têm o app que já roda no Appwrite? É o `mapadoviajante_pro`? | Toda a execução acontece nele. Se for este repositório, a Fase 0 inclui trocar o Supabase pelo Appwrite |
| P2 | ID do projeto Appwrite, IDs dos bancos e se o servidor é próprio (`appwrite.agenc-ia.net`) ou Appwrite Cloud | Sem isso não dá para ler a estrutura atual nem criar coleções |
| P3 | Onde o app é publicado (Vercel, Cloudflare, servidor próprio, Appwrite Sites) e qual o domínio | Define variáveis de ambiente, funções de servidor e webhooks |
| P4 | Os dados antigos (clientes, vendas, roteiros, tarefas, biblioteca, arquivos) já estão no Appwrite? Em quais coleções? | Define se a Fase 2 é só reorganizar dentro do Appwrite ou também importar |
| P5 | Login: conta de e-mail e senha do Appwrite? Existe controle de equipe por agência (Teams)? | Define o modelo de permissões |
| P6 | O CRM atende só a OSV ou outras agências também (multiagência, com acesso pela Hotmart, decisão D5 do plano anterior)? | Define se cada agência é um Team, e a cota de IA |
| P7 | As decisões D1 a D6 do plano anterior continuam valendo? (skills de guia; IA por gateway com chave no servidor; Asaas desligado; acesso pela Hotmart) | Este plano supõe que sim (seção 2) |
| P8 | Os arquivos de referência das skills (`METODO-OSV.md`, `REGRAS-GUIA-GENERICO.md`, `REGRAS-DE-CONTEUDO.md`, skill `roteiro-osv` com `site.py`, `parceiros.json`, `CONTEXTO-OSV.md`) | Sem eles a geração do guia (Fase 11) não fecha |
| P9 | Modelo de contrato e textos reais de termos (incluso, não incluso, responsabilidades, assistência) | Os textos do protótipo são ponto de partida e precisam de revisão jurídica |

### 1.4 Respostas da Fase 0 (25/11/2026)

Verificado no repositório `mmwork2040/mapadoviajante_pro` e no servidor. Detalhes em `inventario-appwrite.md`.

| # | Resposta | Situação |
|---|---|---|
| P1 | **Sim, é o `mmwork2040/mapadoviajante_pro`**, branch `main`. Ele já roda no Appwrite por uma camada de consultas (`src/integrations/appwrite/`). Toda a execução acontece nele; este plano, o protótipo, a identidade e as skills foram copiados para `docs/` | Respondida |
| P2 | Servidor próprio `https://appwrite.agenc-ia.net/v1` (versão 2.3.0). Projeto `6abdb8190017d98565f5`, banco `6abdb82f002c563b2ad3`, bucket `trip-attachments` | Respondida |
| P3 | **Vercel**, publicação automática pela branch `main` do GitHub. Domínio atual: `https://mapadoviajante-pro.vercel.app`. As funções de servidor rodam na Vercel, não em Functions do Appwrite | Respondida. Falta decidir se haverá domínio próprio |
| P4 | Os dados já estão no Appwrite, nas coleções `crm_*`, `agencies`, `agency_members` e `system_settings` (17 existem; `crm_lead_documents` e `agency_payment_settings` não existem). A Fase 2 é reorganizar dentro do Appwrite, sem importar de fora. Contagens em `inventario-appwrite.md` | Respondida |
| P5 | Login por conta do Appwrite: e-mail e senha, Google e recuperação de senha. **Não há Teams.** A equipe fica na coleção `agency_members`, com o campo `role` | Respondida |
| P6 | O código é multiagência (toda coleção tem `agency_id`, há tela de Plataforma para o super admin e cota de IA por agência). Falta o dono do produto confirmar se o produto continua multiagência e com acesso pela Hotmart | **Aberta** |
| P7 | D2 (chave de IA só no servidor, cota por agência) e D4 (Asaas desligado) já estão no código. D1 e D5 dependem de confirmação | **Aberta** |
| P8 | Só as duas skills de `docs/skills/` estão no repositório. Os arquivos de referência citados não estão | **Aberta** |
| P9 | Não há modelo de contrato nem textos jurídicos no repositório | **Aberta** |

Achados da Fase 0 que mudam o plano (detalhes em `inventario-appwrite.md` e na seção 17 de `FUNCOES-ATUAIS.md`):

- **O app atual tinha falhas de base na camada de dados** (relações ignoradas, arquivos com o mesmo código, campos que não cabiam). Foram corrigidas na Fase 0, antes de redesenhar as telas, e a lista está em `FUNCOES-ATUAIS.md`.
- **Segurança:** as coleções e o bucket estão fechados para visitantes. Continua aberto que qualquer usuário logado lê os dados de todas as agências (F2-T2).
- **Faltava no Appwrite** a coleção `crm_lead_documents` e mais espaço em seis campos de texto. Criados em 25/11/2026 pelo script `scripts/appwrite/estrutura-que-falta.mjs`, com aprovação. Foi só acréscimo.
- **Dados:** agências e membros repetidos, 19 fotos da Biblioteca sem arquivo e um roteiro com dias repetidos. A limpeza entra na migração da F2.
- O app usava a marca "MapaPRO" no menu e no login. A fase visual trocou pelo logo OSV com o rótulo "Consultoria", como no protótipo. Se o produto for vendido a outras agências (P6), a marca por agência vira tarefa da F10.

---

## 2. Decisões

| # | Decisão | Situação |
|---|---|---|
| A1 | **Backend único: Appwrite.** Banco, autenticação, arquivos, funções e tempo real. Remover Supabase e Lovable do código | Informado pelo dono do produto |
| A2 | **O protótipo é a especificação.** Visual, textos, fluxos e comportamentos seguem `docs/prototipo-crm/`. Divergência só com aprovação | Aprovado nesta sessão |
| A3 | **Identidade:** linha de sistema OSV (`docs/identidade/plataforma/osv-app.css`). Títulos em **League Spartan 700**, texto em Inter, tema escuro padrão com claro disponível, controles em pílula, laranja só em ação, seleção e progresso, um destaque (borda laranja) por tela, sem itálico | Aprovado (fonte em bold: 24/11) |
| A4 | **Estrutura do produto:** duas áreas centrais. **Viajantes** é a base de pessoas, com famílias e grupos e todas as viagens de cada pessoa. **Viagens** é um único registro que nasce na negociação e vai até a volta, com as fases **Comercial** e **Preparação e viagem**. Não existe área separada de "Vendas" nem de "Clientes" | Aprovado |
| A5 | **Cargos:** Comercial, Consultoria, Gerente e Administrador (a tabela de permissões está na especificação de Equipe). Uma pessoa pode acumular cargos | Aprovado |
| A6 | **Modos de visualização** que cada pessoa escolhe e o sistema lembra **na conta**: Viagens Comercial (Quadro/Lista), Preparação (Lista/Capas/Quadro), Viajantes (Pessoas/Famílias e grupos/Lista e perfil), Agenda (Lista/Semana/Mês), Biblioteca (Capas/Lista) | Aprovado |
| A7 | **IA sempre com revisão:** o que a IA cria (Biblioteca, roteiro, checklist, guia) entra como rascunho e passa pela consultora antes de chegar ao cliente. **Um único Assistente** por viagem substitui as quatro entradas de IA atuais | Aprovado |
| A8 | **Proposta → Contrato → Pagamento → Roteiro e guia** é a jornada comercial padrão, com termos por tipo de serviço, pré-preenchidos e editáveis por proposta | Aprovado |
| A9 | **Nenhuma função se perde.** Tudo o que o app atual faz entra no desenho novo, adaptado à nova identidade e ao novo formato (Viajantes, Viagem única, Agenda, Assistente). A lista de funções de hoje e o destino de cada uma está em `FUNCOES-ATUAIS.md`. Uma função só sai com aprovação registrada nessa lista | Decidido pelo dono do produto (25/11/2026) |
| D1 a D6 | Do plano anterior: skills de guia (D1); IA por gateway com chave só no servidor e cota por agência (D2); Asaas desligado por enquanto (D4); acesso comprado na Hotmart e liberado pelo super admin (D5). D3 está resolvida por A3. D6 (onde roda o servidor) vira P3 | Confirmar em P7 |

---

## 3. Arquitetura alvo

```
Navegador (React, TanStack Router, identidade OSV)
   │  SDK web do Appwrite: sessão do usuário, leitura, gravação com permissão, tempo real
   ▼
Appwrite (appwrite.agenc-ia.net)
   ├─ Auth: contas e sessões; Teams = agências (papéis do team = cargos)
   ├─ Databases: banco "crm" com as coleções do MODELO-DE-DADOS-APPWRITE.md
   ├─ Storage: documentos, biblioteca, capas, contratos, guias
   ├─ Functions (Node, chave de API do servidor):
   │    ia-assistente, ia-ler-pdf, gerar-guia, assinar-contrato, links-publicos,
   │    hotmart-webhook, n8n-entrada, notificacoes, datas-automaticas, migracao
   └─ Realtime: viagens, agenda e notificações ao vivo
```

Regras de arquitetura:

1. **Chaves nunca no navegador.** Chave de IA, chave de API do Appwrite, tokens do Gmail e Drive, e o hottok da Hotmart ficam só nas Functions (variáveis de ambiente).
2. **Permissão no documento, por agência.** Todo documento tem `agencyId` e permissões `Role.team(agencyId)` para leitura. A gravação segue o cargo (`Role.team(agencyId, "admin")` e assim por diante). Ações sensíveis passam por Function, que confere o cargo.
3. **Uma camada de serviços tipada** (`src/data/`) é o único lugar que fala com o Appwrite: um arquivo por domínio, com tipos gerados a partir do esquema. As telas não chamam o SDK direto.
4. **Páginas públicas** (proposta, contrato, roteiro do cliente, formulário de captação) leem por token de compartilhamento, por meio de Function. Nunca abrem a coleção para visitantes.
5. **Tempo real** só onde ajuda: contadores do menu, quadro de Viagens e sino de notificações.

---

## 4. Fases

Cada fase vira uma ou mais sessões e um ou mais pull requests. A ordem respeita as dependências. As fases de tela (3 a 10) só começam depois da 1 e da 2.

```
F0 Descoberta e base ─► F1 Design system ─► F2 Dados no Appwrite ─┬─► F3 Viajantes
                                                                  ├─► F4 Viagens · Comercial ─► F5 Proposta, contrato, pagamento
                                                                  ├─► F6 Viagens · Preparação e página da viagem
                                                                  ├─► F7 Agenda ─► F8 Hoje
                                                                  ├─► F9 Biblioteca (IA e PDF)
                                                                  └─► F10 Gestão
F11 IA, Assistente e skills de guia (depois de F6 e F9)
F12 Telas do cliente final (depois de F5 e F11)
F13 Segurança, acesso e super admin (as tarefas críticas entram já na F0 e na F2)
F14 Qualidade, migração final e lançamento
```

### F0 · Descoberta e base (1 sessão)

**Objetivo:** saber exatamente o que existe e deixar o projeto rodando só no Appwrite.

- F0-T1 Responder P1 a P9 com o dono do produto. Registrar as respostas na seção 1.3.
- F0-T2 Ler o esquema real do Appwrite: bancos, coleções, atributos, índices, buckets, functions e Teams. Gerar `docs/migracao/inventario-appwrite.md` com a tabela "coleção atual → coleção alvo" (o modelo alvo está em `MODELO-DE-DADOS-APPWRITE.md`).
- F0-T3 No repositório do app (P1): `grep -ri "supabase\|lovable"` e listar todo ponto que ainda aponta para fora do Appwrite. Corrigir ou abrir tarefa para cada um. Remover pacotes, plugins, variáveis e arquivos do Supabase e do Lovable.
- F0-T4 Configurar `.env.example` só com variáveis do Appwrite (`VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_DATABASE_ID`) e as do servidor (fora do git).
- F0-T5 Garantir que `npm run build` e `npx tsc --noEmit` passam. Criar CI simples (build e typecheck por pull request).
- F0-T6 Levar para o repositório do app a fase visual já feita aqui (commit `9befff1`): `src/styles.css`, `PageHeader`, `ViagensTabs`, `AppLayout`, `ui/button`, `ui/input`, `ui/select`, `lib/ui.ts`, os logos em `src/assets/osv-logo-*.svg` e a fonte em `__root.tsx`. Se o código divergiu, refazer a partir do diff.
- F0-T7 Copiar `docs/prototipo-crm/`, `docs/identidade/`, `docs/skills/` e `docs/migracao/` para o repositório do app, se for outro.

**Pronto quando:** o app abre, faz login pelo Appwrite e não tem nenhuma chamada a outro backend; existe o inventário do Appwrite.

### F1 · Design system em código (1 a 2 sessões)

**Objetivo:** todos os blocos do protótipo existem como componentes React reutilizáveis, nos dois temas, antes de redesenhar as telas.

- F1-T1 Tokens: portar as variáveis de `docs/identidade/plataforma/osv-app.css` (seção 1) para `src/styles.css` nos dois temas. Mapear para os nomes do shadcn (`--background`, `--primary`...) e criar os que faltam (`--surface-raised`, `--accent-text`, `--done`, `--warn`, `--glow-*`, `--glass`). A base já está no commit `9befff1`.
- F1-T2 Tipografia: League Spartan 700 em títulos e números grandes; Inter no resto; rótulo em Inter 600, 10,5 px, caixa alta (`.mono` do protótipo); números tabulares.
- F1-T3 Componentes (cada um com os estados normal, hover, foco, desabilitado e carregando, nos dois temas):
  - Base: `Button` (principal, contorno, link; pílula); `IconButton`/`Mini` (44 px no celular); `Chip` (estado ok, now, warn, bad, info; filtro com `aria-pressed`); `Seg` (seletor segmentado); `Tabs` (sublinhado com luz); `Field` (rótulo sempre visível, campo em pílula, texto longo com raio 18); `Switch`; `Tick` (círculo de concluir); `Avatar`; `Progress` (barra fina com luz no andamento, verde sem luz no concluído).
  - Estrutura: `SectionHeader` (título com o fio que corre até a ação); `Card` (nível 2); `HighlightCard` (nível 3, só borda laranja, um por tela); `Glass`; `PhotoHero` (foto com véu e card flutuante); `KpiRow`; `Empty` (tracejado só para espaço vazio); `Skeleton`.
  - Sobreposições: `SidePanel` (painel lateral da ficha); `Dialog`/`Janela` (formulários curtos, tela cheia no celular); `CreateSheet` (menu Criar); `Toast` (aviso curto).
  - Dados: `ViewSwitcher` (ícone e nome; grava a preferência na conta, A6); `JourneySteps` (as quatro etapas da jornada); `Funnel` (barras do funil); `Timeline`/`History`; tabela com ordenação que vira lista no celular; gráficos de colunas, barras horizontais, barra segmentada e medidor.
- F1-T4 Casca do app: menu agrupado com contadores; barra de topo com busca global (Ctrl K), tema, sino e **Novo**; barra inferior do celular com o **+** laranja no centro; menu Criar (Nova viagem, Nova pessoa, Nova tarefa, Novo compromisso).
- F1-T5 Página interna `/dev/ui` com todos os componentes nos dois temas, para revisão visual. Usar o próprio protótipo como gabarito.
- F1-T6 Ícones: Phosphor (regular; preenchido só em alvos pequenos), como na identidade. Pode manter o lucide durante a transição, mas trocar tela a tela.

**Pronto quando:** `/dev/ui` reproduz os blocos do protótipo lado a lado, nos dois temas e a 390 px.

### F2 · Dados no Appwrite (2 a 3 sessões)

**Objetivo:** o modelo de dados novo existe, com permissões, e os dados atuais estão nele.

- F2-T1 Criar ou ajustar as coleções, atributos, índices e relacionamentos de `MODELO-DE-DADOS-APPWRITE.md`, por script versionado (`scripts/appwrite/schema.ts`, idempotente, com o SDK de servidor). Nada criado à mão no console.
- F2-T2 Permissões por agência (Teams) e cargos (seção 3, regra 2). Testar com quatro usuários, um de cada cargo.
- F2-T3 Buckets (documentos, biblioteca, capas, contratos, guias), com limite de tamanho, tipos permitidos e permissões por agência.
- F2-T4 Camada `src/data/`: um módulo por domínio (`people`, `households`, `trips`, `travelers`, `days`, `items`, `checklist`, `expenses`, `documents`, `history`, `agenda`, `proposals`, `contracts`, `payments`, `library`, `templates`, `settings`, `team`, `notifications`), com tipos, paginação, busca e tratamento de erro **sem falso sucesso**. TanStack Query por cima.
- F2-T5 Migração dos dados atuais (se P4 confirmar que existem): Function `migracao` idempotente. Clientes viram pessoas titulares; membros da família viram pessoas da mesma família; vendas e roteiros viram uma viagem com fase; tarefas viram agenda; atividades e notas viram histórico; checklists e gastos são ligados à viagem. Relatório de contagem antes e depois. Regras na seção 6 do modelo de dados.
- F2-T6 Dados de exemplo (seed) iguais aos do protótipo, num projeto ou banco de teste, para desenvolvimento e demonstração.
- F2-T7 Tempo real: inscrições para viagens, agenda e notificações.

**Pronto quando:** cada cargo vê e grava só o que deve; a migração roda duas vezes sem duplicar; as contagens batem.

### F3 · Viajantes (1 a 2 sessões)

Especificação: `ESPECIFICACAO-TELAS.md` § Viajantes.
- F3-T1 Lista com os três modos (Pessoas, Famílias e grupos, Lista e perfil), busca e filtros (Todos, Em negociação, Viajam em breve, Documento pendente).
- F3-T2 Perfil da pessoa: viagens (todas, com fase), família ou grupo, acesso ao app (convidar e reenviar), documentos, preferências e aniversário.
- F3-T3 Nova pessoa (com família ou grupo e relação) e criação de família ou grupo.
- F3-T4 **Planejar viagem** a partir da pessoa ou da família: escolhe quem vai a partir da base e cria a viagem na fase Comercial.
- F3-T5 Convite para o app do viajante (o estado do acesso fica gravado; a tela do viajante é a F12).

### F4 · Viagens · Comercial (2 sessões)

Especificação: § Viagens · Comercial e § Ficha da viagem (comercial).
- F4-T1 Abas da área Viagens (Comercial, Preparação e viagem) e o seletor Quadro/Lista.
- F4-T2 Quadro em cinco colunas (Novo, Contatado, Negociando, Fechado, Perdido), com arrastar e soltar, total por coluna e o cartão completo (destino, valor ou "A definir", quem vai, datas, próximo passo, dias sem contato a partir de 3).
- F4-T3 Lista ordenável (cliente, etapa, valor, dias sem contato).
- F4-T4 Filtros: busca, Minhas/Toda a equipe, Sem contato há 3+ dias, Arquivadas.
- F4-T5 Ficha em painel lateral: etapas clicáveis; **próximo passo obrigatório** (concluir pede o seguinte); contato rápido (WhatsApp, Ligar, E-mail, Registrar); abas Resumo, Histórico e Orçamento; jornada da proposta; **motivo obrigatório** ao perder; Reabrir; Criar viagem / Abrir viagem quando fechada.
- F4-T6 Nova viagem em formulário curto (quem vai a partir da base, contato, origem, destino, quando, passageiros, orçamento, próximo passo) e "Mais detalhes" opcional.
- F4-T7 Contadores e tempo real (badge do menu, mudança de etapa feita por outra pessoa).

### F5 · Proposta, termos, contrato e pagamento (2 a 3 sessões)

Especificação: § Proposta, § Termos, § Proposta do cliente, § Contrato e pagamento.
- F5-T1 Editor da proposta: abertura (mensagem, datas, capa da Biblioteca); opções (itens, valor, economia, recomendada, "Completar com a biblioteca"); pagamento e validade; **prévia ao vivo**.
- F5-T2 **Termos por tipo de serviço** (Só passagem aérea, Passagem e hospedagem, Pacote completo, Consultoria de roteiro): incluso, não incluso, responsabilidades do cliente e da OSV, assistência (nível, resumo e itens). Pré-preenchidos pelo modelo e editáveis por proposta, com selo Personalizado e Voltar ao padrão. Trocar o tipo pede confirmação.
- F5-T3 Modelos de proposta em Configurações (F10) e textos revisados (P9).
- F5-T4 Envio por link (WhatsApp, e-mail, copiar) e registro de visualização ("abriu 2x"). Histórico da proposta.
- F5-T5 Página pública da proposta: escolher a opção. A escolha gera o contrato.
- F5-T6 Contrato: cláusulas a partir dos termos e do modelo de contrato (P9); assinatura digital simples (nome digitado, aceite, data e hora, IP e versão do documento, guardados na Function); cópia por e-mail. **Ao assinar, a viagem vai para Fechado.**
- F5-T7 Pagamento: com o Asaas desligado (D4), registrar a forma escolhida e o recebimento manual pela equipe. Deixar a interface pronta para ligar um meio de pagamento depois.
- F5-T8 Jornada nas quatro etapas visível na ficha da viagem e na página da proposta.

### F6 · Viagens · Preparação e página da viagem (3 sessões)

Especificação: § Preparação e viagem e § Página da viagem.
- F6-T1 Lista agrupada por quando embarca, Capas e Quadro de preparação (Montando roteiro, Com o cliente, Emitindo, Pronta para embarcar, Em viagem). Alertas no cartão ("seguro vence hoje").
- F6-T2 Página da viagem: foto do destino com card de embarque (dias, checklist, Enviar ao cliente, PDF); abas Roteiro, Checklist, Financeiro, Documentos e Guia.
- F6-T3 Roteiro: dias na lateral; linha do tempo por horário; itens tipados (voo, hospedagem, atividade, transfer, restaurante) com campos próprios (voo: companhia, número, origem, destino, terminal, horários e bagagem; hospedagem: nome, endereço, check-in e check-out; ingresso: local e quando fica disponível); situação Reservado ou Pendente; edição em painel; adicionar por tipo; dia livre; incluir e duplicar dia.
- F6-T4 Checklist por seções, aplicado a partir do modelo, com prazos e contador ao vivo.
- F6-T5 Financeiro da viagem: orçamento, gasto, economia com milhas e gastos com a forma de pagamento.
- F6-T6 Documentos: lista, upload (soltar arquivos), prévia e download.
- F6-T7 Enviar ao cliente: link público com token, copiar, WhatsApp e PDF.

### F7 · Agenda (1 a 2 sessões)

Especificação: § Agenda.
- Lista (Atrasadas, Hoje, Amanhã, Esta semana, Mais adiante), Semana (7 colunas, + por dia) e Mês (calendário; pontos no celular).
- Filtros: Minha/Toda a equipe; Tudo, Tarefas, Contatos, Datas automáticas.
- **Datas automáticas** (Function agendada): aniversários, passaporte vencendo, embarques e itens do checklist com prazo.
- Concluir na linha, atalho para a viagem, formulário "Novo na agenda", lembrete.

### F8 · Hoje (1 sessão)

Especificação: § Hoje.
- Saudação e resumo; destaque "Comece por aqui" (o item mais urgente); números do mês; agenda do dia; negociações sem resposta; funil; próximos embarques com o checklist.

### F9 · Biblioteca (2 sessões)

Especificação: § Biblioteca.
- Capas e Lista; filtros por tipo; ficha do item com **Usar em uma viagem**.
- **Criar com IA** (descrição, tipo, duração, perfil, usar a biblioteca, jeito OSV) e **Criar a partir de PDF** (enviar, ler, separar dias, experiências e fotos). As duas passam por **revisão** com pontos a conferir, e podem ser salvas como rascunho ou na biblioteca.
- Origem e uso de cada item; o conteúdo alimenta o Assistente.

### F10 · Gestão (2 sessões)

Especificação: § Financeiro, § Equipe e § Configurações.
- Financeiro: números com período, **A receber**, gráfico de 6 meses, por consultora, despesas por tipo, lançamentos filtráveis, ocultar valores, nova transação.
- Equipe: pessoas, cargos, desempenho, convite com o cargo explicado, passar viagens para outra pessoa, bloquear e remover, e a tabela de permissões.
- Configurações: agência e marca; **modelos de checklist** com editor por item (sem texto com símbolos); **modelos de proposta** (termos por tipo de serviço); Assistente de IA (provedor, modelo, chave no servidor, orientações); integrações (Gmail, Google Drive, WhatsApp, Asaas desligado, n8n, webhook); formulário de captação (perguntas, distribuição das novas viagens); notificações (app e e-mail por evento).

### F11 · IA, Assistente e skills de guia (3 a 4 sessões)

- F11-T1 Function `ia-assistente` com a chave só no servidor, cota por agência (D2) e registro de uso.
- F11-T2 **Assistente único na viagem:** completar dias vazios, ler documento, comparar hospedagens e revisar o que falta. A resposta entra como rascunho.
- F11-T3 Skills dentro do sistema (coleção `skills`, com versão), começando por `guia-osv-diagramacao` (guia de cliente) e `guia-osv-completo`. Detalhes no plano anterior, Fase 4 (briefing da viagem, catálogo por destino, links de parceiros com prefixo, validações em código, proposta de roteiro para aprovação).
- F11-T4 Aba **Guia** da viagem: gerar o guia no padrão OSV a partir do roteiro, checklist e documentos, com a lista de lacunas, a revisão e o envio. Exportação no formato do gerador `roteiro-osv` (P8).
- F11-T5 Catálogo por destino e links de parceiros (`gyg:`, `trip:`, `parceiro:`) resolvidos no servidor.
- F11-T6 Avaliação com 8 a 10 casos reais e verificação automática (dias, datas, moeda, links, mapas, nenhuma pendência no texto do cliente, nenhum número de documento).

### F12 · Telas do cliente final (2 sessões)

- Página pública da proposta, do contrato e do pagamento (F5); roteiro e guia por link com token, revogável; formulário de captação "Planejar minha viagem" que cria a viagem em Novo; **app do viajante** (login da pessoa convidada em Viajantes, com as viagens dela, o roteiro, os documentos e o guia no celular).

### F13 · Segurança, acesso e super admin (distribuída)

Adaptar ao Appwrite a Fase 0 do plano anterior:
- Permissões revisadas por cargo (F2-T2), com testes automáticos.
- Convites de equipe por Team do Appwrite.
- Acesso pela Hotmart (webhook em Function) e painel do super admin para liberar, bloquear e definir a cota de IA (D5).
- Segredos só em Functions; Google Drive e Gmail com tokens no servidor; webhook do n8n com assinatura.
- Links públicos sempre por token, revogáveis, sem custos internos nem números de documento.

### F14 · Qualidade, migração final e lançamento (1 a 2 sessões)

- Testes: camada `src/data/` (unidade), fluxos críticos de ponta a ponta com Playwright (criar viagem → proposta → contrato → fechado → roteiro → guia).
- Acessibilidade: foco visível, alvo de 44 px, `aria-label` em ícones, contraste nos dois temas, "reduzir movimento".
- Desempenho: paginação, imagens otimizadas, sem rolagem lateral a 390 px.
- Migração final de produção com relatório, janela combinada e plano de volta.
- Treinamento rápido da equipe (vídeo curto por área) e limpeza do código antigo.

---

## 5. Definição de pronto (toda tarefa)

- [ ] Igual ao protótipo na tela correspondente, nos **dois temas** e a **390 px** (comparar lado a lado).
- [ ] Regras da identidade: um botão laranja por bloco, um destaque por tela, sem itálico, sem pontilhado (só no espaço vazio), títulos em League Spartan 700.
- [ ] Toda função de `FUNCOES-ATUAIS.md` ligada a esta tela continua funcionando no formato novo, e a linha dela está marcada como feita (A9).
- [ ] Dados reais do Appwrite pela camada `src/data/`. Nenhum dado inventado na interface, e o que falta aparece como estado vazio.
- [ ] Estados de carregamento, vazio e erro tratados. Nenhum "sucesso" sem a gravação ter dado certo.
- [ ] Permissão conferida para cada cargo.
- [ ] `npx tsc --noEmit` e `npm run build` sem erros novos.
- [ ] Pull request pequeno, com prints antes e depois e o que foi testado à mão.

## 6. Riscos e como lidar

| Risco | Como lidar |
|---|---|
| O repositório do Appwrite divergiu deste | F0 decide a base. A fase visual daqui é levada por diff, não por merge cego |
| Migração de dados incompleta | Function idempotente, contagens antes e depois, ensaio em cópia do banco |
| Permissão errada expõe dados de outra agência | Testes com quatro cargos e duas agências antes de cada pull request de dados |
| IA inventa conteúdo para o cliente | Tudo como rascunho, catálogo verificado, validações em código (F11) |
| Escopo grande demais por sessão | Uma fase (ou uma tarefa grande) por sessão, um pull request por tarefa |
| Textos jurídicos (termos e contrato) sem revisão | P9 antes de liberar a proposta ao cliente |
