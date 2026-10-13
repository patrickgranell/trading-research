/* TR-VIS PR2 — read-only comparative research panel.
 * Single trade unit for management/temporal groups; per-lot execution is a
 * distinct, explicitly labelled ticks-contract study. Never edits a trade. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchPR2Comparisons)return;
const names={management:'Gestión',lots:'Lotes',hour:'Horas',weekday:'Días',month:'Meses',year:'Años'};
const weekdays=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const keyOf=()=>{
 const p=globalThis.TradingResearchPlanReadContract?.current?.();
 return 'tr-pr2-comparisons-v1:'+String(p?.id||'none')+':'+String(p?.activeDashboardProfileId||'principal');
};
function visible(){try{return localStorage.getItem(keyOf())!=='hide';}catch{return true;}}
function setVisible(v){try{localStorage.setItem(keyOf(),v?'show':'hide');}catch(_){}}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const num=v=>Number.isFinite(v)?Number(v).toLocaleString('es-ES',{maximumFractionDigits:2}):v===Infinity?'∞':'—';
const signed=v=>(v>0?'+':'')+num(v);
let active='management',unit='ticks',basis='gross';
const planRead=()=>globalThis.TradingResearchPlanReadContract?.current?.()||null;
function operations(){
 const plan=planRead();
 const all=globalThis.TradingResearchOperationsReadContract?.current?.();
 if(!plan||!Array.isArray(all))return [];
 return all.filter(op=>String(op?.tradingPlanId||'')===String(plan.id));
}
function entryParts(op){
 const date=String(op?.entryDate||'').trim();
 const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d)/.exec(date);
 return m?{year:m[1],month:m[2],day:Number(m[3]),hour:m[4]}:null;
}
function groupKey(op,kind){
 if(kind==='management')return String(op.riskStrategyName||op.strategyPlanSnapshot?.name||'Sin gestión');
 const dt=entryParts(op);if(!dt)return 'Sin fecha';
 if(kind==='hour')return dt.hour+':00';
 if(kind==='year')return dt.year;
 if(kind==='month')return dt.year+'-'+dt.month;
 const day=new Date(Number(dt.year),Number(dt.month)-1,dt.day).getDay();
 return weekdays[(day+6)%7];
}
function canonicalGroups(kind){
 const buckets=new Map();
 for(const op of operations()){
  const k=groupKey(op,kind);
  if(!buckets.has(k))buckets.set(k,[]);
  buckets.get(k).push(op);
 }
 const rows=[];
 for(const [name,ops] of buckets){
  const stats=typeof calcMetricStats==='function'?calcMetricStats(ops,unit,basis):null;
  if(!stats||!stats.n)continue;
  rows.push({name,n:stats.n,sum:stats.sum,expectancy:stats.expectancy,winRate:stats.winRate,pf:stats.pf});
 }
 if(kind==='weekday')rows.sort((a,b)=>weekdays.indexOf(a.name)-weekdays.indexOf(b.name));
 else if(['month','year','hour'].includes(kind))rows.sort((a,b)=>a.name.localeCompare(b.name));
 else rows.sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name));
 return rows;
}
function lotGroups(){
 const buckets=new Map(),metrics=globalThis.TradingResearchCanonicalMetrics;
 for(const op of operations()){
  const lots=Array.isArray(op.executionLots)?op.executionLots:[];
  for(let i=0;i<lots.length;i++){
   const lot=lots[i];
   if(lot?.status==='open'||lot?.resultTicks===null||lot?.resultTicks===undefined)continue;
   const qty=Number(lot.quantity),ticks=Number(lot.resultTicks);
   if(!Number.isInteger(qty)||qty<1||!Number.isFinite(ticks))continue;
   const value=Number.isFinite(Number(lot.totalTicks))&&lot.totalTicks!==null?Number(lot.totalTicks):qty*ticks;
   if(metrics?.outcome?.(op,value)==='pending')continue;
   const key=String(op.riskStrategyName||op.strategyPlanSnapshot?.name||'Sin gestión')+' · Lote '+(i+1);
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(value);
  }
 }
 return [...buckets].map(([name,values])=>{
  const stats=metrics?.stats?.(values);
  return stats?{name,n:stats.n,sum:stats.sum,expectancy:stats.expectancy,winRate:stats.winRate,pf:stats.pf}:null;
 }).filter(Boolean);
}
function rowsFor(kind){return kind==='lots'?lotGroups():canonicalGroups(kind);}
function readTable(root){
 const body=root.querySelector('[data-trcomp-body]');if(!body)return;
 const lots=active==='lots',rows=rowsFor(active);
 const title=lots?'ticks-contrato reales (por lote)':
  unit==='r'?'R':unit==='usd'?'USD '+(basis==='net'?'netos':'brutos'):'ticks '+(basis==='net'?'netos':'brutos');
 root.querySelector('[data-trcomp-unit-label]').textContent=title;
 const unitSelect=root.querySelector('[data-trcomp-unit]');
 const basisSelect=root.querySelector('[data-trcomp-basis]');
 if(unitSelect)unitSelect.disabled=lots;
 if(basisSelect)basisSelect.disabled=lots||unit==='r';
 const max=Math.max(1,...rows.map(x=>Math.abs(x.sum)));
 if(!rows.length){
  body.innerHTML='<div class="trcomp-empty">No hay operaciones cerradas elegibles para esta comparación. Los registros pendientes no se contabilizan.</div>';
  return;
 }
 body.innerHTML='<div class="trcomp-table-scroll"><table class="trcomp-table"><thead><tr>'+
  '<th>Segmento</th><th>Ops</th><th>Resultado</th><th>Expectancy</th><th>WR</th><th>PF</th><th>Comparativa</th></tr></thead><tbody>'+
  rows.map(row=>{
   const w=Math.round(Math.abs(row.sum)/max*100);
   const polarity=row.sum<0?'negative':row.sum>0?'positive':'neutral';
   return '<tr><th scope="row">'+esc(row.name)+'</th><td>'+row.n+'</td>'+
    '<td class="'+polarity+'">'+signed(row.sum)+'</td><td>'+signed(row.expectancy)+'</td>'+
    '<td>'+num(row.winRate)+'%</td><td>'+num(row.pf)+'</td>'+
    '<td><progress class="trcomp-meter '+polarity+'" value="'+w+'" max="100" aria-label="'+esc(row.name)+' '+w+' por ciento del máximo absoluto"></progress></td></tr>';
  }).join('')+'</tbody></table></div>'+
  '<p class="trcomp-footnote">Ops = operaciones cerradas elegibles · WR = porcentaje positivo · PF = factor de beneficio. La comparación por lotes es descriptiva: sus aportaciones no equivalen a operaciones independientes.</p>';
}
function mountComparisons(root){
 if(!visible()||root.querySelector('[data-trcomp-root]'))return;
 // Do not add an artificial component when no active plan is selected.
 if(!planRead())return;
 const section=document.createElement('section');
 section.className='card panel trcomp-panel';section.dataset.trcompRoot='1';
 section.innerHTML='<div class="trcomp-top"><div><h3>Análisis comparativo</h3><small>Operaciones del Trading Plan activo; sin alterar la configuración ni los resultados.</small></div>'+
  '<div class="trcomp-controls"><label>Unidad <select data-trcomp-unit aria-label="Unidad comparativa"><option value="ticks">Ticks</option><option value="r">R</option><option value="usd">USD</option></select></label>'+
  '<label>Base <select data-trcomp-basis aria-label="Base comparativa"><option value="gross">Bruto</option><option value="net">Neto</option></select></label></div></div>'+
  '<div class="trcomp-tabs" role="group" aria-label="Dimensión de la comparación">'+
  Object.entries(names).map(([key,label])=>'<button type="button" class="btn small trcomp-tab" data-trcomp-tab="'+key+'">'+label+'</button>').join('')+
  '</div><p class="trcomp-unit">Resultado expresado en <strong data-trcomp-unit-label></strong></p><div data-trcomp-body></div>';
 const after=root.querySelector('.dashboard-panel-grid');
 if(after)after.after(section);else root.append(section);
 section.querySelector('[data-trcomp-unit]').value=unit;
 section.querySelector('[data-trcomp-basis]').value=basis;
 section.querySelectorAll('[data-trcomp-tab]').forEach(b=>{const selected=b.dataset.trcompTab===active;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
 readTable(section);
}
function enhancer(){
 for(const modal of document.querySelectorAll('.modal-backdrop .modal')){
  const heading=modal.querySelector('.modal-head')?.textContent||'';
  if(!/Personalizar/.test(heading)||modal.querySelector('[data-trcomp-config]'))continue;
  const host=modal.querySelector('.modal-body');if(!host)continue;
  const section=document.createElement('section');
  section.className='trcomp-config';section.dataset.trcompConfig='1';
  section.innerHTML='<label><input type="checkbox" data-trcomp-enabled> Mostrar panel de análisis comparativo</label>'+
   '<small>Incluye Gestión, Lotes, Horas, Días, Meses y Años. Guarda con «Guardar Dashboard».</small>';
  section.querySelector('[data-trcomp-enabled]').checked=visible();
  host.append(section);
 }
}
const base=typeof trRenderViewHtml==='function'?trRenderViewHtml:null;
if(base)trRenderViewHtml=function(view){
 const html=base.apply(this,arguments);
 if(view!=='dashboard'||typeof html!=='string')return html;
 const tpl=document.createElement('template');tpl.innerHTML=html;
 mountComparisons(tpl.content);return tpl.innerHTML;
};
document.addEventListener('click',ev=>{
 const tab=ev.target?.closest?.('#view [data-trcomp-tab]');
 if(tab){
  active=tab.dataset.trcompTab;
  const root=tab.closest('[data-trcomp-root]');
  root?.querySelectorAll('[data-trcomp-tab]').forEach(b=>{const selected=b.dataset.trcompTab===active;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  if(root)readTable(root);return;
 }
 const save=ev.target?.closest?.('.modal-backdrop .modal-foot button');
 if(save&&/Guardar Dashboard/i.test(save.textContent||'')){
  const cb=save.closest('.modal')?.querySelector('[data-trcomp-enabled]');
  if(cb)setVisible(cb.checked);
 }
},true);
document.addEventListener('change',ev=>{
 const el=ev.target,root=el?.closest?.('#view [data-trcomp-root]');
 if(!root)return;
 if(el.matches('[data-trcomp-unit]'))unit=el.value;
 else if(el.matches('[data-trcomp-basis]'))basis=el.value;
 else return;
 readTable(root);
},true);
const observer=new MutationObserver(records=>{
 if(records.some(r=>r.addedNodes.length))enhancer();
});
observer.observe(document.body,{childList:true,subtree:true});
enhancer();
globalThis.TradingResearchPR2Comparisons=Object.freeze({version:'1',groups:rowsFor,enhancer,mountComparisons});
})();
