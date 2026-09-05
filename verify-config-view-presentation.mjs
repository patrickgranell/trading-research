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
const MAX_RUNTIME_NAME_OVERLAP=184;
const CONTRACT='TradingResearchConfigViewPresentationContract';

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
const directConfigCalls=runtimeFiles.filter(file=>/\bconfig\s*\(/.test(runtimeSources.get(file)||''));
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const configSource=app.match(/function config\(\)\{[^\n]+\}/)?.[0]||'';
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 30: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(Boolean(configSource),'app.js ya no conserva la implementación fuente de config().');
need(configSource.includes("const p=getCurrentPlan();return `${pageHead('Configuración'"),
  'config() cambió su composición de entrada de la vista Configuración.');
need(!configSource.includes('calcMetricStats('),
  'config() no debe introducir cálculos de métricas financieras en la entrada de vista.');
need(!configSource.includes('persist(')&&!configSource.includes('saveState('),
  'config() no debe persistir directamente durante la composición de entrada.');
need(directConfigCalls.length===0,
  `Persisten llamadas ejecutables directas config() en runtimes: ${directConfigCalls.join(', ')}.`);

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Config View Presentation Contract.');
need(bundledAppStage.includes('render:config'),
  'Config View Presentation Contract no publica exactamente render:config.');
need(!bundledAppStage.includes('window.config'),
  'Config View Presentation Contract reintroduce un mirror window redundante.');
need(structural.includes(`case 'config': return globalThis.${CONTRACT}.render();`),
  'El router estructural no consume Config View Presentation Contract.');

for(const file of runtimeFiles.filter(x=>x!=='structural-runtime.js')){
  const src=runtimeSources.get(file)||'';
  need(!src.includes(`globalThis.${CONTRACT}`),
    `Consumidor inesperado de ${CONTRACT}: ${file}.`);
}

if(fail.length){
  console.error('Config View Presentation verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Config View Presentation verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - executable direct config() runtime calls: 0');
console.log(' - app.js source config implementation: preserved');
console.log(' - config entry composition: no direct financial metric/persistence call');
console.log(' - structural router: contract-bound');
