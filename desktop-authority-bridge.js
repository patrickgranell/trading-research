/* Batch 76 / Desktop-only injected lexical bridge (never loaded by Web). */
const trDesktopNativeInvoke=globalThis.__TAURI__?.core?.invoke;
if(typeof trDesktopNativeInvoke!=='function')throw new Error('Tauri SQLite bridge unavailable.');
let trDesktopAuthorityRevision=0;
let trDesktopAuthorityFailed=false;
const trDesktopAuthorityControl={
  enabled:true,active:false,migrationPending:true,version:'0.4.0',
  revision:()=>trDesktopAuthorityRevision,
  mode:()=>trDesktopAuthorityFailed?'blocked':trDesktopAuthorityControl.active?'sqlite-authority':'migration'
};
globalThis.TradingResearchDesktopAuthority=trDesktopAuthorityControl;

let trDesktopImageGeneration=0;
let trDesktopImageFailed=false;
let trDesktopImageWriteChain=Promise.resolve(true);
const trDesktopImageAuthorityControl={
  active:false,migrationPending:false,failed:()=>trDesktopImageFailed,generation:()=>trDesktopImageGeneration,
  version:'0.5.0-b77',mode:()=>trDesktopImageFailed?'blocked':trDesktopImageAuthorityControl.active?'native-authority':trDesktopImageAuthorityControl.migrationPending?'migration':'indexeddb'
};
globalThis.TradingResearchDesktopImageAuthority=trDesktopImageAuthorityControl;
async function trDesktopInvoke(command,args={}){
  const reply=await trDesktopNativeInvoke(command,args);
  return typeof reply==='string'?JSON.parse(reply):reply;
}

async function trDesktopImageBootstrapAuthority(){
  const status=await trDesktopInvoke('desktop_native_image_authority_status',{deep:false});
  trDesktopImageAuthorityControl.active=!!status?.active;
  trDesktopImageGeneration=Number(status?.generation)||0;
  if(trDesktopImageAuthorityControl.active&&trDesktopImageGeneration<1)throw new Error('Autoridad de imágenes activa sin generación válida.');
  return status;
}
function trDesktopImageStop(error){
  trDesktopImageFailed=true;
  trCoreSetWriteBlock('desktop-native-image-authority-error');
  const e=error instanceof Error?error:new Error(String(error));
  console.error('[Trading Research · Native image authority]',e);
  trDesktopAuthorityStop(e);
}
function trDesktopImageBase64(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');
    r.onerror=()=>reject(r.error||new Error('No se pudo serializar imagen.'));
    r.readAsDataURL(blob);
  });
}
async function trDesktopImageSha(blob){
  const bytes=await blob.arrayBuffer();
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function trDesktopImageBlob(data,type='application/octet-stream'){
  const bin=atob(String(data||'')),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type});
}
function trDesktopImageQueueBatch(puts=[],deletes=[],reason='image.commit'){
  if(!trDesktopImageAuthorityControl.active||trDesktopImageFailed)return Promise.reject(new Error('Autoridad nativa de imágenes no disponible.'));
  trDesktopImageWriteChain=trDesktopImageWriteChain.then(async()=>{
    if(trDesktopImageFailed)throw new Error('Autoridad nativa de imágenes bloqueada.');
    const previous=trDesktopImageGeneration;
    try{
      const result=await trDesktopInvoke('desktop_native_image_batch',{
        puts:JSON.stringify(puts),deletes:JSON.stringify(deletes),
        expectedGeneration:previous,reason:String(reason||'image.commit')
      });
      if(!result?.ok||Number(result.generation)!==previous+1)throw new Error('Commit nativo de imágenes no confirmó la siguiente generación.');
      trDesktopImageGeneration=Number(result.generation);
      return result;
    }catch(e){trDesktopImageStop(e);throw e;}
  });
  return trDesktopImageWriteChain;
}
async function trDesktopImageWriteFile(file,id){
  const data=await trDesktopImageBase64(file),sha256=await trDesktopImageSha(file);
  await trDesktopImageQueueBatch([{
    id:String(id),data,sha256,mime:String(file.type||'application/octet-stream'),
    name:String(file.name||'imagen'),updatedAt:new Date().toISOString()
  }],[],'image.file.put');
  return true;
}
async function trDesktopImageReadBlob(id){
  if(!trDesktopImageAuthorityControl.active)throw new Error('Lectura nativa solicitada sin autoridad activa.');
  const rec=await trDesktopInvoke('desktop_read_native_image',{id:String(id)});
  if(!rec?.authority||!rec.data)throw new Error('Imagen nativa no verificable: '+String(id));
  return trDesktopImageBlob(rec.data,rec.mime||'application/octet-stream');
}
async function trDesktopImageListRecords(){
  if(!trDesktopImageAuthorityControl.active)throw new Error('Lista nativa solicitada sin autoridad activa.');
  const rows=await trDesktopInvoke('desktop_list_native_images');
  const out=[];
  for(const meta of rows||[]){
    const rec=await trDesktopInvoke('desktop_read_native_image',{id:String(meta.id)});
    out.push({id:String(meta.id),blob:trDesktopImageBlob(rec.data,rec.mime||meta.mime),
      name:meta.name||'imagen',type:meta.mime||rec.mime||'application/octet-stream',
      updatedAt:meta.updatedAt||'',sha256:meta.sha256||rec.sha256||''});
  }
  return out;
}
async function trDesktopImageClear(){
  const rows=await trDesktopInvoke('desktop_list_native_images'),ids=(rows||[]).map(x=>String(x.id));
  if(ids.length)await trDesktopImageQueueBatch([],ids,'image.clear');
  return true;
}
async function trDesktopImageDeleteIds(ids,reason='image.delete'){
  const unique=[...new Set((ids||[]).filter(Boolean).map(String))];
  if(unique.length)await trDesktopImageQueueBatch([],unique,reason);
  return unique.length;
}
async function trDesktopImageWriteTransaction(puts=[],deletes=[],reason='image.batch'){
  const nativePuts=[];
  for(const rec of puts||[]){
    if(!(rec?.blob instanceof Blob))throw new Error('Put nativo sin Blob: '+String(rec?.id||''));
    nativePuts.push({
      id:String(rec.id),data:await trDesktopImageBase64(rec.blob),sha256:await trDesktopImageSha(rec.blob),
      mime:String(rec.type||rec.blob.type||'application/octet-stream'),name:String(rec.name||'imagen'),
      updatedAt:String(rec.updatedAt||'')
    });
  }
  return trDesktopImageQueueBatch(nativePuts,(deletes||[]).map(String),reason);
}
async function trDesktopImageGcDeleteLocalIds(ids){
  const count=await trDesktopImageDeleteIds(ids,'image.gc.catalog');
  await trDesktopInvoke('desktop_gc_native_image_objects');
  return count;
}
globalThis.TradingResearchDesktopImageBridge=Object.freeze({
  writeFile:trDesktopImageWriteFile,readBlob:trDesktopImageReadBlob,listRecords:trDesktopImageListRecords,
  clear:trDesktopImageClear,deleteIds:trDesktopImageDeleteIds,writeTransaction:trDesktopImageWriteTransaction,
  gcDeleteIds:trDesktopImageGcDeleteLocalIds,
  setPromoted:(generation)=>{trDesktopImageGeneration=Number(generation)||0;trDesktopImageAuthorityControl.active=trDesktopImageGeneration>0;},
  setMigrationPending:(value)=>{trDesktopImageAuthorityControl.migrationPending=!!value;},
  block:trDesktopImageStop,
  refresh:trDesktopImageBootstrapAuthority
});
function trDesktopAuthorityStop(error){
  trDesktopAuthorityFailed=true;
  trCoreFatal=true;trCoreHydrated=false;trCoreMode='fatal';
  trCoreSetWriteBlock('desktop-sqlite-authority-error');
  trCoreLastError='Desktop SQLite: '+(error?.message||String(error));
  console.error('[Trading Research · SQLite authority]',error);
  document.documentElement.classList.remove('tr-core-loading');
  const root=document.getElementById('app');
  if(root)root.innerHTML='<main class="tr-core-fatal"><h1>Trading Research</h1><h2>SQLite requiere recuperación</h2><p>'+String(trCoreLastError).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p><p>No se ha sustituido SQLite por IndexedDB. Conserva tus archivos .trbackup; no introduzcas datos nuevos en este estado.</p></main>';
}
function trDesktopAuthorityQueueStateWrite(reason='persist'){
  if(!trDesktopAuthorityControl.active||trDesktopAuthorityFailed||!trCoreWriteAllowed(reason))return Promise.resolve(false);
  const payload=JSON.stringify(clone(state));
  trCoreWriteChain=trCoreWriteChain.then(async()=>{
    if(trDesktopAuthorityFailed)return false;
    try{
      const previous=trDesktopAuthorityRevision;
      const result=await trDesktopInvoke('desktop_commit_authoritative_workspace',{
        payload,expectedRevision:previous,reason:String(reason||'persist')
      });
      if(!result?.ok||Number(result.revision)!==previous+1)throw new Error('SQLite no confirmó revisión siguiente.');
      trDesktopAuthorityRevision=Number(result.revision);
      trCoreLastSavedAt=result.updatedAt||new Date().toISOString();
      trCoreLastError='';
      return true;
    }catch(e){
      trDesktopAuthorityStop(e);
      trCoreReportPersistenceError(e,'SQLite commit');
      return false;
    }
  });
  return trCoreWriteChain;
}
function trDesktopAuthorityCanonical(value){
  const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?
    Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
  return JSON.stringify(sorted(value));
}
function trDesktopAuthorityReadRecord(raw){
  if(!raw||raw.active!==true||!Number.isSafeInteger(Number(raw.revision))||Number(raw.revision)<1||typeof raw.payload!=='string')throw new Error('No existe registro de autoridad SQLite verificable.');
  const source=JSON.parse(raw.payload);
  if(!trCoreIsValidWorkspacePayload(source))throw new Error('SQLite contiene workspace inválido. No se usará IndexedDB.');
  return source;
}
async function trDesktopAuthorityWaitBackup(){
  for(let i=0;i<200;i++){
    if(typeof trBackupV2BuildPayload==='function'&&typeof trBackupV2Preflight==='function'&&typeof trBackupV2JournalGet==='function')return;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error('Backup V2 no estuvo disponible antes de la migración.');
}
/* A 0.3.1 hydration event can finish normalizing domain state while images and
 * Market Data are being serialized by Backup V2. Do not promote an older
 * snapshot, but do not call this data loss after the FIRST ordinary drift.
 * Require two independent, equal sources: current domain and durable IndexedDB.
 * Each changed attempt is flushed and rebuilt; bounded non-quiescence fails closed.
 */
function trDesktopMigrationSnapshot(){
  return typeof TRDomainStore!=='undefined'&&TRDomainStore?.snapshot?TRDomainStore.snapshot():clone(state);
}
async function trDesktopMigrationMatches(backup){
  if(!(await trCoreFlush()))throw new Error('La cola previa IndexedDB no confirmó sus escrituras.');
  const current=trDesktopMigrationSnapshot();
  const durable=await trCoreGet(TR_CORE_STATE_STORE,TR_CORE_STATE_ID);
  if(!trCoreIsValidWorkspacePayload(durable?.payload))throw new Error('El workspace durable IndexedDB no supera la validación.');
  const expected=trDesktopAuthorityCanonical(backup.workspace);
  return expected===trDesktopAuthorityCanonical(current)&&expected===trDesktopAuthorityCanonical(durable.payload);
}
async function trDesktopAuthorityPrepareMigration(){
  for(let attempt=1;attempt<=5;attempt++){
    if(!(await trCoreFlush()))throw new Error('No se pudo vaciar la cola IndexedDB previa a migración.');
    // The bootstrap hydration and schema-normalization callbacks may still
    // be queued after trCoreBootstrapIndexedDb resolves. Persist those
    // legitimate adjustments before materializing the candidate backup.
    if(!(await trCorePersistNow('desktop-migration-stabilize')))throw new Error('No se pudo confirmar el workspace de migración en IndexedDB.');
    if(!(await trCoreFlush()))throw new Error('IndexedDB no confirmó la normalización previa a migración.');
    const backup=await trBackupV2BuildPayload();
    await trBackupV2Preflight(backup);
    if(await trDesktopMigrationMatches(backup))return backup;
    // Never promote the old candidate: a changed workspace requires a NEW
    // complete manifest and image/Market Data preflight.
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  throw new Error('El workspace no se estabilizó tras 5 verificaciones Backup V2 / IndexedDB. No se ha promovido SQLite.');
}
async function trDesktopAuthorityBootstrap(){
  try{
    const native=await trDesktopInvoke('desktop_authority_status');
    if(native?.active){
      await trCoreOpenDb(); // Images, Market Data and recovery journal remain IndexedDB.
      const record=await trDesktopInvoke('desktop_read_authoritative_workspace');
      const source=trDesktopAuthorityReadRecord(record);
      // This is an already validated, hash-verified SQLite workspace, not a
      // legacy import. normalizeState/ensureAllPlansV8/ensureMasterLibrary are
      // NOT identity transforms; calling them on every boot can add fields,
      // regenerate defaults or timestamps and falsely reject a correct record.
      // Read the exact authoritative payload. Future schema upgrades must
      // write an explicit SQLite CAS revision after their own Backup V2.
      state=source;
      trDesktopAuthorityRevision=Number(record.revision);
      trDesktopAuthorityControl.active=true;
      trCoreSnapshotCache=(await trCoreGetAll(TR_CORE_SNAPSHOT_STORE)).sort((a,b)=>String(b?.savedAt||'').localeCompare(String(a?.savedAt||''))).slice(0,3);
      trCoreMode='sqlite-authority';trCoreHydrated=true;trCoreLastError='';trCoreLastSavedAt=record.updatedAt||'';
      trCoreSignalHydrated();
    }else{
      // Only the prior durable IndexedDB source can be promoted, never its SQLite shadow.
      await trCoreBootstrapIndexedDb();
      if(trCoreFatal||!trCoreHydrated||trCoreMode!=='indexeddb')throw new Error('IndexedDB previo no es una fuente de migración durable válida.');
      await trDesktopAuthorityWaitBackup();
      if(await trBackupV2JournalGet())throw new Error('Restore journal pendiente. Completa recuperación con la versión anterior antes de promover.');
      const backup=await trDesktopAuthorityPrepareMigration();
      const payload=JSON.stringify(backup.workspace);
      // There is no user-visible UI during promotion, but domain callbacks
      // are asynchronous: block new writes and recheck the durable snapshot.
      trCoreSetWriteBlock('desktop-authority-promotion');
      if(!(await trDesktopMigrationMatches(backup)))throw new Error('El workspace cambió justo antes de publicar el backup físico. Promoción rechazada.');
      const saved=await trDesktopInvoke('desktop_write_backup',{
        payload:JSON.stringify(backup),label:'desktop-authority-migration-rollback'
      });
      if(!saved?.ok||!saved.path||!(Number(saved.bytes)>0))throw new Error('No se confirmó backup físico previo a promoción.');
      const promoted=await trDesktopInvoke('desktop_promote_workspace_authority',{
        payload,rollbackPath:saved.path
      });
      const record=await trDesktopInvoke('desktop_read_authoritative_workspace');
      trDesktopAuthorityReadRecord(record);
      if(!promoted?.ok||record?.payload!==payload||Number(record.revision)!==Number(promoted.revision))throw new Error('Promoción/readback SQLite no coincide con Backup V2.');
      trDesktopAuthorityRevision=Number(record.revision);
      trDesktopAuthorityControl.active=true;trCoreMode='sqlite-authority';
      trCoreLastError='';trCoreLastSavedAt=record.updatedAt||'';
      trCoreClearWriteBlock('desktop-authority-promotion');
    }
    await trDesktopImageBootstrapAuthority();
    trDesktopAuthorityControl.migrationPending=false;
    await globalThis.TradingResearchDesktopNativeStorage?.refresh?.();
    document.documentElement.classList.remove('tr-core-loading');
    if(typeof render==='function')render();
  }catch(e){
    trDesktopAuthorityStop(e);
  }
}
async function trCoreBootstrap(){
  return trDesktopAuthorityBootstrap();
}
