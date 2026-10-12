/* Astra · Lote 8: presentation and focus only; no changes to filter values. */
(()=>{
'use strict';
const actions=globalThis.TradingResearchActions;
if(!actions||typeof document==='undefined')return;
const DAY_NAMES=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
function decorateWeekdays(root){
 const scope=root?.querySelectorAll?root:document;
 for(const row of scope.querySelectorAll('#tp-builder-view .chip-row, .day-filter-row')){
  if(row.querySelector('.tr8-week-selector'))continue;
  const builder=!!row.closest('#tp-builder-view');
  const selector=builder?':scope > button[data-day][data-tr-action-click="tpBuilderToggleDay"]':':scope > button[data-day-chip]';
  const buttons=[...row.querySelectorAll(selector)];
  const order=builder?[0,1,2,3,4,5,6]:[1,2,3,4,5,6,0];
  if(buttons.length!==7||buttons.some((b,i)=>Number(builder?b.dataset.day:b.dataset.dayChip)!==order[i]))continue;
  const group=document.createElement('div');
  group.className='tr8-week-selector';
  group.setAttribute('role','group');
  group.setAttribute('aria-label','Días de la semana');
  for(const button of buttons){
   const index=Number(builder?button.dataset.day:button.dataset.dayChip);
   button.classList.add('tr8-week-day');
   button.setAttribute('aria-label',DAY_NAMES[index]);
   button.setAttribute('aria-pressed',button.classList.contains('active')?'true':'false');
   group.append(button);
  }
  // The operations filter updates its button classes without re-rendering.
  // Reflect only the accessibility state, never its filter values.
  if(!builder){
   const sync=new MutationObserver(records=>{
    for(const change of records){
     const b=change.target;
     const pressed=b.classList.contains('active')?'true':'false';
     if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);
    }
   });
   sync.observe(group,{attributes:true,attributeFilter:['class'],subtree:true});
  }
  const reset=builder?null:row.querySelector(':scope > .reset-filter');
  if(reset)reset.before(group);else row.append(group);
  row.classList.add('tr8-week-row');
 }
}
if(typeof trRenderViewHtml==='function'){
 const original=trRenderViewHtml;
 trRenderViewHtml=function(view){
  const html=original(view);
  if((view??globalThis.TradingResearchCurrentViewReadContract?.current?.())!=='tpbuilder'||!html.includes('tp-builder-view'))return html;
  const tpl=document.createElement('template');tpl.innerHTML=html;
  decorateWeekdays(tpl.content);
  return tpl.innerHTML;
 };
}
const originalToggle=actions.tpBuilderToggleDay;
if(typeof originalToggle==='function'){
 actions.tpBuilderToggleDay=function(...args){
  const index=this?.dataset?.day;
  const result=originalToggle.apply(this,args);
  if(index!==undefined){
   const focus=()=>document.querySelector('#tp-builder-view .tr8-week-day[data-day="'+index+'"]')?.focus({preventScroll:true});
   focus();
   queueMicrotask(focus);
  }
  return result;
 };
}
let scheduled=false;
const observer=new MutationObserver(()=>{
 if(scheduled)return;
 scheduled=true;
 queueMicrotask(()=>{
  scheduled=false;
  decorateWeekdays(document);
 });
});
observer.observe(document.body,{childList:true,subtree:true});
decorateWeekdays(document);
globalThis.TradingResearchAstraLote8=Object.freeze({version:'1.0',dayCount:7,visualOnly:true});
})();