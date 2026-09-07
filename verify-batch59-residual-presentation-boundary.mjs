import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const runtimeSources=new Map(runtimeFiles.map(file=>[file,fs.readFileSync(file,'utf8')]));
const reports=runtimeSources.get('reports-purity-runtime.js');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;

/* Source ownership remains classic; Batch 59 closes only the runtime dependency. */
need(app.includes('function v313ReportReviewsGoals(plan){'),'La implementación fuente v313ReportReviewsGoals(plan) desapareció de app.js.');
need(app.includes("if(typeof ensurePlanReviews==='function')ensurePlanReviews(plan);if(typeof ensurePlanGoals==='function')ensurePlanGoals(plan);"),'La implementación fuente de Reviews & Goals cambió fuera de alcance.');

/* No runtime may depend on or republish the classic helper after localization. */
const directConsumers=runtimeFiles.filter(file=>refs(runtimeSources.get(file),'v313ReportReviewsGoals')>0);
need(directConsumers.length===0,`Persisten tokens directos v313ReportReviewsGoals en runtimes: ${directConsumers.map(file=>`${file}(${refs(runtimeSources.get(file),'v313ReportReviewsGoals')})`).join(', ')||'ninguno'}.`);
need(!reports.includes('window.v313ReportReviewsGoals'),'Reports Purity sigue publicando/reemplazando el helper clásico.');

/* Preserve the read-only local presentation implementation and its document composition. */
need(reports.includes('function trReportReviewsGoals(plan){'),'Reports Purity no conserva el helper local privado Reviews & Goals.');
need(reports.includes("const rev=trReportReviews(plan),open=rev.filter(x=>x.status==='open'||x.status==='monitoring'),valid=rev.filter(x=>x.status==='validated'),goals=trReportGoals(plan).filter(g=>g.active),evaluated=goals.map(g=>({g,e:goalEval(g)})),met=evaluated.filter(x=>x.e.met);"),'La lectura/evaluación Reviews & Goals cambió fuera de alcance.');
need(reports.includes("${sec.reviewsGoals?trReportReviewsGoals(p):''}"),'Report Document no consume el helper local Reviews & Goals.');
need(reports.includes('globalThis.TradingResearchContentEncodingContract.html(x.title)'),'El escape del título de review cambió fuera de alcance.');
need(reports.includes("globalThis.TradingResearchContentEncodingContract.html(x.decision||x.finding||'Sin decisión registrada')"),'El escape/placeholder de decisión cambió fuera de alcance.');

/* goalEval remains an unchanged calculation dependency; this batch does not migrate calculations. */
need(refs(reports,'goalEval')===1,`goalEval cambió fuera de alcance (esperado 1 ref en Reports Purity; actual ${refs(reports,'goalEval')}).`);

/* Require the honest lexical reduction without redefining the overlap proxy. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length<=164,`Batch 59 no permite regresión del proxy app/runtime por encima de 164; actual ${runtimeOverlap.length}. v313ReportReviewsGoals presente=${runtimeTokens.has('v313ReportReviewsGoals')}.`);

/* Known high-risk/non-presentation boundaries remain excluded. Batch 63 advances only Reports state reads. */
const styleAttr=runtimeSources.get('style-attr-runtime.js');
const structural=runtimeSources.get('structural-runtime.js');
const state=runtimeSources.get('state-runtime.js');
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(refs(styleAttr,'labState')===11&&refs(state,'labState')===2,'labState dejó de conservar sus consumidores auditados.');
need(refs(reports,'reportsViewState')===0&&refs(state,'reportsViewState')===2,'Batch 63 no conserva la frontera esperada Reports state: Reports directo 0 / State fuente 2.');
need(reports.includes("const trReportsViewStateRead=()=>globalThis.TradingResearchReportsViewStateReadContract.current();"),'Batch 63 perdió el helper contractual tardío de Reports View State.');
need(structural.includes('const series=v315RunningUi.series'),'v315RunningUi dejó de conservar su consumidor Market Data estructural.');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 cambió fuera de Batch 59.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull cambió fuera de Batch 59.');

if(fail.length){
  console.error('Report Reviews & Goals Local Presentation Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Report Reviews & Goals Local Presentation Boundary verification OK');
console.log(' - direct v313ReportReviewsGoals runtime token: 1 name -> 0');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length} <= 164`);
console.log(' - Reviews & Goals presentation: private Reports Purity helper');
console.log(' - original app.js helper remains source-owned; runtime no longer replaces/publishes it');
console.log(' - goalEval unchanged; reportsViewState advanced to Batch 63 read contract; Market Data/Restore/Cloud untouched');

await import('./verify-batch60-residual-read-presentation-boundary.mjs');
