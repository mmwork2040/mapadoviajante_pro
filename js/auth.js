/* ══════════════════════════════════════════════════════════════
   AUTH.JS — Authentication & Role-Based Access Control
   Hybrid: Supabase Auth (production) + localStorage fallback (demo)
   ══════════════════════════════════════════════════════════════ */

// ── Demo Users Database (fallback when offline) ─────────────
const USERS_DB = [
  { id: 1, name: 'Lucas Felipe',      email: 'admin@mapapro.com',      password: 'admin123',    role: 'admin',     avatar: 'LF', status: 'online',  lastLogin: '2025-06-10T10:30:00' },
  { id: 2, name: 'Ana Costa',          email: 'gerente@mapapro.com',    password: 'gerente123',  role: 'gerente',   avatar: 'AC', status: 'online',  lastLogin: '2025-06-10T09:15:00' },
  { id: 3, name: 'Pedro Mendes',       email: 'consultor@mapapro.com',  password: 'consultor123',role: 'consultor', avatar: 'PM', status: 'online',  lastLogin: '2025-06-09T18:00:00' },
  { id: 4, name: 'Juliana Ferreira',   email: 'juliana@mapapro.com',    password: 'jul123',      role: 'consultor', avatar: 'JF', status: 'offline', lastLogin: '2025-06-08T14:20:00' },
  { id: 5, name: 'Carlos Souza',       email: 'carlos@mapapro.com',     password: 'carlos123',   role: 'gerente',   avatar: 'CS', status: 'offline', lastLogin: '2025-06-07T11:00:00' },
];

// ── Role Definitions ────────────────────────────────────────
const ROLE_CONFIG = {
  admin: {
    label: 'Administrador',
    pages: ['dashboard', 'leads', 'itinerary', 'library', 'finances', 'admin'],
    canSeeFinancials: true,
    canManageUsers: true,
    dashboardMetrics: 'full',
  },
  gerente: {
    label: 'Gerente',
    pages: ['dashboard', 'leads', 'itinerary', 'library', 'finances'],
    canSeeFinancials: true,
    canManageUsers: false,
    dashboardMetrics: 'full',
  },
  consultor: {
    label: 'Consultor',
    pages: ['dashboard', 'leads', 'itinerary', 'library'],
    canSeeFinancials: false,
    canManageUsers: false,
    dashboardMetrics: 'limited',
  }
};

// ── Detect if Supabase is available ─────────────────────────
function isSupabaseAvailable() {
  return typeof supabase !== 'undefined' && supabase && supabase.auth;
}

// ══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT (Hybrid)
// ══════════════════════════════════════════════════════════════

function getSession() {
  try {
    const session = localStorage.getItem('mapapro_session');
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

function setSession(user) {
  const sessionData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || (user.name ? user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??'),
    memberId: user.memberId || null,
    agencyId: user.agencyId || null,
    loginTime: new Date().toISOString(),
    isSupabase: user.isSupabase || false,
  };
  localStorage.setItem('mapapro_session', JSON.stringify(sessionData));
}

function clearSession() {
  localStorage.removeItem('mapapro_session');
}

async function logout() {
  if (isSupabaseAvailable()) {
    try { await supabase.auth.signOut(); } catch (e) { console.warn('Supabase signOut:', e); }
  }
  clearSession();
  window.location.href = 'login.html';
}

// ══════════════════════════════════════════════════════════════
// AUTHENTICATION
// ══════════════════════════════════════════════════════════════

async function authenticate(email, password) {
  // Try Supabase Auth first
  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error && data.user) {
        // Load agency context
        const member = await loadAgencyContext();

        if (member) {
          const sessionUser = {
            id: data.user.id,
            name: member.name,
            email: data.user.email,
            role: member.role,
            avatar: member.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
            memberId: member.id,
            agencyId: member.agency_id,
            isSupabase: true,
          };
          setSession(sessionUser);
          return { success: true, user: sessionUser };
        } else {
          // User exists in auth but not linked to agency
          await supabase.auth.signOut();
          return { success: false, error: 'Usuário não vinculado a nenhuma agência' };
        }
      }

      // If Supabase auth failed, fall through to demo
      if (error) {
        console.warn('Supabase auth failed, trying demo fallback:', error.message);
      }
    } catch (e) {
      console.warn('Supabase auth error, using demo fallback:', e);
    }
  }

  // Fallback: Demo users (localStorage only)
  const user = USERS_DB.find(u => u.email === email && u.password === password);
  if (user) {
    setSession({ ...user, isSupabase: false });
    return { success: true, user };
  }
  return { success: false, error: 'E-mail ou senha inválidos' };
}

function authenticateByRole(role) {
  // Quick role-based login (for demo selectors)
  const user = USERS_DB.find(u => u.role === role);
  if (user) {
    // Try Supabase first
    return authenticate(user.email, user.password);
  }
  return Promise.resolve({ success: false, error: 'Perfil não encontrado' });
}

// ── Guard: Check Auth on CRM Pages ─────────────────────────
function guardAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// ══════════════════════════════════════════════════════════════
// ROLE-BASED UI RESTRICTIONS
// ══════════════════════════════════════════════════════════════

function applyRoleRestrictions(session) {
  if (!session) return;

  const config = ROLE_CONFIG[session.role];
  if (!config) return;

  // 1. Update sidebar user info
  const userName = document.querySelector('.user-name');
  const userRole = document.querySelector('.user-role');
  const userAvatar = document.querySelector('.sidebar-user .user-avatar');
  if (userName) userName.textContent = session.name;
  if (userRole) userRole.textContent = config.label;
  if (userAvatar) userAvatar.textContent = session.avatar;

  // 2. Hide/Show sidebar items based on role
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const page = item.dataset.page;
    if (!config.pages.includes(page)) {
      item.style.display = 'none';
    }
  });

  // 3. Handle financial elements for Consultor
  if (!config.canSeeFinancials) {
    hideFinancialElements();
  }

  // 4. Show admin nav item only for admins
  const adminNav = document.querySelector('.nav-item[data-page="admin"]');
  if (adminNav) {
    adminNav.style.display = config.canManageUsers ? '' : 'none';
  }

  // 5. Add logout button to sidebar
  addLogoutButton();

  // 6. Restrict navigation
  restrictNavigation(config);

  // 7. Connection indicator
  addConnectionIndicator(session);
}

function hideFinancialElements() {
  // Hide finance-related metrics on dashboard
  const metricCards = document.querySelectorAll('.metrics-grid .metric-card');
  if (metricCards.length >= 1) {
    // Hide "Vendas do Mês" card (first metric)
    metricCards[0].style.display = 'none';
  }

  // Hide Valor column in leads table (immediate + deferred)
  hideValorColumn();

  // Also watch for when table data is populated later by dashboard.js
  const tbody = document.getElementById('dashboard-leads-body');
  if (tbody) {
    const observer = new MutationObserver(() => {
      hideValorColumn();
      observer.disconnect();
    });
    observer.observe(tbody, { childList: true });
  }

  // Hide chart card entirely for Consultor (no blur, just remove it)
  const chartCard = document.getElementById('dashboard-chart-card');
  if (chartCard) {
    chartCard.style.display = 'none';
    // Expand tasks card to full width
    const tasksCard = document.querySelector('.tasks-card');
    if (tasksCard) {
      tasksCard.style.gridColumn = '1 / -1';
    }
  }
}

function hideValorColumn() {
  const dashboardTable = document.getElementById('dashboard-leads-table');
  if (!dashboardTable) return;

  const headers = dashboardTable.querySelectorAll('th');
  const rows = dashboardTable.querySelectorAll('tbody tr');
  headers.forEach((th, index) => {
    if (th.textContent.trim() === 'Valor') {
      th.style.display = 'none';
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[index]) cells[index].style.display = 'none';
      });
    }
  });
}

function addLogoutButton() {
  const sidebarFooter = document.querySelector('.sidebar-footer');
  if (!sidebarFooter || document.getElementById('logout-btn')) return;

  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.className = 'sidebar-logout-btn';
  logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i><span>Sair</span>';
  logoutBtn.addEventListener('click', logout);

  // Insert before the user row
  const userRow = sidebarFooter.querySelector('.sidebar-user-row');
  if (userRow) {
    sidebarFooter.insertBefore(logoutBtn, userRow);
  } else {
    sidebarFooter.appendChild(logoutBtn);
  }
}

function restrictNavigation(config) {
  // Override navigateTo to enforce role restrictions
  const originalNavigateTo = window.navigateTo;
  window.navigateTo = function(page) {
    if (!config.pages.includes(page)) {
      showToast('Você não tem permissão para acessar esta página', 'error');
      return;
    }
    originalNavigateTo(page);
  };
}

function addConnectionIndicator(session) {
  const sidebarFooter = document.querySelector('.sidebar-footer');
  if (!sidebarFooter || document.getElementById('conn-indicator')) return;

  const indicator = document.createElement('div');
  indicator.id = 'conn-indicator';
  indicator.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 12px;font-size:10px;color:var(--gray-400);';

  if (session.isSupabase) {
    indicator.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#10B981;"></span> Conectado ao Supabase';
  } else {
    indicator.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;"></span> Modo Demo (offline)';
  }

  sidebarFooter.prepend(indicator);
}

// ══════════════════════════════════════════════════════════════
// INIT AUTH ON CRM
// ══════════════════════════════════════════════════════════════

async function initAuth() {
  const session = guardAuth();
  if (!session) return;

  // If session was Supabase-based, restore context
  if (session.isSupabase && isSupabaseAvailable()) {
    const { data: { session: sbSession } } = await supabase.auth.getSession();
    if (sbSession) {
      await loadAgencyContext();
      await fetchTeamMembers();
    } else {
      // Supabase session expired — redirect to login
      clearSession();
      window.location.href = 'login.html';
      return;
    }
  }

  applyRoleRestrictions(session);
}
