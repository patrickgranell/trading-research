import fs from 'node:fs';
import vm from 'node:vm';
import {transformStructuredEventSources,structuredEventTransformSelfTest,injectStructuredEventPlans} from './structured-event-transform.mjs';

const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const evt=fs.readFileSync('event-runtime.js','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const app=fs.readFileSync('app.js','utf8');
const transform=fs.readFileSync('structured-event-transform.mjs','utf8');

need(pkg.version==='31.23.0',`Versión inesperada ${pkg.version}`);
need(build.includes('transformStructuredEventSources'),'Build no compila handlers históricos a frontera estructurada.');
need(build.includes('structuredEventInventory'),'Build no emite inventario de la nueva frontera.');
need(build.includes("dist/structured-event-inventory.json"),'Build no persiste inventario estructurado.');

need(evt.includes("const TR_EVENT_RUNTIME_VERSION='31.24.0'"),'Event Runtime no está en V31.24.');
need(!evt.includes('function trEventParser('),'El parser de código sigue en Event Runtime.');
need(!evt.includes('function trEventTokenize('),'El tokenizer de código sigue en Event Runtime.');
need(!evt.includes('trEventAstCache'),'La caché AST sigue existiendo tras retirar el parser.');
need(!evt.includes('if(name in globalThis)'),'Sigue existiendo fallback a globalThis.');
need(evt.includes('Object.prototype.hasOwnProperty.call(trActionRegistry,name)'),'El resolver no está limitado a propiedades propias de TradingResearchActions.');
need(evt.includes('data-tr-action-')&&evt.includes('data-tr-args-'),'Event Runtime no usa action/args estructurados.');
need(evt.includes('JSON.parse(decodeURIComponent(raw))'),'Argumentos estructurados no se decodifican desde datos serializados.');
need(evt.includes('Promise.resolve(p).catch')&&evt.includes('trEventAsyncRejections++'),'D11: handlers async no quedan observados/contabilizados.');
need(evt.includes('structuredHandlers')&&evt.includes('legacyProgramHandlers'),'Diagnóstico no distingue frontera estructurada de programas legacy.');

need(transform.includes('encodeURIComponent(JSON.stringify('),'Transform no serializa valores dinámicos como datos seguros.');
need(transform.includes('dynamicActionRejected'),'Transform no bloquea nombres de acción construidos desde datos.');
need(transform.includes("x');PWN();String('x"),'Falta fixture adversarial del ID malicioso en el transform.');
const self=structuredEventTransformSelfTest();
need(self.ok,`Structured transform self-test falló: ${JSON.stringify(self.failures)}`);
need(Number(self.dynamicActionRejected)>=1,'El self-test no rechaza nombres de acción dinámicos.');

need(app.includes("data-tr-onclick=\"viewOperation('${o.id}')\""),'D04 source fixture cambió: revisar el sink persistido.');
const fixture="const row=o=>`<button data-tr-onclick=\"viewOperation('${o.id}')\">Ver</button>`;" ;
let compiled=null;
try{compiled=transformStructuredEventSources([{name:'fixture.js',source:fixture}]);}
catch(e){fail.push('No se pudo compilar fixture D04: '+e.message);}
if(compiled){
  const transformed=compiled.sources['fixture.js'];
  const planId=transformed.match(/data-tr-action-click="([^"]+)"/)?.[1]||'';
  need(!!planId,'Fixture D04 no produjo action ID estático.');
  need(!transformed.includes('data-tr-onclick='),'Fixture D04 conserva programa ejecutable.');
  need(transformed.includes('encodeURIComponent(JSON.stringify([o.id]))'),'Fixture D04 no serializa el ID como dato.');

  const malicious="x');PWN();String('x";
  const context={
    console:{log(){},warn(){},error(){}},
    setTimeout(){},
    Element:class {},
    document:{addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},documentElement:{classList:{add(){},remove(){}}}},
    dataSecurityPanel:undefined,currentView:'',configTab:'',render(){},esc:x=>String(x),v30Ui:{modeExpanded:false},
    pwned:0,received:null
  };
  context.window=context;
  context.PWN=()=>{context.pwned++;};
  context.TradingResearchActions={
    viewOperation:id=>{context.received=id;},
    asyncBoom:()=>Promise.reject(new Error('ASYNC_BOOM'))
  };
  vm.createContext(context);
  let runtime=injectStructuredEventPlans(evt,compiled.plans);
  runtime=runtime.replace('function trEventInstall(){','window.__trStructuredEventTest={invoke:trEventInvoke,diagnostics:trEventDiagnostics};\\nfunction trEventInstall(){');
  try{vm.runInContext(runtime,context);}
  catch(e){fail.push('No se pudo ejecutar Event Runtime V31.24 en fixture: '+e.message);}

  if(context.__trStructuredEventTest){
    const makeEl=attrs=>({getAttribute:key=>attrs[key]??null,hasAttribute:key=>Object.prototype.hasOwnProperty.call(attrs,key),parentElement:null});
    const event={preventDefault(){this.prevented=true;},cancelBubble:false,type:'click'};
    const el=makeEl({
      'data-tr-action-click':planId,
      'data-tr-args-click':encodeURIComponent(JSON.stringify([malicious]))
    });
    try{context.__trStructuredEventTest.invoke(planId,el,event,'click');}
    catch(e){fail.push('Invocación estructurada D04 falló: '+e.message);}
    need(context.received===malicious,'D04: el ID malicioso no llegó como valor literal exacto.');
    need(context.pwned===0,'D04: el ID malicioso volvió a ejecutar PWN como programa.');

    const asyncEl=makeEl({'data-tr-action-click':'asyncBoom'});
    try{context.__trStructuredEventTest.invoke('asyncBoom',asyncEl,event,'click');}
    catch(e){fail.push('Invocación async D11 lanzó síncronamente: '+e.message);}
    await Promise.resolve();await Promise.resolve();
    const d=context.__trStructuredEventTest.diagnostics();
    need(d.asyncObserved>=1,'D11: Promise async no fue observada.');
    need(d.asyncRejections===1,`D11: rejection async esperada 1, obtenida ${d.asyncRejections}.`);
  }
}

if(fs.existsSync('dist/index.html')){
  const dist=fs.readFileSync('dist/index.html','utf8');
  need(!/\sdata-tr-on(?:click|change|input|submit)\s*=/.test(dist),'El artefacto final todavía contiene programas data-tr-on*.');
  need(/\sdata-tr-action-(?:click|change|input|submit)\s*=/.test(dist),'El artefacto final no contiene acciones estructuradas.');
}

if(fail.length){
  console.error('Structured event boundary verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Structured event boundary verification OK');
console.log(' - malicious persisted ID remains literal data; secondary PWN action executed: 0');
console.log(' - runtime tokenizer/parser/AST cache/global action fallback: 0');
console.log(' - dispatcher resolves own-property TradingResearchActions only');
console.log(' - dynamic values travel as URI-encoded JSON slots');
console.log(' - async rejected Promise is observed and counted');
