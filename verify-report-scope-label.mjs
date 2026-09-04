import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const reports=fs.readFileSync('reports-purity-runtime.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const MAX_RUNTIME_NAME_OVERLAP=190;
const CONTRACT='TradingResearchReportScopeLabelContract';
const LEGACY='v313ReportScopeLabel';

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
  `El solapamiento app/runtime de Batch 23 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes('function v313ReportScopeLabel(p=getCurrentPlan()){'),
  'app.js ya no conserva la implementación fuente de v313ReportScopeLabel.');
need(app.includes("if(s==='study'){v313EnsureReportPresets(p);ensurePlanStudies(p);"),
  'La implementación fuente auditada de scope label cambió; Batch 23 solo puede cambiar la frontera runtime/build.');
need(!new RegExp(`\\b${LEGACY}\\b`).test(reports),
  'reports-purity-runtime.js todavía nombra directamente v313ReportScopeLabel.');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Report Scope Label Contract.');
need(bundledAppStage.includes('current:()=>v313ReportScopeLabel'),
  'Report Scope Label Contract no captura el binding actual.');
need(bundledAppStage.includes('replace:fn=>{v313ReportScopeLabel=fn;}'),
  'Report Scope Label Contract no reemplaza el binding clásico.');
need(!bundledAppStage.includes('window.v313ReportScopeLabel=fn'),
  'Report Scope Label Contract reintroduce un mirror window redundante.');
need(reports.includes(`const trReportScopeLabelContract=globalThis.${CONTRACT};`),
  'Reports Purity no resuelve Report Scope Label Contract.');
need(reports.includes('let trReportScopeLabel=trReportScopeLabelContract.current();'),
  'Reports Purity no captura el scope label base mediante contrato.');
need(reports.includes('trReportScopeLabelContract.replace(trReportScopeLabel);'),
  'Reports Purity no publica el scope label puro mediante contrato.');
need(reports.includes("if(s==='last20')return 'Últimas 20 operaciones';"),
  'Se perdió la semántica de scope last20.');
need(/if\(s==='study'\)\s*\{\s*const st=trReportSavedStudies\(p\)\.find\(x=>x\.id===reportsViewState\.studyId\);/.test(reports),
  'Se perdió la lectura pura de scope study.');
need(reports.includes("if(s==='date')return `${reportsViewState.dateFrom||'inicio'} → ${reportsViewState.dateTo||'fin'}`;"),
  'Se perdió la semántica de scope date.');
need(reports.includes('globalThis.TradingResearchContentEncodingContract.html(trReportScopeLabel(p))'),
  'Report Document no consume el scope label local puro.');

if(fail.length){
  console.error('Report Scope Label verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Report Scope Label verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - app.js source scope-label implementation: preserved');
console.log(' - Reports Purity scope label: contract-bound and read-only');
console.log(' - last20/block/study/date/full labels: preserved');

await import('./verify-report-scope-controls.mjs');
