import fs from 'node:fs';
import {projectGlobalSurface} from './global-surface-inventory.mjs';

const files=['app.js',...['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js','cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js','style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js']];
const report=projectGlobalSurface(files),d=report.combined,fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

need(d.objectAssignBlocks<=55,`La superficie Object.assign(window) volvió a crecer: ${d.objectAssignBlocks} > 55.`);
need(d.objectAssignUnique<=343,`Los exports únicos vía Object.assign(window) volvieron a crecer: ${d.objectAssignUnique} > 343.`);
need(d.explicitWindowUnique<=372,`Las publicaciones explícitas window/globalThis volvieron a crecer: ${d.explicitWindowUnique} > 372.`);
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
console.log('Explicit window export verification OK');
console.log(` - Explicit window exports: ${d.explicitWindowUnique} (ceiling 372; full V31.24 source inventory)`);
console.log(` - Object.assign(window) blocks: ${d.objectAssignBlocks} (ceiling 55; baseline 59)`);
console.log(` - Object.assign unique exports: ${d.objectAssignUnique} (ceiling 343; baseline 352)`);
console.log(' - Removed duplicate aliases: StyleAttr 1 + CSP 3 + Style 3 + Render Closure 2 = 9');
console.log(' - trStyleResetInventory moved to TradingResearchActions instead of window');
console.log(' - Scope is explicit window/globalThis publications; classic top-level declarations are not claimed');
console.log(' - app.js legacy explicit export surface frozen at 51 blocks / 332 unique exports');
