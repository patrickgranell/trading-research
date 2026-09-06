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
const CONTRACT='TradingResearchDashboardViewPresentationContract';

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
  const count=[...executable.matchAll(/\bdashboard\s*\(/g)].length;
  if(count)directCalls.push([file,count]);
}
const structural=runtimeSources.get('structural-runtime.js')||'';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const dashboardDefinitionCount=(app.match(/(?:function\s+dashboard\s*\(|dashboard\s*=\s*function\s*\()/g)||[]).length;

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 34: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(dashboardDefinitionCount>=7,
  `La cadena histórica de Dashboard cambió inesperadamente: ${dashboardDefinitionCount} definiciones (<7).`);
need(app.includes('baseStats=calcStats(ops)')&&app.includes("metricStats=calcMetricStats(ops,unit,'gross')"),
  'El cuerpo fuente del Dashboard ya no conserva sus llamadas métricas históricas esperadas.');
need(directCalls.length===0,
  `Persisten llamadas ejecutables directas dashboard() en runtimes: ${directCalls.map(([f,n])=>`${f}(${n})`).join(', ')}.`);
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Dashboard View Presentation Contract.');
need(bundledAppStage.includes('render:()=>dashboard()'),
  'Dashboard View Presentation Contract no usa resolución tardía exacta render:()=>dashboard().');
need(!bundledAppStage.includes('window.dashboard'),
  'Dashboard View Presentation Contract reintroduce un mirror window.dashboard redundante.');
need(structural.includes(`case 'dashboard': return globalThis.${CONTRACT}.render();`),
  'El router principal no consume Dashboard View Presentation Contract.');
need(structural.includes(`globalThis.TradingResearchCurrentViewRouterFallbackWriteContract.toDashboard();\n      return globalThis.${CONTRACT}.render();`),
  'El fallback del router no conserva Dashboard mediante el contrato.');
const consumers=runtimeFiles.filter(file=>(runtimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`));
need(consumers.length===1&&consumers[0]==='structural-runtime.js',
  `Consumidores de ${CONTRACT} inesperados: ${consumers.join(', ')||'ninguno'}.`);

if(fail.length){
  console.error('Dashboard View Presentation Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Dashboard View Presentation Boundary verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - executable direct dashboard() runtime calls: 0');
console.log(` - historical Dashboard definitions preserved: ${dashboardDefinitionCount}`);
console.log(' - primary route + unknown-view fallback: contract-bound with late resolution');

await import('./verify-operations-view-presentation-boundary.mjs');
