import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};
const runtimePath='cloud-v10-runtime.js';
const sqlPath='supabase/migrations/202609010001_v31_24_cloud_v10.sql';

need(fs.existsSync(runtimePath),'G2: falta cloud-v10-runtime.js; la escritura efectiva sigue siendo V9.2 multi-tabla.');
need(fs.existsSync(sqlPath),'G2: falta migración SQL versionada para apply_trading_workspace().');

if(fs.existsSync(runtimePath)){
  const r=fs.readFileSync(runtimePath,'utf8');
  need(r.includes("const TR_CLOUD_V10_VERSION='31.24.0'"),'Cloud V10 runtime no está versionado como V31.24.');
  need(r.includes("cloudClient.rpc('apply_trading_workspace'"),'Cloud V10 no usa RPC Postgres atómico.');
  need(!r.includes("cloudUpsertChunks('trading_"),'Cloud V10 conserva escrituras multi-tabla JS.');
  need(!r.includes('cloudAcquireRevisionLock('),'Cloud V10 sigue publicando la revisión antes del commit real.');
  const pushStart=r.indexOf('cloudPushState=async function');
  const pullStart=r.indexOf('cloudPullState=async function',pushStart);
  const push=pushStart>=0?r.slice(pushStart,pullStart>pushStart?pullStart:r.length):'';
  const upload=push.indexOf('cloudSyncImages(user)');
  const rpc=push.indexOf('trCloudV10ApplyWorkspaceRpc(');
  need(upload>=0&&rpc>upload,'Orden cloud inseguro: blobs requeridos deben subirse antes del commit DB.');
  need(r.includes('CLOUD_V10_RPC_REQUIRED'),'Falta fail-closed explícito cuando RPC/migración no está disponible.');
  need(r.includes('masterLibrary')&&!r.includes('__masterLibrary:clone(ensureMasterLibrary())'),
    'G4: Master Library no está representada una sola vez en el bundle cloud V10.');
  need(r.includes('delete clean.__masterLibrary')||r.includes("delete payload.__masterLibrary"),
    'G4: V10 no elimina la copia legacy __masterLibrary de cada plan.');
}
if(fs.existsSync(sqlPath)){
  const sql=fs.readFileSync(sqlPath,'utf8');
  need(/create\s+or\s+replace\s+function\s+public\.apply_trading_workspace/i.test(sql),'SQL no define apply_trading_workspace().');
  need(/auth\.uid\s*\(\s*\)/i.test(sql),'RPC no ata la escritura al usuario autenticado.');
  need(/for\s+update/i.test(sql),'RPC no bloquea la revisión actual antes del CAS.');
  for(const table of ['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'])
    need(sql.includes(table),`RPC no cubre ${table}.`);
  need(/master_library/i.test(sql),'G4: SQL no guarda Master Library una sola vez en workspace.');
  need(/CONFLICT_REVISION|conflict/i.test(sql),'RPC no expone conflicto CAS.');
  const workspaceWrite=Math.max(sql.lastIndexOf('insert into public.trading_workspace'),sql.lastIndexOf('update public.trading_workspace'));
  const childWrite=Math.max(...['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'].map(t=>sql.lastIndexOf(t)));
  need(workspaceWrite>childWrite,'La revisión/workspace debe publicarse después de aplicar las tablas hijas.');
}


if(fs.existsSync(runtimePath)){
  const runtime=fs.readFileSync(runtimePath,'utf8');
  function makeContext(rpcMode='success'){
    const events=[],writeFallbacks=[];
    const state={
      currentPlanId:'P1',
      masterLibrary:{schemaVersion:1,items:[{id:'LIB1',name:'Reusable'}]},
      tradingPlans:[{id:'P1',name:'Plan',__masterLibrary:{legacy:true}}],
      settings:{instruments:[{id:'I1'}]},
      operations:[{id:'O1'}],
      importBatches:[{id:'B1'}],
      opportunities:[{id:'Q1'}]
    };
    const cloudConfig={baseRemoteRevision:'R1',lastPush:'OLD',localDirty:true,localDirtyAt:'now',autoSync:false,syncedImageIds:[]};
    const chain={
      select(){return this;},eq(){return this;},
      async maybeSingle(){return {data:{user_id:'U1',updated_at:'R1',master_library:state.masterLibrary},error:null};},
      async upsert(){writeFallbacks.push('upsert');throw new Error('V9.2 write fallback used');},
      async insert(){writeFallbacks.push('insert');throw new Error('V9.2 write fallback used');},
      async update(){writeFallbacks.push('update');throw new Error('V9.2 write fallback used');},
      async delete(){writeFallbacks.push('delete');throw new Error('V9.2 write fallback used');}
    };
    const cloudClient={
      from(){return Object.create(chain);},
      async rpc(name,args){
        events.push('rpc');
        if(rpcMode==='missing')return {data:null,error:{code:'PGRST202',message:'Could not find function apply_trading_workspace in schema cache'}};
        if(rpcMode==='conflict')return {data:{ok:false,conflict:true,remote_revision:'R9'},error:null};
        if(rpcMode==='failure')return {data:null,error:{code:'XX000',message:'forced transaction failure'}};
        return {data:{ok:true,conflict:false,revision:'R2'},error:null};
      }
    };
    const ctx={
      console:{log(){},warn(){},error(){}},window:null,
      clone:x=>JSON.parse(JSON.stringify(x)),state,CLOUD_SCHEMA_VERSION:1,
      cloudClient,cloudConfig,cloudBusy:false,cloudAuthUser:{id:'U1'},currentView:'',configTab:'',
      ensureAllPlansV8(){},ensureMasterLibrary(){return state.masterLibrary;},
      planCloudRow:(p,u)=>({user_id:u,id:p.id,payload:{...p,__masterLibrary:{duplicated:true}}}),
      instrumentCloudRow:(x,u)=>({user_id:u,id:x.id,payload:x}),
      operationCloudRow:(x,u)=>({user_id:u,id:x.id,payload:x}),
      batchCloudRow:(x,u)=>({user_id:u,id:x.id,payload:x}),
      opportunityCloudRow:(x,u)=>({user_id:u,id:x.id,payload:x}),
      cloudLocalFingerprintPayload(){},cloudWorkspaceMeta(){},cloudRemoteBundle(){},cloudRemoteFingerprintPayload(){},
      cloudPushState(){},cloudPullState(){},cloudConfigPanel:()=>'<span>V9.2 Conflict Guard</span>',
      cloudRequireUser:async()=>({id:'U1'}),
      cloudTryBootstrapRevision:async()=>({ok:true}),
      cloudLocalInventory:()=>({plans:['P1'],instruments:['I1'],operations:['O1'],batches:['B1'],opportunities:['Q1']}),
      cloudRemoteInventory:async()=>({plans:['P1'],instruments:['I1'],operations:['O1'],batches:['B1'],opportunities:['Q1']}),
      cloudDiffInventory:()=>({deleteCount:0}),cloudCounts:x=>({plans:x.plans.length,operations:x.operations.length,batches:x.batches.length,instruments:x.instruments.length}),
      saveCloudSafetySnapshot(){},cloudSyncImages:async()=>{events.push('upload');return 1;},
      cloudSetStatus(){},cloudSetConflict(){},cloudClearConflict(){cloudConfig.conflict=null;},
      saveCloudConfigLocal(){},cloudShortRevision:x=>String(x),render(){},prompt:()=>'',confirm:()=>true,alert(){},
      cloudFetchRows:async()=>[],normalizeState:x=>x,trCorePersistNow:async()=>true
    };
    ctx.TradingResearchActions={};ctx.window=ctx;
    vm.createContext(ctx);
    let instrumented=runtime.replace(
      'window.TradingResearchCloudV10=Object.freeze({',
      'window.__trCloudV10Test={build:trCloudV10BuildBundle,apply:trCloudV10ApplyWorkspaceRpc,clean:trCloudV10CleanPlanPayload};\nwindow.TradingResearchCloudV10=Object.freeze({'
    );
    vm.runInContext(instrumented,ctx);
    return {ctx,events,writeFallbacks};
  }

  try{
    const {ctx}=makeContext('success');
    const bundle=ctx.__trCloudV10Test.build({id:'U1'});
    need(bundle.masterLibrary?.items?.[0]?.id==='LIB1','G4: bundle V10 perdió la Master Library única.');
    need(!JSON.stringify(bundle.plans).includes('__masterLibrary'),'G4: un plan V10 todavía transporta __masterLibrary.');
  }catch(e){fail.push('Cloud V10 bundle fixture: '+e.message);}

  for(const mode of ['missing','failure','conflict','success']){
    try{
      const {ctx,events,writeFallbacks}=makeContext(mode);
      await ctx.cloudPushState({silent:true});
      need(events[0]==='upload'&&events[1]==='rpc',`Cloud V10 ${mode}: orden esperado upload → rpc, obtenido ${events.join(' → ')}`);
      need(writeFallbacks.length===0,`Cloud V10 ${mode}: apareció fallback de escritura V9.2: ${writeFallbacks.join(',')}`);
      if(mode==='success'){
        need(ctx.cloudConfig.baseRemoteRevision==='R2','Cloud V10 success: la revisión confirmada no avanzó a R2.');
        need(ctx.cloudConfig.lastPush!=='OLD','Cloud V10 success: lastPush no avanzó tras commit.');
      }else{
        need(ctx.cloudConfig.baseRemoteRevision==='R1',`Cloud V10 ${mode}: la revisión local avanzó sin commit real.`);
        need(ctx.cloudConfig.lastPush==='OLD',`Cloud V10 ${mode}: lastPush avanzó sin commit real.`);
      }
    }catch(e){fail.push(`Cloud V10 fault fixture ${mode}: ${e.message}`);}
  }
}

const effectiveV92=app.slice(app.lastIndexOf('cloudPushState=async function'),app.indexOf('\n\ncloudPullState=async function',app.lastIndexOf('cloudPushState=async function')));
need(effectiveV92.includes('cloudAcquireRevisionLock(')&&effectiveV92.includes("cloudUpsertChunks('trading_operations'"),
  'Fixture histórico G2 cambió: revisar red gate antes de continuar.');
need(app.includes("row.payload={...clone(row.payload),__masterLibrary:clone(ensureMasterLibrary())}"),
  'Fixture histórico G4 cambió: revisar red gate de duplicación Master Library.');

if(fail.length){
  console.error('Supabase V10 atomic workspace verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Supabase V10 atomic workspace verification OK');
console.log(' - one RPC owns CAS + all relational writes');
console.log(' - revision advances only after transaction success');
console.log(' - required image uploads precede DB commit; Storage GC follows commit');
console.log(' - Master Library has one cloud representation');
console.log(' - RPC unavailable => fail closed, no V9.2 write fallback');
