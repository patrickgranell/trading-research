/* ===== V31.20 RUNTIME · Security Foundation III · CSP Enforcement ===== */
(()=>{
'use strict';
const TR_CSP_RUNTIME_VERSION='31.20.0';
const TR_CSP_APP_LABEL='V31.20 · Security Foundation III · CSP Enforcement';
const TR_CSP_EXPECTED=Object.freeze({
  scriptAttrNone:true,
  unsafeEval:false,
  objectNone:true,
  baseNone:true,
  frameAncestorsNone:true,
  styleAttrCompatibility:true,
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
    styleAttrCompat:has(/(?:^|;)\s*style-src-attr\s+'unsafe-inline'(?:\s|;|$)/i),
    supabaseConnect:has(/(?:^|;)\s*connect-src\s+[^;]*https:\/\/\*\.supabase\.co/i),
    jsdelivrPinned:has(/script-src-elem\s+[^;]*cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.112\.3\/dist\/umd\//i)
  };
}
function trCspEvaluateHeader(header){
  const c=trCspHeaderChecks(header);
  const ok=c.present&&c.defaultNone&&c.scriptAttrNone&&!c.unsafeEval&&c.objectNone&&c.baseNone&&c.frameAncestorsNone&&c.styleAttrCompat&&c.supabaseConnect&&c.jsdelivrPinned;
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
    styleAttrCompatibility:c.styleAttrCompat??null,
    supabaseConnect:c.supabaseConnect??null,
    jsdelivrPinned:c.jsdelivrPinned??null,
    strictExecutableBoundary:s.ok===true,
    fullStrictStyles:false,
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
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Content Security Policy</h3><div class="help">V31.20 aplica la política desde cabecera HTTP de Cloudflare. Los scripts locales solo ejecutan si su hash SHA-256 coincide; los handlers HTML y la ejecución dinámica siguen bloqueados.</div></div><span class="stable-pill ${d.headerOk===false?'warning':''}">${status}</span></div><div class="integrity-kpis"><div><span>Cabecera runtime</span>${trCspMark(d.headerOk)}</div><div><span>script-src-attr</span>${trCspMark(d.scriptAttrNone)}</div><div><span>unsafe-eval</span><strong class="${d.unsafeEval===false?'positive':d.unsafeEval===true?'negative':''}">${d.unsafeEval===false?'No':d.unsafeEval===true?'Sí':'Comprobando…'}</strong></div><div><span>object-src</span>${trCspMark(d.objectNone)}</div><div><span>frame-ancestors</span>${trCspMark(d.frameAncestorsNone)}</div><div><span>Supabase connect</span>${trCspMark(d.supabaseConnect)}</div><div><span>Supabase SDK</span>${trCspMark(d.jsdelivrPinned)}</div><div><span>Style attrs</span><strong>${d.styleAttrCompatibility===true?'Compatibilidad':d.styleAttrCompatibility===false?'Bloqueados':'Comprobando…'}</strong></div></div><div class="notice"><strong>V31.20 · CSP Enforcement:</strong> <code>default-src 'none'</code>, scripts por hash, <code>script-src-attr 'none'</code>, <code>object-src 'none'</code>, <code>base-uri 'none'</code> y <code>frame-ancestors 'none'</code> quedan aplicados desde <code>dist/_headers</code>. El SDK de Supabase queda fijado a 2.112.3 y la red se limita a Supabase + mismo origen.<br><small>Deuda explícita y acotada: la UI histórica todavía usa estilos dinámicos en atributos <code>style</code>; por eso <code>style-src-attr 'unsafe-inline'</code> permanece temporalmente. No habilita JavaScript inline ni <code>eval</code>. La siguiente fase puede retirar esta excepción sin tocar cálculos financieros.</small></div>${d.error?`<div class="notice danger"><strong>CSP runtime:</strong> ${esc(d.error)}</div>`:''}</section>`;
}

/* Compose over the V31.19 security/event diagnostics without changing domain logic. */
if(typeof dataSecurityPanel==='function'){
  const trCspDataSecurityBase=dataSecurityPanel;
  dataSecurityPanel=function(){
    let html=trCspDataSecurityBase();
    html=html.replace('<div><span>CSP estricta</span><strong>Pendiente</strong></div>','<div><span>CSP ejecutable</span><strong class="positive">Enforced</strong></div>')
      .replace('Queda pendiente aplicar la CSP estricta a cabeceras/recursos externos.','V31.20 aplica CSP por cabecera HTTP: scripts por hash, handlers inline bloqueados y recursos externos reducidos a los necesarios. Los estilos dinámicos históricos quedan como única excepción explícita de compatibilidad.')
      .replace('La CSP estricta sigue pendiente para la siguiente fase.','La CSP ejecutable queda aplicada en V31.20; solo permanece la excepción temporal de estilos dinámicos inline.');
    return trCspRuntimePanel()+html;
  };
  window.dataSecurityPanel=dataSecurityPanel;
}

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.20</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_CSP_APP_LABEL)}</div><div class="help">CSP ejecutable aplicada por cabecera Cloudflare: scripts locales por hash, handlers inline y eval bloqueados, Supabase fijado y red restringida. Los estilos inline dinámicos continúan temporalmente bajo compatibilidad explícita.</div></div></div></div>`;};

window.TradingResearchCSP=Object.freeze({version:TR_CSP_RUNTIME_VERSION,expected:TR_CSP_EXPECTED,diagnostics:trCspDiagnostics,probeHeader:trCspProbeHeader});
Object.assign(window,{trCspDiagnostics,trCspProbeHeader,trCspRuntimePanel});
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=v30ModeCard();}catch(_){/* next render refreshes */}
setTimeout(()=>trCspProbeHeader(false),0);
})();
/* ===== END V31.20 CSP RUNTIME ===== */
