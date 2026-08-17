import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {migrateStateActionsToRegistry,TR_STATE_REGISTRY_MIGRATION_NAMES,TR_STATE_REGISTRY_MIGRATION_VERSION} from './state-registry-migration-transform.mjs';
import {remainingGlobalContractMap} from './remaining-global-contract-map.mjs';
import {transformStateActions} from './state-action-transform.mjs';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
const raw=Object.fromEntries(runtimeFiles.map(f=>[f,fs.readFileSync(f,'utf8')]));
const render=consolidateLegacyRenderAssignments(app,{expected:12});
const pruned=pruneAppGlobalExports(render.source,{runtimeSources:Object.values(raw)});
const state=transformStateActions(raw['state-runtime.js']).source;
const mapBefore=remainingGlobalContractMap(pruned.source,{runtimeSources:runtimeFiles.map(f=>f==='state-runtime.js'?state:raw[f]),stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
const frontier=new Set(mapBefore.names.migrationFrontiers.stateOnly);
for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES)if(!frontier.has(name))throw new Error(`State Registry Migration: ${name} ya no pertenece a la frontera State segura.`);
const migrated=migrateStateActionsToRegistry(pruned.source),inv=migrated.inventory,after=globalSurfaceInventory(migrated.source);
if(TR_STATE_REGISTRY_MIGRATION_VERSION!=='31.23.12')throw new Error(`Versión de migración inesperada: ${TR_STATE_REGISTRY_MIGRATION_VERSION}`);
if(TR_STATE_REGISTRY_MIGRATION_NAMES.length!==8)throw new Error(`Se esperaban 8 acciones en el primer lote; hay ${TR_STATE_REGISTRY_MIGRATION_NAMES.length}.`);
if(inv.before.blocks!==44||inv.after.blocks!==44)throw new Error(`Bloques window inesperados: ${inv.before.blocks} -> ${inv.after.blocks}`);
if(inv.before.entries!==325||inv.after.entries!==316)throw new Error(`Entries window inesperadas: ${inv.before.entries} -> ${inv.after.entries}`);
if(inv.before.unique!==286||inv.after.unique!==278)throw new Error(`Exports window únicos inesperados: ${inv.before.unique} -> ${inv.after.unique}`);
if(inv.registryEntries!==9)throw new Error(`Publicaciones registry esperadas 9; hay ${inv.registryEntries}.`);
for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES){
  if(after.names.objectAssign.includes(name))throw new Error(`${name} sigue en Object.assign(window,...).`);
  if(!migrated.source.includes(`V31.23.12 State registry migration:`))throw new Error('Falta marcador V31.23.12 en el bundle migrado.');
}
console.log('State Registry Migration verification OK');
console.log(` - Batch: ${TR_STATE_REGISTRY_MIGRATION_NAMES.length} State actions`);
console.log(` - Explicit window blocks: ${inv.before.blocks} -> ${inv.after.blocks}`);
console.log(` - Explicit window entries: ${inv.before.entries} -> ${inv.after.entries}`);
console.log(` - Explicit window unique exports: ${inv.before.unique} -> ${inv.after.unique}`);
console.log(` - Registry publications replacing window entries: ${inv.registryEntries}`);
console.log(` - State frontier before batch: ${mapBefore.names.migrationFrontiers.stateOnly.length}; expected after batch: ${mapBefore.names.migrationFrontiers.stateOnly.length-TR_STATE_REGISTRY_MIGRATION_NAMES.length}`);
console.log(` - Migrated: ${TR_STATE_REGISTRY_MIGRATION_NAMES.join(', ')}`);
