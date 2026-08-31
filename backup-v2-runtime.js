/* ===== V31.24 BACKUP V2 / RESTORE RECOVERY RUNTIME =====
 * D02/D03 invariants:
 * - "full backup" means workspace + every reachable image + all Market Data stores
 * - missing mandatory resources abort before a file is created
 * - restore preflights hashes/relationships before any durable mutation
 * - no destructive image clear occurs before a recoverable commit point
 * - cross-database restore uses a durable journal and forward recovery
 */
const TR_BACKUP_V2_VERSION='31.24.0';
const TR_BACKUP_V2_SCHEMA=2;
const TR_BACKUP_V2_JOURNAL_ID='backupV2RestoreJournal';
const TR_BACKUP_V2_STAGE_PREFIX='__tr_backup_v2_stage__';
const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];

function trBackupV2Clone(value){return typeof clone==='function'?clone(value):JSON.parse(JSON.stringify(value));}
function trBackupV2SortedUnique(values){return [...new Set((values||[]).filter(Boolean).map(String))].sort();}
function trBackupV2StableValue(value){
  if(Array.isArray(value))return value.map(trBackupV2StableValue);
  if(value&&typeof value==='object'){
    const out={};for(const key of Object.keys(value).sort())out[key]=trBackupV2StableValue(value[key]);return out;
  }
  return value;
}
function trBackupV2Canonical(value){return JSON.stringify(trBackupV2StableValue(value));}
function trBackupV2Hex(buffer){return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function trBackupV2Sha256Bytes(bytes){
  if(!globalThis.crypto?.subtle)throw new Error('SHA-256 no está disponible en este navegador.');
  const source=bytes instanceof ArrayBuffer?bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  return trBackupV2Hex(await globalThis.crypto.subtle.digest('SHA-256',source));
}
async function trBackupV2Sha256Text(text){return trBackupV2Sha256Bytes(new TextEncoder().encode(String(text)));}
async function trBackupV2Sha256Blob(blob){return trBackupV2Sha256Bytes(await blob.arrayBuffer());}
async function trBackupV2HashCanonical(value){return trBackupV2Sha256Text(trBackupV2Canonical(value));}
function trBackupV2SortRecords(rows){return trBackupV2Clone(rows||[]).sort((a,b)=>String(a?.id||'').localeCompare(String(b?.id||'')));}

function trBackupV2CollectReferencedImageIds(workspace){
  const ids=new Set(),add=x=>{if(x?.id)ids.add(String(x.id));},addList=list=>(list||[]).forEach(add);
  for(const op of workspace?.operations||[])addList(op?.images);
  for(const plan of workspace?.tradingPlans||[]){
    for(const ref of plan?.visualReferences||[])addList(ref?.images);
    for(const def of plan?.setupDefinitions||[]){addList(def?.imagesLong);addList(def?.imagesShort);}
    for(const def of plan?.vdDefinitions||[])addList(def?.images);
    for(const def of plan?.contextDefinitions||[])addList(def?.images);
  }
  for(const item of workspace?.masterLibrary?.items||[]){
    const payload=item?.payload||{};
    if(item?.type==='setup'){addList(payload.imagesLong);addList(payload.imagesShort);}
    else if(item?.type==='vd'||item?.type==='context')addList(payload.images);
  }
  return [...ids].sort();
}

async function trBackupV2ReadMarketData(){
  if(typeof v314StoreAll!=='function')throw new Error('Market Data IndexedDB no está disponible.');
  const [marketMeta,marketTicks,execSets]=await Promise.all(TR_BACKUP_V2_MARKET_STORES.map(store=>v314StoreAll(store)));
  return {marketMeta:trBackupV2SortRecords(marketMeta),marketTicks:trBackupV2SortRecords(marketTicks),execSets:trBackupV2SortRecords(execSets)};
}

function trBackupV2ValidateRelationships(workspace,images,marketData){
  const errors=[];
  if(typeof trCoreIsValidWorkspacePayload==='function'&&!trCoreIsValidWorkspacePayload(workspace))errors.push('workspace inválido para el esquema durable actual.');
  else if(!workspace||typeof workspace!=='object'||!Array.isArray(workspace.tradingPlans))errors.push('workspace inválido.');

  const expectedImageIds=trBackupV2CollectReferencedImageIds(workspace);
  const imageIds=(images||[]).map(x=>String(x?.id||'')).filter(Boolean);
  const imageSet=new Set(imageIds);
  if(imageIds.length!==imageSet.size)errors.push('hay IDs de imagen duplicados en la copia.');
  const missingImageIds=expectedImageIds.filter(id=>!imageSet.has(id));
  if(missingImageIds.length)errors.push(`faltan ${missingImageIds.length} imagen(es) referenciada(s): ${missingImageIds.slice(0,5).join(', ')}${missingImageIds.length>5?'…':''}`);

  const meta=marketData?.marketMeta||[],ticks=marketData?.marketTicks||[],sets=marketData?.execSets||[];
  const metaIds=meta.map(x=>String(x?.id||'')).filter(Boolean),tickIds=ticks.map(x=>String(x?.id||'')).filter(Boolean);
  if(metaIds.length!==new Set(metaIds).size)errors.push('marketMeta contiene IDs duplicados.');
  if(tickIds.length!==new Set(tickIds).size)errors.push('marketTicks contiene IDs duplicados.');
  const metaSet=new Set(metaIds),tickSet=new Set(tickIds);
  const missingTicks=metaIds.filter(id=>!tickSet.has(id)),orphanTicks=tickIds.filter(id=>!metaSet.has(id));
  if(missingTicks.length)errors.push(`faltan marketTicks para: ${missingTicks.slice(0,5).join(', ')}`);
  if(orphanTicks.length)errors.push(`hay marketTicks sin marketMeta: ${orphanTicks.slice(0,5).join(', ')}`);
  for(const set of sets||[])if(set?.marketDatasetId&&!metaSet.has(String(set.marketDatasetId)))errors.push(`execSet ${set.id||'sin id'} referencia Market Data inexistente ${set.marketDatasetId}.`);

  return {ok:errors.length===0,errors,expectedImageIds,missingImageIds,marketDatasetIds:metaIds.sort()};
}

async function trBackupV2CreateManifest(workspace,images,marketData,extra={}){
  const rel=trBackupV2ValidateRelationships(workspace,images,marketData);
  if(!rel.ok)throw new Error('La copia no puede considerarse completa: '+rel.errors.join(' '));
  const imageHashes={};for(const im of images||[])imageHashes[String(im.id)]=String(im.sha256||'');
  const manifest={
    schema:TR_BACKUP_V2_SCHEMA,
    runtimeVersion:TR_BACKUP_V2_VERSION,
    counts:{
      plans:workspace?.tradingPlans?.length||0,
      operations:workspace?.operations?.length||0,
      importBatches:workspace?.importBatches?.length||0,
      instruments:workspace?.settings?.instruments?.length||0,
      imageReferences:rel.expectedImageIds.length,
      images:(images||[]).length,
      marketMeta:marketData?.marketMeta?.length||0,
      marketTicks:marketData?.marketTicks?.length||0,
      execSets:marketData?.execSets?.length||0
    },
    expectedImageIds:rel.expectedImageIds,
    marketDatasetIds:rel.marketDatasetIds,
    hashes:{
      workspace:await trBackupV2HashCanonical(workspace),
      marketMeta:await trBackupV2HashCanonical(trBackupV2SortRecords(marketData?.marketMeta)),
      marketTicks:await trBackupV2HashCanonical(trBackupV2SortRecords(marketData?.marketTicks)),
      execSets:await trBackupV2HashCanonical(trBackupV2SortRecords(marketData?.execSets)),
      images:imageHashes
    },
    ...extra
  };
  return manifest;
}

async function trBackupV2BuildPayload(){
  if(typeof trCoreFlush==='function'&&!(await trCoreFlush()))throw new Error('No se pudo confirmar el workspace antes de exportar.');
  const workspace=typeof TRDomainStore!=='undefined'&&TRDomainStore?.snapshot?TRDomainStore.snapshot():trBackupV2Clone(state);
  const expectedImageIds=trBackupV2CollectReferencedImageIds(workspace);
  const local=await getAllImageRecords(),localMap=new Map((local||[]).map(x=>[String(x.id),x]));
  const images=[],missingImageIds=[];
  for(const id of expectedImageIds){
    const rec=localMap.get(id),meta=(typeof findImageMetaByIdV9==='function'?findImageMetaByIdV9(id):null)||rec||{};
    let blob=rec?.blob||null;
    if(!blob&&typeof cloudDownloadImageBlob==='function')blob=await cloudDownloadImageBlob(id);
    if(!blob){missingImageIds.push(id);continue;}
    const data=await blobToBase64(blob),sha256=await trBackupV2Sha256Blob(blob);
    images.push({id,name:meta.name||rec?.name||'imagen',type:meta.type||rec?.type||blob.type||'application/octet-stream',updatedAt:rec?.updatedAt||'',data,sha256});
  }
  if(missingImageIds.length)throw new Error(`Copia completa abortada: faltan ${missingImageIds.length} blob(s) obligatorio(s): ${missingImageIds.slice(0,5).join(', ')}${missingImageIds.length>5?'…':''}`);
  const marketData=await trBackupV2ReadMarketData();
  const manifest=await trBackupV2CreateManifest(workspace,images,marketData);
  return {format:BACKUP_FORMAT,schema:TR_BACKUP_V2_SCHEMA,appVersion:TR_BACKUP_V2_VERSION,exportedAt:new Date().toISOString(),manifest,workspace,images,marketData};
}

function trBackupV2DownloadPayload(payload){
  const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a'),d=new Date();
  const stamp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}`;
  a.href=url;a.download=`Trading-Research-backup-v2-${stamp}.trbackup`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function trBackupV2ExportFullBackup(){
  try{
    const payload=await trBackupV2BuildPayload();trBackupV2DownloadPayload(payload);
    const c=payload.manifest.counts;
    alert(`Copia completa V2 creada.\nPlanes: ${c.plans}\nOperaciones: ${c.operations}\nImágenes: ${c.images}/${c.imageReferences}\nMarket Data: ${c.marketMeta} histórico(s), ${c.execSets} Grid(s)`);
  }catch(e){alert('No se pudo crear la copia completa V2: '+(e?.message||String(e)));}
}

async function trBackupV2LegacyToV2(raw){
  if(raw?.format!==BACKUP_FORMAT||!raw?.state||!Array.isArray(raw?.images))throw new Error('El archivo legacy no es una copia válida de Trading Research.');
  const workspace=trBackupV2Clone(raw.state),marketData=await trBackupV2ReadMarketData(),images=[];
  for(const im of raw.images){
    if(!im?.id||!im?.data)continue;
    const blob=base64ToBlob(im.data,im.type),sha256=await trBackupV2Sha256Blob(blob);
    images.push({...trBackupV2Clone(im),sha256});
  }
  const manifest=await trBackupV2CreateManifest(workspace,images,marketData,{legacySourceSchema:Number(raw.schema)||1,legacyMarketDataPreserved:true});
  return {format:BACKUP_FORMAT,schema:TR_BACKUP_V2_SCHEMA,appVersion:TR_BACKUP_V2_VERSION,exportedAt:raw.exportedAt||'',manifest,workspace,images,marketData};
}

async function trBackupV2Preflight(rawInput){
  let raw=rawInput;
  if(raw?.format===BACKUP_FORMAT&&Number(raw?.schema||1)<TR_BACKUP_V2_SCHEMA)raw=await trBackupV2LegacyToV2(raw);
  if(raw?.format!==BACKUP_FORMAT||Number(raw?.schema)!==TR_BACKUP_V2_SCHEMA||!raw?.manifest||!raw?.workspace||!Array.isArray(raw?.images)||!raw?.marketData)throw new Error('El archivo no es una copia Backup V2 válida.');

  const images=[];
  for(const im of raw.images){
    if(!im?.id||!im?.data||!im?.sha256)throw new Error('Backup V2 contiene una imagen sin id/datos/hash.');
    const blob=base64ToBlob(im.data,im.type),got=await trBackupV2Sha256Blob(blob);
    if(got!==String(im.sha256))throw new Error(`Hash inválido para la imagen ${im.id}.`);
    images.push({...trBackupV2Clone(im),blob});
  }

  const marketData={
    marketMeta:trBackupV2SortRecords(raw.marketData.marketMeta),
    marketTicks:trBackupV2SortRecords(raw.marketData.marketTicks),
    execSets:trBackupV2SortRecords(raw.marketData.execSets)
  };
  const rel=trBackupV2ValidateRelationships(raw.workspace,images,marketData);
  if(!rel.ok)throw new Error('Relaciones inválidas: '+rel.errors.join(' '));

  const counts=raw.manifest.counts||{},actual={
    plans:raw.workspace?.tradingPlans?.length||0,operations:raw.workspace?.operations?.length||0,importBatches:raw.workspace?.importBatches?.length||0,
    instruments:raw.workspace?.settings?.instruments?.length||0,imageReferences:rel.expectedImageIds.length,images:images.length,
    marketMeta:marketData.marketMeta.length,marketTicks:marketData.marketTicks.length,execSets:marketData.execSets.length
  };
  for(const [k,v] of Object.entries(actual))if(Number(counts[k])!==Number(v))throw new Error(`Manifest count ${k} no coincide (${counts[k]} != ${v}).`);
  if(JSON.stringify(trBackupV2SortedUnique(raw.manifest.expectedImageIds))!==JSON.stringify(rel.expectedImageIds))throw new Error('Manifest expectedImageIds no coincide con el workspace.');

  const hashes=raw.manifest.hashes||{};
  if(await trBackupV2HashCanonical(raw.workspace)!==hashes.workspace)throw new Error('Hash de workspace inválido.');
  if(await trBackupV2HashCanonical(marketData.marketMeta)!==hashes.marketMeta)throw new Error('Hash de marketMeta inválido.');
  if(await trBackupV2HashCanonical(marketData.marketTicks)!==hashes.marketTicks)throw new Error('Hash de marketTicks inválido.');
  if(await trBackupV2HashCanonical(marketData.execSets)!==hashes.execSets)throw new Error('Hash de execSets inválido.');
  for(const im of images)if(String(hashes.images?.[im.id]||'')!==String(im.sha256))throw new Error(`Manifest no certifica la imagen ${im.id}.`);

  return {workspace:trBackupV2Clone(raw.workspace),images,marketData,manifest:trBackupV2Clone(raw.manifest),exportedAt:raw.exportedAt||'',legacySourceSchema:raw.manifest.legacySourceSchema||null};
}

async function trBackupV2CoreMetaPut(value){
  const db=await trCoreOpenDb();return new Promise((resolve,reject)=>{const tx=db.transaction(TR_CORE_META_STORE,'readwrite');tx.objectStore(TR_CORE_META_STORE).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('No se pudo escribir restore journal.'));});
}
async function trBackupV2CoreMetaGet(id){
  const db=await trCoreOpenDb();return new Promise((resolve,reject)=>{const tx=db.transaction(TR_CORE_META_STORE,'readonly'),req=tx.objectStore(TR_CORE_META_STORE).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||tx.error);});
}
async function trBackupV2CoreMetaDelete(id){
  const db=await trCoreOpenDb();return new Promise((resolve,reject)=>{const tx=db.transaction(TR_CORE_META_STORE,'readwrite');tx.objectStore(TR_CORE_META_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
async function trBackupV2JournalPut(journal){return trBackupV2CoreMetaPut({...journal,id:TR_BACKUP_V2_JOURNAL_ID,updatedAt:new Date().toISOString()});}
async function trBackupV2JournalGet(){return trBackupV2CoreMetaGet(TR_BACKUP_V2_JOURNAL_ID);}
async function trBackupV2JournalDelete(){return trBackupV2CoreMetaDelete(TR_BACKUP_V2_JOURNAL_ID);}
function trBackupV2StageId(restoreId,id){return `${TR_BACKUP_V2_STAGE_PREFIX}${restoreId}::${id}`;}

async function trBackupV2ImageWriteTransaction(puts=[],deletes=[]){
  const db=await imageDb();return new Promise((resolve,reject)=>{
    let tx;try{
      tx=db.transaction(IMAGE_STORE,'readwrite');const store=tx.objectStore(IMAGE_STORE);
      for(const rec of puts)store.put(rec);for(const id of deletes)store.delete(id);
    }catch(e){try{tx?.abort();}catch{}reject(e);return;}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Transacción de imágenes abortada.'));
  });
}
async function trBackupV2StageImages(prepared,journal){
  const puts=prepared.images.map(im=>({id:trBackupV2StageId(journal.restoreId,im.id),restoreId:journal.restoreId,restoreOriginalId:im.id,blob:im.blob,name:im.name||'imagen',type:im.type||im.blob?.type||'application/octet-stream',updatedAt:im.updatedAt||''}));
  await trBackupV2ImageWriteTransaction(puts,[]);return puts.length;
}
async function trBackupV2StageRecords(journal){
  const records=await getAllImageRecords(),map=new Map(records.map(x=>[String(x.id),x])),out=[];
  for(const id of journal.manifest.expectedImageIds||[]){const rec=map.get(trBackupV2StageId(journal.restoreId,id));if(!rec)throw new Error(`Falta imagen staged ${id}.`);out.push(rec);}return out;
}
async function trBackupV2VerifyStage(journal){
  const records=await trBackupV2StageRecords(journal);
  for(const rec of records){const id=String(rec.restoreOriginalId||'');if(await trBackupV2Sha256Blob(rec.blob)!==journal.manifest.hashes.images[id])throw new Error(`Hash staged inválido para ${id}.`);}
  return records;
}
async function trBackupV2FinalImagesMatch(journal){
  const records=await getAllImageRecords(),map=new Map(records.map(x=>[String(x.id),x]));
  for(const id of journal.manifest.expectedImageIds||[]){const rec=map.get(String(id));if(!rec?.blob)return false;if(await trBackupV2Sha256Blob(rec.blob)!==journal.manifest.hashes.images[id])return false;}return true;
}
async function trBackupV2FinalizeImages(journal){
  const staged=await trBackupV2VerifyStage(journal),puts=staged.map(rec=>({id:String(rec.restoreOriginalId),blob:rec.blob,name:rec.name||'imagen',type:rec.type||rec.blob?.type||'application/octet-stream',updatedAt:rec.updatedAt||new Date().toISOString()}));
  await trBackupV2ImageWriteTransaction(puts,[]);return puts.length;
}
async function trBackupV2CleanupStage(journal){
  const ids=(journal.manifest.expectedImageIds||[]).map(id=>trBackupV2StageId(journal.restoreId,id));if(ids.length)await trBackupV2ImageWriteTransaction([],ids);return ids.length;
}

async function trBackupV2ReplaceMarketData(marketData){
  if(typeof v314Db!=='function')throw new Error('Market Data IndexedDB no está disponible.');
  const db=await v314Db();return new Promise((resolve,reject)=>{
    let tx;try{
      tx=db.transaction(TR_BACKUP_V2_MARKET_STORES,'readwrite');
      for(const storeName of TR_BACKUP_V2_MARKET_STORES){
        const store=tx.objectStore(storeName);store.clear();for(const rec of marketData?.[storeName]||[])store.put(trBackupV2Clone(rec));
      }
    }catch(e){try{db.close();}catch{};reject(e);return;}
    tx.oncomplete=()=>{try{db.close();}catch{}resolve(true);};
    tx.onerror=()=>{const e=tx.error;try{db.close();}catch{}reject(e||new Error('Commit Market Data fallido.'));};
    tx.onabort=()=>{const e=tx.error;try{db.close();}catch{}reject(e||new Error('Commit Market Data abortado.'));};
  });
}
async function trBackupV2MarketMatchesManifest(manifest){
  const market=await trBackupV2ReadMarketData();
  return (await trBackupV2HashCanonical(market.marketMeta))===manifest.hashes.marketMeta
    &&(await trBackupV2HashCanonical(market.marketTicks))===manifest.hashes.marketTicks
    &&(await trBackupV2HashCanonical(market.execSets))===manifest.hashes.execSets;
}
async function trBackupV2PersistWorkspace(workspace){
  state=normalizeState(trBackupV2Clone(workspace));if(typeof ensureAllPlansV8==='function')ensureAllPlansV8();if(typeof ensureMasterLibrary==='function')ensureMasterLibrary();
  if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.ensureAttached)TRDomainStore.ensureAttached('backup.restore-v2');
  if(!(await trCorePersistNow('backup-v2-restore')))throw new Error('No se pudo confirmar el workspace restaurado.');
  if(typeof trCoreFlush==='function'&&!(await trCoreFlush()))throw new Error('El flush durable del workspace restaurado falló.');
  return true;
}
function trBackupV2RestoreIo(){return {
  journalPut:trBackupV2JournalPut,journalDelete:trBackupV2JournalDelete,stageImages:trBackupV2StageImages,verifyStage:trBackupV2VerifyStage,
  replaceMarketData:trBackupV2ReplaceMarketData,finalizeImages:trBackupV2FinalizeImages,persistWorkspace:trBackupV2PersistWorkspace,cleanupStage:trBackupV2CleanupStage
};}
async function trBackupV2RestoreProtocol(prepared,io=trBackupV2RestoreIo()){
  const restoreId=(typeof uid==='function'?uid('RST2'):`RST2_${Date.now()}`),createdAt=new Date().toISOString();
  let journal={id:TR_BACKUP_V2_JOURNAL_ID,schema:TR_BACKUP_V2_SCHEMA,restoreId,phase:'prepared',createdAt,targetWorkspace:trBackupV2Clone(prepared.workspace),manifest:trBackupV2Clone(prepared.manifest)};
  await io.journalPut(journal);
  await io.stageImages(prepared,journal);
  await io.verifyStage(journal);
  journal={...journal,phase:'images-staged'};await io.journalPut(journal);
  await io.replaceMarketData(prepared.marketData);
  journal={...journal,phase:'market-committed'};await io.journalPut(journal);
  await io.finalizeImages(journal);
  journal={...journal,phase:'images-committed'};await io.journalPut(journal);
  await io.persistWorkspace(prepared.workspace);
  journal={...journal,phase:'workspace-committed'};await io.journalPut(journal);
  await io.cleanupStage(journal);
  await io.journalDelete();
  return {ok:true,restoreId};
}

async function trBackupV2RecoverPending(existingJournal=null){
  const journal=existingJournal||await trBackupV2JournalGet();if(!journal)return {status:'none'};
  if(Number(journal.schema)!==TR_BACKUP_V2_SCHEMA||!journal.targetWorkspace||!journal.manifest)throw new Error('Restore journal V2 inválido.');
  const marketMatches=await trBackupV2MarketMatchesManifest(journal.manifest);
  const currentWorkspaceHash=await trBackupV2HashCanonical(typeof TRDomainStore!=='undefined'&&TRDomainStore?.snapshot?TRDomainStore.snapshot():state);
  if(!marketMatches){
    if(currentWorkspaceHash===journal.manifest.hashes.workspace)throw new Error('Restore inconsistente: workspace objetivo publicado pero Market Data no coincide.');
    await trBackupV2CleanupStage(journal);await trBackupV2JournalDelete();return {status:'aborted-before-market'};
  }
  if(!(await trBackupV2FinalImagesMatch(journal))){await trBackupV2VerifyStage(journal);await trBackupV2FinalizeImages(journal);}
  await trBackupV2PersistWorkspace(journal.targetWorkspace);
  await trBackupV2CleanupStage(journal);await trBackupV2JournalDelete();
  return {status:'completed-forward'};
}

async function trBackupV2RefreshUiAfterRestore(){
  try{if(typeof v314TickCache!=='undefined'&&v314TickCache?.clear)v314TickCache.clear();}catch{}
  try{if(typeof v314RefreshMarketDataState==='function')await v314RefreshMarketDataState();}catch{}
  try{integrityAuditCache=null;}catch{}
  try{currentView='config';configTab='data';render();}catch{}
}
async function trBackupV2ImportFullBackup(file){
  if(!file)return;
  try{
    const text=await file.text(),raw=JSON.parse(text),prepared=await trBackupV2Preflight(raw),c=prepared.manifest.counts;
    const legacyNote=prepared.legacySourceSchema?`\n\nNota: copia V${prepared.legacySourceSchema}; Market Data actual se conservará e integrará en el restore seguro.`:'';
    if(!confirm(`Esta restauración sustituirá el workspace local con una copia validada.\n\nPlanes: ${c.plans}\nOperaciones: ${c.operations}\nImágenes: ${c.images}/${c.imageReferences}\nMarket Data: ${c.marketMeta} histórico(s), ${c.execSets} Grid(s)\nFecha: ${prepared.exportedAt?fmtDate(prepared.exportedAt):'—'}${legacyNote}\n\n¿Continuar?`))return;
    const run=()=>trBackupV2RestoreProtocol(prepared);
    if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.exclusive)await TRDomainStore.exclusive('backup.restore-v2',run);else await run();
    await trBackupV2RefreshUiAfterRestore();alert('Restauración Backup V2 completada y confirmada de forma durable.');
  }catch(e){
    const pending=await trBackupV2JournalGet().catch(()=>null);
    alert(`No se pudo completar la restauración: ${e?.message||String(e)}${pending?'\n\nExiste un restore journal recuperable. No borres datos ni limpies IndexedDB; al recargar se intentará completar o abortar de forma segura.':''}`);
  }finally{const input=document.getElementById('backupImportFile');if(input)input.value='';}
}

async function trBackupV2RecoverPendingOnLoad(){
  let journal=null;try{journal=await trBackupV2JournalGet();}catch{return;}if(!journal)return;
  document.documentElement.classList.add('tr-core-loading');
  try{
    for(let i=0;i<200&&typeof trCoreHydrated!=='undefined'&&!trCoreHydrated&&!trCoreFatal;i++)await new Promise(resolve=>setTimeout(resolve,25));
    document.documentElement.classList.add('tr-core-loading');
    if(typeof trCoreFatal!=='undefined'&&trCoreFatal)throw new Error('El core durable no está disponible para recuperar el restore.');
    const run=()=>trBackupV2RecoverPending(journal);
    if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.exclusive)await TRDomainStore.exclusive('backup.restore-v2.recovery',run);else await run();
    await trBackupV2RefreshUiAfterRestore();document.documentElement.classList.remove('tr-core-loading');
  }catch(e){
    try{trCoreShowStorageWarning(`Restauración pendiente bloqueada: ${e?.message||String(e)}. No introduzcas datos nuevos hasta resolverla.`);}catch{}
    console.error('[Trading Research · Backup V2 recovery]',e);
  }
}

/* Effective V31.24 boundaries. The historical V8/V9 implementations remain in app.js
 * only as audited legacy source; UI actions resolve to these V2 functions. */
exportFullBackup=trBackupV2ExportFullBackup;
importFullBackup=trBackupV2ImportFullBackup;
if(typeof window!=='undefined'&&window.TradingResearchActions){
  window.TradingResearchActions.exportFullBackup=exportFullBackup;
  window.TradingResearchActions.importFullBackup=importFullBackup;
}

const trBackupV2DataSecurityBase=typeof dataSecurityPanel==='function'?dataSecurityPanel:null;
if(trBackupV2DataSecurityBase){
  dataSecurityPanel=function(){
    return trBackupV2DataSecurityBase()
      .replace('V8.1 estable','Backup V2 · V31.24')
      .replace('Exporta estado + imágenes en un único archivo. La restauración sustituye los datos locales de este navegador.','Exporta workspace + imágenes referenciadas + Market Data con manifest y hashes. El restore valida antes de modificar datos.')
      .replace('La copia incluye Trading Plans, operaciones, importaciones, contratos, reglas, diario emocional, taxonomías y blobs de imágenes de IndexedDB.','Backup V2 solo se crea si están presentes todos los blobs obligatorios. Incluye workspace, imágenes, marketMeta, marketTicks y execSets; un restore interrumpido conserva un journal recuperable.');
  };
}

void trBackupV2RecoverPendingOnLoad();
/* ===== END V31.24 BACKUP V2 / RESTORE RECOVERY RUNTIME ===== */
