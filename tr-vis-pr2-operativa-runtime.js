/* TR-VIS PR2 — Operativa y resumen · non-destructive presentation layer.
   TR-VIS-004/005/007/010/013/014/015. Never edits metric formulas, saved
   Dashboard profiles, stored operations, filters or Trading Plan domain data. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchVisualPR2)return;
let compactRegister=false;
const priorities=new Set(['result','expectancy','pf','drawdown']);
function dashboard(root){
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
   if(others.length===1)grid.classList.add('tr2-two-panel-dashboard');
  }
 }
 const unit=root.querySelector('.dashboard-unit-switch');
 if(unit)unit.setAttribute('aria-label','Unidad de visualización de las métricas del Dashboard');
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
  }else if(value.textContent.trim()==='—'){
   day.classList.add('tr2-calendar-unevaluated');
   value.textContent='No evaluado';
  }else if(day.classList.contains('flat-day')){
   day.classList.add('tr2-calendar-zero');
   // Zero stays visible as a legitimate 0. An undefined metric stays '—'.
  }
  const ancillary=day.querySelector('.calendar-day-meta');
  if(ancillary)ancillary.classList.add('tr2-calendar-secondary');
 }
 const legend=panel.querySelector('.calendar-legend');
 if(legend){
  const old=[...legend.querySelectorAll('span')].find(span=>span.textContent.includes('neutro / sin muestra'));
  if(old)old.lastChild.textContent=' cero o neutro';
  const text=document.createElement('span');text.className='tr2-calendar-key';
  text.textContent='Sin actividad: sin operaciones · No evaluado: métrica sin evidencia';
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
 if(records.some(record=>record.addedNodes?.length))enhanceOperationModal();
});
observer.observe(document.body,{subtree:true,childList:true});
enhanceOperationModal();
globalThis.TradingResearchVisualPR2=Object.freeze({version:'1',decorate,enhanceOperationModal});
})();