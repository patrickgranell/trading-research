import fs from 'node:fs';
import {globalSurfaceInventory,handlerRootInventory,windowReadInventory} from './global-surface-inventory.mjs';
import {dynamicActionInventory} from './dynamic-action-inventory.mjs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';

export const TR_REMAINING_GLOBAL_CONTRACT_MAP_VERSION='31.23.11';

function uniq(values){return [...new Set(values)].sort();}
function extractStateTargetActions(source){
  const m=String(source).match(/const TARGET_ACTIONS=Object\.freeze\(\[([\s\S]*?)\]\);/);
  if(!m)throw new Error('Remaining Global Contract Map: no se pudo leer TARGET_ACTIONS.');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
}
function primaryContract(labels){
  for(const key of ['dynamic-action','cross-runtime-read','state-action','ui-handler','same-app-global-read','direct-global-mirror'])if(labels.includes(key))return key;
  return 'unclassified';
}

export function remainingGlobalContractMap(appSource,{runtimeSources=[],stateActionTransformSource=''}={}){
  const app=String(appSource),surface=globalSurfaceInventory(app),remaining=surface.names.objectAssign;
  const remainingSet=new Set(remaining),handlers=handlerRootInventory(app),dynamic=dynamicActionInventory(app);
  const handlerSet=new Set(Object.keys(handlers.roots)),dynamicSet=new Set(dynamic.names.protectedDynamicGlobals),stateSet=new Set(extractStateTargetActions(stateActionTransformSource));
  const sameAppReadSet=new Set(windowReadInventory(app).unique);
  const runtimeReadSet=new Set();
  for(const runtime of runtimeSources)for(const name of windowReadInventory(String(runtime)).unique)runtimeReadSet.add(name);
  const directSet=new Set(surface.names.direct);
  const rows=[];
  for(const name of remaining){
    const labels=[];
    if(handlerSet.has(name))labels.push('ui-handler');
    if(dynamicSet.has(name))labels.push('dynamic-action');
    if(stateSet.has(name))labels.push('state-action');
    if(sameAppReadSet.has(name))labels.push('same-app-global-read');
    if(runtimeReadSet.has(name))labels.push('cross-runtime-read');
    if(directSet.has(name))labels.push('direct-global-mirror');
    rows.push({name,contracts:labels,primary:primaryContract(labels),handlerUses:Number(handlers.roots[name]||0)});
  }
  const byPrimary={};for(const row of rows)byPrimary[row.primary]=(byPrimary[row.primary]||0)+1;
  const coverage={
    uiHandler:rows.filter(r=>r.contracts.includes('ui-handler')).length,
    dynamicAction:rows.filter(r=>r.contracts.includes('dynamic-action')).length,
    stateAction:rows.filter(r=>r.contracts.includes('state-action')).length,
    sameAppGlobalRead:rows.filter(r=>r.contracts.includes('same-app-global-read')).length,
    crossRuntimeRead:rows.filter(r=>r.contracts.includes('cross-runtime-read')).length,
    directGlobalMirror:rows.filter(r=>r.contracts.includes('direct-global-mirror')).length
  };
  const unclassified=rows.filter(r=>r.primary==='unclassified').map(r=>r.name);
  const multiContract=rows.filter(r=>r.contracts.length>1).map(r=>r.name);
  const migrationFrontiers={
    stateOnly:rows.filter(r=>r.primary==='state-action'&&r.contracts.every(x=>x==='state-action'||x==='ui-handler')).map(r=>r.name),
    handlerOnly:rows.filter(r=>r.contracts.length===1&&r.contracts[0]==='ui-handler').map(r=>r.name),
    crossRuntime:rows.filter(r=>r.contracts.includes('cross-runtime-read')).map(r=>r.name),
    legacyGlobalRead:rows.filter(r=>r.contracts.includes('same-app-global-read')).map(r=>r.name),
    directMirrors:rows.filter(r=>r.contracts.includes('direct-global-mirror')).map(r=>r.name)
  };
  return {
    version:TR_REMAINING_GLOBAL_CONTRACT_MAP_VERSION,
    remainingUnique:remaining.length,
    classified:rows.length-unclassified.length,
    unclassified:unclassified.length,
    multiContract:multiContract.length,
    coverage,
    byPrimary,
    guards:{handlerRoots:handlerSet.size,dynamicProtected:dynamicSet.size,stateTargets:stateSet.size,runtimeReads:runtimeReadSet.size,sameAppReads:sameAppReadSet.size,directAssignments:directSet.size},
    names:{unclassified:uniq(unclassified),multiContract:uniq(multiContract),migrationFrontiers:Object.fromEntries(Object.entries(migrationFrontiers).map(([k,v])=>[k,uniq(v)]))},
    rows
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const app=fs.readFileSync(process.argv[2]||'app.js','utf8');
  const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
  const rawRuntimes=Object.fromEntries(runtimeFiles.map(f=>[f,fs.readFileSync(f,'utf8')]));
  const render=consolidateLegacyRenderAssignments(app,{expected:12});
  const pruned=pruneAppGlobalExports(render.source,{runtimeSources:Object.values(rawRuntimes)});
  const transformedState=transformStateActions(rawRuntimes['state-runtime.js']).source;
  const runtimeSources=runtimeFiles.map(f=>f==='state-runtime.js'?transformedState:rawRuntimes[f]);
  const inv=remainingGlobalContractMap(pruned.source,{runtimeSources,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
  console.log('Remaining Global Contract Map OK');
  console.log(` - Remaining explicit Object.assign exports: ${inv.remainingUnique}`);
  console.log(` - Classified: ${inv.classified}; unclassified: ${inv.unclassified}; multi-contract: ${inv.multiContract}`);
  console.log(` - Coverage: handler ${inv.coverage.uiHandler}; dynamic ${inv.coverage.dynamicAction}; state ${inv.coverage.stateAction}; same-app read ${inv.coverage.sameAppGlobalRead}; cross-runtime ${inv.coverage.crossRuntimeRead}; direct mirror ${inv.coverage.directGlobalMirror}`);
  console.log(` - Primary contracts: ${Object.entries(inv.byPrimary).map(([k,v])=>`${k} ${v}`).join('; ')}`);
  console.log(` - State migration frontier: ${inv.names.migrationFrontiers.stateOnly.length}`);
  console.log(` - State migration names: ${inv.names.migrationFrontiers.stateOnly.join(', ')||'none'}`);
  console.log(` - Handler-only frontier: ${inv.names.migrationFrontiers.handlerOnly.length}`);
  console.log(` - Handler-only next candidates: ${inv.names.migrationFrontiers.handlerOnly.slice(0,24).join(', ')||'none'}`);
  console.log(` - Cross-runtime frontier: ${inv.names.migrationFrontiers.crossRuntime.length}`);
  console.log(` - Unclassified names: ${inv.names.unclassified.join(', ')||'none'}`);
}
