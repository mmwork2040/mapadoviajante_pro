# PARA-IA — Como construir páginas do O Segredo do Viajante

> **Leia inteiro antes de escrever qualquer HTML.** Este arquivo é o contrato. O catálogo visual com o código de cada peça está em `guia-visual.html`, e uma página completa de referência está em `index.html`.

---

## 0. Em 5 linhas

1. A marca é **O Segredo do Viajante (OSV)**: educação em viagens (milhas, cartões, planejamento) de Lucas Alves e Thay Mafra. A promessa é viajar mais, com mais conforto, sem gastar mais.
2. O visual é **escuro e quente com respiros brancos**, com o **laranja #F58E26** como única cor de ação e uma **palavra de destaque em laranja** (na fonte e no peso do título, sem itálico) como assinatura.
3. A clareza vem de **uma ideia por título**, **uma tarefa por seção** e **um botão primário por tela**.
4. A emoção vem de **fotos reais de viagens em grupo** e de **números reais de economia**.
5. Você **não inventa** cor, espaçamento, número, preço nem depoimento. Use as classes `osv-*` e os fatos da seção 8.

---

## 1. Carregar o sistema

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>[Título da página] — O Segredo do Viajante</title>
<meta name="description" content="[1 frase]">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@500;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/tokens.css?v=2.3.0">
<link rel="stylesheet" href="assets/css/biblioteca.css?v=2.3.0">
<script src="assets/js/runtime.js?v=2.3.0" defer></script>
</head>
<body class="osv-sup--escuro">
  <a class="osv-pular" href="#conteudo">Pular para o conteúdo</a>
  <!-- topo · main#conteudo com <section>s · rodapé · barra fixa (opcional) -->
</body>
</html>
```

- **Nunca** carregue `guia.css` ou `guia.js` em página de produção.
- Esqueleto pronto para copiar: `modelo-pagina.html`.
- Se a página ficar em outra pasta, ajuste os caminhos `assets/…`.

---

## 2. Regras inegociáveis

1. **Sem valores soltos.** Nada de `#hex`, `px` de espaçamento, `font-family` ou `cubic-bezier` no HTML ou em CSS novo. Use classes `osv-*` e tokens `--osv-*`/`--s-*`. Ajustes pontuais por variável: `style="--min:260px"`, `--n`, `--item`, `--foco`, `--brilho-x`, `--brilho-y`, `--gap`, `--rota-w`, `--proporcao`.
2. **Toda `<section>` tem `osv-secao` + uma superfície:** `osv-sup--escuro`, `osv-sup--branco`, `osv-sup--grafite` ou `osv-sup--laranja`.
3. **Ritmo:** alterne escuro e branco. Use no máximo 3 superfícies diferentes por página; a `--laranja` no máximo 1 vez. Para duas escuras seguidas, a segunda vira `--grafite`.
4. **Um botão primário (`osv-btn--primario`) por dobra.** Os demais são `--contorno`, `--vidro` ou `--link`.
5. **Uma palavra de destaque (`osv-destaque`) por título, no máximo.** Laranja, na fonte e no peso do título. Nunca em texto corrido, botão ou rótulo. **Itálico não existe no sistema**: nem em título, nem em parágrafo, citação ou legenda. O nome antigo `osv-script` ainda funciona em páginas já publicadas; em página nova use `osv-destaque`.
6. **Texto dentro do botão sempre em `<span>`.**
7. **Branco é branco.** Nada de bege ou rosado nos fundos claros (pedido explícito do Lucas).
8. **Todo texto laranja usa o laranja principal #F58E26** (regra da marca). Sobre branco ele tem 2,4:1: use lá só em títulos grandes (`osv-destaque`, `osv-d1/d2`) e em rótulos curtos em negrito (`osv-rotulo`). Nunca em texto corrido.
9. **Verde (`osv-selo--cf`) é exclusivo do Close Friends.** Sépia só aparece em rotas e linhas de mapa, nunca em botão.
10. **Fatos só da seção 8.** Se faltar um dado, escreva um marcador visível, por exemplo `[PENDENTE: preço vigente]`, e avise quem pediu.
11. **Sem pontilhado.** Rota, ligação entre passos e divisores são linha contínua (a rota leva paradas). Tracejado só no picote do cartão de embarque, no teaser trancado e na área de upload.
12. **Fontes:** League Spartan nos títulos e Inter em todo o resto. A DM Sans saiu na v2.3.
13. **Acessibilidade:** `alt` descritivo em foto de pessoa e `alt=""` em decorativa; títulos sem pular nível (um `h1` por página); todo `input` com `<label>` (pode ser `.osv-sr`); link com texto que faça sentido sozinho.

---

## 3. Superfícies (o mecanismo central)

Os componentes **não têm cor própria**: leem as variáveis da superfície da seção. Trocar `osv-sup--escuro` por `osv-sup--branco` recolore tudo.

| Superfície | Uso típico | Clima |
|---|---|---|
| `osv-sup--escuro` | Hero, método, fundadores, CTA final, rodapé | Noite, foto, premium |
| `osv-sup--grafite` | Segunda escura seguida | Escuro elevado |
| `osv-sup--branco` | Produtos, provas, FAQ, comparação | Respiro, leitura |
| `osv-sup--laranja` | Captura de e-mail, faixa de chamada única | Ação, urgência |

**Fundos** são camadas num `<div class="osv-fundo …" aria-hidden="true"></div>`, sempre o **primeiro filho** da seção:

| Classe | Efeito | Uso |
|---|---|---|
| `osv-fundo--brilho` | Brilho laranja no canto (`--brilho-x/y`) | Hero, seções escuras |
| `osv-fundo--brilho-centro` / `--brilho-base` | Brilho central / vindo de baixo | Método / CTA final |
| `osv-fundo--grade` | Grade fina que some nas bordas | Hero, CTA final |
| `osv-fundo--mapa` | Linhas de latitude, equador laranja | Seções de método, rota, destinos |
| `osv-fundo--grao` | Ruído de filme sutil | Toda seção escura |
| `osv-fundo--foto` + `<img>` | Foto com véu da superfície | Hero fotográfico, depoimento em vídeo |

Receita de hero: `osv-fundo--brilho osv-fundo--grade osv-fundo--grao`. **Máximo de 3 camadas por seção.**

---

## 4. Como apresentar o texto (é aqui que mora a clareza)

### Fórmulas de título (escolha UMA por título)

"Destaque" é sempre a palavra em laranja de `osv-destaque`, sem itálico.

| Fórmula | Estrutura | Exemplo |
|---|---|---|
| **Promessa + contraste** | frase curta acesa + parte apagada (`osv-suave`) + destaque | `Viaje mais.<br><span class="osv-suave">Gaste</span> <span class="osv-destaque">menos</span>` |
| **Pergunta de caminho** | pergunta com destaque na palavra final | `Por onde você <span class="osv-destaque">começa?</span>` |
| **Afirmação + destaque** | frase com a palavra emocional em laranja | `A gente ensina o que <span class="osv-destaque">vive</span>` |
| **Resultado + sublinhado** | resultado com a palavra-chave sublinhada | `Economia que vira <span class="osv-sublinha">passagem</span>` |
| **Número em gradiente** | dado com destaque | `Economize até <span class="osv-grad">90%</span> nas passagens` |
| **Amplitude girando** | base fixa + 3 a 5 palavras que giram | `Use milhas para ir <span class="osv-roda" data-roda="2400"><span>ao Peru</span><span>a Paris</span>…</span>` |
| **Etiqueta solta** | palavra de destaque acima do título (estilo das capas) | `<span class="osv-destaque osv-destaque--solta">Comunidade</span>O segredo de viajar mais` |

### Escada de texto de toda seção

```
osv-rotulo   → 2 a 5 palavras, CAIXA ALTA automática ("O método OSV")
osv-d2       → a ideia da seção, máx. ~8 palavras, 1 destaque
osv-lead     → 1 ou 2 frases que explicam (opcional)
componentes  → cards, passos, provas…
osv-ctas     → no máx. 1 primário + 1 secundário
osv-microcopy→ 2 a 3 garantias curtas abaixo do botão (opcional)
```

Use `osv-cab` (`--centro` ou `--lado`) para montar rótulo, título e lead.

### Tom de voz

Educativo, motivador, empático e **nunca elitista**. É uma conversa entre amigos viajantes. Use "você" e "a gente". Frases curtas. Nada de "revolucionário", "fórmula secreta" ou "dinheiro fácil".

---

## 5. Receitas de página

Cada linha é uma `<section>`. A coluna "pensa" é o que o visitante precisa concluir ali; se a seção não cumpre isso, corte.

### 5.1 Home institucional (referência: `index.html`)
| # | Seção | Superfície | Componentes | Pensa |
|---|---|---|---|---|
| 1 | Hero | escuro | pílula · `osv-mega` (promessa + contraste) · lead · 2 CTAs · vitrine 21:9 · stats | "Entendi e é gente real" |
| 2 | Destinos | escuro | `osv-faixa` | "Eles viajam de verdade" |
| 3 | Produtos | branco | `osv-cab--centro` · 6 `osv-card` (1 `--destaque`) | "Esse é o meu caminho" |
| 4 | Método | escuro + mapa | `osv-passos` · rota | "É simples e tem fim" |
| 5 | Resultados | branco | 3 `osv-depo` com número · carrossel de `osv-print` | "Funciona pra gente como eu" |
| 6 | Fundadores | escuro | `osv-dupla` · vitrine 4:5 · `osv-flutuante` · `osv-lista` | "Quem ensina faz" |
| 7 | Viagens | branco | carrossel de `osv-poster` | "Quero estar ali" |
| 8 | Newsletter | laranja | `osv-captura` | "Fico por perto" |
| 9 | FAQ | branco | `osv-dupla` · `osv-acordeao` | "Sem dúvidas" |
| 10 | CTA final | escuro | pílula · `osv-d1` + destaque · `osv-btn--brilho` · microcopy | "É agora" |

### 5.2 Página de vendas (PVI, Comunidade, Mapa)
| # | Seção | Superfície | Componentes |
|---|---|---|---|
| 1 | Hero com VSL | escuro | pílula · `osv-d1` · lead · `osv-vitrine--16x9` + `osv-play` (lightbox) · CTA · microcopy |
| 2 | Dor / cenário | branco | `osv-cab` · `osv-grade--3` de `osv-card` com ícone ("Se você já passou por…") |
| 3 | Pra quem é / não é | escuro | `osv-compara` ou duas `osv-lista` (check e `--x`) |
| 4 | O que você aprende | branco | `osv-passos` ou grade de `osv-poster` (módulos) |
| 5 | Prova | escuro | `osv-stats` · `osv-depo` · carrossel `osv-print` |
| 6 | Bônus | branco | `osv-card` + `osv-trancado` para o que abre depois |
| 7 | Quem ensina | escuro | `osv-dupla` · `osv-fundador` |
| 8 | Comparativo | branco | `osv-compara` (Outros × Método OSV) |
| 9 | Oferta | escuro + brilho-centro | `osv-oferta` centralizada · `osv-garantia` |
| 10 | FAQ | branco | `osv-acordeao` |
| 11 | CTA final | escuro | igual à home |
| + | Barra fixa | — | `osv-barra[data-barra="#hero"]` |

### 5.3 Captura de evento / live (ex.: "Semana Desvendando o Segredo do Viajante")
| # | Seção | Superfície | Componentes |
|---|---|---|---|
| 1 | Hero | escuro | pílula "Ao vivo · [data]" · `osv-d1` · lead · **formulário no hero** (`osv-captura`) · `osv-data` |
| 2 | O que acontece em cada dia | branco | `osv-passos` com `--n` = número de dias |
| 3 | Pra quem é | escuro | `osv-lista` |
| 4 | Teaser trancado | grafite | grade de `osv-trancado` ("abre ao vivo") |
| 5 | Quem apresenta | branco | `osv-fundador` ×2 |
| 6 | CTA final + captura | laranja | `osv-captura` |

Página **curta**. Repita o formulário no topo e no fim. No máximo 6 seções.

### 5.4 Página de obrigado
Uma seção escura com `osv-fundo--brilho-centro`, `osv-pilula` "Inscrição confirmada", `osv-d2`, uma lista de próximos passos (`osv-passos` com `--n:3`: e-mail, grupo do WhatsApp, agenda) e **um** botão primário (entrar no grupo).

### 5.5 Link na bio
Uma coluna `osv-container--estreita` escura com logo, `osv-lead` curto e uma pilha de `osv-btn--vidro osv-btn--bloco osv-btn--grande`. Só o link principal leva `--primario`.

### 5.6 Newsletter
Hero branco com `osv-fundo--foto` (viagem), `osv-d1` "Toda sexta, um destino no seu e-mail", `osv-captura`, prova "+[nº] leitores" (**pendente: número real**), três `osv-card` com o que chega, FAQ e captura final em laranja.

---

## 6. Catálogo rápido de componentes

| Classe | Para quê |
|---|---|
| `osv-secao` (`--compacta`, `--sem-topo`) | Toda seção |
| `osv-container` (`--larga`, `--estreita`) | Largura do conteúdo |
| `osv-grade` (`style="--min:260px"`) · `osv-grade--2/3/4` | Grades responsivas |
| `osv-dupla` (`--6040`, `--4060`, `--invertida`) | Texto + mídia |
| `osv-pilha` · `osv-linha` · `osv-centro` | Empilhar · alinhar · centralizar |
| `osv-cab` (`--centro`, `--lado`) | Cabeçalho de seção |
| `osv-mega` `osv-d1` `osv-d2` `osv-d3` `osv-d4` | Títulos |
| `osv-lead` `osv-texto` `osv-peq` | Textos |
| `osv-rotulo` (`--traco`) · `osv-pilula` | Rótulo e status |
| `osv-destaque` (`--solta`) · `osv-suave` · `osv-grad` · `osv-sublinha` · `osv-roda` | Efeitos de título |
| `osv-stats` + `osv-stat` (`data-contar`) | Números |
| `osv-lista` (`--x`) · `osv-citacao` · `osv-rota` | Listas, citação, rota do logo |
| `osv-btn` + `--primario/--contorno/--vidro/--link` + `--grande/--peq/--bloco/--brilho` | Botões |
| `osv-ctas` · `osv-microcopy` | Grupo de botões e garantias |
| `osv-tag` · `osv-selo` (`--neutro`, `--cf`) | Assunto · estado |
| `osv-card` (`--destaque`, `--solido`) · `osv-card__num/__icone/__titulo/__texto/__canto` | Card de vidro |
| `osv-trancado` | Teaser "abre ao vivo" |
| `osv-poster` | Capa vertical (curso, viagem) |
| `osv-cfoto` | Card com foto no topo |
| `osv-depo` · `osv-print` | Depoimento · print real |
| `osv-fundador` | Mini bio com foto |
| `osv-passos` + `osv-passo` (`style="--n:3"`) | Etapas ligadas por rota |
| `osv-compara` | Outros × OSV |
| `osv-oferta` · `osv-garantia` · `osv-data` | Preço, garantia, data de evento |
| `osv-vitrine` (`--16x9`, `--4x5`, `--9x16`, `--1x1`) · `osv-flutuante` · `osv-play` | Mídia |
| `osv-captura` · `osv-campo` · `osv-erro` · `osv-aviso-lgpd` | Formulários |
| `osv-acordeao` | FAQ |
| `osv-carrossel` | Carrossel |
| `osv-faixa` (`--contorno`) | Marquee |
| `osv-topo` · `osv-menu` · `osv-rodape` · `osv-barra` | Navegação, rodapé, barra fixa |

### Comportamentos (`runtime.js`)
`data-topo` · `data-menu-botao="id"` · `data-revelar[="esquerda|direita|escala|cortina"]` · `data-revelar-grupo="90"` · `data-contar` (+ `data-prefixo`/`data-sufixo`) · `.osv-roda[data-roda]` · `data-acordeao="unico"` · `data-carrossel` (+ `data-carrossel-ant`/`-prox`) · `data-faixa="55"` · `data-lightbox="url"` · `form[data-form]` · `.osv-barra[data-barra="#hero"][data-barra-fim=".osv-rodape"]` · `data-ano`.

Ao injetar HTML depois do carregamento, chame `OSV.init(elemento)`.

---

## 7. Trechos essenciais

**Seção padrão**
```html
<section class="osv-secao osv-sup--branco" id="produtos">
  <div class="osv-fundo osv-fundo--brilho" aria-hidden="true"></div>
  <div class="osv-container">
    <header class="osv-cab osv-cab--centro" data-revelar>
      <span class="osv-rotulo">Um ecossistema, um caminho</span>
      <h2 class="osv-d2">Por onde você <span class="osv-destaque">começa?</span></h2>
      <p class="osv-lead">Uma ou duas frases.</p>
    </header>
    <div class="osv-grade osv-grade--3" data-revelar-grupo="80">
      <!-- cards -->
    </div>
  </div>
</section>
```

**Hero**
```html
<section class="osv-secao osv-sup--escuro" id="inicio" style="padding-top:calc(76px + var(--osv-e-10))">
  <div class="osv-fundo osv-fundo--brilho osv-fundo--grade osv-fundo--grao" aria-hidden="true"></div>
  <div class="osv-container osv-centro">
    <div class="osv-pilha" style="--gap:var(--osv-e-6);align-items:center" data-revelar-grupo="110">
      <span class="osv-pilula"><span class="osv-pilula__ponto"></span>Comunidade OSV <span class="osv-pilula__sep"></span> turma aberta</span>
      <h1 class="osv-mega">Viaje mais.<br><span class="osv-suave">Gaste</span> <span class="osv-destaque">menos</span></h1>
      <p class="osv-lead">Milhas, cartões e planejamento para viajar mais, <strong>com mais conforto</strong>, sem gastar mais.</p>
      <div class="osv-ctas">
        <a class="osv-btn osv-btn--primario osv-btn--grande" href="#"><span>Quero entrar</span><span class="osv-btn__seta" aria-hidden="true">→</span></a>
        <a class="osv-btn osv-btn--contorno osv-btn--grande" href="#"><span>Como funciona</span></a>
      </div>
    </div>
    <figure class="osv-vitrine osv-mt-10" data-revelar="escala">
      <img src="assets/img/viagem-peru.jpg" alt="Grupo da comunidade OSV em Machu Picchu">
      <figcaption class="osv-vitrine__legenda"><b>Viagem da comunidade · Peru</b>Alunos colocando o método em prática</figcaption>
    </figure>
  </div>
</section>
```

**Card · pôster · depoimento**
```html
<a class="osv-card" href="#"><span class="osv-card__num">01 · Primeira viagem</span><h3 class="osv-card__titulo">Título</h3><p class="osv-card__texto">Pra quem…</p><div class="osv-tags"><span class="osv-tag">Tag</span></div></a>

<a class="osv-poster" href="#"><img class="osv-poster__img" src="assets/img/viagem-noronha.jpg" alt=""><h3 class="osv-poster__titulo">Fernando<span class="osv-destaque">de Noronha</span></h3><div class="osv-poster__rodape"><p class="osv-poster__pub">Expedição da comunidade</p><span class="osv-poster__icone" aria-hidden="true">✈</span></div></a>

<figure class="osv-depo"><span class="osv-depo__destaque">R$ 5.348</span><blockquote class="osv-depo__texto">“Citação real.”</blockquote><figcaption class="osv-depo__autor"><span class="osv-depo__avatar">É</span><span><span class="osv-depo__nome">Érica</span><br><span class="osv-depo__meta">Turma 05</span></span></figcaption></figure>
```

**Captura**
```html
<form class="osv-pilha" data-form>
  <div class="osv-captura"><label class="osv-sr" for="email">Seu melhor e-mail</label><input id="email" type="email" required placeholder="Seu melhor e-mail" autocomplete="email"><button class="osv-btn osv-btn--primario" type="submit"><span>Quero participar</span></button></div>
  <p class="osv-erro" role="alert">Confira o e-mail: parece que falta alguma coisa.</p>
  <p class="osv-aviso-lgpd">Ao se inscrever você concorda com a nossa <a href="/politica-de-privacidade">Política de Privacidade</a>.</p>
</form>
```

O resto está em `guia-visual.html`: abra o bloco "Ver código" e copie.

---

## 8. Fatos da marca que você PODE usar

| Fato | Valor | Fonte |
|---|---|---|
| Alunos | 500+ | Lucas (04/10/2026) |
| Turmas | 10+ | idem |
| Seguidores no Instagram | 35 mil | idem |
| Início | 2022, pós-pandemia | historia-e-metodo |
| Economia em passagens | 30–90% | CONTEXTO-OSV |
| Lucas Alves | ex-bombeiro militar, 10M+ milhas, 13 cartões Black | CONTEXTO-OSV |
| Thay (Taína) Mafra | fez a volta ao mundo de executiva | CONTEXTO-OSV |
| Método | 3 etapas: Aprendizado · Acompanhamento (aulas mensais) · Prática (viagens) | historia-e-metodo |
| Viagens da comunidade | Fernando de Noronha, Peru, Curaçao, África do Sul | CONTEXTO-OSV |
| Instagram | @osegredodoviajante | manual-de-marca |
| Depoimento Érica (T05) | R$ 5.348 de economia, só taxas de embarque, Porto Velho → África | print WhatsApp |
| Depoimento Amanda | ~R$ 20 mil de economia, Orlando com a família | print WhatsApp |
| Depoimento Débora | "Entrar pra essa comunidade foi uma das melhores decisões da minha vida!" | print WhatsApp |

**Produtos:** PVI (Minha Primeira Viagem Internacional, método V.O.O.) · Comunidade OSV (principal) · Mapa do Viajante (planner Notion) · Thay IA / Oráculo do Viajante · Concierge OSV · Viagens OSV.

### ⚠️ Pendentes: NÃO usar sem confirmar com o Lucas
- **Preço da Comunidade** (as fontes divergem: R$ 997 → R$ 1.297 → R$ 129,90/mês).
- **Garantia** (7 ou 30 dias).
- Número de leitores da newsletter.

Para esses, escreva o marcador `[PENDENTE: …]`.

### Fotos disponíveis em `assets/img/`
| Arquivo | Mostra | Bom para |
|---|---|---|
| `viagem-peru.jpg` | Grupo comemorando em Machu Picchu | Hero, vitrine larga |
| `viagem-noronha.jpg` | Grupo no mirante de Noronha | Pôster, fundo com foto |
| `viagem-praia.jpg` | Grupo na praia com a bandeira OSV | Pôster, comunidade |
| `viagem-jalapao.jpg` | Grupo em cima das caminhonetes no Jalapão | Pôster |
| `viagem-safari.jpg` | Grupo com bandeiras do Brasil e da África do Sul | Pôster |
| `fundadores-peru.jpg` | Lucas e Thay caminhando no Peru (vertical) | Seção fundadores, 4:5 |
| `lucas-executiva.jpg` | Lucas sentado na classe executiva | Fundador, prova de conforto |
| `thay-executiva.jpg` | Thay na executiva (**225×300, só miniatura/avatar**) | `osv-fundador__foto` |
| `area-membros.jpg` | Print da área de membros | Mockup de "por dentro" |
| `depo-erica.jpg` · `depo-amanda.jpg` · `depo-debora.jpg` | Prints reais de WhatsApp | `osv-print` |

Logos (SVG oficiais 2026, recortados): `assets/marca/osv-logo-branco.svg` (fundo escuro), `assets/marca/osv-logo-preto.svg` (fundo branco), Regras de uso, área de proteção e usos proibidos: `../manual-de-marca.html`. **Nunca** recrie o logo com fonte, use filtro CSS, versão monocromática ou coloque o logo sobre fundo laranja: o "do" é sempre laranja.

---

## 9. Checklist antes de entregar

- [ ] Renderizei a página (não entreguei código sem ver).
- [ ] A 375px não há rolagem horizontal (`scrollWidth === clientWidth`).
- [ ] Console sem erros; fontes carregadas.
- [ ] Um `h1`; níveis de título em ordem.
- [ ] Toda seção tem superfície; escuro e branco alternam; laranja no máximo 1 vez.
- [ ] Um primário por dobra; no máximo um destaque por título; nenhum itálico e nenhum pontilhado.
- [ ] Nenhum hex, px ou fonte solta no HTML.
- [ ] Nenhum número, preço ou depoimento fora da seção 8; pendências marcadas.
- [ ] Tab percorre tudo com foco visível; ESC fecha menu e lightbox.
- [ ] Com "reduzir movimento" ligado, tudo aparece.

---

## 10. Repertório v2.2: varie entre as páginas

O Lucas escolheu um repertório para **não repetir a mesma cara em todas as páginas**. Cada página escolhe **1 hero, até 2 fundos animados, 1 ou 2 entradas de título e os botões certos para cada momento**. Exemplos vivos e código: `guia-visual.html` (seções Heróis, Fundos animados, Entradas de título, Botões, Cards, Prova social, Formulários, Feedback).

### Heróis (`.osv-hero` + superfície + fundos)
| Código | Hero | Quando usar |
|---|---|---|
| H1 | **Chão de mapa** centralizado: `osv-fundo--chao` | Home, páginas de venda (padrão) |
| H2 | **Janela de avião** dividida: `.osv-janela` | Captura, newsletter, Mapa do Viajante |
| H3 | **Cartão de embarque**: `.osv-embarque` com `osv-roda` no destino | Lançamento, evento, Viagens OSV, turma aberta |
| H4 | **Globo com rota**: `.osv-globo` | Institucional, Thay IA, Concierge |
| H5 | **Foto em tela cheia**: `osv-fundo--foto` + `osv-fundo--aurora` | Viagens OSV, página emocional, obrigado |

### Fundos animados (um `<div class="osv-fundo osv-fundo--X">` cada; máximo 2 + grão)
`--chao` (avanço) · `--holofotes` (fim de tarde, emocional) · `--aurora` (pôr do sol em faixa) · `--nuvens` (acima das nuvens, só no escuro) · `--raios` (raios de sol girando) · `--topo` (curvas de nível, mapa de relevo).

### Entradas de título (alterne; 1 tipo por seção)
- `data-texto="palavras"` (3A): desfoque palavra por palavra. É calmo e serve como padrão.
- `data-texto="corte"` (3B): sobe de dentro de uma máscara. É firme e editorial; use em método e provas.
- `<span class="osv-varre" data-varre="2400"><span>…</span><span>…</span></span>` (3C): varredura de cor trocando a frase. Use 1 por página, no hero ou no título-chave.

### Botões por momento
| Momento | Botão |
|---|---|
| Compra / inscrição / formulário | `osv-btn--joia` (4C) |
| CTA final, decisão, turma aberta | `osv-btn--contorna` (4A) |
| Secundário premium ao lado do principal | `osv-btn--holofote` (4B) |
| Ações comuns | `--primario`, `--contorno`, `--vidro`, `--link` |
Regra: **um botão de destaque (joia, contorna ou primário) por dobra.**

### Cards e prova
- `.osv-bento` (5B): mosaico com `__foto`, `__largo`, `__alto` e `__acento`, para números, resultados e "o que tem dentro".
- `.osv-card--feixe` (5C): luz girando na borda. **Só 1 por tela** (produto principal ou oferta).
- Faixas opostas (6A): duas `.osv-faixa[data-faixa]` com `.osv-depo-mini`; a segunda leva `.osv-faixa--reversa`.
- Cápsulas (6C): `.osv-capsula[data-lightbox="print.jpg"]` dentro de uma `.osv-faixa`. Abre o print real.
- Colunas de depoimentos: `.osv-colunas-depo[data-colunas-depo]` com 3 `ul.osv-colunas-depo__coluna[style="--duracao:15s"]` de `li.osv-depo-card`. É a seção principal de prova social em páginas de venda. Use pelo menos 3 depoimentos por coluna (repita os reais em outra ordem se faltar) e coloque `data-revelar="giro"` no container.

### Matriz sugerida por página
| Página | Hero | Fundos | Entradas | Botão principal |
|---|---|---|---|---|
| Home institucional | H1 | chão · holofotes | palavras + corte | joia → contorna no fim |
| Venda Comunidade | H1 | chão · topo | palavras + varre | joia |
| Venda PVI | H4 | raios · holofotes | corte | joia |
| Mapa do Viajante | H2 | topo | palavras | joia |
| Captura / Semana / live | H3 | holofotes · grão | corte | contorna |
| Newsletter | H2 | nuvens | palavras | primário |
| Viagens OSV | H5 | aurora | corte | contorna |
| Obrigado | H5 ou H1 curto | holofotes | palavras | primário (entrar no grupo) |

---

## 11. Formulários e feedback

| Peça | Classe / atributo |
|---|---|
| Campo | `.osv-campo` > `label` + `input/select/textarea` + `.osv-erro` + `.osv-sucesso` + `.osv-ajuda` |
| Campo com ícone / prefixo / ação | `.osv-entrada` + `.osv-entrada__icone` / `__prefixo` (ex.: +55) / `__acao` |
| Telefone BR | `input[type=tel][data-mascara=tel]` com `pattern="\(\d{2}\) \d{5}-\d{4}"` |
| Opcional / dica | `.osv-campo__rotulo` + `.osv-opcional` · `.osv-dica[data-dica="…"]` |
| Contador de caracteres | `textarea[maxlength]` + `.osv-contador` |
| Linha com 2 campos | `.osv-form__linha` |
| Checkbox / rádio | `label.osv-marca > input` |
| Chave (switch) | `label.osv-chave > input[type=checkbox][role=switch]` |
| Segmentos | `.osv-segmentos` (input rádio + label) |
| Cartões de opção (quiz/perfil) | `.osv-opcoes` > `label.osv-opcao > input + __icone + __titulo + __texto` |
| Upload | `label.osv-upload > input[type=file]` + `.osv-upload__arquivo` |
| Em etapas | `form[data-etapas]` + `.osv-etapas__barra` + `.osv-etapa` × N + botões `data-etapa-voltar/avancar/enviar` |
| Alertas | `.osv-alerta` (`--sucesso`, `--aviso`, `--erro`) + `[data-fechar-alerta]` |
| Toast | `[data-toast="mensagem"]` ou `OSV.toast("mensagem")` |
| Progresso / vagas | `.osv-progresso` + `.osv-progresso__barra[style="--valor:78%"]` (número real ou `[PENDENTE]`) |
| Abas | `[data-abas]` + `.osv-abas__aba[aria-controls]` + `.osv-abas__painel` |
| Calculadora | `.osv-calc[data-calc="fator"]`. O fator é **ilustrativo** até o Lucas confirmar |

Regras: o rótulo fica sempre visível (placeholder não substitui rótulo); a mensagem de erro fala como gente ("Conta pra gente seu nome"); todo formulário que coleta dado pessoal leva `.osv-aviso-lgpd` ou um checkbox de aceite.

---

## 12. Landing pages no padrão v2.3

Padrão aprovado pelo Lucas em 24/11/2026. Catálogo ao vivo: `guia-landing-pages.html`. Página pronta para copiar: `modelo-landing-page.html`.

**As 7 regras:** (1) a primeira dobra já deixa agir (formulário ou captura no card); (2) foto real na abertura; (3) imersão, depois respiro; (4) seção centralizada, depois seção dividida; (5) uma ideia e um destaque por título; (6) número com rótulo, sem enfeite; (7) um botão laranja por dobra.

**Ordem da página modelo:** hero com foto → manifesto → prova → método → viagens ou produtos → benefícios → resultados → chamada final. As três do meio respondem as três objeções: isso é verdade, isso é para mim, o que eu vou ganhar.

| Classe | Para quê |
|---|---|
| `osv-hero-foto` (`--curto`) + `osv-fundo--foto` | Hero com foto real e véu do lado do texto |
| `osv-hero-foto__corpo` · `osv-hero-foto__texto` | Colunas do hero: texto à esquerda, card à direita |
| `osv-flutua` + `osv-sup--branco` (ou `osv-flutua--vidro`) | Card flutuante com a ação principal |
| `osv-segmentos--neutro` | Abas em pílula com seleção branca, dentro do card |
| `osv-btn-duo` + `osv-btn-duo__seta` | Botão secundário com círculo, sem laranja |
| `osv-manifesto` + `osv-manifesto__foto` | Frase única com fotos em pílula no meio do texto |
| `osv-numeros` + `__linha` / `__valor` / `__legenda` | Prova em linhas, como tabela |
| `osv-mosaico` + `__item` (`--largo`, `--estreito`, `--inteiro`, `--texto`) | Cards de foto em tamanhos variados |
| `osv-colunas-fio` (`style="--n:3"`) | Benefícios separados por linha, sem caixa |
| `osv-card--liso` | Card de fundo chapado, sem brilho |
| `osv-secao--alt` | Segunda seção clara (ou escura) seguida |

Fundos em landing page: no máximo dois efeitos e o grão nas seções escuras; nenhum nas claras. Para app e plataforma existe outro material (linha de sistema), com regras próprias.
