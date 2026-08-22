import fs from 'node:fs';
import {projectGlobalSurface} from './global-surface-inventory.mjs';

const files=['app.js','style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
const report=projectGlobalSurface(files),d=report.combined,fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

need(d.objectAssignBlocks<=55,`La superficie Object.assign(window) volvió a crecer: ${d.objectAssignBlocks} > 55.`);
need(d.objectAssignUnique<=343,`Los exports únicos vía Object.assign(window) volvieron a crecer: ${d.objectAssignUnique} > 343.`);
need(d.totalUniqueGlobals<=369,`La superficie global explícita volvió a crecer: ${d.totalUniqueGlobals} > 369.`);
need(d.handlerDeclarations>=600,`Inventario de handlers inesperadamente bajo: ${d.handlerDeclarations}.`);
need(d.handlerBackedGlobals>=280,`Se perdió demasiada cobertura explícita de handlers: ${d.handlerBackedGlobals}.`);

const styleAttr=fs.readFileSync('style-attr-runtime.js','utf8');
const csp=fs.readFileSync('csp-runtime.js','utf8');
const style=fs.readFileSync('style-runtime.js','utf8');
const closure=fs.readFileSync('render-closure-runtime.js','utf8');
const events=fs.readFileSync('event-runtime.js','utf8');
need(!styleAttr.includes('Object.assign(window,{trStyleAttrDiagnostics})'),'Style Attribute runtime reintrodujo alias diagnóstico global.');
need(!csp.includes('Object.assign(window,{trCspDiagnostics,trCspProbeHeader,trCspRuntimePanel})'),'CSP runtime reintrodujo aliases diagnósticos globales.');
need(!style.includes('Object.assign(window,{trStyleDiagnostics,trStyleResetInventory,trStyleRuntimePanel})'),'Style runtime reintrodujo aliases diagnósticos globales.');
need(!closure.includes('Object.assign(window,{trRenderClosureDiagnostics,trRenderClosurePanel})'),'Render Closure reintrodujo aliases diagnósticos globales.');
need(style.includes('window.TradingResearchActions.trStyleResetInventory=trStyleResetInventory'),'La acción Reiniciar muestra no está registrada en TradingResearchActions.');
need(events.includes('const trActionRegistry=(window.TradingResearchActions'),'Event Runtime no consume el Action Registry.');

const app=report.perFile['app.js'];
need(app.objectAssignBlocks===51,`app.js cambió su inventario antes de la fase dedicada: ${app.objectAssignBlocks} bloques, esperados 51.`);
need(app.objectAssignUnique===332,`app.js cambió sus exports únicos antes de la fase dedicada: ${app.objectAssignUnique}, esperados 332.`);

if(fail.length){console.error('\nGlobal surface verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('Global surface verification OK');
console.log(` - Explicit global surface: ${d.totalUniqueGlobals} (ceiling 369; V31.23.4 baseline was 378)`);
console.log(` - Object.assign(window) blocks: ${d.objectAssignBlocks} (ceiling 55; baseline 59)`);
console.log(` - Object.assign unique exports: ${d.objectAssignUnique} (ceiling 343; baseline 352)`);
console.log(' - Removed duplicate aliases: StyleAttr 1 + CSP 3 + Style 3 + Render Closure 2 = 9');
console.log(' - trStyleResetInventory moved to TradingResearchActions instead of window');
console.log(' - app.js legacy surface frozen at 51 blocks / 332 unique exports for next phase');
