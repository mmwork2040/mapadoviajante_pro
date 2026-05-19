/* ══════════════════════════════════════════════════════════════
   FINANCES.JS — Chart, Transactions Table, Summary, CRUD
   Now powered by Supabase (crm_transactions)
   ══════════════════════════════════════════════════════════════ */

// ── Local cache of fetched transactions ─────────────────────
let _finTransactions = [];

async function initFinances() {
  await loadFinanceData();
  renderFinanceSummary();
  renderTransactionsTable();
  initFinanceChart();
  initFinanceFilters();
  initAddTransaction();
}

async function loadFinanceData() {
  const session = getSession();
  if (session && session.isSupabase) {
    _finTransactions = await fetchTransactions();
  } else {
    // Fallback to static data
    _finTransactions = (typeof TRANSACTIONS !== 'undefined') ? [...TRANSACTIONS] : [];
  }
}

// ── Finance Summary (side card) ─────────────────────────────
function renderFinanceSummary() {
  const container = document.getElementById('finance-summary');
  if (!container) return;

  const totalIncome = _finTransactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalCommission = _finTransactions
    .filter(t => t.type === 'commission')
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalExpense = _finTransactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const netProfit = totalCommission - totalExpense;
  const profitMargin = totalIncome > 0 ? ((totalCommission / totalIncome) * 100).toFixed(1) : 0;

  const incomeCount = _finTransactions.filter(t => t.type === 'income').length;

  container.innerHTML = `
    <div class="summary-row">
      <span class="summary-label"><i class="fas fa-arrow-down" style="color:var(--success);margin-right:6px;"></i>Total Receitas</span>
      <span class="summary-value" style="color:var(--success);">R$ ${totalIncome.toLocaleString('pt-BR')}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label"><i class="fas fa-hand-holding-dollar" style="color:var(--info);margin-right:6px;"></i>Total Comissões</span>
      <span class="summary-value" style="color:var(--info);">R$ ${totalCommission.toLocaleString('pt-BR')}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label"><i class="fas fa-arrow-up" style="color:var(--danger);margin-right:6px;"></i>Total Despesas</span>
      <span class="summary-value" style="color:var(--danger);">- R$ ${totalExpense.toLocaleString('pt-BR')}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-row highlight">
      <span class="summary-label"><i class="fas fa-chart-pie" style="color:var(--primary);margin-right:6px;"></i>Lucro Líquido</span>
      <span class="summary-value" style="color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 18px;">R$ ${netProfit.toLocaleString('pt-BR')}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Margem de Comissão</span>
      <span class="summary-value">${profitMargin}%</span>
    </div>
    <div class="summary-progress">
      <div class="summary-progress-bar" style="width: ${Math.min(profitMargin * 3, 100)}%;"></div>
    </div>
    <div class="summary-row" style="margin-top: var(--sp-4);">
      <span class="summary-label">Transações no período</span>
      <span class="summary-value">${_finTransactions.length}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Ticket médio</span>
      <span class="summary-value">R$ ${Math.round(totalIncome / Math.max(incomeCount, 1)).toLocaleString('pt-BR')}</span>
    </div>
  `;
}

// ── Transactions Table ──────────────────────────────────────
function renderTransactionsTable(filterType = 'all') {
  const tbody = document.getElementById('finance-table-body');
  const countEl = document.getElementById('fin-tx-count');
  if (!tbody) return;

  let filtered = [..._finTransactions];
  if (filterType !== 'all') {
    filtered = filtered.filter(t => t.type === filterType);
  }

  if (countEl) countEl.textContent = `${filtered.length} transações`;

  tbody.innerHTML = filtered.map(tx => {
    const typeLabels = { income: 'Receita', commission: 'Comissão', expense: 'Despesa' };
    const typeColors = { income: 'var(--success)', commission: 'var(--info)', expense: 'var(--danger)' };
    const typeBgs = { income: 'var(--success-light)', commission: 'var(--info-light)', expense: 'var(--danger-light)' };

    const amount = Number(tx.amount);
    const sign = tx.type === 'expense' ? '- ' : '+ ';
    const amountColor = typeColors[tx.type] || 'var(--gray-900)';
    const desc = tx.description || tx.desc || '—';

    // Format date — handle both ISO (from Supabase) and dd/mm/yyyy (from static)
    let dateDisplay = tx.transaction_date || tx.date || '—';
    if (dateDisplay.includes('-')) {
      const [y, m, d] = dateDisplay.split('-');
      dateDisplay = `${d}/${m}/${y}`;
    }

    // Use UUID for Supabase records, numeric for static
    const txId = tx.id;

    return `
      <tr>
        <td>
          <div style="font-weight:600; color:var(--gray-900);">${desc}</div>
        </td>
        <td>
          <span style="display:inline-block;padding:2px 10px;border-radius:var(--radius-full);font-size:11px;font-weight:600;
            background:${typeBgs[tx.type]};color:${typeColors[tx.type]};">${typeLabels[tx.type] || tx.type}</span>
        </td>
        <td style="color:var(--gray-500);font-size:13px;">${dateDisplay}</td>
        <td style="text-align:right;font-weight:700;color:${amountColor};font-size:14px;">${sign}R$ ${Math.abs(amount).toLocaleString('pt-BR')}</td>
        <td style="text-align:center;">
          <button class="btn btn-ghost btn-sm" onclick="deleteTransaction('${txId}')" title="Remover"><i class="fas fa-trash" style="color:var(--danger);"></i></button>
        </td>
      </tr>`;
  }).join('');
}

// ── Finance Chart ───────────────────────────────────────────
function initFinanceChart() {
  const canvas = document.getElementById('finance-chart');
  if (!canvas) return;

  // Build chart data from transactions
  const chartData = buildFinanceChartData();

  const ctx = canvas.getContext('2d');

  window.financeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: 'Receita',
          data: chartData.revenue,
          backgroundColor: 'rgba(245, 142, 38, 0.7)',
          borderColor: '#F58E26',
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.6,
        },
        {
          label: 'Comissões',
          data: chartData.commissions,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3B82F6',
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: { family: 'Inter', size: 11 },
            color: '#6B7280',
            padding: 16,
          }
        },
        tooltip: {
          backgroundColor: '#1F2937',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont: { family: 'Inter', size: 13, weight: '600' },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: R$ ${ctx.parsed.y.toLocaleString('pt-BR')}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 11 }, color: '#9CA3AF' },
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

  // Chart type toggle (bar vs line)
  document.querySelectorAll('[data-fin-chart]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-fin-chart]').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      const type = chip.dataset.finChart;
      window.financeChart.config.type = type;
      window.financeChart.update();
    });
  });
}

/**
 * Build monthly chart data from transactions (last 6 months)
 */
function buildFinanceChartData() {
  const monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const now = new Date();
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: monthLabels[d.getMonth()],
      revenue: 0,
      commissions: 0,
    });
  }

  _finTransactions.forEach(t => {
    const dateStr = t.transaction_date || t.date;
    if (!dateStr) return;

    let txDate;
    if (dateStr.includes('-')) {
      txDate = new Date(dateStr);
    } else {
      // dd/mm/yyyy format
      const [d, m, y] = dateStr.split('/');
      txDate = new Date(y, m - 1, d);
    }

    const bucket = months.find(m => m.year === txDate.getFullYear() && m.month === txDate.getMonth());
    if (!bucket) return;

    if (t.type === 'income') {
      bucket.revenue += Number(t.amount);
    } else if (t.type === 'commission') {
      bucket.commissions += Number(t.amount);
    }
  });

  return {
    labels: months.map(m => m.label),
    revenue: months.map(m => m.revenue),
    commissions: months.map(m => m.commissions),
  };
}

// ── Filters ─────────────────────────────────────────────────
function initFinanceFilters() {
  const filterBtn = document.getElementById('finance-filter-btn');
  const filtersBar = document.getElementById('finance-filters');
  const typeFilter = document.getElementById('fin-filter-type');

  if (filterBtn && filtersBar) {
    filterBtn.addEventListener('click', () => {
      filtersBar.classList.toggle('hidden');
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', () => {
      renderTransactionsTable(typeFilter.value);
    });
  }
}

// ── Add Transaction ─────────────────────────────────────────
function initAddTransaction() {
  const btn = document.getElementById('add-transaction-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      // Set default date to today
      const dateInput = document.querySelector('#transaction-form [name="date"]');
      if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      openModal('transaction-modal');
    });
  }
}

async function submitTransaction(e) {
  e.preventDefault();
  const form = e.target;
  const type = form.type.value;
  const desc = form.desc.value;
  const amount = parseFloat(form.amount.value);
  const dateRaw = form.date.value;

  const session = getSession();

  if (session && session.isSupabase) {
    // Save to Supabase
    const result = await createTransaction({
      type,
      amount,
      description: desc,
      category: type === 'income' ? 'pacote' : type === 'commission' ? 'comissao' : 'operacional',
      transaction_date: dateRaw,
      status: 'confirmed',
    });

    if (result) {
      // Reload all data
      await loadFinanceData();
      renderTransactionsTable(document.getElementById('fin-filter-type')?.value || 'all');
      renderFinanceSummary();
      closeModal('transaction-modal');
      form.reset();
      showToast('Transação adicionada com sucesso! 💰', 'success');
    } else {
      showToast('Erro ao salvar transação', 'error');
    }
  } else {
    // Fallback static mode
    const [y, m, d] = dateRaw.split('-');
    const dateFormatted = `${d}/${m}/${y}`;

    const newTx = {
      id: Date.now(),
      desc,
      date: dateFormatted,
      amount: type === 'expense' ? -amount : amount,
      type,
    };

    _finTransactions.unshift(newTx);
    renderTransactionsTable(document.getElementById('fin-filter-type')?.value || 'all');
    renderFinanceSummary();
    closeModal('transaction-modal');
    form.reset();
    showToast('Transação adicionada com sucesso! 💰', 'success');
  }
}

async function deleteTransaction(id) {
  const session = getSession();

  if (session && session.isSupabase) {
    // Delete from Supabase
    const { error } = await supabase
      .from('crm_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('deleteTransaction:', error);
      showToast('Erro ao remover transação', 'error');
      return;
    }

    await loadFinanceData();
  } else {
    // Fallback static
    const idx = _finTransactions.findIndex(t => t.id === id || t.id === Number(id));
    if (idx === -1) return;
    _finTransactions.splice(idx, 1);
  }

  renderTransactionsTable(document.getElementById('fin-filter-type')?.value || 'all');
  renderFinanceSummary();
  showToast('Transação removida', 'warning');
}
