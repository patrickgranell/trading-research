/* ===== V31.23.1 RUNTIME · Source Consolidation · Canonical Render Closure ===== */
(()=>{
'use strict';
const TR_RENDER_CLOSURE_VERSION='31.23.1';
const TR_RENDER_CLOSURE_LABEL='V31.23.1 · Source Consolidation · Canonical Render Closure';
const TR_RENDER_SOURCE_DEBT_BUDGET=Object.freeze({renderAssignmentsMax:24,renderDeclarationsMax:1});
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
  const ok=canonicalEntry&&baseCaptured&&!!structuralRuntime&&!!stateRuntime&&!trRenderClosureLastError;
  return {
    version:TR_RENDER_CLOSURE_VERSION,
    canonicalEntry,
    baseCaptured,
    structuralRuntime,
    stateRuntime,
    calls:trRenderClosureCalls,
    ownershipRecoveries:trRenderClosureOwnershipRecoveries,
    sourceDebtBudget:{...TR_RENDER_SOURCE_DEBT_BUDGET},
    lastAt:trRenderClosureLastAt,
    lastError:trRenderClosureLastError,
    ok
  };
}

function trRenderClosurePanel(){
  const d=trRenderClosureDiagnostics();
  const mark=v=>`<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Canonical Render Closure</h3><div class="help">V31.23.1 fija un único punto de entrada global después de Structural Runtime + State Runtime. Las definiciones históricas de <code>render()</code> de app.js quedan como deuda de fuente acotada por verificación, no como coordinadores de producción.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Canonical render</span></div><div class="integrity-kpis"><div><span>Entrada canónica</span>${mark(d.canonicalEntry)}</div><div><span>Base capturada</span>${mark(d.baseCaptured)}</div><div><span>Structural runtime</span><strong>${esc(d.structuralRuntime||'—')}</strong></div><div><span>State runtime</span><strong>${esc(d.stateRuntime||'—')}</strong></div><div><span>Llamadas</span><strong>${d.calls}</strong></div><div><span>Recuperaciones</span><strong>${d.ownershipRecoveries}</strong></div><div><span>Budget legacy</span><strong>≤ ${d.sourceDebtBudget.renderAssignmentsMax+d.sourceDebtBudget.renderDeclarationsMax}</strong></div><div><span>Estado</span>${mark(d.ok)}</div></div><div class="notice"><strong>V31.23.1 · Canonical Render Closure:</strong> el entry point final se captura después de todas las capas validadas y se publica como <code>TradingResearchRender.render</code>. El verifier impide aumentar de nuevo la deuda histórica de render antes de empezar a retirarla por bloques. Esta fase no modifica cálculos financieros, persistencia, imports ni contratos de datos.</div>${d.lastError?`<div class="notice danger"><strong>Render closure:</strong> ${esc(d.lastError)}</div>`:''}</section>`;
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
  v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.23.1</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_RENDER_CLOSURE_LABEL)}</div><div class="help">Entry point de render canónico cerrado después de los runtimes estructural y de estado. La deuda legacy de app.js queda acotada y será retirada incrementalmente sin tocar la lógica financiera.</div></div></div></div>`;};
}

trRenderClosureEnsureOwnership();
queueMicrotask(trRenderClosureEnsureOwnership);
try{const side=document.querySelector('.side-bottom');if(side&&typeof v30ModeCard==='function')side.outerHTML=v30ModeCard();}catch(_){/* diagnostics remain available */}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>window.render(),0);}catch(_){/* no forced render outside Datos y seguridad */}
})();
/* ===== END V31.23.1 RENDER CLOSURE RUNTIME ===== */
