/* ══════════════════════════════════════════════════════════════
   DASHBOARD.JS — Charts, Tasks, Recent Leads
   ══════════════════════════════════════════════════════════════ */

// ── Init Dashboard ────────────────────────────────────────────
async function initDashboard() {
  let chartData = null;

  const stats = await fetchDashboardStats();
  if (stats) {
    updateDashboardMetrics(stats);
    renderTasks(stats.tasks);
    renderDashboardLeads(stats.leads);
    chartData = stats.chartData;
  }

  initSalesChart(chartData);
  renderCalendar();
}

function updateDashboardMetrics(stats) {
  const salesEl = document.getElementById('dash-metric-sales');
  const leadsEl = document.getElementById('dash-metric-leads');
  const pipelineEl = document.getElementById('dash-metric-pipeline');
  const conversionEl = document.getElementById('dash-metric-conversion');

  if (salesEl) salesEl.textContent = formatCurrency(stats.totalSales || 0);
  if (leadsEl) leadsEl.textContent = stats.totalLeads;
  if (pipelineEl) pipelineEl.textContent = formatCurrency(stats.totalPipeline || 0);
  
  if (conversionEl) {
    const cvRate = stats.totalLeads > 0 ? ((stats.closed / stats.totalLeads) * 100).toFixed(1) : 0;
    conversionEl.textContent = `${cvRate}%`;
  }
}

// ── Sales Chart ─────────────────────────────────────────────
// Store active chart data source for toggle
let _activeChartData = null;

function initSalesChart(chartData) {
  const canvas = document.getElementById('sales-chart');
  if (!canvas) return;

  _activeChartData = chartData || { labels: [], revenue: [], count: [] };

  const ctx = canvas.getContext('2d');

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, 'rgba(245, 142, 38, 0.3)');
  gradient.addColorStop(1, 'rgba(245, 142, 38, 0.02)');

  window.salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: _activeChartData.labels,
      datasets: [{
        label: 'Receita (R$)',
        data: _activeChartData.revenue,
        borderColor: '#F58E26',
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#F58E26',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        pointHoverBorderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1F2937',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont: { family: 'Inter', size: 13, weight: '600' },
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (ctx) => `R$ ${ctx.parsed.y.toLocaleString('pt-BR')}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Inter', size: 11 },
            color: '#9CA3AF',
          },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
          ticks: {
            font: { family: 'Inter', size: 11 },
            color: '#9CA3AF',
            callback: (val) => `R$ ${(val/1000).toFixed(0)}k`,
            maxTicksLimit: 5,
          },
          border: { display: false },
          beginAtZero: true,
        }
      }
    }
  });

  // Chart toggle (revenue vs count)
  document.querySelectorAll('.chart-card .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chart-card .chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');

      const type = chip.dataset.chart;
      if (type === 'count') {
        window.salesChart.data.datasets[0].data = _activeChartData.count;
        window.salesChart.data.datasets[0].label = 'Nº de Vendas';
        window.salesChart.options.scales.y.ticks.callback = (val) => val;
        window.salesChart.options.plugins.tooltip.callbacks.label = (ctx) => `${ctx.parsed.y} vendas`;
      } else {
        window.salesChart.data.datasets[0].data = _activeChartData.revenue;
        window.salesChart.data.datasets[0].label = 'Receita (R$)';
        window.salesChart.options.scales.y.ticks.callback = (val) => `R$ ${(val/1000).toFixed(0)}k`;
        window.salesChart.options.plugins.tooltip.callbacks.label = (ctx) => `R$ ${ctx.parsed.y.toLocaleString('pt-BR')}`;
      }
      window.salesChart.update();
    });
  });

  // Aplica o tema inicial
  updateChartsTheme();
}

function updateChartsTheme() {
  if (!window.salesChart) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  
  const textColor = isDark ? '#9CA3AF' : '#9CA3AF';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const tooltipBg = isDark ? '#111418' : '#1F2937';
  
  window.salesChart.options.plugins.tooltip.backgroundColor = tooltipBg;
  window.salesChart.options.scales.x.ticks.color = textColor;
  window.salesChart.options.scales.y.ticks.color = textColor;
  window.salesChart.options.scales.y.grid.color = gridColor;
  
  window.salesChart.update();
}

// ── Tasks ───────────────────────────────────────────────────
function renderTasks(tasksToRender) {
  const container = document.getElementById('task-list');
  if (!container) return;

  const tasksList = tasksToRender || [];

  if (tasksList.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--gray-400);">Sem tarefas pendentes! 🎉</div>';
    return;
  }

  container.innerHTML = tasksList.map(task => {
    const isCompleted = task.completed;
    const dueDate = task.due_date || task.due;
    const isOverdue = task.priority === 'urgent' && !isCompleted;
    const title = task.title;

    return `
      <div class="task-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
        <span class="task-priority task-priority-${task.priority}"></span>
        <div class="task-checkbox ${isCompleted ? 'checked' : ''}" onclick="toggleTask('${task.id}', ${isCompleted})"></div>
        <div class="task-info">
          <div class="task-title">${title}</div>
          ${dueDate ? `<div class="task-due ${isOverdue ? 'overdue' : ''}">${relativeDate(dueDate)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function toggleTask(id, currentStatus) {
  await updateTask(id, { completed: !currentStatus });
  const stats = await fetchDashboardStats();
  renderTasks(stats.tasks);
  showToast(!currentStatus ? 'Tarefa concluída! ✅' : 'Tarefa reaberta', 'success');
}

// ── Dashboard Leads Table ───────────────────────────────────
function renderDashboardLeads(leadsToRender) {
  const tbody = document.getElementById('dashboard-leads-body');
  if (!tbody) return;

  const leadsList = leadsToRender || [];
  const recentLeads = [...leadsList].sort((a, b) => new Date(b.last_activity_at || b.lastActivity) - new Date(a.last_activity_at || a.lastActivity)).slice(0, 6);

  if (recentLeads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--gray-400); padding: 20px;">Nenhum lead encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = recentLeads.map(lead => {
    const avatarInitials = lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const dest = lead.destination || 'Indefinido';
    const val = Number(lead.value) || 0;
    const email = lead.email || '—';
    const lastAct = lead.last_activity_at || lead.lastActivity;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="lead-card-avatar" ${lead.assigned_member ? `style="background-color: ${lead.assigned_member.avatar_color}" title="${lead.assigned_member.name}"` : ''}>${avatarInitials}</div>
            <div>
              <div style="font-weight: 600; color: var(--gray-900);">${lead.name}</div>
              <div style="font-size: 11px; color: var(--gray-400);">${email}</div>
            </div>
          </div>
        </td>
        <td><span style="display: flex; align-items: center; gap: 4px;"><i class="fas fa-map-marker-alt" style="color: var(--primary); font-size: 10px;"></i> ${dest}</span></td>
        <td><strong style="color: var(--primary);">R$ ${val.toLocaleString('pt-BR')}</strong></td>
        <td>${statusBadgeHTML(lead.status)}</td>
        <td style="color: var(--gray-400); font-size: 12px;">${relativeDate(lastAct)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="showLeadDetail('${lead.id}')"><i class="fas fa-eye"></i></button></td>
      </tr>
    `;
  }).join('');
}

// ── Calendar Widget ────────────────────────────────────────
const CALENDAR_EVENTS = [
  { day: 0, time: '09:00', title: 'Follow-up Ana Costa', type: 'follow-up', icon: 'fa-phone' },
  { day: 0, time: '14:00', title: 'Reunião — Pacote Aruba', type: 'meeting', icon: 'fa-video' },
  { day: 1, time: '06:30', title: 'Check-in Fam. Santos — LA8045', type: 'flight', icon: 'fa-plane-departure' },
  { day: 1, time: '10:00', title: 'Envio vouchers Casal Oliveira', type: 'task', icon: 'fa-file-alt' },
  { day: 2, time: '11:00', title: 'Confirmar Marriott Aruba', type: 'deadline', icon: 'fa-hotel' },
  { day: 2, time: '15:30', title: 'Call — Thiago Nascimento', type: 'follow-up', icon: 'fa-phone' },
  { day: 3, time: '09:00', title: 'Montar roteiro Grécia', type: 'task', icon: 'fa-route' },
  { day: 3, time: '16:00', title: 'Follow-up Roberto Almeida', type: 'follow-up', icon: 'fa-envelope' },
  { day: 4, time: '08:00', title: 'Embarque Maldivas — Camila', type: 'flight', icon: 'fa-plane-departure' },
  { day: 4, time: '14:00', title: 'Fechamento mensal', type: 'deadline', icon: 'fa-chart-pie' },
  { day: 5, time: '10:00', title: 'Workshop fornecedores', type: 'meeting', icon: 'fa-users' },
  { day: 6, time: '', title: 'Sem compromissos', type: 'free', icon: 'fa-umbrella-beach' },
];

const CAL_TYPE_COLORS = {
  'flight':    { bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6', label: 'Voo' },
  'follow-up': { bg: 'rgba(16,185,129,0.1)',  color: '#10B981', label: 'Follow-up' },
  'meeting':   { bg: 'rgba(139,92,246,0.1)',   color: '#8B5CF6', label: 'Reunião' },
  'task':      { bg: 'rgba(255,122,26,0.1)',   color: '#FF7A1A', label: 'Tarefa' },
  'deadline':  { bg: 'rgba(239,68,68,0.1)',    color: '#EF4444', label: 'Prazo' },
  'free':      { bg: 'rgba(156,163,175,0.06)', color: '#9CA3AF', label: 'Livre' },
};

function renderCalendar() {
  const container = document.getElementById('calendar-widget');
  if (!container) return;

  const today = new Date();
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Build 7-day week starting from today
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }

  const session = getSession();
  const eventsToRender = (session && session.isSupabase) ? [] : CALENDAR_EVENTS;

  let html = '<div class="cal-week-grid">';

  days.forEach((date, idx) => {
    const isToday = idx === 0;
    const dayEvents = eventsToRender.filter(e => e.day === idx);

    html += `
      <div class="cal-day-col ${isToday ? 'cal-today' : ''}">
        <div class="cal-day-header">
          <span class="cal-day-name">${dayNames[date.getDay()]}</span>
          <span class="cal-day-num ${isToday ? 'cal-day-num-today' : ''}">${date.getDate()}</span>
        </div>
        <div class="cal-day-events">`;

    if (dayEvents.length === 0) {
      html += '<div class="cal-event-empty">—</div>';
    } else {
      dayEvents.forEach(event => {
        const typeStyle = CAL_TYPE_COLORS[event.type] || CAL_TYPE_COLORS['task'];
        html += `
          <div class="cal-event" style="background:${typeStyle.bg}; border-left: 3px solid ${typeStyle.color};" title="${event.title}">
            <div class="cal-event-time" style="color:${typeStyle.color};">
              <i class="fas ${event.icon}"></i>
              ${event.time || ''}
            </div>
            <div class="cal-event-title">${event.title}</div>
          </div>`;
      });
    }

    html += '</div></div>';
  });

  html += '</div>';

  // Month indicator
  html += `<div class="cal-footer">
    <span class="cal-month-label">${monthNames[today.getMonth()]} ${today.getFullYear()}</span>
    <span class="cal-event-count">${eventsToRender.filter(e => e.type !== 'free').length} compromissos esta semana</span>
  </div>`;

  container.innerHTML = html;

  // View toggle
  document.querySelectorAll('[data-cal-view]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-cal-view]').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      if (chip.dataset.calView === 'month') {
        showToast('Visualização mensal — em breve', 'info');
      }
    });
  });
}
