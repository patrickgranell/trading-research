import fs from 'node:fs';
import crypto from 'node:crypto';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=184;
const CONTRACT='TradingResearchOperationsViewPresentationContract';
const EXPECTED_OPERATIONS_SHA256='85cb1259bd97b11bb0dcdb8a3c30d9a968f79a3877fd013bd1607f126efc000d';

function stripNonExecutableText(source){
  let out='',i=0;
  while(i<source.length){
    const c=source[i],n=source[i+1];
    if(c==='/'&&n==='/'){out+='  ';i+=2;while(i<source.length&&source[i]!=='\n'){out+=' ';i++;}continue;}
    if(c==='/'&&n==='*'){out+='  ';i+=2;while(i<source.length&&!(source[i]==='*'&&source[i+1]==='/')){out+=source[i]==='\n'?'\n':' ';i++;}if(i<source.length){out+='  ';i+=2;}continue;}
    if(c==='"'||c==="'"||c==='`'){
      const q=c;out+=' ';i++;
      while(i<source.length){const x=source[i];if(x==='\\'){out+='  ';i+=2;continue;}if(x===q){out+=' ';i++;break;}out+=x==='\n'?'\n':' ';i++;}
      continue;
    }
    out+=c;i++;
  }
  return out;
}

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeSources=new Map();
const runtimeTokens=new Set();
for(const file of runtimeFiles){
  const src=fs.readFileSync(file,'utf8');runtimeSources.set(file,src);
  for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
}
const overlap=topNames.filter(name=>runtimeTokens.has(name));
const directCalls=[];
for(const [file,src] of runtimeSources){
  const executable=stripNonExecutableText(src);
  /* Direct legacy calls are operations(...), not member calls such as contract.operations(). */
  const count=[...executable.matchAll(/(?:^|[^.\w$])operations\s*\(/gm)].length;
  if(count)directCalls.push([file,count]);
}
const structural=runtimeSources.get('structural-runtime.js')||'';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const operationsDefinitionCount=(app.match(/(?:^|\n)function\s+operations\s*\(/g)||[]).length;
const operationsStart=app.indexOf('function operations(){');
const operationsEnd=app.indexOf('\n}\n\nfunction setBlockUnit',operationsStart);
const operationsSource=operationsStart>=0&&operationsEnd>=0?app.slice(operationsStart,operationsEnd+2):'';
const operationsHash=operationsSource?crypto.createHash('sha256').update(operationsSource).digest('hex'):'';

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 35: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(operationsDefinitionCount===1,
  `Inventario de operations() cambió inesperadamente: ${operationsDefinitionCount} definiciones (esperado 1).`);
need(operationsHash===EXPECTED_OPERATIONS_SHA256,
  `El cuerpo fuente de operations() cambió: sha256 ${operationsHash||'no encontrado'}.`);
need(directCalls.length===0,
  `Persisten llamadas ejecutables directas operations() en runtimes: ${directCalls.map(([f,n])=>`${f}(${n})`).join(', ')}.`);
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Operations View Presentation Contract.');
need(bundledAppStage.includes('render:()=>operations()'),
  'Operations View Presentation Contract no usa resolución tardía exacta render:()=>operations().');
need(!bundledAppStage.includes('window.operations'),
  'Operations View Presentation Contract reintroduce un mirror window.operations redundante.');
need(structural.includes(`case 'operations': return globalThis.${CONTRACT}.render();`),
  'El router de Operaciones no consume Operations View Presentation Contract.');
const consumers=runtimeFiles.filter(file=>(runtimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`));
need(consumers.length===1&&consumers[0]==='structural-runtime.js',
  `Consumidores de ${CONTRACT} inesperados: ${consumers.join(', ')||'ninguno'}.`);

if(fail.length){
  console.error('Operations View Presentation Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Operations View Presentation Boundary verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - executable direct operations() runtime calls: 0');
console.log(` - operations() source sha256 frozen: ${operationsHash}`);
console.log(' - Operations route: contract-bound with late resolution');

await import('./verify-journal-view-presentation-boundary.mjs');
