import fs from 'node:fs';

const BRIDGE_MARKER='/* ===== V31.23.6 STATE ACTION BRIDGE · build transform ===== */';
const TARGET_ACTIONS=Object.freeze([
  'switchPlan','switchPlanAndOpen','cloudPullState','importFullBackup','navigate','setConfigTab',
  'setOpsUnit','setOpsBasis','toggleOpsDay','toggleOpsModule','resetOpsFilters','setOpsQuickPeriod','setOpsDimension','applyHeatCell',
  'v316SetTab','v316SetExecEnvironment','v315OpenRunning','v315SetRunningTrade','v315SetRunningMode','v315SetCursor',
  'v3110SetTargetTicks','v3110SetTrailTrigger','v3110SetTrailGiveback',
  'saveOperationFromForm','openOperationModal','editOperation','saveEmotionalEditor','saveImportedRowEdit','dqSaveWorkbench','v316ApplyLink','v316Unlink',
  'saveInstrument','v319SyncExecutionSetsToOperations','savePlan','togglePlanStatus','saveRiskStrategy','saveRiskManagement','resetPlanConfig',
  'addConfig','removeConfig','addHypothesis','editHyp','addEmotionConfig','removeEmotionConfig','saveTaxonomyAsset','deleteTaxonomyAsset',
  'saveVisualReference','deleteVisualReference','saveComplianceRule','deleteComplianceRule','moveComplianceRule','v312SaveMistake','v312DeleteMistake','v312MoveMistake',
  'saveGoal','deleteGoal','toggleGoalActive','confirmImportPreview','deleteImportBatch','v314ImportMarketFile','v314ImportExecFile'
]);
const CROSS_RUNTIME_ACTIONS=Object.freeze([
  'confirmImportPreview','deleteImportBatch','editOperation','openOperationModal','saveInstrument','saveOperationFromForm',
  'v314ImportExecFile','v314ImportMarketFile','v319SyncExecutionSetsToOperations'
]);

function replaceExact(source,from,to,expected,label=from.slice(0,80)){
  const count=source.split(from).length-1;
  if(count!==expected)throw new Error(`State Action Bridge: ${label} apareció ${count} veces; se esperaban ${expected}.`);
  return source.split(from).join(to);
}

function bridgePrelude(){
  return `${BRIDGE_MARKER}\n`+
`const trStateActionRegistry=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:Object.create(null);\n`+
`if(!window.TradingResearchActions)window.TradingResearchActions=trStateActionRegistry;\n`+
`let trStateActionRegistryReads=0,trStateActionGlobalFallbacks=0,trStateActionPublishes=0,trStateActionMisses=0;\n`+
`const trStateActionResolve=(name)=>{\n`+
`  if(Object.prototype.hasOwnProperty.call(trStateActionRegistry,name)){trStateActionRegistryReads++;return trStateActionRegistry[name];}\n`+
`  const value=window[name];\n`+
`  if(value!==undefined){trStateActionGlobalFallbacks++;if(typeof value==='function')trStateActionRegistry[name]=value;return value;}\n`+
`  trStateActionMisses++;return undefined;\n`+
`};\n`+
`const trStateActionPublish=(name,value)=>{trStateActionRegistry[name]=value;trStateActionPublishes++;window[name]=value;return value;};\n`+
`const trStateActionDiagnostics=()=>({version:'31.23.6',registrySize:Object.keys(trStateActionRegistry).length,registryReads:trStateActionRegistryReads,globalFallbacks:trStateActionGlobalFallbacks,publishes:trStateActionPublishes,misses:trStateActionMisses,crossRuntimeActions:${JSON.stringify(CROSS_RUNTIME_ACTIONS)},targetActions:${JSON.stringify(TARGET_ACTIONS.length)},ok:trStateActionMisses===0});\n`+
`/* ===== END V31.23.6 STATE ACTION BRIDGE ===== */\n`;
}

export function transformStateActions(source){
  let out=String(source);
  if(out.includes(BRIDGE_MARKER))throw new Error('State Action Bridge ya parece aplicado.');
  const anchor="const TR_STATE_APP_LABEL='V31.17.1 · Structural Foundation III-B3.1a · Import Schema Closure';\n";
  out=replaceExact(out,anchor,anchor+'\n'+bridgePrelude(),1,'runtime label anchor');

  /* V31.25 · Batch 33: keep state-runtime.js source byte-identical and migrate only
   * its effective bundled configTab reads/writes through the explicit state contract. */
  out=replaceExact(out,"configTab:typeof configTab!=='undefined'?configTab:''","configTab:globalThis.TradingResearchConfigTabStateContract.current()",1,'configTab snapshot read');
  out=replaceExact(out,'()=>{configTab=tab;render();}','()=>{globalThis.TradingResearchConfigTabStateContract.set(tab);render();}',1,'configTab setter write');

  /* V31.25 · Batch 61: the ten editor/cloning bindings are ephemeral command-intent
   * reads only. Keep state-runtime.js source byte-identical and route the effective
   * bundled create/update/clone labels through one frozen app-owned read contract. */
  out=replaceExact(out,"trWrapDomainCommandGlobal('saveInstrument',()=>typeof editingInstrumentId!=='undefined'&&editingInstrumentId?'contract.update':'contract.create');","trWrapDomainCommandGlobal('saveInstrument',()=>globalThis.TradingResearchCommandIntentReadContract.instrument()?'contract.update':'contract.create');",1,'instrument command intent');
  out=replaceExact(out,"const label=typeof editingInstrumentId!=='undefined'&&editingInstrumentId?'contract.update':'contract.create';","const label=globalThis.TradingResearchCommandIntentReadContract.instrument()?'contract.update':'contract.create';",1,'instrument async cascade command intent');
  out=replaceExact(out,"trWrapDomainCommandGlobal('savePlan',()=>typeof editingPlanId!=='undefined'&&editingPlanId?'plan.update':(typeof cloningPlanId!=='undefined'&&cloningPlanId?'plan.clone':'plan.create'));","trWrapDomainCommandGlobal('savePlan',()=>globalThis.TradingResearchCommandIntentReadContract.plan()?'plan.update':(globalThis.TradingResearchCommandIntentReadContract.clonePlan()?'plan.clone':'plan.create'));",1,'plan create/update/clone intent');
  out=replaceExact(out,"trWrapDomainCommandGlobal('saveRiskStrategy',()=>typeof editingRiskId!=='undefined'&&editingRiskId?'plan.risk-strategy.update':'plan.risk-strategy.create');","trWrapDomainCommandGlobal('saveRiskStrategy',()=>globalThis.TradingResearchCommandIntentReadContract.riskStrategy()?'plan.risk-strategy.update':'plan.risk-strategy.create');",1,'risk strategy command intent');
  out=replaceExact(out,"trWrapDomainCommandGlobal('saveTaxonomyAsset',()=>typeof editingTaxonomyAsset!=='undefined'&&editingTaxonomyAsset?.key?'plan.taxonomy.asset.update':'plan.taxonomy.asset.create');","trWrapDomainCommandGlobal('saveTaxonomyAsset',()=>globalThis.TradingResearchCommandIntentReadContract.taxonomyAsset()?.key?'plan.taxonomy.asset.update':'plan.taxonomy.asset.create');",1,'taxonomy asset command intent');
  out=replaceExact(out,"trWrapDomainCommandGlobal('saveVisualReference',()=>typeof editingVisualReferenceId!=='undefined'&&editingVisualReferenceId?'plan.visual-reference.update':'plan.visual-reference.create');","trWrapDomainCommandGlobal('saveVisualReference',()=>globalThis.TradingResearchCommandIntentReadContract.visualReference()?'plan.visual-reference.update':'plan.visual-reference.create');",1,'visual reference command intent');
  out=replaceExact(out,"trWrapDomainCommandGlobal('saveComplianceRule',()=>typeof editingComplianceRuleId!=='undefined'&&editingComplianceRuleId?'plan.checklist.update':'plan.checklist.create');","trWrapDomainCommandGlobal('saveComplianceRule',()=>globalThis.TradingResearchCommandIntentReadContract.complianceRule()?'plan.checklist.update':'plan.checklist.create');",1,'compliance rule command intent');
  out=replaceExact(out,"trWrapDomainCommandGlobal('v312SaveMistake',()=>typeof editingMistakeId!=='undefined'&&editingMistakeId?'plan.mistake-rule.update':'plan.mistake-rule.create');","trWrapDomainCommandGlobal('v312SaveMistake',()=>globalThis.TradingResearchCommandIntentReadContract.mistake()?'plan.mistake-rule.update':'plan.mistake-rule.create');",1,'mistake rule command intent');
  out=replaceExact(out,"trWrapDomainCommandGlobal('saveGoal',()=>typeof editingGoalId!=='undefined'&&editingGoalId?'goal.update':'goal.create');","trWrapDomainCommandGlobal('saveGoal',()=>globalThis.TradingResearchCommandIntentReadContract.goal()?'goal.update':'goal.create');",1,'goal command intent');
  out=replaceExact(out,"const targetId=typeof editingId!=='undefined'&&editingId?editingId:null;","const targetId=globalThis.TradingResearchCommandIntentReadContract.operation()||null;",1,'operation command intent');

  /* V31.25 · Batch 62: State Runtime owns normalization orchestration, while app.js
   * remains the source owner of the historical plan-schema normalizers. Resolve the
   * same functions at call time through one frozen read-only contract; preserve order,
   * mutation timing, TRDomainStore.commit boundaries and persistence semantics. */
  const planNormalizerReads=`  const fns=[
    typeof ensurePlanV8Structure==='function'?ensurePlanV8Structure:null,
    typeof ensurePlanCompliance==='function'?ensurePlanCompliance:null,
    typeof ensurePlanStudies==='function'?ensurePlanStudies:null,
    typeof ensurePlanConfidence==='function'?ensurePlanConfidence:null,
    typeof ensurePlanReviews==='function'?ensurePlanReviews:null,
    typeof ensurePlanGoals==='function'?ensurePlanGoals:null,
    typeof ensurePlanForwardTests==='function'?ensurePlanForwardTests:null,
    typeof ensurePlanDataQualityV27==='function'?ensurePlanDataQualityV27:null,
    typeof ensurePlanResearchChanges==='function'?ensurePlanResearchChanges:null,
    typeof v311EnsureDashboardProfiles==='function'?v311EnsureDashboardProfiles:null
  ].filter(Boolean);`;
  out=replaceExact(out,planNormalizerReads,"  const fns=globalThis.TradingResearchPlanSchemaNormalizationReadContract.planNormalizers().filter(Boolean);",1,'plan schema normalizer reads');
  out=replaceExact(out,"if(typeof v30EnsureBaselineLocal==='function')v30EnsureBaselineLocal();","{const trPlanBaseline=globalThis.TradingResearchPlanSchemaNormalizationReadContract.baseline();if(trPlanBaseline)trPlanBaseline();}",3,'plan baseline normalizer reads');

  /* V31.25 · Batch 63: reportsViewState remains fully source-owned, including its
   * whole-object replacement on preset load. State Runtime only snapshots it, so the
   * effective bundle resolves the current object late through the read-only contract. */
  out=replaceExact(out,"if(typeof reportsViewState!=='undefined')out.reports=trUiClone(reportsViewState);","{const trReportsViewState=globalThis.TradingResearchReportsViewStateReadContract.current();if(trReportsViewState!==undefined)out.reports=trUiClone(trReportsViewState);}",1,'Reports view state snapshot read');

  const resetWrapAnchor="[\n  ['setOpsUnit','operations.unit'],";
  const resetParity="const trOperationsResetParityBase=trStateActionResolve('resetOpsFilters');\nconst trOperationsResetParity=function(...args){opsViewState.riskPolicy='raw';return trOperationsResetParityBase.apply(this,args);};\ntrStateActionPublish('resetOpsFilters',trOperationsResetParity);\n";
  out=replaceExact(out,resetWrapAnchor,resetParity+resetWrapAnchor,1,'operations reset parity anchor');

  out=replaceExact(out,'const base=window[name];','const base=trStateActionResolve(name);',4,'generic wrapper reads');
  out=replaceExact(out,'window[name]=wrapped;','trStateActionPublish(name,wrapped);',4,'generic wrapper publishes');

  const directReads=[
    ['const trOperationSaveLegacyBase=window.saveOperationFromForm;','const trOperationSaveLegacyBase=trStateActionResolve(\'saveOperationFromForm\');'],
    ['const trOpenOperationModalLegacyBase=window.openOperationModal;','const trOpenOperationModalLegacyBase=trStateActionResolve(\'openOperationModal\');'],
    ['const trEditOperationLegacyBase=window.editOperation;','const trEditOperationLegacyBase=trStateActionResolve(\'editOperation\');'],
    ['const wrapped=window.saveInstrument;','const wrapped=trStateActionResolve(\'saveInstrument\');'],
    ['const trConfirmImportPreviewBase=window.confirmImportPreview;','const trConfirmImportPreviewBase=trStateActionResolve(\'confirmImportPreview\');'],
    ['const trDeleteImportBatchBase=window.deleteImportBatch;','const trDeleteImportBatchBase=trStateActionResolve(\'deleteImportBatch\');'],
    ['const trV314ImportMarketFileBase=window.v314ImportMarketFile;','const trV314ImportMarketFileBase=trStateActionResolve(\'v314ImportMarketFile\');'],
    ['const trV314ImportExecFileBase=window.v314ImportExecFile;','const trV314ImportExecFileBase=trStateActionResolve(\'v314ImportExecFile\');']
  ];
  for(const [from,to] of directReads)out=replaceExact(out,from,to,1,from);
  out=replaceExact(out,'const syncBase=window.v319SyncExecutionSetsToOperations;','const syncBase=trStateActionResolve(\'v319SyncExecutionSetsToOperations\');',2,'v319 sync reads');

  const directPublishes=[
    ['window.switchPlan=switchPlan;','trStateActionPublish(\'switchPlan\',switchPlan);'],
    ['window.switchPlanAndOpen=switchPlanAndOpen;','trStateActionPublish(\'switchPlanAndOpen\',switchPlanAndOpen);'],
    ['window.navigate=navigate;','trStateActionPublish(\'navigate\',navigate);'],
    ['window.setConfigTab=setConfigTab;','trStateActionPublish(\'setConfigTab\',setConfigTab);'],
    ['window.saveOperationFromForm=saveOperationFromForm;','trStateActionPublish(\'saveOperationFromForm\',saveOperationFromForm);'],
    ['window.openOperationModal=openOperationModal;','trStateActionPublish(\'openOperationModal\',openOperationModal);'],
    ['window.editOperation=editOperation;','trStateActionPublish(\'editOperation\',editOperation);'],
    ['window.confirmImportPreview=confirmImportPreview;','trStateActionPublish(\'confirmImportPreview\',confirmImportPreview);'],
    ['window.deleteImportBatch=deleteImportBatch;','trStateActionPublish(\'deleteImportBatch\',deleteImportBatch);'],
    ['window.v314ImportMarketFile=v314ImportMarketFile;','trStateActionPublish(\'v314ImportMarketFile\',v314ImportMarketFile);'],
    ['window.v314ImportExecFile=v314ImportExecFile;','trStateActionPublish(\'v314ImportExecFile\',v314ImportExecFile);']
  ];
  for(const [from,to] of directPublishes)out=replaceExact(out,from,to,1,from);

  out=replaceExact(out,'window.v319SyncExecutionSetsToOperations=syncStub;','trStateActionPublish(\'v319SyncExecutionSetsToOperations\',syncStub);',1,'v319 sync stub publish');
  out=replaceExact(out,'window.v319SyncExecutionSetsToOperations=syncChecked;','trStateActionPublish(\'v319SyncExecutionSetsToOperations\',syncChecked);',1,'v319 sync checked publish');
  out=replaceExact(out,'window.v319SyncExecutionSetsToOperations=syncBase;','trStateActionPublish(\'v319SyncExecutionSetsToOperations\',syncBase);',2,'v319 sync restores');

  out=replaceExact(
    out,
    "function trStateRuntimeDiagnostics(){return {runtime:TR_STATE_RUNTIME_VERSION,domain:TRDomainStore.diagnostics(),ui:TRUIStore.diagnostics()};}",
    "function trStateRuntimeDiagnostics(){return {runtime:TR_STATE_RUNTIME_VERSION,domain:TRDomainStore.diagnostics(),ui:TRUIStore.diagnostics(),actionBridge:trStateActionDiagnostics()};}",
    1,
    'state diagnostics integration'
  );
  out=replaceExact(
    out,
    'window.TradingResearchStores=Object.freeze({domain:TRDomainStore,ui:TRUIStore,diagnostics:trStateRuntimeDiagnostics});',
    'window.TradingResearchStores=Object.freeze({domain:TRDomainStore,ui:TRUIStore,actions:trStateActionRegistry,diagnostics:trStateRuntimeDiagnostics});',
    1,
    'TradingResearchStores action exposure'
  );

  const inventory=stateActionInventory(out);
  if(inventory.crossRuntimeWindowReads!==0)throw new Error(`State Action Bridge dejó ${inventory.crossRuntimeWindowReads} lecturas window directas cross-runtime.`);
  if(inventory.resolveCalls<14||inventory.publishCalls<19)throw new Error(`State Action Bridge incompleto: resolve ${inventory.resolveCalls}, publish ${inventory.publishCalls}.`);
  return {source:out,inventory};
}

export function stateActionInventory(source){
  const s=String(source);
  const resolveCalls=(s.match(/trStateActionResolve\s*\(/g)||[]).length;
  const publishCalls=(s.match(/trStateActionPublish\s*\(/g)||[]).length;
  let crossRuntimeWindowReads=0;
  for(const name of CROSS_RUNTIME_ACTIONS){
    const re=new RegExp(`\\bwindow\\.${name}\\b`,'g');
    crossRuntimeWindowReads+=(s.match(re)||[]).length;
  }
  return {
    bridge:s.includes(BRIDGE_MARKER),
    resolveCalls,
    publishCalls,
    crossRuntimeWindowReads,
    targetActions:TARGET_ACTIONS.length,
    crossRuntimeActions:[...CROSS_RUNTIME_ACTIONS]
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const file=process.argv[2]||'state-runtime.js';
  const source=fs.readFileSync(file,'utf8');
  const transformed=transformStateActions(source);
  console.log('State Action Bridge transform OK');
  console.log(` - Registry-aware resolves: ${transformed.inventory.resolveCalls}`);
  console.log(` - Registry-aware publishes: ${transformed.inventory.publishCalls}`);
  console.log(` - Cross-runtime direct window reads after transform: ${transformed.inventory.crossRuntimeWindowReads}`);
  console.log(` - State-wrapped action inventory: ${transformed.inventory.targetActions}`);
}