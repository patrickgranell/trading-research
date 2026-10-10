/* Astra Lote 5 · TR-UX-003/007 and E65.
 * Presentation adapter; no writes to saved studies, operations, TP, or calculation methods.
 * The original filter inputs and actions are retained in the DOM. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchAstraLote5Operations)return;
const registry=window.TradingResearchActions||{};
const readPlan=()=>globalThis.TradingResearchPlanReadContract?.current?.();
const readOps=()=>globalThis.TradingResearchOperationsReadContract?.current?.()||[];
const safe=s=>globalThis.TradingResearchContentEncodingContract?.html?.(String(s??''))??String(s??'');
const encode=a=>encodeURIComponent(JSON.stringify(a));
let opsTab='register';
const expandedFilterGroups=new Set();
function updateCollapseAction(root=document){
 const button=root.querySelector('.tr5-collapse-advanced');
 if(button)button.hidden=!root.querySelector('.tr5-advanced-sections details[open]');
}
document.addEventListener('toggle',event=>{
 const node=event.target;
 if(!(node instanceof HTMLDetailsElement)||!node.matches('.tr5-filter-details,.tr5-module-settings')||!node.isConnected)return;
 const group=node.dataset.tr5Group;
 if(!group)return;
 if(node.open)expandedFilterGroups.add(group);
 else expandedFilterGroups.delete(group);
 updateCollapseAction(node.closest('.filter-hub')||document);
},true);
const quick=['searchOps','filterDateFrom','filterDateTo','filterResult','filterSetup','filterDirection','filterSource'];
const advanced=[
 ['Clasificación y ámbito',['filterVD','filterNR','filterHypothesis','filterRisk','filterLayer']],
 ['Contexto y seguimiento',['filterContract','filterBlock','filterEmotion','filterBehavior','filterEmotionStatus','filterRiskPolicy']],
 ['Tiempo y calendario',['filterTimeFrom','filterTimeTo','filterMonth','filterYear']]
];
const filterFields=['setup','vd','nr','hypothesis','h4Context','h4Phase','tradeType','direction'];
function historicalOptions(select,items,currentValue){
 if(!select)return;
 const existing=new Set([...select.options].map(x=>String(x.value)));
 const labelList=items.map(x=>String(x??'').trim()).filter(Boolean);
 if(currentValue)labelList.push(String(currentValue));
 const extras=[...new Set(labelList)].filter(x=>!existing.has(x)).sort((a,b)=>a.localeCompare(b,'es'));
 if(extras.length){
  const group=document.createElement('optgroup');
  group.label='Históricos presentes en operaciones';
  for(const value of extras){
   const option=document.createElement('option');option.value=value;
   option.textContent=value+' · histórico';group.append(option);
  }
  select.append(group);
 }
 if(currentValue!==undefined&&currentValue!==null&&String(currentValue)!==''){
  const requested=String(currentValue);
  if([...select.options].some(o=>o.value===requested)){
   // The filter is rendered in a detached template and serialized to HTML.
   // Set the selected ATTRIBUTE, not only the live DOM value (E65).
   for(const option of select.options){
    const on=option.value===requested;
    option.selected=on;
    if(on)option.setAttribute('selected','');
    else option.removeAttribute('selected');
   }
  }
 }
}
function opsFilterState(){
 try{return typeof opsViewState!=='undefined'?opsViewState:null;}catch(_){return null;}
}
function labFilterState(){
 try{return typeof labState!=='undefined'?labState:null;}catch(_){return null;}
}
function syncedOptions(root,lab=false){
 const p=readPlan(),ops=readOps(),state=lab?labFilterState():opsFilterState();
 if(!p)return;
 const cols=lab?[
  ['labSetup','setup','setups'],['labVD','vd','vd'],['labNR','nr','nr'],
  ['labContext','context','h4Context']
 ]:[
  ['filterSetup','setup','setups'],['filterVD','vd','vd'],['filterNR','nr','nr'],
  ['filterHypothesis','hypothesis','hypotheses']
 ];
 for(const [id,field,source] of cols){
  const select=root.querySelector('#'+id);if(!select)continue;
  const values=field==='hypothesis'?(p.hypotheses||[]).map(o=>o?.name||o?.id||''):
   ops.map(o=>o[source==='h4Context'?'h4Context':field]);
  historicalOptions(select,values,state?.[field]);
 }
 // E65: the visible control MUST show the applied saved-study value.
 if(lab){
  const control=root.querySelector('#labContext'),chip=[...root.querySelectorAll('.lab-active-chip')].find(x=>x.querySelector('span')?.textContent.trim()==='Contexto');
  const applied=String(state?.context||chip?.querySelector('strong')?.textContent?.trim()||'');
  if(control&&applied){
   historicalOptions(control,[],applied);
   control.value=applied;
  }
 }
}
function clarifyFilterSemantics(root){
 const set=(id,label,options,explanation)=>{
  const select=root.querySelector('#'+id);
  if(!select)return;
  const field=select.closest('label');
  const title=field?.querySelector('span');
  if(title&&title.textContent!==label)title.textContent=label;
  for(const [value,description] of Object.entries(options)){
   const option=[...select.options].find(o=>o.value===value);
   if(option&&option.textContent!==description)option.textContent=description;
  }
  if(explanation&&field&&!field.querySelector('.tr5-filter-meaning')){
   const note=document.createElement('small');
   note.className='tr5-filter-meaning';note.textContent=explanation;
   field.append(note);
  }
 };
 set('filterLayer','Ámbito de ejecución',{
  pending:'Pendiente de vinculación NT',
  unclassified:'Sin entorno clasificado'
 },'Pendiente NT = operación preparada para conciliar con fills. No indica un resultado pendiente.');
 set('filterResult','Resultado',{
  pending:'Pendiente de resultado'
 },'Busca aquí operaciones sin resultado confirmado.');
 set('filterSource','Origen del registro',{
  manual:'Manual',
  ankora:'Ankora',
  ninjatrader:'NinjaTrader'
 },'Manual = creada en Trading Research, no importada; no es un entorno operativo.');
}
function badgeSummary(){
 const f=opsFilterState()||{};
 const defs={q:['Texto','searchOps'],dateFrom:['Desde','filterDateFrom'],dateTo:['Hasta','filterDateTo'],
  timeFrom:['Hora desde','filterTimeFrom'],timeTo:['Hora hasta','filterTimeTo'],
  setup:['Setup','filterSetup'],vd:['VD','filterVD'],nr:['NR','filterNR'],
  direction:['Dirección','filterDirection'],result:['Resultado','filterResult'],
  layer:['Entorno','filterLayer'],contract:['Contrato','filterContract'],
  hypothesis:['Hipótesis','filterHypothesis'],risk:['Régimen','filterRisk'],month:['Mes','filterMonth'],
  year:['Año','filterYear'],block:['Bloque','filterBlock'],emotion:['Emoción','filterEmotion'],
  behavior:['Comportamiento','filterBehavior'],emotionStatus:['Diario','filterEmotionStatus'],
  source:['Origen','filterSource']};
 const out=[];
 // Read what the user can actually SEE. The original state remains the source
 // of analytics; this is purely the display summary and works after partial DOM replacement.
 for(const [id,[label,inputId]] of Object.entries(defs)){
  const input=document.getElementById(inputId);
  const value=input?input.value:(f[id]??'');
  if(value===undefined||value===null||value==='')continue;
  out.push([label,String(value)]);
 }
 const activeDays=[...document.querySelectorAll('#view [data-day-chip].active')].map(el=>el.textContent.trim());
 if(activeDays.length)out.push(['Días',activeDays.join(', ')]);
 else if(f.days?.length)out.push(['Días',f.days.join(', ')]);
 if((document.getElementById('filterRiskPolicy')?.value||f.riskPolicy)==='plan')out.push(['Gestión','Reglas TP']);
 return out;
}
function refreshSummary(root=document){
 const summary=root.querySelector('.tr5-filter-status');
 if(!summary)return;
 const chips=badgeSummary();
 const signature=JSON.stringify(chips);
 if(summary.dataset.tr5Signature===signature)return;
 summary.dataset.tr5Signature=signature;
 const nativeReset=root.querySelector('.reset-filter');
 summary.replaceChildren();
 const label=document.createElement('span');label.className='tr5-active-label';
 label.textContent=chips.length?chips.length+' filtros activos':'Sin filtros adicionales';
 summary.append(label);
 for(const [key,val] of chips){
  const chip=document.createElement('span');chip.className='tr5-active-filter';
  chip.textContent=key+': '+val;summary.append(chip);
 }
 // Reuse the original event-dispatched reset. No duplicate or inert controls.
 if(nativeReset){
  nativeReset.textContent='Restablecer filtros';
  nativeReset.classList.add('tr5-reset-filters');
  summary.append(nativeReset);
 }
 const collapse=document.createElement('button');
 collapse.type='button';collapse.className='btn small ghost tr5-collapse-advanced';
 collapse.textContent='Plegar filtros avanzados';
 collapse.hidden=true;
 collapse.addEventListener('click',()=>{
  for(const el of root.querySelectorAll('.tr5-advanced-sections details[open]'))el.open=false;
  expandedFilterGroups.clear();
  updateCollapseAction(root);
 });
 summary.append(collapse);
 updateCollapseAction(root);
}
function compactFilters(root){
 const panel=root.querySelector('.filter-hub'),grid=panel?.querySelector('.filter-grid');
 if(!panel||!grid||panel.classList.contains('tr5-progressive'))return;
 panel.classList.add('tr5-progressive');
 const summary=document.createElement('div');summary.className='tr5-filter-status';
 summary.setAttribute('aria-live','polite');
 const common=document.createElement('div');common.className='tr5-quick-filters';
 const sections=document.createElement('div');sections.className='tr5-advanced-sections';
 const map=new Map([...grid.children].map(node=>[node.querySelector('input,select')?.id,node]));
 for(const id of quick){const el=map.get(id);if(el)common.append(el);}
 const used=new Set(quick);
 for(const [title,ids] of advanced){
  const details=document.createElement('details');details.className='tr5-filter-details';
  details.dataset.tr5Group=title;
  details.open=expandedFilterGroups.has(title);
  const sum=document.createElement('summary');sum.textContent=title;
  const body=document.createElement('div');body.className='tr5-filter-detail-grid';
  for(const id of ids){used.add(id);const el=map.get(id);if(el)body.append(el);}
  details.append(sum,body);sections.append(details);
 }
 const extra=[...grid.children].filter(el=>!used.has(el.querySelector('input,select')?.id));
 if(extra.length){
  const details=document.createElement('details');details.className='tr5-filter-details';
  details.dataset.tr5Group='Otros filtros';
  details.open=expandedFilterGroups.has('Otros filtros');
  const body=document.createElement('div');body.className='tr5-filter-detail-grid';
  for(const el of extra)body.append(el);
  const sum=document.createElement('summary');sum.textContent='Otros filtros';
  details.append(sum,body);sections.append(details);
 }
 grid.replaceChildren(common,sections);
 clarifyFilterSemantics(root);
 const moduleRow=panel.querySelector('.quick-row');
 if(moduleRow){
  const details=document.createElement('details');details.className='tr5-module-settings';
  details.dataset.tr5Group='Periodos rápidos y módulos gráficos';
  details.open=expandedFilterGroups.has('Periodos rápidos y módulos gráficos');
  const s=document.createElement('summary');s.textContent='Periodos rápidos y módulos gráficos';
  details.append(s,moduleRow);sections.append(details);
 }
 panel.append(summary);
 syncedOptions(root);
 refreshSummary(root);
 updateCollapseAction(root);
}
function tabs(){
 const nav=document.createElement('nav');nav.className='tr5-ops-tabs';
 nav.setAttribute('aria-label','Vistas de Operaciones');
 for(const [id,label] of [['register','Registro de operaciones'],['analysis','Análisis gráfico']]){
  const button=document.createElement('button');button.type='button';
  button.textContent=label;button.className='tr5-ops-tab';
  button.dataset.trActionClick='trAstraL5OperationsTab';button.dataset.trArgsClick=encode([id]);
  nav.append(button);
 }
 return nav;
}
function applyTab(root){
 const nav=root.querySelector('.tr5-ops-tabs');if(!nav)return;
 nav.querySelectorAll('button').forEach(b=>{
  const enabled=b.textContent.includes('Registro')?opsTab==='register':opsTab==='analysis';
  b.classList.toggle('active',enabled);
  if(enabled)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 const reg=root.querySelector('.tr5-ops-register'),analysis=root.querySelector('.tr5-ops-analysis');
 if(reg)reg.hidden=opsTab!=='register';
 if(analysis)analysis.hidden=opsTab!=='analysis';
}
function organizeAnalytics(root){
 const area=root.querySelector('#opsAnalyticsArea');
 if(!area||area.querySelector('.tr5-ops-layout')){applyTab(root);return;}
 const wrapper=document.createElement('div');wrapper.className='tr5-ops-layout';
 const register=document.createElement('div');register.className='tr5-ops-register';
 const analysis=document.createElement('div');analysis.className='tr5-ops-analysis';
 const originalTable=area.querySelector('.table-module');
 if(originalTable)register.append(originalTable);
 else{
  // A previously disabled "Tabla" graph-module toggle must never hide daily lookup.
  try{
   const rows=typeof filteredOps==='function'?filteredOps():null;
   const table=typeof opsTable==='function'&&Array.isArray(rows)?opsTable(rows):'';
   if(table){
    const card=document.createElement('section');card.className='card panel table-module';
    const head=document.createElement('div');head.className='panel-title';
    const h=document.createElement('h3');h.textContent='Registro filtrado';
    const size=document.createElement('small');size.textContent=rows.length+' operaciones visibles';
    head.append(h,size);card.append(head);
    const content=document.createElement('div');content.innerHTML=table;card.append(...content.childNodes);
    register.append(card);
   }
  }catch(e){console.warn('[Lote 5 · register fallback]',e);}
 }
 if(!register.children.length){
  const missing=document.createElement('div');missing.className='empty';
  missing.textContent='Activa el módulo Tabla para mostrar el registro de operaciones.';
  register.append(missing);
 }
 while(area.firstChild)analysis.append(area.firstChild);
 wrapper.append(register,analysis);area.append(wrapper);applyTab(root);
}
function operationsView(fragment){
 const filter=fragment.querySelector('.filter-hub');
 if(!filter)return;
 const parent=filter.parentNode;
 const nav=tabs();parent.insertBefore(nav,filter);
 compactFilters(fragment);
 organizeAnalytics(fragment);
}
function labView(fragment){syncedOptions(fragment,true);}
function renderView(view,html){
 if(typeof document==='undefined'||typeof html!=='string')return html;
 if(view!=='operations'&&view!=='lab')return html;
 const frame=document.createElement('template');frame.innerHTML=html;
 if(view==='operations')operationsView(frame.content);
 else labView(frame.content);
 return frame.innerHTML;
}
registry.trAstraL5OperationsTab=function(mode){
 if(mode!=='register'&&mode!=='analysis')return;
 opsTab=mode;applyTab(document);
};
function operationFormIntent(dialog){
 const form=dialog.querySelector('#operationForm');if(!form||form.dataset.tr5Intent)return;
 const heading=dialog.querySelector('.modal-head h3')?.textContent?.trim()||'';
 if(!/^Nueva operación$/i.test(heading)){form.dataset.tr5Intent='editing';return;}
 form.dataset.tr5Intent='new';
 for(const key of filterFields){
  const control=form.querySelector('#f-'+key);if(!control)continue;
  if(control.tagName==='SELECT'){
   const blank=[...control.options].find(x=>x.value==='');
   if(!blank){
    const placeholder=document.createElement('option');
    placeholder.value='';placeholder.textContent='Sin clasificar';control.prepend(placeholder);
   }else blank.textContent='Sin clasificar';
   control.value='';
   for(const option of control.options){
    const initial=option.value==='';
    option.selected=initial;option.defaultSelected=initial;
    if(initial)option.setAttribute('selected','');else option.removeAttribute('selected');
   }
  }else if(control.tagName==='INPUT'&&key==='h4Context'){control.value='';control.defaultValue='';}
 }
 const risk=form.querySelector('#f-riskStrategyId');
 if(risk){
  const hint=document.createElement('small');hint.className='tr5-origin-hint';
  hint.textContent='Régimen propuesto desde el Trading Plan activo. Puedes cambiarlo.';
  risk.closest('.field')?.append(hint);
 }
 const explanatory=document.createElement('p');explanatory.className='tr5-intent-hint';
 explanatory.textContent='Las clasificaciones comienzan sin asignar. Elige únicamente las que hayas observado; podrás completarlas al editar el registro.';
 form.querySelector('.form-section:nth-child(3) h4')?.after(explanatory);
}
let lastRoute=null;
function synchronizeRealView(){
 const view=globalThis.TradingResearchCurrentViewReadContract?.current?.();
 if(view==='operations'&&lastRoute!=='operations')expandedFilterGroups.clear();
 lastRoute=view;
 if(view==='operations'){
  const panel=document.querySelector('#view .filter-hub');
  // V31.13 partial rendering replaces #tr-ops-filter-region with an unmodified
  // filterPanel() after every same-view render. Rebuild progressive controls
  // on the *new* DOM instead of relying exclusively on the initial HTML adapter.
  if(panel&&!panel.classList.contains('tr5-progressive'))compactFilters(document);
  const area=document.getElementById('opsAnalyticsArea');
  if(area&&!area.querySelector('.tr5-ops-layout'))organizeAnalytics(document);
  if(document.querySelector('.tr5-filter-status'))refreshSummary(document);
  const nav=document.querySelector('#view .tr5-ops-tabs');
  if(!nav&&panel){panel.before(tabs());applyTab(document);}
 }
 const modal=[...document.querySelectorAll('.modal-backdrop')].at(-1)?.querySelector('.modal');
 if(modal?.querySelector('#operationForm:not([data-tr5-intent])'))operationFormIntent(modal);
}
let pending=false;
const watch=new MutationObserver(()=>{
 if(pending)return;
 pending=true;
 queueMicrotask(()=>{
  pending=false;
  try{synchronizeRealView();}catch(e){console.error('[Astra Lote 5 · partial render sync]',e);}
 });
});
watch.observe(document.body,{childList:true,subtree:true});
const originalOperationOpen=registry.openOperationModal;
if(typeof originalOperationOpen==='function'){
 registry.openOperationModal=function(...args){
  const result=originalOperationOpen.apply(this,args);
  const modal=[...document.querySelectorAll('.modal-backdrop')].at(-1)?.querySelector('.modal');
  if(modal?.querySelector('#operationForm:not([data-tr5-intent])'))operationFormIntent(modal);
  return result;
 };
}
if(typeof trRenderViewHtml==='function'){
 const base=trRenderViewHtml;
 trRenderViewHtml=function(view){const resolved=view??globalThis.TradingResearchCurrentViewReadContract?.current?.();return renderView(resolved,base(view));};
}
globalThis.TradingResearchAstraLote5Operations=Object.freeze({renderView,compactFilters,organizeAnalytics,operationFormIntent,syncedOptions,refreshSummary,synchronizeRealView});
})();