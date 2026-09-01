/* ===== V31.24 BLOB LIFECYCLE RUNTIME · D07/D08/D15 ===== */
const TR_BLOB_LIFECYCLE_VERSION='31.24.0';

function trBlobGcManualWorkspaceIds(workspace){
  const ids=new Set(),add=x=>{if(x?.id)ids.add(String(x.id));},addList=list=>(list||[]).forEach(add);
  for(const op of workspace?.operations||[])addList(op?.images);
  for(const plan of workspace?.tradingPlans||[]){
    /* Current-plan and other-plan reachability includes visualReferences + taxonomy definitions. */
    for(const ref of plan?.visualReferences||[])addList(ref?.images);
    for(const def of plan?.setupDefinitions||[]){addList(def?.imagesLong);addList(def?.imagesShort);}
    for(const def of plan?.vdDefinitions||[])addList(def?.images);
    for(const def of plan?.contextDefinitions||[])addList(def?.images);
  }
  /* Master Library is a first-class GC root. */
  for(const item of workspace?.masterLibrary?.items||[]){
    const payload=item?.payload||{};
    if(item?.type==='setup'){addList(payload.imagesLong);addList(payload.imagesShort);}
    else if(item?.type==='vd'||item?.type==='context')addList(payload.images);
  }
  return ids;
}
function trBlobGcWorkspaceIds(workspace){
  if(typeof trBackupV2CollectReferencedImageIds==='function')return new Set(trBackupV2CollectReferencedImageIds(workspace));
  return trBlobGcManualWorkspaceIds(workspace);
}
function trBlobGcReachableIdsFromRoots(workspace,snapshots=[]){
  const ids=trBlobGcWorkspaceIds(workspace);
  for(const snap of snapshots||[]){
    const root=snap?.state||snap?.workspace||snap?.targetWorkspace||null;
    if(!root)continue;for(const id of trBlobGcWorkspaceIds(root))ids.add(id);
  }
  return ids;
}
function trBlobGcCloudSweepPlan(objectIds,reachable){
  const keepIds=[],removeIds=[],roots=reachable instanceof Set?reachable:new Set(reachable||[]);
  for(const id of [...new Set((objectIds||[]).filter(Boolean).map(String))].sort()){
    if(roots.has(id))keepIds.push(id);else removeIds.push(id);
  }
  return {keepIds,removeIds};
}
async function trBlobGcDurableMutation(label,adapters){
  const before=await adapters.snapshot();
  try{
    await adapters.mutate();
    await adapters.persist();
    const flushed=await adapters.flush();
    if(!flushed)throw new Error(`${label}: no se pudo confirmar persist + flush.`);
  }catch(e){
    try{await adapters.rollback(before,e);}catch(rb){e.rollbackError=rb;}
    throw e;
  }
  try{
    const gcResult=await adapters.gc();
    return {committed:true,gcOk:true,gcResult};
  }catch(e){
    return {committed:true,gcOk:false,gcError:e};
  }
}
/* TESTABLE CORE END */

(()=>{
'use strict';
const registry=window.TradingResearchActions;
if(!registry||typeof registry!=='object')throw new Error('Blob Lifecycle: TradingResearchActions no disponible.');

let durableDeletes=0,localGcDeleted=0,localGcKept=0,localGcFailures=0,cloudGcDeleted=0,cloudGcKept=0,cloudGcFailures=0,lastError='',lastGcAt='';

function trBlobGcSnapshot(){
  if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.snapshot)return TRDomainStore.snapshot();
  return typeof clone==='function'?clone(state):JSON.parse(JSON.stringify(state));
}
async function trBlobGcRecoverableSnapshots(){
  const roots=[...(typeof trCoreSnapshotCache!=='undefined'&&Array.isArray(trCoreSnapshotCache)?trCoreSnapshotCache:[])];
  try{
    if(typeof trBackupV2JournalGet==='function'){
      const journal=await trBackupV2JournalGet();
      if(journal?.targetWorkspace)roots.push({targetWorkspace:journal.targetWorkspace});
    }
  }catch{}
  return roots;
}
async function trBlobGcReachableIds(){
  return trBlobGcReachableIdsFromRoots(trBlobGcSnapshot(),await trBlobGcRecoverableSnapshots());
}
function trBlobGcStagePrefix(){
  return typeof TR_BACKUP_V2_STAGE_PREFIX!=='undefined'?TR_BACKUP_V2_STAGE_PREFIX:'__tr_backup_v2_stage__';
}
function trBlobGcPayloadImageIds(payload){
  const out=[];
  for(const x of payload?.images||[])if(x?.id)out.push(String(x.id));
  for(const x of payload?.imagesLong||[])if(x?.id)out.push(String(x.id));
  for(const x of payload?.imagesShort||[])if(x?.id)out.push(String(x.id));
  return out;
}
function trBlobGcUniqueIds(ids){return [...new Set((ids||[]).filter(Boolean).map(String))];}

async function trBlobGcDeleteLocalIds(ids){
  const targets=trBlobGcUniqueIds(ids).filter(id=>!id.startsWith(trBlobGcStagePrefix()));
  if(!targets.length)return 0;
  const db=await imageDb();
  return new Promise((resolve,reject)=>{
    let tx;try{
      tx=db.transaction(IMAGE_STORE,'readwrite');const store=tx.objectStore(IMAGE_STORE);
      for(const id of targets)store.delete(id);
    }catch(e){try{tx?.abort();}catch{}reject(e);return;}
    tx.oncomplete=()=>resolve(targets.length);
    tx.onerror=()=>reject(tx.error||new Error('GC local de blobs falló.'));
    tx.onabort=()=>reject(tx.error||new Error('GC local de blobs abortado.'));
  });
}
async function trBlobGcSweepLocalCandidates(candidateIds){
  const roots=await trBlobGcReachableIds(),remove=[],keep=[];
  for(const id of trBlobGcUniqueIds(candidateIds)){
    if(id.startsWith(trBlobGcStagePrefix())||roots.has(id))keep.push(id);else remove.push(id);
  }
  if(remove.length)await trBlobGcDeleteLocalIds(remove);
  localGcDeleted+=remove.length;localGcKept+=keep.length;lastGcAt=new Date().toISOString();
  return {removed:remove,kept:keep,reachable:roots.size};
}
async function trBlobGcSweepLocalAll(){
  const records=await getAllImageRecords(),candidates=(records||[]).map(x=>x?.id).filter(Boolean);
  return trBlobGcSweepLocalCandidates(candidates);
}
function trBlobGcRollback(before,reason){
  if(typeof trDomainRollbackMemory==='function'){
    if(!trDomainRollbackMemory(before,reason))throw new Error('No se pudo restaurar el workspace en memoria.');
    return true;
  }
  state=normalizeState(typeof clone==='function'?clone(before):JSON.parse(JSON.stringify(before)));
  if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.ensureAttached)TRDomainStore.ensureAttached(reason);
  return true;
}
async function trBlobGcRunMutation(label,mutator,candidateIds){
  return trBlobGcDurableMutation(label,{
    snapshot:()=>trBlobGcSnapshot(),
    mutate:()=>TRDomainStore.command(label,()=>mutator(state),{persist:false,render:false}),
    persist:async()=>{if(typeof persist!=='function')throw new Error('persist() no disponible.');persist();},
    flush:async()=>typeof trCoreFlush==='function'?await trCoreFlush():false,
    rollback:async before=>trBlobGcRollback(before,`${label}.rollback`),
    gc:async()=>trBlobGcSweepLocalCandidates(candidateIds)
  });
}
function trBlobGcReportGcPending(result,context){
  if(result?.gcOk!==false)return;
  localGcFailures++;lastError=`${context}: ${result.gcError?.message||String(result.gcError||'GC falló')}`;
  console.warn('[Trading Research · Blob Lifecycle] metadata durable; GC pendiente',result.gcError);
  try{trCoreShowStorageWarning('Los datos se guardaron correctamente, pero quedó limpieza de imágenes pendiente. El blob huérfano se conservará hasta un próximo GC seguro.');}catch{}
}
function trBlobGcRender(){try{if(typeof render==='function')render();}catch{}}

async function trBlobDeleteOperation(id){
  const op=(state.operations||[]).find(o=>o.id===id);if(!op)return;
  const imageIds=(op.images||[]).map(x=>x?.id).filter(Boolean),reviews=(typeof getPlan==='function'?(getPlan(op.tradingPlanId)?.reviewNotes||[]):[]).filter(n=>n?.operationId===op.id).length,imported=!!op.importBatchId;
  const extra=[imageIds.length?`También se retirarán ${imageIds.length} referencia(s) de captura; el blob solo se borrará tras persist + flush y si ya no es alcanzable.`:'',reviews?`${reviews} review(s) se conservarán como historial.`:'',imported?'El lote se conservará y actualizará su contador.':''].filter(Boolean).join('\n');
  if(!confirm(`¿Eliminar esta operación definitivamente?${extra?`\n\n${extra}`:''}`))return;
  try{
    const result=await TRDomainStore.exclusive('blob.delete.operation',()=>trBlobGcRunMutation('operation.delete.safe',()=>{
      state.operations=state.operations.filter(x=>x.id!==id);
      if(op.importBatchId){const b=state.importBatches.find(x=>x.id===op.importBatchId);if(b)b.operationCount=state.operations.filter(x=>x.importBatchId===op.importBatchId).length;}
      if(typeof gallerySelected!=='undefined'&&Array.isArray(gallerySelected))gallerySelected=gallerySelected.filter(x=>x!==id);
    },imageIds));
    durableDeletes++;trBlobGcReportGcPending(result,'deleteOperation');try{closeModal();}catch{}trBlobGcRender();return result;
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · safe operation delete]',e);alert('No se pudo eliminar la operación de forma durable: '+lastError);}
}

async function trBlobDeleteOperationImage(operationId,imageId){
  const op=(state.operations||[]).find(o=>o.id===operationId);if(!op)return;
  const im=(op.images||[]).find(x=>x.id===imageId);if(!im)return;
  if(!confirm(`¿Eliminar la captura “${im.caption||im.name||'Captura'}”?`))return;
  try{
    const result=await TRDomainStore.exclusive('blob.delete.operation-image',()=>trBlobGcRunMutation('operation.image.delete.safe',()=>{
      const live=state.operations.find(o=>o.id===operationId);if(!live)throw new Error('La operación ya no existe.');
      live.images=(live.images||[]).filter(x=>x.id!==imageId);live.updatedAt=new Date().toISOString();
    },[imageId]));
    durableDeletes++;trBlobGcReportGcPending(result,'deleteOperationImage');
    const modal=document.querySelector('.modal-backdrop');
    if(modal){
      for(const img of modal.querySelectorAll('img[data-img-id]'))if(img.dataset.imgId===imageId)img.closest('.image-thumb-btn')?.remove();
      for(const btn of modal.querySelectorAll('[data-tr-cleanup-image]'))if(btn.dataset.trCleanupImage===imageId)btn.remove();
      const existing=modal.querySelector('.existing-images'),live=state.operations.find(o=>o.id===operationId);
      if(existing&&live){const n=(live.images||[]).length;if(!n)existing.remove();else{const label=existing.querySelector(':scope > span');if(label)label.textContent=`${n} imagen(es) ya asociadas`;}}
    }
    return result;
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · safe operation image delete]',e);alert('No se pudo eliminar la captura de forma durable: '+lastError);}
}

async function trBlobDeleteImportBatch(id){
  const batch=(state.importBatches||[]).find(x=>x.id===id);if(!batch)return;
  const ops=(state.operations||[]).filter(o=>o.importBatchId===id),opIds=new Set(ops.map(o=>o.id)),imageIds=ops.flatMap(o=>(o.images||[]).map(x=>x?.id).filter(Boolean));
  if(!confirm(`¿Eliminar la importación ${batch.fileName} y sus ${batch.operationCount} operaciones? Esta acción solo afecta a ese lote importado.`))return;
  try{
    const result=await TRDomainStore.exclusive('blob.delete.import-batch',()=>trBlobGcRunMutation('import.ankora.delete.safe',()=>{
      state.operations=state.operations.filter(o=>o.importBatchId!==id);
      state.importBatches=state.importBatches.filter(x=>x.id!==id);
      if(typeof gallerySelected!=='undefined'&&Array.isArray(gallerySelected))gallerySelected=gallerySelected.filter(x=>!opIds.has(x));
    },imageIds));
    durableDeletes++;trBlobGcReportGcPending(result,'deleteImportBatch');trBlobGcRender();return result;
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · safe import batch delete]',e);alert('No se pudo eliminar el lote de forma durable: '+lastError);}
}

async function trBlobDeleteVisualReference(id){
  const plan=getCurrentPlan(),ref=(plan?.visualReferences||[]).find(x=>x.id===id);if(!plan||!ref)return;
  const imageIds=(ref.images||[]).map(x=>x?.id).filter(Boolean);
  if(!confirm('¿Eliminar esta referencia visual y sus imágenes?'))return;
  try{
    const result=await TRDomainStore.exclusive('blob.delete.visual-reference',()=>trBlobGcRunMutation('plan.visual-reference.delete.safe',()=>{
      const p=getCurrentPlan();p.visualReferences=(p.visualReferences||[]).filter(x=>x.id!==id);p.updatedAt=new Date().toISOString();
    },imageIds));
    durableDeletes++;trBlobGcReportGcPending(result,'deleteVisualReference');trBlobGcRender();return result;
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · safe visual reference delete]',e);alert('No se pudo eliminar la referencia de forma durable: '+lastError);}
}

async function trBlobDeleteTaxonomyAsset(type,key){
  const plan=getCurrentPlan();if(!plan)return;ensurePlanV8Structure(plan);const clean=decodeURIComponent(key||''),collName=defCollectionName(type),item=(plan[collName]||[]).find(d=>d.key===clean);
  const imageIds=item?[...(item.images||[]),...(item.imagesLong||[]),...(item.imagesShort||[])].map(x=>x?.id).filter(Boolean):[];
  if(!confirm(`¿Eliminar ${taxonomyLabel(type).toLowerCase()} "${clean}"? Las operaciones históricas no se borrarán.`))return;
  try{
    const result=await TRDomainStore.exclusive('blob.delete.taxonomy',()=>trBlobGcRunMutation('plan.taxonomy.asset.delete.safe',()=>{
      const p=getCurrentPlan();ensurePlanV8Structure(p);p[collName]=(p[collName]||[]).filter(d=>d.key!==clean);
      if(type==='setup')p.setups=(p.setups||[]).filter(x=>x!==clean);if(type==='vd')p.vd=(p.vd||[]).filter(x=>x!==clean);p.updatedAt=new Date().toISOString();
    },imageIds));
    durableDeletes++;trBlobGcReportGcPending(result,'deleteTaxonomyAsset');trBlobGcRender();return result;
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · safe taxonomy delete]',e);alert('No se pudo eliminar la taxonomía de forma durable: '+lastError);}
}

async function trBlobDeleteSavedLibraryItem(id){
  const lib=ensureMasterLibrary(),item=(lib.items||[]).find(i=>i.id===id);if(!item)return;
  if(!confirm(`¿Eliminar "${item.name}" de la Biblioteca?\n\nNo se borrará de ningún Trading Plan donde ya lo hayas añadido.`))return;
  const targets=lib.items.filter(i=>i.type===item.type&&i.name===item.name),imageIds=targets.flatMap(i=>trBlobGcPayloadImageIds(i.payload)),familyIds=new Set(targets.map(i=>i.familyId)),itemIds=new Set(targets.map(i=>i.id));
  try{
    const result=await TRDomainStore.exclusive('blob.delete.master-library',()=>trBlobGcRunMutation('master-library.delete.safe',()=>{
      const live=ensureMasterLibrary();live.items=live.items.filter(i=>!(i.type===item.type&&i.name===item.name));live.updatedAt=new Date().toISOString();
      state.tradingPlans.forEach(p=>{p.libraryLinks=(p.libraryLinks||[]).filter(x=>!familyIds.has(x.familyId)&&!itemIds.has(x.itemId));});
    },imageIds));
    durableDeletes++;trBlobGcReportGcPending(result,'deleteSavedLibraryItem');trBlobGcRender();return result;
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · safe Master Library delete]',e);alert('No se pudo eliminar el elemento de Biblioteca de forma durable: '+lastError);}
}

async function trBlobGcListCloudObjects(storage,userId){
  const out=[],limit=1000;let offset=0;
  for(;;){
    const {data,error}=await storage.list(String(userId),{limit,offset,sortBy:{column:'name',order:'asc'}});
    if(error)throw new Error('No se pudo listar Storage para GC: '+error.message);
    const rows=(data||[]).filter(x=>x?.name&&x?.id);for(const row of rows)out.push(String(row.name));
    if((data||[]).length<limit)break;offset+=(data||[]).length;if(!(data||[]).length)break;
  }
  return [...new Set(out)].sort();
}
async function trBlobGcReconcileCloudInventory(user){
  if(!cloudClient||!user?.id)return [];
  const storage=cloudClient.storage.from(CLOUD_BUCKET),actual=await trBlobGcListCloudObjects(storage,user.id);
  cloudConfig.syncedImageIds=[...actual];saveCloudConfigLocal();return actual;
}
async function trBlobGcSweepCloud(user){
  if(!cloudClient||!user?.id)return {removed:[],kept:[]};
  const reachable=await trBlobGcReachableIds(),storage=cloudClient.storage.from(CLOUD_BUCKET),objects=await trBlobGcListCloudObjects(storage,user.id),plan=trBlobGcCloudSweepPlan(objects,reachable);
  let removeError=null;
  try{
    for(let i=0;i<plan.removeIds.length;i+=100){
      const paths=plan.removeIds.slice(i,i+100).map(id=>`${user.id}/${id}`);
      if(!paths.length)continue;
      const {error}=await cloudClient.storage.from(CLOUD_BUCKET).remove(paths);
      if(error)throw new Error('GC cloud: '+error.message);
    }
  }catch(e){removeError=e;}
  let actual=null;
  try{actual=await trBlobGcListCloudObjects(storage,user.id);cloudConfig.syncedImageIds=[...actual];saveCloudConfigLocal();}catch(e){if(!removeError)removeError=e;}
  if(removeError){cloudGcFailures++;lastError=removeError.message||String(removeError);throw removeError;}
  cloudGcDeleted+=plan.removeIds.length;cloudGcKept+=(actual||plan.keepIds).length;lastGcAt=new Date().toISOString();
  return {removed:plan.removeIds,kept:actual||plan.keepIds,reachable:reachable.size};
}

/* Only sweep cloud after a push that actually advanced lastPush. Before the push,
 * reconcile syncedImageIds with Storage real so a stale local cache cannot suppress
 * re-upload of a reachable blob that disappeared remotely. */
const trBlobGcCloudPushBase=cloudPushState;
cloudPushState=async function(options={}){
  const before=cloudConfig?.lastPush||'';
  try{if(cloudClient&&cloudAuthUser)await trBlobGcReconcileCloudInventory(cloudAuthUser);}catch(e){console.warn('[Trading Research · cloud inventory preflight]',e);}
  const out=await trBlobGcCloudPushBase.apply(this,arguments),after=cloudConfig?.lastPush||'';
  if(after&&after!==before&&cloudAuthUser){
    try{await trBlobGcSweepCloud(cloudAuthUser);}
    catch(e){console.warn('[Trading Research · cloud GC pending]',e);try{trCoreShowStorageWarning('La sincronización terminó, pero la limpieza de blobs huérfanos en Supabase quedó pendiente. No se ha borrado ninguna referencia viva.');}catch{}}
  }
  return out;
};

/* Effective action boundary. Historical destructive functions remain auditable in app.js
 * / operation-cleanup-runtime.js, but Event Runtime resolves these registry replacements. */
registry.deleteOperation=trBlobDeleteOperation;
registry.deleteOperationImage=trBlobDeleteOperationImage;
registry.deleteImportBatch=trBlobDeleteImportBatch;
registry.deleteVisualReference=trBlobDeleteVisualReference;
registry.deleteTaxonomyAsset=trBlobDeleteTaxonomyAsset;
registry.deleteSavedLibraryItem=trBlobDeleteSavedLibraryItem;
registry.cloudPushState=cloudPushState;
try{deleteImportBatch=trBlobDeleteImportBatch;}catch{}
try{deleteVisualReference=trBlobDeleteVisualReference;}catch{}
try{deleteTaxonomyAsset=trBlobDeleteTaxonomyAsset;}catch{}
try{deleteSavedLibraryItem=trBlobDeleteSavedLibraryItem;}catch{}

Object.defineProperty(registry,'__trBlobLifecycleDiagnostics',{value:()=>({
  version:TR_BLOB_LIFECYCLE_VERSION,durableDeletes,localGcDeleted,localGcKept,localGcFailures,cloudGcDeleted,cloudGcKept,cloudGcFailures,lastGcAt,lastError,
  policy:'metadata -> persist+flush -> mark-and-sweep',snapshotRoots:typeof trCoreSnapshotCache!=='undefined'?(trCoreSnapshotCache||[]).length:0,
  ok:!lastError||localGcFailures>0||cloudGcFailures>0
}),writable:false,enumerable:false,configurable:true});
registry.runLocalBlobGarbageCollection=async function(){
  try{const result=await TRDomainStore.exclusive('blob.gc.local.manual',()=>trBlobGcSweepLocalAll());trBlobGcRender();return result;}
  catch(e){localGcFailures++;lastError=e?.message||String(e);throw e;}
};
registry.runCloudBlobGarbageCollection=async function(){
  const user=cloudAuthUser||await cloudRequireUser();return trBlobGcSweepCloud(user);
};
})();
/* ===== END V31.24 BLOB LIFECYCLE RUNTIME ===== */
