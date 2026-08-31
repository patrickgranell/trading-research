import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const startToken="const STORAGE_KEY = 'tradingResearchState_v4';";
const endToken='/* ===== END V31.11 CORE ===== */';
const start=app.indexOf(startToken);
const end=start<0?-1:app.indexOf(endToken,start);
if(start<0||end<0){
  console.error('Storage authority verification FAILED');
  console.error(' - No se pudo aislar el bootstrap V31.11 en app.js.');
  process.exit(1);
}
const core=app.slice(start,end+endToken.length);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const workspace=sentinel=>({
  sentinel,
  operations:[],
  opportunities:[],
  importBatches:[],
  settings:{instruments:[]},
  tradingPlans:[{id:'TP_TEST'}],
  currentPlanId:'TP_TEST'
});

async function runBootstrapCase({
  marker=false,
  existing=null,
  legacy=null,
  initial=workspace('boot-state'),
  pending=null,
  openError=''
}={}){
  const local=new Map();
  if(marker)local.set('tradingResearchIndexedDbState_v1',JSON.stringify({migratedAt:'test'}));
  if(legacy)local.set('tradingResearchState_v4',JSON.stringify(legacy));
  const writes=[];
  const snapshots=[];
  const document={
    documentElement:{classList:{add(){},remove(){}}},
    body:{appendChild(){}},
    createElement(){return {id:'',className:'',textContent:''};},
    getElementById(){return null;}
  };
  const context={
    console:{log(){},warn(){},error(){}},
    document,
    localStorage:{
      getItem:key=>local.has(key)?local.get(key):null,
      setItem:(key,value)=>{local.set(key,String(value));},
      removeItem:key=>{local.delete(key);}
    },
    indexedDB:{},
    state:clone(initial),
    clone,
    normalizeState:clone,
    ensureAllPlansV8(){},
    ensureMasterLibrary(){},
    uid:prefix=>prefix+'-TEST',
    setTimeout(){},
    alert(){},
    addEventListener(){},
    render:undefined,
    __existing:clone(existing),
    __pending:clone(pending),
    __openError:String(openError||''),
    __writes:writes,
    __snapshots:snapshots
  };
  vm.createContext(context);
  vm.runInContext(core,context,{filename:'app.js#storage-core'});
  vm.runInContext(`
    trCorePendingState=__pending;
    trCoreOpenDb=async()=>{if(__openError)throw new Error(__openError);return {};};
    trCoreGet=async(store,id)=>store===TR_CORE_STATE_STORE&&id===TR_CORE_STATE_ID?__existing:null;
    trCoreGetAll=async()=>[];
    trCoreReplaceSnapshots=async items=>{__snapshots.push(clone(items));return true;};
    trCorePersistNow=async reason=>{__writes.push({reason,state:clone(state)});return true;};
  `,context,{filename:'storage-authority-harness'});
  await vm.runInContext('trCoreBootstrap()',context);
  const status=vm.runInContext('({mode:trCoreMode,hydrated:trCoreHydrated,fatal:trCoreFatal,lastError:trCoreLastError})',context);
  return {
    state:clone(context.state),
    writes:clone(writes),
    snapshots:clone(snapshots),
    marker:local.get('tradingResearchIndexedDbState_v1')||'',
    legacy:local.get('tradingResearchState_v4')||'',
    ...status
  };
}

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(core.includes('function trCoreIsValidWorkspacePayload(payload)'),
  'Falta validación explícita del workspace durable.');
need(core.includes('const hasDurableWorkspace=trCoreIsValidWorkspacePayload(existing?.payload);'),
  'El bootstrap no usa la validación al decidir autoridad de IndexedDB.');

const withMarker=await runBootstrapCase({
  marker:true,
  existing:{id:'workspace',payload:workspace('indexeddb-with-marker')},
  initial:workspace('boot-ignored')
});
need(withMarker.state?.sentinel==='indexeddb-with-marker',
  '1. IndexedDB + marker: IndexedDB no conservó autoridad.');
need(withMarker.mode==='indexeddb'&&!withMarker.fatal,
  '1. IndexedDB + marker: bootstrap no terminó en modo indexeddb.');

const missingMarker=await runBootstrapCase({
  marker:false,
  existing:{id:'workspace',payload:workspace('indexeddb-without-marker')},
  initial:workspace('boot-must-not-win')
});
need(missingMarker.state?.sentinel==='indexeddb-without-marker',
  '2. IndexedDB sin marker: D01, existing.payload fue ignorado.');
need(missingMarker.writes?.[0]?.state?.sentinel==='indexeddb-without-marker',
  '2. IndexedDB sin marker: se intentó persistir otro workspace sobre el durable.');
need(missingMarker.writes?.[0]?.reason==='bootstrap-recovered-marker',
  '2. IndexedDB sin marker: falta razón explícita de recuperación del marker.');
need(!!missingMarker.marker,
  '2. IndexedDB sin marker: no se regeneró el marker tras confirmar el workspace.');

const legacyWorkspace=workspace('legacy-migration');
const legacyOnly=await runBootstrapCase({
  marker:false,
  existing:null,
  legacy:legacyWorkspace,
  initial:legacyWorkspace
});
need(legacyOnly.state?.sentinel==='legacy-migration',
  '3. Legacy localStorage sin IndexedDB: no se migró el workspace legacy.');
need(legacyOnly.mode==='indexeddb'&&!!legacyOnly.marker&&!legacyOnly.legacy,
  '3. Legacy localStorage sin IndexedDB: migración/marker/cleanup incompletos.');

const orphanMarker=await runBootstrapCase({
  marker:true,
  existing:null,
  legacy:null,
  initial:workspace('boot-must-not-overwrite')
});
need(orphanMarker.fatal&&orphanMarker.mode==='fatal'&&!orphanMarker.hydrated,
  '4. Marker huérfano sin IndexedDB: debe fallar cerrado, no inventar un workspace.');
need(orphanMarker.writes.length===0,
  '4. Marker huérfano sin IndexedDB: no debe escribir un estado de arranque sobre almacenamiento durable.');

const corruptWithLegacy=await runBootstrapCase({
  marker:true,
  existing:{id:'workspace',payload:{corrupt:true}},
  legacy:workspace('legacy-recovery'),
  initial:workspace('boot-ignored')
});
need(corruptWithLegacy.state?.sentinel==='legacy-recovery',
  '5. IndexedDB inválido: un payload corrupto obtuvo autoridad sobre un legacy válido.');
need(corruptWithLegacy.mode==='indexeddb'&&!corruptWithLegacy.fatal,
  '5. IndexedDB inválido + legacy válido: no se completó la recuperación conservadora.');

const openFailure=await runBootstrapCase({
  marker:false,
  existing:null,
  legacy:workspace('legacy-fallback'),
  initial:workspace('boot-ignored'),
  openError:'IndexedDB unavailable'
});
need(openFailure.state?.sentinel==='legacy-fallback',
  '6. Fallo al abrir IndexedDB: no se conservó el legacy disponible.');
need(openFailure.mode==='localStorage-fallback'&&openFailure.hydrated&&!openFailure.fatal,
  '6. Fallo al abrir IndexedDB: fallback no quedó operativo.');
need(!!openFailure.legacy&&!openFailure.marker&&openFailure.writes.length===0,
  '6. Fallo al abrir IndexedDB: el fallback no debe borrar legacy, crear marker ni fingir escritura durable.');

if(fail.length){
  console.error('Storage authority verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Storage authority verification OK');
console.log(' - 1/6 IndexedDB + marker: durable workspace wins');
console.log(' - 2/6 IndexedDB without marker: durable workspace wins; marker repaired');
console.log(' - 3/6 legacy localStorage without IndexedDB: migrates to IndexedDB');
console.log(' - 4/6 orphan marker without IndexedDB: fail closed');
console.log(' - 5/6 corrupt IndexedDB payload: rejected; valid legacy recovery allowed');
console.log(' - 6/6 IndexedDB open failure: legacy fallback preserved');
