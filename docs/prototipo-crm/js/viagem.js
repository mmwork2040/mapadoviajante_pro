/* Página da viagem: roteiro dia a dia, checklist, financeiro e documentos. Um assistente só. Dados de exemplo. */
{
const ic = CRM.ic;
const TIPOS = {
  voo: { t: 'Voo', ic: 'airplane-takeoff' }, hotel: { t: 'Hospedagem', ic: 'bed' }, ativ: { t: 'Atividade', ic: 'map-pin' },
  transfer: { t: 'Transfer', ic: 'van' }, rest: { t: 'Restaurante', ic: 'fork-knife' }
};
const DIAS = [
  { t: 'Chegada', dt: 'Sáb, 12 dez', it: [
    { h: '06:40', tp: 'voo', t: 'São Paulo → Fernando de Noronha', s: 'Azul · GRU 06:40 → FEN 12:05 · conexão em Recife', v: 'Milhas', ok: 1 },
    { h: '12:30', tp: 'transfer', t: 'Aeroporto → Pousada', s: 'Transfer privativo · 4 pessoas', v: 'R$ 180', ok: 1 },
    { h: '14:00', tp: 'hotel', t: 'Pousada Mar de Dentro', s: '7 noites · 2 quartos família · café incluso', v: 'R$ 11.900', ok: 1 },
    { h: '17:30', tp: 'ativ', t: 'Pôr do sol no Forte do Boldró', s: 'Ir 30 min antes para pegar lugar', v: '' },
    { h: '20:00', tp: 'rest', t: 'Jantar no Mergulhão', s: 'Reserva para 4 · pedir mesa no deck', v: '~R$ 600', ok: 1 }
  ] },
  { t: 'Ilha toda', dt: 'Dom, 13 dez', it: [
    { h: '08:00', tp: 'ativ', t: 'Ilhatour', s: 'Passeio guiado pelos principais mirantes e praias', v: 'R$ 720', ok: 1 },
    { h: '16:00', tp: 'ativ', t: 'Praia do Sancho', s: 'Descida pela escada na fenda · levar água', v: '' }
  ] },
  { t: 'Mar', dt: 'Seg, 14 dez', it: [
    { h: '09:00', tp: 'ativ', t: 'Mergulho de batismo', s: 'Crianças a partir de 10 anos · Lia pode, Tom acompanha no barco', v: 'R$ 1.100', ok: 1 },
    { h: '15:00', tp: 'ativ', t: 'Baía dos Porcos', s: 'Ir na maré baixa (consultar tábua)', v: '' }
  ] },
  { t: 'Barco', dt: 'Ter, 15 dez', it: [{ h: '09:30', tp: 'ativ', t: 'Passeio de barco até a Ponta da Sapata', s: 'Golfinhos rotadores pela manhã', v: 'R$ 640', ok: 1 }] },
  { t: 'Atalaia', dt: 'Qua, 16 dez', it: [{ h: '08:00', tp: 'ativ', t: 'Trilha do Atalaia', s: 'Agendamento no ICMBio ainda pendente', v: '', pend: 1 }] },
  { t: 'Dia livre', dt: 'Qui, 17 dez', it: [] },
  { t: 'Volta', dt: 'Sex, 18 dez', it: [
    { h: '11:00', tp: 'hotel', t: 'Check-out da pousada', s: 'Guardar malas na recepção', v: '' },
    { h: '14:20', tp: 'voo', t: 'Fernando de Noronha → São Paulo', s: 'Azul · FEN 14:20 → GRU 21:10', v: 'Milhas', ok: 1 }
  ] }
];
const CHECK = [
  { g: 'Documentos', it: [['Documento de identidade de todos', 1], ['Taxa de preservação ambiental paga', 1]] },
  { g: 'Reservas', it: [['Passagens emitidas', 1], ['Pousada confirmada', 1], ['Ilhatour agendado', 1], ['Mergulho reservado', 1], ['Jantar no Mergulhão reservado', 1], ['Trilha do Atalaia agendada no ICMBio', 0, '30 nov']] },
  { g: 'Seguro e pagamentos', it: [['Seguro viagem emitido', 0, 'Hoje', 1], ['Ingresso do parque nacional pago', 1], ['Pagamento final recebido', 1]] },
  { g: 'Antes do embarque', it: [['Check-in online dos voos', 0, '10 dez']] }
];
const GASTOS = [
  ['Passagens', 'Milhas Smiles + taxas', 2480, 9800], ['Hospedagem', 'Cartão', 11900, 0], ['Passeios', 'Pix', 2460, 0],
  ['Taxa ambiental e parque', 'Pix', 2150, 0], ['Transfers', 'Pix', 360, 0], ['Seguro viagem', 'A pagar', 0, 0]
];
const DOCS = [['Passagens ida e volta', 'PDF · 2 páginas', 'file-pdf'], ['Voucher da pousada', 'PDF · 1 página', 'file-pdf'], ['Comprovante da taxa ambiental', 'PDF · 4 páginas', 'file-pdf'], ['Ilhatour e mergulho', 'Imagem', 'images']];
const brl = v => 'R$ ' + v.toLocaleString('pt-BR');
let dia = 0, aba = 'rot';

function itens(d) {
  if (!d.it.length) return `<div class="empty">${ic('suitcase-rolling')}<b>Dia livre</b>Adicione um passeio ou peça sugestões ao assistente.<button class="btn s" type="button" data-assist>${ic('sparkle', 'i s')}Sugerir o que fazer</button></div>`;
  return `<ol class="roteiro">${d.it.map((x, i) => `<li><button type="button" class="ritem" data-item="${i}">
    <time>${x.h}</time><span class="ibox">${ic(TIPOS[x.tp].ic, 'i s')}</span>
    <span class="ritem__b"><small class="mono">${TIPOS[x.tp].t}</small><b>${x.t}</b><span>${x.s}</span></span>
    <span class="ritem__v">${x.pend ? '<span class="chip warn">Pendente</span>' : x.ok ? `<span class="chip ok">${ic('check', 'i s')}Reservado</span>` : ''}${x.v ? `<small class="num">${x.v}</small>` : ''}</span></button></li>`).join('')}</ol>`;
}

function roteiro() {
  const d = DIAS[dia];
  return `<div class="rot">
    <nav class="dias" aria-label="Dias">${DIAS.map((x, i) => `<button type="button" data-dia="${i}" ${i === dia ? 'aria-current="true"' : ''}><b>Dia ${i + 1}</b><span>${x.dt}</span><small>${x.it.length ? x.it.length + (x.it.length > 1 ? ' itens' : ' item') : 'Livre'}</small></button>`).join('')}
      <button type="button" class="dias__add">${ic('plus', 'i s')}Dia</button></nav>
    <section class="stack" style="gap:16px">
      <div class="sec-h"><div><span class="mono">Dia ${dia + 1} · ${d.dt}</span><h2 class="h2">${d.t}</h2></div>
        <button class="mini" type="button" data-dia="${Math.max(0, dia - 1)}" aria-label="Dia anterior">${ic('caret-left', 'i s')}</button><button class="mini" type="button" data-dia="${Math.min(DIAS.length - 1, dia + 1)}" aria-label="Próximo dia">${ic('caret-right', 'i s')}</button></div>
      ${itens(d)}
      <div class="add"><span class="muted">Adicionar ao dia</span>${Object.entries(TIPOS).map(([k, t]) => `<button class="chip" type="button" data-add="${k}">${ic(t.ic, 'i s')}${t.t}</button>`).join('')}</div>
    </section></div>`;
}

function checklist() {
  const tot = CHECK.flatMap(g => g.it), feitos = tot.filter(i => i[1]).length;
  return `<div class="stack" style="gap:26px">
    <div class="row" style="gap:16px"><span class="bar" style="flex:1"><i style="width:${feitos / tot.length * 100}%"></i></span><b class="num">${feitos} de ${tot.length}</b></div>
    ${CHECK.map((g, gi) => `<section class="stack" style="gap:2px"><div class="sec-h"><div><h3 class="h3">${g.g}</h3></div><span class="muted num">${g.it.filter(i => i[1]).length}/${g.it.length}</span></div>
      ${g.it.map((i, ii) => `<div class="inrow"><button type="button" class="tick${i[1] ? ' on' : ''}" data-ck="${gi}-${ii}" aria-pressed="${!!i[1]}" aria-label="${i[0]}">${i[1] ? ic('check', 'i s') : ''}</button>
        <div><span style="${i[1] ? 'color:var(--tm);text-decoration:line-through' : ''}">${i[0]}</span></div>
        ${i[1] ? '' : `<span class="${i[3] ? 'late' : 'muted'}">${i[3] ? ic('warning', 'i s') : ic('calendar-blank', 'i s')}${i[2]}</span>`}</div>`).join('')}</section>`).join('')}
    <button class="link" type="button" style="align-self:flex-start">${ic('plus', 'i s')} Adicionar item</button></div>`;
}

function financeiro() {
  const gasto = GASTOS.reduce((s, g) => s + g[2], 0), eco = GASTOS.reduce((s, g) => s + g[3], 0), orc = 31200;
  return `<div class="stack" style="gap:26px">
    <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="kpi"><span class="mono">Orçamento do cliente</span><b>${brl(orc)}</b></div>
      <div class="kpi"><span class="mono">Gasto até agora</span><b>${brl(gasto)}</b><span class="delta">Saldo de ${brl(orc - gasto)}</span></div>
      <div class="kpi"><span class="mono">Economia gerada</span><b>${brl(eco)}</b><span class="delta up">${ic('arrow-up-right', 'i s')} com milhas</span></div>
    </div>
    <div class="meter ok"><span>Uso do orçamento</span><span class="v">${Math.round(gasto / orc * 100)}%</span><span class="t"><i style="width:${gasto / orc * 100}%"></i></span></div>
    <div class="sec-h"><div><h3 class="h2">Gastos</h3></div><button class="btn s" type="button">${ic('plus', 'i s')}Adicionar gasto</button></div>
    <table class="tbl"><thead><tr><th>Item</th><th>Pago com</th><th class="num">Valor</th><th class="num">Economia</th></tr></thead><tbody>
      ${GASTOS.map(g => `<tr><td>${g[0]}</td><td>${g[1] === 'A pagar' ? '<span class="chip warn">A pagar</span>' : g[1]}</td><td class="num">${g[2] ? brl(g[2]) : '—'}</td><td class="num" style="color:${g[3] ? 'var(--ok)' : 'var(--tm)'}">${g[3] ? brl(g[3]) : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function documentos() {
  return `<div class="stack" style="gap:16px">
    <div>${DOCS.map(d => `<div class="inrow"><span class="ibox">${ic(d[2], 'i s')}</span><div><b style="font-weight:600">${d[0]}</b><span class="muted">${d[1]}</span></div><button class="mini" type="button" aria-label="Baixar ${d[0]}">${ic('download-simple', 'i s')}</button></div>`).join('')}</div>
    <label class="soltar">${ic('upload-simple')}<b>Solte arquivos aqui</b><span class="muted">Vouchers, passagens, seguros. PDF ou imagem.</span><input type="file" multiple class="sr"></label></div>`;
}

const ckN = () => { const t = CHECK.flatMap(g => g.it); return [t.filter(i => i[1]).length, t.length]; };
function guia() {
  return `<div class="stack" style="gap:22px">
    <div class="tip">${ic('map-pin')}<div><b>O guia é o roteiro final que a família leva na viagem</b><br><span class="muted">Ele é gerado a partir do roteiro, do checklist e dos documentos desta viagem, seguindo a skill de guias da OSV. A consultora revisa antes de enviar.</span></div></div>
    <section class="stack" style="gap:2px"><span class="mono">O que o guia terá</span>${[['map-pin', 'Roteiro dia a dia', 'Horários, endereços e o que levar em cada passeio'], ['airplane-takeoff', 'Voos e reservas', 'Localizadores, check-in e vouchers num lugar só'], ['star', 'Dicas da OSV', 'Melhor horário, onde comer, o que evitar'], ['clipboard-text', 'Antes de embarcar', 'Documentos, bagagem e check-in online'], ['phone', 'Contatos', 'Consultora, pousada, guia local e seguro viagem']].map(([i, t, d]) => `<div class="inrow"><span class="ibox">${ic(i, 'i s')}</span><div><b style="font-weight:600">${t}</b><span class="muted">${d}</span></div></div>`).join('')}</section>
    <div class="empty"><b>Aguardando a skill de guias</b>Quando ela chegar, este botão gera o guia completo no padrão da OSV, em página para o celular e em PDF.<button class="btn s" type="button" disabled>${ic('sparkle', 'i s')}Gerar guia</button></div></div>`;
}
const ABAS = { rot: ['Roteiro', roteiro], ck: ['Checklist', checklist], fin: ['Financeiro', financeiro], doc: ['Documentos · 4', documentos], guia: ['Guia', guia] };

function assistente() {
  CRM.painel(`<div class="ficha__top"><span class="mono">Assistente da viagem</span><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <h2 class="h1" style="font-size:28px">O que você precisa nesta viagem?</h2>
    <div class="thaybar"><input placeholder="Ex.: sugira um restaurante para o dia 6" aria-label="Pedir ao assistente"><span class="spark">${ic('paper-plane-tilt', 'i s')}</span></div>
    <div class="stack" style="gap:8px">${[
      ['sparkle', 'Completar dias vazios', 'Sugere passeios para o Dia 6 com base no perfil da família'],
      ['upload-simple', 'Ler um documento', 'Envie um voucher ou roteiro em PDF e os itens entram nos dias certos'],
      ['bed', 'Comparar hospedagens', 'Opções por faixa de preço, bairro e estrelas'],
      ['check-square', 'Revisar o que falta', 'Confere checklist, horários e reservas pendentes']
    ].map(o => `<button type="button" class="tip assist-op">${ic(o[0])}<div><b>${o[1]}</b><br><span class="muted">${o[2]}</span></div>${ic('caret-right', 'i s')}</button>`).join('')}</div>
    <p class="muted" style="margin:0">Tudo que o assistente sugere entra como rascunho. Você revisa antes de ir para o roteiro.</p>`);
}

function editar(i) {
  const x = DIAS[dia].it[i];
  CRM.painel(`<div class="ficha__top"><span class="mono">Dia ${dia + 1} · ${TIPOS[x.tp].t}</span><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <form class="form" data-salvar-item>
      <div class="fld"><label for="it-t">Título</label><input id="it-t" value="${x.t}"></div>
      <div class="linha"><div class="fld"><label for="it-h">Horário</label><input id="it-h" value="${x.h}"></div><div class="fld"><label for="it-v">Valor</label><input id="it-v" value="${x.v}"></div></div>
      <div class="fld"><label for="it-s">Detalhes</label><textarea id="it-s" rows="3">${x.s}</textarea></div>
      <label class="opcao"><input type="checkbox" ${x.ok ? 'checked' : ''}><span>Reservado e confirmado</span></label>
      <div class="fld"><span class="lbl">Fotos e anexos</span><label class="soltar soltar--peq">${ic('upload-simple', 'i s')}<span>Adicionar foto ou voucher</span><input type="file" class="sr"></label></div>
      <div class="row" style="justify-content:space-between"><button class="link perder" type="button">${ic('trash', 'i s')} Excluir item</button><button class="btn p" type="submit">Salvar</button></div>
    </form>`);
}

CRM.telas.viagem = {
  menu: 'viagens',
  render() {
    return `<div id="vg" class="stack" style="gap:26px"><a class="link" href="#viagens">${ic('arrow-left', 'i s')} Viagens</a>
    <div class="phero"><img src="img/viagem-noronha.jpg" alt=""><span class="phero-shade"></span>
      <div class="phero-in">
        <div class="stack" style="flex:6 1 320px;gap:12px"><span class="chip ok" style="align-self:flex-start">${ic('check', 'i s')}Roteiro aprovado pela família</span>
          <h1 class="h1" style="color:#fafaf9;font-size:40px">Fernando de Noronha</h1>
          <p style="margin:0;color:#cfc7be">Família Souza · 12 a 19 dez · 7 noites · 4 pessoas</p>
          <a class="link" href="#viajantes" style="color:#fafaf9">Cláudia, Roberto, Lia e Tom · ver viajantes →</a></div>
        <div class="float"><span class="mono">Embarque em</span><b class="h1 num" style="font-size:44px">18 dias</b>
          <span class="bar"><i style="width:${ckN()[0] / ckN()[1] * 100}%"></i></span><span class="muted">Checklist ${ckN()[0]} de ${ckN()[1]}${CHECK[2].it[0][1] ? '' : ' · seguro viagem vence hoje'}</span>
          <div class="row" style="flex-wrap:wrap"><button class="btn p" type="button" data-enviar>${ic('share-network', 'i s')}Enviar ao cliente</button><button class="btn s" type="button">${ic('file-pdf', 'i s')}PDF</button></div></div>
      </div></div>
    <div class="abas-v"><div class="tabs" role="tablist">${Object.entries(ABAS).map(([k, a]) => `<button role="tab" type="button" data-vaba="${k}" aria-selected="${k === aba}">${a[0]}${k === 'ck' ? ' · ' + ckN().join('/') : ''}</button>`).join('')}</div>
      <button class="btn s assist" type="button" data-assist>${ic('sparkle', 'i s')}Assistente</button></div>
    <div id="vconteudo">${ABAS[aba][1]()}</div></div>`;
  },
  depois(raiz) {
    const el = raiz.querySelector('#vg');
    el.addEventListener('click', e => {
      const t = e.target;
      const a = t.closest('[data-vaba]'); if (a) { aba = a.dataset.vaba; CRM.render(); return; }
      const d = t.closest('[data-dia]'); if (d) { dia = +d.dataset.dia; el.querySelector('#vconteudo').innerHTML = roteiro(); return; }
      const it = t.closest('[data-item]'); if (it) { editar(+it.dataset.item); return; }
      const ad = t.closest('[data-add]'); if (ad) { DIAS[dia].it.push({ h: '--:--', tp: ad.dataset.add, t: 'Novo item: ' + TIPOS[ad.dataset.add].t.toLowerCase(), s: 'Toque para preencher', v: '' }); el.querySelector('#vconteudo').innerHTML = roteiro(); editar(DIAS[dia].it.length - 1); return; }
      const ck = t.closest('[data-ck]'); if (ck) { const [g, i] = ck.dataset.ck.split('-'); CHECK[g].it[i][1] = CHECK[g].it[i][1] ? 0 : 1; CRM.render(); return; }
      if (t.closest('[data-assist]')) { assistente(); return; }
      if (t.closest('[data-enviar]')) {
        CRM.janela(`<div class="sec-h"><div><h2 class="h2">Enviar o roteiro para a família Souza</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
          <p class="muted" style="margin:0">O cliente abre o roteiro pelo link, sem senha, e vê sempre a versão mais nova.</p>
          <div class="search" style="width:100%">${ic('link-simple', 'i s')}<input readonly value="osv.app/viagem/noronha-souza" aria-label="Link do roteiro"><button class="btn s" type="button" data-copiar>${ic('copy', 'i s')}Copiar</button></div>
          <div class="row" style="justify-content:flex-end;flex-wrap:wrap"><button class="btn s" type="button">${ic('file-pdf', 'i s')}Baixar PDF</button><button class="btn p" type="button" data-fechar>${ic('whatsapp-logo', 'i s')}Enviar no WhatsApp</button></div>`);
      }
    });
  }
};

document.addEventListener('submit', e => {
  if (e.target.matches('[data-salvar-item]')) {
    e.preventDefault();
    const f = e.target, x = DIAS[dia].it;
    const it = x.find(i => i.t === f.querySelector('#it-t').defaultValue) || x[x.length - 1];
    it.t = f.querySelector('#it-t').value; it.h = f.querySelector('#it-h').value; it.v = f.querySelector('#it-v').value; it.s = f.querySelector('#it-s').value;
    it.ok = f.querySelector('input[type=checkbox]').checked ? 1 : 0;
    x.sort((a, b) => a.h.localeCompare(b.h));
    CRM.fechar(); CRM.render(); CRM.aviso('Item salvo no roteiro');
  }
});
document.addEventListener('click', e => {
  if (e.target.closest('[data-copiar]')) { try { navigator.clipboard.writeText('osv.app/viagem/noronha-souza'); } catch (err) {} CRM.aviso('Link copiado'); }
  if (e.target.closest('.assist-op')) { CRM.fechar(); CRM.aviso('O assistente está preparando um rascunho'); }
});
}
