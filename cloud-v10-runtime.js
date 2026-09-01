(()=>{
'use strict';

const TR_CLOUD_V10_VERSION='31.24.0';
const TR_CLOUD_V10_APP_VERSION='10.0.0';
const TR_CLOUD_V10_RPC='apply_trading_workspace';
const CLOUD_V10_RPC_REQUIRED='CLOUD_V10_RPC_REQUIRED';

let trCloudV10RpcCalls=0;
let trCloudV10RpcFailures=0;
let trCloudV10Conflicts=0;
let trCloudV10LastRevision='';
let trCloudV10LastError='';

function trCloudV10CleanPlanPayload(value){
  const payload=typeof clone==='function'?clone(value||{}):JSON.parse(JSON.stringify(value||{}));
  delete payload.__masterLibrary;
  return payload;
}
function trCloudV10LegacyMasterLibrary(plans){
  for(const row of plans||[]){
    const lib=row?.payload?.__masterLibrary;
    if(lib)return typeof clone==='function'?clone(lib):JSON.parse(JSON.stringify(lib));
  }
  return null;
}
function trCloudV10MasterLibraryFromBundle(bundle){
  const current=bundle?.ws?.master_library;
  if(current)return typeof clone==='function'?clone(current):JSON.parse(JSON.stringify(current));
  return trCloudV10LegacyMasterLibrary(bundle?.plans||[]);
}
function trCloudV10BuildBundle(user){
  ensureAllPlansV8();
  const masterLibrary=typeof ensureMasterLibrary==='function'?ensureMasterLibrary():(state.masterLibrary||{schemaVersion:1,items:[]});
  return {
    currentPlanId:state.currentPlanId||'',
    appVersion:TR_CLOUD_V10_APP_VERSION,
    schemaVersion:CLOUD_SCHEMA_VERSION,
    masterLibrary:typeof clone==='function'?clone(masterLibrary):JSON.parse(JSON.stringify(masterLibrary)),
    plans:(state.tradingPlans||[]).map(p=>planCloudRow(p,user.id)),
    instruments:(state.settings?.instruments||[]).map(i=>instrumentCloudRow(i,user.id)),
    operations:(state.operations||[]).map(o=>operationCloudRow(o,user.id)),
    batches:(state.importBatches||[]).map(b=>batchCloudRow(b,user.id)),
    opportunities:(state.opportunities||[]).map(o=>opportunityCloudRow(o,user.id))
  };
}
function trCloudV10RpcUnavailable(error){
  const text=String(error?.message||error||'').toLowerCase();
  return error?.code==='PGRST202'||error?.code==='42883'||text.includes('apply_trading_workspace')&&(text.includes('schema cache')||text.includes('does not exist')||text.includes('not found'));
}
async function trCloudV10ApplyWorkspaceRpc(user,expectedRevision,bundle){
  trCloudV10RpcCalls++;
  const {data,error}=await cloudClient.rpc('apply_trading_workspace',{
    p_expected_revision:expectedRevision||'',
    p_bundle:bundle
  });
  if(error){
    trCloudV10RpcFailures++;
    const e=new Error(trCloudV10RpcUnavailable(error)
      ? CLOUD_V10_RPC_REQUIRED+': aplica la migración Supabase V31.24 antes de sincronizar.'
      : 'Supabase V10 RPC: '+(error.message||error));
    e.code=trCloudV10RpcUnavailable(error)?CLOUD_V10_RPC_REQUIRED:(error.code||'RPC_ERROR');
    e.cause=error;
    throw e;
  }
  const result=Array.isArray(data)?data[0]:data;
  if(!result?.ok){
    if(result?.conflict){
      trCloudV10Conflicts++;
      const e=new Error('CONFLICT_REVISION');
      e.remoteRevision=result.remote_revision||result.remoteRevision||'';
      throw e;
    }
    trCloudV10RpcFailures++;
    throw new Error('Supabase V10 RPC devolvió una respuesta inválida.');
  }
  trCloudV10LastRevision=result.revision||'';
  return result;
}

const trCloudV10PlanCloudRowBase=planCloudRow;
planCloudRow=function(p,userId){
  const row=trCloudV10PlanCloudRowBase(p,userId);
  row.payload=trCloudV10CleanPlanPayload(row.payload||p);
  return row;
};

cloudLocalFingerprintPayload=function(){
  ensureAllPlansV8();
  const byId=a=>(typeof clone==='function'?clone(a||[]):JSON.parse(JSON.stringify(a||[]))).sort((x,y)=>String(x?.id||'').localeCompare(String(y?.id||'')));
  const plans=byId(state.tradingPlans).map(trCloudV10CleanPlanPayload);
  const masterLibrary=typeof ensureMasterLibrary==='function'?ensureMasterLibrary():(state.masterLibrary||{schemaVersion:1,items:[]});
  return {
    currentPlanId:state.currentPlanId||'',
    masterLibrary:typeof clone==='function'?clone(masterLibrary):JSON.parse(JSON.stringify(masterLibrary)),
    plans,
    instruments:byId(state.settings?.instruments),
    operations:byId(state.operations),
    batches:byId(state.importBatches),
    opportunities:byId(state.opportunities)
  };
};

cloudWorkspaceMeta=async function(userId){
  const {data,error}=await cloudClient.from('trading_workspace')
    .select('user_id,current_plan_id,app_version,schema_version,updated_at,master_library')
    .eq('user_id',userId).maybeSingle();
  if(error){
    if(String(error.message||'').toLowerCase().includes('master_library')){
      const e=new Error(CLOUD_V10_RPC_REQUIRED+': falta la migración de master_library en trading_workspace.');
      e.code=CLOUD_V10_RPC_REQUIRED;throw e;
    }
    throw new Error('trading_workspace: '+error.message);
  }
  return data||null;
};

cloudRemoteBundle=async function(userId){
  const ws=await cloudWorkspaceMeta(userId);
  if(!ws)return {ws:null,plans:[],inst:[],ops:[],batches:[],opps:[]};
  const [plans,inst,ops,batches,opps]=await Promise.all(
    ['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'].map(t=>cloudFetchRows(t,userId))
  );
  return {ws,plans,inst,ops,batches,opps};
};

cloudRemoteFingerprintPayload=function(bundle){
  const byPayload=a=>(a||[]).slice()
    .sort((x,y)=>String(x?.id||'').localeCompare(String(y?.id||'')))
    .map(x=>trCloudV10CleanPlanPayload(x.payload));
  const byPlain=a=>(a||[]).slice()
    .sort((x,y)=>String(x?.id||'').localeCompare(String(y?.id||'')))
    .map(x=>typeof clone==='function'?clone(x.payload):JSON.parse(JSON.stringify(x.payload)));
  return {
    currentPlanId:bundle.ws?.current_plan_id||'',
    masterLibrary:trCloudV10MasterLibraryFromBundle(bundle)||{schemaVersion:1,items:[]},
    plans:byPayload(bundle.plans),
    instruments:byPlain(bundle.inst),
    operations:byPlain(bundle.ops),
    batches:byPlain(bundle.batches),
    opportunities:byPlain(bundle.opps)
  };
};

cloudPushState=async function(options={}){
  if(cloudBusy)return;
  cloudBusy=true;
  cloudSetStatus('V10 · comprobando revisión y transacción atómica…','busy');
  if(!options.silent)render();
  try{
    const user=await cloudRequireUser();
    ensureAllPlansV8();
    if(typeof ensureMasterLibrary==='function')ensureMasterLibrary();

    let meta=await cloudWorkspaceMeta(user.id),forceExpected='';
    if(meta&&!cloudConfig.baseRemoteRevision){
      const boot=await cloudTryBootstrapRevision(user);
      if(!boot.ok){
        cloudSetConflict(meta.updated_at,'baseline-mismatch');
        if(options.silent){
          cloudSetStatus('Auto-sync V10 bloqueado: este dispositivo no comparte la revisión remota','error');
          return;
        }
        const typed=prompt(
          'CONFLICT GUARD V10\n\nEste dispositivo no tiene una revisión base compatible con Supabase.\n\n'+
          'Recomendado: cancelar y usar Cargar Supabase → este dispositivo.\n\n'+
          'Para hacer prevalecer deliberadamente ESTE dispositivo escribe exactamente:\nRESOLVER CON LOCAL',''
        );
        if(typed!=='RESOLVER CON LOCAL'){cloudSetStatus('Subida cancelada por Conflict Guard','idle');return;}
        saveCloudSafetySnapshot('before-conflict-force-push');
        forceExpected=meta.updated_at;
      }
    }

    meta=await cloudWorkspaceMeta(user.id);
    if(meta&&cloudConfig.baseRemoteRevision&&meta.updated_at!==cloudConfig.baseRemoteRevision&&!forceExpected){
      cloudSetConflict(meta.updated_at,'remote-changed');
      if(options.silent){
        cloudSetStatus('Auto-sync V10 bloqueado: Supabase cambió desde la última revisión','error');
        return;
      }
      const typed=prompt(
        'CONFLICT GUARD V10\n\nLa nube cambió desde la última sincronización de este dispositivo.\n\n'+
        'Base: '+cloudShortRevision(cloudConfig.baseRemoteRevision)+'\n'+
        'Nube: '+cloudShortRevision(meta.updated_at)+'\n\n'+
        'Para hacer prevalecer deliberadamente ESTE dispositivo escribe:\nRESOLVER CON LOCAL',''
      );
      if(typed!=='RESOLVER CON LOCAL'){cloudSetStatus('Subida cancelada: conflicto remoto pendiente','error');return;}
      saveCloudSafetySnapshot('before-conflict-force-push');
      forceExpected=meta.updated_at;
    }

    const localInv=cloudLocalInventory();
    const remoteInv=await cloudRemoteInventory(user.id);
    const diff=cloudDiffInventory(localInv,remoteInv);
    const lc=cloudCounts(localInv),rc=cloudCounts(remoteInv);
    if(diff.deleteCount>0){
      if(options.silent){
        cloudConfig.autoSync=false;saveCloudConfigLocal();
        cloudSetStatus('Auto-sync V10 bloqueado: la subida borraría '+diff.deleteCount+' registro(s) remotos','error',{
          plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments,revision:meta?.updated_at||''
        });
        return;
      }
      const typed=prompt(
        'PROTECCIÓN DE DATOS V10\n\nLocal: '+lc.plans+' planes · '+lc.operations+' operaciones\n'+
        'Nube: '+rc.plans+' planes · '+rc.operations+' operaciones\n\n'+
        'Esta subida eliminaría '+diff.deleteCount+' registro(s) remotos.\n\n'+
        'Para continuar deliberadamente escribe exactamente:\nSOBRESCRIBIR NUBE',''
      );
      if(typed!=='SOBRESCRIBIR NUBE'){cloudSetStatus('Subida cancelada por protección de datos','idle');return;}
    }

    saveCloudSafetySnapshot('before-cloud-push');

    // Storage is intentionally pre-commit: a later RPC failure may leave recoverable
    // garbage, but can never publish metadata pointing at a blob that was never uploaded.
    const uploaded=await cloudSyncImages(user);
    const bundle=trCloudV10BuildBundle(user);
    const expected=forceExpected||cloudConfig.baseRemoteRevision||'';

    let result;
    try{result=await trCloudV10ApplyWorkspaceRpc(user,expected,bundle);}
    catch(e){
      if(e.message==='CONFLICT_REVISION'){
        cloudSetConflict(e.remoteRevision,'race-conflict');
        cloudSetStatus('Conflicto V10: otro dispositivo ganó la revisión; ninguna tabla se publicó parcialmente','error');
        return;
      }
      throw e;
    }

    cloudConfig.baseRemoteRevision=result.revision||'';
    cloudConfig.lastPush=new Date().toISOString();
    cloudConfig.localDirty=false;
    cloudConfig.localDirtyAt='';
    cloudClearConflict();
    saveCloudConfigLocal();
    cloudSetStatus('Sincronizado V10 atómico · '+bundle.operations.length+' operaciones · '+uploaded+' imagen(es) nuevas','ok',{
      plans:bundle.plans.length,
      operations:bundle.operations.length,
      batches:bundle.batches.length,
      instruments:bundle.instruments.length,
      revision:cloudConfig.baseRemoteRevision
    });
  }catch(e){
    trCloudV10LastError=e?.message||String(e);
    cloudSetStatus('Error V10: '+trCloudV10LastError,'error');
    if(!options.silent)alert(
      e?.code===CLOUD_V10_RPC_REQUIRED
        ? 'Supabase V10 todavía no está preparado en el proyecto remoto.\n\nAplica la migración SQL V31.24 antes de sincronizar. No se ha usado el fallback V9.2.'
        : 'No se pudo sincronizar con Supabase V10:\n'+trCloudV10LastError
    );
  }finally{
    cloudBusy=false;
    if(!options.silent&&currentView==='config'&&configTab==='cloud')render();
  }
};

cloudPullState=async function(){
  if(cloudBusy)return;
  cloudBusy=true;
  cloudSetStatus('V10 · verificando revisión antes de descargar…','busy');
  render();
  try{
    const user=await cloudRequireUser();
    const bundle=await cloudRemoteBundle(user.id),ws=bundle.ws;
    if(!ws)throw new Error('Todavía no hay un workspace guardado en Supabase.');
    const {plans,inst,ops,batches,opps}=bundle;
    const remoteInv={
      plans:plans.map(x=>x.id),instruments:inst.map(x=>x.id),operations:ops.map(x=>x.id),
      batches:batches.map(x=>x.id),opportunities:opps.map(x=>x.id)
    };
    const localInv=cloudLocalInventory(),diff=cloudDiffInventory(remoteInv,localInv),lc=cloudCounts(localInv),rc=cloudCounts(remoteInv);
    const remoteChanged=!!cloudConfig.baseRemoteRevision&&ws.updated_at!==cloudConfig.baseRemoteRevision;
    if(diff.deleteCount>0||cloudConfig.localDirty){
      const typed=prompt(
        'CONFLICT GUARD V10\n\nLocal: '+lc.plans+' planes · '+lc.operations+' operaciones\n'+
        'Nube: '+rc.plans+' planes · '+rc.operations+' operaciones\n'+
        'Cambio remoto desde tu base: '+(remoteChanged?'SÍ':'No')+'\n'+
        'Cambios locales pendientes: '+(cloudConfig.localDirty?'SÍ':'No')+'\n\n'+
        'La descarga descartará el estado local actual; se creará antes un snapshot.\n\n'+
        'Para continuar escribe exactamente:\nREEMPLAZAR LOCAL',''
      );
      if(typed!=='REEMPLAZAR LOCAL'){
        cloudSetStatus('Descarga cancelada por Conflict Guard','idle',{
          plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments,revision:ws.updated_at
        });
        return;
      }
    }else if(!confirm(
      'Supabase contiene '+plans.length+' plan(es) y '+ops.length+' operación(es).\n\n'+
      'Se cargará la revisión '+cloudShortRevision(ws.updated_at)+' en este dispositivo. ¿Continuar?'
    )){
      cloudSetStatus('Descarga cancelada','idle');return;
    }

    saveCloudSafetySnapshot('before-cloud-pull');
    const incoming={
      operations:ops.map(x=>x.payload),
      opportunities:opps.map(x=>x.payload),
      importBatches:batches.map(x=>x.payload),
      settings:{instruments:inst.map(x=>x.payload)},
      tradingPlans:plans.map(x=>trCloudV10CleanPlanPayload(x.payload)),
      masterLibrary:trCloudV10MasterLibraryFromBundle(bundle)||{schemaVersion:1,items:[]},
      currentPlanId:ws.current_plan_id||plans[0]?.id||''
    };
    state=normalizeState(incoming);
    ensureAllPlansV8();
    if(typeof ensureMasterLibrary==='function')ensureMasterLibrary();
    cloudSuppressAutoSync=true;
    const localSaved=await trCorePersistNow('cloud-pull-v10');
    cloudSuppressAutoSync=false;
    if(!localSaved)throw new Error('La descarga V10 llegó a memoria, pero no pudo guardarse de forma durable.');

    cloudConfig.lastPull=new Date().toISOString();
    cloudConfig.baseRemoteRevision=ws.updated_at||'';
    cloudConfig.localDirty=false;
    cloudConfig.localDirtyAt='';
    cloudClearConflict();
    saveCloudConfigLocal();
    cloudSetStatus('Datos cargados V10 · '+state.operations.length+' operaciones','ok',{
      plans:state.tradingPlans.length,
      operations:state.operations.length,
      batches:state.importBatches.length,
      instruments:state.settings.instruments.length,
      revision:ws.updated_at
    });
    currentView='dashboard';render();
  }catch(e){
    trCloudV10LastError=e?.message||String(e);
    cloudSetStatus('Error V10 al cargar: '+trCloudV10LastError,'error');
    alert(
      e?.code===CLOUD_V10_RPC_REQUIRED
        ? 'La estructura cloud V10 no está instalada todavía. Aplica la migración SQL V31.24.'
        : 'No se pudo cargar desde Supabase V10:\n'+trCloudV10LastError
    );
  }finally{
    cloudBusy=false;
  }
};

const trCloudV10PanelBase=cloudConfigPanel;
cloudConfigPanel=function(){
  let html=trCloudV10PanelBase();
  html=html.replace('V9.2 Conflict Guard','V10 Atomic RPC');
  html=html.replace('V9.2 comprobará una revisión remota antes de cada subida.','V10 comprobará una revisión remota y publicará el workspace mediante una única transacción Postgres.');
  const note='<div class="notice"><strong>Cloud V10:</strong> CAS + planes + contratos + operaciones + lotes + oportunidades + Biblioteca Maestra se publican en una única transacción Postgres. La migración SQL V31.24 debe estar instalada; si falta, la subida se bloquea sin volver a V9.2.</div>';
  if(!html.includes('Cloud V10:</strong>'))html=html.replace('<section class="card panel config-wide"><div class="panel-title"><div><h3>Qué se guarda</h3>',note+'<section class="card panel config-wide"><div class="panel-title"><div><h3>Qué se guarda</h3>');
  return html;
};

const registry=window.TradingResearchActions;
if(registry&&typeof registry==='object'){
  registry.cloudPushState=cloudPushState;
  registry.cloudPullState=cloudPullState;
}

window.TradingResearchCloudV10=Object.freeze({
  version:TR_CLOUD_V10_VERSION,
  rpc:TR_CLOUD_V10_RPC,
  diagnostics:()=>({
    version:TR_CLOUD_V10_VERSION,
    rpcCalls:trCloudV10RpcCalls,
    rpcFailures:trCloudV10RpcFailures,
    conflicts:trCloudV10Conflicts,
    lastRevision:trCloudV10LastRevision,
    lastError:trCloudV10LastError,
    writeFallbackV92:false,
    masterLibraryRepresentation:'trading_workspace.master_library',
    policy:'upload blobs -> atomic RPC -> publish revision -> blob GC'
  })
});
})();
