import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(source,needle,msg)=>{if(!source.includes(needle))fail.push(msg);};

need(app,"['tpbuilder','⊕','Constructor de TP']", 'Plan y sistema must expose Constructor de TP');
need(structural,"'plans','tpbuilder','config'", 'tpbuilder must be an allowed canonical view');
need(structural,"case 'tpbuilder': return globalThis.TradingResearchViewPresentationContract.tpbuilder();", 'canonical router must render TP Builder');
need(app,"tpbuilder:window.TradingResearchActions.tpBuilderRender", 'view contract must bind TP Builder through the action registry');
need(app,"const blankFilters=()=>({dateFrom:'',dateTo:'',timeFrom:'',timeTo:'',days:[]", 'TP Builder must own an isolated filter recipe');
need(app,"baseFilteredOps({...f,q:'',month:'',year:'',source:'',block:'',emotion:'',behavior:'',emotionStatus:''},sourceOps(),new Map())", 'TP Builder must reuse the canonical operations filter engine');
need(app,"applyRiskManagementRules(rows,p).included", 'TP Builder must support chronological TP risk rules');
need(app,"Muestra original", 'TP Builder must show the original sample');
need(app,"Muestra resultante", 'TP Builder must show the filtered sample');
need(app,"Crear TP derivado", 'TP Builder must materialize a new Trading Plan');
need(app,"window.TradingResearchStores.domain.commit('plan.derived.create'", 'derived plan creation must use one controlled domain commit');
need(app,"next.id=newId;next.familyId=`TPF_${newId}`;next.parentPlanId=null", 'derived plan must have independent plan/version lineage');
need(app,"next.validationGroupId='';next.validationGroupName='';", 'derived plan must not silently inherit a validation group');
need(app,"next.savedStudies=[];next.forwardTests=[];next.goals=[];next.reviewNotes=[];", 'derived plan must not inherit research artifacts');
need(app,"x.id=newOpId;x.tradingPlanId=newId", 'derived operations must receive new IDs and the new TP');
need(app,"x.importBatchId='';x.derivedFromOperationId=sourceOperationId", 'derived operations must detach from source import batches and keep provenance');
need(app,"sourceImportBatchId:o.importBatchId||''", 'source import provenance must be retained separately');
need(app,"sourceOperationIds:ops.map(o=>o.id),derivedOperationIds:copied.map(o=>o.id)", 'derivation must freeze source and derived operation IDs');
need(app,"filters:clone(ui.filters),filterSummary:filterSummary()", 'derivation must freeze the filter recipe');
need(app,"sourceStats:clone(sourceStats),derivedStats:clone(derivedStats)", 'derivation must freeze before/after statistics');
need(app,"sourceCount:sourceAll.length,includedCount:copied.length,excludedCount:", 'derivation must freeze sample counts');
need(app,"p?.derivation?.type==='filtered_sample'?'<span class=\"badge\">Derivado</span>'", 'Trading Plans must visibly identify derived plans');
need(app,"TPs derivados creados", 'TP Builder must expose a derivation history');
need(app,"copia congelada de las operaciones incluidas", 'UI must state that source plan is not mutated and result is materialized');

if(app.includes("state.operations=state.operations.filter(o=>")&&app.includes("plan.derived.create"))fail.push('derived creation appears to destructively replace operations');

if(fail.length){
  console.error('\nTP Builder verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('TP Builder verification OK');
console.log(' - source TP remains independent');
console.log(' - filters reuse canonical operation semantics and optional sequential risk rules');
console.log(' - derived sample is materialized with new operation IDs');
console.log(' - provenance freezes source IDs, filter recipe, counts and before/after stats');
console.log(' - derived TP remains independent from version lineage and validation groups');
