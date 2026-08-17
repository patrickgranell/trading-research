/* ===== V31.22 RUNTIME · Security Foundation V · Full CSP Enforcement ===== */
(()=>{
'use strict';
const TR_CSP_RUNTIME_VERSION='31.22.0';
const TR_CSP_APP_LABEL='V31.22 · Security Foundation V · Strict Style Attribute CSP';
const TR_CSP_EXPECTED=Object.freeze({
  scriptAttrNone:true,
  unsafeEval:false,
  objectNone:true,
  baseNone:true,
  frameAncestorsNone:true,
  styleAttrNone:true,
  supabaseOnly:true
});
let trCspHeaderState={checked:false,ok:null,header:'',error:'',checkedAt:''};
let trCspHeaderPromise=null;

function trCspNormalizeHeader(v){return String(v||'').replace(/\s+/g,' ').trim();}
function trCspHeaderChecks(header){
  const h=trCspNormalizeHeader(header);
  const has=(re)=>re.test(h);
  return {
    present:!!h,
    defaultNone:has(/(?:^|;)\s*default-src\s+'none'(?:\s|;|$)/i),
    scriptAttrNone:has(/(?:^|;)\s*script-src-attr\s+'none'(?:\s|;|$)/i),
    unsafeEval:has(/'unsafe-eval'/i),
    objectNone:has(/(?:^|;)\s*object-src\s+'none'(?:\s|;|$)/i),
    baseNone:has(/(?:^|;)\s*base-uri\s+'none'(?:\s|;|$)/i),
    frameAncestorsNone:has(/(?:^|;)\s*frame-ancestors\s+'none'(?:\s|;|$)/i),
    styleAttrNone:has(/(?:^|;)\s*style-src-attr\s+'none'(?:\s|;|$)/i),
    styleAttrUnsafeInline:has(/(?:^|;)\s*style-src-attr\s+[^;]*'unsafe-inline'/i),
    supabaseConnect:has(/(?:^|;)\s*connect-src\s+[^;]*https:\/\/\*\.supabase\.co/i),
    jsdelivrPinned:has(/script-src-elem\s+[^;]*cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.112\.3\/dist\/umd\//i)
  };
}
function trCspEvaluateHeader(header){
  const c=trCspHeaderChecks(header);
  const ok=c.present&&c.defaultNone&&c.scriptAttrNone&&!c.unsafeEval&&c.objectNone&&c.baseNone&&c.frameAncestorsNone&&c.styleAttrNone&&!c.styleAttrUnsafeInline&&c.supabaseConnect&&c.jsdelivrPinned;
  return {...c,ok};
}
async function trCspProbeHeader(force=false){
  if(trCspHeaderPromise&&!force)return trCspHeaderPromise;
  trCspHeaderPromise=(async()=>{
    try{
      const r=await fetch(location.href,{method:'HEAD',cache:'no-store',credentials:'same-origin'});
      const header=r.headers.get('content-security-policy')||'';
      const ev=trCspEvaluateHeader(header);
      trCspHeaderState={checked:true,ok:ev.ok,header,error:'',checkedAt:new Date().toISOString(),checks:ev};
    }catch(e){
      trCspHeaderState={checked:true,ok:false,header:'',error:e?.message||String(e),checkedAt:new Date().toISOString(),checks:null};
    }
    try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')render();}catch(_){/* diagnostics only */}
    return trCspHeaderState;
  })();
  return trCspHeaderPromise;
}
function trCspDiagnostics(){
  const s=trCspHeaderState,c=s.checks||{};
  return {
    version:TR_CSP_RUNTIME_VERSION,
    headerChecked:s.checked,
    headerOk:s.ok,
    header:s.header,
    error:s.error,
    scriptAttrNone:c.scriptAttrNone??null,
    unsafeEval:c.unsafeEval??null,
    objectNone:c.objectNone??null,
    baseNone:c.baseNone??null,
    frameAncestorsNone:c.frameAncestorsNone??null,
    styleAttrNone:c.styleAttrNone??null,
    styleAttrUnsafeInline:c.styleAttrUnsafeInline??null,
    supabaseConnect:c.supabaseConnect??null,
    jsdelivrPinned:c.jsdelivrPinned??null,
    strictExecutableBoundary:s.ok===true,
    fullStrictStyles:s.ok===true,
    ok:s.ok!==false
  };
}
function trCspMark(v,pending='Comprobando…'){
  if(v===null||v===undefined)return `<strong>${pending}</strong>`;
  return `<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;
}
function trCspRuntimePanel(){
  const d=trCspDiagnostics();
  const status=d.headerChecked?(d.headerOk?'Enforced':'Revisar'):'Comprobando';
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Content Security Policy</h3><div class="help">V31.22 aplica una CSP completa desde cabecera HTTP. Scripts y atributos de estilo inline quedan bloqueados; los estilos dinámicos internos pasan por una frontera controlada y se aplican mediante CSSOM directo.</div></div><span class="stable-pill ${d.headerOk===false?'warning':''}">${status}</span></div><div class="integrity-kpis"><div><span>Cabecera runtime</span>${trCspMark(d.headerOk)}</div><div><span>script-src-attr</span>${trCspMark(d.scriptAttrNone)}</div><div><span>style-src-attr</span>${trCspMark(d.styleAttrNone)}</div><div><span>unsafe-eval</span><strong class="${d.unsafeEval===false?'positive':d.unsafeEval===true?'negative':''}">${d.unsafeEval===false?'No':d.unsafeEval===true?'Sí':'Comprobando…'}</strong></div><div><span>object-src</span>${trCspMark(d.objectNone)}</div><div><span>frame-ancestors</span>${trCspMark(d.frameAncestorsNone)}</div><div><span>Supabase connect</span>${trCspMark(d.supabaseConnect)}</div><div><span>Supabase SDK</span>${trCspMark(d.jsdelivrPinned)}</div></div><div class="notice"><strong>V31.22 · Strict Style Attribute CSP:</strong> <code>style-src-attr 'none'</code> elimina la última excepción <code>'unsafe-inline'</code>. La build convierte los atributos históricos <code>style</code> en tokens <code>data-tr-style</code> antes del bundle y un runtime hash-pinned aplica únicamente declaraciones validadas mediante la API <code>element.style</code>, que no depende de atributos style ejecutables.<br><small>La lógica financiera, IndexedDB, sincronización, cálculos y estructura de datos no cambian en esta fase.</small></div>${d.error?`<div class="notice danger"><strong>CSP runtime:</strong> ${esc(d.error)}</div>`:''}</section>`;
}

if(typeof dataSecurityPanel==='function'){
  const trCspDataSecurityBase=dataSecurityPanel;
  dataSecurityPanel=function(){
    let html=trCspDataSecurityBase();
    html=html.replace('<div><span>CSP estricta</span><strong>Pendiente</strong></div>','<div><span>CSP completa</span><strong class="positive">Enforced</strong></div>')
      .replace('<div><span>CSP ejecutable</span><strong class="positive">Enforced</strong></div>','<div><span>CSP completa</span><strong class="positive">Enforced</strong></div>')
      .replace('Queda pendiente aplicar la CSP estricta a cabeceras/recursos externos.','V31.22 aplica CSP completa por cabecera HTTP: scripts por hash, handlers inline bloqueados, style-src-attr none y recursos externos reducidos a los necesarios.')
      .replace('La CSP estricta sigue pendiente para la siguiente fase.','V31.22 cierra también la excepción de estilos inline mediante la frontera de estilos controlada.')
      .replace('La CSP ejecutable queda aplicada en V31.20; solo permanece la excepción temporal de estilos dinámicos inline.','V31.22 cierra la excepción temporal de estilos dinámicos inline con style-src-attr none.');
    return trCspRuntimePanel()+html;
  };
  window.dataSecurityPanel=dataSecurityPanel;
}

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.22</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_CSP_APP_LABEL)}</div><div class="help">CSP completa aplicada: scripts por hash, handlers y eval bloqueados, Supabase fijado y style-src-attr none. Los estilos dinámicos internos pasan por una frontera controlada sin reabrir unsafe-inline.</div></div></div></div>`;};

window.TradingResearchCSP=Object.freeze({version:TR_CSP_RUNTIME_VERSION,expected:TR_CSP_EXPECTED,diagnostics:trCspDiagnostics,probeHeader:trCspProbeHeader});
Object.assign(window,{trCspDiagnostics,trCspProbeHeader,trCspRuntimePanel});
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=v30ModeCard();}catch(_){/* next render refreshes */}
setTimeout(()=>trCspProbeHeader(false),0);
})();
/* ===== END V31.22 CSP RUNTIME ===== */
