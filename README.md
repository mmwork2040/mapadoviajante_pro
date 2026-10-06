# Mapa do Viajante - PRO

Preciso implementar o sistema configurado através deste projeto no GitHub: https://github.com/mmwork2040/mapa-do-viajante.git

Código hospedado no GitHub e publicado pela Vercel.

**App em produção**: https://mapadoviajante-pro.vercel.app

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Roteiros compartilháveis

O link do viajante usa uma rota de leitura no servidor para carregar o roteiro, seus dias e atividades após conferir o `share_token`. Configure `APPWRITE_API_KEY` **somente no ambiente do servidor** com permissão de leitura para `crm_itineraries`, `crm_itinerary_days` e `crm_itinerary_activities`. O endpoint, projeto e banco usam `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` e `APPWRITE_DATABASE_ID`, com fallback para os respectivos valores `VITE_APPWRITE_*` já existentes. Não coloque a chave em variável `VITE_*` nem no navegador.

O botão de compartilhar só copia ou abre o link depois de validar que a rota pública respondeu com sucesso. O PDF é salvo pelo diálogo de impressão do navegador. No cabeçalho do roteiro, o botão PDF abre uma página de impressão e inicia esse diálogo automaticamente; o botão na própria página permite reabri-lo.
