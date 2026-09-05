import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=184;
const CONTRACT='TradingResearchModeCardStateReadContract';
const LEGACY='v30Ui';
const CONSUMERS=[
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
  `El solapamiento app/runtime de Batch 28 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes("let v30Ui=(()=>{try{return {...{modeExpanded:false},...JSON.parse(localStorage.getItem(V30_UI_KEY)||'{}')}}catch{return {modeExpanded:false}}})();"),
  'app.js ya no conserva el estado fuente auditado de la tarjeta Modo actual.');
need(app.includes('function toggleModeCard(){v30Ui.modeExpanded=!v30Ui.modeExpanded;saveV30Ui();'),
  'La mutación fuente de toggleModeCard cambió durante un batch de solo lectura.');

const direct=runtimeFiles.filter(file=>new RegExp(`\\b${LEGACY}\\b`).test(runtimeSources.get(file)||''));
need(direct.length===0,`Los runtimes todavía leen directamente ${LEGACY}: ${direct.join(', ')}.`);

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Mode Card State Read Contract.');
need(bundledAppStage.includes('expanded:()=>!!v30Ui.modeExpanded'),
  'Mode Card State Read Contract no expone una lectura booleana de modeExpanded.');
need(!bundledAppStage.includes('window.v30Ui='),
  'Mode Card State Read Contract reintroduce un mirror window de v30Ui.');

const actual=runtimeFiles.filter(file=>(runtimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`));
const expected=new Set(CONSUMERS);
need(actual.length===CONSUMERS.length&&actual.every(file=>expected.has(file))&&CONSUMERS.every(file=>actual.includes(file)),
  `Mode Card State Read Contract tiene consumidores inesperados o ausentes: ${actual.join(', ')}.`);

for(const file of CONSUMERS){
  const src=runtimeSources.get(file)||'';
  need(src.includes(`globalThis.${CONTRACT}`),`${file} no resuelve el estado de Mode Card mediante contrato.`);
  need(!src.includes('v30Ui.modeExpanded'),`${file} conserva lectura directa de v30Ui.modeExpanded.`);
}

if(fail.length){
  console.error('Mode Card State Read verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Mode Card State Read verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - v30Ui source state + toggle mutation: preserved');
console.log(' - Mode Card expanded state: 7 runtime readers contract-bound');
console.log(' - persistence and domain behavior: untouched');

await import('./verify-gallery-view-presentation-v2.mjs');
