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
const quick=['searchOps','filterDateFrom','filterDateTo','filterResult','filterSetup','filterDirection'];
const advanced=[
 ['Clasificación',['filterVD','filterNR','filterHypothesis','filterRisk','filterLayer','filterSource']],
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
function badgeSummary(){
 const f=opsFilterState();if(!f)return [];
 const defs={q:'Texto',dateFrom:'Desde',dateTo:'Hasta',timeFrom:'Hora desde',timeTo:'Hora hasta',
  setup:'Setup',vd:'VD',nr:'NR',direction:'Dirección',result:'Resultado',layer:'Entorno',
  contract:'Contrato',hypothesis:'Hipótesis',risk:'Régimen',month:'Mes',year:'Año',block:'Bloque',
  emotion:'Emoción',behavior:'Comportamiento',emotionStatus:'Diario',source:'Origen'};
 const out=[];
 for(const [id,label] of Object.entries(defs)){
  const value=f[id];if(value===undefined||value===null||value==='')continue;
  out.push([label,String(value)]);
 }
 if(f.days?.length)out.push(['Días',f.days.join(', ')]);
 if(f.riskPolicy==='plan')out.push(['Gestión','Reglas TP']);
 return out;
}
function refreshSummary(root=document){
 const summary=root.querySelector('.tr5-filter-status');
 if(!summary)return;
 const chips=badgeSummary();
 const signature=JSON.stringify(chips);
 if(summary.dataset.tr5Signature===signature)return;
 summary.dataset.tr5Signature=signature;
 summary.replaceChildren();
 const label=document.createElement('span');label.className='tr5-active-label';
 label.textContent=chips.length?chips.length+' filtros activos':'Sin filtros adicionales';
 summary.append(label);
 for(const [key,val] of chips){
  const chip=document.createElement('span');chip.className='tr5-active-filter';
  chip.textContent=key+': '+val;summary.append(chip);
 }
 const reset=document.createElement('button');reset.type='button';reset.className='btn small ghost';
 reset.textContent='Restablecer filtros';
 reset.disabled=!chips.length;
 reset.addEventListener('click',()=>registry.resetOpsFilters?.());
 summary.append(reset);
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
  const sum=document.createElement('summary');sum.textContent=title;
  const body=document.createElement('div');body.className='tr5-filter-detail-grid';
  for(const id of ids){used.add(id);const el=map.get(id);if(el)body.append(el);}
  details.append(sum,body);sections.append(details);
 }
 const extra=[...grid.children].filter(el=>!used.has(el.querySelector('input,select')?.id));
 if(extra.length){
  const details=document.createElement('details');details.className='tr5-filter-details';
  const body=document.createElement('div');body.className='tr5-filter-detail-grid';
  for(const el of extra)body.append(el);
  const sum=document.createElement('summary');sum.textContent='Otros filtros';
  details.append(sum,body);sections.append(details);
 }
 grid.replaceChildren(common,sections);
 const moduleRow=panel.querySelector('.quick-row');
 if(moduleRow){
  const details=document.createElement('details');details.className='tr5-module-settings';
  const s=document.createElement('summary');s.textContent='Periodos rápidos y módulos gráficos';
  details.append(s,moduleRow);sections.append(details);
 }
 panel.append(summary);
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
  }else if(control.tagName==='INPUT'&&key==='h4Context')control.value='';
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
const watch=new MutationObserver(mutations=>{
 const view=globalThis.TradingResearchCurrentViewReadContract?.current?.();
 if(view==='operations'){
  const area=document.getElementById('opsAnalyticsArea');
  if(area&&!area.querySelector('.tr5-ops-layout'))organizeAnalytics(document);
  if(document.querySelector('.tr5-filter-status'))refreshSummary(document);
 }
 const op=document.querySelector('.modal-backdrop:last-of-type .modal');
 if(op&&op.querySelector('#operationForm:not([data-tr5-intent])'))operationFormIntent(op);
 // Do not update the DOM when none of the observed edits affects this lot.
});
watch.observe(document.body,{childList:true,subtree:true});
if(typeof trRenderViewHtml==='function'){
 const base=trRenderViewHtml;
 trRenderViewHtml=function(view){const resolved=view??globalThis.TradingResearchCurrentViewReadContract?.current?.();return renderView(resolved,base(view));};
}
globalThis.TradingResearchAstraLote5Operations=Object.freeze({renderView,compactFilters,organizeAnalytics,operationFormIntent,syncedOptions,refreshSummary});
})();