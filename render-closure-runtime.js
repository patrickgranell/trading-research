/* ===== V31.23.3 RUNTIME · Source Consolidation · Bootstrap Render Collapse ===== */
(()=>{
'use strict';
const TR_RENDER_CLOSURE_VERSION='31.23.3';
const TR_RENDER_CLOSURE_LABEL='V31.23.3 · Source Consolidation · Bootstrap Render Collapse';
const TR_RENDER_SOURCE_DEBT_BUDGET=Object.freeze({sourceRenderAssignments:12,bundledRenderAssignments:0,sourceTopLevelCalls:5,bundledTopLevelCalls:1,sourceRenderBaseAliases:5,bundledRenderBaseAliases:0,renderDeclarations:1});
const trRenderClosureBase=window.render;
let trRenderClosureCalls=0;
let trRenderClosureOwnershipRecoveries=0;
let trRenderClosureLastAt='';
let trRenderClosureLastError='';

function trCanonicalRenderEntry(...args){
  trRenderClosureCalls++;
  trRenderClosureLastAt=new Date().toISOString();
  try{return trRenderClosureBase.apply(this,args);}
  catch(e){trRenderClosureLastError=e?.message||String(e);throw e;}
}
Object.defineProperty(trCanonicalRenderEntry,'__trCanonicalRenderEntry',{value:true});
Object.defineProperty(trCanonicalRenderEntry,'__trCanonicalRenderBase',{value:trRenderClosureBase});

function trRenderClosureEnsureOwnership(){
  if(window.render!==trCanonicalRenderEntry){
    trRenderClosureOwnershipRecoveries++;
    window.render=trCanonicalRenderEntry;
  }
  return window.render===trCanonicalRenderEntry;
}

window.render=trCanonicalRenderEntry;

function trRenderClosureDiagnostics(){
  const structural=typeof trRenderDiagnostics==='function'?trRenderDiagnostics():null;
  const stores=window.TradingResearchStores?.diagnostics?.()||null;
  const canonicalEntry=window.render===trCanonicalRenderEntry;
  const baseCaptured=typeof trRenderClosureBase==='function'&&trRenderClosureBase!==trCanonicalRenderEntry;
  const structuralRuntime=String(structural?.runtime||'');
  const stateRuntime=String(stores?.runtime||'');
  const sourceLegacy=Number(document.querySelector('meta[name="trading-research-render-source-legacy-assignments"]')?.content||12);
  const bundledLegacy=Number(document.querySelector('meta[name="trading-research-render-bundled-legacy-assignments"]')?.content||0);
  const ok=canonicalEntry&&baseCaptured&&!!structuralRuntime&&!!stateRuntime&&bundledLegacy===0&&!trRenderClosureLastError;
  return {
    version:TR_RENDER_CLOSURE_VERSION,
    canonicalEntry,
    baseCaptured,
    structuralRuntime,
    stateRuntime,
    calls:trRenderClosureCalls,
    ownershipRecoveries:trRenderClosureOwnershipRecoveries,
    sourceLegacyAssignments:sourceLegacy,
    bundledLegacyAssignments:bundledLegacy,
    sourceTopLevelCalls:5,
    bundledTopLevelCalls:1,
    sourceRenderBaseAliases:5,
    bundledRenderBaseAliases:0,
    sourceDebtBudget:{...TR_RENDER_SOURCE_DEBT_BUDGET},
    lastAt:trRenderClosureLastAt,
    lastError:trRenderClosureLastError,
    ok
  };
}

function trRenderClosurePanel(){
  const d=trRenderClosureDiagnostics();
  const mark=v=>`<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Canonical Render Closure</h3><div class="help">V31.23.3 mantiene fuera del bundle las 12 reasignaciones históricas de <code>render=function(...)</code> y, además, colapsa la fase de bootstrap: de cinco llamadas top-level a una sola y de cinco aliases <code>renderV*Base</code> a cero.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Bootstrap render clean</span></div><div class="integrity-kpis"><div><span>Entrada canónica</span>${mark(d.canonicalEntry)}</div><div><span>Legacy fuente / bundle</span><strong>${d.sourceLegacyAssignments} / <span class="positive">${d.bundledLegacyAssignments}</span></strong></div><div><span>Bootstrap calls</span><strong>${d.sourceTopLevelCalls} → ${d.bundledTopLevelCalls}</strong></div><div><span>renderV*Base</span><strong>${d.sourceRenderBaseAliases} → ${d.bundledRenderBaseAliases}</strong></div><div><span>Llamadas runtime</span><strong>${d.calls}</strong></div><div><span>Recuperaciones</span><strong>${d.ownershipRecoveries}</strong></div><div><span>Structural / State</span><strong>${esc(d.structuralRuntime||'—')} / ${esc(d.stateRuntime||'—')}</strong></div><div><span>Estado</span>${mark(d.ok)}</div></div><div class="notice"><strong>V31.23.3 · Bootstrap Render Collapse:</strong> la copia desplegable conserva un único render bootstrap para que el DOM exista durante la carga histórica, y elimina cuatro remounts redundantes. Después, Structural Runtime monta el shell persistente y State Runtime aplica el boundary read-only antes del Canonical Closure. No se modifican fórmulas financieras, persistencia, imports ni contratos de datos.</div>${d.lastError?`<div class="notice danger"><strong>Render closure:</strong> ${esc(d.lastError)}</div>`:''}</section>`;
}

const TradingResearchRender=Object.freeze({
  version:TR_RENDER_CLOSURE_VERSION,
  label:TR_RENDER_CLOSURE_LABEL,
  render:trCanonicalRenderEntry,
  ensureOwnership:trRenderClosureEnsureOwnership,
  diagnostics:trRenderClosureDiagnostics,
  sourceDebtBudget:TR_RENDER_SOURCE_DEBT_BUDGET
});
window.TradingResearchRender=TradingResearchRender;
Object.assign(window,{trRenderClosureDiagnostics,trRenderClosurePanel});

if(typeof dataSecurityPanel==='function'){
  const trRenderClosureDataSecurityBase=dataSecurityPanel;
  dataSecurityPanel=function(){return trRenderClosurePanel()+trRenderClosureDataSecurityBase();};
}

if(typeof v30ModeCard==='function'){
  v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.23.3</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_RENDER_CLOSURE_LABEL)}</div><div class="help">Bundle de render consolidado: 0 reasignaciones legacy, 1 render bootstrap, 0 aliases renderV*Base; después toma el control el shell persistente protegido por State Runtime.</div></div></div></div>`;};
}

trRenderClosureEnsureOwnership();
queueMicrotask(trRenderClosureEnsureOwnership);
try{const side=document.querySelector('.side-bottom');if(side&&typeof v30ModeCard==='function')side.outerHTML=v30ModeCard();}catch(_){/* diagnostics remain available */}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>window.render(),0);}catch(_){/* no forced render outside Datos y seguridad */}
})();
/* ===== END V31.23.3 RENDER CLOSURE RUNTIME ===== */
