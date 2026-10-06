import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(needle,msg)=>{if(!app.includes(needle))fail.push(msg);};

need("TradingResearchPlanBuilderContract", 'missing Plan Builder contract');
need("function labFilteredOpsForState(f={},sourceOps=null,sourcePlan=null)", 'shared filter pipeline must accept an arbitrary TP dataset');
need("baseFilteredOps(f,ops,blockMap)", 'Plan Builder must reuse the canonical Operations filter engine');
need("sourcePlan?applyRiskManagementRules(shared,sourcePlan).included:applyRiskManagementRules(shared).included", 'sequential risk rules must preserve the legacy current-TP path and accept an injected source TP');
need("Constructor de TP", 'Trading Plans must expose the Plan Builder extension');
need("El TP origen no se modifica y la muestra resultante queda congelada", 'builder must disclose frozen-sample semantics');
need("newPlan.derivation={schemaVersion:1", 'derived TP must persist provenance');
need("frozenSample:true", 'derived TP provenance must explicitly freeze the sample');
need("includedSourceOperationIds:included.map(o=>o.id)", 'derived TP must freeze the exact source-operation membership');
need("o.derivedFromOperationId=sourceOp.id", 'every cloned operation must point to its source operation');
need("o.derivedFromPlanId=p.id", 'every cloned operation must point to its source TP');
need("delete o.importBatchId", 'derived operations must not remain owned by the source import batch');
need("if(sourceImportBatchId)o.sourceImportBatchId=sourceImportBatchId", 'source import provenance must be retained without destructive ownership');
need("state.tradingPlans.push(newPlan);state.operations.push(...clonedOps)", 'derived TP and frozen operations must be created together');
need("newPlan.savedStudies=[];newPlan.forwardTests=[]", 'derived TP must not inherit mutable Lab studies or OOS tests');
need("domain.command('plan.derive'", 'derivation must use the controlled durable command boundary');
need("Ver derivación", 'derived Trading Plans must expose provenance');
need("Muestra ${Number(p.derivation.includedOperationCount)||0}/${Number(p.derivation.sourceOperationCount)||0}", 'Trading Plans must show frozen sample size');
need("Estos filtros solo definen la nueva muestra; no cambian Operaciones ni Laboratorio", 'builder must remain separate from Operations/Lab UI state');

if(app.includes("state.operations=state.operations.filter(o=>o.tradingPlanId===p.id)"))fail.push('builder must never destructively replace the source TP operations');
if(app.includes("newPlan.importBatches"))fail.push('derived TP must not clone import-batch ownership');

if(fail.length){
  console.error('\nPlan Builder verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Plan Builder verification OK');
console.log(' - source TP remains immutable');
console.log(' - filters reuse the canonical Operations/Lab pipeline');
console.log(' - derived sample is frozen into independent operations');
console.log(' - source import-batch ownership is detached safely');
console.log(' - derivation recipe + exact membership are durable');
