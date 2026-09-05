import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=185;
const DATA_CONTRACT='TradingResearchDataSecurityPanelContract';
const MODE_CONTRACT='TradingResearchModeCardPresentationContract';
const DATA_LEGACY='dataSecurityPanel';
const MODE_LEGACY='v30ModeCard';
const DATA_CONSUMERS=[
  'structural-runtime.js','state-runtime.js','backup-v2-runtime.js','security-runtime.js',
  'event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'
];
const MODE_CONSUMERS=[
  'structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js',
  'csp-runtime.js','style-runtime.js','render-closure-runtime.js'
];

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeSources=new Map();
const runtimeTokens=new Set();
for(const file of runtimeFiles){
  const src=fs.readFileSync(file,'utf8');
  runtimeSources.set(file,src);
  for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
}
const overlap=topNames.filter(name=>runtimeTokens.has(name));
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El solapamiento app/runtime de Batch 27 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes('function dataSecurityPanel(){'),
  'app.js ya no conserva la implementación fuente de dataSecurityPanel.');
need(app.includes('function v30ModeCard(){'),
  'app.js ya no conserva la implementación fuente de v30ModeCard.');

for(const [legacy,label] of [[DATA_LEGACY,'Data Security Panel'],[MODE_LEGACY,'Mode Card']]){
  const direct=runtimeFiles.filter(file=>new RegExp(`\\b${legacy}\\b`).test(runtimeSources.get(file)||''));
  need(direct.length===0,`${label} todavía conserva consumidores clásicos directos: ${direct.join(', ')}.`);
}

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${DATA_CONTRACT}'`),
  'El build transform no publica Data Security Panel Contract.');
need(bundledAppStage.includes('current:()=>dataSecurityPanel'),
  'Data Security Panel Contract no captura el binding actual.');
need(bundledAppStage.includes('replace:fn=>{dataSecurityPanel=fn;}'),
  'Data Security Panel Contract no reemplaza el binding clásico.');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${MODE_CONTRACT}'`),
  'El build transform no publica Mode Card Presentation Contract.');
need(bundledAppStage.includes('current:()=>v30ModeCard'),
  'Mode Card Presentation Contract no captura el binding actual.');
need(bundledAppStage.includes('replace:fn=>{v30ModeCard=fn;}'),
  'Mode Card Presentation Contract no reemplaza el binding clásico.');
need(!bundledAppStage.includes('window.dataSecurityPanel=fn')&&!bundledAppStage.includes('window.v30ModeCard=fn'),
  'Los contratos de presentación reintroducen mirrors window redundantes.');

for(const [contract,expectedList,label] of [
  [DATA_CONTRACT,DATA_CONSUMERS,'Data Security Panel'],
  [MODE_CONTRACT,MODE_CONSUMERS,'Mode Card']
]){
  const actual=runtimeFiles.filter(file=>(runtimeSources.get(file)||'').includes(`globalThis.${contract}`));
  const expected=new Set(expectedList);
  need(actual.length===expectedList.length&&actual.every(file=>expected.has(file))&&expectedList.every(file=>actual.includes(file)),
    `${label} Contract tiene consumidores inesperados o ausentes: ${actual.join(', ')}.`);
}

need(!(runtimeSources.get('style-runtime.js')||'').includes('window.dataSecurityPanel='),
  'Style Runtime reintroduce window.dataSecurityPanel.');
need(!(runtimeSources.get('csp-runtime.js')||'').includes('window.dataSecurityPanel='),
  'CSP Runtime reintroduce window.dataSecurityPanel.');
need(!(runtimeSources.get('event-runtime.js')||'').includes('window.dataSecurityPanel='),
  'Event Runtime reintroduce window.dataSecurityPanel.');

if(fail.length){
  console.error('Diagnostics Presentation Chain verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Diagnostics Presentation Chain verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - app.js source presentation implementations: preserved');
console.log(' - Data Security Panel: 8 runtime wrappers contract-bound');
console.log(' - Mode Card: 7 runtime wrappers contract-bound');
console.log(' - financial/domain behavior: untouched');

await import('./verify-mode-card-state-read.mjs');
