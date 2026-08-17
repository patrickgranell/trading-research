import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const closure=fs.readFileSync('render-closure-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};

const legacyAssignments=(app.match(/\brender\s*=\s*function\s*\(/g)||[]).length;
const legacyDeclarations=(app.match(/\bfunction\s+render\s*\(/g)||[]).length;
const destructiveRootWrites=(app.match(/document\.getElementById\(['"]app['"]\)\.innerHTML\s*=\s*shell\(\)/g)||[]).length;

need(legacyAssignments<=24,`La deuda render=function creció: ${legacyAssignments} > 24.`);
need(legacyDeclarations<=1,`La deuda function render creció: ${legacyDeclarations} > 1.`);
need(structural.includes('/* Final runtime coordinator. This is the only render() used after bootstrap completes. */'),'Structural Runtime ya no declara el coordinador final esperado.');
need(structural.includes('window.render=render;'),'Structural Runtime no publica su coordinador.');
need(stateRuntime.includes('const trStateRenderBase=render;'),'State Runtime ya no captura el render estructural.');
need(stateRuntime.includes('trDomainRenderGuardBegin()')&&stateRuntime.includes('trDomainRenderGuardEnd()'),'State Runtime perdió el boundary read-only de render.');
need(stateRuntime.includes('window.render=render;'),'State Runtime no publica el render protegido.');
need(closure.includes("const TR_RENDER_CLOSURE_VERSION='31.23.1'"),'Render closure tiene versión inesperada.');
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
console.log(` - Legacy render assignments budget: ${legacyAssignments}/24`);
console.log(` - Legacy render declarations budget: ${legacyDeclarations}/1`);
console.log(` - Historical destructive root writes still inventoried: ${destructiveRootWrites}`);
console.log(' - New render debt cannot increase without failing prebuild');
