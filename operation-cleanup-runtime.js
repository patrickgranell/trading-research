/* ===== V31.23.52 RUNTIME · Operation Cleanup Controls ===== */
(()=>{
'use strict';
const TR_OPERATION_CLEANUP_VERSION='31.23.52';
const registry=window.TradingResearchActions;
if(!registry||typeof registry!=='object')throw new Error('Operation Cleanup: TradingResearchActions no disponible.');
let deletedOperations=0,deletedImages=0,lastError='';

function trCleanupOperation(id){return state.operations.find(o=>o.id===id)||null;}
function trCleanupReviewCount(o){const p=typeof getPlan==='function'?getPlan(o?.tradingPlanId):null;return (p?.reviewNotes||[]).filter(n=>n?.operationId===o?.id).length;}
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
    const controls=`<div data-tr-operation-image-cleanup="1"><div class="help">Eliminar capturas existentes</div><div class="actions">${o.images.map((im,i)=>`<button class="btn small danger" type="button" data-tr-cleanup-image="${im.id}" data-tr-onclick="deleteOperationImage('${id}','${im.id}')">Eliminar ${i+1}: ${esc(im.caption||im.name||'Captura')}</button>`).join('')}</div></div>`;
    existing.insertAdjacentHTML('beforeend',controls);
  }
}

const trCleanupOpenOperationModalBase=openOperationModal;
openOperationModal=function(id=null){const out=trCleanupOpenOperationModalBase(id);if(id)setTimeout(()=>trCleanupDecorateOperationModal(id),0);return out;};
Object.assign(registry,{openOperationModal,deleteOperation,deleteOperationImage});
Object.defineProperty(registry,'__trOperationCleanupDiagnostics',{value:()=>({version:TR_OPERATION_CLEANUP_VERSION,registeredActions:2,deletedOperations,deletedImages,lastError,ok:typeof registry.deleteOperation==='function'&&typeof registry.deleteOperationImage==='function'&&!lastError}),writable:false,enumerable:false,configurable:true});
})();
/* ===== END V31.23.52 OPERATION CLEANUP RUNTIME ===== */
