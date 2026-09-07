import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const runtimeSources=new Map(runtimeFiles.map(file=>[file,fs.readFileSync(file,'utf8')]));
const exitRuntime=runtimeSources.get('exit-lab-runtime.js');
const bundled=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;

/* Source ownership remains classic and byte-local; Batch 58 moves only the runtime wrapper boundary. */
need(app.includes('function exitLabModule(ops){'),'La implementación fuente exitLabModule(ops) desapareció de app.js.');

/* No runtime may read or replace the classic binding directly after this boundary. */
const directConsumers=runtimeFiles.filter(file=>refs(runtimeSources.get(file),'exitLabModule')>0);
need(directConsumers.length===0,`Persisten tokens directos exitLabModule en runtimes: ${directConsumers.map(file=>`${file}(${refs(runtimeSources.get(file),'exitLabModule')})`).join(', ')||'ninguno'}.`);

const contractShape="Object.defineProperty(globalThis,'TradingResearchExitLabModulePresentationContract',{value:Object.freeze({current:()=>exitLabModule,replace:fn=>{exitLabModule=fn;}}),writable:false,enumerable:false,configurable:false});";
need(bundled.includes(contractShape),'El build transform no publica Exit Lab Module Presentation Contract con current/replace y descriptor congelado.');
need(exitRuntime.includes('const trExitLabModuleContract=globalThis.TradingResearchExitLabModulePresentationContract;'),'Exit Lab Runtime no captura el contrato Batch 58.');
need(exitRuntime.includes('const trExitLabModuleBase=trExitLabModuleContract.current();'),'Exit Lab Runtime no captura la implementación base mediante el contrato.');
need(exitRuntime.includes('trExitLabModuleContract.replace(function(ops){'),'Exit Lab Runtime no instala su wrapper mediante el contrato.');

/* Preserve the exact presentation augmentation that motivated the wrapper. */
need(exitRuntime.includes(".replace(/Escenario · TP fijo/g,'TP Overlay · MFE')"),'El renombrado Escenario → TP Overlay cambió fuera de alcance.');
need(exitRuntime.includes(".replace(/Mapa de objetivos fijos/g,'Mapa TP Overlay')"),'El renombrado del mapa TP Overlay cambió fuera de alcance.');
need(exitRuntime.includes("const panel=trExitSimPanel(ops),at=html.lastIndexOf('</section>');"),'La inserción del panel TP+SL cambió fuera de alcance.');

/* First-touch simulation and metric comparison are explicitly frozen outside this presentation batch. */
need(exitRuntime.includes("if(tpHit)return {status:'tp',resultR:tp,touchIndex:i,touchLast:last,touchMs:Number(ticks[i]?.[0])||null,tpPrice,slPrice};"),'La semántica first-touch TP cambió fuera de Batch 58.');
need(exitRuntime.includes("if(slHit)return {status:'sl',resultR:-sl,touchIndex:i,touchLast:last,touchMs:Number(ticks[i]?.[0])||null,tpPrice,slPrice};"),'La semántica first-touch SL cambió fuera de Batch 58.');
need(exitRuntime.includes("const sim=exitStats(simVals),actual=exitStats(actualVals),delta=sim.sum-actual.sum;"),'La comparación de métricas Exit Lab cambió fuera de Batch 58.');
need(exitRuntime.includes("if(!set){set=await v314StoreGet('execSets',ev.execSetId);if(set)cache.sets.set(ev.execSetId,set);}"),'La lectura Execution Evidence cambió fuera de Batch 58.');
need(exitRuntime.includes("if(!ticks){ticks=await v314LoadTicks(ev.marketDatasetId);if(ticks)cache.ticks.set(ev.marketDatasetId,ticks);}"),'La carga de ticks Market Data cambió fuera de Batch 58.');

/* Preserve the Batch 58 reduction as a ceiling so later batches may reduce debt further. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length<=165,`Batch 58 exige proxy app/runtime <=165; actual ${runtimeOverlap.length}. exitLabModule presente=${runtimeTokens.has('exitLabModule')}.`);

/* High-risk/non-presentation boundaries remain excluded. Batch 63 advances only Reports state reads. */
const styleAttr=runtimeSources.get('style-attr-runtime.js');
const reports=runtimeSources.get('reports-purity-runtime.js');
const structural=runtimeSources.get('structural-runtime.js');
const state=runtimeSources.get('state-runtime.js');
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(refs(styleAttr,'labState')===11&&refs(state,'labState')===2,'labState dejó de conservar sus consumidores auditados.');
need(refs(reports,'reportsViewState')===0&&refs(state,'reportsViewState')===2,'Batch 63 no conserva la frontera esperada Reports state: Reports directo 0 / State fuente 2.');
need(reports.includes("const trReportsViewStateRead=()=>globalThis.TradingResearchReportsViewStateReadContract.current();"),'Batch 63 perdió el helper contractual tardío de Reports View State.');
need(structural.includes('const series=v315RunningUi.series'),'v315RunningUi dejó de conservar su consumidor Market Data estructural.');
need(state.includes("configTab:typeof configTab!=='undefined'?configTab:''"),'configTab raw snapshot cambió fuera de Batch 58.');
need(backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"),'Backup V2 cambió fuera de Batch 58.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull cambió fuera de Batch 58.');

if(fail.length){
  console.error('Exit Lab Module Presentation Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Exit Lab Module Presentation Boundary verification OK');
console.log(' - direct exitLabModule runtime token: 1 name -> 0');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length} <= 165`);
console.log(' - Exit Lab wrapper: current/replace presentation contract-bound');
console.log(' - TP Overlay text augmentation + TP/SL panel insertion preserved');
console.log(' - first-touch simulation, Exit metrics, Market Data reads, Restore, Cloud and persistence untouched; Reports state advanced in Batch 63');
await import('./verify-batch59-residual-presentation-boundary.mjs');
