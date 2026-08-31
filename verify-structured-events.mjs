import fs from 'node:fs';
import vm from 'node:vm';

const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const evt=fs.readFileSync('event-runtime.js','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const app=fs.readFileSync('app.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const transform=fs.existsSync('structured-event-transform.mjs')?fs.readFileSync('structured-event-transform.mjs','utf8'):'';

need(pkg.version==='31.23.0',`Versión inesperada ${pkg.version}`);

/* D04/D11 reproduction against the historical runtime must stay explicit. */
need(evt.includes('function trEventParser(')&&evt.includes('function trEventCompile('),
  'D04 reproduction changed: historical runtime parser no longer found.');
need(evt.includes('if(name in globalThis)'),
  'D04 reproduction changed: globalThis fallback no longer found.');
need(evt.includes('trEventRun(trEventCompile(code),el,event);trEventDispatches++'),
  'D11 reproduction changed: historical dispatch shape not found.');
need(!evt.includes('asyncRejections'),
  'D11 reproduction changed: historical runtime already observes async rejections.');

{
  const context={
    console:{log(){},warn(){},error(){}},
    setTimeout(){},
    URL:{},
    Element:class {},
    document:{
      addEventListener(){},
      querySelector(){return null;},
      querySelectorAll(){return [];}
    },
    dataSecurityPanel:undefined,
    currentView:'',
    configTab:'',
    render(){},
    esc:x=>String(x),
    v30Ui:{modeExpanded:false}
  };
  context.window=context;
  context.PWN=()=>{context.pwned=(context.pwned||0)+1;};
  context.TradingResearchActions={viewOperation:()=>{context.viewed=(context.viewed||0)+1;}};
  vm.createContext(context);
  const instrumented=evt.replace(
    'function trEventInstall(){',
    'window.__trHistoricalEventTest={compile:trEventCompile,run:trEventRun,dispatch:trEventDispatch};\nfunction trEventInstall(){'
  );
  try{vm.runInContext(instrumented,context);}catch(e){fail.push('No se pudo ejecutar runtime histórico para reproducir D04: '+e.message);}
  if(context.__trHistoricalEventTest){
    try{
      const ast=context.__trHistoricalEventTest.compile("viewOperation('x');PWN();String('x')");
      context.__trHistoricalEventTest.run(ast,{}, {preventDefault(){},cancelBubble:false});
    }catch(e){fail.push('Exploit histórico D04 no pudo reproducirse: '+e.message);}
    need(context.pwned===1,'D04 reproduction: el programa inyectado no alcanzó el fallback global como esperaba el hallazgo.');
    need(context.viewed===1,'D04 reproduction: la llamada legítima no se ejecutó antes del payload.');
  }
}

/* Green-state requirements. */
need(transform.length>0,'Falta structured-event-transform.mjs.');
need(build.includes('transformStructuredEventSources'),'Build no compila handlers históricos a frontera estructurada.');
need(build.includes('structuredEventInventory'),'Build no emite inventario de la nueva frontera.');
need(evt.includes("const TR_EVENT_RUNTIME_VERSION='31.24.0'"),'Event Runtime no está en V31.24.');
need(!evt.includes('function trEventParser('),'El parser de código sigue en Event Runtime.');
need(!evt.includes('function trEventTokenize('),'El tokenizer de código sigue en Event Runtime.');
need(!evt.includes('trEventAstCache'),'La caché AST sigue existiendo tras retirar el parser.');
need(!evt.includes('name in globalThis'),'Sigue existiendo fallback a globalThis.');
need(evt.includes('Object.prototype.hasOwnProperty.call(trActionRegistry,name)'),
  'El resolver no está limitado a acciones propias de TradingResearchActions.');
need(evt.includes('data-tr-action-'),'Event Runtime no usa atributos de acción estructurados.');
need(evt.includes('data-tr-args-'),'Event Runtime no usa argumentos estructurados.');
need(evt.includes('decodeURIComponent')&&evt.includes('JSON.parse'),
  'Argumentos estructurados no se decodifican desde datos serializados.');
need(evt.includes('Promise.resolve')&&evt.includes('asyncRejections'),
  'D11: handlers async no quedan observados/contabilizados.');
need(evt.includes('structuredHandlers')&&evt.includes('legacyProgramHandlers'),
  'Diagnóstico no distingue frontera estructurada de programas legacy.');

need(transform.includes('encodeURIComponent(JSON.stringify('),
  'Transform no serializa valores dinámicos como datos seguros.');
need(transform.includes('dynamicActionRejected'),
  'Transform no bloquea nombres de acción construidos desde datos.');
need(transform.includes('selfTest'),
  'Transform no incluye self-test de inyección/escaping.');
need(transform.includes("x');PWN();String('x"),
  'Falta fixture adversarial del ID malicioso en el transform.');

if(fs.existsSync('dist/index.html')){
  const dist=fs.readFileSync('dist/index.html','utf8');
  need(!/\sdata-tr-on(?:click|change|input|submit)\s*=/.test(dist),
    'El artefacto final todavía contiene programas data-tr-on*.');
  need(/\sdata-tr-action-(?:click|change|input|submit)\s*=/.test(dist),
    'El artefacto final no contiene acciones estructuradas.');
}

/* Source sink remains a reproduction fixture; effective build must neutralize it. */
need(app.includes("data-tr-onclick=\"viewOperation('${o.id}')\""),
  'D04 source reproduction changed: viewOperation(o.id) sink no longer found.');

if(fail.length){
  console.error('Structured event boundary verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Structured event boundary verification OK');
console.log(' - historical exploit reproduced: injected ID could become a second program via global fallback');
console.log(' - effective build: zero data-tr-on* program attributes');
console.log(' - runtime: no tokenizer/parser/AST cache/globalThis fallback');
console.log(' - dispatcher: own-property TradingResearchActions only');
console.log(' - persisted values: URI-encoded JSON args, never executable source');
console.log(' - async handler rejections: observed + diagnostic counter');
