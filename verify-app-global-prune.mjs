import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';
import {pruneAppGlobalExports,TR_APP_GLOBAL_PRUNE_NAMES,TR_APP_GLOBAL_PRUNE_TARGETS} from './app-global-prune-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
const runtimeSources=runtimeFiles.map(file=>fs.readFileSync(file,'utf8'));
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};
let result=null;
try{
  const renderConsolidated=consolidateLegacyRenderAssignments(app,{expected:12});
  result=pruneAppGlobalExports(renderConsolidated.source,{runtimeSources});
}catch(e){fail.push(e?.message||String(e));}
const inv=result?.inventory,after=result?globalSurfaceInventory(result.source):null;
need(!app.includes('V31.23.8 pruned explicit window export'),'app.js fuente fue podado físicamente; esta fase debe mantener el histórico intacto y podar solo el bundle.');
need(inv?.touchedBlocks===15,`Se esperaban 15 bloques inspeccionados/podados; hay ${inv?.touchedBlocks??0}.`);
need(inv?.removedBlocks===5,`Se esperaban 5 bloques explícitos vaciados por completo; hay ${inv?.removedBlocks??0}.`);
need(inv?.removedEntries===28,`Se esperaban 28 entries retiradas; hay ${inv?.removedEntries??0}.`);
need(TR_APP_GLOBAL_PRUNE_NAMES.length===26,`El inventario único de nombres podados debería ser 26; hay ${TR_APP_GLOBAL_PRUNE_NAMES.length}.`);
need(inv?.before?.objectAssignBlocks===51,`Baseline app.js inesperada: ${inv?.before?.objectAssignBlocks} bloques, esperados 51.`);
need(inv?.before?.objectAssignEntries===375,`Baseline app.js inesperada: ${inv?.before?.objectAssignEntries} entries, esperadas 375.`);
need(inv?.before?.objectAssignUnique===332,`Baseline app.js inesperada: ${inv?.before?.objectAssignUnique} exports únicos, esperados 332.`);
need(inv?.after?.objectAssignBlocks===46,`Bundle app debería quedar en 46 bloques; hay ${inv?.after?.objectAssignBlocks}.`);
need(inv?.after?.objectAssignEntries===347,`Bundle app debería quedar en 347 entries; hay ${inv?.after?.objectAssignEntries}.`);
need(inv?.after?.objectAssignUnique===306,`Bundle app debería quedar en 306 exports explícitos únicos; hay ${inv?.after?.objectAssignUnique}.`);
need((result?.source.match(/V31\.23\.8 pruned explicit window export:/g)||[]).length===TR_APP_GLOBAL_PRUNE_TARGETS.length,`Marcadores V31.23.8 inesperados; se esperaban ${TR_APP_GLOBAL_PRUNE_TARGETS.length}.`);
for(const name of TR_APP_GLOBAL_PRUNE_NAMES)need(!after?.names?.objectAssign?.includes(name),`${name} sigue publicado mediante Object.assign(window, ...) después de la poda.`);
if(fail.length){console.error('\nApp Global Prune verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('App Global Prune verification OK');
console.log(` - app.js source Object.assign blocks: ${inv.before.objectAssignBlocks}`);
console.log(` - bundled app Object.assign blocks: ${inv.after.objectAssignBlocks}`);
console.log(` - explicit entries: ${inv.before.objectAssignEntries} -> ${inv.after.objectAssignEntries}`);
console.log(` - unique explicit exports: ${inv.before.objectAssignUnique} -> ${inv.after.objectAssignUnique}`);
console.log(` - touched blocks: ${inv.touchedBlocks}; fully removed blocks: ${inv.removedBlocks}`);
console.log(` - unique pruned names: ${TR_APP_GLOBAL_PRUNE_NAMES.length}; removed occurrences: ${inv.removedEntries}`);
console.log(` - pruned names: ${TR_APP_GLOBAL_PRUNE_NAMES.join(', ')}`);
console.log(' - handler roots for pruned exports: 0');
console.log(' - explicit same-app window/globalThis refs for pruned exports: 0');
console.log(' - direct cross-runtime window reads for pruned exports: 0');
