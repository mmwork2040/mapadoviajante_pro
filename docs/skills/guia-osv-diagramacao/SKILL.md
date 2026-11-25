---
name: guia-osv-diagramacao
description: Modo 1 dos Guias OSV — diagrama um guia de viagem a partir de TEXTO PRONTO do time, fiel ao conteúdo, no padrão visual dos Roteiros OSV (PDF clicável + site mobile), e devolve um relatório de lacunas. Use quando o usuário disser "diagrama o guia de X", "faz o design dessa cartilha", "já tenho o texto, só monta", ou entregar uma pasta de `8. Guias OSV/<destino>` com conteúdo em `02. TEXTO PRONTO`. Para criar o conteúdo do zero, use `guia-osv-completo`.
---

# Guia OSV · Modo 1 (Diagramação)

O texto é do time. Seu trabalho é **dar forma, não reescrever**.

Referências (leia antes):
- Pasta do destino no Drive: `.../01. PRODUTOS/8. Guias OSV/<destino>/` (`BRIEFING.md` primeiro)
- `Documents/Projetos DEV/OSV/marca/design-system-roteiros/REGRAS-GUIA-GENERICO.md` (§0 modos e módulos) e `REGRAS-DE-CONTEUDO.md` (limites)
- Geração e QA visual: skill `roteiro-osv`

## Fluxo
1. **Leia** `BRIEFING.md` e tudo em `02. TEXTO PRONTO/`.
   - `.gdoc` é só um atalho: leia pelo conector do Google Drive (`read_file_content`) ou peça ao usuário para exportar em .docx/.md.
   - Se `02. TEXTO PRONTO` estiver vazio, pare e sugira o Modo 2 (`guia-osv-completo`).
2. **Mapeie** cada seção do texto para um tipo de página do gerador. Os títulos do `_MODELOS/modelo-texto-pronto.md` já correspondem 1 para 1:
   Capa→`capa` · O destino→`destino` · Melhor época→`tabela` · Informações→`info` · Voos→`voos` · Dinheiro→`dinheiro` · Onde ficar→`tabela`+`grade` · Comida/O que fazer→`grade`/`destaque` · Roteiro→`dia` · Checklist→`checklist` · Parceiros→`dicas` · Frase→`contracapa`.
   Se o texto vier em outro formato, mapeie pelo conteúdo e anote no relatório.
3. **Regras de fidelidade**
   - Pode: corrigir ortografia, padronizar maiúsculas e horários, transformar parágrafo em lista quando o sentido é o mesmo, dividir uma página que estoura.
   - Pode acrescentar (mecânico): sumário e navegação; `mapa` em lugar com nome inequívoco; botão para links que já estão no texto; links de afiliado OSV (§ Padrões OSV) em passeios pagos, transfer, chip, carro, câmbio e seguro (`gyg:`, `trip:`, `parceiro:`), a página Parceiros OSV e o contato de seguro da OSV. Isso não conta como mudar o conteúdo.
   - **Não pode:** criar seção, lugar, passeio, restaurante, preço ou horário; mudar recomendação; cortar informação para caber (divida a página em vez de cortar).
   - Dúvida de sentido ou dado aparentemente errado (ex.: moeda de outro país): **não corrija sozinho**. Liste no relatório.
4. **Gere** com o fluxo da `roteiro-osv`: JSON com `meta.modo: "diagramacao"`, `meta.tema` do briefing. Guia genérico: sem `meta.inicio` (dias sem data). Guia de cliente: veja § Guia de cliente. Fotos de `03. FOTOS` primeiro.
5. **QA** como na `roteiro-osv`: páginas em PNG, teste no celular a 375 px, links e mapas clicáveis. Confira também: páginas de dia/texto centralizadas (nada colado no topo com metade da folha vazia), página Parceiros OSV completa, tela de senha `segredo` no site e no .html. No guia de cliente, rode também o grep de pendências (§ Guia de cliente).
6. **Entregue** em `04. ENTREGA/`: o PDF, a pasta `site-<destino>/`, o **`site-<destino>-cpanel.zip`** (§ Publicação no cPanel) e o `relatorio-lacunas.md`. Atualize o Status no `BRIEFING.md`.

## Guia de cliente (viagem com datas, dados fornecidos na diagramação)
Quando o guia é de uma viagem específica (clientes com nome, datas, voos e hotéis já comprados), os dados da viagem chegam junto com o texto. Siga o fluxo acima com estas regras a mais.

**1. Dados da viagem — confira se vieram (em `01. FONTES` ou no pedido); o que faltar, pergunte ou liste no relatório:**
- Voos: companhia, número, horários, terminais e franquia de bagagem, **incluindo o trecho da cidade de saída do cliente** (ex.: BH → GRU), não só o internacional.
- Hospedagens: nome, **endereço exato**, horários de check-in e check-out.
- Ingressos e reservas já comprados, com data, local do evento e **quando ficam disponíveis** (ex.: ingresso liberado 48h antes do jogo).
- Links das pastas do Drive do cliente (ex.: Passeios, Transportes, Hotéis, pasta geral).
- Perfil dos viajantes: idades, restrições (ex.: claustrofobia), quantidade de malas, cartões e status que dão benefício (sala VIP, bagagem, fidelidade).

**2. Regras do guia de cliente**
- `meta.inicio` com a data real do dia 1 (ativa o "Hoje" no site) e datas em todos os dias.
- **Itens já comprados apontam para a pasta do Drive**, não para link de compra ou afiliado (ingresso → Passeios; voo/trem → Transportes; hotel → Hotéis). Afiliado OSV só no que o cliente ainda vai comprar.
- **Nada de pendência interna no guia** (PDF, HTML e site): nada de "a definir", "a confirmar", "confirmem com o banco", "perguntem se…", "combinem com o anfitrião" quando quem resolve é a OSV. O guia só traz o que está decidido, em tom afirmativo; o que falta vai para o `relatorio-lacunas.md`. Instruções que dependem só do viajante ("baixem o app", "cheguem 1h antes") podem ficar. Antes de entregar, `grep -ciE "a definir|a confirmar|confirmem|perguntem|combinem|\[CONFIRMAR\]"` no texto do PDF, no .html e no `index.html` do site tem que dar 0.
- **Documentos pessoais** (passaporte, ETA, visto, apólice) nunca em pasta linkada no guia: a senha `segredo` é a mesma para todos os guias. Oriente a OSV a usar uma pasta compartilhada só com os clientes. Nenhum número de documento no guia.

**3. O que pode ser acrescentado além do texto**
- **Traslados**, sempre que houver o endereço da hospedagem: em cada chegada e saída, do aeroporto/estação **até o endereço exato** (nunca "até a estação central" se a hospedagem é outra), com meio de transporte, app, tempo, custo aproximado e alternativa sem malas. Página "Traslados · <cidade>" com `"ancora"`; no dia, um bloco `"detalhes"` apontando para ela. Se as malas não cabem num carro comum, avise (van/XXL ou 2 carros) **uma vez só**, não em toda página.
- **Restaurantes, lugares, compras, vida noturna e outras pesquisas: só quando o Lucas pedir.** Registre a pesquisa com fontes em `Atualizações para o roteiro — pesquisa (<data>).md` na pasta do destino e aplique no guia depois da aprovação.
- **Apps** com link de download (App Store e Google Play, URLs conferidas nas lojas, nunca IDs de cabeça), em tabela com coluna "Baixar" (`[iPhone](…) · [Android](…)`).
- **Clima do dia** (`"clima"`): média histórica do mês, não previsão.
- Links abrindo em nova aba: `meta.links_nova_aba: true`.
Recursos do gerador (`clima`, `detalhes`, `ancora`, `links_nova_aba`, `secao_site`): § Recursos extras na `roteiro-osv`.

## Padrões OSV obrigatórios (todo guia)
- **Links de parceiros** ficam em `DS/parceiros.json` (GetYourGuide + cupom THAYMAFRA5, Trip.com, GetTransfer, Airalo, O Meu Chip, Rentcars + cupom OSV, Nomad + cupom OSV20, Wise, mochila OSV, seguro viagem). Nunca digite esses links à mão no JSON:
  - passeio/atração paga: `"link": "gyg:<url da atividade>"` ou `"trip:<url>"`; sem página específica, use `"gyg:"`/`"trip:"` (cai no link de afiliado OSV);
  - transfer do aeroporto → `parceiro:gettransfer`; carro → `parceiro:rentcars`; chip/internet → `parceiro:airalo` e `parceiro:omeuchip`; dinheiro → `parceiro:nomad` e `parceiro:wise`; trens, voos e hotéis na Ásia → `parceiro:trip`; mala → `parceiro:mochila`.
  - **Coloque o link em tudo que o viajante puder reservar ou comprar** (página de info, dinheiro, locomoção, dias do roteiro, checklist).
- **Seguro viagem:** sempre "cote com a OSV" no WhatsApp **+55 31 98405-1900** (`parceiro:seguro`), no card de seguro da página `info` e na página de parceiros.
- A página **Parceiros OSV** (todos os links e cupons) entra sozinha antes da contracapa; itens que já estiverem na página `dicas` não se repetem. `meta.parceiros: [chaves]` escolhe quais; `meta.parceiros_padrao: false` desliga.
- **Senha de acesso** em todo HTML (site e cartilha .html): **`segredo`** (`senha_html` em `parceiros.json`; `meta.senha` troca só para um guia). O PDF não tem senha.
- **Diagramação:** página de texto sem fotos fica centralizada na vertical (o gerador põe `sem-fotos`). No QA, se uma página tiver mais de 1/3 vazio embaixo, acrescente `imagens` (foto do lugar) ou junte com o dia seguinte. O motivo `geometrico` agora é de losangos, sem quadrados colados no logo.

## Publicação no cPanel (último passo, sempre)
Gere o site já com o PDF dentro e o zip:
`python3 site.py <json> --saida "<04. ENTREGA>" --pdf "<04. ENTREGA>/<arquivo>.pdf" --zip`
Isso cria `site-<destino>-cpanel.zip` (index.html na raiz + `.htaccess` que força https). Passe ao usuário:
1. cPanel → Gerenciador de Arquivos → `public_html` → crie a pasta do guia (ex.: `guia-china`).
2. Carregar o zip dentro dela → botão direito → **Extrair** → apague o zip.
3. Acesse `https://<domínio>/guia-china/` (precisa de SSL ativo), teste a senha **segredo** e envie o link + a senha ao cliente.
Inclua no fim da resposta o caminho do zip e esse passo a passo.

## Relatório de lacunas (`04. ENTREGA/relatorio-lacunas.md`)
Compare com o núcleo e os módulos do `REGRAS-GUIA-GENERICO.md`:
- **Faltando no núcleo** (bloqueia): ex.: "sem informações essenciais".
- **Módulos ausentes que valeriam**: ex.: "sem página de voos/milhas", "restaurantes sem faixa de preço".
- **Passeios sem link de reserva** e **lugares sem mapa**.
- **Dados para conferir**: preços/milhas sem data, informações possivelmente desatualizadas ou incoerentes (cite página e trecho).
- **Ajustes feitos**: ortografia, divisões de página, mapeamentos não óbvios.
Termine com: "Quer completar algum ponto no Modo 2?"
