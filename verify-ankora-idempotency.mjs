import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

function extractFunction(src,name){
  const variants=['async function '+name+'(','function '+name+'('];let start=-1;
  for(const v of variants){start=src.indexOf(v);if(start>=0)break;}
  if(start<0)throw new Error('No se encuentra '+name);
  const brace=src.indexOf('{',start);let depth=0,quote='',template=false;
  for(let i=brace;i<src.length;i++){const c=src[i],p=src[i-1];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote&&p!=='\\')quote='';continue;}
    if(template){if(c==='\\'){i++;continue;}if(c==='`'&&p!=='\\')template=false;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}if(c==='`'){template=true;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('Función sin cierre: '+name);
}

const context={
  state:{operations:[],settings:{instruments:[{id:'INS',symbol:'MNQ',tickValue:2,commission:1,currency:'USD'}]}},
  uid:(p)=>p+'-'+(++context.uidN),uidN:0,
  nnum:v=>{const n=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(n)?n:0;},
  riskCalc:()=>null,
  instrumentSnapshot:i=>i?{id:i.id,symbol:i.symbol,tickValue:i.tickValue,commission:i.commission}:null,
  planSnapshot:p=>({id:p.id,name:p.name,version:p.version}),
  strategySnapshot:()=>null,
  clone:v=>JSON.parse(JSON.stringify(v))
};
vm.createContext(context);
const names=[
  'importKey','ankoraCanonicalSource','ankoraSourceFingerprint','ankoraSourceIdentity',
  'ankoraOperationSourceIdentity','ankoraOperationSourceFingerprint','ankoraClassifyPreviewDrafts',
  'operationFromDraft','importBatchOperations'
];
try{
  vm.runInContext(names.map(n=>extractFunction(app,n)).join('\n')+
    ';globalThis.__api={fp:ankoraSourceFingerprint,id:ankoraSourceIdentity,classify:ankoraClassifyPreviewDrafts,make:operationFromDraft,batchOps:importBatchOperations};',context);
}catch(e){fail.push('No se pudo cargar implementación D10 real: '+e.message);}

const api=context.__api;
const plan={id:'PLAN',name:'Plan',version:1,riskStrategies:[]};
const source=(patch={})=>({
  EntryDateTime:'01/01/2026 10:00:00',BuySell:'BUY',Contract:'MNQ 03-26',EntryPrice:'100',
  Setup:'A',TotQuantity:'1',Lot1Ticks:'5',Lot2Ticks:'',ExitDateTime:'01/01/2026 10:05:00',
  TPCompliance:'True',...patch
});
const draft=(src)=>({
  rowIndex:1,include:true,src,line:Object.values(src).join('|'),key:'',entryDate:'2026-01-01T10:00',
  exitDate:'2026-01-01T10:05',direction:'LONG',contract:'MNQ 03-26',symbol:'MNQ',timeframe:'5m',
  contracts:1,setup:'A',vd:'V',nr:'N',hypothesis:'H1',h4Context:'CTX',tradeType:'T',notes:'',
  entryType:'MARKET',entryPrice:100,stopTicks:10,resultTicks:Number(src.Lot1Ticks||0),lots:[],
  instrumentId:'INS',riskStrategyId:'',riskStrategyName:'No clasificada',unknownInstrument:false,
  sourceIdentity:api?.id(src),sourceFingerprint:api?.fp(src),importDisposition:'insert',
  existingOperationId:'',conflictOperationIds:[],skipReason:'',possibleUpdate:false
});
const existingFrom=(src,id='imp-existing',extra={})=>({
  id,tradingPlanId:'PLAN',importBatchId:'B-OLD',
  raw:{source:'ankora',columns:src,sourceIdentity:api?.id(src),sourceFingerprint:api?.fp(src)},
  emotional:{fear:3},mfe:12,mae:4,sample:'LOCAL',executionEvidence:{source:'ninjatrader'},
  images:[{id:'IMG-1'}],...extra
});

if(api){
  // 1) New source => insert.
  context.state.operations=[];
  const d1=draft(source());
  api.classify([d1],plan);
  need(d1.importDisposition==='insert'&&d1.include===true,
    `D10 insert: esperado insert/include, obtenido ${d1.importDisposition}/${d1.include}`);

  // 2) Exact persisted RAW => skip, no second ID is created.
  const same=source();
  context.state.operations=[existingFrom(same)];
  const d2=draft(same);
  api.classify([d2],plan);
  need(d2.importDisposition==='skip'&&d2.include===false,
    `D10 exact reimport: esperado skip, obtenido ${d2.importDisposition}`);
  need(d2.existingOperationId==='imp-existing','D10 exact reimport: no enlazó el ID existente.');

  // 3) Same historical identity, one changed RAW => update same ID.
  const changed=source({Lot1Ticks:'9',ExitDateTime:'01/01/2026 10:08:00'});
  const d3=draft(changed);
  api.classify([d3],plan);
  need(d3.importDisposition==='update'&&d3.existingOperationId==='imp-existing',
    `D10 update: esperado update sobre imp-existing, obtenido ${d3.importDisposition}/${d3.existingOperationId}`);
  const prior=context.state.operations[0];
  const updated=api.make(d3,plan,'B-NEW',prior);
  need(updated.id==='imp-existing','D10 update creó un ID nuevo.');
  need(updated.importBatchId==='B-OLD'&&updated.lastImportBatchId==='B-NEW',
    'D10 update cambió la propiedad histórica del batch o no registró lastImportBatchId.');
  need(updated.emotional?.fear===3&&updated.mfe===12&&updated.mae===4&&updated.sample==='LOCAL',
    'D10 update destruyó anotaciones locales.');
  need(updated.executionEvidence?.source==='ninjatrader'&&updated.images?.[0]?.id==='IMG-1',
    'D10 update destruyó evidencia/recursos locales no pertenecientes a Ankora.');
  need(updated.raw?.sourceFingerprint===api.fp(changed)&&updated.raw?.sourceIdentity===api.id(changed),
    'D10 update no persistió fingerprint/identity de fuente.');

  // 4) Multiple persisted candidates for same identity => conflict.
  context.state.operations=[existingFrom(same,'imp-a'),existingFrom(same,'imp-b',{raw:{source:'ankora',columns:changed,sourceIdentity:api.id(changed),sourceFingerprint:api.fp(changed)}})];
  const d4=draft(source({Lot1Ticks:'7'}));
  api.classify([d4],plan);
  need(d4.importDisposition==='conflict'&&d4.include===false&&d4.conflictOperationIds.length===2,
    'D10 multiple persisted candidates were not blocked as conflict.');

  // 5) Duplicate identical row in same file => first actionable, second skip.
  context.state.operations=[];
  const d5a=draft(same),d5b=draft(same);d5b.rowIndex=2;
  api.classify([d5a,d5b],plan);
  need(d5a.importDisposition==='insert'&&d5b.importDisposition==='skip'&&d5b.skipReason==='duplicate_in_file',
    'D10 duplicate identical rows in one file are not de-duplicated deterministically.');

  // 6) Same identity + divergent source versions in one file => all conflict.
  const d6a=draft(source({Lot1Ticks:'5'})),d6b=draft(source({Lot1Ticks:'6'}));d6b.rowIndex=2;
  api.classify([d6a,d6b],plan);
  need(d6a.importDisposition==='conflict'&&d6b.importDisposition==='conflict'&&!d6a.include&&!d6b.include,
    'D10 divergent same-identity rows in one file were auto-merged instead of conflict.');

  // 7) Schema v5 batch resolves both inserted and updated affected IDs.
  context.state.operations=[
    {id:'new-1',importBatchId:'B-NEW'},
    {id:'updated-old',importBatchId:'B-OLD'},
    {id:'other',importBatchId:'B-OTHER'}
  ];
  const affected=api.batchOps({id:'B-NEW',schemaVersion:5,operationIds:['new-1','updated-old']}).map(o=>o.id).sort();
  need(JSON.stringify(affected)===JSON.stringify(['new-1','updated-old']),
    'D10 batch v5 no resuelve correctamente operaciones insertadas + actualizadas por operationIds.');
  const legacy=api.batchOps({id:'B-OLD',schemaVersion:4}).map(o=>o.id);
  need(legacy.length===1&&legacy[0]==='updated-old','D10 batch legacy perdió fallback por importBatchId.');

  // 8) Fingerprint is deterministic despite column insertion order.
  const reordered={};
  for(const k of Object.keys(same).reverse())reordered[k]=same[k];
  need(api.fp(same)===api.fp(reordered),'D10 fingerprint depends on object column insertion order.');
}

need(app.includes('function ankoraSourceFingerprint('),'D10: falta fingerprint estable de fuente Ankora.');
need(app.includes('function ankoraClassifyPreviewDrafts('),'D10: falta clasificación contra operaciones persistidas.');
need(app.includes("importDisposition:'insert'"),'D10: draft no declara política insert/update/skip/conflict.');
need(app.includes('sourceFingerprint'),'D10: fingerprint no se persiste con la operación.');
need(app.includes('function importBatchOperations('),'D10: batches de actualización no pueden resolver operaciones afectadas.');
const effectiveBatchTable=app.slice(app.lastIndexOf('function importBatchTable(batches){'),app.indexOf('\nfunction viewImportBatchTrades(',app.lastIndexOf('function importBatchTable(batches){')));
const effectiveBatchView=app.slice(app.indexOf('function viewImportBatchTrades(',app.lastIndexOf('function importBatchTable(batches){')),app.indexOf('\nfunction openImportBatchInspector(',app.indexOf('function viewImportBatchTrades(',app.lastIndexOf('function importBatchTable(batches){'))));
need(effectiveBatchTable.includes('insertedCount')&&effectiveBatchTable.includes('updatedCount'),'D10: tabla efectiva de batches no distingue inserts/updates.');
need(effectiveBatchView.includes('importBatchOperations(b)'),'D10: View trades efectivo no usa operationIds de schema v5.');
need(app.includes('schemaVersion:5'),'D10: batch de reconciliación no está versionado como schema 5.');
const effectiveConfirm=extractFunction(app,'confirmImportPreview');
need(!effectiveConfirm.includes('state.operations.push(...rows);'),'D10: confirmación efectiva sigue insertando todas las filas ciegamente.');
need(effectiveConfirm.includes("['insert','update'].includes(d.importDisposition)")&&effectiveConfirm.includes('state.operations[index]=row'),
  'D10: confirmación efectiva no aplica reconciliación insert/update explícita.');

if(fail.length){
  console.error('Ankora idempotency verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Ankora idempotency verification OK');
console.log(' - exact reimport => skip, no duplicate operation');
console.log(' - one changed version => update same operation ID');
console.log(' - local annotations/evidence survive source update');
console.log(' - duplicate input rows => deterministic skip');
console.log(' - ambiguous persisted or in-file versions => conflict, no auto-merge');
console.log(' - batch schema v5 tracks affected IDs and insert/update/skip/conflict counts');
