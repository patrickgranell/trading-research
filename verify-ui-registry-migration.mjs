import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {migrateStateActionsToRegistry} from './state-registry-migration-transform.mjs';
import * as U from './ui-registry-migration-transform.mjs';
import {remainingGlobalContractMap} from './remaining-global-contract-map.mjs';
import {transformStateActions} from './state-action-transform.mjs';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
const raw=Object.fromEntries(runtimeFiles.map(f=>[f,fs.readFileSync(f,'utf8')]));
const render=consolidateLegacyRenderAssignments(app,{expected:12});
const pruned=pruneAppGlobalExports(render.source,{runtimeSources:Object.values(raw)});
const stateMigrated=migrateStateActionsToRegistry(pruned.source);
const transformedState=transformStateActions(raw['state-runtime.js']).source;
const runtimeSources=runtimeFiles.map(f=>f==='state-runtime.js'?transformedState:raw[f]);
const mapBefore=remainingGlobalContractMap(stateMigrated.source,{runtimeSources,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
const handlerFrontier=new Set(mapBefore.names.migrationFrontiers.handlerOnly);
for(const name of U.TR_UI_REGISTRY_MIGRATION_NAMES)if(!handlerFrontier.has(name))throw new Error(`UI Registry Migration: ${name} no pertenece a la frontera handler-only segura.`);
const migrated=U.migrateUiHandlersToRegistry(stateMigrated.source),inv=migrated.inventory,after=globalSurfaceInventory(migrated.source);
const mapAfter=remainingGlobalContractMap(migrated.source,{runtimeSources,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
if(U.TR_UI_REGISTRY_MIGRATION_VERSION!=='31.23.47')throw new Error(`Versión UI inesperada: ${U.TR_UI_REGISTRY_MIGRATION_VERSION}`);
if(U.TR_UI_REGISTRY_FINAL_BINDING_VERSION!=='31.23.41'||inv.finalBindingVersion!=='31.23.41')throw new Error(`Versión final-binding UI inesperada: ${inv.finalBindingVersion}`);
const batches=Array.from({length:28},(_,i)=>U[`TR_UI_REGISTRY_MIGRATION_BATCH_${i+1}`]);
if(batches.slice(0,27).some(b=>b.length!==8)||batches[27].length!==5||U.TR_UI_REGISTRY_MIGRATION_NAMES.length!==221)throw new Error(`Lotes UI inesperados: ${batches.map(b=>b.length).join('+')}.`);
if(inv.finalBindingRefreshEntries!==221)throw new Error(`UI final-binding refresh inesperado: ${inv.finalBindingRefreshEntries}`);
if(inv.before.blocks!==42||inv.before.entries!==262||inv.before.unique!==230)throw new Error(`Entrada UI inesperada: blocks ${inv.before.blocks}, entries ${inv.before.entries}, unique ${inv.before.unique}.`);
if(inv.after.unique!==9)throw new Error(`Exports window únicos tras UI XXVIII: ${inv.after.unique}; se esperaban 9.`);
if(mapAfter.remainingUnique!==9||mapAfter.classified!==9||mapAfter.unclassified!==0)throw new Error(`Mapa contractual UI post-migración inesperado: ${mapAfter.classified}/${mapAfter.remainingUnique}, sin clasificar ${mapAfter.unclassified}.`);
if((mapAfter.byPrimary['state-action']||0)!==4||(mapAfter.byPrimary['ui-handler']||0)!==2||(mapAfter.byPrimary['dynamic-action']||0)!==3)throw new Error(`Primarios UI post-migración inesperados: State ${mapAfter.byPrimary['state-action']||0}, UI ${mapAfter.byPrimary['ui-handler']||0}, dinámico ${mapAfter.byPrimary['dynamic-action']||0}.`);
if(mapAfter.names.migrationFrontiers.stateOnly.length!==0)throw new Error('La frontera State se reabrió durante UI XXVIII.');
if(mapAfter.names.migrationFrontiers.handlerOnly.length!==0)throw new Error(`Frontera handler-only tras UI XXVIII: ${mapAfter.names.migrationFrontiers.handlerOnly.length}; se esperaba 0.`);
if(mapAfter.coverage.crossRuntimeRead!==0)throw new Error(`UI XXVIII reabrió ${mapAfter.coverage.crossRuntimeRead} lecturas cross-runtime.`);
for(const name of U.TR_UI_REGISTRY_MIGRATION_NAMES){if(after.names.objectAssign.includes(name))throw new Error(`${name} sigue en Object.assign(window,...).`);if(!migrated.source.includes(name))throw new Error(`Se perdió binding léxico UI ${name}.`);}

const historicalAssigns=[...stateMigrated.source.matchAll(/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g)],late=[];
for(const name of U.TR_UI_REGISTRY_MIGRATION_NAMES){let lastPublish=-1;for(const m of historicalAssigns)if(m[1].split(',').map(x=>x.trim()).includes(name))lastPublish=Math.max(lastPublish,m.index||0);if(lastPublish<0)continue;for(const m of stateMigrated.source.matchAll(new RegExp(`\\b${name}\\s*=(?!=)`,'g')))if((m.index||0)>lastPublish){late.push(name);break;}}
const lateNames=[...new Set(late)].sort(),allowedLate=new Set(['applyRiskToOperation','dashboardResetDraft','labReset','openDashboardCustomizer','saveDashboardCustomization']);
if(lateNames.some(n=>!allowedLate.has(n)))throw new Error(`Deuda late-binding UI inesperada: ${lateNames.join(',')||'none'}`);
const finalMarker='/* V31.23.41 UI final binding closure */',finalIdx=migrated.source.lastIndexOf(finalMarker),finalPublish=`Object.assign(trAppUiActionRegistryV340,{${U.TR_UI_REGISTRY_MIGRATION_NAMES.join(',')}});`;
if(finalIdx<0||!migrated.source.trim().endsWith(finalMarker))throw new Error('UI final binding closure no está al final del transform UI.');
if(!migrated.source.includes(finalPublish)||!migrated.source.includes("Object.defineProperty(trAppUiActionRegistryV340,'__trUiFinalBindingClosure',{value:221"))throw new Error('UI final binding publication/marker incompleto.');
for(const name of U.TR_UI_REGISTRY_MIGRATION_NAMES)for(const m of migrated.source.matchAll(new RegExp(`\\b${name}\\s*=(?!=)`,'g')))if((m.index||0)>finalIdx)throw new Error(`${name} se redefine después del UI final binding closure.`);

console.log('UI Registry Migration XXVIII measurement OK');
console.log(` - UI handlers migrated: ${U.TR_UI_REGISTRY_MIGRATION_NAMES.length}`);
console.log(` - Explicit window blocks: ${inv.before.blocks} -> ${inv.after.blocks}`);
console.log(` - Explicit window entries: ${inv.before.entries} -> ${inv.after.entries}`);
console.log(` - Explicit window unique exports: ${inv.before.unique} -> ${inv.after.unique}`);
console.log(` - Registry publications: ${inv.registryEntries} historical + ${inv.finalBindingRefreshEntries} final-binding refresh; batch XXVIII ${inv.batch28Entries}`);
console.log(` - Handler-only frontier: ${mapBefore.names.migrationFrontiers.handlerOnly.length} -> ${mapAfter.names.migrationFrontiers.handlerOnly.length}`);
console.log(` - Batch UI XXVIII: ${U.TR_UI_REGISTRY_MIGRATION_BATCH_28.join(', ')}`);
console.log(` - Final binding closure: V${inv.finalBindingVersion}; historical late redefines covered: ${lateNames.join(', ')||'none'}`);
