/* ===== V31.23.2 RUNTIME · Source Consolidation · Bundled Render Pruning ===== */
(()=>{
'use strict';
const TR_RENDER_CLOSURE_VERSION='31.23.2';
const TR_RENDER_CLOSURE_LABEL='V31.23.2 · Source Consolidation · Bundled Render Pruning';
const TR_RENDER_SOURCE_DEBT_BUDGET=Object.freeze({sourceRenderAssignments:12,bundledRenderAssignments:0,renderDeclarations:1});
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
    sourceDebtBudget:{...TR_RENDER_SOURCE_DEBT_BUDGET},
    lastAt:trRenderClosureLastAt,
    lastError:trRenderClosureLastError,
    ok
  };
}

function trRenderClosurePanel(){
  const d=trRenderClosureDiagnostics();
  const mark=v=>`<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Canonical Render Closure</h3><div class="help">V31.23.2 elimina del bundle desplegable las 12 reasignaciones históricas de <code>render=function(...)</code>. El archivo fuente legacy todavía conserva esas capas como referencia temporal, pero producción ya carga únicamente el render bootstrap base y la cadena Structural Runtime → State Runtime → Canonical Closure.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Bundled render clean</span></div><div class="integrity-kpis"><div><span>Entrada canónica</span>${mark(d.canonicalEntry)}</div><div><span>Base capturada</span>${mark(d.baseCaptured)}</div><div><span>Legacy en fuente</span><strong>${d.sourceLegacyAssignments}</strong></div><div><span>Legacy en bundle</span><strong class="${d.bundledLegacyAssignments?'negative':'positive'}">${d.bundledLegacyAssignments}</strong></div><div><span>Llamadas</span><strong>${d.calls}</strong></div><div><span>Recuperaciones</span><strong>${d.ownershipRecoveries}</strong></div><div><span>Structural / State</span><strong>${esc(d.structuralRuntime||'—')} / ${esc(d.stateRuntime||'—')}</strong></div><div><span>Estado</span>${mark(d.ok)}</div></div><div class="notice"><strong>V31.23.2 · Bundled Render Pruning:</strong> el build identifica exactamente las 12 reasignaciones legacy, las retira de la copia empaquetada de <code>app.js</code> y falla si el inventario cambia inesperadamente. No se alteran fórmulas financieras, persistencia, imports ni contratos de datos. La siguiente subfase podrá retirar físicamente esta deuda del source una vez validado el comportamiento del bundle limpio.</div>${d.lastError?`<div class="notice danger"><strong>Render closure:</strong> ${esc(d.lastError)}</div>`:''}</section>`;
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
  v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.23.2</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_RENDER_CLOSURE_LABEL)}</div><div class="help">Las 12 reasignaciones históricas de render ya no forman parte del bundle desplegable. El runtime activo queda reducido a bootstrap + Structural Runtime + State guard + Canonical Closure.</div></div></div></div>`;};
}

trRenderClosureEnsureOwnership();
queueMicrotask(trRenderClosureEnsureOwnership);
try{const side=document.querySelector('.side-bottom');if(side&&typeof v30ModeCard==='function')side.outerHTML=v30ModeCard();}catch(_){/* diagnostics remain available */}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>window.render(),0);}catch(_){/* no forced render outside Datos y seguridad */}
})();
/* ===== END V31.23.2 RENDER CLOSURE RUNTIME ===== */
