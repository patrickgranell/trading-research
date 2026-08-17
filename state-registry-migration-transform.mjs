import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_STATE_REGISTRY_MIGRATION_VERSION='31.23.12';
export const TR_STATE_REGISTRY_MIGRATION_NAMES=Object.freeze([
  'setOpsUnit','setOpsBasis','toggleOpsDay','toggleOpsModule','resetOpsFilters','setOpsQuickPeriod','setOpsDimension','applyHeatCell'
]);

const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const PRELUDE="const trAppActionRegistryV312=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:(window.TradingResearchActions=Object.create(null));\n";

export function migrateStateActionsToRegistry(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(TR_STATE_REGISTRY_MIGRATION_NAMES);
  const occurrences=Object.fromEntries(TR_STATE_REGISTRY_MIGRATION_NAMES.map(n=>[n,0]));
  let touchedBlocks=0,registryEntries=0;
  const body=input.replace(SIMPLE_ASSIGN,(full,list)=>{
    const props=list.split(',').map(x=>x.trim()).filter(Boolean),moved=props.filter(n=>targets.has(n));
    if(!moved.length)return full;
    touchedBlocks++;
    for(const name of moved){occurrences[name]++;registryEntries++;}
    const remaining=props.filter(n=>!targets.has(n));
    const windowPart=remaining.length?`Object.assign(window,{${remaining.join(',')}});`:'';
    const registryPart=`Object.assign(trAppActionRegistryV312,{${moved.join(',')}});`;
    return `${windowPart}${registryPart}/* V31.23.12 State registry migration: ${moved.join(', ')} */`;
  });
  for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES){
    if(!occurrences[name])throw new Error(`State Registry Migration: ${name} no apareció en ningún Object.assign(window,...).`);
  }
  const out=PRELUDE+body,after=globalSurfaceInventory(out);
  for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES){
    if(after.names.objectAssign.includes(name))throw new Error(`State Registry Migration: ${name} sigue como export explícito window.`);
  }
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==TR_STATE_REGISTRY_MIGRATION_NAMES.length)throw new Error(`State Registry Migration: reducción unique ${uniqueRemoved}; esperada ${TR_STATE_REGISTRY_MIGRATION_NAMES.length}.`);
  return {source:out,inventory:{version:TR_STATE_REGISTRY_MIGRATION_VERSION,names:[...TR_STATE_REGISTRY_MIGRATION_NAMES],touchedBlocks,registryEntries,occurrences,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique}}};
}
