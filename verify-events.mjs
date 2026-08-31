import fs from 'node:fs';
import {structuredEventTransformSelfTest} from './structured-event-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const security=fs.readFileSync('security-runtime.js','utf8');
const closure=fs.readFileSync('render-closure-runtime.js','utf8');
const evt=fs.readFileSync('event-runtime.js','utf8');
const styleBoundary=fs.readFileSync('style-attr-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const fail=[];const need=(x,m)=>{if(!x)fail.push(m);};
const executableAttr=/\s(?:onclick|onchange|oninput|onsubmit)\s*=/g;
const legacyProgramAttr=/\sdata-tr-on(?:click|change|input|submit)\s*=/g;
const structuredAttr=/\sdata-tr-action-(?:click|change|input|submit)\s*=/g;

need(pkg.version==='31.23.0',`Versión inesperada ${pkg.version}`);
need(index.includes('<script src="event-runtime.js"></script>'),'index.html no carga event-runtime.js.');
need(index.includes('<script src="render-closure-runtime.js"></script>'),'index.html no carga render-closure-runtime.js.');
need(index.indexOf('event-runtime.js')>index.indexOf('security-runtime.js'),'event-runtime.js debe cargar después de security-runtime.js.');
need(index.indexOf('render-closure-runtime.js')>index.indexOf('event-runtime.js'),'render closure debe cargar después de instalar la delegación de eventos.');

for(const [name,src] of [['app.js',app],['structural-runtime.js',structural],['state-runtime.js',stateRuntime],['security-runtime.js',security],['render-closure-runtime.js',closure]]){
  const n=(src.match(executableAttr)||[]).length;need(n===0,`${name}: quedan ${n} handlers HTML ejecutables.`);
}
const sourceLegacy=[app,structural,stateRuntime,security,closure].reduce((n,src)=>n+(src.match(legacyProgramAttr)||[]).length,0);
const sourceStructured=[app,structural,stateRuntime,security,closure].reduce((n,src)=>n+(src.match(structuredAttr)||[]).length,0);
need(sourceLegacy>500,`Solo se detectan ${sourceLegacy} handlers legacy de fuente; revisar inventario antes de aceptar una caída grande.`);

need(evt.includes("const TR_EVENT_RUNTIME_VERSION='31.24.0'"),'Event Runtime no está en V31.24.');
need(evt.includes("const TR_EVENT_TYPES=['click','change','input','submit']"),'Faltan los cuatro eventos delegados.');
need(evt.includes('document.addEventListener(t,trEventDispatch,false)'),'No se instalan listeners delegados en document.');
need(!evt.includes('function trEventParser(')&&!evt.includes('function trEventTokenize(')&&!evt.includes('trEventAstCache'),'El runtime todavía contiene parser/tokenizer/AST cache.');
need(!evt.includes('if(name in globalThis)'),'El runtime todavía contiene fallback global.');
need(evt.includes("const trActionRegistry=(window.TradingResearchActions"),'Falta TradingResearchActions.');
need(evt.includes('Object.prototype.hasOwnProperty.call(trActionRegistry,name)'),'El resolver no exige propiedad propia del Action Registry.');
need(evt.includes('data-tr-action-')&&evt.includes('data-tr-args-'),'Falta frontera action/args estructurada.');
need(evt.includes('JSON.parse(decodeURIComponent(raw))'),'Los argumentos estructurados no se decodifican como JSON URI-encoded.');
need(evt.includes('Promise.resolve(p).catch')&&evt.includes('trEventAsyncRejections++'),'Los rechazos async no se observan.');
need(evt.includes('legacyProgramHandlers')&&evt.includes('structuredHandlers'),'Diagnóstico de frontera incompleto.');
need(evt.includes('globalFallbacks:0')&&evt.includes('usesParser:false')&&evt.includes('usesEval:false'),'Diagnóstico no declara las propiedades exactas de la nueva frontera.');
need(!/new\s+Function\s*\(/.test(evt)&&!/\beval\s*\(/.test(evt),'Event Runtime usa ejecución dinámica.');

const self=structuredEventTransformSelfTest();
need(self.ok,`Structured event transform self-test falla: ${JSON.stringify(self.failures)}`);
need(Number(self.dynamicActionRejected)>=1,'El self-test no demuestra rechazo de action name dinámico.');

need(app.includes('function trLegacyStateCommand('),'Falta command boundary para antiguas mutaciones léxicas.');
for(const key of ['ops-risk-policy','gallery-reset','journal-set','journal-reset','lab-clear','lab-compare-clear','reports-compare-open'])need(app.includes(`case '${key}'`),`Falta comando ${key}.`);
need(styleBoundary.includes("const TR_RELEASE_READINESS_BRIDGE_VERSION='31.23.53'"),'Falta cierre release-readiness para handlers léxicos del Laboratorio.');
need(styleBoundary.includes('registry.labState=facade'),'labState no se publica como facade estrecha en TradingResearchActions.');
need(styleBoundary.includes('Object.preventExtensions(facade)'),'La facade labState debe ser no extensible.');
need(!styleBoundary.includes('window.labState='),'El cierre de Laboratorio reabrió window.labState.');

if(fail.length){console.error('\nStructured event source verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('Structured event source verification OK');
console.log(` - Legacy handler programs retained only as build input: ${sourceLegacy}`);
console.log(` - Explicit structured source handlers: ${sourceStructured}`);
console.log(' - Browser runtime parser/tokenizer/AST cache: 0');
console.log(' - globalThis action fallback: 0');
console.log(' - Resolution: own-property TradingResearchActions only');
console.log(' - Async Promise rejection observation: present');
console.log(' - Effective zero-program DOM is verified after build');
