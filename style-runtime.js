/* ===== V31.21 RUNTIME · Security Foundation IV · Style Boundary Inventory ===== */
(()=>{
'use strict';
const TR_STYLE_RUNTIME_VERSION='31.21.0';
const TR_STYLE_APP_LABEL='V31.21 · Security Foundation IV · Style Boundary Inventory';
const TR_STYLE_MAX_BUCKETS=80;
let trStyleObserver=null;
let trStyleStartedAt='';
let trStyleSeenNodes=new WeakSet();
let trStyleStats=null;

function trStyleBlankStats(){
  return {
    initialNodes:0,
    insertedNodes:0,
    attributeMutations:0,
    removedAttributes:0,
    propertyHits:new Map(),
    scopeHits:new Map(),
    signatureHits:new Map(),
    lastMutationAt:'',
    lastScope:'',
    lastSignature:''
  };
}
trStyleStats=trStyleBlankStats();

function trStyleMetaInt(name){
  const el=document.querySelector(`meta[name="${name}"]`);
  const n=Number(el?.content||0);
  return Number.isFinite(n)?n:0;
}
function trStyleSourceBaseline(){
  return {
    inlineAttributes:trStyleMetaInt('trading-research-style-source-inline-attrs'),
    cssomWrites:trStyleMetaInt('trading-research-style-source-cssom-writes')
  };
}
function trStyleInc(map,key,amount=1){
  const k=String(key||'unknown').slice(0,160);
  if(!map.has(k)&&map.size>=TR_STYLE_MAX_BUCKETS)return;
  map.set(k,(map.get(k)||0)+amount);
}
function trStyleProperties(el){
  try{return Array.from(el?.style||[]).map(String).filter(Boolean);}catch(_){return [];}
}
function trStyleSignature(el){
  if(!(el instanceof Element))return 'unknown';
  if(el.id)return `${el.tagName.toLowerCase()}#${String(el.id).slice(0,70)}`;
  const classes=[...el.classList].slice(0,3).map(x=>String(x).replace(/[^a-zA-Z0-9_-]/g,'')).filter(Boolean);
  return `${el.tagName.toLowerCase()}${classes.length?'.'+classes.join('.'):''}`;
}
function trStyleScope(el){
  let view='unknown';
  try{if(typeof currentView!=='undefined'&&currentView)view=String(currentView);}catch(_){/* lexical legacy */}
  if(el?.closest?.('#modalRoot,.modal-backdrop,.modal'))return `${view} · modal`;
  if(el?.closest?.('#sidebar,.sidebar,.side'))return `${view} · sidebar`;
  if(el?.closest?.('#tr-market-body-region,#tr-market-tabs-region,#tr-market-chrome-region'))return 'marketdata · region';
  return `${view} · view`;
}
function trStyleRecordNode(el,kind='inserted'){
  if(!(el instanceof Element)||!el.hasAttribute('style'))return;
  const first=!trStyleSeenNodes.has(el);
  if(first){
    trStyleSeenNodes.add(el);
    if(kind==='initial')trStyleStats.initialNodes++;
    else trStyleStats.insertedNodes++;
  }
  const props=trStyleProperties(el);
  const scope=trStyleScope(el),sig=trStyleSignature(el);
  for(const p of props)trStyleInc(trStyleStats.propertyHits,p,first?1:0);
  if(first){trStyleInc(trStyleStats.scopeHits,scope);trStyleInc(trStyleStats.signatureHits,sig);}
  trStyleStats.lastScope=scope;trStyleStats.lastSignature=sig;
}
function trStyleScanTree(root,kind='inserted'){
  if(!(root instanceof Element)&&root!==document)return;
  if(root instanceof Element)trStyleRecordNode(root,kind);
  try{root.querySelectorAll?.('[style]').forEach(el=>trStyleRecordNode(el,kind));}catch(_){/* diagnostics only */}
}
function trStyleMutation(records){
  for(const rec of records){
    if(rec.type==='attributes'&&rec.attributeName==='style'){
      trStyleStats.attributeMutations++;
      trStyleStats.lastMutationAt=new Date().toISOString();
      const el=rec.target;
      if(el instanceof Element){
        if(el.hasAttribute('style')){
          trStyleRecordNode(el,'inserted');
          const props=trStyleProperties(el);
          for(const p of props)trStyleInc(trStyleStats.propertyHits,p);
          const scope=trStyleScope(el),sig=trStyleSignature(el);
          trStyleInc(trStyleStats.scopeHits,scope);trStyleInc(trStyleStats.signatureHits,sig);
          trStyleStats.lastScope=scope;trStyleStats.lastSignature=sig;
        }else trStyleStats.removedAttributes++;
      }
    }else if(rec.type==='childList'){
      rec.addedNodes.forEach(node=>{if(node instanceof Element)trStyleScanTree(node,'inserted');});
    }
  }
}
function trStyleLiveSnapshot(){
  const nodes=[...document.querySelectorAll('[style]')];
  const props=new Set();
  nodes.forEach(el=>trStyleProperties(el).forEach(p=>props.add(p)));
  return {activeNodes:nodes.length,activeProperties:props.size,properties:[...props].sort()};
}
function trStyleTop(map,n=6){return [...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n).map(([name,count])=>({name,count}));}
function trStyleDiagnostics(){
  const source=trStyleSourceBaseline(),live=trStyleLiveSnapshot();
  return {
    version:TR_STYLE_RUNTIME_VERSION,
    startedAt:trStyleStartedAt,
    sourceInlineAttributes:source.inlineAttributes,
    sourceCssomWrites:source.cssomWrites,
    sourceDebt:source.inlineAttributes+source.cssomWrites,
    activeNodes:live.activeNodes,
    activeProperties:live.activeProperties,
    propertiesActive:live.properties,
    nodesSeen:trStyleStats.initialNodes+trStyleStats.insertedNodes,
    initialNodes:trStyleStats.initialNodes,
    insertedNodes:trStyleStats.insertedNodes,
    attributeMutations:trStyleStats.attributeMutations,
    removedAttributes:trStyleStats.removedAttributes,
    topProperties:trStyleTop(trStyleStats.propertyHits),
    topScopes:trStyleTop(trStyleStats.scopeHits),
    topSignatures:trStyleTop(trStyleStats.signatureHits),
    lastMutationAt:trStyleStats.lastMutationAt,
    lastScope:trStyleStats.lastScope,
    lastSignature:trStyleStats.lastSignature,
    cspCompatibility:true,
    blockingEnabled:false,
    ok:true
  };
}
function trStyleResetInventory(){
  trStyleStats=trStyleBlankStats();
  trStyleSeenNodes=new WeakSet();
  trStyleStartedAt=new Date().toISOString();
  trStyleScanTree(document,'initial');
  try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')render();}catch(_){/* diagnostics only */}
}
function trStyleRows(rows,empty='Sin actividad observada todavía.'){
  if(!rows?.length)return `<div class="tr-style-empty">${empty}</div>`;
  return `<div class="tr-style-list">${rows.map(x=>`<div><code>${esc(x.name)}</code><strong>${x.count}</strong></div>`).join('')}</div>`;
}
function trStyleRuntimePanel(){
  const d=trStyleDiagnostics();
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Style Boundary · inventario</h3><div class="help">V31.21 mide primero la deuda real de estilos inline antes de retirar <code>style-src-attr 'unsafe-inline'</code>. No bloquea estilos ni cambia cálculos.</div></div><span class="stable-pill">Observando</span></div><div class="integrity-kpis"><div><span>Style attrs en fuente</span><strong>${d.sourceInlineAttributes}</strong></div><div><span>Escrituras CSSOM en fuente</span><strong>${d.sourceCssomWrites}</strong></div><div><span>Nodos style activos</span><strong>${d.activeNodes}</strong></div><div><span>Nodos observados</span><strong>${d.nodesSeen}</strong></div><div><span>Mutaciones style</span><strong>${d.attributeMutations}</strong></div><div><span>Propiedades activas</span><strong>${d.activeProperties}</strong></div><div><span>CSP style attrs</span><strong>Compatibilidad</strong></div><div><span>Estado</span><strong class="positive">OK</strong></div></div><div class="tr-style-grid"><div><h4>Propiedades más observadas</h4>${trStyleRows(d.topProperties)}</div><div><h4>Áreas que generan estilos</h4>${trStyleRows(d.topScopes)}</div><div><h4>Elementos más frecuentes</h4>${trStyleRows(d.topSignatures)}</div></div><div class="notice"><strong>V31.21 · Style Boundary:</strong> la muestra combina un inventario estático generado durante el build con observación runtime mediante <code>MutationObserver</code>. Interactúa con Dashboard, Operaciones, Market Data, Calendario e Informes para ampliar la muestra. Cuando el inventario esté estable, migraremos por familias de propiedades y solo entonces activaremos <code>style-src-attr 'none'</code>.<br><small>La observación no modifica atributos <code>style</code>, no llama a <code>render()</code> al registrar mutaciones y no persiste telemetría en el dominio.</small></div><div class="tr-style-actions"><button class="btn small" data-tr-onclick="trStyleResetInventory()">Reiniciar muestra de estilos</button><span class="help">Inicio de muestra: ${esc(d.startedAt?new Date(d.startedAt).toLocaleTimeString('es-ES'):'—')}</span></div></section>`;
}
function trStyleStart(){
  if(trStyleObserver)return;
  trStyleStartedAt=new Date().toISOString();
  trStyleScanTree(document,'initial');
  trStyleObserver=new MutationObserver(trStyleMutation);
  trStyleObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style'],attributeOldValue:true});
}

if(typeof dataSecurityPanel==='function'){
  const trStyleDataSecurityBase=dataSecurityPanel;
  dataSecurityPanel=function(){return trStyleRuntimePanel()+trStyleDataSecurityBase();};
  window.dataSecurityPanel=dataSecurityPanel;
}

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.21</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_STYLE_APP_LABEL)}</div><div class="help">Inventario estático + observación runtime de estilos inline. La excepción CSP de style attributes sigue activa de forma deliberada hasta completar la migración visual.</div></div></div></div>`;};

window.TradingResearchStyles=Object.freeze({version:TR_STYLE_RUNTIME_VERSION,diagnostics:trStyleDiagnostics,reset:trStyleResetInventory});
Object.assign(window,{trStyleDiagnostics,trStyleResetInventory,trStyleRuntimePanel});
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=v30ModeCard();}catch(_){/* next render refreshes */}
trStyleStart();
})();
/* ===== END V31.21 STYLE RUNTIME ===== */
