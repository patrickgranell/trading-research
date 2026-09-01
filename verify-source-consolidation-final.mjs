import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {transformStructuredEventSources} from './structured-event-transform.mjs';

const PHASE='31.23.52';
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const readJson=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const exists=path=>fs.existsSync(path);

for(const path of [
  'dist/index.html','dist/_headers','dist/render-inventory.json','dist/state-action-inventory.json',
  'dist/app-global-prune-inventory.json','dist/state-registry-migration-inventory.json',
  'dist/ui-registry-migration-inventory.json','dist/residual-mirror-closure-inventory.json',
  'dist/dynamic-action-inventory.json','dist/prune-candidate-inventory.json',
  'dist/remaining-global-contract-map.json','dist/structured-event-inventory.json','dist/csp-manifest.json','dist/style-inventory.json'
])need(exists(path),`Falta ${path}`);

if(fail.length){console.error('Source Consolidation Final Audit FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}

const pkg=readJson('package.json');
const html=fs.readFileSync('dist/index.html','utf8');
const headers=fs.readFileSync('dist/_headers','utf8');
const render=readJson('dist/render-inventory.json');
const stateBridge=readJson('dist/state-action-inventory.json');
const state=readJson('dist/state-registry-migration-inventory.json');
const ui=readJson('dist/ui-registry-migration-inventory.json');
const residual=readJson('dist/residual-mirror-closure-inventory.json');
const dynamic=readJson('dist/dynamic-action-inventory.json');
const candidates=readJson('dist/prune-candidate-inventory.json');
const contracts=readJson('dist/remaining-global-contract-map.json');
const structuredEvents=readJson('dist/structured-event-inventory.json');
const csp=readJson('dist/csp-manifest.json');
const style=readJson('dist/style-inventory.json');

need(pkg.version==='31.24.0',`package.json no está en la versión final 31.24.0: ${pkg.version}`);

need(Number(render.source?.assignments)===12&&Number(render.bundled?.assignments)===0,'Render legacy closure cambió');
need(Number(render.source?.baseAliases)===5&&Number(render.bundled?.baseAliases)===0,'renderV*Base closure cambió');
need(Number(render.bundled?.destructiveRootWrites)===1,'Root write bootstrap dejó de ser único');

need(Number(stateBridge.targetActions)===61,'State Action Bridge target inventory cambió');
need(Number(stateBridge.crossRuntimeWindowReads)===0,'State Action Bridge reabrió lecturas cross-runtime');
need(Number(state.names?.length)===56,'State Registry Migration dejó de ser 56');
need(String(state.finalBindingVersion)==='31.23.41'&&Number(state.finalBindingRefreshEntries)===56,'State final-binding closure cambió');
need(Number(ui.names?.length)===221,'UI Registry Migration dejó de ser 221');
need(String(ui.finalBindingVersion)==='31.23.41'&&Number(ui.finalBindingRefreshEntries)===221,'UI final-binding closure cambió');

need(String(residual.version)==='31.23.50',`Residual/Dynamic Closure version inesperada ${residual.version}`);
need(Number(residual.after?.blocks)===0&&Number(residual.after?.entries)===0&&Number(residual.after?.unique)===0,'La superficie explícita final no es 0/0/0');
need(Number(residual.dynamicActionsClosed)===3,'No están cerradas las 3 dynamic actions');
need(Number(residual.legacyDragHandlersBefore)===4&&Number(residual.legacyDragHandlersAfter)===0,'Drag DOM0 closure no es 4 -> 0');
need(Number(residual.dragDelegatedListeners)===4,'Drag delegation no conserva 4 listeners');
for(const type of ['dragstart','dragend','dragover','drop'])need(Number(residual.dragAttributeConversions?.[type])===1,`Conversión ${type} inesperada`);

need(Number(contracts.remainingUnique)===0&&Number(contracts.classified)===0&&Number(contracts.unclassified)===0,'Remaining Global Contract Map no está cerrado');
need(Number(contracts.byPrimary?.['state-action']||0)===0&&Number(contracts.byPrimary?.['ui-handler']||0)===0&&Number(contracts.byPrimary?.['dynamic-action']||0)===0,'Quedan contratos primarios residuales');
need(Number(contracts.names?.migrationFrontiers?.stateOnly?.length||0)===0&&Number(contracts.names?.migrationFrontiers?.handlerOnly?.length||0)===0,'Se reabrió una frontera State/UI');
need(Number(contracts.coverage?.crossRuntimeRead||0)===0,'Se reabrió cross-runtime');
need(Number(candidates.safeCandidateCount)===0,'Quedan candidatos de poda contract-safe');
need(Number(dynamic.dynamicHandlerSlots)===0&&Number(dynamic.dynamicCandidateRoots)===8&&Number(dynamic.protectedDynamicGlobals)===3,'Inventario Dynamic Action Guard V31.24 cambió');
need(Number(structuredEvents.converted)>=600&&Number(structuredEvents.uniquePlans)>=300&&Number(structuredEvents.dynamicSlots)>=200,'Inventario Structured Event Boundary insuficiente');
need(Number(structuredEvents.dynamicActionRejected)===0&&Number(structuredEvents.legacyProgramHandlers)===0,'Structured Event Boundary conserva programas/acciones dinámicas rechazadas');
const finalStaticHtml=html.replace(/<script\s+[^>]*>[\s\S]*?<\/script>/gi,'');
need(!/\sdata-tr-on(?:click|change|input|submit)\s*=/.test(finalStaticHtml),'El HTML estático final conserva programas click/change/input/submit');
const finalScriptBlocks=[...html.matchAll(/<script\s+([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>/data-tr-(?:build|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|persistence-coalescing-runtime|backup-v2-runtime|security-runtime|event-runtime|cloud-v10-runtime|exit-lab-runtime|canonical-metrics-runtime|csp-runtime|style-runtime|operation-cleanup-runtime|blob-lifecycle-runtime|render-closure-runtime)=/.test(m[1]));
need(finalScriptBlocks.length===17,`Structured Event second-pass cubre ${finalScriptBlocks.length}/17 scripts propios.`);
let finalSecondPass=null;try{finalSecondPass=transformStructuredEventSources(finalScriptBlocks.map((m,i)=>({name:`final-bundle-${i}.js`,source:m[2]})));}catch(e){need(false,`Second-pass Structured Event audit falló: ${e.message}`);}
if(finalSecondPass)need(Number(finalSecondPass.inventory.converted)===0,`El bundle final conserva ${finalSecondPass.inventory.converted} handler(s) legacy compilables`);

const appMatch=html.match(/<script\s+data-tr-build="31\.23\.0">([\s\S]*?)<\/script>/i);
need(!!appMatch,'No se encontró el bloque app empaquetado');
const app=appMatch?.[1]||'';
need((app.match(/Object\.assign\(window,\{/g)||[]).length===0,'El app bundle volvió a publicar Object.assign(window,{...})');
for(const name of ['v311DashboardDragStart','v311DashboardDragEnd','v311DashboardDrop']){
  need(!new RegExp(`\\bwindow\\.${name}\\b`).test(app),`${name} volvió a window`);
  need(app.includes(name),`Se perdió binding léxico ${name}`);
}
need(app.includes("__trStateFinalBindingClosure',{value:56"),'Falta marker final-binding State 56');
need(app.includes("__trUiFinalBindingClosure',{value:221"),'Falta marker final-binding UI 221');
need(app.includes("__trResidualMirrorClosure',{value:5"),'Falta marker residual mirrors 5');
need(app.includes("__trDashboardUnitContractClosure',{value:1"),'Falta marker Dashboard Unit 1');
need(app.includes("__trDynamicActionContractClosure',{value:3"),'Falta marker Dynamic Action 3');
need(app.includes('__trDynamicDragDiagnostics'),'Falta diagnóstico delegado del drag');
for(const type of ['dragstart','dragend','dragover','drop'])need((app.match(new RegExp(`data-tr-on${type}=`,`g`))||[]).length===1,`data-tr-on${type} no aparece exactamente una vez`);
need((app.match(/(?:^|[\s<])(?:ondragstart|ondragend|ondragover|ondrop)\s*=/gm)||[]).length===0,'Quedan handlers drag DOM0 efectivos');

const cleanupMatch=html.match(/<script\s+data-tr-operation-cleanup-runtime="31\.23\.0">([\s\S]*?)<\/script>/i);
need(!!cleanupMatch,'No se encontró Operation Cleanup Runtime');
const cleanup=cleanupMatch?.[1]||'';
need(cleanup.includes("const TR_OPERATION_CLEANUP_VERSION='31.23.52'"),'Operation Cleanup Runtime no es V31.23.52');
need(cleanup.includes("Object.assign(registry,{openOperationModal,deleteOperation,deleteOperationImage})"),'Operation Cleanup no registra sus acciones');
need(cleanup.includes("__trOperationCleanupDiagnostics"),'Operation Cleanup no publica diagnóstico en Action Registry');
need(cleanup.includes("for(const im of o.images||[])await deleteImageBlob(im.id)")&&cleanup.includes("state.operations=state.operations.filter(x=>x.id!==id)"),'Eliminar operación no limpia operación + blobs');
need(cleanup.includes("await deleteImageBlob(imageId)")&&cleanup.includes("o.images=(o.images||[]).filter(x=>x.id!==imageId)"),'Eliminar captura no limpia blob + metadata');
need(!/Object\.assign\(window,\{/.test(cleanup),'Operation Cleanup reabrió Object.assign(window,...)');

need(Number(style.inlineAttributes)===66&&Number(style.effectiveInlineAttributes)===0,'Style Boundary final cambió');
need(!/(?:<|\s)style\s*=\s*["']/i.test(html),'dist conserva atributos style ejecutables');
need(/style-src-attr 'none'/.test(headers),'CSP no bloquea style-src-attr');
need(/script-src-attr 'none'/.test(headers),'CSP no bloquea script-src-attr');
need(!/'unsafe-eval'/.test(headers),'CSP contiene unsafe-eval');
need(String(csp.csp||'').includes("script-src-attr 'none'"),'CSP manifest perdió script-src-attr none');
need(String(csp.csp||'').includes("style-src-attr 'none'"),'CSP manifest perdió style-src-attr none');
need(!String(csp.csp||'').includes("'unsafe-eval'"),'CSP manifest contiene unsafe-eval');

const structural=spawnSync(process.execPath,['verify-structure.mjs'],{encoding:'utf8'});
need(structural.status===0,'verify-structure.mjs no está verde en Final Audit');
need(String(structural.stdout||'').includes('Financial regions unchanged vs 31.10.4: 7/7'),'Final Audit no pudo confirmar las 7/7 regiones financieras');

const invariants={
  packageVersion:'31.24.0',
  explicitWindow:{blocks:0,entries:0,exports:0},
  registries:{state:56,ui:221,operationCleanup:2},
  finalBindings:{state:56,ui:221,residualMirrors:5,dashboardUnit:1,dynamicActions:3},
  frontiers:{state:0,ui:0,crossRuntime:0},
  drag:{legacyDom0:0,delegates:4},
  operationCleanup:{deleteOperation:true,deleteOperationImage:true,imageBlobCleanup:true},
  render:{legacyAssignments:0,baseAliases:0,rootWrites:1},
  style:{effectiveInlineAttrs:0},
  csp:{scriptSrcAttr:'none',styleSrcAttr:'none',unsafeEval:false},
  financialRegions:'7/7',
  structuredEventSecondPass:{ownScripts:17,legacyHandlersConverted:0}
};

if(fail.length){
  console.error('Source Consolidation Final Audit FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}

const manifest={phase:PHASE,status:'PASS',generatedAt:new Date().toISOString(),invariants};
fs.writeFileSync('dist/source-consolidation-final-audit.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Source Consolidation Final Audit V31.23.52 PASS');
console.log(' - Package release version: 31.24.0');
console.log(' - Explicit app window action surface: 0 blocks / 0 entries / 0 exports');
console.log(' - Registry final bindings: State 56 / UI 221 / residual 5 / dashboard 1 / dynamic 3');
console.log(' - Operation Cleanup Controls: delete operation + delete image registered, image blobs cleaned');
console.log(' - Frontiers: State 0 / UI 0 / cross-runtime 0');
console.log(' - Dashboard drag: 0 DOM0 / 4 delegated listeners');
console.log(" - CSP: script-src-attr 'none' / style-src-attr 'none' / unsafe-eval absent");
console.log(' - Structured Event second-pass coverage: 17/17 own scripts; 0 legacy handlers converted');
console.log(' - Financial regions unchanged: 7/7');
