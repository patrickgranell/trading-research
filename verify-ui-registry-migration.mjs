import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {migrateStateActionsToRegistry} from './state-registry-migration-transform.mjs';
import {migrateUiHandlersToRegistry,TR_UI_REGISTRY_MIGRATION_NAMES,TR_UI_REGISTRY_MIGRATION_BATCH_1,TR_UI_REGISTRY_MIGRATION_BATCH_2,TR_UI_REGISTRY_MIGRATION_BATCH_3,TR_UI_REGISTRY_MIGRATION_BATCH_4,TR_UI_REGISTRY_MIGRATION_BATCH_5,TR_UI_REGISTRY_MIGRATION_BATCH_6,TR_UI_REGISTRY_MIGRATION_BATCH_7,TR_UI_REGISTRY_MIGRATION_BATCH_8,TR_UI_REGISTRY_MIGRATION_BATCH_9,TR_UI_REGISTRY_MIGRATION_BATCH_10,TR_UI_REGISTRY_MIGRATION_BATCH_11,TR_UI_REGISTRY_MIGRATION_BATCH_12,TR_UI_REGISTRY_MIGRATION_BATCH_13,TR_UI_REGISTRY_MIGRATION_BATCH_14,TR_UI_REGISTRY_MIGRATION_BATCH_15,TR_UI_REGISTRY_MIGRATION_BATCH_16,TR_UI_REGISTRY_MIGRATION_BATCH_17,TR_UI_REGISTRY_MIGRATION_BATCH_18,TR_UI_REGISTRY_MIGRATION_BATCH_19,TR_UI_REGISTRY_MIGRATION_BATCH_20,TR_UI_REGISTRY_MIGRATION_BATCH_21,TR_UI_REGISTRY_MIGRATION_BATCH_22,TR_UI_REGISTRY_MIGRATION_BATCH_23,TR_UI_REGISTRY_MIGRATION_BATCH_24,TR_UI_REGISTRY_MIGRATION_VERSION,TR_UI_REGISTRY_FINAL_BINDING_VERSION} from './ui-registry-migration-transform.mjs';
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
for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)if(!handlerFrontier.has(name))throw new Error(`UI Registry Migration: ${name} no pertenece a la frontera handler-only segura.`);
const migrated=migrateUiHandlersToRegistry(stateMigrated.source),inv=migrated.inventory,after=globalSurfaceInventory(migrated.source);
const mapAfter=remainingGlobalContractMap(migrated.source,{runtimeSources,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
if(TR_UI_REGISTRY_MIGRATION_VERSION!=='31.23.43')throw new Error(`Versión UI inesperada: ${TR_UI_REGISTRY_MIGRATION_VERSION}`);
if(TR_UI_REGISTRY_FINAL_BINDING_VERSION!=='31.23.41'||inv.finalBindingVersion!=='31.23.41')throw new Error(`Versión final-binding UI inesperada: ${inv.finalBindingVersion}`);
const batches=[TR_UI_REGISTRY_MIGRATION_BATCH_1,TR_UI_REGISTRY_MIGRATION_BATCH_2,TR_UI_REGISTRY_MIGRATION_BATCH_3,TR_UI_REGISTRY_MIGRATION_BATCH_4,TR_UI_REGISTRY_MIGRATION_BATCH_5,TR_UI_REGISTRY_MIGRATION_BATCH_6,TR_UI_REGISTRY_MIGRATION_BATCH_7,TR_UI_REGISTRY_MIGRATION_BATCH_8,TR_UI_REGISTRY_MIGRATION_BATCH_9,TR_UI_REGISTRY_MIGRATION_BATCH_10,TR_UI_REGISTRY_MIGRATION_BATCH_11,TR_UI_REGISTRY_MIGRATION_BATCH_12,TR_UI_REGISTRY_MIGRATION_BATCH_13,TR_UI_REGISTRY_MIGRATION_BATCH_14,TR_UI_REGISTRY_MIGRATION_BATCH_15,TR_UI_REGISTRY_MIGRATION_BATCH_16,TR_UI_REGISTRY_MIGRATION_BATCH_17,TR_UI_REGISTRY_MIGRATION_BATCH_18,TR_UI_REGISTRY_MIGRATION_BATCH_19,TR_UI_REGISTRY_MIGRATION_BATCH_20,TR_UI_REGISTRY_MIGRATION_BATCH_21,TR_UI_REGISTRY_MIGRATION_BATCH_22,TR_UI_REGISTRY_MIGRATION_BATCH_23,TR_UI_REGISTRY_MIGRATION_BATCH_24];
if(batches.some(b=>b.length!==8)||TR_UI_REGISTRY_MIGRATION_NAMES.length!==192)throw new Error(`Los lotes UI I/XXIV deben contener 8 acciones cada uno: ${batches.map(b=>b.length).join('+')}.`);
if(inv.finalBindingRefreshEntries!==192)throw new Error(`UI final-binding refresh inesperado: ${inv.finalBindingRefreshEntries}`);
if(inv.before.blocks!==42||inv.before.entries!==262||inv.before.unique!==230)throw new Error(`Entrada UI inesperada: blocks ${inv.before.blocks}, entries ${inv.before.entries}, unique ${inv.before.unique}.`);
if(inv.registryEntries!==209||inv.batch24Entries!==8)throw new Error(`Publicaciones UI inesperadas: total ${inv.registryEntries}, lote XXIV ${inv.batch24Entries}.`);
if(inv.after.entries!==53)throw new Error(`Entries window tras UI XXIV: ${inv.after.entries}; se esperaban 53.`);
if(inv.after.unique!==38)throw new Error(`Exports window únicos tras UI XXIV: ${inv.after.unique}; se esperaban 38.`);
if(inv.after.blocks>20)throw new Error(`Bloques window tras UI XXIV no bajaron o se reabrieron: ${inv.after.blocks}.`);
if(mapAfter.remainingUnique!==38||mapAfter.classified!==38||mapAfter.unclassified!==0)throw new Error(`Mapa contractual UI post-migración inesperado: ${mapAfter.classified}/${mapAfter.remainingUnique}, sin clasificar ${mapAfter.unclassified}.`);
if((mapAfter.byPrimary['state-action']||0)!==4||(mapAfter.byPrimary['ui-handler']||0)!==31||(mapAfter.byPrimary['dynamic-action']||0)!==3)throw new Error(`Primarios UI post-migración inesperados: State ${mapAfter.byPrimary['state-action']||0}, UI ${mapAfter.byPrimary['ui-handler']||0}, dinámico ${mapAfter.byPrimary['dynamic-action']||0}.`);
if(mapAfter.names.migrationFrontiers.stateOnly.length!==0)throw new Error('La frontera State se reabrió durante UI XXIV.');
if(mapAfter.names.migrationFrontiers.handlerOnly.length!==29)throw new Error(`Frontera handler-only tras UI XXIV: ${mapAfter.names.migrationFrontiers.handlerOnly.length}; se esperaban 29.`);
if(mapAfter.coverage.crossRuntimeRead!==0)throw new Error(`UI XXIV reabrió ${mapAfter.coverage.crossRuntimeRead} lecturas cross-runtime.`);
for(const name of TR_UI_REGISTRY_MIGRATION_NAMES){if(after.names.objectAssign.includes(name))throw new Error(`${name} sigue en Object.assign(window,...).`);if(!migrated.source.includes(name))throw new Error(`Se perdió binding léxico UI ${name}.`);}

const historicalAssigns=[...stateMigrated.source.matchAll(/Object\.assign\(window,\{([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\}\);/g)],late=[];
for(const name of TR_UI_REGISTRY_MIGRATION_NAMES){
  let lastPublish=-1;for(const m of historicalAssigns)if(m[1].split(',').map(x=>x.trim()).includes(name))lastPublish=Math.max(lastPublish,m.index||0);
  if(lastPublish<0)continue;
  for(const m of stateMigrated.source.matchAll(new RegExp(`\\b${name}\\s*=(?!=)`,'g')))if((m.index||0)>lastPublish){late.push(name);break;}
}
const lateNames=[...new Set(late)].sort(),allowedLate=new Set(['applyRiskToOperation','dashboardResetDraft','saveDashboardCustomization']);
if(lateNames.some(n=>!allowedLate.has(n)))throw new Error(`Deuda late-binding UI inesperada: ${lateNames.join(',')||'none'}`);
const finalMarker='/* V31.23.41 UI final binding closure */',finalIdx=migrated.source.lastIndexOf(finalMarker),finalPublish=`Object.assign(trAppUiActionRegistryV340,{${TR_UI_REGISTRY_MIGRATION_NAMES.join(',')}});`;
if(finalIdx<0||!migrated.source.trim().endsWith(finalMarker))throw new Error('UI final binding closure no está al final del transform UI.');
if(!migrated.source.includes(finalPublish)||!migrated.source.includes("Object.defineProperty(trAppUiActionRegistryV340,'__trUiFinalBindingClosure',{value:192"))throw new Error('UI final binding publication/marker incompleto.');
for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)for(const m of migrated.source.matchAll(new RegExp(`\\b${name}\\s*=(?!=)`,'g')))if((m.index||0)>finalIdx)throw new Error(`${name} se redefine después del UI final binding closure.`);

console.log('UI Registry Migration XXIV verification OK');
console.log(` - UI handlers migrated: ${TR_UI_REGISTRY_MIGRATION_NAMES.length}`);
console.log(` - Explicit window blocks: ${inv.before.blocks} -> ${inv.after.blocks}`);
console.log(` - Explicit window entries: ${inv.before.entries} -> ${inv.after.entries}`);
console.log(` - Explicit window unique exports: ${inv.before.unique} -> ${inv.after.unique}`);
console.log(` - Registry publications: ${inv.registryEntries} historical + ${inv.finalBindingRefreshEntries} final-binding refresh; batch XXIV ${inv.batch24Entries}`);
console.log(` - Handler-only frontier: ${mapBefore.names.migrationFrontiers.handlerOnly.length} -> ${mapAfter.names.migrationFrontiers.handlerOnly.length}`);
console.log(` - Batch UI XXIV: ${TR_UI_REGISTRY_MIGRATION_BATCH_24.join(', ')}`);
console.log(` - Final binding closure: V${inv.finalBindingVersion}; historical late redefines covered: ${lateNames.join(', ')||'none'}`);
