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
const MAX_RUNTIME_NAME_OVERLAP=188;
const CONTRACT='TradingResearchReportBuilderViewContract';
const LEGACY='v313BuilderView';

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
  `El solapamiento app/runtime de Batch 25 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes('function v313BuilderView(){'),
  'app.js ya no conserva la implementación fuente de v313BuilderView.');
need(app.includes('const toolbar=`<div class="report-builder-toolbar">'),
  'La implementación fuente auditada del Report Builder cambió; Batch 25 solo puede cambiar la frontera runtime/build.');
need(!new RegExp(`\\b${LEGACY}\\b`).test(reports),
  'reports-purity-runtime.js todavía nombra directamente v313BuilderView.');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Report Builder View Contract.');
need(bundledAppStage.includes('current:()=>v313BuilderView'),
  'Report Builder View Contract no captura el binding actual.');
need(bundledAppStage.includes('replace:fn=>{v313BuilderView=fn;}'),
  'Report Builder View Contract no reemplaza el binding clásico.');
need(!bundledAppStage.includes('window.v313BuilderView=fn'),
  'Report Builder View Contract reintroduce un mirror window redundante.');
need(reports.includes(`const trReportBuilderViewContract=globalThis.${CONTRACT};`),
  'Reports Purity no resuelve Report Builder View Contract.');
need(reports.includes('let trReportBuilderView=trReportBuilderViewContract.current();'),
  'Reports Purity no captura el builder base mediante contrato.');
need(reports.includes('trReportBuilderViewContract.replace(trReportBuilderView);'),
  'Reports Purity no publica el builder puro mediante contrato.');
need(reports.includes('const p=globalThis.TradingResearchPlanReadContract.current(),presets=trReportNormalizedPresets(p);'),
  'Se perdió la lectura normalizada de plan/presets del builder.');
need(reports.includes('${trReportScopeControls(p)}'),
  'El builder dejó de consumir los scope controls locales puros.');
need(reports.includes('TradingResearchReportsSectionPresentationContract.controls()'),
  'El builder dejó de consumir los controles de secciones del contrato de Reports.');
need(reports.includes("data-tr-onclick=\"v313SavePresetPrompt()\""),
  'Se perdió la acción Guardar plantilla del builder.');
need(reports.includes("data-tr-onclick=\"v313PrintReport()\""),
  'Se perdió la acción Imprimir / PDF del builder.');
need(
  reports.includes('return `${toolbar}${presetPanel}${v313ReportDocument()}`;')||
  reports.includes('return `${toolbar}${presetPanel}${trReportDocument()}`;'),
  'El builder dejó de ensamblar toolbar + presets + documento con la semántica existente.'
);

if(fail.length){
  console.error('Report Builder View verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Report Builder View verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - app.js source builder implementation: preserved');
console.log(' - Reports Purity builder: contract-bound and presentation-only');
console.log(' - toolbar/presets/report document composition: preserved');

await import('./verify-report-document-presentation.mjs');
