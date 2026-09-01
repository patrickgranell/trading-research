import fs from 'node:fs';
import vm from 'node:vm';

const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const index=fs.readFileSync('index.html','utf8');
const cleanup=fs.readFileSync('operation-cleanup-runtime.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const runtime=fs.existsSync('blob-lifecycle-runtime.js')?fs.readFileSync('blob-lifecycle-runtime.js','utf8'):'';

need(pkg.version==='31.23.0',`Versión inesperada ${pkg.version}`);

/* Reproduction must remain explicit until the new effective runtime supersedes it. */
need(cleanup.includes('for(const im of o.images||[])await deleteImageBlob(im.id);')&&cleanup.indexOf('deleteImageBlob(im.id)')<cleanup.indexOf('state.operations=state.operations.filter'),
  'D07 reproduction changed: historical operation cleanup no longer shows blob-before-metadata.');
need(app.includes("function deleteImportBatch(id)")&&app.includes("state.operations=state.operations.filter(o=>o.importBatchId!==id)"),
  'D08 reproduction changed: deleteImportBatch source not found.');
need(!app.includes('storage.from(CLOUD_BUCKET).remove('),'D15 reproduction changed: app.js now has cloud remove; review ownership.');

need(runtime.length>0,'Falta blob-lifecycle-runtime.js.');
need(index.includes('<script src="blob-lifecycle-runtime.js"></script>'),'index.html no carga Blob Lifecycle Runtime.');
need(index.indexOf('blob-lifecycle-runtime.js')>index.indexOf('operation-cleanup-runtime.js'),'Blob Lifecycle debe cargar después de Operation Cleanup para sustituir las acciones efectivas.');
need(index.indexOf('blob-lifecycle-runtime.js')<index.indexOf('render-closure-runtime.js'),'Blob Lifecycle debe instalarse antes del cierre final de render.');

for(const token of [
  "const TR_BLOB_LIFECYCLE_VERSION='31.24.0'",
  'function trBlobGcReachableIdsFromRoots(',
  'async function trBlobGcDurableMutation(',
  'async function trBlobGcSweepLocalCandidates(',
  'async function trBlobGcListCloudObjects(',
  'async function trBlobGcSweepCloud(',
  "TRDomainStore.exclusive('blob.delete.operation'",
  "TRDomainStore.exclusive('blob.delete.operation-image'",
  "TRDomainStore.exclusive('blob.delete.import-batch'"
])need(runtime.includes(token),`Falta invariant/runtime token: ${token}`);

need(runtime.includes('trCoreSnapshotCache'),'Reachability no incluye snapshots recuperables.');
need(runtime.includes('trBackupV2CollectReferencedImageIds'),'Reachability no reutiliza la definición canónica de referencias V2.');
need(runtime.includes('masterLibrary'),'El runtime no documenta/cubre Master Library.');
need(runtime.includes('visualReferences'),'El runtime no documenta/cubre referencias visuales.');
need(runtime.includes("TR_BACKUP_V2_STAGE_PREFIX"),'GC local no protege staging de Restore V2.');
need(!runtime.includes('deleteImageBlob('),'El GC efectivo no debe usar deleteImageBlob(), que silencia errores.');
need(runtime.includes("db.transaction(IMAGE_STORE,'readwrite')"),'GC local no usa borrado IndexedDB observable/propagable.');
need(runtime.includes(".storage.from(CLOUD_BUCKET).remove("),'D15: falta borrado cloud real.');
need(runtime.includes('.list(')&&runtime.includes('offset'),'D15: listado cloud no pagina el bucket.');
need(runtime.includes('cloudConfig.syncedImageIds'),'D15: syncedImageIds no se reconcilia con Storage real.');

need(runtime.includes('deleteVisualReference'),'La política no cubre referencias visuales.');
need(runtime.includes('deleteTaxonomyAsset'),'La política no cubre imágenes de taxonomías.');
need(runtime.includes('deleteSavedLibraryItem'),'La política no cubre imágenes de Master Library.');
need(runtime.includes('deleteImportBatch'),'La política no cubre borrado de lote.');
need(runtime.includes('deleteOperationImage')&&runtime.includes('deleteOperation'),'La política no sustituye Operation Cleanup.');
need(runtime.includes('cloudPushState'),'Cloud GC no está ligado a una subida remota confirmada.');

const protocolStart=runtime.indexOf('async function trBlobGcDurableMutation(');
const protocolEnd=protocolStart<0?-1:runtime.indexOf('\n\n',protocolStart);
if(protocolStart>=0){
  const marker='/* TESTABLE CORE END */';
  const end=runtime.indexOf(marker);
  need(end>protocolStart,'Falta marcador TESTABLE CORE END para fault injection.');
  if(end>protocolStart){
    const core=runtime.slice(0,end+marker.length);
    const context={console:{log(){},warn(){},error(){}},TR_BACKUP_V2_STAGE_PREFIX:'__stage__'};
    vm.createContext(context);
    try{vm.runInContext(core+'\nthis.api={trBlobGcReachableIdsFromRoots,trBlobGcDurableMutation,trBlobGcCloudSweepPlan};',context);}
    catch(e){fail.push('No se pudo evaluar el core testeable de Blob Lifecycle: '+e.message);}

    if(context.api){
      const ref=id=>({id});
      const current={
        operations:[{images:[ref('CUR_OP')]}],
        tradingPlans:[{
          visualReferences:[{images:[ref('VISUAL')]}],
          setupDefinitions:[{imagesLong:[ref('SETUP_L')],imagesShort:[]}],
          vdDefinitions:[],contextDefinitions:[]
        }],
        masterLibrary:{items:[{type:'context',payload:{images:[ref('LIB')]}}]}
      };
      const snapshots=[{state:{operations:[{images:[ref('SNAP')]}],tradingPlans:[],masterLibrary:{items:[]}}}];
      const roots=context.api.trBlobGcReachableIdsFromRoots(current,snapshots);
      for(const id of ['CUR_OP','VISUAL','SETUP_L','LIB','SNAP'])need(roots.has(id),`Reachability perdió ${id}.`);

      {
        const calls=[],memory={value:'old'};
        const adapters={
          snapshot:()=>({value:memory.value}),
          mutate:async()=>{calls.push('metadata');memory.value='new';},
          persist:async()=>{calls.push('persist');},
          flush:async()=>{calls.push('flush');return false;},
          rollback:async before=>{calls.push('rollback');memory.value=before.value;},
          gc:async()=>calls.push('gc')
        };
        let err=null;try{await context.api.trBlobGcDurableMutation('test',adapters);}catch(e){err=e;}
        need(!!err,'Fault injection: flush fallido no produjo error.');
        need(memory.value==='old','Fault injection: flush fallido no restauró memoria.');
        need(JSON.stringify(calls)===JSON.stringify(['metadata','persist','flush','rollback']),
          'Fault injection: GC ocurrió antes/depués de flush fallido: '+calls.join(' -> '));
      }

      {
        const calls=[],memory={value:'old'};
        const adapters={
          snapshot:()=>({value:memory.value}),
          mutate:async()=>{calls.push('metadata');memory.value='new';},
          persist:async()=>{calls.push('persist');},
          flush:async()=>{calls.push('flush');return true;},
          rollback:async()=>calls.push('rollback'),
          gc:async()=>{calls.push('gc');throw new Error('GC quota');}
        };
        const result=await context.api.trBlobGcDurableMutation('test',adapters);
        need(memory.value==='new','GC fallido revirtió metadata ya durable; debería preferir huérfano.');
        need(result?.gcOk===false,'GC fallido no quedó reportado como cleanup pendiente.');
        need(JSON.stringify(calls)===JSON.stringify(['metadata','persist','flush','gc']),
          'Orden correcto no es metadata→persist→flush→gc: '+calls.join(' -> '));
      }

      {
        const plan=context.api.trBlobGcCloudSweepPlan(
          ['KEEP','DROP','SNAPKEEP'],
          new Set(['KEEP','SNAPKEEP'])
        );
        need(JSON.stringify(plan.removeIds)===JSON.stringify(['DROP']),'Cloud sweep plan borró reachables o conservó huérfanos.');
        need(JSON.stringify(plan.keepIds)===JSON.stringify(['KEEP','SNAPKEEP']),'Cloud sweep plan keep inesperado.');
      }
    }
  }
}

if(fail.length){
  console.error('Blob lifecycle verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Blob lifecycle verification OK');
console.log(' - metadata/reference commit precedes local/cloud blob GC');
console.log(' - flush failure rolls memory back and performs zero GC');
console.log(' - GC failure after durable commit leaves recoverable orphan, never a live dangling reference');
console.log(' - reachability roots: workspace + snapshots + plans + Master Library + visual references');
console.log(' - deleteOperation/deleteOperationImage/deleteImportBatch/taxonomy/library/visual deletes share the lifecycle');
console.log(' - cloud mark-and-sweep lists real bucket objects and reconciles syncedImageIds');
