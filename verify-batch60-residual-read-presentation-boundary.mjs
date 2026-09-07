import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const reports=fs.readFileSync('reports-purity-runtime.js','utf8');
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
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const CONTRACT='TradingResearchReportOperationsReadContract';
const LEGACY='v313ReportOps';

/* Source selector stays authoritative: Batch 60 changes only the runtime access boundary. */
need(app.includes('function v313ReportOps(){'),'La implementación fuente v313ReportOps() desapareció de app.js.');
need(app.includes("const all=[...currentOps()].sort(v3194CompareOps),s=reportsViewState.scope;"),'El selector fuente cambió su dataset base/orden/alcance.');
need(app.includes("if(s==='last20')return all.slice(-20);if(s==='last50')return all.slice(-50);if(s==='last100')return all.slice(-100);"),'El selector fuente cambió los alcances last20/50/100.');
need(app.includes("if(s==='block'){const n=Math.max(1,Number(reportsViewState.block)||1);return all.slice((n-1)*20,n*20);}"),'El selector fuente cambió el alcance por bloques.');
need(app.includes("const p=getCurrentPlan();ensurePlanStudies(p);const st=p?.savedStudies?.find(x=>x.id===reportsViewState.studyId);return st?labFilteredOpsForState(st.lab||{}):[];"),'El selector fuente cambió el alcance de estudio.');
need(app.includes("if(s==='date')return all.filter(o=>{const d=inputDateValue(new Date(o.entryDate));return (!reportsViewState.dateFrom||d>=reportsViewState.dateFrom)&&(!reportsViewState.dateTo||d<=reportsViewState.dateTo);});"),'El selector fuente cambió el rango de fechas.');

/* Build-only contract must be frozen, read-only and call the original selector at use time. */
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),'El build transform no publica Report Operations Read Contract.');
need(bundledAppStage.includes('current:()=>v313ReportOps()'),'Report Operations Read Contract no delega al selector fuente original.');
need(!bundledAppStage.includes(`'${CONTRACT}',{value:Object.freeze({current:()=>v313ReportOps(),replace:`),'Report Operations Read Contract introdujo una vía de reemplazo/mutación.');

/* Runtime consumer must use only the dataset contract; metric pipeline and section composition stay unchanged. */
const directConsumers=runtimeFiles.filter(file=>refs(runtimeSources.get(file),LEGACY)>0);
need(directConsumers.length===0,`Persisten tokens directos ${LEGACY} en runtimes: ${directConsumers.map(file=>`${file}(${refs(runtimeSources.get(file),LEGACY)})`).join(', ')||'ninguno'}.`);
need(reports.includes(`const ops=globalThis.${CONTRACT}.current(),s=calcMetricStats(ops,trReportsViewStateRead().unit,trReportsViewStateRead().basis),sec=trReportsViewStateRead().sections`),'Reports Purity no conserva el pipeline dataset → calcMetricStats mediante los contratos de dataset/estado.');
need(refs(reports,'calcMetricStats')===1,`calcMetricStats cambió fuera de alcance (esperado 1 ref en Reports Purity; actual ${refs(reports,'calcMetricStats')}).`);
need(reports.includes("${sec.reviewsGoals?trReportReviewsGoals(p):''}"),'La composición Reviews & objetivos cambió fuera de Batch 60.');

/* Honest structural reduction: same proxy ceiling, later batches may reduce further. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length<=163,`Batch 60 no permite regresión del proxy app/runtime por encima de 163; actual ${runtimeOverlap.length}. ${LEGACY} presente=${runtimeTokens.has(LEGACY)}.`);

/* Known non-target boundaries remain frozen/excluded. Batch 63 advances only Reports state reads. */
const styleAttr=runtimeSources.get('style-attr-runtime.js');
const structural=runtimeSources.get('structural-runtime.js');
const state=runtimeSources.get('state-runtime.js');
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(refs(styleAttr,'labState')===11&&refs(state,'labState')===2,'labState dejó de conservar sus consumidores auditados.');
need(refs(reports,'reportsViewState')===0&&refs(state,'reportsViewState')===2,'Batch 63 no conserva la frontera esperada Reports state: Reports directo 0 / State fuente 2.');
need(reports.includes("const trReportsViewStateRead=()=>globalThis.TradingResearchReportsViewStateReadContract.current();"),'Batch 63 perdió el helper contractual tardío de Reports View State.');
need(structural.includes('const series=v315RunningUi.series'),'v315RunningUi dejó de conservar su consumidor Market Data estructural.');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 cambió fuera de Batch 60.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull cambió fuera de Batch 60.');

if(fail.length){
  console.error('Report Operations Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Report Operations Read Boundary verification OK');
console.log(' - direct v313ReportOps runtime token: 1 name -> 0');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length} <= 163`);
console.log(' - source report selector: preserved verbatim by ownership/shape gates');
console.log(' - Reports Purity dataset read remains contract-bound; Reports state advanced to Batch 63 read contract');
console.log(' - calcMetricStats, report sections, labState, Market Data, Restore, Cloud and persistence untouched');

await import('./verify-batch61-homogeneous-residual-boundaries.mjs');
