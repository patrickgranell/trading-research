/* Trading Research Desktop 0.6 candidate · Batch 78 native Market Data migration.
 * Web remains IndexedDB. Migration is Backup-V2-first, chunked and fail-closed.
 */
(()=>{
'use strict';
const invoke=globalThis.__TAURI__?.core?.invoke;
if(typeof invoke!=='function')return;
const LOCK='desktop-native-market-migration';
const ui={busy:false,lastError:'',lastRollbackPath:'',staging:null,authority:null};
function parse(v){if(typeof v==='string'){try{return JSON.parse(v);}catch{}}return v;}
async function call(cmd,args={}){return parse(await invoke(cmd,args));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function shaText(value){
  const bytes=new TextEncoder().encode(String(value));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function status(deep=false){
  try{
    ui.staging=await call('desktop_market_staging_status');
    ui.authority=await call('desktop_market_authority_status',{deep:!!deep});
    ui.lastError='';
  }catch(e){ui.lastError=e?.message||String(e);}
  paint();return {staging:ui.staging,authority:ui.authority};
}
async function beginMigration(){
  if(!globalThis.TradingResearchDesktopAuthority?.active)throw new Error('SQLite workspace authority todavía no está activa.');
  if(!globalThis.TradingResearchDesktopImageAuthority?.active)throw new Error('Las imágenes deben usar autoridad nativa antes de migrar Market Data.');
  if(globalThis.TradingResearchDesktopMarketAuthority?.active)throw new Error('Market Data ya usa autoridad nativa.');
  if(typeof trCoreFlush!=='function'||!(await trCoreFlush()))throw new Error('No se pudo confirmar el workspace antes de migrar Market Data.');
  globalThis.TradingResearchDesktopMarketBridge?.setMigrationPending?.(true);
  if(typeof trCoreSetWriteBlock==='function')trCoreSetWriteBlock(LOCK);
}
function endMigration(){
  globalThis.TradingResearchDesktopMarketBridge?.setMigrationPending?.(false);
  if(typeof trCoreClearWriteBlock==='function')trCoreClearWriteBlock(LOCK);
}
async function stageTicks(generation,rec){
  const id=String(rec?.id||''),ticks=Array.isArray(rec?.ticks)?rec.ticks:[];
  if(!id||!ticks.length||ticks.length>2000000)throw new Error('Histórico inválido para staging nativo: '+id);
  const info=[];
  for(let offset=0,index=0;offset<ticks.length;offset+=25000,index++){
    const slice=ticks.slice(offset,Math.min(offset+25000,ticks.length));
    const payload=JSON.stringify(slice),sha256=await shaText(payload);
    const staged=await call('desktop_market_stage_tick_chunk',{generation,datasetId:id,chunkIndex:index,payload,sha256});
    if(!staged?.ok||Number(staged.rows)!==slice.length)throw new Error('Chunk staging no confirmado: '+id+'#'+index);
    info.push({index,count:slice.length,sha256});
  }
  const aggregateSha256=await shaText(info.map(x=>x.index+':'+x.count+':'+x.sha256+'\n').join(''));
  const final=await call('desktop_market_finalize_dataset',{
    generation,datasetId:id,chunkCount:info.length,rowCount:ticks.length,aggregateSha256
  });
  if(!final?.ok||Number(final.rowCount)!==ticks.length)throw new Error('Catálogo staging no confirmado: '+id);
  return {id,rowCount:ticks.length,chunkCount:info.length,aggregateSha256};
}
async function prepareStaging(){
  if(typeof trBackupV2BuildPayload!=='function'||typeof trBackupV2Preflight!=='function')throw new Error('Backup V2 no está disponible.');
  const raw=await trBackupV2BuildPayload();
  const prepared=await trBackupV2Preflight(raw);
  const rollback=await call('desktop_write_backup',{payload:JSON.stringify(raw),label:'desktop-market-stage-rollback'});
  if(!rollback?.ok||!rollback.path||!(Number(rollback.bytes)>0))throw new Error('No se confirmó rollback físico previo a Market Data.');
  ui.lastRollbackPath=String(rollback.path);

  const started=await call('desktop_market_begin_staging',{rollbackPath:String(rollback.path)});
  const generation=Number(started?.generation)||0;
  if(!started?.ok||generation<1)throw new Error('No se pudo abrir staging Market Data.');

  const inventory={meta:[],ticks:[],exec:[]};
  for(const rec of prepared.marketData?.marketMeta||[]){
    const id=String(rec?.id||''),payload=JSON.stringify(rec),sha256=await shaText(payload);
    const out=await call('desktop_market_stage_meta',{generation,id,payload,sha256});
    if(!out?.ok)throw new Error('Staging marketMeta no confirmado: '+id);
    inventory.meta.push({id,sha256});
  }
  for(const rec of prepared.marketData?.marketTicks||[])inventory.ticks.push(await stageTicks(generation,rec));
  for(const rec of prepared.marketData?.execSets||[]){
    const id=String(rec?.id||''),payload=JSON.stringify(rec),sha256=await shaText(payload);
    const out=await call('desktop_market_stage_exec',{generation,id,payload,sha256});
    if(!out?.ok)throw new Error('Staging execSet no confirmado: '+id);
    inventory.exec.push({id,sha256});
  }
  inventory.meta.sort((a,b)=>a.id.localeCompare(b.id));
  inventory.ticks.sort((a,b)=>a.id.localeCompare(b.id));
  inventory.exec.sort((a,b)=>a.id.localeCompare(b.id));
  const verified=await call('desktop_market_verify_staging',{generation,inventory:JSON.stringify(inventory)});
  if(!verified?.ok||Number(verified.meta)!==inventory.meta.length||Number(verified.datasets)!==inventory.ticks.length||Number(verified.execSets)!==inventory.exec.length){
    throw new Error('Verificación staging Market Data no coincide con inventario.');
  }
  return {raw,prepared,rollback,generation,inventory,verified};
}
async function migrateNativeMarketData(){
  if(ui.busy)return null;
  ui.busy=true;ui.lastError='';ui.lastRollbackPath='';paint();
  let staged=null,promotionAttempted=false,promoted=false;
  try{
    await beginMigration();
    staged=await prepareStaging();
    promotionAttempted=true;
    const result=await call('desktop_market_promote_authority',{generation:staged.generation,rollbackPath:String(staged.rollback.path)});
    if(!result?.ok||!result?.active||Number(result.generation)!==1)throw new Error('Promoción Market Data no confirmó generación inicial.');
    promoted=true;
    globalThis.TradingResearchDesktopMarketBridge?.setPromoted?.(Number(result.generation));
    const native=await call('desktop_market_authority_status',{deep:true});
    if(!native?.active||Number(native.generation)!==1||
       Number(native.meta)!==staged.inventory.meta.length||
       Number(native.datasets)!==staged.inventory.ticks.length||
       Number(native.execSets)!==staged.inventory.exec.length){
      throw new Error('Readback profundo de Market Data nativo no coincide.');
    }

    // Rebuild complete Backup V2 through the now-active bounded adapter.
    const post=await trBackupV2Preflight(await trBackupV2BuildPayload());
    const before=staged.prepared.manifest.hashes,after=post.manifest.hashes;
    if(before.marketMeta!==after.marketMeta||before.marketTicks!==after.marketTicks||before.execSets!==after.execSets){
      throw new Error('Backup V2 posterior a promoción no reproduce exactamente Market Data.');
    }
    await status(true);
    endMigration();
    alert('Migración Market Data completada.\n\nAutoridad: NATIVA · generación '+Number(ui.authority?.generation||1)+
      '\nHistóricos: '+Number(ui.authority?.datasets||0)+' · Grid: '+Number(ui.authority?.execSets||0)+
      '\nTicks: '+Number(ui.authority?.ticks||0).toLocaleString('es-ES')+
      '\nRollback previo:\n'+String(staged.rollback.path));
    return result;
  }catch(e){
    ui.lastError=e?.message||String(e);console.error('[Trading Research Desktop · Native Market Data migration]',e);
    if(promoted||promotionAttempted)globalThis.TradingResearchDesktopMarketBridge?.block?.(e);
    else endMigration();
    alert('No se pudo completar la migración nativa de Market Data: '+ui.lastError+
      (staged?.rollback?.path||ui.lastRollbackPath?'\n\nRollback conservado en:\n'+String(staged?.rollback?.path||ui.lastRollbackPath):''));
    return null;
  }finally{
    if(!promoted&&!promotionAttempted)endMigration();
    ui.busy=false;paint();
  }
}
async function verifyNativeMarketData(){
  const result=await status(true);
  if(result.authority?.active)alert('Autoridad nativa de Market Data verificada.\n\nGeneración: '+result.authority.generation+
    '\nHistóricos: '+result.authority.datasets+'\nGrid: '+result.authority.execSets+
    '\nTicks: '+Number(result.authority.ticks||0).toLocaleString('es-ES'));
  return result;
}
function panel(){
  const a=ui.authority,s=ui.staging,active=!!a?.active;
  return '<section class="card panel" id="desktop-native-market-panel">'+
    '<div class="panel-title"><div><h3>Desktop · Market Data nativo</h3><small>Batch 78: históricos y Grid en SQLite por chunks de máximo 25.000 ticks con rollback Backup V2.</small></div>'+
    '<span class="stable-pill '+(ui.lastError?'bad':active?'ok':'')+'">'+(ui.lastError?'ERROR':ui.busy?'TRABAJANDO':active?'NATIVO':'INDEXEDDB')+'</span></div>'+
    '<div class="actions">'+(!active?'<button class="btn primary" type="button" data-desktop-native-market-action="migrate" '+(ui.busy?'disabled':'')+'>Migrar Market Data a nativo</button>':'')+
    '<button class="btn" type="button" data-desktop-native-market-action="verify">Verificar Market Data</button>'+
    '<button class="btn small" type="button" data-desktop-native-market-action="refresh">Actualizar estado</button></div>'+
    '<div class="notice"><strong>Autoridad Market Data:</strong> '+(active?'NATIVA · generación '+Number(a.generation||0):'IndexedDB')+
      (active?' · '+Number(a.datasets||0)+' histórico(s) · '+Number(a.execSets||0)+' Grid · '+Number(a.ticks||0).toLocaleString('es-ES')+' ticks':
        s?.staging?' · staging generación '+Number(s.staging.generation||0)+(s.staging.completed?' verificado':' en curso'):'')+
      (ui.lastError?'<br><strong>Error:</strong> '+esc(ui.lastError):'')+
    '</div></section>';
}
function paint(){const host=document.getElementById('desktop-native-market-host');if(host)host.innerHTML=panel();}
function mount(){
  if(document.getElementById('desktop-native-market-host'))return;
  const base=document.getElementById('desktop-native-images-host')||document.getElementById('trDesktopNativeStorage');
  if(!base)return;
  const host=document.createElement('div');host.id='desktop-native-market-host';base.insertAdjacentElement('afterend',host);paint();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-desktop-native-market-action]');if(!b)return;
  const a=b.dataset.desktopNativeMarketAction;
  if(a==='migrate')void migrateNativeMarketData();
  else if(a==='verify')void verifyNativeMarketData();
  else if(a==='refresh')void status(false);
});
new MutationObserver(()=>mount()).observe(document.documentElement,{childList:true,subtree:true});
globalThis.TradingResearchDesktopNativeMarketData={
  migrateNativeMarketData,verifyNativeMarketData,status,
  get state(){return JSON.parse(JSON.stringify(ui));}
};
setTimeout(()=>{mount();void status(false);},0);
})();