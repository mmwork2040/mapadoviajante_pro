/* ══════════════════════════════════════════════════════════════
   COPILOT.JS — Thay IA Assistant Slide-Over Panel
   Simulated AI suggestions for Module 1 (dummy data).
   ══════════════════════════════════════════════════════════════ */

function initCopilot() {
  const trigger = document.querySelector('.sidebar-ai-widget');
  const panel = document.getElementById('copilot-panel');
  const overlay = document.getElementById('copilot-overlay');
  const closeBtn = document.getElementById('copilot-close');
  const chatInput = document.getElementById('copilot-input');
  const sendBtn = document.getElementById('copilot-send');

  if (!trigger || !panel) return;

  trigger.addEventListener('click', () => toggleCopilot(true));
  if (overlay) overlay.addEventListener('click', () => toggleCopilot(false));
  if (closeBtn) closeBtn.addEventListener('click', () => toggleCopilot(false));

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      toggleCopilot(false);
    }
  });

  // Send message
  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => sendCopilotMessage());
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCopilotMessage();
      }
    });
  }

  // Populate initial suggestions
  renderCopilotInsights();
}

function toggleCopilot(open) {
  const panel = document.getElementById('copilot-panel');
  const overlay = document.getElementById('copilot-overlay');
  if (!panel) return;

  if (open) {
    panel.classList.add('open');
    if (overlay) overlay.classList.add('active');
    document.getElementById('copilot-input')?.focus();
  } else {
    panel.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
}

// ── AI Insights (dummy) ───────────────────────────────────
function renderCopilotInsights() {
  const container = document.getElementById('copilot-insights');
  if (!container) return;

  const insights = [
    {
      icon: 'fa-fire',
      color: '#EE5F52',
      title: 'Lead quente detectado',
      desc: 'Ana Costa (Aruba) abriu o orçamento 3x nas últimas 24h. Sugestão: enviar follow-up com condição especial.',
      action: 'Enviar follow-up',
      actionFn: "showToast('Follow-up agendado para Ana Costa ✉️', 'success')"
    },
    {
      icon: 'fa-plane-arrival',
      color: '#3B82F6',
      title: 'Check-in em 24h',
      desc: 'Família Santos embarca amanhã — Voo LA8045. Confirmar documentos e transfers.',
      action: 'Ver roteiro',
      actionFn: "navigateTo('itinerary'); toggleCopilot(false)"
    },
    {
      icon: 'fa-chart-line',
      color: '#10B981',
      title: 'Meta mensal a 78%',
      desc: 'Faltam R$ 10.350 para bater a meta. 3 leads em negociação podem fechar essa semana.',
      action: 'Ver pipeline',
      actionFn: "navigateTo('leads'); toggleCopilot(false)"
    },
    {
      icon: 'fa-clock',
      color: '#F59E0B',
      title: 'Cancelamento se aproxima',
      desc: 'Hotel Marriott Aruba — prazo de cancelamento gratuito vence em 48h. Confirmar com Casal Oliveira.',
      action: 'Abrir lead',
      actionFn: "navigateTo('leads'); toggleCopilot(false)"
    },
  ];

  container.innerHTML = insights.map((insight, i) => `
    <div class="copilot-insight" style="animation-delay: ${i * 0.08}s">
      <div class="copilot-insight-icon" style="background: ${insight.color}15; color: ${insight.color};">
        <i class="fas ${insight.icon}"></i>
      </div>
      <div class="copilot-insight-body">
        <div class="copilot-insight-title">${insight.title}</div>
        <div class="copilot-insight-desc">${insight.desc}</div>
        <button class="copilot-insight-action" onclick="${insight.actionFn}">
          ${insight.action} <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// ── Chat Simulation ─────────────────────────────────────────
function sendCopilotMessage() {
  const input = document.getElementById('copilot-input');
  const chat = document.getElementById('copilot-chat');
  if (!input || !chat) return;

  const msg = input.value.trim();
  if (!msg) return;

  // Add user message
  chat.innerHTML += `
    <div class="copilot-msg copilot-msg-user">
      <div class="copilot-msg-bubble">${escapeHTML(msg)}</div>
    </div>`;

  input.value = '';
  chat.scrollTop = chat.scrollHeight;

  // Simulate typing
  const typingId = 'typing-' + Date.now();
  chat.innerHTML += `
    <div class="copilot-msg copilot-msg-ai" id="${typingId}">
      <div class="copilot-msg-bubble copilot-typing">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  chat.scrollTop = chat.scrollHeight;

  // Simulate AI response after delay
  setTimeout(() => {
    const typingEl = document.getElementById(typingId);
    if (typingEl) {
      typingEl.querySelector('.copilot-msg-bubble').classList.remove('copilot-typing');
      typingEl.querySelector('.copilot-msg-bubble').innerHTML = generateAIResponse(msg);
    }
    chat.scrollTop = chat.scrollHeight;
  }, 1200 + Math.random() * 800);
}

function generateAIResponse(query) {
  const q = query.toLowerCase();

  // Itinerary creation
  if (q.includes('criar roteiro') || q.includes('montar roteiro') || q.includes('monte um roteiro') || q.includes('sugira um roteiro') || q.includes('crie um')) {
    return `Claro! Com base na <strong>Biblioteca de Roteiros</strong> e nos materiais da base de conhecimento, sugiro:<br><br>
    🗺️ <strong>Aruba — 7 Noites (All-Inclusive)</strong><br>
    • Dia 1-2: Chegada + Eagle Beach & Palm Beach<br>
    • Dia 3: Parque Nacional Arikok (jipe 4x4)<br>
    • Dia 4: Snorkeling na Ilha de Arashi<br>
    • Dia 5: Dia livre / Spa<br>
    • Dia 6: Excursão de catamarã ao pôr do sol<br>
    • Dia 7: Compras + retorno<br><br>
    📄 Referência: <em>Guia_Completo_Aruba.pdf</em> (pág. 12-18)<br>
    Quer que eu adicione este roteiro ao construtor? ✨`;
  }

  // Destination suggestions
  if (q.includes('destino') || q.includes('sugerir') || q.includes('sugestão') || q.includes('para onde') || q.includes('indica')) {
    return `Com base nos seus roteiros mais vendidos e na <strong>base de conhecimento</strong>, os destinos em alta são:<br><br>
    1. 🏝️ <strong>Aruba</strong> — 3 leads ativos, melhor período nov-mar<br>
    2. 🏖️ <strong>Curaçao</strong> — 1 venda fechada recente (R$ 12.400)<br>
    3. 🇬🇷 <strong>Grécia</strong> — Alta demanda, roteiro base de 10 dias cadastrado<br>
    4. 🇵🇹 <strong>Portugal</strong> — 2 leads em negociação<br><br>
    📄 Consultei: <em>Tabela_Hoteis_Caribe_2026.pdf</em><br>
    Quer detalhes de algum destino específico? 🌍`;
  }

  // Hotel / pricing queries
  if (q.includes('hotel') || q.includes('hospedagem') || q.includes('preço') || q.includes('valor') || q.includes('tabela')) {
    return `Consultando a <strong>Tabela_Hoteis_Caribe_2026.pdf</strong>:<br><br>
    🏨 <strong>Marriott Aruba</strong> — US$ 289/noite (all-inclusive)<br>
    🏨 <strong>Ritz-Carlton Aruba</strong> — US$ 450/noite<br>
    🏨 <strong>Hyatt Regency</strong> — US$ 320/noite (all-inclusive)<br>
    🏨 <strong>Renaissance Curaçao</strong> — US$ 198/noite<br><br>
    📋 Comissão média: <strong>12%</strong> (ref: Comissoes_Operadoras_2026.xlsx)<br>
    Posso calcular o orçamento para um cliente específico? 💰`;
  }

  // Cancellation / operations
  if (q.includes('cancelamento') || q.includes('política') || q.includes('prazo')) {
    return `De acordo com a <strong>Politica_Cancelamento_Hoteis.txt</strong>:<br><br>
    ⚠️ <strong>Marriott</strong>: cancelamento grátis até 48h antes<br>
    ⚠️ <strong>Ritz-Carlton</strong>: 72h de antecedência, multa de 1 diária<br>
    ⚠️ <strong>Hyatt</strong>: Flexível até 24h antes para reservas diretas<br><br>
    ⏰ Alerta: Casal Oliveira tem prazo vencendo em <strong>48h</strong>!`;
  }

  if (q.includes('lead') || q.includes('cliente')) {
    return 'Você tem <strong>34 leads ativos</strong> no momento. Os mais quentes são Ana Costa (Aruba) e Thiago Nascimento (Aruba). Sugiro priorizar follow-ups hoje. 🎯';
  }
  if (q.includes('roteiro') || q.includes('itinerário') || q.includes('viagem')) {
    return 'Há <strong>7 roteiros ativos</strong> na biblioteca. O mais recente é "Maldivas 7 Noites" para Camila Pires. Posso usar como base para criar variações ou montar um novo do zero! 🗺️';
  }
  if (q.includes('venda') || q.includes('meta') || q.includes('receita')) {
    return 'Receita do mês: <strong>R$ 47.850</strong> (78% da meta). Se os 3 leads em negociação fecharem, você supera a meta em 15%. 📈';
  }
  if (q.includes('aruba') || q.includes('curaçao') || q.includes('caribe')) {
    return 'Destinos Caribe estão em alta! Consultei o <strong>Guia_Completo_Aruba.pdf</strong> (42 páginas). Aruba tem <strong>2 leads</strong> e Curaçao tem <strong>1 venda fechada</strong> (R$ 12.400). Período ideal: nov-mar. ☀️';
  }
  if (q.includes('financeiro') || q.includes('comissão') || q.includes('despesa')) {
    return 'Comissões acumuladas: <strong>R$ 5.742</strong>. Despesas operacionais: R$ 2.130. Lucro líquido: <strong>R$ 3.612</strong>. Margem de 12%. 💰';
  }
  if (q.includes('olá') || q.includes('oi') || q.includes('bom dia') || q.includes('boa')) {
    return 'Olá! 👋 Sou a Thay, assistente IA do Mapa PRO. Posso ajudar com <strong>criação de roteiros</strong>, sugestões de destinos, consulta a preços de hotéis, análise de leads e muito mais. O que precisa?';
  }
  if (q.includes('ajuda') || q.includes('o que você faz') || q.includes('como funciona')) {
    return `Posso te ajudar em várias frentes:<br><br>
    🗺️ <strong>Criar roteiros</strong> — baseados na biblioteca e materiais da agência<br>
    🏨 <strong>Consultar preços</strong> — de hotéis, voos e pacotes (via docs da base)<br>
    📊 <strong>Analisar leads</strong> — identificar os mais quentes e sugerir ações<br>
    📋 <strong>Operacional</strong> — prazos, cancelamentos, check-ins<br>
    💰 <strong>Financeiro</strong> — comissões, metas e projeções<br><br>
    Tudo baseado nos <strong>5 documentos</strong> e <strong>7 roteiros</strong> da base de conhecimento! 🎓`;
  }

  return 'Entendi! Com base nos dados atuais e na <strong>base de conhecimento</strong> da agência, sugiro focar nos leads quentes desta semana. Posso criar um roteiro, consultar preços ou detalhar algum ponto? 💡';
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
