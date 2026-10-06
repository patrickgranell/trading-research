import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(needle,msg)=>{if(!app.includes(needle))fail.push(msg);};

need("familyId:meta.familyId||", 'new Trading Plans must receive a stable familyId');
need("p.familyId=source.familyId||", 'cloned versions must preserve familyId');
need("p.parentPlanId=source.id;", 'cloned versions must point to their parent plan version');
need("planEnvironment:globalThis.TradingResearchOperationSemanticsContract.planEnvironments.includes(meta.planEnvironment)", 'new Trading Plans must store an explicit environment');
need("validationGroupId:meta.validationGroupId||''", 'Trading Plans must store optional validation grouping');
need("p.validationGroupId='';p.validationGroupName='';", 'a cloned TP version must not silently inherit the prior validation group');
need("planEnvironments=Object.freeze(['unclassified','backtest','replay','sim','live'])", 'plan environments must stay encapsulated in the semantics contract');
need("validationGroupMembers=(workspace,groupId)", 'validation grouping must stay encapsulated in the semantics contract');
need("selectObjField('Ámbito del Trading Plan','plan-environment'", 'plan editor must expose Backtesting / Replay / Sim / Live');
need("case 'plan-group-open': {", 'Trading Plans must expose validation grouping through the existing command boundary');
need("case 'plan-group-save': {", 'missing validation group persistence workflow');
need("Cada TP/versión puede declararse Backtesting, Replay, Sim o Live", 'Trading Plan UI must explain independent plan environments');
need("<th>Ámbito</th><th>Grupo</th>", 'quick plan comparison must expose environment and validation group');
need("Object.defineProperty(globalThis,'TradingResearchOperationSemanticsContract'", 'missing canonical operation semantics contract');
need("function recordClass(o)", 'missing canonical record class resolver inside the semantics contract');
need("function layer(o)", 'missing canonical operation layer resolver inside the semantics contract');
need("function normalize(o)", 'missing additive legacy semantics normalizer inside the semantics contract');
need("TradingResearchOperationSemanticsContract.normalize({...o,tradingPlanId:o.tradingPlanId||out.currentPlanId})", 'workspace load must normalize operation semantics');
need("map(o=>globalThis.TradingResearchOperationSemanticsContract.normalize({...o,tradingPlanId:plan.id", 'legacy V2 migration must normalize operation semantics');
need("Vista agregada del Trading Plan seleccionado", 'dashboard must disclose aggregate layer scope');
need("if(f.layer&&globalThis.TradingResearchOperationSemanticsContract.layer(o)!==f.layer)return false;", 'operations lab must filter by semantic layer');
need("sel('filterLayer','Ámbito'", 'operations UI must expose the layer filter');
need("['layer','Ámbito']", 'interactive breakdown must expose the layer dimension');
need("recordClass:'backtest'", 'Ankora imports must be explicitly marked backtest');
need("op.recordClass='execution';op.executionEnvironment=v316EnvForSet(set);", 'NinjaTrader links must persist execution semantics');
need("op.recordClass='unclassified';op.executionEnvironment='';", 'legacy/manual operations must not be inferred as Live');
need("env=!o&&['backtest','replay','sim','live'].includes(planEnv)?planEnv:storedEnv", 'new operations must inherit the TP environment by default');
need("if(intent==='backtest'&&!op.executionEvidence?.linkedAt)", 'Backtesting TPs must support manual backtest operations without NinjaTrader');

if(app.includes("researchReference:{required:true")||app.includes("plan.mode='backtest_and_live'"))fail.push('a rigid Backtest -> Live requirement was introduced');

if(fail.length){
  console.error('\nOperation layer verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Operation layer verification OK');
console.log(' - Backtest / Replay / Sim / Live are independent semantic layers');
console.log(' - manual legacy operations remain unclassified unless explicitly marked');
console.log(' - Trading Plan version lineage is stable and additive');
console.log(' - Trading Plans have an explicit optional environment and validation-group link');
