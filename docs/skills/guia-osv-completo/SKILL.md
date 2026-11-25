---
name: guia-osv-completo
description: Modo 2 dos Guias OSV — cria do zero (ou reaproveitando cartilhas antigas) um guia de viagem genérico completo para quem vai viajar sozinho — voos e milhas, onde ficar, comida, roteiro dia a dia pelo Método OSV, links de afiliado — no padrão visual dos Roteiros OSV (PDF clicável + site mobile) e gera a base para a Thay IA. Use quando o usuário pedir "cria o guia completo de X", "monta o roteiro genérico de X", "transforma a cartilha antiga de X em guia", ou entregar uma pasta de `8. Guias OSV/<destino>` sem texto pronto. Se o texto já vier pronto, use `guia-osv-diagramacao`.
---

# Guia OSV · Modo 2 (Roteiro completo)

Público: um viajante que **só terá este guia** (e, se quiser, a Thay IA) para planejar e fazer a viagem. A venda já aconteceu: o guia é 100% viagem, sem oferta.

Leia antes:
- Pasta do destino no Drive: `.../01. PRODUTOS/8. Guias OSV/<destino>/` (`BRIEFING.md` primeiro)
- `Documents/Projetos DEV/OSV/marca/design-system-roteiros/REGRAS-GUIA-GENERICO.md` (estrutura, voos, afiliados, qualidade)
- `.../design-system-roteiros/METODO-OSV.md` (como montar os dias)
- Geração e QA visual: skill `roteiro-osv`
- Tom de voz: `Projetos DEV/OSV/OSV Brain/_kb/CONTEXTO-OSV.md` (educativo, prático, "você", nunca elitista)

## Fluxo
1. **Briefing.** Leia `BRIEFING.md`. Confirme com o usuário só o que faltar: quantos dias na versão base, módulos que entram, saída dos voos (padrão GRU; outra cidade só com voo direto).
2. **Inventário das fontes** (`01. FONTES` e "Outras fontes" do briefing). Extraia o texto com PyMuPDF. Com 3 ou mais fontes grandes, delegue a extração a subagentes (um por fonte) que devolvam só o inventário. Classifique cada informação:
   - **Aproveitar:** dicas, lugares, restaurantes, estratégias de voo/milhas.
   - **Remover:** logística de grupo ("teremos guia", transfer do grupo, pacote, Pix, cancelamento), nomes e dados de clientes, hotel/voo já comprado, datas fixas.
   - **Conferir:** todo dado datado (preço, milhas, câmbio, horário, regra de entrada) e o que parecer incoerente (ex.: moeda de outro país).
   Nunca leve dados pessoais de cartilhas de clientes para o guia.
3. **Pesquisa por módulo** (WebSearch; "extended" para preços e regras atuais). Para cada dado: valor + mês/ano + fonte.
   - Voos: rotas de GRU, companhias, programas que emitem e faixa de milhas, bagagem, salas VIP.
   - Onde ficar: regiões por perfil + 2 ou 3 hospedagens por região (faixas $).
   - Comida: pratos e restaurantes por estilo (ficha: tipo, $, horário, reserva).
   - O que fazer: cada passeio pago com a página no **GetYourGuide** e/ou **Trip.com** (link `gyg:<url>`/`trip:<url>`; sem página específica, `gyg:`).
   - Transfer, carro, chip, câmbio e seguro sempre com os links `parceiro:` (§ Padrões OSV).
   - Custo por dia em 3 faixas, melhor época (12 meses), regras/cultura, taxas obrigatórias, passes.
   - Sem fonte confiável → `[CONFIRMAR]`. **Nunca invente.**
4. **Roteiro.** Monte a versão base seguindo o `METODO-OSV.md`: chegada leve, um dia por região, folga no último dia, eventos por dia da semana, plano B, onde comer perto, reserve antes. Depois faça a tabela de versões curta e longa.
5. **JSON e geração** pelo fluxo da `roteiro-osv`: `meta.modo: "completo"`, `meta.tema` do briefing, sem `meta.inicio` (dias sem data). Fotos de `03. FOTOS` primeiro, depois `foto:` do Commons.
6. **QA**
   - Ortografia ("Itinerário"), nomes de lugares, coerência entre as páginas.
   - Moeda, documentos e tomada são do destino certo.
   - Todo passeio pago tem link de reserva; todo lugar tem mapa; tudo que se compra tem link de parceiro OSV; seguro aponta para o WhatsApp da OSV.
   - Páginas centralizadas (nada colado no topo com metade da folha vazia) e motivo sem quadrados.
   - Tela de senha `segredo` aparece no site e no .html.
   - Visual e celular como na `roteiro-osv` (375 px, sem rolagem lateral, links funcionando). PDF até 10 MB.
7. **Entregue** em `04. ENTREGA/`:
   - PDF + pasta `site-<destino>/` + **`site-<destino>-cpanel.zip`** (§ Publicação no cPanel)
   - `pendencias.md`: lista de `[CONFIRMAR]`, fontes usadas (com data), fotos vindas da internet, afiliados faltando.
   - `thay-<destino>.md`: **base para a Thay IA** (§ abaixo).
   Atualize o Status e as Pendências no `BRIEFING.md`.

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

## Base para a Thay IA (`thay-<destino>.md`)
Markdown pensado para ser carregado no conhecimento do plugin (ChatGPT e Claude):
1. Cabeçalho: destino, data da última checagem, "siga o METODO-OSV.md".
2. Fatos práticos: documentos, moeda, custo/dia, melhor época, voos e milhas.
3. **Catálogo** com uma linha por item: `nome · tipo (atração/restaurante/hospedagem) · região · faixa $ · duração · melhor horário · reserva antecipada? · link · mapa`.
4. Regiões e tempos de deslocamento entre elas.
5. Roteiro base no formato do dia (Dia N · Região → Manhã/Tarde/Noite → Onde comer → Reserve antes → Plano B → Dica) + lista "versão curta corta" e "versão longa acrescenta".
6. Regras específicas do destino (vento, maré, calor, dias de evento, fechamentos).
A Thay só recomenda o que está nesse catálogo. O que vier de fora deve ser sinalizado como sugestão não verificada.
