/* OSV · JS de apoio do CSS de apps · v24. Sem dependências. */

/* tema: <button id="themebtn"> alterna data-theme em <html> */
function osvTheme(btn){
  const root=document.documentElement;
  const set=m=>{root.dataset.theme=m;btn.textContent=m==='light'?'Modo escuro':'Modo claro'};
  set(root.dataset.theme==='light'?'light':'dark');
  btn.addEventListener('click',()=>set(root.dataset.theme==='light'?'dark':'light'));
}

/* luz que segue o cursor nos cards de vidro */
if(matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches)
  document.addEventListener('pointermove',e=>{
    const g=e.target.closest&&e.target.closest('.glass');if(!g)return;
    const r=g.getBoundingClientRect();
    g.style.setProperty('--mx',(e.clientX-r.left)+'px');g.style.setProperty('--my',(e.clientY-r.top)+'px');
  },{passive:true});

/* dica: qualquer elemento com data-tip="Rótulo|Valor" */
const osvTip=(()=>{
  const box=document.createElement('div');box.className='tipbox';box.setAttribute('role','status');
  const ready=()=>document.body.append(box);
  document.body?ready():document.addEventListener('DOMContentLoaded',ready);
  const row=(tag,txt,k)=>{const e=document.createElement(tag);if(k){const i=document.createElement('i');i.className='k'+k;e.append(i)}e.append(txt);return e};
  function show(rows,x,y){
    box.replaceChildren(...rows.map(r=>row(r.b?'b':'span',r.t,r.k)));box.classList.add('on');
    const w=box.offsetWidth,h=box.offsetHeight;
    box.style.left=Math.max(8,Math.min(innerWidth-w-8,x+14))+'px';
    box.style.top=Math.max(8,y-h-12)+'px';
  }
  const hide=()=>box.classList.remove('on');
  const from=el=>{const[a,b]=el.dataset.tip.split('|');return[{t:a},{t:b,b:1}]};
  document.addEventListener('pointermove',e=>{
    if(e.target.closest&&e.target.closest('.line'))return;
    const el=e.target.closest&&e.target.closest('[data-tip]');
    el?show(from(el),e.clientX,e.clientY):hide();
  },{passive:true});
  document.addEventListener('focusin',e=>{
    const el=e.target.closest&&e.target.closest('[data-tip]');if(!el)return;
    const r=el.getBoundingClientRect();show(from(el),r.left+r.width/2,r.top);
  });
  document.addEventListener('focusout',hide);
  return{show,hide};
})();

/* linha e área: osvLine(svg,{labels:[…],series:[{name,values:[…]}],area:true,fmt:v=>…}) — até 4 séries, um eixo só */
function osvLine(svg,cfg){
  const NS='http://www.w3.org/2000/svg';
  const el=(n,a,t)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;return e};
  const fmt=cfg.fmt||(v=>v.toLocaleString('pt-BR'));
  const nice=m=>{const p=10**Math.floor(Math.log10(m)),f=m/p;return[1,1.2,1.6,2,2.4,3,4,5,6,8,10].find(s=>f<=s)*p};
  const S=cfg.series.slice(0,4),n=cfg.labels.length;
  let geo,idx=-1,cross,dots;
  function draw(){
    const W=Math.max(260,svg.clientWidth||svg.parentNode.clientWidth),H=cfg.height||240;
    const L=44,T=14,B=26,R=S.length>1?Math.max(...S.map(s=>s.name.length))*7+22:14;
    const max=nice(Math.max(...S.flatMap(s=>s.values)));
    const x=i=>L+(W-L-R)*i/(n-1),y=v=>T+(H-T-B)*(1-v/max);
    geo={W,L,R,x,y};
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('height',H);svg.replaceChildren();
    for(let g=0;g<=4;g++){const v=max*g/4;svg.append(el('line',{class:'g',x1:L,x2:W-R,y1:y(v),y2:y(v)}),el('text',{class:'ax',x:L-8,y:y(v)+4,'text-anchor':'end'},fmt(v)))}
    const step=Math.max(1,Math.ceil(n/Math.max(2,Math.floor((W-L-R)/52))));
    cfg.labels.forEach((l,i)=>{if((n-1-i)%step===0)svg.append(el('text',{class:'ax',x:x(i),y:H-6,'text-anchor':'middle'},l))});
    cross=el('line',{class:'cross',y1:T,y2:H-B,visibility:'hidden'});svg.append(cross);
    const ends=S.map(s=>y(s.values[n-1]));
    for(let a=0;a<ends.length;a++)for(let b=a+1;b<ends.length;b++)if(Math.abs(ends[a]-ends[b])<15){const up=ends[a]<ends[b]?a:b,dn=up===a?b:a,mid=(ends[a]+ends[b])/2;ends[up]=mid-8;ends[dn]=mid+8}
    S.forEach((s,k)=>{
      const d=s.values.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join('');
      if(cfg.area&&k===0)svg.append(el('path',{class:'a1',d:d+`L${x(n-1)} ${y(0)}L${x(0)} ${y(0)}Z`}));
      svg.append(el('path',{class:'l l'+(k+1),d}),el('circle',{class:'d d'+(k+1),r:4,cx:x(n-1),cy:y(s.values[n-1])}));
      if(S.length>1)svg.append(el('text',{class:'lab',x:x(n-1)+10,y:ends[k]+4},s.name));
    });
    dots=S.map((s,k)=>{const c=el('circle',{class:'d d'+(k+1),r:5,visibility:'hidden'});svg.append(c);return c});
    const hit=el('rect',{class:'hit',x:L,y:T,width:W-L-R,height:H-T-B});svg.append(hit);
    if(idx>=0)mark(idx);
  }
  function mark(i,cx,cy){
    idx=Math.max(0,Math.min(n-1,i));const{x,y}=geo,r=svg.getBoundingClientRect();
    cross.setAttribute('x1',x(idx));cross.setAttribute('x2',x(idx));cross.setAttribute('visibility','visible');
    dots.forEach((c,k)=>{c.setAttribute('cx',x(idx));c.setAttribute('cy',y(S[k].values[idx]));c.setAttribute('visibility','visible')});
    osvTip.show([{t:cfg.labels[idx],b:1},...S.map((s,k)=>({t:s.name+' · '+fmt(s.values[idx]),k:k+1}))],cx??r.left+x(idx),cy??r.top+y(Math.max(...S.map(s=>s.values[idx]))));
  }
  function clear(){idx=-1;cross.setAttribute('visibility','hidden');dots.forEach(c=>c.setAttribute('visibility','hidden'));osvTip.hide()}
  svg.addEventListener('pointermove',e=>{const r=svg.getBoundingClientRect(),{L,R,W}=geo;mark(Math.round((e.clientX-r.left-L)/(W-L-R)*(n-1)),e.clientX,e.clientY)});
  svg.addEventListener('pointerleave',clear);
  svg.setAttribute('tabindex','0');svg.setAttribute('role','img');
  svg.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();mark(idx<0?n-1:idx+(e.key==='ArrowRight'?1:-1))}if(e.key==='Escape')clear()});
  svg.addEventListener('blur',clear);
  new ResizeObserver(draw).observe(svg.parentNode);draw();
}

/* tendência curta do número em destaque: osvSpark(svg,[…]) */
function osvSpark(svg,v){
  const min=Math.min(...v),max=Math.max(...v),W=100,H=36;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const p=document.createElementNS('http://www.w3.org/2000/svg','path');
  p.setAttribute('d',v.map((y,i)=>(i?'L':'M')+(W*i/(v.length-1)).toFixed(1)+' '+(3+(H-6)*(1-(y-min)/(max-min||1))).toFixed(1)).join(''));
  svg.replaceChildren(p);
}
