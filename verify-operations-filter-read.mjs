import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const classicVerifierPath='verify-classic-global-debt.mjs';
const composedVerifierPath='.verify-classic-global-debt-batch20.tmp.mjs';
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=192;
const EXPECTED_FILTERED_OPS="function filteredOps(){const base=baseFilteredOps();const out=opsViewState.riskPolicy==='plan'?applyRiskManagementRules(base).included:base;return [...out].sort((a,b)=>v3194CompareOps(b,a));}";

function replaceExactlyOnce(source,from,to,label){
  const first=source.indexOf(from),last=source.lastIndexOf(from);
  if(first<0||first!==last)throw new Error(`${label}: se esperaba exactamente una coincidencia.`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

let classic=fs.readFileSync(classicVerifierPath,'utf8');
classic=replaceExactlyOnce(
  classic,
  'const MAX_RUNTIME_NAME_OVERLAP=193;',
  'const MAX_RUNTIME_NAME_OVERLAP=192;',
  'Classic overlap ceiling'
);
classic=replaceExactlyOnce(
  classic,
  "  need(operationsPresentationSrc.includes(`globalThis.${OPERATIONS_PRESENTATION_CONTRACT}.analytics(filteredOps())`),\n    `${OPERATIONS_PRESENTATION_CONSUMER} no consume directamente ${OPERATIONS_PRESENTATION_CONTRACT}.analytics(filteredOps()).`);",
  "  need(operationsPresentationSrc.includes('trRefreshOpsAnalyticsBase(false);'),\n    `${OPERATIONS_PRESENTATION_CONSUMER} no delega analytics mediante trRefreshOpsAnalyticsBase(false).`);",
  'Operations Presentation analytics expectation'
);

let classicStatus=1;
try{
  fs.writeFileSync(composedVerifierPath,classic,'utf8');
  const run=spawnSync(process.execPath,[composedVerifierPath],{stdio:'inherit'});
  classicStatus=Number.isInteger(run.status)?run.status:1;
}finally{
  try{fs.unlinkSync(composedVerifierPath);}catch{}
}
if(classicStatus!==0)process.exit(classicStatus);

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
  `El solapamiento app/runtime de Batch 20 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(!/\bfilteredOps\b/.test(structural),
  'structural-runtime.js todavía consume filteredOps directamente.');
need(
  structural.includes('const trRefreshOpsAnalyticsBase=refreshOpsAnalytics;')||
  structural.includes('const trRefreshOpsAnalyticsBase=trOpsAnalyticsRefreshContract.current();'),
  'Falta el boundary capturado refreshOpsAnalytics usado por el runtime estructural.'
);
need(structural.includes('trRefreshOpsAnalyticsBase(false);'),
  'El partial render de Operaciones no delega analytics en trRefreshOpsAnalyticsBase(false).');
need(!structural.includes('TradingResearchOperationsPresentationContract.analytics(filteredOps())'),
  'El partial render de Operaciones conserva el acoplamiento analytics(filteredOps()).');
need(app.includes(EXPECTED_FILTERED_OPS),
  'La implementación auditada de filteredOps cambió; Batch 20 solo puede cambiar su consumo runtime.');

if(fail.length){
  console.error('Operations Filter Read verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Operations Filter Read verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - filteredOps implementation: preserved');
console.log(' - structural partial analytics: delegated through captured refresh boundary');
console.log(' - historical Classic Global Debt checks: composed and preserved');

await import('./verify-operations-analytics-refresh.mjs');
