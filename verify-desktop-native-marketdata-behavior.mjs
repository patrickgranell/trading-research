import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const runtime=fs.readFileSync('desktop-native-market-runtime.js','utf8');
assert(runtime.includes("label:'desktop-market-stage-rollback'"));
assert(runtime.includes('desktop_market_promote_authority'));
assert(runtime.includes('desktop_market_authority_status'));

function uiDocument(){
  return {
    documentElement:{},
    addEventListener(){},
    getElementById(){return null;},
    createElement(){return {id:'',innerHTML:'',insertAdjacentElement(){}};}
  };
}
function migrationHarness({failBackup=false,failStage=false,failPromote=false}={}){
  const calls=[],alerts=[],locks=[];let active=false,generation=0,blocked=false;
  const meta={id:'MD1',instrument:'CL',rowCount:3};
  const tick={id:'MD1',ticks:[[1,0,1,1,1,1],[2,0,2,2,2,1],[3,0,3,3,3,1]]};
  const exec={id:'EX1',marketDatasetId:'MD1',rows:[]};
  const hashes={workspace:'w',marketMeta:'m',marketTicks:'t',execSets:'e',images:{}};
  const raw={
    format:'tr',workspace:{tradingPlans:[]},images:[],
    marketData:{marketMeta:[meta],marketTicks:[tick],execSets:[exec]},
    manifest:{hashes,counts:{marketMeta:1,marketTicks:1,execSets:1}}
  };
  const ctx={
    console:{log(){},warn(){},error(){}},crypto:webcrypto,TextEncoder,
    alert:x=>alerts.push(String(x)),setTimeout:()=>0,MutationObserver:class{observe(){}},document:uiDocument(),
    TradingResearchDesktopAuthority:{active:true},
    TradingResearchDesktopImageAuthority:{active:true},
    TradingResearchDesktopMarketAuthority:{active:false,migrationPending:false},
    TradingResearchDesktopMarketBridge:{
      setMigrationPending:v=>{ctx.TradingResearchDesktopMarketAuthority.migrationPending=!!v;},
      setPromoted:g=>{generation=Number(g);active=generation>0;ctx.TradingResearchDesktopMarketAuthority.active=active;},
      block:()=>{blocked=true;}
    },
    trCoreFlush:async()=>true,trCoreSetWriteBlock:r=>locks.push(['set',r]),trCoreClearWriteBlock:r=>locks.push(['clear',r]),
    trBackupV2BuildPayload:async()=>raw,
    trBackupV2Preflight:async input=>({
      workspace:input.workspace,images:[],marketData:input.marketData,
      manifest:{hashes:{...hashes},counts:input.manifest.counts}
    }),
    __TAURI__:{core:{invoke:async(cmd,args)=>{
      calls.push({cmd,args});
      if(cmd==='desktop_write_backup'){
        if(failBackup)throw Error('backup failed');
        return JSON.stringify({ok:true,path:'C:/safe/market.trbackup',bytes:500});
      }
      if(cmd==='desktop_market_begin_staging')return JSON.stringify({ok:true,generation:1,resumed:false,authority:false});
      if(cmd==='desktop_market_stage_meta'||cmd==='desktop_market_stage_exec'){
        if(failStage)throw Error('stage failed');
        return JSON.stringify({ok:true,generation:1,id:args.id,authority:false});
      }
      if(cmd==='desktop_market_stage_tick_chunk'){
        if(failStage)throw Error('stage failed');
        return JSON.stringify({ok:true,generation:1,rows:JSON.parse(args.payload).length,authority:false});
      }
      if(cmd==='desktop_market_finalize_dataset')return JSON.stringify({ok:true,rowCount:args.rowCount,chunkCount:args.chunkCount,authority:false});
      if(cmd==='desktop_market_verify_staging')return JSON.stringify({ok:true,generation:1,meta:1,datasets:1,execSets:1,authority:false});
      if(cmd==='desktop_market_promote_authority'){
        if(failPromote)throw Error('promote failed');
        active=true;generation=1;return JSON.stringify({ok:true,active:true,generation:1,meta:1,datasets:1,execSets:1,ticks:3});
      }
      if(cmd==='desktop_market_authority_status')return JSON.stringify({ok:true,active,generation,meta:active?1:0,datasets:active?1:0,execSets:active?1:0,ticks:active?3:0,deepVerified:!!args?.deep});
      if(cmd==='desktop_market_staging_status')return JSON.stringify({ok:true,active,generation,staging:{generation:1,completed:true}});
      throw Error('unexpected '+cmd);
    }}}
  };
  ctx.globalThis=ctx;
  vm.runInContext(runtime,vm.createContext(ctx));
  return {ctx,calls,alerts,locks,get blocked(){return blocked;}};
}

{
  const t=migrationHarness();
  const result=await t.ctx.TradingResearchDesktopNativeMarketData.migrateNativeMarketData();
  assert.equal(result.ok,true);
  const names=t.calls.map(x=>x.cmd);
  assert(names.indexOf('desktop_write_backup')<names.indexOf('desktop_market_begin_staging'),'Backup must precede Market staging');
  assert(names.indexOf('desktop_market_begin_staging')<names.indexOf('desktop_market_stage_meta'));
  assert(names.indexOf('desktop_market_stage_tick_chunk')<names.indexOf('desktop_market_finalize_dataset'));
  assert(names.indexOf('desktop_market_verify_staging')<names.indexOf('desktop_market_promote_authority'));
  assert(t.calls.some(x=>x.cmd==='desktop_market_authority_status'&&x.args.deep===true),'Promotion must deep-read native authority');
  const chunkCalls=t.calls.filter(x=>x.cmd==='desktop_market_stage_tick_chunk');
  assert.equal(chunkCalls.length,1);assert.equal(JSON.parse(chunkCalls[0].args.payload).length,3);
  assert.equal(t.ctx.TradingResearchDesktopMarketAuthority.active,true);
  assert(t.locks.some(x=>x[0]==='set')&&t.locks.some(x=>x[0]==='clear'),'Migration lock must be set and released');
  assert.equal(t.blocked,false);
}
{
  const t=migrationHarness({failBackup:true});
  await t.ctx.TradingResearchDesktopNativeMarketData.migrateNativeMarketData();
  assert(!t.calls.some(x=>x.cmd==='desktop_market_begin_staging'),'No staging without physical Backup V2');
  assert(!t.calls.some(x=>x.cmd==='desktop_market_promote_authority'));
  assert.equal(t.ctx.TradingResearchDesktopMarketAuthority.migrationPending,false);
}
{
  const t=migrationHarness({failStage:true});
  await t.ctx.TradingResearchDesktopNativeMarketData.migrateNativeMarketData();
  assert(t.calls.some(x=>x.cmd==='desktop_write_backup'));
  assert(!t.calls.some(x=>x.cmd==='desktop_market_promote_authority'),'Failed staging must not promote');
  assert(t.alerts.some(x=>x.includes('market.trbackup')),'Failure must surface preserved rollback');
}
{
  const t=migrationHarness({failPromote:true});
  await t.ctx.TradingResearchDesktopNativeMarketData.migrateNativeMarketData();
  assert.equal(t.blocked,true,'Failure after promotion attempt must fail closed because marker publication may have started');
}

/* Bridge behavior: chunked live commit + bounded read reconstruction. */
const bridgeSource=fs.readFileSync('desktop-authority-bridge.js','utf8');
function bridgeHarness(){
  const calls=[];let generation=1;
  const ctx={
    console:{log(){},warn(){},error(){}},crypto:webcrypto,TextEncoder,
    document:{documentElement:{classList:{remove(){}}},getElementById(){return null}},
    __TAURI__:{core:{invoke:async(cmd,args)=>{
      calls.push({cmd,args});
      if(cmd==='desktop_market_begin_live_op')return JSON.stringify({ok:true,expectedGeneration:args.expectedGeneration});
      if(cmd==='desktop_market_stage_live_record'||cmd==='desktop_market_stage_live_delete')return JSON.stringify({ok:true});
      if(cmd==='desktop_market_stage_live_tick_chunk')return JSON.stringify({ok:true,rows:JSON.parse(args.payload).length});
      if(cmd==='desktop_market_finalize_live_tick')return JSON.stringify({ok:true,rowCount:args.rowCount,chunkCount:args.chunkCount});
      if(cmd==='desktop_market_commit_live_op'){generation++;return JSON.stringify({ok:true,generation,updatedAt:'x'});}
      if(cmd==='desktop_market_abort_live_op')return JSON.stringify({ok:true});
      if(cmd==='desktop_market_list_catalogs')return JSON.stringify([{id:'MD1',chunkCount:2,rowCount:3,aggregateSha256:'a'.repeat(64)}]);
      if(cmd==='desktop_market_read_active_chunk'){
        const p=args.chunkIndex===0?[[1,0,1,1,1,1],[2,0,2,2,2,1]]:[[3,0,3,3,3,1]];
        return JSON.stringify({authority:true,chunkIndex:args.chunkIndex,rowCount:p.length,payload:JSON.stringify(p)});
      }
      if(cmd==='desktop_market_authority_status')return JSON.stringify({ok:true,active:true,generation});
      if(cmd==='desktop_native_image_authority_status')return JSON.stringify({ok:true,active:true,generation:1});
      throw Error('unexpected '+cmd);
    }}},
    trCoreSetWriteBlock(){},trCoreClearWriteBlock(){},
    trCoreIsValidWorkspacePayload:()=>true,clone:x=>structuredClone(x)
  };
  ctx.globalThis=ctx;
  vm.runInContext(bridgeSource,vm.createContext(ctx));
  ctx.TradingResearchDesktopMarketBridge.setPromoted(1);
  return {ctx,calls};
}
{
  const t=bridgeHarness();
  const ticks=Array.from({length:25001},(_,i)=>[i,0,1,1,1,1]);
  const out=await t.ctx.TradingResearchDesktopMarketBridge.applyChanges([
    {type:'put',store:'marketMeta',id:'MDX',value:{id:'MDX',instrument:'CL'}},
    {type:'put',store:'marketTicks',id:'MDX',value:{id:'MDX',ticks}}
  ],'test.chunks');
  assert.equal(out.generation,2);
  const chunks=t.calls.filter(x=>x.cmd==='desktop_market_stage_live_tick_chunk');
  assert.equal(chunks.length,2,'25,001 ticks must use two bounded IPC chunks');
  assert.equal(JSON.parse(chunks[0].args.payload).length,25000);
  assert.equal(JSON.parse(chunks[1].args.payload).length,1);
  const reconstructed=await t.ctx.TradingResearchDesktopMarketBridge.get('marketTicks','MD1');
  assert.equal(reconstructed.ticks.length,3);
  assert.deepEqual(JSON.parse(JSON.stringify(reconstructed.ticks[2])),[3,0,3,3,3,1]);
}

if(fs.existsSync('desktop-dist/index.html')){
  const html=fs.readFileSync('desktop-dist/index.html','utf8');
  assert(html.includes('data-tr-desktop-native-marketdata="batch78"'));
  assert(html.includes('TradingResearchDesktopMarketBridge.applyChanges'));
  assert(html.includes('TradingResearchDesktopMarketBridge.replaceAll'));
}
console.log('Batch 78 Market Data behavior PASS: rollback-first migration, fail-closed promotion, 25k IPC chunks, CAS commit and chunked readback.');
