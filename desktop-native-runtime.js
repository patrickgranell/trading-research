/* Trading Research Desktop 0.3 · native recovery foundation.
 * Desktop-only: injected after the normal verified web build.
 * IndexedDB remains authoritative for daily writes. SQLite now holds:
 * 1) a byte-parity workspace shadow, and
 * 2) one complete Backup V2 recovery snapshot for controlled recovery.
 */
(()=>{
'use strict';
const VERSION='0.3.0';
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
function backupCounts(prepared){
  const c=prepared?.manifest?.counts||{};
  return 'Planes: '+Number(c.plans||0)+' · Operaciones: '+Number(c.operations||0)+' · Imágenes: '+Number(c.images||0)+' · Market Data: '+Number(c.marketMeta||0)+' histórico(s), '+Number(c.execSets||0)+' Grid(s)';
}

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
async function buildCertifiedBackupV2(){
  if(typeof trBackupV2BuildPayload!=='function'||typeof trBackupV2Preflight!=='function')throw new Error('Backup V2 certificado no está disponible.');
  const payload=await trBackupV2BuildPayload();
  const prepared=await trBackupV2Preflight(payload);
  return {payload,prepared};
}
async function writeNativeBackup(){
  try{
    const {payload}=await buildCertifiedBackupV2();
    const result=await call('desktop_write_backup',{payload:JSON.stringify(payload),label:'backup-v2'});
    await refreshStatus();
    alert('Backup V2 nativo creado correctamente en:\n\n'+result.path);
    return result;
  }catch(e){status.lastError=e?.message||String(e);paint();alert('No se pudo crear el backup nativo: '+status.lastError);return null;}
}
async function createRecoverySnapshot(){
  if(status.busy)return null;
  status.busy=true;paint();
  try{
    const {payload,prepared}=await buildCertifiedBackupV2();
    const result=await call('desktop_store_recovery_snapshot',{
      payload:JSON.stringify(payload),
      source:'manual-certified-backup-v2'
    });
    await refreshStatus();
    alert('Punto de recuperación SQLite creado y validado.\n\n'+backupCounts(prepared)+'\n\nTamaño: '+fmtBytes(result.bytes)+' · Hash: '+shortHash(result.sha256));
    return result;
  }catch(e){status.lastError=e?.message||String(e);paint();alert('No se pudo crear el punto de recuperación SQLite: '+status.lastError);return null;}
  finally{status.busy=false;paint();}
}
async function readRecoveryPrepared(){
  if(typeof trBackupV2Preflight!=='function')throw new Error('Preflight Backup V2 no está disponible.');
  const rawText=await invoke('desktop_read_recovery_snapshot');
  if(!rawText)throw new Error('Todavía no existe un punto de recuperación SQLite.');
  const raw=JSON.parse(String(rawText));
  const prepared=await trBackupV2Preflight(raw);
  return {rawText:String(rawText),raw,prepared};
}
async function verifyRecoverySnapshot(){
  try{
    const {prepared}=await readRecoveryPrepared();
    await refreshStatus();
    const r=status.native?.recovery||{};
    alert('Punto de recuperación SQLite válido.\n\n'+backupCounts(prepared)+'\n\nCreado: '+String(r.createdAt||'—')+'\nTamaño: '+fmtBytes(r.bytes)+' · Hash: '+shortHash(r.sha256));
    return true;
  }catch(e){status.lastError=e?.message||String(e);paint();alert('El punto de recuperación SQLite no pudo validarse: '+status.lastError);return false;}
}
async function restoreRecoverySnapshot(){
  if(status.busy)return false;
  let rollbackResult=null;
  try{
    const {prepared}=await readRecoveryPrepared();
    const r=status.native?.recovery||{};
    const accepted=confirm(
      'Restaurar el punto de recuperación SQLite sustituirá el workspace, imágenes y Market Data actuales.\n\n'+
      backupCounts(prepared)+'\nCreado: '+String(r.createdAt||'—')+
      '\n\nAntes de restaurar se creará automáticamente un Backup V2 de rollback del estado actual.\n\n¿Continuar?'
    );
    if(!accepted)return false;

    status.busy=true;paint();
    const current=await buildCertifiedBackupV2();
    rollbackResult=await call('desktop_write_backup',{
      payload:JSON.stringify(current.payload),
      label:'desktop-recovery-rollback'
    });

    if(typeof trBackupV2RestoreProtocol!=='function'||typeof trBackupV2RefreshUiAfterRestore!=='function')throw new Error('Protocolo de restore Backup V2 no está disponible.');
    if(typeof trBackupV2SetRecoveryUiBlocked==='function')trBackupV2SetRecoveryUiBlocked(true);
    const run=()=>trBackupV2RestoreProtocol(prepared);
    if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.exclusive)await TRDomainStore.exclusive('backup.restore-v2.desktop-sqlite',run);
    else await run();

    await trBackupV2RefreshUiAfterRestore();
    if(typeof trBackupV2SetRecoveryUiBlocked==='function')trBackupV2SetRecoveryUiBlocked(false);
    await mirror('desktop-recovery-restore');
    await refreshStatus();
    alert('Recuperación SQLite completada y confirmada de forma durable.\n\nBackup de rollback previo:\n'+rollbackResult.path);
    return true;
  }catch(e){
    try{
      const pending=typeof trBackupV2JournalGet==='function'?await trBackupV2JournalGet().catch(()=>null):null;
      if(pending&&typeof trBackupV2AcquireRecoveryLock==='function')trBackupV2AcquireRecoveryLock(pending);
      if(typeof trBackupV2SetRecoveryUiBlocked==='function')trBackupV2SetRecoveryUiBlocked(!!pending);
    }catch{}
    status.lastError=e?.message||String(e);paint();
    alert('No se pudo completar la recuperación SQLite: '+status.lastError+(rollbackResult?.path?'\n\nBackup de rollback conservado en:\n'+rollbackResult.path:''));
    return false;
  }finally{status.busy=false;paint();}
}
function panelHtml(){
  const n=status.native||{},s=n.shadow||null;
  const stateLabel=status.lastError?'ERROR':status.busy?'TRABAJANDO':s?'OK':'SIN COPIA';
  return '<section id="trDesktopNativeStorage" class="card panel config-wide">'+
    '<div class="panel-title"><div><h3>Desktop · almacenamiento local</h3>'+
    '<div class="help">Desktop 0.3 mantiene IndexedDB como autoridad diaria, verifica un espejo SQLite y permite guardar/restaurar un punto de recuperación Backup V2 completo dentro de SQLite.</div></div>'+
    '<span class="stable-pill">'+escDesktop(stateLabel)+'</span></div>'+
    '<div class="security-actions">'+
    '<button class="btn primary" type="button" data-desktop-native-action="parity">Sincronizar y verificar SQLite</button>'+
    '<button class="btn" type="button" data-desktop-native-action="recovery-create">Crear punto de recuperación</button>'+
    '<button class="btn" type="button" data-desktop-native-action="recovery-verify">Verificar recuperación</button>'+
    '<button class="btn" type="button" data-desktop-native-action="recovery-restore">Restaurar desde SQLite</button>'+
    '<button class="btn" type="button" data-desktop-native-action="backup">Crear backup nativo</button>'+
    '<button class="btn small" type="button" data-desktop-native-action="refresh">Actualizar estado</button>'+
    '</div>'+
    '<div class="notice" id="trDesktopNativeStorageStatus">'+statusHtml()+'</div>'+
    '</section>';
}
function statusHtml(){
  const n=status.native||{},s=n.shadow||null,r=n.recovery||null;
  if(status.lastError)return '<strong>Error nativo:</strong> '+escDesktop(status.lastError);
  if(!status.ready)return 'Inicializando almacenamiento local…';
  return '<strong>SQLite:</strong> '+escDesktop(n.dbPath||'—')+
    '<br><strong>Espejo:</strong> '+(s?escDesktop(s.updatedAt)+' · '+fmtBytes(s.bytes)+' · '+shortHash(s.sha256):'todavía vacío')+
    '<br><strong>Recuperación completa:</strong> '+(r?escDesktop(r.createdAt)+' · '+fmtBytes(r.bytes)+' · '+shortHash(r.sha256):'todavía no creada')+
    '<br><strong>Backups:</strong> '+escDesktop(n.backupCount??0)+' · '+escDesktop(n.backupPath||'—')+
    '<br><strong>Imágenes:</strong> directorio preparado · '+escDesktop(n.imagesPath||'—');
}
function paint(){
  const box=document.getElementById('trDesktopNativeStorageStatus');if(box)box.innerHTML=statusHtml();
  const pill=document.querySelector('#trDesktopNativeStorage .stable-pill');
  if(pill)pill.textContent=status.lastError?'ERROR':status.busy?'TRABAJANDO':status.native?.shadow?'OK':'SIN COPIA';
}
function ensurePanel(){
  if(document.getElementById('trDesktopNativeStorage'))return;
  const heading=[...document.querySelectorAll('h3')].find(el=>/Copias de seguridad/i.test(el.textContent||''));
  const anchor=heading?.closest('section');
  if(!anchor)return;
  anchor.insertAdjacentHTML('afterend',panelHtml());
}
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-desktop-native-action]');if(!button)return;
  const action=button.getAttribute('data-desktop-native-action');
  if(action==='parity')void verifyParity();
  else if(action==='recovery-create')void createRecoverySnapshot();
  else if(action==='recovery-verify')void verifyRecoverySnapshot();
  else if(action==='recovery-restore')void restoreRecoverySnapshot();
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
  version:VERSION,
  status:()=>JSON.parse(JSON.stringify(status)),
  refresh:refreshStatus,
  mirror,
  verifyParity,
  writeNativeBackup,
  createRecoverySnapshot,
  verifyRecoverySnapshot,
  restoreRecoverySnapshot
});
void bootstrap();
})();
