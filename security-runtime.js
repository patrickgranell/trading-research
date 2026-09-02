/* ===== Trading Research V31.18 · Security Foundation I =====
 * User-content boundary + FormData diagnostics.
 * Loaded after state-runtime.js. This layer does not alter financial calculations.
 */
(()=>{
'use strict';
const TR_SECURITY_RUNTIME_VERSION='31.18.0';
const TR_SECURITY_APP_LABEL='V31.18 · Security Foundation I · User Content Boundary';
const TR_SECURITY_FORMDATA_BOUNDARIES=Object.freeze([
  'operation','plan','contract','risk-management','emotional-journal','review-note','visual-reference'
]);

function trSecurityProbeEscaping(){
  try{
    const payload=`<img src=x onerror="window.__tr_security_probe=1">'&\"</img>`;
    const host=document.createElement('div');
    host.innerHTML=`<span>${globalThis.TradingResearchContentEncodingContract.html(payload)}</span>`;
    const span=host.firstElementChild;
    return !!span&&span.textContent===payload&&!span.querySelector('img,script,iframe,object,embed,svg,math');
  }catch(_){return false;}
}
function trSecurityProbeModalTitle(){
  try{
    const payload=`</h3><img src=x onerror="window.__tr_security_probe=2">`;
    const host=document.createElement('div');
    host.innerHTML=globalThis.TradingResearchFormBoundaryContract.renderLockedModal(payload,'','');
    const title=host.querySelector('.modal-head h3');
    return !!title&&title.textContent===payload&&!title.querySelector('*')&&!host.querySelector('.modal-head img,.modal-head script');
  }catch(_){return false;}
}
function trSecurityProbeInlineToken(){
  try{
    const payload=`')-alert(1)-('`;
    const token=globalThis.TradingResearchContentEncodingContract.uri(payload);
    return !token.includes("'")&&decodeURIComponent(token)===payload;
  }catch(_){return false;}
}
function trSecurityProbeFormData(){
  try{
    const form=document.createElement('form');
    form.innerHTML='<input name="alpha" value="uno"><textarea name="beta">dos</textarea><input type="checkbox" name="flags" value="A" checked><input type="checkbox" name="flags" value="B" checked>';
    const fd=globalThis.TradingResearchFormBoundaryContract.captureFormData(form);
    return globalThis.TradingResearchFormBoundaryContract.readFormValue(fd,'alpha')==='uno'&&globalThis.TradingResearchFormBoundaryContract.readFormValue(fd,'beta')==='dos'&&fd?.getAll('flags').join(',')==='A,B';
  }catch(_){return false;}
}
function trSecurityDiagnostics(){
  const escaping=trSecurityProbeEscaping();
  const modalTitle=trSecurityProbeModalTitle();
  const inlineToken=trSecurityProbeInlineToken();
  const formData=trSecurityProbeFormData();
  return {
    runtime:TR_SECURITY_RUNTIME_VERSION,
    escaping,modalTitle,inlineToken,formData,
    coreFormBoundaries:TR_SECURITY_FORMDATA_BOUNDARIES.length,
    inlineHandlersLegacy:false,
    eventDelegationReady:true,
    strictCspReady:false,
    ok:escaping&&modalTitle&&inlineToken&&formData
  };
}
function trSecurityRuntimePanel(){
  const d=trSecurityDiagnostics();
  const mark=v=>`<strong class="${v?'positive':'negative'}">${v?'OK':'Revisar'}</strong>`;
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Seguridad de render y formularios</h3><div class="help">V31.18 separa el texto de usuario del HTML ejecutable en los sinks corregidos y mueve los editores principales a FormData. No cambia cálculos financieros ni el modelo de datos.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Content boundary</span></div><div class="integrity-kpis"><div><span>Escape HTML</span>${mark(d.escaping)}</div><div><span>Títulos de modal</span>${mark(d.modalTitle)}</div><div><span>Token inline</span>${mark(d.inlineToken)}</div><div><span>FormData</span>${mark(d.formData)}</div><div><span>Editores migrados</span><strong>${d.coreFormBoundaries}</strong></div><div><span>Event delegation</span><strong>Parcial / pendiente</strong></div><div><span>CSP estricta</span><strong>Pendiente</strong></div><div><span>Estado</span>${mark(d.ok)}</div></div><div class="notice"><strong>V31.18 · User Content Boundary:</strong> los títulos de modal se convierten en texto en el propio sink; los valores dinámicos que todavía viajan por handlers inline usan tokens URI que codifican también el apóstrofo; y Operaciones, Trading Plans, Contratos, Gestión de riesgo, Diario emocional, Reviews y Referencias visuales leen sus campos mediante <code>FormData</code>.<br><small>Deuda explícita: la aplicación todavía conserva numerosos <code>onclick/onchange/oninput</code> históricos. Esta fase reduce la superficie de inyección sin fingir que existe una CSP estricta; la delegación global de eventos se abordará por módulos para no romper una base funcional ya validada.</small></div>${d.ok?'':`<div class="notice danger"><strong>Security runtime:</strong> una de las sondas locales de escaping/FormData no pasó. No introduzcas datos nuevos hasta revisar esta build.</div>`}</section>`;
}

const trSecurityDataSecurityBase=dataSecurityPanel;
dataSecurityPanel=function(){return trSecurityRuntimePanel()+trSecurityDataSecurityBase();};

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.18</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${globalThis.TradingResearchContentEncodingContract.html(TR_SECURITY_APP_LABEL)}</div><div class="help">Boundary de contenido de usuario + FormData en editores principales. Títulos de modal y tokens dinámicos quedan endurecidos contra inyección. La migración completa de handlers inline a delegación de eventos continúa en la siguiente fase; la lógica financiera permanece congelada.</div></div></div></div>`;};

window.TradingResearchSecurity=Object.freeze({version:TR_SECURITY_RUNTIME_VERSION,diagnostics:trSecurityDiagnostics,formDataBoundaries:TR_SECURITY_FORMDATA_BOUNDARIES});
Object.assign(window,{trSecurityDiagnostics,trSecurityRuntimePanel});

/* The persistent shell may already exist when this final runtime loads. Refresh only
 * the version card directly; the next normal config render will include diagnostics. */
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=v30ModeCard();}catch(_){/* diagnostics remain available */}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>render(),0);}catch(_){/* no forced render outside Datos y seguridad */}
})();
/* ===== END V31.18 SECURITY RUNTIME ===== */
