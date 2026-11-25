/* Tela Hoje: painel da consultora. Dados de exemplo. */
{
const ic=CRM.ic;
/* ── Dados de exemplo ── */
const AGENDA=[
  {late:1,h:'Ontem',tipo:'Tarefa',ic:'file-text',t:'Enviar proposta de Orlando',c:'Carla Mendes',v:'Venda · Negociando'},
  {h:'09:00',tipo:'Ligação',ic:'phone',t:'Confirmar datas de Lisboa e Porto',c:'Família Andrade',v:'Venda · Contatado',done:1},
  {h:'10:30',tipo:'Reunião',ic:'users-three',t:'Apresentar o roteiro do Peru',c:'Rafael e Bia',v:'Viagem · Em andamento'},
  {h:'14:00',tipo:'Checklist',ic:'check-square',t:'Emitir seguro viagem',c:'Família Souza',v:'Viagem · Noronha'},
  {h:'16:00',tipo:'WhatsApp',ic:'whatsapp-logo',t:'Retorno sobre hotel em Paris',c:'Juliana Prado',v:'Venda · Negociando'},
  {h:'17:30',tipo:'Documento',ic:'clipboard-text',t:'Conferir passaportes do grupo',c:'Grupo Jalapão',v:'Viagem · Em andamento'}
];
const PARADAS=[
  {id:'v5',c:'Bruno Costa',av:'BC',k:'a2',d:'Santiago',e:'Contatado',dias:6,v:'R$ 14.800'},
  {id:'v9',c:'Ana Ribeiro',av:'AR',k:'a3',d:'Maldivas',e:'Negociando',dias:5,v:'R$ 62.000'},
  {id:'v1',c:'Diego Alves',av:'DA',k:'a4',d:'Buenos Aires',e:'Novo',dias:3,v:'R$ 9.500',sem:1}
];
const EMBARQUES=[
  {img:'viagem-noronha.jpg',c:'Família Souza',d:'Fernando de Noronha',dt:'12 a 19 dez',dias:18,ck:[9,12]},
  {img:'viagem-peru.jpg',c:'Rafael e Bia',d:'Cusco e Machu Picchu',dt:'8 a 18 jan',dias:45,ck:[5,14]},
  {img:'viagem-jalapao.jpg',c:'Grupo Jalapão',d:'Jalapão, Tocantins',dt:'20 a 25 jan',dias:57,ck:[3,10]},
  {img:'viagem-praia.jpg',c:'Patrícia Gomes',d:'Curaçao',dt:'2 a 9 fev',dias:70,ck:[1,12]}
];

/* ── Tela: Hoje ── */
CRM.telas.hoje={titulo:'Hoje',render(){
  const pend=AGENDA.filter(a=>!a.done&&!a.late).length,late=AGENDA.filter(a=>a.late).length;
  const V=CRM.vendas||[],soma=e=>V.filter(v=>v.e===e).reduce((s,v)=>s+v.v,0),qtd=e=>V.filter(v=>v.e===e).length;
  const FUNIL=[{t:'Novo',e:'novo'},{t:'Contatado',e:'contatado'},{t:'Negociando',e:'negociando'},{t:'Fechado no mês',e:'fechado'},{t:'Perdido no mês',e:'perdido',mute:1}].map(f=>({...f,n:qtd(f.e),v:Math.round(soma(f.e)/100)/10}));
  const neg=soma('negociando'),abertas=qtd('novo')+qtd('contatado')+qtd('negociando');
  const max=Math.max(...FUNIL.map(f=>f.v));
  return `
  <header class="ph">
    <div><span class="mono">Terça, 24 de novembro</span><h1 class="h1">Bom dia, Mariana</h1><p>Você tem <b>${pend} compromissos</b> hoje e <b>${late} atrasado</b>.</p></div>
  </header>

  <section class="card lv3 focus" aria-label="Comece por aqui">
    <span class="ibox">${ic('warning')}</span>
    <div><span class="mono" style="color:var(--acct)">Comece por aqui</span><b class="h3">A proposta de Orlando da Carla venceu ontem</b><p>Ela está em Negociando há 4 dias. Enviar hoje mantém a venda quente.</p></div>
    <button class="btn p" type="button" data-venda="v3">Abrir ${ic('arrow-right','i s')}</button>
  </section>

  <section class="kpis" aria-label="Seus números do mês">
    <div class="kpi"><span class="mono">Vendido em novembro</span><b>R$ 48,3 mil</b><span class="delta up">${ic('arrow-up-right','i s')} 12% sobre outubro</span></div>
    <div class="kpi"><span class="mono">Em negociação</span><b>R$ ${Math.round(neg/1000)} mil</b><span class="delta">${qtd('negociando')} vendas · ${abertas} abertas no total</span></div>
    <div class="kpi"><span class="mono">Conversão em 90 dias</span><b>28%</b><span class="delta">7 fechadas de 25</span></div>
    <div class="kpi"><span class="mono">Embarques em 60 dias</span><b>3</b><span class="delta">18 dias para o próximo</span></div>
  </section>

  <div class="side2">
    <div class="stack" style="gap:30px">
      <section class="stack" aria-labelledby="ag-t">
        <div class="sec-h wrap"><div><h2 class="h2" id="ag-t">Agenda</h2></div>
          <div class="seg" role="group" aria-label="Período"><button aria-pressed="true">Hoje · 6</button><button aria-pressed="false">Amanhã · 4</button><button aria-pressed="false">Semana · 18</button></div>
        </div>
        <div>${AGENDA.map(a=>`
          <div class="ag${a.late?' late':''}">
            <time>${a.h}<small>${a.tipo}</small></time>
            <div class="bd"><b style="${a.done?'text-decoration:line-through;color:var(--tm)':''}">${a.t}</b>
              <span>${ic(a.ic,'i s')}${a.c} · ${a.v}${a.late?' <span class="chip bad">Atrasada</span>':''}${a.done?' <span class="chip ok">Feito</span>':''}</span></div>
            <div class="acts">${a.done?'':`<button class="mini" type="button" aria-label="Chamar ${a.c} no WhatsApp">${ic('whatsapp-logo','i s')}</button><button class="mini done" type="button" aria-label="Concluir">${ic('check','i s')}</button>`}</div>
          </div>`).join('')}
        </div>
        <a class="link" href="#agenda">Ver agenda completa →</a>
      </section>

      <section class="stack" aria-labelledby="pa-t">
        <div class="sec-h"><div><h2 class="h2" id="pa-t">Negociações sem resposta</h2></div><a class="link" href="#vendas">Ver comercial →</a></div>
        <table class="tbl rows">
          <thead><tr><th>Cliente</th><th>Destino</th><th>Etapa</th><th class="num">Valor</th><th class="num">Sem contato</th><th><span class="proto" style="position:absolute;left:-9999px">Ação</span></th></tr></thead>
          <tbody>${PARADAS.map(p=>`
            <tr data-venda="${p.id}" style="cursor:pointer"><td><span class="row" style="gap:10px"><span class="av sm ${p.k}">${p.av}</span>${p.c}</span></td><td class="c2">${p.d}</td>
            <td class="c3"><span class="chip${p.sem?' now':''}">${p.e}</span></td><td class="num c4">${p.v}</td>
            <td class="num c5"><b style="color:${p.dias>=5?'var(--bad)':'var(--t)'}">${p.dias} dias</b></td>
            <td class="c6" style="text-align:right"><button class="mini" type="button" aria-label="Chamar ${p.c} no WhatsApp">${ic('whatsapp-logo','i s')}</button></td></tr>`).join('')}
          </tbody>
        </table>
      </section>
    </div>

    <aside class="stack" style="gap:30px">
      <section class="stack" aria-labelledby="fu-t">
        <div class="sec-h"><div><h2 class="h2" id="fu-t">Seu funil</h2></div></div>
        <div class="funnel">${FUNIL.map(f=>`
          <a href="#vendas"><span>${f.t}<br><small class="muted">R$ ${f.v.toLocaleString('pt-BR')} mil</small></span><span class="t"><i style="width:${f.v/max*100}%;${f.mute?'background:var(--c0)':''}"></i></span><b>${f.n}</b></a>`).join('')}
        </div>
      </section>

      <section class="stack" aria-labelledby="em-t">
        <div class="sec-h"><div><h2 class="h2" id="em-t">Próximos embarques</h2></div></div>
        <div>${EMBARQUES.map(e=>`
          <a class="trip" href="${e.c==='Família Souza'?'#viagem':'#viagens'}"><img src="img/${e.img}" alt=""><div><b>${e.c}</b><span>${e.d} · ${e.dt}</span>
            <span class="row" style="gap:8px;margin-top:4px"><span class="bar" style="width:90px"><i style="width:${e.ck[0]/e.ck[1]*100}%"></i></span><small class="muted">${e.ck[0]}/${e.ck[1]} itens</small></span></div>
            <div class="d"><strong>${e.dias}</strong><small>dias</small></div></a>`).join('')}
        </div>
      </section>
    </aside>
  </div>`;
}};
}
