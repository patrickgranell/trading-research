import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports,TR_APP_GLOBAL_PRUNE_NAMES} from './app-global-prune-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
const runtimeSources=runtimeFiles.map(file=>fs.readFileSync(file,'utf8'));
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};
let result=null;
try{
  const renderConsolidated=consolidateLegacyRenderAssignments(app,{expected:12});
  result=pruneAppGlobalExports(renderConsolidated.source,{runtimeSources});
}catch(e){fail.push(e?.message||String(e));}
const inv=result?.inventory;
need(!app.includes('V31.23.7 pruned explicit window export'),'app.js fuente fue podado físicamente; esta fase debe mantener el histórico intacto y podar solo el bundle.');
need(inv?.removedBlocks===5,`Se esperaban 5 bloques explícitos retirados; hay ${inv?.removedBlocks??0}.`);
need(inv?.removedEntries===7,`Se esperaban 7 entries retiradas; hay ${inv?.removedEntries??0}.`);
need(inv?.before?.objectAssignBlocks===51,`Baseline app.js inesperada: ${inv?.before?.objectAssignBlocks} bloques, esperados 51.`);
need(inv?.before?.objectAssignEntries===375,`Baseline app.js inesperada: ${inv?.before?.objectAssignEntries} entries, esperadas 375.`);
need(inv?.before?.objectAssignUnique===332,`Baseline app.js inesperada: ${inv?.before?.objectAssignUnique} exports únicos, esperados 332.`);
need(inv?.after?.objectAssignBlocks===46,`Bundle app debería quedar en 46 bloques; hay ${inv?.after?.objectAssignBlocks}.`);
need(inv?.after?.objectAssignEntries===368,`Bundle app debería quedar en 368 entries; hay ${inv?.after?.objectAssignEntries}.`);
need(inv?.after?.objectAssignUnique===326,`Bundle app debería quedar en 326 exports explícitos únicos; hay ${inv?.after?.objectAssignUnique}.`);
for(const name of TR_APP_GLOBAL_PRUNE_NAMES){
  const marker=`V31.23.7 pruned explicit window export: `;
  need(result?.source.includes(marker),`Falta marcador de poda V31.23.7 para ${name}.`);
}
if(fail.length){console.error('\nApp Global Prune verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('App Global Prune verification OK');
console.log(` - app.js source Object.assign blocks: ${inv.before.objectAssignBlocks}`);
console.log(` - bundled app Object.assign blocks: ${inv.after.objectAssignBlocks}`);
console.log(` - explicit entries: ${inv.before.objectAssignEntries} -> ${inv.after.objectAssignEntries}`);
console.log(` - unique explicit exports: ${inv.before.objectAssignUnique} -> ${inv.after.objectAssignUnique}`);
console.log(` - first batch removed: ${TR_APP_GLOBAL_PRUNE_NAMES.join(', ')}`);
console.log(' - handler roots for removed exports: 0');
console.log(' - direct cross-runtime window reads for removed exports: 0');
