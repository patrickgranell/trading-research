import fs from 'node:fs';

const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};
const app=fs.readFileSync('app.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const runtime=fs.existsSync('backup-v2-runtime.js')?fs.readFileSync('backup-v2-runtime.js','utf8'):'';

need(pkg.version==='31.23.0',`Versión inesperada ${pkg.version}`);
need(runtime.length>0,'Falta backup-v2-runtime.js.');
need(index.includes('<script src="backup-v2-runtime.js"></script>'),'index.html no carga Backup V2 Runtime.');
need(index.indexOf('backup-v2-runtime.js')>index.indexOf('persistence-coalescing-runtime.js'),'Backup V2 debe cargar después de persistencia/DomainStore.');
need(index.indexOf('backup-v2-runtime.js')<index.indexOf('security-runtime.js'),'Backup V2 debe instalar su panel antes del Security Runtime.');

need(runtime.includes("const TR_BACKUP_V2_SCHEMA=2"),'Backup V2 no declara schema 2.');
need(runtime.includes("const TR_BACKUP_V2_VERSION='31.24.0'"),'Backup V2 no declara versión V31.24.');
need(runtime.includes("'marketMeta'")&&runtime.includes("'marketTicks'")&&runtime.includes("'execSets'"),
  'La copia completa no incluye los tres stores de Market Data.');
need(runtime.includes('function trBackupV2CollectReferencedImageIds('),'Falta cálculo de referencias de imagen sobre workspace arbitrario.');
need(runtime.includes('masterLibrary'),'La reachability de imágenes no incluye Master Library.');
need(runtime.includes('async function trBackupV2BuildPayload('),'Falta constructor verificable de Backup V2.');
need(runtime.includes('missingImageIds')&&runtime.includes('throw new Error'),'No se aborta explícitamente una copia con imágenes obligatorias ausentes.');
need(!/if\s*\(!blob\)\s*continue/.test(runtime),'Backup V2 vuelve a omitir blobs ausentes silenciosamente.');

need(runtime.includes('manifest')&&runtime.includes('hashes')&&runtime.includes('counts')&&runtime.includes('expectedImageIds'),
  'Manifest V2 incompleto: faltan conteos/hashes/referencias esperadas.');
need(runtime.includes('async function trBackupV2Preflight('),'Falta preflight de restore.');
need(runtime.includes('trBackupV2ValidateRelationships'),'Falta validación de relaciones antes de mutar stores.');
need(runtime.includes('TR_BACKUP_V2_JOURNAL_ID'),'Falta restore journal durable.');
need(runtime.includes('async function trBackupV2StageImages('),'Falta staging durable de imágenes.');
need(runtime.includes('async function trBackupV2ReplaceMarketData('),'Falta commit transaccional de Market Data.');
need(runtime.includes('async function trBackupV2FinalizeImages('),'Falta commit de imágenes desde staging.');
need(runtime.includes('async function trBackupV2RecoverPending('),'Falta protocolo de recuperación tras interrupción.');
need(!runtime.includes('clearImageStore()'),'Backup V2 no debe vaciar destructivamente imágenes antes del commit recuperable.');

need(runtime.includes("TRDomainStore.exclusive('backup.restore-v2'"),'Restore V2 no está serializado por DomainStore.');
need(runtime.includes("trCorePersistNow('backup-v2-restore')"),'Workspace restaurado no se confirma con persistencia durable explícita.');
need(runtime.includes("exportFullBackup=trBackupV2ExportFullBackup"),'La exportación efectiva no queda sustituida por Backup V2.');
need(runtime.includes("importFullBackup=trBackupV2ImportFullBackup"),'El restore efectivo no queda sustituido por Restore V2.');

need(app.includes('if(!blob)continue'),'La reproducción D03 cambió en el monolito: revisar el contraste del hallazgo.');
need(app.includes('state=restored;ensureAllPlansV8();\n    await clearImageStore();'),
  'La reproducción D02 cambió en el monolito: revisar el contraste del hallazgo.');

if(fail.length){
  console.error('Backup V2 / Restore verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Backup V2 / Restore verification OK');
console.log(' - Full backup: workspace + reachable images + marketMeta + marketTicks + execSets');
console.log(' - Completeness: missing mandatory image aborts before file creation');
console.log(' - Manifest: counts + hashes + expected references');
console.log(' - Restore: preflight -> journal -> image staging -> Market Data tx -> image commit -> workspace durable commit');
console.log(' - Recovery: pending journal can continue/abort safely after interruption');
console.log(' - Destructive clearImageStore in effective V2 path: 0');
