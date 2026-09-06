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
const CONTRACT='TradingResearchBlocksViewPresentationContract';
const EXPECTED_BLOCKS_SHA256='3c2140e2a3fdac1b047cdd43743bc94cb13bc0c5df1643c0b8222bdc23a51ebd';
const EXPECTED_BLOCK_CORE_SHA256='a3fec9f07aebce77583f42b441a848775868724f2edd2f5140836113d398ab9d';
const EXPECTED_CALC_METRIC_STATS_SHA256='234307beed9a2e8ed3abb4bbb5bdd23c2ad48457e8ef63753df8e8aa8925d72a';

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
function fnToNextFunction(startMarker){
  const start=app.indexOf(startMarker);
  if(start<0)return '';
  const end=app.indexOf('\nfunction ',start+startMarker.length);
  return end>=0?app.slice(start,end):'';
}
function sha(source){return source?crypto.createHash('sha256').update(source).digest('hex'):'';}

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
  /* Direct legacy calls are blocks(...), not member calls such as contract.blocks(). */
  const count=[...executable.matchAll(/(?:^|[^.\w$])blocks\s*\(/gm)].length;
  if(count)directCalls.push([file,count]);
}
const structural=runtimeSources.get('structural-runtime.js')||'';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const blocksDefinitionCount=(app.match(/(?:^|\n)function\s+blocks\s*\(/g)||[]).length;
const blockCoreDefinitionCount=(app.match(/(?:^|\n)function\s+blockCore\s*\(/g)||[]).length;
const calcMetricStatsDefinitionCount=(app.match(/(?:^|\n)function\s+calcMetricStats\s*\(/g)||[]).length;
const blocksSource=fnToNextFunction('function blocks(){');
const blockCoreSource=fnToNextFunction('function blockCore(slice){');
const calcMetricStatsSource=fnToNextFunction("function calcMetricStats(ops,unit='r',basis='gross'){");
const blocksHash=sha(blocksSource),blockCoreHash=sha(blockCoreSource),calcMetricStatsHash=sha(calcMetricStatsSource);

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 37: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(blocksDefinitionCount===1,
  `Inventario de blocks() cambió inesperadamente: ${blocksDefinitionCount} definiciones (esperado 1).`);
need(blockCoreDefinitionCount===1,
  `Inventario de blockCore() cambió inesperadamente: ${blockCoreDefinitionCount} definiciones (esperado 1).`);
need(calcMetricStatsDefinitionCount===1,
  `Inventario de calcMetricStats() cambió inesperadamente: ${calcMetricStatsDefinitionCount} definiciones (esperado 1).`);
need(blocksHash===EXPECTED_BLOCKS_SHA256,
  `blocks() SHA256 actual: ${blocksHash||'no encontrado'}; esperado ${EXPECTED_BLOCKS_SHA256}.`);
need(blockCoreHash===EXPECTED_BLOCK_CORE_SHA256,
  `blockCore() SHA256 actual: ${blockCoreHash||'no encontrado'}; esperado ${EXPECTED_BLOCK_CORE_SHA256}.`);
need(calcMetricStatsHash===EXPECTED_CALC_METRIC_STATS_SHA256,
  `calcMetricStats() SHA256 actual: ${calcMetricStatsHash||'no encontrado'}; esperado ${EXPECTED_CALC_METRIC_STATS_SHA256}.`);
need(blockCoreSource.includes("calcMetricStats(slice,blockViewState.unit,blockViewState.basis)"),
  'blockCore() dejó de usar la ruta canónica calcMetricStats para la unidad/base activa.');
need(blockCoreSource.includes("calcMetricStats(slice,'usd','net')"),
  'blockCore() dejó de usar calcMetricStats para el neto USD.');
need(directCalls.length===0,
  `Persisten llamadas ejecutables directas blocks() en runtimes: ${directCalls.map(([f,n])=>`${f}(${n})`).join(', ')}.`);
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Blocks View Presentation Contract.');
need(bundledAppStage.includes('render:()=>blocks()'),
  'Blocks View Presentation Contract no usa resolución tardía exacta render:()=>blocks().');
need(!bundledAppStage.includes('window.blocks'),
  'Blocks View Presentation Contract reintroduce un mirror window.blocks redundante.');
need(structural.includes(`case 'blocks': return globalThis.${CONTRACT}.render();`),
  'El router de Bloques no consume Blocks View Presentation Contract.');
const consumers=runtimeFiles.filter(file=>(runtimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`));
need(consumers.length===1&&consumers[0]==='structural-runtime.js',
  `Consumidores de ${CONTRACT} inesperados: ${consumers.join(', ')||'ninguno'}.`);

if(fail.length){
  console.error('Blocks View Presentation Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Blocks View Presentation Boundary verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - executable direct blocks() runtime calls: 0');
console.log(` - blocks() source sha256 frozen: ${blocksHash}`);
console.log(` - blockCore() source sha256 frozen: ${blockCoreHash}`);
console.log(` - calcMetricStats() source sha256 frozen: ${calcMetricStatsHash}`);
console.log(' - Blocks route: contract-bound with late resolution');
await import('./verify-current-view-router-read-boundary.mjs');
