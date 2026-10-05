import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const runtime=fs.readFileSync('desktop-portable-recovery-runtime.js','utf8');
const source={
  format:'trading-research-backup',schema:2,appVersion:'31.24.0',exportedAt:'x',
  manifest:{counts:{plans:1,operations:2,images:1,marketMeta:1,marketTicks:1,execSets:1},
    hashes:{workspace:'w',images:{IMG1:'i'},marketMeta:'m',marketTicks:'t',execSets:'e'}},
  workspace:{tradingPlans:[{id:'TP1'}],operations:[{id:'A'},{id:'B'}],opportunities:[],importBatches:[],settings:{instruments:[]}},
  images:[{id:'IMG1',data:'AA==',sha256:'i'}],
  marketData:{marketMeta:[{id:'MD1'}],marketTicks:[{id:'MD1',ticks:[[1,0,1,1,1,1]]}],execSets:[{id:'EX1',marketDatasetId:'MD1'}]}
};
const current={...source,manifest:{...source.manifest,hashes:{...source.manifest.hashes,workspace:'old'}},workspace:{...source.workspace,operations:[]}};
const sourceText=JSON.stringify(source);

function stable(v){
  if(Array.isArray(v))return v.map(stable);
  if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=stable(v[k]);return o;}
  return v;
}
function harness({journalPhase=null,imageActive=true,marketActive=true,statusFailure=false,backupJournalPending=false,backupRecoveryStatus='completed-forward',workspaceActive=true}={}){
  const calls=[],alerts=[],timers=[];
  let blockReason='',loading=false,veilCalls=0;
  let restored=journalPhase!==null&&journalPhase!=='prepared',cleared=false;
  let imageNow=imageActive,marketNow=marketActive,workspaceNow=workspaceActive,phase=journalPhase;
  const document={
    documentElement:{classList:{toggle(_name,value){loading=!!value;},remove(){loading=false;}}},
    addEventListener(){},
    getElementById(){return null;}
  };
  const context={
    console:{log(){},warn(){},error(){}},
    globalThis:null,document,MutationObserver:class{observe(){}},
    setTimeout:fn=>{timers.push(fn);return timers.length;},
    TextEncoder,TextDecoder,
    btoa:v=>Buffer.from(String(v),'binary').toString('base64'),
    atob:v=>Buffer.from(String(v),'base64').toString('binary'),
    alert:v=>alerts.push(String(v)),confirm:()=>true,
    Math,Date,JSON,Number,String,Array,Object,Promise,Error,Uint8Array,
    trCoreSetWriteBlock:r=>{blockReason=String(r||'');return blockReason;},
    trCoreClearWriteBlock:r=>{if(!r||blockReason===String(r))blockReason='';return !blockReason;},
    trCoreWriteBlocked:()=>!!blockReason,
    trCorePersistenceInfo:()=>({writeBlocked:!!blockReason,writeBlockReason:blockReason}),
    trBackupV2SetRecoveryUiBlocked(blocked){veilCalls++;const effective=!!blocked||!!blockReason;loading=effective;return effective;},
    trBackupV2Canonical:v=>JSON.stringify(stable(v)),
    trBackupV2SortRecords:rows=>JSON.parse(JSON.stringify(rows||[])).sort((a,b)=>String(a?.id||'').localeCompare(String(b?.id||''))),
    trBackupV2HashCanonical:async v=>{
      const got=JSON.stringify(stable(v));
      if(got===JSON.stringify(stable(source.workspace)))return 'w';
      if(got===JSON.stringify(stable(source.marketData.marketMeta)))return 'm';
      if(got===JSON.stringify(stable(source.marketData.execSets)))return 'e';
      throw new Error('unexpected canonical hash input');
    },
    trBackupV2Preflight:async raw=>JSON.parse(JSON.stringify(raw)),
    trBackupV2BuildPayload:async()=>JSON.parse(JSON.stringify(restored?source:current)),
    trBackupV2RefreshUiAfterRestore:async()=>{assert.equal(blockReason,'','portable UI refresh must run only after the portable recovery write lock is released');calls.push({cmd:'refreshUi'});return true;},
    trBackupV2JournalGet:async()=>backupJournalPending?{id:'backup-v2-pending'}:null,
    trBackupV2RecoverPending:async()=>{assert.equal(backupJournalPending,true);backupJournalPending=false;calls.push({cmd:'recoverBackupJournal'});if(backupRecoveryStatus==='completed-forward')restored=true;return {status:backupRecoveryStatus};},
    trBackupV2RestoreProtocol:async()=>{restored=true;calls.push({cmd:'restoreProtocol'});return {ok:true};},
    TRDomainStore:{exclusive:async(_r,fn)=>fn()},
    TradingResearchDesktopAuthority:{active:workspaceNow,refreshFromNative:async()=>{workspaceNow=true;context.TradingResearchDesktopAuthority.active=true;calls.push({cmd:'refreshWorkspaceAuthority'});return {active:true,revision:1};}},
    TradingResearchDesktopNativeStorage:{refresh:async()=>true},
    TradingResearchDesktopNativeImages:{
      status:async()=>({authority:{active:imageNow,deepVerified:imageNow,catalogRecords:imageNow?1:0,generation:imageNow?1:0}}),
      migrateNativeImages:async options=>{assert.equal(options?.silent,true);imageNow=true;calls.push({cmd:'migrateImages'});return {ok:true,active:true,generation:1};}
    },
    TradingResearchDesktopNativeMarketData:{
      status:async()=>({authority:{active:marketNow,deepVerified:marketNow,datasets:marketNow?1:0,execSets:marketNow?1:0,ticks:marketNow?1:0,generation:marketNow?1:0}}),
      migrateNativeMarketData:async options=>{assert.equal(options?.silent,true);marketNow=true;calls.push({cmd:'migrateMarket'});return {ok:true,active:true,generation:1};}
    },
    __TAURI__:{core:{invoke:async(cmd,args={})=>{
      calls.push({cmd,args});
      if(cmd==='desktop_backup_stream_begin')return JSON.stringify({ok:true,sessionId:args.sessionId,bytes:0});
      if(cmd==='desktop_backup_stream_append'){
        const bytes=Buffer.from(String(args.dataB64||''),'base64').length;
        return JSON.stringify({ok:true,sessionId:args.sessionId,bytes:(args.sessionId.includes('dummy')?0:bytes)});
      }
      if(cmd==='desktop_backup_stream_finalize'){
        const label=String(args.label||'');
        const bytes=label.includes('source')?Buffer.byteLength(sourceText):Buffer.byteLength(JSON.stringify(current));
        return JSON.stringify({ok:true,path:'C:/app/backups/'+label+'.trbackup',bytes,sha256:(label.includes('source')?'b':'a').repeat(64)});
      }
      if(cmd==='desktop_backup_stream_abort')return JSON.stringify({ok:true});
      if(cmd==='desktop_promote_workspace_authority'){
        assert.equal(args.payload,JSON.stringify(source.workspace));
        assert(String(args.rollbackPath).includes('portable-restore-source'));
        workspaceNow=true;
        return JSON.stringify({ok:true,revision:1});
      }
      if(cmd==='desktop_portable_restore_begin'){
        phase='prepared';
        return JSON.stringify({ok:true,active:true,resumed:false,phase,sourcePath:args.sourcePath,sourceSha256:args.sourceSha256,rollbackPath:args.rollbackPath,rollbackSha256:args.rollbackSha256});
      }
      if(cmd==='desktop_portable_restore_status'){
        if(statusFailure)throw new Error('source missing');
        if(!phase)return JSON.stringify({ok:true,active:false});
        return JSON.stringify({ok:true,active:true,phase,sourcePath:'C:/app/backups/portable-restore-source.trbackup',sourceSha256:'b'.repeat(64),rollbackPath:'C:/app/backups/rollback.trbackup',rollbackSha256:'a'.repeat(64)});
      }
      if(cmd==='desktop_portable_restore_advance'){
        assert.equal(args.expectedPhase,phase);
        phase=args.nextPhase;return JSON.stringify({ok:true,phase,updatedAt:'now'});
      }
      if(cmd==='desktop_portable_restore_clear'){assert.equal(phase,'verified');cleared=true;phase=null;return JSON.stringify({ok:true,active:false});}
      if(cmd==='desktop_read_native_backup_chunk'){
        const bytes=Buffer.from(sourceText);
        return JSON.stringify({ok:true,offset:0,bytes:bytes.length,totalBytes:bytes.length,eof:true,dataB64:bytes.toString('base64')});
      }
      if(cmd==='desktop_read_authoritative_workspace')return JSON.stringify({active:true,payload:JSON.stringify(source.workspace),revision:9});
      if(cmd==='desktop_list_native_images')return JSON.stringify([{id:'IMG1',sha256:'i'}]);
      if(cmd==='desktop_market_list_records'){
        if(args.store==='marketMeta')return JSON.stringify(source.marketData.marketMeta);
        if(args.store==='execSets')return JSON.stringify(source.marketData.execSets);
      }
      if(cmd==='desktop_market_backup_ticks_hash'){
        assert.equal(args.orderedIdsJson,JSON.stringify(['MD1']));
        return JSON.stringify({ok:true,sha256:'t',datasets:1,ticks:1});
      }
      throw new Error('Unexpected command '+cmd);
    }}}
  };
  context.globalThis=context;
  vm.runInContext(runtime,vm.createContext(context),{timeout:1500});
  return {ctx:context,api:context.TradingResearchDesktopPortableRecovery,calls,alerts,timers,get blockReason(){return blockReason;},get loading(){return loading;},get veilCalls(){return veilCalls;},get cleared(){return cleared;},get phase(){return phase;},get restored(){return restored;}};
}

{
  const t=harness({workspaceActive:false,imageActive:false,marketActive:false});
  const file={text:async()=>sourceText};
  const result=await t.api.startFromFile(file);
  assert(result,'truly fresh target must recover from portable Backup V2');
  assert(t.calls.some(x=>x.cmd==='desktop_promote_workspace_authority'),'fresh target must promote source workspace into SQLite');
  assert(t.calls.some(x=>x.cmd==='refreshWorkspaceAuthority'),'runtime must adopt newly promoted SQLite authority before restore');
  assert.equal(t.ctx.TradingResearchDesktopAuthority.active,true);
  assert.equal(t.cleared,true);
}

{
  const t=harness({imageActive:false,marketActive:false});
  const file={text:async()=>sourceText};
  const result=await t.api.startFromFile(file);
  assert(result,'portable restore should complete');
  assert.equal(t.cleared,true,'verified journal must be cleared');
  assert.equal(t.phase,null);
  assert(t.calls.some(x=>x.cmd==='restoreProtocol'),'source Backup V2 must restore before verification');
  assert(t.calls.some(x=>x.cmd==='migrateImages'),'fresh target must promote restored images to native authority');
  assert(t.calls.some(x=>x.cmd==='migrateMarket'),'fresh target must promote restored Market Data to native authority');
  const advances=t.calls.filter(x=>x.cmd==='desktop_portable_restore_advance').map(x=>x.args.nextPhase);
  assert.deepEqual(advances,['restored','images-native','market-native','verified']);
  assert.equal(t.blockReason,'','write block must be released after verified clear');
  assert.equal(t.loading,false,'portable restore must never enter the boot workspace loading veil');
  assert.equal(t.veilCalls,0,'portable restore must not call the boot-only recovery veil at all');
  await Promise.resolve();await Promise.resolve();
  assert(t.calls.some(x=>x.cmd==='refreshUi'),'successful portable restore may refresh diagnostics only after release');
}

{
  const t=harness({journalPhase:'restored',imageActive:false,marketActive:false});
  const out=await t.api.resumePending({announce:false});
  assert.equal(out.status,'completed');
  assert(!t.calls.some(x=>x.cmd==='restoreProtocol'),'phase restored must not replay completed workspace restore');
  assert(t.calls.some(x=>x.cmd==='migrateImages'),'resume must promote missing native images');
  assert(t.calls.some(x=>x.cmd==='migrateMarket'),'resume must promote missing native Market Data');
  assert.equal(t.cleared,true);
}

{
  const t=harness({journalPhase:'prepared',imageActive:true,marketActive:true,backupJournalPending:true});
  const out=await t.api.resumePending({announce:false});
  assert.equal(out.status,'completed');
  assert(t.calls.some(x=>x.cmd==='recoverBackupJournal'),'pending Backup V2 journal must recover before portable phase advance');
  assert(!t.calls.some(x=>x.cmd==='restoreProtocol'),'portable resume must not start a second Backup V2 restore while one is recoverable');
  assert.equal(t.cleared,true);
}

{
  const t=harness({journalPhase:'prepared',imageActive:true,marketActive:true,backupJournalPending:true,backupRecoveryStatus:'aborted-before-market'});
  const out=await t.api.resumePending({announce:false});
  assert.equal(out.status,'completed');
  assert(t.calls.some(x=>x.cmd==='recoverBackupJournal'),'pre-Market pending journal must be resolved first');
  assert(t.calls.some(x=>x.cmd==='restoreProtocol'),'safe pre-Market abort must restart the source Backup V2 restore before portable phase advance');
  assert.equal(t.cleared,true);
}

{
  const t=harness({journalPhase:'prepared',statusFailure:true});
  const out=await t.api.resumePending({announce:false});
  assert.equal(out.status,'blocked');
  assert.equal(t.blockReason,'desktop-portable-restore','unreadable pending journal/source must remain write-blocked');
  assert.equal(t.loading,false,'even a failed resume must keep the application visible');
  assert.equal(t.veilCalls,0,'failed portable recovery must not reuse the boot veil');
  assert.equal(t.cleared,false);
}

console.log('Batch 79 portable recovery behavior PASS: complete, restart-resume and fail-closed source loss.');
