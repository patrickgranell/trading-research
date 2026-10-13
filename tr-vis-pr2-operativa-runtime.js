/* TR-VIS PR2 — Operativa y resumen · non-destructive presentation layer.
   TR-VIS-004/005/007/010/013/014/015. Never edits metric formulas, saved
   Dashboard profiles, stored operations, filters or Trading Plan domain data. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchVisualPR2)return;
let compactRegister=false;
let expandedEquity=false;
/* V31.9.4 preserved the V31.1 size selectors and saved profiles, but its
 * later Dashboard renderer returns bare KPI/panel/secondary elements.
 * Reconnect those existing elements to the original 12-column layout. */
const dashboardGroupDefs={
 kpis:['operations','winRate','expectancy','pf','drawdown','blocks'],
 panels:['equity','setupCount'],
 secondary:['mfe','mae','currentBlock']
};
function restoreDashboardProfileGrid(root){
 const plan=globalThis.TradingResearchPlanReadContract?.current?.();
 const profiles=Array.isArray(plan?.dashboardProfiles)?plan.dashboardProfiles:[];
 const profile=profiles.find(p=>p.id===plan?.activeDashboardProfileId)||profiles[0]||null;
 const config=profile?.config||plan?.dashboardConfig||{};
 const sizes=profile?.sizes||{};
 const sets=[
  ['kpis','.dashboard-kpis-custom','.kpi',[2,3,4,6],2],
  ['panels','.dashboard-panel-grid','.dashboard-custom-panel',[4,6,8,12],6],
  ['secondary','.dashboard-secondary-grid','.dashboard-secondary-card',[4,6,8,12],4]
 ];
 for(const [group,selector,childSelector,allowed,fallback] of sets){
  const grid=root.querySelector(selector);
  if(!grid||grid.querySelector(':scope > .dashboard-widget'))continue;
  const original=[...grid.children];
  if(!original.length||original.some(el=>!el.matches(childSelector)))continue;
  const configured=Array.isArray(config[group])?config[group]:dashboardGroupDefs[group];
  // Never attach a possibly incorrect saved size to a different metric.
  if(configured.length!==original.length)continue;
  for(let i=0;i<original.length;i++){
   const id=configured[i];
   const requested=Number(sizes?.[group]?.[id]);
   const span=allowed.includes(requested)?requested:fallback;
   const wrapper=document.createElement('div');
   wrapper.className='dashboard-widget dashboard-widget-'+group+' dashboard-span-'+span;
   wrapper.dataset.dashboardWidget=id;
   const el=original[i];el.replaceWith(wrapper);wrapper.append(el);
  }
  grid.classList.add('dashboard-flex-grid');
 }
}
const priorities=new Set(['result','expectancy','pf','drawdown']);
function dashboard(root){
 restoreDashboardProfileGrid(root);
 const widgets=[...root.querySelectorAll('.dashboard-kpis-custom [data-dashboard-widget]')];
 if(!widgets.length)return;
 for(const widget of widgets){
  if(priorities.has(widget.dataset.dashboardWidget)){
   widget.classList.add('tr2-primary-kpi');
   const number=widget.querySelector('.kpi .value');
   if(number)number.classList.add('tr2-result-value');
  }else widget.classList.add('tr2-secondary-kpi');
 }
 const equity=root.querySelector('.dashboard-panel-grid [data-dashboard-widget="equity"]');
 if(equity){
  equity.classList.add('tr2-equity-widget');
  const grid=equity.closest('.dashboard-panel-grid');
  if(grid){
   const others=[...grid.children].filter(el=>el!==equity);
   // Respect all user-defined widget widths and order. Offer visual prominence
   // without rewriting their custom grid spans.
   grid.classList.add('tr2-dashboard-panels');
   if(others.length===1){
    grid.classList.add('tr2-two-panel-dashboard');
    const sibling=others[0];
    if(equity.classList.contains('dashboard-span-6')&&sibling.classList.contains('dashboard-span-6')){
     if(expandedEquity)grid.classList.add('tr2-equity-expanded');
     const header=equity.querySelector('.dashboard-equity-title');
     if(header){
      const expand=document.createElement('button');
      expand.type='button';expand.className='btn small ghost tr2-equity-expand';
      expand.dataset.tr2EquityExpand='1';expand.setAttribute('aria-pressed',String(expandedEquity));
      expand.textContent=expandedEquity?'Usar proporción guardada':'Ampliar curva a 2/3';
      expand.title='Vista temporal: no modifica el tamaño del widget guardado en Personalizar';
      header.append(expand);
     }
    }
   }
  }
 }
 const unit=root.querySelector('.dashboard-unit-switch');
 if(unit)unit.setAttribute('aria-label','Unidad de visualización de las métricas del Dashboard');
}
/* TR-VIS PR2 · Fit the EQUITY PLOT, not only its outer widget.
 * Original viewBox is fixed at 760×250; the PR1 aspect-ratio safeguard
 * correctly prevents distortion but letterboxes the drawing on wide cards.
 * Regenerate the very same canonical series at the rendered chart width and
 * height. Axes/labels/points are recomputed by the existing SVG helper;
 * no result formula or source dataset is changed. */
let tr2EquityWrap=null;
let tr2EquityObserver=null;
let tr2ChartFrame=null;
function tr2ResizeEquityChart(){
 const wrap=tr2EquityWrap;
 if(!wrap||!wrap.isConnected)return;
 const rect=wrap.getBoundingClientRect();
 const width=Math.max(0,Math.round(rect.width)),height=Math.max(0,Math.round(rect.height));
 if(width<120||height<100)return;
 const svg=wrap.querySelector('svg.dashboard-equity-svg');
 if(!svg)return; // Empty plans retain their authored empty-state message.
 const unit=['r','ticks','usd'].includes(window.__trDashboardUnit)?window.__trDashboardUnit:'r';
 // Do not trust only the cached wrapper dimensions: the application's
 // render pipeline can replace the inner SVG without replacing the wrapper.
 if(wrap.dataset.tr2EquityWidth===String(width)&&
    wrap.dataset.tr2EquityHeight===String(height)&&
    wrap.dataset.tr2EquityUnit===unit&&
    Math.abs((svg.viewBox?.baseVal?.width||0)-width)<2&&
    Math.abs((svg.viewBox?.baseVal?.height||0)-height)<2)return;
 if(typeof dashboardEquitySvgV114!=='function'||
    typeof calcMetricStats!=='function'||typeof currentOps!=='function'||
    typeof v3194EquityFromZero!=='function')return;
 try{
  const stats=calcMetricStats(currentOps(),unit,'gross');
  const values=v3194EquityFromZero(stats.equity);
  if(!values.length)return;
  const template=document.createElement('template');
  template.innerHTML=dashboardEquitySvgV114(values,unit,width,height);
  const fitted=template.content.querySelector('svg.dashboard-equity-svg');
  if(!fitted)return;
  // viewBox and actual geometry share an aspect ratio: no letterboxing and
  // no non-uniform stretch of text or line strokes.
  fitted.setAttribute('preserveAspectRatio','xMinYMin meet');
  fitted.setAttribute('role','img');
  fitted.setAttribute('aria-label','Curva de equity del plan seleccionado');
  svg.replaceWith(fitted);
  wrap.dataset.tr2EquityWidth=String(width);
  wrap.dataset.tr2EquityHeight=String(height);
  wrap.dataset.tr2EquityUnit=unit;
 }catch(error){console.warn('[Trading Research] Equity responsive sizing',error);}
}
function tr2QueueChartFit(){
 if(tr2ChartFrame!==null)return;
 tr2ChartFrame=requestAnimationFrame(()=>{
  tr2ChartFrame=null;
  tr2ResizeEquityChart();
 });
}
function tr2ConnectEquityChart(){
 const next=document.querySelector('#view .tr2-equity-widget .chart-wrap');
 if(next===tr2EquityWrap){
  // Even same wrapper may contain a freshly rendered 760px SVG.
  if(next)tr2ResizeEquityChart();
  return;
 }
 if(tr2EquityObserver)tr2EquityObserver.disconnect();
 tr2EquityWrap=next;
 if(!next)return;
 delete next.dataset.tr2EquityWidth;
 delete next.dataset.tr2EquityHeight;
 delete next.dataset.tr2EquityUnit;
 if(typeof ResizeObserver==='function'){
  if(!tr2EquityObserver)tr2EquityObserver=new ResizeObserver(()=>tr2QueueChartFit());
  tr2EquityObserver.observe(next);
 }
 // Immediately fit on route/size changes; a scheduled animation frame is
 // a second safety net for post-layout adjustments and viewport resizes.
 tr2ResizeEquityChart();
 tr2QueueChartFit();
}
function operations(root){
 const panel=root.querySelector('.tr5-ops-register .table-module')||
  root.querySelector('#opsAnalyticsArea .table-module');
 if(!panel||panel.querySelector('[data-tr2-compact-switch]'))return;
 panel.classList.add('tr2-operaciones-register');
 if(compactRegister)panel.classList.add('tr2-compact');
 const button=document.createElement('button');
 button.type='button';button.className='btn small tr2-compact-switch';
 button.dataset.tr2CompactSwitch='1';
 button.setAttribute('aria-pressed',String(compactRegister));
 button.textContent=compactRegister?'Vista completa':'Vista compacta';
 const organizer=panel.querySelector('.tr-colprefs-top')||panel.querySelector('.panel-title');
 if(organizer)organizer.append(button);
 const table=panel.querySelector('table.tr-ops-entry-exit');
 if(table){
  table.classList.add('tr2-operaciones-table');
  const head=table.tHead?.rows?.[0];
  if(head){
   [...head.cells].forEach(cell=>{
    if(!cell.dataset.trColsKey)return;
    if(['entryDate','entryTime','exitDate','exitTime'].includes(cell.dataset.trColsKey)){
     cell.title=cell.textContent.trim()+' · fecha y hora de ejecución';
    }
   });
  }
  // In compact mode show timestamp next to its date rather than discarding it.
  // Original cell text, source values, column preferences and events stay intact.
  for(const row of table.tBodies?.[0]?.rows||[]){
   for(const type of ['entry','exit']){
    const date=row.querySelector('[data-tr-cols-key="'+type+'Date"]');
    const time=row.querySelector('[data-tr-cols-key="'+type+'Time"]');
    const text=time?.textContent?.trim();
    if(date&&text&&text!=='—')date.dataset.tr2Time=text;
   }
  }
 }
 const helper=panel.querySelector('.tr-colprefs-top small');
 if(helper)helper.textContent=helper.textContent+' · Vista compacta conserva el resto en Vista completa.';
}
function blocks(root){
 const cards=[...root.querySelectorAll('.v5-block-grid .v5-block')];
 if(!cards.length)return;
 const all=globalThis.TradingResearchOperationsReadContract?.current?.();
 const total=Array.isArray(all)?all.length:null;
 const core=['ops','resultado','expectancy','max dd'];
 for(const [index,card] of cards.entries()){
  card.classList.add('tr2-block-card');
  const grid=card.querySelector('.block-core-grid');
  if(!grid||grid.dataset.tr2Organized)return;
  grid.dataset.tr2Organized='1';
  const original=[...grid.children];
  const label=el=>el.querySelector('span')?.textContent?.trim().toLowerCase()||'';
  const primary=core.map(name=>original.find(el=>label(el)===name)).filter(Boolean);
  const remaining=original.filter(el=>!primary.includes(el));
  // This is a DOM move, not a copy: every original statistic remains accessible.
  grid.replaceChildren(...primary);
  if(remaining.length){
   const details=document.createElement('details');
   details.className='tr2-block-more';
   const summary=document.createElement('summary');
   summary.textContent='Otras métricas del bloque';
   const detailGrid=document.createElement('div');
   detailGrid.className='block-core-grid tr2-block-more-grid';
   detailGrid.append(...remaining);
   details.append(summary,detailGrid);grid.after(details);
  }
  const curve=card.querySelector('.block-spark');
  if(curve){
   curve.setAttribute('aria-label','Minicurva del bloque: escala adaptada al propio bloque');
   curve.setAttribute('role','img');
   const note=document.createElement('small');
   note.className='tr2-block-scale';
   note.textContent='Curva con escala propia · compara la forma, no la altura';
   curve.after(note);
  }
  if(total!==null&&index===cards.length-1&&total%20!==0){
   const badge=document.createElement('span');
   badge.className='tr2-block-incomplete';
   badge.textContent='Bloque en curso · '+total%20+'/20 registros';
   badge.setAttribute('aria-label',badge.textContent);
   card.querySelector('.block-top')?.append(badge);
  }
 }
 const comparison=root.querySelector('.block-compare');
 if(comparison)comparison.classList.add('tr2-block-comparison');
}
function calendar(root){
 const panel=root.querySelector('.calendar-panel');
 if(!panel)return;
 panel.classList.add('tr2-calendar-panel');
 for(const day of panel.querySelectorAll('.calendar-day')){
  const heading=day.querySelector('.calendar-day-head');
  const count=heading?.querySelector('span');
  const value=day.querySelector('.calendar-day-result');
  const n=Number((count?.textContent||'').match(/^\d+/)?.[0]||0);
  if(count&&n>0){count.textContent='n='+n;count.setAttribute('aria-label',n+' operaciones del día');}
  if(!value)continue;
  if(n===0){
   day.classList.add('tr2-calendar-empty');
   day.setAttribute('aria-label','Día sin actividad');
   value.textContent='Sin actividad';
  }else{
   // The calendar renderer sometimes displays numerical zero even when there
   // are no eligible closed operations. Reuse canonical eligibility checks.
   let lackingEvidence=false;
   let awaitingClosure=false;
   try{
    if(typeof calendarState!=='undefined'&&typeof calendarMonthOps==='function'&&
       typeof calendarDayOps==='function'&&typeof calcMetricStats==='function'){
     const d=Number(heading?.querySelector('strong')?.textContent);
     const dateKey=[calendarState.year,String(calendarState.month+1).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
     const trades=calendarDayOps(calendarMonthOps(),dateKey);
     awaitingClosure=Array.isArray(trades)&&trades.length>0&&trades.every(op=>!op.exitDate);
     if(calendarState.metric==='discipline'&&typeof calendarDisciplinePct==='function'){
      lackingEvidence=calendarDisciplinePct(trades)===null;
     }else lackingEvidence=calcMetricStats(trades,calendarState.unit,calendarState.basis).n===0;
    }
   }catch(_){}
   if(lackingEvidence||value.textContent.trim()==='—'){
    day.classList.add('tr2-calendar-unevaluated');
   if(awaitingClosure){day.classList.add('tr2-calendar-awaiting-closure');value.textContent='Pendiente de cierre';}
   else value.textContent='No evaluado';
   }else if(day.classList.contains('flat-day')){
    day.classList.add('tr2-calendar-zero');
    // Zero is valid only with an eligible measurement.
   }
  }
  const ancillary=day.querySelector('.calendar-day-meta');
  if(ancillary)ancillary.classList.add('tr2-calendar-secondary');
 }
 const legend=panel.querySelector('.calendar-legend');
 if(legend){
  const old=[...legend.querySelectorAll('span')].find(span=>span.textContent.includes('neutro / sin muestra'));
  if(old)old.lastChild.textContent=' cero o neutro';
  const text=document.createElement('span');text.className='tr2-calendar-key';
  text.textContent='Sin actividad: sin operaciones · Pendiente de cierre: ninguna salida registrada · No evaluado: sin datos elegibles para la métrica';
  legend.append(text);
 }
 const totals=panel.querySelector('.calendar-month-kpis');
 if(totals){
  for(const box of totals.children){
   const label=box.querySelector('span')?.textContent?.trim()||'';
   box.classList.add(['Resultado','Operaciones'].includes(label)?'tr2-calendar-month-primary':'tr2-calendar-month-secondary');
  }
 }
}
function decorate(view,html){
 if(!['dashboard','operations','blocks','calendar'].includes(view)||typeof html!=='string')return html;
 const frame=document.createElement('template');frame.innerHTML=html;
 switch(view){
  case 'dashboard':dashboard(frame.content);break;
  case 'operations':operations(frame.content);break;
  case 'blocks':blocks(frame.content);break;
  case 'calendar':calendar(frame.content);break;
 }
 const first=frame.content.firstElementChild;
 if(first)first.classList.add('tr2-view-start-'+view);
 return frame.innerHTML;
}
if(typeof trRenderViewHtml==='function'){
 const base=trRenderViewHtml;
 trRenderViewHtml=function(view){return decorate(view,base(view));};
}
document.addEventListener('click',event=>{
 const expand=event.target?.closest?.('#view [data-tr2-equity-expand]');
 if(expand){
  expandedEquity=!expandedEquity;
  const grid=expand.closest('.dashboard-panel-grid');
  grid?.classList.toggle('tr2-equity-expanded',expandedEquity);
  expand.setAttribute('aria-pressed',String(expandedEquity));
  expand.textContent=expandedEquity?'Usar proporción guardada':'Ampliar curva a 2/3';
  return;
 }
 const button=event.target?.closest?.('#view [data-tr2-compact-switch]');
 if(!button)return;
 compactRegister=!compactRegister;
 button.setAttribute('aria-pressed',String(compactRegister));
 button.textContent=compactRegister?'Vista completa':'Vista compacta';
 const panel=button.closest('.table-module');
 if(panel)panel.classList.toggle('tr2-compact',compactRegister);
});
function enhanceOperationModal(){
 for(const form of document.querySelectorAll('.modal-backdrop #operationForm')){
  const modal=form.closest('.modal');
  if(!modal||modal.classList.contains('tr2-operation-modal'))continue;
  modal.classList.add('tr2-operation-modal');
  const context=form.querySelector('.plan-readonly');
  if(context)context.setAttribute('aria-label','Trading Plan activo y contexto de la operación');
  const foot=modal.querySelector('.modal-foot');
  if(foot)foot.setAttribute('aria-label','Acciones del formulario de operación');
 }
}
const observer=new MutationObserver(records=>{
 if(records.some(record=>record.addedNodes?.length)){
  enhanceOperationModal();
  tr2ConnectEquityChart();
 }
});
observer.observe(document.body,{subtree:true,childList:true});
window.addEventListener('resize',tr2QueueChartFit,{passive:true});
enhanceOperationModal();
tr2ConnectEquityChart();
globalThis.TradingResearchVisualPR2=Object.freeze({version:'1',decorate,enhanceOperationModal});
})();