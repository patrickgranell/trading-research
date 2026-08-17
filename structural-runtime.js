/* ===== V31.12 RUNTIME · Structural Foundation II · Persistent Shell ===== */
const V3112_APP_LABEL='V31.12 · Structural Foundation II · Persistent Shell';
const TR_RENDER_RUNTIME_VERSION='31.12.0';
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
}
function trRenderDiagnostics(){
  return {runtime:TR_RENDER_RUNTIME_VERSION,shell:'persistent',shellMounts:trRenderShellMounts,viewRenders:trRenderViewRenders,currentView,lastView:trRenderLastView,lastRenderAt:trRenderLastAt,lastError:trRenderLastError};
}
function trRenderRuntimePanel(){
  const d=trRenderDiagnostics(),ok=d.shellMounts===1&&!d.lastError;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Motor de render</h3><div class="help">V31.12 mantiene el shell y la sidebar montados. La navegación sustituye únicamente la vista central; los renders internos parciales se migrarán en la siguiente etapa.</div></div><span class="stable-pill ${ok?'':'warning'}">Shell persistente</span></div><div class="integrity-kpis"><div><span>Shell mounts</span><strong>${d.shellMounts}</strong></div><div><span>Renders de vista</span><strong>${d.viewRenders}</strong></div><div><span>Vista actual</span><strong>${esc(d.currentView||'—')}</strong></div><div><span>Estado</span><strong class="${d.lastError?'negative':'positive'}">${d.lastError?'Revisar':'OK'}</strong></div></div>${d.lastError?`<div class="notice danger"><strong>Render:</strong> ${esc(d.lastError)}</div>`:'<div class="notice"><strong>V31.12:</strong> cambiar filtros, pestañas o pantallas ya no reconstruye el cascarón completo de la aplicación. Si un render ocurre mientras estás escribiendo en un control de la vista actual, se conserva el valor, el foco y la posición del cursor.</div>'}</section>`;
}

/* Version card is generated dynamically when the persistent shell mounts once. */
v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.12</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(V3112_APP_LABEL)}</div><div class="help">Fase estructural 2A: shell/sidebar persistentes, router central único y continuidad de inputs durante renders de la misma vista. La lógica financiera y la persistencia IndexedDB de V31.11 permanecen congeladas.</div></div></div></div>`;};

/* Add render diagnostics to the existing Datos y seguridad view without replacing V31.11 persistence diagnostics. */
const dataSecurityPanelV3112Base=dataSecurityPanel;
dataSecurityPanel=function(){return trRenderRuntimePanel()+dataSecurityPanelV3112Base();};

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
