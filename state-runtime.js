/* ===== V31.16 STATE RUNTIME · Structural Foundation III-B2 =====
 * Transitional state boundary:
 * - durable/domain state is deep-proxied so legacy direct mutations are observable
 * - persistence boundaries publish atomic mutation batches
 * - explicit DomainStore.commit() is available for migrated commands
 * - UIStore classifies and tracks ephemeral UI state separately from durable state
 * No financial formula lives in this file.
 */
const TR_STATE_RUNTIME_VERSION='31.16';
const TR_STATE_APP_LABEL='V31.16 · Structural Foundation III-B2 · Plan Configuration Command Boundary';

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
let trDomainSchemaNormalizeCount=0;
let trDomainSchemaNormalizeLastAt='';
let trDomainSchemaNormalizeLastMutations=0;
let trDomainRenderSideEffects=0;
let trDomainLastRenderSideEffect='';
let trDomainLastRenderSideEffectPaths=[];
let trDomainRenderGuardDepth=0;
let trDomainRenderGuardUndo=[];
let trDomainRenderGuardSeen=new WeakMap();
let trDomainRenderGuardPaths=new Set();
let trDomainRenderGuardWrites=0;
let trDomainRenderGuardPersistRequests=0;
let trDomainRenderGuardSuppressedWrites=0;
let trDomainRenderGuardSuppressedPersists=0;
/* Controlled command batching. Legacy operation handlers can keep their tested
 * mutation code temporarily, while every persist/render they request is coalesced
 * into one observable domain commit + one durable snapshot + one final render. */
let trDomainCommandDepth=0;
let trDomainCommandPersistRequests=0;
let trDomainCommandRenderRequests=0;
let trDomainCommandCount=0;
let trDomainCommandCoalescedPersists=0;
let trDomainCommandCoalescedRenders=0;
let trDomainLastCommand='';
let trDomainLastCommandAt='';
let trDomainLastCommandMutations=0;
let trDomainLastCommandPersistRequests=0;
let trDomainLastCommandRenderRequests=0;
const trDomainCommandBreakdown=new Map();
const trDomainSchemaNormalizedRoots=new WeakSet();
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

/* During UI composition the legacy code is allowed to *attempt* a write so old view
 * builders keep working, but every changed property is journalled and rolled back
 * before render() returns. Persistence calls are suppressed in the same boundary.
 * This makes render a durable read-only transaction without cloning the full workspace. */
function trDomainRenderGuardRemember(target,key,path){
  let keys=trDomainRenderGuardSeen.get(target);
  if(!keys){keys=new Set();trDomainRenderGuardSeen.set(target,keys);if(Array.isArray(target))trDomainRenderGuardUndo.push({kind:'array-length',target,length:target.length});}
  if(!keys.has(key)){keys.add(key);trDomainRenderGuardUndo.push({kind:'prop',target,key,descriptor:Object.getOwnPropertyDescriptor(target,key)});}
  trDomainRenderGuardWrites++;trDomainRenderGuardSuppressedWrites++;
  if(trDomainRenderGuardPaths.size<80)trDomainRenderGuardPaths.add(path||'$');
}
function trDomainRenderGuardBegin(){
  if(++trDomainRenderGuardDepth!==1)return;
  trDomainRenderGuardUndo=[];trDomainRenderGuardSeen=new WeakMap();trDomainRenderGuardPaths=new Set();trDomainRenderGuardWrites=0;trDomainRenderGuardPersistRequests=0;
}
function trDomainRenderGuardEnd(){
  if(!trDomainRenderGuardDepth)return {writes:0,persistRequests:0,paths:[]};
  if(--trDomainRenderGuardDepth)return null;
  for(let i=trDomainRenderGuardUndo.length-1;i>=0;i--){
    const r=trDomainRenderGuardUndo[i];
    try{
      if(r.kind==='array-length'){r.target.length=r.length;continue;}
      if(r.descriptor)Object.defineProperty(r.target,r.key,r.descriptor);else Reflect.deleteProperty(r.target,r.key);
    }catch(e){trDomainLastError=`render rollback: ${e?.message||String(e)}`;console.error('[Trading Research · render rollback]',e);}
  }
  const result={writes:trDomainRenderGuardWrites,persistRequests:trDomainRenderGuardPersistRequests,paths:[...trDomainRenderGuardPaths]};
  trDomainRenderGuardUndo=[];trDomainRenderGuardSeen=new WeakMap();trDomainRenderGuardPaths=new Set();trDomainRenderGuardWrites=0;trDomainRenderGuardPersistRequests=0;
  return result;
}
function trStateProxy(value,path='$'){
  if(!trStateIsObject(value))return value;
  if(trDomainRawByProxy.has(value))return value;
  const cached=trDomainProxyCache.get(value);if(cached)return cached;
  const proxy=new Proxy(value,{
    get(target,key,receiver){const out=Reflect.get(target,key,receiver);return trStateIsObject(out)?trStateProxy(out,trStatePath(path,key)):out;},
    set(target,key,value,receiver){
      const raw=trStateUnwrap(value),old=Reflect.get(target,key,receiver),changed=trStateChanged(old,raw),p=trStatePath(path,key);
      /* A semantic no-op must also be a referential no-op. */
      if(!changed)return true;
      if(trDomainRenderGuardDepth){trDomainRenderGuardRemember(target,key,p);return Reflect.set(target,key,raw,target);}
      const ok=Reflect.set(target,key,raw,target);if(ok)trStateRecordMutation(p,'set');return ok;
    },
    deleteProperty(target,key){
      const had=Object.prototype.hasOwnProperty.call(target,key);if(!had)return true;const p=trStatePath(path,key);
      if(trDomainRenderGuardDepth){trDomainRenderGuardRemember(target,key,p);return Reflect.deleteProperty(target,key);}
      const ok=Reflect.deleteProperty(target,key);if(ok)trStateRecordMutation(p,'delete');return ok;
    },
    defineProperty(target,key,desc){
      const old=target[key],next=('value' in desc)?trStateUnwrap(desc.value):old,changed=('value' in desc)&&trStateChanged(old,next),clean=('value' in desc)?{...desc,value:next}:desc,p=trStatePath(path,key);
      if(('value' in desc)&&!changed)return true;
      if(trDomainRenderGuardDepth){trDomainRenderGuardRemember(target,key,p);return Reflect.defineProperty(target,key,clean);}
      const ok=Reflect.defineProperty(target,key,clean);if(ok&&changed)trStateRecordMutation(p,'define');return ok;
    }
  });
  trDomainProxyCache.set(value,proxy);trDomainRawByProxy.set(proxy,value);return proxy;
}

/* V31.9.2 used to refresh contractEconomics.updatedAt even when economics were
 * already identical, leaving invisible pending mutations for the next persist().
 * Keep the historical calculator untouched, but do not call it unless a substantive
 * contract/economic field actually differs. */
const trV3192ApplyConfiguredEconomicsBase=typeof v3192ApplyConfiguredEconomicsToAnkora==='function'?v3192ApplyConfiguredEconomicsToAnkora:null;
if(trV3192ApplyConfiguredEconomicsBase){
  v3192ApplyConfiguredEconomicsToAnkora=function(o){
    if(o?.raw?.source!=='ankora')return false;
    const inst=typeof v3192InstrumentForOperation==='function'?v3192InstrumentForOperation(o):null;if(!inst)return false;
    const qty=typeof v3192OperationQuantity==='function'?v3192OperationQuantity(o):Math.max(1,Number(o?.contracts)||1),ticks=Number(o?.resultTicks)||0,tickValue=Number(inst?.tickValue)||0;
    const commission=(Number(inst?.commission)||0)*qty,gross=ticks*tickValue,net=gross-commission,riskTicks=Number(o?.riskTickExposure)||0,riskUsd=riskTicks*tickValue,nextSnap=typeof instrumentSnapshot==='function'?instrumentSnapshot(inst):o.instrumentSnapshot;
    const ce=o?.contractEconomics||{},expectedR=riskTicks>0?ticks/riskTicks:Number(o?.rMultiple);
    const same=o.instrumentId===inst.id&&JSON.stringify(o.instrumentSnapshot||null)===JSON.stringify(nextSnap||null)&&Number(o.contracts)===qty&&Number(o.commission)===commission&&Number(o.pnlGross)===gross&&Number(o.pnlNet)===net&&(!riskTicks||Number(o.riskUsd)===riskUsd)&&(!riskTicks||Number(o.rMultiple)===expectedR)&&ce.source==='global_contract_library'&&String(ce.symbol||'')===String(inst.symbol||'')&&Number(ce.commissionRoundTurn||0)===Number(inst.commission||0)&&Number(ce.tickValue||0)===tickValue&&Number(ce.quantity||0)===qty;
    if(same)return false;
    trV3192ApplyConfiguredEconomicsBase(o);return true;
  };
  window.v3192ApplyConfiguredEconomicsToAnkora=v3192ApplyConfiguredEconomicsToAnkora;
}

function trDomainNormalizePlanSchema(p){
  if(!p)return p;
  const fns=[
    typeof ensurePlanV8Structure==='function'?ensurePlanV8Structure:null,
    typeof ensurePlanCompliance==='function'?ensurePlanCompliance:null,
    typeof ensurePlanStudies==='function'?ensurePlanStudies:null,
    typeof ensurePlanConfidence==='function'?ensurePlanConfidence:null,
    typeof ensurePlanReviews==='function'?ensurePlanReviews:null,
    typeof ensurePlanGoals==='function'?ensurePlanGoals:null,
    typeof ensurePlanForwardTests==='function'?ensurePlanForwardTests:null,
    typeof ensurePlanDataQualityV27==='function'?ensurePlanDataQualityV27:null,
    typeof ensurePlanResearchChanges==='function'?ensurePlanResearchChanges:null
  ].filter(Boolean);
  for(const fn of fns)fn(p);
  return p;
}
function trDomainNormalizeHydratedSchema(reason='render'){
  if(typeof trCoreHydrated==='undefined'||!trCoreHydrated||!trDomainRootTarget||trDomainSchemaNormalizedRoots.has(trDomainRootTarget))return false;
  const root=trDomainRootTarget;
  trDomainSchemaNormalizedRoots.add(root);
  const previous=trDomainActiveLabel,beforeMutations=trDomainMutationCount,beforeCommits=trDomainCommitCount;
  trDomainActiveLabel='schema.normalize';
  try{
    const plans=Array.isArray(state?.tradingPlans)?state.tradingPlans:[];
    for(const plan of plans)trDomainNormalizePlanSchema(plan);
    if(typeof v30EnsureBaselineLocal==='function')v30EnsureBaselineLocal();
    if(trDomainPendingMutationCount)trDomainFlush('schema.normalize','controlled');
    if(trDomainCommitCount>beforeCommits&&typeof trDomainPersistBridgeBase==='function')trDomainPersistBridgeBase(`schema-normalize:${reason}`);
    trDomainSchemaNormalizeCount++;
    trDomainSchemaNormalizeLastAt=new Date().toISOString();
    trDomainSchemaNormalizeLastMutations=Math.max(0,trDomainMutationCount-beforeMutations);
    return true;
  }catch(e){
    trDomainSchemaNormalizedRoots.delete(root);
    trDomainLastError=`schema.normalize: ${e?.message||String(e)}`;
    console.error('[Trading Research · schema normalize]',e);
    return false;
  }finally{trDomainActiveLabel=previous;}
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
function trDomainCommand(label,task,options={}){
  trStateEnsureAttached(`command.${label||'domain'}`);
  /* Nested migrated commands participate in the outer atomic boundary. */
  if(trDomainCommandDepth)return task?.();
  const commandLabel=String(label||'domain.command'),previousLabel=trDomainActiveLabel;
  const beforeMutations=trDomainMutationCount,beforeCommits=trDomainCommitCount;
  trDomainActiveLabel=commandLabel;trDomainCommandDepth=1;trDomainCommandPersistRequests=0;trDomainCommandRenderRequests=0;
  const finish=(value,error=null)=>{
    const persistRequests=trDomainCommandPersistRequests,renderRequests=trDomainCommandRenderRequests;
    let batch=null;
    try{
      if(!error&&trDomainPendingMutationCount)batch=trDomainFlush(commandLabel,'controlled');
      /* Do not write a duplicate snapshot for validation-only/no-op commands. */
      if(!error&&batch&&options.persist!==false){trDomainPersistBridgeBase(`command:${commandLabel}`);}
      trDomainCommandCount++;trDomainLastCommand=commandLabel;trDomainLastCommandAt=new Date().toISOString();
      trDomainLastCommandMutations=Math.max(0,trDomainMutationCount-beforeMutations);
      trDomainLastCommandPersistRequests=persistRequests;trDomainLastCommandRenderRequests=renderRequests;
      trDomainCommandCoalescedPersists+=persistRequests;trDomainCommandCoalescedRenders+=renderRequests;
      trDomainCommandBreakdown.set(commandLabel,(trDomainCommandBreakdown.get(commandLabel)||0)+1);
    }finally{
      trDomainCommandDepth=0;trDomainCommandPersistRequests=0;trDomainCommandRenderRequests=0;trDomainActiveLabel=previousLabel;
    }
    if(!error&&options.render!==false&&renderRequests>0&&typeof render==='function')render();
    if(error)throw error;return value;
  };
  try{
    const out=task?.();
    if(out&&typeof out.then==='function')return out.then(v=>finish(v),e=>finish(undefined,e));
    return finish(out);
  }catch(e){return finish(undefined,e);}
}
function trDomainExclusive(label,task){
  const run=async()=>{trDomainExclusiveBusy=true;try{if(typeof trCoreFlush==='function')await trCoreFlush();return await task();}finally{trDomainExclusiveBusy=false;trStateEnsureAttached(`exclusive.${label}`);}};
  trDomainExclusiveChain=trDomainExclusiveChain.catch(()=>{}).then(run);return trDomainExclusiveChain;
}
function trDomainSnapshot(){trStateEnsureAttached('snapshot');return typeof clone==='function'?clone(state):JSON.parse(JSON.stringify(state));}
function trDomainDiagnostics(){return {runtime:TR_STATE_RUNTIME_VERSION,attached:trDomainAttached,replacements:trDomainReplacements,unsafeReplacements:trDomainUnsafeReplacements,revision:trDomainRevision,commits:trDomainCommitCount,controlledCommits:trDomainControlledCommits,legacyCommits:trDomainLegacyCommits,mutations:trDomainMutationCount,suppressedNoopWrites:trDomainSuppressedNoopWrites,pendingMutations:trDomainPendingMutationCount,pendingPaths:[...trDomainPendingPaths],schemaNormalizations:trDomainSchemaNormalizeCount,schemaNormalizeLastAt:trDomainSchemaNormalizeLastAt,schemaNormalizeLastMutations:trDomainSchemaNormalizeLastMutations,renderSideEffects:trDomainRenderSideEffects,lastRenderSideEffect:trDomainLastRenderSideEffect,lastRenderSideEffectPaths:[...trDomainLastRenderSideEffectPaths],renderGuardSuppressedWrites:trDomainRenderGuardSuppressedWrites,renderGuardSuppressedPersists:trDomainRenderGuardSuppressedPersists,commandDepth:trDomainCommandDepth,commands:trDomainCommandCount,commandCoalescedPersists:trDomainCommandCoalescedPersists,commandCoalescedRenders:trDomainCommandCoalescedRenders,lastCommand:trDomainLastCommand,lastCommandAt:trDomainLastCommandAt,lastCommandMutations:trDomainLastCommandMutations,lastCommandPersistRequests:trDomainLastCommandPersistRequests,lastCommandRenderRequests:trDomainLastCommandRenderRequests,commandBreakdown:Object.fromEntries(trDomainCommandBreakdown),lastCommit:trDomainLastCommit,lastMutationAt:trDomainLastMutationAt,lastReplacement:trDomainLastReplacement,lastError:trDomainLastError,exclusiveBusy:trDomainExclusiveBusy};}
const TRDomainStore=Object.freeze({
  getState:()=>{trStateEnsureAttached('get');return state;},snapshot:trDomainSnapshot,commit:trDomainCommit,command:trDomainCommand,flush:(label='manual.flush')=>trDomainFlush(label,'controlled'),subscribe(fn){if(typeof fn!=='function')return()=>{};trDomainSubscribers.add(fn);return()=>trDomainSubscribers.delete(fn);},diagnostics:trDomainDiagnostics,ensureAttached:trStateEnsureAttached,exclusive:trDomainExclusive
});

/* Persistence is the atomic boundary for still-legacy mutation syntax. */
const trDomainPersistBridgeBase=trCorePersistStateBridge;
trCorePersistStateBridge=function(reason='persist'){
  if(trDomainRenderGuardDepth){trDomainRenderGuardPersistRequests++;trDomainRenderGuardSuppressedPersists++;return true;}
  if(trDomainCommandDepth){trDomainCommandPersistRequests++;return true;}
  trStateEnsureAttached(`persist.${reason}`);trDomainFlush(trDomainCallerLabel(reason),trDomainActiveLabel?'controlled':'legacy');return trDomainPersistBridgeBase(reason);
};
const trDomainPersistNowBase=trCorePersistNow;
trCorePersistNow=async function(reason='persist'){
  if(trDomainRenderGuardDepth){trDomainRenderGuardPersistRequests++;trDomainRenderGuardSuppressedPersists++;return true;}
  if(trDomainCommandDepth){trDomainCommandPersistRequests++;return true;}
  trStateEnsureAttached(`core.${reason}`);trDomainFlush(trDomainCallerLabel(reason),trDomainActiveLabel?'controlled':'legacy');return trDomainPersistNowBase(reason);
};

/* First explicitly migrated durable command: active Trading Plan selection. */
switchPlan=function(id){if(!getPlan(id))return;return TRDomainStore.commit('plan.switch',()=>{state.currentPlanId=id;trDomainNormalizePlanSchema(getPlan(id));if(typeof v30EnsureBaselineLocal==='function')v30EnsureBaselineLocal();},{persist:true,render:true});};
window.switchPlan=switchPlan;
if(typeof switchPlanAndOpen==='function'){
  switchPlanAndOpen=function(id){if(!getPlan(id))return;return TRDomainStore.commit('plan.switch-open',()=>{state.currentPlanId=id;trDomainNormalizePlanSchema(getPlan(id));if(typeof v30EnsureBaselineLocal==='function')v30EnsureBaselineLocal();currentView='dashboard';},{persist:true,render:true});};
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

/* ---------- III-B1 · Operation command boundary ----------
 * Keep the mature V31.x operation transformation chain intact, but execute it as
 * one command. This collapses the many historical persist()+render() calls made
 * by compliance/data-quality/research/evidence wrappers into one atomic commit. */
const trOperationSaveLegacyBase=window.saveOperationFromForm;
if(typeof trOperationSaveLegacyBase==='function'){
  saveOperationFromForm=function(...args){
    const targetId=typeof editingId!=='undefined'&&editingId?editingId:null;
    const label=targetId?'operation.update':'operation.create';
    return TRDomainStore.command(label,()=>trOperationSaveLegacyBase.apply(this,args),{persist:true,render:true});
  };
  window.saveOperationFromForm=saveOperationFromForm;
}

/* Opening an editor is UI state. If an operation belongs to another plan, reuse
 * the already-controlled plan switch instead of mutating currentPlanId directly. */
const trOpenOperationModalLegacyBase=window.openOperationModal;
if(typeof trOpenOperationModalLegacyBase==='function'){
  openOperationModal=function(id=null){return TRUIStore.action(id?'operation.editor.edit':'operation.editor.new',()=>trOpenOperationModalLegacyBase.call(this,id));};
  window.openOperationModal=openOperationModal;
}
const trEditOperationLegacyBase=window.editOperation;
if(typeof trEditOperationLegacyBase==='function'){
  editOperation=function(id){
    const o=state.operations.find(x=>x.id===id);if(!o)return;
    if(o.tradingPlanId!==state.currentPlanId){const out=switchPlan(o.tradingPlanId);setTimeout(()=>openOperationModal(id),0);return out;}
    return openOperationModal(id);
  };
  window.editOperation=editOperation;
}

function trWrapOperationCommand(name,label){
  const base=window[name];if(typeof base!=='function'||base.__trOperationCommandWrapped)return;
  const wrapped=function(...args){return TRDomainStore.command(label,()=>base.apply(this,args),{persist:true,render:true});};
  Object.defineProperty(wrapped,'__trOperationCommandWrapped',{value:true});window[name]=wrapped;
  try{
    if(name==='saveEmotionalEditor')saveEmotionalEditor=wrapped;
    else if(name==='saveImportedRowEdit')saveImportedRowEdit=wrapped;
    else if(name==='dqSaveWorkbench')dqSaveWorkbench=wrapped;
    else if(name==='v316ApplyLink')v316ApplyLink=wrapped;
    else if(name==='v316Unlink')v316Unlink=wrapped;
  }catch{}
}
[
  ['saveEmotionalEditor','operation.emotional.update'],
  ['saveImportedRowEdit','operation.imported.update'],
  ['dqSaveWorkbench','operation.data-quality.update'],
  ['v316ApplyLink','operation.execution.link'],
  ['v316Unlink','operation.execution.unlink']
].forEach(([name,label])=>trWrapOperationCommand(name,label));

/* ---------- III-B2 · Plan/configuration command boundary ----------
 * V31.15 proved that the historical handlers can remain intact while the runtime
 * exposes one atomic domain transaction to persistence and render consumers.
 * Apply the same boundary to contracts and Trading Plan configuration. No formula
 * or payload transformation is duplicated here: the tested legacy handler remains
 * the single source of business behavior until its later extraction into modules. */
function trAssignDomainWrappedGlobal(name,wrapped){
  window[name]=wrapped;
  try{
    switch(name){
      case 'saveInstrument': saveInstrument=wrapped; break;
      case 'saveRiskStrategy': saveRiskStrategy=wrapped; break;
      case 'saveRiskManagement': saveRiskManagement=wrapped; break;
      case 'savePlan': savePlan=wrapped; break;
      case 'togglePlanStatus': togglePlanStatus=wrapped; break;
      case 'addConfig': addConfig=wrapped; break;
      case 'removeConfig': removeConfig=wrapped; break;
      case 'addHypothesis': addHypothesis=wrapped; break;
      case 'editHyp': editHyp=wrapped; break;
      case 'resetPlanConfig': resetPlanConfig=wrapped; break;
      case 'addEmotionConfig': addEmotionConfig=wrapped; break;
      case 'removeEmotionConfig': removeEmotionConfig=wrapped; break;
      case 'saveTaxonomyAsset': saveTaxonomyAsset=wrapped; break;
      case 'deleteTaxonomyAsset': deleteTaxonomyAsset=wrapped; break;
      case 'saveVisualReference': saveVisualReference=wrapped; break;
      case 'deleteVisualReference': deleteVisualReference=wrapped; break;
      case 'saveComplianceRule': saveComplianceRule=wrapped; break;
      case 'deleteComplianceRule': deleteComplianceRule=wrapped; break;
      case 'moveComplianceRule': moveComplianceRule=wrapped; break;
      case 'saveGoal': saveGoal=wrapped; break;
      case 'deleteGoal': deleteGoal=wrapped; break;
      case 'toggleGoalActive': toggleGoalActive=wrapped; break;
      case 'v312SaveMistake': v312SaveMistake=wrapped; break;
      case 'v312DeleteMistake': v312DeleteMistake=wrapped; break;
      case 'v312MoveMistake': v312MoveMistake=wrapped; break;
    }
  }catch{}
}
function trWrapDomainCommandGlobal(name,labelOrResolver,options={persist:true,render:true}){
  const base=window[name];if(typeof base!=='function'||base.__trDomainCommandWrapped)return;
  const wrapped=function(...args){
    const label=typeof labelOrResolver==='function'?labelOrResolver.apply(this,args):labelOrResolver;
    return TRDomainStore.command(String(label||`domain.${name}`),()=>base.apply(this,args),options);
  };
  Object.defineProperty(wrapped,'__trDomainCommandWrapped',{value:true});
  Object.defineProperty(wrapped,'__trDomainCommandBase',{value:base});
  trAssignDomainWrappedGlobal(name,wrapped);
}

/* Global contract library. Changing a contract may trigger historical economics
 * propagation; every resulting mutation is still one contract.create/update command. */
trWrapDomainCommandGlobal('saveInstrument',()=>typeof editingInstrumentId!=='undefined'&&editingInstrumentId?'contract.update':'contract.create');

/* Trading Plan lifecycle and management rules. */
trWrapDomainCommandGlobal('savePlan',()=>typeof editingPlanId!=='undefined'&&editingPlanId?'plan.update':(typeof cloningPlanId!=='undefined'&&cloningPlanId?'plan.clone':'plan.create'));
trWrapDomainCommandGlobal('togglePlanStatus','plan.status.update');
trWrapDomainCommandGlobal('saveRiskStrategy',()=>typeof editingRiskId!=='undefined'&&editingRiskId?'plan.risk-strategy.update':'plan.risk-strategy.create');
trWrapDomainCommandGlobal('saveRiskManagement','plan.risk-rules.update');
trWrapDomainCommandGlobal('resetPlanConfig','plan.config.reset');

/* Taxonomies and plan-local reference material. */
trWrapDomainCommandGlobal('addConfig','plan.taxonomy.option.add');
trWrapDomainCommandGlobal('removeConfig','plan.taxonomy.option.remove');
trWrapDomainCommandGlobal('addHypothesis','plan.hypothesis.create');
trWrapDomainCommandGlobal('editHyp','plan.hypothesis.update');
trWrapDomainCommandGlobal('addEmotionConfig','plan.emotion-taxonomy.add');
trWrapDomainCommandGlobal('removeEmotionConfig','plan.emotion-taxonomy.remove');
trWrapDomainCommandGlobal('saveTaxonomyAsset',()=>typeof editingTaxonomyAsset!=='undefined'&&editingTaxonomyAsset?.key?'plan.taxonomy.asset.update':'plan.taxonomy.asset.create');
trWrapDomainCommandGlobal('deleteTaxonomyAsset','plan.taxonomy.asset.delete');
trWrapDomainCommandGlobal('saveVisualReference',()=>typeof editingVisualReferenceId!=='undefined'&&editingVisualReferenceId?'plan.visual-reference.update':'plan.visual-reference.create');
trWrapDomainCommandGlobal('deleteVisualReference','plan.visual-reference.delete');

/* Checklist, explicit mistake taxonomy and scorecard goals. */
trWrapDomainCommandGlobal('saveComplianceRule',()=>typeof editingComplianceRuleId!=='undefined'&&editingComplianceRuleId?'plan.checklist.update':'plan.checklist.create');
trWrapDomainCommandGlobal('deleteComplianceRule','plan.checklist.delete');
trWrapDomainCommandGlobal('moveComplianceRule','plan.checklist.reorder');
trWrapDomainCommandGlobal('v312SaveMistake',()=>typeof editingMistakeId!=='undefined'&&editingMistakeId?'plan.mistake-rule.update':'plan.mistake-rule.create');
trWrapDomainCommandGlobal('v312DeleteMistake','plan.mistake-rule.delete');
trWrapDomainCommandGlobal('v312MoveMistake','plan.mistake-rule.reorder');
trWrapDomainCommandGlobal('saveGoal',()=>typeof editingGoalId!=='undefined'&&editingGoalId?'goal.update':'goal.create');
trWrapDomainCommandGlobal('deleteGoal','goal.delete');
trWrapDomainCommandGlobal('toggleGoalActive','goal.status.update');

/* Render is a strict durable read-only boundary. Legacy view builders may still
 * attempt lazy normalization during the migration, but those writes are rolled back
 * before render() returns and any persist request is suppressed. */
const trStateRenderBase=render;
render=function(...args){
  if(trDomainCommandDepth){trDomainCommandRenderRequests++;return;}
  trStateEnsureAttached('render');
  trDomainNormalizeHydratedSchema('render');
  const commitsBefore=trDomainCommitCount,pendingBefore=trDomainPendingMutationCount;
  trUiCapture(trUiActiveAction||'legacy.render.before');
  trDomainRenderGuardBegin();
  let out,guard=null,error=null;
  try{out=trStateRenderBase.apply(this,args);}catch(e){error=e;}finally{guard=trDomainRenderGuardEnd();}
  const commitDelta=trDomainCommitCount-commitsBefore,pendingDelta=trDomainPendingMutationCount-pendingBefore;
  if((guard?.writes||0)>0||(guard?.persistRequests||0)>0||commitDelta>0||pendingDelta>0){
    trDomainRenderSideEffects++;trDomainLastRenderSideEffectPaths=(guard?.paths||[]).slice(0,12);
    trDomainLastRenderSideEffect=`${currentView||'view'} · writes revertidas ${guard?.writes||0} · persist suprimidos ${guard?.persistRequests||0} · commits +${commitDelta} · pending +${Math.max(0,pendingDelta)} · ${new Date().toISOString()}`;
  }
  trUiCapture(trUiActiveAction||'legacy.render.after');if(error)throw error;return out;
};
window.render=render;

/* ---------- Diagnostics / integration ---------- */
function trStateRuntimeDiagnostics(){return {runtime:TR_STATE_RUNTIME_VERSION,domain:TRDomainStore.diagnostics(),ui:TRUIStore.diagnostics()};}
function trStateRuntimePanel(){
  const d=TRDomainStore.diagnostics(),u=TRUIStore.diagnostics(),ok=!d.lastError&&!u.lastError&&!d.unsafeReplacements&&!d.pendingMutations&&!d.renderSideEffects,paths=(d.lastCommit?.paths||[]).slice(0,6).join(' · ')||'—';
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Arquitectura de estado</h3><div class="help">V31.16 extiende el command boundary validado en Operaciones a contratos y configuración durable del Trading Plan: planes, gestión/riesgo, taxonomías, checklist, errores y objetivos quedan agrupados en transacciones controladas sin duplicar su lógica histórica.</div></div><span class="stable-pill ${ok?'':'warning'}">Domain + UI Store</span></div><div class="integrity-kpis"><div><span>Domain revision</span><strong>${d.revision}</strong></div><div><span>Commits observados</span><strong>${d.commits}</strong></div><div><span>Legacy / controlados</span><strong>${d.legacyCommits} / ${d.controlledCommits}</strong></div><div><span>Mutaciones pendientes</span><strong class="${d.pendingMutations?'negative':'positive'}">${d.pendingMutations}</strong></div><div><span>UI revision</span><strong>${u.revision}</strong></div><div><span>UI actions / legacy</span><strong>${u.trackedActions} / ${u.legacyChanges}</strong></div><div><span>Reemplazos de state</span><strong>${d.replacements}</strong></div><div><span>Estado</span><strong class="${ok?'positive':'negative'}">${ok?'OK':'Revisar'}</strong></div></div><div class="notice"><strong>V31.16 · Plan Configuration Command Boundary:</strong> <code>state</code> sigue siendo compatible con el código histórico, pero ya no es opaco: cada escritura profunda queda registrada y el siguiente guardado publica un lote atómico con rutas modificadas. <code>TRDomainStore.commit()</code> es el API para migrar comandos sin reescribir de golpe la lógica financiera. La navegación y los principales controles de Operaciones/Market Data ya pasan por <code>TRUIStore</code>. Comandos controlados ejecutados: <strong>${d.commands||0}</strong> · persistencias legacy coalescidas: <strong>${d.commandCoalescedPersists||0}</strong> · renders legacy coalescidos: <strong>${d.commandCoalescedRenders||0}</strong> · normalizaciones de esquema: <strong>${d.schemaNormalizations||0}</strong> · no-op suprimidos: <strong>${d.suppressedNoopWrites||0}</strong> · escrituras de render revertidas: <strong>${d.renderGuardSuppressedWrites||0}</strong> · persistencias de render suprimidas: <strong>${d.renderGuardSuppressedPersists||0}</strong> · efectos laterales detectados: <strong class="${d.renderSideEffects?'negative':'positive'}">${d.renderSideEffects||0}</strong>.<br><small>Último domain commit: ${esc(d.lastCommit?.label||'—')} · rutas: ${esc(paths)}${d.lastCommand?` · último comando: ${esc(d.lastCommand)} (${d.lastCommandMutations||0} mut.; ${d.lastCommandPersistRequests||0} persist; ${d.lastCommandRenderRequests||0} render)`:''}${u.lastAction?` · última UI action: ${esc(u.lastAction)}`:''}</small></div>${d.pendingMutations?`<div class="notice danger"><strong>Mutaciones sin persistir:</strong> ${d.pendingMutations}. Rutas: ${esc(d.pendingPaths.slice(0,8).join(' · '))}</div>`:''}${d.renderSideEffects?`<div class="notice danger"><strong>Render con efecto lateral:</strong> ${esc(d.lastRenderSideEffect||'detectado')}. Rutas: ${esc((d.lastRenderSideEffectPaths||[]).join(' · ')||'—')}. La escritura fue revertida y no alcanzó IndexedDB.</div>`:''}${d.lastError||u.lastError?`<div class="notice danger"><strong>State runtime:</strong> ${esc(d.lastError||u.lastError)}</div>`:''}</section>`;
}

const trStateDataSecurityBase=dataSecurityPanel;
dataSecurityPanel=function(){return trStateRuntimePanel()+trStateDataSecurityBase();};

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.16</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_STATE_APP_LABEL)}</div><div class="help">Fase estructural 3B2: contratos y configuración durable del Trading Plan se suman al boundary ya validado de Operaciones. Crear/editar planes, estrategias, reglas, taxonomías, checklist, errores y objetivos coalesce persistencias/renders legacy en un único commit controlado. Imports/Cloud quedan para la siguiente fase transaccional. La lógica financiera sigue congelada.</div></div></div></div>`;};

window.TradingResearchStores=Object.freeze({domain:TRDomainStore,ui:TRUIStore,diagnostics:trStateRuntimeDiagnostics});
Object.assign(window,{trStateRuntimeDiagnostics,trStateRuntimePanel});
if(typeof trCoreHydrated!=='undefined'&&trCoreHydrated)trStateEnsureAttached('runtime-load');trUiCapture('runtime-load');
/* ===== END V31.16 STATE RUNTIME ===== */
