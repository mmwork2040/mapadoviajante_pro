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
  return !!(window.supabase && window.supabase.auth);
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
  // Check if it's a demo user first for offline / demo mode fallback
  const demoUser = USERS_DB.find(u => u.email === email && u.password === password);
  if (demoUser) {
    const sessionUser = {
      id: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      role: demoUser.role,
      avatar: demoUser.avatar || (demoUser.name ? demoUser.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??'),
      memberId: null,
      agencyId: null,
      isSupabase: false,
    };
    setSession(sessionUser);
    return { success: true, user: sessionUser };
  }

  if (!isSupabaseAvailable()) {
    return { success: false, error: 'Sistema indisponível. Tente novamente mais tarde.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { success: false, error: 'E-mail ou senha inválidos' };
    }

    if (data.user) {
      let member = await loadAgencyContext();

      // Auto-provision: if no agency membership exists, create one
      if (!member) {
        const userName = data.user.user_metadata?.name || data.user.user_metadata?.full_name || email.split('@')[0];
        member = await autoProvisionAgency(data.user.id, userName, data.user.email);
      }

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
        await supabase.auth.signOut();
        return { success: false, error: 'Erro ao configurar sua conta. Tente novamente.' };
      }
    }
  } catch (e) {
    console.error('Supabase auth error:', e);
    return { success: false, error: 'Erro ao conectar. Tente novamente.' };
  }

  return { success: false, error: 'E-mail ou senha inválidos' };
}

async function signInWithGoogle() {
  if (!isSupabaseAvailable()) {
    return { success: false, error: 'Sistema indisponível. Tente novamente mais tarde.' };
  }
  try {
    // Always redirect back to login.html so handleOAuthSession() can process the tokens
    const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const redirectTo = window.location.origin + basePath + 'login.html';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    console.error('Google OAuth error:', e);
    return { success: false, error: 'Erro ao conectar com Google. Tente novamente.' };
  }
}

async function sendPasswordReset(email) {
  if (!isSupabaseAvailable()) {
    return { success: false, error: 'Sistema indisponível. Tente novamente mais tarde.' };
  }
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    console.error('Password reset error:', e);
    return { success: false, error: 'Erro ao enviar e-mail. Tente novamente.' };
  }
}

async function handleOAuthSession() {
  if (!isSupabaseAvailable()) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    let member = await loadAgencyContext();

    // Auto-provision: if no agency membership exists, create one
    if (!member) {
      const userName = session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email.split('@')[0];
      member = await autoProvisionAgency(session.user.id, userName, session.user.email);
    }

    if (!member) { await supabase.auth.signOut(); return null; }

    const sessionUser = {
      id: session.user.id,
      name: member.name,
      email: session.user.email,
      role: member.role,
      avatar: member.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
      memberId: member.id,
      agencyId: member.agency_id,
      isSupabase: true,
    };
    setSession(sessionUser);
    return sessionUser;
  } catch (e) {
    console.error('OAuth session error:', e);
    return null;
  }
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
  let session = getSession();

  // No localStorage session — but maybe this is an OAuth callback?
  if (!session && isSupabaseAvailable()) {
    // Give Supabase SDK time to process OAuth tokens from URL hash
    const oauthUser = await handleOAuthSession();
    if (oauthUser) {
      session = getSession(); // handleOAuthSession sets session in localStorage
    }
  }

  // Still no session after OAuth check — redirect to login
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

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
