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
const CONTRACT='TradingResearchUiSnapshotStateReadContract';
const targets=[
  ['robustnessState','robustness'],
  ['riskStressState','riskStress'],
  ['walkForwardState','walkForward'],
  ['dataQualityState','dataQuality'],
  ['mistakesViewState','mistakes']
];
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;

for(const [name] of targets){
  const residual=runtimeFiles.filter(file=>refs(runtimeSources.get(file),name)>0);
  need(residual.length===0,`Persisten tokens directos ${name} en runtimes: ${residual.map(file=>`${file}(${refs(runtimeSources.get(file),name)})`).join(', ')||'ninguno'}.`);
}

const contractShape="Object.defineProperty(globalThis,'TradingResearchUiSnapshotStateReadContract',{value:Object.freeze({robustness:()=>typeof robustnessState==='undefined'?undefined:robustnessState,riskStress:()=>typeof riskStressState==='undefined'?undefined:riskStressState,walkForward:()=>typeof walkForwardState==='undefined'?undefined:walkForwardState,dataQuality:()=>typeof dataQualityState==='undefined'?undefined:dataQualityState,mistakes:()=>typeof mistakesViewState==='undefined'?undefined:mistakesViewState}),writable:false,enumerable:false,configurable:false});";
need(bundled.includes(contractShape),'El build transform no publica UI Snapshot State Read Contract read-only con la forma exacta esperada.');

const expectedSnapshotReads=[
  ["const robustness=globalThis.TradingResearchUiSnapshotStateReadContract.robustness();if(robustness!==undefined)out.robustness=trUiClone(robustness);",'robustness'],
  ["const riskStress=globalThis.TradingResearchUiSnapshotStateReadContract.riskStress();if(riskStress!==undefined)out.riskStress=trUiClone(riskStress);",'riskStress'],
  ["const walkForward=globalThis.TradingResearchUiSnapshotStateReadContract.walkForward();if(walkForward!==undefined)out.walkForward=trUiClone(walkForward);",'walkForward'],
  ["const dataQuality=globalThis.TradingResearchUiSnapshotStateReadContract.dataQuality();if(dataQuality!==undefined)out.dataQuality=trUiClone(dataQuality);",'dataQuality'],
  ["const mistakes=globalThis.TradingResearchUiSnapshotStateReadContract.mistakes();if(mistakes!==undefined)out.mistakes=trUiClone(mistakes);",'mistakes']
];
for(const [snippet,label] of expectedSnapshotReads)need(stateEffective.includes(snippet),`UIStore snapshot no conserva ${label} mediante el contrato Batch 55.`);

/* Source ownership and mutation semantics remain in app.js. */
for(const [name] of targets)need(new RegExp(`(?:^|\\n)(?:const|let|var)\\s+${name}\\b`).test(app),`La definición fuente ${name} desapareció o dejó de ser top-level.`);
need(app.includes('function robustnessSetHorizon(')&&app.includes('function robustnessSetIterations('),'Mutaciones de Robustez cambiaron fuera de alcance.');
need(app.includes('function riskStressSetMethod(')&&app.includes('function riskStressSetIterations('),'Mutaciones de Risk & Stress cambiaron fuera de alcance.');

/* Require real structural reduction: five classic names leave all runtimes. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length===177,`Batch 55 debe reducir el proxy app/runtime a 177; actual ${runtimeOverlap.length}. Targets presentes=${targets.filter(([name])=>runtimeTokens.has(name)).map(([name])=>name).join(', ')||'ninguno'}.`);

/* Higher-risk boundaries remain out of scope. */
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 cambió fuera de Batch 55.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull cambió fuera de Batch 55.');
need(app.includes('function riskStressSimulation('),'Risk & Stress calculations disappeared outside Batch 55.');

if(fail.length){
  console.error('UI Snapshot State Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('UI Snapshot State Read Boundary verification OK');
console.log(' - snapshot-only state bindings migrated: robustness, riskStress, walkForward, dataQuality, mistakes');
console.log(' - direct runtime tokens for five source-owned UI states: 5 names -> 0');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length}`);
console.log(' - source setters/calculations, Restore, Cloud and persistence untouched');
