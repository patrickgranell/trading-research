import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('desktop-native-images-runtime.js','utf8');
assert(source.includes("label:'desktop-image-stage-rollback'"),'Physical rollback must precede staging');
assert(source.includes("desktop_finalize_native_image_staging"),'Final staging binding missing');
assert(source.includes("authority!==false"),'Staging must remain explicitly non-authoritative');

function harness({failStage=false,failBackup=false}={}){
  const calls=[],alerts=[];
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
    trCoreFlush:async()=>true,
    trBackupV2BuildPayload:async()=>({format:'tr',workspace:{tradingPlans:[]},images:[image],marketData:{},manifest:{counts:{images:1}}}),
    trBackupV2Preflight:async raw=>raw,
    __TAURI__:{core:{invoke:async(cmd,args)=>{
      calls.push({cmd,args});
      if(cmd==='desktop_write_backup'){
        if(failBackup)throw Error('backup failed');
        return JSON.stringify({ok:true,path:'C:/safe/rollback.trbackup'});
      }
      if(cmd==='desktop_stage_native_image'){
        if(failStage)throw Error('stage failed');
        return JSON.stringify({ok:true,authority:false});
      }
      if(cmd==='desktop_verify_staged_images')return JSON.stringify({ok:true,stagedImages:1,authority:false});
      if(cmd==='desktop_finalize_native_image_staging')return JSON.stringify({ok:true,stagedImages:1,authority:false});
      if(cmd==='desktop_native_image_staging_status')return JSON.stringify({ok:true,complete:true,catalogRecords:1,objects:1,authority:false});
      throw Error('unexpected '+cmd);
    }}}
  };
  ctx.globalThis=ctx;
  vm.runInContext(source,vm.createContext(ctx));
  return {ctx,calls,alerts};
}
{
  const t=harness();
  const done=await t.ctx.TradingResearchDesktopNativeImages.stageReferencedImages();
  assert.equal(done.ok,true);
  const names=t.calls.map(x=>x.cmd);
  assert(names.indexOf('desktop_write_backup')>=0);
  assert(names.indexOf('desktop_write_backup')<names.indexOf('desktop_stage_native_image'),'No native image bytes before rollback');
  assert(names.indexOf('desktop_stage_native_image')<names.indexOf('desktop_verify_staged_images'));
  assert(names.indexOf('desktop_verify_staged_images')<names.indexOf('desktop_finalize_native_image_staging'));
  assert.equal(t.calls.find(x=>x.cmd==='desktop_finalize_native_image_staging').args.rollbackPath,'C:/safe/rollback.trbackup');
}
{
  const t=harness({failStage:true});
  const done=await t.ctx.TradingResearchDesktopNativeImages.stageReferencedImages();
  assert.equal(done,null);
  assert(t.calls.some(x=>x.cmd==='desktop_write_backup'),'Failure path still requires physical rollback first');
  assert(!t.calls.some(x=>x.cmd==='desktop_finalize_native_image_staging'),'Failed staging must never finalize');
  assert(t.alerts.some(x=>x.includes('rollback.trbackup')),'Failure must surface preserved rollback path');
}
{
  const t=harness({failBackup:true});
  await t.ctx.TradingResearchDesktopNativeImages.stageReferencedImages();
  assert(!t.calls.some(x=>x.cmd==='desktop_stage_native_image'),'No staging allowed when physical rollback fails');
}
if(fs.existsSync('desktop-dist/index.html')){
  const html=fs.readFileSync('desktop-dist/index.html','utf8');
  assert(html.includes('data-tr-desktop-native-images="batch77-staging"'),'Desktop artifact missing staging runtime');
}
console.log('Batch 77 native image staging behavior PASS: rollback-first, verify/finalize order, fail-closed; authority remains IndexedDB.');
