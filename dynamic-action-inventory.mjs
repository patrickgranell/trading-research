import fs from 'node:fs';
import {handlerRootInventory,globalSurfaceInventory} from './global-surface-inventory.mjs';

export const TR_DYNAMIC_ACTION_GUARD_VERSION='31.23.9';
const BUILTIN_ROOTS=new Set([
  'if','for','while','switch','catch','function','return','typeof','void','delete','new',
  'Math','Number','String','Boolean','Array','Object','Date','JSON','RegExp','Set','Map','Promise',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','alert','confirm','prompt',
  'setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','queueMicrotask',
  'document','window','globalThis'
]);
const ACTIONISH_ROOT=/(?:^|["'`])\s*([A-Za-z_$][\w$]*)\s*\(/g;
const DYNAMIC_HANDLER_SLOT=/\bdata-tr-on(?:click|change|input|submit)\s*=\s*(["'])\s*\$\{([^}]+)\}[\s\S]*?\1/g;

function uniqSorted(values){return [...new Set(values)].sort();}

export function dynamicActionInventory(source){
  const text=String(source);
  const staticHandlers=handlerRootInventory(text);
  const surface=globalSurfaceInventory(text);
  const explicitGlobals=new Set(surface.names.all);
  const quotedActionRoots=[];
  for(const m of text.matchAll(ACTIONISH_ROOT)){
    const name=m[1];
    if(!BUILTIN_ROOTS.has(name))quotedActionRoots.push(name);
  }
  const quotedRoots=uniqSorted(quotedActionRoots);
  const staticRoots=new Set(Object.keys(staticHandlers.roots));
  const dynamicCandidates=quotedRoots.filter(name=>!staticRoots.has(name));
  const protectedDynamicGlobals=dynamicCandidates.filter(name=>explicitGlobals.has(name));
  const dynamicSlots=[];
  for(const m of text.matchAll(DYNAMIC_HANDLER_SLOT))dynamicSlots.push(String(m[2]||'').trim());
  return {
    version:TR_DYNAMIC_ACTION_GUARD_VERSION,
    declarativeHandlers:staticHandlers.handlers,
    staticHandlerRoots:staticRoots.size,
    quotedActionRoots:quotedRoots.length,
    dynamicCandidateRoots:dynamicCandidates.length,
    protectedDynamicGlobals:protectedDynamicGlobals.length,
    dynamicHandlerSlots:dynamicSlots.length,
    names:{
      staticHandlerRoots:[...staticRoots].sort(),
      quotedActionRoots:quotedRoots,
      dynamicCandidateRoots:dynamicCandidates,
      protectedDynamicGlobals,
      dynamicSlotExpressions:uniqSorted(dynamicSlots)
    }
  };
}

export function assertPruneTargetsAvoidDynamicActions(source,names){
  const inv=dynamicActionInventory(source),protectedSet=new Set(inv.names.protectedDynamicGlobals);
  const blocked=[...new Set(names)].filter(name=>protectedSet.has(name)).sort();
  if(blocked.length)throw new Error(`Dynamic Action Guard: la poda intenta retirar acciones potencialmente generadas dinámicamente: ${blocked.join(', ')}`);
  return {inventory:inv,blocked};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const file=process.argv[2]||'app.js',src=fs.readFileSync(file,'utf8'),inv=dynamicActionInventory(src);
  console.log('Dynamic Action inventory OK');
  console.log(` - Declarative handlers: ${inv.declarativeHandlers}`);
  console.log(` - Static handler roots: ${inv.staticHandlerRoots}`);
  console.log(` - Quoted action-like roots: ${inv.quotedActionRoots}`);
  console.log(` - Dynamic candidate roots: ${inv.dynamicCandidateRoots}`);
  console.log(` - Protected dynamic globals: ${inv.protectedDynamicGlobals}`);
  console.log(` - Dynamic handler slots: ${inv.dynamicHandlerSlots}`);
  console.log(` - Protected roots: ${inv.names.protectedDynamicGlobals.join(', ')||'none'}`);
  console.log(` - Dynamic slot expressions: ${inv.names.dynamicSlotExpressions.join(', ')||'none'}`);
}
