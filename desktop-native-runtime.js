/* Trading Research Desktop 0.2 · native storage shadow layer.
 * Desktop-only: injected after the normal verified web build.
 * IndexedDB remains authoritative in this batch; SQLite is a parity-checked shadow.
 */
(()=>{
'use strict';
const VERSION='0.2.0';
const invoke=globalThis.__TAURI__?.core?.invoke;
if(typeof invoke!=='function')return;

let status={version:VERSION,ready:false,busy:false,lastMirror:null,lastError:'',native:null};
let mirrorTimer=null;

function parseNative(value){
  if(value===null||value===undefined)return value;
  if(typeof value==='string'){try{return JSON.parse(value);}catch{return value;}}
  return value;
}
async function call(command,args={}){return parseNative(await invoke(command,args));}
function workspaceSnapshot(){
  if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.snapshot)return TRDomainStore.snapshot();
  if(typeof state!=='undefined')return JSON.parse(JSON.stringify(state));
  throw new Error('Workspace no disponible.');
}
function workspaceJson(){return JSON.stringify(workspaceSnapshot());}
function fmtBytes(n){const v=Number(n)||0;if(v<1024)return v+' B';if(v<1024*1024)return (v/1024).toFixed(1)+' KB';return (v/1024/1024).toFixed(1)+' MB';}
function shortHash(v){return String(v||'').slice(0,12)||'—';}
function escDesktop(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function refreshStatus(){
  try{
    status.native=await call('desktop_storage_status');
    status.ready=true;status.lastError='';
  }catch(e){status.lastError=e?.message||String(e);}
  paint();
  return status.native;
}
async function mirror(reason='desktop-auto'){
  if(status.busy)return null;
  status.busy=true;paint();
  try{
    const payload=workspaceJson();
    const meta=await call('desktop_mirror_workspace',{payload,reason:String(reason||'desktop-auto')});
    status.lastMirror=meta;status.lastError='';
    await refreshStatus();
    return meta;
  }catch(e){
    status.lastError=e?.message||String(e);paint();console.error('[Trading Research Desktop · SQLite mirror]',e);return null;
  }finally{status.busy=false;paint();}
}
function scheduleMirror(reason='domain-commit'){
  clearTimeout(mirrorTimer);
  mirrorTimer=setTimeout(()=>void mirror(reason),500);
}
async function verifyParity(){
  try{
    if(typeof trCoreFlush==='function'){
      const ok=await trCoreFlush();
      if(!ok)throw new Error('IndexedDB no pudo completar flush antes de comparar.');
    }
    await mirror('manual-parity');
    const nativePayload=await invoke('desktop_read_workspace_shadow');
    const current=workspaceJson();
    const same=String(nativePayload||'')===current;
    await refreshStatus();
    alert(same
      ? 'SQLite coincide exactamente con el workspace actual.'
      : 'SQLite NO coincide con el workspace actual. IndexedDB sigue siendo la autoridad; no se ha sustituido ningún dato.');
    return same;
  }catch(e){status.lastError=e?.message||String(e);paint();alert('No se pudo verificar SQLite: '+status.lastError);return false;}
}
async function writeNativeBackup(){
  try{
    if(typeof trBackupV2BuildPayload!=='function')throw new Error('Backup V2 builder no está disponible.');
    const payload=await trBackupV2BuildPayload();
    const result=await call('desktop_write_backup',{payload:JSON.stringify(payload)});
    await refreshStatus();
    alert('Backup V2 nativo creado correctamente en:\n\n'+result.path);
    return result;
  }catch(e){status.lastError=e?.message||String(e);paint();alert('No se pudo crear el backup nativo: '+status.lastError);return null;}
}
function panelHtml(){
  const n=status.native||{},s=n.shadow||null;
  const stateLabel=status.lastError?'ERROR':status.busy?'GUARDANDO':s?'OK':'SIN COPIA';
  return '<section id="trDesktopNativeStorage" class="card panel config-wide">'+
    '<div class="panel-title"><div><h3>Desktop · almacenamiento local</h3>'+
    '<div class="help">Desktop 0.2 mantiene IndexedDB como autoridad y guarda un espejo verificable en SQLite. Los backups nativos usan el mismo formato Backup V2.</div></div>'+
    '<span class="stable-pill">'+escDesktop(stateLabel)+'</span></div>'+
    '<div class="security-actions">'+
    '<button class="btn primary" type="button" data-desktop-native-action="parity">Sincronizar y verificar SQLite</button>'+
    '<button class="btn" type="button" data-desktop-native-action="backup">Crear backup nativo</button>'+
    '<button class="btn small" type="button" data-desktop-native-action="refresh">Actualizar estado</button>'+
    '</div>'+
    '<div class="notice" id="trDesktopNativeStorageStatus">'+statusHtml()+'</div>'+
    '</section>';
}
function statusHtml(){
  const n=status.native||{},s=n.shadow||null;
  if(status.lastError)return '<strong>Error nativo:</strong> '+escDesktop(status.lastError);
  if(!status.ready)return 'Inicializando almacenamiento local…';
  return '<strong>SQLite:</strong> '+escDesktop(n.dbPath||'—')+
    '<br><strong>Espejo:</strong> '+(s?escDesktop(s.updatedAt)+' · '+fmtBytes(s.bytes)+' · '+shortHash(s.sha256):'todavía vacío')+
    '<br><strong>Backups:</strong> '+escDesktop(n.backupCount??0)+' · '+escDesktop(n.backupPath||'—')+
    '<br><strong>Imágenes:</strong> directorio preparado · '+escDesktop(n.imagesPath||'—');
}
function paint(){
  const box=document.getElementById('trDesktopNativeStorageStatus');if(box)box.innerHTML=statusHtml();
  const pill=document.querySelector('#trDesktopNativeStorage .stable-pill');
  if(pill)pill.textContent=status.lastError?'ERROR':status.busy?'GUARDANDO':status.native?.shadow?'OK':'SIN COPIA';
}
function ensurePanel(){
  if(document.getElementById('trDesktopNativeStorage')){paint();return;}
  const heading=[...document.querySelectorAll('h3')].find(el=>/Copias de seguridad/i.test(el.textContent||''));
  const anchor=heading?.closest('section');
  if(!anchor)return;
  anchor.insertAdjacentHTML('afterend',panelHtml());
}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-desktop-native-action]');if(!button)return;
  const action=button.getAttribute('data-desktop-native-action');
  if(action==='parity')void verifyParity();
  else if(action==='backup')void writeNativeBackup();
  else if(action==='refresh')void refreshStatus();
});
new MutationObserver(()=>ensurePanel()).observe(document.documentElement,{subtree:true,childList:true});

if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.subscribe){
  TRDomainStore.subscribe(batch=>scheduleMirror('domain:'+(batch?.label||'commit')));
}
async function bootstrap(){
  for(let i=0;i<200;i++){
    const ready=globalThis.TradingResearchCoreHydrationReadContract?.ready?.();
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  await refreshStatus();
  await mirror('desktop-bootstrap');
  ensurePanel();
}
globalThis.TradingResearchDesktopNativeStorage=Object.freeze({
  version:VERSION,status:()=>JSON.parse(JSON.stringify(status)),refresh:refreshStatus,mirror,verifyParity,writeNativeBackup
});
void bootstrap();
})();
