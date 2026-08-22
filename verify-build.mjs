import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';
import {TR_APP_GLOBAL_PRUNE_NAMES} from './app-global-prune-transform.mjs';
import {TR_STATE_REGISTRY_MIGRATION_NAMES,TR_STATE_REGISTRY_MIGRATION_BATCH_1,TR_STATE_REGISTRY_MIGRATION_BATCH_2,TR_STATE_REGISTRY_MIGRATION_BATCH_3,TR_STATE_REGISTRY_MIGRATION_BATCH_4,TR_STATE_REGISTRY_MIGRATION_BATCH_5,TR_STATE_REGISTRY_MIGRATION_BATCH_6,TR_STATE_REGISTRY_MIGRATION_BATCH_7} from './state-registry-migration-transform.mjs';
import {TR_UI_REGISTRY_MIGRATION_NAMES,TR_UI_REGISTRY_MIGRATION_BATCH_1,TR_UI_REGISTRY_MIGRATION_BATCH_2} from './ui-registry-migration-transform.mjs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const v=pkg.version,file='dist/index.html',fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};
const readJson=name=>fs.existsSync(name)?JSON.parse(fs.readFileSync(name,'utf8')):null;
if(!fs.existsSync(file)){console.error('Build verification FAILED: dist/index.html missing');process.exit(1);}
const h=fs.readFileSync(file,'utf8'),count=s=>h.split(s).length-1;
for(const [marker,expected] of [['data-tr-build',2],['data-tr-style-attr-runtime',1],['data-tr-reports-purity-runtime',1],['data-tr-structural-runtime',1],['data-tr-state-runtime',1],['data-tr-security-runtime',1],['data-tr-event-runtime',1],['data-tr-csp-runtime',1],['data-tr-style-runtime',1],['data-tr-render-closure-runtime',1]])need(count(`${marker}="${v}"`)===expected,`${marker}: expected ${expected}, got ${count(`${marker}="${v}"`)}`);
need(count('<!doctype html>')===1,'doctype duplicated');
need(count('function modalShell(title,body,footer)')===1,'app.js duplicated/corrupted');
need(!/<script\s+src=["'](?:app|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|security-runtime|event-runtime|csp-runtime|style-runtime|render-closure-runtime)\.js["']/i.test(h),'local runtime script src remains after bundling');
need(!/<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']/i.test(h),'styles.css link remains after bundling');
const size=Buffer.byteLength(h);need(size<=3_000_000,`bundle unexpectedly large: ${size} bytes`);
const scripts=[...h.matchAll(/<script\s+([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>/data-tr-(?:build|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|security-runtime|event-runtime|csp-runtime|style-runtime|render-closure-runtime)=/.test(m[1]));
need(scripts.length===10,`expected 10 bundled JS blocks, got ${scripts.length}`);

const renderInv=readJson('dist/render-inventory.json');
need(!!renderInv,'dist/render-inventory.json missing');
if(renderInv){need(renderInv.source?.assignments===12&&renderInv.source?.declarations===1&&renderInv.source?.baseAliases===5,'source render inventory changed');need(renderInv.bundled?.assignments===0&&renderInv.bundled?.declarations===1&&renderInv.bundled?.baseAliases===0&&renderInv.bundled?.destructiveRootWrites===1,'bundled render inventory changed');need(renderInv.removedAssignments===12,'render removal count changed');}
const stateInv=readJson('dist/state-action-inventory.json');
need(!!stateInv,'dist/state-action-inventory.json missing');
if(stateInv){need(stateInv.bridge===true,'State Action Bridge marker missing');need(Number(stateInv.resolveCalls)>=14,'State Action Bridge resolve inventory too low');need(Number(stateInv.publishCalls)>=19,'State Action Bridge publish inventory too low');need(Number(stateInv.crossRuntimeWindowReads)===0,'State Action Bridge reopened direct cross-runtime reads');need(Number(stateInv.targetActions)===61,'State Action Bridge target inventory changed');}
const pruneInv=readJson('dist/app-global-prune-inventory.json');
need(!!pruneInv,'dist/app-global-prune-inventory.json missing');
if(pruneInv){need(String(pruneInv.version)==='31.23.10','App global prune version changed');need(Number(pruneInv.before?.objectAssignBlocks)===51&&Number(pruneInv.after?.objectAssignBlocks)===44,'App global prune blocks changed');need(Number(pruneInv.before?.objectAssignEntries)===375&&Number(pruneInv.after?.objectAssignEntries)===325,'App global prune entries changed');need(Number(pruneInv.before?.objectAssignUnique)===332&&Number(pruneInv.after?.objectAssignUnique)===286,'App global prune unique exports changed');need(Number(pruneInv.dynamicActionGuard?.dynamicHandlerSlots)===4&&Number(pruneInv.dynamicActionGuard?.protectedDynamicGlobals)===3,'Dynamic Action Guard changed');}
const migrationInv=readJson('dist/state-registry-migration-inventory.json');
need(!!migrationInv,'dist/state-registry-migration-inventory.json missing');
if(migrationInv){
  need(String(migrationInv.version)==='31.23.18',`State registry migration version unexpected: ${migrationInv.version}`);
  need((migrationInv.names||[]).length===56,`State registry migrated names unexpected: ${(migrationInv.names||[]).length}`);
  const batches=migrationInv.batches||{};need(['batch1','batch2','batch3','batch4','batch5','batch6','batch7'].every(k=>(batches[k]||[]).length===8),'State registry batch sizes changed');
  need(Number(migrationInv.registryEntries)===63&&Number(migrationInv.batch1Entries)===9&&Number(migrationInv.batch2Entries)===8&&Number(migrationInv.batch3Entries)===8&&Number(migrationInv.batch4Entries)===9&&Number(migrationInv.batch5Entries)===8&&Number(migrationInv.batch6Entries)===11&&Number(migrationInv.batch7Entries)===10,`State registry publication occurrences unexpected: ${migrationInv.registryEntries}`);
  need(Number(migrationInv.before?.blocks)===44&&Number(migrationInv.after?.blocks)===42,`State registry block inventory changed: ${migrationInv.before?.blocks} -> ${migrationInv.after?.blocks}`);
  need(Number(migrationInv.before?.entries)===325&&Number(migrationInv.after?.entries)===262,`State registry entry inventory unexpected: ${migrationInv.before?.entries} -> ${migrationInv.after?.entries}`);
  need(Number(migrationInv.before?.unique)===286&&Number(migrationInv.after?.unique)===230,`State registry unique inventory unexpected: ${migrationInv.before?.unique} -> ${migrationInv.after?.unique}`);
}
const uiInv=readJson('dist/ui-registry-migration-inventory.json');
need(!!uiInv,'dist/ui-registry-migration-inventory.json missing');
if(uiInv){need(String(uiInv.version)==='31.23.20',`UI registry migration version unexpected: ${uiInv.version}`);need((uiInv.names||[]).length===16,'UI registry migrated names changed');need((uiInv.batches?.batch1||[]).length===8&&(uiInv.batches?.batch2||[]).length===8,'UI registry batch sizes changed');need(Number(uiInv.registryEntries)===16&&Number(uiInv.batch1Entries)===8&&Number(uiInv.batch2Entries)===8,'UI registry publications changed');need(Number(uiInv.before?.blocks)===42&&Number(uiInv.after?.blocks)===40,'UI registry block inventory changed');need(Number(uiInv.before?.entries)===262&&Number(uiInv.after?.entries)===246,'UI registry entry inventory changed');need(Number(uiInv.before?.unique)===230&&Number(uiInv.after?.unique)===214,'UI registry unique inventory changed');}
const dynamicInv=readJson('dist/dynamic-action-inventory.json');
need(!!dynamicInv,'dist/dynamic-action-inventory.json missing');
if(dynamicInv){need(Number(dynamicInv.dynamicHandlerSlots)===4&&Number(dynamicInv.dynamicCandidateRoots)===8&&Number(dynamicInv.protectedDynamicGlobals)===3,'dynamic-action-inventory changed');for(const name of ['v311DashboardDragEnd','v311DashboardDragStart','v311DashboardDrop'])need(dynamicInv.names?.protectedDynamicGlobals?.includes(name),`dynamic-action-inventory missing ${name}`);}
const candidateInv=readJson('dist/prune-candidate-inventory.json');
need(!!candidateInv,'dist/prune-candidate-inventory.json missing');if(candidateInv)need(Number(candidateInv.safeCandidateCount)===0&&(candidateInv.safeCandidates||[]).length===0,'contract-safe explicit prune candidates remain');
const contractInv=readJson('dist/remaining-global-contract-map.json');
need(!!contractInv,'dist/remaining-global-contract-map.json missing');
if(contractInv){need(String(contractInv.version)==='31.23.11','remaining contract map version changed');need(Number(contractInv.remainingUnique)===214&&Number(contractInv.classified)===214&&Number(contractInv.unclassified)===0,`remaining contract coverage unexpected: ${contractInv.classified}/${contractInv.remainingUnique}`);need(Number(contractInv.multiContract)===6,`remaining contract overlap changed: ${contractInv.multiContract}`);need(Number(contractInv.byPrimary?.['state-action'])===4&&Number(contractInv.byPrimary?.['ui-handler'])===207&&Number(contractInv.byPrimary?.['dynamic-action'])===3,'remaining primary contract counts unexpected');need(Number(contractInv.coverage?.crossRuntimeRead)===0,'remaining map reopened cross-runtime direct reads');need(Number(contractInv.names?.migrationFrontiers?.stateOnly?.length)===0,`state migration frontier not closed: ${contractInv.names?.migrationFrontiers?.stateOnly?.length}`);need(Number(contractInv.names?.migrationFrontiers?.handlerOnly?.length)===205,'handler-only frontier changed');}

const appBlock=scripts.find(m=>/data-tr-build=/.test(m[1]));
if(appBlock){
  need((appBlock[2].match(/\brender\s*=\s*function\s*\(/g)||[]).length===0,'bundled legacy render assignment remains');
  need((appBlock[2].match(/^const renderV(?:21|30|312|313|314)Base=render;\s*$/gm)||[]).length===0,'bundled dead render alias remains');
  const globals=globalSurfaceInventory(appBlock[2]);need(globals.objectAssignBlocks===40,`bundled app blocks ${globals.objectAssignBlocks}, expected 40`);need(globals.objectAssignEntries===246,`bundled app entries ${globals.objectAssignEntries}, expected 246`);need(globals.objectAssignUnique===214,`bundled app unique ${globals.objectAssignUnique}, expected 214`);
  for(const name of TR_APP_GLOBAL_PRUNE_NAMES)need(!globals.names.objectAssign.includes(name),`bundled app re-exports pruned name ${name}`);
  for(const name of TR_STATE_REGISTRY_MIGRATION_NAMES)need(!globals.names.objectAssign.includes(name),`bundled app still explicitly exports State-migrated name ${name}`);
  for(const name of TR_UI_REGISTRY_MIGRATION_NAMES)need(!globals.names.objectAssign.includes(name),`bundled app still explicitly exports UI-migrated name ${name}`);
  for(const name of [TR_STATE_REGISTRY_MIGRATION_BATCH_1,TR_STATE_REGISTRY_MIGRATION_BATCH_2,TR_STATE_REGISTRY_MIGRATION_BATCH_3,TR_STATE_REGISTRY_MIGRATION_BATCH_4,TR_STATE_REGISTRY_MIGRATION_BATCH_5,TR_STATE_REGISTRY_MIGRATION_BATCH_6,TR_STATE_REGISTRY_MIGRATION_BATCH_7,TR_UI_REGISTRY_MIGRATION_BATCH_1,TR_UI_REGISTRY_MIGRATION_BATCH_2].flat())need(appBlock[2].includes(name),`bundled app lost lexical action binding ${name}`);
}
const stateBlock=scripts.find(m=>/data-tr-state-runtime=/.test(m[1]));
if(stateBlock){need(stateBlock[2].includes('V31.23.6 STATE ACTION BRIDGE'),'bundled State Runtime missing bridge');need(stateBlock[2].includes("const trStateActionResolve=(name)=>"),'bundled State Runtime missing registry resolver');need(stateBlock[2].includes("const trStateActionPublish=(name,value)=>"),'bundled State Runtime missing registry publisher');for(const name of ['confirmImportPreview','deleteImportBatch','editOperation','openOperationModal','saveInstrument','saveOperationFromForm','v314ImportExecFile','v314ImportMarketFile','v319SyncExecutionSetsToOperations'])need(!new RegExp(`\\bwindow\\.${name}\\b`).test(stateBlock[2]),`bundled State Runtime still reads window.${name}`);}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tr-build-check-'));
try{scripts.forEach((m,i)=>{const p=path.join(tmp,`block-${i}.js`);fs.writeFileSync(p,m[2].replace(/<\\\/script/gi,'</script'));const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});need(r.status===0,`inline JS block ${i} syntax error: ${(r.stderr||r.stdout||'').trim().split('\n')[0]}`);});}finally{fs.rmSync(tmp,{recursive:true,force:true});}

if(fail.length){console.error('Build verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('Build verification OK');
console.log(' - Single HTML document: yes');
console.log(' - Bundled JS blocks: 10/10, syntax OK');
console.log(' - Canonical render closure: bundled + inventoried');
console.log(' - State Action Bridge: bundled + inventoried, 0 direct cross-runtime window reads');
console.log(' - App explicit window export pruning: 51 -> 44 blocks; 375 -> 325 entries; 332 -> 286 unique exports');
console.log(' - State Registry Migration VII cumulative: 56 names; explicit window blocks 44 -> 42; entries 325 -> 262; unique 286 -> 230');
console.log(' - UI Registry Migration II cumulative: 16 names; explicit window blocks 42 -> 40; entries 262 -> 246; unique 230 -> 214');
console.log(' - Remaining Global Contract Map: 214/214 classified; primary State 4 / handler 207 / dynamic 3; State frontier 0; handler frontier 205; cross-runtime 0');
console.log(' - Dynamic Action Guard: 4 dynamic slots; 8 candidate roots; 3 protected exported globals');
console.log(` - Output size: ${size} bytes`);
