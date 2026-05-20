/* ══════════════════════════════════════════════════════════════
   ADMIN.JS — Administration Panel Logic
   ══════════════════════════════════════════════════════════════ */

// ── Activity Log Data ───────────────────────────────────────
const ACTIVITY_LOG = [
  { type: 'sale',    user: 'Ana Costa',        action: 'Fechou venda — Pacote Curaçao', detail: 'R$ 12.400 • Casal Oliveira', time: 'Há 2 horas' },
  { type: 'lead',    user: 'Pedro Mendes',      action: 'Cadastrou novo lead', detail: 'Larissa Campos — Grécia', time: 'Há 3 horas' },
  { type: 'itin',    user: 'Juliana Ferreira',   action: 'Criou roteiro', detail: 'Maldivas 7 noites — Camila Pires', time: 'Há 5 horas' },
  { type: 'login',   user: 'Carlos Souza',       action: 'Fez login no sistema', detail: 'Desktop • Chrome', time: 'Há 6 horas' },
  { type: 'sale',    user: 'Pedro Mendes',       action: 'Atualizou lead para "Em Negociação"', detail: 'Rafael Dias — Lisboa + Espanha', time: 'Há 8 horas' },
  { type: 'setting', user: 'Lucas Felipe',       action: 'Alterou configuração', detail: 'Comissão padrão: 10% → 12%', time: 'Há 1 dia' },
  { type: 'lead',    user: 'Ana Costa',          action: 'Enviou proposta', detail: 'Família Santos — Portugal • R$ 18.500', time: 'Há 1 dia' },
  { type: 'itin',    user: 'Juliana Ferreira',   action: 'Compartilhou roteiro via WhatsApp', detail: 'Casal Oliveira — Curaçao', time: 'Há 2 dias' },
  { type: 'login',   user: 'Ana Costa',          action: 'Fez login no sistema', detail: 'Mobile • Safari', time: 'Há 2 dias' },
  { type: 'sale',    user: 'Carlos Souza',       action: 'Recebeu pagamento', detail: 'Comissão Peru — R$ 1.360', time: 'Há 3 dias' },
];

// ── Agency Settings Data ────────────────────────────────────
const AGENCY_SETTINGS = [
  { label: 'Nome da Agência',      value: 'O Segredo do Viajante',  desc: 'Razão social / nome fantasia' },
  { label: 'CNPJ',                 value: '47.915.163/0001-68',     desc: 'Cadastro nacional' },
  { label: 'Comissão Padrão',      value: '12%',                    desc: 'Percentual sobre vendas' },
  { label: 'Fuso Horário',         value: 'UTC-3 (Brasília)',       desc: 'Horário do sistema' },
  { label: 'Moeda Base',           value: 'BRL (R$)',               desc: 'Moeda para cálculos' },
  { label: 'Plano Ativo',          value: 'PRO — Ilimitado',        desc: 'Licença do MapaPRO' },
];

// ── Initialize Admin Panel ──────────────────────────────────
function initAdmin() {
  renderAdminMetrics();
  renderUsersTable();
  renderActivityLog();
  renderAgencySettings();
  initAIConfig();
  initKnowledgeBase();
}

// ── Admin Metrics ───────────────────────────────────────────
function renderAdminMetrics() {
  const container = document.getElementById('admin-metrics');
  if (!container) return;

  const totalUsers = USERS_DB.length;
  const activeUsers = USERS_DB.filter(u => u.status === 'online').length;

  // Calculate total revenue from TRANSACTIONS
  const totalRevenue = typeof TRANSACTIONS !== 'undefined'
    ? TRANSACTIONS.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const totalLeads = typeof LEADS !== 'undefined' ? LEADS.length : 0;

  const metrics = [
    { icon: 'fa-users',       class: 'icon-users',   label: 'Total Usuários',    value: totalUsers },
    { icon: 'fa-circle-check', class: 'icon-active',  label: 'Usuários Online',   value: activeUsers },
    { icon: 'fa-dollar-sign',  class: 'icon-revenue', label: 'Receita Total',     value: `R$ ${totalRevenue.toLocaleString('pt-BR')}` },
    { icon: 'fa-address-book', class: 'icon-leads',   label: 'Total de Leads',    value: totalLeads },
  ];

  container.innerHTML = metrics.map((m, i) => `
    <div class="admin-metric-card" style="animation-delay: ${i * 60}ms">
      <div class="admin-metric-icon ${m.class}">
        <i class="fas ${m.icon}"></i>
      </div>
      <div class="admin-metric-info">
        <span class="admin-metric-label">${m.label}</span>
        <span class="admin-metric-value">${m.value}</span>
      </div>
    </div>
  `).join('');
}

// ── Users Table ─────────────────────────────────────────────
function renderUsersTable() {
  const tbody = document.getElementById('admin-users-body');
  if (!tbody) return;

  const roleLabels = { admin: 'Admin', gerente: 'Gerente', consultor: 'Consultor' };

  tbody.innerHTML = USERS_DB.map((user, i) => `
    <tr style="animation: fadeInLog 0.3s ease ${i * 60}ms both">
      <td>
        <div class="user-row-info">
          <div class="user-avatar-sm">${user.avatar}</div>
          <div>
            <div class="user-row-name">${user.name}</div>
            <div class="user-row-email">${user.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="user-role-badge role-${user.role}">
          <i class="fas ${user.role === 'admin' ? 'fa-shield-halved' : user.role === 'gerente' ? 'fa-briefcase' : 'fa-headset'}"></i>
          ${roleLabels[user.role]}
        </span>
      </td>
      <td>
        <span class="user-status-dot ${user.status}"></span>
        ${user.status === 'online' ? 'Online' : 'Offline'}
      </td>
      <td>${new Date(user.lastLogin).toLocaleDateString('pt-BR')} ${new Date(user.lastLogin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td style="text-align: center;">
        <button class="btn btn-ghost btn-sm" onclick="showToast('Editar ${user.name} — em breve', 'info')" title="Editar">
          <i class="fas fa-pen"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ── Activity Log ────────────────────────────────────────────
function renderActivityLog() {
  const container = document.getElementById('admin-activity-log');
  if (!container) return;

  const typeIcons = {
    login: 'fa-right-to-bracket',
    lead: 'fa-user-plus',
    sale: 'fa-coins',
    itin: 'fa-route',
    setting: 'fa-gear'
  };

  container.innerHTML = ACTIVITY_LOG.map((item, i) => `
    <div class="activity-item" style="animation-delay: ${i * 50}ms">
      <div class="activity-icon act-${item.type}">
        <i class="fas ${typeIcons[item.type]}"></i>
      </div>
      <div class="activity-text">
        <p><strong>${item.user}</strong> ${item.action}</p>
        <div class="activity-time">${item.detail} • ${item.time}</div>
      </div>
    </div>
  `).join('');
}

// ── Agency Settings ─────────────────────────────────────────
function renderAgencySettings() {
  const container = document.getElementById('admin-settings');
  if (!container) return;

  container.innerHTML = AGENCY_SETTINGS.map(s => `
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-label">${s.label}</span>
        <span class="setting-desc">${s.desc}</span>
      </div>
      <span class="setting-value">${s.value}</span>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════════════════
// THAY IA — Configuration & Token Usage
// ══════════════════════════════════════════════════════════════

const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    placeholder: 'sk-proj-...',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o (Mais inteligente)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Mais rápido)' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Econômico)' },
    ]
  },
  claude: {
    name: 'Claude',
    placeholder: 'sk-ant-...',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Inteligente)' },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Rápido)' },
    ]
  },
  gemini: {
    name: 'Gemini',
    placeholder: 'AIza...',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Inteligente)' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Rápido)' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite (Econômico)' },
    ]
  }
};

// Simulated token usage per user (Module 1 dummy data fallback)
const TOKEN_USAGE = {
  total: 347820,
  limit: 500000,
  cost: 4.18,
  users: [
    { name: 'Lucas Felipe',    avatar: 'LF', role: 'Admin',     tokens: 142300, pct: 40.9 },
    { name: 'Ana Costa',       avatar: 'AC', role: 'Gerente',   tokens: 98450,  pct: 28.3 },
    { name: 'Pedro Mendes',    avatar: 'PM', role: 'Consultor', tokens: 67200,  pct: 19.3 },
    { name: 'Juliana Ferreira',avatar: 'JF', role: 'Consultor', tokens: 31870,  pct: 9.2 },
    { name: 'Carlos Souza',    avatar: 'CS', role: 'Gerente',   tokens: 8000,   pct: 2.3 },
  ]
};

async function initAIConfig() {
  const session = getSession();
  if (!session || !session.isSupabase) {
    // Fallback offline mode
    const savedProvider = localStorage.getItem('thay_provider') || 'openai';
    const savedKey = localStorage.getItem('thay_api_key') || '';
    const savedPrompt = localStorage.getItem('thay_system_prompt') || '';
    
    selectAIProvider(savedProvider, false);
    const keyInput = document.getElementById('ai-api-key');
    if (keyInput && savedKey) {
      keyInput.value = savedKey;
      updateAIStatus(true);
    }
    const systemPromptEl = document.getElementById('kb-system-prompt');
    if (systemPromptEl && savedPrompt) {
      systemPromptEl.value = savedPrompt;
      updateCharCount();
    }
    renderTokenUsage();
    return;
  }

  try {
    // Load from Supabase crm_ai_config
    const { data: config, error } = await supabase
      .from('crm_ai_config')
      .select('*')
      .eq('agency_id', session.agencyId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configuração de IA do Supabase:', error);
      showToast('Erro ao carregar configurações de IA do servidor', 'error');
      return;
    }

    if (config) {
      // 1. Select the provider and update inputs
      selectAIProvider(config.provider || 'gemini', false);
      
      const keyInput = document.getElementById('ai-api-key');
      if (keyInput && config.api_key_encrypted) {
        keyInput.value = config.api_key_encrypted;
        updateAIStatus(true, config.provider);
      }

      // 2. Select the specific model
      const modelSelect = document.getElementById('ai-model-select');
      if (modelSelect && config.model) {
        modelSelect.value = config.model;
      }

      // 3. System Prompt
      const systemPromptEl = document.getElementById('kb-system-prompt');
      if (systemPromptEl && config.system_prompt) {
        systemPromptEl.value = config.system_prompt;
        updateCharCount();
      }

      // 4. Knowledge Sources / Switches
      if (config.knowledge_sources) {
        const ks = config.knowledge_sources;
        ['library', 'leads', 'finance'].forEach(source => {
          const toggle = document.getElementById(`kb-toggle-${source}`);
          const card = document.getElementById(`kb-source-${source}`);
          if (toggle && card) {
            toggle.checked = !!ks[source];
            card.classList.toggle('active', !!ks[source]);
          }
        });
      }
    } else {
      // Default: select gemini
      selectAIProvider('gemini', false);
      updateAIStatus(false);
    }
  } catch (e) {
    console.error('Erro ao inicializar IA:', e);
  }

  // Load actual token usage from logs
  await renderTokenUsage();
}

function selectAIProvider(provider, animate = true) {
  const config = AI_PROVIDERS[provider];
  if (!config) return;

  // Update active card
  document.querySelectorAll('.ai-provider-card').forEach(card => {
    card.classList.toggle('active', card.dataset.provider === provider);
  });

  // Update label and placeholder
  const label = document.getElementById('ai-provider-label');
  const input = document.getElementById('ai-api-key');
  if (label) label.textContent = config.name;
  if (input) input.placeholder = config.placeholder;

  // Update model selector
  const modelSelect = document.getElementById('ai-model-select');
  if (modelSelect) {
    modelSelect.innerHTML = config.models.map((m, i) =>
      `<option value="${m.id}" ${i === 0 ? 'selected' : ''}>${m.label}</option>`
    ).join('');
  }

  localStorage.setItem('thay_provider', provider);
}

async function saveAIConfig() {
  const session = getSession();
  const keyInput = document.getElementById('ai-api-key');
  const key = keyInput?.value?.trim();

  if (!key || key.length < 10) {
    showToast('Insira uma chave de API válida', 'error');
    return;
  }

  const provider = localStorage.getItem('thay_provider') || 'gemini';
  const modelSelect = document.getElementById('ai-model-select');
  const model = modelSelect?.value || '';
  const limitInput = document.getElementById('ai-token-limit');
  const maxTokens = limitInput ? parseInt(limitInput.value, 10) : 500000;

  if (session && session.isSupabase) {
    const btn = document.querySelector('button[onclick="saveAIConfig()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
      // Check if config exists
      const { data: existing, error: checkError } = await supabase
        .from('crm_ai_config')
        .select('id')
        .eq('agency_id', session.agencyId)
        .maybeSingle();

      if (checkError) throw checkError;

      let result;
      if (existing) {
        // Update
        result = await supabase
          .from('crm_ai_config')
          .update({
            provider,
            model,
            api_key_encrypted: key,
            max_tokens: maxTokens,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Insert
        result = await supabase
          .from('crm_ai_config')
          .insert({
            agency_id: session.agencyId,
            provider,
            model,
            api_key_encrypted: key,
            max_tokens: maxTokens
          });
      }

      if (result.error) throw result.error;

      updateAIStatus(true, provider);
      showToast(`Chave ${AI_PROVIDERS[provider]?.name} salva no banco com sucesso! 🤖`, 'success');
    } catch (e) {
      console.error('Erro ao salvar config no banco:', e);
      showToast('Erro ao salvar configuração: ' + e.message, 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  } else {
    // Offline Demo mode
    localStorage.setItem('thay_api_key', key);
    localStorage.setItem('thay_model', model);
    updateAIStatus(true, provider);
    showToast(`Chave ${AI_PROVIDERS[provider]?.name} salva com sucesso! (Modo Demo) 🤖`, 'success');
  }
}

function updateAIStatus(connected, provider) {
  const badge = document.getElementById('ai-status-badge');
  if (!badge) return;

  if (connected) {
    const activeProvider = provider || localStorage.getItem('thay_provider') || 'gemini';
    const providerName = AI_PROVIDERS[activeProvider]?.name || 'IA';
    badge.innerHTML = `<span class="ai-status-dot connected"></span> Conectada — ${providerName}`;
    badge.classList.add('connected');
  } else {
    badge.innerHTML = '<span class="ai-status-dot"></span> Desconectada';
    badge.classList.remove('connected');
  }
}

async function updateAIModel() {
  const session = getSession();
  const modelSelect = document.getElementById('ai-model-select');
  if (!modelSelect) return;
  const model = modelSelect.value;
  const modelText = modelSelect.options[modelSelect.selectedIndex].text;

  if (session && session.isSupabase) {
    try {
      const { data: existing } = await supabase
        .from('crm_ai_config')
        .select('id')
        .eq('agency_id', session.agencyId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('crm_ai_config')
          .update({ model, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) throw error;
        showToast(`Modelo atualizado para ${modelText} no servidor!`, 'success');
      } else {
        showToast(`Modelo alterado localmente. Salve a chave para sincronizar.`, 'info');
      }
    } catch (e) {
      console.error('Erro ao atualizar modelo:', e);
      showToast('Erro ao salvar modelo no servidor', 'error');
    }
  } else {
    localStorage.setItem('thay_model', model);
    showToast(`Modelo alterado para ${modelText} (Modo Demo)`, 'success');
  }
}

function toggleKeyVisibility() {
  const input = document.getElementById('ai-api-key');
  const eye = document.getElementById('ai-key-eye');
  if (!input || !eye) return;

  if (input.type === 'password') {
    input.type = 'text';
    eye.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    eye.className = 'fas fa-eye';
  }
}

async function renderTokenUsage() {
  const summaryEl = document.getElementById('ai-usage-summary');
  const usersEl = document.getElementById('ai-usage-users');
  if (!summaryEl || !usersEl) return;

  const session = getSession();
  
  let totalUsage = 0;
  let usageLimit = 500000;
  let estimatedCost = 0;
  let usersUsage = [];

  if (session && session.isSupabase) {
    try {
      // 1. Fetch AI Limit from config
      const { data: config } = await supabase
        .from('crm_ai_config')
        .select('max_tokens')
        .eq('agency_id', session.agencyId)
        .maybeSingle();

      if (config && config.max_tokens) {
        usageLimit = config.max_tokens;
        const limitInput = document.getElementById('ai-token-limit');
        if (limitInput) limitInput.value = usageLimit;
      }

      // 2. Fetch all team members so we can match user_id to names & avatars
      const team = await fetchTeamMembers();

      // 3. Fetch AI logs
      const { data: logs, error } = await supabase
        .from('ai_usage_logs')
        .select('*');

      if (error) {
        console.error('Erro ao buscar logs de IA:', error);
      }

      const logsList = logs || [];

      // 4. Aggregate by user
      const usageByUser = {};
      logsList.forEach(log => {
        totalUsage += log.total_tokens || 0;
        if (!usageByUser[log.user_id]) {
          usageByUser[log.user_id] = 0;
        }
        usageByUser[log.user_id] += log.total_tokens || 0;
      });

      // pricing: ~$0.15 per 1M tokens on average
      estimatedCost = (totalUsage / 1000000) * 0.15;

      // 5. Build users list
      team.forEach(member => {
        const tokens = usageByUser[member.user_id] || 0;
        const pct = totalUsage > 0 ? ((tokens / totalUsage) * 100).toFixed(1) : 0;
        
        usersUsage.push({
          name: member.name,
          avatar: member.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
          role: member.role === 'admin' ? 'Admin' : member.role === 'gerente' ? 'Gerente' : 'Consultor',
          tokens: tokens,
          pct: parseFloat(pct)
        });
      });

      // Sort by tokens descending
      usersUsage.sort((a, b) => b.tokens - a.tokens);

    } catch (e) {
      console.error('Erro ao processar consumo de tokens real:', e);
    }
  } else {
    // Offline/Demo Mode fallback
    totalUsage = TOKEN_USAGE.total;
    usageLimit = TOKEN_USAGE.limit;
    estimatedCost = TOKEN_USAGE.cost;
    usersUsage = TOKEN_USAGE.users;
  }

  const pctUsed = usageLimit > 0 ? ((totalUsage / usageLimit) * 100).toFixed(1) : 0;
  const remaining = Math.max(0, usageLimit - totalUsage);
  const pctColor = pctUsed > 80 ? '#EF4444' : pctUsed > 50 ? '#F59E0B' : '#10B981';

  summaryEl.innerHTML = `
    <div class="ai-usage-ring">
      <svg viewBox="0 0 120 120" class="ai-usage-svg">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-color)" stroke-width="8"/>
        <circle cx="60" cy="60" r="52" fill="none" stroke="${pctColor}" stroke-width="8"
          stroke-dasharray="${(Math.min(100, pctUsed) / 100) * 327} 327"
          stroke-linecap="round" transform="rotate(-90 60 60)"
          style="transition: stroke-dasharray 1s ease;"/>
      </svg>
      <div class="ai-usage-ring-text">
        <span class="ai-usage-ring-pct" style="color: ${pctColor};">${pctUsed}%</span>
        <span class="ai-usage-ring-label">utilizado</span>
      </div>
    </div>
    <div class="ai-usage-stats">
      <div class="ai-usage-stat">
        <span class="ai-usage-stat-label">Tokens consumidos</span>
        <span class="ai-usage-stat-value">${totalUsage.toLocaleString('pt-BR')}</span>
      </div>
      <div class="ai-usage-stat">
        <span class="ai-usage-stat-label">Limite mensal</span>
        <span class="ai-usage-stat-value">${usageLimit.toLocaleString('pt-BR')}</span>
      </div>
      <div class="ai-usage-stat">
        <span class="ai-usage-stat-label">Restante</span>
        <span class="ai-usage-stat-value" style="color: ${pctColor};">${remaining.toLocaleString('pt-BR')}</span>
      </div>
      <div class="ai-usage-stat">
        <span class="ai-usage-stat-label">Custo estimado</span>
        <span class="ai-usage-stat-value">US$ ${estimatedCost.toFixed(3)}</span>
      </div>
    </div>
  `;

  usersEl.innerHTML = usersUsage.map(user => `
    <div class="ai-user-usage">
      <div class="ai-user-info">
        <div class="user-avatar-sm" style="background: ${getAvatarColorByRole(user.role.toLowerCase())}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 50%; width: 32px; height: 32px; font-size: 12px;">${user.avatar}</div>
        <div>
          <div class="ai-user-name">${user.name}</div>
          <div class="ai-user-role">${user.role}</div>
        </div>
      </div>
      <div class="ai-user-bar-wrap">
        <div class="ai-user-bar">
          <div class="ai-user-bar-fill" style="width: ${user.pct}%; background: ${user.tokens > 0 ? 'var(--orange-500)' : 'var(--stone-400)'}"></div>
        </div>
        <span class="ai-user-tokens">${user.tokens.toLocaleString('pt-BR')} tokens (${user.pct}%)</span>
      </div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════════════════
// KNOWLEDGE BASE — Documents & Instructions
// ══════════════════════════════════════════════════════════════

// Demo uploaded files
const KB_DEMO_FILES = [
  { id: 1, name: 'Tabela_Hoteis_Caribe_2026.pdf',    size: '2.4 MB', type: 'pdf',  date: '10/05/2026', pages: 18 },
  { id: 2, name: 'Guia_Completo_Aruba.pdf',           size: '5.1 MB', type: 'pdf',  date: '08/05/2026', pages: 42 },
  { id: 3, name: 'Comissoes_Operadoras_2026.xlsx',    size: '340 KB', type: 'xlsx', date: '05/05/2026', pages: null },
  { id: 4, name: 'Roteiro_Base_Europa_15D.docx',      size: '1.8 MB', type: 'doc',  date: '01/05/2026', pages: 12 },
  { id: 5, name: 'Politica_Cancelamento_Hoteis.txt',   size: '28 KB',  type: 'txt',  date: '28/04/2026', pages: null },
];

let kbFiles = [...KB_DEMO_FILES];

function initKnowledgeBase() {
  // Load saved prompt
  const savedPrompt = localStorage.getItem('thay_system_prompt') || '';
  const textarea = document.getElementById('kb-system-prompt');
  if (textarea) {
    textarea.value = savedPrompt;
    textarea.addEventListener('input', updateCharCount);
    updateCharCount();
  }

  // Init drag-and-drop
  const dropzone = document.getElementById('kb-dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handleKBDrop(e.dataTransfer.files);
    });
  }

  renderKBFiles();
}

function updateCharCount() {
  const textarea = document.getElementById('kb-system-prompt');
  const counter = document.getElementById('kb-char-count');
  if (!textarea || !counter) return;
  const len = textarea.value.length;
  counter.textContent = `${len.toLocaleString('pt-BR')} / 2.000 caracteres`;
  counter.style.color = len > 1800 ? '#EF4444' : len > 1200 ? '#F59E0B' : 'var(--stone-400)';
}

async function saveKBPrompt() {
  const textarea = document.getElementById('kb-system-prompt');
  if (!textarea) return;
  const prompt = textarea.value.trim();
  if (prompt.length > 2000) {
    showToast('O texto excede 2.000 caracteres. Reduza para salvar.', 'error');
    return;
  }

  const session = getSession();
  if (session && session.isSupabase) {
    const btn = document.querySelector('button[onclick="saveKBPrompt()"]');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      btn.disabled = true;
    }

    try {
      // Get existing config or create new
      const { data: existing, error: checkError } = await supabase
        .from('crm_ai_config')
        .select('id')
        .eq('agency_id', session.agencyId)
        .maybeSingle();

      if (checkError) throw checkError;

      let result;
      if (existing) {
        result = await supabase
          .from('crm_ai_config')
          .update({
            system_prompt: prompt,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        result = await supabase
          .from('crm_ai_config')
          .insert({
            agency_id: session.agencyId,
            system_prompt: prompt,
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            max_tokens: 500000
          });
      }

      if (result.error) throw result.error;
      showToast('Orientações da Thay sincronizadas no servidor! 🎓', 'success');
    } catch (e) {
      console.error('Erro ao salvar orientações no banco:', e);
      showToast('Erro ao salvar no servidor: ' + e.message, 'error');
    } finally {
      if (btn) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }
  } else {
    localStorage.setItem('thay_system_prompt', prompt);
    showToast('Orientações da Thay salvas com sucesso! (Modo Demo) 🎓', 'success');
  }
}

async function toggleKBSource(source) {
  const card = document.getElementById(`kb-source-${source}`);
  const toggle = document.getElementById(`kb-toggle-${source}`);
  if (!card || !toggle) return;
  
  card.classList.toggle('active', toggle.checked);
  const name = source === 'library' ? 'Biblioteca de Roteiros' : source === 'leads' ? 'Base de Leads' : 'Dados Financeiros';

  const session = getSession();
  if (session && session.isSupabase) {
    try {
      // Gather status of all toggles
      const libraryActive = document.getElementById('kb-toggle-library')?.checked || false;
      const leadsActive = document.getElementById('kb-toggle-leads')?.checked || false;
      const financeActive = document.getElementById('kb-toggle-finance')?.checked || false;

      const knowledgeSources = {
        library: libraryActive,
        leads: leadsActive,
        finance: financeActive
      };

      const { data: existing, error: checkError } = await supabase
        .from('crm_ai_config')
        .select('id')
        .eq('agency_id', session.agencyId)
        .maybeSingle();

      if (checkError) throw checkError;

      let result;
      if (existing) {
        result = await supabase
          .from('crm_ai_config')
          .update({
            knowledge_sources: knowledgeSources,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        result = await supabase
          .from('crm_ai_config')
          .insert({
            agency_id: session.agencyId,
            knowledge_sources: knowledgeSources,
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            max_tokens: 500000
          });
      }

      if (result.error) throw result.error;
      showToast(`${name} ${toggle.checked ? 'ativada' : 'desativada'} no servidor!`, 'success');
    } catch (e) {
      console.error('Erro ao atualizar fontes de conhecimento no servidor:', e);
      showToast('Erro ao atualizar fontes no servidor: ' + e.message, 'error');
    }
  } else {
    showToast(`${name} ${toggle.checked ? 'ativada' : 'desativada'} para a Thay (Modo Demo)`, 'success');
  }
}

// ── File Upload ──────────────────────────────────────────────
function handleKBUpload(event) {
  const files = event.target?.files;
  if (files) handleKBDrop(files);
}

function handleKBDrop(files) {
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      showToast(`${file.name} excede 10 MB`, 'error');
      continue;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'csv'];
    if (!allowed.includes(ext)) {
      showToast(`Formato .${ext} não suportado`, 'error');
      continue;
    }

    const newFile = {
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`,
      type: ext === 'docx' ? 'doc' : ext,
      date: new Date().toLocaleDateString('pt-BR'),
      pages: null,
    };
    kbFiles.unshift(newFile);
    showToast(`${file.name} adicionado à base de conhecimento 📄`, 'success');
  }
  renderKBFiles();
}

function removeKBFile(id) {
  kbFiles = kbFiles.filter(f => f.id !== id);
  renderKBFiles();
  showToast('Arquivo removido da base de conhecimento', 'info');
}

function renderKBFiles() {
  const container = document.getElementById('kb-files-list');
  if (!container) return;

  const typeIcons = {
    pdf:  { icon: 'fa-file-pdf',   color: '#EF4444' },
    doc:  { icon: 'fa-file-word',  color: '#3B82F6' },
    txt:  { icon: 'fa-file-lines', color: '#6B7280' },
    xlsx: { icon: 'fa-file-excel', color: '#10B981' },
    csv:  { icon: 'fa-file-csv',   color: '#10B981' },
  };

  if (kbFiles.length === 0) {
    container.innerHTML = '<div class="kb-empty">Nenhum arquivo na base de conhecimento</div>';
    return;
  }

  container.innerHTML = kbFiles.map((file, i) => {
    const t = typeIcons[file.type] || typeIcons.txt;
    return `
      <div class="kb-file-row" style="animation-delay: ${i * 40}ms">
        <div class="kb-file-icon" style="color: ${t.color};">
          <i class="fas ${t.icon}"></i>
        </div>
        <div class="kb-file-info">
          <div class="kb-file-name">${file.name}</div>
          <div class="kb-file-meta">${file.size} • ${file.date}${file.pages ? ` • ${file.pages} páginas` : ''}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="removeKBFile(${file.id})" title="Remover">
          <i class="fas fa-trash-alt" style="color: var(--stone-400);"></i>
        </button>
      </div>
    `;
  }).join('');
}
