import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';
import {TR_APP_GLOBAL_PRUNE_NAMES} from './app-global-prune-transform.mjs';
import {TR_STATE_REGISTRY_MIGRATION_NAMES,TR_STATE_REGISTRY_MIGRATION_BATCH_1,TR_STATE_REGISTRY_MIGRATION_BATCH_2,TR_STATE_REGISTRY_MIGRATION_BATCH_3} from './state-registry-migration-transform.mjs';
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
if(!fs.existsSync('dist/render-inventory.json'))failures.push('dist/render-inventory.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/render-inventory.json','utf8'));
  if(inv.source?.assignments!==12)failures.push(`source render assignment inventory changed: ${inv.source?.assignments}`);
  if(inv.source?.declarations!==1)failures.push(`source render declaration inventory changed: ${inv.source?.declarations}`);
  if(inv.source?.baseAliases!==5)failures.push(`source render base alias inventory changed: ${inv.source?.baseAliases}`);
  if(inv.bundled?.assignments!==0)failures.push(`bundled legacy render assignments remain: ${inv.bundled?.assignments}`);
  if(inv.bundled?.declarations!==1)failures.push(`bundled bootstrap render declaration count unexpected: ${inv.bundled?.declarations}`);
  if(inv.bundled?.baseAliases!==0)failures.push(`bundled dead render aliases remain: ${inv.bundled?.baseAliases}`);
  if(inv.bundled?.destructiveRootWrites!==1)failures.push(`bundled destructive root writes expected 1 bootstrap write, got ${inv.bundled?.destructiveRootWrites}`);
  if(inv.removedAssignments!==12)failures.push(`expected 12 removed render assignments, got ${inv.removedAssignments}`);
  if(inv.closureRuntime!=='render-closure-runtime.js')failures.push('render inventory does not identify canonical closure runtime');
}
if(!fs.existsSync('dist/state-action-inventory.json'))failures.push('dist/state-action-inventory.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/state-action-inventory.json','utf8'));
  if(inv.bridge!==true)failures.push('bundled State Action Bridge marker missing from inventory');
  if(Number(inv.resolveCalls)<14)failures.push(`State Action Bridge resolve inventory too low: ${inv.resolveCalls}`);
  if(Number(inv.publishCalls)<19)failures.push(`State Action Bridge publish inventory too low: ${inv.publishCalls}`);
  if(Number(inv.crossRuntimeWindowReads)!==0)failures.push(`State Action Bridge leaves ${inv.crossRuntimeWindowReads} direct cross-runtime window reads`);
  if(Number(inv.targetActions)!==61)failures.push(`State Action Bridge target inventory changed: ${inv.targetActions}`);
}
if(!fs.existsSync('dist/app-global-prune-inventory.json'))failures.push('dist/app-global-prune-inventory.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/app-global-prune-inventory.json','utf8'));
  if(String(inv.version)!=='31.23.10')failures.push(`App global prune version unexpected: ${inv.version}`);
  if(Number(inv.touchedBlocks)!==26)failures.push(`App global prune touched blocks changed: ${inv.touchedBlocks}`);
  if(Number(inv.removedBlocks)!==7)failures.push(`App global prune removed blocks changed: ${inv.removedBlocks}`);
  if(Number(inv.removedEntries)!==50)failures.push(`App global prune removed entries changed: ${inv.removedEntries}`);
  if(Number(inv.before?.objectAssignBlocks)!==51||Number(inv.after?.objectAssignBlocks)!==44)failures.push(`App global prune block inventory unexpected: ${inv.before?.objectAssignBlocks} -> ${inv.after?.objectAssignBlocks}`);
  if(Number(inv.before?.objectAssignEntries)!==375||Number(inv.after?.objectAssignEntries)!==325)failures.push(`App global prune entry inventory unexpected: ${inv.before?.objectAssignEntries} -> ${inv.after?.objectAssignEntries}`);
  if(Number(inv.before?.objectAssignUnique)!==332||Number(inv.after?.objectAssignUnique)!==286)failures.push(`App global prune unique inventory unexpected: ${inv.before?.objectAssignUnique} -> ${inv.after?.objectAssignUnique}`);
  if(Number(inv.dynamicActionGuard?.dynamicHandlerSlots)!==4)failures.push(`Dynamic Action Guard slot inventory changed: ${inv.dynamicActionGuard?.dynamicHandlerSlots}`);
  if(Number(inv.dynamicActionGuard?.protectedDynamicGlobals)!==3)failures.push(`Dynamic Action Guard protected globals changed: ${inv.dynamicActionGuard?.protectedDynamicGlobals}`);
}
if(!fs.existsSync('dist/state-registry-migration-inventory.json'))failures.push('dist/state-registry-migration-inventory.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/state-registry-migration-inventory.json','utf8'));
  if(String(inv.version)!=='31.23.14')failures.push(`State registry migration version unexpected: ${inv.version}`);
  if((inv.names||[]).length!==24)failures.push(`State registry migrated names unexpected: ${(inv.names||[]).length}`);
  if((inv.batches?.batch1||[]).length!==8||(inv.batches?.batch2||[]).length!==8||(inv.batches?.batch3||[]).length!==8)failures.push(`State registry batch sizes unexpected: ${(inv.batches?.batch1||[]).length}+${(inv.batches?.batch2||[]).length}+${(inv.batches?.batch3||[]).length}`);
  if(Number(inv.registryEntries)!==25||Number(inv.batch1Entries)!==9||Number(inv.batch2Entries)!==8||Number(inv.batch3Entries)!==8)failures.push(`State registry publication occurrences unexpected: total ${inv.registryEntries}, batch I ${inv.batch1Entries}, batch II ${inv.batch2Entries}, batch III ${inv.batch3Entries}`);
  if(Number(inv.before?.blocks)!==44||Number(inv.after?.blocks)!==44)failures.push(`State registry block inventory unexpected: ${inv.before?.blocks} -> ${inv.after?.blocks}`);
  if(Number(inv.before?.entries)!==325||Number(inv.after?.entries)!==300)failures.push(`State registry entry inventory unexpected: ${inv.before?.entries} -> ${inv.after?.entries}`);
  if(Number(inv.before?.unique)!==286||Number(inv.after?.unique)!==262)failures.push(`State registry unique inventory unexpected: ${inv.before?.unique} -> ${inv.after?.unique}`);
}
if(!fs.existsSync('dist/dynamic-action-inventory.json'))failures.push('dist/dynamic-action-inventory.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/dynamic-action-inventory.json','utf8'));
  if(Number(inv.dynamicHandlerSlots)!==4)failures.push(`dynamic-action-inventory slots changed: ${inv.dynamicHandlerSlots}`);
  if(Number(inv.dynamicCandidateRoots)!==8)failures.push(`dynamic-action-inventory candidate roots changed: ${inv.dynamicCandidateRoots}`);
  if(Number(inv.protectedDynamicGlobals)!==3)failures.push(`dynamic-action-inventory protected globals changed: ${inv.protectedDynamicGlobals}`);
  for(const name of ['v311DashboardDragEnd','v311DashboardDragStart','v311DashboardDrop'])if(!inv.names?.protectedDynamicGlobals?.includes(name))failures.push(`dynamic-action-inventory missing protected root: ${name}`);
}
if(!fs.existsSync('dist/prune-candidate-inventory.json'))failures.push('dist/prune-candidate-inventory.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/prune-candidate-inventory.json','utf8'));
  if(String(inv.version)!=='31.23.10')failures.push(`prune-candidate inventory version unexpected: ${inv.version}`);
  if(Number(inv.safeCandidateCount)!==0)failures.push(`contract-safe explicit prune candidates remain: ${inv.safeCandidateCount}`);
  if((inv.safeCandidates||[]).length!==0)failures.push(`contract-safe candidate list is not empty: ${(inv.safeCandidates||[]).join(', ')}`);
  if(Number(inv.guards?.stateTargets)!==61)failures.push(`prune candidate state target guard changed: ${inv.guards?.stateTargets}`);
  if(Number(inv.guards?.dynamicProtected)!==3)failures.push(`prune candidate dynamic guard changed: ${inv.guards?.dynamicProtected}`);
}
if(!fs.existsSync('dist/remaining-global-contract-map.json'))failures.push('dist/remaining-global-contract-map.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/remaining-global-contract-map.json','utf8'));
  if(String(inv.version)!=='31.23.11')failures.push(`remaining global contract map version unexpected: ${inv.version}`);
  if(Number(inv.remainingUnique)!==262||Number(inv.classified)!==262||Number(inv.unclassified)!==0)failures.push(`remaining contract coverage unexpected: remaining ${inv.remainingUnique}, classified ${inv.classified}, unclassified ${inv.unclassified}`);
  if(Number(inv.multiContract)!==37)failures.push(`remaining contract overlap changed: ${inv.multiContract}`);
  if(Number(inv.byPrimary?.['state-action'])!==36||Number(inv.byPrimary?.['ui-handler'])!==223||Number(inv.byPrimary?.['dynamic-action'])!==3)failures.push(`remaining primary contract counts unexpected: state ${inv.byPrimary?.['state-action']}, handler ${inv.byPrimary?.['ui-handler']}, dynamic ${inv.byPrimary?.['dynamic-action']}`);
  if(Number(inv.coverage?.crossRuntimeRead)!==0)failures.push(`remaining map leaves ${inv.coverage?.crossRuntimeRead} cross-runtime direct reads`);
  if(Number(inv.names?.migrationFrontiers?.stateOnly?.length)!==32)failures.push(`state migration frontier changed: ${inv.names?.migrationFrontiers?.stateOnly?.length}`);
  if(Number(inv.names?.migrationFrontiers?.handlerOnly?.length)!==221)failures.push(`handler-only migration frontier changed: ${inv.names?.migrationFrontiers?.handlerOnly?.length}`);
  if(Number(inv.names?.migrationFrontiers?.crossRuntime?.length)!==0)failures.push(`cross-runtime migration frontier reopened: ${inv.names?.migrationFrontiers?.crossRuntime?.length}`);
}
const appBlock=scripts.find(m=>/data-tr-build=/.test(m[1]));
if(appBlock){
  const legacyBundled=(appBlock[2].match(/\brender\s*=\s*function\s*\(/g)||[]).length;
  const aliasesBundled=(appBlock[2].match(/^const renderV(?:21|30|312|313|314)Base=render;\s*$/gm)||[]).length;
  if(legacyBundled!==0)failures.push(`bundled app still contains ${legacyBundled} render=function assignments`);
  if(aliasesBundled!==0)failures.push(`bundled app still contains ${aliasesBundled} dead renderV*Base aliases`);
  const globals=globalSurfaceInventory(appBlock[2]);
  if(globals.objectAssignBlocks!==44)failures.push(`bundled app explicit Object.assign blocks: ${globals.objectAssignBlocks}, expected 44`);
  if(globals.objectAssignEntries!==300)failures.push(`bundled app explicit entries: ${globals.objectAssignEntries}, expected 300`);
  if(globals.objectAssignUnique!==262)failures.push(`bundled app explicit unique exports: ${globals.objectAssignUnique}, expected 262`);
  for(const name of TR_APP_GLOBAL_PRUNE_NAMES)if(globals.names.objectAssign.includes(name))failures.push(`bundled app still explicitly exports pruned name: ${name}`);
  for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES)if(globals.names.objectAssign.includes(name))failures.push(`bundled app still explicitly exports State-migrated name: ${name}`);
  for(const name of [...TR_STATE_REGISTRY_MIGRATION_BATCH_1,...TR_STATE_REGISTRY_MIGRATION_BATCH_2,...TR_STATE_REGISTRY_MIGRATION_BATCH_3])if(!appBlock[2].includes(name))failures.push(`bundled app lost lexical State action binding: ${name}`);
}
const stateBlock=scripts.find(m=>/data-tr-state-runtime=/.test(m[1]));
if(stateBlock){
  if(!stateBlock[2].includes('V31.23.6 STATE ACTION BRIDGE'))failures.push('bundled State Runtime is missing V31.23.6 bridge');
  if(!stateBlock[2].includes("const trStateActionResolve=(name)=>"))failures.push('bundled State Runtime is missing registry-aware resolver');
  if(!stateBlock[2].includes("const trStateActionPublish=(name,value)=>"))failures.push('bundled State Runtime is missing registry-aware publisher');
  for(const name of ['confirmImportPreview','deleteImportBatch','editOperation','openOperationModal','saveInstrument','saveOperationFromForm','v314ImportExecFile','v314ImportMarketFile','v319SyncExecutionSetsToOperations']){
    if(new RegExp(`\\bwindow\\.${name}\\b`).test(stateBlock[2]))failures.push(`bundled State Runtime still reads window.${name} directly`);
  }
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
console.log(' - State Registry Migration III cumulative: 24 names; explicit window entries 325 -> 300; unique 286 -> 262');
console.log(' - Contract-safe explicit prune candidates remaining: 0');
console.log(' - Remaining Global Contract Map: 262/262 classified; primary State 36 / handler 223 / dynamic 3; cross-runtime 0');
console.log(' - Migration frontiers: State 32 / handler-only 221 / cross-runtime 0');
console.log(' - Dynamic Action Guard: 4 dynamic slots; 8 candidate roots; 3 protected exported globals');
console.log(' - Strict style attribute runtime: bundled');
console.log(' - app.js occurrence: 1');
console.log(` - Output size: ${size} bytes`);
