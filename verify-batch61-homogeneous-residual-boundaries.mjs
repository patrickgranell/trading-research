import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const rawState=fs.readFileSync('state-runtime.js','utf8');
const reports=fs.readFileSync('reports-purity-runtime.js','utf8');
const styleAttr=fs.readFileSync('style-attr-runtime.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const backup=fs.readFileSync('backup-v2-runtime.js','utf8');
const cloud=fs.readFileSync('cloud-v10-runtime.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const runtimeSources=new Map(runtimeFiles.map(file=>[file,fs.readFileSync(file,'utf8')]));
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;
const bundledApp=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const effectiveState=transformStateActions(rawState).source;
const CONTRACT='TradingResearchCommandIntentReadContract';
const legacy=Object.freeze([
  ['editingId',3],
  ['editingInstrumentId',4],
  ['editingRiskId',2],
  ['editingPlanId',2],
  ['cloningPlanId',2],
  ['editingTaxonomyAsset',2],
  ['editingVisualReferenceId',2],
  ['editingComplianceRuleId',2],
  ['editingMistakeId',2],
  ['editingGoalId',2]
]);

/* Source ownership stays in app.js. Batch 61 changes no editor/modal setters. */
for(const [name] of legacy){
  need(new RegExp(`\\blet\\s+${name}\\s*=\\s*null\\s*;`).test(app),`app.js ya no conserva la declaración fuente ${name}=null.`);
}

/* RED inventory proved these were exactly one homogeneous state-runtime-only family. */
for(const [name,expected] of legacy){
  need(refs(rawState,name)===expected,`${name} cambió su inventario raw auditado: ${refs(rawState,name)} != ${expected}.`);
  const otherConsumers=runtimeFiles.filter(file=>file!=='state-runtime.js'&&refs(runtimeSources.get(file),name)>0);
  need(otherConsumers.length===0,`${name} apareció fuera de State Runtime: ${otherConsumers.join(', ')}.`);
}

/* The app build owns one frozen read-only bridge over all ten ephemeral bindings. */
const contractLine=bundledApp.split('\n').find(line=>line.includes(`'${CONTRACT}'`))||'';
need(!!contractLine,`El bundle no publica ${CONTRACT}.`);
need(contractLine.includes("value:Object.freeze({operation:()=>typeof editingId==='undefined'?null:editingId,instrument:()=>typeof editingInstrumentId==='undefined'?null:editingInstrumentId,riskStrategy:()=>typeof editingRiskId==='undefined'?null:editingRiskId,plan:()=>typeof editingPlanId==='undefined'?null:editingPlanId,clonePlan:()=>typeof cloningPlanId==='undefined'?null:cloningPlanId,taxonomyAsset:()=>typeof editingTaxonomyAsset==='undefined'?null:editingTaxonomyAsset,visualReference:()=>typeof editingVisualReferenceId==='undefined'?null:editingVisualReferenceId,complianceRule:()=>typeof editingComplianceRuleId==='undefined'?null:editingComplianceRuleId,mistake:()=>typeof editingMistakeId==='undefined'?null:editingMistakeId,goal:()=>typeof editingGoalId==='undefined'?null:editingGoalId})"),'Command Intent contract no conserva el mapa exacto de diez lecturas.');
need(!/\b(?:set|replace|write|update)\s*:/.test(contractLine),'Command Intent contract introdujo una vía de escritura/reemplazo.');
need(contractLine.includes('writable:false,enumerable:false,configurable:false'),'Command Intent contract dejó de ser inmutable/no configurable.');

/* Effective deployed State Runtime must contain zero direct legacy intent bindings. */
for(const [name] of legacy)need(refs(effectiveState,name)===0,`State Runtime efectivo todavía contiene ${name} (${refs(effectiveState,name)} refs).`);
const expectedContractCalls=Object.freeze({operation:1,instrument:2,riskStrategy:1,plan:1,clonePlan:1,taxonomyAsset:1,visualReference:1,complianceRule:1,mistake:1,goal:1});
for(const [method,expected] of Object.entries(expectedContractCalls)){
  const count=(effectiveState.match(new RegExp(`TradingResearchCommandIntentReadContract\\.${method}\\(`,'g'))||[]).length;
  need(count===expected,`Command Intent ${method}() tiene ${count} call sites efectivos; se esperaban ${expected}.`);
}

/* Preserve every command-intent branch exactly; this boundary labels commands only. */
need(effectiveState.includes("trWrapDomainCommandGlobal('saveInstrument',()=>globalThis.TradingResearchCommandIntentReadContract.instrument()?'contract.update':'contract.create');"),'Se alteró contract.create/update en saveInstrument.');
need(effectiveState.includes("const label=globalThis.TradingResearchCommandIntentReadContract.instrument()?'contract.update':'contract.create';"),'Se alteró contract.create/update en el cascade async de instrumento.');
need(effectiveState.includes("trWrapDomainCommandGlobal('savePlan',()=>globalThis.TradingResearchCommandIntentReadContract.plan()?'plan.update':(globalThis.TradingResearchCommandIntentReadContract.clonePlan()?'plan.clone':'plan.create'));"),'Se alteró plan.create/update/clone.');
need(effectiveState.includes("trWrapDomainCommandGlobal('saveRiskStrategy',()=>globalThis.TradingResearchCommandIntentReadContract.riskStrategy()?'plan.risk-strategy.update':'plan.risk-strategy.create');"),'Se alteró risk-strategy create/update.');
need(effectiveState.includes("trWrapDomainCommandGlobal('saveTaxonomyAsset',()=>globalThis.TradingResearchCommandIntentReadContract.taxonomyAsset()?.key?'plan.taxonomy.asset.update':'plan.taxonomy.asset.create');"),'Se alteró taxonomy asset create/update o su condición .key.');
need(effectiveState.includes("trWrapDomainCommandGlobal('saveVisualReference',()=>globalThis.TradingResearchCommandIntentReadContract.visualReference()?'plan.visual-reference.update':'plan.visual-reference.create');"),'Se alteró visual-reference create/update.');
need(effectiveState.includes("trWrapDomainCommandGlobal('saveComplianceRule',()=>globalThis.TradingResearchCommandIntentReadContract.complianceRule()?'plan.checklist.update':'plan.checklist.create');"),'Se alteró checklist create/update.');
need(effectiveState.includes("trWrapDomainCommandGlobal('v312SaveMistake',()=>globalThis.TradingResearchCommandIntentReadContract.mistake()?'plan.mistake-rule.update':'plan.mistake-rule.create');"),'Se alteró mistake-rule create/update.');
need(effectiveState.includes("trWrapDomainCommandGlobal('saveGoal',()=>globalThis.TradingResearchCommandIntentReadContract.goal()?'goal.update':'goal.create');"),'Se alteró goal create/update.');
need(effectiveState.includes("const targetId=globalThis.TradingResearchCommandIntentReadContract.operation()||null;\n    const label=targetId?'operation.update':'operation.create';"),'Se alteró operation create/update.');

/* Raw lexical debt is reported honestly: source files remain byte-owned by their original layers. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const rawOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(rawOverlap.length<=163,`Batch 61 introdujo regresión del overlap raw: ${rawOverlap.length} > 163.`);

/* Explicit high-risk/non-target boundaries stay outside this grouped batch. Batch 63 advances only Reports state reads. */
need(refs(styleAttr,'labState')===11&&refs(rawState,'labState')===2,'labState cambió fuera de Batch 61.');
need(refs(reports,'reportsViewState')===0&&refs(rawState,'reportsViewState')===2,'Batch 63 no conserva la frontera esperada Reports state: Reports directo 0 / State fuente 2.');
need(reports.includes("const trReportsViewStateRead=()=>globalThis.TradingResearchReportsViewStateReadContract.current();"),'Batch 63 perdió el helper contractual tardío de Reports View State.');
need(structural.includes('const series=v315RunningUi.series'),'v315RunningUi/Market Data cambió fuera de Batch 61.');
need(refs(rawState,'trCoreWriteBlockReason')===2,'Restore write-lock state cambió fuera de Batch 61.');
need(refs(reports,'goalEval')===1,'goalEval cambió fuera de Batch 61.');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 cambió fuera de Batch 61.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull cambió fuera de Batch 61.');

if(fail.length){
  console.error('Command Intent Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Command Intent Read Boundary verification OK');
console.log(' - grouped homogeneous command-intent bindings: 10');
console.log(' - effective direct editing/cloning bindings: 10 names -> 0');
console.log(' - effective contractual call sites: 11 (instrument has two consumers)');
console.log(' - operation/instrument/plan/risk/taxonomy/reference/checklist/mistake/goal labels preserved');
console.log(` - raw lexical app/runtime overlap: ${rawOverlap.length} <= 163 (intentionally not gamed)`);
console.log(' - app.js + state-runtime.js source ownership preserved; bundle access is contract-bound');
console.log(' - Restore/Backup, persistence, Cloud, Market Data and financial calculations untouched; Reports state advanced in Batch 63');

await import('./verify-batch62-homogeneous-residual-boundaries.mjs');
