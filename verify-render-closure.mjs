import fs from 'node:fs';
import {consolidateLegacyRenderAssignments,renderDebtInventory} from './render-source-transform.mjs';
const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const closure=fs.readFileSync('render-closure-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};

let consolidated=null;
try{consolidated=consolidateLegacyRenderAssignments(app,{expected:12});}catch(e){fail.push(e?.message||String(e));}
const sourceDebt=renderDebtInventory(app);
const bundledDebt=consolidated?renderDebtInventory(consolidated.source):{assignments:-1,declarations:-1,topLevelCalls:-1,baseAliases:-1,destructiveRootWrites:-1};

need(sourceDebt.assignments===12,`Inventario fuente inesperado: ${sourceDebt.assignments} render=function; se esperaban 12 antes de la sustitución física.`);
need(sourceDebt.declarations===1,`Inventario fuente inesperado: ${sourceDebt.declarations} function render; se esperaba 1.`);
need(sourceDebt.topLevelCalls===5,`Inventario fuente inesperado: ${sourceDebt.topLevelCalls} llamadas top-level render(); se esperaban 5.`);
need(sourceDebt.baseAliases===5,`Inventario fuente inesperado: ${sourceDebt.baseAliases} aliases renderV*Base; se esperaban 5.`);
need(bundledDebt.assignments===0,`La consolidación deja ${bundledDebt.assignments} render=function en el app empaquetado.`);
need(bundledDebt.declarations===1,`La consolidación debe conservar exactamente el render bootstrap base; hay ${bundledDebt.declarations}.`);
need(bundledDebt.topLevelCalls===1,`El bundle debe conservar una única llamada bootstrap render(); hay ${bundledDebt.topLevelCalls}.`);
need(bundledDebt.baseAliases===0,`El bundle conserva ${bundledDebt.baseAliases} aliases renderV*Base muertos.`);
need(consolidated?.removed===12,`La consolidación eliminó ${consolidated?.removed??0}/12 assignments.`);
need(consolidated?.bootstrapCallsRemoved===4,`La consolidación eliminó ${consolidated?.bootstrapCallsRemoved??0}/4 llamadas bootstrap redundantes.`);
need(consolidated?.renderAliasesRemoved===5,`La consolidación eliminó ${consolidated?.renderAliasesRemoved??0}/5 aliases muertos.`);
need(structural.includes('/* Final runtime coordinator. This is the only render() used after bootstrap completes. */'),'Structural Runtime ya no declara el coordinador final esperado.');
need(structural.includes('window.render=render;'),'Structural Runtime no publica su coordinador.');
need(stateRuntime.includes('const trStateRenderBase=render;'),'State Runtime ya no captura el render estructural.');
need(stateRuntime.includes('trDomainRenderGuardBegin()')&&stateRuntime.includes('trDomainRenderGuardEnd()'),'State Runtime perdió el boundary read-only de render.');
need(stateRuntime.includes('window.render=render;'),'State Runtime no publica el render protegido.');
need(closure.includes("const TR_RENDER_CLOSURE_VERSION='31.23.3'"),'Render closure tiene versión inesperada.');
need(closure.includes('const trRenderClosureBase=window.render;'),'Render closure no captura el entry point final previo.');
need(closure.includes('function trCanonicalRenderEntry('),'Falta el entry point canónico.');
need(closure.includes('window.render=trCanonicalRenderEntry;'),'El entry point canónico no se publica globalmente.');
need(closure.includes('window.TradingResearchRender=TradingResearchRender;'),'Falta API TradingResearchRender.');
need(!closure.includes("document.getElementById('app').innerHTML=shell()"),'Render closure no debe volver a introducir un render destructivo propio.');
need(index.includes('<script src="render-closure-runtime.js"></script>'),'index.html no carga render-closure-runtime.js.');
need(index.indexOf('render-closure-runtime.js')>index.indexOf('style-runtime.js'),'render-closure-runtime.js debe cargar el último entre los runtimes locales.');

if(fail.length){console.error('\nCanonical render closure verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('Canonical render closure verification OK');
console.log(' - Production entry: Structural Runtime -> State read-only guard -> Render Closure');
console.log(` - Source legacy render assignments: ${sourceDebt.assignments}; bundled: ${bundledDebt.assignments}`);
console.log(` - Source top-level render calls: ${sourceDebt.topLevelCalls}; bundled bootstrap calls: ${bundledDebt.topLevelCalls}`);
console.log(` - Source renderV*Base aliases: ${sourceDebt.baseAliases}; bundled: ${bundledDebt.baseAliases}`);
console.log(` - Bundled destructive root writes: ${bundledDebt.destructiveRootWrites}`);
console.log(' - V31.23.3 keeps one bootstrap render and removes the four redundant remounts + five dead aliases');