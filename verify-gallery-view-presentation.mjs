import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const base=spawnSync(process.execPath,['verify-operations-filter-read.mjs'],{stdio:'inherit'});
if(base.status!==0)process.exit(Number.isInteger(base.status)?base.status:1);

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=191;
const CONTRACT='TradingResearchGalleryViewPresentationContract';

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const file of runtimeFiles){
  const src=fs.readFileSync(file,'utf8');
  for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
}
const overlap=topNames.filter(name=>runtimeTokens.has(name));
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El solapamiento app/runtime de Batch 22 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'Falta el contrato explícito Gallery View Presentation en app.js.');
need(app.includes("value:Object.freeze({render:gallery})"),
  'Gallery View Presentation no publica exactamente render:gallery.');
need(!structural.includes("case 'gallery': return gallery();"),
  'structural-runtime.js todavía consume gallery() directamente.');
need(structural.includes(`case 'gallery': return globalThis.${CONTRACT}.render();`),
  `structural-runtime.js no consume ${CONTRACT}.render() en el router de vistas.`);
const unexpectedConsumers=runtimeFiles.filter(file=>
  file!=='structural-runtime.js'&&(fs.readFileSync(file,'utf8')||'').includes(`globalThis.${CONTRACT}.`)
);
need(unexpectedConsumers.length===0,
  `Consumidores inesperados de Gallery View Presentation: ${unexpectedConsumers.join(', ')}.`);

if(fail.length){
  console.error('Gallery View Presentation verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Gallery View Presentation verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - gallery implementation: preserved in app.js');
console.log(' - structural router: direct contractual renderer');
console.log(' - historical Operations Filter Read + Classic Global Debt gates: preserved');
