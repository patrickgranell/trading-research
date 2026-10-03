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
async function trDesktopAuthorityBootstrap(){
  try{
    const native=await trDesktopInvoke('desktop_authority_status');
    if(native?.active){
      await trCoreOpenDb(); // Images, Market Data and recovery journal remain IndexedDB.
      const record=await trDesktopInvoke('desktop_read_authoritative_workspace');
      const source=trDesktopAuthorityReadRecord(record);
      state=normalizeState(source);
      if(typeof ensureAllPlansV8==='function')ensureAllPlansV8();
      if(typeof ensureMasterLibrary==='function')ensureMasterLibrary();
      if(JSON.stringify(state)!==JSON.stringify(source))throw new Error('Normalización del workspace SQLite requiere migración explícita; arranque bloqueado.');
      trDesktopAuthorityRevision=Number(record.revision);
      trDesktopAuthorityControl.active=true;
      trCoreSnapshotCache=(await trCoreGetAll(TR_CORE_SNAPSHOT_STORE)).sort((a,b)=>String(b?.savedAt||'').localeCompare(String(a?.savedAt||''))).slice(0,3);
      trCoreMode='sqlite-authority';trCoreHydrated=true;trCoreLastError='';
      trCoreSignalHydrated();
    }else{
      // Only the prior durable IndexedDB source can be promoted, never its SQLite shadow.
      await trCoreBootstrapIndexedDb();
      if(trCoreFatal||!trCoreHydrated||trCoreMode!=='indexeddb')throw new Error('IndexedDB previo no es una fuente de migración durable válida.');
      await trDesktopAuthorityWaitBackup();
      if(await trBackupV2JournalGet())throw new Error('Restore journal pendiente. Completa recuperación con la versión anterior antes de promover.');
      if(!(await trCoreFlush()))throw new Error('No se pudo vaciar la cola IndexedDB previa a migración.');
      const backup=await trBackupV2BuildPayload();
      await trBackupV2Preflight(backup);
      const payload=JSON.stringify(backup.workspace);
      if(JSON.stringify(typeof TRDomainStore!=='undefined'&&TRDomainStore?.snapshot?TRDomainStore.snapshot():clone(state))!==payload) {
        throw new Error('El workspace cambió durante la preparación del Backup V2. Se rechaza la promoción.');
      }
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
      trCoreLastError='';
    }
    trDesktopAuthorityControl.migrationPending=false;
    document.documentElement.classList.remove('tr-core-loading');
    if(typeof render==='function')render();
  }catch(e){
    trDesktopAuthorityStop(e);
  }
}
async function trCoreBootstrap(){
  return trDesktopAuthorityBootstrap();
}
