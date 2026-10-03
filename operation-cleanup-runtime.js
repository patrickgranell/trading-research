/* ===== V31.23.52 RUNTIME · Operation Cleanup Controls ===== */
(()=>{
'use strict';
const TR_OPERATION_CLEANUP_VERSION='31.23.52';
const registry=window.TradingResearchActions;
if(!registry||typeof registry!=='object')throw new Error('Operation Cleanup: TradingResearchActions no disponible.');
let deletedOperations=0,deletedImages=0,deletedTaxonomyImages=0,lastError='';

/* PLAN DELETION TESTABLE CORE START */
function trPlanDeletionProjection(workspace,ids){
  const selected=new Set((ids||[]).map(String));
  const plans=Array.isArray(workspace?.tradingPlans)?workspace.tradingPlans:[];
  if(!selected.size)throw new Error('Selecciona al menos un Trading Plan.');
  if([...selected].some(id=>!plans.some(p=>String(p.id)===id)))throw new Error('Un Trading Plan seleccionado ya no existe.');
  if(plans.length-selected.size<1)throw new Error('Debe conservarse al menos un Trading Plan.');
  const removedPlans=plans.filter(p=>selected.has(String(p.id)));
  const removedBatches=(workspace.importBatches||[]).filter(b=>selected.has(String(b.tradingPlanId)));
  const batchIds=new Set(removedBatches.map(b=>String(b.id)));
  const removedOperations=(workspace.operations||[]).filter(o=>selected.has(String(o.tradingPlanId)));
  for(const op of workspace.operations||[]){
    if(batchIds.has(String(op.importBatchId||''))&&!selected.has(String(op.tradingPlanId)))
      throw new Error('Un lote del plan contiene operaciones asociadas a otro Trading Plan.');
    if(selected.has(String(op.tradingPlanId))&&op.importBatchId&&
      (workspace.importBatches||[]).some(b=>String(b.id)===String(op.importBatchId)&&!batchIds.has(String(b.id))))
      throw new Error('Una operación seleccionada pertenece a un lote de otro Trading Plan.');
  }
  const remaining=plans.filter(p=>!selected.has(String(p.id)));
  const current=selected.has(String(workspace.currentPlanId))?
    (remaining.find(p=>p.status!=='archived')||remaining[0]).id:workspace.currentPlanId;
  return {
    next:{
      tradingPlans:remaining,
      operations:(workspace.operations||[]).filter(o=>!selected.has(String(o.tradingPlanId))),
      importBatches:(workspace.importBatches||[]).filter(b=>!selected.has(String(b.tradingPlanId))),
      opportunities:(workspace.opportunities||[]).filter(o=>!selected.has(String(o.tradingPlanId))),
      currentPlanId:current
    },
    removedPlans,removedOperations,removedBatches,
    removedOpportunities:(workspace.opportunities||[]).filter(o=>selected.has(String(o.tradingPlanId)))
  };
}
/* PLAN DELETION TESTABLE CORE END */


function trCleanupOperation(id){return state.operations.find(o=>o.id===id)||null;}
function trCleanupReviewCount(o){const p=typeof globalThis.TradingResearchPlanReadContract.byId==='function'?globalThis.TradingResearchPlanReadContract.byId(o?.tradingPlanId):null;return (p?.reviewNotes||[]).filter(n=>n?.operationId===o?.id).length;}
function trCleanupUpdateImportBatch(o){if(!o?.importBatchId)return;const b=state.importBatches.find(x=>x.id===o.importBatchId);if(b)b.operationCount=state.operations.filter(x=>x.importBatchId===o.importBatchId).length;}

async function deleteOperation(id){
  try{
    const o=trCleanupOperation(id);if(!o)return;
    const images=(o.images||[]).length,reviews=trCleanupReviewCount(o),imported=!!o.importBatchId;
    const extra=[images?`También se eliminarán ${images} captura(s) asociada(s).`:'',reviews?`${reviews} review(s) vinculada(s) se conservarán como historial y mostrarán “Operación no disponible”.`:'',imported?'Esta operación pertenece a un lote importado; el lote se conservará y actualizará su contador de operaciones.':''].filter(Boolean).join('\n');
    if(!confirm(`¿Eliminar esta operación definitivamente?${extra?`\n\n${extra}`:''}`))return;
    for(const im of o.images||[])await deleteImageBlob(im.id);
    state.operations=state.operations.filter(x=>x.id!==id);
    trCleanupUpdateImportBatch(o);
    if(typeof gallerySelected!=='undefined'&&Array.isArray(gallerySelected))gallerySelected=gallerySelected.filter(x=>x!==id);
    deletedOperations++;persist();closeModal();render();
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · operation cleanup]',e);alert('No se pudo eliminar la operación: '+lastError);}
}

async function deleteOperationImage(operationId,imageId){
  try{
    const o=trCleanupOperation(operationId);if(!o)return;
    const im=(o.images||[]).find(x=>x.id===imageId);if(!im)return;
    if(!confirm(`¿Eliminar la captura “${im.caption||im.name||'Captura'}”?`))return;
    await deleteImageBlob(imageId);
    o.images=(o.images||[]).filter(x=>x.id!==imageId);o.updatedAt=new Date().toISOString();deletedImages++;persist();
    const modal=document.querySelector('.modal-backdrop');
    if(modal){
      for(const img of modal.querySelectorAll('img[data-img-id]'))if(img.dataset.imgId===imageId)img.closest('.image-thumb-btn')?.remove();
      for(const btn of modal.querySelectorAll('[data-tr-cleanup-image]'))if(btn.dataset.trCleanupImage===imageId)btn.remove();
      const existing=modal.querySelector('.existing-images');
      if(existing){const n=(o.images||[]).length;if(!n)existing.remove();else{const label=existing.querySelector(':scope > span');if(label)label.textContent=`${n} imagen(es) ya asociadas`;}}
    }
  }catch(e){lastError=e?.message||String(e);console.error('[Trading Research · operation image cleanup]',e);alert('No se pudo eliminar la captura: '+lastError);}
}

function trCleanupDecorateOperationModal(id){
  const o=trCleanupOperation(id),modal=document.querySelector('.modal-backdrop');if(!o||!modal)return;
  const foot=modal.querySelector('.modal-foot');
  if(foot&&!foot.querySelector('[data-tr-operation-delete]'))foot.insertAdjacentHTML('afterbegin',`<button class="btn danger" type="button" data-tr-operation-delete="1" data-tr-onclick="deleteOperation('${id}')">Eliminar operación</button>`);
  const existing=modal.querySelector('.existing-images');
  if(existing&&(o.images||[]).length&&!existing.querySelector('[data-tr-operation-image-cleanup]')){
    const controls=`<div data-tr-operation-image-cleanup="1"><div class="help">Eliminar capturas existentes</div><div class="actions">${o.images.map((im,i)=>`<button class="btn small danger" type="button" data-tr-cleanup-image="${im.id}" data-tr-onclick="deleteOperationImage('${id}','${im.id}')">Eliminar ${i+1}: ${globalThis.TradingResearchContentEncodingContract.html(im.caption||im.name||'Captura')}</button>`).join('')}</div></div>`;
    existing.insertAdjacentHTML('beforeend',controls);
  }
}

/* Batch 65 · canonical taxonomy ficha image removal.
 * The metadata/reference is removed and durably flushed first. Physical blob cleanup
 * is delegated afterwards to Blob Lifecycle's reachability-aware GC. */
function trCleanupTaxPlan(){return typeof globalThis.TradingResearchPlanReadContract?.current==='function'?globalThis.TradingResearchPlanReadContract.current():null;}
function trCleanupTaxText(v){return String(v??'').trim();}
function trCleanupTaxDomain(){return globalThis.TradingResearchTaxonomyDomain||null;}
function trCleanupTaxValueKey(value){return trCleanupTaxText(value?.legacyValue||value?.name);}
function trCleanupTaxImageTarget(plan,taxId,valueId,imageId,slot='generic'){
  const domain=trCleanupTaxDomain();if(!plan||!domain)return null;
  const tax=domain.taxonomyById(plan,taxId),value=domain.valueById(tax,valueId);if(!tax||!value)return null;
  const key=trCleanupTaxValueKey(value),id=String(imageId||''),match=list=>(list||[]).some(x=>String(x?.id||'')===id);
  if(tax.id==='setup'){
    const def=(plan.setupDefinitions||[]).find(d=>trCleanupTaxText(d?.key)===key)||null;
    if(slot==='long'&&def&&match(def.imagesLong))return {owner:def,key:'imagesLong',image:(def.imagesLong||[]).find(x=>String(x?.id||'')===id)};
    if(slot==='short'&&def&&match(def.imagesShort))return {owner:def,key:'imagesShort',image:(def.imagesShort||[]).find(x=>String(x?.id||'')===id)};
  }
  if(tax.id==='vd'||tax.id==='context'){
    const coll=tax.id==='vd'?(plan.vdDefinitions||[]):(plan.contextDefinitions||[]),def=coll.find(d=>trCleanupTaxText(d?.key)===key)||null;
    if(def&&match(def.images))return {owner:def,key:'images',image:(def.images||[]).find(x=>String(x?.id||'')===id)};
  }
  const ref=(plan.visualReferences||[]).find(r=>r?.kind==='taxonomy'&&String(r.taxonomyId)===String(tax.id)&&String(r.valueId)===String(value.id))||null;
  if(ref&&match(ref.images))return {owner:ref,key:'images',image:(ref.images||[]).find(x=>String(x?.id||'')===id)};
  return null;
}
function trCleanupTaxRemoveImageFromModal(imageId){
  const form=document.getElementById('trTaxValueFichaForm');if(!form)return;
  const id=String(imageId||'');
  for(const img of form.querySelectorAll('img[data-img-id]'))if(String(img.dataset.imgId||'')===id)(img.closest('.image-thumb-btn')||img).remove();
  for(const btn of form.querySelectorAll('[data-tr-tax-image-delete]'))if(String(btn.dataset.taxImageId||'')===id)btn.remove();
}
async function trTaxDeleteTaxonomyValueImage(taxId,valueId,imageId,slot='generic'){
  const plan=trCleanupTaxPlan(),target=trCleanupTaxImageTarget(plan,taxId,valueId,imageId,slot);if(!plan||!target)return false;
  const label=target.image?.caption||target.image?.name||'Imagen';
  if(!confirm(`¿Eliminar la imagen “${label}”?`))return false;
  const before=typeof TRDomainStore!=='undefined'&&TRDomainStore?.snapshot?TRDomainStore.snapshot():(typeof clone==='function'?clone(state):JSON.parse(JSON.stringify(state)));
  try{
    if(typeof TRDomainStore==='undefined'||!TRDomainStore?.exclusive||!TRDomainStore?.command)throw new Error('Dominio durable no disponible.');
    await TRDomainStore.exclusive('taxonomy.value.image.delete',async()=>{
      TRDomainStore.command('taxonomy.value.image.delete.safe',()=>{
        const livePlan=trCleanupTaxPlan(),liveTarget=trCleanupTaxImageTarget(livePlan,taxId,valueId,imageId,slot);if(!liveTarget)throw new Error('La referencia de imagen ya no existe.');
        liveTarget.owner[liveTarget.key]=(liveTarget.owner[liveTarget.key]||[]).filter(x=>String(x?.id||'')!==String(imageId));
        if(Object.prototype.hasOwnProperty.call(liveTarget.owner,'updatedAt'))liveTarget.owner.updatedAt=new Date().toISOString();
        livePlan.updatedAt=new Date().toISOString();
      },{persist:false,render:false});
      if(typeof persist!=='function')throw new Error('persist() no disponible.');
      persist();
      const flushed=typeof trCoreFlush==='function'?await trCoreFlush():false;
      if(!flushed)throw new Error('No se pudo confirmar persist + flush.');
    });
  }catch(e){
    try{if(typeof trDomainRollbackMemory==='function')trDomainRollbackMemory(before,'taxonomy.value.image.delete.rollback');else state=normalizeState(typeof clone==='function'?clone(before):JSON.parse(JSON.stringify(before)));}catch{}
    lastError=e?.message||String(e);console.error('[Trading Research · taxonomy image cleanup]',e);alert('No se pudo eliminar la imagen de forma durable: '+lastError);return false;
  }
  deletedTaxonomyImages++;
  trCleanupTaxRemoveImageFromModal(imageId);
  try{
    if(typeof registry.runLocalBlobGarbageCollection==='function')await registry.runLocalBlobGarbageCollection();
  }catch(e){
    console.warn('[Trading Research · taxonomy image GC pending]',e);
    try{trCoreShowStorageWarning('La imagen se retiró correctamente de la ficha, pero quedó limpieza del blob pendiente. No se ha eliminado ninguna referencia viva.');}catch{}
  }
  return true;
}
function trCleanupTaxDecorateFicha(taxId,valueId){
  const form=document.getElementById('trTaxValueFichaForm');if(!form)return;
  for(const section of form.querySelectorAll('.form-section')){
    const title=trCleanupTaxText(section.querySelector('h4')?.textContent);let slot='';
    if(title.includes('LONG actuales'))slot='long';else if(title.includes('SHORT actuales'))slot='short';else if(title==='Imágenes actuales')slot='generic';
    if(!slot)continue;
    for(const img of section.querySelectorAll('img[data-img-id]')){
      const imageId=String(img.dataset.imgId||'');if(!imageId||section.querySelector(`[data-tr-tax-image-delete][data-tax-image-id="${CSS.escape(imageId)}"]`))continue;
      const btn=document.createElement('button');btn.type='button';btn.className='btn small danger';btn.textContent='Eliminar imagen';btn.dataset.trTaxImageDelete='1';btn.dataset.taxImageId=imageId;btn.dataset.taxImageSlot=slot;
      btn.addEventListener('click',()=>{void trTaxDeleteTaxonomyValueImage(taxId,valueId,imageId,slot);});
      const thumb=img.closest('.image-thumb-btn')||img;thumb.insertAdjacentElement('afterend',btn);
    }
  }
}
function trCleanupTaxFindLegacyValue(type,key){
  const taxId=type==='setup'?'setup':type==='vd'?'vd':type==='context'?'context':'';if(!taxId)return null;
  const plan=trCleanupTaxPlan(),domain=trCleanupTaxDomain();if(!plan||!domain)return null;
  let clean=String(key||'');try{clean=decodeURIComponent(clean);}catch{}
  const tax=domain.taxonomyById(plan,taxId),value=(tax?.values||[]).find(v=>[v?.legacyValue,v?.name,...(v?.aliases||[])].some(x=>trCleanupTaxText(x)===trCleanupTaxText(clean)))||null;
  return value?{taxId,valueId:value.id}:null;
}

const trCleanupOpenOperationModalBase=openOperationModal;
openOperationModal=function(id=null){const out=trCleanupOpenOperationModalBase(id);if(id)setTimeout(()=>trCleanupDecorateOperationModal(id),0);return out;};
Object.assign(registry,{openOperationModal,deleteOperation,deleteOperationImage});

const trCleanupTaxFichaBase=registry.trTaxOpenValueFicha;
if(typeof trCleanupTaxFichaBase==='function')registry.trTaxOpenValueFicha=function(taxId,valueId){const out=trCleanupTaxFichaBase.apply(this,arguments);setTimeout(()=>trCleanupTaxDecorateFicha(taxId,valueId),0);return out;};
const trCleanupLegacyActionKey=['open','Taxonomy','Asset','Modal'].join('');
const trCleanupLegacyFichaBase=registry[trCleanupLegacyActionKey];
if(typeof trCleanupLegacyFichaBase==='function')registry[trCleanupLegacyActionKey]=function(type,key=''){const out=trCleanupLegacyFichaBase.apply(this,arguments),resolved=trCleanupTaxFindLegacyValue(type,key);if(resolved)setTimeout(()=>trCleanupTaxDecorateFicha(resolved.taxId,resolved.valueId),0);return out;};
registry.trTaxDeleteTaxonomyValueImage=trTaxDeleteTaxonomyValueImage;


/* Batch 75 · plan cards publish inert data attributes, handled by a direct,
 * delegated DOM listener. This does not expand the structured event registry. */
let trPlanDeleteBusy=false;
function trPlanDeleteMarketReferences(marketData,ids){
  const selected=new Set(ids.map(String)),issues=[];
  for(const key of ['marketMeta','marketTicks','execSets']){
    for(const item of marketData?.[key]||[]){
      if(selected.has(String(item?.tradingPlanId||''))||selected.has(String(item?.planId||'')))
        issues.push(key);
    }
  }
  return [...new Set(issues)];
}
function trPlanDeleteUpdateToolbar(){
  const selected=document.querySelectorAll('[data-tr-plan-select]:checked').length;
  const button=document.querySelector('[data-tr-plan-delete-selected]');
  if(button){
    const next='Eliminar seleccionados ('+selected+')';
    if(button.textContent!==next)button.textContent=next;
    button.disabled=trPlanDeleteBusy||selected===0;
  }
}
document.addEventListener('change',event=>{
  if(event.target.closest?.('[data-tr-plan-select]'))trPlanDeleteUpdateToolbar();
});
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-tr-plan-delete-id],[data-tr-plan-delete-selected]');if(!button)return;
  if(button.dataset.trPlanDeleteId)void trPlanDeleteExecute([button.dataset.trPlanDeleteId]);
  else void trPlanDeleteExecute([...document.querySelectorAll('[data-tr-plan-select]:checked')].map(input=>input.dataset.trPlanSelect));
});
async function trPlanDeleteExecute(ids){
  if(trPlanDeleteBusy)return;
  let planned,rollbackPath='';
  try{
    planned=trPlanDeletionProjection(TRDomainStore.snapshot(),ids);
    const selected=planned.removedPlans.map(p=>String(p.id));
    const names=planned.removedPlans.map(p=>globalThis.TradingResearchPlanReadContract.label(p)).join('\n• ');
    if(!confirm('Eliminar '+selected.length+' Trading Plan(s):\n• '+names+
      '\n\nSe retirarán sus '+planned.removedOperations.length+' operaciones, '+
      planned.removedBatches.length+' importaciones y '+planned.removedOpportunities.length+
      ' oportunidades vinculadas.\nLos contratos y la Biblioteca global seguirán intactos.'+
      '\n\nPrimero se creará un Backup V2 completo. ¿Preparar la eliminación?'))return;
    trPlanDeleteBusy=true;trPlanDeleteUpdateToolbar();
    if(typeof trCoreWriteBlocked==='function'&&trCoreWriteBlocked())throw new Error('Hay una recuperación pendiente: eliminación bloqueada.');
    if(typeof trBackupV2BuildPayload!=='function'||typeof trBackupV2Preflight!=='function')throw new Error('Backup V2 no disponible.');
    const payload=await trBackupV2BuildPayload();
    await trBackupV2Preflight(payload);
    const linked=trPlanDeleteMarketReferences(payload.marketData,selected);
    if(linked.length)throw new Error('El plan tiene registros externos vinculados en '+linked.join(', ')+
      '. El borrado se ha bloqueado para evitar referencias huérfanas; conserva este plan hasta disponer de su limpieza específica.');
    const original=JSON.stringify(payload.workspace);
    const nativeInvoke=globalThis.__TAURI__?.core?.invoke;
    if(typeof nativeInvoke==='function'){
      const meta=await nativeInvoke('desktop_write_backup',{payload:JSON.stringify(payload),label:'plan-delete-rollback'});
      const result=typeof meta==='string'?JSON.parse(meta):meta;
      if(!result?.ok||!result.path)throw new Error('El Backup V2 nativo no fue confirmado.');
      rollbackPath=result.path;
    }else{
      trBackupV2DownloadPayload(payload);
      if(!confirm('Se ha iniciado la descarga de la copia completa Backup V2.\n\nComprueba que el archivo .trbackup está guardado fuera de la aplicación. ¿Confirmas que lo tienes?'))return;
      rollbackPath='Backup V2 descargado en tu equipo';
    }
    const phrase='ELIMINAR '+selected.length;
    if(prompt('Backup anterior: '+rollbackPath+
      '\n\nEsta eliminación incluye los datos vinculados de los planes seleccionados. Para confirmar escribe exactamente:\n'+phrase)!==phrase)return;
    await TRDomainStore.exclusive('plan.delete.safe',async()=>{
      const current=TRDomainStore.snapshot();
      if(JSON.stringify(current)!==original)throw new Error('El workspace ha cambiado después del backup. Repite la operación para respaldar los datos actuales.');
      const projected=trPlanDeletionProjection(current,selected);
      const before=current;
      try{
        TRDomainStore.command('plan.delete.safe',()=>{
          state.tradingPlans=projected.next.tradingPlans;
          state.operations=projected.next.operations;
          state.importBatches=projected.next.importBatches;
          state.opportunities=projected.next.opportunities;
          state.currentPlanId=projected.next.currentPlanId;
        },{persist:true,render:false});
        if(!(await trCoreFlush()))throw new Error('No se confirmó el guardado durable de la eliminación.');
      }catch(e){
        if(typeof trDomainRollbackMemory==='function'&&trDomainRollbackMemory(before,'plan.delete.rollback')){
          await trCorePersistNow('plan-delete-rollback');await trCoreFlush();
        }
        throw e;
      }
    });
    if(typeof pendingImportPlanId!=='undefined'&&selected.includes(String(pendingImportPlanId)))pendingImportPlanId=null;
    if(typeof gallerySelected!=='undefined'&&Array.isArray(gallerySelected)){
      const gone=new Set(planned.removedOperations.map(o=>String(o.id)));
      gallerySelected=gallerySelected.filter(id=>!gone.has(String(id)));
    }
    currentView='plans';render();
    try{await registry.runLocalBlobGarbageCollection?.();}
    catch(e){console.warn('[Trading Research · plan delete GC pending]',e);try{trCoreShowStorageWarning('Planes eliminados, pero quedó limpieza de imágenes huérfanas pendiente.');}catch{}}
    alert('Eliminación confirmada: '+selected.length+' Trading Plan(s).\nCopia de rollback:\n'+rollbackPath);
  }catch(e){
    console.error('[Trading Research · plan deletion]',e);
    alert('No se han eliminado los planes, o no se pudo confirmar la operación: '+(e?.message||String(e))+
      (rollbackPath?'\n\nCopia previa:\n'+rollbackPath:''));
  }finally{trPlanDeleteBusy=false;trPlanDeleteUpdateToolbar();}
}

Object.defineProperty(registry,'__trOperationCleanupDiagnostics',{value:()=>({version:TR_OPERATION_CLEANUP_VERSION,registeredActions:2,deletedOperations,deletedImages,deletedTaxonomyImages,lastError,ok:typeof registry.deleteOperation==='function'&&typeof registry.deleteOperationImage==='function'&&typeof registry.trTaxDeleteTaxonomyValueImage==='function'&&!lastError}),writable:false,enumerable:false,configurable:true});
})();
/* ===== END V31.23.52 OPERATION CLEANUP RUNTIME ===== */
