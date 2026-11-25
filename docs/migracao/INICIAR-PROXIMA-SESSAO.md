# Como iniciar a próxima sessão

## Antes de abrir a sessão

Ter em mãos (perguntas P1 a P9 do `PLANO-MESTRE.md`):

1. **O repositório e a branch do app que já usa o Appwrite** (provavelmente `mmwork2040/mapadoviajante_pro`). A sessão precisa ser aberta **com esse repositório** e também com este (`mmwork2040/crmosegredodoviajante`, branch `claude/relaxed-mendel-k8rfnz`), onde estão o protótipo, a identidade e este plano.
2. **O ID do projeto Appwrite** e o ID do banco. O servidor é `https://appwrite.agenc-ia.net`. A conexão com ele já existe no ambiente; só falta o projeto.
3. Onde o app é publicado e o domínio.
4. Se os dados antigos já estão no Appwrite, e em quais coleções.
5. Se as decisões D1 a D6 do plano anterior continuam valendo (acesso pela Hotmart, Asaas desligado, IA com chave no servidor, skills de guia).
6. Os arquivos de referência das skills de guia e o modelo de contrato, se já existirem.

## Texto para colar ao abrir a sessão

```
Vamos executar a migração do CRM OSV para o desenho novo, rodando só no Appwrite.

Leia primeiro, no repositório mmwork2040/crmosegredodoviajante (branch claude/relaxed-mendel-k8rfnz):
- docs/migracao/PLANO-MESTRE.md (fases, decisões e definição de pronto)
- docs/migracao/MODELO-DE-DADOS-APPWRITE.md
- docs/migracao/ESPECIFICACAO-TELAS.md
- docs/prototipo-crm/ (o protótipo aprovado; abra index.html e use como gabarito)
- docs/identidade/ e docs/skills/

O app que roda no Appwrite está em: <REPOSITÓRIO E BRANCH>.
Projeto Appwrite: <ID DO PROJETO>, banco: <ID DO BANCO>, servidor https://appwrite.agenc-ia.net.
Publicação: <ONDE E DOMÍNIO>.
Dados antigos: <ONDE ESTÃO>.
Decisões D1 a D6: <CONFIRMADAS OU AJUSTES>.

Comece pela Fase 0 (Descoberta e base): responda as perguntas abertas com o que eu passei, faça o inventário do Appwrite (somente leitura), liste e corrija tudo que ainda aponta para Supabase ou Lovable, e traga a fase visual já feita (commit 9befff1). Não altere dados nem estrutura do Appwrite sem me mostrar o plano da mudança antes. Trabalhe em branch e me mostre prints a cada tela.
```

## Ordem sugerida das sessões

| Sessão | Fase | Resultado esperado |
|---|---|---|
| 1 | F0 Descoberta e base | Inventário do Appwrite, app rodando só no Appwrite, fase visual aplicada |
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

A Fase 13 (segurança e acesso) entra aos poucos: permissões na F2, links públicos na F5 e F12, Hotmart e super admin numa sessão própria quando P6 e P7 estiverem respondidas.
