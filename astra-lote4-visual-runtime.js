/* Astra Lote 4 · UI projection and dialog ergonomics only.
 * No changes to persisted taxonomies, study fields, backups, or statistics. */
(()=>{
'use strict';
const actions=window.TradingResearchActions||{};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const view=()=>window.TradingResearchCurrentViewReadContract?.current?.()||'';
const tab=()=>window.TradingResearchConfigTabStateContract?.current?.()||'';
let emotionalTab='questions',pickedPerspective='',perspectiveQuery='',perspectiveState='all';
const DIALOG_FOCUSABLE='button:not([disabled]):not([hidden]),[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let opener=null,dialog=null,initialFields='',wasDialogOpen=false,glossaryList=null,glossaryFocus=null;
const content=v=>typeof v==='string'?v:'';
function filters(container){
 const list=container.querySelector('.perspective-config-list');
 if(!list)return;
 const rows=[...list.querySelectorAll('.perspective-config-card')];
 for(const row of rows){
  const id=row.querySelector('[data-perspective-id]')?.dataset.perspectiveId||'';
  row.dataset.l4PerspectiveId=id;
  const searchable=row.textContent.toLocaleLowerCase('es');
  const filtered=!!perspectiveQuery&&!searchable.includes(perspectiveQuery.toLocaleLowerCase('es'))||
    perspectiveState==='active'&&row.classList.contains('inactive')||
    perspectiveState==='inactive'&&!row.classList.contains('inactive');
  row.hidden=filtered||id!==pickedPerspective;
 }
 const controls=container.querySelector('.l4-perspective-select');
 if(controls){
  for(const opt of controls.options){
   if(!opt.value)continue;
   const row=rows.find(r=>r.dataset.l4PerspectiveId===opt.value);
   const excluded=!!perspectiveQuery&&!(row?.textContent||'').toLocaleLowerCase('es').includes(perspectiveQuery.toLocaleLowerCase('es'))||
     perspectiveState==='active'&&!!row?.classList.contains('inactive')||
     perspectiveState==='inactive'&&!row?.classList.contains('inactive');
   opt.hidden=excluded;
  }
  const available=[...controls.options].filter(o=>o.value&&!o.hidden);
  if(!available.some(o=>o.value===pickedPerspective))pickedPerspective=available[0]?.value||'';
  controls.value=pickedPerspective;
  rows.forEach(row=>row.hidden=row.dataset.l4PerspectiveId!==pickedPerspective);
 }
 const counter=container.querySelector('.l4-perspective-hits');
 if(counter)counter.textContent=rows.filter(r=>!r.hidden).length?'Mostrando una ficha de '+(container.querySelector('.l4-perspective-select')?.options.length-1||rows.length)+' · filtro aplicado':'Sin referencias para estos criterios';
}
function emotionalConfig(container){
 const section=container.querySelector('.emotion-config-grid')?.closest('section.card');
 if(!section)return;
 const categories=section.querySelector('.emotion-config-grid');
 const questions=section.querySelector('.session-taxonomy-section');
 const perspectives=section.querySelector('.perspective-config-section');
 if(!categories||!questions||!perspectives||section.querySelector('.l4-emotional-tabs'))return;
 const menu=document.createElement('div');
 menu.className='l4-emotional-tabs';menu.setAttribute('role','group');menu.setAttribute('aria-label','Configuración emocional');
 const panels=[['questions','Preguntas del TP',questions],['categories','Categorías del TP',categories],['library','Biblioteca de perspectivas · global',perspectives]];
 panels.forEach(([id,label,node])=>{
  const b=document.createElement('button');b.type='button';b.className='l4-emotional-tab';
  b.textContent=label;b.dataset.l4Tab=id;b.dataset.trActionClick='trAstraL4EmotionTab';menu.append(b);
  node.classList.add('l4-emotional-panel');node.dataset.l4Panel=id;
 });
 const header=section.querySelector('.panel-title');
 if(header)header.after(menu);else section.prepend(menu);
 const help=document.createElement('p');help.className='l4-emotional-scope';
 help.textContent='Preguntas y categorías modifican el Trading Plan seleccionado. La biblioteca de perspectivas es global y puede utilizarse también en Backtesting.';
 menu.after(help);
 // Original editors and saving actions are moved, never recreated.
 if(perspectives){
  const cards=[...perspectives.querySelectorAll('.perspective-config-card')];
  if(cards.length){
   const area=document.createElement('div');area.className='l4-perspective-controls';
   const search=document.createElement('label');search.className='l4-field';
   search.innerHTML='<span>Buscar por autor, frase o contexto</span><input class="input" type="search" data-tr-action-input="trAstraL4PerspectiveFilter" placeholder="Autor, contexto, etiqueta..." />';
   search.querySelector('input').value=perspectiveQuery;
   const state=document.createElement('label');state.className='l4-field';
   state.innerHTML='<span>Estado</span><select class="select" data-tr-action-change="trAstraL4PerspectiveState"><option value="all">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select>';
   state.querySelector('select').value=perspectiveState;
   const select=document.createElement('label');select.className='l4-field';
   select.innerHTML='<span>Seleccionar perspectiva</span><select class="select l4-perspective-select" data-tr-action-change="trAstraL4PerspectivePick"><option value="">Seleccionar...</option></select>';
   for(const card of cards){
    const id=card.querySelector('[data-perspective-id]')?.dataset.perspectiveId||'';
    if(!id)continue;
    const option=document.createElement('option');option.value=id;
    option.textContent=card.querySelector('header strong')?.textContent?.trim()||id;
    select.querySelector('select').append(option);
   }
   area.append(search,state,select);perspectives.querySelector('.perspective-config-list')?.before(area);
   const count=document.createElement('p');count.className='l4-perspective-hits';
   area.after(count);filters(perspectives);
  }
 }
 setEmotionalTab(section,emotionalTab);
}
function setEmotionalTab(root,target){
 emotionalTab=['questions','categories','library'].includes(target)?target:'questions';
 root.querySelectorAll('.l4-emotional-tab').forEach(b=>{
  const active=b.dataset.l4Tab===emotionalTab;b.classList.toggle('is-current',active);b.setAttribute('aria-pressed',String(active));
 });
 root.querySelectorAll('.l4-emotional-panel').forEach(p=>p.hidden=p.dataset.l4Panel!==emotionalTab);
}
actions.trAstraL4EmotionTab=function(){setEmotionalTab(document.querySelector('.config-tab-content')||document,this.dataset.l4Tab);};
actions.trAstraL4PerspectiveFilter=function(){perspectiveQuery=this.value||'';filters(document.querySelector('.perspective-config-section')||document);};
actions.trAstraL4PerspectiveState=function(){perspectiveState=this.value||'all';filters(document.querySelector('.perspective-config-section')||document);};
actions.trAstraL4PerspectivePick=function(){pickedPerspective=this.value||'';filters(document.querySelector('.perspective-config-section')||document);};
function textFixes(root,current){
 // Only edit visible product copy; never change ID, value attributes or users' saved text.
 const substitutions=new Map([
  ['Limpiar dataset','Revisar calidad del dataset'],
  ['Guardar plantilla','Guardar en biblioteca de plantillas'],
  ['Detalle + 20 operaciones','Abrir detalle del bloque'],
  ['Máx. ganancia / pérdida media','Máx. ganancia / pérdida']
 ]);
 for(const el of root.querySelectorAll('button')){
  const label=el.textContent.trim();
  if(substitutions.has(label))el.textContent=substitutions.get(label);
  if(label==='×'&&!el.getAttribute('aria-label')){
   const row=el.closest('.emotion-token,.config-row,.perspective-config-card');
   const item=row?.querySelector('strong,span')?.textContent?.trim().slice(0,80)||'este elemento';
   el.setAttribute('aria-label','Eliminar '+item);
  }
 }
 for(const item of root.querySelectorAll('.block-actions button')){
  if(/Detalle \+ 20 operaciones/.test(item.textContent.trim()))item.textContent='Abrir detalle del bloque';
 }
 const compareNumber=Number(root.querySelector('#galleryCompareCount')?.textContent);
 const selectedCard=[...root.querySelectorAll('.gallery-kpis .kpi')].find(card=>card.querySelector('.label')?.textContent?.trim()==='Seleccionadas');
 if(selectedCard&&Number.isFinite(compareNumber)){
  const count=selectedCard.querySelector('.value,strong');
  if(count)count.textContent=String(compareNumber);
 }
 root.querySelectorAll('.research-swap').forEach(b=>b.setAttribute('aria-label','Intercambiar filas y columnas del Research Grid'));
 root.querySelectorAll('.kpi .value,.block-core-grid strong,.research-grid td strong,.research-grid td .value').forEach(el=>{
  const value=el.textContent.trim();
  if(/^\+\+\d/.test(value))el.textContent=value.replace(/^\+\+/, '+');
 });
 root.querySelectorAll('.block-card .block-spark').forEach(spark=>{
  if(spark.querySelector('.l4-curve-scale'))return;
  const card=spark.closest('.block-card');
  const date=card?.querySelector('.block-dates')?.textContent?.trim()||'Periodo no registrado';
  const result=[...card?.querySelectorAll('.block-core-grid>div')||[]].find(div=>div.querySelector('span')?.textContent.trim()==='Resultado')?.querySelector('strong')?.textContent?.trim()||'—';
  const note=document.createElement('small');note.className='l4-curve-scale';
  note.textContent='Inicio: 0 · Fin: '+result+' · '+date;
  spark.append(note);
 });
 root.querySelectorAll('.metric-segmented button,.segmented button,.pill-switch button').forEach(b=>{
  b.style.whiteSpace='nowrap';
 });
 // Correct actionable field names without replacing their existing event handlers.
 root.querySelectorAll('input,select,textarea').forEach(el=>{
  if(el.hasAttribute('aria-label')||el.closest('label')||el.labels?.length)return;
  const label=el.closest('.field,.filter-field')?.querySelector(':scope > span,:scope > label');
  if(label?.textContent?.trim())el.setAttribute('aria-label',label.textContent.trim().slice(0,110));
 });
 if(current==='config')emotionalConfig(root);
}
function decorate(current,markup){
 if(typeof markup!=='string'||typeof document==='undefined')return markup;
 const tpl=document.createElement('template');tpl.innerHTML=markup;
 textFixes(tpl.content,current);
 return tpl.innerHTML;
}
const original=typeof trRenderViewHtml==='function'?trRenderViewHtml:null;
if(original)trRenderViewHtml=function(route){return decorate(route,original(route));};
/* Read-only glossary is a single dialog: swap inner panels in place.
   The actual glossary list DOM, search value, and scroll are preserved. */
function glossaryModal(el){return !!el?.querySelector('#glossary-list');}
function glossaryDetail(button,modal){
 const list=modal.querySelector('#glossary-list');
 if(!list)return;
 const index=[...list.children].indexOf(button);
 const item=typeof CONTEXT_HELP!=='undefined'?CONTEXT_HELP[index]:null;
 if(!item)return;
 glossaryList=list;glossaryFocus=button;
 const search=modal.querySelector('.glossary-search');
 const detail=document.createElement('section');detail.className='l4-glossary-detail';
 detail.innerHTML='<button class="btn small" type="button" data-tr-action-click="trAstraL4GlossaryBack">← Volver a resultados</button>'+
  '<h4>'+escapeHtml(item.title)+'</h4><p>'+escapeHtml(item.summary||'')+'</p>'+
  '<h5>Qué significa</h5><p>'+escapeHtml(item.body||'')+'</p>'+
  '<h5>Para qué sirve</h5><p>'+escapeHtml(item.use||'')+'</p>';
 search.hidden=true;list.hidden=true;list.after(detail);
 detail.querySelector('button')?.focus();
}
actions.trAstraL4GlossaryBack=function(){
 const parent=document.querySelector('.modal-backdrop .modal');
 if(!parent)return;
 parent.querySelector('.l4-glossary-detail')?.remove();
 const search=parent.querySelector('.glossary-search');
 if(search)search.hidden=false;
 if(glossaryList)glossaryList.hidden=false;
 const restore=glossaryFocus;
 glossaryList=null;glossaryFocus=null;
 if(restore?.isConnected&&!restore.classList.contains('hidden'))restore.focus();
 else parent.querySelector('#glossary-search')?.focus();
};
function isVisible(el){return el.getClientRects().length>0&&!el.closest('[hidden]');}
function dialogFields(node){return [...node.querySelectorAll('input,textarea,select')].map(el=>[el.name,el.id,el.value,el.checked]);}
function topDialog(){return [...document.querySelectorAll('.modal-backdrop .modal')].filter(isVisible).at(-1)||null;}
function decorateDialog(active){
 if(active.dataset.l4DialogEnhanced)return;
 active.dataset.l4DialogEnhanced='true';
 active.querySelectorAll('button').forEach(btn=>{
  if(btn.textContent.trim()!=='×'||btn.getAttribute('aria-label'))return;
  const item=btn.closest('.emotion-token,.config-row,.form-grid,.modal-body')?.querySelector('strong,span')?.textContent?.trim();
  btn.setAttribute('aria-label','Eliminar '+(item||'elemento'));
 });
 for(const input of active.querySelectorAll('input,textarea,select')){
  if(input.getAttribute('aria-label')||input.labels?.length||input.closest('label'))continue;
  const field=input.closest('.field');
  const title=field?.querySelector('span,label')?.textContent?.trim();
  if(title)input.setAttribute('aria-label',title.slice(0,100));
 }
 const name=active.querySelector('.modal-head h3')?.textContent?.trim()||'';
 if(name.startsWith('Editar Trading Plan')){
  for(const notice of active.querySelectorAll('.notice')){
   if(notice.textContent.includes('El nuevo plan empezará')){
    notice.textContent='Estás editando este Trading Plan. Sus operaciones, taxonomías y vínculos existentes no se sustituyen al guardar.';
   }
  }
 }
 if(name.includes('Gestión de riesgo')){
  for(const field of active.querySelectorAll('.field')){
   if(/límite|pérdida|diari|semanal/i.test(field.querySelector('span')?.textContent||'')){
    const helper=document.createElement('small');helper.className='l4-zero-hint';helper.textContent='0 = límite desactivado';
    field.append(helper);
   }
  }
 }
}
function autofocus(){
 const active=topDialog();
 if(!active)return;
 if(active===dialog)return;
 dialog=active;wasDialogOpen=true;decorateDialog(active);initialFields=JSON.stringify(dialogFields(active));
 const header=active.querySelector('.modal-head h3');
 if(header){if(!header.id)header.id='l4-dialog-title';active.setAttribute('aria-labelledby',header.id);header.tabIndex=-1;}
 const target=active.querySelector('input:not([type=hidden]),textarea,select')||active.querySelector('button:not([disabled])')||header;
 if(target)target.focus({preventScroll:true});
}
function closeReadOnly(){
 if(typeof closeModal==='function'){closeModal();return true;}
 const backdrop=document.querySelector('.modal-backdrop');backdrop?.remove();return !!backdrop;
}
function changedForm(){return dialog&&JSON.stringify(dialogFields(dialog))!==initialFields;}
function glossaryOpenNow(){return !!dialog?.querySelector('#glossary-list,.context-help-modal');}
document.addEventListener('click',e=>{
 const trigger=e.target.closest('button,a');if(!trigger)return;
 const active=topDialog();
 if(active&&glossaryModal(active)&&trigger.closest('#glossary-list')){
  e.preventDefault();e.stopImmediatePropagation();glossaryDetail(trigger,active);return;
 }
 if(active&&trigger.closest('.modal-foot')&&/^(Cerrar|Cancelar|Descartar|Volver)$/i.test(trigger.textContent.trim())&&changedForm()){
  if(!window.confirm('Hay cambios sin guardar. ¿Descartarlos y cerrar?')){e.preventDefault();e.stopImmediatePropagation();}
  return;
 }
 if(!active)opener=trigger;
},true);
document.addEventListener('keydown',e=>{
 const active=topDialog();if(!active)return;
 if(e.key==='Escape'&&glossaryOpenNow()){
  e.preventDefault();e.stopImmediatePropagation();closeReadOnly();return;
 }
 if(e.key!=='Tab')return;
 const focusable=[...active.querySelectorAll(DIALOG_FOCUSABLE)].filter(isVisible);
 if(!focusable.length){e.preventDefault();active.tabIndex=-1;active.focus();return;}
 const first=focusable[0],last=focusable.at(-1),current=document.activeElement;
 if(e.shiftKey&&(current===first||!active.contains(current))){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&(current===last||!active.contains(current))){e.preventDefault();first.focus();}
},true);
document.addEventListener('focusin',e=>{
 const active=topDialog();if(active&&!active.contains(e.target)){
  const first=[...active.querySelectorAll(DIALOG_FOCUSABLE)].find(isVisible);
  if(first)first.focus({preventScroll:true});
 }
},true);
const observer=new MutationObserver(()=>{
 const active=topDialog();
 if(active){autofocus();return;}
 if(wasDialogOpen){
  wasDialogOpen=false;dialog=null;glossaryFocus=null;glossaryList=null;initialFields='';
  const target=opener;opener=null;
  if(target?.isConnected&&!target.disabled)target.focus({preventScroll:true});
 }
});
observer.observe(document.body,{subtree:true,childList:true});
window.TradingResearchAstraLote4=Object.freeze({decorate,emotionalConfig,filters,setEmotionalTab,autofocus});
})();