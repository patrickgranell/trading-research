/* ===== V31.23.55 RUNTIME · Post-Audit Persistence Coalescing =====
 * External-audit hardening: delay the expensive legacy workspace snapshot until
 * the write actually leaves the debounce window. Controlled DomainStore commands
 * already coalesce their own writes and deliberately bypass this compatibility layer.
 */
(()=>{
'use strict';
const TR_PERSIST_COALESCE_VERSION='31.23.55';
const TR_PERSIST_DEBOUNCE_MS=200;
const trPersistBridgeBase=trCorePersistStateBridge;
const trPersistNowBase=trCorePersistNow;
const trFlushBase=trCoreFlush;
const trPersistenceInfoBase=typeof trCorePersistenceInfo==='function'?trCorePersistenceInfo:null;
let trPersistTimer=null;
let trPersistPendingPromise=null;
let trPersistPendingResolve=null;
let trPersistPendingReason='';
let trPersistRequests=0;
let trPersistCoalesced=0;
let trPersistDebouncedWrites=0;
let trPersistForcedFlushes=0;
let trPersistSupersededByImmediate=0;
let trPersistLastAt='';
let trPersistLastReason='';
let trPersistLastError='';

function trPersistCreatePending(){
  if(trPersistPendingPromise)return trPersistPendingPromise;
  trPersistPendingPromise=new Promise(resolve=>{trPersistPendingResolve=resolve;});
  return trPersistPendingPromise;
}
function trPersistDetachPending(){
  const pending={promise:trPersistPendingPromise,resolve:trPersistPendingResolve,reason:trPersistPendingReason||'persist'};
  trPersistPendingPromise=null;trPersistPendingResolve=null;trPersistPendingReason='';
  if(trPersistTimer){clearTimeout(trPersistTimer);trPersistTimer=null;}
  return pending;
}
async function trPersistRunPending(){
  if(!trPersistPendingPromise)return true;
  const pending=trPersistDetachPending();
  try{
    /* The historical bridge performs clone(state). Calling it here, rather than on
       every persist() request, makes the deep clone itself part of the debounce. */
    const ok=trPersistBridgeBase(pending.reason);
    trPersistDebouncedWrites++;trPersistLastAt=new Date().toISOString();trPersistLastReason=pending.reason;trPersistLastError='';
    pending.resolve?.(ok!==false);return ok!==false;
  }catch(e){
    trPersistLastError=e?.message||String(e);pending.resolve?.(false);console.error('[Trading Research · persistence coalescer]',e);return false;
  }
}
function trPersistCancelPendingAsSuperseded(){
  if(!trPersistPendingPromise)return false;
  const pending=trPersistDetachPending();trPersistSupersededByImmediate++;pending.resolve?.(true);return true;
}
function trPersistSchedule(reason='persist'){
  trPersistRequests++;
  if(trPersistPendingPromise)trPersistCoalesced++;
  trPersistPendingReason=String(reason||'persist');trPersistCreatePending();
  if(trPersistTimer)clearTimeout(trPersistTimer);
  trPersistTimer=setTimeout(()=>{void trPersistRunPending();},TR_PERSIST_DEBOUNCE_MS);
  return true;
}

trCorePersistStateBridge=function(reason='persist'){return trPersistSchedule(reason);};
trCorePersistNow=async function(reason='persist'){
  /* An explicit immediate persist snapshots the latest state, so a pending legacy
     write is redundant and can be cancelled instead of cloning the workspace twice. */
  trPersistCancelPendingAsSuperseded();return trPersistNowBase(reason);
};
trCoreFlush=async function(){
  if(trPersistPendingPromise){trPersistForcedFlushes++;await trPersistRunPending();}
  return trFlushBase();
};
if(trPersistenceInfoBase){
  trCorePersistenceInfo=function(){return {...trPersistenceInfoBase(),writeCoalescing:{version:TR_PERSIST_COALESCE_VERSION,debounceMs:TR_PERSIST_DEBOUNCE_MS,pending:!!trPersistPendingPromise,requests:trPersistRequests,coalesced:trPersistCoalesced,writes:trPersistDebouncedWrites,forcedFlushes:trPersistForcedFlushes,supersededByImmediate:trPersistSupersededByImmediate,lastAt:trPersistLastAt,lastReason:trPersistLastReason,lastError:trPersistLastError}};};
}

/* Start a pending IndexedDB write when the tab is being backgrounded. Completion is
 * still governed by the browser, but the debounce itself never intentionally waits
 * through a visibility/page lifecycle transition. */
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&trPersistPendingPromise)void trPersistRunPending();});
addEventListener('pagehide',()=>{if(trPersistPendingPromise)void trPersistRunPending();});
})();
/* ===== END V31.23.55 PERSISTENCE COALESCING RUNTIME ===== */
