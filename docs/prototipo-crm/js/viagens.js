/* Tela Viagens: três opções de layout para escolher a direção. Dados de exemplo. */
{
const ic = CRM.ic;
const VIAGENS = [
  { id: 't7', c: 'Família Medeiros', d: 'Porto de Galinhas', dt: '22 a 28 nov', img: 'viagem-praia.jpg', fase: 'agora', dia: 'Dia 3 de 7', ck: [12, 12], rot: 'Aprovado', pax: 4, prep: 'viajando' },
  { id: 't1', c: 'Família Souza', d: 'Fernando de Noronha', dt: '12 a 19 dez', img: 'viagem-noronha.jpg', fase: 'breve', dias: 18, ck: [9, 12], rot: 'Aprovado', pax: 4, prep: 'emitindo', alerta: 'Seguro viagem vence hoje' },
  { id: 't2', c: 'Rafael e Bia', d: 'Cusco e Machu Picchu', dt: '8 a 18 jan', img: 'viagem-peru.jpg', fase: 'adiante', dias: 45, ck: [5, 14], rot: 'Enviado ao cliente', pax: 2, prep: 'enviado' },
  { id: 't3', c: 'Grupo Jalapão', d: 'Jalapão, Tocantins', dt: '20 a 25 jan', img: 'viagem-jalapao.jpg', fase: 'adiante', dias: 57, ck: [3, 10], rot: 'Em montagem', pax: 8, prep: 'montando', alerta: '2 passaportes por conferir' },
  { id: 't4', c: 'Patrícia Gomes', d: 'Curaçao', dt: '2 a 9 fev', img: '', fase: 'adiante', dias: 70, ck: [1, 12], rot: 'Em montagem', pax: 2, prep: 'montando' },
  { id: 't5', c: 'Juliana e Marcos', d: 'Chapada Diamantina', dt: '15 a 20 dez', img: '', fase: 'breve', dias: 21, ck: [11, 11], rot: 'Aprovado', pax: 2, prep: 'pronta' },
  { id: 't6', c: 'Helena Castro', d: 'Lisboa', dt: '2 a 12 out', img: '', fase: 'feita', ck: [12, 12], rot: 'Concluída', pax: 1, prep: 'feita' }
];
CRM.viagens = VIAGENS;
const pct = v => Math.round(v.ck[0] / v.ck[1] * 100);
const capa = (v, cls = '') => v.img ? `<img class="${cls}" src="img/${v.img}" alt="">` : `<span class="${cls} capa-vazia">${ic('globe-hemisphere-west')}</span>`;
const quando = v => v.fase === 'agora' ? `<b class="ok">${v.dia}</b>` : v.dias ? `<b class="num">${v.dias}</b><small>dias</small>` : '<small>Concluída</small>';
const rotChip = r => `<span class="chip ${r === 'Aprovado' || r === 'Concluída' ? 'ok' : r === 'Enviado ao cliente' ? 'info' : ''}">${r}</span>`;
const href = v => v.id === 't1' ? '#viagem' : '#viagens';
let opc = 'a';
try { opc = localStorage.getItem('crm-opc-viagens') || 'a'; } catch (e) {}

/* A · Linha do tempo: agrupada por quando embarca */
function opA() {
  const G = [['agora', 'Em viagem agora'], ['breve', 'Embarcam em 30 dias'], ['adiante', 'Mais adiante'], ['feita', 'Concluídas']];
  return G.map(([f, t]) => {
    const l = VIAGENS.filter(v => v.fase === f); if (!l.length) return '';
    return `<section class="stack" style="gap:4px"><div class="sec-h"><div><h2 class="h2">${t} <span class="muted">· ${l.length}</span></h2></div></div>
    ${l.map(v => `<a class="vrow" href="${href(v)}">${capa(v, 'vrow__img')}
      <div class="vrow__b"><b>${v.d}</b><span>${v.c} · ${v.dt} · ${v.pax} ${v.pax > 1 ? 'pessoas' : 'pessoa'}</span>${v.alerta ? `<span class="late">${ic('warning', 'i s')}${v.alerta}</span>` : ''}</div>
      <div class="vrow__c">${rotChip(v.rot)}</div>
      <div class="vrow__p"><span class="bar${pct(v) === 100 ? ' ok' : ''}"><i style="width:${pct(v)}%"></i></span><small class="muted">Checklist ${v.ck[0]}/${v.ck[1]}</small></div>
      <div class="vrow__d">${quando(v)}</div></a>`).join('')}</section>`;
  }).join('');
}

/* B · Capas: galeria de fotos com selo, contagem e barra colada */
function opB() {
  return `<div class="seg" role="group" aria-label="Filtro"><button aria-pressed="true">Próximas · 6</button><button aria-pressed="false">Em viagem · 1</button><button aria-pressed="false">Concluídas · 1</button></div>
  <div class="capas">${VIAGENS.filter(v => v.fase !== 'feita').map(v => `<a class="vcapa" href="${href(v)}">
    <div class="vcapa__m">${capa(v)}<span class="vcapa__shade"></span>
      <span class="selo">${v.fase === 'agora' ? 'Em viagem' : v.rot}</span>
      <span class="vcapa__n">${v.fase === 'agora' ? `<small>${v.dia}</small>` : `<b class="num">${v.dias}</b><small>dias</small>`}</span>
      <span class="vcapa__bar"><i style="width:${pct(v)}%;${pct(v) === 100 ? 'background:var(--ok);box-shadow:none' : ''}"></i></span></div>
    <div class="vcapa__t"><b>${v.d}</b><span>${v.c} · ${v.dt}</span>${v.alerta ? `<span class="late">${ic('warning', 'i s')}${v.alerta}</span>` : `<span class="muted">Checklist ${v.ck[0]}/${v.ck[1]}</span>`}</div></a>`).join('')}</div>`;
}

/* C · Quadro de preparação: colunas pelo que falta fazer */
function opC() {
  const C = [['montando', 'Montando roteiro'], ['enviado', 'Com o cliente'], ['emitindo', 'Emitindo'], ['pronta', 'Pronta para embarcar'], ['viajando', 'Em viagem']];
  return `<div class="quadro quadro--5">${C.map(([k, t]) => {
    const l = VIAGENS.filter(v => v.prep === k);
    return `<section class="col"><header class="col__h"><b>${t}</b><span class="cnt">${l.length}</span></header><div class="col__b">
    ${l.map(v => `<a class="vcard" href="${href(v)}">${v.img ? `<img class="vcard__img" src="img/${v.img}" alt="">` : ''}
      <div class="vcard__t"><b>${v.d}</b><span class="num" style="font:700 14px var(--fd)">${v.fase === 'agora' ? '' : v.dias + 'd'}</span></div>
      <span class="vcard__q">${v.c} · ${v.dt}</span>
      <span class="row" style="gap:8px"><span class="bar${pct(v) === 100 ? ' ok' : ''}"><i style="width:${pct(v)}%"></i></span><small class="muted num">${v.ck[0]}/${v.ck[1]}</small></span>
      ${v.alerta ? `<span class="vcard__nx late">${ic('warning', 'i s')}${v.alerta}</span>` : ''}</a>`).join('') || '<div class="col__vazio">Nenhuma viagem aqui</div>'}
    </div></section>`;
  }).join('')}</div>`;
}

const OPC = { a: ['Lista', 'list-bullets', opA], b: ['Capas', 'squares-four', opB], c: ['Quadro', 'kanban', opC] };

CRM.telas.viagens = {
  get larga() { return opc === 'c'; },
  render() {
    const fn = OPC[opc][2];
    return `
    <header class="ph"><div><h1 class="h1">Viagens</h1><p>Fechadas e em preparação · 1 em andamento · próximo embarque em 18 dias</p></div>
      <button class="btn p" type="button" data-nova-venda>${ic('plus', 'i s')}Nova viagem</button></header>
    ${CRM.subViagens('prep')}
    <div class="filtros"><label class="search"><svg class="i s"><use href="#i-magnifying-glass"/></svg><input placeholder="Cliente ou destino" aria-label="Buscar viagens"></label>
      <div class="seg" role="group" aria-label="De quem"><button type="button" aria-pressed="true">Minhas</button><button type="button" aria-pressed="false">Toda a equipe</button></div>
      <span class="sp"></span>${CRM.vistas(OPC, opc, 'v')}</div>
    ${fn()}`;
  },
  depois(el) {
    el.querySelectorAll('[data-opc-v]').forEach(b => b.addEventListener('click', () => {
      opc = b.dataset.opcV; try { localStorage.setItem('crm-opc-viagens', opc); } catch (e) {} CRM.render();
    }));
  }
};

}
