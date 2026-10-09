/* Astra Lote 4 · Presentational patterns, accessibility, and scoped emotional editor.
   Never modify persisted IDs, calculations, data schemas or backup logic. */
(()=>{
'use strict';
const actions=window.TradingResearchActions||(window.TradingResearchActions=Object.create(null));
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&#39;'}[c]));
const args=a=>encodeURIComponent(JSON.stringify(a));
let emotionalTab='questions',questionIndex=0,perspectiveIndex=0,libraryQuery='',libraryStatus='all';
const modeNames={questions:'Preguntas',categories:'Categorías',library:'Biblioteca de perspectivas'};
actions.tr4EmotionTab=t=>{if(!modeNames[t])return;emotionalTab=t;window.render();};
actions.tr4EmotionQuestion=function(){questionIndex=Math.max(0,Number(this.value)||0);window.render();};
actions.tr4EmotionPerspective=function(){perspectiveIndex=Math.max(0,Number(this.value)||0);window.render();};
actions.tr4EmotionSearch=function(){
 libraryQuery=String(this.value||'').toLocaleLowerCase('es');
 filterEmotionalList(document);
};
actions.tr4EmotionStatus=function(){libraryStatus=String(this.value||'all');filterEmotionalList(document);};
function filterEmotionalList(root){
 const field=root.querySelector('.tr4-perspective-selector');if(!field)return;
 const rows=[...field.options];let count=0;
 for(const option of rows){const active=option.dataset.active!=='false';const match=(!libraryQuery||option.textContent.toLocaleLowerCase('es').includes(libraryQuery))&&(libraryStatus==='all'||(libraryStatus==='active'?active:!active));
 option.hidden=!match;option.disabled=!match;if(match)count++;
 }
 const counter=root.querySelector('.tr4-library-count');if(counter&&counter.textContent!==count+' referencias coincidentes')counter.textContent=count+' referencias coincidentes';
 const current=field.selectedOptions?.[0];
 const chosen=current&&!current.hidden&&!current.disabled?current:rows.find(o=>!o.hidden&&!o.disabled);
 if(chosen){field.value=chosen.value;perspectiveIndex=Number(chosen.value);}
 const cards=[...root.querySelectorAll('.tr4-emotion-panel .perspective-config-card')];
 if(cards.length)cards.forEach((card,index)=>card.hidden=index!==perspectiveIndex);
 // No re-render while typing: preserve caret, focus, and any unsaved editor content.
}
function button(label,action,arg,active=false){
 return '<button type="button" class="tr4-local-tab'+(active?' is-active':'')+'" data-tr-action-click="'+action+'" data-tr-args-click="'+args([arg])+'"'+(active?' aria-current="page"':'')+'>'+safe(label)+'</button>';
}
function emotionalConfig(content){
 const panel=[...content.querySelectorAll('section.card.panel')].find(el=>el.querySelector('.emotion-config-grid')&&el.querySelector('.session-taxonomy-section'));
 if(!panel)return;
 const grid=panel.querySelector('.emotion-config-grid'),questions=panel.querySelector('.session-taxonomy-section'),library=panel.querySelector('.perspective-config-section');
 if(!grid||!questions||!library)return;
 panel.classList.add('tr4-emotion-panel');
 const title=panel.querySelector('.panel-title');if(title)title.classList.add('tr4-emotional-head');
 const tabs=document.createElement('nav');tabs.className='tr4-emotional-tabs';tabs.setAttribute('aria-label','Configurar Diario emocional');
 for(const [key,label] of Object.entries(modeNames))tabs.insertAdjacentHTML('beforeend',button(label,'tr4EmotionTab',key,emotionalTab===key));
 title?.after(tabs);
 if(emotionalTab!=='categories')grid.hidden=true;
 if(emotionalTab!=='questions')questions.hidden=true;
 if(emotionalTab!=='library')library.hidden=true;
 const owner=document.createElement('div');owner.className='tr4-emotion-owner';
 owner.textContent=emotionalTab==='library'?'Biblioteca compartida · las perspectivas son globales, también para Backtesting':'Configuración de preguntas y categorías del Trading Plan activo';
 tabs.after(owner);
 if(emotionalTab==='questions'){
  const rows=[...questions.querySelectorAll('.session-question-list>.form-grid')];
  if(rows.length>1){
    questionIndex=Math.min(questionIndex,rows.length-1);
    const picker=document.createElement('div');picker.className='tr4-editor-picker';
    const select=document.createElement('select');select.className='select';select.setAttribute('aria-label','Pregunta emocional a editar');
    rows.forEach((row,i)=>{const name=row.querySelector('input')?.value||'Pregunta '+(i+1);const o=document.createElement('option');o.value=String(i);o.textContent=name;if(i===questionIndex)o.selected=true;select.append(o);if(i!==questionIndex)row.hidden=true;});
    select.dataset.trActionChange='tr4EmotionQuestion';// event runtime reads the selected option via action this.value
    picker.innerHTML='<label for="tr4-question-select">Pregunta que quieres editar</label>';
    select.id='tr4-question-select';picker.append(select);questions.querySelector('.session-question-list')?.before(picker);
  }
 }
 if(emotionalTab==='library'){
  const list=library.querySelector('.perspective-config-list');if(!list)return;
  const cards=[...list.querySelectorAll('.perspective-config-card')];
  if(!cards.length)return;
  perspectiveIndex=Math.min(perspectiveIndex,cards.length-1);
  const filters=document.createElement('div');filters.className='tr4-library-toolbar';
  filters.innerHTML='<label>Buscar por autor, contexto o texto<input class="input" type="search" data-tr-action-input="tr4EmotionSearch" value="'+safe(libraryQuery)+'" placeholder="Autor, contexto, frase…"></label>'+
   '<label>Estado<select class="select" data-tr-action-change="tr4EmotionStatus"><option value="all">Todos</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label>'+
   '<label>Referencia<select class="select tr4-perspective-selector" data-tr-action-change="tr4EmotionPerspective" aria-label="Perspectiva seleccionada"></select></label><span class="tr4-library-count"></span>';
  const chooser=filters.querySelector('.tr4-perspective-selector');
  cards.forEach((card,i)=>{
    const author=card.querySelector('header strong')?.textContent||'Sin autor',context=card.querySelector('.perspective-config-meta strong')?.textContent||'';
    const text=card.querySelector('blockquote')?.textContent||'';
    const opt=document.createElement('option');opt.value=String(i);opt.textContent=author+' · '+context+' · '+text.slice(0,80);
    opt.dataset.active=String(!card.classList.contains('inactive'));if(i===perspectiveIndex)opt.selected=true;chooser.append(opt);
    if(i!==perspectiveIndex)card.hidden=true;
  });
  filters.querySelector('select[data-tr-action-change="tr4EmotionStatus"]').value=libraryStatus;
  list.before(filters);filterEmotionalList(filters);
 }
}
// One modal, two glossary views. Native action registry is the single event owner.
const baseHelp=actions.openContextHelp;
if(typeof baseHelp==='function')actions.openContextHelp=function(id){
 const glossary=document.querySelector('.modal-backdrop #glossary-list');
 if(!glossary)return baseHelp.apply(this,arguments);
 const button=[...glossary.querySelectorAll('[data-glossary-search]')].find(el=>{
   const action=el.getAttribute('data-tr-action-click')||el.getAttribute('data-tr-onclick')||'';
   return action.includes("'"+id+"'")||action.includes('"'+id+'"');
 });
 // Read the already rendered definition from the original help source by
 // invoking the original view only as a detached transient source, then remove it.
 const before=new Set(document.querySelectorAll('.modal-backdrop'));
 baseHelp.call(this,id);
 const added=[...document.querySelectorAll('.modal-backdrop')].find(x=>!before.has(x));
 if(!added)return;
 const originalBody=added.querySelector('.context-help-modal');
 if(!originalBody){added.remove();return;}
 const detail=document.createElement('section');detail.className='tr4-glossary-detail';detail.setAttribute('aria-label','Detalle de concepto');
 const back=document.createElement('button');back.type='button';back.className='btn small tr4-glossary-back';back.textContent='← Volver a resultados';
 back.addEventListener('click',()=>{detail.remove();glossary.closest('.glossary-search')?.removeAttribute('hidden');glossary.hidden=false;document.querySelector('#glossary-search')?.focus();});
 detail.append(back,originalBody.cloneNode(true));
 added.remove();
 glossary.hidden=true;glossary.before(detail);
 back.focus();
};
const focusables='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let modalOwner=null,activeModal=null,modalInitial='';
function readModalState(modal){return [...modal.querySelectorAll('input,select,textarea')].map(el=>(el.type==='checkbox'||el.type==='radio'?'c:'+el.checked:'v:'+el.value)).join('\u0000');}
function bindModal(modal){
 if(modal===activeModal)return;
 if(activeModal&&!document.contains(activeModal))modalOwner?.focus?.();
 modalOwner=document.activeElement;
 activeModal=modal;
 const dialog=modal.querySelector('[role="dialog"]')||modal.querySelector('.modal');
 if(!dialog)return;
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 const header=dialog.querySelector('.modal-head h3,.modal-head h2,.modal-title');
 if(header){if(!header.id)header.id='tr4-modal-title';dialog.setAttribute('aria-labelledby',header.id);header.setAttribute('tabindex','-1');}
 modalInitial=readModalState(dialog);
 const first=dialog.querySelector('input,select,textarea')||header||dialog.querySelector(focusables);
 first?.focus?.();
}
function reconcileModal(){
 const list=[...document.querySelectorAll('.modal-backdrop')];
 const top=list.at(-1)||null;
 if(top!==activeModal){
  if(!top&&activeModal){activeModal=null;const back=modalOwner;modalOwner=null;back?.isConnected&&back.focus?.();return;}
  if(top)bindModal(top);
 }
}
const isHelp=modal=>!!modal?.querySelector('#glossary-list,.context-help-modal,.tr4-glossary-detail');
document.addEventListener('keydown',event=>{
 if(!activeModal||!document.contains(activeModal))return;
 const dialog=activeModal.querySelector('[role="dialog"]')||activeModal;
 if(event.key==='Tab'){
  const els=[...dialog.querySelectorAll(focusables)].filter(el=>el.getClientRects().length>0&&!el.closest('[hidden]'));
  if(!els.length){event.preventDefault();dialog.focus();return;}
  const first=els[0],last=els.at(-1),current=document.activeElement;
  if(event.shiftKey&&(current===first||!dialog.contains(current))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(current===last||!dialog.contains(current))){event.preventDefault();first.focus();}
 }else if(event.key==='Escape'){
  event.preventDefault();event.stopImmediatePropagation();
  if(isHelp(activeModal)){actions.closeModal?.();reconcileModal();}
  else if(modalInitial===readModalState(dialog)){actions.closeModal?.();reconcileModal();}
  else if(window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')){actions.closeModal?.();reconcileModal();}
 }
},true);
document.addEventListener('click',event=>{
 const el=event.target.closest?.('button');if(!el||!activeModal||!activeModal.contains(el))return;
 const action=(el.dataset.trActionClick||el.getAttribute('data-tr-onclick')||'');
 if((/^closeModal(?:\(\))?$/).test(action)){
  const dialog=activeModal.querySelector('[role="dialog"]')||activeModal;
  if(modalInitial!==readModalState(dialog)&&!window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')){
   event.preventDefault();event.stopImmediatePropagation();
  }
 }
},true);
new MutationObserver(()=>queueMicrotask(reconcileModal)).observe(document.body,{childList:true,subtree:true});
queueMicrotask(reconcileModal);
// Scoped, in-place label and microcopy correction, not taxonomy/data rewrite.
function normalizeContent(root){
 for(const label of root.querySelectorAll('.modal .field>label:not([for])')){
   const field=label.parentElement?.querySelector('input[id],select[id],textarea[id]');
   if(field)label.htmlFor=field.id;
 }
 for(const field of root.querySelectorAll('.modal .field')){
   const label=field.querySelector(':scope > span');
   const control=field.querySelector('input,select,textarea');
   if(label&&control&&!control.getAttribute('aria-label')&&!control.closest('label'))control.setAttribute('aria-label',label.textContent.trim());
 }
 for(const b of root.querySelectorAll('.modal button,.emotion-config-list button')){
   if(b.textContent.trim()!=='×'||b.getAttribute('aria-label'))continue;
   const item=b.closest('.emotion-token')?.childNodes?.[0]?.textContent?.trim()||b.closest('.field')?.querySelector('label')?.textContent||'elemento';
   b.setAttribute('aria-label','Eliminar '+item);
   b.setAttribute('title','Eliminar '+item);
 }
 for(const b of root.querySelectorAll('button')){
   const label=b.textContent.trim();
   if(label==='Limpiar dataset')b.textContent='Revisar calidad del dataset';
   if(label==='Actualizar referencia'&&b.getAttribute('data-tr-onclick')?.includes('researchResetBaseline'))b.textContent='Actualizar referencia de comparación';
 }
 for(const cell of root.querySelectorAll('.block-card')){
   const button=[...cell.querySelectorAll('button')].find(x=>/^Detalle \+ 20 operaciones$/.test(x.textContent.trim()));
   if(!button)continue;
   const n=Number(cell.querySelector('.block-core-grid>div:first-child strong')?.textContent?.trim());
   if(Number.isFinite(n)&&n>=0)button.textContent='Detalle · '+n+' operaciones';
 }
 for(const el of root.querySelectorAll('.kpi .value,.stat-delta,.delta,.value-right')){
   if(el.children.length)continue;
   if(/^\+\+\d/.test(el.textContent.trim()))el.textContent=el.textContent.replace(/^\s*\+\+/,'+');
 }
 for(const panel of root.querySelectorAll('.modal')){
   const title=panel.querySelector('.modal-head h3')?.textContent||'';
   if(/Editar Trading Plan/i.test(title)){
    panel.querySelectorAll('.help,.notice').forEach(n=>{if(/crea(r|ción)? (un |otro )?plan/i.test(n.textContent))n.textContent=n.textContent.replace(/crear (un |otro )?plan/i,'editar este Trading Plan');});
   }
 }
}
const observer=new MutationObserver(()=>normalizeContent(document));observer.observe(document.body,{subtree:true,childList:true});
globalThis.TradingResearchAstraLote4=Object.freeze({decorateEmotional:emotionalConfig,normalizeContent,filterEmotionalList,modalCheck:()=>!!activeModal});
})();