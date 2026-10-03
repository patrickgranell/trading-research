/* Batch 76 · isolated bridge behavior contract with mocked native I/O. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const bridge=fs.readFileSync('desktop-authority-bridge.js','utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const seed=()=>({tradingPlans:[{id:'p'}],operations:[],opportunities:[],importBatches:[],settings:{instruments:[]}});
function harness({active=false,failStatus=false,failPreflight=false,failCommit=false}={}){
  let record=active?{active:true,payload:JSON.stringify(seed()),revision:1,sha256:'test',updatedAt:'test'}:null;
  const calls=[],root={innerHTML:''},ctx={
    console:{error:()=>{}},Promise,setTimeout,clearTimeout,
    state:seed(),trCoreHydrated:false,trCoreFatal:false,trCoreMode:'booting',
    trCoreWriteChain:Promise.resolve(),trCoreLastError:'',trCoreLastSavedAt:'',trCoreSnapshotCache:[],
    trCoreSetWriteBlock:r=>{ctx.block=r;},trCoreReportPersistenceError:()=>{ctx.reported=true;},
    trCoreWriteAllowed:()=>!ctx.block,
    trCoreOpenDb:async()=>({}),trCoreGetAll:async()=>[],
    trCoreIsValidWorkspacePayload:obj=>!!obj&&Array.isArray(obj.tradingPlans)&&obj.tradingPlans.length>0&&Array.isArray(obj.operations),
    normalizeState:copy,ensureAllPlansV8:()=>{},ensureMasterLibrary:()=>{},
    trCoreSignalHydrated:()=>{ctx.signaled=true;},trCoreFlush:async()=>true,
    clone:copy,TR_CORE_SNAPSHOT_STORE:'snapshots',
    trCoreBootstrapIndexedDb:async()=>{ctx.trCoreMode='indexeddb';ctx.trCoreHydrated=true;},
    trBackupV2BuildPayload:async()=>({workspace:copy(ctx.state),images:[],marketData:{},manifest:{schema:2}}),
    trBackupV2Preflight:async()=>{if(failPreflight)throw Error('preflight failed');return true;},
    trBackupV2JournalGet:async()=>null,
    TRDomainStore:{snapshot:()=>copy(ctx.state)},
    document:{documentElement:{classList:{remove:()=>{ctx.unlocked=true;}}},getElementById:()=>root},
    render:()=>{ctx.rendered=true;},TradingResearchDesktopNativeStorage:{refresh:async()=>{ctx.refreshed=true;}}
  };
  ctx.__TAURI__={core:{invoke:async(name,args={})=>{
    calls.push(name);
    if(name==='desktop_authority_status'){if(failStatus)throw Error('authority status corrupted');return JSON.stringify(record?{active:true,revision:record.revision}:{active:false});}
    if(name==='desktop_read_authoritative_workspace')return JSON.stringify(record);
    if(name==='desktop_write_backup')return JSON.stringify({ok:true,path:'C:/native/backups/rollback.trbackup',bytes:123});
    if(name==='desktop_promote_workspace_authority'){
      record={active:true,payload:args.payload,revision:1,sha256:'test',updatedAt:'migrated'};
      return JSON.stringify({ok:true,revision:1});
    }
    if(name==='desktop_commit_authoritative_workspace'){
      if(failCommit)throw Error('native CAS failure');
      assert.equal(args.expectedRevision,record.revision,'write must CAS against last confirmed revision');
      record={...record,payload:args.payload,revision:record.revision+1,updatedAt:'committed'};
      return JSON.stringify({ok:true,revision:record.revision,updatedAt:'committed'});
    }
    throw Error('Unexpected native command '+name);
  }}};
  const context=vm.createContext(ctx);
  const api=vm.runInContext(bridge+'\n;({boot:trDesktopAuthorityBootstrap,queue:trDesktopAuthorityQueueStateWrite,control:trDesktopAuthorityControl})',context,{timeout:1000});
  return {ctx,api,calls,root,getRecord:()=>record};
}
{
  const t=harness({active:false});await t.api.boot();
  assert.equal(t.ctx.trCoreMode,'sqlite-authority');assert.equal(t.ctx.trCoreFatal,false);
  assert.equal(t.api.control.revision(),1);
  const seq=t.calls;
  assert(seq.indexOf('desktop_write_backup')<seq.indexOf('desktop_promote_workspace_authority'),'physical backup must precede promotion');
  assert(seq.indexOf('desktop_promote_workspace_authority')<seq.lastIndexOf('desktop_read_authoritative_workspace'),'readback must follow promotion');
  assert(t.ctx.refreshed&&t.ctx.rendered);
  t.ctx.state.operations.push({id:'1'});const a=t.api.queue('a');
  t.ctx.state.operations.push({id:'2'});const b=t.api.queue('b');
  assert.equal(await a,true);assert.equal(await b,true);
  assert.equal(t.api.control.revision(),3);
  assert.equal(JSON.parse(t.getRecord().payload).operations.length,2);
}
{
  const t=harness({active:true});await t.api.boot();
  assert.equal(t.ctx.trCoreMode,'sqlite-authority');assert(!t.calls.includes('desktop_write_backup'));
  assert(!t.calls.includes('desktop_promote_workspace_authority'),'Promoted SQLite must bypass legacy migration');
}
{
  const t=harness({failStatus:true});await t.api.boot();
  assert.equal(t.ctx.trCoreFatal,true);assert.equal(t.ctx.trCoreHydrated,false);
  assert(!t.calls.includes('desktop_write_backup'),'Corrupt native authority must not fall back to IndexedDB');
}
{
  const t=harness({failPreflight:true});await t.api.boot();
  assert.equal(t.ctx.trCoreFatal,true);assert(!t.calls.includes('desktop_write_backup'));
  assert(!t.calls.includes('desktop_promote_workspace_authority'));
}
{
  const t=harness({active:true,failCommit:true});await t.api.boot();
  t.ctx.state.operations.push({id:'new'});
  assert.equal(await t.api.queue('failing-write'),false);
  assert.equal(t.ctx.trCoreFatal,true);assert.equal(t.api.control.revision(),1);
  assert.equal(await t.api.queue('must-not-retry'),false);
  assert.equal(t.calls.filter(x=>x==='desktop_commit_authoritative_workspace').length,1);
}
console.log('Desktop authority behavior OK: backup-first migration, direct SQLite boot, ordered CAS commits and fail-closed cases.');
