import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_STATE_REGISTRY_MIGRATION_VERSION='31.23.13';
export const TR_STATE_REGISTRY_MIGRATION_BATCH_1=Object.freeze([
  'setOpsUnit','setOpsBasis','toggleOpsDay','toggleOpsModule','resetOpsFilters','setOpsQuickPeriod','setOpsDimension','applyHeatCell'
]);
export const TR_STATE_REGISTRY_MIGRATION_BATCH_2=Object.freeze([
  'addConfig','removeConfig','addHypothesis','editHyp','resetPlanConfig','addEmotionConfig','removeEmotionConfig','savePlan'
]);
export const TR_STATE_REGISTRY_MIGRATION_NAMES=Object.freeze([
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_1,
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_2
]);

const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const PRELUDE="const trAppActionRegistryV313=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:(window.TradingResearchActions=Object.create(null));\n";

export function migrateStateActionsToRegistry(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(TR_STATE_REGISTRY_MIGRATION_NAMES);
  const batch1=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_1),batch2=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_2);
  const occurrences=Object.fromEntries(TR_STATE_REGISTRY_MIGRATION_NAMES.map(n=>[n,0]));
  let touchedBlocks=0,registryEntries=0,batch1Entries=0,batch2Entries=0;
  const body=input.replace(SIMPLE_ASSIGN,(full,list)=>{
    const props=list.split(',').map(x=>x.trim()).filter(Boolean),moved=props.filter(n=>targets.has(n));
    if(!moved.length)return full;
    touchedBlocks++;
    for(const name of moved){
      occurrences[name]++;registryEntries++;
      if(batch1.has(name))batch1Entries++;
      if(batch2.has(name))batch2Entries++;
    }
    const remaining=props.filter(n=>!targets.has(n));
    const windowPart=remaining.length?`Object.assign(window,{${remaining.join(',')}});`:'';
    const registryPart=`Object.assign(trAppActionRegistryV313,{${moved.join(',')}});`;
    return `${windowPart}${registryPart}/* V31.23.13 State registry migration: ${moved.join(', ')} */`;
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
  return {source:out,inventory:{
    version:TR_STATE_REGISTRY_MIGRATION_VERSION,
    names:[...TR_STATE_REGISTRY_MIGRATION_NAMES],
    batches:{batch1:[...TR_STATE_REGISTRY_MIGRATION_BATCH_1],batch2:[...TR_STATE_REGISTRY_MIGRATION_BATCH_2]},
    touchedBlocks,registryEntries,batch1Entries,batch2Entries,occurrences,
    before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique},
    after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique}
  }};
}
