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
async function trDesktopInvoke(command,args={}){
  const reply=await trDesktopNativeInvoke(command,args);
  return typeof reply==='string'?JSON.parse(reply):reply;
}
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
