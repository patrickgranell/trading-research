import fs from 'node:fs';
import vm from 'node:vm';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';
import {migrateStateActionsToRegistry} from './state-registry-migration-transform.mjs';
import {migrateUiHandlersToRegistry} from './ui-registry-migration-transform.mjs';
import {closeResidualDirectMirrors} from './residual-mirror-closure-transform.mjs';
import {remainingGlobalContractMap} from './remaining-global-contract-map.mjs';

const app=fs.readFileSync('app.js','utf8');
const canonical=fs.readFileSync('canonical-metrics-runtime.js','utf8');
const blob=fs.readFileSync('blob-lifecycle-runtime.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

function extractFunction(src,name){
  const start=src.indexOf('function '+name+'(');
  if(start<0)throw new Error('No se encuentra '+name);
  const brace=src.indexOf('{',start);let depth=0,quote='',template=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i],p=src[i-1];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote&&p!=='\\')quote='';continue;}
    if(template){if(c==='\\'){i++;continue;}if(c==='\`'&&p!=='\\')template=false;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}if(c==='\`'){template=true;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('Función sin cierre: '+name);
}

// N01 · Running P&L must use the position that actually existed at each tick.
{
  const ctx={console};vm.createContext(ctx);
  vm.runInContext(extractFunction(app,'v315PreciseMs')+'\n'+extractFunction(app,'v315BuildSeries')+';globalThis.__build=v315BuildSeries;',ctx);
  const result={
    direction:'LONG',entryPrice:105,
    entryMatch:{i:0},exitMatch:{i:4},
    entryRows:[
      {wallMs:0,price:100,qty:1,action:'Comprar'},
      {wallMs:10000,price:110,qty:1,action:'Comprar'}
    ],
    exitRows:[{wallMs:20000,price:108,qty:2,action:'Vender'}]
  };
  const ticks=[
    [0,0,100,99,101],
    [5000,0,104,103,105],
    [10000,0,110,109,111],
    [15000,0,106,105,107],
    [20000,0,108,107,109]
  ];
  const series=ctx.__build(result,ticks,1,0);
  const beforeScaleIn=series?.points?.find(p=>p.i===1);
  need(beforeScaleIn?.pnlTicks===4,
    `N01: antes del segundo BUY, Last=104 sobre BUY1@100 debe ser +4t; obtenido ${beforeScaleIn?.pnlTicks}`);
}

// N02 · canonical outcome migration must run after durable hydration, not only at script load.
need(canonical.includes('trCoreHydrated'),
  'N02: Canonical Metrics no observa el estado de hidratación durable.');
need(!canonical.includes('trCanonicalBootstrapNormalizations=trCanonicalNormalizeStateOutcomes();'),
  'N02: Canonical Metrics sigue normalizando incondicionalmente al cargar el script.');

// N03 · blank result must remain absent/null, never collapse to numeric zero.
need(!app.includes("ticks=Number(get('resultTicks')||0)"),
  'N03: saveOperationFromForm todavía convierte resultTicks vacío en 0.');
need(app.includes('resultTicksRaw')||app.includes('resultTicks:null')||app.includes('resultTicks: null'),
  'N03: no hay evidencia de representación explícita null/ausente para resultado no introducido.');

// N04 · diagnostics must fail closed after GC failures.
need(!blob.includes('ok:!lastError||localGcFailures>0||cloudGcFailures>0'),
  'N04: Blob Lifecycle diagnostics conserva el booleano ok invertido.');
need(blob.includes('localGcFailures===0')&&blob.includes('cloudGcFailures===0'),
  'N04: Blob Lifecycle diagnostics no exige cero fallos de GC.');

// N05 · financial import must distinguish invalid numeric text from a legitimate zero.
need(!(app.includes("function nnum(v){const x=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(x)?x:0;}") &&
       app.includes('const q1=nnum(src.Lot1Quantity),q2=nnum(src.Lot2Quantity),t1=nnum(src.Lot1Ticks),t2=nnum(src.Lot2Ticks);')),
  'N05: Ankora sigue alimentando cantidades/ticks con un parser que degrada inválidos a 0.');
need(app.includes('invalidNumeric')||app.includes('invalidNumbers')||app.includes('nnumStrict')||app.includes('parseImportNumber'),
  'N05: no existe una frontera explícita de validación numérica Ankora.');

// D18 · CLI/check stage must measure the same app stage as build.
{
  const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js','cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js','style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'];
  const raw=Object.fromEntries(runtimeFiles.map(f=>[f,fs.readFileSync(f,'utf8')]));
  const render=consolidateLegacyRenderAssignments(app,{expected:12});
  const pruned=pruneAppGlobalExports(render.source,{runtimeSources:Object.values(raw)});
  const transformedState=transformStateActions(raw['state-runtime.js']).source;
  const runtimes=runtimeFiles.map(f=>f==='state-runtime.js'?transformedState:raw[f]);
  const cliLike=remainingGlobalContractMap(pruned.source,{runtimeSources:runtimes,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
  const stateMigrated=migrateStateActionsToRegistry(pruned.source);
  const uiMigrated=migrateUiHandlersToRegistry(stateMigrated.source);
  const closed=closeResidualDirectMirrors(uiMigrated.source);
  const buildLike=remainingGlobalContractMap(closed.source,{runtimeSources:runtimes,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
  const projection=x=>({remainingUnique:x.remainingUnique,classified:x.classified,unclassified:x.unclassified,multiContract:x.multiContract,coverage:x.coverage,byPrimary:x.byPrimary});
  need(JSON.stringify(projection(cliLike))===JSON.stringify(projection(buildLike)),
    'D18: contract-map CLI/check stage sigue sin coincidir con la etapa que analiza build.mjs.');
}

if(fail.length){
  console.error('\nV31.25 re-audit red gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('V31.25 re-audit gate OK');
console.log(' - N01 position-aware intratrade');
console.log(' - N02 post-hydration canonical normalization');
console.log(' - N03 null != zero outcome model');
console.log(' - N04 fail-closed Blob diagnostics');
console.log(' - N05 strict Ankora numeric validation');
console.log(' - D18 CLI/build contract-map stage parity');
