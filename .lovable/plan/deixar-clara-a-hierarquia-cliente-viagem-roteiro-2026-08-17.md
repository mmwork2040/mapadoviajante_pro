# Deixar clara a hierarquia Cliente > Viagem > Roteiro

## Como está hoje (verificado no código)

- Cada roteiro em `crm_itineraries` já é filho de uma venda (`lead_id`) que, por sua vez, aponta para o cliente (`client_id`). Todos os roteiros existentes têm venda vinculada.
- Na aba **Vendas**, o modal de detalhes da viagem reúne Checklist, Financeiro, Benefícios, Notas e Atividades.
- Na aba **Viagens** já foram adicionados: menu de 3 pontos com "Detalhes da viagem", "Checklist", "Financeiro" e "Perfil do cliente", além do badge "Venda: <status>" no card.
- Na página de um roteiro já existem o breadcrumb Cliente › Viagem › Roteiro e o botão "Detalhes da viagem".

O que ainda falta é deixar isso **evidente** e completo dentro da própria aba Viagens.

## Ajustes propostos

1. **Barra de abas dentro do modal aberto pela Viagem**
   Garantir que ao abrir "Detalhes da viagem" a partir da aba Viagens o modal traga exatamente as mesmas abas da aba Vendas (Checklist, Roteiro, Financeiro, Benefícios, Notas, Atividades), com edição liberada quando o status não for Fechado/Perdido.

2. **Acesso rápido no próprio card da Viagem**
   Além do menu de 3 pontos, adicionar no rodapé do card ícones diretos para Checklist, Financeiro e Detalhes, para não depender do menu.

3. **Cabeçalho da aba Viagens**
   Subtítulo explicando a lógica: "Cada viagem pertence a um cliente e a uma venda. O roteiro é o conteúdo dia a dia; checklist, financeiro e benefícios ficam nos detalhes da viagem."

4. **Dentro do roteiro (`/roteiros/:id`)**
   Manter o botão "Detalhes da viagem" visível no topo e adicionar atalhos que abrem o modal já na aba Checklist e na aba Financeiro.

5. **Nome do cliente clicável**
   No card da Viagem, o nome do cliente leva ao perfil (`/clientes/:id`), preservando a rota de origem para o botão Voltar.

6. **Aviso quando a viagem não tem venda vinculada**
   Se algum roteiro ficar sem `lead_id`, exibir badge "Sem venda vinculada" e uma ação para vincular a uma venda existente ou criar uma nova proposta.

## Detalhes técnicos

- Arquivos: `src/routes/_app.roteiros.index.tsx`, `src/routes/_app.roteiros.$id.tsx`, `src/components/LeadDetailDrawer.tsx`.
- Reuso do `LeadDetailDrawer` (já importado nas duas rotas) com `initialTab` para abrir direto em Checklist/Financeiro.
- Invalidação de `["itineraries"]`, `["leads"]` e `["itinerary", id]` ao fechar o modal, para refletir alterações feitas nas abas.
- Sem mudanças de banco de dados.
