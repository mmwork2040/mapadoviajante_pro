# Roteiro Kanban + Visão do Viajante

## 1. Editor do consultor — board Kanban (`src/routes/_app.roteiros.$id.tsx`)

Transformar a edição vertical de dias em um **quadro Kanban horizontal**, onde cada dia é uma coluna.

- Cada dia vira uma **coluna de largura fixa** (`w-80`), dispostas lado a lado com **rolagem horizontal** (`overflow-x-auto`).
- Manter a paleta de blocos arrastáveis fixa no topo (Voo, Hospedagem, Atividade, Transfer, Restaurante).
- Manter toda a lógica atual de `@dnd-kit`:
  - arrastar blocos da paleta para dentro de uma coluna/dia;
  - reordenar itens dentro do dia;
  - mover itens entre dias (atualizando `sort_order` e `day_id`).
- Cada coluna mostra: título do dia, data, botão de adicionar item manual, botão de excluir dia, e a lista de atividades (`SortableActivity`).
- Botão "Adicionar dia" como uma coluna final compacta.
- Preservar: voucher, chat flutuante de IA, status do roteiro, "Limpar roteiro".

```text
[ Paleta: Voo | Hospedagem | Atividade | Transfer | Restaurante ]
┌─Dia 1───┐ ┌─Dia 2───┐ ┌─Dia 3───┐ ┌─+ Dia─┐
│ item    │ │ item    │ │ item    │ │       │
│ item    │ │ item    │ │         │ │       │
└─────────┘ └─────────┘ └─────────┘ └───────┘
   ←——————— rolagem horizontal ———————→
```

## 2. Visão do viajante (`src/routes/viajante.$id.tsx`)

Reformular a página pública para uma apresentação rica, seguindo o print de referência:

- **Hero** com destino, datas e nº de passageiros.
- Blocos agrupados de **Voos** e **Hospedagem** (extraídos das atividades por tipo), com ícones, horários, códigos e valores.
- **Itinerário dia a dia** em timeline refinada.
- Rodapé da marca.
- Observação técnica: o schema não tem campos de imagem para hotéis; serão usados ícones/placeholders inicialmente.

## Detalhes técnicos

- Sem mudanças de schema nem de lógica de negócio; apenas UI + reorganização de DnD.
- Reaproveitar `DayCard`/`SortableActivity` adaptando o layout para coluna.
- Tokens semânticos do design system (sem cores hardcoded).
