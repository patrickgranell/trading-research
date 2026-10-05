/* Trading Research Desktop 0.5 candidate · Batch 77 native image staging.
 * Non-authoritative until explicit promotion lands and is certified.
 */
(()=>{
'use strict';
const invoke=globalThis.__TAURI__?.core?.invoke;
if(typeof invoke!=='function')return;
const ui={busy:false,lastError:'',native:null};
function parse(v){if(typeof v==='string'){try{return JSON.parse(v);}catch{}}return v;}
async function call(cmd,args={}){return parse(await invoke(cmd,args));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function short(v){return String(v||'').slice(0,12)||'—';}
async function status(){
  try{ui.native=await call('desktop_native_image_staging_status');ui.lastError='';}
  catch(e){ui.lastError=e?.message||String(e);}
  paint();return ui.native;
}
async function stageReferencedImages(){
  if(ui.busy)return null;
  ui.busy=true;ui.lastError='';paint();
  let rollback=null;
  try{
    if(!globalThis.TradingResearchDesktopAuthority?.active)throw new Error('SQLite workspace authority todavía no está activa.');
    if(typeof trCoreFlush!=='function'||!(await trCoreFlush()))throw new Error('No se pudo confirmar el workspace antes del staging de imágenes.');
    if(typeof trBackupV2BuildPayload!=='function'||typeof trBackupV2Preflight!=='function')throw new Error('Backup V2 no está disponible.');
    const raw=await trBackupV2BuildPayload();
    const prepared=await trBackupV2Preflight(raw);
    rollback=await call('desktop_write_backup',{payload:JSON.stringify(raw),label:'desktop-image-stage-rollback'});
    if(!rollback?.path)throw new Error('No se confirmó el rollback físico previo.');
    const images=prepared.images||[];
    for(const im of images){
      await call('desktop_stage_native_image',{
        id:String(im.id),data:String(im.data),sha256:String(im.sha256),
        mime:String(im.type||'application/octet-stream'),name:String(im.name||'imagen')
      });
    }
    const expected=images.map(im=>[String(im.id),String(im.sha256)]).sort((a,b)=>a[0].localeCompare(b[0]));
    const verified=await call('desktop_verify_staged_images',{expected:JSON.stringify(expected)});
    if(!verified?.ok||Number(verified.stagedImages)!==expected.length)throw new Error('El staging nativo no confirmó todo el inventario.');
    const final=await call('desktop_finalize_native_image_staging',{expected:JSON.stringify(expected),rollbackPath:String(rollback.path)});
    if(!final?.ok||final?.authority!==false||Number(final.stagedImages)!==expected.length)throw new Error('No se pudo cerrar el staging nativo de imágenes.');
    ui.native=await call('desktop_native_image_staging_status');
    alert('Preparación nativa de imágenes completada sin cambiar la autoridad.\n\nImágenes verificadas: '+expected.length+'\nRollback físico: '+rollback.path);
    return final;
  }catch(e){
    ui.lastError=e?.message||String(e);
    console.error('[Trading Research Desktop · Native image staging]',e);
    alert('No se pudo preparar el almacenamiento nativo de imágenes: '+ui.lastError+(rollback?.path?'\n\nRollback conservado en:\n'+rollback.path:''));
    return null;
  }finally{ui.busy=false;paint();}
}
function panel(){
  const n=ui.native;
  return '<section class="card panel" id="desktop-native-images-panel">'+
    '<div class="panel-title"><div><h3>Desktop · imágenes nativas</h3><small>Batch 77: copia nativa verificada en preparación; IndexedDB sigue siendo la autoridad de imágenes.</small></div>'+
    '<span class="pill '+(ui.lastError?'bad':n?.complete?'ok':'')+'">'+(ui.lastError?'ERROR':ui.busy?'TRABAJANDO':n?.complete?'STAGING OK':'NO PREPARADO')+'</span></div>'+
    '<div class="actions"><button class="btn" type="button" data-desktop-native-images-action="stage" '+(ui.busy?'disabled':'')+'>Preparar copia nativa</button>'+
    '<button class="btn" type="button" data-desktop-native-images-action="refresh">Actualizar estado</button></div>'+
    '<div class="notice"><strong>Autoridad de imágenes:</strong> IndexedDB'+
      (n?.complete?' · staging nativo '+Number(n.catalogRecords||0)+' registro(s) / '+Number(n.objects||0)+' objeto(s) · '+short(n.inventorySha256):'')+
      (ui.lastError?'<br><strong>Error:</strong> '+esc(ui.lastError):'')+
    '</div></section>';
}
function paint(){
  const host=document.getElementById('desktop-native-images-host');
  if(host)host.innerHTML=panel();
}
function mount(){
  if(document.getElementById('desktop-native-images-host')){paint();return;}
  const native=document.getElementById('desktop-native-storage-card')||document.querySelector('[data-desktop-native-storage]');
  if(!native)return;
  const host=document.createElement('div');host.id='desktop-native-images-host';
  native.insertAdjacentElement('afterend',host);paint();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-desktop-native-images-action]');if(!b)return;
  const a=b.dataset.desktopNativeImagesAction;
  if(a==='stage')void stageReferencedImages();
  else if(a==='refresh')void status();
});
const observer=new MutationObserver(()=>mount());observer.observe(document.documentElement,{childList:true,subtree:true});
globalThis.TradingResearchDesktopNativeImages={stageReferencedImages,status,get state(){return JSON.parse(JSON.stringify(ui));}};
setTimeout(()=>{mount();void status();},0);
})();