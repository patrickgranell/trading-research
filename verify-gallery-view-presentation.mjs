import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=186;
const CONTRACT='TradingResearchGalleryViewPresentationContract';
const LEGACY='gallery';

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const file of runtimeFiles){
  const src=fs.readFileSync(file,'utf8');
  for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
}
const overlap=topNames.filter(name=>runtimeTokens.has(name));
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const gallerySource=app.match(/function gallery\(\)\{[^\n]+\}/)?.[0]||'';
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El solapamiento app/runtime de Batch 27 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(Boolean(gallerySource),'app.js ya no conserva la implementación fuente de gallery().');
need(gallerySource.includes('const p=getCurrentPlan(),ops=galleryFilteredOps(),all=currentOps()'),
  'gallery() cambió su frontera de lectura del plan/dataset.');
need(!gallerySource.includes('calcMetricStats('),
  'gallery() no debe cruzar la frontera de métricas financieras.');
need(!gallerySource.includes('persist(')&&!gallerySource.includes('saveState('),
  'gallery() dejó de ser una proyección de solo lectura.');
need(!new RegExp(`\\b${LEGACY}\\s*\\(`).test(structural),
  'structural-runtime.js todavía invoca directamente gallery().');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Gallery View Presentation Contract.');
need(bundledAppStage.includes('render:gallery'),
  'Gallery View Presentation Contract no publica exactamente render:gallery.');
need(!bundledAppStage.includes('window.gallery'),
  'Gallery View Presentation Contract reintroduce un mirror window redundante.');
need(structural.includes(`case 'gallery': return globalThis.${CONTRACT}.render();`),
  'El router estructural no consume Gallery View Presentation Contract.');
for(const file of runtimeFiles.filter(x=>x!=='structural-runtime.js')){
  const src=fs.readFileSync(file,'utf8');
  need(!src.includes(`globalThis.${CONTRACT}`),
    `Consumidor inesperado de ${CONTRACT}: ${file}.`);
}

if(fail.length){
  console.error('Gallery View Presentation verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Gallery View Presentation verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - app.js source gallery implementation: preserved');
console.log(' - gallery read-only / no canonical metric call: preserved');
console.log(' - structural router: contract-bound');
