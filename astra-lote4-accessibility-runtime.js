/* Astra · Lote 4: single active-dialog keyboard boundary and accessible control labels.
   Presentation-only: no writes to operation/plan state or persistence. */
(function(){
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchAstraLote4Dialog)return;
let active=null;
let latestTrigger=null;
let sequence=0;
const focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function visible(el){return !!(el&&el.isConnected&&!el.hidden&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length);}
function topOverlay(){const all=Array.from(document.querySelectorAll('.modal-backdrop'));return all.length?all[all.length-1]:null;}
function fields(form){
 return Array.from(form?.querySelectorAll('input,select,textarea')||[])
 .filter(el=>!el.disabled&&!el.readOnly&&el.type!=='hidden')
 .map(el=>el.type==='checkbox'||el.type==='radio'?[el.name,el.checked]:
  el.type==='file'?[el.name,Array.from(el.files||[]).map(f=>[f.name,f.size,f.lastModified])]:
  [el.name||el.id,el.value]);
}
function changed(dialog){const form=dialog?.querySelector('form');return !!(form&&JSON.stringify(fields(form))!==dialog.dataset.tr4Initial);}
function focusItems(dialog){return Array.from(dialog.querySelectorAll(focusable)).filter(visible);}

let glossaryTop=null;
let glossaryDetail=null;
let pendingMetricHelp=null;
function consolidateGlossary(){
 const all=Array.from(document.querySelectorAll('.modal-backdrop'));
 if(all.length<2)return;
 const parent=all[all.length-2],child=all[all.length-1];
 const list=parent.querySelector('#glossary-list');
 const help=child.querySelector('.context-help-modal');
 if(!list||!help)return;
 const body=parent.querySelector('.modal-body');
 if(!body)return;
 let results=body.querySelector('.tr4-glossary-results');
 if(!results){
  results=document.createElement('div');
  results.className='tr4-glossary-results';
  const search=body.querySelector('.glossary-search');
  if(search)results.appendChild(search);
  results.appendChild(list);
  body.appendChild(results);
 }
 let detail=body.querySelector('.tr4-glossary-detail');
 if(!detail){
  detail=document.createElement('div');detail.className='tr4-glossary-detail';
  body.appendChild(detail);
 }
 detail.replaceChildren();
 const head=document.createElement('div');head.className='glossary-detail-head';
 const back=document.createElement('button');back.type='button';back.className='btn small';
 back.textContent='← Volver a resultados';back.dataset.tr4GlossaryBack='true';
 const title=document.createElement('h4');title.textContent=child.querySelector('.modal-head h3')?.textContent||'Definición';
 head.append(back,title);detail.append(head,help);
 results.classList.add('hidden');detail.classList.remove('hidden');
 child.remove();
 glossaryTop=parent;glossaryDetail=detail;
 queueMicrotask(()=>{if(parent.isConnected)back.focus({preventScroll:true});});
}
function enhancePresentation(){
 const search=document.getElementById('glossary-search');
 if(search&&!search.hasAttribute('aria-label')&&!document.getElementById('tr4-glossary-label')){
  const label=document.createElement('label');label.id='tr4-glossary-label';
  label.htmlFor='glossary-search';label.className='tr4-field-label';
  label.textContent='Buscar concepto';search.before(label);
 }
 for(const button of document.querySelectorAll('button[data-tr-onclick]')){
  const action=button.getAttribute('data-tr-onclick')||'';
  const label=button.textContent.trim();
  let next='';
  if(label==='Limpiar dataset'&&action.includes("navigate('quality')"))next='Revisar calidad del dataset';
  else if(label==='Guardar'&&action.includes('savePlanItemToLibrary'))next='Guardar en biblioteca';
  else if(label==='Actualizar referencia'&&action.includes('researchResetBaseline'))next='Actualizar referencia de comparación';
  else if(label==='Limpiar historial'&&action.includes('researchClearHistory'))next='Borrar historial de cambios';
  else if(label==='Detalle + 20 operaciones'){
   const range=button.closest('.v5-block')?.querySelector('.block-range')?.textContent?.match(/(\d+)\s*[–-]\s*(\d+)/);
   if(range)next='Detalle · '+(Number(range[2])-Number(range[1])+1)+' operaciones';
  }
  if(next&&label!==next)button.textContent=next;
 }
 for(const input of document.querySelectorAll('.modal input[id^="f-rm-"][type="number"]')){
  if(input.parentElement.querySelector('.tr4-limit-hint'))continue;
  const note=document.createElement('small');note.className='tr4-limit-hint';
  note.textContent='0 = límite desactivado';input.after(note);
 }

 // Keep the chart's chronological/value references visible without changing plotted points.
 document.querySelectorAll('.v5-block .block-spark').forEach(spark=>{
  if(spark.nextElementSibling?.classList.contains('tr4-spark-caption'))return;
  const block=spark.closest('.v5-block');
  const result=Array.from(block?.querySelectorAll('.block-core-grid>div')||[])
   .find(n=>n.querySelector('span')?.textContent.trim()==='Resultado')?.querySelector('strong')?.textContent?.trim();
  const label=document.createElement('div');label.className='tr4-spark-caption';
  label.textContent='Inicio: 0 · Cierre: '+(result||'—')+' · progresión por operaciones';
  spark.after(label);
 });
 document.querySelectorAll('.positive,.negative').forEach(el=>{
  for(const node of el.childNodes){
   if(node.nodeType===Node.TEXT_NODE&&/\+\+(?=\d)/.test(node.nodeValue||'')){
    node.nodeValue=node.nodeValue.replace(/\+\+(?=\d)/g,'+');
   }
  }
 });
 // Nube must not display an unrelated Bruto/Neto definition.
 if(globalThis.TradingResearchConfigTabStateContract?.current?.()==='cloud'){
  document.querySelectorAll('.config-tab-content .info-dot[data-help-id="basis"]').forEach(btn=>btn.remove());
 }
 const modal=topOverlay();
 if(modal){
  const lock=modal.querySelector('.modal-lock-note');
  if(lock)lock.remove(); // Escape/focus behavior is documented by actual controls, not a false 'Protected' pill.
 }
 if(modal?.querySelector('.modal-head h3')?.textContent.trim()==='Editar Trading Plan'){
  const notice=modal.querySelector('.modal-body .notice');
  const first=notice?.firstChild;
  if(first?.nodeType===Node.TEXT_NODE&&first.textContent.includes('El nuevo plan empezará')){
   first.textContent='Estás editando este Trading Plan. Guardar cambios no crea otro plan ni altera las operaciones existentes.';
  }
 }
 if(pendingMetricHelp){
  const help=modal?.querySelector('.context-help-modal');
  if(help){
   const title=modal.querySelector('.modal-head h3');
   if(title)title.textContent=pendingMetricHelp==='maxwin'?'ⓘ Máxima ganancia':'ⓘ Máxima pérdida';
   const summary=help.querySelector('.context-help-summary'),paragraphs=help.querySelectorAll('p');
   if(summary)summary.textContent=pendingMetricHelp==='maxwin'?'Mayor resultado positivo de una sola operación.':'Peor resultado negativo de una sola operación.';
   if(paragraphs[0])paragraphs[0].textContent=pendingMetricHelp==='maxwin'?'Es el resultado individual más alto, no la ganancia media.':'Es el resultado individual más negativo, no la pérdida media ni el drawdown acumulado.';
   if(paragraphs[1])paragraphs[1].textContent='Consulta este extremo junto a la media de las operaciones y el tamaño de muestra.';
   pendingMetricHelp=null;
  }
 }
}

function accessible(root){
 root.querySelectorAll('.field > label:not([for])').forEach(label=>{
  const ctrl=label.parentElement?.querySelector('input,select,textarea');
  if(!ctrl||label.contains(ctrl))return;
  if(!ctrl.id)ctrl.id='tr4-control-'+(++sequence);
  label.htmlFor=ctrl.id;
 });
 root.querySelectorAll('.emotion-token > button').forEach(btn=>{
  if(btn.textContent.trim()!=='×')return;
  const name=Array.from(btn.parentNode.childNodes).filter(n=>n!==btn).map(n=>n.textContent||'').join(' ').trim();
  btn.setAttribute('aria-label','Eliminar '+(name||'categoría emocional'));
  btn.title='Eliminar '+(name||'categoría emocional');
 });
 const count=document.getElementById('galleryCompareCount');
 if(count){
  const kpi=Array.from(document.querySelectorAll('.gallery-kpis .kpi')).find(n=>n.textContent.includes('Seleccionadas'));
  const value=kpi?.querySelector('.value');
  if(value&&value.textContent!==count.textContent)value.textContent=count.textContent;
 }
}
function setup(overlay){
 if(!overlay||overlay===active?.overlay)return;
 const trigger=latestTrigger?.isConnected?latestTrigger:(document.activeElement!==document.body?document.activeElement:null);
 active={overlay,trigger};
 const dialog=overlay.querySelector('[role="dialog"]')||overlay.querySelector('.modal');
 if(!dialog)return;
 if(!dialog.hasAttribute('aria-label')&&!dialog.hasAttribute('aria-labelledby')){
  const heading=dialog.querySelector('.modal-head h3');
  if(heading){
   if(!heading.id)heading.id='tr4-dialog-title-'+(++sequence);
   dialog.setAttribute('aria-labelledby',heading.id);
  }
 }
 accessible(dialog);
 const form=dialog.querySelector('form');
 if(form)dialog.dataset.tr4Initial=JSON.stringify(fields(form));
 queueMicrotask(()=>{
  if(topOverlay()!==overlay)return;
  const initial=overlay.querySelector('#glossary-search')||overlay.querySelector('#operationForm input:not([readonly])')||focusItems(dialog)[0]||dialog;
  if(initial===dialog&&!dialog.hasAttribute('tabindex'))dialog.tabIndex=-1;
  initial.focus({preventScroll:true});
 });
}
function refresh(){
 consolidateGlossary();
 enhancePresentation();
 accessible(document);
 const top=topOverlay();
 if(!top){
  if(active){
   const trigger=active.trigger;
   active=null;
   if(trigger?.isConnected)queueMicrotask(()=>{if(!topOverlay())trigger.focus({preventScroll:true});});
  }
  return;
 }
 if(top!==active?.overlay)setup(top);
}
document.addEventListener('click',ev=>{
 const btn=ev.target.closest('.info-dot');
 if(!btn){pendingMetricHelp=null;return;}
 const label=btn.parentElement?.textContent||'';
 pendingMetricHelp=/Máx\.?\s*ganancia/i.test(label)?'maxwin':/Máx\.?\s*pérdida/i.test(label)?'maxloss':null;
},true);
document.addEventListener('pointerdown',ev=>{
 if(!topOverlay())latestTrigger=ev.target.closest('button,a,[role="button"],input,select');
},true);
document.addEventListener('click',ev=>{
 if(!topOverlay())latestTrigger=ev.target.closest('button,a,[role="button"],input,select');
 const top=topOverlay();
 if(!top)return;
 const button=ev.target.closest('button');
 if(!button||!top.contains(button))return;
 if(button.dataset.tr4GlossaryBack==='true'){
  ev.preventDefault();ev.stopImmediatePropagation();
  const detail=top.querySelector('.tr4-glossary-detail');
  detail?.classList.add('hidden');
  top.querySelector('.tr4-glossary-results')?.classList.remove('hidden');
  top.querySelector('#glossary-search')?.focus({preventScroll:true});
  return;
 }
 const action=String(button.getAttribute('data-tr-onclick')||button.getAttribute('data-tr-action-click')||'');
 const cancelling=/closeModal/.test(action)&&/cancelar|cerrar/i.test(button.textContent||'');
 if(!cancelling)return;
 const dialog=top.querySelector('[role="dialog"]');
 if(dialog&&changed(dialog)&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos y cerrar?')){
  ev.preventDefault();ev.stopImmediatePropagation();
 }
},true);
document.addEventListener('focusin',ev=>{
 const top=topOverlay();
 if(!top||top.contains(ev.target))return;
 const first=focusItems(top)[0]||top.querySelector('.modal');
 first?.focus({preventScroll:true});
},true);
document.addEventListener('keydown',ev=>{
 const top=topOverlay();
 if(!top)return;
 const dialog=top.querySelector('[role="dialog"]')||top;
 if(ev.key==='Tab'){
  const list=focusItems(dialog);
  if(!list.length){ev.preventDefault();dialog.tabIndex=-1;dialog.focus();return;}
  const first=list[0],last=list[list.length-1],inside=dialog.contains(document.activeElement);
  if(ev.shiftKey&&(!inside||document.activeElement===first)){ev.preventDefault();last.focus();}
  else if(!ev.shiftKey&&(!inside||document.activeElement===last)){ev.preventDefault();first.focus();}
 }else if(ev.key==='Escape'){
  const hasForm=!!dialog.querySelector('form');
  const hasEditable=!!dialog.querySelector('input:not([readonly]):not([type="hidden"]),textarea,select');
  // Do not dismiss unstructured editors whose change-tracking semantics are unknown.
  if(!hasForm&&hasEditable&&!dialog.querySelector('#glossary-search'))return;
  if(!hasForm||!changed(dialog)||window.confirm('Hay cambios sin guardar. ¿Descartarlos y cerrar?')){
   ev.preventDefault();ev.stopImmediatePropagation();
   if(typeof window.closeModal==='function')window.closeModal();
  }else{ev.preventDefault();ev.stopImmediatePropagation();}
 }
},true);
const observer=new MutationObserver(()=>refresh());
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('change',()=>queueMicrotask(refresh),false);
globalThis.TradingResearchAstraLote4Dialog=Object.freeze({refresh});
refresh();
})();
