/* Batch 79 · Desktop 0.7 portable cold recovery.
 * One complete Backup V2 -> SQLite workspace + native images + native Market Data.
 * The native journal + source backup make the sequence restart-resumable.
 */
(()=>{
'use strict';
const invoke=globalThis.__TAURI__?.core?.invoke;
if(typeof invoke!=='function')throw new Error('Tauri portable recovery bridge unavailable.');
const LOCK='desktop-portable-restore';
const PROBE_LOCK='desktop-portable-restore-probe';
const STREAM_CHUNK=512*1024;
const ui={busy:false,lastError:'',journal:null,lastResult:null};

function parseNative(v){return typeof v==='string'?JSON.parse(v):v;}
async function call(command,args={}){return parseNative(await invoke(command,args));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function b64(bytes){
  let out='';
  for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
  return btoa(out);
}
function fromB64(value){
  const raw=atob(String(value||'')),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
function setBlock(on){
  if(on){
    trCoreSetWriteBlock?.(LOCK);
    trBackupV2SetRecoveryUiBlocked?.(true);
  }else{
    trCoreClearWriteBlock?.(LOCK);
    trBackupV2SetRecoveryUiBlocked?.(false);
  }
}
function currentWriteBlock(){
  try{return String(trCorePersistenceInfo?.().writeBlockReason||'');}catch{return typeof trCoreWriteBlocked==='function'&&trCoreWriteBlocked()?'unknown':'';}
}
function holdRecoveryBlock(){
  if(!(typeof trCoreWriteBlocked==='function'&&trCoreWriteBlocked()))trCoreSetWriteBlock?.(LOCK);
  trBackupV2SetRecoveryUiBlocked?.(true);
}
function releaseWriteBlockKeepVeil(){
  trCoreClearWriteBlock?.(LOCK);
  const remaining=currentWriteBlock();
  if(remaining)throw new Error('Restore portable verificado, pero sigue activo un bloqueo durable: '+remaining);
  // UI refresh may need read/ephemeral callbacks that are forbidden by the
  // durable write lock. Keep the full-screen veil until refresh completes.
  trBackupV2SetRecoveryUiBlocked?.(true);
}
function clearProbe(){try{trCoreClearWriteBlock?.(PROBE_LOCK);}catch{}}
function acquireProbe(){try{trCoreSetWriteBlock?.(PROBE_LOCK);}catch{}}
function canonical(v){return typeof trBackupV2Canonical==='function'?trBackupV2Canonical(v):JSON.stringify(v);}
function sameHashes(a,b){
  if(!a||!b)return false;
  return a.workspace===b.workspace&&a.marketMeta===b.marketMeta&&a.marketTicks===b.marketTicks&&a.execSets===b.execSets&&canonical(a.images||{})===canonical(b.images||{});
}
function sourceSummary(prepared){
  const c=prepared?.manifest?.counts||{};
  const ticks=(prepared?.marketData?.marketTicks||[]).reduce((n,r)=>n+(Array.isArray(r?.ticks)?r.ticks.length:0),0);
  return 'Planes: '+Number(c.plans||0)+' · Operaciones: '+Number(c.operations||0)+
    '\nImágenes: '+Number(c.images||0)+' · Históricos: '+Number(c.marketMeta||0)+' · Grid: '+Number(c.execSets||0)+
    '\nTicks: '+Number(ticks||0).toLocaleString('es-ES');
}
async function streamBackupText(text,label){
  const bytes=new TextEncoder().encode(String(text));
  const sessionId='B79-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
  await call('desktop_backup_stream_begin',{sessionId});
  try{
    let sent=0;
    for(let offset=0;offset<bytes.length;offset+=STREAM_CHUNK){
      const chunk=bytes.subarray(offset,Math.min(offset+STREAM_CHUNK,bytes.length));
      const out=await call('desktop_backup_stream_append',{sessionId,dataB64:b64(chunk)});
      sent=Number(out?.bytes||0);
    }
    const final=await call('desktop_backup_stream_finalize',{sessionId,label});
    if(!final?.ok||!final.path||Number(final.bytes)!==bytes.length||sent!==bytes.length)throw new Error('Backup físico portable no coincide con los bytes enviados.');
    return final;
  }catch(e){
    try{await call('desktop_backup_stream_abort',{sessionId});}catch{}
    throw e;
  }
}
async function readNativeBackupText(path){
  const decoder=new TextDecoder(),parts=[];
  let offset=0,total=null;
  for(;;){
    const out=await call('desktop_read_native_backup_chunk',{path,offset,maxBytes:STREAM_CHUNK});
    if(!out?.ok)throw new Error('No se pudo releer el backup source portable.');
    if(total===null)total=Number(out.totalBytes||0);
    const bytes=fromB64(out.dataB64);
    parts.push(decoder.decode(bytes,{stream:!out.eof}));
    offset+=Number(out.bytes||0);
    if(out.eof)break;
    if(!out.bytes||offset>total)throw new Error('Replay del backup source portable no progresa.');
  }
  if(offset!==total)throw new Error('Replay del backup source portable terminó con tamaño distinto.');
  return parts.join('');
}
async function prepareText(text){
  if(typeof trBackupV2Preflight!=='function')throw new Error('Backup V2 preflight no disponible.');
  const raw=JSON.parse(String(text));
  return {raw,prepared:await trBackupV2Preflight(raw)};
}
async function advance(journal,nextPhase){
  const out=await call('desktop_portable_restore_advance',{expectedPhase:String(journal.phase),nextPhase});
  journal={...journal,phase:out.phase,updatedAt:out.updatedAt};
  ui.journal=journal;paint();
  return journal;
}
async function ensureWorkspaceAuthority(prepared,journal){
  if(globalThis.TradingResearchDesktopAuthority?.active)return true;
  const promoted=await call('desktop_promote_workspace_authority',{
    payload:JSON.stringify(prepared.workspace),rollbackPath:String(journal.sourcePath)
  });
  if(!promoted?.ok)throw new Error('No se pudo promover SQLite workspace desde el Backup V2 source.');
  const refreshed=await globalThis.TradingResearchDesktopAuthority?.refreshFromNative?.();
  if(!refreshed?.active||!globalThis.TradingResearchDesktopAuthority?.active)
    throw new Error('SQLite workspace source se promovió, pero el runtime no pudo adoptar la nueva autoridad.');
  return true;
}
async function recoverOrRunRestore(prepared,journal){
  if(typeof trBackupV2RestoreProtocol!=='function')throw new Error('Restore Backup V2 no disponible.');
  await ensureWorkspaceAuthority(prepared,journal);
  const run=async()=>{
    const pending=typeof trBackupV2JournalGet==='function'?await trBackupV2JournalGet():null;
    if(pending){
      if(typeof trBackupV2RecoverPending!=='function')throw new Error('Existe journal Backup V2 pendiente, pero no está disponible su recuperación.');
      await trBackupV2RecoverPending(pending);
      return {recovered:true};
    }
    await trBackupV2RestoreProtocol(prepared);
    return {recovered:false};
  };
  const result=typeof TRDomainStore!=='undefined'&&TRDomainStore?.exclusive?
    await TRDomainStore.exclusive('backup.restore-v2.desktop-portable',run):await run();
  return result;
}
async function ensureNativeImages(){
  let check=await globalThis.TradingResearchDesktopNativeImages?.status?.(true);
  if(!check?.authority?.active){
    const result=await globalThis.TradingResearchDesktopNativeImages?.migrateNativeImages?.({silent:true});
    if(!result)throw new Error('No se pudo promover imágenes durante restore portable.');
    check=await globalThis.TradingResearchDesktopNativeImages?.status?.(true);
  }
  if(!check?.authority?.active||check.authority.deepVerified!==true)throw new Error('Autoridad nativa de imágenes no supera verificación profunda.');
  return check.authority;
}
async function ensureNativeMarket(){
  let check=await globalThis.TradingResearchDesktopNativeMarketData?.status?.(true);
  if(!check?.authority?.active){
    const result=await globalThis.TradingResearchDesktopNativeMarketData?.migrateNativeMarketData?.({silent:true});
    if(!result)throw new Error('No se pudo promover Market Data durante restore portable.');
    check=await globalThis.TradingResearchDesktopNativeMarketData?.status?.(true);
  }
  if(!check?.authority?.active||check.authority.deepVerified!==true)throw new Error('Autoridad nativa de Market Data no supera verificación profunda.');
  return check.authority;
}
async function finalVerify(prepared){
  if(!globalThis.TradingResearchDesktopAuthority?.active)throw new Error('SQLite workspace authority no está activa tras restore portable.');
  const nativeWorkspace=await call('desktop_read_authoritative_workspace');
  const nativePayload=nativeWorkspace?.payload?JSON.parse(String(nativeWorkspace.payload)):null;
  if(canonical(nativePayload)!==canonical(prepared.workspace))throw new Error('Workspace SQLite final no coincide exactamente con el Backup V2 source.');
  const images=await ensureNativeImages();
  const market=await ensureNativeMarket();
  const rebuilt=await trBackupV2Preflight(await trBackupV2BuildPayload());
  if(!sameHashes(prepared.manifest?.hashes,rebuilt.manifest?.hashes))throw new Error('Backup V2 final reconstruido desde autoridades nativas no conserva todos los hashes source.');
  return {workspaceRevision:Number(nativeWorkspace?.revision||0),images:Number(images.catalogRecords||0),market};
}
async function execute(prepared,journal,{announce=true}={}){
  setBlock(true);clearProbe();
  ui.busy=true;ui.lastError='';ui.journal=journal;paint();
  try{
    let j=journal;
    if(j.phase==='prepared'){
      await recoverOrRunRestore(prepared,j);
      j=await advance(j,'restored');
    }
    if(j.phase==='restored'){
      await ensureNativeImages();
      j=await advance(j,'images-native');
    }
    if(j.phase==='images-native'){
      await ensureNativeMarket();
      j=await advance(j,'market-native');
    }
    let verified=null;
    if(j.phase==='market-native'){
      verified=await finalVerify(prepared);
      j=await advance(j,'verified');
    }
    if(j.phase==='verified'){
      verified=verified||await finalVerify(prepared);
      // Do not refresh/render the application while the portable recovery
      // durable write lock is active. The real Windows smoke proved that this
      // could leave the session permanently behind «Cargando workspace…» even
      // though the durable restore had already completed. Release only the
      // write lock here, keep the visual veil, refresh, then clear the journal.
      releaseWriteBlockKeepVeil();
      await trBackupV2RefreshUiAfterRestore?.();
      await globalThis.TradingResearchDesktopNativeStorage?.refresh?.();
      await call('desktop_portable_restore_clear');
      ui.journal=null;ui.lastResult=verified;
      setBlock(false);
      paint();
      if(announce)alert('Restauración portable completada y verificada.\n\n'+sourceSummary(prepared)+
        '\n\nWorkspace SQLite + imágenes nativas + Market Data nativo confirmados tras reconstruir Backup V2.');
      return verified;
    }
    throw new Error('Fase portable no reconocida: '+String(j.phase));
  }catch(e){
    ui.lastError=e?.message||String(e);
    console.error('[Trading Research Desktop · Portable recovery]',e);
    holdRecoveryBlock();paint();
    if(announce)alert('La restauración portable no pudo finalizar: '+ui.lastError+
      '\n\nEl journal y los backups físicos se conservan. No introduzcas datos nuevos; al volver a abrir Desktop se intentará reanudar.');
    return null;
  }finally{ui.busy=false;paint();}
}
async function startFromFile(file){
  if(ui.busy||!file)return null;
  // A truly fresh Desktop may not yet have a SQLite workspace authority.
  // Portable recovery is allowed to promote the source Backup V2 itself, but
  // only after its physical source copy and portable journal are durably bound.
  const existingPortable=await call('desktop_portable_restore_status');
  if(existingPortable?.active){
    ui.journal=existingPortable;paint();
    alert('Ya existe una recuperación portable pendiente. Usa «Reanudar recuperación» en lugar de seleccionar otra copia.');
    return null;
  }
  if(typeof trBackupV2JournalGet==='function'&&await trBackupV2JournalGet()){
    alert('Existe una restauración Backup V2 pendiente. Debe recuperarse antes de iniciar un restore portable nuevo.');
    return null;
  }
  let sourceText,sourcePrepared;
  try{
    sourceText=await file.text();
    ({prepared:sourcePrepared}=await prepareText(sourceText));
  }catch(e){
    alert('El archivo seleccionado no supera Backup V2 preflight: '+(e?.message||String(e)));return null;
  }
  if(!confirm('Se restaurará este Backup V2 y se verificará toda la instalación nativa.\n\n'+sourceSummary(sourcePrepared)+
    '\n\nAntes de modificar datos se guardará un rollback completo del estado actual.\n\n¿Continuar?'))return null;
  ui.busy=true;paint();
  try{
    const currentRaw=await trBackupV2BuildPayload();
    await trBackupV2Preflight(currentRaw);
    const rollback=await streamBackupText(JSON.stringify(currentRaw),'portable-restore-target-rollback');
    const source=await streamBackupText(sourceText,'portable-restore-source');
    const journal=await call('desktop_portable_restore_begin',{
      sourcePath:String(source.path),sourceSha256:String(source.sha256),
      rollbackPath:String(rollback.path),rollbackSha256:String(rollback.sha256)
    });
    ui.journal=journal;
    return await execute(sourcePrepared,journal,{announce:true});
  }catch(e){
    ui.lastError=e?.message||String(e);paint();
    alert('No se pudo preparar el restore portable: '+ui.lastError);
    return null;
  }finally{ui.busy=false;paint();}
}
async function resumePending({announce=true}={}){
  acquireProbe();
  let journal;
  try{
    journal=await call('desktop_portable_restore_status');
    if(!journal?.active){clearProbe();ui.journal=null;paint();return {status:'none'};}
    ui.journal=journal;setBlock(true);clearProbe();paint();
    const text=await readNativeBackupText(journal.sourcePath);
    const {prepared}=await prepareText(text);
    const result=await execute(prepared,journal,{announce});
    return result?{status:'completed',result}:{status:'pending'};
  }catch(e){
    clearProbe();holdRecoveryBlock();
    ui.lastError=e?.message||String(e);paint();
    console.error('[Trading Research Desktop · Portable recovery bootstrap]',e);
    if(announce)alert('Existe un restore portable pendiente que no puede reanudarse automáticamente: '+ui.lastError+
      '\n\nNo introduzcas datos nuevos. Conserva la carpeta AppLocalData y los .trbackup.');
    return {status:'blocked',error:ui.lastError};
  }
}
function panel(){
  const j=ui.journal;
  return '<section class="card panel" id="desktop-portable-recovery-panel">'+
    '<div class="panel-title"><div><h3>Desktop · recuperación portable</h3><small>Batch 79: un Backup V2 reconstruye workspace, imágenes y Market Data nativos con journal reanudable.</small></div>'+
    '<span class="stable-pill '+(ui.lastError?'bad':j?'warn':ui.lastResult?'ok':'')+'">'+(ui.lastError?'ERROR':ui.busy?'TRABAJANDO':j?'RECUPERANDO':ui.lastResult?'VERIFICADO':'LISTO')+'</span></div>'+
    '<div class="actions">'+(!j?'<button class="btn primary" type="button" data-desktop-portable-action="restore" '+(ui.busy?'disabled':'')+'>Restaurar Backup V2 portable</button>':'')+
    (j?'<button class="btn primary" type="button" data-desktop-portable-action="resume" '+(ui.busy?'disabled':'')+'>Reanudar recuperación</button>':'')+
    '<button class="btn small" type="button" data-desktop-portable-action="refresh">Actualizar estado</button></div>'+
    '<div class="notice">'+(j?'<strong>Restore pendiente:</strong> fase '+esc(j.phase)+'<br><strong>Source:</strong> '+esc(j.sourcePath):
      ui.lastResult?'<strong>Última recuperación:</strong> verificada · imágenes '+esc(ui.lastResult.images)+' · revisión workspace '+esc(ui.lastResult.workspaceRevision):
      'No hay restore portable pendiente.')+
    (ui.lastError?'<br><strong>Error:</strong> '+esc(ui.lastError):'')+'</div>'+
    '<input id="desktopPortableRestoreFile" type="file" accept=".trbackup,application/json" hidden /></section>';
}
function paint(){const host=document.getElementById('desktop-portable-recovery-host');if(host)host.innerHTML=panel();}
function mount(){
  if(document.getElementById('desktop-portable-recovery-host'))return;
  const base=document.getElementById('desktop-native-market-host')||document.getElementById('desktop-native-images-host')||document.getElementById('trDesktopNativeStorage');
  if(!base)return;
  const host=document.createElement('div');host.id='desktop-portable-recovery-host';base.insertAdjacentElement('afterend',host);paint();
}
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-desktop-portable-action]');if(!b)return;
  const action=b.dataset.desktopPortableAction;
  if(action==='restore')document.getElementById('desktopPortableRestoreFile')?.click();
  else if(action==='resume')void resumePending({announce:true});
  else if(action==='refresh')void (async()=>{try{ui.journal=await call('desktop_portable_restore_status');if(!ui.journal?.active)ui.journal=null;ui.lastError='';}catch(err){ui.lastError=err?.message||String(err);}paint();})();
});
document.addEventListener('change',e=>{
  if(e.target?.id!=='desktopPortableRestoreFile')return;
  const file=e.target.files?.[0]||null;e.target.value='';
  if(file)void startFromFile(file);
});
new MutationObserver(()=>mount()).observe(document.documentElement,{childList:true,subtree:true});
globalThis.TradingResearchDesktopPortableRecovery=Object.freeze({startFromFile,resumePending,get state(){return JSON.parse(JSON.stringify(ui));}});
acquireProbe();
setTimeout(()=>{mount();void resumePending({announce:true});},0);
})();