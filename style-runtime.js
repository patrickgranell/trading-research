/* ===== V31.22 RUNTIME · Security Foundation V · Strict Style Boundary Diagnostics ===== */
(()=>{
'use strict';
const TR_STYLE_RUNTIME_VERSION='31.22.0';
const TR_STYLE_APP_LABEL='V31.22 · Strict Style Attribute Boundary';
const TR_STYLE_MAX_BUCKETS=80;
let trStyleObserver=null;
let trStyleStartedAt='';
let trStyleSeenNodes=new WeakSet();
let trStyleStats=null;

function trStyleBlankStats(){return {initialNodes:0,insertedNodes:0,attributeMutations:0,removedAttributes:0,propertyHits:new Map(),scopeHits:new Map(),signatureHits:new Map(),lastMutationAt:'',lastScope:'',lastSignature:''};}
trStyleStats=trStyleBlankStats();
function trStyleMetaInt(name){const el=document.querySelector(`meta[name="${name}"]`),n=Number(el?.content||0);return Number.isFinite(n)?n:0;}
function trStyleSourceBaseline(){return {inlineAttributes:trStyleMetaInt('trading-research-style-source-inline-attrs'),effectiveInlineAttributes:trStyleMetaInt('trading-research-style-effective-inline-attrs'),cssomWrites:trStyleMetaInt('trading-research-style-source-cssom-writes')};}
function trStyleBoundaryDiagnostics(){try{return window.TradingResearchStyleAttrs?.diagnostics?.()||null;}catch(_){return null;}}
function trStyleInc(map,key,amount=1){const k=String(key||'unknown').slice(0,160);if(!map.has(k)&&map.size>=TR_STYLE_MAX_BUCKETS)return;map.set(k,(map.get(k)||0)+amount);}
function trStyleProperties(el){try{return Array.from(el?.style||[]).map(String).filter(Boolean);}catch(_){return [];}}
function trStyleSignature(el){if(!(el instanceof Element))return 'unknown';if(el.id)return `${el.tagName.toLowerCase()}#${String(el.id).slice(0,70)}`;const classes=[...el.classList].slice(0,3).map(x=>String(x).replace(/[^a-zA-Z0-9_-]/g,'')).filter(Boolean);return `${el.tagName.toLowerCase()}${classes.length?'.'+classes.join('.'):''}`;}
function trStyleScope(el){let view='unknown';try{if(typeof currentView!=='undefined'&&currentView)view=String(currentView);}catch(_){/* lexical legacy */}if(el?.closest?.('#modalRoot,.modal-backdrop,.modal'))return `${view} · modal`;if(el?.closest?.('#sidebar,.sidebar,.side'))return `${view} · sidebar`;if(el?.closest?.('#tr-market-body-region,#tr-market-tabs-region,#tr-market-chrome-region'))return 'marketdata · region';return `${view} · view`;}
function trStyleRecordNode(el,kind='inserted'){
  if(!(el instanceof Element)||!el.hasAttribute('style'))return;
  const first=!trStyleSeenNodes.has(el);
  if(first){trStyleSeenNodes.add(el);if(kind==='initial')trStyleStats.initialNodes++;else trStyleStats.insertedNodes++;}
  const props=trStyleProperties(el),scope=trStyleScope(el),sig=trStyleSignature(el);
  for(const p of props)trStyleInc(trStyleStats.propertyHits,p,first?1:0);
  if(first){trStyleInc(trStyleStats.scopeHits,scope);trStyleInc(trStyleStats.signatureHits,sig);}
  trStyleStats.lastScope=scope;trStyleStats.lastSignature=sig;
}
function trStyleScanTree(root,kind='inserted'){
  const valid=root===document||root instanceof Element||root instanceof DocumentFragment;if(!valid)return;
  if(root instanceof Element)trStyleRecordNode(root,kind);
  try{root.querySelectorAll?.('[style]').forEach(el=>trStyleRecordNode(el,kind));}catch(_){/* diagnostics only */}
}
function trStyleMutation(records){
  for(const rec of records){
    if(rec.type==='attributes'&&rec.attributeName==='style'){
      trStyleStats.attributeMutations++;trStyleStats.lastMutationAt=new Date().toISOString();const el=rec.target;
      if(el instanceof Element){if(el.hasAttribute('style')){trStyleRecordNode(el,'inserted');const props=trStyleProperties(el);for(const p of props)trStyleInc(trStyleStats.propertyHits,p);const scope=trStyleScope(el),sig=trStyleSignature(el);trStyleInc(trStyleStats.scopeHits,scope);trStyleInc(trStyleStats.signatureHits,sig);trStyleStats.lastScope=scope;trStyleStats.lastSignature=sig;}else trStyleStats.removedAttributes++;}
    }else if(rec.type==='childList')rec.addedNodes.forEach(node=>trStyleScanTree(node,'inserted'));
  }
}
function trStyleLiveSnapshot(){const nodes=[...document.querySelectorAll('[style]')],props=new Set();nodes.forEach(el=>trStyleProperties(el).forEach(p=>props.add(p)));return {activeNodes:nodes.length,activeProperties:props.size,properties:[...props].sort()};}
function trStyleTop(map,n=6){return [...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n).map(([name,count])=>({name,count}));}
function trStyleDiagnostics(){
  trStyleScanTree(document,'inserted');
  const source=trStyleSourceBaseline(),live=trStyleLiveSnapshot(),boundary=trStyleBoundaryDiagnostics(),csp=window.TradingResearchCSP?.diagnostics?.()||null;
  const ok=source.effectiveInlineAttributes===0&&(boundary?.pending||0)===0&&(boundary?.rejected||0)===0&&csp?.styleAttrNone!==false;
  return {version:TR_STYLE_RUNTIME_VERSION,startedAt:trStyleStartedAt,sourceInlineAttributes:source.inlineAttributes,effectiveInlineAttributes:source.effectiveInlineAttributes,sourceCssomWrites:source.cssomWrites,activeCssomNodes:live.activeNodes,activeCssomProperties:live.activeProperties,propertiesActive:live.properties,nodesSeen:trStyleStats.initialNodes+trStyleStats.insertedNodes,attributeMutations:trStyleStats.attributeMutations,topProperties:trStyleTop(trStyleStats.propertyHits),topScopes:trStyleTop(trStyleStats.scopeHits),topSignatures:trStyleTop(trStyleStats.signatureHits),boundaryHydrated:boundary?.hydrated||0,boundaryDeclarations:boundary?.declarations||0,boundaryRejected:boundary?.rejected||0,boundaryPending:boundary?.pending||0,lastBoundaryProperty:boundary?.lastProperty||'',cspStyleAttrNone:csp?.styleAttrNone??null,strictBoundary:true,ok};
}
function trStyleResetInventory(){trStyleStats=trStyleBlankStats();trStyleSeenNodes=new WeakSet();trStyleStartedAt=new Date().toISOString();trStyleScanTree(document,'initial');try{window.TradingResearchStyleAttrs?.rescan?.();}catch(_){/* diagnostics only */}try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')render();}catch(_){/* diagnostics only */}}
function trStyleRows(rows,empty='Sin actividad observada todavía.'){if(!rows?.length)return `<div class="tr-style-empty">${empty}</div>`;return `<div class="tr-style-list">${rows.map(x=>`<div><code>${esc(x.name)}</code><strong>${x.count}</strong></div>`).join('')}</div>`;}
function trStyleRuntimePanel(){
  const d=trStyleDiagnostics(),mark=v=>`<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Style Boundary · estricto</h3><div class="help">V31.22 mantiene la deuda histórica visible en fuente, pero la build ya no entrega atributos <code>style</code> ejecutables. Los transforma a <code>data-tr-style</code> y un runtime hash-pinned aplica declaraciones validadas mediante CSSOM directo, compatible con <code>style-src-attr 'none'</code>.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Strict boundary</span></div><div class="integrity-kpis"><div><span>Style attrs legacy</span><strong>${d.sourceInlineAttributes}</strong></div><div><span>Style attrs efectivos</span><strong>${d.effectiveInlineAttributes}</strong></div><div><span>Tokens hidratados</span><strong>${d.boundaryHydrated}</strong></div><div><span>Declaraciones aplicadas</span><strong>${d.boundaryDeclarations}</strong></div><div><span>Rechazadas</span><strong class="${d.boundaryRejected?'negative':'positive'}">${d.boundaryRejected}</strong></div><div><span>Pendientes</span><strong class="${d.boundaryPending?'negative':'positive'}">${d.boundaryPending}</strong></div><div><span>CSP style-src-attr</span><strong>${d.cspStyleAttrNone===true?'none':d.cspStyleAttrNone===false?'Revisar':'Comprobando…'}</strong></div><div><span>Estado</span>${mark(d.ok)}</div></div><div class="tr-style-grid"><div><h4>CSSOM observado</h4>${trStyleRows(d.topProperties)}</div><div><h4>Áreas dinámicas</h4>${trStyleRows(d.topScopes)}</div><div><h4>Elementos frecuentes</h4>${trStyleRows(d.topSignatures)}</div></div><div class="notice"><strong>V31.22 · Strict Style Boundary:</strong> <code>style-src-attr 'unsafe-inline'</code> ya no es necesario. Que aparezcan nodos con <code>element.style</code> durante la ejecución no reabre esa excepción: son escrituras CSSOM directas desde scripts locales cuyo hash está autorizado. El criterio de seguridad es <strong>0 style attrs efectivos en la build, 0 tokens rechazados, 0 tokens pendientes y CSP style-src-attr none</strong>.<br><small>Esta fase no modifica cálculos financieros, operaciones, importaciones, sincronización ni persistencia.</small></div><div class="tr-style-actions"><button class="btn small" data-tr-onclick="trStyleResetInventory()">Reiniciar muestra</button><span class="help">Inicio: ${esc(d.startedAt?new Date(d.startedAt).toLocaleTimeString('es-ES'):'—')} · CSSOM activo ahora: ${d.activeCssomNodes} nodo(s), ${d.activeCssomProperties} propiedad(es)</span></div></section>`;
}
function trStyleStart(){if(trStyleObserver)return;trStyleStartedAt=new Date().toISOString();trStyleScanTree(document,'initial');trStyleObserver=new MutationObserver(trStyleMutation);trStyleObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style'],attributeOldValue:true});}

if(typeof dataSecurityPanel==='function'){const trStyleDataSecurityBase=dataSecurityPanel;dataSecurityPanel=function(){return trStyleRuntimePanel()+trStyleDataSecurityBase();};window.dataSecurityPanel=dataSecurityPanel;}
v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.22</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_STYLE_APP_LABEL)}</div><div class="help">Atributos style históricos transformados en build, CSP style-src-attr none y estilos dinámicos aplicados por una frontera CSSOM controlada. Sin cambios en la lógica financiera.</div></div></div></div>`;};
window.TradingResearchStyles=Object.freeze({version:TR_STYLE_RUNTIME_VERSION,diagnostics:trStyleDiagnostics,reset:trStyleResetInventory});
Object.assign(window,{trStyleDiagnostics,trStyleResetInventory,trStyleRuntimePanel});
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=v30ModeCard();}catch(_){/* next render refreshes */}
trStyleStart();
})();
/* ===== END V31.22 STYLE RUNTIME ===== */
