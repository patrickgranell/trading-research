(()=>{
'use strict';
const TR_EVENT_RUNTIME_VERSION='31.24.0';
const TR_EVENT_APP_LABEL='V31.24 · Structured Event Boundary';
const TR_EVENT_TYPES=['click','change','input','submit'];
const TR_EVENT_COMPILED_PLANS=Object.freeze(__TR_EVENT_COMPILED_PLANS__);
const TR_EVENT_BUILD_FINGERPRINT='__TR_EVENT_BUILD_FINGERPRINT__';
const TR_EVENT_EXPECTED_PLAN_COUNT=Number('__TR_EVENT_EXPECTED_PLAN_COUNT__');
const TR_BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);
const TR_SAFE_BUILTINS=Object.freeze({String,Number,Boolean,decodeURIComponent,encodeURIComponent});
const trActionRegistry=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:Object.create(null);
if(!window.TradingResearchActions)window.TradingResearchActions=trActionRegistry;

let trEventDispatches=0,trEventExecErrors=0,trEventAsyncRejections=0,trEventArgsErrors=0,trEventLastError='',trEventListenersInstalled=false;
let trActionRegistryHits=0,trActionRegistryMisses=0,trEventAsyncObserved=0;

function trEventActionAttr(type){return 'data-tr-action-'+type;}
function trEventArgsAttr(type){return 'data-tr-args-'+type;}
function trEventLegacyAttr(type){return 'data-tr-on'+type;}
function trEventDangerousKey(k){return TR_BLOCKED_KEYS.has(String(k));}
function trActionRegistrySize(){return Object.keys(trActionRegistry).length;}
function trActionResolve(name){
  if(trEventDangerousKey(name))throw new Error('Acción bloqueada: '+String(name));
  if(Object.prototype.hasOwnProperty.call(trActionRegistry,name)){
    trActionRegistryHits++;const value=trActionRegistry[name];
    if(typeof value!=='function')throw new TypeError('La acción registrada no es una función: '+name);
    return value;
  }
  trActionRegistryMisses++;throw new ReferenceError('Acción no expuesta en TradingResearchActions: '+name);
}
function trEventDecodeArgs(el,type){
  const raw=el.getAttribute(trEventArgsAttr(type));if(!raw)return [];
  try{const value=JSON.parse(decodeURIComponent(raw));if(!Array.isArray(value))throw new Error('args no es array');return value;}
  catch(e){trEventArgsErrors++;trEventLastError='Argumentos estructurados inválidos: '+(e?.message||e);throw e;}
}
function trEventRef(node,ctx){
  if(node.t==='this')return {obj:ctx,key:'this',value:ctx.thisArg,root:'this'};
  if(node.t==='id'){
    if(node.n==='event')return {obj:ctx,key:'event',value:ctx.event,root:'event'};
    if(node.n==='document')return {obj:ctx,key:'document',value:document,root:'document'};
    if(node.n==='window'||node.n==='globalThis')return {obj:ctx,key:'registry',value:trActionRegistry,root:'registry'};
    if(Object.prototype.hasOwnProperty.call(TR_SAFE_BUILTINS,node.n))return {obj:TR_SAFE_BUILTINS,key:node.n,value:TR_SAFE_BUILTINS[node.n],root:'builtin'};
    const fn=trActionResolve(node.n);return {obj:trActionRegistry,key:node.n,value:fn,root:'registry'};
  }
  if(node.t==='mem'){
    let base,root=null;
    if(['id','mem','this'].includes(node.o?.t)){const r=trEventRef(node.o,ctx);base=r.value;root=r.root;}
    else base=trEventEval(node.o,ctx);
    if((base===null||base===undefined)&&node.opt)return {obj:null,key:null,value:undefined,optional:true,root};
    if(base===null||base===undefined)throw new TypeError('Acceso a miembro de null/undefined');
    const key=trEventEval(node.k,ctx);if(trEventDangerousKey(key))throw new Error('Miembro bloqueado: '+String(key));
    if(root==='registry'){
      if(!Object.prototype.hasOwnProperty.call(trActionRegistry,key)){trActionRegistryMisses++;throw new ReferenceError('Acción no expuesta en TradingResearchActions: '+String(key));}
      trActionRegistryHits++;
    }
    return {obj:base,key,value:base[key],root};
  }
  throw new TypeError('Referencia estructurada inválida');
}
function trEventTrackPromise(value,ctx){
  if(value&&typeof value.then==='function'){ctx.promises.push(value);trEventAsyncObserved++;}
  return value;
}
function trEventEval(node,ctx){
  if(!node)return undefined;
  switch(node.t){
    case 'lit':return node.v;
    case 'slot':{const v=ctx.slots[node.i];return node.str?String(v??''):v;}
    case 'cat':return node.a.map(x=>String(trEventEval(x,ctx)??'')).join('');
    case 'this':return ctx.thisArg;
    case 'id':return trEventRef(node,ctx).value;
    case 'arr':return node.a.map(x=>trEventEval(x,ctx));
    case 'obj':{const o={};for(const [k,v] of node.a){if(trEventDangerousKey(k))throw new Error('Clave bloqueada: '+k);o[k]=trEventEval(v,ctx);}return o;}
    case 'mem':return trEventRef(node,ctx).value;
    case 'un':{const v=trEventEval(node.x,ctx);if(node.op==='!')return !v;if(node.op==='-')return -v;if(node.op==='+')return +v;break;}
    case 'bin':{
      if(node.op==='&&'){const a=trEventEval(node.a,ctx);return a?trEventEval(node.b,ctx):a;}
      if(node.op==='||'){const a=trEventEval(node.a,ctx);return a?a:trEventEval(node.b,ctx);}
      const a=trEventEval(node.a,ctx),b=trEventEval(node.b,ctx);
      switch(node.op){case '===':return a===b;case '!==':return a!==b;case '==':return a==b;case '!=':return a!=b;case '>':return a>b;case '<':return a<b;case '>=':return a>=b;case '<=':return a<=b;}
      break;
    }
    case 'call':{
      let fn,thisArg;
      if(node.f.t==='mem'){const r=trEventRef(node.f,ctx);if(r.optional&&r.value===undefined)return undefined;fn=r.value;thisArg=r.obj;}
      else if(node.f.t==='id'&&Object.prototype.hasOwnProperty.call(TR_SAFE_BUILTINS,node.f.n)){fn=TR_SAFE_BUILTINS[node.f.n];thisArg=TR_SAFE_BUILTINS;}
      else{fn=trEventEval(node.f,ctx);thisArg=undefined;}
      if(typeof fn!=='function')throw new TypeError('La acción estructurada no es una función');
      if(fn===globalThis.eval||fn===globalThis.Function)throw new Error('Ejecución dinámica bloqueada');
      return trEventTrackPromise(Reflect.apply(fn,thisArg,node.args.map(x=>trEventEval(x,ctx))),ctx);
    }
    case 'assign':{
      if(node.left.t!=='mem')throw new Error('Solo se permiten asignaciones sobre el elemento del evento');
      const r=trEventRef(node.left,ctx);if(r.root!=='this'||!r.obj||trEventDangerousKey(r.key))throw new Error('Asignación fuera de this bloqueada');
      const v=trEventEval(node.right,ctx);r.obj[r.key]=v;return v;
    }
  }
  throw new Error('Nodo estructurado no soportado: '+node.t);
}
function trEventRunPlan(plan,el,event,slots=[]){
  const ctx={thisArg:el,event,slots,promises:[]};let last;
  for(const s of plan.body||[]){
    if(s.t==='ret'){last=s.arg?trEventEval(s.arg,ctx):undefined;if(last===false)event.preventDefault();break;}
    last=trEventEval(s.e,ctx);
  }
  return {value:last,promises:ctx.promises};
}
function trEventObservePromises(promises,type,actionName){
  for(const p of promises||[])Promise.resolve(p).catch(e=>{
    trEventAsyncRejections++;trEventLastError='Async '+type+' '+actionName+': '+(e?.message||e);
    console.error('[Trading Research · structured async event]',type,actionName,e);
  });
}
function trEventInvoke(actionName,el,event,type){
  const slots=trEventDecodeArgs(el,type),plan=TR_EVENT_COMPILED_PLANS[actionName];
  if(plan){
    const result=trEventRunPlan(plan,el,event,slots);trEventObservePromises(result.promises,type,actionName);return result.value;
  }
  const fn=trActionResolve(actionName),value=Reflect.apply(fn,el,slots);
  if(value&&typeof value.then==='function'){trEventAsyncObserved++;trEventObservePromises([value],type,actionName);}
  return value;
}
function trEventHandlerNodes(event,type){
  const attr=trEventActionAttr(type),nodes=[];let n=event.target instanceof Element?event.target:null;
  while(n){if(n.hasAttribute?.(attr))nodes.push(n);n=n.parentElement;}
  return nodes;
}
function trEventDispatch(event){
  const type=event.type;if(!TR_EVENT_TYPES.includes(type))return;
  for(const el of trEventHandlerNodes(event,type)){
    const actionName=String(el.getAttribute(trEventActionAttr(type))||'').trim();if(!actionName)continue;
    try{const result=trEventInvoke(actionName,el,event,type);if(result===false)event.preventDefault();trEventDispatches++;}
    catch(e){trEventExecErrors++;trEventLastError=(e?.message||e)+' · '+actionName;console.error('[Trading Research · structured event]',type,e,actionName);}
    if(event.cancelBubble)break;
  }
}
function trEventInstall(){if(trEventListenersInstalled)return;for(const t of TR_EVENT_TYPES)document.addEventListener(t,trEventDispatch,false);trEventListenersInstalled=true;}
function trEventInlineDomCount(root=document){let n=0;for(const t of TR_EVENT_TYPES)n+=root.querySelectorAll?.('[on'+t+']')?.length||0;return n;}
function trEventStructuredDomCount(root=document){let n=0;for(const t of TR_EVENT_TYPES)n+=root.querySelectorAll?.('['+trEventActionAttr(t)+']')?.length||0;return n;}
function trEventLegacyProgramCount(root=document){let n=0;for(const t of TR_EVENT_TYPES)n+=root.querySelectorAll?.('['+trEventLegacyAttr(t)+']')?.length||0;return n;}
function trEventAuditDocument(root=document){
  let structuredHandlers=0,legacyProgramHandlers=0,invalidActions=0,argsErrors=0;const errors=[];
  for(const t of TR_EVENT_TYPES){
    legacyProgramHandlers+=root.querySelectorAll?.('['+trEventLegacyAttr(t)+']')?.length||0;
    for(const el of root.querySelectorAll?.('['+trEventActionAttr(t)+']')||[]){
      structuredHandlers++;const action=String(el.getAttribute(trEventActionAttr(t))||'').trim();
      if(!action){invalidActions++;errors.push({type:t,error:'Acción vacía'});continue;}
      if(!TR_EVENT_COMPILED_PLANS[action]&&!Object.prototype.hasOwnProperty.call(trActionRegistry,action)){invalidActions++;errors.push({type:t,action,error:'Acción no registrada'});}
      const raw=el.getAttribute(trEventArgsAttr(t));if(raw){try{const a=JSON.parse(decodeURIComponent(raw));if(!Array.isArray(a))throw new Error('args no array');}catch(e){argsErrors++;errors.push({type:t,action,error:'args: '+(e?.message||e)});}}
    }
  }
  return {structuredHandlers,legacyProgramHandlers,invalidActions,argsErrors,errors,inlineHandlers:trEventInlineDomCount(root)};
}
function trEventDiagnostics(){
  const a=trEventAuditDocument(document),compiledPlans=Object.keys(TR_EVENT_COMPILED_PLANS).length,artifactParity=compiledPlans===TR_EVENT_EXPECTED_PLAN_COUNT;
  return {version:TR_EVENT_RUNTIME_VERSION,buildFingerprint:TR_EVENT_BUILD_FINGERPRINT,expectedCompiledPlans:TR_EVENT_EXPECTED_PLAN_COUNT,artifactParity,listeners:trEventListenersInstalled?TR_EVENT_TYPES.length:0,structuredHandlers:a.structuredHandlers,legacyProgramHandlers:a.legacyProgramHandlers,inlineHandlers:a.inlineHandlers,invalidActions:a.invalidActions,argsErrors:a.argsErrors,executionErrors:trEventExecErrors,asyncRejections:trEventAsyncRejections,asyncObserved:trEventAsyncObserved,dispatches:trEventDispatches,compiledPlans,actionRegistrySize:trActionRegistrySize(),actionRegistryHits:trActionRegistryHits,registryMisses:trActionRegistryMisses,globalFallbacks:0,usesEval:false,usesParser:false,lastError:trEventLastError,ok:artifactParity&&trEventListenersInstalled&&a.inlineHandlers===0&&a.legacyProgramHandlers===0&&a.invalidActions===0&&a.argsErrors===0&&!trEventExecErrors&&!trEventAsyncRejections&&!trActionRegistryMisses};
}

trEventInstall();
window.TradingResearchEvents=Object.freeze({version:TR_EVENT_RUNTIME_VERSION,diagnostics:trEventDiagnostics,audit:trEventAuditDocument,actions:trActionRegistry});
Object.assign(window,{trEventDiagnostics,trEventAuditDocument});

const trEventDataContract=globalThis.TradingResearchDataSecurityPanelContract;
const trEventDataBase=trEventDataContract.current();
if(typeof trEventDataBase==='function'){
  trEventDataContract.replace(function(){
    const d=trEventDiagnostics();let html=trEventDataBase();
    html=html.replace('<div><span>Event delegation</span><strong>Parcial / pendiente</strong></div>',`<div><span>Event delegation</span><strong class="${d.ok?'positive':'negative'}">${d.ok?'OK':'Revisar'}</strong></div>`)
      .replace(/V31\.23\.4 conserva la delegación estricta[^<]+/,`V31.24 elimina programas de atributos: el build compila los handlers históricos a action IDs estáticos y valores URI-encoded JSON. El runtime solo resuelve propiedades propias de TradingResearchActions.`);
    const extra=`<section class="card panel config-wide"><div class="panel-title"><div><h3>Delegación de eventos</h3><div class="help">Frontera V31.24: sin parser de código, sin AST cache y sin fallback global. Los datos persistidos solo llegan como argumentos estructurados.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Structured actions</span></div><div class="integrity-kpis"><div><span>Listeners</span><strong>${d.listeners}</strong></div><div><span>Handlers estructurados</span><strong>${d.structuredHandlers}</strong></div><div><span>Programas legacy DOM</span><strong class="${d.legacyProgramHandlers?'negative':'positive'}">${d.legacyProgramHandlers}</strong></div><div><span>Planes compilados</span><strong class="${d.artifactParity?'positive':'negative'}">${d.compiledPlans} / ${d.expectedCompiledPlans}</strong></div><div><span>Build fingerprint</span><strong class="positive">${globalThis.TradingResearchContentEncodingContract.html(d.buildFingerprint)}</strong></div><div><span>Registry</span><strong>${d.actionRegistrySize}</strong></div><div><span>Registry misses</span><strong class="${d.registryMisses?'negative':'positive'}">${d.registryMisses}</strong></div><div><span>Async observados / rejects</span><strong class="${d.asyncRejections?'negative':'positive'}">${d.asyncObserved} / ${d.asyncRejections}</strong></div><div><span>Parser / eval</span><strong class="positive">No / No</strong></div><div><span>Estado</span><strong class="${d.ok?'positive':'negative'}">${d.ok?'OK':'Revisar'}</strong></div></div>${d.lastError?`<div class="notice danger"><strong>Delegación:</strong> ${globalThis.TradingResearchContentEncodingContract.html(d.lastError)}</div>`:''}</section>`;
    return extra+html;
  });
}

const trEventModeContract=globalThis.TradingResearchModeCardPresentationContract;
const trEventModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.24</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${globalThis.TradingResearchContentEncodingContract.html(TR_EVENT_APP_LABEL)}</div><div class="help">Structured Event Boundary: action registry propio + argumentos serializados; sin programas en atributos.</div></div></div></div>`;};
trEventModeContract.replace(trEventModeCard);
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=trEventModeCard();}catch(_){}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>render(),0);}catch(_){}
})();
