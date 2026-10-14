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
 const active=Object.entries(typeof labState==='object'?labState:{})
  .filter(([key,value])=>['q','dateFrom','dateTo','timeFrom','timeTo','setup','vd','nr','hypothesis','context','direction','risk','source','result','contract','block','focus','stress','behavior','emotion','month','year','rMin','rMax','days'].includes(key)&&value!==''&&value!=null&&(!Array.isArray(value)||value.length));
 if(active.length){const chip=document.createElement('small');chip.className='trvis3-active-filter-summary';chip.textContent='Aplicados: '+active.map(([key,value])=>key+' '+(Array.isArray(value)?value.join(', '):String(value))).join(' · ');summary.append(chip);}
 summary.append(label,count,caption);
 const panel=document.createElement('div');panel.className='trvis3-filter-panel';
 // Keep unit/base controls visible: they are not optional filters.
 const metricControl=filter.querySelector('.metric-switch');
 // Move the ORIGINAL filter panel — do not clone or fabricate replacements.
 filter.replaceWith(shell);panel.append(filter);shell.append(summary,panel);
 // The analysis task tabs and live sample context must precede the filters.
 shell.before(nav);
 if(metricControl){const always=document.createElement('div');always.className='trvis3-lab-unitbar';always.append(metricControl);shell.before(always);}
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

function elevateResearchEvidence(root){
 const grid=root.querySelector('.research-grid-module'),segment=root.querySelector('[data-tr6-group="segmentation"]');
 if(segment&&!segment.querySelector('.trvis3-grid-legend')){
  const note=document.createElement('p');note.className='trvis3-grid-legend';
  note.textContent='Lectura: valor y n en cada celda. La intensidad del color es relativa a cada matriz; una muestra pequeña limita la evidencia, no cambia el resultado.';
  const anchor=grid?.querySelector('.research-grid-wrap')||segment.firstElementChild;
  if(anchor)anchor.before(note);else segment.append(note);
 }
 if(grid){
  for(const td of grid.querySelectorAll('td.research-cell')){
   const n=Number((td.querySelector('small')?.textContent||'').match(/n\s*=\s*(\d+)/)?.[1]);
   if(Number.isFinite(n)&&n<10&&!td.classList.contains('empty-cell')){
    td.classList.add('trvis3-low-sample');td.dataset.trvis3LowSample=String(n);
    const button=td.querySelector('button');
    if(button)button.title=(button.title?button.title+' · ':'')+'Muestra insuficiente para conclusiones estables (n='+n+')';
   }
  }
 }
 const validation=root.querySelector('[data-tr6-group="validation"]');
 if(validation&&!validation.querySelector('.trvis3-validation-explanation')){
  const line=document.createElement('p');line.className='trvis3-validation-explanation';
  line.innerHTML='<strong>Descubrimiento y validación son universos distintos.</strong> OOS real = solo operaciones futuras tras congelar. El intervalo de confianza describe incertidumbre de la muestra; Monte Carlo/Bootstrap simula escenarios, no constituye evidencia OOS.';
  validation.prepend(line);validation.classList.add('trvis3-validation-layout');
 }
}
function decorateBuilder(html){
 if(typeof html!=='string'||!html.includes('id="tp-builder-view"'))return html;
 const tpl=document.createElement('template');tpl.innerHTML=html;
 const root=tpl.content,view=root.querySelector('#tp-builder-view');
 if(!view||view.dataset.trvis3Builder)return html;
 view.dataset.trvis3Builder='1';
 const source=root.querySelector('#tpb-source');
 if(source){
  const label=document.createElement('label');label.className='trvis3-builder-source-field';
  const title=document.createElement('span');title.textContent='Trading Plan de origen';
  source.replaceWith(label);label.append(title,source);
 }
 const filter=root.querySelector('#tpb-date-from')?.closest('.card.panel');
 if(filter){
  filter.classList.add('trvis3-builder-filters');
  const fgrid=filter.querySelector('.filter-grid');
  if(fgrid){
   for(const label of fgrid.querySelectorAll('label')){
    if(label.querySelector(':scope > span')||!label.querySelector('input,select'))continue;
    const original=[...label.childNodes].filter(x=>x.nodeType===Node.TEXT_NODE&&x.textContent.trim());
    if(original.length){
     const span=document.createElement('span');span.textContent=original.map(x=>x.textContent.trim()).join(' ');
     original.forEach(x=>x.remove());label.prepend(span);
    }
   }
  }
  filter.querySelector('.chip-row')?.classList.add('trvis3-builder-weekdays');
 }
 const names={backtest:'Backtesting',replay:'Market Replay',sim:'SIM',live:'Live',unclassified:'Sin clasificar',
  win:'Ganadora',loss:'Perdedora',flat:'Neutra',pending:'Pendiente'};
 for(const select of [root.querySelector('#tpb-layer'),root.querySelector('#tpb-result')]){
  for(const option of select?.options||[]){const label=names[option.value];if(label)option.textContent=label;}
 }
 const compare=view.querySelector('.grid.two');
 if(compare){
  compare.classList.add('trvis3-builder-comparison');
  const head=document.createElement('div');head.className='trvis3-builder-comparison-title';
  head.innerHTML='<h3>Comparación de muestras</h3><small>Universo original frente al resultante: los valores conservan las métricas canónicas.</small>';
  compare.before(head);
  const create=root.querySelector('[data-tr-action-click="tpBuilderOpenCreate"]');
  if(create){
   const row=document.createElement('div');row.className='trvis3-builder-create-row';
   const hint=document.createElement('div');hint.innerHTML='<strong>Crear nueva muestra congelada</strong><small>Se copiarán las operaciones incluidas con IDs independientes. El origen no se modifica.</small>';
   row.append(hint,create);compare.after(row);
  }
 }
 return tpl.innerHTML;
}
function decorateGallery(html){
 if(typeof html!=='string')return html;
 const tpl=document.createElement('template');tpl.innerHTML=html;
 const root=tpl.content,filter=root.querySelector('#galQ')?.closest('.filter-hub'),gallery=root.querySelector('.trade-gallery-grid');
 if(!filter||root.querySelector('.trvis3-gallery-filters'))return html;
 const counter=root.querySelector('.gallery-kpis');
 const shell=document.createElement('details');shell.className='trvis3-gallery-filters';
 const summary=document.createElement('summary');summary.className='trvis3-gallery-filter-summary';
 const active=[...filter.querySelectorAll('input,select')].filter(el=>!!el.value).length;
 const count=root.querySelectorAll('.gallery-trade-card').length;
 summary.textContent='Filtros de capturas · '+active+' activos · '+count+' operaciones visibles';
 const content=document.createElement('div');content.className='trvis3-gallery-filter-content';
 filter.replaceWith(shell);content.append(filter);shell.append(summary,content);
 if(counter){counter.classList.add('trvis3-gallery-counter');shell.before(counter);}
 if(gallery)gallery.classList.add('trvis3-gallery-evidence');
 for(const card of root.querySelectorAll('.gallery-trade-card'))card.classList.add('trvis3-visual-card');
 return tpl.innerHTML;
}
function decorateMarket(html){
 if(typeof html!=='string')return html;
 const tpl=document.createElement('template');tpl.innerHTML=html;
 const root=tpl.content,tabs=root.querySelector('.tr6-market-tabs'),context=root.querySelector('.tr6-market-context');
 if(!tabs||!context||root.querySelector('.trvis3-market-sources'))return html;
 const requires=context.querySelector('.tr6-prerequisites');
 const tab=tabs.querySelector('[aria-selected="true"]')?.textContent?.trim()||'';
 const baseNote=[...root.querySelectorAll('.notice')].find(n=>n.textContent.includes('Tres capas separadas:'));
 const details=document.createElement('details');details.className='trvis3-market-sources';details.open=!!requires;
 const summary=document.createElement('summary');summary.textContent='Fuentes, requisitos y contexto técnico'+(requires?' · atención necesaria':'');
 const content=document.createElement('div');content.className='trvis3-market-source-content';
 context.replaceWith(details);content.append(context);
 if(baseNote)content.prepend(baseNote);
 details.append(summary,content);
 // Keep an unmet prerequisite prominent and actionable; otherwise the
 // selected analysis chart or calibration workbench comes first.
 if(!requires)root.append(details);
 if(tab.includes('Recorrido')){
  const panel=root.querySelector('.rp-panel');
  if(panel)panel.classList.add('trvis3-market-hero');
 }
 return tpl.innerHTML;
}

if(typeof trRenderViewHtml==='function'){
 const original=trRenderViewHtml;
 trRenderViewHtml=function(view){
  const html=original.apply(this,arguments);
  const route=view??globalThis.TradingResearchCurrentViewReadContract?.current?.();
  if(route==='lab'){
   const transformed=decorateLab(html);
   const fragment=document.createElement('template');fragment.innerHTML=transformed;
   elevateResearchEvidence(fragment.content);
   return fragment.innerHTML;
  }
  if(route==='tpbuilder')return decorateBuilder(html);
  if(route==='gallery')return decorateGallery(html);
  if(route==='market')return decorateMarket(html);
  return html;
 };
}
document.addEventListener('toggle',event=>{
 const details=event.target;
 if(details?.matches?.('.trvis3-lab-filters')&&details.isConnected)labFiltersOpen=details.open;
},true);
globalThis.TradingResearchVisualPR3=Object.freeze({
 version:'0.2',decorateLab,decorateBuilder,decorateGallery,decorateMarket,get labFiltersOpen(){return labFiltersOpen;}
});
})();