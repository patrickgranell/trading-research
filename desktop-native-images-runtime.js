/* Trading Research Desktop 0.5 candidate · Batch 77 native image migration.
 * Web is untouched. Migration is Backup-V2-first and fails closed.
 */
(()=>{
'use strict';
const invoke=globalThis.__TAURI__?.core?.invoke;
if(typeof invoke!=='function')return;
const LOCK='desktop-native-image-migration';
const ui={busy:false,lastError:'',lastRollbackPath:'',staging:null,authority:null};
function parse(v){if(typeof v==='string'){try{return JSON.parse(v);}catch{}}return v;}
async function call(cmd,args={}){return parse(await invoke(cmd,args));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function short(v){return String(v||'').slice(0,12)||'—';}
function expectedFrom(images){
  return (images||[]).map(im=>[String(im.id),String(im.sha256)]).sort((a,b)=>a[0].localeCompare(b[0]));
}
async function status(deep=false){
  try{
    ui.staging=await call('desktop_native_image_staging_status');
    ui.authority=await call('desktop_native_image_authority_status',{deep:!!deep});
    ui.lastError='';
  }catch(e){ui.lastError=e?.message||String(e);}
  paint();return {staging:ui.staging,authority:ui.authority};
}
async function beginMigration(){
  if(!globalThis.TradingResearchDesktopAuthority?.active)throw new Error('SQLite workspace authority todavía no está activa.');
  if(globalThis.TradingResearchDesktopImageAuthority?.active)throw new Error('Las imágenes ya usan autoridad nativa.');
  if(typeof trCoreFlush!=='function'||!(await trCoreFlush()))throw new Error('No se pudo confirmar el workspace antes de migrar imágenes.');
  globalThis.TradingResearchDesktopImageBridge?.setMigrationPending?.(true);
  if(typeof trCoreSetWriteBlock==='function')trCoreSetWriteBlock(LOCK);
}
function endMigration(){
  globalThis.TradingResearchDesktopImageBridge?.setMigrationPending?.(false);
  if(typeof trCoreClearWriteBlock==='function')trCoreClearWriteBlock(LOCK);
}
async function prepareStaging(){
  if(typeof trBackupV2BuildPayload!=='function'||typeof trBackupV2Preflight!=='function')throw new Error('Backup V2 no está disponible.');
  const raw=await trBackupV2BuildPayload();
  const prepared=await trBackupV2Preflight(raw);
  const rollback=await call('desktop_write_backup',{payload:JSON.stringify(raw),label:'desktop-image-stage-rollback'});
  if(!rollback?.ok||!rollback.path||!(Number(rollback.bytes)>0))throw new Error('No se confirmó el rollback físico previo.');
  ui.lastRollbackPath=String(rollback.path);
  const images=prepared.images||[];
  for(const im of images){
    await call('desktop_stage_native_image',{
      id:String(im.id),data:String(im.data),sha256:String(im.sha256),
      mime:String(im.type||'application/octet-stream'),name:String(im.name||'imagen')
    });
  }
  const expected=expectedFrom(images);
  const verified=await call('desktop_verify_staged_images',{expected:JSON.stringify(expected)});
  if(!verified?.ok||Number(verified.stagedImages)!==expected.length)throw new Error('El staging nativo no confirmó todo el inventario.');
  const final=await call('desktop_finalize_native_image_staging',{expected:JSON.stringify(expected),rollbackPath:String(rollback.path)});
  if(!final?.ok||final?.authority!==false||Number(final.stagedImages)!==expected.length)throw new Error('No se pudo cerrar el staging nativo de imágenes.');
  return {raw,prepared,rollback,expected,final};
}
async function stageReferencedImages(){
  if(ui.busy)return null;
  ui.busy=true;ui.lastError='';ui.lastRollbackPath='';paint();let rollback=null;
  try{
    await beginMigration();
    const staged=await prepareStaging();rollback=staged.rollback;
    await status(false);
    alert('Preparación nativa de imágenes completada sin cambiar la autoridad.\n\nImágenes verificadas: '+staged.expected.length+'\nRollback físico: '+rollback.path);
    return staged.final;
  }catch(e){
    ui.lastError=e?.message||String(e);console.error('[Trading Research Desktop · Native image staging]',e);
    alert('No se pudo preparar el almacenamiento nativo de imágenes: '+ui.lastError+(rollback?.path||ui.lastRollbackPath?'\n\nRollback conservado en:\n'+String(rollback?.path||ui.lastRollbackPath):''));
    return null;
  }finally{endMigration();ui.busy=false;paint();}
}
async function migrateNativeImages(){
  if(ui.busy)return null;
  ui.busy=true;ui.lastError='';ui.lastRollbackPath='';paint();
  let rollback=null,promoted=false;
  try{
    await beginMigration();
    const staged=await prepareStaging();rollback=staged.rollback;
    const promotedResult=await call('desktop_promote_native_image_authority',{
      expected:JSON.stringify(staged.expected),rollbackPath:String(rollback.path)
    });
    if(!promotedResult?.ok||!promotedResult?.active||Number(promotedResult.generation)!==1)throw new Error('La promoción nativa no confirmó generación inicial.');
    promoted=true;
    globalThis.TradingResearchDesktopImageBridge?.setPromoted?.(Number(promotedResult.generation));
    const native=await call('desktop_native_image_authority_status',{deep:true});
    if(!native?.active||Number(native.generation)!==1||Number(native.catalogRecords)!==staged.expected.length)throw new Error('Readback profundo de autoridad nativa no coincide.');
    // Rebuild Backup V2 through the now-active native adapter. This proves
    // Backup/restore reads no longer depend on stale Image IndexedDB.
    const post=await trBackupV2Preflight(await trBackupV2BuildPayload());
    const postExpected=expectedFrom(post.images||[]);
    if(JSON.stringify(postExpected)!==JSON.stringify(staged.expected))throw new Error('Backup V2 posterior a promoción no conserva exactamente los hashes de imágenes.');
    await status(true);
    endMigration();
    alert('Migración de imágenes completada.\n\nAutoridad: NATIVA · generación '+Number(ui.authority?.generation||1)+
      '\nImágenes verificadas: '+staged.expected.length+'\nRollback previo: '+rollback.path);
    return promotedResult;
  }catch(e){
    ui.lastError=e?.message||String(e);console.error('[Trading Research Desktop · Native image migration]',e);
    if(promoted)globalThis.TradingResearchDesktopImageBridge?.block?.(e);
    else endMigration();
    alert('No se pudo completar la migración nativa de imágenes: '+ui.lastError+(rollback?.path||ui.lastRollbackPath?'\n\nRollback conservado en:\n'+String(rollback?.path||ui.lastRollbackPath):''));
    return null;
  }finally{
    if(!promoted)endMigration();
    ui.busy=false;paint();
  }
}
async function verifyNativeImages(){
  const result=await status(true);
  if(result.authority?.active)alert('Autoridad nativa de imágenes verificada.\n\nGeneración: '+result.authority.generation+
    '\nRegistros: '+result.authority.catalogRecords);
  return result;
}
function panel(){
  const a=ui.authority,s=ui.staging,active=!!a?.active;
  return '<section class="card panel" id="desktop-native-images-panel">'+
    '<div class="panel-title"><div><h3>Desktop · imágenes nativas</h3><small>Batch 77: almacenamiento local content-addressed con SHA-256 y rollback Backup V2.</small></div>'+
    '<span class="stable-pill '+(ui.lastError?'bad':active||s?.complete?'ok':'')+'">'+
      (ui.lastError?'ERROR':ui.busy?'TRABAJANDO':active?'NATIVO':s?.complete?'STAGING OK':'INDEXEDDB')+'</span></div>'+
    '<div class="actions">'+(!active?'<button class="btn primary" type="button" data-desktop-native-images-action="migrate" '+(ui.busy?'disabled':'')+'>Migrar imágenes a nativo</button>':'')+
    '<button class="btn" type="button" data-desktop-native-images-action="verify">Verificar imágenes</button>'+
    '<button class="btn small" type="button" data-desktop-native-images-action="refresh">Actualizar estado</button></div>'+
    '<div class="notice"><strong>Autoridad de imágenes:</strong> '+(active?'NATIVA · generación '+Number(a.generation||0):'IndexedDB')+
      (active?' · '+Number(a.catalogRecords||0)+' registro(s)':s?.complete?' · staging '+Number(s.catalogRecords||0)+' registro(s) / '+Number(s.objects||0)+' objeto(s) · '+short(s.inventorySha256):'')+
      (ui.lastError?'<br><strong>Error:</strong> '+esc(ui.lastError):'')+
    '</div></section>';
}
function paint(){const host=document.getElementById('desktop-native-images-host');if(host)host.innerHTML=panel();}
function mount(){
  // MutationObserver watches childList. Repainting an already-mounted host from
  // inside the observer changes childList again and creates an infinite loop.
  // Existing host means there is nothing to mount; explicit state changes call
  // paint() themselves.
  if(document.getElementById('desktop-native-images-host'))return;
  const native=document.getElementById('trDesktopNativeStorage');if(!native)return;
  const host=document.createElement('div');host.id='desktop-native-images-host';native.insertAdjacentElement('afterend',host);paint();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-desktop-native-images-action]');if(!b)return;
  const a=b.dataset.desktopNativeImagesAction;
  if(a==='migrate')void migrateNativeImages();
  else if(a==='verify')void verifyNativeImages();
  else if(a==='refresh')void status(false);
});
new MutationObserver(()=>mount()).observe(document.documentElement,{childList:true,subtree:true});
globalThis.TradingResearchDesktopNativeImages={
  stageReferencedImages,migrateNativeImages,verifyNativeImages,status,
  get state(){return JSON.parse(JSON.stringify(ui));}
};
setTimeout(()=>{mount();void status(false);},0);
})();