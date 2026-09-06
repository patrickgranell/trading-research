import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateSource=fs.readFileSync('state-runtime.js','utf8');
const stateEffective=transformStateActions(stateSource).source;
const bundled=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const CONTRACT='TradingResearchCoreHydrationReadContract';
const directRefs=src=>(src.match(/\btrCoreHydrated\b/g)||[]).length;
const contractCalls=src=>(src.match(/globalThis\.TradingResearchCoreHydrationReadContract\.ready\(\)/g)||[]).length;

need(directRefs(structural)===0,`Structural Runtime conserva ${directRefs(structural)} referencia(s) directa(s) a trCoreHydrated.`);
need(directRefs(stateEffective)===0,`State Runtime efectivo conserva ${directRefs(stateEffective)} referencia(s) directa(s) a trCoreHydrated.`);
need(contractCalls(structural)===2,`Structural Runtime debe usar exactamente 2 lecturas de ${CONTRACT}; encontró ${contractCalls(structural)}.`);
need(contractCalls(stateEffective)===2,`State Runtime efectivo debe usar exactamente 2 lecturas de ${CONTRACT}; encontró ${contractCalls(stateEffective)}.`);

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

/* Freeze unrelated currentView sensitive boundaries while Batch 53 moves only hydration reads. */
const backup=fs.readFileSync('backup-v2-runtime.js','utf8');
const cloud=fs.readFileSync('cloud-v10-runtime.js','utf8');
need(backup.includes("currentView='config';globalThis.TradingResearchConfigTabStateContract.set('data');render();"),'Restore V2 currentView write changed outside Batch 53.');
need(cloud.includes("currentView='dashboard';render();"),'Cloud Pull currentView write changed outside Batch 53.');
need(cloud.includes("currentView==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='cloud'"),'Cloud Push currentView read changed outside Batch 53.');

if(fail.length){
  console.error('Core Hydration Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Core Hydration Read Boundary verification OK');
console.log(' - direct trCoreHydrated runtime reads: 4 -> 0');
console.log(' - Structural Runtime: 2 hydration reads contract-bound');
console.log(' - State Runtime: 2 hydration reads contract-bound');
console.log(' - Core Hydration contract: read-only ready() over classic source binding');
console.log(' - Restore V2 and Cloud currentView boundaries remain untouched');
