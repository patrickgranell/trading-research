const TR_EVENT_TYPES=['click','change','input','submit'];
const TR_SLOT_PREFIX='__TR_EVENT_SLOT_';
const TR_SLOT_RE=/__TR_EVENT_SLOT_(\d+)__/g;

function isId0(c){return !!c&&/[A-Za-z_$]/.test(c);}
function isId(c){return !!c&&/[A-Za-z0-9_$]/.test(c);}
function isDigit(c){return !!c&&/[0-9]/.test(c);}

function tokenize(src){
  const out=[];let i=0,n=src.length;
  while(i<n){
    let c=src[i];if(/\s/.test(c)){i++;continue;}
    if(c==="'"||c==='"'){
      const q=c;let s='',raw=q;i++;let closed=false;
      while(i<n){c=src[i++];raw+=c;if(c===q){closed=true;break;}if(c==='\\'){if(i>=n)throw new SyntaxError('Cadena incompleta');const e=src[i++];raw+=e;const map={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0'};s+=map[e]??e;}else s+=c;}
      if(!closed)throw new SyntaxError('Cadena sin cerrar');out.push({t:'str',v:s,raw});continue;
    }
    if(isDigit(c)||(c==='.'&&isDigit(src[i+1]))){
      let j=i+1;while(j<n&&/[0-9.eE_+-]/.test(src[j])){if((src[j]==='+'||src[j]==='-')&&!/[eE]/.test(src[j-1]))break;j++;}
      const raw=src.slice(i,j).replaceAll('_',''),v=Number(raw);if(!Number.isFinite(v))throw new SyntaxError('Número inválido: '+raw);out.push({t:'num',v,raw});i=j;continue;
    }
    if(isId0(c)){let j=i+1;while(j<n&&isId(src[j]))j++;const raw=src.slice(i,j);out.push({t:'id',v:raw,raw});i=j;continue;}
    const ops=['?.','!==','===','!=','==','>=','<=','&&','||'];const op=ops.find(x=>src.startsWith(x,i));if(op){out.push({t:'p',v:op,raw:op});i+=op.length;continue;}
    if('()[]{}.,:;=!-+<>'.includes(c)){out.push({t:'p',v:c,raw:c});i++;continue;}
    throw new SyntaxError("Token no permitido '"+c+"'");
  }
  out.push({t:'eof',v:'',raw:''});return out;
}

function parse(src){
  const toks=tokenize(src);let p=0;const cur=()=>toks[p],eat=v=>cur().v===v?(p++,true):false,need=v=>{if(!eat(v))throw new SyntaxError("Se esperaba '"+v+"' y llegó '"+(cur().raw||'EOF')+"'");};
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
      p++;if(x.v==='true')return {t:'lit',v:true};if(x.v==='false')return {t:'lit',v:false};if(x.v==='null')return {t:'lit',v:null};if(x.v==='undefined')return {t:'lit'};if(x.v==='this')return {t:'this'};return {t:'id',n:x.v};
    }
    if(eat('(')){const e=expr();need(')');return e;}
    if(eat('[')){const a=[];if(!eat(']')){do{a.push(expr());}while(eat(','));need(']');}return {t:'arr',a};}
    if(eat('{')){const a=[];if(!eat('}')){do{const k=cur();if(!['id','str','num'].includes(k.t))throw new SyntaxError('Clave de objeto inválida');p++;need(':');a.push([String(k.v),expr()]);}while(eat(','));need('}');}return {t:'obj',a};}
    throw new SyntaxError("Expresión inesperada '"+(x.raw||'EOF')+"'");
  }
  function postfix(a){
    while(true){
      let optional=false;if(eat('?.'))optional=true;
      if(optional||eat('.')){const k=cur();if(k.t!=='id')throw new SyntaxError('Miembro sin identificador');p++;a={t:'mem',o:a,k:{t:'lit',v:k.v},c:false,opt:optional};continue;}
      if(eat('[')){const k=expr();need(']');a={t:'mem',o:a,k,c:true,opt:false};continue;}
      if(eat('(')){const args=[];if(!eat(')')){do{args.push(expr());}while(eat(','));need(')');}a={t:'call',f:a,args,opt:optional};continue;}
      break;
    }
    return a;
  }
  const ast=program();if(cur().t!=='eof')throw new SyntaxError('Tokens sobrantes');return ast;
}

function readInterpolation(src,start){
  if(src.slice(start,start+2)!=='${')throw new Error('Interpolation start esperado.');
  let i=start+2,depth=1,quote='';
  while(i<src.length){
    const c=src[i];
    if(quote){if(c==='\\'){i+=2;continue;}if(c===quote){quote='';i++;continue;}i++;continue;}
    if(c==="'"||c==='"'){quote=c;i++;continue;}
    if(c==='{'){depth++;i++;continue;}
    if(c==='}'){depth--;if(depth===0)return {expr:src.slice(start+2,i),end:i+1};i++;continue;}
    if(c==='`')throw new SyntaxError('Template literal anidado dentro de handler dinámico no permitido.');
    i++;
  }
  throw new SyntaxError('Interpolación sin cerrar.');
}

function splitDynamic(raw){
  let skeleton='',expressions=[],i=0;
  while(i<raw.length){
    const at=raw.indexOf('${',i);
    if(at<0){skeleton+=raw.slice(i);break;}
    skeleton+=raw.slice(i,at);const part=readInterpolation(raw,at),slot=expressions.length;
    skeleton+=TR_SLOT_PREFIX+slot+'__';expressions.push(part.expr);i=part.end;
  }
  return {skeleton,expressions};
}

function normalizeLiteralString(value){
  const s=String(value);TR_SLOT_RE.lastIndex=0;let m,last=0,parts=[];
  while((m=TR_SLOT_RE.exec(s))){if(m.index>last)parts.push({t:'lit',v:s.slice(last,m.index)});parts.push({t:'slot',i:Number(m[1]),str:true});last=m.index+m[0].length;}
  if(!parts.length)return {t:'lit',v:value};if(last<s.length)parts.push({t:'lit',v:s.slice(last)});
  return parts.length===1?parts[0]:{t:'cat',a:parts};
}
function normalizeAst(node){
  if(!node||typeof node!=='object')return node;
  if(node.t==='lit'&&typeof node.v==='string')return normalizeLiteralString(node.v);
  if(node.t==='id'){const m=String(node.n||'').match(/^__TR_EVENT_SLOT_(\d+)__$/);return m?{t:'slot',i:Number(m[1])}:node;}
  if(node.t==='prog')return {...node,body:node.body.map(normalizeAst)};
  if(node.t==='exprs')return {...node,e:normalizeAst(node.e)};
  if(node.t==='ret')return {...node,arg:normalizeAst(node.arg)};
  if(node.t==='arr')return {...node,a:node.a.map(normalizeAst)};
  if(node.t==='obj')return {...node,a:node.a.map(([k,v])=>[k,normalizeAst(v)])};
  if(node.t==='mem')return {...node,o:normalizeAst(node.o),k:normalizeAst(node.k)};
  if(node.t==='call')return {...node,f:normalizeAst(node.f),args:node.args.map(normalizeAst)};
  if(node.t==='assign')return {...node,left:normalizeAst(node.left),right:normalizeAst(node.right)};
  if(node.t==='un')return {...node,x:normalizeAst(node.x)};
  if(node.t==='bin')return {...node,a:normalizeAst(node.a),b:normalizeAst(node.b)};
  return node;
}
function validateStaticActionShape(ast){
  let rejected=0;
  const walk=node=>{
    if(!node||typeof node!=='object')return;
    if(node.t==='call'){const f=node.f;if(f?.t==='slot'||f?.t==='cat')rejected++;if(f?.t==='mem'&&(f.k?.t==='slot'||f.k?.t==='cat'))rejected++;}
    for(const [k,v] of Object.entries(node)){if(k==='t')continue;if(Array.isArray(v)){for(const x of v){if(Array.isArray(x))walk(x[1]);else walk(x);}}else walk(v);}
  };
  walk(ast);return rejected;
}

function plausibleTagStart(src,i){
  if(src[i]!=='<')return false;let p=i+1;while(/\s/.test(src[p]||''))p++;
  if(!/[A-Za-z]/.test(src[p]||''))return false;p++;while(/[A-Za-z0-9:-]/.test(src[p]||''))p++;
  return src[p]===undefined||/[\s/>`]/.test(src[p]);
}
function openTagStartBefore(src,at){
  for(let i=at-1;i>=0;i--){if(src[i]!=='<'||!plausibleTagStart(src,i))continue;let quote='',ok=true;
    for(let p=i+1;p<at;p++){const c=src[p];if(quote){if(c===quote&&src[p-1]!=='\\')quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='>'){ok=false;break;}}
    if(ok)return i;
  }
  return -1;
}
function readHandlerAttribute(src,at){
  const prefix='data-tr-on';if(src.slice(at,at+prefix.length)!==prefix)return null;
  let p=at+prefix.length,type='';for(const t of TR_EVENT_TYPES)if(src.startsWith(t,p)){type=t;p+=t.length;break;}if(!type)return null;
  if(/[A-Za-z0-9_-]/.test(src[p]||''))return null;while(/\s/.test(src[p]||''))p++;if(src[p]!=='=')return null;p++;while(/\s/.test(src[p]||''))p++;
  const q=src[p];if(q!=='"'&&q!=="'")return null;const valueStart=++p;
  while(p<src.length){
    if(src.startsWith('${',p)){const part=readInterpolation(src,p);p=part.end;continue;}
    if(src[p]===q&&src[p-1]!=='\\')return {type,valueStart,valueEnd:p,end:p+1,quote:q,raw:src.slice(valueStart,p)};
    p++;
  }
  throw new SyntaxError('Atributo '+prefix+type+' sin cerrar.');
}
function nextPlanId(index){return '__tr_evt_'+String(index).padStart(4,'0');}

export function transformStructuredEventSources(entries){
  const plans=Object.create(null),keyToId=new Map(),sources=Object.create(null),byFile={},errors=[];
  let converted=0,dynamicSlots=0,dynamicActionRejected=0,nextId=1;
  for(const entry of entries){
    const name=entry.name,src=String(entry.source??'');let out='',last=0,fileConverted=0;
    for(let i=0;i<src.length-10;i++){
      if(src[i]!=='d'||!src.startsWith('data-tr-on',i))continue;
      if(openTagStartBefore(src,i)<0)continue;
      let attr;try{attr=readHandlerAttribute(src,i);}catch(e){errors.push({file:name,at:i,error:e.message});break;}
      if(!attr)continue;
      const split=splitDynamic(attr.raw);
      if(split.skeleton.trim()===TR_SLOT_PREFIX+'0__'&&split.expressions.length===1){
        dynamicActionRejected++;errors.push({file:name,at:i,error:'Nombre/programa de acción dinámico rechazado.',raw:attr.raw});i=attr.end-1;continue;
      }
      let ast;try{ast=normalizeAst(parse(split.skeleton));}catch(e){errors.push({file:name,at:i,error:e.message,raw:attr.raw});i=attr.end-1;continue;}
      const rejected=validateStaticActionShape(ast);dynamicActionRejected+=rejected;
      if(rejected){errors.push({file:name,at:i,error:'Callee dinámico rechazado.',raw:attr.raw});i=attr.end-1;continue;}
      const key=JSON.stringify(ast);let id=keyToId.get(key);if(!id){id=nextPlanId(nextId++);keyToId.set(key,id);plans[id]=ast;}
      let repl='data-tr-action-'+attr.type+'="'+id+'"';
      if(split.expressions.length){
        repl+=' data-tr-args-'+attr.type+'="${encodeURIComponent(JSON.stringify(['+split.expressions.join(',')+']))}"';
        dynamicSlots+=split.expressions.length;
      }
      out+=src.slice(last,i)+repl;last=attr.end;converted++;fileConverted++;i=attr.end-1;
    }
    sources[name]=out+src.slice(last);byFile[name]=fileConverted;
  }
  if(errors.length){const e=new Error('Structured event transform rejected '+errors.length+' handler(s).');e.failures=errors;e.dynamicActionRejected=dynamicActionRejected;throw e;}
  return {sources,plans,inventory:{converted,uniquePlans:Object.keys(plans).length,dynamicSlots,dynamicActionRejected,legacyProgramHandlers:0,byFile}};
}

export function injectStructuredEventPlans(source,plans){
  const marker='__TR_EVENT_COMPILED_PLANS__';
  if(!String(source).includes(marker))throw new Error('Event Runtime plan marker no encontrado.');
  return String(source).replace(marker,JSON.stringify(plans));
}

export function structuredEventTransformSelfTest(){
  const failures=[];let dynamicActionRejected=0;
  try{
    const input='function row(o){return `<button data-tr-onclick="viewOperation(\\'${o.id}\\')">Ver</button>`;}';
    const got=transformStructuredEventSources([{name:'fixture.js',source:input}]),src=got.sources['fixture.js'];
    if(!src.includes('data-tr-action-click="__tr_evt_'))failures.push('action attr missing');
    if(!src.includes('encodeURIComponent(JSON.stringify([o.id]))'))failures.push('safe args serialization missing');
    if(src.includes('data-tr-onclick='))failures.push('legacy program attr remained');
    const malicious="x');PWN();String('x",encoded=encodeURIComponent(JSON.stringify([malicious]));
    if(encoded.includes('PWN()'))failures.push('malicious value was not encoded as inert data');
    const planText=JSON.stringify(got.plans);if((planText.match(/viewOperation/g)||[]).length!==1||planText.includes('PWN'))failures.push('malicious value altered compiled plan');
  }catch(e){failures.push('basic fixture: '+e.message);}
  try{transformStructuredEventSources([{name:'dynamic.js',source:'const x=`<button data-tr-onclick="${action}">X</button>`;'}]);failures.push('dynamic action was accepted');}
  catch(e){dynamicActionRejected=Number(e.dynamicActionRejected)||1;}
  return {ok:failures.length===0,failures,dynamicActionRejected};
}
export const selfTest=structuredEventTransformSelfTest;
