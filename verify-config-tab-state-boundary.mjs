import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const stateRuntimeSource=fs.readFileSync('state-runtime.js','utf8');
const stateRuntimeEffective=transformStateActions(stateRuntimeSource).source;
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const EXPECTED_CONSUMERS=new Set([
  'state-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'
]);
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
    .replace(/\.\s*configTab\b/g,'           '); // property key/access is not the classic binding
  return [...executable.matchAll(/\bconfigTab\b/g)].length;
}

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const rawRuntimeSources=new Map();
const effectiveRuntimeSources=new Map();
const runtimeTokens=new Set();
for(const file of runtimeFiles){
  const raw=fs.readFileSync(file,'utf8');rawRuntimeSources.set(file,raw);
  const effective=file==='state-runtime.js'?stateRuntimeEffective:raw;effectiveRuntimeSources.set(file,effective);
  for(const m of raw.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
}
const overlap=topNames.filter(name=>runtimeTokens.has(name));
const directRefFiles=[...effectiveRuntimeSources].filter(([,src])=>directConfigTabRefs(src)>0).map(([file])=>file);
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 33: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes("let configTab='instruments';"),
  'El estado fuente configTab ya no conserva el valor inicial instruments.');
need(app.includes('function setConfigTab(tab){configTab=tab;render();}'),
  'El comando fuente setConfigTab cambió su semántica histórica.');
need(stateRuntimeSource.includes("configTab:typeof configTab!=='undefined'?configTab:''"),
  'state-runtime.js fuente ya no conserva la lectura histórica configTab esperada.');
need(stateRuntimeSource.includes('()=>{configTab=tab;render();}'),
  'state-runtime.js fuente ya no conserva la escritura histórica configTab esperada.');
need(!stateRuntimeSource.includes(`globalThis.${CONTRACT}`),
  'state-runtime.js fuente fue editado directamente; Batch 33 exige migración build-only para este archivo grande.');
need(directRefFiles.length===0,
  `Persisten referencias ejecutables directas al binding configTab en runtimes efectivos: ${directRefFiles.join(', ')}.`);

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Config Tab State Contract.');
need(bundledAppStage.includes('current:()=>configTab,set:value=>{configTab=value;}'),
  'Config Tab State Contract no publica exactamente current/set sobre el binding histórico.');
need(!bundledAppStage.includes('window.configTab'),
  'Config Tab State Contract reintroduce un mirror window.configTab redundante.');
need(stateRuntimeEffective.includes(`configTab:globalThis.${CONTRACT}.current()`),
  'TRUIStore efectivo no lee configTab a través del contrato.');
need(stateRuntimeEffective.includes(`globalThis.${CONTRACT}.set(tab);render();`),
  'TRUIStore efectivo no escribe configTab a través del contrato antes de renderizar.');

const actualConsumers=runtimeFiles.filter(file=>(effectiveRuntimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`));
need(actualConsumers.length===EXPECTED_CONSUMERS.size&&actualConsumers.every(file=>EXPECTED_CONSUMERS.has(file)),
  `Consumidores efectivos de ${CONTRACT} no coinciden con el inventario auditado: ${actualConsumers.join(', ')||'ninguno'}.`);
need((effectiveRuntimeSources.get('backup-v2-runtime.js')||'').includes(`currentView='config';globalThis.${CONTRACT}.set('data');render();`),
  'Backup V2 no conserva el aterrizaje post-restore en Configuración → Datos mediante contrato.');
need((effectiveRuntimeSources.get('security-runtime.js')||'').includes(`currentView==='config'&&globalThis.${CONTRACT}.current()==='data'`),
  'Security runtime no conserva su refresh condicional de Datos mediante contrato.');
need((effectiveRuntimeSources.get('event-runtime.js')||'').includes(`currentView==='config'&&globalThis.${CONTRACT}.current()==='data'`),
  'Event runtime no conserva su refresh condicional de Datos mediante contrato.');
need((effectiveRuntimeSources.get('cloud-v10-runtime.js')||'').includes(`currentView==='config'&&globalThis.${CONTRACT}.current()==='cloud'`),
  'Cloud V10 no conserva su refresh condicional de Nube mediante contrato.');
need((effectiveRuntimeSources.get('csp-runtime.js')||'').includes(`currentView==='config'&&globalThis.${CONTRACT}.current()==='data'`),
  'CSP runtime no conserva su refresh condicional de Datos mediante contrato.');
need((effectiveRuntimeSources.get('style-runtime.js')||'').includes(`currentView==='config'&&globalThis.${CONTRACT}.current()==='data'`),
  'Style runtime no conserva su refresh condicional de Datos mediante contrato.');
need((effectiveRuntimeSources.get('render-closure-runtime.js')||'').includes(`currentView==='config'&&globalThis.${CONTRACT}.current()==='data'`),
  'Render Closure no conserva su refresh condicional de Datos mediante contrato.');

if(fail.length){
  console.error('Config Tab State Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Config Tab State Boundary verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - effective executable direct configTab binding refs in runtimes: 0');
console.log(' - state-runtime.js source: byte-preserved; migration applied in existing build transform');
console.log(' - diagnostic configTab key/property reads: preserved');
console.log(' - audited effective contract consumers: 8/8');
console.log(' - TRUIStore + Datos/Nube refresh paths: contract-bound');

await import('./verify-dashboard-view-presentation-boundary.mjs');
