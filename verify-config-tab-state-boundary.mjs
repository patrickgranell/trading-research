import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=184;
const CONTRACT='TradingResearchConfigTabStateContract';

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

function directConfigTabRefs(source){
  const executable=stripNonExecutableText(source)
    .replace(/\bconfigTab\s*:/g,'           ')
    .replace(/\.\s*configTab\b/g,'           '); // object key/property access is not the classic binding
  return [...executable.matchAll(/\bconfigTab\b/g)].length;
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
const directRefs=[...runtimeSources].flatMap(([file,src])=>Array(directConfigTabRefs(src)).fill(file));
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 33: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes("let configTab='instruments';"),
  'El estado fuente configTab ya no conserva el valor inicial instruments.');
need(app.includes('function setConfigTab(tab){configTab=tab;render();}'),
  'El comando fuente setConfigTab cambió su semántica histórica.');
need(directRefs.length===0,
  `Persisten referencias ejecutables directas al binding configTab en runtimes: ${directRefs.join(', ')}.`);

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Config Tab State Contract.');
need(bundledAppStage.includes('current:()=>configTab,set:value=>{configTab=value;}'),
  'Config Tab State Contract no publica exactamente current/set sobre el binding histórico.');
need(!bundledAppStage.includes('window.configTab'),
  'Config Tab State Contract reintroduce un mirror window.configTab redundante.');
need(stateRuntime.includes(`configTab:globalThis.${CONTRACT}.current()`),
  'TRUIStore snapshot no lee configTab a través del contrato.');
need(stateRuntime.includes(`globalThis.${CONTRACT}.set(tab);render();`),
  'TRUIStore config.tab no escribe configTab a través del contrato antes de renderizar.');

for(const file of runtimeFiles.filter(x=>x!=='state-runtime.js')){
  need(!(runtimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`),
    `Consumidor inesperado de ${CONTRACT}: ${file}.`);
}

if(fail.length){
  console.error('Config Tab State Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Config Tab State Boundary verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - executable direct configTab binding refs in runtimes: 0');
console.log(' - diagnostic configTab key/property reads: preserved');
console.log(' - TRUIStore config tab read/write: contract-bound');
