# CRM OSV (Mapa do Viajante PRO)

CRM de consultoria de viagens d'O Segredo do Viajante. O único backend é o **Appwrite**
(`https://appwrite.agenc-ia.net`): banco, login, arquivos e tempo real.

- **Código:** GitHub. **Publicação:** Vercel, a partir da branch `main`.
- **App em produção:** https://mapadoviajante-pro.vercel.app
- **Plano da migração para o desenho novo:** `docs/migracao/PLANO-MESTRE.md`
- **Protótipo aprovado (especificação visual):** `docs/prototipo-crm/index.html`
- **Segurança e variáveis do servidor:** `docs/SEGURANCA_APPWRITE.md`

## Rodar no computador

Precisa de Node.js 22 e npm.

```sh
npm ci
cp .env.example .env   # os valores públicos já vêm preenchidos
npm run dev            # http://localhost:8080
```

Antes de abrir um pull request:

```sh
npm run typecheck
npm run build
```

O CI (`.github/workflows/ci.yml`) roda os dois e recusa qualquer referência a outro backend.

## Variáveis de ambiente

Veja `.env.example`. As `VITE_*` são públicas. Os segredos (`APPWRITE_API_KEY`, chaves de IA,
contas de serviço do Google, segredo do n8n) ficam **só no servidor**, configurados na Vercel.

## Roteiros compartilháveis

O link do viajante usa uma rota de leitura no servidor para carregar o roteiro, seus dias e
atividades depois de conferir o `share_token`. Ela precisa de `APPWRITE_API_KEY` com leitura em
`crm_itineraries`, `crm_itinerary_days` e `crm_itinerary_activities`.

O botão de compartilhar só copia ou abre o link depois de validar que a rota pública respondeu.
O PDF é salvo pelo diálogo de impressão do navegador.
