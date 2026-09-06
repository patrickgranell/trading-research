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
const CONTRACT='TradingResearchJournalViewPresentationContract';
const EXPECTED_JOURNAL_SHA256='2d099a058152a67a08caf2ca626ea831deee084a10c7b13781c2fd48fc5c79c2';
const EXPECTED_JOURNAL_STATS_SHA256='0729302e36c8ef9d6dd995f5d7f292cbbdebf9da5308a97cf84b71489a02a5e7';
const EXPECTED_EMOTIONAL_BREAKDOWN_SHA256='560266be271393e2e1657125cd47db67da7c515555d0b26a77c7585e7fd8658e';

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
function fnSource(startMarker,nextMarker){
  const start=app.indexOf(startMarker);
  const end=start>=0?app.indexOf(nextMarker,start):-1;
  return start>=0&&end>=0?app.slice(start,end):'';
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
  const count=[...executable.matchAll(/\bjournal\s*\(/g)].length;
  if(count)directCalls.push([file,count]);
}
const structural=runtimeSources.get('structural-runtime.js')||'';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const journalDefinitionCount=(app.match(/(?:^|\n)function\s+journal\s*\(/g)||[]).length;
const journalStatsDefinitionCount=(app.match(/(?:^|\n)function\s+journalStats\s*\(/g)||[]).length;
const emotionalBreakdownDefinitionCount=(app.match(/(?:^|\n)function\s+emotionalBreakdown\s*\(/g)||[]).length;
const journalSource=fnSource('function journal(){','\nfunction journalTable');
const journalStatsSource=fnSource('function journalStats(ops){','\nfunction emotionalBreakdown');
const emotionalBreakdownSource=fnSource("function emotionalBreakdown(ops,key='emotion'){",'\nfunction readJournalFilters');
const journalHash=sha(journalSource),journalStatsHash=sha(journalStatsSource),emotionalBreakdownHash=sha(emotionalBreakdownSource);

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El proxy lexical app/runtime empeoró en Batch 36: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(journalDefinitionCount===1,
  `Inventario de journal() cambió inesperadamente: ${journalDefinitionCount} definiciones (esperado 1).`);
need(journalStatsDefinitionCount===1,
  `Inventario de journalStats() cambió inesperadamente: ${journalStatsDefinitionCount} definiciones (esperado 1).`);
need(emotionalBreakdownDefinitionCount===1,
  `Inventario de emotionalBreakdown() cambió inesperadamente: ${emotionalBreakdownDefinitionCount} definiciones (esperado 1).`);
need(journalHash===EXPECTED_JOURNAL_SHA256,
  `journal() SHA256 actual: ${journalHash||'no encontrado'}; esperado ${EXPECTED_JOURNAL_SHA256}.`);
need(journalStatsHash===EXPECTED_JOURNAL_STATS_SHA256,
  `journalStats() SHA256 actual: ${journalStatsHash||'no encontrado'}; esperado ${EXPECTED_JOURNAL_STATS_SHA256}.`);
need(emotionalBreakdownHash===EXPECTED_EMOTIONAL_BREAKDOWN_SHA256,
  `emotionalBreakdown() SHA256 actual: ${emotionalBreakdownHash||'no encontrado'}; esperado ${EXPECTED_EMOTIONAL_BREAKDOWN_SHA256}.`);
need(directCalls.length===0,
  `Persisten llamadas ejecutables directas journal() en runtimes: ${directCalls.map(([f,n])=>`${f}(${n})`).join(', ')}.`);
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Journal View Presentation Contract.');
need(bundledAppStage.includes('render:()=>journal()'),
  'Journal View Presentation Contract no usa resolución tardía exacta render:()=>journal().');
need(!bundledAppStage.includes('window.journal'),
  'Journal View Presentation Contract reintroduce un mirror window.journal redundante.');
need(structural.includes(`case 'journal': return globalThis.${CONTRACT}.render();`),
  'El router del Diario no consume Journal View Presentation Contract.');
const consumers=runtimeFiles.filter(file=>(runtimeSources.get(file)||'').includes(`globalThis.${CONTRACT}`));
need(consumers.length===1&&consumers[0]==='structural-runtime.js',
  `Consumidores de ${CONTRACT} inesperados: ${consumers.join(', ')||'ninguno'}.`);

if(fail.length){
  console.error('Journal View Presentation Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Journal View Presentation Boundary verification OK');
console.log(` - legacy lexical runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - executable direct journal() runtime calls: 0');
console.log(` - journal() source sha256 frozen: ${journalHash}`);
console.log(` - journalStats() source sha256 frozen: ${journalStatsHash}`);
console.log(` - emotionalBreakdown() source sha256 frozen: ${emotionalBreakdownHash}`);
console.log(' - Journal route: contract-bound with late resolution');
