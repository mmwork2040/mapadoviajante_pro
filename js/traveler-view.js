/* ══════════════════════════════════════════════════════════════
   TRAVELER-VIEW.JS — Mobile PWA Itinerary Viewer
   Renders the itinerary for the traveler's mobile view.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────
  const AGENT_PHONE = '5511999999999';
  const AGENT_NAME  = 'Lucas Felipe';
  const AGENT_ROLE  = 'Consultor de Viagens • O Segredo do Viajante';

  // ── Get Itinerary ID from URL (default to first) ─────────
  function getItineraryId() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    return isNaN(id) ? 1 : id;
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    const itId = getItineraryId();
    const it = (typeof ITINERARIES !== 'undefined')
      ? ITINERARIES.find(i => i.id === itId)
      : null;

    if (!it) {
      document.querySelector('.tv-container').innerHTML = `
        <div style="text-align:center; padding: 60px 20px; color: #9CA3AF;">
          <i class="fas fa-map-marked-alt" style="font-size: 48px; margin-bottom: 16px; display:block; color: #D1D5DB;"></i>
          <h2 style="color: #1F2937; margin-bottom: 8px;">Roteiro não encontrado</h2>
          <p>O link pode estar incorreto ou o roteiro não está mais disponível.</p>
        </div>`;
      hideLoading();
      return;
    }

    renderHero(it);
    renderStats(it);
    renderDays(it);
    renderVouchers(it);
    renderBudget(it);
    setupWhatsApp(it);
    startCountdown(it);
    hideLoading();
  }

  // ── Hero ──────────────────────────────────────────────────
  function renderHero(it) {
    const dest = document.getElementById('tv-destination');
    const title = document.getElementById('tv-trip-title');
    const chips = document.getElementById('tv-chips');

    if (dest) dest.textContent = it.destination;
    if (title) title.textContent = `Roteiro personalizado para ${it.client}`;

    if (chips) {
      chips.innerHTML = `
        <span class="tv-chip"><i class="fas fa-calendar"></i> ${it.dates}</span>
        <span class="tv-chip"><i class="fas fa-users"></i> ${it.passengers} passageiro${it.passengers > 1 ? 's' : ''}</span>
        <span class="tv-chip"><i class="fas fa-sun"></i> ${it.days.length} dias</span>
      `;
    }
  }

  // ── Quick Stats ───────────────────────────────────────────
  function renderStats(it) {
    const container = document.getElementById('tv-stats');
    if (!container) return;

    let totalActivities = 0;
    let cities = new Set();
    it.days.forEach(day => {
      totalActivities += day.activities.length;
      day.activities.forEach(a => {
        if (a.type === 'hotel') {
          const city = a.detail.split('•').pop()?.trim() || a.detail;
          cities.add(city);
        }
      });
    });

    container.innerHTML = `
      <div class="tv-stat">
        <span class="tv-stat-value">${it.days.length}</span>
        <span class="tv-stat-label">Dias</span>
      </div>
      <div class="tv-stat">
        <span class="tv-stat-value">${totalActivities}</span>
        <span class="tv-stat-label">Atividades</span>
      </div>
      <div class="tv-stat">
        <span class="tv-stat-value">${cities.size || '—'}</span>
        <span class="tv-stat-label">Cidades</span>
      </div>
    `;
  }

  // ── Days Render ───────────────────────────────────────────
  function renderDays(it) {
    const container = document.getElementById('tv-days');
    if (!container) return;

    if (it.days.length === 0) {
      container.innerHTML = `
        <div class="tv-day">
          <div class="tv-day-body">
            <div class="tv-day-empty">
              <i class="fas fa-calendar-plus"></i>
              Seu roteiro está sendo preparado com carinho!<br>
              Em breve você verá todas as atividades aqui.
            </div>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = it.days.map((day, index) => `
      <div class="tv-day" style="animation-delay: ${index * 0.08}s;">
        <div class="tv-day-header">
          <span class="tv-day-label">${day.label}</span>
          <span class="tv-day-date"><i class="fas fa-calendar-day"></i> ${day.date}</span>
        </div>
        <div class="tv-day-body">
          ${day.activities.length === 0
            ? '<div class="tv-day-empty"><i class="fas fa-hourglass-half"></i>Dia livre — aproveite para explorar!</div>'
            : day.activities.map(act => renderActivity(act)).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderActivity(act) {
    const icon = getTypeIcon(act.type);
    const mapsUrl = buildMapsUrl(act);

    return `
      <div class="tv-activity">
        <span class="tv-activity-time">${act.time || '—'}</span>
        <div class="tv-activity-icon type-${act.type}">
          <i class="fas ${icon}"></i>
        </div>
        <div class="tv-activity-content">
          <div class="tv-activity-title">${act.title}</div>
          <div class="tv-activity-detail">${act.detail}</div>
          ${act.price > 0 ? `<div class="tv-activity-price">R$ ${act.price.toLocaleString('pt-BR')}</div>` : ''}
          <div class="tv-activity-actions">
            ${mapsUrl ? `
              <a class="tv-activity-btn" href="${mapsUrl}" target="_blank" rel="noopener">
                <i class="fas fa-location-dot"></i> Ver no mapa
              </a>` : ''}
            ${act.type === 'hotel' ? `
              <a class="tv-activity-btn" href="${buildMapsUrl(act)}" target="_blank" rel="noopener">
                <i class="fas fa-directions"></i> Como chegar
              </a>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ── Vouchers (Documentos Anexados) ─────────────────────────
  function renderVouchers(it) {
    const container = document.getElementById('tv-vouchers');
    const section = document.getElementById('tv-vouchers-section');
    if (!container || !section) return;

    // Vouchers are attached documents (PDFs, images)
    const vouchers = it.vouchers || [];

    if (vouchers.length === 0) {
      section.style.display = 'none';
      return;
    }

    container.innerHTML = vouchers.map(v => {
      const fileIcon = getFileIcon(v.type);
      const fileColor = getFileColor(v.type);

      return `
        <div class="tv-voucher-card">
          <div class="tv-voucher-left" style="background: ${fileColor};">
            <i class="fas ${v.icon}"></i>
            <span>${v.category}</span>
          </div>
          <div class="tv-voucher-right">
            <div class="tv-voucher-title">${v.name}</div>
            <div class="tv-voucher-detail">
              <i class="fas ${fileIcon}" style="margin-right: 4px;"></i>
              ${v.type.toUpperCase()} • ${v.size}
            </div>
            <div class="tv-voucher-actions">
              <a class="tv-activity-btn" href="${v.url}" target="_blank" rel="noopener" onclick="showTvToastGlobal('Abrindo documento... 📄')">
                <i class="fas fa-eye"></i> Visualizar
              </a>
              <a class="tv-activity-btn" href="${v.url}" download="${v.name}" onclick="showTvToastGlobal('Download iniciado! ⬇️')">
                <i class="fas fa-download"></i> Baixar
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getFileIcon(type) {
    const icons = {
      pdf: 'fa-file-pdf',
      image: 'fa-file-image',
      doc: 'fa-file-word',
      jpg: 'fa-file-image',
      png: 'fa-file-image',
    };
    return icons[type] || 'fa-file';
  }

  function getFileColor(type) {
    const colors = {
      pdf: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      image: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
      doc: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    };
    return colors[type] || 'linear-gradient(135deg, #F58E26 0%, #D67618 100%)';
  }

  // ── Budget ────────────────────────────────────────────────
  function renderBudget(it) {
    const card = document.getElementById('tv-budget-card');
    if (!card) return;

    const pct = it.budget > 0 ? Math.min(100, Math.round((it.spent / it.budget) * 100)) : 0;
    const overClass = pct > 90 ? 'over' : '';

    // Build breakdown by type
    const breakdown = {};
    it.days.forEach(day => {
      day.activities.forEach(act => {
        const label = getTypeLabel(act.type);
        breakdown[label] = (breakdown[label] || 0) + (act.price || 0);
      });
    });

    card.innerHTML = `
      <div class="tv-budget-total">
        <span class="tv-budget-label">Investimento Total</span>
        <span class="tv-budget-value">R$ ${it.spent.toLocaleString('pt-BR')}</span>
      </div>
      <div class="tv-budget-bar">
        <div class="tv-budget-bar-fill ${overClass}" style="width: ${pct}%;"></div>
      </div>
      <div class="tv-budget-breakdown">
        <span>Utilizado</span>
        <span>${pct}% do orçamento</span>
      </div>
      <div style="margin-top: 16px; border-top: 1px solid #F3F4F6; padding-top: 16px;">
        ${Object.entries(breakdown).map(([label, value]) => `
          <div class="tv-budget-breakdown" style="margin-bottom: 6px;">
            <span>${label}</span>
            <span>R$ ${value.toLocaleString('pt-BR')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── WhatsApp ──────────────────────────────────────────────
  function setupWhatsApp(it) {
    const btn = document.getElementById('tv-whatsapp-btn');
    if (!btn) return;

    const msg = encodeURIComponent(
      `Olá ${AGENT_NAME}! 🗺️\n\nEstou consultando meu roteiro *${it.title}* e gostaria de tirar uma dúvida.\n\nPode me ajudar?`
    );

    btn.href = `https://wa.me/${AGENT_PHONE}?text=${msg}`;
  }

  // ── Countdown ─────────────────────────────────────────────
  function startCountdown(it) {
    const container = document.getElementById('tv-countdown');
    if (!container) return;

    // Parse dates like "15 Jul – 25 Jul 2025"
    const dateStr = it.dates;
    const match = dateStr.match(/(\d{1,2})\s+(\w+).*?(\d{4})/);

    if (!match) {
      container.innerHTML = `
        <div class="tv-countdown-item">
          <span class="tv-countdown-value">🎉</span>
          <span class="tv-countdown-label">Boa viagem!</span>
        </div>`;
      return;
    }

    const months = { Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5, Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11 };
    const day = parseInt(match[1], 10);
    const month = months[match[2]] ?? 0;
    const year = parseInt(match[3], 10);
    const tripDate = new Date(year, month, day);

    function update() {
      const now = new Date();
      const diff = tripDate - now;

      if (diff <= 0) {
        container.innerHTML = `
          <div class="tv-countdown-item">
            <span class="tv-countdown-value">🌍</span>
            <span class="tv-countdown-label">Boa viagem!</span>
          </div>`;
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      container.innerHTML = `
        <div class="tv-countdown-item">
          <span class="tv-countdown-value">${days}</span>
          <span class="tv-countdown-label">dias</span>
        </div>
        <span class="tv-countdown-sep">:</span>
        <div class="tv-countdown-item">
          <span class="tv-countdown-value">${String(hours).padStart(2, '0')}</span>
          <span class="tv-countdown-label">horas</span>
        </div>
        <span class="tv-countdown-sep">:</span>
        <div class="tv-countdown-item">
          <span class="tv-countdown-value">${String(mins).padStart(2, '0')}</span>
          <span class="tv-countdown-label">minutos</span>
        </div>
      `;
    }

    update();
    setInterval(update, 60000); // Update every minute
  }

  // ── Helpers ───────────────────────────────────────────────
  function getTypeIcon(type) {
    const icons = {
      flight: 'fa-plane',
      hotel: 'fa-hotel',
      activity: 'fa-map-pin',
      transfer: 'fa-car',
      restaurant: 'fa-utensils',
      note: 'fa-sticky-note'
    };
    return icons[type] || 'fa-circle';
  }

  function getTypeLabel(type) {
    const labels = {
      flight: 'Aéreo',
      hotel: 'Hospedagem',
      activity: 'Passeios',
      transfer: 'Transfers',
      restaurant: 'Gastronomia',
      note: 'Outros'
    };
    return labels[type] || type;
  }

  function buildMapsUrl(act) {
    // Build a Google Maps search URL based on activity title and detail
    const query = `${act.title} ${act.detail}`.replace(/•/g, '').trim();
    if (!query || act.type === 'note') return null;
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  }

  function hideLoading() {
    setTimeout(() => {
      const loader = document.getElementById('tv-loading');
      if (loader) loader.classList.add('loaded');
    }, 600);
  }

  // ── Global: Toast for voucher actions ──────────────────────
  window.showTvToastGlobal = function (msg) {
    showTvToast(msg);
  };

  function showTvToast(msg) {
    const toast = document.getElementById('tv-toast');
    const text = document.getElementById('tv-toast-text');
    if (!toast || !text) return;

    text.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  // ── Boot ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
