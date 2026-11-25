/* Tela Agenda: tarefas, compromissos e datas automáticas num lugar só. Modos Lista, Semana e Mês. Dados de exemplo. */
{
const ic = CRM.ic;
const HOJE = 24; // terça, 24 de novembro de 2026
const TIPOS = {
  tarefa: ['Tarefa', 'check-square'], ligacao: ['Ligação', 'phone'], whats: ['WhatsApp', 'whatsapp-logo'], reuniao: ['Reunião', 'users-three'],
  email: ['E-mail', 'envelope-simple'], checklist: ['Checklist', 'list-checks'], auto: ['Automático', 'calendar-blank']
};
/* d = dia de novembro (32+ = dezembro) */
const ITENS = [
  { id: 1, d: 23, h: '', tp: 'tarefa', t: 'Enviar proposta de Orlando', c: 'Carla Mendes', l: 'Venda · Negociando', venda: 'v3', pr: 'alta' },
  { id: 2, d: 23, h: '', tp: 'tarefa', t: 'Enviar opções de hotel', c: 'Bruno Costa', l: 'Venda · Contatado', venda: 'v5' },
  { id: 3, d: 24, h: '09:00', tp: 'ligacao', t: 'Confirmar datas de Lisboa e Porto', c: 'Família Andrade', l: 'Venda · Contatado', venda: 'v6', ok: 1 },
  { id: 4, d: 24, h: '10:30', tp: 'reuniao', t: 'Apresentar o roteiro do Peru', c: 'Rafael e Bia', l: 'Viagem · Peru' },
  { id: 5, d: 24, h: '14:00', tp: 'checklist', t: 'Emitir seguro viagem', c: 'Família Souza', l: 'Viagem · Noronha', viagem: 1, pr: 'alta' },
  { id: 6, d: 24, h: '16:00', tp: 'whats', t: 'Retorno sobre hotel em Paris', c: 'Juliana Prado', l: 'Venda · Negociando', venda: 'v7' },
  { id: 7, d: 24, h: '17:30', tp: 'tarefa', t: 'Conferir passaportes do grupo', c: 'Grupo Jalapão', l: 'Viagem · Jalapão' },
  { id: 8, d: 24, h: '', tp: 'whats', t: 'Cobrar retorno da proposta', c: 'Ana Ribeiro', l: 'Venda · Negociando', venda: 'v9' },
  { id: 9, d: 25, h: '10:00', tp: 'ligacao', t: 'Ligar para entender o perfil', c: 'Marcos e Lia Teixeira', l: 'Venda · Novo', venda: 'v4' },
  { id: 10, d: 25, h: '15:00', tp: 'reuniao', t: 'Reunião de equipe', c: 'Equipe OSV', l: 'Interno' },
  { id: 11, d: 26, h: '11:00', tp: 'tarefa', t: 'Montar proposta de Lisboa e Porto', c: 'Família Andrade', l: 'Venda · Contatado', venda: 'v6' },
  { id: 12, d: 27, h: '09:00', tp: 'email', t: 'Ajustar datas do voo', c: 'Thiago Rocha', l: 'Venda · Negociando', venda: 'v8' },
  { id: 13, d: 28, h: '', tp: 'auto', t: 'Aniversário de Ana Ribeiro', c: 'Ana Ribeiro', l: 'Mandar parabéns' },
  { id: 14, d: 30, h: '', tp: 'checklist', t: 'Agendar trilha do Atalaia no ICMBio', c: 'Família Souza', l: 'Viagem · Noronha', viagem: 1 },
  { id: 15, d: 32, h: '', tp: 'auto', t: 'Aniversário de Diego Alves', c: 'Diego Alves', l: 'Mandar parabéns' },
  { id: 16, d: 33, h: '', tp: 'auto', t: 'Passaporte de Carla Mendes vence em 4 meses', c: 'Carla Mendes', l: 'Avisar a cliente' },
  { id: 17, d: 40, h: '', tp: 'checklist', t: 'Check-in online dos voos', c: 'Família Souza', l: 'Viagem · Noronha', viagem: 1 },
  { id: 18, d: 42, h: '', tp: 'auto', t: 'Embarque para Fernando de Noronha', c: 'Família Souza', l: 'Viagem · Noronha', viagem: 1 }
];
const SEM = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const semana = d => SEM[(d + 5) % 7]; // 1º de novembro de 2026 é domingo
const dataTxt = d => d > 30 ? `${d - 30} dez` : `${d} nov`;
let vista = 'a', filtro = 'todos';
try { vista = localStorage.getItem('crm-opc-agenda') || 'a'; } catch (e) {}
const VISTAS = { a: ['Lista', 'list-bullets'], b: ['Semana', 'columns'], c: ['Mês', 'calendar-blank'] };

const visiveis = () => ITENS.filter(i => filtro === 'todos' || (filtro === 'tarefas' ? ['tarefa', 'checklist'].includes(i.tp) : filtro === 'contatos' ? ['ligacao', 'whats', 'reuniao', 'email'].includes(i.tp) : i.tp === 'auto'));
const atrasado = i => i.d < HOJE && !i.ok;

function linha(i) {
  const [tn, ti] = TIPOS[i.tp];
  return `<div class="ag${atrasado(i) ? ' late' : ''}${i.ok ? ' feito' : ''}">
    <time>${i.h || (i.tp === 'auto' ? '' : 'Dia')}<small>${tn}</small></time>
    <div class="bd"><b>${i.t}</b><span>${ic(ti, 'i s')}${i.c} · ${i.l}${atrasado(i) ? ' <span class="chip bad">Atrasada</span>' : ''}${i.pr === 'alta' && !i.ok ? ' <span class="chip warn">Prioridade alta</span>' : ''}</span></div>
    <div class="acts">${i.ok ? '<span class="chip ok">Feito</span>' : `${i.tp !== 'auto' && i.tp !== 'checklist' && i.c !== 'Equipe OSV' ? `<button class="mini" type="button" aria-label="WhatsApp de ${i.c}">${ic('whatsapp-logo', 'i s')}</button>` : ''}
      ${i.venda ? `<button class="mini" type="button" data-venda="${i.venda}" aria-label="Abrir venda">${ic('kanban', 'i s')}</button>` : i.viagem ? `<a class="mini" href="#viagem" aria-label="Abrir viagem">${ic('airplane-tilt', 'i s')}</a>` : ''}
      <button class="mini done" type="button" data-feito="${i.id}" aria-label="Concluir">${ic('check', 'i s')}</button>`}</div></div>`;
}

function lista() {
  const v = visiveis();
  const G = [['Atrasadas', i => atrasado(i)], [`Hoje · ${semana(HOJE)}, ${HOJE} nov`, i => i.d === HOJE], [`Amanhã · ${semana(HOJE + 1)}, ${HOJE + 1} nov`, i => i.d === HOJE + 1],
    ['Esta semana', i => i.d > HOJE + 1 && i.d <= 29], ['Mais adiante', i => i.d > 29]];
  return G.map(([t, f]) => { const l = v.filter(f).sort((a, b) => a.d - b.d || (a.h || '99').localeCompare(b.h || '99')); if (!l.length) return '';
    return `<section class="stack" style="gap:2px"><div class="sec-h"><div><h2 class="h2${t === 'Atrasadas' ? ' tx-bad' : ''}">${t} <span class="muted">· ${l.length}</span></h2></div></div>
      ${l.map(i => (t === 'Esta semana' || t === 'Mais adiante' ? linha(i).replace('<time>', `<time><span class="ag__d">${semana(i.d)}, ${dataTxt(i.d)}</span>`) : linha(i))).join('')}</section>`;
  }).join('');
}

function semanaV() {
  const v = visiveis();
  return `<div class="sem">${[23, 24, 25, 26, 27, 28, 29].map(d => {
    const l = v.filter(i => i.d === d || (d === HOJE && atrasado(i))).sort((a, b) => (atrasado(b) - atrasado(a)) || (a.h || '99').localeCompare(b.h || '99'));
    return `<section class="sem__d${d === HOJE ? ' hoje' : ''}"><header><span>${semana(d)}</span><b>${d}</b></header>
      ${l.map(i => `<button type="button" class="sem__i${atrasado(i) ? ' late' : ''}${i.ok ? ' feito' : ''}${i.tp === 'auto' ? ' auto' : ''}" data-ver="${i.id}"><small>${atrasado(i) ? 'Atrasada' : i.h || TIPOS[i.tp][0]}</small>${i.t}<span>${i.c}</span></button>`).join('') || '<span class="sem__vazio">Livre</span>'}
      <button type="button" class="sem__add" data-nova-tarefa="${d}" aria-label="Novo em ${d} nov">${ic('plus', 'i s')}</button></section>`;
  }).join('')}</div>`;
}

function mes() {
  const v = visiveis(), cel = [];
  for (let k = 0; k < 6; k++) cel.push('<div class="mes__c fora"></div>');
  for (let d = 1; d <= 30; d++) {
    const l = v.filter(i => i.d === d);
    cel.push(`<button type="button" class="mes__c${d === HOJE ? ' hoje' : ''}${d < HOJE ? ' passado' : ''}" data-dia-mes="${d}"><b>${d}</b>
      ${l.slice(0, 2).map(i => `<span class="${atrasado(i) ? 'late' : i.ok ? 'feito' : ''}">${i.t}</span>`).join('')}${l.length > 2 ? `<small>+${l.length - 2}</small>` : ''}</button>`);
  }
  return `<div class="mes"><div class="mes__h">${SEM.map(s => `<span>${s}</span>`).join('')}</div><div class="mes__g">${cel.join('')}</div></div>`;
}

function nova(d = HOJE) {
  CRM.janela(`<form class="form" data-nova-ag>
    <div class="sec-h"><div><span class="mono">Agenda</span><h2 class="h2">Novo na agenda</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="fld"><span class="lbl">Tipo</span><div class="chips">${['tarefa', 'ligacao', 'whats', 'reuniao', 'email'].map((k, n) => `<label class="opcao opcao--chip"><input type="radio" name="tp" value="${k}" ${n ? '' : 'checked'}><span>${TIPOS[k][0]}</span></label>`).join('')}</div></div>
    <div class="fld"><label for="ag-t">O que fazer</label><input id="ag-t" required placeholder="Ex.: Enviar proposta revisada"></div>
    <div class="linha"><div class="fld"><label for="ag-d">Quando</label><select id="ag-d">${[HOJE, HOJE + 1, 26, 27, 30].map(x => `<option value="${x}" ${x === +d ? 'selected' : ''}>${x === HOJE ? 'Hoje' : x === HOJE + 1 ? 'Amanhã' : semana(x) + ', ' + x + ' nov'}</option>`).join('')}</select></div>
      <div class="fld"><label for="ag-h">Horário (opcional)</label><input id="ag-h" type="time"></div></div>
    <div class="fld"><label for="ag-c">Cliente, venda ou viagem</label><input id="ag-c" list="ag-lista" placeholder="Busque pelo nome"><datalist id="ag-lista">${[...new Set(ITENS.map(i => i.c))].map(c => `<option value="${c}">`).join('')}</datalist></div>
    <div class="fld"><span class="lbl">Prioridade</span><div class="seg" role="group"><button type="button" aria-pressed="false">Baixa</button><button type="button" aria-pressed="true">Normal</button><button type="button" aria-pressed="false">Alta</button></div></div>
    <div class="row" style="justify-content:space-between;flex-wrap:wrap"><label class="row muted" style="gap:8px;font-size:13.5px"><input type="checkbox" checked style="accent-color:var(--acc)">Lembrar 15 min antes</label>
      <div class="row"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="submit">Salvar</button></div></div>
  </form>`);
}

function diaMes(d) {
  const l = visiveis().filter(i => i.d === d);
  CRM.janela(`<div class="sec-h"><div><span class="mono">${semana(d)}</span><h2 class="h2">${d} de novembro</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div>${l.map(linha).join('') || '<div class="empty"><b>Dia livre</b>Nada marcado para este dia.</div>'}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn p" type="button" data-nova-tarefa="${d}">${ic('plus', 'i s')}Novo neste dia</button></div>`);
}

CRM.telas.agenda = {
  get larga() { return vista !== 'a'; },
  render() {
    const pend = ITENS.filter(i => i.d === HOJE && !i.ok).length, late = ITENS.filter(atrasado).length;
    return `<div id="ag" class="stack" style="gap:26px">
    <header class="ph"><div><h1 class="h1">Agenda</h1><p>${pend} para hoje · <span class="tx-bad">${late} atrasadas</span><span class="so-desk"> · aniversários, passaportes e embarques entram sozinhos</span></p></div>
      <button class="btn p" type="button" data-nova-tarefa="${HOJE}">${ic('plus', 'i s')}Novo na agenda</button></header>
    <div class="filtros">
      <div class="seg" role="group" aria-label="De quem"><button type="button" aria-pressed="true">Minha</button><button type="button" aria-pressed="false">Toda a equipe</button></div>
      <div class="seg" data-seg-livre role="group" aria-label="Tipo">${[['todos', 'Tudo'], ['tarefas', 'Tarefas'], ['contatos', 'Contatos'], ['auto', 'Datas automáticas']].map(([k, t]) => `<button type="button" data-filtro="${k}" aria-pressed="${k === filtro}">${t}</button>`).join('')}</div>
      <span class="sp"></span>${CRM.vistas(VISTAS, vista, 'ag')}</div>
    ${vista === 'a' ? lista() : vista === 'b' ? semanaV() : mes()}</div>`;
  },
  depois(raiz) {
    const el = raiz.querySelector('#ag');
    el.addEventListener('click', e => {
      const t = e.target, b = t.closest('[data-opc-ag]');
      if (b) { vista = b.dataset.opcAg; try { localStorage.setItem('crm-opc-agenda', vista); } catch (er) {} CRM.render(); return; }
      const f = t.closest('[data-filtro]'); if (f) { filtro = f.dataset.filtro; CRM.render(); return; }
      const m = t.closest('[data-dia-mes]'); if (m) diaMes(+m.dataset.diaMes);
      const s = t.closest('[data-ver]'); if (s) { const i = ITENS.find(x => x.id === +s.dataset.ver); CRM.janela(`<div class="sec-h"><div><h2 class="h2">${dataTxt(i.d)}</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>${linha(i)}`); }
    });
  }
};

document.addEventListener('click', e => {
  const n = e.target.closest('[data-nova-tarefa]'); if (n) { e.preventDefault(); nova(n.dataset.novaTarefa); return; }
  const f = e.target.closest('[data-feito]');
  if (f) { const i = ITENS.find(x => x.id === +f.dataset.feito); i.ok = 1; CRM.fechar(); CRM.render(); CRM.aviso(`Feito: ${i.t}`); }
});
document.addEventListener('submit', e => {
  if (!e.target.matches('[data-nova-ag]')) return;
  e.preventDefault();
  const f = e.target, c = f.querySelector('#ag-c').value.trim() || 'Sem vínculo';
  ITENS.push({ id: Date.now(), d: +f.querySelector('#ag-d').value, h: f.querySelector('#ag-h').value, tp: f.querySelector('input[name=tp]:checked').value, t: f.querySelector('#ag-t').value.trim().replace(/[<>&]/g, ''), c: c.replace(/[<>&]/g, ''), l: 'Adicionado agora', pr: f.querySelector('.seg [aria-pressed=true]').textContent === 'Alta' ? 'alta' : '' });
  CRM.fechar(); if (location.hash !== '#agenda') location.hash = '#agenda'; else CRM.render(); CRM.aviso('Salvo na agenda');
});
}
