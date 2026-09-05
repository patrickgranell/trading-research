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
const MAX_RUNTIME_NAME_OVERLAP=187;
const CONTRACT='TradingResearchReportDocumentContract';
const LEGACY='v313ReportDocument';

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
  `El solapamiento app/runtime de Batch 26 no cerró: ${overlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);
need(app.includes('function v313ReportDocument(){'),
  'app.js ya no conserva la implementación fuente de v313ReportDocument.');
need(app.includes("const ops=v313ReportOps(),s=calcMetricStats(ops,reportsViewState.unit,reportsViewState.basis),sec=reportsViewState.sections"),
  'La implementación fuente auditada del documento cambió su pipeline de dataset/métricas.');
need(!new RegExp(`\\b${LEGACY}\\b`).test(reports),
  'reports-purity-runtime.js todavía nombra directamente v313ReportDocument.');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Report Document Contract.');
need(bundledAppStage.includes('current:()=>v313ReportDocument'),
  'Report Document Contract no captura el binding actual.');
need(bundledAppStage.includes('replace:fn=>{v313ReportDocument=fn;}'),
  'Report Document Contract no reemplaza el binding clásico.');
need(!bundledAppStage.includes('window.v313ReportDocument=fn'),
  'Report Document Contract reintroduce un mirror window redundante.');
need(reports.includes(`const trReportDocumentContract=globalThis.${CONTRACT};`),
  'Reports Purity no resuelve Report Document Contract.');
need(reports.includes('let trReportDocument=trReportDocumentContract.current();'),
  'Reports Purity no captura el documento base mediante contrato.');
need(reports.includes('trReportDocumentContract.replace(trReportDocument);'),
  'Reports Purity no publica el documento mediante contrato.');
need(reports.includes('const ops=v313ReportOps(),s=calcMetricStats(ops,reportsViewState.unit,reportsViewState.basis),sec=reportsViewState.sections'),
  'El wrapper de presentación cambió el pipeline de dataset/métricas existente.');
need(reports.includes('TradingResearchReportsSectionPresentationContract.summary(p,ops,s)'),
  'Se perdió la sección summary del documento.');
need(reports.includes('TradingResearchReportsSectionPresentationContract.confidence(ops,s)'),
  'Se perdió la sección confidence del documento.');
need(reports.includes('TradingResearchReportsSectionPresentationContract.process(p,ops)'),
  'Se perdió la sección process del documento.');
need(reports.includes('TradingResearchReportsSectionPresentationContract.quality(p,ops)'),
  'Se perdió la sección quality del documento.');
need(reports.includes('TradingResearchReportsSectionPresentationContract.breakdowns(ops)'),
  'Se perdió la sección breakdowns del documento.');
need(reports.includes('${sec.reviewsGoals?v313ReportReviewsGoals(p):\'\'}'),
  'Se perdió la composición Reviews & objetivos existente.');
need(reports.includes('return `${toolbar}${presetPanel}${trReportDocument()}`;'),
  'El builder no consume el documento mediante el binding local contractual.');

if(fail.length){
  console.error('Report Document Presentation verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Report Document Presentation verification OK');
console.log(` - runtime name-overlap proxy: ${overlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
console.log(' - app.js source document implementation: preserved');
console.log(' - dataset + canonical metric call: preserved');
console.log(' - report sections + builder composition: contract-bound');

await import('./verify-diagnostics-presentation-chain.mjs');
