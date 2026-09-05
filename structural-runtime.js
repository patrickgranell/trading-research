/* ===== V31.13 RUNTIME · Structural Foundation II-B · Partial Rendering ===== */
const V3112_APP_LABEL='V31.13 · Structural Foundation II-B · Partial Operations + Market Data';
const TR_RENDER_RUNTIME_VERSION='31.13';
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
let trRenderPartialRenders=0;
const trRenderPartialByRegion=Object.create(null);
let trRenderLastPartial='';
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
    case 'decision': return globalThis.TradingResearchViewPresentationContract.decision();
    case 'changes': return globalThis.TradingResearchViewPresentationContract.changes();
    case 'operations': return operations();
    case 'calendar': return globalThis.TradingResearchViewPresentationContract.calendar();
    case 'goals': return globalThis.TradingResearchViewPresentationContract.goals();
    case 'quality': return globalThis.TradingResearchViewPresentationContract.quality();
    case 'compliance': return globalThis.TradingResearchViewPresentationContract.compliance();
    case 'mistakes': return globalThis.TradingResearchViewPresentationContract.mistakes();
    case 'lab': return globalThis.TradingResearchViewPresentationContract.lab();
    case 'review': return globalThis.TradingResearchViewPresentationContract.review();
    case 'gallery': return gallery();
    case 'journal': return journal();
    case 'blocks': return blocks();
    case 'reports': return globalThis.TradingResearchViewPresentationContract.reports();
    case 'market': return globalThis.TradingResearchViewPresentationContract.market();
    case 'plans': return globalThis.TradingResearchViewPresentationContract.plans();
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
  if(name){const peers=[...root.querySelectorAll(`[name="${CSS.escape(name)}"]`)];return `name:${name}:${peers.indexOf(el)}`;}
  /* Structural II-B: unnamed controls (e.g. Best Exit numeric inputs) still need a stable key. */
  const controls=[...root.querySelectorAll('input,textarea,select,[contenteditable="true"]')];
  const idx=controls.indexOf(el);return idx>=0?`control:${idx}`:'';
}
function trRenderFindControl(key,root){
  if(!key)return null;
  if(key.startsWith('#')){try{return root.querySelector(`#${CSS.escape(key.slice(1))}`);}catch{return null;}}
  if(key.startsWith('name:')){
    const parts=key.split(':'),idx=Number(parts.pop()),name=parts.slice(1).join(':');
    try{return [...root.querySelectorAll(`[name="${CSS.escape(name)}"]`)][idx]||null;}catch{return null;}
  }
  if(key.startsWith('control:')){const idx=Number(key.slice(8));return [...root.querySelectorAll('input,textarea,select,[contenteditable="true"]')][idx]||null;}
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
  const p=globalThis.TradingResearchPlanReadContract.current();
  const plans=(state.tradingPlans||[]).filter(x=>x.status!=='archived'||x.id===p?.id);
  const signature=plans.map(x=>`${x.id}\u0000${globalThis.TradingResearchPlanReadContract.label(x)}`).join('\u0001');
  if(select.dataset.trSignature!==signature){
    const frag=document.createDocumentFragment();
    for(const plan of plans){const o=document.createElement('option');o.value=plan.id;o.textContent=globalThis.TradingResearchPlanReadContract.label(plan);frag.appendChild(o);}
    select.replaceChildren(frag);select.dataset.trSignature=signature;
  }
  if(p&&select.value!==p.id)select.value=p.id;
}
function trRenderSyncTheme(){
  const theme=globalThis.TradingResearchThemeReadContract.current();
  document.querySelectorAll('.theme-btn').forEach(btn=>{
    const isDark=/Oscuro/i.test(btn.textContent||''),active=isDark?theme==='dark':theme==='light';btn.classList.toggle('active',active);
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
  if(typeof globalThis.TradingResearchNavigationPresentationContract?.groupForView==='function'){
    const activeGroup=globalThis.TradingResearchNavigationPresentationContract.groupForView(currentView);
    if(activeGroup&&globalThis.TradingResearchNavigationRuntimeStateContract.ensureGroupOpen(activeGroup))globalThis.TradingResearchNavigationStateContract.saveOpenGroups();
    globalThis.TradingResearchNavigationRuntimeStateContract.setLastView(currentView);
  }
  document.querySelectorAll('.nav-organized [data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===currentView));
  document.querySelectorAll('.nav-group').forEach(group=>{
    const id=group.dataset.navGroup||'',hasActive=[...group.querySelectorAll('[data-view]')].some(btn=>btn.dataset.view===currentView);
    const open=globalThis.TradingResearchNavigationRuntimeStateContract.isGroupOpen(id);
    group.classList.toggle('has-active',hasActive);group.classList.toggle('open',open);
    const toggle=group.querySelector(':scope > .nav-group-toggle');
    if(toggle){toggle.setAttribute('aria-expanded',open?'true':'false');const arrow=toggle.querySelector('.nav-group-arrow');if(arrow)arrow.textContent=open?'▾':'▸';}
  });
  const unread=Number(globalThis.TradingResearchResearchStatusContract.unreadCount())||0;
  trRenderSetBadge(document.querySelector('.nav-organized [data-view="changes"]'),unread);
  trRenderSetBadge(document.querySelector('.nav-group[data-nav-group="research"] > .nav-group-toggle'),unread,'nav-group-count');
  trRenderSyncPlanSelector();trRenderSyncTheme();
}
function trRenderAfterView(){
  try{if(typeof hydrateImageElements==='function')setTimeout(hydrateImageElements,0);}catch(e){console.warn('hydrateImageElements',e);}
  try{if(globalThis.TradingResearchContextHelpPresentationContract){globalThis.TradingResearchContextHelpPresentationContract.ensureObserver();setTimeout(globalThis.TradingResearchContextHelpPresentationContract.apply,0);}}catch(e){console.warn('context help',e);}
  trDraftMaybeRestoreAfterView();
}
function trRenderDiagnostics(){
  return {runtime:TR_RENDER_RUNTIME_VERSION,shell:'persistent',shellMounts:trRenderShellMounts,fullViewRenders:trRenderViewRenders,viewRenders:trRenderViewRenders,partialRenders:trRenderPartialRenders,partialByRegion:{...trRenderPartialByRegion},lastPartial:trRenderLastPartial,currentView,lastView:trRenderLastView,lastRenderAt:trRenderLastAt,lastError:trRenderLastError,draftRecovery:'session',draftRecoveredAt:trDraftLastRecoveredAt,draftError:trDraftLastError};
}
function trRenderRuntimePanel(){
  const d=trRenderDiagnostics(),ok=d.shellMounts===1&&!d.lastError&&!d.draftError,parts=Object.entries(d.partialByRegion||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join(' · ')||'todavía sin renders parciales';
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Motor de render</h3><div class="help">V31.13 mantiene shell/sidebar persistentes y evita regenerar la vista completa en interacciones internas de Operaciones y Market Data.</div></div><span class="stable-pill ${ok?'':'warning'}">Partial DOM</span></div><div class="integrity-kpis"><div><span>Shell mounts</span><strong>${d.shellMounts}</strong></div><div><span>Full-view renders</span><strong>${d.fullViewRenders}</strong></div><div><span>Partial renders</span><strong>${d.partialRenders}</strong></div><div><span>Estado</span><strong class="${(!d.lastError&&!d.draftError)?'positive':'negative'}">${(!d.lastError&&!d.draftError)?'OK':'Revisar'}</strong></div></div><div class="notice"><strong>V31.13:</strong> Operaciones actualiza filtros/analytics sin sustituir <code>#view</code>; Market Data conserva cabecera y pestañas cuando solo cambia el contenido de la fase. El inspector tick a tick actualiza únicamente gráfico e inspector para no romper el arrastre del slider. Borradores tras F5/Ctrl+Shift+R y persistencia IndexedDB siguen activos.<br><small>Contadores parciales: ${globalThis.TradingResearchContentEncodingContract.html(parts)}${d.lastPartial?` · último: ${globalThis.TradingResearchContentEncodingContract.html(d.lastPartial)}`:''}</small></div>${d.lastError||d.draftError?`<div class="notice danger"><strong>Runtime:</strong> ${globalThis.TradingResearchContentEncodingContract.html(d.lastError||d.draftError)}</div>`:''}</section>`;
}

/* Version card is generated dynamically when the persistent shell mounts once. */
const trStructuralModeContract=globalThis.TradingResearchModeCardPresentationContract;
const trStructuralModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${globalThis.TradingResearchModeCardStateReadContract.expanded()?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.13</strong></span><b class="mode-card-arrow">${globalThis.TradingResearchModeCardStateReadContract.expanded()?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${globalThis.TradingResearchContentEncodingContract.html(V3112_APP_LABEL)}</div><div class="help">Fase estructural 2B: shell/sidebar persistentes + render parcial en Operaciones y Market Data. La recuperación de borradores y IndexedDB permanecen activas; la lógica financiera continúa congelada.</div></div></div></div>`;};
trStructuralModeContract.replace(trStructuralModeCard);

/* Add render diagnostics to the existing Datos y seguridad view without replacing V31.11 persistence diagnostics. */
const trStructuralDataContract=globalThis.TradingResearchDataSecurityPanelContract;
const trStructuralDataBase=trStructuralDataContract.current();
trStructuralDataContract.replace(function(){return trRenderRuntimePanel()+trStructuralDataBase();});

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
  try{globalThis.TradingResearchOperationChecklistPresentationContract.refresh();}catch{}
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


/* ----- V31.13 · Partial rendering for Operations + Market Data ----- */
function trPartialRecord(region){
  trRenderPartialRenders++;trRenderPartialByRegion[region]=(trRenderPartialByRegion[region]||0)+1;trRenderLastPartial=region;trRenderLastAt=new Date().toISOString();
}
function trPartialRestoreScroll(x,y){requestAnimationFrame(()=>{try{window.scrollTo(x,y);}catch{}});}
function trPartialWrapElement(el,id){
  if(!el)return null;const existing=document.getElementById(id);if(existing)return existing;
  const wrap=document.createElement('div');wrap.id=id;wrap.style.display='contents';el.before(wrap);wrap.appendChild(el);return wrap;
}
function trPartialPrepareOperations(view=document.getElementById('view')){
  if(!view||view.dataset.trView!=='operations')return false;
  const filter=view.querySelector('.filter-hub');if(filter)trPartialWrapElement(filter,'tr-ops-filter-region');
  return !!document.getElementById('opsAnalyticsArea');
}
function trPartialRenderOperations(){
  const view=document.getElementById('view');if(!view||view.dataset.trView!=='operations')return false;
  trPartialPrepareOperations(view);
  const filter=document.getElementById('tr-ops-filter-region'),analytics=document.getElementById('opsAnalyticsArea');if(!filter||!analytics)return false;
  const continuity=trRenderCaptureInputContinuity(view),sx=window.scrollX,sy=window.scrollY;
  filter.innerHTML=globalThis.TradingResearchOperationsPresentationContract.filterPanel();
  trRefreshOpsAnalyticsBase(false);
  if(continuity)trRenderRestoreInputContinuity(continuity,view);else trPartialRestoreScroll(sx,sy);
  trPartialRecord('operations.regions');trRenderAfterView();return true;
}
function trPartialPrepareMarket(view=document.getElementById('view')){
  if(!view||view.dataset.trView!=='market')return false;
  if(document.getElementById('tr-market-body-region'))return true;
  const tabs=view.querySelector(':scope > .md-phase-tabs');if(!tabs)return false;
  const nodes=[...view.children],idx=nodes.indexOf(tabs);if(idx<0)return false;
  const before=nodes.slice(0,idx),after=nodes.slice(idx+1);
  const chrome=document.createElement('div');chrome.id='tr-market-chrome-region';chrome.style.display='contents';tabs.before(chrome);before.forEach(n=>chrome.appendChild(n));
  const tabRegion=document.createElement('div');tabRegion.id='tr-market-tabs-region';tabRegion.style.display='contents';tabs.before(tabRegion);tabRegion.appendChild(tabs);
  const body=document.createElement('div');body.id='tr-market-body-region';body.style.display='contents';tabRegion.after(body);after.forEach(n=>body.appendChild(n));
  body.dataset.trMarketTab=String(v316Ui?.tab||'');return true;
}
function trPartialMarketParts(){
  const tpl=document.createElement('template');tpl.innerHTML=globalThis.TradingResearchViewPresentationContract.market();
  const tabs=tpl.content.querySelector('.md-phase-tabs');if(!tabs)return null;
  const nodes=[...tpl.content.children],idx=nodes.indexOf(tabs);if(idx<0)return null;
  return {chrome:nodes.slice(0,idx).map(n=>n.outerHTML).join(''),tabs:tabs.outerHTML,body:nodes.slice(idx+1).map(n=>n.outerHTML).join('')};
}
function trPartialRenderMarket(reason='market.body'){
  const view=document.getElementById('view');if(!view||view.dataset.trView!=='market'||!trPartialPrepareMarket(view))return false;
  const parts=trPartialMarketParts(),chrome=document.getElementById('tr-market-chrome-region'),tabs=document.getElementById('tr-market-tabs-region'),body=document.getElementById('tr-market-body-region');if(!parts||!chrome||!tabs||!body)return false;
  const oldTab=body.dataset.trMarketTab||'',newTab=String(v316Ui?.tab||''),tabChanged=oldTab!==newTab,continuity=trRenderCaptureInputContinuity(body),sx=window.scrollX,sy=window.scrollY;
  if(tabChanged){chrome.innerHTML=parts.chrome;tabs.innerHTML=parts.tabs;}
  body.innerHTML=parts.body;body.dataset.trMarketTab=newTab;
  if(continuity&&!tabChanged)trRenderRestoreInputContinuity(continuity,body);else trPartialRestoreScroll(sx,sy);
  trPartialRecord(tabChanged?'market.tab':reason);trRenderAfterView();return true;
}
function trPartialPrepareCurrentView(view=document.getElementById('view')){
  if(!view)return;if(currentView==='operations')trPartialPrepareOperations(view);else if(currentView==='market')trPartialPrepareMarket(view);
}

/* Count the partial analytics path that V5 already had, so diagnostics measure real DOM work. */
const trOpsAnalyticsRefreshContract=globalThis.TradingResearchOperationsAnalyticsRefreshContract;
const trRefreshOpsAnalyticsBase=trOpsAnalyticsRefreshContract.current();
trOpsAnalyticsRefreshContract.replace(function(read=true){const before=document.getElementById('opsAnalyticsArea');const out=trRefreshOpsAnalyticsBase(read);if(currentView==='operations'&&before)trPartialRecord('operations.analytics');return out;});

/* Cursor movement must never replace its own range input while the user is dragging it. */
const trV315SetCursorBase=v315SetCursor;
v315SetCursor=function(v){
  const series=v315RunningUi.series;if(!series?.points?.length||currentView!=='market'||v316Ui?.tab!=='running')return trV315SetCursorBase(v);
  v315RunningUi.cursor=Math.max(0,Math.min(Number(v)||0,series.points.length-1));
  const set=v314MarketUi.execSets.find(x=>x.id===v314MarketUi.activeExecId),rows=set?.results||[],idx=Math.max(0,Math.min(v315RunningUi.tradeIndex,rows.length-1)),result=rows[idx],cursor=series.points[v315RunningUi.cursor];if(!result||!cursor)return;
  const body=document.getElementById('tr-market-body-region'),panel=body?.querySelector('.rp-panel');if(!panel)return trV315SetCursorBase(v);
  const oldChart=panel.querySelector('.rp-chart-wrap'),chartHtml=globalThis.TradingResearchRunningChartPresentationContract.render(result,series);if(oldChart&&chartHtml){const tpl=document.createElement('template');tpl.innerHTML=chartHtml.trim();const fresh=tpl.content.firstElementChild;if(fresh)oldChart.replaceWith(fresh);}
  const grid=panel.querySelector('.rp-inspect-grid');if(grid)grid.innerHTML=`<div><span>Hora Grid</span><strong>${globalThis.TradingResearchContentEncodingContract.html(globalThis.TradingResearchTimelinePresentationContract.formatGridTimestamp(cursor.ms,series.offsetHours,true))}</strong></div><div><span>Transcurrido</span><strong>${globalThis.TradingResearchTimelinePresentationContract.formatElapsedDuration(cursor.ms-series.startMs)}</strong></div><div><span>Last</span><strong>${Number(cursor.last).toFixed(2)}</strong></div><div><span>Bid / Ask</span><strong>${Number(cursor.bid).toFixed(2)} / ${Number(cursor.ask).toFixed(2)}</strong></div><div><span>P&amp;L Last</span><strong class="${cursor.pnlTicks>0?'positive':cursor.pnlTicks<0?'negative':''}">${globalThis.TradingResearchTimelinePresentationContract.formatSignedTicks(cursor.pnlTicks)}</strong></div>`;
  const range=panel.querySelector('.rp-slider input[type="range"]');if(range&&Number(range.value)!==v315RunningUi.cursor)range.value=String(v315RunningUi.cursor);
  trPartialRecord('market.cursor');
};
window.v315SetCursor=v315SetCursor;
/* ----- END V31.13 partial rendering ----- */

/* Final runtime coordinator. This is the only render() used after bootstrap completes. */
render=function(){
  if(trCoreFatal)return;
  try{
    /* V31.14.3: durable schema/baseline preparation belongs to DomainStore before render.
       Rendering is a projection and must never persist or initialize domain state. */
    const first=!trRenderShellMounted;
    const view=trRenderEnsureShell(first);if(!view)return;
    const previous=view.dataset.trView||trRenderLastView||'',sameView=previous===currentView;
    trRenderSyncSidebar();trUiRememberView();
    if(sameView&&currentView==='operations'&&trPartialRenderOperations()){trRenderLastView=currentView;trRenderLastError='';return;}
    if(sameView&&currentView==='market'&&trPartialRenderMarket()){trRenderLastView=currentView;trRenderLastError='';return;}
    const continuity=sameView?trRenderCaptureInputContinuity(view):null;
    view.innerHTML=trRenderViewHtml(currentView);view.dataset.trView=currentView;
    trRenderViewRenders++;trRenderLastView=currentView;trRenderLastAt=new Date().toISOString();trRenderLastError='';
    trPartialPrepareCurrentView(view);
    if(continuity)trRenderRestoreInputContinuity(continuity,view);
    trRenderAfterView();
  }catch(e){
    trRenderLastError=e?.message||String(e);console.error('[Trading Research · render V31.13]',e);
    const view=document.getElementById('view');if(view)view.innerHTML=`<section class="card panel"><div class="notice danger"><strong>Error al renderizar ${globalThis.TradingResearchContentEncodingContract.html(currentView)}:</strong> ${globalThis.TradingResearchContentEncodingContract.html(trRenderLastError)}</div></section>`;
  }
};
window.render=render;
Object.assign(window,{trRenderDiagnostics,trRenderRuntimePanel,trRenderViewHtml,trPartialRenderOperations,trPartialRenderMarket});

/* If IndexedDB bootstrap completed unusually early, mount the new runtime immediately. */
if(typeof trCoreHydrated!=='undefined'&&trCoreHydrated&&!trCoreFatal)render();
/* ===== END V31.13 RUNTIME ===== */
