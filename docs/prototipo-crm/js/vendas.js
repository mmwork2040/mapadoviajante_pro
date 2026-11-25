/* Tela Vendas: funil em colunas, ficha da venda (painel lateral) e Nova venda. Dados de exemplo. */
{
const ic = CRM.ic;
const ETAPAS = [
  { id: 'novo', t: 'Novo' }, { id: 'contatado', t: 'Contatado' }, { id: 'negociando', t: 'Negociando' },
  { id: 'fechado', t: 'Fechado' }, { id: 'perdido', t: 'Perdido' }
];
const nomeEtapa = id => ETAPAS.find(e => e.id === id).t;
const brl = v => 'R$ ' + v.toLocaleString('pt-BR');
const mil = v => 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';

const VENDAS = [
  { id: 'v1', c: 'Diego Alves', av: 'DA', k: 'a4', d: 'Buenos Aires', q: 'Abril de 2027 · 5 noites', pax: '2 adultos', v: 9500, e: 'novo', sc: 3, nx: { t: 'Primeiro contato', q: 'Hoje' }, o: 'Instagram', tp: 'Lazer', criada: '21 nov' },
  { id: 'v2', c: 'Paula Nogueira', av: 'PN', k: 'a3', d: 'Gramado', q: '18 a 22 jul', pax: '2 adultos e 1 criança', v: 7200, e: 'novo', sc: 1, nx: { t: 'Primeiro contato', q: 'Hoje' }, o: 'Site', tp: 'Família', criada: '23 nov' },
  { id: 'v4', c: 'Marcos e Lia Teixeira', av: 'MT', k: 'a2', d: 'Japão', q: 'Outubro de 2027 · 15 dias', pax: '2 adultos', v: 58000, e: 'novo', sc: 0, nx: { t: 'Ligar para entender o perfil', q: 'Amanhã' }, o: 'Indicação', tp: 'Lazer', criada: '24 nov' },
  { id: 'v5', c: 'Bruno Costa', av: 'BC', k: 'a2', d: 'Santiago', q: '14 a 19 jun', pax: '2 adultos', v: 14800, e: 'contatado', sc: 6, nx: { t: 'Enviar opções de hotel', q: 'Ontem', late: 1 }, o: 'Instagram', tp: 'Lazer', criada: '10 nov' },
  { id: 'v6', c: 'Família Andrade', av: 'FA', k: '', d: 'Lisboa e Porto', q: '12 a 24 mar', pax: '2 adultos e 2 crianças', v: 46000, e: 'contatado', sc: 0, nx: { t: 'Montar proposta', q: 'Qui, 26 nov' }, o: 'Indicação', tp: 'Família', criada: '18 nov' },
  { id: 'v7', c: 'Juliana Prado', av: 'JP', k: 'a3', d: 'Paris', q: '3 a 10 mai', pax: '1 adulto', v: 21500, e: 'negociando', sc: 1, nx: { t: 'Retorno sobre hotel', q: 'Hoje, 16:00' }, o: 'WhatsApp', tp: 'Lazer', criada: '5 nov' },
  { id: 'v3', c: 'Carla Mendes', av: 'CM', k: 'a3', d: 'Orlando', q: '2 a 12 fev', pax: '2 adultos e 2 crianças', v: 38900, e: 'negociando', sc: 4, nx: { t: 'Enviar proposta', q: 'Ontem', late: 1 }, o: 'Instagram', tp: 'Família', criada: '1 nov' },
  { id: 'v9', c: 'Ana Ribeiro', av: 'AR', k: 'a3', d: 'Maldivas', q: '10 a 20 mar', pax: '2 adultos', v: 62000, e: 'negociando', sc: 5, nx: { t: 'Cobrar retorno da proposta', q: 'Hoje' }, o: 'Google', tp: 'Lua de mel', criada: '28 out' },
  { id: 'v8', c: 'Thiago Rocha', av: 'TR', k: 'a4', d: 'Cancún', q: '20 a 27 abr', pax: '2 adultos', v: 16800, e: 'negociando', sc: 2, nx: { t: 'Ajustar datas do voo', q: 'Sex, 27 nov' }, o: 'Site', tp: 'Lazer', criada: '12 nov' },
  { id: 'v10', c: 'Família Souza', av: 'FS', k: '', d: 'Fernando de Noronha', q: '12 a 19 dez', pax: '4 adultos', v: 31200, e: 'fechado', sc: 0, o: 'Indicação', tp: 'Família', criada: '2 out', viagem: 1 },
  { id: 'v11', c: 'Rafael e Bia', av: 'RB', k: 'a2', d: 'Cusco e Machu Picchu', q: '8 a 18 jan', pax: '2 adultos', v: 17100, e: 'fechado', sc: 0, o: 'Instagram', tp: 'Aventura', criada: '20 out', viagem: 1 },
  { id: 'v13', c: 'Renata Lima', av: 'RL', k: 'a3', d: 'Nova York', q: 'Dezembro', pax: '2 adultos', v: 18000, e: 'perdido', sc: 0, o: 'Google', tp: 'Lazer', criada: '15 out', motivo: 'Preço acima do esperado' },
  { id: 'v14', c: 'Caio Martins', av: 'CA', k: 'a2', d: 'Atacama', q: 'Julho', pax: '2 adultos', v: 12000, e: 'perdido', sc: 0, o: 'Site', tp: 'Aventura', criada: '3 nov', motivo: 'Adiou a viagem' }
];
CRM.vendas = VENDAS;

/* Detalhes que só aparecem na ficha (iguais para o exemplo) */
const HIST = {
  v3: [
    { ic: 'warning', t: 'Tarefa atrasada: <b>Enviar proposta</b>', q: 'Venceu ontem', bad: 1 },
    { ic: 'whatsapp-logo', t: 'WhatsApp: pediu proposta com parque e hotel perto da Disney', q: '20 nov · Mariana' },
    { ic: 'phone', t: 'Ligação de 18 min: família de 4, crianças de 6 e 9 anos', q: '12 nov · Mariana' },
    { ic: 'kanban', t: 'Etapa: Contatado → Negociando', q: '12 nov' },
    { ic: 'plus', t: 'Venda criada a partir do Instagram', q: '1 nov' }
  ]
};
const histPadrao = v => [
  { ic: 'chat-circle-text', t: 'Observação: prefere voos diurnos', q: '15 nov · Mariana' },
  { ic: 'phone', t: 'Primeiro contato por ligação', q: v.criada + ' · Mariana' },
  { ic: 'plus', t: 'Venda criada a partir de ' + v.o, q: v.criada }
];

let busca = '', soParadas = false, aberta = null, ordem = 'sc';
let vista = 'a';
try { vista = localStorage.getItem('crm-opc-vendas') || 'a'; } catch (e) {}
const VISTAS = { a: ['Quadro', 'kanban'], b: ['Lista', 'rows'] };

/* Lista: tabela ordenável, boa para muitas vendas */
function lista() {
  const f = VENDAS.filter(v => (!busca || (v.c + ' ' + v.d).toLowerCase().includes(busca)) && (!soParadas || v.sc >= 3));
  const ord = { sc: (a, b) => b.sc - a.sc, v: (a, b) => b.v - a.v, c: (a, b) => a.c.localeCompare(b.c), e: (a, b) => ETAPAS.findIndex(x => x.id === a.e) - ETAPAS.findIndex(x => x.id === b.e) }[ordem];
  const th = (k, t, cls = '') => `<th class="${cls}"><button type="button" class="ord" data-ord="${k}" aria-pressed="${ordem === k}">${t}${ordem === k ? ' ↓' : ''}</button></th>`;
  return `<table class="tbl rows vlista"><thead><tr>${th('c', 'Cliente')}<th>Destino</th>${th('e', 'Etapa')}${th('v', 'Valor', 'num')}<th>Próximo passo</th>${th('sc', 'Sem contato', 'num')}</tr></thead>
  <tbody>${[...f].sort(ord).map(v => `<tr data-id="${v.id}" tabindex="0" style="cursor:pointer">
    <td><span class="row" style="gap:10px"><span class="av sm ${v.k}">${v.av}</span>${v.c}</span></td>
    <td class="c2">${v.d}<br><small class="muted">${v.q}</small></td>
    <td class="c3"><span class="chip${v.e === 'fechado' ? ' ok' : v.e === 'perdido' ? '' : v.e === 'negociando' ? ' now' : ''}">${nomeEtapa(v.e)}</span></td>
    <td class="num c4">${brl(v.v)}</td>
    <td class="c7">${v.nx ? `<span class="${v.nx.late ? 'late' : ''}">${v.nx.late ? ic('warning', 'i s') : ''}${v.nx.t} · ${v.nx.q}</span>` : '<span class="muted">—</span>'}</td>
    <td class="num c5"><b style="color:${v.sc >= 5 ? 'var(--bad)' : v.sc >= 3 ? 'var(--warn)' : 'var(--tm)'}">${v.e === 'fechado' || v.e === 'perdido' ? '—' : v.sc + (v.sc === 1 ? ' dia' : ' dias')}</b></td></tr>`).join('')}</tbody></table>`;
}

function cartao(v) {
  const parada = v.sc >= 5;
  return `<article class="vcard" draggable="true" data-id="${v.id}" tabindex="0" aria-label="${v.c}, ${v.d}">
    <div class="vcard__t"><b>${v.d}</b><span class="num">${v.v ? mil(v.v) : "A definir"}</span></div>
    <span class="vcard__q">${v.c} · ${v.q}</span>
    ${v.nx ? `<span class="vcard__nx${v.nx.late ? ' late' : ''}">${ic(v.nx.late ? 'warning' : 'clock', 'i s')}${v.nx.t} · ${v.nx.q}</span>`
      : v.e === 'fechado' ? `<span class="vcard__nx ok">${ic('airplane-tilt', 'i s')}Viagem criada</span>`
      : v.motivo ? `<span class="vcard__nx">${ic('x', 'i s')}${v.motivo}</span>` : ''}
    <div class="vcard__f"><span class="av sm ${v.k}">${v.av}</span>${parada ? `<span class="chip bad">${v.sc} dias sem contato</span>` : v.sc >= 3 ? `<span class="chip warn">${v.sc} dias sem contato</span>` : ''}</div>
  </article>`;
}

function quadro() {
  const f = VENDAS.filter(v => (!busca || (v.c + ' ' + v.d).toLowerCase().includes(busca)) && (!soParadas || v.sc >= 3));
  return ETAPAS.map(e => {
    const l = f.filter(v => v.e === e.id), tot = l.reduce((s, v) => s + v.v, 0);
    return `<section class="col" data-etapa="${e.id}" aria-label="${e.t}">
      <header class="col__h"><b>${e.t}</b><span class="cnt">${l.length}</span><span class="col__v num">${tot ? mil(tot) : ''}</span></header>
      <div class="col__b">${l.map(cartao).join('') || `<div class="col__vazio">${busca || soParadas ? 'Nada com esse filtro' : 'Arraste uma venda para cá'}</div>`}</div>
    </section>`;
  }).join('');
}

function atualizarQuadro() {
  const q = document.getElementById('quadro');
  if (q) q.innerHTML = vista === 'b' ? lista() : quadro();
}

/* Ficha da venda */
function ficha(v) {
  const idx = ETAPAS.findIndex(e => e.id === v.e);
  const fim = v.e === 'fechado' || v.e === 'perdido';
  const hist = HIST[v.id] || histPadrao(v);
  return `
  <div class="ficha__top">
    <span class="mono">Viagem · fase comercial · criada em ${v.criada} · ${v.o}</span>
    <button class="mini" type="button" data-fechar aria-label="Fechar ficha">${ic('x', 'i s')}</button>
  </div>
  <header class="stack" style="gap:6px">
    <h2 class="h1" style="font-size:30px">${v.c}</h2>
    <p class="ficha__sub">${v.d} · ${v.q} · ${v.pax}</p>
    <div class="row" style="gap:10px;flex-wrap:wrap"><b class="ficha__valor num">${brl(v.v)}</b><span class="muted">orçamento do cliente</span></div>
  </header>

  ${v.e === 'perdido' ? `<div class="tip">${ic('x')}<div><b>Venda perdida</b><br><span class="muted">${v.motivo}</span></div><button class="btn s" type="button" data-reabrir>Reabrir</button></div>` : `
  <div class="stack" style="gap:8px">
    <div class="etapas" role="group" aria-label="Etapa da venda">
      ${ETAPAS.slice(0, 4).map((e, i) => `<button type="button" data-etapa="${e.id}" class="${i < idx ? 'feita' : i === idx ? 'atual' : ''}" ${i === idx ? 'aria-current="step"' : ''}>${i < idx ? ic('check', 'i s') : ''}${e.t}</button>`).join('')}
    </div>
    ${fim ? '' : '<button class="link perder" type="button" data-perder>Marcar como perdida</button>'}
  </div>`}

  ${v.e === 'fechado' ? `
  <section class="card lv3 proximo">
    <span class="mono" style="color:var(--acct)">Venda fechada</span>
    <b class="h3">${v.viagem ? 'A viagem já foi criada' : 'Agora crie a viagem para montar o roteiro'}</b>
    <div class="row" style="flex-wrap:wrap">${v.viagem ? `<a class="btn p" href="#viagens">Abrir viagem ${ic('arrow-right', 'i s')}</a>` : `<button class="btn p" type="button" data-criar-viagem>Criar viagem ${ic('arrow-right', 'i s')}</button>`}</div>
  </section>` : v.nx ? `
  <section class="card lv3 proximo">
    <span class="mono" style="color:var(--acct)">Próximo passo</span>
    <b class="h3">${v.nx.t}</b>
    <span class="${v.nx.late ? 'late' : 'muted'}">${v.nx.late ? ic('warning', 'i s') : ic('clock', 'i s')}${v.nx.q}</span>
    <div class="row" style="flex-wrap:wrap"><button class="btn p" type="button" data-concluir>${ic('check', 'i s')}Concluir e definir o próximo</button><button class="btn s" type="button">Reagendar</button></div>
  </section>` : ''}

  ${v.e === 'perdido' ? '' : `<section class="stack" style="gap:10px"><div class="sec-h"><div><span class="mono">Proposta, contrato e guia</span></div><a class="link" href="#proposta" data-fechar>${v.id === 'v3' ? 'Abrir' : 'Montar proposta'} →</a></div>${CRM.jornadaHtml ? CRM.jornadaHtml(1) : ''}</section>`}

  <div class="acoes" role="group" aria-label="Contato">
    <a href="#" class="acao">${ic('whatsapp-logo')}<span>WhatsApp</span></a>
    <a href="#" class="acao">${ic('phone')}<span>Ligar</span></a>
    <a href="#" class="acao">${ic('envelope-simple')}<span>E-mail</span></a>
    <a href="#" class="acao" data-aba-ir="hist">${ic('pencil-simple')}<span>Registrar</span></a>
  </div>

  <div class="tabs" role="tablist">
    <button role="tab" aria-selected="true" data-aba="resumo">Resumo</button>
    <button role="tab" aria-selected="false" data-aba="hist">Histórico · ${hist.length}</button>
    <button role="tab" aria-selected="false" data-aba="orc">Orçamento</button>
  </div>

  <div data-painel="resumo" class="stack" style="gap:24px">
    <section class="stack" style="gap:10px"><span class="mono">Viagem</span>
      <dl class="dados"><dt>Destino</dt><dd>${v.d}</dd><dt>Saída de</dt><dd>São Paulo (GRU)</dd><dt>Quando</dt><dd>${v.q}</dd><dt>Passageiros</dt><dd>${v.pax}</dd><dt>Tipo</dt><dd>${v.tp}</dd><dt>Preferências</dt><dd>Econômica premium · hotel 4 estrelas · quarto família</dd></dl>
    </section>
    <section class="stack" style="gap:10px"><span class="mono">Cliente</span>
      <dl class="dados"><dt>WhatsApp</dt><dd class="num">(11) 98765-4321</dd><dt>E-mail</dt><dd>${v.c.split(' ')[0].toLowerCase()}@exemplo.com</dd><dt>Passaporte</dt><dd>Válido até 08/2029 <span class="chip ok">OK</span></dd></dl>
      <a class="link" href="#viajantes">Abrir na base de viajantes →</a>
    </section>
    <section class="stack" style="gap:10px"><span class="mono">Milhas e benefícios</span>
      <div class="hbars"><span class="n">Smiles</span><span class="t"><i style="width:82%"></i></span><span class="v">82 mil</span><span class="n">Latam Pass</span><span class="t"><i style="width:40%"></i></span><span class="v">40 mil</span><span class="n">Livelo</span><span class="t"><i style="width:18%"></i></span><span class="v">18 mil</span></div>
      <span class="muted">Cartão com acesso a sala VIP · 2 acompanhantes</span>
    </section>
  </div>

  <div data-painel="hist" class="stack" hidden>
    <form class="registro" data-registro>
      <div class="seg" role="group" aria-label="Tipo de registro"><button type="button" aria-pressed="true">WhatsApp</button><button type="button" aria-pressed="false">Ligação</button><button type="button" aria-pressed="false">E-mail</button><button type="button" aria-pressed="false">Reunião</button><button type="button" aria-pressed="false">Observação</button></div>
      <div class="fld"><label class="sr" for="reg-txt">O que aconteceu</label><textarea id="reg-txt" rows="2" placeholder="O que aconteceu nesse contato?"></textarea></div>
      <div class="row" style="justify-content:flex-end"><button class="btn s" type="submit">Registrar</button></div>
    </form>
    <ol class="hist">${hist.map(h => `<li class="${h.bad ? 'bad' : ''}"><span class="ibox">${ic(h.ic, 'i s')}</span><div><span>${h.t}</span><small>${h.q}</small></div></li>`).join('')}</ol>
  </div>

  <div data-painel="orc" class="stack" style="gap:22px" hidden>
    <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div class="kpi"><span class="mono">Cliente trouxe</span><b>${mil(v.v)}</b><span class="delta">Pesquisa dele</span></div>
      <div class="kpi"><span class="mono">Proposta OSV</span><b>${mil(Math.round(v.v * 0.82))}</b><span class="delta up">${ic('arrow-up-right', 'i s')} ${mil(v.v - Math.round(v.v * 0.82))} de economia</span></div>
    </div>
    <div class="meter ok"><span>Proposta dentro do orçamento</span><span class="v">82%</span><span class="t"><i style="width:82%"></i></span></div>
    <table class="tbl"><thead><tr><th>Item</th><th>Pago com</th><th class="num">Valor</th></tr></thead><tbody>
      <tr><td>Passagens</td><td>Milhas Smiles + taxas</td><td class="num">${brl(Math.round(v.v * .28))}</td></tr>
      <tr><td>Hospedagem</td><td>Cartão</td><td class="num">${brl(Math.round(v.v * .41))}</td></tr>
      <tr><td>Seguro e transfers</td><td>Pix</td><td class="num">${brl(Math.round(v.v * .13))}</td></tr>
    </tbody></table>
  </div>`;
}

function abrir(id) {
  const v = VENDAS.find(x => x.id === id); if (!v) return;
  aberta = v;
  CRM.painel(ficha(v));
}

function mover(v, etapa) {
  if (etapa === 'perdido') return perguntarMotivo(v);
  const de = v.e; v.e = etapa; if (etapa !== 'perdido') delete v.motivo;
  if (etapa === 'fechado') v.nx = null;
  atualizarQuadro();
  if (aberta === v) CRM.painel(ficha(v));
  CRM.aviso(`${v.c}: ${nomeEtapa(de)} → ${nomeEtapa(etapa)}`);
}

function perguntarMotivo(v) {
  const M = ['Preço acima do esperado', 'Fechou com outra agência', 'Adiou a viagem', 'Não respondeu mais', 'Outro'];
  CRM.janela(`
    <div class="sec-h"><div><h2 class="h2">Por que a venda de ${v.c} foi perdida?</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <p class="muted" style="margin:0">O motivo aparece nos relatórios e ajuda a ajustar as próximas propostas.</p>
    <div class="opcoes" role="radiogroup">${M.map((m, i) => `<label class="opcao"><input type="radio" name="motivo" value="${m}" ${i ? '' : 'checked'}><span>${m}</span></label>`).join('')}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="button" data-confirmar-perda="${v.id}">Marcar como perdida</button></div>`);
}

function nova() {
  CRM.janela(`
    <form class="form" data-nova>
      <div class="sec-h"><div><span class="mono">Viagens · comercial</span><h2 class="h2">Nova viagem</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
      <div class="fld"><label for="nv-c">Quem vai viajar</label><input id="nv-c" list="nv-clientes" required placeholder="Busque na base de viajantes ou digite um nome novo" autocomplete="off">
        <datalist id="nv-clientes">${(CRM.pessoas || []).map(p => `<option value="${p.n}">`).join('')}</datalist></div>
      <div class="linha"><div class="fld"><label for="nv-w">WhatsApp</label><input id="nv-w" type="tel" inputmode="tel" placeholder="(11) 90000-0000"></div>
        <div class="fld"><label for="nv-o">Como chegou</label><select id="nv-o"><option>Instagram</option><option>Indicação</option><option>WhatsApp</option><option>Site</option><option>Google</option><option>Outro</option></select></div></div>
      <div class="linha"><div class="fld"><label for="nv-d">Destino</label><input id="nv-d" required placeholder="Ex.: Lisboa e Porto"></div>
        <div class="fld"><label for="nv-q">Quando</label><input id="nv-q" placeholder="Ex.: 10 a 20 mar ou julho"></div></div>
      <div class="linha"><div class="fld"><label for="nv-p">Passageiros</label><input id="nv-p" placeholder="Ex.: 2 adultos e 1 criança"></div>
        <div class="fld"><label for="nv-v">Orçamento estimado</label><input id="nv-v" inputmode="numeric" placeholder="R$ 0"></div></div>
      <div class="fld"><label for="nv-nx">Próximo passo</label><div class="linha" style="grid-template-columns:minmax(0,1fr) 150px"><input id="nv-nx" required value="Primeiro contato"><select aria-label="Quando fazer"><option>Hoje</option><option>Amanhã</option><option>Esta semana</option></select></div></div>
      <details class="mais"><summary>${ic('caret-right', 'i s')}Mais detalhes (opcional)</summary>
        <div class="form" style="padding-top:14px">
          <div class="fld"><span class="lbl">Tipo de viagem</span><div class="chips">${['Lazer', 'Família', 'Lua de mel', 'Negócios', 'Aventura', 'Cruzeiro'].map(t => `<label class="opcao opcao--chip"><input type="radio" name="tp" value="${t}"><span>${t}</span></label>`).join('')}</div></div>
          <div class="linha"><div class="fld"><label for="nv-s">Saída de</label><input id="nv-s" placeholder="Ex.: São Paulo (GRU)"></div><div class="fld"><label for="nv-m">Milhas e pontos</label><input id="nv-m" placeholder="Ex.: Smiles 80 mil"></div></div>
          <div class="fld"><label for="nv-obs">Observações</label><textarea id="nv-obs" rows="3" placeholder="Preferências de voo, hotel, restrições"></textarea></div>
        </div>
      </details>
      <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="submit">Criar viagem</button></div>
    </form>`);
}

CRM.telas.vendas = {
  menu: 'viagens',
  get larga() { return vista === 'a'; },
  abrir, nova,
  render() {
    const ab = VENDAS.filter(v => ['novo', 'contatado', 'negociando'].includes(v.e));
    return `
    <header class="ph">
      <div><h1 class="h1">Viagens</h1><p>${ab.length} em negociação · ${mil(ab.reduce((s, v) => s + v.v, 0))} em jogo${vista === 'a' ? '<span class="so-desk"> · arraste o cartão para mudar a etapa</span>' : ''}</p></div>
      <button class="btn p" type="button" data-nova-venda>${ic('plus', 'i s')}Nova viagem</button>
    </header>
    ${CRM.subViagens('com')}
    <div class="filtros">
      <label class="search"><svg class="i s"><use href="#i-magnifying-glass"/></svg><input id="v-busca" placeholder="Filtrar por cliente ou destino" aria-label="Filtrar vendas" value="${busca}"></label>
      <div class="seg" role="group" aria-label="De quem"><button type="button" aria-pressed="true">Minhas</button><button type="button" aria-pressed="false">Toda a equipe</button></div>
      <button class="chip" type="button" id="v-paradas" aria-pressed="${soParadas}">${ic('clock', 'i s')}Sem contato há 3+ dias</button>
      <span class="sp"></span>
      <button class="link" type="button">${ic('dots-three', 'i s')} Arquivadas</button>
      ${CRM.vistas(VISTAS, vista, 'vd')}
    </div>
    <div class="${vista === 'b' ? '' : 'quadro'}" id="quadro">${vista === 'b' ? lista() : quadro()}</div>`;
  },
  depois(el) {
    const q = el.querySelector('#quadro');
    el.querySelector('#v-busca').addEventListener('input', e => { busca = e.target.value.trim().toLowerCase(); atualizarQuadro(); });
    el.querySelector('#v-paradas').addEventListener('click', e => { soParadas = !soParadas; e.currentTarget.setAttribute('aria-pressed', soParadas); atualizarQuadro(); });
    el.querySelectorAll('[data-opc-vd]').forEach(b => b.addEventListener('click', () => { vista = b.dataset.opcVd; try { localStorage.setItem('crm-opc-vendas', vista); } catch (e) {} CRM.render(); }));
    q.addEventListener('click', e => {
      const o = e.target.closest('[data-ord]'); if (o) { ordem = o.dataset.ord; atualizarQuadro(); return; }
      const c = e.target.closest('.vcard,tr[data-id]'); if (c) abrir(c.dataset.id);
    });
    q.addEventListener('keydown', e => { const c = e.target.closest('.vcard,tr[data-id]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(c.dataset.id); } });
    q.addEventListener('dragstart', e => { const c = e.target.closest('.vcard'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('arrastando'); });
    q.addEventListener('dragend', e => { e.target.closest?.('.vcard')?.classList.remove('arrastando'); q.querySelectorAll('.alvo').forEach(x => x.classList.remove('alvo')); });
    q.addEventListener('dragover', e => { const col = e.target.closest('.col'); if (!col) return; e.preventDefault(); q.querySelectorAll('.alvo').forEach(x => x !== col && x.classList.remove('alvo')); col.classList.add('alvo'); });
    q.addEventListener('drop', e => {
      const col = e.target.closest('.col'); if (!col) return; e.preventDefault();
      const v = VENDAS.find(x => x.id === e.dataTransfer.getData('text/plain'));
      if (v && v.e !== col.dataset.etapa) mover(v, col.dataset.etapa); else atualizarQuadro();
    });
  }
};

/* Ações dentro da ficha e das janelas */
document.addEventListener('click', e => {
  const t = e.target;
  const aba = t.closest('[data-aba],[data-aba-ir]');
  if (aba) {
    e.preventDefault();
    const id = aba.dataset.aba || aba.dataset.abaIr, p = aba.closest('.painel__in');
    p.querySelectorAll('[data-aba]').forEach(b => b.setAttribute('aria-selected', b.dataset.aba === id));
    p.querySelectorAll('[data-painel]').forEach(s => s.hidden = s.dataset.painel !== id);
    if (aba.dataset.abaIr) p.querySelector('#reg-txt')?.focus();
  }
  const et = t.closest('.etapas [data-etapa]');
  if (et && aberta && aberta.e !== et.dataset.etapa) mover(aberta, et.dataset.etapa);
  if (t.closest('[data-perder]') && aberta) perguntarMotivo(aberta);
  const cp = t.closest('[data-confirmar-perda]');
  if (cp) {
    const v = VENDAS.find(x => x.id === cp.dataset.confirmarPerda), m = document.querySelector('input[name=motivo]:checked').value;
    const de = v.e; v.e = 'perdido'; v.motivo = m; v.nx = null;
    document.getElementById('janela').classList.remove('on');
    atualizarQuadro(); if (aberta === v) CRM.painel(ficha(v)); else document.body.classList.remove('travado');
    CRM.aviso(`${v.c}: ${nomeEtapa(de)} → Perdido (${m.toLowerCase()})`);
  }
  if (t.closest('[data-reabrir]') && aberta) { aberta.e = 'negociando'; delete aberta.motivo; aberta.nx = { t: 'Retomar contato', q: 'Hoje' }; atualizarQuadro(); CRM.painel(ficha(aberta)); CRM.aviso('Venda reaberta em Negociando'); }
  if (t.closest('[data-concluir]') && aberta) { aberta.nx = { t: 'Defina o próximo passo', q: 'Sem data' }; aberta.sc = 0; atualizarQuadro(); CRM.painel(ficha(aberta)); CRM.aviso('Passo concluído e registrado no histórico'); }
  if (t.closest('[data-criar-viagem]') && aberta) { aberta.viagem = 1; atualizarQuadro(); CRM.painel(ficha(aberta)); CRM.aviso(`Viagem criada para ${aberta.c}`); }
});
document.addEventListener('submit', e => {
  if (e.target.matches('[data-nova]')) {
    e.preventDefault();
    const f = e.target, val = id => f.querySelector(id).value.trim();
    const c = val('#nv-c');
    const v = { id: 'n' + Date.now(), c, av: c.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(), k: 'a2', d: val('#nv-d'), q: val('#nv-q') || 'Datas a definir', pax: val('#nv-p') || 'A definir', v: parseInt(val('#nv-v').replace(/\D/g, '')) || 0, e: 'novo', sc: 0, nx: { t: val('#nv-nx'), q: f.querySelector('select[aria-label="Quando fazer"]').value }, o: val('#nv-o'), tp: f.querySelector('input[name=tp]:checked')?.value || 'Lazer', criada: '24 nov' };
    VENDAS.unshift(v); CRM.fechar(); CRM.render(); CRM.aviso(`Viagem criada para ${c}. Próximo passo: ${v.nx.t.toLowerCase()}`);
  }
  if (e.target.matches('[data-registro]')) {
    e.preventDefault();
    const txt = e.target.querySelector('textarea');
    if (!txt.value.trim()) { txt.focus(); return; }
    const tipo = e.target.querySelector('[aria-pressed=true]').textContent;
    const l = HIST[aberta.id] || (HIST[aberta.id] = histPadrao(aberta));
    l.unshift({ ic: 'chat-circle-text', t: `${tipo}: ${txt.value.trim().replace(/[<>&]/g, '')}`, q: 'Agora · Mariana' });
    aberta.sc = 0; atualizarQuadro(); CRM.painel(ficha(aberta));
    document.querySelector('.painel [data-aba="hist"]').click();
    CRM.aviso('Registrado no histórico');
  }
});
}
