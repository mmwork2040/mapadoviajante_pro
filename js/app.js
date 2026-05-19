/* ══════════════════════════════════════════════════════════════
   APP.JS — Core Navigation, Search, Notifications
   ══════════════════════════════════════════════════════════════ */

// ── Navigation ──────────────────────────────────────────────
function navigateTo(page) {
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  // Close mobile sidebar
  closeMobileSidebar();

  // Update URL hash
  history.pushState(null, '', `#${page}`);
}

// Init navigation from hash
function initNavigation() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  // Sidebar nav click handlers
  document.querySelectorAll('.nav-item a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.closest('.nav-item').dataset.page;
      navigateTo(page);
    });
  });

  // Handle back/forward
  window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
  });
}

// ── Sidebar Collapse ────────────────────────────────────────
function initSidebar() {
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const app = document.getElementById('app');

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      app.classList.toggle('sidebar-collapsed');
    });
  }

  // Mobile menu
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');

  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      toggleOverlay(true);
    });
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  toggleOverlay(false);
}

function toggleOverlay(show) {
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay && show) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeMobileSidebar);
    document.body.appendChild(overlay);
  }
  if (overlay) {
    if (show) {
      requestAnimationFrame(() => overlay.classList.add('active'));
    } else {
      overlay.classList.remove('active');
    }
  }
}

// ── Search ──────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  if (!input) return;

  // Keyboard shortcut "/"
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape') {
      input.blur();
      results.classList.add('hidden');
    }
  });

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      results.classList.add('hidden');
      return;
    }
    showSearchResults(query);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      results.classList.remove('hidden');
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
      results.classList.add('hidden');
    }
  });
}

function showSearchResults(query) {
  const results = document.getElementById('search-results');
  let html = '';

  // Search leads
  const matchedLeads = LEADS.filter(l =>
    l.name.toLowerCase().includes(query) ||
    l.destination.toLowerCase().includes(query) ||
    l.email.toLowerCase().includes(query)
  ).slice(0, 4);

  if (matchedLeads.length) {
    html += '<div class="search-result-group">Leads</div>';
    matchedLeads.forEach(lead => {
      html += `
        <div class="search-result-item" onclick="navigateTo('leads')">
          <i class="fas fa-user"></i>
          <div class="result-text">
            <div class="result-label">${lead.name}</div>
            <div class="result-meta">${lead.destination} • R$ ${lead.value.toLocaleString('pt-BR')}</div>
          </div>
        </div>`;
    });
  }

  // Search destinations (use Supabase cache if available, fallback to static)
  const destSource = (typeof _libDestinations !== 'undefined' && _libDestinations.length) ? _libDestinations : (typeof DESTINATIONS !== 'undefined' ? DESTINATIONS : []);
  const matchedDest = destSource.filter(d =>
    d.name.toLowerCase().includes(query) ||
    (d.country || '').toLowerCase().includes(query)
  ).slice(0, 3);

  if (matchedDest.length) {
    html += '<div class="search-result-group">Destinos</div>';
    matchedDest.forEach(dest => {
      html += `
        <div class="search-result-item" onclick="navigateTo('library')">
          <i class="fas fa-map-marker-alt"></i>
          <div class="result-text">
            <div class="result-label">${dest.name}</div>
            <div class="result-meta">${dest.country} • ${dest.category}</div>
          </div>
        </div>`;
    });
  }

  // Search itineraries
  const matchedItin = ITINERARIES.filter(i =>
    i.title.toLowerCase().includes(query) ||
    i.client.toLowerCase().includes(query) ||
    i.destination.toLowerCase().includes(query)
  ).slice(0, 3);

  if (matchedItin.length) {
    html += '<div class="search-result-group">Roteiros</div>';
    matchedItin.forEach(it => {
      html += `
        <div class="search-result-item" onclick="navigateTo('itinerary')">
          <i class="fas fa-route"></i>
          <div class="result-text">
            <div class="result-label">${it.title}</div>
            <div class="result-meta">${it.dates} • ${it.status}</div>
          </div>
        </div>`;
    });
  }

  if (!html) {
    html = '<div class="search-result-item"><i class="fas fa-search"></i><div class="result-text"><div class="result-label text-muted">Nenhum resultado para "' + query + '"</div></div></div>';
  }

  results.innerHTML = html;
  results.classList.remove('hidden');
}

// ── Notifications ───────────────────────────────────────────
function initNotifications() {
  const btn = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');

  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notif-dropdown') && !e.target.closest('.notif-btn')) {
      dropdown.classList.add('hidden');
    }
  });

  // Mark all as read
  const markRead = dropdown.querySelector('.notif-mark-read');
  if (markRead) {
    markRead.addEventListener('click', () => {
      dropdown.querySelectorAll('.notif-item.unread').forEach(item => {
        item.classList.remove('unread');
      });
      const badge = document.querySelector('.notif-badge');
      if (badge) badge.style.display = 'none';
      showToast('Todas as notificações foram marcadas como lidas', 'success');
    });
  }
}

// ── Modal Helpers ───────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

// ── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Helper: Format currency ─────────────────────────────────
function formatCurrency(value) {
  return 'R$ ' + Math.abs(value).toLocaleString('pt-BR');
}

// ── Helper: Relative time ───────────────────────────────────
function relativeDate(dateStr) {
  const now = new Date();
  // Handle Postgres timestamp format (space instead of T)
  const normalized = String(dateStr).replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return dateStr;
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 0) return `Em ${Math.abs(diffDays)} dias`;
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return date.toLocaleDateString('pt-BR');
}

// ── Helper: Status badge HTML ───────────────────────────────
function statusBadgeHTML(status) {
  const labels = {
    new: 'Novo',
    negotiating: 'Em Negociação',
    closed: 'Fechado',
    lost: 'Perdido',
  };
  return `<span class="status-badge status-badge-${status}"><span class="status-dot status-${status}"></span>${labels[status]}</span>`;
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  initNavigation();
  initSidebar();
  initSearch();
  initNotifications();
  initDashboard();
  initLeads();
  initItinerary();
  await initLibrary();
  await initFinances();
  initAdmin();
  initCopilot();
});
