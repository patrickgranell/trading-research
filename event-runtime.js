/* ===== V31.19 RUNTIME · Security Foundation II · Event Delegation ===== */
(()=>{
'use strict';
const TR_EVENT_RUNTIME_VERSION='31.19';
const TR_EVENT_APP_LABEL='V31.19 · Security Foundation II · Delegated Events';
const TR_EVENT_TYPES=['click','change','input','submit'];
const TR_EVENT_ATTR_PREFIX='data-tr-on';
const TR_BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);
const trEventAstCache=new Map();
let trEventDispatches=0,trEventParseErrors=0,trEventExecErrors=0,trEventLastError='',trEventListenersInstalled=false;

function trEventAttr(type){return `${TR_EVENT_ATTR_PREFIX}${type}`;}
function trEventDangerousKey(k){return TR_BLOCKED_KEYS.has(String(k));}

/* ---- Tiny parser for the historical handler grammar.
   It deliberately supports only the expressions present in Trading Research inline handlers:
   calls, member access, literals, arrays/objects, assignments, unary +/-/!, comparisons and sequences.
   No eval / Function constructor is used, so this boundary is compatible with a future strict CSP. ---- */
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
function trEventCompile(code){
  const src=String(code||'').trim();if(!src)return {t:'prog',body:[]};
  if(trEventAstCache.has(src))return trEventAstCache.get(src);
  try{const ast=trEventParser(src);trEventAstCache.set(src,ast);return ast;}catch(e){trEventParseErrors++;trEventLastError=`${e?.message||e} · ${src.slice(0,180)}`;throw e;}
}
function trEventRef(node,ctx){
  if(node.t==='id'){
    if(node.n==='event')return {obj:ctx,key:'event',value:ctx.event};
    if(node.n==='window'||node.n==='globalThis')return {obj:ctx,key:'window',value:globalThis};
    if(node.n==='document')return {obj:ctx,key:'document',value:document};
    if(!(node.n in globalThis))throw new ReferenceError(`Acción no expuesta: ${node.n}`);
    return {obj:globalThis,key:node.n,value:globalThis[node.n]};
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
        const r=trEventRef(node.left,ctx);if(r.obj!==globalThis)throw new Error('Asignación global no permitida');r.obj[r.key]=v;return v;
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
function trEventDiagnostics(){const a=trEventAuditDocument(document);return {version:TR_EVENT_RUNTIME_VERSION,listeners:trEventListenersInstalled?TR_EVENT_TYPES.length:0,delegatedHandlers:a.handlers,inlineHandlers:a.inlineHandlers,parseErrors:a.parseErrors,executionErrors:trEventExecErrors,dispatches:trEventDispatches,cacheSize:trEventAstCache.size,lastError:trEventLastError,usesEval:false,ok:trEventListenersInstalled&&a.inlineHandlers===0&&a.parseErrors===0&&!trEventExecErrors};}

trEventInstall();
window.TradingResearchEvents=Object.freeze({version:TR_EVENT_RUNTIME_VERSION,diagnostics:trEventDiagnostics,audit:trEventAuditDocument});
Object.assign(window,{trEventDiagnostics,trEventAuditDocument});

/* Security diagnostics are extended at the composed Datos y seguridad boundary. */
if(typeof dataSecurityPanel==='function'){
  const trEventDataSecurityBase=dataSecurityPanel;
  dataSecurityPanel=function(){
    const d=trEventDiagnostics();
    let html=trEventDataSecurityBase();
    html=html.replace('<div><span>Event delegation</span><strong>Parcial / pendiente</strong></div>',`<div><span>Event delegation</span><strong class="${d.ok?'positive':'negative'}">${d.ok?'OK':'Revisar'}</strong></div>`)
      .replace('Deuda explícita: la aplicación todavía conserva numerosos <code>onclick/onchange/oninput</code> históricos. Esta fase reduce la superficie de inyección sin fingir que existe una CSP estricta; la delegación global de eventos se abordará por módulos para no romper una base funcional ya validada.',`V31.19 elimina los handlers HTML ejecutables del DOM: click/change/input/submit se resuelven por listeners delegados y un intérprete restringido sin <code>eval</code> ni <code>Function</code>. Queda pendiente aplicar la CSP estricta a cabeceras/recursos externos.`);
    const extra=`<section class="card panel config-wide"><div class="panel-title"><div><h3>Delegación de eventos</h3><div class="help">V31.19 retira los handlers ejecutables del HTML y centraliza click/change/input/submit en listeners de documento.</div></div><span class="stable-pill ${d.ok?'':'warning'}">Delegated DOM</span></div><div class="integrity-kpis"><div><span>Listeners globales</span><strong>${d.listeners}</strong></div><div><span>Handlers delegados</span><strong>${d.delegatedHandlers}</strong></div><div><span>Handlers inline DOM</span><strong class="${d.inlineHandlers?'negative':'positive'}">${d.inlineHandlers}</strong></div><div><span>Parse errors</span><strong class="${d.parseErrors?'negative':'positive'}">${d.parseErrors}</strong></div><div><span>Exec errors</span><strong class="${d.executionErrors?'negative':'positive'}">${d.executionErrors}</strong></div><div><span>eval / Function</span><strong class="positive">No</strong></div><div><span>Estado</span><strong class="${d.ok?'positive':'negative'}">${d.ok?'OK':'Revisar'}</strong></div></div><div class="notice"><strong>V31.19 · Delegated Event Boundary:</strong> el runtime solo interpreta el subconjunto histórico necesario para acciones de UI y bloquea <code>eval</code>, <code>Function</code> y acceso a <code>constructor/prototype/__proto__</code>. La CSP estricta sigue pendiente para la siguiente fase.</div>${d.lastError?`<div class="notice danger"><strong>Delegación:</strong> ${esc(d.lastError)}</div>`:''}</section>`;
    return extra+html;
  };
  window.dataSecurityPanel=dataSecurityPanel;
}

v30ModeCard=function(){return `<div class="side-bottom"><div class="mini-card mode-card ${v30Ui.modeExpanded?'expanded':''}"><button class="mode-card-toggle" data-tr-onclick="toggleModeCard()"><span><small>Modo actual</small><strong>V31.19</strong></span><b class="mode-card-arrow">${v30Ui.modeExpanded?'▾':'▴'}</b></button><div class="mode-card-detail"><div class="mini-value">${esc(TR_EVENT_APP_LABEL)}</div><div class="help">Event Delegation cerrada: el DOM ya no ejecuta onclick/onchange/oninput/onsubmit. Las acciones pasan por listeners delegados y un intérprete restringido sin eval. Siguiente frontera: CSP estricta.</div></div></div></div>`;};
try{const side=document.querySelector('.side-bottom');if(side)side.outerHTML=v30ModeCard();}catch(_){/* next render will refresh */}
try{if(typeof currentView!=='undefined'&&currentView==='config'&&typeof configTab!=='undefined'&&configTab==='data')setTimeout(()=>render(),0);}catch(_){/* no forced render elsewhere */}
})();
/* ===== END V31.19 EVENT RUNTIME ===== */
