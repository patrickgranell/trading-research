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
const canonical=runtimeSources.get('canonical-metrics-runtime.js');
const bundled=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const CONTRACT='TradingResearchCoreHydrationReadContract';
const directRefs=src=>(src.match(/\btrCoreHydrated\b/g)||[]).length;
const contractCalls=src=>(src.match(/globalThis\.TradingResearchCoreHydrationReadContract\.ready\(\)/g)||[]).length;

const residualHydrationFiles=runtimeFiles.filter(file=>directRefs(runtimeSources.get(file))>0);
need(residualHydrationFiles.length===0,
  `Persisten tokens directos trCoreHydrated en runtimes: ${residualHydrationFiles.map(file=>`${file}(${directRefs(runtimeSources.get(file))})`).join(', ')||'ninguno'}.`);
need(directRefs(structural)===0,`Structural Runtime conserva ${directRefs(structural)} referencia(s) directa(s) a trCoreHydrated.`);
need(directRefs(stateEffective)===0,`State Runtime efectivo conserva ${directRefs(stateEffective)} referencia(s) directa(s) a trCoreHydrated.`);
need(directRefs(canonical)===0,`Canonical Metrics conserva ${directRefs(canonical)} referencia(s) directa(s) a trCoreHydrated.`);
need(contractCalls(structural)===2,`Structural Runtime debe usar exactamente 2 lecturas de ${CONTRACT}; encontró ${contractCalls(structural)}.`);
need(contractCalls(stateEffective)===2,`State Runtime efectivo debe usar exactamente 2 lecturas de ${CONTRACT}; encontró ${contractCalls(stateEffective)}.`);
need(contractCalls(canonical)===2,`Canonical Metrics debe usar exactamente 2 lecturas de ${CONTRACT}; encontró ${contractCalls(canonical)}.`);

need(bundled.includes(`Object.defineProperty(globalThis,'${CONTRACT}',{value:Object.freeze({ready:()=>!!trCoreHydrated}),writable:false,enumerable:false,configurable:false});`),
  'El build transform no publica Core Hydration Read Contract read-only con la forma exacta esperada.');
need(structural.includes(`function trDraftMaybeRestoreAfterView(){\n  if(!globalThis.${CONTRACT}.ready())return;`),
  'Draft restore no conserva el guard de hidratación a través del contrato.');
need(structural.includes(`if(globalThis.${CONTRACT}.ready()&&!trCoreFatal)render();`),
  'Structural Runtime no conserva el mount inmediato post-hidratación mediante contrato.');
need(stateEffective.includes(`if(!globalThis.${CONTRACT}.ready()||!trDomainRootTarget||trDomainSchemaNormalizedRoots.has(trDomainRootTarget))return false;`),
  'State Runtime no conserva el guard de normalización hidratada mediante contrato.');
need(stateEffective.includes(`if(globalThis.${CONTRACT}.ready())trStateEnsureAttached('runtime-load');trUiCapture('runtime-load');`),
  'State Runtime no conserva el attach inmediato post-hidratación mediante contrato.');
need(canonical.includes(`if(!globalThis.${CONTRACT}.ready())return 0;`),
  'Canonical Metrics no conserva el guard de normalización post-hidratación mediante contrato.');
need(canonical.includes(`if(globalThis.${CONTRACT}.ready()){`),
  'Canonical Metrics no conserva la decisión de bootstrap hidratado mediante contrato.');
need(canonical.includes("addEventListener('tradingresearch:core-hydrated',()=>trCanonicalNormalizeAfterHydration(),{once:true});"),
  'Canonical Metrics cambió el listener de hidratación durable fuera de alcance.');

/* Require an actual structural reduction, not only a syntactic indirection. */
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const src of runtimeSources.values())for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));
need(runtimeOverlap.length===183,
  `Batch 53 debe reducir el proxy app/runtime a 183; actual ${runtimeOverlap.length}. trCoreHydrated presente=${runtimeTokens.has('trCoreHydrated')}.`);

/* Freeze unrelated currentView sensitive boundaries while Batch 53 moves only hydration reads. */
const backup=runtimeSources.get('backup-v2-runtime.js');
const cloud=runtimeSources.get('cloud-v10-runtime.js');
need(backup.includes("currentView='config';globalThis.TradingResearchConfigTabStateContract.set('data');render();"),'Restore V2 currentView write changed outside Batch 53.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull currentView write changed outside Batch 53.');
need(cloud.includes("currentView==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='cloud'"),'Cloud Push currentView read changed outside Batch 53.');

if(fail.length){
  console.error('Core Hydration Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Core Hydration Read Boundary verification OK');
console.log(' - direct trCoreHydrated semantic runtime reads: 6 -> 0');
console.log(' - all 16 runtime files are free of direct trCoreHydrated tokens');
console.log(' - Structural Runtime: 2 hydration reads contract-bound');
console.log(' - State Runtime: 2 hydration reads contract-bound');
console.log(' - Canonical Metrics: 2 hydration reads contract-bound');
console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length}`);
console.log(' - Core Hydration contract: read-only ready() over classic source binding');
console.log(' - Restore V2 and Cloud currentView boundaries remain untouched');
