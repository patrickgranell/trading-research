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

async function trDesktopRefreshWorkspaceAuthorityFromNative(){
  const native=await trDesktopInvoke('desktop_authority_status');
  if(!native?.active)return {active:false};
  const record=await trDesktopInvoke('desktop_read_authoritative_workspace');
  const source=trDesktopAuthorityReadRecord(record);
  state=source;
  trDesktopAuthorityRevision=Number(record.revision)||0;
  trDesktopAuthorityControl.active=true;
  trDesktopAuthorityControl.migrationPending=false;
  trCoreMode='sqlite-authority';trCoreHydrated=true;trCoreLastError='';trCoreLastSavedAt=record.updatedAt||'';
  trCoreSignalHydrated();
  return {active:true,revision:trDesktopAuthorityRevision};
}
trDesktopAuthorityControl.refreshFromNative=trDesktopRefreshWorkspaceAuthorityFromNative;

let trDesktopImageGeneration=0;
let trDesktopImageFailed=false;
let trDesktopImageWriteChain=Promise.resolve(true);
const trDesktopImageAuthorityControl={
  active:false,migrationPending:false,failed:()=>trDesktopImageFailed,generation:()=>trDesktopImageGeneration,
  version:'0.5.1-b77-hotfix1',mode:()=>trDesktopImageFailed?'blocked':trDesktopImageAuthorityControl.active?'native-authority':trDesktopImageAuthorityControl.migrationPending?'migration':'indexeddb'
};
globalThis.TradingResearchDesktopImageAuthority=trDesktopImageAuthorityControl;
let trDesktopMarketGeneration=0;
let trDesktopMarketFailed=false;
let trDesktopMarketWriteChain=Promise.resolve(true);
let trDesktopMarketOpCounter=0;
const trDesktopMarketAuthorityControl={
  active:false,migrationPending:false,failed:()=>trDesktopMarketFailed,generation:()=>trDesktopMarketGeneration,
  version:'0.6.0-b78',mode:()=>trDesktopMarketFailed?'blocked':trDesktopMarketAuthorityControl.active?'native-authority':trDesktopMarketAuthorityControl.migrationPending?'migration':'indexeddb'
};
globalThis.TradingResearchDesktopMarketAuthority=trDesktopMarketAuthorityControl;
async function trDesktopInvoke(command,args={}){
  const reply=await trDesktopNativeInvoke(command,args);
  return typeof reply==='string'?JSON.parse(reply):reply;
}
async function trDesktopMarketBootstrapAuthority(){
  const status=await trDesktopInvoke('desktop_market_authority_status',{deep:false});
  trDesktopMarketAuthorityControl.active=!!status?.active;
  trDesktopMarketGeneration=Number(status?.generation)||0;
  if(trDesktopMarketAuthorityControl.active&&trDesktopMarketGeneration<1)throw new Error('Autoridad Market Data activa sin generación válida.');
  return status;
}
function trDesktopMarketStop(error){
  trDesktopMarketFailed=true;
  trCoreSetWriteBlock('desktop-native-market-authority-error');
  const e=error instanceof Error?error:new Error(String(error));
  console.error('[Trading Research · Native Market Data authority]',e);
  trDesktopAuthorityStop(e,'Market Data');
}
async function trDesktopMarketShaText(value){
  const bytes=new TextEncoder().encode(String(value));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function trDesktopMarketOpId(){trDesktopMarketOpCounter++;return 'MDOP-'+Date.now()+'-'+trDesktopMarketOpCounter;}
async function trDesktopMarketStageTicks(opId,id,value){
  const ticks=Array.isArray(value?.ticks)?value.ticks:[];
  if(!id||String(value?.id||id)!==String(id))throw new Error('marketTicks sin ID coherente.');
  if(!ticks.length||ticks.length>2000000)throw new Error('Histórico nativo vacío o superior a 2.000.000 ticks.');
  const info=[];
  for(let offset=0,index=0;offset<ticks.length;offset+=25000,index++){
    const slice=ticks.slice(offset,Math.min(offset+25000,ticks.length));
    const payload=JSON.stringify(slice),sha256=await trDesktopMarketShaText(payload);
    const staged=await trDesktopInvoke('desktop_market_stage_live_tick_chunk',{opId,datasetId:String(id),chunkIndex:index,payload,sha256});
    if(!staged?.ok||Number(staged.rows)!==slice.length)throw new Error('Staging chunk Market Data no confirmó sus filas.');
    info.push({index,count:slice.length,sha256});
  }
  const material=info.map(x=>x.index+':'+x.count+':'+x.sha256+'\n').join('');
  const aggregateSha256=await trDesktopMarketShaText(material);
  const final=await trDesktopInvoke('desktop_market_finalize_live_tick',{opId,datasetId:String(id),chunkCount:info.length,rowCount:ticks.length,aggregateSha256});
  if(!final?.ok||Number(final.rowCount)!==ticks.length)throw new Error('Catálogo Market Data nativo no confirmó el histórico.');
  return final;
}
function trDesktopMarketQueueChanges(changes=[],reason='market.commit'){
  if(!trDesktopMarketAuthorityControl.active||trDesktopMarketFailed)return Promise.reject(new Error('Autoridad nativa Market Data no disponible.'));
  const list=[...(changes||[])];
  trDesktopMarketWriteChain=trDesktopMarketWriteChain.catch(()=>true).then(async()=>{
    if(trDesktopMarketFailed)throw new Error('Autoridad nativa Market Data bloqueada.');
    const expected=trDesktopMarketGeneration,opId=trDesktopMarketOpId();let committing=false;
    try{
      await trDesktopInvoke('desktop_market_begin_live_op',{opId,expectedGeneration:expected,reason:String(reason||'market.commit')});
      for(const c of list){
        const store=String(c?.store||''),id=String(c?.id||c?.value?.id||'');
        if(!['marketMeta','marketTicks','execSets'].includes(store)||!id)throw new Error('Cambio Market Data inválido.');
        if(c.type==='delete'){
          await trDesktopInvoke('desktop_market_stage_live_delete',{opId,store,id});
        }else if(c.type==='put'){
          if(store==='marketTicks')await trDesktopMarketStageTicks(opId,id,c.value);
          else{
            const payload=JSON.stringify(c.value),sha256=await trDesktopMarketShaText(payload);
            await trDesktopInvoke('desktop_market_stage_live_record',{opId,store,id,payload,sha256});
          }
        }else throw new Error('Tipo de cambio Market Data inválido.');
      }
      committing=true;
      const result=await trDesktopInvoke('desktop_market_commit_live_op',{opId});
      if(!result?.ok||Number(result.generation)!==expected+1)throw new Error('Commit Market Data no confirmó la siguiente generación.');
      trDesktopMarketGeneration=Number(result.generation);
      return result;
    }catch(e){
      try{await trDesktopInvoke('desktop_market_abort_live_op',{opId});}catch{}
      if(committing&&(/Conflicto generación/i.test(String(e?.message||e))||/siguiente generación/i.test(String(e?.message||e))))trDesktopMarketStop(e);
      throw e;
    }
  });
  return trDesktopMarketWriteChain;
}
async function trDesktopMarketCatalogs(){
  const rows=await trDesktopInvoke('desktop_market_list_catalogs');
  return Array.isArray(rows)?rows:[];
}
async function trDesktopMarketReadTicks(id,catalog=null){
  const meta=catalog||(await trDesktopMarketCatalogs()).find(x=>String(x.id)===String(id));
  if(!meta)return null;
  const chunkCount=Number(meta.chunkCount)||0,rowCount=Number(meta.rowCount)||0;
  if(chunkCount<1||rowCount<1||rowCount>2000000)throw new Error('Catálogo Market Data nativo fuera de límites: '+String(id));
  const ticks=[];
  for(let i=0;i<chunkCount;i++){
    const rec=await trDesktopInvoke('desktop_market_read_active_chunk',{datasetId:String(id),chunkIndex:i});
    if(!rec?.authority||Number(rec.chunkIndex)!==i)throw new Error('Readback chunk Market Data inválido: '+String(id)+'#'+i);
    const part=JSON.parse(String(rec.payload||'[]'));
    if(!Array.isArray(part)||part.length!==Number(rec.rowCount))throw new Error('Payload chunk Market Data inválido.');
    ticks.push(...part);
    if(ticks.length>2000000)throw new Error('Readback Market Data supera 2.000.000 ticks.');
  }
  if(ticks.length!==rowCount)throw new Error('Readback Market Data no coincide con rowCount: '+String(id));
  return {id:String(id),ticks};
}
async function trDesktopMarketStoreGet(store,id){
  if(!trDesktopMarketAuthorityControl.active)throw new Error('Lectura Market Data nativa sin autoridad activa.');
  if(store==='marketTicks')return trDesktopMarketReadTicks(id);
  const rec=await trDesktopInvoke('desktop_market_get_record',{store:String(store),id:String(id)});
  return rec||null;
}
async function trDesktopMarketStoreAll(store){
  if(!trDesktopMarketAuthorityControl.active)throw new Error('Lista Market Data nativa sin autoridad activa.');
  if(store==='marketTicks'){
    const cats=await trDesktopMarketCatalogs(),out=[];
    for(const cat of cats)out.push(await trDesktopMarketReadTicks(cat.id,cat));
    return out;
  }
  const rows=await trDesktopInvoke('desktop_market_list_records',{store:String(store)});
  return Array.isArray(rows)?rows:[];
}
async function trDesktopMarketStorePut(store,value){
  if(!value?.id)throw new Error('Put Market Data sin id.');
  await trDesktopMarketQueueChanges([{type:'put',store:String(store),id:String(value.id),value}], 'market.'+String(store)+'.put');
  return value;
}
async function trDesktopMarketStoreDelete(store,id){
  await trDesktopMarketQueueChanges([{type:'delete',store:String(store),id:String(id)}], 'market.'+String(store)+'.delete');
}
async function trDesktopMarketDeleteDataset(id){
  await trDesktopMarketQueueChanges([{type:'delete',store:'marketMeta',id:String(id)},{type:'delete',store:'marketTicks',id:String(id)}],'market.dataset.delete');
}
async function trDesktopMarketReplaceAll(marketData){
  const [metas,execs,cats]=await Promise.all([trDesktopMarketStoreAll('marketMeta'),trDesktopMarketStoreAll('execSets'),trDesktopMarketCatalogs()]);
  const changes=[];
  for(const x of metas)changes.push({type:'delete',store:'marketMeta',id:String(x.id)});
  for(const x of cats)changes.push({type:'delete',store:'marketTicks',id:String(x.id)});
  for(const x of execs)changes.push({type:'delete',store:'execSets',id:String(x.id)});
  for(const x of marketData?.marketMeta||[])changes.push({type:'put',store:'marketMeta',id:String(x.id),value:x});
  for(const x of marketData?.marketTicks||[])changes.push({type:'put',store:'marketTicks',id:String(x.id),value:x});
  for(const x of marketData?.execSets||[])changes.push({type:'put',store:'execSets',id:String(x.id),value:x});
  await trDesktopMarketQueueChanges(changes,'backup-v2.market.replace-all');
  return true;
}
globalThis.TradingResearchDesktopMarketBridge=Object.freeze({
  get:trDesktopMarketStoreGet,all:trDesktopMarketStoreAll,put:trDesktopMarketStorePut,del:trDesktopMarketStoreDelete,
  applyChanges:trDesktopMarketQueueChanges,deleteDataset:trDesktopMarketDeleteDataset,replaceAll:trDesktopMarketReplaceAll,
  catalogs:trDesktopMarketCatalogs,readTicks:trDesktopMarketReadTicks,
  setPromoted:(generation)=>{trDesktopMarketGeneration=Number(generation)||0;trDesktopMarketAuthorityControl.active=trDesktopMarketGeneration>0;},
  setMigrationPending:(value)=>{trDesktopMarketAuthorityControl.migrationPending=!!value;},
  block:trDesktopMarketStop,refresh:trDesktopMarketBootstrapAuthority
});

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
  trDesktopAuthorityStop(e,'Imágenes nativas');
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
function trDesktopAuthorityStop(error,area='SQLite'){
  trDesktopAuthorityFailed=true;
  trCoreFatal=true;trCoreHydrated=false;trCoreMode='fatal';
  const block=area==='SQLite'?'desktop-sqlite-authority-error':area==='Imágenes nativas'?'desktop-native-image-authority-error':'desktop-native-market-authority-error';
  trCoreSetWriteBlock(block);
  trCoreLastError='Desktop '+area+': '+(error?.message||String(error));
  console.error('[Trading Research · '+area+' authority]',error);
  document.documentElement.classList.remove('tr-core-loading');
  const root=document.getElementById('app');
  const title=area==='SQLite'?'SQLite requiere recuperación':area==='Imágenes nativas'?'Almacenamiento nativo de imágenes requiere recuperación':'Market Data nativo requiere recuperación';
  const detail=area==='SQLite'?'No se ha sustituido SQLite por IndexedDB.':area==='Imágenes nativas'?'No se ha sustituido el almacenamiento nativo por el IndexedDB antiguo.':'No se ha sustituido Market Data nativo por el IndexedDB antiguo.';
  if(root)root.innerHTML='<main class="tr-core-fatal"><h1>Trading Research</h1><h2>'+title+'</h2><p>'+String(trCoreLastError).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p><p>'+detail+' Conserva tus archivos .trbackup; no introduzcas datos nuevos en este estado.</p></main>';
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
    await trDesktopMarketBootstrapAuthority();
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
