/* ══════════════════════════════════════════════════════════════
   LEADS.JS — Pipeline View, Filtering, Add Lead
   ══════════════════════════════════════════════════════════════ */

let currentLeads = []; // Store loaded leads

async function initLeads() {
  await loadAndRenderPipeline();
  initLeadFilters();
  initAddLead();
}

async function loadAndRenderPipeline() {
  const container = document.querySelector('#leads .pipeline-board');
  if (container) {
    container.style.opacity = '0.5'; // Visual feedback for loading
  }

  // 1. Check if Supabase is connected
  const session = getSession();
  if (session && session.isSupabase) {
    currentLeads = await fetchLeads();
  } else {
    // Fallback
    currentLeads = [...LEADS];
  }

  if (container) {
    container.style.opacity = '1';
  }

  const statusFilter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';
  const destFilter = document.getElementById('filter-destination') ? document.getElementById('filter-destination').value : 'all';
  const sortFilter = document.getElementById('filter-sort') ? document.getElementById('filter-sort').value : 'recent';

  renderPipeline(statusFilter, destFilter, sortFilter);
}

// ── Pipeline Render ─────────────────────────────────────────
function renderPipeline(filterStatus = 'all', filterDest = 'all', sortBy = 'recent') {
  let filtered = [...currentLeads];

  // Apply filters
  if (filterStatus !== 'all') {
    filtered = filtered.filter(l => l.status === filterStatus);
  }
  if (filterDest !== 'all') {
    filtered = filtered.filter(l => (l.destination || '').toLowerCase() === filterDest.toLowerCase());
  }

  // Apply sort
  switch (sortBy) {
    case 'value-desc': filtered.sort((a, b) => b.value - a.value); break;
    case 'value-asc': filtered.sort((a, b) => a.value - b.value); break;
    case 'name': filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
    default: filtered.sort((a, b) => new Date(b.last_activity_at || b.lastActivity) - new Date(a.last_activity_at || a.lastActivity));
  }

  const statuses = ['new', 'negotiating', 'closed', 'lost'];

  statuses.forEach(status => {
    const container = document.getElementById(`pipeline-${status}`);
    const count = document.getElementById(`pipeline-${status}-count`);
    if (!container) return;

    const statusLeads = filtered.filter(l => l.status === status);
    count.textContent = statusLeads.length;

    container.innerHTML = statusLeads.map(lead => {
      // Determine avatar
      let avatarHtml = '';
      if (lead.assigned_member) {
        avatarHtml = `<div class="lead-card-avatar" style="background-color: ${lead.assigned_member.avatar_color}" title="${lead.assigned_member.name}">${lead.assigned_member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>`;
      } else {
        avatarHtml = `<div class="lead-card-avatar">${lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>`;
      }

      const dateStr = lead.last_activity_at || lead.lastActivity;
      
      return `
      <div class="lead-card" draggable="true" data-id="${lead.id}" onclick="showLeadDetail('${lead.id}')">
        <div class="lead-card-header">
          <span class="lead-card-name">${lead.name}</span>
          <span class="lead-card-value">R$ ${Number(lead.value).toLocaleString('pt-BR')}</span>
        </div>
        <div class="lead-card-destination">
          <i class="fas fa-map-marker-alt"></i>
          ${lead.destination || 'Indefinido'}
        </div>
        <div class="lead-card-footer">
          <span class="lead-card-date">${relativeDate(dateStr)}</span>
          ${avatarHtml}
        </div>
      </div>
    `}).join('');

    if (!statusLeads.length) {
      container.innerHTML = '<div class="drop-placeholder">Nenhum lead nesta etapa</div>';
    }
  });

  initDragAndDrop();
}

// ── Drag and Drop Logic ─────────────────────────────────────
function initDragAndDrop() {
  const cards = document.querySelectorAll('.lead-card');
  const columns = document.querySelectorAll('.pipeline-cards');

  cards.forEach(card => {
    card.addEventListener('dragstart', () => {
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  columns.forEach(column => {
    column.addEventListener('dragover', e => {
      e.preventDefault();
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', async e => {
      e.preventDefault();
      column.classList.remove('drag-over');
      
      const draggingCard = document.querySelector('.dragging');
      if (!draggingCard) return;

      // Identify the new status from the column ID (e.g. "pipeline-new")
      const newStatus = column.id.replace('pipeline-', '');
      const leadId = draggingCard.dataset.id;

      // Update in Supabase or local depending on mode
      const session = getSession();
      if (session && session.isSupabase) {
        const lead = currentLeads.find(l => l.id === leadId);
        if (lead && lead.status !== newStatus) {
          lead.status = newStatus; // optimistic UI update
          
          renderPipeline(
            document.getElementById('filter-status').value,
            document.getElementById('filter-destination').value,
            document.getElementById('filter-sort').value
          );

          await updateLead(leadId, { status: newStatus });
          if (typeof showToast === 'function') {
            showToast(`Status atualizado com sucesso!`);
          }
          await loadAndRenderPipeline(); // reload fully
        }
      } else {
        // Fallback
        const leadIdNum = parseInt(leadId, 10);
        const lead = LEADS.find(l => l.id === leadIdNum);
        if (lead && lead.status !== newStatus) {
          lead.status = newStatus;
          lead.lastActivity = new Date().toISOString();
          
          renderPipeline(
            document.getElementById('filter-status').value,
            document.getElementById('filter-destination').value,
            document.getElementById('filter-sort').value
          );
          
          if (typeof showToast === 'function') {
            showToast(`Status atualizado com sucesso!`);
          }
        }
      }
      
      // Update dashboard table if loaded
      if (typeof renderDashboardLeads === 'function') {
        renderDashboardLeads();
      }
    });
  });
}

// ── Filters ─────────────────────────────────────────────────
function initLeadFilters() {
  const filterBtn = document.getElementById('leads-filter-btn');
  const filtersBar = document.getElementById('leads-filters');

  if (filterBtn && filtersBar) {
    filterBtn.addEventListener('click', () => {
      filtersBar.classList.toggle('hidden');
    });
  }

  const statusFilter = document.getElementById('filter-status');
  const destFilter = document.getElementById('filter-destination');
  const sortFilter = document.getElementById('filter-sort');

  [statusFilter, destFilter, sortFilter].forEach(select => {
    if (select) {
      select.addEventListener('change', () => {
        renderPipeline(
          statusFilter ? statusFilter.value : 'all',
          destFilter ? destFilter.value : 'all',
          sortFilter ? sortFilter.value : 'recent'
        );
      });
    }
  });
}

// ── Add Lead Button ─────────────────────────────────────────
function initAddLead() {
  const btn = document.getElementById('add-lead-btn');
  if (btn) {
    btn.addEventListener('click', () => openModal('lead-modal'));
  }
}

// ── Lead Detail → Open Drawer ───────────────────────────────
function showLeadDetail(id) {
  openDrawer(id);
}

// ── Submit New Lead ─────────────────────────────────────────
async function submitNewLead(e) {
  e.preventDefault();
  const name = document.getElementById('nl-name').value;
  const email = document.getElementById('nl-email').value;
  const phone = document.getElementById('nl-phone').value;
  const destination = document.getElementById('nl-destination').value;
  const value = document.getElementById('nl-value').value;

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  btn.disabled = true;

  const session = getSession();

  if (session && session.isSupabase) {
    const newLead = await createLead({
      name,
      email,
      phone,
      destination,
      value: parseFloat(value) || 0,
      status: 'new'
    });

    if (newLead) {
      await loadAndRenderPipeline();
      closeModal('lead-modal');
      e.target.reset();
      showToast('Lead cadastrado com sucesso!', 'success');
    } else {
      showToast('Erro ao cadastrar lead.', 'error');
    }
  } else {
    // Fallback static
    const newLead = {
      id: Date.now(),
      name,
      email,
      phone,
      destination,
      value: parseFloat(value) || 0,
      status: 'new',
      lastActivity: new Date().toISOString()
    };
    LEADS.unshift(newLead);
    renderPipeline();
    closeModal('lead-modal');
    e.target.reset();
    showToast('Lead cadastrado com sucesso!', 'success');
  }

  btn.innerHTML = originalText;
  btn.disabled = false;
}
