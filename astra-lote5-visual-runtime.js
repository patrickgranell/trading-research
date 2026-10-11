/* Astra Lote 5 · TR-UX-012/023.
 * DOM presentation only: preserve every existing plan action and original capture buttons. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchAstraLote5Visual)return;
function planPresentation(root){
 for(const card of root.querySelectorAll('.plan-card:not([data-tr5-ready])')){
  const actions=card.querySelector('.plan-actions');
  if(!actions)continue;
  card.dataset.tr5Ready='1';
  card.classList.add('tr5-plan-card');
  const buttons=[...actions.querySelectorAll(':scope > button')];
  const keep=buttons.filter(b=>/^(Abrir|Editar)$/.test(b.textContent.trim()));
  const extras=buttons.filter(b=>!keep.includes(b));
  for(const btn of buttons)btn.classList.remove('primary');
  const open=keep.find(b=>b.textContent.trim()==='Abrir');
  if(open)open.classList.add('primary');
  if(extras.length){
   const more=document.createElement('details');more.className='tr5-plan-maintenance';
   const title=document.createElement('summary');title.textContent='Más acciones';
   title.setAttribute('aria-label','Acciones de mantenimiento de '+(card.querySelector('.plan-title')?.textContent.trim()||'Trading Plan'));
   const body=document.createElement('div');body.className='tr5-plan-maintenance-menu';
   for(const btn of extras)body.append(btn);
   more.append(title,body);actions.append(more);
  }
 }
 const tables=root.querySelectorAll('.table-wrap');
 for(const container of tables){
  container.classList.add('tr5-contained-table');
  container.setAttribute('role','region');
  container.setAttribute('tabindex','0');
  const title=container.closest('.card,section')?.querySelector('h3,h4')?.textContent?.trim()||'Tabla de Trading Research';
  container.setAttribute('aria-label',title+' · desplazamiento horizontal dentro de la tabla');
 }
}
function comparePresentation(overlay){
 if(!overlay||overlay.dataset.tr5Comparison)return;
 const grid=overlay.querySelector('.compare-grid');
 if(!grid)return;
 const trades=[...grid.querySelectorAll(':scope > .compare-trade')];
 if(trades.length<2)return;
 overlay.dataset.tr5Comparison='1';
 overlay.classList.add('tr5-compare-backdrop');
 grid.classList.add('tr5-compare-grid','tr5-compare-count-'+Math.min(4,trades.length));
 for(const trade of trades){
  const images=trade.querySelector('.operation-image-grid');
  if(!images)continue;
  images.classList.add('tr5-compare-images');
  const buttons=[...images.querySelectorAll('.image-thumb-btn')];
  if(buttons.length)buttons[0].classList.add('tr5-primary-capture');
  for(const button of buttons){
   button.setAttribute('title','Ampliar captura completa');
   const caption=button.querySelector('span')?.textContent?.trim()||'Captura de operación';
   button.setAttribute('aria-label','Ampliar '+caption);
  }
  const explanation=document.createElement('div');explanation.className='tr5-compare-help';
  explanation.textContent='Captura completa sin recorte · pulsa la imagen para ampliar';
  images.before(explanation);
 }
 const head=overlay.querySelector('.modal-head h3');
 if(head)head.textContent='Comparación de capturas · '+trades.length+' operaciones';
}
function compareImageLabels(root){
 const count=document.getElementById('galleryCompareCount');
 if(!count||!root.querySelector('.gallery-kpis'))return;
 const label=[...root.querySelectorAll('.gallery-kpis .kpi')].find(n=>n.textContent.includes('Seleccionadas'));
 const value=label?.querySelector('.value');
 if(value&&value.textContent!==count.textContent)value.textContent=count.textContent;
}
function decorate(view,html){
 if(typeof document==='undefined'||typeof html!=='string')return html;
 if(view!=='plans'&&view!=='gallery')return html;
 const frame=document.createElement('template');frame.innerHTML=html;
 if(view==='plans')planPresentation(frame.content);
 return frame.innerHTML;
}
if(typeof trRenderViewHtml==='function'){
 const base=trRenderViewHtml;
 trRenderViewHtml=function(view){return decorate(view,base(view));};
}
const watcher=new MutationObserver(()=>{
 const overlay=[...document.querySelectorAll('.modal-backdrop')].at(-1);
 if(overlay?.querySelector('.compare-grid')&&!overlay.dataset.tr5Comparison)comparePresentation(overlay);
 if(globalThis.TradingResearchCurrentViewReadContract?.current?.()==='gallery')compareImageLabels(document);
});
watcher.observe(document.body,{subtree:true,childList:true});
globalThis.TradingResearchAstraLote5Visual=Object.freeze({decorate,planPresentation,comparePresentation});
})();