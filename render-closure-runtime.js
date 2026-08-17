/* ===== V31.23.5 RUNTIME · Source Consolidation · Runtime Namespace Pruning ===== */
(()=>{
'use strict';
const TR_RENDER_CLOSURE_VERSION='31.23.5';
const TR_RENDER_CLOSURE_LABEL='V31.23.5 · Source Consolidation · Runtime Namespace Pruning';
const TR_RENDER_SOURCE_DEBT_BUDGET=Object.freeze({sourceRenderAssignments:12,bundledRenderAssignments:0,sourceRenderBaseAliases:5,bundledRenderBaseAliases:0,renderDeclarations:1});
const trRenderClosureBase=window.render;
let trRenderClosureCalls=0;
let trRenderClosureOwnershipRecoveries=0;
let trRenderClosureLastAt='';
let trRenderClosureLastError='';
function trCanonicalRenderEntry(...args){trRenderClosureCalls++;trRenderClosureLastAt=new Date().toISOString();try{return trRenderClosureBase.apply(this,args);}catch(e){trRenderClosureLastError=e?.message||String(e);throw e;}}
Object.defineProperty(trCanonicalRenderEntry,'__trCanonicalRenderEntry',{value:true});
Object.defineProperty(trCanonicalRenderEntry,'__trCanonicalRenderBase',{value:trRenderClosureBase});
function trRenderClosureEnsureOwnership(){if(window.render!==trCanonicalRenderEntry){trRenderClosureOwnershipRecoveries++;window.render=trCanonicalRenderEntry;}return window.render===trCanonicalRenderEntry;}
window.render=trCanonicalRenderEntry;
function trRenderClosureDiagnostics(){
  const structural=typeof trRenderDiagnostics==='function'?trRenderDiagnostics():null,stores=window.TradingResearchStores?.diagnostics?.()||null,canonicalEntry=window.render===trCanonicalRenderEntry,baseCaptured=typeof trRenderClosureBase==='function'&&trRenderClosureBase!==trCanonicalRenderEntry,structuralRuntime=String(structural?.runtime||''),stateRuntime=String(stores?.runtime||''),sourceLegacy=Number(document.querySelector('meta[name="trading-research-render-source-legacy-assignments"]')?.content||12),bundledLegacy=Number(document.querySelector('meta[name="trading-research-render-bundled-legacy-assignments"]')?.content||0),ok=canonicalEntry&&baseCaptured&&!!structuralRuntime&&!!stateRuntime&&bundledLegacy===0&&!trRenderClosureLastError;
  return {version:TR_RENDER_CLOSURE_VERSION,canonicalEntry,baseCaptured,structuralRuntime,stateRuntime,calls:trRenderClosureCalls,ownershipRecoveries:trRenderClosureOwnershipRecoveries,sourceLegacyAssignments:sourceLegacy,bundledLegacyAssignments:bundledLegacy,sourceRenderBaseAliases:5,bundledRenderBaseAliases:0,sourceDebtBudget:{...TR_RENDER_SOURCE_DEBT_BUDGET},lastAt:trRenderClosureLastAt,lastError:trRenderClosureLastError,ok};
}
function trRenderClosurePanel(){
  const d=trRenderClosureDiagnostics(),mark=v=>`<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Canonical Render Closure</h3><div class="help">V31.23.5 mantiene fuera del bundle las 12 reasignaciones históricas de <code>render=function(...)</code>, elimina los cinco aliases <code>renderV*Base</code> muertos y empieza a reducir aliases diagnósticos duplicados en <code>window</code>.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Runtime namespace pruning</span></div><div class="integrity-kpis"><div><span>Entrada canónica</span>${mark(d.canonicalEntry)}</div><div><span>Legacy fuente / bundle</span><strong>${d.sourceLegacyAssignments} / <span class="positive">${d.bundledLegacyAssignments}</span></strong></div><div><span>renderV*Base</span><strong>${d.sourceRenderBaseAliases} → ${d.bundledRenderBaseAliases}</strong></div><div><span>Root writes bundle</span><strong>1 bootstrap</strong></div><div><span>Llamadas runtime</span><strong>${d.calls}</strong></div><div><span>Recuperaciones</span><strong>${d.ownershipRecoveries}</strong></div><div><span>Structural / State</span><strong>${esc(d.structuralRuntime||'—')} / ${esc(d.stateRuntime||'—')}</strong></div><div><span>Estado</span>${mark(d.ok)}</div></div><div class="notice"><strong>V31.23.5 · Runtime Namespace Pruning:</strong> los contratos públicos de diagnóstico se mantienen en objetos <code>TradingResearch*</code>; los aliases duplicados de funciones internas empiezan a desaparecer del objeto global. No se modifican fórmulas financieras, persistencia, imports ni contratos de datos.</div>${d.lastError?`<div class="notice danger"><strong>Render closure:</strong> ${esc(d.lastError)}</div>`:''}</section>`;
}
const TradingResearchRender=Object.freeze({version:TR_RENDER_CLOSURE_VERSION,label:TR_RENDER_CLOSURE_LABEL,render:trCanonicalRenderEntry,ensureOwnership:trRenderClosureEnsureOwnership,diagnostics:trRenderClosureDiagnostics,sourceDebtBudget:TR_RENDER_SOURCE_DEBT_BUDGET});
/* V31.23.5: one namespaced public render API; duplicate diagnostic aliases removed. */
window.TradingResearchRender=TradingResearchRender;
if(typeof dataSecurityPanel==='function'){const trRenderClosureDataSecurityBase=dataSecurityPanel;dataSecurityPanel=function(){return trRenderClosurePanel()+trRenderClosureDataSecurityBase();};}
if(typeof v30ModeCard==='function')v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.23.5</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_RENDER_CLOSURE_LABEL)}</div><div class="help">Render consolidado + primera poda real de aliases globales redundantes. Los diagnósticos públicos permanecen accesibles mediante APIs TradingResearch*.</div></div></div></div>`;};
trRenderClosureEnsureOwnership();queueMicrotask(trRenderClosureEnsureOwnership);
try{const side=document.querySelector('.side-bottom');if(side&&typeof v30ModeCard==='function')side.outerHTML=v30ModeCard();}catch(_){}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>window.render(),0);}catch(_){}
})();
/* ===== END V31.23.5 RENDER CLOSURE RUNTIME ===== */