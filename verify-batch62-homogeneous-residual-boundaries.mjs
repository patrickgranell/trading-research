import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const rawState=fs.readFileSync('state-runtime.js','utf8');
const reports=fs.readFileSync('reports-purity-runtime.js','utf8');
const backup=fs.readFileSync('backup-v2-runtime.js','utf8');
const cloud=fs.readFileSync('cloud-v10-runtime.js','utf8');
const canonical=fs.readFileSync('canonical-metrics-runtime.js','utf8');
const styleAttr=fs.readFileSync('style-attr-runtime.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const runtimeSources=new Map(runtimeFiles.map(file=>[file,fs.readFileSync(file,'utf8')]));
const bundledApp=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const effectiveState=transformStateActions(rawState).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;
const CONTRACT='TradingResearchPlanSchemaNormalizationReadContract';
const normalizers=Object.freeze([
  ['ensurePlanV8Structure',2],
  ['ensurePlanCompliance',2],
  ['ensurePlanStudies',2],
  ['ensurePlanConfidence',2],
  ['ensurePlanReviews',2],
  ['ensurePlanGoals',2],
  ['ensurePlanForwardTests',2],
  ['ensurePlanDataQualityV27',2],
  ['ensurePlanResearchChanges',2],
  ['v311EnsureDashboardProfiles',2],
  ['v30EnsureBaselineLocal',6]
]);
const orderedPlanNormalizers=normalizers.slice(0,10).map(([name])=>name);

/* App ownership stays intact. No normalizer implementation moves into State Runtime. */
for(const [name] of normalizers){
  need(new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(app),`app.js ya no conserva la implementación fuente ${name}().`);
}

/* Freeze the exact RED inventory observed on the real Batch 61 main. */
for(const [name,expected] of normalizers){
  need(refs(rawState,name)===expected,`${name} cambió su inventario raw State Runtime: ${refs(rawState,name)} != ${expected}.`);
}
const rawPlanBlock=orderedPlanNormalizers.map(name=>`typeof ${name}==='function'?${name}:null`).join(',\n    ');
need(rawState.includes(`  const fns=[\n    ${rawPlanBlock}\n  ].filter(Boolean);`),'El orden fuente de los diez normalizadores de plan cambió.');
need((rawState.match(/if\(typeof v30EnsureBaselineLocal==='function'\)v30EnsureBaselineLocal\(\);/g)||[]).length===3,'Los tres call sites fuente de baseline cambiaron.');

/* Build publishes one frozen read-only contract, resolving source functions at call time. */
const contractLine=bundledApp.split('\n').find(line=>line.includes(`'${CONTRACT}'`))||'';
need(!!contractLine,`El bundle no publica ${CONTRACT}.`);
let lastIndex=-1;
for(const name of orderedPlanNormalizers){
  const i=contractLine.indexOf(`typeof ${name}==='function'?${name}:null`);
  need(i>lastIndex,`El contrato no conserva el orden de ${name}.`);
  lastIndex=i;
}
need(contractLine.includes("baseline:()=>typeof v30EnsureBaselineLocal==='function'?v30EnsureBaselineLocal:null"),'El contrato no conserva baseline() sobre v30EnsureBaselineLocal.');
need(!/\b(?:set|replace|write|update)\s*:/.test(contractLine),'El contrato de normalización introdujo una vía de escritura/reemplazo.');
need(contractLine.includes('writable:false,enumerable:false,configurable:false'),'El contrato dejó de ser inmutable/no configurable.');

/* Effective deployed State Runtime must no longer name any source normalizer directly. */
for(const [name] of normalizers)need(refs(effectiveState,name)===0,`State Runtime efectivo todavía contiene ${name} (${refs(effectiveState,name)} refs).`);
need((effectiveState.match(/TradingResearchPlanSchemaNormalizationReadContract\.planNormalizers\(\)/g)||[]).length===1,'planNormalizers() no tiene exactamente un call site efectivo.');
need((effectiveState.match(/TradingResearchPlanSchemaNormalizationReadContract\.baseline\(\)/g)||[]).length===3,'baseline() no tiene exactamente tres call sites efectivos.');

/* Orchestration, ordering and mutation/persistence boundaries remain source-equivalent. */
need(effectiveState.includes("function trDomainNormalizePlanSchema(p){\n  if(!p)return p;\n  const fns=globalThis.TradingResearchPlanSchemaNormalizationReadContract.planNormalizers().filter(Boolean);\n  for(const fn of fns)fn(p);\n  return p;\n}"),'trDomainNormalizePlanSchema dejó de ejecutar los normalizadores secuencialmente.');
need(effectiveState.includes("const plans=Array.isArray(state?.tradingPlans)?state.tradingPlans:[];\n  for(const plan of plans)trDomainNormalizePlanSchema(plan);\n  {const trPlanBaseline=globalThis.TradingResearchPlanSchemaNormalizationReadContract.baseline();if(trPlanBaseline)trPlanBaseline();}\n  return plans.length;"),'trDomainNormalizeAllPlanSchemas cambió orden o baseline.');
need(effectiveState.includes("if(!globalThis.TradingResearchCoreHydrationReadContract.ready()||!trDomainRootTarget||trDomainSchemaNormalizedRoots.has(trDomainRootTarget))return false;"),'Cambió el guard de hidratación/schema normalization.');
need(effectiveState.includes("trDomainNormalizeAllPlanSchemas();\n    if(trDomainPendingMutationCount)trDomainFlush('schema.normalize','controlled');\n    if(trDomainCommitCount>beforeCommits&&typeof trDomainPersistBridgeBase==='function')trDomainPersistBridgeBase(`schema-normalize:${reason}`);"),'Cambió flush/persist de schema.normalize.');
need(effectiveState.includes("trDomainSchemaNormalizedRoots.delete(root);"),'Cambió rollback del marcador de schema normalization.');

const switchPlanExpected="switchPlan=function(id){if(!globalThis.TradingResearchPlanReadContract.byId(id))return;return TRDomainStore.commit('plan.switch',()=>{state.currentPlanId=id;trDomainNormalizePlanSchema(globalThis.TradingResearchPlanReadContract.byId(id));{const trPlanBaseline=globalThis.TradingResearchPlanSchemaNormalizationReadContract.baseline();if(trPlanBaseline)trPlanBaseline();}},{persist:true,render:true});};";
need(effectiveState.includes(switchPlanExpected),'switchPlan cambió validación, normalización, baseline o commit persist/render.');
const switchOpenExpected="switchPlanAndOpen=function(id){if(!globalThis.TradingResearchPlanReadContract.byId(id))return;return TRDomainStore.commit('plan.switch-open',()=>{state.currentPlanId=id;trDomainNormalizePlanSchema(globalThis.TradingResearchPlanReadContract.byId(id));{const trPlanBaseline=globalThis.TradingResearchPlanSchemaNormalizationReadContract.baseline();if(trPlanBaseline)trPlanBaseline();}globalThis.TradingResearchCurrentViewPlanSwitchOpenWriteContract.toDashboard();},{persist:true,render:true});};";
need(effectiveState.includes(switchOpenExpected),'switchPlanAndOpen cambió validación, normalización, Dashboard write o commit persist/render.');

/* ensurePlanStudies has a late runtime purity wrapper; call-time resolution must preserve it. */
need(reports.includes("const trEnsurePlanStudiesBase=typeof ensurePlanStudies==='function'?ensurePlanStudies:null;"),'Reports Purity perdió el capture histórico de ensurePlanStudies.');
need(reports.includes("ensurePlanStudies=function(p){"),'Reports Purity perdió el wrapper de ensurePlanStudies.');
need(reports.includes("if(guarded){trStudyRenderPurityBypasses++;return p;}"),'Reports Purity perdió el bypass read-only durante render.');

/* Raw lexical debt is reported honestly; this batch changes effective coupling, not source tokens. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const rawOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(rawOverlap.length<=163,`Batch 62 introdujo regresión del overlap raw: ${rawOverlap.length} > 163.`);

/* Explicit exclusions / non-target high-risk surfaces remain frozen. Batch 63 advances only Reports state reads. */
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 / Market stores cambiaron fuera de Batch 62.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull currentView/render cambió fuera de Batch 62.');
need(refs(canonical,'calcStats')===2&&refs(canonical,'opMetricValue')===1,'Canonical financial metric bindings cambiaron fuera de Batch 62.');
need(refs(styleAttr,'labState')===11&&refs(rawState,'labState')===2,'labState cambió fuera de Batch 62.');
need(refs(reports,'reportsViewState')===0&&refs(rawState,'reportsViewState')===2,'Batch 63 no conserva la frontera esperada Reports state: Reports directo 0 / State fuente 2.');
need(reports.includes("const trReportsViewStateRead=()=>globalThis.TradingResearchReportsViewStateReadContract.current();"),'Batch 63 perdió el helper contractual tardío de Reports View State.');

if(fail.length){
  console.error('Plan Schema Normalization Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Plan Schema Normalization Read Boundary verification OK');
console.log(' - grouped source-owned plan schema normalizers: 11');
console.log(' - effective State Runtime direct dependencies: 11 names / 26 refs -> 0');
console.log(' - plan normalizer order: preserved');
console.log(' - baseline call sites: 3 -> 3 contract reads');
console.log(` - raw lexical app/runtime overlap: ${rawOverlap.length} <= 163 (intentionally not gamed)`);
console.log(' - app.js + state-runtime.js source ownership preserved');
console.log(' - Restore/Backup, Cloud, Market Data and financial calculations untouched; Reports state advanced in Batch 63');
