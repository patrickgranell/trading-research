import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_RESIDUAL_MIRROR_CLOSURE_VERSION='31.23.50';
export const TR_RESIDUAL_MIRROR_CLOSURE_NAMES=Object.freeze([
  'confirmImportPreview','openInstrumentModal','saveInstrument','saveOperationFromForm','v314ImportExecFile'
]);
export const TR_DASHBOARD_UNIT_CONTRACT_NAME='setDashboardUnit';
export const TR_DYNAMIC_ACTION_CONTRACT_NAMES=Object.freeze([
  'v311DashboardDragStart','v311DashboardDragEnd','v311DashboardDrop'
]);

const ALL_TARGETS=Object.freeze([...TR_RESIDUAL_MIRROR_CLOSURE_NAMES,TR_DASHBOARD_UNIT_CONTRACT_NAME,...TR_DYNAMIC_ACTION_CONTRACT_NAMES]);
const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const DIRECT_MIRROR=new RegExp(`\\bwindow\\.(${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.join('|')})\\s*=\\s*\\1\\s*;`,'g');
const DASHBOARD_HANDLER_REF=/\bwindow\.setDashboardUnit\s*\(/g;
const LEGACY_DRAG_ATTR=/\b(?:ondragstart|ondragend|ondragover|ondrop)\s*=/g;
const LEGACY_DRAG_ROW=`draggable=\\"true\\" ondragstart=\\"v311DashboardDragStart('\${group}','\${id}',event)\\" ondragend=\\"v311DashboardDragEnd(event)\\" ondragover=\\"event.preventDefault()\\" ondrop=\\"v311DashboardDrop('\${group}','\${id}',event)\\"`;
const DELEGATED_DRAG_ROW=`draggable=\\"true\\" data-tr-dashboard-drag=\\"1\\" data-tr-dashboard-group=\\"\${group}\\" data-tr-dashboard-id=\\"\${id}\\"`;

const finalClosure=()=>`\nObject.assign(trAppUiActionRegistryV340,{${ALL_TARGETS.join(',')}});Object.defineProperty(trAppUiActionRegistryV340,'__trResidualMirrorClosure',{value:${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.length},writable:false,enumerable:false,configurable:true});Object.defineProperty(trAppUiActionRegistryV340,'__trDashboardUnitContractClosure',{value:1,writable:false,enumerable:false,configurable:true});Object.defineProperty(trAppUiActionRegistryV340,'__trDynamicActionContractClosure',{value:${TR_DYNAMIC_ACTION_CONTRACT_NAMES.length},writable:false,enumerable:false,configurable:true});/* V31.23.50 dynamic action contract closure */\n(()=>{const registry=trAppUiActionRegistryV340,selector='[data-tr-dashboard-drag="1"]';let dispatches=0,errors=0,lastError='';const row=e=>e?.target instanceof Element?e.target.closest(selector):null;const run=(name,args)=>{try{const fn=registry[name];if(typeof fn!=='function')throw new ReferenceError('Acción drag no registrada: '+name);const out=Reflect.apply(fn,undefined,args);dispatches++;return out;}catch(e){errors++;lastError=e?.message||String(e);console.error('[Trading Research · dashboard drag]',name,e);}};document.addEventListener('dragstart',e=>{const el=row(e);if(el)run('v311DashboardDragStart',[el.dataset.trDashboardGroup||'',el.dataset.trDashboardId||'',e,el]);},false);document.addEventListener('dragend',e=>{const el=row(e);if(el)run('v311DashboardDragEnd',[e,el]);},false);document.addEventListener('dragover',e=>{if(row(e))e.preventDefault();},false);document.addEventListener('drop',e=>{const el=row(e);if(el)run('v311DashboardDrop',[el.dataset.trDashboardGroup||'',el.dataset.trDashboardId||'',e]);},false);Object.defineProperty(registry,'__trDynamicDragDiagnostics',{value:()=>({listeners:4,dispatches,errors,lastError,ok:errors===0}),writable:false,enumerable:false,configurable:true});})();/* V31.23.50 delegated dashboard drag */\n`;

export function closeResidualDirectMirrors(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(ALL_TARGETS);
  const occurrences=Object.fromEntries(ALL_TARGETS.map(n=>[n,0]));
  let touchedBlocks=0,removedEntries=0;
  let body=input.replace(SIMPLE_ASSIGN,(full,list)=>{
    const props=list.split(',').map(x=>x.trim()).filter(Boolean),moved=props.filter(n=>targets.has(n));
    if(!moved.length)return full;
    touchedBlocks++;
    for(const name of moved){occurrences[name]++;removedEntries++;}
    const remaining=props.filter(n=>!targets.has(n));
    return `${remaining.length?`Object.assign(window,{${remaining.join(',')}});`:''}/* V31.23.50 explicit window contract removed: ${moved.join(', ')} */`;
  });
  let directMirrorsRemoved=0;
  body=body.replace(DIRECT_MIRROR,(_full,name)=>{directMirrorsRemoved++;return `/* V31.23.50 residual direct mirror removed: ${name} */`;});
  let dashboardHandlerRefsRemoved=0;
  body=body.replace(DASHBOARD_HANDLER_REF,()=>{dashboardHandlerRefsRemoved++;return 'setDashboardUnit(';});

  const legacyDragHandlersBefore=(body.match(LEGACY_DRAG_ATTR)||[]).length;
  const dragRowsBefore=body.split(LEGACY_DRAG_ROW).length-1;
  if(legacyDragHandlersBefore!==4||dragRowsBefore!==1)throw new Error(`Dynamic Action Closure: deuda drag inesperada ${legacyDragHandlersBefore} attrs / ${dragRowsBefore} filas.`);
  body=body.replace(LEGACY_DRAG_ROW,DELEGATED_DRAG_ROW);
  body=body.replace('function v311DashboardDragStart(group,id,e){','function v311DashboardDragStart(group,id,e,el){');
  body=body.replace("e?.currentTarget?.classList.add('dragging');","(el||e?.currentTarget)?.classList?.add('dragging');");
  body=body.replace("function v311DashboardDragEnd(e){e?.currentTarget?.classList.remove('dragging');v311DashboardDrag=null;}","function v311DashboardDragEnd(e,el){(el||e?.currentTarget)?.classList?.remove('dragging');v311DashboardDrag=null;}");
  const legacyDragHandlersAfter=(body.match(LEGACY_DRAG_ATTR)||[]).length;
  if(legacyDragHandlersAfter!==0)throw new Error(`Dynamic Action Closure: quedan ${legacyDragHandlersAfter} atributos drag DOM0.`);
  if(!body.includes('function v311DashboardDragStart(group,id,e,el){')||!body.includes('function v311DashboardDragEnd(e,el){'))throw new Error('Dynamic Action Closure: falta adaptación currentTarget -> elemento delegado.');

  for(const name of ALL_TARGETS)if(!occurrences[name])throw new Error(`Residual Contract Closure: ${name} no apareció en Object.assign(window,...).`);
  if(!dashboardHandlerRefsRemoved)throw new Error('Dashboard Unit Contract Closure: no se encontró window.setDashboardUnit(...) en handlers declarativos.');
  const sourceOut=body+finalClosure(),after=globalSurfaceInventory(sourceOut);
  for(const name of ALL_TARGETS)if(after.names.objectAssign.includes(name))throw new Error(`Residual Contract Closure: ${name} sigue en Object.assign(window,...).`);
  for(const name of TR_RESIDUAL_MIRROR_CLOSURE_NAMES)if(after.names.direct.includes(name))throw new Error(`Residual Mirror Closure: ${name} sigue como mirror directo window.`);
  if(/\bwindow\.setDashboardUnit\s*\(/.test(sourceOut))throw new Error('Dashboard Unit Contract Closure: sigue existiendo window.setDashboardUnit(...).');
  if(after.objectAssignBlocks!==0||after.objectAssignEntries!==0||after.objectAssignUnique!==0)throw new Error(`Dynamic Action Closure: superficie Object.assign residual ${after.objectAssignBlocks}/${after.objectAssignEntries}/${after.objectAssignUnique}.`);
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==ALL_TARGETS.length)throw new Error(`Residual Contract Closure: reducción unique ${uniqueRemoved}; esperada ${ALL_TARGETS.length}.`);
  return {source:sourceOut,inventory:{version:TR_RESIDUAL_MIRROR_CLOSURE_VERSION,names:[...TR_RESIDUAL_MIRROR_CLOSURE_NAMES],dashboardUnit:TR_DASHBOARD_UNIT_CONTRACT_NAME,dashboardUnitClosed:1,dynamicActions:[...TR_DYNAMIC_ACTION_CONTRACT_NAMES],dynamicActionsClosed:TR_DYNAMIC_ACTION_CONTRACT_NAMES.length,legacyDragHandlersBefore,legacyDragHandlersAfter,dragDelegatedListeners:4,occurrences,touchedBlocks,removedEntries,directMirrorsRemoved,dashboardHandlerRefsRemoved,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique,directUnique:before.directWindowUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique,directUnique:after.directWindowUnique}}};
}
