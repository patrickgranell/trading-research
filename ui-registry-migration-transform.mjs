import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_UI_REGISTRY_MIGRATION_VERSION='31.23.34';
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
export const TR_UI_REGISTRY_MIGRATION_BATCH_5=Object.freeze([
  'dqBatchMarkNA','dqOpenWorkbench','dqSaveStandards','dqToggleRepairChecks',
  'dqV28OpenQuality','dqWorkbenchFullEdit','dqWorkbenchJournal','duplicateReviewNote'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_6=Object.freeze([
  'duplicateSelectedStudy','exportFullBackup','filterGlossary','freezeCurrentHypothesis',
  'goalRefreshMetricFields','goalResetFilters','labClearBehavior','labClearEdge'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_7=Object.freeze([
  'labClearFocusStress','labClearGraphSelections','labClearRBin','loadForwardFilters',
  'loadSelectedStudy','markAllOperationChecklist','openBackupImportPicker','openContextHelp'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_8=Object.freeze([
  'openEmotionalEditor','openFreezeHypothesisModal','openGalleryCompare','openGlossary',
  'openImageLightbox','openImportBatchInspector','openImportedRowEditor','openLibraryPicker'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_9=Object.freeze([
  'openPlanFromLibraryModal','openSaveStudyModal','refreshCloudRemoteStatus','refreshReferenceKey',
  'refreshRiskLotVisibility','removeRiskLotRow','researchApplyCell','researchClearHistory'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_10=Object.freeze([
  'researchClearSelection','researchMarkAllRead','restoreCloudSnapshot','restoreLibraryFamily',
  'reviewOpenLinked','reviewRefreshTarget','reviewResetFilters','reviewSetBasis'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_11=Object.freeze([
  'reviewSetUnit','riskStressSetBlockSize','riskStressSetCapital','riskStressSetExtraCost',
  'riskStressSetHorizon','riskStressSetIterations','riskStressSetMethod','riskStressSetShock'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_12=Object.freeze([
  'riskStressSetThreshold','riskStressSetTolerance','robustnessSetHorizon','robustnessSetIterations',
  'runIntegrityAudit','saveCloudConnection','saveCurrentPlanToLibrary','saveCurrentStudy'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_13=Object.freeze([
  'savePlanItemToLibrary','saveReviewNote','setBlockBasis','setBlockCommissionUnit',
  'setBlockUnit','setCloudAutoSync','setLabBasis','setLabRollingMetric'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_14=Object.freeze([
  'setLabRollingWindow','setLabUnit','setResearchGridMaxCats','setResearchGridMetric',
  'setResearchGridMinN','setReviewNoteStatus','setStudySelection','startImportSelection'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_15=Object.freeze([
  'addSimpleLibraryItem','applyDimensionFilter','applyRiskToOperation','clearHeatSelection',
  'closeModal','dashboardMoveDraft','dashboardResetDraft','dashboardToggleDraft'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_16=Object.freeze([
  'decisionOpenForward','decisionOpenGoals','decisionOpenReviews','deleteSavedLibraryItem',
  'dqSetFocus','dqWorkbenchNavigate','filterOperations','goalReadFilters'
]);
export const TR_UI_REGISTRY_MIGRATION_NAMES=Object.freeze([
  ...TR_UI_REGISTRY_MIGRATION_BATCH_1,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_2,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_3,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_4,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_5,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_6,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_7,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_8,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_9,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_10,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_11,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_12,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_13,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_14,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_15,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_16
]);

const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const PRELUDE="const trAppUiActionRegistryV334=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:(window.TradingResearchActions=Object.create(null));\n";

export function migrateUiHandlersToRegistry(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(TR_UI_REGISTRY_MIGRATION_NAMES);
  const batch1=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_1),batch2=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_2),batch3=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_3),batch4=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_4),batch5=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_5),batch6=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_6),batch7=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_7),batch8=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_8),batch9=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_9),batch10=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_10),batch11=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_11),batch12=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_12),batch13=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_13),batch14=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_14),batch15=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_15),batch16=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_16);
  const occurrences=Object.fromEntries(TR_UI_REGISTRY_MIGRATION_NAMES.map(n=>[n,0]));
  let touchedBlocks=0,registryEntries=0,batch1Entries=0,batch2Entries=0,batch3Entries=0,batch4Entries=0,batch5Entries=0,batch6Entries=0,batch7Entries=0,batch8Entries=0,batch9Entries=0,batch10Entries=0,batch11Entries=0,batch12Entries=0,batch13Entries=0,batch14Entries=0,batch15Entries=0,batch16Entries=0;
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
      if(batch8.has(name))batch8Entries++;
      if(batch9.has(name))batch9Entries++;
      if(batch10.has(name))batch10Entries++;
      if(batch11.has(name))batch11Entries++;
      if(batch12.has(name))batch12Entries++;
      if(batch13.has(name))batch13Entries++;
      if(batch14.has(name))batch14Entries++;
      if(batch15.has(name))batch15Entries++;
      if(batch16.has(name))batch16Entries++;
    }
    const remaining=props.filter(n=>!targets.has(n));
    const windowPart=remaining.length?`Object.assign(window,{${remaining.join(',')}});`:'';
    const registryPart=`Object.assign(trAppUiActionRegistryV334,{${moved.join(',')}});`;
    return `${windowPart}${registryPart}/* V31.23.34 UI registry migration: ${moved.join(', ')} */`;
  });
  for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)if(!occurrences[name])throw new Error(`UI Registry Migration: ${name} no apareció en ningún Object.assign(window,...).`);
  const out=PRELUDE+body,after=globalSurfaceInventory(out);
  for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)if(after.names.objectAssign.includes(name))throw new Error(`UI Registry Migration: ${name} sigue como export explícito window.`);
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==TR_UI_REGISTRY_MIGRATION_NAMES.length)throw new Error(`UI Registry Migration: reducción unique ${uniqueRemoved}; esperada ${TR_UI_REGISTRY_MIGRATION_NAMES.length}.`);
  return {source:out,inventory:{version:TR_UI_REGISTRY_MIGRATION_VERSION,names:[...TR_UI_REGISTRY_MIGRATION_NAMES],batches:{batch1:[...TR_UI_REGISTRY_MIGRATION_BATCH_1],batch2:[...TR_UI_REGISTRY_MIGRATION_BATCH_2],batch3:[...TR_UI_REGISTRY_MIGRATION_BATCH_3],batch4:[...TR_UI_REGISTRY_MIGRATION_BATCH_4],batch5:[...TR_UI_REGISTRY_MIGRATION_BATCH_5],batch6:[...TR_UI_REGISTRY_MIGRATION_BATCH_6],batch7:[...TR_UI_REGISTRY_MIGRATION_BATCH_7],batch8:[...TR_UI_REGISTRY_MIGRATION_BATCH_8],batch9:[...TR_UI_REGISTRY_MIGRATION_BATCH_9],batch10:[...TR_UI_REGISTRY_MIGRATION_BATCH_10],batch11:[...TR_UI_REGISTRY_MIGRATION_BATCH_11],batch12:[...TR_UI_REGISTRY_MIGRATION_BATCH_12],batch13:[...TR_UI_REGISTRY_MIGRATION_BATCH_13],batch14:[...TR_UI_REGISTRY_MIGRATION_BATCH_14],batch15:[...TR_UI_REGISTRY_MIGRATION_BATCH_15],batch16:[...TR_UI_REGISTRY_MIGRATION_BATCH_16]},touchedBlocks,registryEntries,batch1Entries,batch2Entries,batch3Entries,batch4Entries,batch5Entries,batch6Entries,batch7Entries,batch8Entries,batch9Entries,batch10Entries,batch11Entries,batch12Entries,batch13Entries,batch14Entries,batch15Entries,batch16Entries,occurrences,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique}}};
}
