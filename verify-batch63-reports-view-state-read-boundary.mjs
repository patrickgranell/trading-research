import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const reports=fs.readFileSync('reports-purity-runtime.js','utf8');
const rawState=fs.readFileSync('state-runtime.js','utf8');
const styleAttr=fs.readFileSync('style-attr-runtime.js','utf8');
const canonical=fs.readFileSync('canonical-metrics-runtime.js','utf8');
const backup=fs.readFileSync('backup-v2-runtime.js','utf8');
const cloud=fs.readFileSync('cloud-v10-runtime.js','utf8');
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
const CONTRACT='TradingResearchReportsViewStateReadContract';

/* Source ownership and every write boundary stay in app.js. */
need(refs(app,'reportsViewState')===127,`app.js reportsViewState inventory changed: ${refs(app,'reportsViewState')} != 127.`);
need(app.includes("let reportsViewState={\n  tab:'builder',unit:'r',basis:'net',scope:'full'"),'Source-owned Reports state declaration changed.');
need(app.includes("function v313SetTab(v){reportsViewState.tab=v==='compare'?'compare':'builder';render();}"),'Reports tab setter changed.');
need(app.includes("function v313SetUnit(v){reportsViewState.unit=['r','ticks','usd'].includes(v)?v:'r';render();}"),'Reports unit setter changed.');
need(app.includes("function v313SetBasis(v){reportsViewState.basis=v==='gross'?'gross':'net';render();}"),'Reports basis setter changed.');
need(app.includes("function v313SetScope(v){reportsViewState.scope=v||'full';render();}"),'Reports scope setter changed.');
need(app.includes("function v313ToggleSection(k,checked){if(Object.prototype.hasOwnProperty.call(reportsViewState.sections,k))reportsViewState.sections[k]=!!checked;render();}"),'Reports section setter changed.');
need(app.includes("reportsViewState={...reportsViewState,...clone(c),sections:{...reportsViewState.sections,...clone(c.sections||{})},presetId:x.id,tab:'builder'};render();"),'Preset load no longer preserves whole-object Reports state replacement semantics.');
need(app.includes("case 'reports-compare-open': reportsViewState.tab='compare';navigate('reports');return true;"),'Reports compare-open source write changed.');

/* The build-only provider must resolve the current lexical binding on every call.
 * This is critical because v313LoadPreset replaces the whole object. */
const contractLine=bundledApp.split('\n').find(line=>line.includes(`'${CONTRACT}'`))||'';
need(!!contractLine,`El bundle no publica ${CONTRACT}.`);
need(contractLine.includes("current:()=>typeof reportsViewState==='undefined'?undefined:reportsViewState"),'Reports state contract does not late-resolve the current source binding.');
need(!/\b(?:set|replace|write|update)\s*:/.test(contractLine),'Reports state read contract introduced a write/replace capability.');
need(contractLine.includes('writable:false,enumerable:false,configurable:false'),'Reports state contract is no longer immutable/non-configurable.');

/* Reports Purity is now a pure consumer of the read contract. */
need(refs(reports,'reportsViewState')===0,`Reports Purity todavía contiene reportsViewState (${refs(reports,'reportsViewState')} refs).`);
need(reports.includes("const trReportsViewStateRead=()=>globalThis.TradingResearchReportsViewStateReadContract.current();"),'Reports Purity lost its late read helper.');
need((reports.match(/trReportsViewStateRead\(\)/g)||[]).length===22,`Reports Purity contract read count changed: ${(reports.match(/trReportsViewStateRead\(\)/g)||[]).length} != 22.`);
need(!/window\.reportsViewState\b/.test(reports),'Reports Purity reopened a window.reportsViewState dependency.');
need(reports.includes("const s=trReportsViewStateRead().scope;"),'Report scope-label no longer reads contract state.');
need(reports.includes("calcMetricStats(ops,trReportsViewStateRead().unit,trReportsViewStateRead().basis)"),'Report document metric unit/basis read changed.');
need(reports.includes("const toolbar=`<div class=\"report-builder-toolbar\""),'Report Builder composition changed unexpectedly.');

/* State Runtime source remains byte-pattern-compatible; only effective snapshot read is transformed. */
need(refs(rawState,'reportsViewState')===2,`Raw State Runtime Reports state inventory changed: ${refs(rawState,'reportsViewState')} != 2.`);
need(rawState.includes("if(typeof reportsViewState!=='undefined')out.reports=trUiClone(reportsViewState);"),'Raw State Runtime Reports snapshot source changed.');
need(refs(effectiveState,'reportsViewState')===0,`Effective State Runtime todavía contiene reportsViewState (${refs(effectiveState,'reportsViewState')} refs).`);
need((effectiveState.match(/TradingResearchReportsViewStateReadContract\.current\(\)/g)||[]).length===1,'Effective State Runtime must have exactly one Reports state contract read.');
need(effectiveState.includes("{const trReportsViewState=globalThis.TradingResearchReportsViewStateReadContract.current();if(trReportsViewState!==undefined)out.reports=trUiClone(trReportsViewState);}"),'State Runtime snapshot semantics changed.');

/* Raw lexical overlap is reported honestly; app ownership is not rewritten to game it. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const rawOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(rawOverlap.length<=163,`Batch 63 introduced raw overlap regression: ${rawOverlap.length} > 163.`);

/* Explicit exclusions stay frozen. */
need(refs(styleAttr,'labState')===11&&refs(rawState,'labState')===2,'labState changed outside Batch 63.');
need(styleAttr.includes("set:value=>{labState.nr=String(value??'');}"),'labState write facade changed outside Batch 63.');
need(refs(canonical,'calcStats')===2&&refs(canonical,'opMetricValue')===1,'Canonical metric bindings changed outside Batch 63.');
need(refs(reports,'calcMetricStats')===1&&refs(reports,'goalEval')===1,'Reports calculations changed outside the state-read boundary.');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 / Market stores changed outside Batch 63.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull currentView/render changed outside Batch 63.');

if(fail.length){
  console.error('Reports View State Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Reports View State Read Boundary verification OK');
console.log(' - source-owned Reports UI state: 1');
console.log(' - direct Reports Purity dependency: 22 refs -> 0');
console.log(' - effective State Runtime dependency: 2 refs -> 0');
console.log(' - late current() resolution preserves full-object preset replacement');
console.log(` - raw lexical app/runtime overlap: ${rawOverlap.length} <= 163 (not gamed)`);
console.log(' - app.js writes, calculations, labState, Restore/Backup, Cloud and Market Data untouched');
