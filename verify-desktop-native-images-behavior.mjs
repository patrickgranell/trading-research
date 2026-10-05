import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('desktop-native-images-runtime.js','utf8');
assert(source.includes("label:'desktop-image-stage-rollback'"),'Physical rollback must precede staging');
assert(source.includes('desktop_promote_native_image_authority'),'Native promotion command missing');
assert(source.includes("desktop_native_image_authority_status',{deep:true}"),'Deep native readback missing');
assert(source.includes('setMigrationPending'),'Migration lock missing');

function harness({failStage=false,failBackup=false,failPromotion=false}={}){
  const calls=[],alerts=[],locks=[];let generation=0,active=false,blocked=false;
  const image={id:'IMG1',data:'eA==',sha256:'a'.repeat(64),type:'image/png',name:'x.png'};
  const ctx={
    console:{log(){},warn(){},error(){}},
    alert:x=>alerts.push(String(x)),
    setTimeout:()=>0,
    MutationObserver:class{observe(){}},
    document:{
      documentElement:{},addEventListener(){},getElementById(){return null},
      createElement(){return {id:'',innerHTML:'',insertAdjacentElement(){}};}
    },
    TradingResearchDesktopAuthority:{active:true},
    TradingResearchDesktopImageAuthority:{active:false,migrationPending:false},
    TradingResearchDesktopImageBridge:{
      setMigrationPending:v=>{ctx.TradingResearchDesktopImageAuthority.migrationPending=!!v;},
      setPromoted:g=>{generation=Number(g);active=generation>0;ctx.TradingResearchDesktopImageAuthority.active=active;},
      block:()=>{blocked=true;}
    },
    trCoreFlush:async()=>true,
    trCoreSetWriteBlock:r=>locks.push(['set',r]),
    trCoreClearWriteBlock:r=>locks.push(['clear',r]),
    trBackupV2BuildPayload:async()=>({format:'tr',workspace:{tradingPlans:[]},images:[image],marketData:{},manifest:{counts:{images:1}}}),
    trBackupV2Preflight:async raw=>raw,
    __TAURI__:{core:{invoke:async(cmd,args)=>{
      calls.push({cmd,args});
      if(cmd==='desktop_write_backup'){
        if(failBackup)throw Error('backup failed');
        return JSON.stringify({ok:true,path:'C:/safe/rollback.trbackup',bytes:100});
      }
      if(cmd==='desktop_stage_native_image'){
        if(failStage)throw Error('stage failed');
        return JSON.stringify({ok:true,authority:false});
      }
      if(cmd==='desktop_verify_staged_images')return JSON.stringify({ok:true,stagedImages:1,authority:false});
      if(cmd==='desktop_finalize_native_image_staging')return JSON.stringify({ok:true,stagedImages:1,authority:false,backupPath:'C:/safe/rollback.trbackup'});
      if(cmd==='desktop_native_image_staging_status')return JSON.stringify({ok:true,complete:true,catalogRecords:1,objects:1,authority:false});
      if(cmd==='desktop_promote_native_image_authority'){
        if(failPromotion)throw Error('promote failed');
        active=true;generation=1;return JSON.stringify({ok:true,active:true,generation:1,images:1});
      }
      if(cmd==='desktop_native_image_authority_status')return JSON.stringify({ok:true,active,generation,catalogRecords:active?1:0,deepVerified:!!args?.deep});
      throw Error('unexpected '+cmd);
    }}}
  };
  ctx.globalThis=ctx;
  vm.runInContext(source,vm.createContext(ctx));
  return {ctx,calls,alerts,locks,get blocked(){return blocked;}};
}
{
  const t=harness();
  const done=await t.ctx.TradingResearchDesktopNativeImages.migrateNativeImages();
  assert.equal(done.ok,true);
  const names=t.calls.map(x=>x.cmd);
  assert(names.indexOf('desktop_write_backup')>=0);
  assert(names.indexOf('desktop_write_backup')<names.indexOf('desktop_stage_native_image'),'No native image bytes before rollback');
  assert(names.indexOf('desktop_stage_native_image')<names.indexOf('desktop_verify_staged_images'));
  assert(names.indexOf('desktop_verify_staged_images')<names.indexOf('desktop_finalize_native_image_staging'));
  assert(names.indexOf('desktop_finalize_native_image_staging')<names.indexOf('desktop_promote_native_image_authority'));
  assert(t.calls.some(x=>x.cmd==='desktop_native_image_authority_status'&&x.args.deep===true),'Promotion must deep-verify native objects');
  assert.equal(t.ctx.TradingResearchDesktopImageAuthority.active,true);
  assert(t.locks.some(x=>x[0]==='set')&&t.locks.some(x=>x[0]==='clear'),'Migration must freeze and release workspace writes');
  assert.equal(t.blocked,false);
}
{
  const t=harness({failStage:true});
  const done=await t.ctx.TradingResearchDesktopNativeImages.migrateNativeImages();
  assert.equal(done,null);
  assert(t.calls.some(x=>x.cmd==='desktop_write_backup'),'Failure path still requires physical rollback first');
  assert(!t.calls.some(x=>x.cmd==='desktop_promote_native_image_authority'),'Failed staging must never promote');
  assert(t.alerts.some(x=>x.includes('rollback.trbackup')),'Failure must surface preserved rollback path');
  assert.equal(t.ctx.TradingResearchDesktopImageAuthority.migrationPending,false);
}
{
  const t=harness({failBackup:true});
  await t.ctx.TradingResearchDesktopNativeImages.migrateNativeImages();
  assert(!t.calls.some(x=>x.cmd==='desktop_stage_native_image'),'No staging allowed when physical rollback fails');
  assert(!t.calls.some(x=>x.cmd==='desktop_promote_native_image_authority'));
}
{
  const t=harness({failPromotion:true});
  await t.ctx.TradingResearchDesktopNativeImages.migrateNativeImages();
  assert(!t.blocked,'Failure before native authority commit remains recoverable without fatalizing workspace');
  assert.equal(t.ctx.TradingResearchDesktopImageAuthority.active,false);
}
if(fs.existsSync('desktop-dist/index.html')){
  const html=fs.readFileSync('desktop-dist/index.html','utf8');
  assert(html.includes('data-tr-desktop-native-images="batch77-staging"'),'Desktop artifact missing native image runtime');
  assert(html.includes('trDesktopImageWriteFile(file,id)'),'Desktop app image writes not routed after promotion');
  assert(html.includes("trDesktopImageWriteTransaction(puts,deletes,'backup-v2.images')"),'Desktop Backup V2 image restore not routed');
  assert(html.includes('trDesktopImageGcDeleteLocalIds(targets)'),'Desktop GC not routed');
}
console.log('Batch 77 native image migration PASS: rollback-first staging, explicit promotion, deep readback, mutation freeze and native routing.');
