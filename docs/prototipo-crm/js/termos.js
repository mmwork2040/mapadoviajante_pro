/* Termos da proposta: incluso, não incluso, responsabilidades e assistência.
   Modelos por tipo de serviço (editáveis em Configurações) e cópia editável em cada proposta. */
{
const ic = CRM.ic;
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const clone = o => JSON.parse(JSON.stringify(o));

const SECS = [
  ['inc', 'O que está incluso', 'check'], ['nao', 'O que não está incluso', 'x'],
  ['cli', 'Responsabilidades do cliente', 'user'], ['osv', 'Responsabilidades da OSV', 'shield-check'], ['ass', 'Assistência', 'phone']
];

const MODELOS = {
  passagem: { n: 'Só passagem aérea', nivel: 'Essencial', resumo: 'Suporte até o embarque, em horário comercial', sec: {
    inc: ['Pesquisa da melhor combinação de milhas e tarifa', 'Emissão das passagens e envio do localizador', 'Marcação de assentos quando a tarifa permitir', 'Aviso de mudanças feitas pela companhia até o embarque'],
    nao: ['Hospedagem, transfers, passeios e ingressos', 'Bagagem despachada, quando a tarifa não incluir', 'Seguro viagem', 'Vistos, taxas de documentos e vacinas', 'Remarcação ou cancelamento pedidos pelo cliente, que seguem as regras e custos da companhia', 'Assistência durante a viagem'],
    cli: ['Conferir os nomes exatamente como estão no documento', 'Ter passaporte válido e os vistos exigidos pelo destino', 'Fazer o check-in online e chegar ao aeroporto no horário indicado', 'Respeitar as regras de bagagem da tarifa escolhida', 'Avisar a OSV sobre qualquer mudança de planos'],
    osv: ['Emitir no prazo combinado depois do pagamento', 'Enviar localizador e comprovantes por escrito', 'Orientar sobre bagagem, documentos e conexões', 'Repassar as alterações da companhia que chegarem até nós'],
    ass: ['WhatsApp de segunda a sexta, das 9h às 18h, até o dia do embarque', 'Resposta em até 1 dia útil', 'Durante a viagem, o atendimento é feito direto pela companhia aérea'] } },
  aereo_hotel: { n: 'Passagem e hospedagem', nivel: 'Completa até o embarque', resumo: 'Suporte até o embarque e apoio em emergências durante a viagem', sec: {
    inc: ['Passagens aéreas com milhas ou tarifa', 'Hospedagem nas datas da proposta', 'Escolha de quarto e pedidos especiais ao hotel', 'Lista de documentos e checklist da viagem'],
    nao: ['Transfers e passeios, salvo se listados na opção', 'Refeições não incluídas pelo hotel', 'Seguro viagem, salvo se listado na opção', 'Taxas locais cobradas no hotel', 'Despesas pessoais'],
    cli: ['Conferir nomes, datas e quartos antes da emissão', 'Ter documentos válidos para todos os viajantes', 'Pagar taxas locais e cauções exigidas pelo hotel', 'Seguir horários de check-in e check-out'],
    osv: ['Emitir e reservar no prazo combinado', 'Confirmar a reserva com o hotel antes do embarque', 'Enviar vouchers e localizadores organizados', 'Ajudar a resolver problemas com voo ou hotel'],
    ass: ['WhatsApp de segunda a sábado, das 9h às 20h, até o embarque', 'Durante a viagem: apoio em emergências com voo ou hotel', 'Resposta em até 4 horas em dias úteis'] } },
  pacote: { n: 'Pacote completo', nivel: 'Total', resumo: 'Do planejamento à volta, com plantão durante a viagem', sec: {
    inc: ['Roteiro completo dia a dia, com o guia da viagem da OSV', 'Passagens, hospedagem, transfers e passeios listados na opção', 'Uso das suas milhas e pontos para reduzir o custo', 'Checklist de documentos e preparação', 'Reunião de alinhamento antes do embarque'],
    nao: ['Refeições não citadas na opção', 'Vistos, passaporte e vacinas', 'Gastos pessoais, compras e gorjetas', 'Mudanças pedidas pelo cliente depois da emissão, que seguem as regras de cada fornecedor'],
    cli: ['Ter passaporte válido por 6 meses e os vistos de todos os viajantes', 'Conferir o roteiro e os nomes antes das emissões', 'Seguir os horários do roteiro e dos fornecedores', 'Contratar ou aceitar o seguro viagem indicado', 'Informar restrições de saúde e alimentação'],
    osv: ['Montar e revisar o roteiro com você até a aprovação', 'Emitir e reservar tudo no prazo combinado', 'Enviar o guia da viagem e os vouchers antes do embarque', 'Acompanhar a viagem e resolver imprevistos com os fornecedores'],
    ass: ['WhatsApp de segunda a sábado, das 9h às 20h, durante o planejamento', 'Plantão 24 horas para emergências durante a viagem', 'Mensagem de acompanhamento em cada etapa da viagem'] } },
  consultoria: { n: 'Consultoria de roteiro', nivel: 'Planejamento', resumo: 'Planejamento do roteiro; as emissões ficam com o cliente', sec: {
    inc: ['Reunião de entendimento do perfil e do orçamento', 'Roteiro dia a dia com sugestões de hotéis, passeios e restaurantes', 'Estratégia de milhas e pontos para as emissões', 'Até 2 rodadas de ajustes no roteiro'],
    nao: ['Emissão de passagens, reservas e ingressos', 'Pagamento a fornecedores', 'Assistência durante a viagem'],
    cli: ['Fazer as emissões e reservas indicadas', 'Conferir preços e disponibilidade no momento da compra', 'Ter documentos válidos para a viagem'],
    osv: ['Entregar o roteiro no prazo combinado', 'Explicar cada sugestão e a estratégia de milhas', 'Fazer os ajustes combinados'],
    ass: ['WhatsApp em horário comercial durante o planejamento', 'Suporte por 30 dias depois da entrega do roteiro'] } }
};
CRM.modelosProposta = MODELOS;
CRM.secsProposta = SECS;
CRM.novosTermos = tipo => ({ tipo, ...clone(MODELOS[tipo]), custom: {} });

/* Editor dos termos. alvo = { termos, padrao: () => modelo, depois: () => void } registrado em CRM.alvoTermos[escopo] */
CRM.alvoTermos = {};
CRM.termosEditor = (t, escopo, mostrarPadrao = true) => `<div class="termos" data-escopo="${escopo}">
  ${SECS.map(([k, titulo, i]) => `<details class="termo" ${k === 'inc' || k === 'ass' ? 'open' : ''}><summary>${ic(i, 'i s')}<b>${titulo}</b><span class="muted">${t.sec[k].length}</span>
      ${mostrarPadrao ? (t.custom[k] ? '<span class="chip now">Personalizado</span>' : '<span class="chip">Padrão</span>') : ''}${ic('caret-down', 'i s seta')}</summary>
    ${k === 'ass' ? `<div class="linha" style="margin:4px 0 6px"><div class="fld"><label>Nível</label><input data-nivel value="${esc(t.nivel)}"></div><div class="fld"><label>Resumo</label><input data-resumo value="${esc(t.resumo)}"></div></div>` : ''}
    ${t.sec[k].map((x, n) => `<div class="termo__i"><span class="arrasta" aria-hidden="true">⋮⋮</span><input class="inline" data-sec="${k}" data-i="${n}" value="${esc(x)}" aria-label="${titulo}, item ${n + 1}"><button class="mini" type="button" data-rm="${k}:${n}" aria-label="Remover">${ic('x', 'i s')}</button></div>`).join('')}
    <div class="row" style="justify-content:space-between;padding-top:6px"><button class="link" type="button" data-add-termo="${k}">${ic('plus', 'i s')} Item</button>
      ${mostrarPadrao && t.custom[k] ? `<button class="link perder" type="button" data-padrao="${k}">Voltar ao padrão</button>` : ''}</div>
  </details>`).join('')}</div>`;

/* Versão do cliente */
CRM.termosCliente = t => `<section class="saber stack" style="gap:22px"><h2 class="h2">O que você precisa saber</h2>
  <div class="assist"><span class="ibox">${ic('phone')}</span><div><span class="mono">Nível de assistência</span><b class="h3">${esc(t.nivel)}</b><span class="muted">${esc(t.resumo)}</span>
    <ul>${t.sec.ass.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
  <div class="two">${[['inc', 'Está incluso', 'check', 'ok'], ['nao', 'Não está incluso', 'x', 'muted']].map(([k, tt, i, c]) => `<div class="stack" style="gap:10px"><h3 class="h3">${tt}</h3><ul class="lista-t">${t.sec[k].map(x => `<li><span class="${c}">${ic(i, 'i s')}</span>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
  <div class="two">${[['cli', 'O que fica com você'], ['osv', 'O que fica com a gente']].map(([k, tt]) => `<div class="stack" style="gap:10px"><h3 class="h3">${tt}</h3><ul class="lista-t">${t.sec[k].map(x => `<li><span class="muted">${ic('caret-right', 'i s')}</span>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
</section>`;

/* Eventos do editor, para qualquer escopo registrado */
const alvoDe = el => { const e = el.closest('[data-escopo]'); return e && CRM.alvoTermos[e.dataset.escopo]; };
document.addEventListener('change', e => {
  const a = alvoDe(e.target); if (!a) return;
  const t = a.termos();
  if (e.target.matches('[data-sec]')) { t.sec[e.target.dataset.sec][+e.target.dataset.i] = e.target.value.trim(); t.custom[e.target.dataset.sec] = 1; }
  else if (e.target.matches('[data-nivel]')) { t.nivel = e.target.value.trim(); t.custom.ass = 1; }
  else if (e.target.matches('[data-resumo]')) { t.resumo = e.target.value.trim(); t.custom.ass = 1; }
  else return;
  a.depois(false);
});
document.addEventListener('click', e => {
  const a = alvoDe(e.target); if (!a) return;
  const t = a.termos();
  const rm = e.target.closest('[data-rm]'); if (rm) { const [k, n] = rm.dataset.rm.split(':'); t.sec[k].splice(+n, 1); t.custom[k] = 1; a.depois(true); return; }
  const ad = e.target.closest('[data-add-termo]'); if (ad) { const k = ad.dataset.addTermo; t.sec[k].push(''); t.custom[k] = 1; a.depois(true, k); return; }
  const pd = e.target.closest('[data-padrao]'); if (pd) { const k = pd.dataset.padrao, m = a.padrao(); t.sec[k] = clone(m.sec[k]); if (k === 'ass') { t.nivel = m.nivel; t.resumo = m.resumo; } delete t.custom[k]; a.depois(true); CRM.aviso('Seção voltou ao texto padrão'); }
});
}
