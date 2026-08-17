import {globalSurfaceInventory,handlerRootInventory} from './global-surface-inventory.mjs';
import {assertPruneTargetsAvoidDynamicActions} from './dynamic-action-inventory.mjs';

export const TR_APP_GLOBAL_PRUNE_VERSION='31.23.10';
export const TR_APP_GLOBAL_PRUNE_TARGETS=Object.freeze([
  Object.freeze({block:'Object.assign(window,{exitLabModule});',names:['exitLabModule'],reason:'view builder interno; ya no forma parte del contrato de eventos'}),
  Object.freeze({block:'Object.assign(window,{v303MetricQualitySummary});',names:['v303MetricQualitySummary'],reason:'helper analítico interno sin handler ni consumidor cross-runtime'}),
  Object.freeze({block:'Object.assign(window,{v3192SyncAnkoraEconomics});',names:['v3192SyncAnkoraEconomics'],reason:'helper de economía llamado léxicamente dentro de app.js'}),
  Object.freeze({block:'Object.assign(window,{v3193ChronologicalOps});',names:['v3193ChronologicalOps'],reason:'helper cronológico interno sin contrato UI'}),
  Object.freeze({block:'Object.assign(window,{v3194ChronologicalOps,v3194CompareOps,v3194EquityFromZero});',names:['v3194ChronologicalOps','v3194CompareOps','v3194EquityFromZero'],reason:'helpers cronológicos internos sin contrato UI'}),
  Object.freeze({block:'Object.assign(window,{v301ExcursionInput,v301RefreshExcursionEquivalents,v301WorkbenchExcursionInput,v301CheckChangesNow,saveOperationFromForm,dqSaveWorkbench});',names:['v301RefreshExcursionEquivalents'],reason:'helper de refresco invocado léxicamente y por setTimeout; no es acción UI pública'}),
  Object.freeze({block:'Object.assign(window,{v312OpenMistakeModal,v312SaveMistake,v312DeleteMistake,v312MoveMistake,v312ToggleMistakeEvaluation,v312UpdateMistakePreview,v312SetMistakeFilter,v312ResetMistakeFilters,mistakesView,saveOperationFromForm,viewOperation});',names:['mistakesView'],reason:'view builder interno; navegación y render lo resuelven léxicamente'}),
  Object.freeze({block:'Object.assign(window,{reportsViewState,v313SetTab,v313SetUnit,v313SetBasis,v313SetScope,v313SetReportField,v313ToggleSection,v313SetCompareField,v313SavePresetPrompt,v313LoadPreset,v313DeletePreset,v313PrintReport,reportsView});',names:['reportsViewState','reportsView'],reason:'estado UI y view builder internos; State Runtime usa el binding léxico y los handlers usan acciones dedicadas'}),
  Object.freeze({block:'Object.assign(window,{dqV28OpenQuality,exitLabModule,labMaeMfeScatter,labFocusStressHeatmap,labBehaviorPenalties,researchGridModule,confidencePanel,robustnessModule,riskStressModule,walkForwardModule,complianceView,journal});',names:['exitLabModule','labMaeMfeScatter','labFocusStressHeatmap','labBehaviorPenalties','researchGridModule','confidencePanel','robustnessModule','riskStressModule','walkForwardModule','complianceView','journal'],reason:'builders analíticos internos; se conserva dqV28OpenQuality como acción de navegación dinámica'}),
  Object.freeze({block:'Object.assign(window,{labStudiesUi,setStudySelection,openSaveStudyModal,saveCurrentStudy,loadSelectedStudy,updateActiveStudy,duplicateSelectedStudy,deleteSelectedStudy,toggleCompareSelectedStudy});',names:['labStudiesUi'],reason:'estado UI léxico; sus mutaciones se realizan mediante acciones dedicadas'}),
  Object.freeze({block:'Object.assign(window,{reviewViewState,openReviewNoteModal,reviewRefreshTarget,saveReviewNote,deleteReviewNote,setReviewNoteStatus,duplicateReviewNote,reviewReadFilters,reviewResetFilters,reviewSetUnit,reviewSetBasis,reviewOpenLinked});',names:['reviewViewState'],reason:'estado UI léxico; no es acción ni contrato cross-runtime por window'}),
  Object.freeze({block:'Object.assign(window,{goalViewState,openGoalModal,goalRefreshMetricFields,saveGoal,deleteGoal,toggleGoalActive,goalReadFilters,goalResetFilters});',names:['goalViewState'],reason:'estado UI léxico; no es acción ni contrato cross-runtime por window'}),
  Object.freeze({block:'Object.assign(window,{exportFullBackup,openBackupImportPicker,importFullBackup,runIntegrityAudit});',names:['importFullBackup'],reason:'callback interno del input file registrado con addEventListener; no requiere export global explícito'}),
  Object.freeze({block:'Object.assign(window,{dqSetFocus,dqOpenConfigAudit,dataQualityView});',names:['dataQualityView'],reason:'view builder interno de Data Quality; las acciones conservan su export'}),
  Object.freeze({block:'Object.assign(window,{dqSetFocus,dqOpenWorkbench,dqWorkbenchNavigate,dqWorkbenchFullEdit,dqWorkbenchJournal,dqSaveWorkbench,dqToggleRepairChecks,dqBatchMarkNA,dqOpenStandardsModal,dqSaveStandards,dataQualityView,saveOperationFromForm,viewOperation});',names:['dataQualityView'],reason:'reexport duplicado del view builder tras Workbench; no es acción UI'}),

  Object.freeze({block:'Object.assign(window,{navigate,switchPlan,switchPlanAndOpen,openPlanModal,savePlan,togglePlanStatus,openOperationModal,closeModal,saveOperationFromForm,filterOperations,editOperation,viewOperation,showBlock,openBlockInOperations,setBlockUnit,setBlockBasis,setBlockCommissionUnit,setOpsUnit,setOpsBasis,toggleOpsDay,toggleOpsModule,resetOpsFilters,setOpsQuickPeriod,setOpsDimension,applyDimensionFilter,applyHeatCell,addConfig,removeConfig,addHypothesis,resetPlanConfig,editHyp,openInstrumentModal,refreshInstrumentCommissionTicks,saveInstrument,openRiskModal,addRiskLotRow,removeRiskLotRow,refreshRiskLotVisibility,refreshRiskEditorSummary,saveRiskStrategy,applyRiskToOperation,recalcOperation,openImportModal,startImportSelection,viewImportBatch,deleteImportBatch,openImportPreviewModal,updatePreviewField,togglePreviewRaw,cancelImportPreview,confirmImportPreview,openImportBatchInspector,viewImportBatchTrades,toggleSavedRaw,openImportedRowEditor,saveImportedRowEdit,addEmotionConfig,removeEmotionConfig,openRiskManagementModal,saveRiskManagement,readJournalFilters,openEmotionalEditor,saveEmotionalEditor,setConfigTab,openVisualReferenceModal,refreshReferenceKey,saveVisualReference,deleteVisualReference,openImageLightbox,readGalleryFilters,toggleGallerySelect,openGalleryCompare});',names:['openImportPreviewModal'],reason:'modal builder invocado léxicamente desde el flujo de importación; las acciones del inspector permanecen publicadas'}),
  Object.freeze({block:'Object.assign(window,{researchDecisionCenter,decisionOpenStudy,decisionOpenForward,decisionOpenGoals,decisionOpenReviews,decisionOpenStress,decisionOpenCompliance});',names:['researchDecisionCenter','decisionOpenCompliance'],reason:'view builder y helper de navegación resueltos léxicamente; las acciones visibles restantes siguen publicadas'}),
  Object.freeze({block:'Object.assign(window,{toggleModeCard,researchChangesView,researchSetFilter,researchMarkAllRead,researchClearHistory,researchResetBaseline,researchAlertOpen});',names:['researchChangesView'],reason:'view builder del timeline; los controles del historial conservan sus acciones públicas'}),
  Object.freeze({block:'Object.assign(window,{v302RefreshExcursionDefinition,v302RefreshWorkbenchDefinition,saveOperationFromForm,dqSaveWorkbench,viewOperation});',names:['v302RefreshExcursionDefinition','v302RefreshWorkbenchDefinition'],reason:'helpers de sincronización MAE/MFE usados internamente sin contrato de evento'}),
  Object.freeze({block:'Object.assign(window,{v314ImportMarketFile,v314ImportExecFile,v314SelectMarket,v314SelectExec,v314RecalculateExec,v314ApplyManualOffset,v314DeleteMarket,v314DeleteExec,v314MarketDataView});',names:['v314MarketDataView'],reason:'view builder Market Data V31.4 sustituido léxicamente por versiones posteriores'}),
  Object.freeze({block:'Object.assign(window,{v315SetMarketTab,v315OpenRunning,v315SetRunningTrade,v315SetRunningMode,v315SetCursor,v315PrevTrade,v315NextTrade,v315LoadTrade,v315MarketDataView,v314SelectMarket,v314SelectExec,v314RecalculateExec});',names:['v315LoadTrade','v315MarketDataView'],reason:'helpers/view builder de Running P&L consumidos léxicamente; handlers públicos permanecen'}),
  Object.freeze({block:'Object.assign(window,{v316SetTab,v316SetExecEnvironment,v316Link,v316ApplyLink,v316Unlink,v316MarketDataView,saveOperationFromForm,viewOperation});',names:['v316MarketDataView'],reason:'view builder de Execution Evidence consumido léxicamente'}),
  Object.freeze({block:'Object.assign(window,{v315RenderChart,v315RunningPanel,v316MarketTabs});',names:['v315RenderChart','v315RunningPanel','v316MarketTabs'],reason:'builders visuales internos sin handler, acción dinámica ni consumidor cross-runtime'}),
  Object.freeze({block:'Object.assign(window,{v319SyncExecutionSetsToOperations,v316LinkedOpFor,v316ReconcileView});',names:['v316LinkedOpFor','v316ReconcileView'],reason:'helpers de reconciliación llamados léxicamente; sync público se conserva'}),
  Object.freeze({block:'Object.assign(window,{v3110SetTargetTicks,v3110SetTrailTrigger,v3110SetTrailGiveback,v3110BestExitPanel,v316SetTab,v316MarketTabs,v316MarketDataView});',names:['v3110BestExitPanel','v316MarketTabs','v316MarketDataView'],reason:'builders Best Exit/Market Data internos; acciones de parámetros y tab permanecen'}),
  Object.freeze({block:'Object.assign(window,{trCorePersistenceInfo,trCoreFlush,v3111PersistencePanel,v3111ForceSave});',names:['trCorePersistenceInfo','trCoreFlush','v3111PersistencePanel','v3111ForceSave'],reason:'diagnóstico y helpers de persistencia consumidos léxicamente; sin contrato de handler o runtime externo'})
]);

export const TR_APP_GLOBAL_PRUNE_NAMES=Object.freeze([...new Set(TR_APP_GLOBAL_PRUNE_TARGETS.flatMap(x=>x.names))]);

function countExact(source,needle){return source.split(needle).length-1;}
function parseSimpleAssignBlock(block){
  const m=String(block).match(/^Object\.assign\(window,\{([^{}]*)\}\);$/);
  if(!m)throw new Error(`App Global Prune: bloque no simple/no soportado: ${block}`);
  const props=m[1].split(',').map(x=>x.trim()).filter(Boolean);
  if(props.some(x=>!/^[A-Za-z_$][\w$]*$/.test(x)))throw new Error(`App Global Prune: propiedades no simples en ${block}`);
  return props;
}

export function pruneAppGlobalExports(source,{runtimeSources=[]}={}){
  const input=String(source);
  const dynamicGuard=assertPruneTargetsAvoidDynamicActions(input,TR_APP_GLOBAL_PRUNE_NAMES);
  const handlerRoots=handlerRootInventory(input).roots;
  for(const name of TR_APP_GLOBAL_PRUNE_NAMES){
    if(handlerRoots[name])throw new Error(`App Global Prune: ${name} sigue siendo raíz de ${handlerRoots[name]} handler(s) declarativo(s).`);
    const re=new RegExp(`\\b(?:window|globalThis)\\.${name}\\b`,'g');
    const selfRefs=(input.match(re)||[]).length;
    if(selfRefs)throw new Error(`App Global Prune: ${name} todavía tiene ${selfRefs} referencia(s) explícita(s) window/globalThis dentro de app.js.`);
    let crossReads=0;
    for(const runtime of runtimeSources)crossReads+=(String(runtime).match(re)||[]).length;
    if(crossReads)throw new Error(`App Global Prune: ${name} todavía tiene ${crossReads} lectura(s) cross-runtime directa(s).`);
  }

  let out=input,removedBlocks=0,removedEntries=0,touchedBlocks=0;
  for(const target of TR_APP_GLOBAL_PRUNE_TARGETS){
    const count=countExact(out,target.block);
    if(count!==1)throw new Error(`App Global Prune: bloque objetivo ${target.block} apareció ${count} veces; se esperaba 1.`);
    const props=parseSimpleAssignBlock(target.block);
    for(const name of target.names)if(!props.includes(name))throw new Error(`App Global Prune: ${name} no está en su bloque objetivo.`);
    const remove=new Set(target.names),remaining=props.filter(name=>!remove.has(name));
    const marker=`/* V31.23.10 pruned explicit window export: ${target.names.join(', ')} */`;
    const replacement=remaining.length?`Object.assign(window,{${remaining.join(',')}});${marker}`:marker;
    out=out.replace(target.block,replacement);
    touchedBlocks++;
    removedEntries+=target.names.length;
    if(!remaining.length)removedBlocks++;
  }

  const before=globalSurfaceInventory(input),after=globalSurfaceInventory(out);
  if(before.objectAssignBlocks-after.objectAssignBlocks!==removedBlocks)throw new Error(`App Global Prune: reducción de bloques inesperada ${before.objectAssignBlocks} -> ${after.objectAssignBlocks}.`);
  if(before.objectAssignEntries-after.objectAssignEntries!==removedEntries)throw new Error(`App Global Prune: reducción de entries inesperada ${before.objectAssignEntries} -> ${after.objectAssignEntries}.`);
  for(const name of TR_APP_GLOBAL_PRUNE_NAMES)if(after.names.objectAssign.includes(name))throw new Error(`App Global Prune: ${name} sigue publicado mediante Object.assign(window, ...) después de la poda.`);
  return {source:out,inventory:{version:TR_APP_GLOBAL_PRUNE_VERSION,touchedBlocks,removedBlocks,removedEntries,targetNames:[...TR_APP_GLOBAL_PRUNE_NAMES],dynamicActionGuard:dynamicGuard.inventory,before:{objectAssignBlocks:before.objectAssignBlocks,objectAssignEntries:before.objectAssignEntries,objectAssignUnique:before.objectAssignUnique,totalUniqueGlobals:before.totalUniqueGlobals},after:{objectAssignBlocks:after.objectAssignBlocks,objectAssignEntries:after.objectAssignEntries,objectAssignUnique:after.objectAssignUnique,totalUniqueGlobals:after.totalUniqueGlobals}}};
}
