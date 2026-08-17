import {globalSurfaceInventory,handlerRootInventory} from './global-surface-inventory.mjs';

export const TR_APP_GLOBAL_PRUNE_VERSION='31.23.7';
export const TR_APP_GLOBAL_PRUNE_TARGETS=Object.freeze([
  Object.freeze({block:'Object.assign(window,{exitLabModule});',names:['exitLabModule'],reason:'view builder interno; ya no forma parte del contrato de eventos'}),
  Object.freeze({block:'Object.assign(window,{v303MetricQualitySummary});',names:['v303MetricQualitySummary'],reason:'helper analítico interno sin handler ni consumidor cross-runtime'}),
  Object.freeze({block:'Object.assign(window,{v3192SyncAnkoraEconomics});',names:['v3192SyncAnkoraEconomics'],reason:'helper de economía llamado léxicamente dentro de app.js'}),
  Object.freeze({block:'Object.assign(window,{v3193ChronologicalOps});',names:['v3193ChronologicalOps'],reason:'helper cronológico interno sin contrato UI'}),
  Object.freeze({block:'Object.assign(window,{v3194ChronologicalOps,v3194CompareOps,v3194EquityFromZero});',names:['v3194ChronologicalOps','v3194CompareOps','v3194EquityFromZero'],reason:'helpers cronológicos internos sin contrato UI'})
]);

export const TR_APP_GLOBAL_PRUNE_NAMES=Object.freeze(TR_APP_GLOBAL_PRUNE_TARGETS.flatMap(x=>x.names));

function countExact(source,needle){return source.split(needle).length-1;}

export function pruneAppGlobalExports(source,{runtimeSources=[]}={}){
  const input=String(source);
  const handlerRoots=handlerRootInventory(input).roots;
  for(const name of TR_APP_GLOBAL_PRUNE_NAMES){
    if(handlerRoots[name])throw new Error(`App Global Prune: ${name} sigue siendo raíz de ${handlerRoots[name]} handler(s) declarativo(s).`);
    const re=new RegExp(`\\b(?:window|globalThis)\\.${name}\\b`,'g');
    let crossReads=0;
    for(const runtime of runtimeSources)crossReads+=(String(runtime).match(re)||[]).length;
    if(crossReads)throw new Error(`App Global Prune: ${name} todavía tiene ${crossReads} lectura(s) cross-runtime directa(s).`);
  }

  let out=input,removedBlocks=0,removedEntries=0;
  for(const target of TR_APP_GLOBAL_PRUNE_TARGETS){
    const count=countExact(out,target.block);
    if(count!==1)throw new Error(`App Global Prune: bloque objetivo ${target.block} apareció ${count} veces; se esperaba 1.`);
    out=out.replace(target.block,`/* V31.23.7 pruned explicit window export: ${target.names.join(', ')} */`);
    removedBlocks++;
    removedEntries+=target.names.length;
  }

  const before=globalSurfaceInventory(input),after=globalSurfaceInventory(out);
  if(before.objectAssignBlocks-after.objectAssignBlocks!==removedBlocks)throw new Error(`App Global Prune: reducción de bloques inesperada ${before.objectAssignBlocks} -> ${after.objectAssignBlocks}.`);
  if(before.objectAssignEntries-after.objectAssignEntries!==removedEntries)throw new Error(`App Global Prune: reducción de entries inesperada ${before.objectAssignEntries} -> ${after.objectAssignEntries}.`);
  return {source:out,inventory:{version:TR_APP_GLOBAL_PRUNE_VERSION,removedBlocks,removedEntries,targetNames:[...TR_APP_GLOBAL_PRUNE_NAMES],before:{objectAssignBlocks:before.objectAssignBlocks,objectAssignEntries:before.objectAssignEntries,objectAssignUnique:before.objectAssignUnique,totalUniqueGlobals:before.totalUniqueGlobals},after:{objectAssignBlocks:after.objectAssignBlocks,objectAssignEntries:after.objectAssignEntries,objectAssignUnique:after.objectAssignUnique,totalUniqueGlobals:after.totalUniqueGlobals}}};
}
