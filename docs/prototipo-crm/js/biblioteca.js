/* Tela Biblioteca: base de conteúdo da agência. Cria a partir de PDF ou com IA, sempre com revisão. Dados de exemplo. */
{
const ic = CRM.ic;
const TIPOS = { roteiro: ['Roteiro modelo', 'map-pin'], exp: ['Experiência', 'star'], pacote: ['Pacote', 'suitcase-rolling'], doc: ['Documento', 'file-pdf'] };
const ORIGEM = { pdf: ['Lido de PDF', 'file-pdf'], ia: ['Criado com IA', 'sparkle'], manual: ['Manual', 'pencil-simple'] };
const ITENS = [
  { id: 1, tp: 'roteiro', t: 'Noronha em 7 dias para família', d: 'Fernando de Noronha', dias: 7, img: 'viagem-noronha.jpg', o: 'pdf', uso: 3, tags: ['Família', 'Praia', 'Mergulho'] },
  { id: 2, tp: 'roteiro', t: 'Peru clássico: Cusco e Machu Picchu', d: 'Peru', dias: 9, img: 'viagem-peru.jpg', o: 'ia', uso: 2, tags: ['Aventura', 'Altitude'] },
  { id: 3, tp: 'roteiro', t: 'Lisboa e Porto em 10 dias', d: 'Portugal', dias: 10, img: '', o: 'ia', uso: 0, tags: ['Família', 'Cultura'], rev: 1 },
  { id: 4, tp: 'exp', t: 'Passeio de 4x4 pelo Jalapão', d: 'Jalapão, Tocantins', dias: 1, img: 'viagem-jalapao.jpg', o: 'manual', uso: 4, tags: ['Aventura', 'Grupo'] },
  { id: 5, tp: 'exp', t: 'Ilhatour com guia local', d: 'Fernando de Noronha', dias: 1, img: '', o: 'pdf', uso: 5, tags: ['Família'] },
  { id: 6, tp: 'pacote', t: 'Curaçao para casais · 7 noites', d: 'Curaçao', dias: 8, img: 'viagem-praia.jpg', o: 'pdf', uso: 1, tags: ['Casal', 'Praia', 'Resort'], preco: 'A partir de R$ 14.900' },
  { id: 7, tp: 'doc', t: 'Regras de bagagem das companhias aéreas', d: 'Geral', img: '', o: 'manual', uso: 0, tags: ['Voo'], pag: 6 },
  { id: 8, tp: 'doc', t: 'Documentos para viajar à Europa', d: 'Europa', img: '', o: 'manual', uso: 0, tags: ['Documentos'], pag: 3 }
];
let filtro = 'todos', vista = 'a', ultimo = { o: 'ia', t: 'Novo roteiro', d: 'A confirmar' };
try { vista = localStorage.getItem('crm-opc-biblioteca') || 'a'; } catch (e) {}
const VISTAS = { a: ['Capas', 'squares-four'], b: ['Lista', 'rows'] };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const capa = i => i.img ? `<img src="img/${i.img}" alt="">` : `<span class="capa-vazia">${ic(TIPOS[i.tp][1])}</span>`;
const meta = i => [i.d, i.dias ? i.dias + (i.dias > 1 ? ' dias' : ' dia') : i.pag ? i.pag + ' páginas' : ''].filter(Boolean).join(' · ');

function cartoes(l) {
  return `<div class="capas">${l.map(i => `<button type="button" class="vcapa bib" data-bib="${i.id}">
    <div class="vcapa__m" style="aspect-ratio:3/2">${capa(i)}<span class="vcapa__shade"></span><span class="selo">${TIPOS[i.tp][0]}</span>
      ${i.rev ? '<span class="selo selo--rev">Revisar</span>' : ''}</div>
    <div class="vcapa__t"><b>${esc(i.t)}</b><span>${meta(i)}</span>
      <span class="bib__o">${ic(ORIGEM[i.o][1], 'i s')}${ORIGEM[i.o][0]}${i.uso ? ` · usado em ${i.uso} ${i.uso > 1 ? 'viagens' : 'viagem'}` : ''}</span></div></button>`).join('')}</div>`;
}
function linhas(l) {
  return `<table class="tbl rows"><thead><tr><th>Título</th><th>Tipo</th><th>Origem</th><th class="num">Uso</th></tr></thead><tbody>
    ${l.map(i => `<tr data-bib="${i.id}" style="cursor:pointer"><td>${esc(i.t)}<br><small class="muted">${meta(i)}</small></td><td class="c3"><span class="chip">${TIPOS[i.tp][0]}</span></td>
      <td class="c2">${ORIGEM[i.o][0]}${i.rev ? ' <span class="chip warn">Revisar</span>' : ''}</td><td class="num c5">${i.uso || '—'}</td></tr>`).join('')}</tbody></table>`;
}

/* Criar a partir de PDF: enviar → ler → revisar → salvar */
function pdf(nome) {
  if (!nome) {
    return CRM.janela(`<div class="sec-h"><div><span class="mono">Biblioteca</span><h2 class="h2">Criar a partir de um PDF</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
      <p class="muted" style="margin:0">Roteiros de operadoras, vouchers, catálogos de pacotes. A IA lê o arquivo, separa os dias, as experiências e as fotos, e você revisa antes de salvar.</p>
      <label class="soltar">${ic('upload-simple')}<b>Solte o PDF aqui ou clique para escolher</b><span class="muted">Até 20 MB · pode enviar vários de uma vez</span><input type="file" accept="application/pdf" multiple class="sr" data-pdf-input></label>
      <button class="link" type="button" data-pdf-exemplo style="align-self:center">Sem arquivo à mão? Usar o exemplo Roteiro_Lisboa_Porto.pdf</button>`);
  }
  CRM.janela(`<div class="sec-h"><div><span class="mono">Lendo o PDF</span><h2 class="h2">${esc(nome)}</h2></div></div>
    <div class="lendo">${['Lendo as páginas', 'Separando os dias', 'Encontrando experiências e fotos'].map((t, n) => `<div class="lendo__p" style="animation-delay:${n * .5}s">${ic('check', 'i s')}${t}</div>`).join('')}</div>
    <div class="stack" style="gap:8px"><div class="skel" style="height:18px;width:70%"></div><div class="skel" style="height:14px"></div><div class="skel" style="height:14px;width:85%"></div></div>`);
  const ex = nome === 'Roteiro_Lisboa_Porto.pdf';
  setTimeout(() => revisar({ o: 'pdf', nome, ex, t: ex ? 'Lisboa e Porto em 10 dias' : nome.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), d: ex ? 'Portugal' : 'A confirmar' }), 1700);
}

/* Criar com IA: descrever → gerar → revisar → salvar */
function ia(texto = '') {
  CRM.janela(`<form class="form" data-ia>
    <div class="sec-h"><div><span class="mono">Biblioteca</span><h2 class="h2">Criar com IA</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="fld"><span class="lbl">O que criar</span><div class="chips">${['roteiro', 'exp', 'pacote'].map((k, n) => `<label class="opcao opcao--chip"><input type="radio" name="tp" value="${k}" ${n ? '' : 'checked'}><span>${TIPOS[k][0]}</span></label>`).join('')}</div></div>
    <div class="fld"><label for="ia-txt">Descreva</label><textarea id="ia-txt" rows="3" required placeholder="Ex.: roteiro de 7 dias em Santiago no inverno para casal, com neve e vinícolas">${esc(texto)}</textarea></div>
    <div class="linha"><div class="fld"><label for="ia-d">Duração</label><select id="ia-d"><option>Escolher pela IA</option><option>3 a 5 dias</option><option selected>6 a 8 dias</option><option>9 a 14 dias</option></select></div>
      <div class="fld"><label for="ia-p">Perfil</label><select id="ia-p"><option>Casal</option><option>Família com crianças</option><option>Grupo</option><option>Sozinho</option></select></div></div>
    <label class="opcao"><input type="checkbox" checked><span>Usar experiências e hotéis que já estão na biblioteca</span></label>
    <label class="opcao"><input type="checkbox" checked><span>Seguir o jeito OSV: milhas, conforto e economia</span></label>
    <div class="row" style="justify-content:flex-end"><button class="btn s" type="button" data-fechar>Cancelar</button><button class="btn p" type="submit">${ic('sparkle', 'i s')}Gerar</button></div></form>`);
}

function revisar(r) {
  const dias = r.ex ? ['Chegada em Lisboa e Alfama', 'Belém e Jerónimos', 'Sintra e Cascais', 'Óbidos a caminho do Porto', 'Ribeira e caves do vinho do Porto', 'Vale do Douro', 'Volta'] : ['Chegada e reconhecimento', 'Passeio principal da cidade', 'Experiência local', 'Dia de natureza', 'Gastronomia e compras', 'Dia livre com sugestões', 'Volta'];
  CRM.janela(`<div class="sec-h"><div><span class="mono">${r.o === 'pdf' ? 'Lido de ' + esc(r.nome) : 'Gerado com IA'} · revise antes de salvar</span><h2 class="h2">${esc(r.t)}</h2></div><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="tip">${ic('sparkle')}<div><b>${r.o === 'pdf' ? 'Encontrei 10 dias, 6 experiências e 4 fotos' : 'Montei 7 dias com 3 experiências que já estão na biblioteca'}</b><br><span class="muted">Confira nomes, horários e valores. Nada vai para um cliente sem passar por você.</span></div></div>
    <div class="linha"><div class="fld"><label for="rv-t">Título</label><input id="rv-t" value="${esc(r.t)}"></div><div class="fld"><label for="rv-d">Destino</label><input id="rv-d" value="${esc(r.d)}"></div></div>
    <ol class="rev">${dias.map((t, n) => `<li><b>Dia ${n + 1}</b><span>${t}</span>${n === 3 ? `<span class="chip warn">${r.ex ? 'Conferir horário do trem' : 'Conferir funcionamento na data'}</span>` : ''}</li>`).join('')}${r.o === 'pdf' ? '<li class="muted"><b>+3</b><span>dias</span></li>' : ''}</ol>
    ${r.o === 'pdf' ? `<label class="opcao"><input type="checkbox" checked><span>Salvar também as 6 experiências separadas, para usar em outros roteiros</span></label>` : ''}
    <div class="row" style="justify-content:space-between;flex-wrap:wrap">${r.o === 'ia' ? `<button class="btn s" type="button" data-ia-de-novo>${ic('sparkle', 'i s')}Gerar outra versão</button>` : '<span></span>'}
      <div class="row"><button class="btn s" type="button" data-salvar-bib="rev" data-o="${r.o}">Salvar como rascunho</button><button class="btn p" type="button" data-salvar-bib="ok" data-o="${r.o}">Salvar na biblioteca</button></div></div>`);
}

function detalhe(i) {
  CRM.painel(`<div class="ficha__top"><span class="mono">${TIPOS[i.tp][0]} · ${ORIGEM[i.o][0]}</span><button class="mini" type="button" data-fechar aria-label="Fechar">${ic('x', 'i s')}</button></div>
    <div class="bib__capa">${capa(i)}</div>
    <header class="stack" style="gap:6px"><h2 class="h1" style="font-size:28px">${esc(i.t)}</h2><p class="ficha__sub">${meta(i)}${i.preco ? ' · ' + i.preco : ''}</p>
      <div class="chips">${i.tags.map(t => `<span class="chip">${t}</span>`).join('')}${i.rev ? '<span class="chip warn">Rascunho · revisar</span>' : ''}</div></header>
    <div class="row" style="flex-wrap:wrap">${i.tp === 'doc' ? `<button class="btn p" type="button">${ic('download-simple', 'i s')}Baixar</button><button class="btn s" type="button">${ic('share-network', 'i s')}Enviar ao cliente</button>`
      : `<button class="btn p" type="button" data-usar="${i.id}">${ic('airplane-tilt', 'i s')}Usar em uma viagem</button><button class="btn s" type="button">${ic('pencil-simple', 'i s')}Editar</button>`}</div>
    ${i.tp === 'roteiro' ? `<section class="stack" style="gap:8px"><span class="mono">Dias</span><ol class="rev">${Array.from({ length: Math.min(i.dias, 5) }, (_, n) => `<li><b>Dia ${n + 1}</b><span>${['Chegada e primeiro passeio', 'Passeio principal', 'Dia de mar ou trilha', 'Experiência local', 'Dia livre com sugestões'][n]}</span></li>`).join('')}${i.dias > 5 ? `<li class="muted"><b>+${i.dias - 5}</b><span>dias</span></li>` : ''}</ol></section>` : ''}
    <section class="stack" style="gap:8px"><span class="mono">Para a IA</span><p class="muted" style="margin:0">Este conteúdo também alimenta o Assistente: ele usa estes dias, preços e dicas ao sugerir roteiros.</p></section>
    <p class="muted" style="margin:0">${i.uso ? `Usado em ${i.uso} ${i.uso > 1 ? 'viagens' : 'viagem'}.` : 'Ainda não foi usado em nenhuma viagem.'}</p>`);
}

CRM.telas.biblioteca = {
  render() {
    const l = ITENS.filter(i => filtro === 'todos' || i.tp === filtro);
    const n = k => ITENS.filter(i => i.tp === k).length;
    return `<div id="bib" class="stack" style="gap:26px">
    <header class="ph"><div><h1 class="h1">Biblioteca</h1><p>Roteiros, experiências, pacotes e documentos da agência. Tudo aqui pode ir para uma viagem e alimenta o Assistente.</p></div></header>
    <section class="criar">
      <form class="criar__ia" data-ia-rapida><span class="mono">Criar com IA</span>
        <div class="thaybar"><input id="ia-rapida" placeholder="Ex.: roteiro de 7 dias em Santiago para casal no inverno" aria-label="Descreva o que criar"><button class="spark" type="submit" aria-label="Gerar">${ic('sparkle', 'i s')}</button></div>
        <div class="chips">${['Roteiro de 5 dias em Buenos Aires', 'Pacote família na Disney', 'Experiência de vinícola no Chile'].map(s => `<button type="button" class="chip" data-ia-sug="${s}">${s}</button>`).join('')}</div></form>
      <label class="criar__pdf soltar" data-pdf-abrir>${ic('file-pdf')}<b>Criar a partir de PDF</b><span class="muted">Solte aqui roteiros, catálogos ou vouchers</span><input type="file" accept="application/pdf" class="sr" data-pdf-input></label>
    </section>
    <div class="filtros">
      <label class="search"><svg class="i s"><use href="#i-magnifying-glass"/></svg><input placeholder="Buscar por título, destino ou tag" aria-label="Buscar na biblioteca"></label>
      <div class="seg" data-seg-livre role="group" aria-label="Tipo">${[['todos', 'Tudo · ' + ITENS.length], ['roteiro', 'Roteiros · ' + n('roteiro')], ['exp', 'Experiências · ' + n('exp')], ['pacote', 'Pacotes · ' + n('pacote')], ['doc', 'Documentos · ' + n('doc')]].map(([k, t]) => `<button type="button" data-bfiltro="${k}" aria-pressed="${k === filtro}">${t}</button>`).join('')}</div>
      <span class="sp"></span>${CRM.vistas(VISTAS, vista, 'bib')}</div>
    ${vista === 'a' ? cartoes(l) : linhas(l)}</div>`;
  },
  depois(raiz) {
    const el = raiz.querySelector('#bib');
    el.addEventListener('click', e => {
      const t = e.target;
      const v = t.closest('[data-opc-bib]'); if (v) { vista = v.dataset.opcBib; try { localStorage.setItem('crm-opc-biblioteca', vista); } catch (er) {} CRM.render(); return; }
      const f = t.closest('[data-bfiltro]'); if (f) { filtro = f.dataset.bfiltro; CRM.render(); return; }
      const b = t.closest('[data-bib]'); if (b) { detalhe(ITENS.find(i => i.id === +b.dataset.bib)); return; }
      const s = t.closest('[data-ia-sug]'); if (s) { ia(s.dataset.iaSug); return; }
      if (t.closest('[data-pdf-abrir]') && !t.matches('input')) { e.preventDefault(); pdf(); }
    });
    const zona = el.querySelector('.criar__pdf');
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('alvo'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('alvo'));
    zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('alvo'); const f = e.dataTransfer.files[0]; pdf(f ? f.name : 'documento.pdf'); });
  }
};

document.addEventListener('change', e => { if (e.target.matches('[data-pdf-input]') && e.target.files[0]) pdf(e.target.files[0].name); });
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-pdf-exemplo]')) pdf('Roteiro_Lisboa_Porto.pdf');
  if (t.closest('[data-ia-de-novo]')) { CRM.aviso('Gerando outra versão'); setTimeout(() => revisar(ultimo), 600); }
  const sv = t.closest('[data-salvar-bib]');
  if (sv) {
    const tt = document.getElementById('rv-t').value.trim() || 'Sem título';
    ITENS.unshift({ id: Date.now(), tp: 'roteiro', t: tt, d: document.getElementById('rv-d').value.trim(), dias: 7, img: '', o: sv.dataset.o, uso: 0, tags: ['Novo'], rev: sv.dataset.salvarBib === 'rev' ? 1 : 0 });
    CRM.fechar(); filtro = 'todos'; CRM.render(); CRM.aviso(sv.dataset.salvarBib === 'rev' ? 'Salvo como rascunho para revisar depois' : 'Salvo na biblioteca');
  }
  const u = t.closest('[data-usar]'); if (u) { CRM.fechar(); location.hash = '#viagem'; CRM.aviso('Escolha o dia da viagem onde o roteiro entra'); }
});
document.addEventListener('submit', e => {
  if (e.target.matches('[data-ia-rapida]')) { e.preventDefault(); ia(document.getElementById('ia-rapida').value); }
  if (e.target.matches('[data-ia]')) {
    e.preventDefault();
    CRM.janela(`<div class="sec-h"><div><span class="mono">Criar com IA</span><h2 class="h2">Montando o roteiro</h2></div></div>
      <div class="lendo">${['Entendendo o pedido', 'Buscando na biblioteca', 'Organizando os dias'].map((t, n) => `<div class="lendo__p" style="animation-delay:${n * .5}s">${ic('check', 'i s')}${t}</div>`).join('')}</div>
      <div class="stack" style="gap:8px"><div class="skel" style="height:18px;width:60%"></div><div class="skel" style="height:14px"></div><div class="skel" style="height:14px;width:80%"></div></div>`);
    const txt = e.target.querySelector('#ia-txt').value.trim();
    ultimo = { o: 'ia', t: txt.charAt(0).toUpperCase() + txt.slice(1, 60), d: 'A confirmar' };
    setTimeout(() => revisar(ultimo), 1700);
  }
});
}
