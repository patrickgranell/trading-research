import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_RESIDUAL_MIRROR_CLOSURE_VERSION='31.23.49';
export const TR_RESIDUAL_MIRROR_CLOSURE_NAMES=Object.freeze([
  'confirmImportPreview','openInstrumentModal','saveInstrument','saveOperationFromForm','v314ImportExecFile'
]);
export const TR_DASHBOARD_UNIT_CONTRACT_NAME='setDashboardUnit';

const ALL_TARGETS=Object.freeze([...TR_RESIDUAL_MIRROR_CLOSURE_NAMES,TR_DASHBOARD_UNIT_CONTRACT_NAME]);
const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const DIRECT_MIRROR=new RegExp(`\\bwindow\\.(${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.join('|')})\\s*=\\s*\\1\\s*;`,'g');
const DASHBOARD_HANDLER_REF=/\bwindow\.setDashboardUnit\s*\(/g;
const finalClosure=()=>`\nObject.assign(trAppUiActionRegistryV340,{${ALL_TARGETS.join(',')}});Object.defineProperty(trAppUiActionRegistryV340,'__trResidualMirrorClosure',{value:${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.length},writable:false,enumerable:false,configurable:true});Object.defineProperty(trAppUiActionRegistryV340,'__trDashboardUnitContractClosure',{value:1,writable:false,enumerable:false,configurable:true});/* V31.23.49 dashboard unit contract closure */\n`;

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
    return `${remaining.length?`Object.assign(window,{${remaining.join(',')}});`:''}/* V31.23.49 explicit window contract removed: ${moved.join(', ')} */`;
  });
  let directMirrorsRemoved=0;
  body=body.replace(DIRECT_MIRROR,(_full,name)=>{directMirrorsRemoved++;return `/* V31.23.49 residual direct mirror removed: ${name} */`;});
  let dashboardHandlerRefsRemoved=0;
  body=body.replace(DASHBOARD_HANDLER_REF,()=>{dashboardHandlerRefsRemoved++;return 'setDashboardUnit(';});
  for(const name of ALL_TARGETS)if(!occurrences[name])throw new Error(`Residual Contract Closure: ${name} no apareció en Object.assign(window,...).`);
  if(!dashboardHandlerRefsRemoved)throw new Error('Dashboard Unit Contract Closure: no se encontró window.setDashboardUnit(...) en handlers declarativos.');
  const sourceOut=body+finalClosure(),after=globalSurfaceInventory(sourceOut);
  for(const name of ALL_TARGETS){
    if(after.names.objectAssign.includes(name))throw new Error(`Residual Contract Closure: ${name} sigue en Object.assign(window,...).`);
  }
  for(const name of TR_RESIDUAL_MIRROR_CLOSURE_NAMES)if(after.names.direct.includes(name))throw new Error(`Residual Mirror Closure: ${name} sigue como mirror directo window.`);
  if(/\bwindow\.setDashboardUnit\s*\(/.test(sourceOut))throw new Error('Dashboard Unit Contract Closure: sigue existiendo window.setDashboardUnit(...).');
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==ALL_TARGETS.length)throw new Error(`Residual Contract Closure: reducción unique ${uniqueRemoved}; esperada ${ALL_TARGETS.length}.`);
  return {source:sourceOut,inventory:{version:TR_RESIDUAL_MIRROR_CLOSURE_VERSION,names:[...TR_RESIDUAL_MIRROR_CLOSURE_NAMES],dashboardUnit:TR_DASHBOARD_UNIT_CONTRACT_NAME,dashboardUnitClosed:1,occurrences,touchedBlocks,removedEntries,directMirrorsRemoved,dashboardHandlerRefsRemoved,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique,directUnique:before.directWindowUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique,directUnique:after.directWindowUnique}}};
}
