/* ===== V31.22 RUNTIME · Security Foundation V · Full CSP Enforcement ===== */
(()=>{
'use strict';
const TR_CSP_RUNTIME_VERSION='31.24.0';
const TR_CSP_APP_LABEL='V31.24 · CSP Header Evidence Diagnostics';
const TR_CSP_EXPECTED=Object.freeze({scriptAttrNone:true,unsafeEval:false,objectNone:true,baseNone:true,frameAncestorsNone:true,styleAttrNone:true,supabaseConnectRequired:true,supabaseSdkPinned:true});
let trCspHeaderState={checked:false,ok:null,header:'',error:'',checkedAt:''};
let trCspHeaderPromise=null;
function trCspNormalizeHeader(v){return String(v||'').replace(/\s+/g,' ').trim();}
function trCspHeaderChecks(header){
  const h=trCspNormalizeHeader(header),has=re=>re.test(h);
  return {present:!!h,defaultNone:has(/(?:^|;)\s*default-src\s+'none'(?:\s|;|$)/i),scriptAttrNone:has(/(?:^|;)\s*script-src-attr\s+'none'(?:\s|;|$)/i),unsafeEval:has(/'unsafe-eval'/i),objectNone:has(/(?:^|;)\s*object-src\s+'none'(?:\s|;|$)/i),baseNone:has(/(?:^|;)\s*base-uri\s+'none'(?:\s|;|$)/i),frameAncestorsNone:has(/(?:^|;)\s*frame-ancestors\s+'none'(?:\s|;|$)/i),styleAttrNone:has(/(?:^|;)\s*style-src-attr\s+'none'(?:\s|;|$)/i),styleAttrUnsafeInline:has(/(?:^|;)\s*style-src-attr\s+[^;]*'unsafe-inline'/i),supabaseConnect:has(/(?:^|;)\s*connect-src\s+[^;]*https:\/\/\*\.supabase\.co/i),jsdelivrPinned:has(/script-src-elem\s+[^;]*cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.112\.3\/dist\/umd\//i)};
}
function trCspEvaluateHeader(header){const c=trCspHeaderChecks(header);return {...c,ok:c.present&&c.defaultNone&&c.scriptAttrNone&&!c.unsafeEval&&c.objectNone&&c.baseNone&&c.frameAncestorsNone&&c.styleAttrNone&&!c.styleAttrUnsafeInline&&c.supabaseConnect&&c.jsdelivrPinned};}
async function trCspProbeHeader(force=false){
  if(trCspHeaderPromise&&!force)return trCspHeaderPromise;
  trCspHeaderPromise=(async()=>{try{const r=await fetch(location.href,{method:'HEAD',cache:'no-store',credentials:'same-origin'}),header=r.headers.get('content-security-policy')||'',ev=trCspEvaluateHeader(header);trCspHeaderState={checked:true,ok:ev.ok,header,error:'',checkedAt:new Date().toISOString(),checks:ev};}catch(e){trCspHeaderState={checked:true,ok:false,header:'',error:e?.message||String(e),checkedAt:new Date().toISOString(),checks:null};}try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')render();}catch(_){}return trCspHeaderState;})();
  return trCspHeaderPromise;
}
function trCspDiagnostics(){const s=trCspHeaderState,c=s.checks||{},match=s.checked?(s.ok===true):null;return {version:TR_CSP_RUNTIME_VERSION,headerChecked:s.checked,headerOk:s.ok,headerMatchesExpectedPolicy:match,header:s.header,error:s.error,scriptAttrNone:c.scriptAttrNone??null,unsafeEval:c.unsafeEval??null,objectNone:c.objectNone??null,baseNone:c.baseNone??null,frameAncestorsNone:c.frameAncestorsNone??null,styleAttrNone:c.styleAttrNone??null,styleAttrUnsafeInline:c.styleAttrUnsafeInline??null,supabaseConnect:c.supabaseConnect??null,jsdelivrPinned:c.jsdelivrPinned??null,executableDirectivesMatch:s.checked?!!(c.defaultNone&&c.scriptAttrNone&&!c.unsafeEval&&c.objectNone&&c.baseNone&&c.frameAncestorsNone&&c.supabaseConnect&&c.jsdelivrPinned):null,styleAttributeDirectiveMatch:s.checked?!!(c.styleAttrNone&&!c.styleAttrUnsafeInline):null,ok:s.checked?(s.ok===true):null};}
function trCspMark(v,pending='Comprobando…'){if(v===null||v===undefined)return `<strong>${pending}</strong>`;return `<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;}
function trCspRuntimePanel(){const d=trCspDiagnostics(),status=d.headerChecked?(d.headerMatchesExpectedPolicy?'Cabecera OK':'Revisar'):'Comprobando';return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Content Security Policy · evidencia de cabecera</h3><div class="help">La sonda HEAD compara la cabecera observada con las directivas esperadas. Este diagnóstico prueba la política HTTP recibida; no sustituye los gates de build ni afirma por sí solo cobertura exhaustiva de todos los sinks del navegador.</div></div><span class="stable-pill ${d.headerMatchesExpectedPolicy===false?'warning':''}">${status}</span></div><div class="integrity-kpis"><div><span>Cabecera esperada</span>${trCspMark(d.headerMatchesExpectedPolicy)}</div><div><span>script-src-attr</span>${trCspMark(d.scriptAttrNone)}</div><div><span>style-src-attr</span>${trCspMark(d.styleAttrNone)}</div><div><span>unsafe-eval</span><strong class="${d.unsafeEval===false?'positive':d.unsafeEval===true?'negative':''}">${d.unsafeEval===false?'No':d.unsafeEval===true?'Sí':'Comprobando…'}</strong></div><div><span>object-src</span>${trCspMark(d.objectNone)}</div><div><span>frame-ancestors</span>${trCspMark(d.frameAncestorsNone)}</div><div><span>Supabase connect</span>${trCspMark(d.supabaseConnect)}</div><div><span>Supabase SDK</span>${trCspMark(d.jsdelivrPinned)}</div></div><div class="notice"><strong>Propiedad comprobada:</strong> la respuesta HEAD contiene el conjunto esperado de directivas CSP. El build verifica por separado hashes, ausencia de <code>unsafe-eval</code> y bloqueo de atributos inline.</div>${d.error?`<div class="notice danger"><strong>Sonda CSP:</strong> ${globalThis.TradingResearchContentEncodingContract.html(d.error)}</div>`:''}</section>`;}
const trCspDataContract=globalThis.TradingResearchDataSecurityPanelContract;
const trCspDataBase=trCspDataContract.current();
if(typeof trCspDataBase==='function'){
  trCspDataContract.replace(function(){
    let html=trCspDataBase(),d=trCspDiagnostics();
    const mark=!d.headerChecked?'<strong>Comprobando…</strong>':d.headerMatchesExpectedPolicy?'<strong class="positive">Cabecera OK</strong>':'<strong class="negative">Revisar</strong>';
    const row=`<div><span>Cabecera CSP esperada</span>${mark}</div>`;
    html=html.replace(/<div><span>CSP (?:estricta|ejecutable|completa)<\/span><strong(?: class="positive")?>[^<]*<\/strong><\/div>/g,row);
    html=html
      .replace('Queda pendiente aplicar la CSP estricta a cabeceras/recursos externos.','La build configura una política CSP estricta; la sonda HEAD de esta vista comprueba si la cabecera observada coincide con la política esperada.')
      .replace('La CSP estricta sigue pendiente para la siguiente fase.','La build bloquea atributos de estilo inline; la sonda HEAD verifica la directiva observada.')
      .replace('La CSP ejecutable queda aplicada en V31.20; solo permanece la excepción temporal de estilos dinámicos inline.','Los gates de build verifican scripts por hash y style-src-attr none; la sonda runtime solo certifica la cabecera recibida.');
    return trCspRuntimePanel()+html;
  });
}
const trCspModeContract=globalThis.TradingResearchModeCardPresentationContract;
const trCspModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.24</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${globalThis.TradingResearchContentEncodingContract.html(TR_CSP_APP_LABEL)}</div><div class="help">La build define la política CSP objetivo y los gates verifican hashes/directivas. La sonda runtime informa por separado si la cabecera HTTP observada coincide con esa política.</div></div></div></div>`;};
trCspModeContract.replace(trCspModeCard);
/* V31.23.5: keep one namespaced public CSP contract; duplicate root diagnostic aliases removed. */
window.TradingResearchCSP=Object.freeze({version:TR_CSP_RUNTIME_VERSION,expected:TR_CSP_EXPECTED,diagnostics:trCspDiagnostics,probeHeader:trCspProbeHeader});
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=trCspModeCard();}catch(_){}
setTimeout(()=>trCspProbeHeader(false),0);
})();
/* ===== END V31.22 CSP RUNTIME ===== */