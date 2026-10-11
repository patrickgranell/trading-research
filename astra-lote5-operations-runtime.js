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
document.addEventListener('toggle',event=>{
 const details=event.target;
 if(!(details instanceof HTMLDetailsElement)||!details.matches('.tr5-advanced-panel')||!details.isConnected)return;
 if(details.open)expandedFilterGroups.add('Filtros avanzados');
 else expandedFilterGroups.delete('Filtros avanzados');
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
  // Help is available on the accessible control, never below one field:
  // explanatory paragraphs caused misaligned Result/Origin/Regime controls.
  if(explanation){
   select.setAttribute('aria-description',explanation);
   select.title=explanation;
   field?.querySelector('.tr5-filter-meaning')?.remove();
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
 for(const select of document.querySelectorAll('#view .filter-grid [data-tax-filter-ops]')){
  if(!select.value)continue;
  const label=select.closest('label')?.querySelector('span')?.textContent?.trim()||select.dataset.taxonomyId;
  out.push([label,select.selectedOptions[0]?.textContent?.trim()||select.value]);
 }
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

}

// Canonical taxonomy fields are generated by taxonomy-runtime.js and depend on the
// active Trading Plan, including its custom taxonomies. Base view rendering can
// bypass the later runtime decoration; compensate using the SAME IDs/actions/data.
function ensureCanonicalTaxonomyFilters(grid){
 const p=readPlan(),api=globalThis.TradingResearchTaxonomyDomain;
 if(!p||!api||typeof api.activeTaxonomies!=='function')return [];
 const active=api.activeTaxonomies(p);
 const applied=globalThis.TradingResearchTaxonomyFilterReadContract?.operations?.()||{};
 const ops=readOps().filter(op=>!p.id||!op.tradingPlanId||op.tradingPlanId===p.id);
 const coreLegacy={setup:'filterSetup',vd:'filterVD',nr:'filterNR',hypothesis:'filterHypothesis'};
 for(const tax of active){
  const id='trTaxOps_'+tax.id;
  const existing=[...grid.querySelectorAll('[data-tax-filter-ops]')].find(x=>x.dataset.taxonomyId===tax.id);
  if(!existing){
   const label=document.createElement('label');label.className='filter-field';
   const caption=document.createElement('span');caption.textContent=tax.name;
   const select=document.createElement('select');
   select.className='select';select.id=id;select.dataset.taxonomyId=tax.id;
   select.dataset.taxFilterOps='1';select.setAttribute('data-tr-onchange','filterOperations()');
   const all=document.createElement('option');all.value='';all.textContent='Todos';select.append(all);
   const values=api.selectionOptions(p,tax)||[];
   const included=new Set(values.map(v=>String(v.id)));
   const list=[...values];
   // Historic IDs are only offered in Operations if an actual operation uses them.
   // Their IDs are kept unchanged; no migration or renaming is performed.
   for(const op of ops){
    const value=api.operationValue(tax,op);
    if(!value||included.has(String(value.id)))continue;
    included.add(String(value.id));
    list.push({...value,status:'historical'});
   }
   const stored=String(applied[tax.id]||'');
   if(stored&&!included.has(stored)){
    included.add(stored);
    const value=api.valueById(tax,stored);
    list.push(value||{id:stored,name:stored,status:'historical'});
   }
   const archive=list.filter(v=>v.status==='historical'||v.status==='archived');
   const current=list.filter(v=>v.status!=='historical'&&v.status!=='archived');
   const add=(target,v)=>{
    const option=document.createElement('option');option.value=String(v.id);
    option.textContent=String(v.name)+(v.status==='historical'?' · histórico':v.status==='archived'?' · archivado':'');
    if(String(v.id)===stored){option.selected=true;option.defaultSelected=true;option.setAttribute('selected','');}
    target.append(option);
   };
   for(const v of current)add(select,v);
   if(archive.length){
    const group=document.createElement('optgroup');group.label='Históricos presentes en operaciones';
    archive.forEach(v=>add(group,v));select.append(group);
   }
   label.append(caption,select);grid.append(label);
  }else{
   // Never re-create already generated selectors: preserve their listeners and selection.
   const stored=String(applied[tax.id]||'');
   if(stored&&[...existing.options].some(x=>x.value===stored)){
    existing.value=stored;
    [...existing.options].forEach(option=>{
     option.defaultSelected=option.value===stored;
     if(option.defaultSelected)option.setAttribute('selected','');
     else option.removeAttribute('selected');
    });
   }
  }
  const legacyId=coreLegacy[tax.id];
  if(legacyId){
   const old=grid.querySelector('#'+legacyId);
   if(old)old.closest('.filter-field')?.remove();
  }
 }
 return active.map(t=>({id:'trTaxOps_'+t.id,name:t.name,taxonomyId:t.id}));
}

function compactFilters(root){
 const panel=root.querySelector('.filter-hub'),grid=panel?.querySelector('.filter-grid');
 if(!panel||!grid||panel.classList.contains('tr5-progressive'))return;
 const taxonomyControls=ensureCanonicalTaxonomyFilters(grid);
 const originalChildren=[...grid.children];
 const idsBefore=new Set([...grid.querySelectorAll('select[id],input[id]')].map(el=>el.id));
 // Each original field is kept, including unrecognized extensions and historical taxonomy selectors.
 // Duplicate controls with the SAME ID and action are consolidated, preserving their option universe.
 const fields=new Map(),anonymous=[];
 const fieldId=node=>node.querySelector('input[id],select[id]')?.id||'';
 for(const node of originalChildren){
  const id=fieldId(node);
  if(!id){anonymous.push(node);continue;}
  const first=fields.get(id);
  if(!first){fields.set(id,node);continue;}
  const primary=first.querySelector('select'),duplicate=node.querySelector('select');
  if(primary&&duplicate){
   const known=new Set([...primary.options].map(o=>o.value));
   for(const option of [...duplicate.options]){
    if(known.has(option.value))continue;
    primary.append(option.cloneNode(true));known.add(option.value);
   }
   if(!primary.value&&duplicate.value)primary.value=duplicate.value;
  }else if(!primary&&!duplicate){
   const a=first.querySelector('input'),b=node.querySelector('input');
   if(a&&b&&!a.value&&b.value)a.value=b.value;
  }
  // The same ID is dispatched as one filter in the original model: no duplicate widget.
 }
 const quickRow=document.createElement('div');quickRow.className='tr5-quick-filters';
 const consumed=new Set();
 for(const id of quick){
  const wanted=id==='filterSetup'&&fields.has('trTaxOps_setup')?'trTaxOps_setup':id;
  const node=fields.get(wanted);
  if(node){quickRow.append(node);consumed.add(wanted);}
 }
 const more=document.createElement('details');
 more.className='tr5-advanced-panel';
 more.dataset.tr5Group='Filtros avanzados';
 more.open=expandedFilterGroups.has('Filtros avanzados');
 const summary=document.createElement('summary');summary.className='tr5-advanced-summary';
 const advancedContent=document.createElement('div');advancedContent.className='tr5-advanced-content';
 const taxonomyIds=taxonomyControls.map(x=>x.id).filter(id=>id!=='trTaxOps_setup');
 const sections=[
  ['Taxonomías del Trading Plan', taxonomyIds],
  ['Otras clasificaciones', ['filterVD','filterNR','filterHypothesis','filterRisk','filterLayer']],
  ['Contexto y seguimiento', ['filterContract','filterBlock','filterEmotion','filterBehavior','filterEmotionStatus','filterRiskPolicy']],
  ['Tiempo y calendario', ['filterTimeFrom','filterTimeTo','filterMonth','filterYear']]
 ];
 const group=(heading,nodes)=>{
  if(!nodes.length)return;
  const section=document.createElement('section');section.className='tr5-filter-group';
  const title=document.createElement('h4');title.textContent=heading;
  const body=document.createElement('div');body.className='tr5-filter-detail-grid';
  for(const node of nodes)body.append(node);
  section.append(title,body);advancedContent.append(section);
 };
 for(const [heading,ids] of sections){
  const nodes=[];
  for(const id of ids){
   const node=fields.get(id);
   if(node&&!consumed.has(id)){nodes.push(node);consumed.add(id);}
  }
  group(heading,nodes);
 }
 const unassigned=[];
 for(const [id,node] of fields)if(!consumed.has(id)){unassigned.push(node);consumed.add(id);}
 unassigned.push(...anonymous);
 group('Otros filtros originales',unassigned);
 const moduleRow=panel.querySelector('.quick-row');
 if(moduleRow){
  const section=document.createElement('section');section.className='tr5-filter-group tr5-period-controls';
  const title=document.createElement('h4');title.textContent='Periodos rápidos y módulos gráficos';
  section.append(title,moduleRow);advancedContent.append(section);
 }
 summary.textContent='Filtros avanzados · '+(fields.size-consumed.size+anonymous.length)+' adicionales';
 more.append(summary,advancedContent);
 grid.replaceChildren(quickRow,more);
 panel.classList.add('tr5-progressive');
 // Contract: all distinct source controls must remain addressable exactly once,
 // even if future versions add fields unknown to this adapter.
 const after=[...grid.querySelectorAll('select[id],input[id]')].map(el=>el.id);
 const idsAfter=new Set(after);
 if(idsAfter.size!==idsBefore.size||after.length!==idsAfter.size||[...idsBefore].some(id=>!idsAfter.has(id))){
  console.error('[Astra Lote 5] Filter parity violation; original panel restored', [...idsBefore],after);
  grid.replaceChildren(...originalChildren);
  panel.classList.remove('tr5-progressive');
  return;
 }
 const filterStatus=document.createElement('div');filterStatus.className='tr5-filter-status';
 filterStatus.setAttribute('aria-live','polite');panel.append(filterStatus);
 clarifyFilterSemantics(root);
 syncedOptions(root);
 refreshSummary(root);
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