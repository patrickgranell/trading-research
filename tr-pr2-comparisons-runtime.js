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
let unit='ticks',basis='gross';
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

/* Each comparison is a standalone Dashboard widget, aligned with the
   existing setup/expectancy panels. Detailed tabular exploration remains
   available in the operational/laboratory analysis screens, not here. */
const titles={
 management:'Resultado por gestión',
 lots:'Resultados por lotes',
 hour:'Resultado por hora de entrada',
 weekday:'Resultado por día de la semana',
 month:'Resultado por mes',
 year:'Resultado por año'
};
const keys=Object.keys(titles);
const spans=[4,6,8,12];
function preferences(){
 let stored={};
 try{stored=JSON.parse(localStorage.getItem(keyOf()+':widgets')||'{}')||{};}catch(_){}
 const legacy=visible();
 return {show:Object.fromEntries(keys.map(k=>[k,stored.show?.[k]!==undefined?!!stored.show[k]:legacy])),
  size:Object.fromEntries(keys.map(k=>[k,spans.includes(Number(stored.size?.[k]))?Number(stored.size[k]):6]))};
}
function persistPrefs(p){
 try{localStorage.setItem(keyOf()+':widgets',JSON.stringify(p));}catch(_){}
}
function metricLabel(kind){
 return kind==='lots'?'ticks-contrato':
  unit==='r'?'R':unit==='usd'?'USD '+(basis==='net'?'netos':'brutos'):'ticks '+(basis==='net'?'netos':'brutos');
}
function renderCard(widget,kind){
 const rows=rowsFor(kind),body=widget.querySelector('[data-trcomp-body]');
 if(!body)return;
 const header=widget.querySelector('[data-trcomp-unit-label]');
 if(header)header.textContent=metricLabel(kind);
 const max=Math.max(1,...rows.map(r=>Math.abs(r.sum)));
 const shown=widget.dataset.trcompExpanded==='1'?rows:rows.slice(0,8);
 if(!rows.length){
  body.innerHTML='<div class="trcomp-empty">Todavía no hay operaciones cerradas elegibles en este segmento.</div>';
  return;
 }
 body.innerHTML=shown.map(r=>{
  const width=Math.max(r.sum===0?0:2,Math.round(100*Math.abs(r.sum)/max));
  const tone=r.sum<0?'negative':r.sum>0?'positive':'neutral';
  return '<div class="trcomp-bar-row" title="'+esc('Expectancy '+num(r.expectancy)+' · WR '+num(r.winRate)+'% · PF '+num(r.pf))+'">'+
   '<div class="trcomp-row-name"><strong>'+esc(r.name)+'</strong><small>n='+r.n+' · WR '+num(r.winRate)+'%</small></div>'+
   '<div class="trcomp-track"><div class="trcomp-fill '+tone+'" style="width:'+width+'%"></div></div>'+
   '<strong class="trcomp-value '+tone+'">'+signed(r.sum)+'</strong></div>';
 }).join('')+
 '<div class="trcomp-card-footer"><small>'+rows.length+' segmentos · '+rows.reduce((a,r)=>a+r.n,0)+' muestras'+(kind==='lots'?' de lotes':' de operaciones')+'</small>'+
 (rows.length>8?'<button type="button" class="btn tiny ghost" data-trcomp-expand>'+ (widget.dataset.trcompExpanded==='1'?'Ver menos':'Ver '+(rows.length-8)+' más')+'</button>':'')+'</div>';
}
function makeWidget(kind,size){
 const widget=document.createElement('div');
 widget.className='dashboard-widget dashboard-widget-panels dashboard-span-'+size+' trcomp-widget';
 widget.dataset.dashboardWidget='comparison-'+kind;
 widget.dataset.trcompWidget=kind;
 const card=document.createElement('section');card.className='card panel dashboard-custom-panel trcomp-card';
 card.innerHTML='<div class="panel-title trcomp-card-head"><div><h3>'+esc(titles[kind])+'</h3>'+
  '<small>'+ (kind==='lots'?'Aportación real por estrategia y lote (no operaciones independientes)':'Operaciones cerradas · agrupadas por '+esc(names[kind]).toLowerCase())+
  '</small></div><small data-trcomp-unit-label></small></div><div data-trcomp-body class="trcomp-card-body"></div>';
 widget.append(card);renderCard(widget,kind);return widget;
}
function mountComparisons(root){
 const grid=root.querySelector('.dashboard-panel-grid');
 if(!grid||grid.querySelector('[data-trcomp-widget]')||!planRead())return;
 const p=preferences();
 for(const kind of keys){
  if(p.show[kind])grid.append(makeWidget(kind,p.size[kind]));
 }
}
function enhancer(){
 for(const modal of document.querySelectorAll('.modal-backdrop .modal')){
  const heading=modal.querySelector('.modal-head')?.textContent||'';
  if(!/Personalizar/.test(heading)||modal.querySelector('[data-trcomp-config]'))continue;
  const host=modal.querySelector('.modal-body');if(!host)continue;
  const prefs=preferences();
  const section=document.createElement('section');
  section.className='trcomp-config';section.dataset.trcompConfig='1';
  section.innerHTML='<div class="trcomp-config-heading"><strong>Comparativas</strong><small>Paneles independientes; visibilidad y anchura para este perfil. Se guardan con el Dashboard.</small></div>'+
    keys.map(key=>'<div class="trcomp-config-item" data-trcomp-config-item="'+key+'">'+
      '<label><input type="checkbox" data-trcomp-enabled="'+key+'" '+(prefs.show[key]?'checked':'')+'>'+esc(titles[key])+'</label>'+
      '<select aria-label="Anchura de '+esc(titles[key])+'" data-trcomp-size="'+key+'">'+
      spans.map(span=>'<option value="'+span+'" '+(prefs.size[key]===span?'selected':'')+'>'+
        (span===4?'1/3':span===6?'1/2':span===8?'2/3':'Fila completa')+'</option>').join('')+
      '</select></div>').join('');
  host.append(section);
 }
}
const base=typeof trRenderViewHtml==='function'?trRenderViewHtml:null;
if(base)trRenderViewHtml=function(view){
 const html=base.apply(this,arguments);
 if(view!=='dashboard'||typeof html!=='string')return html;
 const tpl=document.createElement('template');tpl.innerHTML=html;
 mountComparisons(tpl.content);
 return tpl.innerHTML;
};
document.addEventListener('click',ev=>{
 const expand=ev.target?.closest?.('#view [data-trcomp-expand]');
 if(expand){
  const widget=expand.closest('[data-trcomp-widget]');
  if(widget){widget.dataset.trcompExpanded=widget.dataset.trcompExpanded==='1'?'0':'1';renderCard(widget,widget.dataset.trcompWidget);}
  return;
 }
 const save=ev.target?.closest?.('.modal-backdrop .modal-foot button');
 if(save&&/Guardar Dashboard/i.test(save.textContent||'')){
  const modal=save.closest('.modal');
  if(!modal?.querySelector('[data-trcomp-config]'))return;
  const next={show:{},size:{}};
  for(const key of keys){
   next.show[key]=!!modal.querySelector('[data-trcomp-enabled="'+key+'"]')?.checked;
   next.size[key]=Number(modal.querySelector('[data-trcomp-size="'+key+'"]')?.value)||6;
  }
  persistPrefs(next);
 }
},true);
document.addEventListener('change',ev=>{
 // Source unit/base is driven from the main Dashboard and acts on every card.
 const target=ev.target;
 if(!target?.closest?.('#view'))return;
 if(target.matches('.dashboard-unit-switch input,.dashboard-unit-switch select')){
  const value=target.value;
  if(['ticks','r','usd'].includes(value))unit=value;
  document.querySelectorAll('#view [data-trcomp-widget]').forEach(w=>renderCard(w,w.dataset.trcompWidget));
 }
},true);
const observer=new MutationObserver(records=>{
 if(records.some(r=>r.addedNodes.length))enhancer();
});
observer.observe(document.body,{childList:true,subtree:true});
enhancer();
globalThis.TradingResearchPR2Comparisons=Object.freeze({version:'1',groups:rowsFor,enhancer,mountComparisons});
})();
