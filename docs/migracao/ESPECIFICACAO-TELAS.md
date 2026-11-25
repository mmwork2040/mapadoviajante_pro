# Especificação das telas · CRM OSV

Fonte: o protótipo aprovado em `docs/prototipo-crm/` (abrir `index.html`). Para cada tela abaixo há o arquivo do protótipo e a rota dele (`#rota`). **Em caso de dúvida, vale o protótipo.** Textos de interface: usar os do protótipo.

Regras que valem para todas as telas:
- **Visual:** dois temas (escuro é o padrão); a 390 px, nada de rolagem lateral; foco visível; alvo de toque de 44 px; ícone sozinho sempre com `aria-label`; "reduzir movimento" respeitado.
- **Identidade:** um botão laranja por bloco; um destaque (borda laranja) por tela; laranja só em ação, seleção e progresso; verde é concluído e vermelho é atraso ou erro (sempre com ícone e texto).
- **Termos:** **Viagem** é o registro único, da negociação à volta; **Viajante** é a pessoa; **Família ou grupo** reúne pessoas; **Proposta**, **Contrato** e **Guia** são as etapas. Não usar "lead", "venda" nem "cliente" na interface.
- **Modos de visualização:** o seletor fica no fim da barra de filtros, com ícone e nome (só ícone no celular). A escolha fica gravada na conta.
- **Dados:** todo valor vem do Appwrite. Se falta, mostrar estado vazio ou "A definir", nunca um número inventado.

---

## Casca do app (`js/app.js`, `index.html`, `crm.css`)

- **Menu lateral (248 px):**
  - Logo oficial, com a versão clara ou escura conforme o tema, e o rótulo "Consultoria".
  - Grupos: **Trabalho** (Hoje, Viagens, Viajantes, Agenda), **Recursos** (Biblioteca) e **Gestão** (Financeiro, Equipe, Configurações), com os itens de gestão só para quem tem permissão.
  - Contadores: em Viagens, as viagens novas, com destaque; em Agenda, os itens de hoje.
  - Rodapé com o avatar, o nome e o cargo, que levam a Minha conta.
- **Barra de topo:** busca global (viajante ou viagem, atalho Ctrl K), botão de tema, sino com o ponto de novidade e **Novo** com contorno, que abre o menu Criar.
- **Menu Criar:** Nova viagem (começa pela negociação), Nova pessoa, Nova tarefa e Novo compromisso.
- **Celular (< 900 px):** o menu lateral some e entra a barra inferior de vidro com Hoje, Viagens, **+** laranja ao centro, Viajantes e Agenda.
- **Painel lateral (580 px):** usado pelas fichas. Fecha com Esc, com o X ou clicando no véu.
- **Janela:** usada pelos formulários curtos. No celular ocupa a tela cheia.
- **Aviso curto:** aparece embaixo, no centro, por 2,6 s.

## Hoje (`js/hoje.js`, `#hoje`)

1. Data em rótulo, título "Bom dia, {nome}" e o resumo "Você tem N compromissos hoje e M atrasados".
2. **Destaque "Comece por aqui":** o item mais urgente (atrasado ou de maior valor), com o motivo e **Abrir**, que abre a ficha da viagem.
3. **Números do mês**, cada um com rótulo, valor e variação: vendido no mês (comparado ao mês anterior); em negociação (valor, quantidade e total de viagens abertas); conversão em 90 dias; embarques em 60 dias (e quantos dias faltam para o próximo).
4. **Agenda do dia** (Hoje, Amanhã e Semana com contagem): hora pendurada, tipo, título, viajante e viagem, chips Atrasada e Feito, e as ações WhatsApp e Concluir na linha.
5. **Negociações sem resposta:** tabela com viajante, destino, etapa, valor e dias sem contato (vermelho a partir de 5), com WhatsApp. A linha abre a ficha.
6. **Seu funil:** etapas com quantidade, valor e barra (o Perdido fica em cinza).
7. **Próximos embarques:** foto, viajantes, destino, datas, barra do checklist (feitos de total) e dias que faltam. Abre a viagem.

## Viagens · Comercial (`js/vendas.js`, `#vendas`)

- **Cabeçalho:** título "Viagens", o resumo "{N} em negociação · R$ X em jogo" e **Nova viagem**. Abaixo, as abas **Comercial · N** e **Preparação e viagem · N**.
- **Filtros:** busca por viajante ou destino; Minhas / Toda a equipe; o chip "Sem contato há 3+ dias"; Arquivadas; e o seletor **Quadro / Lista**.
- **Quadro:** cinco colunas, Novo, Contatado, Negociando, Fechado e Perdido (a de Perdido é mais estreita e compacta).
  - Cabeçalho da coluna: quantidade e valor total.
  - Arrastar o cartão muda a etapa e mostra o aviso "Viajante: etapa → etapa". Soltar em Perdido pede o motivo.
  - **Cartão:** destino; valor (ou "A definir"); viajante e datas; próximo passo com data (vermelho com ícone se atrasado); dias sem contato (amarelo a partir de 3, vermelho a partir de 5); avatar do responsável. Fechado mostra "Viagem criada"; Perdido mostra o motivo.
  - A coluna vazia mostra a área tracejada "Arraste uma viagem para cá".
  - No celular, as colunas deslizam para o lado, e a etapa se troca pela ficha.
- **Lista:** tabela com viajante, destino e datas, etapa, valor, próximo passo e dias sem contato. Ordena ao clicar em Viajante, Etapa, Valor ou Sem contato. A linha abre a ficha.
- **Nova viagem (janela):**
  - Campos: quem vai viajar (busca na base, ou um nome novo, que cria a pessoa); WhatsApp; como chegou; destino; quando; passageiros; orçamento estimado; **próximo passo** (obrigatório, com quando fazer).
  - "Mais detalhes (opcional)": tipo de viagem, saída de, milhas e pontos, observações.
  - **Criar viagem** cria em Novo e mostra o aviso.

## Ficha da viagem, fase comercial (painel lateral, `js/vendas.js` › `ficha`)

1. Rótulo "Viagem · fase comercial · criada em {data} · {origem}" e o botão de fechar.
2. Nome do viajante ou da família, destino, datas e passageiros, e o valor com "orçamento do cliente".
3. **Etapas clicáveis:** Novo, Contatado, Negociando e Fechado, com as anteriores marcadas como feitas e a atual em laranja. Abaixo, "Marcar como perdida".
4. **Destaque do próximo passo:** o texto, a data (atrasado em vermelho), **Concluir e definir o próximo** e Reagendar. Na viagem fechada, o destaque vira "Criar viagem" ou "Abrir viagem".
5. **Proposta, contrato e guia:** as quatro etapas da jornada e o link para a página da proposta.
6. **Contato rápido:** WhatsApp, Ligar, E-mail e Registrar.
7. **Abas:**
   - **Resumo:** dados da viagem (destino, saída, quando, passageiros, tipo, preferências); dados do viajante (WhatsApp, e-mail, passaporte com a situação) e o link "Abrir na base de viajantes"; milhas e benefícios em barras por programa.
   - **Histórico · N:** registro com o seletor WhatsApp, Ligação, E-mail, Reunião e Observação, mais o texto e o botão Registrar. Abaixo, a linha do tempo, com o atraso em vermelho. Registrar zera os dias sem contato.
   - **Orçamento:** quanto o cliente trouxe e a proposta da OSV, com a economia; o medidor de uso do orçamento; e a tabela de itens com a forma de pagamento.
8. **Perder:** janela com o motivo obrigatório (preço acima do esperado, fechou com outra agência, adiou a viagem, não respondeu mais, outro). A ficha mostra "Viagem perdida" com o motivo e **Reabrir**.

## Proposta (consultora) (`js/proposta.js`, `#proposta`)

- **Cabeçalho:** voltar para "Viagens · comercial", o rótulo "{viajante} · {destino} · {etapa}", o título "Proposta, contrato e guia" e a **jornada em quatro etapas**, com o estado de cada uma (rascunho, visualizada Nx, aceita; aguardando assinatura, assinado; entrada recebida; montar com a skill de guias).
- **Coluna principal:**
  - Destaque "Proposta aceita" quando houver aceite, com a próxima ação (Enviar contrato, Ver como cliente ou Montar guia).
  - **Abertura:** mensagem para o cliente (atualiza a prévia enquanto digita); datas; foto da capa (escolher na Biblioteca).
  - **Opções:** nome, subtítulo, número de itens, economia e valor; recomendada; Editar itens; Completar com a biblioteca; incluir opção.
  - **Termos da proposta:** veja abaixo.
  - **Pagamento e validade:** formas oferecidas (Pix com desconto, cartão em 10x, entrada mais parcelas) e "valores garantidos até".
- **Coluna lateral (fixa):** prévia ao vivo "Como o cliente vê"; Abrir como cliente; **Enviar proposta** (link, e-mail e WhatsApp); e o histórico (enviada, abriu Nx, aceita, contrato enviado, assinado).

## Termos da proposta (`js/termos.js`)

- **Tipo de serviço:** Só passagem aérea, Passagem e hospedagem, Pacote completo ou Consultoria de roteiro. O tipo preenche as cinco seções com o modelo.
- **Seções** (recolhíveis, com contagem e o selo **Padrão** ou **Personalizado**): O que está incluso, O que não está incluso, Responsabilidades do cliente, Responsabilidades da OSV e Assistência (nível, resumo e itens).
- Itens editáveis no próprio campo; incluir e remover item; **Voltar ao padrão** por seção. A mudança vale só para a proposta.
- **Trocar o tipo** depois de personalizar pede confirmação antes de substituir.
- Os textos padrão de cada tipo ficam em Configurações › Modelos de proposta.

## Proposta do cliente (`#proposta-cliente`, página pública, sem menu)

- Topo com o logo e "Proposta para {nome}". Capa com o destino, "Sua próxima viagem", título, datas, noites e viajantes.
- Mensagem da consultora, com a assinatura.
- **Escolha a sua opção:** cartões lado a lado (empilhados no celular), cada um com os itens, o valor para todos, a economia com milhas e **Quero a opção X**. A recomendada tem a borda laranja.
- **O que você precisa saber:** o nível de assistência em destaque; Está incluso e Não está incluso; O que fica com você e O que fica com a gente.
- Como pagar e Bom saber (validade, segurança, WhatsApp da consultora).
- Depois do aceite: destaque "Próximo passo: assinar o contrato".

## Contrato e pagamento (`#contrato-cliente`, página pública)

- A jornada em quatro etapas. "Contrato de prestação de serviços de viagem" com o destino e a opção.
- Dados: contratante (documento mascarado), agência, valor total e o que inclui.
- **Cláusulas** recolhíveis, montadas a partir dos termos da proposta (serviços, não incluso, responsabilidades das duas partes, assistência, pagamento, cancelamento) mais o texto jurídico do modelo.
- **Assinatura:** nome digitado, "Li e concordo" e **Assinar contrato**. Depois: "Contrato assinado por {nome}", com data e hora e a cópia por e-mail. **A viagem vai para Fechado.**
- **Pagamento:** Pix à vista, cartão em 10x ou entrada mais o restante, e **Pagar com segurança**. Depois: "Entrada recebida. Agora é com a gente." Com o Asaas desligado (D4), a equipe registra o recebimento à mão.

## Viagens · Preparação e viagem (`js/viagens.js`, `#viagens`)

- **Cabeçalho:** "Viagens", o resumo das fechadas e em preparação e o próximo embarque, e as abas.
- **Filtros:** busca, Minhas / Toda a equipe e o seletor **Lista / Capas / Quadro**.
- **Lista:** grupos Em viagem agora, Embarcam em 30 dias, Mais adiante e Concluídas. Cada linha tem foto, destino, viajantes, datas e pessoas; o alerta em vermelho; a situação do roteiro (Aprovado, Enviado ao cliente, Em montagem, Concluída); a barra do checklist; e os dias que faltam ("Dia N de M" durante a viagem).
- **Capas:** galeria 4:3 com o selo da situação, os dias sobre a foto e a barra do checklist colada na base. Filtro Próximas, Em viagem e Concluídas. A capa sobe 6 px no hover.
- **Quadro:** Montando roteiro, Com o cliente, Emitindo, Pronta para embarcar e Em viagem, com cartões que mostram foto, dias, checklist e alerta.

## Página da viagem (`js/viagem.js`, `#viagem`)

- **Topo:** voltar; foto do destino com véu; selo de situação ("Roteiro aprovado pela família"); título; viajantes, datas, noites e pessoas; link para os viajantes.
- **Card de embarque:** dias que faltam, barra do checklist com o texto do que falta, **Enviar ao cliente** (link sem senha que sempre mostra a versão mais nova, Copiar, WhatsApp, PDF) e PDF.
- **Abas** Roteiro, Checklist · feitos/total, Financeiro, Documentos · N e Guia, com o botão **Assistente** à direita.
- **Roteiro:**
  - Dias na lateral (Dia N, data e número de itens ou "Livre") e "+ Dia". No celular, os dias ficam numa faixa que desliza.
  - Cabeçalho do dia: data, título e os botões dia anterior e próximo.
  - Linha do tempo: horário, ícone do tipo, rótulo do tipo, título, detalhes, selo Reservado ou Pendente e o valor.
  - Clicar no item abre o painel de edição: título, horário, valor, detalhes, "Reservado e confirmado", fotos e anexos, e Excluir.
  - "Adicionar ao dia" com Voo, Hospedagem, Atividade, Transfer e Restaurante. O dia vazio mostra "Dia livre" e **Sugerir o que fazer**.
- **Checklist:** barra com "N de M" e seções (Documentos, Reservas, Seguro e pagamentos, Antes do embarque). Cada item tem o círculo de concluir, o prazo (vermelho se vence hoje) e "+ Adicionar item". Marcar atualiza a aba e o card do topo.
- **Financeiro:** orçamento do cliente, gasto até agora (com o saldo) e economia gerada com milhas; o medidor de uso; e a tabela de gastos (item, pago com, valor e economia), com **Adicionar gasto**.
- **Documentos:** lista com o tipo, as páginas e o download, e a área "Solte arquivos aqui".
- **Guia:** o que o guia terá (roteiro dia a dia, voos e reservas, dicas da OSV, antes de embarcar, contatos) e **Gerar guia**, que usa a skill `guia-osv-diagramacao` no modo de guia de cliente, com revisão e lista de lacunas (F11).
- **Assistente (painel):** campo para perguntar (o único lugar com o brilho laranja) e os atalhos Completar dias vazios, Ler um documento, Comparar hospedagens e Revisar o que falta. Aviso: "Tudo que o assistente sugere entra como rascunho".

## Viajantes (`js/viajantes.js`, `#viajantes`)

- **Cabeçalho:** "Viajantes", o resumo "N pessoas em M famílias, grupos e individuais" e **Nova pessoa**.
- **Filtros:** busca por nome, família ou destino; Todos, Em negociação, Viajam em breve e Documento pendente; e o seletor **Pessoas / Famílias e grupos / Lista e perfil**.
- **Pessoas (tabela):** pessoa (com a relação e a idade), família ou grupo, o que está acontecendo agora (viagem e fase), número de viagens, passaporte (válido, vencendo, sem) e o acesso ao app. A linha abre o perfil.
- **Famílias e grupos (cartões):** tipo e número de pessoas, nome, os membros em pílulas (que abrem o perfil), a viagem em andamento com foto (ou "Nenhuma viagem em andamento"), o total de viagens, **Planejar viagem** e **Adicionar pessoa**.
- **Lista e perfil:** lista à esquerda e o perfil à direita:
  - Cabeçalho: família e relação, nome, idade e telefone, WhatsApp e **Planejar viagem**.
  - **Viagens:** todas as viagens da pessoa, com a fase.
  - **Família ou grupo:** as outras pessoas, que abrem o perfil delas, e "Adicionar pessoa".
  - **Acesso ao app do viajante:** a situação, a explicação e Convidar ou Reenviar.
  - **Documentos e preferências:** passaporte, CPF mascarado, aniversário e preferências.
- **Nova pessoa (janela):** nome completo, nascimento, família ou grupo (existente, nenhum ou criar novo), relação, WhatsApp (opcional para menores), passaporte e "Enviar convite para o app".
- **Planejar viagem (janela):** quem vai (a família já vem marcada, mais "Outra pessoa da base"), destino, quando, orçamento e responsável comercial. **Criar viagem** cria em Comercial › Novo, já com os viajantes.

## Agenda (`js/agenda.js`, `#agenda`)

- **Cabeçalho:** "Agenda", o resumo "N para hoje · M atrasadas · aniversários, passaportes e embarques entram sozinhos" e **Novo na agenda**.
- **Filtros:** Minha / Toda a equipe; Tudo, Tarefas, Contatos e Datas automáticas; e o seletor **Lista / Semana / Mês**.
- **Lista:** grupos Atrasadas (em vermelho), Hoje, Amanhã, Esta semana e Mais adiante. Cada linha tem a hora ou o dia, o tipo, o título, o viajante e a viagem, e os selos Atrasada e Prioridade alta. Ações: WhatsApp, abrir viagem e Concluir.
- **Semana:** sete colunas, com hoje em destaque e as atrasadas no topo de hoje. Os itens automáticos têm borda tracejada, e o "+" de cada dia cria um item naquela data.
- **Mês:** calendário com até dois itens por dia e "+N". Clicar no dia abre a lista dele com "Novo neste dia". No celular, os itens viram pontinhos.
- **Novo na agenda (janela):** tipo; o que fazer; quando; horário opcional; viajante ou viagem; prioridade; e "Lembrar 15 min antes".

## Biblioteca (`js/biblioteca.js`, `#biblioteca`)

- **Cabeçalho:** o texto "Tudo aqui pode ir para uma viagem e alimenta o Assistente".
- **Criar** (topo): **Criar com IA**, com o campo de pedido e três sugestões, e **Criar a partir de PDF**, com a área de soltar e escolher o arquivo.
- **Filtros:** busca; Tudo, Roteiros, Experiências, Pacotes e Documentos com contagem; e o seletor **Capas / Lista**.
- **Item:** capa, selo do tipo, selo Revisar (rascunho), título, destino e dias, origem (Lido de PDF, Criado com IA, Manual) e "usado em N viagens".
- **Ficha:** capa, título, meta, etiquetas, **Usar em uma viagem** (ou Baixar e Enviar ao cliente para documentos), Editar, os dias, "Para a IA" e o uso.
- **Criar com IA (janela):** o que criar; descrição; duração; perfil; "Usar experiências e hotéis que já estão na biblioteca" e "Seguir o jeito OSV". Em seguida, a tela de progresso e a **revisão**.
- **Criar a partir de PDF:** soltar ou escolher o arquivo, a tela de leitura ("Lendo as páginas, separando os dias, encontrando experiências e fotos") e a **revisão**.
- **Revisão** (as duas formas): o resumo do que foi encontrado; título e destino editáveis; os dias, com os pontos a conferir; e, no PDF, "Salvar também as N experiências separadas". Botões: Gerar outra versão (só IA), Salvar como rascunho e **Salvar na biblioteca**.

## Financeiro (`js/gestao.js`, `#financeiro`, só administrador)

- **Cabeçalho:** o selo Gestão, **Ocultar valores** e **Nova transação**.
- Período: mês, trimestre ou ano.
- **Números:** receita, comissões, despesas e lucro líquido, cada um com a variação.
- **Destaque "A receber":** total e quantidade de pendentes, o maior, e Ver pendentes.
- **Gráficos:** colunas com receita e comissões dos últimos 6 meses; barras por consultora; barra segmentada das despesas por tipo, com a legenda.
- **Lançamentos:** filtro Tudo, Receitas, Despesas e Pendentes; tabela com descrição, categoria, situação e valor (receita em verde).
- **Nova transação:** receita ou despesa, descrição, valor, categoria, viagem (opcional) e situação.

## Equipe (`js/gestao.js`, `#equipe`, só administrador)

- **Tabela:** pessoa, cargo, em negociação, fechadas no mês, último acesso e o menu de opções (mudar cargo, passar as viagens para outra pessoa, bloquear e remover). Convite pendente aparece com **Reenviar**.
- **Convidar pessoa:** e-mail e cargo, com a explicação de cada um: Comercial, Consultoria, Gerente e Administrador.
- **"O que cada cargo pode fazer":**

| Permissão | Comercial | Consultoria | Gerente | Administrador |
|---|---|---|---|---|
| Base de viajantes: cadastrar e consultar | ✓ | ✓ | ✓ | ✓ |
| Viagens · comercial: negociar, proposta e contrato | ✓ | — | ✓ | ✓ |
| Viagens · preparação: roteiro, checklist, documentos e guia | — | ✓ | ✓ | ✓ |
| Ver o trabalho de toda a equipe e reatribuir viagens | — | — | ✓ | ✓ |
| Financeiro da agência | — | — | — | ✓ |
| Equipe, configurações e integrações | — | — | — | ✓ |

## Configurações (`js/gestao.js`, `#config`, só administrador)

O menu de seções fica à esquerda (vira uma faixa que desliza no celular):
- **Agência e marca:** nome, CNPJ, WhatsApp, Instagram, logo (para o PDF e as páginas do cliente) e rodapé do PDF.
- **Modelos de checklist:** lista dos modelos (padrão, número de itens, uso). O editor trabalha por seção e item: editar, arrastar e remover, "+ Item em {seção}", Nova seção, **Sugerir itens com IA**, Definir como padrão e Salvar modelo.
- **Modelos de proposta:** os tipos de serviço, com o mesmo editor de termos (sem o selo Personalizado), e "Novo tipo de serviço".
- **Assistente de IA:** provedor, modelo, chave (guardada no servidor, nunca exibida) e as orientações no tom da OSV.
- **Integrações:** Gmail, Google Drive, WhatsApp, Asaas, n8n e Webhook, cada um com Conectado ou Desligado e Configurar ou Conectar.
- **Formulário de captação:** link para copiar; perguntas que ligam e desligam (nome e WhatsApp são obrigatórias); e a distribuição das viagens novas (rodízio, uma pessoa só ou a gerente distribui).
- **Notificações:** chave no app e por e-mail para cada evento (viagem nova chegou, tarefa vence hoje, viajante sem contato há 5 dias, embarque em 7 dias, pagamento confirmado).

## Telas que o protótipo ainda não desenhou (fazer no mesmo padrão)

- Minha conta (nome, cor do avatar, senha, tema e preferências de visualização).
- Notificações (lista, lidas e não lidas, marcar todas).
- Login, criar conta, aceitar convite e recuperar senha. O login atual já está no padrão (commit `9befff1`).
- Formulário público de captação "Planejar minha viagem".
- Roteiro e guia que o cliente abre pelo link.
- App do viajante (a pessoa convidada vê as viagens dela).
- Painel do super admin (agências, acesso pela Hotmart e cota de IA).
