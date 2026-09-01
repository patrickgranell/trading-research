import fs from 'node:fs';
import vm from 'node:vm';

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


need(runtime.includes("db.transaction(IMAGE_STORE,'readwrite')"),'Staging/finalización de imágenes no usa una transacción IndexedDB única.');
need(runtime.includes("db.transaction(TR_BACKUP_V2_MARKET_STORES,'readwrite')"),'Market Data no se reemplaza en una transacción multi-store.');
need(runtime.includes('store.clear();for(const rec of marketData?.[storeName]||[])store.put'), 'Market Data restore no hace replace all-or-nothing por store.');
need(runtime.includes('const marketMatches=await trBackupV2MarketMatchesManifest(journal.manifest)'), 'Recovery no detecta si el commit Market Data llegó a completarse.');
need(runtime.includes("return {status:'aborted-before-market'}"), 'Recovery no puede abortar de forma segura antes del commit externo.');
need(runtime.includes("return {status:'completed-forward'}"), 'Recovery no puede completar hacia delante tras un commit externo.');

const pStart=runtime.indexOf('async function trBackupV2RestoreProtocol(');
const pEnd=pStart<0?-1:runtime.indexOf('\n\nasync function trBackupV2RecoverPending',pStart);
need(pStart>=0&&pEnd>pStart,'No se pudo aislar el protocolo de restore para fault injection.');
if(pStart>=0&&pEnd>pStart){
  const protocolSrc=runtime.slice(pStart,pEnd);
  const context={
    TR_BACKUP_V2_JOURNAL_ID:'journal',
    TR_BACKUP_V2_SCHEMA:2,
    uid:()=> 'RST2_TEST',
    trBackupV2Clone:v=>JSON.parse(JSON.stringify(v)),
    trBackupV2RestoreIo:()=>{throw new Error('default IO no debe usarse en test');}
  };
  vm.createContext(context);
  vm.runInContext(protocolSrc+'\nthis.protocol=trBackupV2RestoreProtocol;',context);
  const prepared={workspace:{sentinel:'target'},images:Array.from({length:100},(_,i)=>({id:'IMG'+(i+1)})),marketData:{},manifest:{expectedImageIds:Array.from({length:100},(_,i)=>'IMG'+(i+1)),hashes:{images:{}}}};

  {
    const calls=[];let latestJournal=null;
    const io={
      journalPut:async j=>{calls.push('journal:'+j.phase);latestJournal=JSON.parse(JSON.stringify(j));},
      journalDelete:async()=>calls.push('journal-delete'),
      stageImages:async()=>{calls.push('stage-images');const e=new Error('image 37 of 100');e.name='QuotaExceededError';throw e;},
      verifyStage:async()=>calls.push('verify-stage'),
      replaceMarketData:async()=>calls.push('market-commit'),
      finalizeImages:async()=>calls.push('image-commit'),
      persistWorkspace:async()=>calls.push('workspace-commit'),
      cleanupStage:async()=>calls.push('stage-cleanup')
    };
    let error=null;try{await context.protocol(prepared,io);}catch(e){error=e;}
    need(error?.name==='QuotaExceededError','Fault injection 37/100 no propagó QuotaExceededError.');
    need(JSON.stringify(calls)===JSON.stringify(['journal:prepared','stage-images']),
      'QuotaExceeded durante staging avanzó a Market Data/workspace: '+calls.join(' -> '));
    need(latestJournal?.phase==='prepared','Fault injection no dejó journal en fase recuperable prepared.');
  }

  {
    const calls=[];
    const io={
      journalPut:async j=>calls.push('journal:'+j.phase),
      journalDelete:async()=>calls.push('journal-delete'),
      stageImages:async()=>calls.push('stage-images'),
      verifyStage:async()=>calls.push('verify-stage'),
      replaceMarketData:async()=>calls.push('market-commit'),
      finalizeImages:async()=>calls.push('image-commit'),
      persistWorkspace:async()=>calls.push('workspace-commit'),
      cleanupStage:async()=>calls.push('stage-cleanup')
    };
    await context.protocol(prepared,io);
    const expected=['journal:prepared','stage-images','verify-stage','journal:images-staged','market-commit','journal:market-committed','image-commit','journal:images-committed','workspace-commit','journal:workspace-committed','stage-cleanup','journal-delete'];
    need(JSON.stringify(calls)===JSON.stringify(expected),'Orden de commit restore inesperado: '+calls.join(' -> '));
  }

  {
    const calls=[];let journalWrites=0;
    const io={
      journalPut:async j=>{journalWrites++;calls.push('journal:'+j.phase);if(j.phase==='market-committed')throw new Error('journal write after market commit failed');},
      journalDelete:async()=>calls.push('journal-delete'),
      stageImages:async()=>calls.push('stage-images'),
      verifyStage:async()=>calls.push('verify-stage'),
      replaceMarketData:async()=>calls.push('market-commit'),
      finalizeImages:async()=>calls.push('image-commit'),
      persistWorkspace:async()=>calls.push('workspace-commit'),
      cleanupStage:async()=>calls.push('stage-cleanup')
    };
    let error=null;try{await context.protocol(prepared,io);}catch(e){error=e;}
    need(!!error,'Fault injection posterior a Market Data no interrumpió el protocolo.');
    need(calls.includes('market-commit')&&!calls.includes('workspace-commit'),'Fallo tras Market Data publicó workspace indebidamente.');
    need(runtime.includes('trBackupV2MarketMatchesManifest'), 'El journal stale tras Market Data no tiene detección forward-recovery.');
  }
}

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
