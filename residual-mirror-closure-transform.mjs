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
const DRAG_ATTRS=Object.freeze(['dragstart','dragend','dragover','drop']);

const finalClosure=()=>`\nObject.assign(trAppUiActionRegistryV340,{${ALL_TARGETS.join(',')}});Object.defineProperty(trAppUiActionRegistryV340,'__trResidualMirrorClosure',{value:${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.length},writable:false,enumerable:false,configurable:true});Object.defineProperty(trAppUiActionRegistryV340,'__trDashboardUnitContractClosure',{value:1,writable:false,enumerable:false,configurable:true});Object.defineProperty(trAppUiActionRegistryV340,'__trDynamicActionContractClosure',{value:${TR_DYNAMIC_ACTION_CONTRACT_NAMES.length},writable:false,enumerable:false,configurable:true});/* V31.23.50 dynamic action contract closure */\n(()=>{const registry=trAppUiActionRegistryV340;let dispatches=0,errors=0,lastError='';const node=(e,type)=>e?.target instanceof Element?e.target.closest('[data-tr-on'+type+']'):null;const parsePair=(el,type,name)=>{const code=el?.getAttribute('data-tr-on'+type)||'';const prefix=name+"('";if(!code.startsWith(prefix)||!code.endsWith("',event)"))return null;const body=code.slice(prefix.length,-8),cut=body.indexOf("','");return cut<0?null:[body.slice(0,cut),body.slice(cut+3)];};const run=(name,args)=>{try{const fn=registry[name];if(typeof fn!=='function')throw new ReferenceError('Acción drag no registrada: '+name);const out=Reflect.apply(fn,undefined,args);dispatches++;return out;}catch(e){errors++;lastError=e?.message||String(e);console.error('[Trading Research · dashboard drag]',name,e);}};document.addEventListener('dragstart',e=>{const el=node(e,'dragstart'),a=parsePair(el,'dragstart','v311DashboardDragStart');if(el&&a)run('v311DashboardDragStart',[a[0],a[1],e,el]);},false);document.addEventListener('dragend',e=>{const el=node(e,'dragend');if(el)run('v311DashboardDragEnd',[e,el]);},false);document.addEventListener('dragover',e=>{if(node(e,'dragover'))e.preventDefault();},false);document.addEventListener('drop',e=>{const el=node(e,'drop'),a=parsePair(el,'drop','v311DashboardDrop');if(el&&a)run('v311DashboardDrop',[a[0],a[1],e]);},false);Object.defineProperty(registry,'__trDynamicDragDiagnostics',{value:()=>({listeners:4,dispatches,errors,lastError,ok:errors===0}),writable:false,enumerable:false,configurable:true});})();/* V31.23.50 delegated dashboard drag */\n`;

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
  if(legacyDragHandlersBefore!==4)throw new Error(`Dynamic Action Closure: deuda drag inesperada ${legacyDragHandlersBefore} attrs.`);
  const dragAttributeConversions={};
  for(const type of DRAG_ATTRS){const re=new RegExp(`\\bon${type}\\s*=`,`g`);const n=(body.match(re)||[]).length;if(n!==1)throw new Error(`Dynamic Action Closure: on${type} aparece ${n} veces; esperado 1.`);dragAttributeConversions[type]=n;body=body.replace(re,`data-tr-on${type}=`);}
  body=body.replace('function v311DashboardDragStart(group,id,e){','function v311DashboardDragStart(group,id,e,el){');
  body=body.replace("e?.currentTarget?.classList.add('dragging');","(el||e?.currentTarget)?.classList?.add('dragging');");
  body=body.replace("function v311DashboardDragEnd(e){e?.currentTarget?.classList.remove('dragging');v311DashboardDrag=null;}","function v311DashboardDragEnd(e,el){(el||e?.currentTarget)?.classList?.remove('dragging');v311DashboardDrag=null;}");
  const legacyDragHandlersAfter=(body.match(LEGACY_DRAG_ATTR)||[]).length;
  if(legacyDragHandlersAfter!==0)throw new Error(`Dynamic Action Closure: quedan ${legacyDragHandlersAfter} atributos drag DOM0.`);
  for(const type of DRAG_ATTRS)if(!body.includes(`data-tr-on${type}=`))throw new Error(`Dynamic Action Closure: falta data-tr-on${type}.`);
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
  return {source:sourceOut,inventory:{version:TR_RESIDUAL_MIRROR_CLOSURE_VERSION,names:[...TR_RESIDUAL_MIRROR_CLOSURE_NAMES],dashboardUnit:TR_DASHBOARD_UNIT_CONTRACT_NAME,dashboardUnitClosed:1,dynamicActions:[...TR_DYNAMIC_ACTION_CONTRACT_NAMES],dynamicActionsClosed:TR_DYNAMIC_ACTION_CONTRACT_NAMES.length,legacyDragHandlersBefore,legacyDragHandlersAfter,dragAttributeConversions,dragDelegatedListeners:4,occurrences,touchedBlocks,removedEntries,directMirrorsRemoved,dashboardHandlerRefsRemoved,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique,directUnique:before.directWindowUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique,directUnique:after.directWindowUnique}}};
}
