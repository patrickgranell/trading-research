/* ===== V31.23.52 RUNTIME · Operation Cleanup Controls ===== */
(()=>{
'use strict';
const TR_OPERATION_CLEANUP_VERSION='31.23.52';
const registry=window.TradingResearchActions;
if(!registry||typeof registry!=='object')throw new Error('Operation Cleanup: TradingResearchActions no disponible.');
let deletedOperations=0,deletedImages=0,deletedTaxonomyImages=0,lastError='';

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
const trCleanupLegacyFichaBase=registry.openTaxonomyAssetModal;
if(typeof trCleanupLegacyFichaBase==='function')registry.openTaxonomyAssetModal=function(type,key=''){const out=trCleanupLegacyFichaBase.apply(this,arguments),resolved=trCleanupTaxFindLegacyValue(type,key);if(resolved)setTimeout(()=>trCleanupTaxDecorateFicha(resolved.taxId,resolved.valueId),0);return out;};
registry.trTaxDeleteTaxonomyValueImage=trTaxDeleteTaxonomyValueImage;

Object.defineProperty(registry,'__trOperationCleanupDiagnostics',{value:()=>({version:TR_OPERATION_CLEANUP_VERSION,registeredActions:3,deletedOperations,deletedImages,deletedTaxonomyImages,lastError,ok:typeof registry.deleteOperation==='function'&&typeof registry.deleteOperationImage==='function'&&typeof registry.trTaxDeleteTaxonomyValueImage==='function'&&!lastError}),writable:false,enumerable:false,configurable:true});
})();
/* ===== END V31.23.52 OPERATION CLEANUP RUNTIME ===== */
