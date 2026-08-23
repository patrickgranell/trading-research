import {globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_UI_REGISTRY_MIGRATION_VERSION='31.23.45';
export const TR_UI_REGISTRY_FINAL_BINDING_VERSION='31.23.41';
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
export const TR_UI_REGISTRY_MIGRATION_BATCH_17=Object.freeze([
  'swapResearchGridAxes','testCloudConnection','toggleCompareSelectedStudy','toggleGallerySelect',
  'toggleOperationChecklistEvaluation','togglePreviewRaw','toggleSavedRaw','updateActiveStudy'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_18=Object.freeze([
  'updateOperationChecklistPreview','v301CheckChangesNow','v301ExcursionInput','v301WorkbenchExcursionInput',
  'v311DashboardSetSize','v311DeleteDashboardProfile','v311DuplicateDashboardProfile','v311OpenDashboardManager'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_19=Object.freeze([
  'v311OpenNewDashboardProfile','v311OpenRenameDashboardProfile','v312ResetMistakeFilters','v312ToggleMistakeEvaluation',
  'v312UpdateMistakePreview','v313DeletePreset','v313LoadPreset','v313PrintReport'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_20=Object.freeze([
  'v313SavePresetPrompt','v313SetScope','v313ToggleSection','v314DeleteExec',
  'v314DeleteMarket','v314SelectExec','v314SelectMarket','v316Link'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_21=Object.freeze([
  'v318ToggleNavGroup','viewImportBatch','wfSetInitialTrain','wfSetMode',
  'wfSetSplit','wfSetTestSize','labApplyBehavior','labApplyEdge'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_22=Object.freeze([
  'labApplyFocusStress','labApplyRBin','openBlockInOperations','openComplianceRuleModal',
  'openGoalModal','openRiskManagementModal','readGalleryFilters','readJournalFilters'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_23=Object.freeze([
  'recalcOperation','researchAlertOpen','saveDashboardCustomization','setAppTheme',
  'setExitBeTrigger','setLabHeatMetric','setLabHistBin','setLabScatterX'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_24=Object.freeze([
  'setResearchGridDim','showBlock','v311CreateDashboardProfile','v311RenameDashboardProfile',
  'v311SwitchDashboardProfile','v312OpenMistakeModal','v313SetBasis','v313SetTab'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_25=Object.freeze([
  'v313SetUnit','v314ApplyManualOffset','v314RecalculateExec','v315SetMarketTab',
  'viewImportBatchTrades','labReset','researchResetBaseline','researchSetFilter'
]);
export const TR_UI_REGISTRY_MIGRATION_BATCH_26=Object.freeze([
  'v313SetCompareField','v315NextTrade','v315PrevTrade','openDashboardCustomizer',
  'openReviewNoteModal','openVisualReferenceModal','refreshInstrumentCommissionTicks','reviewReadFilters'
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
  ...TR_UI_REGISTRY_MIGRATION_BATCH_16,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_17,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_18,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_19,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_20,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_21,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_22,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_23,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_24,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_25,
  ...TR_UI_REGISTRY_MIGRATION_BATCH_26
]);

const SIMPLE_ASSIGN=/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g;
const PRELUDE="const trAppUiActionRegistryV340=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:(window.TradingResearchActions=Object.create(null));\n";
const finalBindingClosure=()=>`\nObject.assign(trAppUiActionRegistryV340,{${TR_UI_REGISTRY_MIGRATION_NAMES.join(',')}});Object.defineProperty(trAppUiActionRegistryV340,'__trUiFinalBindingClosure',{value:${TR_UI_REGISTRY_MIGRATION_NAMES.length},writable:false,enumerable:false,configurable:true});/* V31.23.41 UI final binding closure */\n`;

export function migrateUiHandlersToRegistry(source){
  const input=String(source),before=globalSurfaceInventory(input),targets=new Set(TR_UI_REGISTRY_MIGRATION_NAMES);
  const batch1=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_1),batch2=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_2),batch3=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_3),batch4=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_4),batch5=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_5),batch6=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_6),batch7=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_7),batch8=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_8),batch9=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_9),batch10=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_10),batch11=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_11),batch12=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_12),batch13=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_13),batch14=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_14),batch15=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_15),batch16=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_16),batch17=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_17),batch18=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_18),batch19=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_19),batch20=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_20),batch21=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_21),batch22=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_22),batch23=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_23),batch24=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_24),batch25=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_25),batch26=new Set(TR_UI_REGISTRY_MIGRATION_BATCH_26);
  const occurrences=Object.fromEntries(TR_UI_REGISTRY_MIGRATION_NAMES.map(n=>[n,0]));
  let touchedBlocks=0,registryEntries=0,batch1Entries=0,batch2Entries=0,batch3Entries=0,batch4Entries=0,batch5Entries=0,batch6Entries=0,batch7Entries=0,batch8Entries=0,batch9Entries=0,batch10Entries=0,batch11Entries=0,batch12Entries=0,batch13Entries=0,batch14Entries=0,batch15Entries=0,batch16Entries=0,batch17Entries=0,batch18Entries=0,batch19Entries=0,batch20Entries=0,batch21Entries=0,batch22Entries=0,batch23Entries=0,batch24Entries=0,batch25Entries=0,batch26Entries=0;
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
      if(batch17.has(name))batch17Entries++;
      if(batch18.has(name))batch18Entries++;
      if(batch19.has(name))batch19Entries++;
      if(batch20.has(name))batch20Entries++;
      if(batch21.has(name))batch21Entries++;
      if(batch22.has(name))batch22Entries++;
      if(batch23.has(name))batch23Entries++;
      if(batch24.has(name))batch24Entries++;
      if(batch25.has(name))batch25Entries++;
      if(batch26.has(name))batch26Entries++;
    }
    const remaining=props.filter(n=>!targets.has(n));
    const windowPart=remaining.length?`Object.assign(window,{${remaining.join(',')}});`:'';
    const registryPart=`Object.assign(trAppUiActionRegistryV340,{${moved.join(',')}});`;
    return `${windowPart}${registryPart}/* V31.23.45 UI registry migration: ${moved.join(', ')} */`;
  });
  for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)if(!occurrences[name])throw new Error(`UI Registry Migration: ${name} no apareció en ningún Object.assign(window,...).`);
  const out=PRELUDE+body+finalBindingClosure(),after=globalSurfaceInventory(out);
  for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)if(after.names.objectAssign.includes(name))throw new Error(`UI Registry Migration: ${name} sigue como export explícito window.`);
  const uniqueRemoved=before.objectAssignUnique-after.objectAssignUnique;
  if(uniqueRemoved!==TR_UI_REGISTRY_MIGRATION_NAMES.length)throw new Error(`UI Registry Migration: reducción unique ${uniqueRemoved}; esperada ${TR_UI_REGISTRY_MIGRATION_NAMES.length}.`);
  return {source:out,inventory:{version:TR_UI_REGISTRY_MIGRATION_VERSION,finalBindingVersion:TR_UI_REGISTRY_FINAL_BINDING_VERSION,finalBindingRefreshEntries:TR_UI_REGISTRY_MIGRATION_NAMES.length,names:[...TR_UI_REGISTRY_MIGRATION_NAMES],batches:{batch1:[...TR_UI_REGISTRY_MIGRATION_BATCH_1],batch2:[...TR_UI_REGISTRY_MIGRATION_BATCH_2],batch3:[...TR_UI_REGISTRY_MIGRATION_BATCH_3],batch4:[...TR_UI_REGISTRY_MIGRATION_BATCH_4],batch5:[...TR_UI_REGISTRY_MIGRATION_BATCH_5],batch6:[...TR_UI_REGISTRY_MIGRATION_BATCH_6],batch7:[...TR_UI_REGISTRY_MIGRATION_BATCH_7],batch8:[...TR_UI_REGISTRY_MIGRATION_BATCH_8],batch9:[...TR_UI_REGISTRY_MIGRATION_BATCH_9],batch10:[...TR_UI_REGISTRY_MIGRATION_BATCH_10],batch11:[...TR_UI_REGISTRY_MIGRATION_BATCH_11],batch12:[...TR_UI_REGISTRY_MIGRATION_BATCH_12],batch13:[...TR_UI_REGISTRY_MIGRATION_BATCH_13],batch14:[...TR_UI_REGISTRY_MIGRATION_BATCH_14],batch15:[...TR_UI_REGISTRY_MIGRATION_BATCH_15],batch16:[...TR_UI_REGISTRY_MIGRATION_BATCH_16],batch17:[...TR_UI_REGISTRY_MIGRATION_BATCH_17],batch18:[...TR_UI_REGISTRY_MIGRATION_BATCH_18],batch19:[...TR_UI_REGISTRY_MIGRATION_BATCH_19],batch20:[...TR_UI_REGISTRY_MIGRATION_BATCH_20],batch21:[...TR_UI_REGISTRY_MIGRATION_BATCH_21],batch22:[...TR_UI_REGISTRY_MIGRATION_BATCH_22],batch23:[...TR_UI_REGISTRY_MIGRATION_BATCH_23],batch24:[...TR_UI_REGISTRY_MIGRATION_BATCH_24],batch25:[...TR_UI_REGISTRY_MIGRATION_BATCH_25],batch26:[...TR_UI_REGISTRY_MIGRATION_BATCH_26]},touchedBlocks,registryEntries,batch1Entries,batch2Entries,batch3Entries,batch4Entries,batch5Entries,batch6Entries,batch7Entries,batch8Entries,batch9Entries,batch10Entries,batch11Entries,batch12Entries,batch13Entries,batch14Entries,batch15Entries,batch16Entries,batch17Entries,batch18Entries,batch19Entries,batch20Entries,batch21Entries,batch22Entries,batch23Entries,batch24Entries,batch25Entries,batch26Entries,occurrences,before:{blocks:before.objectAssignBlocks,entries:before.objectAssignEntries,unique:before.objectAssignUnique},after:{blocks:after.objectAssignBlocks,entries:after.objectAssignEntries,unique:after.objectAssignUnique}}};
}
