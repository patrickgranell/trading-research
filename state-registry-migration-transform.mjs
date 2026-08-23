import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_STATE_REGISTRY_MIGRATION_VERSION='31.23.18';
export const TR_STATE_REGISTRY_FINAL_BINDING_VERSION='31.23.41';
export const TR_STATE_REGISTRY_MIGRATION_BATCH_1=Object.freeze([
  'setOpsUnit','setOpsBasis','toggleOpsDay','toggleOpsModule','resetOpsFilters','setOpsQuickPeriod','setOpsDimension','applyHeatCell'
]);
export const TR_STATE_REGISTRY_MIGRATION_BATCH_2=Object.freeze([
  'addConfig','removeConfig','addHypothesis','editHyp','resetPlanConfig','addEmotionConfig','removeEmotionConfig','savePlan'
]);
export const TR_STATE_REGISTRY_MIGRATION_BATCH_3=Object.freeze([
  'setConfigTab','switchPlan','switchPlanAndOpen','togglePlanStatus','saveRiskManagement','saveRiskStrategy','saveEmotionalEditor','toggleGoalActive'
]);
export const TR_STATE_REGISTRY_MIGRATION_BATCH_4=Object.freeze([
  'deleteComplianceRule','moveComplianceRule','saveComplianceRule','deleteGoal','saveGoal','deleteTaxonomyAsset','saveTaxonomyAsset','saveVisualReference'
]);
export const TR_STATE_REGISTRY_MIGRATION_BATCH_5=Object.freeze([
  'v3110SetTargetTicks','v3110SetTrailGiveback','v3110SetTrailTrigger','v312DeleteMistake','v312MoveMistake','v312SaveMistake','v315OpenRunning','v315SetCursor'
]);
export const TR_STATE_REGISTRY_MIGRATION_BATCH_6=Object.freeze([
  'deleteVisualReference','dqSaveWorkbench','saveImportedRowEdit','v315SetRunningMode','v315SetRunningTrade','v316ApplyLink','v316SetExecEnvironment','v316SetTab'
]);
export const TR_STATE_REGISTRY_MIGRATION_BATCH_7=Object.freeze([
  'cloudPullState','deleteImportBatch','editOperation','navigate','openOperationModal','v314ImportMarketFile','v316Unlink','v319SyncExecutionSetsToOperations'
]);
export const TR_STATE_REGISTRY_MIGRATION_NAMES=Object.freeze([
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_1,
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_2,
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_3,
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_4,
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_5,
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_6,
  ...TR_STATE_REGISTRY_MIGRATION_BATCH_7
]);

const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const PRELUDE="const trAppActionRegistryV318=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:(window.TradingResearchActions=Object.create(null));\n";
const finalBindingClosure=()=>`\nObject.assign(trAppActionRegistryV318,{${TR_STATE_REGISTRY_MIGRATION_NAMES.join(',')}});Object.defineProperty(trAppActionRegistryV318,'__trStateFinalBindingClosure',{value:${TR_STATE_REGISTRY_MIGRATION_NAMES.length},writable:false,enumerable:false,configurable:true});/* V31.23.41 State final binding closure */\n`;

export function migrateStateActionsToRegistry(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(TR_STATE_REGISTRY_MIGRATION_NAMES);
  const batch1=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_1),batch2=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_2),batch3=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_3),batch4=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_4),batch5=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_5),batch6=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_6),batch7=new Set(TR_STATE_REGISTRY_MIGRATION_BATCH_7);
  const occurrences=Object.fromEntries(TR_STATE_REGISTRY_MIGRATION_NAMES.map(n=>[n,0]));
  let touchedBlocks=0,registryEntries=0,batch1Entries=0,batch2Entries=0,batch3Entries=0,batch4Entries=0,batch5Entries=0,batch6Entries=0,batch7Entries=0;
  const body=input.replace(SIMPLE_ASSIGN,(full,list)=>{
    const props=list.split(',').map(x=>x.trim()).filter(Boolean),moved=props.filter(n=>targets.has(n));
    if(!moved.length)return full;
    touchedBlocks++;
    for(const name of moved){
      occurrences[name]++;registryEntries++;
      if(batch1.has(name))batch1Entries++;
      if(batch2.has(name))batch2Entries++;
      if(batch3.has(name))batch3Entries++;
      if(batch4.has(name))batch4Entries++;
      if(batch5.has(name))batch5Entries++;
      if(batch6.has(name))batch6Entries++;
      if(batch7.has(name))batch7Entries++;
    }
    const remaining=props.filter(n=>!targets.has(n));
    const windowPart=remaining.length?`Object.assign(window,{${remaining.join(',')}});`:'';
    const registryPart=`Object.assign(trAppActionRegistryV318,{${moved.join(',')}});`;
    return `${windowPart}${registryPart}/* V31.23.18 State registry migration: ${moved.join(', ')} */`;
  });
  for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES){
    if(!occurrences[name])throw new Error(`State Registry Migration: ${name} no apareció en ningún Object.assign(window,...).`);
  }
  const out=PRELUDE+body+finalBindingClosure(),after=globalSurfaceInventory(out);
  for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES){
    if(after.names.objectAssign.includes(name))throw new Error(`State Registry Migration: ${name} sigue como export explícito window.`);
  }
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==TR_STATE_REGISTRY_MIGRATION_NAMES.length)throw new Error(`State Registry Migration: reducción unique ${uniqueRemoved}; esperada ${TR_STATE_REGISTRY_MIGRATION_NAMES.length}.`);
  return {source:out,inventory:{
    version:TR_STATE_REGISTRY_MIGRATION_VERSION,
    finalBindingVersion:TR_STATE_REGISTRY_FINAL_BINDING_VERSION,
    finalBindingRefreshEntries:TR_STATE_REGISTRY_MIGRATION_NAMES.length,
    names:[...TR_STATE_REGISTRY_MIGRATION_NAMES],
    batches:{batch1:[...TR_STATE_REGISTRY_MIGRATION_BATCH_1],batch2:[...TR_STATE_REGISTRY_MIGRATION_BATCH_2],batch3:[...TR_STATE_REGISTRY_MIGRATION_BATCH_3],batch4:[...TR_STATE_REGISTRY_MIGRATION_BATCH_4],batch5:[...TR_STATE_REGISTRY_MIGRATION_BATCH_5],batch6:[...TR_STATE_REGISTRY_MIGRATION_BATCH_6],batch7:[...TR_STATE_REGISTRY_MIGRATION_BATCH_7]},
    touchedBlocks,registryEntries,batch1Entries,batch2Entries,batch3Entries,batch4Entries,batch5Entries,batch6Entries,batch7Entries,occurrences,
    before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique},
    after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique}
  }};
}
