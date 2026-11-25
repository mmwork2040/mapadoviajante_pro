/* Gestão (só administradores): Financeiro, Equipe e Configurações. Dados de exemplo. */
{
const ic = CRM.ic;
const brl = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const mil = v => 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const soAdmin = '<span class="chip" title="Só administradores veem esta tela">' + ic('lock-simple', 'i s') + 'Gestão</span>';

/* ═══ Financeiro ═══ */
const MESES = [['jun', 52, 7.8], ['jul', 61, 9.2], ['ago', 48, 7.1], ['set', 66, 9.9], ['out', 71, 10.6], ['nov', 79, 11.8]];
const TX = [
  { d: '24 nov', t: 'Pacote Noronha · Família Souza', cat: 'Pacote', tp: 'r', v: 31200, st: 'ok' },
  { d: '22 nov', t: 'Comissão Pousada Mar de Dentro', cat: 'Comissão', tp: 'r', v: 1780, st: 'pend' },
  { d: '20 nov', t: 'Pacote Peru · Rafael e Bia', cat: 'Pacote', tp: 'r', v: 17100, st: 'ok' },
  { d: '18 nov', t: 'Anúncios no Instagram', cat: 'Marketing', tp: 'd', v: 2400, st: 'ok' },
  { d: '15 nov', t: 'Comissão seguro viagem (lote)', cat: 'Comissão', tp: 'r', v: 960, st: 'pend' },
  { d: '12 nov', t: 'Ferramentas e assinaturas', cat: 'Operacional', tp: 'd', v: 890, st: 'ok' },
  { d: '10 nov', t: 'Sinal do Grupo Jalapão', cat: 'Pacote', tp: 'r', v: 15660, st: 'pend' },
  { d: '5 nov', t: 'Comissões das consultoras · outubro', cat: 'Operacional', tp: 'd', v: 6300, st: 'ok' }
];
let oculto = false, ftx = 'todos';

function financeiro() {
  const max = Math.max(...MESES.map(m => m[1]));
  const pend = TX.filter(t => t.st === 'pend' && t.tp === 'r');
  const v = x => oculto ? 'R$ •••' : x;
  return `<div id="fin" class="stack" style="gap:30px">
  <header class="ph"><div><h1 class="h1">Financeiro</h1><p>Receitas, comissões e despesas da agência ${soAdmin}</p></div>
    <div class="row" style="flex-wrap:wrap"><button class="btn s" type="button" data-ocultar>${ic(oculto ? 'eye' : 'eye-slash', 'i s')}${oculto ? 'Mostrar valores' : 'Ocultar valores'}</button>
    <button class="btn p" type="button" data-nova-tx>${ic('plus', 'i s')}Nova transação</button></div></header>
  <div class="filtros"><div class="seg" role="group" aria-label="Período"><button type="button" aria-pressed="true">Novembro</button><button type="button" aria-pressed="false">Trimestre</button><button type="button" aria-pressed="false">2026</button></div></div>
  <section class="kpis" aria-label="Números do mês">
    <div class="kpi"><span class="mono">Receita</span><b>${v('R$ 79 mil')}</b><span class="delta up">${ic('arrow-up-right', 'i s')} 11% sobre outubro</span></div>
    <div class="kpi"><span class="mono">Comissões</span><b>${v('R$ 11,8 mil')}</b><span class="delta up">${ic('arrow-up-right', 'i s')} 11% sobre outubro</span></div>
    <div class="kpi"><span class="mono">Despesas</span><b>${v('R$ 9,6 mil')}</b><span class="delta">3 lançamentos</span></div>
    <div class="kpi"><span class="mono">Lucro líquido</span><b>${v('R$ 69,4 mil')}</b><span class="delta">Margem de 88%</span></div>
  </section>
  <section class="card lv3 focus"><span class="ibox">${ic('clock')}</span>
    <div><span class="mono" style="color:var(--acct)">A receber</span><b class="h3">${v(brl(pend.reduce((s, t) => s + t.v, 0)))} em ${pend.length} pagamentos pendentes</b><p>O maior é o sinal do Grupo Jalapão, lançado há 14 dias.</p></div>
    <button class="btn p" type="button" data-ftx="pend">Ver pendentes</button></section>
  <div class="side2">
    <section class="viz"><div class="viz-h"><div><h2 class="h2">Últimos 6 meses</h2><span class="viz-s">Receita e comissões, em mil reais</span></div>
      <div class="legend"><span><i class="k1"></i>Receita</span><span><i class="k2"></i>Comissões</span></div></div>
      <div class="cols2">${MESES.map(m => `<div class="c" data-tip="${m[0]}|Receita R$ ${m[1]} mil · comissões R$ ${m[2]} mil"><span class="num">${oculto ? '' : m[1]}</span><div class="par"><i class="k1" style="height:${m[1] / max * 100}%"></i><i class="k2" style="height:${m[2] / max * 100}%"></i></div><small>${m[0]}</small></div>`).join('')}</div></section>
    <aside class="stack" style="gap:26px">
      <section class="stack" style="gap:12px"><div class="sec-h"><div><h2 class="h2">Por consultora</h2></div></div>
        <div class="hbars">${[['Mariana Lopes', 48.3], ['Rafael Lima', 21.4], ['Jéssica Prado', 9.3]].map(([n, x]) => `<span class="n">${n}</span><span class="t"><i style="width:${x / 48.3 * 100}%"></i></span><span class="v">${oculto ? '•••' : 'R$ ' + x.toLocaleString('pt-BR') + ' mil'}</span>`).join('')}</div></section>
      <section class="stack" style="gap:12px"><div class="sec-h"><div><h2 class="h2">Despesas</h2></div></div>
        <div class="segbar"><i class="k1" style="flex:6300"></i><i class="k2" style="flex:2400"></i><i class="k3" style="flex:890"></i></div>
        <div class="legend"><span><i class="k1"></i>Comissões da equipe <b>66%</b></span><span><i class="k2"></i>Marketing <b>25%</b></span><span><i class="k3"></i>Operacional <b>9%</b></span></div></section>
    </aside>
  </div>
  <section class="stack" style="gap:12px"><div class="sec-h wrap"><div><h2 class="h2">Lançamentos</h2></div>
    <div class="seg" data-seg-livre role="group" aria-label="Tipo">${[['todos', 'Tudo'], ['r', 'Receitas'], ['d', 'Despesas'], ['pend', 'Pendentes']].map(([k, t]) => `<button type="button" data-ftx="${k}" aria-pressed="${k === ftx}">${t}</button>`).join('')}</div></div>
    <table class="tbl rows"><thead><tr><th>Descrição</th><th>Categoria</th><th>Situação</th><th class="num">Valor</th></tr></thead><tbody>
    ${TX.filter(t => ftx === 'todos' || t.tp === ftx || (ftx === 'pend' && t.st === 'pend')).map(t => `<tr><td>${t.t}<br><small class="muted">${t.d}</small></td><td class="c2">${t.cat}</td>
      <td class="c3">${t.st === 'ok' ? '<span class="chip ok">Confirmado</span>' : '<span class="chip warn">Pendente</span>'}</td>
      <td class="num c5" style="color:${t.tp === 'r' ? 'var(--ok)' : 'var(--t)'}">${oculto ? '•••' : (t.tp === 'r' ? '+ ' : '− ') + brl(t.v)}</td></tr>`).join('')}</tbody></table></section>
  </div>`;
}

/* ═══ Equipe ═══ */
const TIME = [
  { n: 'Lucas Alves', av: 'LA', k: 'a2', e: 'lucas@exemplo.com', c: 'Administrador', ab: 0, fe: 0, ac: 'Hoje', st: 'ativo' },
  { n: 'Mariana Lopes', av: 'ML', k: '', e: 'mariana@exemplo.com', c: 'Comercial e consultoria', ab: 9, fe: 2, ac: 'Agora', st: 'ativo' },
  { n: 'Rafael Lima', av: 'RL', k: 'a4', e: 'rafael@exemplo.com', c: 'Gerente', ab: 6, fe: 1, ac: 'Hoje', st: 'ativo' },
  { n: 'Jéssica Prado', av: 'JP', k: 'a3', e: 'jessica@exemplo.com', c: 'Consultoria', ab: 4, fe: 1, ac: 'Ontem', st: 'ativo' },
  { n: 'beatriz@exemplo.com', av: 'B', k: 'a3', e: 'Convite enviado em 20 nov', c: 'Consultora', ab: 0, fe: 0, ac: '—', st: 'convite' }
];
const PERM = [
  ['Base de viajantes: cadastrar e consultar pessoas e famílias', 1, 1, 1, 1],
  ['Viagens · comercial: negociar, montar proposta e contrato', 1, 0, 1, 1],
  ['Viagens · preparação: roteiro, checklist, documentos e guia', 0, 1, 1, 1],
  ['Ver o trabalho de toda a equipe e reatribuir viagens', 0, 0, 1, 1],
  ['Financeiro da agência', 0, 0, 0, 1],
  ['Equipe, configurações e integrações', 0, 0, 0, 1]
];
function equipe() {
  return `<div id="eq" class="stack" style="gap:30px">
  <header class="ph"><div><h1 class="h1">Equipe</h1><p>${TIME.filter(t => t.st === 'ativo').length} pessoas ativas · 1 convite pendente ${soAdmin}</p></div>
    <button class="btn p" type="button" data-convidar>${ic('plus', 'i s')}Convidar pessoa</button></header>
  <table class="tbl rows"><thead><tr><th>Pessoa</th><th>Cargo</th><th class="num">Em negociação</th><th class="num">Fechadas no mês</th><th>Último acesso</th><th></th></tr></thead><tbody>
  ${TIME.map(t => `<tr><td><span class="row" style="gap:10px"><span class="av sm ${t.k}">${t.av}</span><span>${t.n}<br><small class="muted">${t.e}</small></span></span></td>
    <td class="c3">${t.st === 'convite' ? '<span class="chip warn">Convite pendente</span>' : `<span class="chip${t.c === 'Administrador' ? ' now' : ''}">${t.c}</span>`}</td>
    <td class="num c4">${t.st === 'convite' ? '—' : t.ab}</td><td class="num c5">${t.st === 'convite' ? '—' : t.fe}</td><td class="c2">${t.ac}</td>
    <td class="c6" style="text-align:right">${t.st === 'convite' ? '<button class="btn s" type="button" data-aviso="Convite reenviado">Reenviar</button>' : `<button class="mini" type="button" data-pessoa="${t.n}" aria-label="Opções de ${t.n}">${ic('dots-three', 'i s')}</button>`}</td></tr>`).join('')}
  </tbody></table>
  <section class="stack" style="gap:12px"><div class="sec-h"><div><h2 class="h2">O que cada cargo pode fazer</h2></div></div>
    <table class="tbl perm"><thead><tr><th></th><th>Comercial</th><th>Consultoria</th><th>Gerente</th><th>Administrador</th></tr></thead><tbody>
    ${PERM.map(p => `<tr><td>${p[0]}</td>${p.slice(1).map(x => `<td>${x ? `<span class="ok">${ic('check', 'i s')}</span>` : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></section>
  </div>`;
}
function convidar() {
  CRM.janela(`<form class="form" data-convite>
    <div class="sec-h"><div><span class="mono">Equipe</span><h2 class="h2">Convidar pessoa</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="fld"><label for="cv-e">E-mail</label><input id="cv-e" type="email" required placeholder="nome@exemplo.com"></div>
    <div class="fld"><span class="lbl">Cargo</span><div class="opcoes">${[['Comercial', 'Negocia as viagens: proposta, contrato e pagamento'], ['Consultoria', 'Prepara as viagens fechadas: roteiro, checklist e guia'], ['Gerente', 'Vê e reatribui o trabalho de toda a equipe'], ['Administrador', 'Tudo, incluindo financeiro e configurações']].map(([c, d], n) => `<label class="opcao"><input type="radio" name="cargo" value="${c}" ${n ? '' : 'checked'}><span><b>${c}</b><br><small class="muted">${d}</small></span></label>`).join('')}</div></div>
    <p class="muted" style="margin:0;font-size:13px">A pessoa recebe um e-mail para criar a senha. O convite vale por 7 dias.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="submit">Enviar convite</button></div></form>`);
}

/* ═══ Configurações ═══ */
const SECOES = [
  ['agencia', 'Agência e marca', 'identification-card'], ['checklists', 'Modelos de checklist', 'list-checks'], ['propostas', 'Modelos de proposta', 'file-text'], ['ia', 'Assistente de IA', 'sparkle'],
  ['integracoes', 'Integrações', 'link-simple'], ['captacao', 'Formulário de captação', 'clipboard-text'], ['notificacoes', 'Notificações', 'bell']
];
let secao = 'agencia', modelo = 0, modProp = 'pacote';
const INTEG = [
  ['Gmail', 'Enviar propostas e roteiros pelo e-mail da agência', 1, 'envelope-simple'], ['Google Drive', 'Buscar vouchers e PDFs direto do Drive', 1, 'folder-simple'],
  ['WhatsApp', 'Abrir conversas e registrar no histórico', 1, 'whatsapp-logo'], ['Asaas', 'Cobranças e links de pagamento', 0, 'currency-circle-dollar'],
  ['n8n', 'Receber vendas novas de outras ferramentas', 1, 'arrows-left-right'], ['Webhook', 'Avisar outros sistemas quando algo muda', 0, 'link-simple']
];
const MODELOS = [
  { n: 'Viagem nacional', it: 12, uso: 9, pad: 1, g: [['Documentos', ['Documento de identidade de todos', 'Taxas locais pagas']], ['Reservas', ['Passagens emitidas', 'Hospedagem confirmada', 'Passeios agendados']], ['Antes do embarque', ['Check-in online', 'Enviar roteiro final']]] },
  { n: 'Viagem internacional', it: 18, uso: 6, pad: 0, g: [['Documentos', ['Passaporte válido por 6 meses', 'Visto, se precisar', 'Vacinas exigidas']], ['Reservas', ['Passagens emitidas', 'Hospedagem confirmada']], ['Seguro e câmbio', ['Seguro viagem emitido', 'Cartão ou câmbio para a viagem']]] },
  { n: 'Lua de mel', it: 14, uso: 2, pad: 0, g: [['Detalhes', ['Avisar o hotel que é lua de mel', 'Jantar especial reservado']]] }
];
function conteudoSecao() {
  if (secao === 'agencia') return `<div class="form"><div class="linha"><div class="fld"><label for="cf-n">Nome da agência</label><input id="cf-n" value="O Segredo do Viajante"></div><div class="fld"><label for="cf-c">CNPJ</label><input id="cf-c" value="00.000.000/0001-00"></div></div>
    <div class="linha"><div class="fld"><label for="cf-w">WhatsApp de atendimento</label><input id="cf-w" value="(11) 90000-0000"></div><div class="fld"><label for="cf-i">Instagram</label><input id="cf-i" value="@osegredodoviajante"></div></div>
    <div class="fld"><span class="lbl">Logo no PDF e no roteiro do cliente</span><div class="logo-prev"><img src="img/logo-branco.svg" alt="Logo atual" class="logo-dark"><img src="img/logo-preto.svg" alt="Logo atual" class="logo-light"><button class="btn s" type="button">${ic('upload-simple', 'i s')}Trocar</button></div></div>
    <div class="fld"><label for="cf-r">Rodapé do PDF</label><textarea id="cf-r" rows="2">Roteiro preparado pela equipe O Segredo do Viajante. Valores sujeitos a disponibilidade.</textarea></div>
    <div class="row" style="justify-content:flex-end"><button class="btn p" type="button" data-aviso="Dados da agência salvos">Salvar</button></div></div>`;
  if (secao === 'checklists') { const m = MODELOS[modelo]; return `<div class="cfg-ck"><div class="stack" style="gap:4px">${MODELOS.map((x, i) => `<button type="button" class="md__i" data-modelo="${i}" ${i === modelo ? 'aria-current="true"' : ''}><span><b>${x.n}${x.pad ? ' · padrão' : ''}</b><small>${x.it} itens · usado em ${x.uso} viagens</small></span></button>`).join('')}
      <button class="link" type="button" style="padding:10px 12px">${ic('plus', 'i s')} Novo modelo</button></div>
    <div class="stack" style="gap:18px"><div class="sec-h"><div><h3 class="h2">${m.n}</h3></div><button class="btn s" type="button" data-aviso="O assistente sugeriu 4 itens novos para revisar">${ic('sparkle', 'i s')}Sugerir itens com IA</button></div>
      ${m.g.map(([g, its]) => `<section class="stack" style="gap:2px"><span class="mono">${g}</span>${its.map(t => `<div class="inrow"><span class="arrasta" aria-hidden="true">⋮⋮</span><div><input class="inline" value="${t}" aria-label="Item"></div><button class="mini" type="button" aria-label="Remover">${ic('x', 'i s')}</button></div>`).join('')}
        <button class="link" type="button" style="padding:8px 0">${ic('plus', 'i s')} Item em ${g}</button></section>`).join('')}
      <div class="row" style="justify-content:space-between;flex-wrap:wrap"><button class="link" type="button">${ic('plus', 'i s')} Nova seção</button><div class="row"><button class="btn s" type="button">Definir como padrão</button><button class="btn p" type="button" data-aviso="Modelo salvo">Salvar modelo</button></div></div></div></div>`; }
  if (secao === 'propostas') { const m = CRM.modelosProposta[modProp]; return `<div class="cfg-ck"><div class="stack" style="gap:4px">${Object.entries(CRM.modelosProposta).map(([k, x]) => `<button type="button" class="md__i" data-modprop="${k}" ${k === modProp ? 'aria-current="true"' : ''}><span><b>${x.n}</b><small>Assistência ${x.nivel}</small></span></button>`).join('')}
      <button class="link" type="button" style="padding:10px 12px">${ic('plus', 'i s')} Novo tipo de serviço</button></div>
    <div class="stack" style="gap:14px"><div class="sec-h"><div><h3 class="h2">${m.n}</h3></div></div>
      <p class="muted" style="margin:0">Estes textos preenchem toda proposta nova deste tipo. A consultora pode personalizar em cada proposta, sem mudar o modelo.</p>
      ${CRM.termosEditor({ ...m, custom: {} }, 'cfg', false)}
      <div class="row" style="justify-content:flex-end"><button class="btn p" type="button" data-aviso="Modelo de proposta salvo">Salvar modelo</button></div></div></div>`; }
  if (secao === 'ia') return `<div class="form"><div class="tip">${ic('sparkle')}<div><b>O Assistente usa a Biblioteca e estas orientações</b><br><span class="muted">Ele aparece na página da viagem e na Biblioteca. Tudo que ele cria passa por revisão.</span></div></div>
    <div class="linha"><div class="fld"><label for="ia-pv">Provedor</label><select id="ia-pv"><option>Anthropic</option><option>OpenAI</option><option>Google</option></select></div><div class="fld"><label for="ia-m">Modelo</label><select id="ia-m"><option>O mais capaz disponível</option><option>O mais rápido</option></select></div></div>
    <div class="fld"><label for="ia-k">Chave de acesso</label><div class="search" style="width:100%">${ic('lock-simple', 'i s')}<input id="ia-k" type="password" value="chave-de-exemplo" readonly><button class="btn s" type="button">Trocar</button></div><small class="muted">Guardada de forma segura. Só administradores veem esta tela.</small></div>
    <div class="fld"><label for="ia-o">Orientações para o Assistente</label><textarea id="ia-o" rows="4">Fale como a OSV: perto, prático, nunca elitista. Priorize milhas e economia sem perder conforto. Nunca invente preço: marque como "a confirmar".</textarea></div>
    <div class="row" style="justify-content:flex-end"><button class="btn p" type="button" data-aviso="Orientações salvas">Salvar</button></div></div>`;
  if (secao === 'integracoes') return `<div class="integ">${INTEG.map(([n, d, on, i]) => `<div class="integ__c"><span class="ibox">${ic(i)}</span><div><b>${n}</b><span class="muted">${d}</span></div>
    ${on ? `<span class="chip ok">Conectado</span><button class="btn s" type="button">Configurar</button>` : `<span class="chip">Desligado</span><button class="btn s" type="button" data-aviso="Abrindo a conexão com ${n}">Conectar</button>`}</div>`).join('')}</div>`;
  if (secao === 'captacao') return `<div class="form"><p class="muted" style="margin:0">O formulário que o cliente preenche no site ou na bio do Instagram. Cada resposta vira uma venda em Novo, com o próximo passo "Primeiro contato".</p>
    <div class="fld"><label for="cp-l">Link do formulário</label><div class="search" style="width:100%">${ic('link-simple', 'i s')}<input id="cp-l" readonly value="osv.app/planejar"><button class="btn s" type="button" data-aviso="Link copiado">${ic('copy', 'i s')}Copiar</button></div></div>
    <div class="fld"><span class="lbl">Perguntas</span>${['Nome e WhatsApp', 'Para onde quer ir', 'Quando e por quantos dias', 'Quantas pessoas', 'Orçamento aproximado', 'Tem milhas ou pontos?'].map((q, n) => `<label class="opcao"><input type="checkbox" ${n < 5 ? 'checked' : ''} ${n < 2 ? 'disabled' : ''}><span>${q}${n < 2 ? ' <small class="muted">· obrigatória</small>' : ''}</span></label>`).join('')}</div>
    <div class="fld"><label for="cp-r">Distribuir as vendas novas</label><select id="cp-r"><option>Em rodízio entre as consultoras</option><option>Tudo para uma pessoa</option><option>Sem responsável (a gerente distribui)</option></select></div>
    <div class="row" style="justify-content:flex-end"><button class="btn p" type="button" data-aviso="Formulário salvo">Salvar</button></div></div>`;
  return `<div class="stack" style="gap:2px">${[['Venda nova chegou', 1, 1], ['Tarefa vence hoje', 1, 0], ['Cliente sem contato há 5 dias', 1, 0], ['Embarque em 7 dias', 1, 1], ['Pagamento confirmado', 0, 1]].map(([t, a, b]) => `<div class="inrow"><div><span>${t}</span></div>
    <span class="row" style="gap:18px"><span class="row" style="gap:8px;font-size:13px">No app <button type="button" class="sw" role="switch" aria-checked="${!!a}" aria-label="${t} no app"><i></i></button></span><span class="row" style="gap:8px;font-size:13px">E-mail <button type="button" class="sw" role="switch" aria-checked="${!!b}" aria-label="${t} por e-mail"><i></i></button></span></span></div>`).join('')}</div>`;
}
function configuracoes() {
  const s = SECOES.find(x => x[0] === secao);
  return `<div id="cfg" class="stack" style="gap:26px">
  <header class="ph"><div><h1 class="h1">Configurações</h1><p>Agência, modelos, Assistente e integrações ${soAdmin}</p></div></header>
  <div class="cfg"><nav class="cfg__nav" aria-label="Seções">${SECOES.map(([k, t, i]) => `<button type="button" data-secao="${k}" ${k === secao ? 'aria-current="true"' : ''}>${ic(i, 'i s')}${t}</button>`).join('')}</nav>
    <section class="cfg__c stack" style="gap:20px"><h2 class="h2">${s[1]}</h2>${conteudoSecao()}</section></div></div>`;
}

CRM.telas.financeiro = { render: financeiro, depois(r) { r.querySelector('#fin').addEventListener('click', e => {
  if (e.target.closest('[data-ocultar]')) { oculto = !oculto; CRM.render(); }
  const f = e.target.closest('[data-ftx]'); if (f) { ftx = f.dataset.ftx; CRM.render(); }
  if (e.target.closest('[data-nova-tx]')) CRM.janela(`<form class="form" data-tx><div class="sec-h"><div><span class="mono">Financeiro</span><h2 class="h2">Nova transação</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="seg" role="group" aria-label="Tipo"><button type="button" aria-pressed="true">Receita</button><button type="button" aria-pressed="false">Despesa</button></div>
    <div class="fld"><label for="tx-t">Descrição</label><input id="tx-t" required placeholder="Ex.: Comissão do hotel"></div>
    <div class="linha"><div class="fld"><label for="tx-v">Valor</label><input id="tx-v" inputmode="numeric" required placeholder="R$ 0"></div><div class="fld"><label for="tx-c">Categoria</label><select id="tx-c"><option>Pacote</option><option>Comissão</option><option>Operacional</option><option>Marketing</option></select></div></div>
    <div class="linha"><div class="fld"><label for="tx-v2">Venda ou viagem</label><input id="tx-v2" placeholder="Opcional"></div><div class="fld"><label for="tx-s">Situação</label><select id="tx-s"><option>Confirmado</option><option>Pendente</option></select></div></div>
    <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="submit">Salvar</button></div></form>`);
}); } };
CRM.telas.equipe = { render: equipe, depois(r) { r.querySelector('#eq').addEventListener('click', e => {
  if (e.target.closest('[data-convidar]')) convidar();
  const p = e.target.closest('[data-pessoa]');
  if (p) CRM.janela(`<div class="sec-h"><div><h2 class="h2">${esc(p.dataset.pessoa)}</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="stack" style="gap:8px">${[['user-gear', 'Mudar cargo'], ['arrows-left-right', 'Passar as viagens para outra pessoa'], ['lock-simple', 'Bloquear acesso'], ['trash', 'Remover da equipe']].map(([i, t]) => `<button type="button" class="tip assist-op" data-fechar>${ic(i)}<div><b>${t}</b></div></button>`).join('')}</div>`);
}); } };
CRM.alvoTermos.cfg = { termos: () => CRM.modelosProposta[modProp], padrao: () => CRM.modelosProposta[modProp], depois: re => { if (re) CRM.render(); } };
CRM.modelosProposta && Object.values(CRM.modelosProposta).forEach(m => { m.custom = m.custom || {}; });
CRM.telas.config = { render: configuracoes, depois(r) { r.querySelector('#cfg').addEventListener('click', e => {
  const s = e.target.closest('[data-secao]'); if (s) { secao = s.dataset.secao; CRM.render(); }
  const m = e.target.closest('[data-modelo]'); if (m) { modelo = +m.dataset.modelo; CRM.render(); }
  const mp = e.target.closest('[data-modprop]'); if (mp) { modProp = mp.dataset.modprop; CRM.render(); }
  const w = e.target.closest('.sw'); if (w) w.setAttribute('aria-checked', w.getAttribute('aria-checked') !== 'true');
}); } };

document.addEventListener('click', e => { const a = e.target.closest('[data-aviso]'); if (a) CRM.aviso(a.dataset.aviso); });
document.addEventListener('submit', e => {
  if (e.target.matches('[data-convite]')) { e.preventDefault(); const em = e.target.querySelector('#cv-e').value.trim(); CRM.fechar(); CRM.aviso('Convite enviado para ' + em); }
  if (e.target.matches('[data-tx]')) {
    e.preventDefault(); const f = e.target;
    TX.unshift({ d: '24 nov', t: esc(f.querySelector('#tx-t').value.trim()), cat: f.querySelector('#tx-c').value, tp: f.querySelector('.seg [aria-pressed=true]').textContent === 'Receita' ? 'r' : 'd', v: parseInt(f.querySelector('#tx-v').value.replace(/\D/g, '')) || 0, st: f.querySelector('#tx-s').value === 'Pendente' ? 'pend' : 'ok' });
    CRM.fechar(); CRM.render(); CRM.aviso('Transação salva');
  }
});
}
