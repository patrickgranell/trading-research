/* TR-VIS PR3 · Research-first layout, presentation adapter only.
 * Keeps the original input elements, IDs, selected options and dispatched
 * actions unchanged; no mutation of Trading Plan or research state. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchVisualPR3)return;
let labFiltersOpen=false;
function decorateLab(html){
 if(typeof html!=='string')return html;
 const template=document.createElement('template');template.innerHTML=html;
 const root=template.content,nav=root.querySelector('.tr6-lab-navigation');
 const filter=root.querySelector('.lab-filter-hub');
 if(!nav||!filter||root.querySelector('.trvis3-lab-filters'))return html;
 const originalIds=[...filter.querySelectorAll('input[id],select[id],textarea[id]')].map(x=>x.id);
 const context=nav.querySelector('.tr6-context-line');
 const badges=[...context?.querySelectorAll('span')||[]].map(x=>x.textContent.trim());
 const filterCount=badges.find(x=>/^\d+ filtros?$/.test(x))||'Filtros disponibles';
 const sample=badges.find(x=>/operaciones de/.test(x))||'';
 const shell=document.createElement('details');
 shell.className='trvis3-lab-filters';shell.open=labFiltersOpen;
 shell.setAttribute('data-trvis3-lab-filters','');
 const summary=document.createElement('summary');
 summary.className='trvis3-lab-filter-summary';
 const label=document.createElement('span');label.className='trvis3-lab-filter-name';label.textContent='Filtros de investigación';
 const count=document.createElement('span');count.className='trvis3-lab-filter-count';count.textContent=filterCount;
 const caption=document.createElement('small');caption.textContent='Abrir todos los filtros, incluidos los personalizados';
 summary.append(label,count,caption);
 const panel=document.createElement('div');panel.className='trvis3-filter-panel';
 // Move the ORIGINAL filter panel — do not clone or fabricate replacements.
 filter.replaceWith(shell);panel.append(filter);shell.append(summary,panel);
 // The analysis task tabs and live sample context must precede the filters.
 shell.before(nav);
 if(context){
  const hint=document.createElement('span');hint.className='trvis3-lab-sample';
  hint.textContent=sample?sample+' · Todos los filtros conservados':'Todos los filtros conservados';
  hint.setAttribute('role','status');context.append(hint);
 }
 const movedIds=[...shell.querySelectorAll('input[id],select[id],textarea[id]')].map(x=>x.id);
 if(JSON.stringify(originalIds)!==JSON.stringify(movedIds)){
  throw new Error('PR3 Laboratory filter inventory mismatch');
 }
 const grid=root.querySelector('.tr6-lab-group-container');
 if(grid)grid.classList.add('trvis3-lab-analysis');
 return template.innerHTML;
}
if(typeof trRenderViewHtml==='function'){
 const original=trRenderViewHtml;
 trRenderViewHtml=function(view){
  const html=original.apply(this,arguments);
  const route=view??globalThis.TradingResearchCurrentViewReadContract?.current?.();
  return route==='lab'?decorateLab(html):html;
 };
}
document.addEventListener('toggle',event=>{
 const details=event.target;
 if(details?.matches?.('.trvis3-lab-filters')&&details.isConnected)labFiltersOpen=details.open;
},true);
globalThis.TradingResearchVisualPR3=Object.freeze({
 version:'0.1',decorateLab,get labFiltersOpen(){return labFiltersOpen;}
});
})();