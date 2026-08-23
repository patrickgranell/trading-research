/* ===== V31.23.4 RUNTIME · Source Consolidation · Action Registry Bridge ===== */
(()=>{
'use strict';
const TR_EVENT_RUNTIME_VERSION='31.23.4';
const TR_EVENT_APP_LABEL='V31.23.4 · Source Consolidation · Action Registry Bridge';
const TR_EVENT_TYPES=['click','change','input','submit'];
const TR_EVENT_ATTR_PREFIX='data-tr-on';
const TR_BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);
const TR_EVENT_AST_CACHE_LIMIT=512;
const trEventAstCache=new Map();
let trEventAstEvictions=0;
const trActionRegistry=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:Object.create(null);
if(!window.TradingResearchActions)window.TradingResearchActions=trActionRegistry;
let trEventDispatches=0,trEventParseErrors=0,trEventExecErrors=0,trEventLastError='',trEventListenersInstalled=false;
let trActionRegistryHits=0,trActionGlobalFallbacks=0,trActionRegistryMisses=0;

function trEventAttr(type){return `${TR_EVENT_ATTR_PREFIX}${type}`;}
function trEventDangerousKey(k){return TR_BLOCKED_KEYS.has(String(k));}
function trActionRegistrySize(){return Object.keys(trActionRegistry).length;}
function trActionResolve(name){
  if(trEventDangerousKey(name))throw new Error(`Acción bloqueada: ${String(name)}`);
  if(Object.prototype.hasOwnProperty.call(trActionRegistry,name)){trActionRegistryHits++;return {obj:trActionRegistry,key:name,value:trActionRegistry[name],source:'registry'};}
  if(name in globalThis){
    const value=globalThis[name];trActionGlobalFallbacks++;
    /* Transitional bridge: functions discovered on the historical global object are
       cached in the dedicated registry. Later phases can remove the root export
       without changing the delegated-event resolver contract. */
    if(typeof value==='function'){trActionRegistry[name]=value;return {obj:trActionRegistry,key:name,value,source:'global-cached'};}
    return {obj:globalThis,key:name,value,source:'global'};
  }
  trActionRegistryMisses++;throw new ReferenceError(`Acción no expuesta: ${name}`);
}

/* ---- Tiny parser for the historical handler grammar.
   It deliberately supports only the expressions present in Trading Research inline handlers:
   calls, member access, literals, arrays/objects, assignments, unary +/-/!, comparisons and sequences.
   No eval / Function constructor is used, so this boundary is compatible with a strict CSP. ---- */
function trEventTokenize(src){
  const out=[];let i=0;const n=src.length;
  const isId0=c=>/[A-Za-z_$]/.test(c),isId=c=>/[A-Za-z0-9_$]/.test(c),isDigit=c=>/[0-9]/.test(c);
  while(i<n){
    let c=src[i];if(/\s/.test(c)){i++;continue;}
    if(c==='\''||c==='"'){
      const q=c;let s='',raw=q;i++;
      while(i<n){c=src[i++];raw+=c;if(c===q){out.push({t:'str',v:s,raw});break;}if(c==='\\'){if(i>=n)throw new SyntaxError('Cadena incompleta');const e=src[i++];raw+=e;const map={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0'};s+=map[e]??e;}else s+=c;}
      if(out.at(-1)?.raw!==raw)throw new SyntaxError('Cadena sin cerrar');continue;
    }
    if(isDigit(c)||(c==='.'&&isDigit(src[i+1]||''))){let j=i+1;while(j<n&&/[0-9.eE_+-]/.test(src[j])){if((src[j]==='+'||src[j]==='-')&&!/[eE]/.test(src[j-1]))break;j++;}const raw=src.slice(i,j).replaceAll('_',''),v=Number(raw);if(!Number.isFinite(v))throw new SyntaxError(`Número inválido: ${raw}`);out.push({t:'num',v,raw});i=j;continue;}
    if(isId0(c)){let j=i+1;while(j<n&&isId(src[j]))j++;const raw=src.slice(i,j);out.push({t:'id',v:raw,raw});i=j;continue;}
    const ops=['?.','!==','===','!=','==','>=','<=','&&','||'];let op=ops.find(x=>src.startsWith(x,i));if(op){out.push({t:'p',v:op,raw:op});i+=op.length;continue;}
    if('()[]{}.,:;=!-+<>'.includes(c)){out.push({t:'p',v:c,raw:c});i++;continue;}
    throw new SyntaxError(`Token no permitido '${c}'`);
  }
  out.push({t:'eof',v:'',raw:''});return out;
}
function trEventParser(src){
  const toks=trEventTokenize(src);let p=0;const cur=()=>toks[p],eat=v=>cur().v===v?(p++,true):false,need=v=>{if(!eat(v))throw new SyntaxError(`Se esperaba '${v}' y llegó '${cur().raw||'EOF'}'`);};
  function program(){const body=[];while(cur().t!=='eof'){if(eat(';'))continue;if(cur().t==='id'&&cur().v==='return'){p++;const arg=cur().v===';'||cur().t==='eof'?null:expr();body.push({t:'ret',arg});eat(';');continue;}body.push({t:'exprs',e:assign()});eat(';');}return {t:'prog',body};}
  function expr(){return assign();}
  function assign(){const left=logicalOr();if(eat('=')){if(!['id','mem'].includes(left.t))throw new SyntaxError('Destino de asignación inválido');return {t:'assign',left,right:assign()};}return left;}
  function logicalOr(){let a=logicalAnd();while(eat('||'))a={t:'bin',op:'||',a,b:logicalAnd()};return a;}
  function logicalAnd(){let a=equality();while(eat('&&'))a={t:'bin',op:'&&',a,b:equality()};return a;}
  function equality(){let a=rel();while(['===','!==','==','!='].includes(cur().v)){const op=cur().v;p++;a={t:'bin',op,a,b:rel()};}return a;}
  function rel(){let a=unary();while(['>','<','>=','<='].includes(cur().v)){const op=cur().v;p++;a={t:'bin',op,a,b:unary()};}return a;}
  function unary(){if(['!','-','+'].includes(cur().v)){const op=cur().v;p++;return {t:'un',op,x:unary()};}return postfix(primary());}
  function primary(){
    const x=cur();
    if(x.t==='str'||x.t==='num'){p++;return {t:'lit',v:x.v};}
    if(x.t==='id'){
      p++;if(x.v==='true')return {t:'lit',v:true};if(x.v==='false')return {t:'lit',v:false};if(x.v==='null')return {t:'lit',v:null};if(x.v==='undefined')return {t:'lit',v:undefined};if(x.v==='this')return {t:'this'};return {t:'id',n:x.v};
    }
    if(eat('(')){const e=expr();need(')');return e;}
    if(eat('[')){const a=[];if(!eat(']')){do{a.push(expr());}while(eat(','));need(']');}return {t:'arr',a};}
    if(eat('{')){const a=[];if(!eat('}')){do{const k=cur();if(!['id','str','num'].includes(k.t))throw new SyntaxError('Clave de objeto inválida');p++;need(':');a.push([String(k.v),expr()]);}while(eat(','));need('}');}return {t:'obj',a};}
    throw new SyntaxError(`Expresión inesperada '${x.raw||'EOF'}'`);
  }
  function postfix(a){
    while(true){
      let optional=false;
      if(eat('?.'))optional=true;
      if(optional||eat('.')){const k=cur();if(k.t!=='id')throw new SyntaxError('Miembro sin identificador');p++;a={t:'mem',o:a,k:{t:'lit',v:k.v},c:false,opt:optional};continue;}
      if(eat('[')){const k=expr();need(']');a={t:'mem',o:a,k,c:true,opt:false};continue;}
      if(eat('(')){const args=[];if(!eat(')')){do{args.push(expr());}while(eat(','));need(')');}a={t:'call',f:a,args,opt:optional};continue;}
      break;
    }
    return a;
  }
  const ast=program();if(cur().t!=='eof')throw new SyntaxError('Tokens sobrantes');return ast;
}
function trEventCacheGet(src){
  if(!trEventAstCache.has(src))return null;
  const ast=trEventAstCache.get(src);trEventAstCache.delete(src);trEventAstCache.set(src,ast);return ast;
}
function trEventCacheSet(src,ast){
  if(trEventAstCache.has(src))trEventAstCache.delete(src);
  trEventAstCache.set(src,ast);
  if(trEventAstCache.size>TR_EVENT_AST_CACHE_LIMIT){const oldest=trEventAstCache.keys().next().value;trEventAstCache.delete(oldest);trEventAstEvictions++;}
  return ast;
}
function trEventCompile(code){
  const src=String(code||'').trim();if(!src)return {t:'prog',body:[]};
  const cached=trEventCacheGet(src);if(cached)return cached;
  try{return trEventCacheSet(src,trEventParser(src));}catch(e){trEventParseErrors++;trEventLastError=`${e?.message||e} · ${src.slice(0,180)}`;throw e;}
}
function trEventRef(node,ctx){
  if(node.t==='id'){
    if(node.n==='event')return {obj:ctx,key:'event',value:ctx.event};
    if(node.n==='window'||node.n==='globalThis')return {obj:ctx,key:'window',value:globalThis};
    if(node.n==='document')return {obj:ctx,key:'document',value:document};
    return trActionResolve(node.n);
  }
  if(node.t==='mem'){
    const base=trEventEval(node.o,ctx);if((base===null||base===undefined)&&node.opt)return {obj:null,key:null,value:undefined,optional:true};if(base===null||base===undefined)throw new TypeError('Acceso a miembro de null/undefined');const key=trEventEval(node.k,ctx);if(trEventDangerousKey(key))throw new Error(`Miembro bloqueado: ${String(key)}`);return {obj:base,key,value:base[key]};
  }
  throw new TypeError('Referencia inválida');
}
function trEventEval(node,ctx){
  switch(node.t){
    case 'lit':return node.v;
    case 'this':return ctx.thisArg;
    case 'id':return trEventRef(node,ctx).value;
    case 'arr':return node.a.map(x=>trEventEval(x,ctx));
    case 'obj':{const o={};for(const [k,v] of node.a){if(trEventDangerousKey(k))throw new Error(`Clave bloqueada: ${k}`);o[k]=trEventEval(v,ctx);}return o;}
    case 'mem':return trEventRef(node,ctx).value;
    case 'un':{const v=trEventEval(node.x,ctx);if(node.op==='!')return !v;if(node.op==='-')return -v;if(node.op==='+')return +v;break;}
    case 'bin':{
      if(node.op==='&&'){const a=trEventEval(node.a,ctx);return a?trEventEval(node.b,ctx):a;}
      if(node.op==='||'){const a=trEventEval(node.a,ctx);return a?a:trEventEval(node.b,ctx);}
      const a=trEventEval(node.a,ctx),b=trEventEval(node.b,ctx);switch(node.op){case '===':return a===b;case '!==':return a!==b;case '==':return a==b;case '!=':return a!=b;case '>':return a>b;case '<':return a<b;case '>=':return a>=b;case '<=':return a<=b;}break;
    }
    case 'call':{
      let fn,thisArg=undefined;
      if(node.f.t==='mem'){const r=trEventRef(node.f,ctx);if(r.optional&&r.value===undefined)return undefined;fn=r.value;thisArg=r.obj;}
      else{fn=trEventEval(node.f,ctx);}
      if(typeof fn!=='function')throw new TypeError('La acción resuelta no es una función');
      if(fn===globalThis.eval||fn===globalThis.Function)throw new Error('Ejecución dinámica bloqueada');
      const args=node.args.map(x=>trEventEval(x,ctx));return Reflect.apply(fn,thisArg,args);
    }
    case 'assign':{
      const v=trEventEval(node.right,ctx);
      if(node.left.t==='id'){
        const r=trEventRef(node.left,ctx);if(r.obj!==globalThis&&r.obj!==trActionRegistry)throw new Error('Asignación global no permitida');r.obj[r.key]=v;if(r.obj===trActionRegistry&&r.key in globalThis)globalThis[r.key]=v;return v;
      }
      const r=trEventRef(node.left,ctx);if(!r.obj||trEventDangerousKey(r.key))throw new Error('Asignación de miembro bloqueada');r.obj[r.key]=v;return v;
    }
  }
  throw new Error(`Nodo no soportado: ${node.t}`);
}
function trEventRun(ast,el,event){
  const ctx={thisArg:el,event};let last;
  for(const s of ast.body){
    if(s.t==='ret'){last=s.arg?trEventEval(s.arg,ctx):undefined;if(last===false)event.preventDefault();return last;}
    last=trEventEval(s.e,ctx);
  }
  return last;
}
function trEventHandlerNodes(event,type){
  const attr=trEventAttr(type),nodes=[];let n=event.target instanceof Element?event.target:null;
  while(n){if(n.hasAttribute?.(attr))nodes.push(n);n=n.parentElement;}
  return nodes;
}
function trEventDispatch(event){
  const type=event.type;if(!TR_EVENT_TYPES.includes(type))return;
  for(const el of trEventHandlerNodes(event,type)){
    const code=el.getAttribute(trEventAttr(type));if(!code)continue;
    try{trEventRun(trEventCompile(code),el,event);trEventDispatches++;}
    catch(e){trEventExecErrors++;trEventLastError=`${e?.message||e} · ${String(code).slice(0,180)}`;console.error('[Trading Research · delegated event]',type,e,code);}
    if(event.cancelBubble)break;
  }
}
function trEventInstall(){if(trEventListenersInstalled)return;for(const t of TR_EVENT_TYPES)document.addEventListener(t,trEventDispatch,false);trEventListenersInstalled=true;}
function trEventInlineDomCount(root=document){let n=0;for(const t of TR_EVENT_TYPES)n+=root.querySelectorAll?.(`[on${t}]`)?.length||0;return n;}
function trEventDelegatedDomCount(root=document){let n=0;for(const t of TR_EVENT_TYPES)n+=root.querySelectorAll?.(`[${trEventAttr(t)}]`)?.length||0;return n;}
function trEventAuditDocument(root=document){
  let handlers=0,parseErrors=0;const errors=[];
  for(const t of TR_EVENT_TYPES){for(const el of root.querySelectorAll?.(`[${trEventAttr(t)}]`)||[]){handlers++;const code=el.getAttribute(trEventAttr(t))||'';try{trEventCompile(code);}catch(e){parseErrors++;errors.push({type:t,code,error:e?.message||String(e)});}}}
  return {handlers,parseErrors,errors,inlineHandlers:trEventInlineDomCount(root)};
}
function trEventDiagnostics(){
  const a=trEventAuditDocument(document);
  return {version:TR_EVENT_RUNTIME_VERSION,listeners:trEventListenersInstalled?TR_EVENT_TYPES.length:0,delegatedHandlers:a.handlers,inlineHandlers:a.inlineHandlers,parseErrors:a.parseErrors,executionErrors:trEventExecErrors,dispatches:trEventDispatches,cacheSize:trEventAstCache.size,cacheLimit:TR_EVENT_AST_CACHE_LIMIT,cacheEvictions:trEventAstEvictions,actionRegistrySize:trActionRegistrySize(),actionRegistryHits:trActionRegistryHits,globalFallbacks:trActionGlobalFallbacks,registryMisses:trActionRegistryMisses,lastError:trEventLastError,usesEval:false,ok:trEventListenersInstalled&&a.inlineHandlers===0&&a.parseErrors===0&&!trEventExecErrors&&!trActionRegistryMisses&&trEventAstCache.size<=TR_EVENT_AST_CACHE_LIMIT};
}

trEventInstall();
window.TradingResearchEvents=Object.freeze({version:TR_EVENT_RUNTIME_VERSION,diagnostics:trEventDiagnostics,audit:trEventAuditDocument,actions:trActionRegistry});
Object.assign(window,{trEventDiagnostics,trEventAuditDocument});

/* Security diagnostics are extended at the composed Datos y seguridad boundary. */
if(typeof dataSecurityPanel==='function'){
  const trEventDataSecurityBase=dataSecurityPanel;
  dataSecurityPanel=function(){
    const d=trEventDiagnostics();
    let html=trEventDataSecurityBase();
    html=html.replace('<div><span>Event delegation</span><strong>Parcial / pendiente</strong></div>',`<div><span>Event delegation</span><strong class="${d.ok?'positive':'negative'}">${d.ok?'OK':'Revisar'}</strong></div>`)
      .replace('Deuda explícita: la aplicación todavía conserva numerosos <code>onclick/onchange/oninput</code> históricos. Esta fase reduce la superficie de inyección sin fingir que existe una CSP estricta; la delegación global de eventos se abordará por módulos para no romper una base funcional ya validada.',`V31.23.4 conserva la delegación estricta y añade una frontera explícita de acciones: el intérprete consulta primero <code>TradingResearchActions</code> y solo usa el objeto global como puente transitorio.`);
    const extra=`<section class="card panel config-wide"><div class="panel-title"><div><h3>Delegación de eventos</h3><div class="help">V31.23.4 mantiene click/change/input/submit en listeners de documento, separa la resolución de acciones del objeto global y limita la caché AST para que handlers dinámicos no acumulen memoria sin cota.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Action registry bridge</span></div><div class="integrity-kpis"><div><span>Listeners globales</span><strong>${d.listeners}</strong></div><div><span>Handlers delegados</span><strong>${d.delegatedHandlers}</strong></div><div><span>Handlers inline DOM</span><strong class="${d.inlineHandlers?'negative':'positive'}">${d.inlineHandlers}</strong></div><div><span>AST cache</span><strong>${d.cacheSize} / ${d.cacheLimit}</strong></div><div><span>Action registry</span><strong>${d.actionRegistrySize}</strong></div><div><span>Registry hits</span><strong>${d.actionRegistryHits}</strong></div><div><span>Fallback global</span><strong>${d.globalFallbacks}</strong></div><div><span>Registry misses</span><strong class="${d.registryMisses?'negative':'positive'}">${d.registryMisses}</strong></div><div><span>Parse / Exec</span><strong class="${d.parseErrors||d.executionErrors?'negative':'positive'}">${d.parseErrors} / ${d.executionErrors}</strong></div><div><span>eval / Function</span><strong class="positive">No</strong></div><div><span>Estado</span><strong class="${d.ok?'positive':'negative'}">${d.ok?'OK':'Revisar'}</strong></div></div><div class="notice"><strong>V31.23.4 · Action Registry Bridge:</strong> las acciones ejecutadas por atributos <code>data-tr-on*</code> se resuelven primero desde <code>TradingResearchActions</code>. Si una acción histórica todavía vive solo en <code>window</code>, se usa una vez como fallback y se cachea en el registro. La caché del parser usa LRU con límite rígido de <strong>${d.cacheLimit}</strong> entradas${d.cacheEvictions?` y ha expulsado ${d.cacheEvictions}`:''}.</div>${d.lastError?`<div class="notice danger"><strong>Delegación:</strong> ${esc(d.lastError)}</div>`:''}</section>`;
    return extra+html;
  };
  window.dataSecurityPanel=dataSecurityPanel;
}

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.23.4</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_EVENT_APP_LABEL)}</div><div class="help">Delegated Events resuelve acciones mediante un registro dedicado con fallback global observable y una caché AST LRU acotada.</div></div></div></div>`;};
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=v30ModeCard();}catch(_){/* next render will refresh */}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>render(),0);}catch(_){/* no forced render elsewhere */}
})();
/* ===== END V31.23.4 ACTION REGISTRY RUNTIME ===== */