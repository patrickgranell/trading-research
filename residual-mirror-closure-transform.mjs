import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_RESIDUAL_MIRROR_CLOSURE_VERSION='31.23.48';
export const TR_RESIDUAL_MIRROR_CLOSURE_NAMES=Object.freeze([
  'confirmImportPreview','openInstrumentModal','saveInstrument','saveOperationFromForm','v314ImportExecFile'
]);

const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const DIRECT_MIRROR=new RegExp(`\\bwindow\\.(${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.join('|')})\\s*=\\s*\\1\\s*;`,'g');
const finalClosure=()=>`\nObject.assign(trAppUiActionRegistryV340,{${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.join(',')}});Object.defineProperty(trAppUiActionRegistryV340,'__trResidualMirrorClosure',{value:${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.length},writable:false,enumerable:false,configurable:true});/* V31.23.48 residual mirror closure */\n`;

export function closeResidualDirectMirrors(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(TR_RESIDUAL_MIRROR_CLOSURE_NAMES);
  const occurrences=Object.fromEntries(TR_RESIDUAL_MIRROR_CLOSURE_NAMES.map(n=>[n,0]));
  let touchedBlocks=0,removedEntries=0;
  let body=input.replace(SIMPLE_ASSIGN,(full,list)=>{
    const props=list.split(',').map(x=>x.trim()).filter(Boolean),moved=props.filter(n=>targets.has(n));
    if(!moved.length)return full;
    touchedBlocks++;
    for(const name of moved){occurrences[name]++;removedEntries++;}
    const remaining=props.filter(n=>!targets.has(n));
    return `${remaining.length?`Object.assign(window,{${remaining.join(',')}});`:''}/* V31.23.48 residual Object.assign mirror removed: ${moved.join(', ')} */`;
  });
  let directMirrorsRemoved=0;
  body=body.replace(DIRECT_MIRROR,(_full,name)=>{directMirrorsRemoved++;return `/* V31.23.48 residual direct mirror removed: ${name} */`;});
  for(const name of TR_RESIDUAL_MIRROR_CLOSURE_NAMES)if(!occurrences[name])throw new Error(`Residual Mirror Closure: ${name} no apareció en Object.assign(window,...).`);
  const sourceOut=body+finalClosure(),after=globalSurfaceInventory(sourceOut);
  for(const name of TR_RESIDUAL_MIRROR_CLOSURE_NAMES){
    if(after.names.objectAssign.includes(name))throw new Error(`Residual Mirror Closure: ${name} sigue en Object.assign(window,...).`);
    if(after.names.direct.includes(name))throw new Error(`Residual Mirror Closure: ${name} sigue como mirror directo window.`);
  }
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==TR_RESIDUAL_MIRROR_CLOSURE_NAMES.length)throw new Error(`Residual Mirror Closure: reducción unique ${uniqueRemoved}; esperada ${TR_RESIDUAL_MIRROR_CLOSURE_NAMES.length}.`);
  return {source:sourceOut,inventory:{version:TR_RESIDUAL_MIRROR_CLOSURE_VERSION,names:[...TR_RESIDUAL_MIRROR_CLOSURE_NAMES],occurrences,touchedBlocks,removedEntries,directMirrorsRemoved,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique,directUnique:before.directWindowUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique,directUnique:after.directWindowUnique}}};
}
