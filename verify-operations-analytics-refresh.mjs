import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

// Batch 22 gate: run on every candidate head so CI validates the exact deployable tree.
const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=191;
const CONTRACT='TradingResearchOperationsAnalyticsRefreshContract';
const EXPECTED_REFRESH="function refreshOpsAnalytics(read=true){if(read)readOpsFilters();const area=document.getElementById('opsAnalyticsArea');if(area)area.innerHTML=opsAnalyticsHtml(filteredOps());}";

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const runtimeTokens=new Set();
for(const file of runtimeFiles){
  const src=fs.readFileSync(file,'utf8');
  for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
}
const overlap=topNames.filter(name=>runtimeTokens.has(name));
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(overlap.length<=MAX_RUNTIME_NAME_OVERLAP,
  `El solapamiento app/runtime de Batch 22 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes(EXPECTED_REFRESH),
  'La implementación fuente auditada de refreshOpsAnalytics cambió; Batch 22 solo puede cambiar su frontera runtime/build.');
need(!new RegExp('\\brefreshOpsAnalytics\\b').test(structural),
  'structural-runtime.js todavía nombra directamente refreshOpsAnalytics.');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Operations Analytics Refresh Contract.');
need(bundledAppStage.includes("current:()=>refreshOpsAnalytics"),
  'Operations Analytics Refresh Contract no captura el binding actual de refreshOpsAnalytics.');
need(bundledAppStage.includes("replace:fn=>{refreshOpsAnalytics=fn;}"),
  'Operations Analytics Refresh Contract no reemplaza el binding clásico de refreshOpsAnalytics.');
need(!bundledAppStage.includes('window.refreshOpsAnalytics=fn'),
  'Operations Analytics Refresh Contract reintroduce un mirror window redundante.');
need(structural.includes(`const trOpsAnalyticsRefreshContract=globalThis.${CONTRACT};`),
  'structural-runtime.js no resuelve Operations Analytics Refresh Contract.');
need(structural.includes('const trRefreshOpsAnalyticsBase=trOpsAnalyticsRefreshContract.current();'),
  'structural-runtime.js no captura el refresh base mediante el contrato.');
need(structural.includes('trOpsAnalyticsRefreshContract.replace(function(read=true){'),
  'structural-runtime.js no instala la instrumentación analytics mediante el contrato.');
need(structural.includes("if(currentView==='operations'&&before)trPartialRecord('operations.analytics');"),
  'Se perdió la instrumentación de partial analytics de Operaciones.');
need(structural.includes('trRefreshOpsAnalyticsBase(false);'),
  'Se perdió la delegación Batch 20 del partial render de Operaciones.');

if(fail.length){
  console.error('Operations Analytics Refresh verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Operations Analytics Refresh verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - app.js source refresh implementation: preserved');
console.log(' - build-only contract: current/replace compatibility boundary');
console.log(' - redundant window mirror: absent');
console.log(' - structural analytics instrumentation: contract-bound');
console.log(' - Batch 20 partial refresh(false) delegation: preserved');
