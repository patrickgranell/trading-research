import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {migrateStateActionsToRegistry} from './state-registry-migration-transform.mjs';
import {migrateUiHandlersToRegistry} from './ui-registry-migration-transform.mjs';
import {remainingGlobalContractMap} from './remaining-global-contract-map.mjs';
import {transformStateActions} from './state-action-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
const raw=Object.fromEntries(runtimeFiles.map(f=>[f,fs.readFileSync(f,'utf8')]));
const render=consolidateLegacyRenderAssignments(app,{expected:12});
const pruned=pruneAppGlobalExports(render.source,{runtimeSources:Object.values(raw)});
const state=migrateStateActionsToRegistry(pruned.source);
const ui=migrateUiHandlersToRegistry(state.source);
const transformedState=transformStateActions(raw['state-runtime.js']).source;
const runtimeSources=runtimeFiles.map(f=>f==='state-runtime.js'?transformedState:raw[f]);
const map=remainingGlobalContractMap(ui.source,{runtimeSources,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
console.log(`RESIDUAL_GLOBAL_COUNT=${map.remainingUnique}`);
for(const row of [...map.rows].sort((a,b)=>a.name.localeCompare(b.name))){
  console.log(`RESIDUAL ${row.name} | primary=${row.primary} | contracts=${row.contracts.join('+')} | handlerUses=${row.handlerUses}`);
}
console.log(`MULTI=${map.names.multiContract.join(',')||'none'}`);
console.log(`LEGACY_READ=${map.names.migrationFrontiers.legacyGlobalRead.join(',')||'none'}`);
console.log(`DIRECT_MIRROR=${map.names.migrationFrontiers.directMirrors.join(',')||'none'}`);
