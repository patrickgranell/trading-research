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
const CONTRACT='TradingResearchViewSnapshotStateReadContract';
const targets=[
  ['journalViewState','journal'],
  ['blockViewState','blocks'],
  ['galleryViewState','gallery'],
  ['calendarState','calendar'],
  ['complianceViewState','compliance'],
  ['reviewViewState','review'],
  ['goalViewState','goals']
];
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;

for(const [name] of targets){
  const residual=runtimeFiles.filter(file=>refs(runtimeSources.get(file),name)>0);
  need(residual.length===0,`Persisten tokens directos ${name} en runtimes: ${residual.map(file=>`${file}(${refs(runtimeSources.get(file),name)})`).join(', ')||'ninguno'}.`);
}

const contractShape="Object.defineProperty(globalThis,'TradingResearchViewSnapshotStateReadContract',{value:Object.freeze({journal:()=>typeof journalViewState==='undefined'?undefined:journalViewState,blocks:()=>typeof blockViewState==='undefined'?undefined:blockViewState,gallery:()=>typeof galleryViewState==='undefined'?undefined:galleryViewState,calendar:()=>typeof calendarState==='undefined'?undefined:calendarState,compliance:()=>typeof complianceViewState==='undefined'?undefined:complianceViewState,review:()=>typeof reviewViewState==='undefined'?undefined:reviewViewState,goals:()=>typeof goalViewState==='undefined'?undefined:goalViewState}),writable:false,enumerable:false,configurable:false});";
need(bundled.includes(contractShape),'El build transform no publica View Snapshot State Read Contract read-only con la forma exacta esperada.');

const expectedSnapshotReads=[
  ["const journal=globalThis.TradingResearchViewSnapshotStateReadContract.journal();if(journal!==undefined)out.journal=trUiClone(journal);",'journal'],
  ["const blocks=globalThis.TradingResearchViewSnapshotStateReadContract.blocks();if(blocks!==undefined)out.blocks=trUiClone(blocks);",'blocks'],
  ["const gallery=globalThis.TradingResearchViewSnapshotStateReadContract.gallery();if(gallery!==undefined)out.gallery=trUiClone(gallery);",'gallery'],
  ["const calendar=globalThis.TradingResearchViewSnapshotStateReadContract.calendar();if(calendar!==undefined)out.calendar=trUiClone(calendar);",'calendar'],
  ["const compliance=globalThis.TradingResearchViewSnapshotStateReadContract.compliance();if(compliance!==undefined)out.compliance=trUiClone(compliance);",'compliance'],
  ["const review=globalThis.TradingResearchViewSnapshotStateReadContract.review();if(review!==undefined)out.review=trUiClone(review);",'review'],
  ["const goals=globalThis.TradingResearchViewSnapshotStateReadContract.goals();if(goals!==undefined)out.goals=trUiClone(goals);",'goals']
];
for(const [snippet,label] of expectedSnapshotReads)need(stateEffective.includes(snippet),`UIStore snapshot no conserva ${label} mediante el contrato Batch 56.`);

/* Source ownership stays in app.js; Batch 56 only moves runtime snapshot reads. */
for(const [name] of targets)need(new RegExp(`(?:^|\\n)(?:const|let|var)\\s+${name}\\b`).test(app),`La definición fuente ${name} desapareció o dejó de ser top-level.`);

/* Preserve the Batch 56 reduction as a ceiling so later batches may reduce debt further. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length<=170,`Batch 56 exige proxy app/runtime <=170; actual ${runtimeOverlap.length}. Targets presentes=${targets.filter(([name])=>runtimeTokens.has(name)).map(([name])=>name).join(', ')||'ninguno'}.`);

/* Batch 63 legitimately closes the former Reports-state exclusion; Market Data remains excluded. */
const reports=runtimeSources.get('reports-purity-runtime.js');
const structural=runtimeSources.get('structural-runtime.js');
const rawState=runtimeSources.get('state-runtime.js');
need(refs(reports,'reportsViewState')===0,'Batch 63 debe mantener Reports Purity libre del binding directo reportsViewState.');
need(reports.includes("const trReportsViewStateRead=()=>globalThis.TradingResearchReportsViewStateReadContract.current();"),'Batch 63 perdió el helper contractual tardío de Reports View State.');
need(refs(rawState,'reportsViewState')===2,'La fuente State Runtime dejó de conservar el snapshot histórico de reportsViewState antes del transform Batch 63.');
need(structural.includes('const series=v315RunningUi.series'),'v315RunningUi dejó de estar en el cursor parcial de Market Data fuera del alcance de Batch 56.');

/* Higher-risk durable/external boundaries remain untouched. */
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 cambió fuera de Batch 56.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull cambió fuera de Batch 56.');

if(fail.length){
  console.error('View Snapshot State Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('View Snapshot State Read Boundary verification OK');
console.log(' - snapshot-only view bindings migrated: journal, blocks, gallery, calendar, compliance, review, goals');
console.log(' - direct runtime tokens for seven source-owned UI states: 7 names -> 0');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length} <= 170`);
console.log(' - reportsViewState advanced to Batch 63 read contract; v315RunningUi remains excluded');
console.log(' - app.js ownership, Restore, Cloud and persistence untouched');
await import('./verify-remaining-ui-snapshot-state-read-boundary.mjs');
