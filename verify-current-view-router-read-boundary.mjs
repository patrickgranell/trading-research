import fs from 'node:fs';
import crypto from 'node:crypto';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const CONTRACT='TradingResearchCurrentViewReadContract';
const EXPECTED_ROUTER_NORMALIZED_SHA256='5ba9ce043fb05775e88503309a7ab667c7f938c2b0e198b0d45470c78f0514ff';

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
need(structural.includes("currentView='dashboard';"),
  'El fallback de vista desconocida dejó de conservar currentView=dashboard.');
need(structural.includes('function trUiRememberView(){trSessionSet(TR_UI_SESSION_KEY,{')&&structural.includes('updatedAt:new Date().toISOString()});}'),
  'La forma de persistencia de la vista UI cambió fuera de alcance.');
need(structural.includes('TradingResearchCurrentViewReadContract.current()'),
  'El consumidor de router de Current View Read Contract desapareció.');

if(fail.length){
  console.error('Current View Router Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Router Read Boundary verification OK');
console.log(` - router normalized SHA256 frozen: ${routerHash}`);
console.log(' - router default currentView read: contract-bound');
console.log(' - session restore/save shape and unknown-view fallback: preserved');
console.log(' - contract is read-only and late-resolved');
await import('./verify-current-view-session-remember-read-boundary.mjs');
