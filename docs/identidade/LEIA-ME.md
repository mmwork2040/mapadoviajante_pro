# OSV · Identidade visual · pacote de 24/11/2026

A identidade segue duas linhas. As duas usam o mesmo logo, o mesmo laranja (#F58E26), League Spartan nos títulos e Inter no texto. Em nenhuma existe itálico, DM Sans ou rota pontilhada.

| Linha | Para quê | Títulos | Fundos |
|---|---|---|---|
| **Marca** (`marca/`) | Site, landing pages, peças gráficas | League Spartan 800 | Foto, brilho, grade |
| **Sistema** (`plataforma/`) | App e plataforma | League Spartan 600 (grandes) e 700 (pequenos) | Lisos; laranja só em ação, seleção e progresso |

## marca/

| Arquivo | O que é |
|---|---|
| `manual-de-marca.html` | Manual de marca: logo, cores, tipografia, elementos, aplicações. Revisado em 24/11. |
| `design-system-v2.3/guia-visual.html` | **Guia visual atualizado.** Catálogo de todos os componentes, com o código de cada um. |
| `design-system-v2.3/guia-landing-pages.html` | **Guia de landing pages.** As 7 regras, a ordem das dobras, as peças novas e as receitas por tipo de página. |
| `design-system-v2.3/modelo-landing-page.html` | Landing page completa no padrão novo, pronta para copiar. |
| `design-system-v2.3/index.html` | Home institucional de referência. |
| `design-system-v2.3/modelo-pagina.html` | Esqueleto em branco. |
| `design-system-v2.3/PARA-IA.md` | Contrato para qualquer IA que for montar páginas. |
| `design-system-v2.3/LEIA-ME.md` | Estrutura, decisões e pendências do sistema. |
| `design-system-v2.3/assets/` | `tokens.css`, `biblioteca.css`, `runtime.js`, fotos e logos. |
| `fotos/` · `logos/` | Fotos e logos oficiais usados pelo manual. |

Abra os `.html` com duplo clique. Eles precisam ficar junto das pastas `assets/`, `fotos/` e `logos/`.

## plataforma/

| Arquivo | O que é |
|---|---|
| `guia-de-composicao.html` | Como montar qualquer tela do app: princípios, efeitos e composição. |
| `manual-de-css.html` | Manual de CSS para apps: tokens, layout, controles, gráficos e estados, com o código. |
| `osv-app.css` · `osv-app.js` | A folha de estilo e o JS de apoio do manual. |
| `prototipo-app-v24.html` | Protótipo navegável do app, com 25 telas. Dados de exemplo. |

Os três `.html` da plataforma são arquivos únicos: funcionam sozinhos.

## O que mudou nesta revisão

1. **Sem itálico.** A palavra de destaque do título agora é laranja, na mesma fonte e no mesmo peso do título (`.osv-destaque`). A classe antiga `.osv-script` continua funcionando, já sem itálico.
2. **Inter no lugar da DM Sans**, em todo o sistema da marca. É a mesma fonte de texto da plataforma.
3. **Rota em linha contínua com paradas.** O pontilhado ficou só dentro do logo oficial.
4. **Peças de landing page** na biblioteca: hero com foto e card flutuante, botão com círculo, manifesto, prova em linhas, mosaico de fotos, colunas com fio, card liso.
5. **Plataforma:** sem brilho laranja em banners e cards; destaque é só a borda; brilho só na caixa de digitação.

## Ficou como estava (decisão sua)

- **Palavra manuscrita nas capas** (manual de marca, seção Aplicações). Ela repete o "do" do logo e as capas atuais da área de membros. Não é itálico, mas é da mesma família de recurso.
- **Tracejado** no picote do cartão de embarque, no teaser trancado e na área de upload. São convenções desses objetos, não a rota.
- **Faixa laranja** (`osv-sup--laranja`). Segue disponível, no máximo uma por página.

## Pendências antes de publicar qualquer página

Preço vigente da Comunidade · garantia de 7 ou 30 dias · autorização de imagem das fotos e prints com alunos · links reais · política de privacidade.
