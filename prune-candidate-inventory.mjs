import fs from 'node:fs';
import {objectAssignWindowBlocks,globalSurfaceInventory,handlerRootInventory,windowReadInventory} from './global-surface-inventory.mjs';
import {dynamicActionInventory} from './dynamic-action-inventory.mjs';
import {TR_APP_GLOBAL_PRUNE_NAMES} from './app-global-prune-transform.mjs';

export const TR_PRUNE_CANDIDATE_INVENTORY_VERSION='31.23.10';

function extractStateTargetActions(source){
  const m=String(source).match(/const TARGET_ACTIONS=Object\.freeze\(\[([\s\S]*?)\]\);/);
  if(!m)throw new Error('Prune Candidate Inventory: no se pudo leer TARGET_ACTIONS de state-action-transform.mjs.');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
}
function explicitRefsForName(source,name){
  const re=new RegExp(`\\b(?:window|globalThis)\\.${name}\\b`,'g');
  return (String(source).match(re)||[]).length;
}

export function pruneCandidateInventory(appSource,{runtimeSources=[],stateActionTransformSource=''}={}){
  const app=String(appSource),surface=globalSurfaceInventory(app),handlers=handlerRootInventory(app),dynamic=dynamicActionInventory(app);
  const handlerRoots=new Set(Object.keys(handlers.roots));
  const dynamicProtected=new Set(dynamic.names.protectedDynamicGlobals);
  const stateTargets=new Set(extractStateTargetActions(stateActionTransformSource));
  const alreadyPruned=new Set(TR_APP_GLOBAL_PRUNE_NAMES);
  const directGlobals=new Set(surface.names.direct);
  const runtimeReads=new Set();
  for(const runtime of runtimeSources)for(const name of windowReadInventory(String(runtime)).unique)runtimeReads.add(name);

  const safe=[],blocked={handler:[],dynamic:[],state:[],sameAppRef:[],runtimeRead:[],directAssignment:[],alreadyPruned:[]},blocks=[];
  for(const block of objectAssignWindowBlocks(app)){
    const row={at:block.at,props:[...block.props],safe:[],blocked:[]};
    for(const name of block.props){
      let reason='';
      if(alreadyPruned.has(name)){blocked.alreadyPruned.push(name);reason='already-pruned';}
      else if(handlerRoots.has(name)){blocked.handler.push(name);reason='handler';}
      else if(dynamicProtected.has(name)){blocked.dynamic.push(name);reason='dynamic';}
      else if(stateTargets.has(name)){blocked.state.push(name);reason='state-action';}
      else if(explicitRefsForName(app,name)>0){blocked.sameAppRef.push(name);reason='same-app-window-ref';}
      else if(runtimeReads.has(name)){blocked.runtimeRead.push(name);reason='runtime-window-read';}
      else if(directGlobals.has(name)){blocked.directAssignment.push(name);reason='direct-window-assignment';}
      if(reason)row.blocked.push({name,reason});
      else{row.safe.push(name);safe.push(name);}
    }
    if(row.safe.length)blocks.push(row);
  }
  const uniq=a=>[...new Set(a)].sort();
  return {
    version:TR_PRUNE_CANDIDATE_INVENTORY_VERSION,
    source:{blocks:surface.objectAssignBlocks,entries:surface.objectAssignEntries,unique:surface.objectAssignUnique},
    safeCandidates:uniq(safe),
    safeCandidateCount:uniq(safe).length,
    candidateBlocks:blocks,
    guards:{handlerRoots:handlerRoots.size,dynamicProtected:dynamicProtected.size,stateTargets:stateTargets.size,runtimeWindowReads:runtimeReads.size,directWindowAssignments:directGlobals.size},
    blocked:Object.fromEntries(Object.entries(blocked).map(([k,v])=>[k,uniq(v)])),
    dynamic
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const appFile=process.argv[2]||'app.js';
  const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
  const inv=pruneCandidateInventory(fs.readFileSync(appFile,'utf8'),{
    runtimeSources:runtimeFiles.map(f=>fs.readFileSync(f,'utf8')),
    stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')
  });
  console.log('Prune Candidate inventory OK');
  console.log(` - Safe explicit export candidates: ${inv.safeCandidateCount}`);
  console.log(` - Guard sets: handlers ${inv.guards.handlerRoots}; dynamic ${inv.guards.dynamicProtected}; state ${inv.guards.stateTargets}; runtime reads ${inv.guards.runtimeWindowReads}; direct assignments ${inv.guards.directWindowAssignments}`);
  console.log(` - Safe candidates: ${inv.safeCandidates.join(', ')||'none'}`);
  console.log(' - Candidate blocks:');
  for(const b of inv.candidateBlocks)console.log(`   · ${b.safe.join(', ')}`);
}
