import fs from 'node:fs';
import vm from 'node:vm';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';
import {migrateStateActionsToRegistry} from './state-registry-migration-transform.mjs';
import {migrateUiHandlersToRegistry} from './ui-registry-migration-transform.mjs';
import {closeResidualDirectMirrors} from './residual-mirror-closure-transform.mjs';
import {remainingGlobalContractMap,prepareRemainingGlobalContractStage} from './remaining-global-contract-map.mjs';

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
  vm.runInContext([
    extractFunction(app,'v314LowerBoundTicks'),
    extractFunction(app,'v314FindFill'),
    extractFunction(app,'v314TickPreciseMs'),
    extractFunction(app,'v314PositionAwarePath'),
    extractFunction(app,'v315BuildSeries')
  ].join('\n')+';globalThis.__path=v314PositionAwarePath;globalThis.__build=v315BuildSeries;',ctx);

  const scaleIn={
    direction:'LONG',entryPrice:105,peakQuantity:2,totalEntryQuantity:2,
    entryMatch:{i:0},exitMatch:{i:4},
    entryRows:[
      {wallMs:0,price:100,qty:1,action:'Comprar',sourceLine:1},
      {wallMs:10000,price:110,qty:1,action:'Comprar',sourceLine:2}
    ],
    exitRows:[{wallMs:20000,price:108,qty:2,action:'Vender',sourceLine:3}]
  };
  const scaleTicks=[
    [0,0,100,99,100],
    [5000,0,104,103,105],
    [10000,0,110,109,110],
    [15000,0,106,105,107],
    [20000,0,108,108,109]
  ];
  const path=ctx.__path(scaleIn,scaleTicks,1,0),series=ctx.__build(scaleIn,scaleTicks,1,0);
  const beforeScaleIn=path?.points?.find(p=>p.i===1),afterScaleIn=path?.points?.find(p=>p.i===2);
  need(beforeScaleIn?.pnlTicks===4&&beforeScaleIn?.openQuantity===1&&beforeScaleIn?.averageEntry===100,
    `N01 scale-in: antes del segundo BUY debe ser qty1 avg100 +4t; obtenido qty=${beforeScaleIn?.openQuantity}, avg=${beforeScaleIn?.averageEntry}, pnl=${beforeScaleIn?.pnlTicks}`);
  need(afterScaleIn?.pnlTicks===10&&afterScaleIn?.openQuantity===2&&afterScaleIn?.averageEntry===105,
    `N01 scale-in: después BUY@110 debe ser qty2 avg105 +10t agregados; obtenido qty=${afterScaleIn?.openQuantity}, avg=${afterScaleIn?.averageEntry}, pnl=${afterScaleIn?.pnlTicks}`);
  need(series?.aggregateRealizedTicks===6&&series?.realizedTicks===3,
    `N01 scale-in: cierre @108 debe realizar 6t agregados / 3t equivalentes; obtenido ${series?.aggregateRealizedTicks}/${series?.realizedTicks}`);

  const reentry={
    direction:'LONG',entryPrice:106.6666666667,peakQuantity:2,totalEntryQuantity:3,
    entryMatch:{i:0},exitMatch:{i:3},
    entryRows:[
      {wallMs:0,price:100,qty:2,action:'Comprar',sourceLine:1},
      {wallMs:2000,price:120,qty:1,action:'Comprar',sourceLine:3}
    ],
    exitRows:[
      {wallMs:1000,price:110,qty:1,action:'Vender',sourceLine:2},
      {wallMs:3000,price:115,qty:2,action:'Vender',sourceLine:4}
    ]
  };
  const reTicks=[
    [0,0,100,99,100],
    [1000,0,110,110,111],
    [2000,0,120,119,120],
    [3000,0,115,115,116]
  ];
  const rePath=ctx.__path(reentry,reTicks,1,0),reSeries=ctx.__build(reentry,reTicks,1,0),atReentry=rePath?.points?.find(p=>p.i===2);
  need(atReentry?.openQuantity===2&&atReentry?.averageEntry===110&&atReentry?.realizedAggregateTicks===10&&atReentry?.pnlTicks===30,
    `N01 re-entry: esperado qty2 avg110 realized10 total30; obtenido qty=${atReentry?.openQuantity}, avg=${atReentry?.averageEntry}, realized=${atReentry?.realizedAggregateTicks}, pnl=${atReentry?.pnlTicks}`);
  need(reSeries?.aggregateRealizedTicks===20&&Math.abs(Number(reSeries?.realizedTicks)-20/3)<1e-9,
    `N01 re-entry: cierre agregado esperado 20t; obtenido ${reSeries?.aggregateRealizedTicks}`);

  const shortTrade={
    direction:'SHORT',entryPrice:105,peakQuantity:2,totalEntryQuantity:2,
    entryMatch:{i:0},exitMatch:{i:3},
    entryRows:[
      {wallMs:0,price:110,qty:1,action:'Vender',sourceLine:1},
      {wallMs:2000,price:100,qty:1,action:'Vender',sourceLine:2}
    ],
    exitRows:[{wallMs:3000,price:105,qty:2,action:'Comprar',sourceLine:3}]
  };
  const shortTicks=[
    [0,0,110,110,111],
    [1000,0,106,106,107],
    [2000,0,100,100,101],
    [3000,0,105,104,105]
  ];
  const shPath=ctx.__path(shortTrade,shortTicks,1,0),sh=ctx.__build(shortTrade,shortTicks,1,0),beforeSecondShort=shPath?.points?.find(p=>p.i===1);
  need(beforeSecondShort?.pnlTicks===4&&beforeSecondShort?.averageEntry===110,
    `N01 SHORT: antes del segundo SELL debe ser +4t desde 110; obtenido ${beforeSecondShort?.pnlTicks}`);
  need(sh?.aggregateRealizedTicks===0,'N01 SHORT: cierre simétrico esperado 0t agregados.');
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
  const canonicalStage=prepareRemainingGlobalContractStage(app,{runtimeSources:Object.values(raw)});
  const render=consolidateLegacyRenderAssignments(app,{expected:12});
  const pruned=pruneAppGlobalExports(render.source,{runtimeSources:Object.values(raw)});
  const stateMigrated=migrateStateActionsToRegistry(pruned.source);
  const uiMigrated=migrateUiHandlersToRegistry(stateMigrated.source);
  const closed=closeResidualDirectMirrors(uiMigrated.source);
  need(canonicalStage.source===closed.source,
    'D18: la preparación canónica del contract-map no coincide byte a byte con la etapa real del build.');
  const transformedState=transformStateActions(raw['state-runtime.js']).source;
  const runtimes=runtimeFiles.map(f=>f==='state-runtime.js'?transformedState:raw[f]);
  const inv=remainingGlobalContractMap(canonicalStage.source,{runtimeSources:runtimes,stateActionTransformSource:fs.readFileSync('state-action-transform.mjs','utf8')});
  need(inv.remainingUnique===0&&inv.unclassified===0,
    `D18: la etapa final debería cerrar exports explícitos; remaining=${inv.remainingUnique}, unclassified=${inv.unclassified}`);
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
