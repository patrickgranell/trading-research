import fs from 'node:fs';
import crypto from 'node:crypto';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const CONTRACT='TradingResearchCurrentViewReadContract';
const EXPECTED_ROUTER_NORMALIZED_SHA256='20e7fa077957b6b85634ab04ac520f147be154ab8a2248f4171c7bb00f4ba5bb';

function sliceBetween(source,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  if(start<0)return '';
  const end=source.indexOf(endMarker,start+startMarker.length);
  return end>=0?source.slice(start,end):'';
}
function sha(source){return source?crypto.createHash('sha256').update(source).digest('hex'):'';}

const routerSource=sliceBetween(structural,'function trRenderViewHtml(', '\nfunction trRenderEditable(');
const routerLines=routerSource.split('\n');
if(routerLines.length)routerLines[0]='function trRenderViewHtml(<CURRENT_VIEW_READ>){';
const routerNormalized=routerLines.join('\n');
const routerHash=sha(routerNormalized);
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(routerSource.length>0,'No se pudo localizar trRenderViewHtml().');
need(routerHash===EXPECTED_ROUTER_NORMALIZED_SHA256,
  `El cuerpo normalizado de trRenderViewHtml() cambió: ${routerHash}; esperado ${EXPECTED_ROUTER_NORMALIZED_SHA256}.`);
need(structural.includes('function trRenderViewHtml(view=globalThis.TradingResearchCurrentViewReadContract.current()){'),
  'El router aún no obtiene su vista por defecto mediante Current View Read Contract.');
need(!structural.includes('function trRenderViewHtml(view=currentView){'),
  'Persiste la lectura directa currentView en el parámetro por defecto del router.');
need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${CONTRACT}'`),
  'El build transform no publica Current View Read Contract.');
need(bundledAppStage.includes('current:()=>currentView'),
  'Current View Read Contract no usa la lectura tardía exacta current:()=>currentView.');
need(!/TradingResearchCurrentViewReadContract[\s\S]{0,180}\bset\s*:/.test(bundledAppStage),
  'Current View Read Contract no debe exponer mutación.');
need(structural.includes("if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))globalThis.TradingResearchCurrentViewSessionRestoreWriteContract.restore(ui.currentView);"),
  'La restauración de currentView desde sesión cambió fuera de alcance.');
need(structural.includes('globalThis.TradingResearchCurrentViewRouterFallbackWriteContract.toDashboard();'),
  'El fallback de vista desconocida dejó de conservar Dashboard mediante Router Fallback Write Contract.');
need(structural.includes('function trUiRememberView(){trSessionSet(TR_UI_SESSION_KEY,{')&&structural.includes('updatedAt:new Date().toISOString()});}'),
  'La forma de persistencia de la vista UI cambió fuera de alcance.');
need(structural.includes('TradingResearchCurrentViewReadContract.current()'),
  'El consumidor de router de Current View Read Contract desapareció.');
need(structural.includes("case 'journalstatements':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderStatements();"),
  'El router no conserva la nueva vista Dejar constancia del Diario emocional.');
need(structural.includes("case 'journalconfidence':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderConfidence();"),
  'El router no conserva la vista Confianza del Diario emocional.');
need(structural.includes("case 'journalstreaks':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderStreaks();"),
  'El router no conserva la vista Rachas y adaptación del Diario emocional.');
need(structural.includes("case 'journaldrift':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderDrift();"),
  'El router no conserva la vista Deriva conductual del Diario emocional.');
need(structural.includes("case 'journalreflections':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderReflections();"),
  'El router no conserva la vista Reflexiones del Diario emocional.');
need(structural.includes("case 'journallibrary':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderLibrary();"),
  'El router no conserva la vista Biblioteca personal del Diario emocional.');

if(fail.length){
  console.error('Current View Router Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Router Read Boundary verification OK');
console.log(` - router normalized SHA256 frozen: ${routerHash}`);
console.log(' - router default currentView read: contract-bound');
console.log(' - session restore/save shape and unknown-view fallback write boundary: preserved');
console.log(' - contract is read-only and late-resolved');
await import('./verify-current-view-session-remember-read-boundary.mjs');
