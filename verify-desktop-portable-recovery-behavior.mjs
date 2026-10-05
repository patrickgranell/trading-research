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
function harness({journalPhase=null,imageActive=true,marketActive=true,statusFailure=false}={}){
  const calls=[],alerts=[],blocks=new Set(),timers=[];let restored=false,cleared=false;
  let imageNow=imageActive,marketNow=marketActive,phase=journalPhase;
  const document={
    documentElement:{},
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
    trCoreSetWriteBlock:r=>blocks.add(r),trCoreClearWriteBlock:r=>blocks.delete(r),
    trBackupV2SetRecoveryUiBlocked(){},
    trBackupV2Canonical:v=>JSON.stringify(stable(v)),
    trBackupV2Preflight:async raw=>JSON.parse(JSON.stringify(raw)),
    trBackupV2BuildPayload:async()=>JSON.parse(JSON.stringify(restored?source:current)),
    trBackupV2RefreshUiAfterRestore:async()=>true,
    trBackupV2RestoreProtocol:async()=>{restored=true;calls.push({cmd:'restoreProtocol'});return {ok:true};},
    TRDomainStore:{exclusive:async(_r,fn)=>fn()},
    TradingResearchDesktopAuthority:{active:true},
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
      throw new Error('Unexpected command '+cmd);
    }}}
  };
  context.globalThis=context;
  vm.runInContext(runtime,vm.createContext(context),{timeout:1500});
  return {ctx:context,api:context.TradingResearchDesktopPortableRecovery,calls,alerts,blocks,timers,get cleared(){return cleared;},get phase(){return phase;},get restored(){return restored;}};
}

{
  const t=harness();
  const file={text:async()=>sourceText};
  const result=await t.api.startFromFile(file);
  assert(result,'portable restore should complete');
  assert.equal(t.cleared,true,'verified journal must be cleared');
  assert.equal(t.phase,null);
  assert(t.calls.some(x=>x.cmd==='restoreProtocol'),'source Backup V2 must restore before verification');
  const advances=t.calls.filter(x=>x.cmd==='desktop_portable_restore_advance').map(x=>x.args.nextPhase);
  assert.deepEqual(advances,['restored','images-native','market-native','verified']);
  assert(!t.blocks.has('desktop-portable-restore'),'write block must release only after verified clear');
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
  const t=harness({journalPhase:'prepared',statusFailure:true});
  const out=await t.api.resumePending({announce:false});
  assert.equal(out.status,'blocked');
  assert(t.blocks.has('desktop-portable-restore'),'unreadable pending journal/source must remain write-blocked');
  assert.equal(t.cleared,false);
}

console.log('Batch 79 portable recovery behavior PASS: complete, restart-resume and fail-closed source loss.');
