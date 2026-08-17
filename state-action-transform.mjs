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
  if(inventory.resolveCalls<14||inventory.publishCalls<20)throw new Error(`State Action Bridge incompleto: resolve ${inventory.resolveCalls}, publish ${inventory.publishCalls}.`);
  return {source:out,inventory};
}

export function stateActionInventory(source){
  const s=String(source);
  const resolveCalls=(s.match(/trStateActionResolve\s*\(/g)||[]).length-1; // exclude helper declaration
  const publishCalls=(s.match(/trStateActionPublish\s*\(/g)||[]).length-1;
  let crossRuntimeWindowReads=0;
  for(const name of CROSS_RUNTIME_ACTIONS){
    const re=new RegExp(`\\bwindow\\.${name}\\b`,'g');
    crossRuntimeWindowReads+=(s.match(re)||[]).length;
  }
  return {
    bridge:s.includes(BRIDGE_MARKER),
    resolveCalls:Math.max(0,resolveCalls),
    publishCalls:Math.max(0,publishCalls),
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
