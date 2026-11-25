/* Jornada comercial: proposta → contrato → pagamento → roteiro e guia.
   Lado da consultora (#proposta) e lado do cliente (#proposta-cliente, #contrato-cliente). Dados de exemplo. */
{
const ic = CRM.ic;
const brl = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

/* Estado da jornada da venda de exemplo (Carla Mendes · Orlando) */
const J = CRM.jornada = { proposta: 'rascunho', vistas: 0, escolha: null, contrato: 'nao', pagamento: 'nao', guia: 'nao' };
const P = {
  cliente: 'Carla Mendes', familia: 'Carla, Pedro, Ana (9) e João (6)', destino: 'Orlando', datas: '2 a 12 de fevereiro de 2027', noites: 10,
  msg: 'Carla, montamos duas opções para a viagem da família a Orlando. As duas usam as milhas que vocês já têm e deixam os parques perto do hotel.',
  opcoes: [
    { n: 'Essencial', h: 'Hotel parceiro Disney · 4 estrelas', it: ['Voos GRU → MCO com milhas Smiles + taxas', '10 noites, quarto família', 'Ingressos de 4 dias nos parques Disney', 'Carro alugado por 10 dias', 'Seguro viagem para 4'], v: 32400, eco: 9800 },
    { n: 'Conforto', h: 'Hotel dentro do complexo Disney', it: ['Voos GRU → MCO com milhas Smiles + taxas', '10 noites, suíte família', 'Ingressos de 6 dias, Disney e Universal', 'Transporte do hotel aos parques', 'Seguro viagem para 4', 'Um jantar com personagens'], v: 41900, eco: 11200, rec: 1 }
  ],
  pag: ['Pix à vista com 5% de desconto', 'Cartão em até 10x sem juros', 'Entrada de 30% e o restante até 30 dias antes'],
  validade: '1 de dezembro'
};
let pagSel = [1, 1, 1];
P.termos = CRM.novosTermos('pacote');

const ETAPAS = [['proposta', 'Proposta', 'file-text'], ['contrato', 'Contrato', 'pencil-simple'], ['pagamento', 'Pagamento', 'currency-circle-dollar'], ['guia', 'Roteiro e guia', 'map-pin']];
function estadoEtapa(k) {
  if (k === 'proposta') return J.proposta === 'aceita' ? ['ok', `Aceita · opção ${J.escolha}`] : J.proposta === 'enviada' ? ['now', J.vistas ? `Visualizada ${J.vistas}x` : 'Enviada'] : ['', 'Rascunho'];
  if (k === 'contrato') return J.contrato === 'assinado' ? ['ok', 'Assinado'] : J.contrato === 'enviado' ? ['now', 'Aguardando assinatura'] : ['', J.proposta === 'aceita' ? 'Pronto para enviar' : 'Depois do aceite'];
  if (k === 'pagamento') return J.pagamento === 'pago' ? ['ok', 'Entrada recebida'] : J.contrato === 'assinado' ? ['now', 'Link enviado'] : ['', 'Depois do contrato'];
  return J.guia === 'enviado' ? ['ok', 'Enviado'] : J.pagamento === 'pago' ? ['now', 'Montar com a skill de guias'] : ['', 'Depois do pagamento'];
}
const jornada = (compacta) => `<ol class="jornada${compacta ? ' jornada--c' : ''}">${ETAPAS.map(([k, t, i], n) => { const [st, tx] = estadoEtapa(k);
  return `<li class="${st}"><span class="jornada__n">${st === 'ok' ? ic('check', 'i s') : n + 1}</span><div><b>${t}</b><small>${tx}</small></div></li>`; }).join('')}</ol>`;
CRM.jornadaHtml = jornada;

/* ── Página do cliente: a proposta ── */
function propostaCliente() {
  const op = P.opcoes;
  return `<div class="cli-pg">
  <header class="cli-top"><img class="logo-dark" src="img/logo-branco.svg" alt="O Segredo do Viajante"><img class="logo-light" src="img/logo-preto.svg" alt="O Segredo do Viajante"><span class="muted">Proposta para ${P.cliente}</span></header>
  <section class="cli-hero"><div class="cli-hero__foto" aria-hidden="true"><span>${P.destino}</span></div>
    <div class="cli-hero__t"><span class="mono">Sua próxima viagem</span><h1 class="h1">${P.destino} em família</h1><p>${P.datas} · ${P.noites} noites · ${P.familia}</p></div></section>
  <p class="cli-msg">${esc(P.msg)}<br><span class="muted">Mariana Lopes · sua consultora</span></p>
  <section class="stack" style="gap:16px"><h2 class="h2">Escolha a sua opção</h2>
    <div class="ops">${op.map(o => `<article class="op card${o.rec ? ' lv3' : ''}${J.escolha === o.n ? ' sel' : ''}">
      ${o.rec ? '<span class="mono" style="color:var(--acct)">A que recomendamos</span>' : '<span class="mono">Opção</span>'}
      <h3 class="h2">${o.n}</h3><span class="muted">${o.h}</span>
      <ul class="op__it">${o.it.map(t => `<li>${ic('check', 'i s')}${t}</li>`).join('')}</ul>
      <div class="op__v"><b class="num">${brl(o.v)}</b><span class="muted">para a família toda</span><span class="ok">${ic('arrow-up-right', 'i s')} ${brl(o.eco)} de economia com milhas</span></div>
      ${J.proposta === 'aceita' ? (J.escolha === o.n ? '<span class="chip ok">' + ic('check', 'i s') + 'Escolhida</span>' : '') : `<button class="btn ${o.rec ? 'p' : 's'}" type="button" data-aceitar="${o.n}">Quero a opção ${o.n}</button>`}
    </article>`).join('')}</div></section>
  ${CRM.termosCliente(P.termos)}
  <section class="two"><div class="stack" style="gap:10px"><h2 class="h2">Como pagar</h2>${P.pag.filter((_, i) => pagSel[i]).map(p => `<span class="row" style="gap:10px">${ic('check', 'i s')}${p}</span>`).join('')}</div>
    <div class="stack" style="gap:10px"><h2 class="h2">Bom saber</h2><span class="row" style="gap:10px">${ic('clock', 'i s')}Valores garantidos até ${P.validade}</span><span class="row" style="gap:10px">${ic('lock-simple', 'i s')}Contrato e pagamento por aqui, com segurança</span><span class="row" style="gap:10px">${ic('whatsapp-logo', 'i s')}Dúvidas? Fale com a Mariana no WhatsApp</span></div></section>
  ${J.proposta === 'aceita' ? `<section class="card lv3 focus"><span class="ibox">${ic('pencil-simple')}</span><div><span class="mono" style="color:var(--acct)">Próximo passo</span><b class="h3">Assinar o contrato da opção ${J.escolha}</b><p>Leva 2 minutos. Depois você escolhe a forma de pagamento.</p></div><a class="btn p" href="#contrato-cliente">Ver e assinar</a></section>` : ''}
  <p class="proto" style="text-align:center">Assim o cliente vê a proposta pelo link · protótipo · <a class="link" href="#proposta">voltar para a visão da consultora</a></p></div>`;
}

/* ── Página do cliente: contrato e pagamento ── */
function contratoCliente() {
  const o = P.opcoes.find(x => x.n === (J.escolha || 'Conforto'));
  const assinado = J.contrato === 'assinado';
  return `<div class="cli-pg">
  <header class="cli-top"><img class="logo-dark" src="img/logo-branco.svg" alt="O Segredo do Viajante"><img class="logo-light" src="img/logo-preto.svg" alt="O Segredo do Viajante"><span class="muted">Contrato · ${P.cliente}</span></header>
  ${jornada(1)}
  <section class="stack" style="gap:8px"><span class="mono">Contrato de prestação de serviços de viagem</span><h1 class="h1">${P.destino} · opção ${o.n}</h1><p class="muted" style="margin:0">${P.datas} · ${P.familia}</p></section>
  <dl class="dados"><dt>Contratante</dt><dd>Carla Mendes · CPF ***.456.789-**</dd><dt>Agência</dt><dd>O Segredo do Viajante</dd><dt>Valor total</dt><dd class="num">${brl(o.v)}</dd><dt>Inclui</dt><dd>${o.it.join(' · ')}</dd></dl>
  <div class="clausulas">${[['Serviços contratados', 'Organização da viagem conforme a opção escolhida. Incluso: ' + P.termos.sec.inc.join('; ') + '.'], ['O que não está incluso', P.termos.sec.nao.join('; ') + '.'], ['Responsabilidades do contratante', P.termos.sec.cli.join('; ') + '.'], ['Responsabilidades da agência', P.termos.sec.osv.join('; ') + '.'], ['Assistência · nível ' + P.termos.nivel, P.termos.resumo + '. ' + P.termos.sec.ass.join('; ') + '.'], ['Pagamento', 'Conforme a forma escolhida abaixo. Valores garantidos até ' + P.validade + '.'], ['Cancelamento e alterações', 'Seguem as regras de cada fornecedor (companhia aérea, hotel, parques), informadas antes de cada emissão.']].map(([t, d], n) => `<details ${n ? '' : 'open'}><summary>${ic('caret-right', 'i s')}${n + 1}. ${t}</summary><p>${d}</p></details>`).join('')}
    <p class="muted" style="font-size:13px;margin:6px 0 0">As cláusulas usam os termos da proposta. O texto jurídico completo vem do modelo de contrato da agência.</p></div>
  ${assinado ? `<section class="stack" style="gap:16px"><div class="tip">${ic('check')}<div><b>Contrato assinado por Carla Mendes</b><br><span class="muted">Hoje, ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · uma cópia foi para o seu e-mail</span></div></div>
    <h2 class="h2">Pagamento</h2>
    ${J.pagamento === 'pago' ? `<div class="card lv3 focus"><span class="ibox">${ic('airplane-tilt')}</span><div><span class="mono" style="color:var(--acct)">Tudo certo</span><b class="h3">Entrada recebida. Agora é com a gente.</b><p>A Mariana emite as passagens e as reservas. Seu roteiro completo e o guia da viagem chegam aqui e no WhatsApp antes do embarque.</p></div></div>`
      : `<div class="opcoes">${['Pix à vista · ' + brl(o.v * .95), 'Cartão em até 10x de ' + brl(o.v / 10), 'Entrada de ' + brl(o.v * .3) + ' e o restante até 30 dias antes'].map((t, n) => `<label class="opcao"><input type="radio" name="pg" ${n ? '' : 'checked'}><span>${t}</span></label>`).join('')}</div>
      <button class="btn p" type="button" data-pagar style="align-self:flex-start">${ic('lock-simple', 'i s')}Pagar com segurança</button>`}</section>`
  : `<form class="stack" style="gap:14px" data-assinar><div class="fld"><label for="ass-n">Assine digitando seu nome completo</label><input id="ass-n" required value="Carla Mendes" class="assinatura"></div>
    <label class="opcao"><input type="checkbox" required checked><span>Li e concordo com o contrato</span></label>
    <button class="btn p" type="submit" style="align-self:flex-start">${ic('pencil-simple', 'i s')}Assinar contrato</button></form>`}
  <p class="proto" style="text-align:center">Assim o cliente vê o contrato · protótipo · <a class="link" href="#proposta">voltar para a visão da consultora</a></p></div>`;
}

/* ── Lado da consultora: montar e acompanhar ── */
function editor() {
  return `<div id="pp" class="stack" style="gap:26px">
  <a class="link" href="#vendas">${ic('arrow-left', 'i s')} Viagens · comercial</a>
  <header class="ph"><div><span class="mono">Carla Mendes · Orlando · ${J.contrato === 'assinado' ? 'Fechado' : 'Negociando'}</span><h1 class="h1">Proposta, contrato e guia</h1><p>Monte a proposta, acompanhe a visualização e siga até o guia final, tudo daqui.</p></div></header>
  ${jornada()}
  <div class="pp">
    <div class="stack" style="gap:26px">
      ${J.proposta === 'aceita' ? `<section class="card lv3 focus"><span class="ibox">${ic('check')}</span><div><span class="mono" style="color:var(--acct)">Proposta aceita</span><b class="h3">Carla escolheu a opção ${J.escolha}</b><p>${J.contrato === 'assinado' ? (J.pagamento === 'pago' ? 'Contrato assinado e entrada recebida. Hora de emitir e montar o guia.' : 'Contrato assinado. Aguardando o pagamento.') : 'O contrato já foi gerado com os dados da proposta.'}</p></div>
        ${J.contrato === 'nao' ? `<button class="btn p" type="button" data-enviar-contrato>Enviar contrato</button>` : J.pagamento === 'pago' ? `<button class="btn p" type="button" data-aviso="A geração do guia entra quando a skill de guias chegar">Montar guia</button>` : `<a class="btn s" href="#contrato-cliente">Ver como cliente</a>`}</section>` : ''}
      <section class="stack" style="gap:12px"><div class="sec-h"><div><h2 class="h2">Abertura</h2></div></div>
        <div class="fld"><label for="pp-m">Mensagem para a cliente</label><textarea id="pp-m" rows="3">${esc(P.msg)}</textarea></div>
        <div class="linha"><div class="fld"><label for="pp-d">Datas</label><input id="pp-d" value="${P.datas}"></div><div class="fld"><label for="pp-f">Foto da capa</label><button class="btn s" type="button" style="min-height:46px">${ic('images', 'i s')}Escolher na biblioteca</button></div></div></section>
      <section class="stack" style="gap:12px"><div class="sec-h"><div><h2 class="h2">Opções</h2></div><button class="link" type="button">${ic('plus', 'i s')} Opção</button></div>
        ${P.opcoes.map((o, n) => `<div class="op-ed"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><b class="h3">${o.n}${o.rec ? ' <span class="chip now">Recomendada</span>' : ''}</b><span class="num" style="font:700 18px var(--fd)">${brl(o.v)}</span></div>
          <span class="muted">${o.h} · ${o.it.length} itens · economia de ${brl(o.eco)}</span>
          <div class="row" style="flex-wrap:wrap"><button class="btn s" type="button">${ic('pencil-simple', 'i s')}Editar itens</button><button class="btn s" type="button" data-assist-prop>${ic('sparkle', 'i s')}Completar com a biblioteca</button></div></div>`).join('')}</section>
      <section class="stack" style="gap:12px"><div class="sec-h"><div><h2 class="h2">Termos da proposta</h2></div></div>
        <div class="fld"><span class="lbl">Tipo de serviço</span><div class="chips">${Object.entries(CRM.modelosProposta).map(([k, m]) => `<button type="button" class="chip tipo-s" data-tipo="${k}" aria-pressed="${k === P.termos.tipo}">${m.n}</button>`).join('')}</div>
          <small class="muted">Os textos vêm do modelo de Configurações. O que você editar aqui vale só para esta proposta.</small></div>
        <div id="pp-termos">${CRM.termosEditor(P.termos, 'prop')}</div></section>
      <section class="stack" style="gap:12px"><div class="sec-h"><div><h2 class="h2">Pagamento e validade</h2></div></div>
        ${P.pag.map((p, i) => `<label class="opcao"><input type="checkbox" data-pag="${i}" ${pagSel[i] ? 'checked' : ''}><span>${p}</span></label>`).join('')}
        <div class="fld" style="max-width:260px"><label for="pp-v">Valores garantidos até</label><input id="pp-v" value="${P.validade}"></div></section>
    </div>
    <aside class="pp__lado stack" style="gap:16px">
      <div class="pp__prev"><span class="mono">Como a cliente vê</span><div class="pp__tela"><div class="pp__mini">${propostaCliente()}</div></div></div>
      <div class="row" style="flex-wrap:wrap"><a class="btn s" href="#proposta-cliente">${ic('eye', 'i s')}Abrir como cliente</a>
        ${J.proposta === 'rascunho' ? `<button class="btn p" type="button" data-enviar-prop>${ic('paper-plane-tilt', 'i s')}Enviar proposta</button>` : `<button class="btn s" type="button" data-sim-vista>${ic('eye', 'i s')}Simular visualização</button>`}</div>
      ${J.proposta !== 'rascunho' ? `<ol class="hist">${[J.contrato === 'assinado' && ['pencil-simple', 'Contrato assinado', 'agora'], J.contrato !== 'nao' && ['paper-plane-tilt', 'Contrato enviado', 'agora'], J.proposta === 'aceita' && ['check', 'Proposta aceita: opção ' + J.escolha, 'agora'], J.vistas && ['eye', `Carla abriu a proposta ${J.vistas}x`, 'agora'], ['paper-plane-tilt', 'Proposta enviada pelo WhatsApp', 'hoje']].filter(Boolean).map(h => `<li><span class="ibox">${ic(h[0], 'i s')}</span><div><span>${h[1]}</span><small>${h[2]}</small></div></li>`).join('')}</ol>` : ''}
    </aside>
  </div></div>`;
}

CRM.telas.proposta = { menu: 'viagens', larga: true, render: editor, depois(r) {
  r.querySelector('#pp').addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-enviar-prop]')) CRM.janela(`<div class="sec-h"><div><h2 class="h2">Enviar a proposta para Carla</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
      <p class="muted" style="margin:0">Ela abre pelo link, escolhe a opção e já segue para o contrato. Você é avisada quando ela abrir.</p>
      <div class="search" style="width:100%">${ic('link-simple', 'i s')}<input readonly value="osv.app/proposta/orlando-carla" aria-label="Link"><button class="btn s" type="button" data-aviso="Link copiado">${ic('copy', 'i s')}Copiar</button></div>
      <div class="row" style="justify-content:flex-end;flex-wrap:wrap"><button class="btn s" type="button" data-confirmar-envio>${ic('envelope-simple', 'i s')}Enviar por e-mail</button><button class="btn p" type="button" data-confirmar-envio>${ic('whatsapp-logo', 'i s')}Enviar no WhatsApp</button></div>`);
    if (t.closest('[data-sim-vista]')) { J.vistas++; CRM.render(); CRM.aviso('Carla abriu a proposta'); }
    if (t.closest('[data-enviar-contrato]')) { J.contrato = 'enviado'; CRM.render(); CRM.aviso('Contrato enviado para assinatura'); }
    if (t.closest('[data-assist-prop]')) CRM.aviso('O Assistente buscou 3 itens na biblioteca para revisar');
    const pg = t.closest('[data-pag]'); if (pg) { pagSel[pg.dataset.pag] = pg.checked ? 1 : 0; CRM.render(); }
  });
  const prev = () => { const m = r.querySelector('.pp__mini'); if (m) m.innerHTML = propostaCliente(); };
  CRM.alvoTermos.prop = { termos: () => P.termos, padrao: () => CRM.modelosProposta[P.termos.tipo], depois: (re, k) => {
    if (re) { const abertos = [...r.querySelectorAll('#pp-termos details')].map(d => d.open); r.querySelector('#pp-termos').innerHTML = CRM.termosEditor(P.termos, 'prop');
      r.querySelectorAll('#pp-termos details').forEach((d, n) => { d.open = abertos[n] || (k && d.querySelector(`[data-add-termo="${k}"]`)); });
      if (k) { const l = r.querySelectorAll(`#pp-termos [data-sec="${k}"]`); l[l.length - 1]?.focus(); } }
    else r.querySelectorAll('#pp-termos summary').forEach((su, n) => { const k2 = CRM.secsProposta[n][0], c = su.querySelector('.chip'); if (c && P.termos.custom[k2]) { c.className = 'chip now'; c.textContent = 'Personalizado'; } });
    prev(); } };
  r.querySelector('#pp').addEventListener('click', e => {
    const tp = e.target.closest('[data-tipo]'); if (!tp || tp.dataset.tipo === P.termos.tipo) return;
    const trocar = () => { P.termos = CRM.novosTermos(tp.dataset.tipo); CRM.fechar(); CRM.render(); CRM.aviso('Termos preenchidos pelo modelo: ' + CRM.modelosProposta[tp.dataset.tipo].n); };
    if (!Object.keys(P.termos.custom).length) return trocar();
    CRM.janela(`<div class="sec-h"><div><h2 class="h2">Trocar o tipo de serviço?</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
      <p class="muted" style="margin:0">Os termos serão preenchidos pelo modelo "${CRM.modelosProposta[tp.dataset.tipo].n}" e as personalizações desta proposta serão substituídas.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Manter como está</button><button class="btn p" type="button" id="trocar-tipo">Trocar e usar o modelo</button></div>`);
    document.getElementById('trocar-tipo').onclick = trocar;
  });
  r.querySelector('#pp-m').addEventListener('input', e => { P.msg = e.target.value; const m = r.querySelector('.pp__mini .cli-msg'); if (m) m.firstChild.textContent = P.msg; });
} };
CRM.telas['proposta-cliente'] = { cliente: true, render: propostaCliente };
CRM.telas['contrato-cliente'] = { cliente: true, render: contratoCliente };

document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-confirmar-envio]')) { J.proposta = 'enviada'; CRM.fechar(); CRM.render(); CRM.aviso('Proposta enviada para Carla'); }
  const a = t.closest('[data-aceitar]');
  if (a && !a.closest('.pp__mini')) { J.proposta = 'aceita'; J.escolha = a.dataset.aceitar; J.vistas = Math.max(J.vistas, 1); if (J.contrato === 'nao') J.contrato = 'enviado'; CRM.render(); CRM.aviso('Opção ' + J.escolha + ' escolhida'); }
  if (t.closest('[data-pagar]')) { J.pagamento = 'pago'; CRM.render(); CRM.aviso('Pagamento confirmado'); }
});
document.addEventListener('submit', e => {
  if (e.target.matches('[data-assinar]')) { e.preventDefault(); J.contrato = 'assinado'; const vd = (CRM.vendas || []).find(x => x.id === 'v3'); if (vd) { vd.e = 'fechado'; vd.nx = null; } if (!J.escolha) { J.escolha = 'Conforto'; J.proposta = 'aceita'; } CRM.render(); CRM.aviso('Contrato assinado'); }
});
}
