/* ══════════════════════════════════════════════════════════════
   DRAWER.JS — Lead Profile Drawer (Open/Close, Tabs, Render)
   ══════════════════════════════════════════════════════════════ */

let currentDrawerLead = null;
let currentDrawerTab = 'profile';

// ── Open / Close ────────────────────────────────────────────
async function openDrawer(leadId) {
  let lead = null;
  const session = getSession();
  
  if (session && session.isSupabase) {
    lead = await fetchLeadById(leadId);
  } else {
    // Fallback
    const idNum = parseInt(leadId, 10);
    lead = LEADS.find(l => l.id === idNum);
  }

  if (!lead) return;

  currentDrawerLead = lead;
  currentDrawerTab = 'profile';

  await renderDrawer(lead);

  const drawer = document.getElementById('lead-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('active');

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  const drawer = document.getElementById('lead-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('active');

  document.body.style.overflow = '';
  currentDrawerLead = null;
}

// ── Render Full Drawer ──────────────────────────────────────
async function renderDrawer(lead) {
  const initials = lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const profile = lead.profile || {};
  const checklists = lead.checklists || null;

  // ── Header
  document.getElementById('drawer-avatar').textContent = initials;
  document.getElementById('drawer-name').textContent = lead.name;
  document.getElementById('drawer-dest-text').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${lead.destination || 'Indefinido'}`;
  document.getElementById('drawer-value').textContent = formatCurrency(lead.value);

  // Status select
  const statusSelect = document.getElementById('drawer-status-select');
  if (statusSelect) {
    statusSelect.value = lead.status;
    statusSelect.setAttribute('data-status', lead.status);
  }

  // Created date
  const dateStr = lead.last_activity_at || lead.lastActivity;
  document.getElementById('drawer-created').textContent = `Criado: ${relativeDate(dateStr)}`;

  // Checklist progress in header
  updateDrawerChecklistBadge(lead);

  // ── Render active tab
  await switchDrawerTab(currentDrawerTab);
}

// ── Tab Switching ───────────────────────────────────────────
async function switchDrawerTab(tab) {
  currentDrawerTab = tab;

  // Update tab buttons
  document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.drawer-tab[data-tab="${tab}"]`);
  if (activeTab) activeTab.classList.add('active');

  // Update panels
  document.querySelectorAll('.drawer-tab-panel').forEach(p => p.classList.remove('active'));
  const activePanel = document.getElementById(`drawer-panel-${tab}`);
  if (activePanel) activePanel.classList.add('active');

  // Render content
  if (!currentDrawerLead) return;

  switch (tab) {
    case 'profile': renderProfileTab(currentDrawerLead); break;
    case 'travel': renderTravelTab(currentDrawerLead); break;
    case 'activities': await renderActivitiesTab(currentDrawerLead); break;
    case 'checklist': renderChecklistTab(currentDrawerLead); break;
    case 'notes': renderNotesTab(currentDrawerLead); break;
  }
}

// ── Profile Tab ─────────────────────────────────────────────
function renderProfileTab(lead) {
  const container = document.getElementById('drawer-panel-profile');
  if (!container) return;

  const profile = lead.profile || {};
  const originLabel = lead.origin === 'instagram' ? 'Instagram' :
                      lead.origin === 'indicacao' ? 'Indicação' : 'Direto';

  container.innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-user"></i> Dados de Contato</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item">
          <span class="drawer-info-label">E-mail</span>
          <span class="drawer-info-value"><a href="mailto:${lead.email}">${lead.email || '—'}</a></span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">WhatsApp</span>
          <span class="drawer-info-value"><a href="https://wa.me/55${(lead.phone || '').replace(/\D/g, '')}" target="_blank">${lead.phone || '—'}</a></span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">Orçamento</span>
          <span class="drawer-info-value" style="color: var(--primary); font-weight: 700;">${formatCurrency(lead.value)}</span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">Origem</span>
          <span class="drawer-info-value">${originLabel}</span>
        </div>
      </div>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-clock"></i> Atividade Recente</div>
      <div class="drawer-timeline">
        <div class="drawer-timeline-item">
          <div class="drawer-timeline-dot"></div>
          <div class="drawer-timeline-content">
            <div class="drawer-timeline-title">Lead criado no sistema</div>
            <div class="drawer-timeline-date">${relativeDate(lead.lastActivity)}</div>
          </div>
        </div>
        ${lead.status === 'negotiating' ? `
        <div class="drawer-timeline-item">
          <div class="drawer-timeline-dot warning"></div>
          <div class="drawer-timeline-content">
            <div class="drawer-timeline-title">Movido para Em Negociação</div>
            <div class="drawer-timeline-date">${relativeDate(lead.lastActivity)}</div>
          </div>
        </div>` : ''}
        ${lead.status === 'closed' ? `
        <div class="drawer-timeline-item">
          <div class="drawer-timeline-dot success"></div>
          <div class="drawer-timeline-content">
            <div class="drawer-timeline-title">🎉 Venda fechada!</div>
            <div class="drawer-timeline-date">${relativeDate(lead.lastActivity)}</div>
          </div>
        </div>` : ''}
        <div class="drawer-timeline-item">
          <div class="drawer-timeline-dot info"></div>
          <div class="drawer-timeline-content">
            <div class="drawer-timeline-title">Primeiro contato</div>
            <div class="drawer-timeline-date">Início do funil</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Travel Tab ──────────────────────────────────────────────
function renderTravelTab(lead) {
  const container = document.getElementById('drawer-panel-travel');
  if (!container) return;

  const profile = lead.profile || {};
  const cards = profile.cards || [];
  const miles = profile.miles || [];

  container.innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-plane"></i> Dados da Viagem</div>
      <div class="drawer-info-grid">
        <div class="drawer-info-item">
          <span class="drawer-info-label">Destino</span>
          <span class="drawer-info-value">${lead.destination}</span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">Ponto de Partida</span>
          <span class="drawer-info-value">${profile.originCity || '—'}</span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">Data Pretendida</span>
          <span class="drawer-info-value">${profile.date || '—'}</span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">Nº Pessoas</span>
          <span class="drawer-info-value">${profile.pax || '—'}</span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">Hospedagem</span>
          <span class="drawer-info-value">${profile.accomType || '—'}</span>
        </div>
        <div class="drawer-info-item">
          <span class="drawer-info-label">Flexibilidade</span>
          <span class="drawer-info-value">${profile.flightFlex || '—'}</span>
        </div>
        ${profile.accomPrefs ? `
        <div class="drawer-info-item full">
          <span class="drawer-info-label">Preferências</span>
          <span class="drawer-info-value">${profile.accomPrefs}</span>
        </div>` : ''}
      </div>
    </div>

    ${cards.length ? `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-credit-card"></i> Cartões</div>
      <div class="drawer-tags">
        ${cards.map(c => `<span class="drawer-tag"><i class="fas fa-credit-card"></i> ${c}</span>`).join('')}
      </div>
    </div>` : ''}

    ${miles.length ? `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-plane-departure"></i> Programas de Milhas</div>
      <div class="drawer-tags">
        ${miles.map(m => `<span class="drawer-tag miles"><i class="fas fa-ticket-alt"></i> ${m}</span>`).join('')}
      </div>
      ${profile.milesBalance ? `
      <div class="drawer-info-grid" style="margin-top: var(--sp-3);">
        <div class="drawer-info-item">
          <span class="drawer-info-label">Saldo de Milhas</span>
          <span class="drawer-info-value">${profile.milesBalance}</span>
        </div>
      </div>` : ''}
    </div>` : ''}

    ${!cards.length && !miles.length ? `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-credit-card"></i> Cartões & Milhas</div>
      <div style="text-align: center; padding: var(--sp-6); color: var(--gray-400); font-size: 13px;">
        <i class="fas fa-info-circle" style="font-size: 20px; display: block; margin-bottom: var(--sp-2);"></i>
        Nenhum cartão ou milha registrado.<br>Esses dados são preenchidos no formulário de cadastro.
      </div>
    </div>` : ''}
  `;
}

// ── Checklist Tab ───────────────────────────────────────────
function renderChecklistTab(lead) {
  const container = document.getElementById('drawer-panel-checklist');
  if (!container) return;

  // Initialize checklists if missing
  if (!lead.checklists) {
    lead.checklists = {
      geral: CHECKLISTS_TEMPLATE.geral.items.map(title => ({ title, done: false })),
      briefing: CHECKLISTS_TEMPLATE.briefing.items.map(title => ({ title, done: false })),
      entrega: CHECKLISTS_TEMPLATE.entrega.items.map(title => ({ title, done: false })),
    };
  }

  const groups = [
    { key: 'geral', ...CHECKLISTS_TEMPLATE.geral },
    { key: 'briefing', ...CHECKLISTS_TEMPLATE.briefing },
    { key: 'entrega', ...CHECKLISTS_TEMPLATE.entrega },
  ];

  container.innerHTML = groups.map(group => {
    const items = lead.checklists[group.key];
    const done = items.filter(i => i.done).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return `
      <div class="drawer-checklist-group">
        <div class="drawer-checklist-header" onclick="toggleChecklistGroup('${group.key}')">
          <div class="drawer-checklist-header-left">
            <div class="drawer-checklist-icon ${group.color}">
              <i class="fas ${group.icon}"></i>
            </div>
            <span class="drawer-checklist-title">${group.title}</span>
          </div>
          <div class="drawer-checklist-progress">
            <div class="drawer-checklist-progress-bar">
              <div class="drawer-checklist-progress-fill ${pct === 100 ? 'complete' : ''}" style="width: ${pct}%"></div>
            </div>
            <span>${done}/${total}</span>
          </div>
        </div>
        <div class="drawer-checklist-items" id="checklist-items-${group.key}">
          ${items.map((item, idx) => `
            <div class="drawer-check-item ${item.done ? 'done' : ''}" data-group="${group.key}" data-idx="${idx}">
              <div class="drawer-checkbox" onclick="toggleCheckItem('${group.key}', ${idx}); event.stopPropagation();">
                ${item.done ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <span class="drawer-check-text" ondblclick="startEditCheckItem('${group.key}', ${idx}, this); event.stopPropagation();">${item.title}</span>
              <button class="drawer-check-remove" onclick="removeCheckItem('${group.key}', ${idx}); event.stopPropagation();" title="Remover item">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `).join('')}
          <div class="drawer-check-add" onclick="startAddCheckItem('${group.key}')">
            <i class="fas fa-plus"></i>
            <span>Adicionar item</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleChecklistGroup(key) {
  const items = document.getElementById(`checklist-items-${key}`);
  if (items) items.classList.toggle('collapsed');
}

function toggleCheckItem(groupKey, index) {
  if (!currentDrawerLead || !currentDrawerLead.checklists) return;

  const item = currentDrawerLead.checklists[groupKey][index];
  if (item) {
    item.done = !item.done;
    renderChecklistTab(currentDrawerLead);
    updateDrawerChecklistBadge(currentDrawerLead);

    if (item.done) {
      showToast(`✅ "${item.title}" concluída!`, 'success');
    }
  }
}

// ── Inline Edit Item ────────────────────────────────────────
function startEditCheckItem(groupKey, index, spanEl) {
  if (!currentDrawerLead || !currentDrawerLead.checklists) return;

  const item = currentDrawerLead.checklists[groupKey][index];
  if (!item) return;

  // Prevent double-edit
  if (spanEl.querySelector('input')) return;

  const currentText = item.title;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.className = 'drawer-check-edit-input';

  // Replace text with input
  spanEl.textContent = '';
  spanEl.appendChild(input);
  input.focus();
  input.select();

  // Save on Enter or blur
  const saveEdit = () => {
    const newText = input.value.trim();
    if (newText && newText !== currentText) {
      item.title = newText;
      showToast(`📝 Item atualizado`, 'info');
    }
    renderChecklistTab(currentDrawerLead);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') {
      renderChecklistTab(currentDrawerLead);
    }
  });

  input.addEventListener('blur', saveEdit);
}

// ── Add New Item ────────────────────────────────────────────
function startAddCheckItem(groupKey) {
  if (!currentDrawerLead || !currentDrawerLead.checklists) return;

  const container = document.getElementById(`checklist-items-${groupKey}`);
  if (!container) return;

  // Check if already adding
  if (container.querySelector('.drawer-check-new-input')) return;

  const addBtn = container.querySelector('.drawer-check-add');

  // Create input row
  const inputRow = document.createElement('div');
  inputRow.className = 'drawer-check-item drawer-check-new-row';
  inputRow.innerHTML = `
    <div class="drawer-checkbox" style="border-color: var(--primary); border-style: dashed;">
      <i class="fas fa-plus" style="color: var(--primary); font-size: 8px;"></i>
    </div>
    <input type="text" class="drawer-check-new-input" placeholder="Descreva a nova tarefa..." autofocus>
    <button class="drawer-check-confirm" onclick="confirmAddCheckItem('${groupKey}')" title="Confirmar">
      <i class="fas fa-check"></i>
    </button>
  `;

  // Insert before add button
  container.insertBefore(inputRow, addBtn);

  const input = inputRow.querySelector('input');
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmAddCheckItem(groupKey);
    }
    if (e.key === 'Escape') {
      renderChecklistTab(currentDrawerLead);
    }
  });

  input.addEventListener('blur', (e) => {
    // Small delay to allow confirm button click
    setTimeout(() => {
      if (document.querySelector('.drawer-check-new-input')) {
        const val = input.value.trim();
        if (val) {
          confirmAddCheckItem(groupKey);
        } else {
          renderChecklistTab(currentDrawerLead);
        }
      }
    }, 150);
  });
}

function confirmAddCheckItem(groupKey) {
  if (!currentDrawerLead || !currentDrawerLead.checklists) return;

  const input = document.querySelector(`#checklist-items-${groupKey} .drawer-check-new-input`);
  if (!input) return;

  const text = input.value.trim();
  if (!text) {
    renderChecklistTab(currentDrawerLead);
    return;
  }

  currentDrawerLead.checklists[groupKey].push({ title: text, done: false });
  renderChecklistTab(currentDrawerLead);
  updateDrawerChecklistBadge(currentDrawerLead);
  showToast(`➕ "${text}" adicionada à lista`, 'success');
}

// ── Remove Item ─────────────────────────────────────────────
function removeCheckItem(groupKey, index) {
  if (!currentDrawerLead || !currentDrawerLead.checklists) return;

  const item = currentDrawerLead.checklists[groupKey][index];
  if (!item) return;

  currentDrawerLead.checklists[groupKey].splice(index, 1);
  renderChecklistTab(currentDrawerLead);
  updateDrawerChecklistBadge(currentDrawerLead);
  showToast(`🗑️ "${item.title}" removida`, 'info');
}

function updateDrawerChecklistBadge(lead) {
  const badge = document.getElementById('drawer-checklist-badge');
  if (!badge) return;

  if (!lead.checklists) {
    badge.textContent = '0/0';
    return;
  }

  let done = 0, total = 0;
  Object.values(lead.checklists).forEach(group => {
    group.forEach(item => {
      total++;
      if (item.done) done++;
    });
  });
  badge.textContent = `${done}/${total}`;
}

// ── Notes Tab ───────────────────────────────────────────────
function renderNotesTab(lead) {
  const container = document.getElementById('drawer-panel-notes');
  if (!container) return;

  container.innerHTML = `
    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-sticky-note"></i> Observações</div>
      <textarea class="drawer-notes-area" id="drawer-notes-textarea"
        placeholder="Adicione observações sobre este viajante..."
        oninput="saveDrawerNotes()">${lead.notes || ''}</textarea>
    </div>

    <div class="drawer-section">
      <div class="drawer-section-title"><i class="fas fa-clock"></i> Histórico de Contato</div>
      <div class="drawer-timeline">
        <div class="drawer-timeline-item">
          <div class="drawer-timeline-dot"></div>
          <div class="drawer-timeline-content">
            <div class="drawer-timeline-title">Último contato registrado</div>
            <div class="drawer-timeline-date">${relativeDate(lead.lastActivity)}</div>
          </div>
        </div>
        <div class="drawer-timeline-item">
          <div class="drawer-timeline-dot info"></div>
          <div class="drawer-timeline-content">
            <div class="drawer-timeline-title">Lead adicionado ao sistema</div>
            <div class="drawer-timeline-date">Cadastro inicial</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function saveDrawerNotes() {
  if (!currentDrawerLead) return;
  const textarea = document.getElementById('drawer-notes-textarea');
  if (textarea) {
    currentDrawerLead.notes = textarea.value;
  }
}

// ── Status Change ───────────────────────────────────────────
async function changeDrawerStatus(select) {
  if (!currentDrawerLead) return;

  const newStatus = select.value;
  const labels = { new: 'Novo', negotiating: 'Em Negociação', closed: 'Fechado', lost: 'Perdido' };

  currentDrawerLead.status = newStatus;
  select.setAttribute('data-status', newStatus);

  const session = getSession();
  if (session && session.isSupabase) {
    await updateLead(currentDrawerLead.id, { status: newStatus });
    // Reload pipeline from Supabase
    if (typeof loadAndRenderPipeline === 'function') {
      await loadAndRenderPipeline();
    }
  } else {
    currentDrawerLead.lastActivity = new Date().toISOString().split('T')[0];
    renderPipeline();
  }

  // Update dashboard
  if (typeof renderDashboardLeads === 'function') {
    renderDashboardLeads(typeof currentLeads !== 'undefined' ? currentLeads : undefined);
  }

  // Update nav badge
  const badge = document.querySelector('.nav-badge');
  if (badge) {
    const source = typeof currentLeads !== 'undefined' ? currentLeads : LEADS;
    badge.textContent = source.filter(l => l.status === 'new').length;
  }

  showToast(`Status alterado para "${labels[newStatus]}"`, 'success');
}

// ── Quick Actions ───────────────────────────────────────────
function drawerWhatsApp() {
  if (!currentDrawerLead) return;
  const phone = (currentDrawerLead.phone || '').replace(/\D/g, '');
  if (phone) {
    window.open(`https://wa.me/55${phone}`, '_blank');
  } else {
    showToast('WhatsApp não cadastrado para este viajante', 'error');
  }
}

async function drawerCreateItinerary() {
  if (!currentDrawerLead) return;

  const session = getSession();

  if (session && session.isSupabase) {
    // ── Supabase mode ──
    try {
      const created = await createItinerary({
        title: `${currentDrawerLead.destination || 'Roteiro'} — ${currentDrawerLead.name}`,
        client_name: currentDrawerLead.name,
        destination: currentDrawerLead.destination,
        lead_id: currentDrawerLead.id,
        passengers: currentDrawerLead.profile?.pax || 1,
        budget: currentDrawerLead.value || 10000,
        status: 'draft',
      });
      closeDrawer();
      navigateTo('itinerary');
      if (created && typeof openItinerary === 'function') openItinerary(created.id);
      showToast(`✈️ Roteiro criado para ${currentDrawerLead.name}!`, 'success');
    } catch (err) {
      console.error('drawerCreateItinerary Supabase error:', err);
      showToast('Erro ao criar roteiro. Tente novamente.', 'error');
    }
  } else {
    // ── Demo mode ──
    const newIt = {
      id: ITINERARIES.length + 1,
      title: `${currentDrawerLead.destination} — ${currentDrawerLead.name}`,
      client: currentDrawerLead.name,
      destination: currentDrawerLead.destination,
      dates: 'A definir',
      passengers: currentDrawerLead.profile?.pax || 1,
      budget: currentDrawerLead.value,
      spent: 0,
      status: 'Rascunho',
      days: [
        { label: 'Dia 1', date: 'DD/MM', activities: [] },
        { label: 'Dia 2', date: 'DD/MM', activities: [] },
        { label: 'Dia 3', date: 'DD/MM', activities: [] },
      ]
    };
    ITINERARIES.push(newIt);
    closeDrawer();
    navigateTo('itinerary');
    openItinerary(newIt.id);
    showToast(`✈️ Roteiro criado para ${currentDrawerLead.name}!`, 'success');
  }
}

// ══════════════════════════════════════════════════════════════
// ACTIVITIES TAB — Team Collaboration & Activity Feed
// ══════════════════════════════════════════════════════════════

const ACTIVITY_TYPES = {
  call:       { icon: 'fa-phone',           color: '#3B82F6', label: 'Ligação' },
  whatsapp:   { icon: 'fa-brands fa-whatsapp', color: '#25D366', label: 'WhatsApp' },
  email:      { icon: 'fa-envelope',        color: '#8B5CF6', label: 'E-mail' },
  meeting:    { icon: 'fa-handshake',       color: '#F59E0B', label: 'Reunião' },
  assignment: { icon: 'fa-user-tag',        color: '#EF4444', label: 'Solicitação' },
  note:       { icon: 'fa-sticky-note',     color: '#6B7280', label: 'Observação' },
  status:     { icon: 'fa-arrows-spin',     color: '#10B981', label: 'Status' },
  document:   { icon: 'fa-file-pdf',        color: '#DC2626', label: 'Documento' },
  done:       { icon: 'fa-circle-check',    color: '#16A34A', label: 'Concluído' },
};

function _getTeamMembers() {
  const cached = typeof getCachedTeamMembers === 'function' ? getCachedTeamMembers() : [];
  return cached.length ? cached : TEAM_MEMBERS;
}

function getActivityAuthor(activity) {
  if (activity.author) {
    return activity.author;
  }
  const tm = _getTeamMembers();
  return tm.find(m => m.id === activity.author) || tm[0];
}

async function renderActivitiesTab(lead) {
  const container = document.getElementById('drawer-panel-activities');
  if (!container) return;

  let activities = [];
  const session = getSession();
  
  if (session && session.isSupabase) {
    activities = await fetchLeadActivities(lead.id);
  } else {
    activities = LEAD_ACTIVITIES[lead.id] || [];
  }

  // Update badge
  const badge = document.getElementById('drawer-activities-badge');
  if (badge) {
    const mentionCount = activities.filter(a => a.mentions && a.mentions.length > 0).length;
    if (mentionCount > 0) {
      badge.textContent = mentionCount;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  container.innerHTML = `
    <!-- Activity Composer -->
    <div class="activity-composer">
      <div class="activity-composer-header">
        <span class="activity-composer-title"><i class="fas fa-plus-circle"></i> Registrar Atividade</span>
      </div>
      <div class="activity-type-selector" id="activity-type-selector">
        ${Object.entries(ACTIVITY_TYPES).filter(([k]) => !['status','done'].includes(k)).map(([key, cfg]) => `
          <button class="activity-type-chip ${key === 'note' ? 'active' : ''}" data-type="${key}" onclick="selectActivityType('${key}')">
            <i class="fas ${cfg.icon}"></i> ${cfg.label}
          </button>
        `).join('')}
      </div>
      <div class="activity-compose-body">
        <input type="text" class="activity-title-input" id="activity-title-input" placeholder="Título da atividade..." autocomplete="off">
        <div class="activity-detail-wrap">
          <textarea class="activity-detail-input" id="activity-detail-input" rows="2" placeholder="Detalhes... Use @ para mencionar alguém da equipe"></textarea>
          <div class="mention-dropdown hidden" id="mention-dropdown"></div>
        </div>
        <div class="activity-compose-footer">
          <div class="activity-assign-row">
            <span class="activity-assign-label"><i class="fas fa-user-tag"></i> Atribuir a:</span>
            <select class="activity-assign-select" id="activity-assign-select">
              <option value="">Ninguém</option>
              ${_getTeamMembers().map(m => `<option value="${m.id}">${m.name} (${m.roleLabel || m.role || ''})</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="submitActivity(${lead.id})">
            <i class="fas fa-paper-plane"></i> Registrar
          </button>
        </div>
      </div>
    </div>

    <!-- Activity Feed -->
    <div class="activity-feed-header">
      <span><i class="fas fa-clock-rotate-left"></i> Histórico de Atividades</span>
      <span class="activity-feed-count">${activities.length} registro${activities.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="activity-feed" id="activity-feed">
      ${activities.length === 0 ? `
        <div class="activity-empty">
          <i class="fas fa-inbox"></i>
          <p>Nenhuma atividade registrada ainda.</p>
          <p class="activity-empty-hint">Registre a primeira interação com este cliente acima.</p>
        </div>
      ` : activities.map((act, i) => renderActivityItem(act, i)).join('')}
    </div>
  `;

  // Init @mention listener
  initMentionAutocomplete();
}

function renderActivityItem(act, index) {
  const typeCfg = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.note;
  const author = getActivityAuthor(act);
  const tm = _getTeamMembers();
  const assignedTo = act.assigned_to_id ? tm.find(m => m.id === act.assigned_to_id) : (act.assignedTo ? tm.find(m => m.id === act.assignedTo) : null);
  const mentionedMembers = (act.mentions || []).map(id => tm.find(m => m.id === id)).filter(Boolean);

  // Format date
  const actDate = new Date(act.created_at || act.date);
  const timeStr = actDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = actDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  // Highlight @mentions in details
  let details = act.details || '';
  _getTeamMembers().forEach(m => {
    details = details.replace(new RegExp(`@${m.name}`, 'g'), `<span class="mention-highlight">@${m.name}</span>`);
  });

  const authorInitials = author ? author.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';
  const authorColor = author ? (author.avatar_color || author.color || '#9CA3AF') : '#9CA3AF';
  const authorFirstName = author ? author.name.split(' ')[0] : 'Sistema';

  return `
    <div class="activity-item" style="animation-delay: ${index * 0.04}s">
      <div class="activity-item-dot" style="background: ${typeCfg.color};">
        <i class="fas ${typeCfg.icon}"></i>
      </div>
      <div class="activity-item-content">
        <div class="activity-item-header">
          <div class="activity-item-meta">
            <span class="activity-type-label" style="color: ${typeCfg.color};">${typeCfg.label}</span>
            <span class="activity-item-date">${dateStr} às ${timeStr}</span>
          </div>
        </div>
        <div class="activity-item-title">${act.title}</div>
        ${details ? `<div class="activity-item-details">${details}</div>` : ''}
        <div class="activity-item-footer">
          <div class="activity-author" title="${author ? author.name : 'Desconhecido'}">
            <div class="activity-author-avatar" style="background: ${authorColor};">${authorInitials}</div>
            <span>${authorFirstName}</span>
          </div>
          ${assignedTo ? `
            <div class="activity-assigned-badge" title="Atribuído a ${assignedTo.name}">
              <i class="fas fa-arrow-right"></i>
              <div class="activity-author-avatar" style="background: ${assignedTo.avatar_color || assignedTo.color};">${assignedTo.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
              <span>${assignedTo.name.split(' ')[0]}</span>
            </div>
          ` : ''}
          ${mentionedMembers.length > 0 ? `
            <div class="activity-mentions-row">
              ${mentionedMembers.map(m => `
                <span class="activity-mention-chip" style="border-color: ${(m.avatar_color || m.color)}20; color: ${m.avatar_color || m.color};">
                  @${m.name.split(' ')[0]}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// ── Activity Type Selector ──────────────────────────────────
let selectedActivityType = 'note';

function selectActivityType(type) {
  selectedActivityType = type;
  document.querySelectorAll('.activity-type-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

// ── Submit New Activity ─────────────────────────────────────
async function submitActivity(leadId) {
  const titleInput = document.getElementById('activity-title-input');
  const detailInput = document.getElementById('activity-detail-input');
  const assignSelect = document.getElementById('activity-assign-select');

  const title = titleInput?.value.trim();
  if (!title) {
    showToast('Preencha o título da atividade', 'error');
    titleInput?.focus();
    return;
  }

  const details = detailInput?.value.trim() || '';
  const assignedTo = assignSelect?.value ? assignSelect.value : null;

  // Extract @mentions from details
  const mentionRegex = /@(\w+\s?\w*)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(details)) !== null) {
    const mentioned = _getTeamMembers().find(m => m.name.toLowerCase().startsWith(match[1].toLowerCase()));
    if (mentioned && !mentions.includes(mentioned.id)) {
      mentions.push(mentioned.id);
    }
  }

  // Add assigned person to mentions if not already there
  if (assignedTo && !mentions.includes(assignedTo)) {
    mentions.push(assignedTo);
  }

  // Get current session user
  const session = getSession();
  const authorId = session ? (_getTeamMembers().find(m => m.name === session.name)?.id || 1) : 1;

  const type = assignedTo ? 'assignment' : selectedActivityType;

  if (session && session.isSupabase) {
    const btn = document.querySelector('.activity-compose-footer .btn-primary');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    const activityData = {
      type: type,
      title: title,
      details: details,
      assigned_to_id: assignedTo || null,
      mentions: mentions
    };
    
    await createLeadActivity(leadId, activityData);

    btn.innerHTML = originalHtml;
    btn.disabled = false;
  } else {
    // Create activity locally
    const newActivity = {
      id: Date.now(),
      type: type,
      title: title,
      author: authorId,
      date: new Date().toISOString(),
      mentions: mentions,
      assignedTo: assignedTo ? parseInt(assignedTo) : undefined,
      details: details,
    };

    // Add to activities
    if (!LEAD_ACTIVITIES[leadId]) {
      LEAD_ACTIVITIES[leadId] = [];
    }
    LEAD_ACTIVITIES[leadId].unshift(newActivity);
  }

  // Show notification
  if (mentions.length > 0) {
    const mentionNames = mentions.map(id => _getTeamMembers().find(m => m.id === id)?.name).filter(Boolean);
    showToast(`📬 Notificação enviada para: ${mentionNames.join(', ')}`, 'success');
  } else {
    showToast('✅ Atividade registrada!', 'success');
  }

  // Update notification count
  updateNotificationBadgeForMentions();

  // Re-render
  await renderActivitiesTab(currentDrawerLead);

  // Reload pipeline if Supabase
  if (session && session.isSupabase && typeof loadAndRenderPipeline === 'function') {
    loadAndRenderPipeline();
  }
}

// ── @Mention Autocomplete ───────────────────────────────────
function initMentionAutocomplete() {
  const textarea = document.getElementById('activity-detail-input');
  const dropdown = document.getElementById('mention-dropdown');
  if (!textarea || !dropdown) return;

  textarea.addEventListener('input', () => {
    const val = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const query = atMatch[1].toLowerCase();
      const matches = _getTeamMembers().filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.roleLabel.toLowerCase().includes(query)
      );

      if (matches.length > 0) {
        dropdown.innerHTML = matches.map(m => `
          <div class="mention-option" data-name="${m.name}" onclick="insertMention('${m.name}')">
            <div class="mention-option-avatar" style="background: ${m.color};">${m.avatar}</div>
            <div class="mention-option-info">
              <span class="mention-option-name">${m.name}</span>
              <span class="mention-option-role">${m.roleLabel}</span>
            </div>
            <span class="mention-option-status ${m.status}"></span>
          </div>
        `).join('');
        dropdown.classList.remove('hidden');
        return;
      }
    }

    dropdown.classList.add('hidden');
  });

  // Close on click outside
  textarea.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });

  // Keyboard navigation
  textarea.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
        e.preventDefault();
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        const firstOption = dropdown.querySelector('.mention-option');
        if (firstOption) {
          insertMention(firstOption.dataset.name);
          e.preventDefault();
        }
      }
    }
  });
}

function insertMention(name) {
  const textarea = document.getElementById('activity-detail-input');
  const dropdown = document.getElementById('mention-dropdown');
  if (!textarea) return;

  const val = textarea.value;
  const cursorPos = textarea.selectionStart;
  const textBefore = val.substring(0, cursorPos);
  const textAfter = val.substring(cursorPos);
  const newBefore = textBefore.replace(/@\w*$/, `@${name} `);

  textarea.value = newBefore + textAfter;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = newBefore.length;

  if (dropdown) dropdown.classList.add('hidden');
}

// ── Update Global Notification Badge ────────────────────────
function updateNotificationBadgeForMentions() {
  const session = getSession();
  if (!session) return;

  const currentUser = _getTeamMembers().find(m => m.name === session.name);
  if (!currentUser) return;

  let totalMentions = 0;
  Object.values(LEAD_ACTIVITIES).forEach(activities => {
    activities.forEach(act => {
      if (act.mentions && act.mentions.includes(currentUser.id)) {
        totalMentions++;
      }
    });
  });

  const badge = document.querySelector('.notif-badge');
  if (badge && totalMentions > 0) {
    badge.style.display = '';
    badge.textContent = totalMentions;
  }
}

// ── Keyboard shortcut: Escape closes drawer ─────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const drawer = document.getElementById('lead-drawer');
    if (drawer && drawer.classList.contains('open')) {
      closeDrawer();
    }
  }
});
