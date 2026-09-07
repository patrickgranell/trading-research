import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const runtimeSources=new Map(runtimeFiles.map(file=>[file,fs.readFileSync(file,'utf8')]));
const stateEffective=transformStateActions(runtimeSources.get('state-runtime.js')).source;
const bundled=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const CONTRACT='TradingResearchRemainingUiSnapshotStateReadContract';
const targets=[
  ['opsViewState','operations'],
  ['dashboardViewState','dashboard'],
  ['exitLabState','exitLab'],
  ['v3110Ui','bestExit']
];
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;

for(const [name] of targets){
  const residual=runtimeFiles.filter(file=>refs(runtimeSources.get(file),name)>0);
  need(residual.length===0,`Persisten tokens directos ${name} en runtimes: ${residual.map(file=>`${file}(${refs(runtimeSources.get(file),name)})`).join(', ')||'ninguno'}.`);
}

const contractShape="Object.defineProperty(globalThis,'TradingResearchRemainingUiSnapshotStateReadContract',{value:Object.freeze({operations:()=>typeof opsViewState==='undefined'?undefined:opsViewState,dashboard:()=>typeof dashboardViewState==='undefined'?undefined:dashboardViewState,exitLab:()=>typeof exitLabState==='undefined'?undefined:exitLabState,bestExit:()=>typeof v3110Ui==='undefined'?undefined:v3110Ui}),writable:false,enumerable:false,configurable:false});";
need(bundled.includes(contractShape),'El build transform no publica Remaining UI Snapshot State Read Contract read-only con la forma exacta esperada.');

const expectedSnapshotReads=[
  ["const operations=globalThis.TradingResearchRemainingUiSnapshotStateReadContract.operations();if(operations!==undefined)out.operations=trUiClone(operations);",'operations'],
  ["const dashboard=globalThis.TradingResearchRemainingUiSnapshotStateReadContract.dashboard();if(dashboard!==undefined)out.dashboard=trUiClone(dashboard);",'dashboard'],
  ["const exitLab=globalThis.TradingResearchRemainingUiSnapshotStateReadContract.exitLab();if(exitLab!==undefined)out.exitLab=trUiClone(exitLab);",'exitLab'],
  ["const bestExit=globalThis.TradingResearchRemainingUiSnapshotStateReadContract.bestExit();if(bestExit!==undefined)out.bestExit=trUiClone(bestExit);",'bestExit']
];
for(const [snippet,label] of expectedSnapshotReads)need(stateEffective.includes(snippet),`UIStore snapshot no conserva ${label} mediante el contrato Batch 57.`);

/* Source ownership stays in app.js; Batch 57 only moves runtime snapshot reads. */
for(const [name] of targets)need(new RegExp(`(?:^|\\n)(?:const|let|var)\\s+${name}\\b`).test(app),`La definición fuente ${name} desapareció o dejó de ser top-level.`);

/* Preserve the Batch 57 reduction as a ceiling so later batches may reduce debt further. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length<=166,`Batch 57 exige proxy app/runtime <=166; actual ${runtimeOverlap.length}. Targets presentes=${targets.filter(([name])=>runtimeTokens.has(name)).map(([name])=>name).join(', ')||'ninguno'}.`);

/* RED inventory proved labState has real Style Attr Runtime consumers, so keep it out. */
const styleAttr=runtimeSources.get('style-attr-runtime.js');
need(refs(styleAttr,'labState')===11,`labState dejó de conservar el inventario Style Attr Runtime auditado (esperado 11; actual ${refs(styleAttr,'labState')}).`);
need(refs(stateEffective,'labState')===2,`labState snapshot directo cambió fuera del alcance de Batch 57 (esperado 2 refs efectivas; actual ${refs(stateEffective,'labState')}).`);

/* Known nontrivial consumers remain explicitly outside this snapshot-only batch. */
const reports=runtimeSources.get('reports-purity-runtime.js');
const structural=runtimeSources.get('structural-runtime.js');
const state=runtimeSources.get('state-runtime.js');
need(reports.includes('reportsViewState.scope'),'reportsViewState dejó de estar en Reports Purity fuera del alcance de Batch 57.');
need(structural.includes('const series=v315RunningUi.series'),'v315RunningUi dejó de estar en el cursor parcial de Market Data fuera del alcance de Batch 57.');
need(state.includes("configTab:typeof configTab!=='undefined'?configTab:''"),'configTab dejó de conservar su lectura snapshot directa fuera del alcance de Batch 57.');

/* Higher-risk durable/external boundaries remain untouched. */
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 cambió fuera de Batch 57.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull cambió fuera de Batch 57.');

if(fail.length){
  console.error('Remaining UI Snapshot State Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Remaining UI Snapshot State Read Boundary verification OK');
console.log(' - snapshot-only bindings migrated: operations, dashboard, exitLab, bestExit');
console.log(' - direct runtime tokens for four source-owned UI states: 4 names -> 0');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length} <= 166`);
console.log(' - labState excluded after RED inventory proved 11 Style Attr Runtime consumers');
console.log(' - reportsViewState + v315RunningUi + configTab deliberately excluded');
console.log(' - app.js ownership, Restore, Cloud, Market Data and persistence untouched');
await import('./verify-residual-runtime-overlap-boundary.mjs');
