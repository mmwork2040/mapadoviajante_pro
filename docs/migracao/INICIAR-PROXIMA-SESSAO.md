# Como iniciar a próxima sessão

A Fase 0 foi feita em 25/11/2026, na branch `claude/epic-sagan-g4n8l2` do repositório `mmwork2040/mapadoviajante_pro`. Tudo o que o plano precisa (este plano, o protótipo, a identidade e as skills) agora está em `docs/` deste repositório. Não é mais preciso abrir a sessão com o `crmosegredodoviajante`.

## Antes de abrir a sessão

1. **Fechar o banco** (`inventario-appwrite.md`, seção 1): aprovar o plano e rodar o script com uma chave temporária.
2. **Chave de leitura do Appwrite** no ambiente da sessão, para o host `appwrite.agenc-ia.net`, no cabeçalho `X-Appwrite-Key` (escopos na seção 6 do inventário). A chave anterior foi recusada pelo servidor.
3. **Juntar a branch da Fase 0 na `main`** depois de conferir a prévia da Vercel.
4. Responder o que ficou aberto: P6 (multiagência e Hotmart), P7 (decisões D1 e D5), P8 (arquivos de referência das skills) e P9 (modelo de contrato e termos).

## Texto para colar ao abrir a sessão

```
Vamos continuar a migração do CRM OSV para o desenho novo, rodando só no Appwrite.

Leia primeiro, neste repositório (mmwork2040/mapadoviajante_pro):
- docs/migracao/PLANO-MESTRE.md (fases, decisões, respostas da Fase 0 e definição de pronto)
- docs/migracao/inventario-appwrite.md
- docs/migracao/MODELO-DE-DADOS-APPWRITE.md
- docs/migracao/ESPECIFICACAO-TELAS.md
- docs/prototipo-crm/ (o protótipo aprovado; abra index.html e use como gabarito)
- docs/identidade/ e docs/skills/

A Fase 0 está feita. Comece completando o inventário do Appwrite com a chave de leitura
(somente leitura) e depois faça a Fase 1 (Design system): os componentes e a casca do app
iguais ao protótipo, com a página /dev/ui nos dois temas e a 390 px.

Respostas que faltavam: P6 <...>, P7 <...>, P8 <...>, P9 <...>.

Não altere dados nem estrutura do Appwrite sem me mostrar o plano da mudança antes.
Trabalhe em branch e me mostre prints a cada tela.
```

## Ordem sugerida das sessões

| Sessão | Fase | Resultado esperado |
|---|---|---|
| 1 (feita) | F0 Descoberta e base | Inventário do Appwrite, app rodando só no Appwrite, fase visual aplicada |
| 2 | F1 Design system | Componentes e casca do app iguais ao protótipo, com a página `/dev/ui` |
| 3 e 4 | F2 Dados | Coleções, permissões, camada `src/data/`, migração ensaiada numa cópia |
| 5 | F3 Viajantes | Tela completa com os três modos e Planejar viagem |
| 6 e 7 | F4 Viagens · Comercial | Quadro, lista, ficha e nova viagem |
| 8 e 9 | F5 Proposta e contrato | Editor, termos, página do cliente, assinatura e pagamento manual |
| 10 a 12 | F6 Preparação e página da viagem | Roteiro, checklist, financeiro, documentos e envio |
| 13 | F7 e F8 Agenda e Hoje | Agenda com datas automáticas e o painel Hoje |
| 14 e 15 | F9 Biblioteca | Criar com IA e a partir de PDF, com revisão |
| 16 e 17 | F10 Gestão | Financeiro, equipe e configurações |
| 18 a 21 | F11 IA e guias | Assistente único e geração do guia com as skills |
| 22 e 23 | F12 Cliente final | Páginas públicas, captação e app do viajante |
| 24 | F14 Lançamento | Testes, migração final e treinamento |

A Fase 13 (segurança e acesso) entra aos poucos: fechar o banco agora, permissões por agência na F2, links públicos na F5 e F12, Hotmart e super admin numa sessão própria quando P6 e P7 estiverem respondidas.
