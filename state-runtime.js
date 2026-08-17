/* ===== V31.14 STATE RUNTIME · Structural Foundation III-A =====
 * Transitional state boundary:
 * - durable/domain state is deep-proxied so legacy direct mutations are observable
 * - persistence boundaries publish atomic mutation batches
 * - explicit DomainStore.commit() is available for migrated commands
 * - UIStore classifies and tracks ephemeral UI state separately from durable state
 * No financial formula lives in this file.
 */
const TR_STATE_RUNTIME_VERSION='31.14.1';
const TR_STATE_APP_LABEL='V31.14.1 · Structural Foundation III-A1 · Semantic Mutation Boundary';

/* ---------- Durable domain store ---------- */
let trDomainRootTarget=null;
let trDomainRootProxy=null;
let trDomainProxyCache=new WeakMap();
let trDomainRawByProxy=new WeakMap();
let trDomainAttached=0;
let trDomainReplacements=0;
let trDomainUnsafeReplacements=0;
let trDomainRevision=0;
let trDomainCommitCount=0;
let trDomainControlledCommits=0;
let trDomainLegacyCommits=0;
let trDomainMutationCount=0;
let trDomainSuppressedNoopWrites=0;
let trDomainPendingMutationCount=0;
let trDomainPendingPaths=new Set();
let trDomainLastMutationAt='';
let trDomainLastCommit=null;
let trDomainLastReplacement='';
let trDomainLastError='';
let trDomainActiveLabel='';
let trDomainExclusiveChain=Promise.resolve();
let trDomainExclusiveBusy=false;
const trDomainSubscribers=new Set();

function trStateIsObject(v){return !!v&&typeof v==='object';}
function trStateUnwrap(v){return trDomainRawByProxy.get(v)||v;}
function trStateIsPlain(v){if(!trStateIsObject(v))return false;const proto=Object.getPrototypeOf(v);return Array.isArray(v)||proto===Object.prototype||proto===null;}
function trStateSemanticEqual(a,b,budget={n:0,max:25000},seen=new WeakMap()){
  a=trStateUnwrap(a);b=trStateUnwrap(b);if(Object.is(a,b))return true;
  if(!trStateIsObject(a)||!trStateIsObject(b)||!trStateIsPlain(a)||!trStateIsPlain(b))return false;
  if(++budget.n>budget.max)return false;
  const aa=Array.isArray(a),ab=Array.isArray(b);if(aa!==ab)return false;
  const prior=seen.get(a);if(prior===b)return true;seen.set(a,b);
  if(aa){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!trStateSemanticEqual(a[i],b[i],budget,seen))return false;return true;}
  const ka=Object.keys(a),kb=Object.keys(b);if(ka.length!==kb.length)return false;
  for(const k of ka){if(!Object.prototype.hasOwnProperty.call(b,k)||!trStateSemanticEqual(a[k],b[k],budget,seen))return false;}return true;
}
function trStateChanged(oldValue,nextValue){
  const oldRaw=trStateUnwrap(oldValue),nextRaw=trStateUnwrap(nextValue);if(Object.is(oldRaw,nextRaw))return false;
  if(trStateIsObject(oldRaw)&&trStateIsObject(nextRaw)&&trStateSemanticEqual(oldRaw,nextRaw)){trDomainSuppressedNoopWrites++;return false;}return true;
}
function trStatePath(base,key){if(typeof key==='symbol')return base||'$';const k=String(key);return base?`${base}.${k}`:k;}
function trStateRecordMutation(path,kind='set'){
  trDomainMutationCount++;trDomainPendingMutationCount++;trDomainLastMutationAt=new Date().toISOString();
  if(trDomainPendingPaths.size<80)trDomainPendingPaths.add(path||'$');
}
function trStateProxy(value,path='$'){
  if(!trStateIsObject(value))return value;
  if(trDomainRawByProxy.has(value))return value;
  const cached=trDomainProxyCache.get(value);if(cached)return cached;
  const proxy=new Proxy(value,{
    get(target,key,receiver){const out=Reflect.get(target,key,receiver);return trStateIsObject(out)?trStateProxy(out,trStatePath(path,key)):out;},
    set(target,key,value,receiver){
      const raw=trStateUnwrap(value),old=Reflect.get(target,key,receiver),changed=trStateChanged(old,raw),ok=Reflect.set(target,key,raw,target);
      if(ok&&changed)trStateRecordMutation(trStatePath(path,key),'set');return ok;
    },
    deleteProperty(target,key){const had=Object.prototype.hasOwnProperty.call(target,key),ok=Reflect.deleteProperty(target,key);if(ok&&had)trStateRecordMutation(trStatePath(path,key),'delete');return ok;},
    defineProperty(target,key,desc){
      const old=target[key],next=('value' in desc)?trStateUnwrap(desc.value):old,changed=('value' in desc)&&trStateChanged(old,next),clean=('value' in desc)?{...desc,value:next}:desc,ok=Reflect.defineProperty(target,key,clean);
      if(ok&&changed)trStateRecordMutation(trStatePath(path,key),'define');return ok;
    }
  });
  trDomainProxyCache.set(value,proxy);trDomainRawByProxy.set(proxy,value);return proxy;
}
function trDomainPublish(batch){for(const fn of [...trDomainSubscribers]){try{fn(batch);}catch(e){console.warn('[Trading Research · DomainStore subscriber]',e);}}}
function trDomainCallerLabel(reason='persist'){
  if(trDomainActiveLabel)return trDomainActiveLabel;
  try{
    const lines=String(new Error().stack||'').split('\n').slice(1);
    for(const line of lines){
      const m=line.match(/at\s+([^\s(]+)/),name=m?.[1]||'';
      if(name&&!/^tr(State|Domain)|persist$|trCore/.test(name))return `legacy.${name}`;
    }
  }catch{}
  return `legacy.${reason||'persist'}`;
}
function trDomainFlush(label='',kind=''){
  if(!trDomainPendingMutationCount)return null;
  const controlled=kind==='controlled'||!!trDomainActiveLabel;
  const batch={revision:++trDomainRevision,label:label||trDomainCallerLabel('persist'),kind:controlled?'controlled':'legacy',mutations:trDomainPendingMutationCount,paths:[...trDomainPendingPaths],at:new Date().toISOString()};
  trDomainCommitCount++;if(controlled)trDomainControlledCommits++;else trDomainLegacyCommits++;
  trDomainPendingMutationCount=0;trDomainPendingPaths.clear();trDomainLastCommit=batch;trDomainPublish(batch);return batch;
}
function trStateAttach(reason='runtime'){
  if(typeof state==='undefined'||!trStateIsObject(state))return false;
  if(state===trDomainRootProxy)return true;
  const hadRoot=!!trDomainRootTarget;
  if(hadRoot&&trDomainPendingMutationCount){trDomainUnsafeReplacements++;trDomainFlush('state.replace.before-flush','legacy');}
  const raw=trStateUnwrap(state);
  trDomainProxyCache=new WeakMap();trDomainRawByProxy=new WeakMap();trDomainRootTarget=raw;trDomainRootProxy=trStateProxy(raw,'$');state=trDomainRootProxy;trDomainAttached++;
  if(hadRoot){
    trDomainReplacements++;trDomainRevision++;trDomainLastReplacement=`${reason} · ${new Date().toISOString()}`;
    const batch={revision:trDomainRevision,label:`state.replace.${reason}`,kind:'replacement',mutations:0,paths:['$'],at:new Date().toISOString()};trDomainLastCommit=batch;trDomainPublish(batch);
  }
  return true;
}
function trStateEnsureAttached(reason='runtime'){
  try{return trStateAttach(reason);}catch(e){trDomainLastError=e?.message||String(e);console.error('[Trading Research · DomainStore attach]',e);return false;}
}
function trDomainCommit(label,mutator,options={}){
  trStateEnsureAttached('commit');
  const previous=trDomainActiveLabel;trDomainActiveLabel=String(label||'domain.commit');
  const finish=()=>{
    let batch=null;
    try{
      if(options.persist!==false&&typeof persist==='function'){
        const before=trDomainCommitCount;persist();
        if(trDomainPendingMutationCount)trDomainFlush(trDomainActiveLabel,'controlled');
        if(trDomainCommitCount>before)batch=trDomainLastCommit;
      }else batch=trDomainFlush(trDomainActiveLabel,'controlled');
      if(options.render&&typeof render==='function')render();
      return batch;
    }finally{trDomainActiveLabel=previous;}
  };
  try{
    const out=mutator?.(state);
    if(out&&typeof out.then==='function')return out.then(value=>{finish();return value;},error=>{trDomainActiveLabel=previous;throw error;});
    finish();return out;
  }catch(e){trDomainActiveLabel=previous;throw e;}
}
function trDomainExclusive(label,task){
  const run=async()=>{trDomainExclusiveBusy=true;try{if(typeof trCoreFlush==='function')await trCoreFlush();return await task();}finally{trDomainExclusiveBusy=false;trStateEnsureAttached(`exclusive.${label}`);}};
  trDomainExclusiveChain=trDomainExclusiveChain.catch(()=>{}).then(run);return trDomainExclusiveChain;
}
function trDomainSnapshot(){trStateEnsureAttached('snapshot');return typeof clone==='function'?clone(state):JSON.parse(JSON.stringify(state));}
function trDomainDiagnostics(){return {runtime:TR_STATE_RUNTIME_VERSION,attached:trDomainAttached,replacements:trDomainReplacements,unsafeReplacements:trDomainUnsafeReplacements,revision:trDomainRevision,commits:trDomainCommitCount,controlledCommits:trDomainControlledCommits,legacyCommits:trDomainLegacyCommits,mutations:trDomainMutationCount,suppressedNoopWrites:trDomainSuppressedNoopWrites,pendingMutations:trDomainPendingMutationCount,pendingPaths:[...trDomainPendingPaths],lastCommit:trDomainLastCommit,lastMutationAt:trDomainLastMutationAt,lastReplacement:trDomainLastReplacement,lastError:trDomainLastError,exclusiveBusy:trDomainExclusiveBusy};}
const TRDomainStore=Object.freeze({
  getState:()=>{trStateEnsureAttached('get');return state;},snapshot:trDomainSnapshot,commit:trDomainCommit,flush:(label='manual.flush')=>trDomainFlush(label,'controlled'),subscribe(fn){if(typeof fn!=='function')return()=>{};trDomainSubscribers.add(fn);return()=>trDomainSubscribers.delete(fn);},diagnostics:trDomainDiagnostics,ensureAttached:trStateEnsureAttached,exclusive:trDomainExclusive
});

/* Persistence is the atomic boundary for still-legacy mutation syntax. */
const trDomainPersistBridgeBase=trCorePersistStateBridge;
trCorePersistStateBridge=function(reason='persist'){
  trStateEnsureAttached(`persist.${reason}`);trDomainFlush(trDomainCallerLabel(reason),trDomainActiveLabel?'controlled':'legacy');return trDomainPersistBridgeBase(reason);
};
const trDomainPersistNowBase=trCorePersistNow;
trCorePersistNow=async function(reason='persist'){
  trStateEnsureAttached(`core.${reason}`);trDomainFlush(trDomainCallerLabel(reason),trDomainActiveLabel?'controlled':'legacy');return trDomainPersistNowBase(reason);
};

/* First explicitly migrated durable command: active Trading Plan selection. */
switchPlan=function(id){if(!getPlan(id))return;return TRDomainStore.commit('plan.switch',()=>{state.currentPlanId=id;},{persist:true,render:true});};
window.switchPlan=switchPlan;
if(typeof switchPlanAndOpen==='function'){
  switchPlanAndOpen=function(id){if(!getPlan(id))return;return TRDomainStore.commit('plan.switch-open',()=>{state.currentPlanId=id;currentView='dashboard';},{persist:true,render:true});};
  window.switchPlanAndOpen=switchPlanAndOpen;
}

/* Serialize destructive external replacements so two restore/pull operations cannot overlap. */
function trDomainWrapExclusiveGlobal(name,label){
  const base=window[name];if(typeof base!=='function'||base.__trDomainExclusiveWrapped)return;
  const wrapped=function(...args){return TRDomainStore.exclusive(label,()=>base.apply(this,args));};
  Object.defineProperty(wrapped,'__trDomainExclusiveWrapped',{value:true});window[name]=wrapped;
  try{if(name==='cloudPullState')cloudPullState=wrapped;else if(name==='importFullBackup')importFullBackup=wrapped;}catch{}
}
trDomainWrapExclusiveGlobal('cloudPullState','cloud.pull');
trDomainWrapExclusiveGlobal('importFullBackup','backup.restore');

/* ---------- Ephemeral UI store ---------- */
let trUiRevision=0;
let trUiTrackedActions=0;
let trUiLegacyChanges=0;
let trUiLastAction='';
let trUiLastChangeAt='';
let trUiActiveAction='';
let trUiFingerprint='';
let trUiLastSnapshot=null;
let trUiLastError='';
const trUiSubscribers=new Set();
function trUiClone(v){try{return JSON.parse(JSON.stringify(v));}catch{return null;}}
function trUiSnapshot(){
  const out={navigation:{currentView:typeof currentView!=='undefined'?currentView:'',configTab:typeof configTab!=='undefined'?configTab:'',theme:typeof appTheme!=='undefined'?appTheme:''}};
  if(typeof opsViewState!=='undefined')out.operations=trUiClone(opsViewState);
  if(typeof journalViewState!=='undefined')out.journal=trUiClone(journalViewState);
  if(typeof blockViewState!=='undefined')out.blocks=trUiClone(blockViewState);
  if(typeof galleryViewState!=='undefined')out.gallery=trUiClone(galleryViewState);
  if(typeof labState!=='undefined')out.lab=trUiClone(labState);
  if(typeof dashboardViewState!=='undefined')out.dashboard=trUiClone(dashboardViewState);
  if(typeof exitLabState!=='undefined')out.exitLab=trUiClone(exitLabState);
  if(typeof calendarState!=='undefined')out.calendar=trUiClone(calendarState);
  if(typeof complianceViewState!=='undefined')out.compliance=trUiClone(complianceViewState);
  if(typeof reviewViewState!=='undefined')out.review=trUiClone(reviewViewState);
  if(typeof goalViewState!=='undefined')out.goals=trUiClone(goalViewState);
  if(typeof robustnessState!=='undefined')out.robustness=trUiClone(robustnessState);
  if(typeof riskStressState!=='undefined')out.riskStress=trUiClone(riskStressState);
  if(typeof walkForwardState!=='undefined')out.walkForward=trUiClone(walkForwardState);
  if(typeof dataQualityState!=='undefined')out.dataQuality=trUiClone(dataQualityState);
  if(typeof mistakesViewState!=='undefined')out.mistakes=trUiClone(mistakesViewState);
  if(typeof reportsViewState!=='undefined')out.reports=trUiClone(reportsViewState);
  if(typeof v316Ui!=='undefined')out.market={phase:v316Ui.tab,environment:v316Ui.environment};
  if(typeof v315RunningUi!=='undefined')out.marketRunning={tab:v315RunningUi.tab,tradeIndex:v315RunningUi.tradeIndex,mode:v315RunningUi.mode,cursor:v315RunningUi.cursor,loading:v315RunningUi.loading,metaId:v315RunningUi.metaId,execId:v315RunningUi.execId};
  if(typeof v3110Ui!=='undefined')out.bestExit=trUiClone(v3110Ui);
  return out;
}
function trUiPublish(change){for(const fn of [...trUiSubscribers]){try{fn(change);}catch(e){console.warn('[Trading Research · UIStore subscriber]',e);}}}
function trUiCapture(label='legacy.ui'){
  try{
    const snap=trUiSnapshot(),fp=JSON.stringify(snap);if(!trUiFingerprint){trUiFingerprint=fp;trUiLastSnapshot=snap;return null;}if(fp===trUiFingerprint)return null;
    const tracked=!!trUiActiveAction||!String(label).startsWith('legacy.');const change={revision:++trUiRevision,label:trUiActiveAction||label,kind:tracked?'tracked':'legacy',at:new Date().toISOString()};
    if(tracked)trUiTrackedActions++;else trUiLegacyChanges++;trUiLastAction=change.label;trUiLastChangeAt=change.at;trUiFingerprint=fp;trUiLastSnapshot=snap;trUiPublish(change);return change;
  }catch(e){trUiLastError=e?.message||String(e);return null;}
}
function trUiAction(label,fn){
  const prev=trUiActiveAction;trUiActiveAction=String(label||'ui.action');
  try{
    const out=fn();
    if(out&&typeof out.then==='function')return out.finally(()=>{trUiCapture(trUiActiveAction);trUiActiveAction=prev;});
    trUiCapture(trUiActiveAction);trUiActiveAction=prev;return out;
  }catch(e){trUiActiveAction=prev;throw e;}
}
function trUiNavigate(view){if(typeof TR_VALID_VIEWS!=='undefined'&&!TR_VALID_VIEWS.has(view))return false;return trUiAction('navigation.navigate',()=>{currentView=view;render();return true;});}
function trUiSetConfigTab(tab){return trUiAction('config.tab',()=>{configTab=tab;render();});}
function trUiDiagnostics(){return {runtime:TR_STATE_RUNTIME_VERSION,revision:trUiRevision,trackedActions:trUiTrackedActions,legacyChanges:trUiLegacyChanges,lastAction:trUiLastAction,lastChangeAt:trUiLastChangeAt,lastError:trUiLastError,activeAction:trUiActiveAction,current:trUiLastSnapshot||trUiSnapshot()};}
const TRUIStore=Object.freeze({snapshot:()=>trUiClone(trUiSnapshot()),action:trUiAction,navigate:trUiNavigate,setConfigTab:trUiSetConfigTab,capture:trUiCapture,subscribe(fn){if(typeof fn!=='function')return()=>{};trUiSubscribers.add(fn);return()=>trUiSubscribers.delete(fn);},diagnostics:trUiDiagnostics});

/* Migrate the central navigation/config commands to explicit UI-store actions. */
navigate=function(view){return TRUIStore.navigate(view);};window.navigate=navigate;
setConfigTab=function(tab){return TRUIStore.setConfigTab(tab);};window.setConfigTab=setConfigTab;

/* Existing view-specific setters keep their tested business/UI code but execute inside a named UI action boundary. */
function trUiWrapGlobal(name,label){
  const base=window[name];if(typeof base!=='function'||base.__trUiStoreWrapped)return;
  const wrapped=function(...args){return TRUIStore.action(label,()=>base.apply(this,args));};
  Object.defineProperty(wrapped,'__trUiStoreWrapped',{value:true});window[name]=wrapped;
}
[
  ['setOpsUnit','operations.unit'],['setOpsBasis','operations.basis'],['toggleOpsDay','operations.day'],['toggleOpsModule','operations.module'],['resetOpsFilters','operations.reset'],['setOpsQuickPeriod','operations.period'],['setOpsDimension','operations.dimension'],['applyHeatCell','operations.heat-cell'],
  ['v316SetTab','market.phase'],['v316SetExecEnvironment','market.environment'],['v315OpenRunning','market.open-running'],['v315SetRunningTrade','market.trade'],['v315SetRunningMode','market.mode'],['v315SetCursor','market.cursor'],
  ['v3110SetTargetTicks','best-exit.target'],['v3110SetTrailTrigger','best-exit.trail-trigger'],['v3110SetTrailGiveback','best-exit.giveback']
].forEach(([name,label])=>trUiWrapGlobal(name,label));

/* Render is also a reconciliation point for legacy UI setters not yet migrated. */
const trStateRenderBase=render;
render=function(...args){
  trStateEnsureAttached('render');trUiCapture(trUiActiveAction||'legacy.render.before');
  const out=trStateRenderBase.apply(this,args);trUiCapture(trUiActiveAction||'legacy.render.after');return out;
};
window.render=render;

/* ---------- Diagnostics / integration ---------- */
function trStateRuntimeDiagnostics(){return {runtime:TR_STATE_RUNTIME_VERSION,domain:TRDomainStore.diagnostics(),ui:TRUIStore.diagnostics()};}
function trStateRuntimePanel(){
  const d=TRDomainStore.diagnostics(),u=TRUIStore.diagnostics(),ok=!d.lastError&&!u.lastError&&!d.unsafeReplacements&&!d.pendingMutations,paths=(d.lastCommit?.paths||[]).slice(0,6).join(' · ')||'—';
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Arquitectura de estado</h3><div class="help">V31.14.1 separa el workspace durable del estado efímero de interfaz y distingue mutaciones reales de normalizaciones semánticamente idénticas. El Proxy ya no marca como dirty una asignación de arrays/objetos que conserva exactamente el mismo contenido.</div></div><span class="stable-pill ${ok?'':'warning'}">Domain + UI Store</span></div><div class="integrity-kpis"><div><span>Domain revision</span><strong>${d.revision}</strong></div><div><span>Commits observados</span><strong>${d.commits}</strong></div><div><span>Legacy / controlados</span><strong>${d.legacyCommits} / ${d.controlledCommits}</strong></div><div><span>Mutaciones pendientes</span><strong class="${d.pendingMutations?'negative':'positive'}">${d.pendingMutations}</strong></div><div><span>UI revision</span><strong>${u.revision}</strong></div><div><span>UI actions / legacy</span><strong>${u.trackedActions} / ${u.legacyChanges}</strong></div><div><span>Reemplazos de state</span><strong>${d.replacements}</strong></div><div><span>Estado</span><strong class="${ok?'positive':'negative'}">${ok?'OK':'Revisar'}</strong></div></div><div class="notice"><strong>V31.14.1 · boundary semántico:</strong> <code>state</code> sigue siendo compatible con el código histórico, pero ya no es opaco: cada escritura profunda queda registrada y el siguiente guardado publica un lote atómico con rutas modificadas. <code>TRDomainStore.commit()</code> es el API para migrar comandos sin reescribir de golpe la lógica financiera. La navegación y los principales controles de Operaciones/Market Data ya pasan por <code>TRUIStore</code>. Escrituras no-op suprimidas: <strong>${d.suppressedNoopWrites||0}</strong>.<br><small>Último domain commit: ${esc(d.lastCommit?.label||'—')} · rutas: ${esc(paths)}${u.lastAction?` · última UI action: ${esc(u.lastAction)}`:''}</small></div>${d.pendingMutations?`<div class="notice danger"><strong>Mutaciones sin persistir:</strong> ${d.pendingMutations}. Rutas: ${esc(d.pendingPaths.slice(0,8).join(' · '))}</div>`:''}${d.lastError||u.lastError?`<div class="notice danger"><strong>State runtime:</strong> ${esc(d.lastError||u.lastError)}</div>`:''}</section>`;
}

const trStateDataSecurityBase=dataSecurityPanel;
dataSecurityPanel=function(){return trStateRuntimePanel()+trStateDataSecurityBase();};

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.14.1</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_STATE_APP_LABEL)}</div><div class="help">Fase estructural 3A1: DomainStore con comparación semántica + UIStore separado. IndexedDB, shell persistente, borradores y Partial DOM permanecen activos. La lógica financiera sigue congelada.</div></div></div></div>`;};

window.TradingResearchStores=Object.freeze({domain:TRDomainStore,ui:TRUIStore,diagnostics:trStateRuntimeDiagnostics});
Object.assign(window,{trStateRuntimeDiagnostics,trStateRuntimePanel});
if(typeof trCoreHydrated!=='undefined'&&trCoreHydrated)trStateEnsureAttached('runtime-load');trUiCapture('runtime-load');
/* ===== END V31.14 STATE RUNTIME ===== */
