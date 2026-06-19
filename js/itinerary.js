/* ══════════════════════════════════════════════════════════════
   ITINERARY.JS — List, Builder, Drag & Drop, PDF Preview
   ══════════════════════════════════════════════════════════════ */

let currentItinerary = null;

function initItinerary() {
  renderItineraryList();
  initItineraryButtons();
  initDragAndDrop();
}

// ── Itinerary List ──────────────────────────────────────────
async function renderItineraryList() {
  const grid = document.getElementById('itinerary-grid');
  if (!grid) return;

  const session = JSON.parse(localStorage.getItem('mapapro_session') || '{}');
  let itineraries;

  if (session.isSupabase) {
    try {
      itineraries = await fetchItineraries();
      // Normalize Supabase fields to match static data format
      itineraries = itineraries.map(it => ({
        ...it,
        client: it.client_name || (it.lead ? it.lead.name : 'Cliente'),
        dates: it.start_date && it.end_date
          ? `${new Date(it.start_date).toLocaleDateString('pt-BR')} — ${new Date(it.end_date).toLocaleDateString('pt-BR')}`
          : 'A definir',
        passengers: it.passengers || 1,
        budget: Number(it.budget) || 0,
        spent: Number(it.spent) || 0,
        status: it.status === 'draft' ? 'Rascunho' : it.status === 'sent' ? 'Enviado' : it.status === 'approved' ? 'Aprovado' : it.status,
        days: it.days || [],
      }));
    } catch (err) {
      console.error('renderItineraryList Supabase error:', err);
      itineraries = [];
    }
  } else {
    itineraries = [...ITINERARIES];
  }

  // Store for global search access
  window._currentItineraries = itineraries;

  grid.innerHTML = itineraries.map(it => {
    const pct = it.budget > 0 ? Math.round((it.spent / it.budget) * 100) : 0;
    const statusClass = it.status === 'Aprovado' ? 'status-badge-closed' :
                        it.status === 'Rascunho' ? 'status-badge-new' : 'status-badge-negotiating';

    return `
    <div class="itinerary-card" onclick="openItinerary('${it.id}')">
      <div class="itinerary-card-cover">
        <i class="fas fa-route"></i>
        <span class="itinerary-card-status">
          <span class="status-badge ${statusClass}">${it.status}</span>
        </span>
      </div>
      <div class="itinerary-card-body">
        <div class="itinerary-card-title">${it.title}</div>
        <div class="itinerary-card-meta">
          <span><i class="fas fa-user"></i> ${it.client}</span>
          <span><i class="fas fa-calendar"></i> ${it.dates}</span>
          <span><i class="fas fa-users"></i> ${it.passengers} passageiro(s)</span>
        </div>
        <div class="itinerary-card-footer">
          <span class="itinerary-card-price">R$ ${it.budget.toLocaleString('pt-BR')}</span>
          <span style="font-size: 12px; color: var(--gray-400);">${(it.days || []).length} dias</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Open Builder ────────────────────────────────────────────
async function openItinerary(id) {
  const session = JSON.parse(localStorage.getItem('mapapro_session') || '{}');
  let it;

  if (session.isSupabase) {
    try {
      it = await fetchItineraryById(id);
      if (it) {
        // Normalize Supabase fields
        it.client = it.client_name || 'Cliente';
        it.dates = it.start_date && it.end_date
          ? `${new Date(it.start_date).toLocaleDateString('pt-BR')} — ${new Date(it.end_date).toLocaleDateString('pt-BR')}`
          : 'A definir';
        it.budget = Number(it.budget) || 0;
        it.spent = Number(it.spent) || 0;
        it.passengers = it.passengers || 1;
        // Normalize days with activities
        it.days = (it.days || []).map(day => ({
          ...day,
          label: day.label || `Dia ${day.day_number}`,
          date: day.date ? new Date(day.date).toLocaleDateString('pt-BR') : 'DD/MM',
          activities: (day.activities || []).map(act => ({
            ...act,
            type: act.type || 'activity',
            title: act.title || 'Atividade',
            detail: act.description || '',
            time: act.time_start || '',
            price: Number(act.cost) || 0,
          })),
        }));
      }
    } catch (err) {
      console.error('openItinerary Supabase error:', err);
      it = null;
    }
  } else {
    it = ITINERARIES.find(i => i.id == id);
  }

  if (!it) return;

  currentItinerary = it;

  // Switch views
  document.getElementById('itinerary-list-view').classList.add('hidden');
  document.getElementById('itinerary-builder-view').classList.remove('hidden');

  // Populate header
  document.getElementById('builder-title').value = it.title;
  document.getElementById('builder-client').textContent = it.client;
  document.getElementById('builder-destination').textContent = it.destination;
  document.getElementById('builder-dates').textContent = it.dates;

  // Budget
  const pct = it.budget > 0 ? Math.min(100, Math.round((it.spent / it.budget) * 100)) : 0;
  document.getElementById('budget-fill').style.width = pct + '%';
  if (pct > 90) document.getElementById('budget-fill').classList.add('over');
  else document.getElementById('budget-fill').classList.remove('over');
  document.getElementById('budget-spent').textContent = `R$ ${it.spent.toLocaleString('pt-BR')}`;
  document.getElementById('budget-total').textContent = `R$ ${it.budget.toLocaleString('pt-BR')}`;

  renderTimeline(it);
}

// ── Back to list ────────────────────────────────────────────
function initItineraryButtons() {
  const backBtn = document.getElementById('back-to-list-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      document.getElementById('itinerary-list-view').classList.remove('hidden');
      document.getElementById('itinerary-builder-view').classList.add('hidden');
      currentItinerary = null;
    });
  }

  const newBtn = document.getElementById('new-itinerary-btn');
  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      const session = JSON.parse(localStorage.getItem('mapapro_session') || '{}');

      if (session.isSupabase) {
        try {
          const created = await createItinerary({
            title: 'Novo Roteiro',
            status: 'draft',
          });
          if (created) {
            await renderItineraryList();
            openItinerary(created.id);
            showToast('Novo roteiro criado!', 'success');
          }
        } catch (err) {
          console.error('New itinerary error:', err);
          showToast('Erro ao criar roteiro.', 'error');
        }
      } else {
        // Local fallback
        const newId = 'local-' + Math.random().toString(36).substr(2, 9);
        const newIt = {
          id: newId,
          title: 'Novo Roteiro',
          client: 'Cliente',
          destination: 'Destino',
          dates: 'A definir',
          passengers: 1,
          budget: 10000,
          spent: 0,
          status: 'Rascunho',
          days: [
            { label: 'Dia 1', date: 'DD/MM', activities: [] },
            { label: 'Dia 2', date: 'DD/MM', activities: [] },
            { label: 'Dia 3', date: 'DD/MM', activities: [] },
          ]
        };
        if (typeof ITINERARIES !== 'undefined') {
          ITINERARIES.unshift(newIt); // Add to the top
        }
        await renderItineraryList();
        openItinerary(newId);
        showToast('Novo roteiro criado (Local)!', 'success');
      }
    });
  }

  const saveBtn = document.getElementById('save-itinerary-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (currentItinerary) {
        currentItinerary.title = document.getElementById('builder-title').value;
        const session = JSON.parse(localStorage.getItem('mapapro_session') || '{}');
        if (session.isSupabase && currentItinerary.id) {
          await updateItinerary(currentItinerary.id, { title: currentItinerary.title });
        }
        await renderItineraryList();
        showToast('Roteiro salvo com sucesso! 💾', 'success');
      }
    });
  }

  const pdfBtn = document.getElementById('preview-pdf-btn');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', () => {
      if (currentItinerary) showPdfPreview(currentItinerary);
    });
  }

  const shareBtn = document.getElementById('share-client-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      if (!currentItinerary) return;
      shareWithClient(currentItinerary);
    });
  }
}

// ── Share with Client ─────────────────────────────────────
function shareWithClient(it) {
  const baseUrl = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
  const shareUrl = `${baseUrl}traveler.html?id=${it.id}`;

  // Copy to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showShareModal(it, shareUrl);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = shareUrl;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showShareModal(it, shareUrl);
  }
}

function showShareModal(it, shareUrl) {
  // WhatsApp share message
  const whatsMsg = encodeURIComponent(
    `Olá! 🗺️✨\n\nSeu roteiro *${it.title}* está pronto!\n\nAcesse aqui para ver todos os detalhes da sua viagem:\n${shareUrl}\n\nQualquer dúvida, estou à disposição! 😊`
  );
  const whatsLink = `https://wa.me/?text=${whatsMsg}`;

  showToast(`Link copiado! 📋 Compartilhe com ${it.client}`, 'success');

  // Open WhatsApp share after a brief delay
  setTimeout(() => {
    if (confirm(`Link copiado!\n\nDeseja enviar diretamente pelo WhatsApp para ${it.client}?`)) {
      window.open(whatsLink, '_blank');
    }
  }, 300);
}

// ── Timeline Render ─────────────────────────────────────────
function renderTimeline(it) {
  const timeline = document.getElementById('builder-timeline');
  if (!timeline) return;

  timeline.innerHTML = it.days.map((day, dayIndex) => `
    <div class="day-column" data-day="${dayIndex}">
      <div class="day-column-header">
        <h4>${day.label}</h4>
        <span class="day-date">${day.date}</span>
      </div>
      <div class="day-column-body" data-day="${dayIndex}" ondrop="dropActivity(event, ${dayIndex})" ondragover="dragOverDay(event)" ondragleave="dragLeaveDay(event)">
        ${day.activities.map((act, actIndex) => renderActivityBlock(act, dayIndex, actIndex)).join('')}
        ${day.activities.length === 0 ? '<div class="drop-placeholder">Arraste blocos aqui</div>' : ''}
      </div>
    </div>
  `).join('');

  // Add "Add Day" button
  timeline.innerHTML += `
    <div class="day-column" style="min-width: 200px; display: flex; align-items: center; justify-content: center; background: transparent; border: 2px dashed var(--gray-200); cursor: pointer;" onclick="addDay()">
      <div style="text-align: center; color: var(--gray-400);">
        <i class="fas fa-plus" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
        <span style="font-size: 13px; font-weight: 600;">Adicionar Dia</span>
      </div>
    </div>`;
}

function renderActivityBlock(act, dayIndex, actIndex) {
  return `
    <div class="activity-block" draggable="true" data-day="${dayIndex}" data-index="${actIndex}"
         ondragstart="dragActivity(event, ${dayIndex}, ${actIndex})"
         onclick="openBlockEditor(${dayIndex}, ${actIndex})">
      <button class="remove-block" onclick="removeActivity(${dayIndex}, ${actIndex}); event.stopPropagation();" title="Remover">
        <i class="fas fa-times"></i>
      </button>
      <button class="duplicate-block" onclick="duplicateActivity(${dayIndex}, ${actIndex}); event.stopPropagation();" title="Duplicar">
        <i class="fas fa-copy"></i>
      </button>
      <span class="activity-block-time">${act.time}</span>
      <div class="activity-block-type">
        <span class="activity-block-type-icon type-${act.type}"><i class="fas ${getTypeIcon(act.type)}"></i></span>
        <span>${getTypeLabel(act.type)}</span>
      </div>
      <div class="activity-block-title">${act.title}</div>
      <div class="activity-block-detail">${act.detail}</div>
      ${act.price > 0 ? `<div class="activity-block-price">R$ ${act.price.toLocaleString('pt-BR')}</div>` : ''}
    </div>`;
}

function getTypeIcon(type) {
  const icons = { flight: 'fa-plane', hotel: 'fa-hotel', activity: 'fa-map-pin', transfer: 'fa-car', restaurant: 'fa-utensils', note: 'fa-sticky-note' };
  return icons[type] || 'fa-circle';
}

function getTypeLabel(type) {
  const labels = { flight: 'VOO', hotel: 'HOTEL', activity: 'ATIVIDADE', transfer: 'TRANSFER', restaurant: 'RESTAURANTE', note: 'NOTA' };
  return labels[type] || type.toUpperCase();
}

// ── Drag & Drop ─────────────────────────────────────────────
let draggedPaletteType = null;
let draggedFrom = null;

function initDragAndDrop() {
  document.querySelectorAll('.palette-block').forEach(block => {
    block.addEventListener('dragstart', (e) => {
      draggedPaletteType = block.dataset.type;
      draggedFrom = null;
      e.dataTransfer.effectAllowed = 'copy';
      block.style.opacity = '0.5';
    });
    block.addEventListener('dragend', () => {
      block.style.opacity = '1';
      draggedPaletteType = null;
    });
  });
}

function dragActivity(e, dayIndex, actIndex) {
  draggedPaletteType = null;
  draggedFrom = { day: dayIndex, index: actIndex };
  e.dataTransfer.effectAllowed = 'move';
  e.target.style.opacity = '0.4';
  setTimeout(() => { if (e.target) e.target.style.opacity = '1'; }, 200);
}

function dragOverDay(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function dragLeaveDay(e) {
  e.currentTarget.classList.remove('drag-over');
}

function dropActivity(e, targetDay) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (!currentItinerary) return;

  if (draggedPaletteType) {
    // New block from palette
    const newActivity = createDefaultActivity(draggedPaletteType);
    currentItinerary.days[targetDay].activities.push(newActivity);
    updateBudget();
    renderTimeline(currentItinerary);
    showToast(`${getTypeLabel(draggedPaletteType)} adicionado ao ${currentItinerary.days[targetDay].label}`, 'success');
    draggedPaletteType = null;
  } else if (draggedFrom) {
    // Move existing block
    const [activity] = currentItinerary.days[draggedFrom.day].activities.splice(draggedFrom.index, 1);
    currentItinerary.days[targetDay].activities.push(activity);
    renderTimeline(currentItinerary);
    draggedFrom = null;
  }
}

function createDefaultActivity(type) {
  const defaults = {
    flight: { type: 'flight', title: 'Novo Voo', detail: 'Origem → Destino', time: '00:00', price: 2000 },
    hotel: { type: 'hotel', title: 'Novo Hotel', detail: 'Check-in', time: '14:00', price: 800 },
    activity: { type: 'activity', title: 'Nova Atividade', detail: 'Descrição', time: '10:00', price: 150 },
    transfer: { type: 'transfer', title: 'Novo Transfer', detail: 'Tipo de transporte', time: '09:00', price: 100 },
    restaurant: { type: 'restaurant', title: 'Novo Restaurante', detail: 'Tipo de culinária', time: '19:00', price: 200 },
    note: { type: 'note', title: 'Nova Nota', detail: 'Observação', time: '', price: 0 },
  };
  return { ...defaults[type] };
}

function removeActivity(dayIndex, actIndex) {
  if (!currentItinerary) return;
  currentItinerary.days[dayIndex].activities.splice(actIndex, 1);
  updateBudget();
  renderTimeline(currentItinerary);
  showToast('Item removido do roteiro', 'info');
}

// ── Block Editor (Inline Edit) ──────────────────────────────
function openBlockEditor(dayIndex, actIndex) {
  if (!currentItinerary) return;
  const act = currentItinerary.days[dayIndex].activities[actIndex];
  if (!act) return;

  // Remove any existing editor
  closeBlockEditor();

  const block = document.querySelector(`.activity-block[data-day="${dayIndex}"][data-index="${actIndex}"]`);
  if (!block) return;

  // Create editor popover
  const editor = document.createElement('div');
  editor.className = 'block-editor';
  editor.id = 'block-editor-active';
  editor.innerHTML = `
    <div class="block-editor-header">
      <div class="block-editor-type">
        <span class="activity-block-type-icon type-${act.type}"><i class="fas ${getTypeIcon(act.type)}"></i></span>
        <span>Editar ${getTypeLabel(act.type)}</span>
      </div>
      <button class="block-editor-close" onclick="closeBlockEditor(); event.stopPropagation();">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="block-editor-body">
      <div class="block-editor-field">
        <label>Título</label>
        <input type="text" id="editor-title" value="${act.title}" placeholder="Nome da atividade">
      </div>
      <div class="block-editor-field">
        <label>Detalhe</label>
        <input type="text" id="editor-detail" value="${act.detail}" placeholder="Descrição curta">
      </div>
      <div class="block-editor-row">
        <div class="block-editor-field">
          <label>Horário</label>
          <input type="time" id="editor-time" value="${act.time}">
        </div>
        <div class="block-editor-field">
          <label>Preço (R$)</label>
          <input type="number" id="editor-price" value="${act.price}" min="0" step="50" placeholder="0">
        </div>
      </div>
      <div class="block-editor-field">
        <label>Tipo</label>
        <select id="editor-type" disabled title="Não é possível alterar o tipo após a criação">
          <option value="flight" ${act.type === 'flight' ? 'selected' : ''}>✈️ Voo</option>
          <option value="hotel" ${act.type === 'hotel' ? 'selected' : ''}>🏨 Hotel</option>
          <option value="activity" ${act.type === 'activity' ? 'selected' : ''}>📍 Atividade</option>
          <option value="transfer" ${act.type === 'transfer' ? 'selected' : ''}>🚗 Transfer</option>
          <option value="restaurant" ${act.type === 'restaurant' ? 'selected' : ''}>🍽️ Restaurante</option>
          <option value="note" ${act.type === 'note' ? 'selected' : ''}>📝 Nota</option>
        </select>
      </div>
    </div>
    <div class="block-editor-footer" style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; align-items: center;">
      <input type="file" id="ai-file-${dayIndex}-${actIndex}" style="display: none;" accept=".pdf,.txt,.csv,.doc,.docx" onchange="handleAIFileUpload(event, ${dayIndex}, ${actIndex})">
      <button class="btn btn-ghost btn-sm" style="color: var(--orange-500);" onclick="document.getElementById('ai-file-${dayIndex}-${actIndex}').click(); event.stopPropagation();" title="Anexar documento e preencher com IA">
        <i class="fas fa-wand-magic-sparkles"></i> Extrair de Documento
      </button>
      <div id="ai-status-${dayIndex}-${actIndex}" style="font-size: 11px; color: var(--gray-400); flex: 1;"></div>
      <button class="btn btn-ghost btn-sm" onclick="duplicateActivity(${dayIndex}, ${actIndex}); event.stopPropagation();">
        <i class="fas fa-copy"></i> Duplicar
      </button>
      <button class="btn btn-primary btn-sm" onclick="saveBlockEdit(${dayIndex}, ${actIndex}); event.stopPropagation();">
        <i class="fas fa-check"></i> Salvar
      </button>
    </div>
  `;

  // Position relative to the block
  block.style.position = 'relative';
  block.appendChild(editor);

  // Focus title input
  setTimeout(() => {
    const titleInput = document.getElementById('editor-title');
    if (titleInput) { titleInput.focus(); titleInput.select(); }
  }, 50);

  // Save on Enter key
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      saveBlockEdit(dayIndex, actIndex);
    }
    if (e.key === 'Escape') {
      closeBlockEditor();
    }
  });

  // Prevent drag while editing
  block.setAttribute('draggable', 'false');

  // Stop click propagation
  editor.addEventListener('click', (e) => e.stopPropagation());
}

function saveBlockEdit(dayIndex, actIndex) {
  if (!currentItinerary) return;
  const act = currentItinerary.days[dayIndex].activities[actIndex];
  if (!act) return;

  const title = document.getElementById('editor-title');
  const detail = document.getElementById('editor-detail');
  const time = document.getElementById('editor-time');
  const price = document.getElementById('editor-price');
  const type = document.getElementById('editor-type');

  if (title) act.title = title.value.trim() || act.title;
  if (detail) act.detail = detail.value.trim() || act.detail;
  if (time) act.time = time.value;
  if (price) act.price = parseFloat(price.value) || 0;
  if (type) act.type = type.value;

  closeBlockEditor();
  updateBudget();
  renderTimeline(currentItinerary);
  showToast(`✏️ "${act.title}" atualizado!`, 'success');
}

function closeBlockEditor() {
  const editor = document.getElementById('block-editor-active');
  if (editor) {
    const block = editor.closest('.activity-block');
    if (block) block.setAttribute('draggable', 'true');
    editor.remove();
  }
}

function duplicateActivity(dayIndex, actIndex) {
  if (!currentItinerary) return;
  const act = currentItinerary.days[dayIndex].activities[actIndex];
  if (!act) return;

  const clone = { ...act, title: `${act.title} (cópia)` };
  currentItinerary.days[dayIndex].activities.splice(actIndex + 1, 0, clone);

  closeBlockEditor();
  updateBudget();
  renderTimeline(currentItinerary);
  showToast(`📋 "${act.title}" duplicado!`, 'success');
}

function addDay() {
  if (!currentItinerary) return;
  const num = currentItinerary.days.length + 1;
  currentItinerary.days.push({ label: `Dia ${num}`, date: 'DD/MM', activities: [] });
  renderTimeline(currentItinerary);
  showToast(`Dia ${num} adicionado!`, 'success');
}

function updateBudget() {
  if (!currentItinerary) return;
  let total = 0;
  currentItinerary.days.forEach(day => {
    day.activities.forEach(act => { total += act.price || 0; });
  });
  currentItinerary.spent = total;
  const pct = Math.min(100, Math.round((total / currentItinerary.budget) * 100));
  document.getElementById('budget-fill').style.width = pct + '%';
  if (pct > 90) document.getElementById('budget-fill').classList.add('over');
  else document.getElementById('budget-fill').classList.remove('over');
  document.getElementById('budget-spent').textContent = `R$ ${total.toLocaleString('pt-BR')}`;
}

// ── PDF Preview ─────────────────────────────────────────────
function showPdfPreview(it) {
  const content = document.getElementById('pdf-preview-content');
  if (!content) return;

  // ── Type helpers ──
  function typeIcon(type) {
    const map = { flight:'✈️', hotel:'🏨', activity:'🗺️', transfer:'🚗', restaurant:'🍽️', note:'📝' };
    return map[type] || '📌';
  }
  function typeLabel(type) {
    const map = { flight:'Aéreo', hotel:'Hospedagem', activity:'Passeio', transfer:'Transfer', restaurant:'Gastronomia', note:'Nota' };
    return map[type] || type;
  }

  // ── Budget breakdown ──
  const breakdown = {};
  let totalSpent = 0;
  it.days.forEach(day => {
    day.activities.forEach(act => {
      const label = typeLabel(act.type);
      breakdown[label] = (breakdown[label] || 0) + (act.price || 0);
      totalSpent += (act.price || 0);
    });
  });

  // ── Voucher count ──
  const voucherCount = (it.vouchers || []).length;

  content.innerHTML = `
    <div class="pdf-preview" id="pdf-render-target">
      <!-- HEADER -->
      <div class="pdf-header">
        <div class="pdf-logo-row">
          <div class="pdf-logo">
            <div class="pdf-logo-icon"><i class="fas fa-map-marker-alt"></i></div>
            <span>Mapa<span class="pdf-pro">PRO</span></span>
          </div>
          <div class="pdf-doc-info">
            <span>Roteiro de Viagem</span>
            <span class="pdf-date">Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <div class="pdf-hero">
          <h1>${it.destination}</h1>
          <p>${it.title}</p>
        </div>
        <div class="pdf-client-grid">
          <div class="pdf-client-card">
            <div class="pdf-client-label">Cliente</div>
            <div class="pdf-client-value">${it.client}</div>
          </div>
          <div class="pdf-client-card">
            <div class="pdf-client-label">Período</div>
            <div class="pdf-client-value">${it.dates}</div>
          </div>
          <div class="pdf-client-card">
            <div class="pdf-client-label">Passageiros</div>
            <div class="pdf-client-value">${it.passengers}</div>
          </div>
          <div class="pdf-client-card">
            <div class="pdf-client-label">Investimento</div>
            <div class="pdf-client-value pdf-price">R$ ${it.budget.toLocaleString('pt-BR')}</div>
          </div>
        </div>
      </div>

      <!-- ITINERARY -->
      <div class="pdf-body">
        <div class="pdf-section-title"><i class="fas fa-route"></i> Roteiro Dia a Dia</div>
        ${it.days.map(day => `
          <div class="pdf-day">
            <div class="pdf-day-header">
              <span class="pdf-day-label">${day.label}</span>
              <span class="pdf-day-date">${day.date}</span>
            </div>
            ${day.activities.length === 0
              ? '<div class="pdf-activity-empty">Dia livre — aproveite para explorar!</div>'
              : day.activities.map(act => `
                <div class="pdf-activity">
                  <div class="pdf-activity-time">${act.time || '—'}</div>
                  <div class="pdf-activity-icon">${typeIcon(act.type)}</div>
                  <div class="pdf-activity-content">
                    <div class="pdf-activity-title">${act.title}</div>
                    <div class="pdf-activity-detail">${act.detail}</div>
                  </div>
                  ${act.price > 0 ? `<div class="pdf-activity-price">R$ ${act.price.toLocaleString('pt-BR')}</div>` : '<div class="pdf-activity-price">—</div>'}
                </div>
              `).join('')}
          </div>
        `).join('')}

        <!-- BUDGET BREAKDOWN -->
        <div class="pdf-section-title" style="margin-top: 28px;"><i class="fas fa-wallet"></i> Resumo Financeiro</div>
        <div class="pdf-budget">
          <div class="pdf-budget-items">
            ${Object.entries(breakdown).map(([label, value]) => `
              <div class="pdf-budget-row">
                <span>${label}</span>
                <span>R$ ${value.toLocaleString('pt-BR')}</span>
              </div>
            `).join('')}
            <div class="pdf-budget-row pdf-budget-total">
              <span>Total Utilizado</span>
              <span>R$ ${totalSpent.toLocaleString('pt-BR')}</span>
            </div>
          </div>
          <div class="pdf-budget-summary">
            <div class="pdf-budget-bar">
              <div class="pdf-budget-bar-fill" style="width: ${Math.min(100, Math.round((totalSpent / it.budget) * 100))}%"></div>
            </div>
            <div class="pdf-budget-meta">
              <span>${Math.round((totalSpent / it.budget) * 100)}% do orçamento</span>
              <span>R$ ${it.budget.toLocaleString('pt-BR')} total</span>
            </div>
          </div>
        </div>

        ${voucherCount > 0 ? `
        <div class="pdf-voucher-note">
          <i class="fas fa-paperclip"></i>
          ${voucherCount} documento(s) anexado(s) — acesse o link do roteiro para visualizar e baixar seus vouchers.
        </div>
        ` : ''}
      </div>

      <!-- FOOTER -->
      <div class="pdf-footer">
        <div class="pdf-footer-brand">
          <strong>O Segredo do Viajante</strong>
          <span>Consultoria Premium em Viagens</span>
        </div>
        <div class="pdf-footer-contact">
          <span>Lucas Felipe — Consultor de Viagens</span>
          <span>CNPJ: 47.915.163/0001-68</span>
          <span>contato@osegredodoviajante.com</span>
        </div>
      </div>
    </div>`;

  openModal('pdf-modal');
}

// ── Download PDF via html2pdf.js ─────────────────────────────
function downloadPdf() {
  const element = document.getElementById('pdf-render-target');
  if (!element) {
    showToast('Erro: template PDF não encontrado', 'error');
    return;
  }

  const btn = document.getElementById('download-pdf-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
  }

  // Filename from itinerary title
  const title = element.querySelector('.pdf-hero h1')?.textContent || 'roteiro';
  const client = element.querySelector('.pdf-client-value')?.textContent || '';
  const filename = `Roteiro_${title.replace(/\s+/g, '_')}_${client.replace(/\s+/g, '_')}.pdf`;

  const opt = {
    margin:       [0, 0, 0, 0],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-download"></i> Baixar PDF';
    }
    showToast('PDF gerado com sucesso! 📄', 'success');
  }).catch(err => {
    console.error('PDF generation error:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-download"></i> Baixar PDF';
    }
    showToast('Erro ao gerar PDF. Tente novamente.', 'error');
  });
}

// ── AI Extraction ───────────────────────────────────────────
async function handleAIFileUpload(event, dayIndex, actIndex) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById(`ai-status-${dayIndex}-${actIndex}`);
  if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lendo arquivo...';

  try {
    let text = '';
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') {
      text = await extractTextFromPDF(file);
    } else {
      text = await file.text();
    }

    if (!text || text.trim().length < 10) {
      throw new Error("Não foi possível extrair texto legível do arquivo.");
    }

    if (statusEl) statusEl.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Analisando com a Thay...';
    
    const extracted = await extractDataWithAI(text);
    
    if (extracted) {
      if (extracted.title) document.getElementById('editor-title').value = extracted.title;
      if (extracted.detail) document.getElementById('editor-detail').value = extracted.detail;
      if (extracted.time) document.getElementById('editor-time').value = extracted.time;
      if (extracted.price) document.getElementById('editor-price').value = extracted.price;
      if (extracted.type) {
        const sel = document.getElementById('editor-type');
        if (sel) {
          sel.disabled = false; // Allow AI to change it
          sel.value = extracted.type;
        }
      }
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--green-500)"><i class="fas fa-check"></i> Preenchido! (Revise e clique em Salvar)</span>';
      showToast('Dados extraídos com sucesso! 🪄', 'success');
    } else {
      throw new Error("A IA não conseguiu interpretar os dados.");
    }

  } catch (err) {
    console.error('AI Extraction error:', err);
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red-500)"><i class="fas fa-times"></i> Erro: ${err.message}</span>`;
    showToast('Falha na extração por IA.', 'error');
  }
}

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  if (!window.pdfjsLib) throw new Error("Biblioteca PDF não carregada.");
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  // Limit to first 3 pages to save tokens and time
  const numPages = Math.min(pdf.numPages, 3); 
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    text += strings.join(' ') + '\n';
  }
  return text;
}

async function extractDataWithAI(textContent) {
  // Use config from copilot.js if loaded, or fetch from Supabase
  let config = window.aiConfig;
  const session = getSession();
  
  if (!config && session && session.isSupabase) {
    const { data } = await supabase.from('crm_ai_config').select('*').eq('agency_id', session.agencyId).maybeSingle();
    config = data;
  }
  
  const provider = config?.provider || 'gemini';
  const apiKey = config?.api_key_encrypted || localStorage.getItem('thay_api_key');
  const modelName = config?.model || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('Chave de API da IA não configurada no painel Super Admin.');
  }

  const prompt = `Extraia as informações cruciais deste documento/voucher de viagem para preencher um bloco de roteiro.
Responda APENAS com um objeto JSON válido, sem formatação markdown.
As chaves do JSON devem ser exatamente estas:
- title: string curta (ex: "Voo LA8045", "Marriott Resort", "Passeio de Barco")
- detail: string (breve resumo do documento, locais, assentos, reserva)
- time: string no formato "HH:MM" (horário de embarque, check-in ou início)
- price: numero (apenas o valor numérico em BRL, converta se necessário ou coloque 0 se não tiver)
- type: string (deve ser obrigatoriamente um destes: "flight", "hotel", "activity", "transfer", "restaurant", "note")

Texto do documento:
${textContent.substring(0, 8000)}`;

  try {
    let responseText = '';
    
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
      const data = await res.json();
      responseText = data.candidates[0].content.parts[0].text;
    } else if (provider === 'openai') {
      const url = 'https://api.openai.com/v1/chat/completions';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${apiKey}\` },
        body: JSON.stringify({
          model: modelName,
          response_format: { type: "json_object" },
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
      const data = await res.json();
      responseText = data.choices[0].message.content;
    } else if (provider === 'claude') {
      const url = 'https://api.anthropic.com/v1/messages';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!res.ok) throw new Error(`Claude API error ${res.status}`);
      const data = await res.json();
      responseText = data.content[0].text;
    }

    // Limpar crases Markdown do JSON se a IA enviou
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(responseText);

  } catch (e) {
    console.error('extractDataWithAI error:', e);
    throw e;
  }
}


