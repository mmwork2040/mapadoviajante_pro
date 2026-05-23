/* ══════════════════════════════════════════════════════════════
   INTAKE.JS — Novo Viajante (Multi-step form + checklists)
   ══════════════════════════════════════════════════════════════ */

// ── Checklists operacionais (baseados no fluxo real da agência) ──
const CHECKLISTS_TEMPLATE = {
  geral: {
    title: 'Tarefas Gerais',
    icon: 'fa-list-check',
    color: 'primary',
    items: [
      'Reunião briefing',
      'Preenchimento do formulário',
      'Drive com comprovantes de reserva',
      'Planilha com prévia do roteiro',
      'Prévia do roteiro no Gamma',
      'Passagem IDA',
      'Passagem VOLTA',
      'Passagem Interna',
      'Sugestão de hospedagens',
      'Fechamento de hospedagens',
      'Reserva de passeios',
      'Criar My Maps',
      'Prévia da cartilha',
      'Enviar checklist para o cliente',
      'Conta Wise',
      'Seguro viagem',
      'Cartilha',
      'Bilhete personalizado para o brinde',
      'Fazer e enviar brinde',
      'Reunião final',
    ]
  },
  briefing: {
    title: 'Reunião — Briefing',
    icon: 'fa-comments',
    color: 'info',
    items: [
      'Definição de datas',
      'Definição de locais',
      'Definir preferências de hospedagem',
      'Definir passeios',
      'Orçamento',
      'Checklist de documentos para o cliente',
      'Orientações sobre cartões',
    ]
  },
  entrega: {
    title: 'Reunião de Entrega',
    icon: 'fa-plane-departure',
    color: 'success',
    items: [
      'Cartilha pronta',
      'Orientações sobre câmbio e internet',
      'Dicas de aeroporto',
      'Sala VIP',
      'Orientações sobre o destino',
    ]
  }
};

// ── State ────────────────────────────────────────────────────
let currentIntakeStep = 1;
const TOTAL_STEPS = 4;
let selectedCards = new Set(['Nubank']);
let selectedMiles = new Set();
let selectedAccomType = new Set();
let selectedAccomPrefs = new Set();

// ── Init ─────────────────────────────────────────────────────
function initIntake() {
  initCardTags();
  initOptionPills();
  initAddCustomCard();
}

// ── Card tag toggles ─────────────────────────────────────────
function initCardTags() {
  document.querySelectorAll('.card-tag-item:not(.add-card-tag)').forEach(tag => {
    const card = tag.dataset.card;
    // Determine if it's a miles program
    const isMilesSection = ['Smiles (Gol)', 'LATAM Pass', 'TudoAzul', 'Livelo', 'Esfera', 'Multiplus'].includes(card);

    tag.addEventListener('click', () => {
      const set = isMilesSection ? selectedMiles : selectedCards;
      if (set.has(card)) {
        set.delete(card);
        tag.classList.remove('selected');
      } else {
        set.add(card);
        tag.classList.add('selected');
      }
    });
  });
}

// ── Option Pills (accommodation) ─────────────────────────────
function initOptionPills() {
  // Type — single select
  document.querySelectorAll('#accommodation-type .option-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#accommodation-type .option-pill').forEach(p => {
        p.classList.remove('selected');
        selectedAccomType.clear();
      });
      pill.classList.add('selected');
      selectedAccomType.add(pill.dataset.val);
    });
  });

  // Prefs — multi select
  document.querySelectorAll('#accommodation-prefs .option-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      if (selectedAccomPrefs.has(pill.dataset.val)) {
        selectedAccomPrefs.delete(pill.dataset.val);
        pill.classList.remove('selected');
      } else {
        selectedAccomPrefs.add(pill.dataset.val);
        pill.classList.add('selected');
      }
    });
  });
}

// ── Add custom card ───────────────────────────────────────────
function initAddCustomCard() {
  const btn = document.getElementById('add-card-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const name = prompt('Nome do cartão:');
    if (name && name.trim()) {
      const tag = document.createElement('div');
      tag.className = 'card-tag-item selected';
      tag.dataset.card = name.trim();
      tag.textContent = name.trim();
      selectedCards.add(name.trim());
      tag.addEventListener('click', () => {
        if (selectedCards.has(name.trim())) {
          selectedCards.delete(name.trim());
          tag.classList.remove('selected');
        } else {
          selectedCards.add(name.trim());
          tag.classList.add('selected');
        }
      });
      btn.parentElement.insertBefore(tag, btn);
    }
  });
}

// ── Pax Counter ───────────────────────────────────────────────
function changePax(delta) {
  const input = document.getElementById('lead-pax');
  const display = document.getElementById('pax-display');
  if (!input || !display) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(20, val + delta));
  input.value = val;
  display.textContent = val;
}

// ── Step Navigation ───────────────────────────────────────────
function intakeNext() {
  // Validate current step
  if (!validateIntakeStep(currentIntakeStep)) return;

  if (currentIntakeStep >= TOTAL_STEPS) {
    submitIntakeForm();
    return;
  }

  goToIntakeStep(currentIntakeStep + 1);
}

function intakeBack() {
  if (currentIntakeStep <= 1) return;
  goToIntakeStep(currentIntakeStep - 1);
}

function goToIntakeStep(step) {
  // Hide current
  document.getElementById(`intake-step-${currentIntakeStep}`)?.classList.remove('active');

  // Mark done
  const prevStepEl = document.querySelector(`.intake-step[data-step="${currentIntakeStep}"]`);
  if (step > currentIntakeStep && prevStepEl) {
    prevStepEl.classList.remove('active');
    prevStepEl.classList.add('done');
    prevStepEl.querySelector('.step-dot').textContent = '';

    // Mark line as done
    const lines = document.querySelectorAll('.intake-step-line');
    if (lines[currentIntakeStep - 1]) lines[currentIntakeStep - 1].classList.add('done');
  }

  currentIntakeStep = step;

  // Show new panel
  document.getElementById(`intake-step-${step}`)?.classList.add('active');

  // Update step indicators
  document.querySelectorAll('.intake-step').forEach(el => el.classList.remove('active'));
  const activeStepEl = document.querySelector(`.intake-step[data-step="${step}"]`);
  if (activeStepEl && !activeStepEl.classList.contains('done')) {
    activeStepEl.classList.add('active');
  }

  // Update dots
  document.querySelectorAll('.intake-progress-dots .dot').forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === step);
  });

  // Update nav buttons
  const backBtn = document.getElementById('intake-back-btn');
  const nextBtn = document.getElementById('intake-next-btn');
  if (backBtn) backBtn.style.display = step > 1 ? '' : 'none';
  if (nextBtn) {
    if (step === TOTAL_STEPS) {
      nextBtn.innerHTML = '<i class="fas fa-check"></i> Criar Viajante';
    } else {
      nextBtn.innerHTML = 'Próximo <i class="fas fa-arrow-right"></i>';
    }
  }
}

// ── Validation ────────────────────────────────────────────────
function validateIntakeStep(step) {
  if (step === 1) {
    const name = document.getElementById('lead-name')?.value.trim();
    const phone = document.getElementById('lead-phone')?.value.trim();
    if (!name) {
      showToast('Por favor, informe o nome do viajante.', 'error');
      document.getElementById('lead-name')?.focus();
      return false;
    }
    if (!phone) {
      showToast('Por favor, informe o WhatsApp.', 'error');
      document.getElementById('lead-phone')?.focus();
      return false;
    }
  }
  if (step === 2) {
    const dest = document.getElementById('lead-destination')?.value.trim();
    if (!dest) {
      showToast('Por favor, informe o destino da viagem.', 'error');
      document.getElementById('lead-destination')?.focus();
      return false;
    }
  }
  return true;
}

// ── Submit ────────────────────────────────────────────────────
async function submitIntakeForm() {
  const name = document.getElementById('lead-name').value.trim();
  const email = document.getElementById('lead-email').value.trim();
  const phone = document.getElementById('lead-phone').value.trim();
  const destination = document.getElementById('lead-destination').value.trim() || 'A definir';
  const value = parseInt(document.getElementById('lead-value').value) || 0;
  const originCity = document.getElementById('lead-origin-city')?.value.trim() || '';
  const date = document.getElementById('lead-date')?.value.trim() || '';
  const pax = parseInt(document.getElementById('lead-pax')?.value) || 1;
  const tripDetails = document.getElementById('lead-trip-details')?.value.trim() || '';
  const notes = document.getElementById('lead-notes')?.value.trim() || '';
  const flightObs = document.getElementById('lead-flight-obs')?.value.trim() || '';
  const milesBalance = document.getElementById('lead-miles-balance')?.value.trim() || '';
  const accomType = [...selectedAccomType].join(', ');
  const accomPrefs = [...selectedAccomPrefs].join(', ');
  const flightFlex = document.getElementById('lead-flight-flex')?.value || '';
  const origin = document.getElementById('lead-origin')?.value || 'direto';

  // Build checklists from template
  const checklists = {
    geral: CHECKLISTS_TEMPLATE.geral.items.map(title => ({ title, done: false })),
    briefing: CHECKLISTS_TEMPLATE.briefing.items.map(title => ({ title, done: false })),
    entrega: CHECKLISTS_TEMPLATE.entrega.items.map(title => ({ title, done: false })),
  };

  const profile = {
    originCity,
    date,
    pax,
    cards: [...selectedCards],
    miles: [...selectedMiles],
    milesBalance,
    accomType,
    accomPrefs,
    flightFlex,
  };

  const combinedNotes = [tripDetails, notes, flightObs].filter(Boolean).join(' | ');

  const session = JSON.parse(localStorage.getItem('mapapro_session') || '{}');

  if (session.isSupabase) {
    // ── Supabase mode ──
    try {
      const created = await createLead({
        name,
        email,
        phone,
        destination,
        value,
        status: 'new',
        origin,
        notes: combinedNotes,
        profile,
        checklists,
      });
      if (!created) {
        showToast('Erro ao criar viajante no servidor.', 'error');
        return;
      }
      // Refresh pipeline with real data
      if (typeof initLeads === 'function') initLeads();
      if (typeof initDashboard === 'function') initDashboard();
    } catch (err) {
      console.error('submitIntakeForm Supabase error:', err);
      showToast('Erro ao salvar no servidor. Tente novamente.', 'error');
      return;
    }
  } else {
    // ── Demo mode ──
    if (typeof window.LEADS === 'undefined') window.LEADS = [];
    const newLead = {
      id: window.LEADS.length + 1,
      name,
      email,
      phone,
      destination,
      value,
      status: 'new',
      lastActivity: new Date().toISOString().split('T')[0],
      notes: combinedNotes,
      profile,
      checklists,
    };
    window.LEADS.unshift(newLead);
    if (typeof renderPipeline === 'function') renderPipeline();
    if (typeof renderDashboardLeads === 'function') renderDashboardLeads();
  }

  // Update nav badge
  const badge = document.querySelector('.nav-badge');
  if (badge) {
    const leadsList = typeof currentLeads !== 'undefined' ? currentLeads : (typeof window.LEADS !== 'undefined' ? window.LEADS : []);
    badge.textContent = leadsList.filter(l => l.status === 'new').length;
  }

  // Close and reset
  closeModal('lead-modal');
  resetIntakeForm();
  showToast(`✈️ Viajante "${name}" criado com sucesso!`, 'success');
}

// ── Reset form state ──────────────────────────────────────────
function resetIntakeForm() {
  // Reset step state
  currentIntakeStep = 1;
  selectedCards = new Set(['Nubank']);
  selectedMiles = new Set();
  selectedAccomType = new Set();
  selectedAccomPrefs = new Set();

  // Reset form fields
  document.getElementById('lead-form')?.reset();
  document.getElementById('pax-display').textContent = '2';

  // Reset step UI
  document.querySelectorAll('.intake-panel').forEach((p, i) => {
    p.classList.toggle('active', i === 0);
  });

  document.querySelectorAll('.intake-step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    el.querySelector('.step-dot').textContent = i + 1;
    if (i === 0) el.classList.add('active');
  });

  document.querySelectorAll('.intake-step-line').forEach(l => l.classList.remove('done'));

  document.querySelectorAll('.intake-progress-dots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === 0);
  });

  document.querySelectorAll('.card-tag-item').forEach(t => {
    t.classList.toggle('selected', t.dataset.card === 'Nubank');
  });

  document.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));

  const backBtn = document.getElementById('intake-back-btn');
  const nextBtn = document.getElementById('intake-next-btn');
  if (backBtn) backBtn.style.display = 'none';
  if (nextBtn) nextBtn.innerHTML = 'Próximo <i class="fas fa-arrow-right"></i>';
}

// Register init
document.addEventListener('DOMContentLoaded', initIntake);
