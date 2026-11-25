## Diagnóstico do estado atual

Verificado no código e no banco:

- **Vendas (`/leads`)**: o card abre o `LeadDetailDrawer`, que já concentra tudo da viagem — abas Perfil, Viagem, Atividades, Checklist, Financeiro, Benefícios e Notas, além de editar a proposta e criar/salvar o roteiro.
- **Viagens (`/roteiros`)**: o card só leva ao roteiro (`/roteiros/$id`) — blocos de dias, atividades, documentos, PDF. Não há acesso ao checklist, financeiro, benefícios, notas nem às atividades. O menu de 3 pontos só tem Abrir / Mover status / Duplicar / Excluir.
- **A ligação existe**: todo roteiro tem `lead_id` preenchido (6 de 6 hoje), e a página do roteiro já carrega o lead vinculado para editar o cliente no cabeçalho.

Ou seja: a hierarquia Cliente > Viagem > (roteiro, checklist, financeiro...) está correta nos dados, mas na aba Viagens falta a porta de entrada para esses dados.

## Ajustes propostos

### 1. Painel completo a partir do card da aba Viagens
Em `src/routes/_app.roteiros.index.tsx`:
- Novo item no menu de 3 pontos: **"Detalhes da viagem"**, abrindo o `LeadDetailDrawer` do `lead_id` do roteiro na própria página (sem ir para Vendas).
- Atalhos diretos para **Checklist** e **Financeiro** usando a prop `initialTab` que o drawer já aceita.
- Roteiro sem `lead_id` (caso legado): itens desabilitados com aviso.

### 2. Acesso pelo cabeçalho do roteiro
Em `src/routes/_app.roteiros.$id.tsx`:
- Botão **"Detalhes da viagem"** no cabeçalho, abrindo o mesmo drawer sobre a página do roteiro (o lead já é carregado ali).
- Ao fechar, invalidar as queries do roteiro/lista para refletir mudanças de status e valores.

### 3. Clareza da hierarquia
- No card da aba Viagens: nome do cliente como link para o perfil (`/clientes/$id`, com `from` para o voltar correto) e o status da venda ao lado do status do roteiro.
- No cabeçalho do roteiro: breadcrumb curto **Cliente › Viagem › Roteiro**.

### 4. Sem mudanças de banco
Nenhuma tabela, coluna ou RLS nova — apenas reuso do `LeadDetailDrawer` e navegação.

## Detalhes técnicos

- `LeadDetailDrawer({ leadId, onClose, initialTab })` já é reusado em `/leads`, `/clientes/$id` e `/tarefas`; o contrato não muda.
- Estado local `detailLeadId` + `detailTab` nas duas rotas de roteiros.
- `fetchItineraries` já traz `lead:crm_leads(...)`; incluir `id` e `client_id` no select para montar os links de cliente.

## Verificação

- Na aba Viagens, "Detalhes da viagem" mostra checklist, financeiro, benefícios, notas e atividades da mesma viagem vista em Vendas.
- Alterar status pelo drawer reflete no Kanban de Viagens ao fechar.
- Roteiro sem lead vinculado não quebra a tela.
