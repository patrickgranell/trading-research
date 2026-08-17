/* ===== V31.12 RUNTIME · Structural Foundation II · Persistent Shell ===== */
const V3112_APP_LABEL='V31.12.1 · Structural Foundation II-A · Persistent Shell + Draft Recovery';
const TR_RENDER_RUNTIME_VERSION='31.12.1';
const TR_UI_SESSION_KEY='tradingResearchUiSessionV31121';
const TR_OPERATION_DRAFT_KEY='tradingResearchOperationDraftV31121';
const TR_VALID_VIEWS=new Set(['dashboard','decision','changes','operations','calendar','goals','quality','compliance','mistakes','lab','review','gallery','journal','blocks','reports','market','plans','config']);
let trDraftRestoreAttempted=false;
let trDraftSaveInProgress=false;
let trOperationDraftContext=null;
let trDraftLastRecoveredAt='';
let trDraftLastError='';

function trSessionGet(key){try{const raw=sessionStorage.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}}
function trSessionSet(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));return true;}catch(e){trDraftLastError=e?.message||String(e);return false;}}
function trSessionRemove(key){try{sessionStorage.removeItem(key);}catch{}}
function trUiRestoreViewAtBoot(){
  const ui=trSessionGet(TR_UI_SESSION_KEY);
  if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))currentView=ui.currentView;
}
function trUiRememberView(){trSessionSet(TR_UI_SESSION_KEY,{currentView,updatedAt:new Date().toISOString()});}
const trBootOperationDraft=trSessionGet(TR_OPERATION_DRAFT_KEY);
trUiRestoreViewAtBoot();
let trRenderShellMounted=false;
let trRenderShellMounts=0;
let trRenderViewRenders=0;
let trRenderLastView='';
let trRenderLastAt='';
let trRenderLastError='';

/*
 * V31.12 deliberately leaves the financial/domain functions in app.js untouched.
 * This runtime replaces only the final rendering coordinator. Historical render()
 * wrappers remain in the source for regression safety, but no longer drive the UI.
 */
function trRenderViewHtml(view=currentView){
  switch(view){
    case 'dashboard': return dashboard();
    case 'decision': return researchDecisionCenter();
    case 'changes': return researchChangesView();
    case 'operations': return operations();
    case 'calendar': return calendarView();
    case 'goals': return goalsView();
    case 'quality': return dataQualityView();
    case 'compliance': return complianceView();
    case 'mistakes': return mistakesView();
    case 'lab': return analyticsLab();
    case 'review': return reviewView();
    case 'gallery': return gallery();
    case 'journal': return journal();
    case 'blocks': return blocks();
    case 'reports': return reportsView();
    case 'market': return v314MarketDataView();
    case 'plans': return plansView();
    case 'config': return config();
    default:
      console.warn('[Trading Research · router] Vista desconocida:',view);
      currentView='dashboard';
      return dashboard();
  }
}

function trRenderEditable(el){
  if(!el||!el.matches)return false;
  if(el.matches('textarea,select,[contenteditable="true"]'))return true;
  if(!el.matches('input'))return false;
  return !['button','submit','reset','file','hidden','checkbox','radio'].includes(String(el.type||'text').toLowerCase());
}
function trRenderControlKey(el,root){
  if(el.id)return `#${el.id}`;
  const name=el.getAttribute('name');
  if(!name)return '';
  const peers=[...root.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
  return `name:${name}:${peers.indexOf(el)}`;
}
function trRenderFindControl(key,root){
  if(!key)return null;
  if(key.startsWith('#')){try{return root.querySelector(`#${CSS.escape(key.slice(1))}`);}catch{return null;}}
  if(key.startsWith('name:')){
    const parts=key.split(':'),idx=Number(parts.pop()),name=parts.slice(1).join(':');
    try{return [...root.querySelectorAll(`[name="${CSS.escape(name)}"]`)][idx]||null;}catch{return null;}
  }
  return null;
}
function trRenderCaptureInputContinuity(view){
  const active=document.activeElement;
  if(!view||!active||!view.contains(active)||!trRenderEditable(active))return null;
  const controls=[];
  view.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach(el=>{
    const type=String(el.type||'').toLowerCase();
    if(type==='file'||type==='hidden'||type==='button'||type==='submit'||type==='reset')return;
    const key=trRenderControlKey(el,view);if(!key)return;
    const rec={key,tag:el.tagName,type};
    if(el.matches('[contenteditable="true"]'))rec.text=el.textContent;
    else if(type==='checkbox'||type==='radio')rec.checked=!!el.checked;
    else if(el.tagName==='SELECT'&&el.multiple)rec.values=[...el.selectedOptions].map(o=>o.value);
    else rec.value=el.value;
    controls.push(rec);
  });
  const activeKey=trRenderControlKey(active,view);
  let selection=null;
  try{if(typeof active.selectionStart==='number')selection=[active.selectionStart,active.selectionEnd];}catch{}
  return {controls,activeKey,selection,scrollX:window.scrollX,scrollY:window.scrollY};
}
function trRenderRestoreInputContinuity(snapshot,view){
  if(!snapshot||!view)return;
  for(const rec of snapshot.controls||[]){
    const el=trRenderFindControl(rec.key,view);if(!el)continue;
    if(el.matches('[contenteditable="true"]'))el.textContent=rec.text??'';
    else if(rec.type==='checkbox'||rec.type==='radio')el.checked=!!rec.checked;
    else if(el.tagName==='SELECT'&&el.multiple){const wanted=new Set(rec.values||[]);[...el.options].forEach(o=>o.selected=wanted.has(o.value));}
    else if('value' in rec)el.value=rec.value??'';
  }
  const active=trRenderFindControl(snapshot.activeKey,view);
  if(active){
    try{active.focus({preventScroll:true});}catch{try{active.focus();}catch{}}
    if(snapshot.selection&&typeof active.setSelectionRange==='function'){
      try{active.setSelectionRange(snapshot.selection[0],snapshot.selection[1]);}catch{}
    }
  }
  requestAnimationFrame(()=>{try{window.scrollTo(snapshot.scrollX,snapshot.scrollY);}catch{}});
}

function trRenderEnsureShell(force=false){
  const root=document.getElementById('app');if(!root)return null;
  let view=document.getElementById('view');
  if(force||!trRenderShellMounted||!root.querySelector(':scope > .shell')||!view){
    root.innerHTML=shell();
    view=document.getElementById('view');
    trRenderShellMounted=true;
    trRenderShellMounts++;
    if(view)view.dataset.trView='';
  }
  return view;
}
function trRenderSyncPlanSelector(){
  const select=document.querySelector('.sidebar .plan-switch select');if(!select)return;
  const p=getCurrentPlan();
  const plans=(state.tradingPlans||[]).filter(x=>x.status!=='archived'||x.id===p?.id);
  const signature=plans.map(x=>`${x.id}\u0000${planLabel(x)}`).join('\u0001');
  if(select.dataset.trSignature!==signature){
    const frag=document.createDocumentFragment();
    for(const plan of plans){const o=document.createElement('option');o.value=plan.id;o.textContent=planLabel(plan);frag.appendChild(o);}
    select.replaceChildren(frag);select.dataset.trSignature=signature;
  }
  if(p&&select.value!==p.id)select.value=p.id;
}
function trRenderSyncTheme(){
  document.querySelectorAll('.theme-btn').forEach(btn=>{
    const isDark=/Oscuro/i.test(btn.textContent||''),active=isDark?appTheme==='dark':appTheme==='light';btn.classList.toggle('active',active);
  });
}
function trRenderSetBadge(host,count,extraClass=''){
  if(!host)return;let badge=host.querySelector(':scope > .nav-alert-count');
  if(count>0){
    if(!badge){badge=document.createElement('b');badge.className=`nav-alert-count${extraClass?` ${extraClass}`:''}`;const arrow=host.querySelector(':scope > .nav-group-arrow');if(arrow)host.insertBefore(badge,arrow);else host.appendChild(badge);}
    badge.textContent=count>99?'99+':String(count);
  }else if(badge)badge.remove();
}
function trRenderSyncSidebar(){
  if(typeof v318GroupForView==='function'&&typeof v318OpenGroups!=='undefined'){
    const activeGroup=v318GroupForView(currentView);
    if(activeGroup&&!v318OpenGroups.has(activeGroup)){v318OpenGroups.add(activeGroup);if(typeof v318SaveOpenGroups==='function')v318SaveOpenGroups();}
    if(typeof v318LastView!=='undefined')v318LastView=currentView;
  }
  document.querySelectorAll('.nav-organized [data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===currentView));
  document.querySelectorAll('.nav-group').forEach(group=>{
    const id=group.dataset.navGroup||'',hasActive=[...group.querySelectorAll('[data-view]')].some(btn=>btn.dataset.view===currentView);
    const open=typeof v318OpenGroups!=='undefined'?v318OpenGroups.has(id):group.classList.contains('open');
    group.classList.toggle('has-active',hasActive);group.classList.toggle('open',open);
    const toggle=group.querySelector(':scope > .nav-group-toggle');
    if(toggle){toggle.setAttribute('aria-expanded',open?'true':'false');const arrow=toggle.querySelector('.nav-group-arrow');if(arrow)arrow.textContent=open?'▾':'▸';}
  });
  const unread=typeof researchUnreadCount==='function'?Number(researchUnreadCount())||0:0;
  trRenderSetBadge(document.querySelector('.nav-organized [data-view="changes"]'),unread);
  trRenderSetBadge(document.querySelector('.nav-group[data-nav-group="research"] > .nav-group-toggle'),unread,'nav-group-count');
  trRenderSyncPlanSelector();trRenderSyncTheme();
}
function trRenderAfterView(){
  try{if(typeof hydrateImageElements==='function')setTimeout(hydrateImageElements,0);}catch(e){console.warn('hydrateImageElements',e);}
  try{if(typeof ensureContextHelpObserver==='function')ensureContextHelpObserver();if(typeof applyContextHelp==='function')setTimeout(applyContextHelp,0);}catch(e){console.warn('context help',e);}
  trDraftMaybeRestoreAfterView();
}
function trRenderDiagnostics(){
  return {runtime:TR_RENDER_RUNTIME_VERSION,shell:'persistent',shellMounts:trRenderShellMounts,viewRenders:trRenderViewRenders,currentView,lastView:trRenderLastView,lastRenderAt:trRenderLastAt,lastError:trRenderLastError,draftRecovery:'session',draftRecoveredAt:trDraftLastRecoveredAt,draftError:trDraftLastError};
}
function trRenderRuntimePanel(){
  const d=trRenderDiagnostics(),ok=d.shellMounts===1&&!d.lastError&&!d.draftError;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Motor de render</h3><div class="help">V31.12.1 mantiene shell/sidebar montados y añade recuperación de borradores de operación ante F5 o Ctrl+Shift+R dentro de la misma pestaña.</div></div><span class="stable-pill ${ok?'':'warning'}">Shell persistente</span></div><div class="integrity-kpis"><div><span>Shell mounts</span><strong>${d.shellMounts}</strong></div><div><span>Renders de vista</span><strong>${d.viewRenders}</strong></div><div><span>Vista actual</span><strong>${esc(d.currentView||'—')}</strong></div><div><span>Estado</span><strong class="${(!d.lastError&&!d.draftError)?'positive':'negative'}">${(!d.lastError&&!d.draftError)?'OK':'Revisar'}</strong></div></div>${d.lastError||d.draftError?`<div class="notice danger"><strong>Runtime:</strong> ${esc(d.lastError||d.draftError)}</div>`:'<div class="notice"><strong>V31.12.1:</strong> un render interno conserva foco/valor/cursor en memoria. Una recarga real del navegador destruye JavaScript y DOM, por lo que ahora el editor de operaciones mantiene además un borrador temporal en <code>sessionStorage</code>, reabre la vista y recupera los campos sin guardarlos como operación. Los archivos seleccionados no pueden recuperarse por seguridad del navegador.</div>'}</section>`;
}

/* Version card is generated dynamically when the persistent shell mounts once. */
v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.12.1</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(V3112_APP_LABEL)}</div><div class="help">Fase estructural 2A.1: shell/sidebar persistentes, router central, continuidad durante renders internos y recuperación temporal del editor de operaciones tras una recarga real. La lógica financiera e IndexedDB permanecen congelados.</div></div></div></div>`;};

/* Add render diagnostics to the existing Datos y seguridad view without replacing V31.11 persistence diagnostics. */
const dataSecurityPanelV3112Base=dataSecurityPanel;
dataSecurityPanel=function(){return trRenderRuntimePanel()+dataSecurityPanelV3112Base();};

/* ----- V31.12.1 · Session draft recovery for the operation editor ----- */
function trDraftControlRecords(form){
  const controls=[];let hadFiles=false;
  form.querySelectorAll('input,textarea,select,[contenteditable="true"]').forEach(el=>{
    const type=String(el.type||'').toLowerCase();
    if(type==='file'){if(el.files?.length)hadFiles=true;return;}
    if(type==='hidden'||type==='button'||type==='submit'||type==='reset')return;
    const key=trRenderControlKey(el,form);if(!key)return;
    const rec={key,tag:el.tagName,type};
    if(el.matches('[contenteditable="true"]'))rec.text=el.textContent;
    else if(type==='checkbox'||type==='radio')rec.checked=!!el.checked;
    else if(el.tagName==='SELECT'&&el.multiple)rec.values=[...el.selectedOptions].map(o=>o.value);
    else rec.value=el.value;
    controls.push(rec);
  });
  return {controls,hadFiles};
}
function trDraftCaptureOperation(){
  const form=document.getElementById('operationForm');if(!form||!trOperationDraftContext)return false;
  const data=trDraftControlRecords(form),active=document.activeElement;
  let activeKey='',selection=null;
  if(active&&form.contains(active)){activeKey=trRenderControlKey(active,form);try{if(typeof active.selectionStart==='number')selection=[active.selectionStart,active.selectionEnd];}catch{}}
  const modalBody=form.closest('.modal-body');
  const draft={version:1,kind:'operation',operationId:trOperationDraftContext.operationId??null,planId:trOperationDraftContext.planId||state.currentPlanId||null,originView:trOperationDraftContext.originView||currentView,controls:data.controls,hadFiles:data.hadFiles,activeKey,selection,modalScrollTop:modalBody?.scrollTop||0,updatedAt:new Date().toISOString()};
  return trSessionSet(TR_OPERATION_DRAFT_KEY,draft);
}
function trDraftClearOperation(){trSessionRemove(TR_OPERATION_DRAFT_KEY);trOperationDraftContext=null;}
function trDraftApplyOperation(draft){
  const form=document.getElementById('operationForm');if(!form)return false;
  for(const rec of draft.controls||[]){
    const el=trRenderFindControl(rec.key,form);if(!el)continue;
    if(el.matches('[contenteditable="true"]'))el.textContent=rec.text??'';
    else if(rec.type==='checkbox'||rec.type==='radio')el.checked=!!rec.checked;
    else if(el.tagName==='SELECT'&&el.multiple){const wanted=new Set(rec.values||[]);[...el.options].forEach(o=>o.selected=wanted.has(o.value));}
    else if('value' in rec)el.value=rec.value??'';
  }
  try{if(typeof applyRiskToOperation==='function')applyRiskToOperation(false);else if(typeof recalcOperation==='function')recalcOperation();}catch{}
  try{if(typeof updateOperationChecklistPreview==='function')updateOperationChecklistPreview();}catch{}
  const notice=document.createElement('div');notice.className='notice';notice.dataset.trDraftRecovered='1';notice.innerHTML=`<strong>Borrador recuperado tras la recarga.</strong> Los cambios siguen sin guardarse como operación.${draft.hadFiles?' Los archivos seleccionados antes de recargar deben elegirse de nuevo.':''}`;
  form.prepend(notice);
  const body=form.closest('.modal-body');if(body)body.scrollTop=Number(draft.modalScrollTop)||0;
  const active=trRenderFindControl(draft.activeKey,form);
  if(active){try{active.focus({preventScroll:true});}catch{try{active.focus();}catch{}}if(draft.selection&&typeof active.setSelectionRange==='function'){try{active.setSelectionRange(draft.selection[0],draft.selection[1]);}catch{}}}
  trDraftLastRecoveredAt=new Date().toISOString();return true;
}
function trDraftMaybeRestoreAfterView(){
  if(trDraftRestoreAttempted)return;
  const draft=trBootOperationDraft;if(!draft||draft.kind!=='operation')return;
  trDraftRestoreAttempted=true;
  setTimeout(()=>{
    try{
      if(draft.planId&&state?.tradingPlans?.some(p=>p.id===draft.planId)&&state.currentPlanId!==draft.planId)state.currentPlanId=draft.planId;
      if(draft.operationId&&!state?.operations?.some(o=>o.id===draft.operationId)){trDraftClearOperation();trDraftLastError='El borrador apuntaba a una operación que ya no existe.';return;}
      openOperationModal(draft.operationId||null);
      setTimeout(()=>{if(!trDraftApplyOperation(draft)){trDraftLastError='No se pudo reconstruir el editor del borrador.';}},25);
    }catch(e){trDraftLastError=e?.message||String(e);console.error('[Trading Research · draft restore]',e);}
  },25);
}

const trOpenOperationModalBase=openOperationModal;
openOperationModal=function(id=null){
  const result=trOpenOperationModalBase(id);
  if(document.getElementById('operationForm'))trOperationDraftContext={operationId:id??null,planId:state.currentPlanId||null,originView:currentView};
  return result;
};
window.openOperationModal=openOperationModal;

const trCloseModalBase=closeModal;
closeModal=function(...args){
  const hadOperation=!!document.getElementById('operationForm');
  const result=trCloseModalBase.apply(this,args);
  if(hadOperation&&!trDraftSaveInProgress)trDraftClearOperation();
  return result;
};
window.closeModal=closeModal;

const trSaveOperationBase=saveOperationFromForm;
saveOperationFromForm=async function(...args){
  trDraftSaveInProgress=true;
  try{
    const result=await trSaveOperationBase.apply(this,args);
    if(document.getElementById('operationForm'))trDraftCaptureOperation();else trDraftClearOperation();
    return result;
  }finally{trDraftSaveInProgress=false;}
};
window.saveOperationFromForm=saveOperationFromForm;

document.addEventListener('input',e=>{if(e.target?.closest?.('#operationForm'))trDraftCaptureOperation();},true);
document.addEventListener('change',e=>{if(e.target?.closest?.('#operationForm'))trDraftCaptureOperation();},true);
window.addEventListener('beforeunload',()=>{trUiRememberView();trDraftCaptureOperation();});
/* ----- END V31.12.1 draft recovery ----- */

/* Final runtime coordinator. This is the only render() used after bootstrap completes. */
render=function(){
  if(trCoreFatal)return;
  try{
    if(typeof v30EnsureBaselineLocal==='function')v30EnsureBaselineLocal();
    const first=!trRenderShellMounted;
    const view=trRenderEnsureShell(first);if(!view)return;
    const previous=view.dataset.trView||trRenderLastView||'';
    const sameView=previous===currentView;
    const continuity=sameView?trRenderCaptureInputContinuity(view):null;
    trRenderSyncSidebar();
    trUiRememberView();
    view.innerHTML=trRenderViewHtml(currentView);
    view.dataset.trView=currentView;
    trRenderViewRenders++;trRenderLastView=currentView;trRenderLastAt=new Date().toISOString();trRenderLastError='';
    if(continuity)trRenderRestoreInputContinuity(continuity,view);
    trRenderAfterView();
  }catch(e){
    trRenderLastError=e?.message||String(e);console.error('[Trading Research · render V31.12]',e);
    const view=document.getElementById('view');if(view)view.innerHTML=`<section class="card panel"><div class="notice danger"><strong>Error al renderizar ${esc(currentView)}:</strong> ${esc(trRenderLastError)}</div></section>`;
  }
};
window.render=render;
Object.assign(window,{trRenderDiagnostics,trRenderRuntimePanel,trRenderViewHtml});

/* If IndexedDB bootstrap completed unusually early, mount the new runtime immediately. */
if(typeof trCoreHydrated!=='undefined'&&trCoreHydrated&&!trCoreFatal)render();
/* ===== END V31.12 RUNTIME ===== */
