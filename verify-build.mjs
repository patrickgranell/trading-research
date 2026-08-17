import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';
import {TR_APP_GLOBAL_PRUNE_NAMES} from './app-global-prune-transform.mjs';
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
  if(String(inv.version)!=='31.23.8')failures.push(`App global prune version unexpected: ${inv.version}`);
  if(Number(inv.touchedBlocks)!==15)failures.push(`App global prune touched blocks changed: ${inv.touchedBlocks}`);
  if(Number(inv.removedBlocks)!==5)failures.push(`App global prune removed blocks changed: ${inv.removedBlocks}`);
  if(Number(inv.removedEntries)!==28)failures.push(`App global prune removed entries changed: ${inv.removedEntries}`);
  if(Number(inv.before?.objectAssignBlocks)!==51||Number(inv.after?.objectAssignBlocks)!==46)failures.push(`App global prune block inventory unexpected: ${inv.before?.objectAssignBlocks} -> ${inv.after?.objectAssignBlocks}`);
  if(Number(inv.before?.objectAssignEntries)!==375||Number(inv.after?.objectAssignEntries)!==347)failures.push(`App global prune entry inventory unexpected: ${inv.before?.objectAssignEntries} -> ${inv.after?.objectAssignEntries}`);
  if(Number(inv.before?.objectAssignUnique)!==332||Number(inv.after?.objectAssignUnique)!==306)failures.push(`App global prune unique inventory unexpected: ${inv.before?.objectAssignUnique} -> ${inv.after?.objectAssignUnique}`);
}
const appBlock=scripts.find(m=>/data-tr-build=/.test(m[1]));
if(appBlock){
  const legacyBundled=(appBlock[2].match(/\brender\s*=\s*function\s*\(/g)||[]).length;
  const aliasesBundled=(appBlock[2].match(/^const renderV(?:21|30|312|313|314)Base=render;\s*$/gm)||[]).length;
  if(legacyBundled!==0)failures.push(`bundled app still contains ${legacyBundled} render=function assignments`);
  if(aliasesBundled!==0)failures.push(`bundled app still contains ${aliasesBundled} dead renderV*Base aliases`);
  const globals=globalSurfaceInventory(appBlock[2]);
  if(globals.objectAssignBlocks!==46)failures.push(`bundled app explicit Object.assign blocks: ${globals.objectAssignBlocks}, expected 46`);
  if(globals.objectAssignEntries!==347)failures.push(`bundled app explicit entries: ${globals.objectAssignEntries}, expected 347`);
  if(globals.objectAssignUnique!==306)failures.push(`bundled app explicit unique exports: ${globals.objectAssignUnique}, expected 306`);
  for(const name of TR_APP_GLOBAL_PRUNE_NAMES)if(globals.names.objectAssign.includes(name))failures.push(`bundled app still explicitly exports pruned name: ${name}`);
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
console.log(' - App explicit window export pruning: 51 -> 46 blocks; 375 -> 347 entries; 332 -> 306 unique exports');
console.log(' - Strict style attribute runtime: bundled');
console.log(' - app.js occurrence: 1');
console.log(` - Output size: ${size} bytes`);
