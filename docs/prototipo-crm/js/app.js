/* Protótipo CRM OSV · casca do app: menu, rotas por hash, tema, criar novo, painel lateral. */
window.CRM = (() => {
  const ic = (n, c = 'i') => `<svg class="${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  /* Menu agrupado: trabalho do dia, recursos e gestão */
  const NAV = [
    { g: 'Trabalho' },
    { id: 'hoje', t: 'Hoje', ic: 'house' },
    { id: 'viagens', h: 'vendas', t: 'Viagens', ic: 'airplane-tilt', n: 6, acc: 1 },
    { id: 'viajantes', t: 'Viajantes', ic: 'address-book' },
    { id: 'agenda', t: 'Agenda', ic: 'calendar-blank', n: 6 },
    { g: 'Recursos' },
    { id: 'biblioteca', t: 'Biblioteca', ic: 'images' },
    { g: 'Gestão' },
    { id: 'financeiro', t: 'Financeiro', ic: 'wallet' },
    { id: 'equipe', t: 'Equipe', ic: 'users-three' },
    { id: 'config', t: 'Configurações', ic: 'shield-check' }
  ];
  const TAB = [{ id: 'hoje', t: 'Hoje', ic: 'house' }, { id: 'viagens', h: 'vendas', t: 'Viagens', ic: 'airplane-tilt' }, { novo: 1 }, { id: 'viajantes', t: 'Viajantes', ic: 'address-book' }, { id: 'agenda', t: 'Agenda', ic: 'calendar-blank' }];
  const telas = {};
  let atual = null;

  function emBreve(id) {
    const it = NAV.find(n => n.id === id) || { t: 'Minha conta' };
    return `<header class="ph"><div><h1 class="h1">${it.t}</h1></div></header>
    <div class="empty"><b>Próxima etapa do protótipo</b>Esta tela entra nas próximas etapas.<a class="btn s" href="#hoje">Voltar para Hoje</a></div>`;
  }

  function render() {
    const id = (location.hash || '#hoje').slice(1);
    const menu = (telas[id] && telas[id].menu) || id;
    document.getElementById('nav').innerHTML = NAV.map(n => n.g ? `<span class="grp">${n.g}</span>` :
      `<a class="nav" href="#${n.h || n.id}"${n.id === menu ? ' aria-current="page"' : ''}>${ic(n.ic)}${n.t}${n.n ? `<span class="cnt${n.acc ? ' acc' : ''}">${n.n}</span>` : ''}</a>`).join('');
    document.getElementById('tabbar').innerHTML = TAB.map(n => n.novo ? `<a class="fab" href="#" data-novo aria-label="Criar novo"><span>${ic('plus')}</span></a>` :
      `<a href="#${n.h || n.id}"${n.id === menu ? ' aria-current="page"' : ''}>${ic(n.ic)}${n.t}</a>`).join('');
    const t = telas[id];
    const el = document.getElementById('tela');
    document.body.classList.toggle('so-cliente', !!(t && t.cliente));
    el.innerHTML = t ? t.render() : emBreve(id);
    document.getElementById('main').classList.toggle('wide', !!(t && t.larga));
    if (id !== atual) window.scrollTo(0, 0);
    atual = id;
    t && t.depois && t.depois(el);
  }

  /* Painel lateral (ficha) e janela (formulário) */
  /* Viagens: uma área só, com a fase comercial e a fase de preparação */
  const subViagens = ativo => { const v = CRM.vendas || [], ab = v.filter(x => ['novo', 'contatado', 'negociando'].includes(x.e)).length, pr = (CRM.viagens || []).filter(x => x.fase !== 'feita').length;
    return `<nav class="tabs subv" aria-label="Fases da viagem"><a href="#vendas" role="tab" aria-selected="${ativo === 'com'}">${ic('kanban', 'i s')}Comercial <span class="muted">· ${ab}</span></a><a href="#viagens" role="tab" aria-selected="${ativo === 'prep'}">${ic('airplane-tilt', 'i s')}Preparação e viagem <span class="muted">· ${pr}</span></a></nav>`; };

  function painel(html) {
    const p = document.getElementById('painel');
    p.querySelector('.painel__in').innerHTML = html;
    p.classList.add('on'); document.body.classList.add('travado');
    p.querySelector('.painel__in').scrollTop = 0;
    setTimeout(() => p.querySelector('[data-fechar]')?.focus(), 30);
  }
  function janela(html) {
    const j = document.getElementById('janela');
    j.querySelector('.janela__in').innerHTML = html;
    j.classList.add('on'); document.body.classList.add('travado');
    setTimeout(() => j.querySelector('input,select,textarea')?.focus(), 30);
  }
  function fechar() {
    for (const s of ['painel', 'janela', 'sheet']) document.getElementById(s).classList.remove('on');
    document.body.classList.remove('travado');
  }
  function aviso(txt) {
    const t = document.getElementById('aviso');
    t.textContent = txt; t.classList.add('on');
    clearTimeout(aviso.t); aviso.t = setTimeout(() => t.classList.remove('on'), 2600);
  }

  function iniciar() {
    addEventListener('hashchange', render); render();
    const root = document.documentElement, tb = document.getElementById('temaBtn');
    const setT = m => { root.dataset.theme = m; tb.innerHTML = ic(m === 'light' ? 'moon' : 'sun', 'i s'); try { localStorage.setItem('crm-tema', m) } catch (e) {} };
    setT(root.dataset.theme === 'light' ? 'light' : 'dark');
    tb.addEventListener('click', () => setT(root.dataset.theme === 'light' ? 'dark' : 'light'));

    const sh = document.getElementById('sheet');
    document.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('[data-novo]')) { e.preventDefault(); sh.classList.add('on'); sh.querySelector('a').focus(); return; }
      if (t.closest('[data-fechar]') || t.classList.contains('veu') || t === sh) { fechar(); return; }
      if (t.closest('.sheet a')) sh.classList.remove('on');
      const s = t.closest('.seg button');
      if (s && !s.closest('[data-seg-livre]')) s.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === s));
      const v = t.closest('[data-venda]');
      if (v && telas.vendas) { e.preventDefault(); if (location.hash !== '#vendas') location.hash = '#vendas'; telas.vendas.abrir(v.dataset.venda); }
      const nv = t.closest('[data-nova-venda]');
      if (nv && telas.vendas) { e.preventDefault(); fechar(); if (location.hash !== '#vendas') location.hash = '#vendas'; telas.vendas.nova(); }
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  }

  /* Seletor de visualização: ícone + nome; a escolha fica guardada por pessoa */
  const vistas = (opcs, atual, pref) => `<div class="seg vistas" data-seg-livre role="group" aria-label="Visualização">${Object.entries(opcs).map(([k, o]) =>
    `<button type="button" data-opc-${pref}="${k}" aria-pressed="${k === atual}" title="${o[0]}">${ic(o[1], 'i s')}<span>${o[0]}</span></button>`).join('')}</div>`;

  return { ic, telas, vistas, subViagens, render, painel, janela, fechar, aviso, iniciar };
})();
