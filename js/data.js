/* ══════════════════════════════════════════════════════════════
   DUMMY DATA — All static data for Module 1
   ══════════════════════════════════════════════════════════════ */

// ── Team Members (mirrors USERS_DB in auth.js) ──────────────
const TEAM_MEMBERS = [
  { id: 1, name: 'Lucas Felipe',    avatar: 'LF', role: 'admin',     roleLabel: 'Administrador', color: '#F58E26', status: 'online' },
  { id: 2, name: 'Ana Costa',       avatar: 'AC', role: 'gerente',   roleLabel: 'Gerente',       color: '#3B82F6', status: 'online' },
  { id: 3, name: 'Pedro Mendes',    avatar: 'PM', role: 'consultor', roleLabel: 'Consultor',     color: '#10B981', status: 'online' },
  { id: 4, name: 'Juliana Ferreira',avatar: 'JF', role: 'consultor', roleLabel: 'Consultor',     color: '#8B5CF6', status: 'offline' },
  { id: 5, name: 'Carlos Souza',    avatar: 'CS', role: 'gerente',   roleLabel: 'Gerente',       color: '#EF4444', status: 'offline' },
];

// ── Lead Activities (per lead, keyed by lead ID) ────────────
const LEAD_ACTIVITIES = {
  // Família Santos
  1: [
    { id: 101, type: 'call',       title: 'Ligação de follow-up — cotação Europa',      author: 1, date: '2025-06-10T14:30:00', mentions: [], details: 'Cliente confirmou interesse em Lisboa + Porto. Quer incluir Sintra.' },
    { id: 102, type: 'assignment',  title: 'Montar orçamento detalhado com hotéis 4★',   author: 1, date: '2025-06-09T11:00:00', mentions: [3], assignedTo: 3, details: '@Pedro Mendes, prepare o orçamento de hotéis em Lisboa e Porto para 4 pax. Prazo: sexta-feira.' },
    { id: 103, type: 'email',      title: 'Enviado e-mail com opções de voos',           author: 3, date: '2025-06-08T16:45:00', mentions: [], details: 'Apresentei 3 opções LATAM (direto) e 2 TAP (escala Madrid). Cliente prefere voo direto.' },
    { id: 104, type: 'note',       title: 'Cliente mencionou restrição alimentar',       author: 3, date: '2025-06-07T10:20:00', mentions: [1], details: 'Esposa é celíaca. @Lucas Felipe, lembrar de solicitar refeição especial no voo e verificar opções nos restaurantes.' },
    { id: 105, type: 'status',     title: 'Status alterado para "Em Negociação"',        author: 1, date: '2025-06-06T09:00:00', mentions: [], details: '' },
    { id: 106, type: 'whatsapp',   title: 'Primeiro contato via WhatsApp',               author: 1, date: '2025-06-05T18:30:00', mentions: [], details: 'Cliente veio por indicação. Quer viajar em julho com a família (4 pessoas).' },
  ],
  // Casal Oliveira
  2: [
    { id: 201, type: 'done',       title: '🎉 Venda fechada! Pacote Curaçao confirmado', author: 2, date: '2025-06-07T15:00:00', mentions: [1], details: 'All-inclusive Dreams Curaçao, 7 noites. R$ 12.400 total. Comissão 12%. @Lucas Felipe, aprovar comissão.' },
    { id: 202, type: 'document',   title: 'Vouchers enviados ao cliente',                author: 3, date: '2025-06-06T14:00:00', mentions: [], details: 'Enviados: e-ticket Copa CM726, reserva Dreams Curaçao, seguro Travel Ace.' },
    { id: 203, type: 'assignment',  title: 'Verificar seguro viagem — cobertura COVID',   author: 2, date: '2025-06-05T10:00:00', mentions: [4], assignedTo: 4, details: '@Juliana Ferreira, confirmar se a apólice cobre COVID e esportes aquáticos.' },
    { id: 204, type: 'call',       title: 'Ligação para fechar negociação',               author: 2, date: '2025-06-04T16:30:00', mentions: [], details: 'Casal aceitou a proposta final. Vai fazer pagamento via PIX amanhã.' },
  ],
  // Maria Silva
  3: [
    { id: 301, type: 'whatsapp',   title: 'Primeiro contato — veio do Instagram',        author: 3, date: '2025-06-09T11:15:00', mentions: [], details: 'Comentou no post de Noronha e mandou DM. Quer orçamento para 2 pessoas.' },
    { id: 302, type: 'assignment',  title: 'Preparar apresentação de Noronha',            author: 3, date: '2025-06-09T11:30:00', mentions: [4], assignedTo: 4, details: '@Juliana Ferreira, monta a apresentação premium com as pousadas parceiras?' },
  ],
  // Roberto Almeida
  4: [
    { id: 401, type: 'call',       title: 'Follow-up sobre roteiro Peru',                author: 1, date: '2025-06-05T14:00:00', mentions: [], details: 'Roberto quer incluir Machu Picchu, Cusco e Sacred Valley. Orçamento: até R$ 15.200.' },
    { id: 402, type: 'assignment',  title: 'Pesquisar trens Peru Rail — horários agosto', author: 1, date: '2025-06-05T14:30:00', mentions: [3, 4], assignedTo: 3, details: '@Pedro Mendes e @Juliana Ferreira, precisamos dos horários do Peru Rail para agosto. Prioridade alta.' },
    { id: 403, type: 'note',       title: 'Cliente tem medo de altitude',                author: 3, date: '2025-06-04T09:00:00', mentions: [2], details: 'Roberto mencionou que tem receio com altitude. @Ana Costa, sugere incluir dia de aclimatação em Cusco?' },
  ],
  // Ana Costa (lead)
  5: [
    { id: 501, type: 'whatsapp',   title: 'Contato inicial — lua de mel',                author: 3, date: '2025-06-09T09:00:00', mentions: [], details: 'Casal quer lua de mel em agosto. Aruba é a primeira opção. Orçamento flexível.' },
    { id: 502, type: 'assignment',  title: 'Cotar resorts all-inclusive Aruba',            author: 3, date: '2025-06-09T09:15:00', mentions: [4], assignedTo: 4, details: '@Juliana Ferreira, cota os resorts Marriott, Hyatt e Ritz-Carlton para agosto, 7 noites, casal.' },
  ],
  // Pedro Mendes (lead)
  6: [
    { id: 601, type: 'meeting',    title: 'Reunião presencial — roteiro Grécia',         author: 2, date: '2025-06-06T10:00:00', mentions: [1], details: 'Grupo de 6 amigos. Querem Atenas + Mykonos + Santorini. Budget: R$ 22k total. @Lucas Felipe, esse lead é grande.' },
    { id: 602, type: 'assignment',  title: 'Montar roteiro base 10 dias Grécia',          author: 2, date: '2025-06-06T10:30:00', mentions: [3], assignedTo: 3, details: '@Pedro Mendes, monta o roteiro base: 3 noites Atenas, 3 Mykonos, 3 Santorini + transfers.' },
  ],
};


const LEADS = [
  { id: 1, name: 'Família Santos', email: 'santos@email.com', phone: '(11) 98877-6655', destination: 'Lisboa', value: 18500, status: 'negotiating', lastActivity: '2025-06-08', notes: 'Interessados em 10 dias pela Europa' },
  { id: 2, name: 'Casal Oliveira', email: 'oliveira@email.com', phone: '(21) 97766-5544', destination: 'Curaçao', value: 12400, status: 'closed', lastActivity: '2025-06-07', notes: 'Pacote all-inclusive confirmado' },
  { id: 3, name: 'Maria Silva', email: 'maria@email.com', phone: '(31) 99988-7766', destination: 'Fernando de Noronha', value: 8900, status: 'new', lastActivity: '2025-06-09', notes: 'Veio pelo Instagram' },
  { id: 4, name: 'Roberto Almeida', email: 'roberto@email.com', phone: '(41) 96655-4433', destination: 'Peru', value: 15200, status: 'negotiating', lastActivity: '2025-06-05', notes: 'Quer incluir Machu Picchu e Cusco' },
  { id: 5, name: 'Ana Costa', email: 'ana.costa@email.com', phone: '(51) 95544-3322', destination: 'Aruba', value: 9800, status: 'new', lastActivity: '2025-06-09', notes: 'Lua de mel em agosto' },
  { id: 6, name: 'Pedro Mendes', email: 'pedro@email.com', phone: '(61) 94433-2211', destination: 'Grécia', value: 22000, status: 'negotiating', lastActivity: '2025-06-06', notes: 'Grupo de 6 pessoas, ilhas gregas' },
  { id: 7, name: 'Juliana Ferreira', email: 'juf@email.com', phone: '(71) 93322-1100', destination: 'Maldivas', value: 35000, status: 'negotiating', lastActivity: '2025-06-04', notes: 'Viagem de aniversário de casamento' },
  { id: 8, name: 'Carlos Souza', email: 'carlos@email.com', phone: '(81) 92211-0099', destination: 'Lisboa', value: 11000, status: 'closed', lastActivity: '2025-06-03', notes: 'Viagem solo, 15 dias' },
  { id: 9, name: 'Mariana Lima', email: 'mariana@email.com', phone: '(91) 91100-9988', destination: 'Curaçao', value: 7500, status: 'lost', lastActivity: '2025-06-01', notes: 'Desistiu por questões financeiras' },
  { id: 10, name: 'Felipe Torres', email: 'felipe.t@email.com', phone: '(11) 90099-8877', destination: 'Fernando de Noronha', value: 6200, status: 'new', lastActivity: '2025-06-09', notes: 'Viagem com filhos, 4 dias' },
  { id: 11, name: 'Beatriz Rocha', email: 'bea@email.com', phone: '(21) 98776-5432', destination: 'Peru', value: 13600, status: 'closed', lastActivity: '2025-06-02', notes: 'Roteiro aventura confirmado' },
  { id: 12, name: 'Thiago Nascimento', email: 'thiago@email.com', phone: '(31) 97654-3210', destination: 'Aruba', value: 14800, status: 'lost', lastActivity: '2025-05-28', notes: 'Preferiu outro destino' },
  { id: 13, name: 'Larissa Campos', email: 'larissa@email.com', phone: '(41) 96543-2109', destination: 'Grécia', value: 19500, status: 'new', lastActivity: '2025-06-10', notes: 'Quer roteiro cultural em Atenas + ilhas' },
  { id: 14, name: 'Rafael Dias', email: 'rafa@email.com', phone: '(51) 95432-1098', destination: 'Lisboa', value: 16000, status: 'negotiating', lastActivity: '2025-06-07', notes: 'Portugal + Espanha, 12 dias' },
  { id: 15, name: 'Camila Pires', email: 'camila@email.com', phone: '(61) 94321-0987', destination: 'Maldivas', value: 28000, status: 'new', lastActivity: '2025-06-10', notes: 'Resort overwater, 7 noites' },
];

const TASKS = [
  { id: 1, title: 'Check-in Família Santos — Voo LA8045 Lisboa', priority: 'urgent', due: 'Amanhã', completed: false },
  { id: 2, title: 'Confirmar Hotel Marriott Aruba — Ana Costa', priority: 'attention', due: 'Em 2 dias', completed: false },
  { id: 3, title: 'Follow-up Roberto Almeida — orçamento Peru', priority: 'normal', due: 'Em 3 dias', completed: false },
  { id: 4, title: 'Enviar vouchers Casal Oliveira — Curaçao', priority: 'urgent', due: 'Hoje', completed: false },
  { id: 5, title: 'Montar roteiro Grécia — Pedro Mendes (6 pax)', priority: 'attention', due: 'Em 4 dias', completed: false },
  { id: 6, title: 'Responder DM Instagram — Maria Silva', priority: 'normal', due: 'Hoje', completed: false },
  { id: 7, title: 'Verificar visto Maldivas — Juliana Ferreira', priority: 'attention', due: 'Em 5 dias', completed: true },
  { id: 8, title: 'Atualizar planilha comissões — Maio', priority: 'normal', due: 'Em 7 dias', completed: true },
];

const ITINERARIES = [
  {
    id: 1,
    title: 'Lisboa & Porto — Família Santos',
    client: 'Família Santos',
    destination: 'Lisboa',
    dates: '15 Jul – 25 Jul 2025',
    passengers: 4,
    budget: 18500,
    spent: 14200,
    status: 'Em andamento',
    vouchers: [
      { id: 1, name: 'E-ticket LATAM LA8045.pdf', type: 'pdf', size: '1.2 MB', category: 'Aéreo', icon: 'fa-plane', url: '#voucher-1' },
      { id: 2, name: 'Reserva Pestana Palace.pdf', type: 'pdf', size: '890 KB', category: 'Hotel', icon: 'fa-hotel', url: '#voucher-2' },
      { id: 3, name: 'Reserva The Yeatman.pdf', type: 'pdf', size: '1.1 MB', category: 'Hotel', icon: 'fa-hotel', url: '#voucher-3' },
      { id: 4, name: 'Seguro Viagem - Allianz.pdf', type: 'pdf', size: '2.3 MB', category: 'Seguro', icon: 'fa-shield-halved', url: '#voucher-4' },
      { id: 5, name: 'Comprovante Transfer Porto.jpg', type: 'image', size: '450 KB', category: 'Transfer', icon: 'fa-car', url: '#voucher-5' },
      { id: 6, name: 'Tour Sintra - Confirmação.png', type: 'image', size: '320 KB', category: 'Passeio', icon: 'fa-map-pin', url: '#voucher-6' },
    ],
    days: [
      {
        label: 'Dia 1',
        date: '15/07',
        activities: [
          { type: 'flight', title: 'Voo LATAM LA8045', detail: 'GRU → LIS • 10h30', time: '22:00', price: 4800 },
        ]
      },
      {
        label: 'Dia 2',
        date: '16/07',
        activities: [
          { type: 'hotel', title: 'Hotel Pestana Palace', detail: 'Check-in • R. Jau, Lisboa', time: '14:00', price: 1200 },
          { type: 'activity', title: 'Tour Belém', detail: 'Torre de Belém + Jerónimos', time: '16:00', price: 120 },
          { type: 'restaurant', title: 'Restaurante Ramiro', detail: 'Frutos do mar', time: '20:00', price: 280 },
        ]
      },
      {
        label: 'Dia 3',
        date: '17/07',
        activities: [
          { type: 'activity', title: 'Sintra & Cascais', detail: 'Day trip com guia privado', time: '09:00', price: 450 },
          { type: 'restaurant', title: 'Jantar em Cascais', detail: 'Vista para o mar', time: '19:30', price: 200 },
        ]
      },
      {
        label: 'Dia 4',
        date: '18/07',
        activities: [
          { type: 'transfer', title: 'Transfer Lisboa → Porto', detail: 'Trem Alfa Pendular • 2h40', time: '08:00', price: 160 },
          { type: 'hotel', title: 'Hotel The Yeatman', detail: 'Check-in • Vila Nova de Gaia', time: '12:00', price: 1800 },
          { type: 'activity', title: 'Degustação de Vinhos', detail: 'Caves do Porto', time: '15:00', price: 180 },
        ]
      },
      {
        label: 'Dia 5',
        date: '19/07',
        activities: [
          { type: 'activity', title: 'Passeio de barco Douro', detail: 'Cruzeiro 6 pontes', time: '10:00', price: 200 },
          { type: 'restaurant', title: 'Francesinha no Porto', detail: 'Café Santiago', time: '13:00', price: 80 },
        ]
      }
    ]
  },
  {
    id: 2,
    title: 'Curaçao All-Inclusive — Casal Oliveira',
    client: 'Casal Oliveira',
    destination: 'Curaçao',
    dates: '01 Ago – 08 Ago 2025',
    passengers: 2,
    budget: 12400,
    spent: 12400,
    status: 'Aprovado',
    vouchers: [
      { id: 7, name: 'E-ticket Copa CM726.pdf', type: 'pdf', size: '980 KB', category: 'Aéreo', icon: 'fa-plane', url: '#voucher-7' },
      { id: 8, name: 'Dreams Curaçao - Booking.pdf', type: 'pdf', size: '1.5 MB', category: 'Hotel', icon: 'fa-hotel', url: '#voucher-8' },
      { id: 9, name: 'Seguro Travel Ace.pdf', type: 'pdf', size: '1.8 MB', category: 'Seguro', icon: 'fa-shield-halved', url: '#voucher-9' },
    ],
    days: [
      {
        label: 'Dia 1',
        date: '01/08',
        activities: [
          { type: 'flight', title: 'Voo Copa CM726', detail: 'GRU → CUR (via PTY) • 9h20', time: '06:00', price: 3200 },
          { type: 'hotel', title: 'Dreams Curaçao Resort', detail: 'Check-in All-Inclusive', time: '16:00', price: 5600 },
        ]
      },
      {
        label: 'Dia 2',
        date: '02/08',
        activities: [
          { type: 'activity', title: 'Praia de Cas Abao', detail: 'Snorkeling + almoço na praia', time: '09:00', price: 0 },
        ]
      },
      {
        label: 'Dia 3',
        date: '03/08',
        activities: [
          { type: 'activity', title: 'Willemstad Tour', detail: 'Punda + Otrobanda + Floating Market', time: '10:00', price: 80 },
          { type: 'restaurant', title: 'Gouverneur de Rouville', detail: 'Jantar com vista', time: '19:00', price: 180 },
        ]
      }
    ]
  },
  {
    id: 3,
    title: 'Peru Aventura — Roberto Almeida',
    client: 'Roberto Almeida',
    destination: 'Peru',
    dates: '10 Set – 20 Set 2025',
    passengers: 2,
    budget: 15200,
    spent: 0,
    status: 'Rascunho',
    days: []
  }
];

const DESTINATIONS = [
  {
    id: 1,
    name: 'Lisboa',
    country: 'Portugal',
    category: 'cultural',
    image: 'linear-gradient(135deg, #F6D365 0%, #FDA085 100%)',
    currency: 'EUR (€)',
    timezone: 'UTC+0',
    climate: 'Mediterrâneo',
    visa: 'Não requerido (até 90 dias)',
    avgCost: 'R$ 12.000',
    description: 'Lisboa encanta com sua luz dourada, ruas históricas e uma gastronomia incomparável. De Belém a Alfama, cada bairro conta uma história de séculos.',
    attractions: ['Torre de Belém', 'Mosteiro dos Jerónimos', 'Alfama & Castelo', 'Sintra', 'Cascais', 'Pastéis de Belém', 'Bairro Alto', 'Ponte 25 de Abril']
  },
  {
    id: 2,
    name: 'Aruba',
    country: 'Caribe Holandês',
    category: 'beach',
    image: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    currency: 'AWG / USD',
    timezone: 'UTC-4',
    climate: 'Tropical Seco',
    visa: 'Não requerido',
    avgCost: 'R$ 10.000',
    description: 'Aruba é a ilha feliz do Caribe: praias de areia branca, sol garantido o ano todo e uma infraestrutura turística impecável. Perfeita para casais e famílias.',
    attractions: ['Eagle Beach', 'Palm Beach', 'Natural Pool', 'Arikok National Park', 'Baby Beach', 'Flamingo Beach', 'Downtown Oranjestad', 'California Lighthouse']
  },
  {
    id: 3,
    name: 'Curaçao',
    country: 'Caribe Holandês',
    category: 'beach',
    image: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
    currency: 'ANG / USD',
    timezone: 'UTC-4',
    climate: 'Tropical Seco',
    visa: 'Não requerido',
    avgCost: 'R$ 8.500',
    description: 'Curaçao surpreende com suas casas coloridas em Willemstad, praias paradisíacas e mergulhos incríveis. Um destino que mistura cultura holandesa com alma caribenha.',
    attractions: ['Willemstad (Punda)', 'Cas Abao Beach', 'Playa Kenepa', 'Shete Boka', 'Blue Room Cave', 'Floating Market', 'Klein Curaçao', 'Hato Caves']
  },
  {
    id: 4,
    name: 'Fernando de Noronha',
    country: 'Brasil',
    category: 'beach',
    image: 'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)',
    currency: 'BRL (R$)',
    timezone: 'UTC-2',
    climate: 'Tropical',
    visa: 'N/A (Brasil)',
    avgCost: 'R$ 7.000',
    description: 'Noronha é o paraíso brasileiro: águas cristalinas, vida marinha abundante e paisagens de tirar o fôlego. Número limitado de visitantes garante a exclusividade.',
    attractions: ['Baía do Sancho', 'Praia do Leão', 'Baía dos Porcos', 'Mergulho com golfinhos', 'Trilha do Atalaia', 'Morro Dois Irmãos', 'Praia da Conceição', 'Forte N.S. dos Remédios']
  },
  {
    id: 5,
    name: 'Peru',
    country: 'Peru',
    category: 'adventure',
    image: 'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
    currency: 'PEN (S/)',
    timezone: 'UTC-5',
    climate: 'Variado (altitude)',
    visa: 'Não requerido',
    avgCost: 'R$ 9.000',
    description: 'O Peru oferece uma jornada épica: de Machu Picchu às linhas de Nazca, da gastronomia de Lima aos mercados de Cusco. Aventura e história em cada esquina.',
    attractions: ['Machu Picchu', 'Cusco (Plaza de Armas)', 'Vale Sagrado', 'Lima (Miraflores)', 'Lago Titicaca', 'Rainbow Mountain', 'Linhas de Nazca', 'Trilha Inca']
  },
  {
    id: 6,
    name: 'Grécia',
    country: 'Grécia',
    category: 'cultural',
    image: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
    currency: 'EUR (€)',
    timezone: 'UTC+2',
    climate: 'Mediterrâneo',
    visa: 'Não requerido (até 90 dias)',
    avgCost: 'R$ 15.000',
    description: 'Grécia é o berço da civilização ocidental e um destino de tirar o fôlego. De Santorini a Mykonos, passando por Atenas, cada ilha é um mundo à parte.',
    attractions: ['Santorini (Oia)', 'Mykonos', 'Atenas (Acrópole)', 'Creta', 'Meteora', 'Zakynthos (Navagio)', 'Corfu', 'Delos']
  },
  {
    id: 7,
    name: 'Maldivas',
    country: 'Maldivas',
    category: 'beach',
    image: 'linear-gradient(135deg, #A18CD1 0%, #FBC2EB 100%)',
    currency: 'MVR / USD',
    timezone: 'UTC+5',
    climate: 'Tropical',
    visa: 'Visa on arrival (30 dias)',
    avgCost: 'R$ 25.000',
    description: 'As Maldivas são o ápice do luxo tropical: bangalôs sobre águas cristalinas, recifes de coral e um nível de exclusividade incomparável no planeta.',
    attractions: ['Overwater Bungalow', 'Snorkeling no recife', 'Mergulho com mantas', 'Jantar subaquático', 'Sandbank privado', 'Pôr do sol no Índico', 'Spa overwater', 'Pesca noturna']
  },
];

const TRANSACTIONS = [
  { id: 1, desc: 'Pacote Curaçao — Casal Oliveira', date: '07/06/2025', amount: 12400, type: 'income' },
  { id: 2, desc: 'Comissão — Curaçao (12%)', date: '07/06/2025', amount: 1488, type: 'commission' },
  { id: 3, desc: 'Pacote Lisboa — Carlos Souza', date: '03/06/2025', amount: 11000, type: 'income' },
  { id: 4, desc: 'Comissão — Lisboa (12%)', date: '03/06/2025', amount: 1320, type: 'commission' },
  { id: 5, desc: 'Pacote Peru — Beatriz Rocha', date: '02/06/2025', amount: 13600, type: 'income' },
  { id: 6, desc: 'Comissão — Peru (10%)', date: '02/06/2025', amount: 1360, type: 'commission' },
  { id: 7, desc: 'Software CRM — Mensalidade', date: '01/06/2025', amount: -89, type: 'expense' },
  { id: 8, desc: 'Material marketing — Instagram Ads', date: '01/06/2025', amount: -450, type: 'expense' },
  { id: 9, desc: 'Pacote Noronha — Cliente antigo', date: '28/05/2025', amount: 6800, type: 'income' },
  { id: 10, desc: 'Comissão — Noronha (15%)', date: '28/05/2025', amount: 1020, type: 'commission' },
  { id: 11, desc: 'Telefonia e internet', date: '25/05/2025', amount: -199, type: 'expense' },
  { id: 12, desc: 'Seguro viagem — reembolso', date: '20/05/2025', amount: -350, type: 'expense' },
];

const SALES_DATA = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  revenue: [28000, 32000, 25000, 41000, 38000, 47850],
  count: [4, 5, 3, 6, 5, 7],
};
