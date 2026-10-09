/* Astra UI/UX Lote 4 · six visual/accessibility recommendations.
   Presentation only: original editors, action handlers and persistence remain authoritative. */
(()=>{
'use strict';
const actions=window.TradingResearchActions||{};
const configTab=()=>window.TradingResearchConfigTabStateContract?.current?.()||'';
let emotionalSection='questions',perspectiveQuery='',perspectiveStatus='all',perspectiveSelection='';
const modalMeta=new WeakMap();
let lastTrigger=null,knownModals=[],refreshScheduled=false;
const focusable='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const visible=el=>el?.getClientRects?.().length&&!el.hidden&&!el.closest('[hidden],[inert]');
const getCurrent=()=>[...document.querySelectorAll('.modal-backdrop')].filter(x=>x.isConnected).at(-1)||null;
const text=el=>String(el?.textContent||'').trim();
function formSnapshot(form){
 return [...form.querySelectorAll('input:not([readonly]):not([disabled]),select:not([disabled]),textarea:not([readonly]):not([disabled])')].map(c=>{
  if(c.type==='file')return [c.id,c.files?.length||0,c.files?.[0]?.name||''];
  if(c.type==='checkbox'||c.type==='radio')return [c.id,c.checked];
  return [c.id,c.value];
 });
}
function isDirty(backdrop){
 const form=backdrop?.querySelector('form'),stored=modalMeta.get(backdrop)?.form;
 return !!(form&&stored&&JSON.stringify(formSnapshot(form))!==stored);
}
function titleFor(backdrop){
 const modal=backdrop.querySelector('[role="dialog"]');if(!modal)return;
 const title=modal.querySelector('.modal-head h3')||modal.querySelector('h2,h3');
 if(title){title.id||='tr4-modal-heading-'+Math.random().toString(36).slice(2);modal.setAttribute('aria-labelledby',title.id);title.setAttribute('tabindex','-1');}
 modal.setAttribute('aria-modal','true');
 const body=modal.querySelector('.modal-body'),help=body?.querySelector('.notice,.context-help-summary');
 if(help){help.id||='tr4-modal-description-'+Math.random().toString(36).slice(2);modal.setAttribute('aria-describedby',help.id);}
 if(body?.querySelector('#glossary-search')){
  const search=body.querySelector('#glossary-search');
  search.setAttribute('aria-label','Buscar conceptos en el glosario');
  modal.classList.add('tr4-glossary');
  const protectedNote=modal.querySelector('.modal-lock-note');if(protectedNote)protectedNote.remove();
 }
 if(body?.querySelector('#operationForm'))modal.classList.add('tr4-operation');
 if(body?.querySelector('#operationForm')){
  const category=body.querySelector('#screenCategory'),caption=body.querySelector('#screenCaption');
  if(category)category.setAttribute('aria-label','Categoría de las nuevas capturas');
  if(caption)caption.setAttribute('aria-label','Nota común de las nuevas capturas');
 }
 if(body?.querySelector('[id^="f-rm-"]'))modal.classList.add('tr4-risk');
 for(const field of modal.querySelectorAll('.field')){
  const label=field.querySelector(':scope > label:not([for])');
  const control=field.querySelector(':scope > input[id],:scope > select[id],:scope > textarea[id]');
  if(label&&control)label.setAttribute('for',control.id);
 }
 for(const label of modal.querySelectorAll('label')){
  if(label.hasAttribute('for')||label.querySelector('input,select,textarea'))continue;
  const control=label.parentElement?.querySelector(':scope > input[id],:scope > select[id],:scope > textarea[id]');
  if(control)label.setAttribute('for',control.id);
 }
 for(const b of modal.querySelectorAll('.emotion-token>button')){
  if(!b.getAttribute('aria-label'))b.setAttribute('aria-label','Eliminar categoría '+text(b.parentElement).replace('×','').trim());
 }
 if(modal.classList.contains('tr4-risk')&&!modal.querySelector('.tr4-risk-inline')){
  for(const field of modal.querySelectorAll('.field')){
   const input=field.querySelector('input[type="number"][id^="f-rm-"]');
   if(!input||!/pérdida|consecutiv|días/i.test(text(field.querySelector('label'))))continue;
   const note=document.createElement('small');note.className='tr4-risk-inline';note.textContent='0 = sin límite para esta regla.';
   note.id='tr4-rule-'+input.id;input.setAttribute('aria-describedby',note.id);field.append(note);
  }
 }
 if(modal.querySelector('.modal-head h3')?.textContent.includes('Editar Trading Plan')){
  const note=[...modal.querySelectorAll('.notice')].find(el=>text(el).includes('El nuevo plan empezará'));
  if(note)note.innerHTML=note.innerHTML.replace('El nuevo plan empezará sin setups, VD, NR, hipótesis ni estrategias.','Editas el Trading Plan seleccionado y su versión; los cambios no crean otro plan.');
 }
}
function focusOptions(b){return [...b.querySelectorAll(focusable)].filter(visible);}
function initializeModal(b){
 titleFor(b);
 if(!modalMeta.has(b)){
  const form=b.querySelector('form');
  modalMeta.set(b,{opener:lastTrigger?.isConnected?lastTrigger:document.activeElement,form:form?JSON.stringify(formSnapshot(form)):null});
 }
 const modal=b.querySelector('[role="dialog"]');
 if(modal&&!modal.contains(document.activeElement)){
  const search=modal.querySelector('#glossary-search');
  (search||focusOptions(modal)[0]||modal.querySelector('.modal-head h3')||modal).focus({preventScroll:true});
 }
}
function onModalChanges(){
 const current=[...document.querySelectorAll('.modal-backdrop')];
 const removed=knownModals.filter(m=>!current.includes(m));
 knownModals=current;
 if(current.length)initializeModal(current.at(-1));
 else if(removed.length){
  const opener=modalMeta.get(removed.at(-1))?.opener;
  if(opener?.isConnected&&typeof opener.focus==='function')opener.focus({preventScroll:true});
 }
}
function scheduleRefresh(){
 if(refreshScheduled)return;
 refreshScheduled=true;
 queueMicrotask(()=>{refreshScheduled=false;onModalChanges();});
}
function glossaryDetail(button){
 const backdrop=button.closest('.modal-backdrop'),search=backdrop?.querySelector('#glossary-search');
 if(!backdrop||!search)return false;
 const idArgs=button.getAttribute('data-tr-args-click');
 let id='';
 try{
  const decoded=JSON.parse(decodeURIComponent(idArgs||''));
  id=String(Array.isArray(decoded)?decoded[0]:decoded||'');
 }catch(_){
  const old=button.getAttribute('data-tr-onclick')||'';
  id=old.match(/openContextHelp\(['"]([^'"]+)['"]\)/)?.[1]||'';
 }
 if(!id||typeof actions.openContextHelp!=='function')return false;
 const list=backdrop.querySelector('#glossary-list');
 if(!list)return false;
 const previousScroll=list.scrollTop;
 actions.openContextHelp(id);
 const generated=[...document.querySelectorAll('.modal-backdrop')].find(x=>x!==backdrop);
 const data=generated?.querySelector('.context-help-modal');
 if(!data)return false;
 const heading=generated.querySelector('.modal-head h3')?.textContent||text(button.querySelector('strong'))||'Detalle';
 data.remove();generated.remove();
 const area=backdrop.querySelector('.modal-body');
 const detail=document.createElement('section');detail.id='tr4-glossary-detail';
 const title=document.createElement('h4');title.textContent=heading;
 const back=document.createElement('button');back.type='button';back.className='btn small';back.textContent='← Volver a resultados';
 back.addEventListener('click',()=>{
  detail.remove();search.parentElement.hidden=false;list.hidden=false;
  list.scrollTop=previousScroll;
  (button.isConnected?button:search).focus({preventScroll:true});
 });
 detail.append(back,title,data);
 search.parentElement.hidden=true;list.hidden=true;
 area.append(detail);back.focus({preventScroll:true});
 return true;
}
document.addEventListener('click',event=>{
 const target=event.target instanceof Element?event.target:null;
 if(!target)return;
 const glossary=target.closest('#glossary-list button');
 if(glossary&&glossary.closest('.modal-backdrop')){
  event.preventDefault();event.stopImmediatePropagation();glossaryDetail(glossary);return;
 }
 const close=target.closest('.modal-backdrop .modal-foot button');
 if(close&&String(close.getAttribute('data-tr-action-click')||'').trim()==='closeModal'&&isDirty(close.closest('.modal-backdrop'))){
  if(!window.confirm('Hay modificaciones sin guardar. ¿Descartar los cambios?')){event.preventDefault();event.stopImmediatePropagation();return;}
 }
 if(!target.closest('.modal-backdrop')){
  const opener=target.closest('button,a,[role="button"]');
  if(opener)lastTrigger=opener;
 }
},true);
document.addEventListener('keydown',event=>{
 const b=getCurrent();if(!b)return;
 if(event.key==='Tab'){
  const nodes=focusOptions(b),first=nodes[0],last=nodes.at(-1);
  if(!first){event.preventDefault();b.querySelector('[role="dialog"]')?.focus();return;}
  if(!b.contains(document.activeElement)){event.preventDefault();first.focus();return;}
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  return;
 }
 if(event.key==='Escape'){
  const glossary=!!b.querySelector('#glossary-search'),readonly=!!b.querySelector('.context-help-modal')&&!b.querySelector('form');
  if(!glossary&&!readonly&&!b.querySelector('form'))return;
  event.preventDefault();event.stopPropagation();
  if(glossary&&b.querySelector('#tr4-glossary-detail')){
   b.querySelector('#tr4-glossary-detail button')?.click();return;
  }
  if(isDirty(b)&&!window.confirm('Hay modificaciones sin guardar. ¿Descartar los cambios?'))return;
  if(typeof actions.closeModal==='function')actions.closeModal();
 }
},true);
function setupEmotional(html){
 if(configTab()!=='emotional')return html;
 const tpl=document.createElement('template');tpl.innerHTML=html;
 const content=tpl.content;
 const categories=content.querySelector('.emotion-config-grid');
 const questions=content.querySelector('.session-taxonomy-section');
 const library=content.querySelector('.perspective-config-section');
 if(!categories||!questions||!library)return html;
 const panel=categories.closest('section.card.panel');
 if(!panel)return html;
 const nav=document.createElement('nav');nav.className='tr4-emotional-nav';nav.setAttribute('aria-label','Configurar Diario emocional');
 for(const [key,title] of [['questions','Preguntas'],['categories','Categorías'],['library','Biblioteca de perspectivas']]){
  const button=document.createElement('button');button.type='button';button.className='tr4-emotional-tab'+(emotionalSection===key?' is-current':'');
  button.dataset.trActionClick='trAstraL4EmotionTab';button.dataset.trArgsClick=encodeURIComponent(JSON.stringify([key]));
  button.textContent=title;
  if(emotionalSection===key)button.setAttribute('aria-current','page');
  nav.append(button);
 }
 panel.querySelector('.panel-title')?.after(nav);
 for(const [node,key] of [[questions,'questions'],[categories,'categories'],[library,'library']]){
  node.dataset.tr4Pane=key;node.hidden=emotionalSection!==key;
 }
 const global=document.createElement('p');global.className='tr4-scope';
 global.innerHTML='<strong>Biblioteca compartida:</strong> estas perspectivas son globales y se utilizan en todos los Trading Plans; no se duplican en cada plan.';
 library.prepend(global);
 const cards=[...library.querySelectorAll('.perspective-config-card')];
 if(cards.length){
  const controls=document.createElement('div');controls.className='tr4-perspective-filters';
  controls.innerHTML='<label>Buscar por autor o contexto<input type="search" class="input" id="tr4-perspective-search" data-tr-action-input="trAstraL4PerspectiveSearch"></label>'+
   '<label>Estado<select class="select" id="tr4-perspective-status" data-tr-action-change="trAstraL4PerspectiveStatus"><option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>'+
   '<label>Seleccionar perspectiva<select class="select" id="tr4-perspective-select" data-tr-action-change="trAstraL4PerspectivePick"></select></label>';
  library.querySelector('.panel-title')?.after(controls);
  controls.querySelector('#tr4-perspective-search').value=perspectiveQuery;
  controls.querySelector('#tr4-perspective-status').value=perspectiveStatus;
  updatePerspectiveCards(library,perspectiveSelection);
 }
 for(const b of panel.querySelectorAll('.emotion-token>button'))if(!b.getAttribute('aria-label'))b.setAttribute('aria-label','Eliminar categoría '+text(b.parentElement).replace('×','').trim());
 for(const button of panel.querySelectorAll('.session-question-list .btn.danger')){
  const row=button.closest('.form-grid'),name=row?.querySelector('input')?.value;
  button.setAttribute('aria-label','Eliminar pregunta '+(name||'de sesión'));
 }
 return tpl.innerHTML;
}
function updatePerspectiveCards(library,choose=''){
 const cards=[...library.querySelectorAll('.perspective-config-card')];
 const matches=cards.filter(c=>{
  const active=!c.classList.contains('inactive');
  const q=(text(c.querySelector('header strong'))+' '+text(c.querySelector('.perspective-config-meta'))+' '+text(c.querySelector('blockquote'))).toLocaleLowerCase('es');
  return (!perspectiveQuery||q.includes(perspectiveQuery.toLocaleLowerCase('es')))&&
   (perspectiveStatus==='all'||(perspectiveStatus==='active'?active:!active));
 });
 const select=library.querySelector('#tr4-perspective-select');
 if(!select)return;
 select.replaceChildren();
 for(const c of matches){
  const option=document.createElement('option');
  option.value=c.querySelector('button[data-perspective-id]')?.dataset.perspectiveId||'';
  option.textContent=(text(c.querySelector('header strong'))||'Sin autor')+' · '+text(c.querySelector('blockquote')).slice(0,58);
  select.append(option);
 }
 const chosen=matches.find(c=>c.querySelector('button[data-perspective-id]')?.dataset.perspectiveId===(choose||perspectiveSelection))||matches[0];
 perspectiveSelection=chosen?.querySelector('button[data-perspective-id]')?.dataset.perspectiveId||'';
 select.value=perspectiveSelection;
 for(const c of cards)c.hidden=c!==chosen;
 let note=library.querySelector('.tr4-perspective-empty');
 if(!note){note=document.createElement('p');note.className='tr4-perspective-empty';library.querySelector('.perspective-config-list')?.before(note);}
 note.textContent=matches.length?matches.length+' resultados · muestra una ficha editable por vez.':'No hay perspectivas que coincidan con los filtros.';
}
actions.trAstraL4EmotionTab=key=>{
 if(!['questions','categories','library'].includes(key))return;
 emotionalSection=key;
 const root=document.querySelector('.config-tab-content');
 if(!root)return;
 for(const el of root.querySelectorAll('[data-tr4-pane]'))el.hidden=el.dataset.tr4Pane!==key;
 for(const btn of root.querySelectorAll('.tr4-emotional-tab')){
  const is=JSON.parse(decodeURIComponent(btn.dataset.trArgsClick||'[]'))[0]===key;
  btn.classList.toggle('is-current',is);
  if(is)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
 }
};
actions.trAstraL4PerspectiveSearch=function(){perspectiveQuery=String(this.value||'');updatePerspectiveCards(document.querySelector('.perspective-config-section'),perspectiveSelection);};
actions.trAstraL4PerspectiveStatus=function(){perspectiveStatus=String(this.value||'all');updatePerspectiveCards(document.querySelector('.perspective-config-section'),perspectiveSelection);};
actions.trAstraL4PerspectivePick=function(){perspectiveSelection=String(this.value||'');updatePerspectiveCards(document.querySelector('.perspective-config-section'),perspectiveSelection);};
function microcopy(view,html){
 const tpl=document.createElement('template');tpl.innerHTML=html;const root=tpl.content;
 for(const button of root.querySelectorAll('button')){
  const label=text(button),action=button.getAttribute('data-tr-action-click')||'';
  if(label==='Limpiar dataset'&&action==='navigate')button.textContent='Abrir calidad de datos';
  if(label==='Actualizar referencia')button.textContent='Actualizar referencia de comparación';
  if(label==='Detalle + 20 operaciones')button.textContent='Ver detalle del bloque';
  if(label==='Guardar'&&/library|biblioteca/i.test(button.closest('.modal,.library-panel,.panel')?.textContent||'')&&/Library|Biblioteca/.test(action))button.textContent='Guardar en biblioteca';
  if(label==='×'&&!button.getAttribute('aria-label')){
   const obj=button.closest('.emotion-token')?.textContent.replace('×','').trim()||button.closest('article,li')?.querySelector('strong,h3')?.textContent||'elemento';
   button.setAttribute('aria-label','Eliminar '+obj);
  }
  if(button.classList.contains('research-swap'))button.setAttribute('aria-label','Intercambiar filas y columnas del Research Grid');
 }
 if(view==='blocks'){
  for(const card of root.querySelectorAll('.block-card')){
   const spark=card.querySelector('.block-spark'),dates=text(card.querySelector('.block-dates'));
   const final=text(card.querySelector('.block-core-grid>div:nth-child(3)>strong'));
   if(!spark||!dates||!final||card.querySelector('.tr4-block-curve-caption'))continue;
   const caption=document.createElement('div');caption.className='tr4-block-curve-caption';
   caption.textContent='Curva acumulada · '+dates+' · inicio 0 → final '+final;
   spark.after(caption);
  }
  for(const card of root.querySelectorAll('.block-detail-kpis>div')){
   const label=card.querySelector('span'),title=text(label);
   if(title==='Máx. ganancia')label.title='Mayor resultado positivo de una sola operación del bloque, no media ganadora.';
   if(title==='Máx. pérdida')label.title='Mayor pérdida individual de una sola operación del bloque, no media perdedora.';
  }
 }
 for(const field of root.querySelectorAll('.field')){
  const label=field.querySelector(':scope > label:not([for])');
  const control=field.querySelector(':scope > input[id],:scope > select[id],:scope > textarea[id]');
  if(label&&control)label.setAttribute('for',control.id);
 }
 for(const metric of root.querySelectorAll('.kpi .value,.dashboard-mini-stats strong,.block-core-grid strong')){
  if(/^\+\+(?=\d)/.test(metric.textContent.trim()))metric.textContent=metric.textContent.trim().replace(/^\+\+/,'+');
 }
 if(view==='config'&&configTab()==='cloud'){
  for(const b of root.querySelectorAll('.info-dot')){
   if(/Bruto|Neto/i.test(b.getAttribute('aria-label')||''))b.remove();
  }
 }
 return tpl.innerHTML;
}
if(typeof trRenderViewHtml==='function'){
 const previous=trRenderViewHtml;
 trRenderViewHtml=function(view){
  const output=previous(view);
  if(typeof output!=='string')return output;
  const current=view||window.TradingResearchCurrentViewReadContract?.current?.();
  return current==='config'?setupEmotional(microcopy(current,output)):microcopy(current,output);
 };
}
new MutationObserver(scheduleRefresh).observe(document.body,{childList:true,subtree:true});
onModalChanges();
// A remembered Config page can be mounted before the final adapter loads.
queueMicrotask(()=>{if(window.TradingResearchCurrentViewReadContract?.current?.()==='config'&&configTab()==='emotional')window.render?.();});
window.TradingResearchAstraLote4=Object.freeze({currentEmotionalSection:()=>emotionalSection,isDirty,updatePerspectiveCards});
})();
