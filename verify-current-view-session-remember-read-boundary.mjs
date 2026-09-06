import fs from 'node:fs';

const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const OLD="function trUiRememberView(){trSessionSet(TR_UI_SESSION_KEY,{currentView,updatedAt:new Date().toISOString()});}";
const NEXT="function trUiRememberView(){trSessionSet(TR_UI_SESSION_KEY,{currentView:globalThis.TradingResearchCurrentViewReadContract.current(),updatedAt:new Date().toISOString()});}";

need(structural.includes(NEXT),
  'trUiRememberView() aún no guarda la vista mediante Current View Read Contract.');
need(!structural.includes(OLD),
  'Persiste la lectura directa currentView dentro de trUiRememberView().');
need(structural.includes("if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))globalThis.TradingResearchCurrentViewSessionRestoreWriteContract.restore(ui.currentView);"),
  'La restauración de currentView cambió fuera de alcance.');
need(structural.includes('globalThis.TradingResearchCurrentViewRouterFallbackWriteContract.toDashboard();'),
  'El fallback de vista desconocida cambió fuera de alcance.');
need(structural.includes("window.addEventListener('beforeunload',()=>{trUiRememberView();trDraftCaptureOperation();});"),
  'El disparador beforeunload para recordar vista/borrador cambió fuera de alcance.');
need(structural.includes('function trRenderViewHtml(view=globalThis.TradingResearchCurrentViewReadContract.current()){'),
  'El consumidor del router de Batch 38 dejó de estar ligado al contrato.');

if(fail.length){
  console.error('Current View Session Remember Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Session Remember Read Boundary verification OK');
console.log(' - trUiRememberView currentView read: contract-bound');
console.log(' - session restore write boundary, router fallback write boundary and beforeunload trigger: preserved');
await import('./verify-current-view-navigation-active-read-boundary.mjs');
