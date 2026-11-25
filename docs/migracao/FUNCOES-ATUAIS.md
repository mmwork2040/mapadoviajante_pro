# Funções do app atual e o destino de cada uma

Decisão A9 do `PLANO-MESTRE.md`: **nenhuma função se perde.** Tudo o que o app faz hoje entra no desenho novo, adaptado à nova identidade e ao novo formato. Uma função só sai com aprovação registrada aqui.

Como usar:

- Levantamento feito em 25/11/2026 pela leitura do código (`src/`). Nada foi testado com dados reais; o que ficou em dúvida está marcado com "(conferir)".
- **Destino** é a tela do desenho novo (`ESPECIFICACAO-TELAS.md`) onde a função passa a morar. **Fase** é a fase do plano em que ela é refeita.
- Ao terminar uma tela, marque a coluna **Feito** de cada linha ligada a ela. A tela só está pronta quando todas as linhas dela estão marcadas.
- "Nova no desenho" na coluna Destino quer dizer que o protótipo não mostra a função. Ela continua valendo e precisa ser desenhada no mesmo padrão.

Fases citadas: F1 casca do app · F3 Viajantes · F4 Viagens Comercial · F5 Proposta e contrato · F6 Preparação e página da viagem · F7 Agenda · F8 Hoje · F9 Biblioteca · F10 Gestão · F11 Assistente e guia · F12 Cliente final · F13 Segurança e acesso.

---

## 1. Viagens · Preparação (hoje: lista de roteiros, `/roteiros`)

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Abas Comercial e Preparação | Alterna entre as vendas e as viagens | Abas da área Viagens | F4 | |
| Buscar viagem | Filtra por título, destino ou nome do cliente | Busca da barra de filtros | F6 | |
| Minhas / Todas | Admin e gerente alternam; os outros cargos veem só as suas | Minhas / Toda a equipe | F6 | |
| Quadro por status | Quatro colunas: Rascunho, Em andamento, Concluído, Cancelado, com contador | Quadro de preparação (Montando roteiro, Com o cliente, Emitindo, Pronta para embarcar, Em viagem). Concluídas e canceladas ficam na Lista | F6 | |
| Arrastar cartão | Muda o status, com volta em caso de erro | Arrastar no Quadro | F6 | |
| Mover para (menu) | Muda o status pelo menu do cartão | Menu do cartão e ficha, para o celular | F6 | |
| Cartão da viagem | Capa, destino, cliente, datas, viajantes e status da venda | Linha da Lista, Capa e cartão do Quadro, com checklist e dias que faltam | F6 | |
| Capa automática | Usa a capa do roteiro, a da venda, uma imagem da Biblioteca do destino ou a padrão | Mesma regra na foto da viagem | F6 | |
| Selos "Cópia" e "Sem venda vinculada" | Marcam cópias e viagens sem venda | Selo de situação. Viagem sem negociação nasce direto em Preparação | F6 | |
| Atalhos Detalhes, Checklist e Financeiro | Abrem a ficha na aba certa | Abas da página da viagem | F6 | |
| Link para o cliente | Vai ao perfil do cliente | Link para os viajantes | F6 | |
| Duplicar viagem | Cria cópia em rascunho com dias e itens | Menu da viagem. A cópia passa a levar todos os campos (hoje perde moeda, sugestões, fotos e anexos) | F6 | |
| Arquivar e desarquivar | Arquiva a venda | Arquivadas (filtro de Viagens) | F4 | |
| Excluir cliente (venda) | Apaga a venda e os dados ligados, com confirmação | Excluir viagem, só para gerente e administrador | F4 | |
| Excluir viagem | Apaga roteiro, dias e itens e avisa o webhook | Excluir viagem, apagando também os anexos (hoje ficam órfãos) | F6 | |
| Estados de carregamento, vazio e erro | Mensagens e "tentar de novo" | Estados padrão do design system | F1 | |

## 2. Nova viagem e edição (hoje: modal Nova / Editar Proposta)

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Dados de contato | Nome, e-mail validado, WhatsApp com máscara, orçamento e "Como nos encontrou?" com "Especifique" | Nova viagem: quem vai, WhatsApp, como chegou e orçamento | F4 | |
| Detalhes da viagem | Ponto de partida com sugestão de aeroportos, destino, período, passageiros, tipo de viagem (escolher ou criar) e expectativas | Nova viagem e "Mais detalhes" | F4 | |
| Interpretar período | Texto livre ("Jul/2026, 10 dias") vira datas com IA | Campo "Quando" da Nova viagem | F4 | |
| Imagem do destino | Buscar com IA, escolher da Biblioteca ou enviar. Tudo vai para a Biblioteca | Foto da capa (viagem e proposta) | F5 | |
| Benefícios e fidelidade | Programas, pontos e milhas, passaporte e preferências | "Mais detalhes" e perfil do viajante | F4 | |
| Voos e hotel | Classe, companhia, categoria de hotel, tipo de quarto e observações | "Mais detalhes" (perfil da viagem) | F4 | |
| Avisos ao salvar | Avisa de e-mail já cadastrado e de viagem que já tem roteiro | Busca na base ao digitar quem vai | F4 | |

## 3. Página da viagem (hoje: `/roteiros/$id`)

### 3.1 Cabeçalho

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Voltar e trilha Cliente › Viagem › Roteiro | Navegação para a lista, o cliente e a ficha | Voltar e link para os viajantes | F6 | |
| Capa do roteiro | Foto com carregamento e nova tentativa quando o link expira | Foto do destino com véu | F6 | |
| Trocar capa | Enviar imagem nova ou escolher da Biblioteca | Trocar foto no topo da viagem | F6 | |
| Resumo | Título, cliente, orçamento, status, datas e viajantes | Topo e card de embarque | F6 | |
| Editar cadastro do cliente | Abre o formulário do cliente | Link para o perfil do viajante | F3 | |
| Status da viagem | Rascunho, Em andamento, Concluído, Cancelado | Etapas da preparação | F6 | |
| Limpar roteiro | Apaga todos os dias, itens e anexos, com confirmação | Menu do roteiro | F6 | |
| Completar com IA | Cria os dias que faltam e os itens por turno, e salva fotos na Biblioteca | Assistente: Completar dias vazios (entra como rascunho) | F11 | |
| Copiar link e Abrir roteiro | Gera o link público, confere se abre e copia ou abre | Enviar ao cliente | F6 | |
| Visualizar | Prévia do documento em tela cheia | Ver como cliente | F6 | |
| PDF | Abre a página de impressão | PDF do card de embarque | F6 | |

### 3.2 Montar o roteiro

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Blocos arrastáveis | Voo, Hospedagem, Atividade, Transfer e Restaurante | "Adicionar ao dia" por tipo, mantendo o arrastar no computador | F6 | |
| Soltar bloco num dia ou em dia novo | Cria o item e já abre a edição | Adicionar por tipo | F6 | |
| Reordenar itens | Arrastar muda a ordem dentro do dia | Linha do tempo por horário, com arrastar | F6 | |
| Mover ou copiar para outro dia | Pergunta Mover, Copiar ou Cancelar | Painel do item: mover ou copiar para outro dia | F6 | |
| Arrastar no celular | Detecção de alvo pelo toque | Mover pelo painel no celular | F6 | |
| Carrossel de dias | Dias lado a lado com setas | Dias na lateral; faixa que desliza no celular | F6 | |
| Adicionar dia | Cria "Dia N" | "+ Dia" | F6 | |
| Renomear dia | Título editável no cartão | Cabeçalho do dia | F6 | |
| Duplicar dia | Escolhe a posição e renumera os outros | Incluir e duplicar dia, levando todos os campos | F6 | |
| Excluir dia | Remove o dia e os itens, com confirmação | Menu do dia | F6 | |
| Adição rápida | Tipo, hora e título numa linha | Adicionar ao dia | F6 | |
| Data do dia | Só a IA e a importação preenchem; não dá para editar | Data editável no cabeçalho do dia | F6 | |
| Dia vazio | Convida a arrastar blocos | "Dia livre" e Sugerir o que fazer | F6 | |

### 3.3 Item do roteiro

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Marcar como feito | Risca o item (hoje apaga o tipo do item) | Situação Reservado ou Pendente, sem perder o tipo | F6 | |
| Linha do item | Ícone do tipo, hora, título e local | Linha do tempo | F6 | |
| Detalhes do item | Observação, fotos em carrossel e valor com conversão | Painel de edição do item | F6 | |
| Tipo, horário e título | Campos básicos, título obrigatório | Painel do item, com os campos próprios de cada tipo | F6 | |
| Local com autocompletar | Sugere lugares conforme o tipo e gera link de mapa | Campo de local do item | F6 | |
| Observação | Texto que o cliente vê | Detalhes do item | F6 | |
| Valor e moeda | 12 moedas (BRL, USD, EUR, GBP, ARS, CLP, UYU, CAD, AUD, CHF, JPY, MXN) | Valor do item, com moeda | F6 | |
| Converter para R$ | Estimativa de câmbio feita pela IA, marcada como informativa | Valor em R$ no item. Avaliar trocar por cotação de serviço de câmbio | F6 | |
| Valores por pessoa | Nome, moeda e valor por passageiro, com total em R$ | Painel do item, ligado aos viajantes da viagem | F6 | |
| Fotos da atração | Do aparelho, da Biblioteca ou buscadas com IA; tudo vai para a Biblioteca | Fotos e anexos do item | F6 | |
| Remover foto | Pergunta se apaga também da Biblioteca | Fotos do item | F6 | |
| Sugestões de hospedagem com assistente | Filtros de bairro, quarto, estrelas, diária, sites e quantidade; converte a diária | Assistente: Comparar hospedagens | F11 | |
| Sugestões de hospedagem manuais | Nome, endereço, quarto, diária e link | Opções dentro do item de hospedagem | F6 | |
| Sugestões de transfer, restaurante e passeio | Assistente ou manual, com sites por tipo | Assistente e opções no item | F11 | |
| Regra por tipo ao salvar | Fotos só em Atividade, opções de hotel só em Hospedagem | Campos próprios por tipo (`kindData`) | F6 | |
| Excluir item | Remove o item e os anexos dele | Excluir no painel | F6 | |

### 3.4 Anexos do item e documentos

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Categorias de anexo | Ingresso, Passagem, Ticket, Voucher, Reserva, Seguro, Imagem e Outro | Tipo do documento | F6 | |
| Anexar do aparelho | Imagem ou PDF, guardado no item, na viagem e na venda | Aba Documentos e anexos do item | F6 | |
| Conferência de imagem pela IA | Recusa imagem sem relação com o destino e avisa de imagem repetida | Mesma regra ao enviar foto | F6 | |
| Anexar da Biblioteca | Busca e copia um documento da agência | Escolher da Biblioteca | F6 | |
| Anexar link | Nome e endereço, abre em outra aba | Link no item | F6 | |
| Visualizar e baixar | Prévia de imagem e PDF, e download | Prévia e download em Documentos | F6 | |
| Excluir anexo | Remove sem pedir confirmação | Excluir com confirmação | F6 | |

### 3.5 Ler documento e montar o roteiro com IA

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Enviar documento | Do aparelho, da Biblioteca ou do Google Drive | Assistente: Ler um documento | F11 | |
| Importar um documento num dia | A IA cria um item a partir de imagem ou PDF | Assistente: Ler um documento | F11 | |
| Extração de vários itens | Lê o documento sem repetir o que já está no roteiro | Assistente, com a resposta como rascunho | F11 | |
| Distribuição por data | Coloca cada item no dia certo e cria os dias que faltam | Mesma regra | F11 | |
| Regras de voo | Ida e volta sem data usam o início e o fim da viagem | Mesma regra | F11 | |
| Ordenar por horário | Estima a hora pelo tipo quando falta | Linha do tempo por horário | F6 | |
| Aviso de datas fora do período | Alerta quando o documento não bate com a viagem | Ponto a conferir na revisão | F11 | |
| Não duplicar | Ignora itens repetidos ou muito parecidos e o mesmo arquivo duas vezes | Mesma regra | F11 | |
| Guardar o arquivo lido | Fica anexado ao primeiro item criado | Fica em Documentos da viagem | F11 | |
| Google Drive: escolher arquivo | Busca na pasta da agência; aceita PDF, imagem, Docs, Slides e planilhas | Integração Google Drive | F10 | |
| Planilhas: escolher abas e ver prévia | Marca as abas e mostra as primeiras linhas | Mesma função ao ler planilha | F11 | |
| Revisão antes de inserir | Só no Drive: lista os itens para marcar e inserir | Revisão para toda leitura de documento (A7) | F11 | |

### 3.6 Assistente de roteiro (chat)

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Abrir o assistente | Botão flutuante na página | Botão Assistente ao lado das abas | F11 | |
| Diagnóstico ao abrir | Mostra progresso dos dias, itens incompletos e dados que faltam | Atalho "Revisar o que falta" | F11 | |
| Conversar | Pergunta livre, Enter envia | Campo de pergunta do Assistente | F11 | |
| Anexar documentos na conversa | Várias imagens ou PDFs por mensagem | Assistente: Ler um documento | F11 | |
| Contexto da IA | Usa a venda, outros roteiros, documentos, anexos e a Biblioteca | Briefing da viagem para o Assistente | F11 | |
| Aplicar resposta | Cria dias e itens e atualiza os existentes | Entra como rascunho para a consultora aprovar | F11 | |

## 4. Ficha da viagem (hoje: gaveta aberta pela lista e pela página)

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Cabeçalho | Capa, nome, destino, orçamento e datas | Topo da ficha comercial | F4 | |
| Tela cheia | Alterna painel e tela cheia, e lembra a escolha | Painel lateral; a preferência fica na conta | F4 | |
| Fechar | Botão, Esc, clique fora e voltar do celular | Padrão do painel lateral | F1 | |
| Status da venda | Novo, Contatado, Negociando, Fechado e Perdido, com confirmação e aviso ao responsável | Etapas clicáveis e "Marcar como perdida" com motivo | F4 | |
| Bloqueio em Fechado ou Perdido | Tudo fica só para leitura; reabrir pede confirmação | Reabrir | F4 | |
| Resumo | Destino, datas, contagem de dias e observações do cliente | Aba Resumo | F4 | |
| Vincular cliente | Liga ou desliga o cliente da venda | Quem vai (viajantes da viagem) | F4 | |
| WhatsApp | Abre a conversa com o telefone | Contato rápido | F4 | |
| Editar | Abre o formulário da venda | Editar dados na aba Resumo | F4 | |
| Atribuir a | Troca o responsável e avisa | Responsável comercial e consultora | F4 | |
| Atividades recentes | Quatro últimas, com atalho | Aba Histórico | F4 | |
| Histórico de viagens do cliente | Lista com link para cada roteiro | Perfil do viajante: Viagens | F3 | |
| Valor da consultoria | Só o administrador vê e edita | Aba Orçamento, com a mesma restrição | F4 | |
| Registrar atividade | Tipo (Ligação, WhatsApp, E-mail, Reunião, Solicitação, Observação, Documento, Outros), título, detalhes, data e responsável | Histórico: registrar. Com data, vira item da Agenda | F4 | |
| Histórico de atividades | Selos Concluída e Atrasada; editar, concluir, reabrir e excluir | Linha do tempo do Histórico | F4 | |
| Checklist: aplicar modelo | Escolhe um modelo e aplica | Aba Checklist da viagem | F6 | |
| Checklist: itens | Seções com progresso; marcar item atualiza a tarefa ligada | Checklist por seções, com contador ao vivo | F6 | |
| Checklist: trocar e remover | Trocar só sem item marcado; remover tem "Desfazer" | Menu do checklist | F6 | |
| Checklist: itens extras | Adicionar e remover itens avulsos | "+ Adicionar item" | F6 | |
| Checklist: virar tarefa | Cria tarefa a partir do item | Item com prazo entra sozinho na Agenda | F7 | |
| Financeiro: resumo | Orçamento, gasto, saldo e economia, com barra de uso | Aba Financeiro: medidor | F6 | |
| Financeiro: orçamentos | Total, valor do cliente e valor da OSV, com a diferença | Aba Orçamento da ficha comercial | F4 | |
| Financeiro: gastos | Categoria, forma de pagamento, descrição, valor, economia e data | Tabela de gastos e Adicionar gasto | F6 | |
| Benefícios | Milhas e pontos por programa; cortesias e sala VIP, com "usada" | Resumo: milhas e benefícios | F4 | |
| Notas | Observações e linha do tempo de contatos | Histórico (Observação) | F4 | |
| Criar ou atualizar roteiro | Cria o roteiro ou copia os dados da venda para ele | Não precisa mais: a viagem é um registro só. Ao fechar, aparece "Abrir viagem" | F4 | |

## 5. Biblioteca (hoje: `/biblioteca`)

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Abas com contador | Experiências, Pacotes, Imagens, Roteiros modelo e Documentos | Filtros por tipo com contagem. **Imagens precisa de um filtro próprio** (o protótipo não mostra) | F9 | |
| Novo item | Formulário por tipo: título, destino, descrição, conteúdo para a IA, etiquetas, imagem e anexo; pacote tem preço e dias | Ficha do item e Editar | F9 | |
| IA na descrição e no conteúdo | Gera o texto e sugere etiquetas | Criar com IA | F9 | |
| Cartão do item | Imagem, título, local, descrição, etiquetas, preço e dias | Capas e Lista | F9 | |
| Ampliar imagem | Abre em tela cheia | Ficha do item | F9 | |
| Editar e excluir | Com confirmação | Ficha do item | F9 | |
| Enviar várias imagens | Confere imagem parecida antes de gravar | Envio de fotos na Biblioteca | F9 | |
| Seleção em massa de imagens | Selecionar todas e excluir várias | Nova no desenho: seleção em massa no modo Lista | F9 | |
| Imagem "Em uso" | Trava a imagem usada em roteiro e mostra onde está | "Usado em N viagens", com a mesma trava | F9 | |
| Roteiros modelo por arquivo | Envia PDFs e cria um item por arquivo | Criar a partir de PDF, com revisão | F9 | |
| Documentos: enviar | PDFs, sem repetir o mesmo arquivo | Tipo Documentos | F9 | |
| Documentos por origem | Gerais, Roteiros e Leads | Origem do documento na Lista | F9 | |
| Documentos: ações | Visualizar, baixar, abrir a viagem e excluir | Ficha do documento: Baixar e Enviar ao cliente | F9 | |

## 6. Roteiro do cliente (hoje: link público `/viajante` e impressão)

| Função hoje | O que faz | Destino | Fase | Feito |
|---|---|---|---|---|
| Acesso por link | Sem login, com código no link. Hoje não dá para revogar | Link com token, revogável | F12 | |
| Barra superior | Sumário, copiar link e salvar PDF | Página do roteiro do cliente | F12 | |
| Capa e sumário | Destino, "Preparado para", datas e índice | Guia da viagem | F11 | |
| Páginas de Voos e de Hospedagem | Reúnem todos os voos e todas as hospedagens | "Voos e reservas" do guia | F11 | |
| Página de cada dia | Tipo, período, hora, título, observação, local, valor e link do mapa | Roteiro dia a dia do guia | F11 | |
| Navegação entre dias | Sumário, dia anterior e próximo | Página do cliente | F12 | |
| O que o cliente não vê | Orçamento, sugestões, valores por pessoa, anexos, checklist e financeiro | Mesma regra, **aplicada também na resposta do servidor** (hoje esses dados vão escondidos na resposta) | F12 | |
| Impressão em A4 | Abre a impressão sozinha, com capa e sem quebrar itens | PDF do guia | F11 | |
| Prévia interna | Mostra o documento dentro do app | Ver como cliente | F6 | |

