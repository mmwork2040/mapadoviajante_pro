/* ══════════════════════════════════════════════════════════════
   LIBRARY.JS — Destination Grid, Filters, Detail Modal
   Now powered by Supabase (crm_library_destinations)
   ══════════════════════════════════════════════════════════════ */

// ── Local cache ─────────────────────────────────────────────
let _libDestinations = [];

async function initLibrary() {
  await loadLibraryData();
  renderLibrary();
  initLibraryFilters();
}

async function loadLibraryData() {
  const session = getSession();
  if (session && session.isSupabase) {
    _libDestinations = await fetchDestinations();
  } else {
    // Fallback to static data
    _libDestinations = (typeof DESTINATIONS !== 'undefined') ? [...DESTINATIONS] : [];
  }
}

// ── Category mapping (DB uses Portuguese) ───────────────────
const CATEGORY_MAP = {
  praia:     { emoji: '🏖️', label: 'Praia',     filter: 'praia' },
  aventura:  { emoji: '⛰️', label: 'Aventura',  filter: 'aventura' },
  cultural:  { emoji: '🏛️', label: 'Cultural',  filter: 'cultural' },
  romantico: { emoji: '💕', label: 'Romântico', filter: 'romantico' },
  luxo:      { emoji: '✨', label: 'Luxo',      filter: 'luxo' },
  familia:   { emoji: '👨‍👩‍👧‍👦', label: 'Família',   filter: 'familia' },
  // Fallback for old English keys from data.js
  beach:     { emoji: '🏖️', label: 'Praia',     filter: 'praia' },
  adventure: { emoji: '⛰️', label: 'Aventura',  filter: 'aventura' },
};

function getCategoryEmoji(cat) {
  return CATEGORY_MAP[cat]?.emoji || '📍';
}

function getCategoryLabel(cat) {
  return CATEGORY_MAP[cat]?.label || cat;
}

// ── Render Grid ─────────────────────────────────────────────
function renderLibrary(filter = 'all') {
  const grid = document.getElementById('library-grid');
  if (!grid) return;

  let destinations = [..._libDestinations];
  if (filter !== 'all') {
    destinations = destinations.filter(d => d.category === filter);
  }

  if (destinations.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--gray-400);">
        <i class="fas fa-globe-americas" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
        <p style="font-size: 16px; margin-bottom: 4px;">Nenhum destino encontrado</p>
        <p style="font-size: 13px;">Adicione destinos à biblioteca da agência</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = destinations.map(dest => {
    const imageStyle = dest.image_url || dest.image || 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)';
    const avgCost = dest.avg_budget
      ? `R$ ${Number(dest.avg_budget).toLocaleString('pt-BR')}`
      : (dest.avgCost || '—');
    const country = dest.country || '—';
    const climateText = dest.climate || '—';
    const description = dest.description || '';

    return `
    <div class="destination-card" onclick="showDestinationDetail('${dest.id}')">
      <div class="destination-card-image" style="background: ${imageStyle};">
        <span class="destination-card-tag">
          <span class="chip chip-active" style="font-size: 10px; padding: 3px 10px;">
            ${getCategoryEmoji(dest.category)} ${getCategoryLabel(dest.category)}
          </span>
        </span>
        <span class="destination-card-name">${dest.name}</span>
      </div>
      <div class="destination-card-body">
        <div class="destination-card-info">
          <span><i class="fas fa-globe-americas"></i> ${country}</span>
          <span><i class="fas fa-sun"></i> ${climateText}</span>
        </div>
        <p class="destination-card-desc">${description}</p>
        <div class="destination-card-footer">
          <span class="destination-card-price">A partir de <strong>${avgCost}</strong></span>
          <button class="btn btn-ghost btn-sm"><i class="fas fa-arrow-right"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Filters ─────────────────────────────────────────────────
function initLibraryFilters() {
  document.querySelectorAll('.library-filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.library-filters .chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      renderLibrary(chip.dataset.filter);
    });
  });
}

// ── Destination Detail Modal ────────────────────────────────
function showDestinationDetail(id) {
  const dest = _libDestinations.find(d => String(d.id) === String(id));
  if (!dest) return;

  const container = document.getElementById('destination-detail');
  if (!container) return;

  const imageStyle = dest.image_url || dest.image || 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)';
  const currency = dest.currency || '—';
  const timezone = dest.timezone || '—';
  const climateText = dest.climate || '—';
  const visaText = dest.visa_required ? 'Requerido' : 'Não requerido';
  const attractions = dest.attractions || [];
  const country = dest.country || '';
  const description = dest.description || '';
  const operationalNotes = dest.operational_notes || '';

  container.innerHTML = `
    <div class="destination-detail-header" style="background: ${imageStyle};">
      <h2>${dest.name}${country ? `, ${country}` : ''}</h2>
    </div>

    <div class="destination-detail-info">
      <div class="detail-info-card">
        <i class="fas fa-coins"></i>
        <span class="info-label">Moeda</span>
        <span class="info-value">${currency}</span>
      </div>
      <div class="detail-info-card">
        <i class="fas fa-clock"></i>
        <span class="info-label">Fuso Horário</span>
        <span class="info-value">${timezone}</span>
      </div>
      <div class="detail-info-card">
        <i class="fas fa-sun"></i>
        <span class="info-label">Clima</span>
        <span class="info-value">${climateText}</span>
      </div>
      <div class="detail-info-card">
        <i class="fas fa-passport"></i>
        <span class="info-label">Visto</span>
        <span class="info-value">${visaText}</span>
      </div>
    </div>

    <div class="destination-detail-desc">
      <p>${description}</p>
    </div>

    ${attractions.length > 0 ? `
    <div class="destination-detail-attractions">
      <h3>🎯 Principais Atrações</h3>
      <div class="attractions-grid">
        ${attractions.map(attr => `
          <div class="attraction-item">
            <i class="fas fa-map-pin"></i>
            <span>${attr}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${operationalNotes ? `
    <div class="destination-detail-notes" style="margin-top: 16px; padding: 12px 16px; background: var(--gray-50); border-radius: var(--radius-lg); border-left: 3px solid var(--primary);">
      <h4 style="font-size: 12px; text-transform: uppercase; color: var(--primary); margin-bottom: 6px;">
        <i class="fas fa-clipboard-list"></i> Notas Operacionais
      </h4>
      <p style="font-size: 13px; color: var(--gray-600); line-height: 1.5;">${operationalNotes}</p>
    </div>` : ''}

    <div class="destination-detail-cta">
      <button class="btn btn-outline" onclick="closeModal('destination-modal')">Fechar</button>
      <button class="btn btn-primary" onclick="useInItinerary('${dest.name}')">
        <i class="fas fa-route"></i> Usar no Roteiro
      </button>
    </div>
  `;

  openModal('destination-modal');
}

// ── Use in Itinerary ──────────────────────────────────────────
function useInItinerary(destination) {
  closeModal('destination-modal');
  navigateTo('itinerary');
  showToast(`Destino "${destination}" selecionado! Crie um novo roteiro.`, 'info');
}

// ── New Destination ──────────────────────────────────────────
function openNewDestinationModal() {
  document.getElementById('new-destination-form').reset();
  openModal('new-destination-modal');
}

async function submitNewDestination() {
  const name = document.getElementById('nd-name').value.trim();
  const country = document.getElementById('nd-country').value.trim();
  const category = document.getElementById('nd-category').value;
  const cost = document.getElementById('nd-cost').value;
  const days = document.getElementById('nd-days').value;
  const desc = document.getElementById('nd-desc').value.trim();
  const image = document.getElementById('nd-image').value.trim() || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=800';

  const btn = document.getElementById('nd-submit-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  btn.disabled = true;

  try {
    const session = getSession();
    if (session && session.isSupabase) {
      if (typeof createDestination === 'function') {
        const dest = await createDestination({
          title: name,
          country,
          category,
          base_price: parseInt(cost) || 0,
          days: parseInt(days) || 1,
          description: desc,
          image_url: image
        });
        if (dest) {
          showToast('Destino criado com sucesso!', 'success');
          await loadLibraryData();
          renderLibrary();
        } else {
          showToast('Erro ao criar destino no servidor', 'error');
        }
      } else {
        showToast('Função createDestination não encontrada!', 'error');
      }
    } else {
      // Offline fallback
      _libDestinations.unshift({
        id: Date.now(),
        title: name,
        country,
        category,
        base_price: parseInt(cost) || 0,
        days: parseInt(days) || 1,
        description: desc,
        image_url: image
      });
      showToast('Destino criado (Modo Offline)', 'success');
      renderLibrary();
    }
  } catch (error) {
    showToast('Erro ao salvar destino: ' + error.message, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
    closeModal('new-destination-modal');
  }
}
