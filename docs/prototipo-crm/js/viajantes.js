/* Tela Viajantes: a base de pessoas da agência, por família ou grupo, com todas as viagens de cada uma
   e o acesso ao app do viajante. Substitui "Clientes". Dados de exemplo. */
{
const ic = CRM.ic;
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

/* Viagens que aparecem no histórico das pessoas */
const VG = {
  noronha: { d: 'Fernando de Noronha', dt: '12 a 19 dez 2026', f: 'prep', img: 'viagem-noronha.jpg', href: '#viagem' },
  gramado: { d: 'Gramado', dt: 'jul 2026', f: 'feita' }, portoseguro: { d: 'Porto Seguro', dt: 'jan 2025', f: 'feita' },
  orlando: { d: 'Orlando', dt: '2 a 12 fev 2027', f: 'neg', venda: 'v3' }, bariloche: { d: 'Bariloche', dt: 'jul 2025', f: 'feita' },
  peru: { d: 'Cusco e Machu Picchu', dt: '8 a 18 jan 2027', f: 'prep', img: 'viagem-peru.jpg' }, chile: { d: 'Atacama', dt: 'set 2025', f: 'feita' },
  maldivas: { d: 'Maldivas', dt: '10 a 20 mar 2027', f: 'neg', venda: 'v9' }, santiago: { d: 'Santiago', dt: '14 a 19 jun 2027', f: 'neg', venda: 'v5' },
  lisboa: { d: 'Lisboa', dt: 'out 2026', f: 'feita' }, paris: { d: 'Paris', dt: 'mai 2025', f: 'feita' }, roma: { d: 'Roma', dt: 'out 2024', f: 'feita' }, japao: { d: 'Japão', dt: 'abr 2024', f: 'feita' },
  jalapao: { d: 'Jalapão', dt: '20 a 25 jan 2027', f: 'prep', img: 'viagem-jalapao.jpg' }, buenos: { d: 'Buenos Aires', dt: 'abr 2027', f: 'neg', venda: 'v1' }
};
const FASE = { neg: ['Em negociação', 'now'], prep: ['Em preparação', 'info'], feita: ['Concluída', ''] };
const FAM = {
  souza: { n: 'Família Souza', tp: 'Família' }, mendes: { n: 'Família Mendes', tp: 'Família' }, duarte: { n: 'Rafael e Bia', tp: 'Casal' },
  ribeiro: { n: 'Ana e Felipe', tp: 'Casal' }, alves: { n: 'Diego e Marina', tp: 'Casal' }, jalapao: { n: 'Grupo Jalapão 2027', tp: 'Grupo' }
};
const PESSOAS = [
  { id: 'p1', n: 'Cláudia Souza', av: 'CS', k: '', fam: 'souza', rel: 'Titular', id_: '44 anos', tel: '(81) 99812-4455', pass: ['ok', 'Válido até 2030'], acesso: 'ativo', vg: ['noronha', 'gramado', 'portoseguro'] },
  { id: 'p2', n: 'Roberto Souza', av: 'RS', k: 'a2', fam: 'souza', rel: 'Cônjuge', id_: '46 anos', tel: '(81) 99700-1122', pass: ['ok', 'Válido até 2029'], acesso: 'ativo', vg: ['noronha', 'gramado', 'portoseguro'] },
  { id: 'p3', n: 'Lia Souza', av: 'LS', k: 'a3', fam: 'souza', rel: 'Filha', id_: '12 anos', pass: ['warn', 'Vence em 5 meses'], acesso: 'menor', vg: ['noronha', 'gramado'] },
  { id: 'p4', n: 'Tom Souza', av: 'TS', k: 'a4', fam: 'souza', rel: 'Filho', id_: '9 anos', pass: ['ok', 'Válido até 2028'], acesso: 'menor', vg: ['noronha', 'gramado'] },
  { id: 'p5', n: 'Carla Mendes', av: 'CM', k: 'a3', fam: 'mendes', rel: 'Titular', id_: '39 anos', tel: '(11) 97654-3321', pass: ['warn', 'Vence em 4 meses'], acesso: 'convite', vg: ['orlando', 'bariloche'] },
  { id: 'p6', n: 'Pedro Mendes', av: 'PM', k: 'a2', fam: 'mendes', rel: 'Cônjuge', id_: '41 anos', tel: '(11) 97111-2233', pass: ['ok', 'Válido até 2031'], acesso: 'sem', vg: ['orlando', 'bariloche'] },
  { id: 'p7', n: 'Ana Mendes', av: 'AM', k: 'a3', fam: 'mendes', rel: 'Filha', id_: '9 anos', pass: ['bad', 'Sem passaporte'], acesso: 'menor', vg: ['orlando'] },
  { id: 'p8', n: 'João Mendes', av: 'JM', k: 'a4', fam: 'mendes', rel: 'Filho', id_: '6 anos', pass: ['bad', 'Sem passaporte'], acesso: 'menor', vg: ['orlando'] },
  { id: 'p9', n: 'Rafael Duarte', av: 'RD', k: 'a2', fam: 'duarte', rel: 'Titular', id_: '34 anos', tel: '(31) 99123-0099', pass: ['ok', 'Válido até 2029'], acesso: 'ativo', vg: ['peru', 'chile'] },
  { id: 'p10', n: 'Bia Duarte', av: 'BD', k: 'a3', fam: 'duarte', rel: 'Cônjuge', id_: '32 anos', tel: '(31) 99456-7788', pass: ['ok', 'Válido até 2030'], acesso: 'ativo', vg: ['peru', 'chile'] },
  { id: 'p11', n: 'Ana Ribeiro', av: 'AR', k: 'a3', fam: 'ribeiro', rel: 'Titular', id_: '29 anos', tel: '(21) 98877-1200', pass: ['ok', 'Válido até 2031'], acesso: 'sem', vg: ['maldivas'], niver: '28 nov' },
  { id: 'p12', n: 'Felipe Nunes', av: 'FN', k: 'a2', fam: 'ribeiro', rel: 'Noivo', id_: '31 anos', pass: ['warn', 'Não informado'], acesso: 'sem', vg: ['maldivas'] },
  { id: 'p13', n: 'Bruno Costa', av: 'BC', k: 'a2', fam: null, rel: 'Viaja sozinho', id_: '37 anos', tel: '(11) 96655-8800', pass: ['bad', 'Sem passaporte'], acesso: 'sem', vg: ['santiago'] },
  { id: 'p14', n: 'Helena Castro', av: 'HC', k: 'a4', fam: null, rel: 'Viaja sozinha', id_: '58 anos', tel: '(41) 98444-2211', pass: ['ok', 'Válido até 2028'], acesso: 'ativo', vg: ['lisboa', 'paris', 'roma', 'japao'] },
  { id: 'p15', n: 'Diego Alves', av: 'DA', k: 'a4', fam: 'alves', rel: 'Titular', id_: '33 anos', tel: '(11) 95544-7766', pass: ['warn', 'Não informado'], acesso: 'sem', vg: ['buenos'], niver: '2 dez' },
  { id: 'p16', n: 'Marina Alves', av: 'MA', k: 'a3', fam: 'alves', rel: 'Cônjuge', id_: '31 anos', pass: ['warn', 'Não informado'], acesso: 'sem', vg: ['buenos'] },
  { id: 'p17', n: 'Júlia Pires', av: 'JP', k: 'a3', fam: 'jalapao', rel: 'Organizadora', id_: '41 anos', tel: '(62) 99321-6655', pass: ['ok', 'Não precisa'], acesso: 'ativo', vg: ['jalapao'] },
  { id: 'p18', n: 'Marcos Pires', av: 'MP', k: 'a2', fam: 'jalapao', rel: 'Participante', id_: '43 anos', pass: ['ok', 'Não precisa'], acesso: 'convite', vg: ['jalapao'] }
];
CRM.pessoas = PESSOAS;
const ACESSO = { ativo: ['ok', 'Usa o app'], convite: ['warn', 'Convite enviado'], sem: ['', 'Sem acesso'], menor: ['', 'Menor de idade'] };
const passChip = p => `<span class="chip ${p[0] === 'ok' ? 'ok' : p[0] === 'warn' ? 'warn' : 'bad'}">${p[1]}</span>`;
const famDe = p => PESSOAS.filter(x => p.fam && x.fam === p.fam && x !== p);
const agora = p => { const a = p.vg.map(k => VG[k]).find(v => v.f !== 'feita'); return a ? `<span class="chip ${FASE[a.f][1]}">${a.d} · ${FASE[a.f][0].toLowerCase()}</span>` : '<span class="muted">—</span>'; };

let vista = 'c', sel = 'p1', busca = '', filtro = 'todos';
try { vista = localStorage.getItem('crm-opc-viajantes') || 'c'; } catch (e) {}
const VISTAS = { a: ['Pessoas', 'table'], b: ['Famílias e grupos', 'users-three'], c: ['Lista e perfil', 'sidebar-simple'] };
const visiveis = () => PESSOAS.filter(p => (!busca || (p.n + ' ' + (FAM[p.fam]?.n || '') + ' ' + p.vg.map(k => VG[k].d).join(' ')).toLowerCase().includes(busca))
  && (filtro === 'todos' || (filtro === 'viajando' && p.vg.some(k => VG[k].f === 'prep')) || (filtro === 'neg' && p.vg.some(k => VG[k].f === 'neg')) || (filtro === 'doc' && p.pass[0] !== 'ok')));

function pessoasTabela() {
  return `<table class="tbl rows"><thead><tr><th>Pessoa</th><th>Família ou grupo</th><th>Agora</th><th class="num">Viagens</th><th>Passaporte</th><th>App</th></tr></thead><tbody>
  ${visiveis().map(p => `<tr data-pessoa-id="${p.id}" style="cursor:pointer"><td><span class="row" style="gap:10px"><span class="av sm ${p.k}">${p.av}</span><span>${p.n}<br><small class="muted">${p.rel} · ${p.id_}</small></span></span></td>
    <td class="c2">${p.fam ? FAM[p.fam].n : '<span class="muted">—</span>'}</td><td class="c3">${agora(p)}</td><td class="num c4">${p.vg.length}</td><td class="c5">${passChip(p.pass)}</td>
    <td class="c7"><span class="chip ${ACESSO[p.acesso][0]}">${ACESSO[p.acesso][1]}</span></td></tr>`).join('')}</tbody></table>`;
}

function familias() {
  const ids = [...new Set(visiveis().map(p => p.fam || p.id))];
  return `<div class="clis">${ids.map(f => { const membros = PESSOAS.filter(p => (p.fam || p.id) === f), fa = FAM[f];
    const vgs = [...new Set(membros.flatMap(p => p.vg))].map(k => VG[k]); const at = vgs.find(v => v.f !== 'feita');
    return `<article class="cli card"><header class="stack" style="gap:2px"><span class="mono">${fa ? fa.tp : 'Individual'} · ${membros.length} ${membros.length > 1 ? 'pessoas' : 'pessoa'}</span><b class="h2">${fa ? fa.n : membros[0].n}</b></header>
      <div class="membros">${membros.map(p => `<button type="button" class="membro" data-pessoa-id="${p.id}"><span class="av sm ${p.k}">${p.av}</span><span><b>${p.n.split(' ')[0]}</b><small>${p.rel}</small></span></button>`).join('')}</div>
      ${at ? `<div class="cli__prox">${at.img ? `<img src="img/${at.img}" alt="">` : `<span class="ibox">${ic('airplane-tilt', 'i s')}</span>`}<div><small class="mono">${FASE[at.f][0]}</small><b>${at.d}</b><span class="muted">${at.dt}</span></div></div>` : '<div class="cli__prox cli__prox--vazio"><span class="muted">Nenhuma viagem em andamento</span></div>'}
      <span class="muted" style="font-size:13px">${vgs.length} ${vgs.length > 1 ? 'viagens' : 'viagem'} com a OSV</span>
      <footer class="row" style="gap:8px;flex-wrap:wrap"><button class="btn s" type="button" data-planejar="${membros[0].id}">${ic('plus', 'i s')}Planejar viagem</button><button class="btn s" type="button" data-nova-pessoa="${f}">${ic('user', 'i s')}Adicionar pessoa</button></footer></article>`; }).join('')}</div>`;
}

function perfil(p) {
  const fa = famDe(p), [acT, acN] = ACESSO[p.acesso];
  return `<div class="stack" style="gap:26px">
    <header class="row" style="gap:16px;flex-wrap:wrap"><span class="av ${p.k}" style="width:64px;height:64px;font-size:20px">${p.av}</span>
      <div class="stack" style="gap:4px;flex:1"><span class="mono">${p.fam ? FAM[p.fam].n + ' · ' : ''}${p.rel}</span><h2 class="h1" style="font-size:28px">${p.n}</h2><span class="muted">${p.id_}${p.tel ? ' · ' + p.tel : ''}</span></div>
      ${p.tel ? `<button class="btn s" type="button">${ic('whatsapp-logo', 'i s')}WhatsApp</button>` : ''}<button class="btn p" type="button" data-planejar="${p.id}">${ic('plus', 'i s')}Planejar viagem</button></header>
    <section class="stack" style="gap:8px"><div class="sec-h"><div><h3 class="h2">Viagens</h3></div><span class="muted">${p.vg.length}</span></div>
      ${p.vg.map(k => { const v = VG[k]; return `<a class="trip" href="${v.href || (v.venda ? '#vendas' : '#viagens')}" ${v.venda ? `data-venda="${v.venda}"` : ''}>${v.img ? `<img src="img/${v.img}" alt="">` : `<span class="capa-vazia" style="width:64px;height:48px;border-radius:10px">${ic('globe-hemisphere-west', 'i s')}</span>`}
        <div><b>${v.d}</b><span>${v.dt}</span></div><div class="d"><span class="chip ${FASE[v.f][1]}">${FASE[v.f][0]}</span></div></a>`; }).join('')}</section>
    <div class="two">
      <section class="stack" style="gap:10px"><span class="mono">${p.fam ? FAM[p.fam].tp === 'Grupo' ? 'Grupo' : 'Família' : 'Viaja com'}</span>
        ${fa.length ? fa.map(x => `<button type="button" class="membro membro--l" data-pessoa-id="${x.id}"><span class="av sm ${x.k}">${x.av}</span><span><b>${x.n}</b><small>${x.rel} · ${x.id_}</small></span></button>`).join('') : '<span class="muted">Viaja sozinho</span>'}
        <button class="link" type="button" data-nova-pessoa="${p.fam || ''}" style="align-self:flex-start">${ic('plus', 'i s')} Adicionar pessoa</button></section>
      <section class="stack" style="gap:10px"><span class="mono">Acesso ao app do viajante</span>
        <div class="acesso"><span class="chip ${acT}">${acN}</span>
          <span class="muted">${p.acesso === 'ativo' ? 'Vê as viagens, o roteiro, os documentos e o guia no celular.' : p.acesso === 'menor' ? 'Acompanha pelo acesso dos responsáveis.' : p.acesso === 'convite' ? 'O convite foi enviado e ainda não foi aceito.' : 'Com acesso, a pessoa vê as viagens e o guia no celular.'}</span>
          ${p.acesso === 'sem' || p.acesso === 'convite' ? `<button class="btn s" type="button" data-aviso="Convite enviado para ${esc(p.n)} pelo WhatsApp">${ic('paper-plane-tilt', 'i s')}${p.acesso === 'convite' ? 'Reenviar convite' : 'Convidar para o app'}</button>` : ''}</div></section>
    </div>
    <section class="stack" style="gap:10px"><span class="mono">Documentos e preferências</span>
      <dl class="dados"><dt>Passaporte</dt><dd>${passChip(p.pass)}</dd><dt>CPF</dt><dd class="num">***.456.789-**</dd>${p.niver ? `<dt>Aniversário</dt><dd>${p.niver} ${ic('cake', 'i s')}</dd>` : ''}<dt>Preferências</dt><dd>Assento na janela · sem restrição alimentar</dd></dl></section>
  </div>`;
}

function listaPerfil() {
  const l = visiveis(), p = PESSOAS.find(x => x.id === sel) || l[0];
  return `<div class="md"><div class="md__l">${l.map(x => `<button type="button" class="md__i" data-sel="${x.id}" ${x.id === p.id ? 'aria-current="true"' : ''}><span class="av sm ${x.k}">${x.av}</span><span><b>${x.n}</b><small>${x.fam ? FAM[x.fam].n : x.rel}</small></span></button>`).join('')}</div>
    <div class="md__r">${p ? perfil(p) : ''}</div></div>`;
}

function novaPessoa(fam) {
  CRM.janela(`<form class="form" data-pessoa-nova>
    <div class="sec-h"><div><span class="mono">Viajantes</span><h2 class="h2">Nova pessoa</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="linha"><div class="fld"><label for="np-n">Nome completo</label><input id="np-n" required placeholder="Como está no documento"></div><div class="fld"><label for="np-d">Nascimento</label><input id="np-d" placeholder="dd/mm/aaaa"></div></div>
    <div class="linha"><div class="fld"><label for="np-f">Família ou grupo</label><select id="np-f"><option value="">Nenhum (viaja sozinho)</option>${Object.entries(FAM).map(([k, f]) => `<option value="${k}" ${k === fam ? 'selected' : ''}>${f.n}</option>`).join('')}<option value="nova">Criar nova família ou grupo</option></select></div>
      <div class="fld"><label for="np-r">Relação</label><select id="np-r"><option>Titular</option><option>Cônjuge</option><option>Filha</option><option>Filho</option><option>Amigo</option><option>Participante</option></select></div></div>
    <div class="linha"><div class="fld"><label for="np-w">WhatsApp (opcional para menores)</label><input id="np-w" type="tel" placeholder="(11) 90000-0000"></div><div class="fld"><label for="np-p">Passaporte</label><input id="np-p" placeholder="Número e validade"></div></div>
    <label class="opcao"><input type="checkbox" checked><span>Enviar convite para o app do viajante</span></label>
    <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="submit">Salvar pessoa</button></div></form>`);
}

/* Planejar viagem: escolhe quem vai, a partir da base, e cria a viagem na fase comercial */
function planejar(pid) {
  const p = PESSOAS.find(x => x.id === pid), grupo = p.fam ? PESSOAS.filter(x => x.fam === p.fam) : [p];
  CRM.janela(`<form class="form" data-planejar-form>
    <div class="sec-h"><div><span class="mono">Viagens</span><h2 class="h2">Planejar viagem</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="fld"><span class="lbl">Quem vai viajar</span><div class="chips">${PESSOAS.filter(x => grupo.includes(x) || x === p).map(x => `<label class="opcao opcao--chip"><input type="checkbox" name="quem" value="${x.id}" checked><span>${x.n.split(' ')[0]} · ${x.rel.toLowerCase()}</span></label>`).join('')}
      <button type="button" class="chip" data-aviso="Busque qualquer pessoa da base para incluir">${ic('plus', 'i s')}Outra pessoa da base</button></div></div>
    <div class="linha"><div class="fld"><label for="pl-d">Destino</label><input id="pl-d" required placeholder="Ex.: Lisboa e Porto"></div><div class="fld"><label for="pl-q">Quando</label><input id="pl-q" placeholder="Ex.: julho, 10 dias"></div></div>
    <div class="linha"><div class="fld"><label for="pl-v">Orçamento estimado</label><input id="pl-v" inputmode="numeric" placeholder="R$ 0"></div><div class="fld"><label for="pl-r">Responsável comercial</label><select id="pl-r"><option>Mariana Lopes</option><option>Rafael Lima</option><option>Jéssica Prado</option></select></div></div>
    <p class="muted" style="margin:0;font-size:13px">A viagem começa em Viagens › Comercial, na etapa Novo, já com as pessoas, documentos e preferências da base.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="submit">Criar viagem</button></div></form>`);
}

CRM.telas.viajantes = {
  get larga() { return vista === 'c'; },
  render() {
    const fams = new Set(PESSOAS.map(p => p.fam || p.id)).size;
    return `<div id="vj" class="stack" style="gap:26px">
    <header class="ph"><div><h1 class="h1">Viajantes</h1><p>${PESSOAS.length} pessoas em ${fams} famílias, grupos e individuais · cada pessoa com todas as suas viagens</p></div>
      <button class="btn p" type="button" data-nova-pessoa="">${ic('plus', 'i s')}Nova pessoa</button></header>
    <div class="filtros"><label class="search"><svg class="i s"><use href="#i-magnifying-glass"/></svg><input id="vj-busca" value="${esc(busca)}" placeholder="Nome, família ou destino" aria-label="Buscar viajantes"></label>
      <div class="seg" data-seg-livre role="group" aria-label="Filtro">${[['todos', 'Todos'], ['neg', 'Em negociação'], ['viajando', 'Viajam em breve'], ['doc', 'Documento pendente']].map(([k, t]) => `<button type="button" data-vjf="${k}" aria-pressed="${k === filtro}">${t}</button>`).join('')}</div>
      <span class="sp"></span>${CRM.vistas(VISTAS, vista, 'vj')}</div>
    ${vista === 'a' ? pessoasTabela() : vista === 'b' ? familias() : listaPerfil()}</div>`;
  },
  depois(raiz) {
    const el = raiz.querySelector('#vj');
    el.querySelector('#vj-busca').addEventListener('change', e => { busca = e.target.value.trim().toLowerCase(); CRM.render(); });
    el.addEventListener('click', e => {
      const t = e.target;
      const v = t.closest('[data-opc-vj]'); if (v) { vista = v.dataset.opcVj; try { localStorage.setItem('crm-opc-viajantes', vista); } catch (er) {} CRM.render(); return; }
      const f = t.closest('[data-vjf]'); if (f) { filtro = f.dataset.vjf; CRM.render(); return; }
      const s = t.closest('[data-sel]'); if (s) { sel = s.dataset.sel; CRM.render(); return; }
      const pp = t.closest('[data-pessoa-id]'); if (pp) { sel = pp.dataset.pessoaId; vista = 'c'; try { localStorage.setItem('crm-opc-viajantes', 'c'); } catch (er) {} CRM.render(); return; }
    });
  }
};
CRM.telas.clientes = { render() { setTimeout(() => { location.hash = '#viajantes'; }); return ''; } };

document.addEventListener('click', e => {
  const n = e.target.closest('[data-nova-pessoa]'); if (n) { e.preventDefault(); CRM.fechar(); novaPessoa(n.dataset.novaPessoa); return; }
  const pl = e.target.closest('[data-planejar]'); if (pl) { planejar(pl.dataset.planejar); }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.matches('[data-pessoa-nova]')) {
    e.preventDefault(); const n = f.querySelector('#np-n').value.trim(), fam = f.querySelector('#np-f').value;
    PESSOAS.push({ id: 'p' + Date.now(), n: esc(n), av: n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(), k: 'a2', fam: FAM[fam] ? fam : null, rel: f.querySelector('#np-r').value, id_: 'Idade a confirmar', tel: esc(f.querySelector('#np-w').value), pass: ['warn', 'Não informado'], acesso: 'convite', vg: [] });
    sel = PESSOAS[PESSOAS.length - 1].id; CRM.fechar(); if (location.hash !== '#viajantes') location.hash = '#viajantes'; else CRM.render(); CRM.aviso(n + ' cadastrada na base');
  }
  if (f.matches('[data-planejar-form]')) {
    e.preventDefault(); const quem = [...f.querySelectorAll('input[name=quem]:checked')].map(i => PESSOAS.find(p => p.id === i.value));
    const d = esc(f.querySelector('#pl-d').value.trim()), tit = quem[0];
    (CRM.vendas || []).unshift({ id: 'n' + Date.now(), c: tit.fam ? FAM[tit.fam].n : tit.n, av: tit.av, k: tit.k, d, q: esc(f.querySelector('#pl-q').value) || 'Datas a definir', pax: quem.length + (quem.length > 1 ? ' pessoas' : ' pessoa'), v: parseInt(f.querySelector('#pl-v').value.replace(/\D/g, '')) || 0, e: 'novo', sc: 0, nx: { t: 'Primeiro contato', q: 'Hoje' }, o: 'Base de viajantes', tp: 'Lazer', criada: '24 nov' });
    CRM.fechar(); location.hash = '#vendas'; CRM.aviso(`Viagem para ${d} criada com ${quem.length} ${quem.length > 1 ? 'pessoas' : 'pessoa'}`);
  }
});
}
