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
const MAX_RUNTIME_NAME_OVERLAP=189;
const CONTRACT='TradingResearchReportScopeControlsContract';
const LEGACY='v313ScopeControls';

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
  `El solapamiento app/runtime de Batch 24 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes('function v313ScopeControls(p){'),
  'app.js ya no conserva la implementación fuente de v313ScopeControls.');
need(app.includes("ensurePlanStudies(p);const blocks=Math.max(1,Math.ceil(currentOps().length/20));"),
  'La implementación fuente auditada de scope controls cambió; Batch 24 solo puede cambiar la frontera runtime/build.');
need(!new RegExp(`\\b${LEGACY}\\b`).test(reports),
  'reports-purity-runtime.js todavía nombra directamente v313ScopeControls.');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Report Scope Controls Contract.');
need(bundledAppStage.includes('current:()=>v313ScopeControls'),
  'Report Scope Controls Contract no captura el binding actual.');
need(bundledAppStage.includes('replace:fn=>{v313ScopeControls=fn;}'),
  'Report Scope Controls Contract no reemplaza el binding clásico.');
need(!bundledAppStage.includes('window.v313ScopeControls=fn'),
  'Report Scope Controls Contract reintroduce un mirror window redundante.');
need(reports.includes(`const trReportScopeControlsContract=globalThis.${CONTRACT};`),
  'Reports Purity no resuelve Report Scope Controls Contract.');
need(reports.includes('let trReportScopeControls=trReportScopeControlsContract.current();'),
  'Reports Purity no captura los scope controls base mediante contrato.');
need(reports.includes('trReportScopeControlsContract.replace(trReportScopeControls);'),
  'Reports Purity no publica los scope controls puros mediante contrato.');
need(reports.includes("if(reportsViewState.scope==='block')extra="),
  'Se perdió la presentación del selector de Bloque.');
need(reports.includes("if(reportsViewState.scope==='date')extra="),
  'Se perdió la presentación del rango de fechas.');
need(reports.includes("if(reportsViewState.scope==='study')extra="),
  'Se perdió la presentación del selector de estudio guardado.');
need(reports.includes("[['full','Plan completo'],['last20','Últimas 20'],['last50','Últimas 50'],['last100','Últimas 100'],['month','Mes actual'],['block','Bloque'],['study','Estudio guardado'],['date','Rango de fechas']]"),
  'Se perdió el inventario de opciones de alcance.');
need(reports.includes('${trReportScopeControls(p)}'),
  'Builder View no consume los scope controls locales puros.');

if(fail.length){
  console.error('Report Scope Controls verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Report Scope Controls verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - app.js source scope-controls implementation: preserved');
console.log(' - Reports Purity scope controls: contract-bound and read-only');
console.log(' - full/last20/last50/last100/month/block/study/date options: preserved');

await import('./verify-report-builder-view.mjs');
