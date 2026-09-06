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
const CONTRACT='TradingResearchImageHydrationPresentationContract';

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
const executableHydrationRefs=runtimeFiles.filter(file=>/\bhydrateImageElements\b/.test(stripNonExecutableText(runtimeSources.get(file)||'')));
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const hydrateDefinitions=[...app.matchAll(/async function hydrateImageElements\(root=document\)\{/g)].length;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 31: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(hydrateDefinitions===2,
  `Inventario fuente de hydrateImageElements cambió: esperado 2 definiciones, encontradas ${hydrateDefinitions}.`);
need(app.includes('const url=await cloudSignedImageUrl(el.dataset.imgId)'),
  'La implementación final Cloud de hydrateImageElements ya no conserva el fallback firmado.');
need(app.includes("el.alt='Imagen no disponible localmente ni en Supabase'"),
  'La implementación final Cloud de hydrateImageElements cambió su fallback visual.');
need(executableHydrationRefs.length===0,
  `Persisten referencias ejecutables directas hydrateImageElements en runtimes: ${executableHydrationRefs.join(', ')}.`);

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Image Hydration Presentation Contract.');
need(bundledAppStage.includes("schedule:()=>{if(typeof hydrateImageElements==='function')setTimeout(hydrateImageElements,0);}"),
  'Image Hydration Presentation Contract no conserva la programación asíncrona original.');
need(!bundledAppStage.includes('window.hydrateImageElements'),
  'Image Hydration Presentation Contract reintroduce un mirror window redundante.');
need(structural.includes(`try{globalThis.${CONTRACT}.schedule();}catch(e){console.warn('hydrateImageElements',e);}`),
  'El post-render estructural no consume Image Hydration Presentation Contract.');

for(const file of runtimeFiles.filter(x=>x!=='structural-runtime.js')){
  need(!(runtimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`),
    `Consumidor inesperado de ${CONTRACT}: ${file}.`);
}

if(fail.length){
  console.error('Image Hydration Presentation verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Image Hydration Presentation verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - executable direct hydrateImageElements runtime references: 0');
console.log(' - local + final Cloud hydrate implementations: preserved');
console.log(' - structural post-render hydration: contract-bound');

await import('./verify-shell-presentation-boundary.mjs');
