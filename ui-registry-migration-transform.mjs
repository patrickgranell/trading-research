import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_UI_REGISTRY_MIGRATION_VERSION='31.23.22';
export const TR_UI_REGISTRY_MIGRATION_BATCH_1=Object.freeze([
  'calendarGoLatest','calendarSetBasis','calendarSetMetric','calendarSetUnit',
  'complianceResetFilters','complianceSetBasis','complianceSetFilter','complianceSetUnit'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_2=Object.freeze([
  'calendarMoveMonth','calendarSelectDate','clearDimensionSelection','confidenceSetTarget',
  'decisionOpenStress','decisionOpenStudy','dqOpenConfigAudit','dqOpenStandardsModal'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_3=Object.freeze([
  'addRiskLotRow','addSingleLibraryItem','archiveLibraryFamily','cancelImportPreview',
  'closeForwardTest','cloudPushState','cloudSignIn','cloudSignOut'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_4=Object.freeze([
  'cloudSignUp','confirmLibraryPicker','createManualCloudSnapshot','createPlanFromLibrary',
  'deleteCloudSnapshot','deleteForwardTest','deleteReviewNote','deleteSelectedStudy'
]);
export const TR_UI_REGISTRY_MIGRATION_NAMES=Object.freeze([
  ...TR_UI_REGISTRY_MIGRATION_BATCH_1,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_2,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_3,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_4
]);

const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const PRELUDE="const trAppUiActionRegistryV322=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:(window.TradingResearchActions=Object.create(null));\n";

export function migrateUiHandlersToRegistry(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(TR_UI_REGISTRY_MIGRATION_NAMES);
  const batch1=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_1),batch2=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_2),batch3=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_3),batch4=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_4);
  const occurrences=Object.fromEntries(TR_UI_REGISTRY_MIGRATION_NAMES.map(n=>[n,0]));
  let touchedBlocks=0,registryEntries=0,batch1Entries=0,batch2Entries=0,batch3Entries=0,batch4Entries=0;
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
    }
    const remaining=props.filter(n=>!targets.has(n));
    const windowPart=remaining.length?`Object.assign(window,{${remaining.join(',')}});`:'';
    const registryPart=`Object.assign(trAppUiActionRegistryV322,{${moved.join(',')}});`;
    return `${windowPart}${registryPart}/* V31.23.22 UI registry migration: ${moved.join(', ')} */`;
  });
  for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)if(!occurrences[name])throw new Error(`UI Registry Migration: ${name} no apareció en ningún Object.assign(window,...).`);
  const out=PRELUDE+body,after=globalSurfaceInventory(out);
  for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)if(after.names.objectAssign.includes(name))throw new Error(`UI Registry Migration: ${name} sigue como export explícito window.`);
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==TR_UI_REGISTRY_MIGRATION_NAMES.length)throw new Error(`UI Registry Migration: reducción unique ${uniqueRemoved}; esperada ${TR_UI_REGISTRY_MIGRATION_NAMES.length}.`);
  return {source:out,inventory:{version:TR_UI_REGISTRY_MIGRATION_VERSION,names:[...TR_UI_REGISTRY_MIGRATION_NAMES],batches:{batch1:[...TR_UI_REGISTRY_MIGRATION_BATCH_1],batch2:[...TR_UI_REGISTRY_MIGRATION_BATCH_2],batch3:[...TR_UI_REGISTRY_MIGRATION_BATCH_3],batch4:[...TR_UI_REGISTRY_MIGRATION_BATCH_4]},touchedBlocks,registryEntries,batch1Entries,batch2Entries,batch3Entries,batch4Entries,occurrences,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique}}};
}
