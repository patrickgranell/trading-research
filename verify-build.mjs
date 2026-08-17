import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';
import {TR_APP_GLOBAL_PRUNE_NAMES} from './app-global-prune-transform.mjs';
import {TR_STATE_REGISTRY_MIGRATION_NAMES,TR_STATE_REGISTRY_MIGRATION_BATCH_1,TR_STATE_REGISTRY_MIGRATION_BATCH_2,TR_STATE_REGISTRY_MIGRATION_BATCH_3,TR_STATE_REGISTRY_MIGRATION_BATCH_4,TR_STATE_REGISTRY_MIGRATION_BATCH_5} from './state-registry-migration-transform.mjs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const v=pkg.version;
const file='dist/index.html';
if(!fs.existsSync(file)){console.error('Build verification FAILED: dist/index.html missing');process.exit(1);}
const h=fs.readFileSync(file,'utf8');
const failures=[];
const count=s=>h.split(s).length-1;
const expectedMarkers=[['data-tr-build',2],['data-tr-style-attr-runtime',1],['data-tr-reports-purity-runtime',1],['data-tr-structural-runtime',1],['data-tr-state-runtime',1],['data-tr-security-runtime',1],['data-tr-event-runtime',1],['data-tr-csp-runtime',1],['data-tr-style-runtime',1],['data-tr-render-closure-runtime',1]];
for(const [marker,expected] of expectedMarkers){const n=count(`${marker}="${v}"`);if(n!==expected)failures.push(`${marker}: expected ${expected}, got ${n}`);}
if(count('<!doctype html>')!==1)failures.push(`doctype duplicated: ${count('<!doctype html>')}`);
if(count('function modalShell(title,body,footer)')!==1)failures.push(`app.js duplicated/corrupted: modalShell count ${count('function modalShell(title,body,footer)')}`);
if(/<script\s+src=["'](?:app|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|security-runtime|event-runtime|csp-runtime|style-runtime|render-closure-runtime)\.js["']/i.test(h))failures.push('local runtime script src remains after bundling');
if(/<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']/i.test(h))failures.push('styles.css link remains after bundling');
const size=Buffer.byteLength(h);if(size>3_000_000)failures.push(`bundle unexpectedly large: ${size} bytes`);
const scripts=[...h.matchAll(/<script\s+([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>/data-tr-(?:build|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|security-runtime|event-runtime|csp-runtime|style-runtime|render-closure-runtime)=/.test(m[1]));
if(scripts.length!==10)failures.push(`expected 10 bundled JS blocks, got ${scripts.length}`);

const readJson=name=>fs.existsSync(name)?JSON.parse(fs.readFileSync(name,'utf8')):null;
const renderInv=readJson('dist/render-inventory.json');
if(!renderInv)failures.push('dist/render-inventory.json missing');
else{
  if(renderInv.source?.assignments!==12||renderInv.source?.declarations!==1||renderInv.source?.baseAliases!==5)failures.push('source render inventory changed');
  if(renderInv.bundled?.assignments!==0||renderInv.bundled?.declarations!==1||renderInv.bundled?.baseAliases!==0||renderInv.bundled?.destructiveRootWrites!==1)failures.push('bundled render inventory changed');
  if(renderInv.removedAssignments!==12)failures.push(`expected 12 removed render assignments, got ${renderInv.removedAssignments}`);
  if(renderInv.closureRuntime!=='render-closure-runtime.js')failures.push('render inventory does not identify canonical closure runtime');
}

const stateInv=readJson('dist/state-action-inventory.json');
if(!stateInv)failures.push('dist/state-action-inventory.json missing');
else{
  if(stateInv.bridge!==true)failures.push('bundled State Action Bridge marker missing from inventory');
  if(Number(stateInv.resolveCalls)<14)failures.push(`State Action Bridge resolve inventory too low: ${stateInv.resolveCalls}`);
  if(Number(stateInv.publishCalls)<19)failures.push(`State Action Bridge publish inventory too low: ${stateInv.publishCalls}`);
  if(Number(stateInv.crossRuntimeWindowReads)!==0)failures.push(`State Action Bridge leaves ${stateInv.crossRuntimeWindowReads} direct cross-runtime window reads`);
  if(Number(stateInv.targetActions)!==61)failures.push(`State Action Bridge target inventory changed: ${stateInv.targetActions}`);
}

const pruneInv=readJson('dist/app-global-prune-inventory.json');
if(!pruneInv)failures.push('dist/app-global-prune-inventory.json missing');
else{
  if(String(pruneInv.version)!=='31.23.10')failures.push(`App global prune version unexpected: ${pruneInv.version}`);
  if(Number(pruneInv.touchedBlocks)!==26||Number(pruneInv.removedBlocks)!==7||Number(pruneInv.removedEntries)!==50)failures.push('App global prune removal inventory changed');
  if(Number(pruneInv.before?.objectAssignBlocks)!==51||Number(pruneInv.after?.objectAssignBlocks)!==44)failures.push('App global prune block inventory changed');
  if(Number(pruneInv.before?.objectAssignEntries)!==375||Number(pruneInv.after?.objectAssignEntries)!==325)failures.push('App global prune entry inventory changed');
  if(Number(pruneInv.before?.objectAssignUnique)!==332||Number(pruneInv.after?.objectAssignUnique)!==286)failures.push('App global prune unique inventory changed');
  if(Number(pruneInv.dynamicActionGuard?.dynamicHandlerSlots)!==4||Number(pruneInv.dynamicActionGuard?.protectedDynamicGlobals)!==3)failures.push('Dynamic Action Guard inventory changed');
}

const migrationInv=readJson('dist/state-registry-migration-inventory.json');
if(!migrationInv)failures.push('dist/state-registry-migration-inventory.json missing');
else{
  if(String(migrationInv.version)!=='31.23.16')failures.push(`State registry migration version unexpected: ${migrationInv.version}`);
  if((migrationInv.names||[]).length!==40)failures.push(`State registry migrated names unexpected: ${(migrationInv.names||[]).length}`);
  const batches=migrationInv.batches||{};
  if((batches.batch1||[]).length!==8||(batches.batch2||[]).length!==8||(batches.batch3||[]).length!==8||(batches.batch4||[]).length!==8||(batches.batch5||[]).length!==8)failures.push('State registry batch sizes changed');
  if(Number(migrationInv.registryEntries)!==42||Number(migrationInv.batch1Entries)!==9||Number(migrationInv.batch2Entries)!==8||Number(migrationInv.batch3Entries)!==8||Number(migrationInv.batch4Entries)!==9||Number(migrationInv.batch5Entries)!==8)failures.push(`State registry publication occurrences unexpected: total ${migrationInv.registryEntries}, batches ${migrationInv.batch1Entries}/${migrationInv.batch2Entries}/${migrationInv.batch3Entries}/${migrationInv.batch4Entries}/${migrationInv.batch5Entries}`);
  if(Number(migrationInv.before?.blocks)!==44||Number(migrationInv.after?.blocks)!==44)failures.push(`State registry block inventory unexpected: ${migrationInv.before?.blocks} -> ${migrationInv.after?.blocks}`);
  if(Number(migrationInv.before?.entries)!==325||Number(migrationInv.after?.entries)!==283)failures.push(`State registry entry inventory unexpected: ${migrationInv.before?.entries} -> ${migrationInv.after?.entries}`);
  if(Number(migrationInv.before?.unique)!==286||Number(migrationInv.after?.unique)!==246)failures.push(`State registry unique inventory unexpected: ${migrationInv.before?.unique} -> ${migrationInv.after?.unique}`);
}

const dynamicInv=readJson('dist/dynamic-action-inventory.json');
if(!dynamicInv)failures.push('dist/dynamic-action-inventory.json missing');
else{
  if(Number(dynamicInv.dynamicHandlerSlots)!==4||Number(dynamicInv.dynamicCandidateRoots)!==8||Number(dynamicInv.protectedDynamicGlobals)!==3)failures.push('dynamic-action-inventory changed');
  for(const name of ['v311DashboardDragEnd','v311DashboardDragStart','v311DashboardDrop'])if(!dynamicInv.names?.protectedDynamicGlobals?.includes(name))failures.push(`dynamic-action-inventory missing protected root: ${name}`);
}

const candidateInv=readJson('dist/prune-candidate-inventory.json');
if(!candidateInv)failures.push('dist/prune-candidate-inventory.json missing');
else{
  if(String(candidateInv.version)!=='31.23.10')failures.push(`prune-candidate inventory version unexpected: ${candidateInv.version}`);
  if(Number(candidateInv.safeCandidateCount)!==0||(candidateInv.safeCandidates||[]).length!==0)failures.push('contract-safe explicit prune candidates remain');
  if(Number(candidateInv.guards?.stateTargets)!==61||Number(candidateInv.guards?.dynamicProtected)!==3)failures.push('prune candidate guard inventory changed');
}

const contractInv=readJson('dist/remaining-global-contract-map.json');
if(!contractInv)failures.push('dist/remaining-global-contract-map.json missing');
else{
  if(String(contractInv.version)!=='31.23.11')failures.push(`remaining global contract map version unexpected: ${contractInv.version}`);
  if(Number(contractInv.remainingUnique)!==246||Number(contractInv.classified)!==246||Number(contractInv.unclassified)!==0)failures.push(`remaining contract coverage unexpected: remaining ${contractInv.remainingUnique}, classified ${contractInv.classified}, unclassified ${contractInv.unclassified}`);
  if(Number(contractInv.multiContract)!==21)failures.push(`remaining contract overlap changed: ${contractInv.multiContract}`);
  if(Number(contractInv.byPrimary?.['state-action'])!==20||Number(contractInv.byPrimary?.['ui-handler'])!==223||Number(contractInv.byPrimary?.['dynamic-action'])!==3)failures.push(`remaining primary contract counts unexpected: state ${contractInv.byPrimary?.['state-action']}, handler ${contractInv.byPrimary?.['ui-handler']}, dynamic ${contractInv.byPrimary?.['dynamic-action']}`);
  if(Number(contractInv.coverage?.crossRuntimeRead)!==0)failures.push(`remaining map leaves ${contractInv.coverage?.crossRuntimeRead} cross-runtime direct reads`);
  if(Number(contractInv.names?.migrationFrontiers?.stateOnly?.length)!==16)failures.push(`state migration frontier changed: ${contractInv.names?.migrationFrontiers?.stateOnly?.length}`);
  if(Number(contractInv.names?.migrationFrontiers?.handlerOnly?.length)!==221)failures.push(`handler-only migration frontier changed: ${contractInv.names?.migrationFrontiers?.handlerOnly?.length}`);
  if(Number(contractInv.names?.migrationFrontiers?.crossRuntime?.length)!==0)failures.push(`cross-runtime migration frontier reopened: ${contractInv.names?.migrationFrontiers?.crossRuntime?.length}`);
}

const appBlock=scripts.find(m=>/data-tr-build=/.test(m[1]));
if(appBlock){
  const legacyBundled=(appBlock[2].match(/\brender\s*=\s*function\s*\(/g)||[]).length;
  const aliasesBundled=(appBlock[2].match(/^const renderV(?:21|30|312|313|314)Base=render;\s*$/gm)||[]).length;
  if(legacyBundled!==0)failures.push(`bundled app still contains ${legacyBundled} render=function assignments`);
  if(aliasesBundled!==0)failures.push(`bundled app still contains ${aliasesBundled} dead renderV*Base aliases`);
  const globals=globalSurfaceInventory(appBlock[2]);
  if(globals.objectAssignBlocks!==44)failures.push(`bundled app explicit Object.assign blocks: ${globals.objectAssignBlocks}, expected 44`);
  if(globals.objectAssignEntries!==283)failures.push(`bundled app explicit entries: ${globals.objectAssignEntries}, expected 283`);
  if(globals.objectAssignUnique!==246)failures.push(`bundled app explicit unique exports: ${globals.objectAssignUnique}, expected 246`);
  for(const name of TR_APP_GLOBAL_PRUNE_NAMES)if(globals.names.objectAssign.includes(name))failures.push(`bundled app still explicitly exports pruned name: ${name}`);
  for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES)if(globals.names.objectAssign.includes(name))failures.push(`bundled app still explicitly exports State-migrated name: ${name}`);
  for(const name of [...TR_STATE_REGISTRY_MIGRATION_BATCH_1,...TR_STATE_REGISTRY_MIGRATION_BATCH_2,...TR_STATE_REGISTRY_MIGRATION_BATCH_3,...TR_STATE_REGISTRY_MIGRATION_BATCH_4,...TR_STATE_REGISTRY_MIGRATION_BATCH_5])if(!appBlock[2].includes(name))failures.push(`bundled app lost lexical State action binding: ${name}`);
}

const stateBlock=scripts.find(m=>/data-tr-state-runtime=/.test(m[1]));
if(stateBlock){
  if(!stateBlock[2].includes('V31.23.6 STATE ACTION BRIDGE'))failures.push('bundled State Runtime is missing V31.23.6 bridge');
  if(!stateBlock[2].includes("const trStateActionResolve=(name)=>"))failures.push('bundled State Runtime is missing registry-aware resolver');
  if(!stateBlock[2].includes("const trStateActionPublish=(name,value)=>"))failures.push('bundled State Runtime is missing registry-aware publisher');
  for(const name of ['confirmImportPreview','deleteImportBatch','editOperation','openOperationModal','saveInstrument','saveOperationFromForm','v314ImportExecFile','v314ImportMarketFile','v319SyncExecutionSetsToOperations'])if(new RegExp(`\\bwindow\\.${name}\\b`).test(stateBlock[2]))failures.push(`bundled State Runtime still reads window.${name} directly`);
}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tr-build-check-'));
try{
  scripts.forEach((m,i)=>{
    const p=path.join(tmp,`block-${i}.js`);fs.writeFileSync(p,m[2].replace(/<\\\/script/gi,'</script'));
    const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
    if(r.status!==0)failures.push(`inline JS block ${i} syntax error: ${(r.stderr||r.stdout||'').trim().split('\n')[0]}`);
  });
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

if(failures.length){console.error('Build verification FAILED');for(const f of failures)console.error(' - '+f);process.exit(1);}
console.log('Build verification OK');
console.log(' - Single HTML document: yes');
console.log(' - Bundled JS blocks: 10/10, syntax OK');
console.log(' - Canonical render closure: bundled + inventoried');
console.log(' - Legacy render reassignments in bundled app: 0');
console.log(' - Dead renderV*Base aliases in bundled app: 0');
console.log(' - Bundled destructive root writes: 1 bootstrap write');
console.log(' - State Action Bridge: bundled + inventoried, 0 direct cross-runtime window reads');
console.log(' - App explicit window export pruning: 51 -> 44 blocks; 375 -> 325 entries; 332 -> 286 unique exports');
console.log(' - State Registry Migration V cumulative: 40 names; explicit window entries 325 -> 283; unique 286 -> 246');
console.log(' - Contract-safe explicit prune candidates remaining: 0');
console.log(' - Remaining Global Contract Map: 246/246 classified; primary State 20 / handler 223 / dynamic 3; cross-runtime 0');
console.log(' - Migration frontiers: State 16 / handler-only 221 / cross-runtime 0');
console.log(' - Dynamic Action Guard: 4 dynamic slots; 8 candidate roots; 3 protected exported globals');
console.log(' - Strict style attribute runtime: bundled');
console.log(' - app.js occurrence: 1');
console.log(` - Output size: ${size} bytes`);
