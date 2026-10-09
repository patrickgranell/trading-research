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
  if(value)value.textContent=count.textContent;
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
document.addEventListener('pointerdown',ev=>{
 if(!topOverlay())latestTrigger=ev.target.closest('button,a,[role="button"],input,select');
},true);
document.addEventListener('click',ev=>{
 if(!topOverlay())latestTrigger=ev.target.closest('button,a,[role="button"],input,select');
 const top=topOverlay();
 if(!top)return;
 const button=ev.target.closest('button');
 if(!button||!top.contains(button))return;
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
