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
const structural=runtimeSources.get('structural-runtime.js');
const stateSource=runtimeSources.get('state-runtime.js');
const stateEffective=transformStateActions(stateSource).source;
const bundled=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const CONTRACT='TradingResearchMarketUiStateReadContract';
const directRefs=src=>(src.match(/\bv316Ui\b/g)||[]).length;
const callCount=(src,method)=>(src.match(new RegExp(`globalThis\\.${CONTRACT}\\.${method}\\(\\)`,'g'))||[]).length;

const residualFiles=runtimeFiles.filter(file=>directRefs(runtimeSources.get(file))>0);
need(residualFiles.length===0,
  `Persisten tokens directos v316Ui en runtimes: ${residualFiles.map(file=>`${file}(${directRefs(runtimeSources.get(file))})`).join(', ')||'ninguno'}.`);
need(directRefs(structural)===0,`Structural Runtime conserva ${directRefs(structural)} referencia(s) directa(s) a v316Ui.`);
need(directRefs(stateEffective)===0,`State Runtime efectivo conserva ${directRefs(stateEffective)} referencia(s) directa(s) a v316Ui.`);
need(callCount(structural,'tab')===3,`Structural Runtime debe usar exactamente 3 lecturas tab() de ${CONTRACT}; encontró ${callCount(structural,'tab')}.`);
need(callCount(stateEffective,'available')===1,`State Runtime efectivo debe usar exactamente 1 available() de ${CONTRACT}; encontró ${callCount(stateEffective,'available')}.`);
need(callCount(stateEffective,'tab')===1,`State Runtime efectivo debe usar exactamente 1 tab() de ${CONTRACT}; encontró ${callCount(stateEffective,'tab')}.`);
need(callCount(stateEffective,'environment')===1,`State Runtime efectivo debe usar exactamente 1 environment() de ${CONTRACT}; encontró ${callCount(stateEffective,'environment')}.`);

const contractShape=`Object.defineProperty(globalThis,'${CONTRACT}',{value:Object.freeze({available:()=>typeof v316Ui!=='undefined',tab:()=>typeof v316Ui==='undefined'?undefined:v316Ui.tab,environment:()=>typeof v316Ui==='undefined'?undefined:v316Ui.environment}),writable:false,enumerable:false,configurable:false});`;
need(bundled.includes(contractShape),'El build transform no publica Market UI State Read Contract read-only con la forma exacta esperada.');

/* Freeze the source ownership and write semantics: Batch 54 only moves runtime reads. */
need(app.includes("const v316Ui={...(window.v316Ui||{}),tab:'reconcile',environment:'replay'};"),'La definición fuente de v316Ui cambió fuera de alcance.');
const tabWrites=(app.match(/\bv316Ui\.tab\s*=\s*/g)||[]).length;
const environmentWrites=(app.match(/\bv316Ui\.environment\s*=\s*/g)||[]).length;
need(tabWrites===14,`Inventario de writes v316Ui.tab cambió: ${tabWrites} (esperado 14).`);
need(environmentWrites===1,`Inventario de writes v316Ui.environment cambió: ${environmentWrites} (esperado 1).`);
need(app.includes("function v316SetExecEnvironment(value){if(!['replay','sim','live'].includes(value))return;v316Ui.environment=value;render();}"),'La mutación de entorno Market Data cambió fuera de alcance.');
need(app.includes("v316SetTab=function(tab){if(tab==='bestexit'){v316Ui.tab='bestexit';v315RunningUi.tab='running';render();setTimeout(v315EnsureRunningLoaded,0);return;}return v316SetTabV3110Base(tab);};"),'La mutación Best Exit de v316Ui.tab cambió fuera de alcance.');

need(structural.includes(`body.dataset.trMarketTab=String(globalThis.${CONTRACT}.tab()||'');return true;`),'Structural Runtime no conserva la lectura de pestaña inicial a través del contrato.');
need(structural.includes(`const oldTab=body.dataset.trMarketTab||'',newTab=String(globalThis.${CONTRACT}.tab()||''),tabChanged=oldTab!==newTab`),'Structural Runtime no conserva la comparación old/new tab a través del contrato.');
need(structural.includes(`globalThis.TradingResearchCurrentViewReadContract.current()!=='market'||globalThis.${CONTRACT}.tab()!=='running'`),'El guard del cursor Running P&L no usa el contrato Market UI.');
need(stateEffective.includes(`if(globalThis.${CONTRACT}.available())out.market={phase:globalThis.${CONTRACT}.tab(),environment:globalThis.${CONTRACT}.environment()};`),'UIStore snapshot no conserva phase/environment mediante el contrato Market UI.');

/* Require an actual structural reduction, not a new alias with unchanged overlap. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length===182,
  `Batch 54 debe reducir el proxy app/runtime a 182; actual ${runtimeOverlap.length}. v316Ui presente=${runtimeTokens.has('v316Ui')}.`);

/* Explicitly keep higher-risk Market Data / persistence surfaces out of this batch. */
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 Market Data store set changed outside Batch 54.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull currentView write changed outside Batch 54.');
need(app.includes("async function v316MigrateExecEnvironments()"),'Market Data environment migration implementation disappeared outside Batch 54.');

if(fail.length){
  console.error('Market UI State Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Market UI State Read Boundary verification OK');
console.log(' - direct v316Ui runtime tokens: 6 -> 0');
console.log(' - Structural Runtime: 3 tab reads contract-bound');
console.log(' - State Runtime: available + tab + environment snapshot reads contract-bound');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length}`);
console.log(' - v316Ui writes remain source-owned and unchanged');
console.log(' - Restore, Cloud, Market Data persistence and financial calculations untouched');
await import('./verify-ui-snapshot-state-read-boundary.mjs');
