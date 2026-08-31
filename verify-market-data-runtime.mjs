import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

function extractFunction(src,name){
  const variants=['async function '+name+'(','function '+name+'('];
  let start=-1;for(const v of variants){start=src.indexOf(v);if(start>=0)break;}
  if(start<0)throw new Error('No se encuentra '+name);
  const brace=src.indexOf('{',start);let depth=0,quote='',template=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i],p=src[i-1];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote&&p!=='\\')quote='';continue;}
    if(template){if(c==='\\'){i++;continue;}if(c==='`'&&p!=='\\')template=false;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}if(c==='`'){template=true;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('Función sin cierre: '+name);
}
function extractDeclaration(src,name){
  const safe=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');
  const patterns=[
    new RegExp('const\\s+'+safe+'\\s*=\\s*[^;]+;'),
    new RegExp('let\\s+'+safe+'\\s*=\\s*[^;]+;')
  ];
  for(const re of patterns){const m=src.match(re);if(m)return m[0];}
  return '';
}

// D12 · execute the real cache loader/helpers.
{
  const context={
    v314TickCache:new Map(),
    v314StoreGet:async(store,id)=>({id,ticks:[id]}),
    console
  };
  vm.createContext(context);
  const pieces=[];
  for(const n of ['V314_TICK_CACHE_MAX_DATASETS','V314_TICK_CACHE_MAX_TICKS','v314TickCacheTicks','v314TickCacheEvictions']){
    const x=extractDeclaration(app,n);if(x)pieces.push(x);
  }
  for(const n of ['v314TickCacheGet','v314TickCachePut','v314TickCacheDelete']){
    try{pieces.push(extractFunction(app,n));}catch{}
  }
  pieces.push(extractFunction(app,'v314LoadTicks'));
  try{vm.runInContext(pieces.join('\n')+';globalThis.__load=v314LoadTicks;',context);}
  catch(e){fail.push('D12: no se pudo ejecutar loader real: '+e.message);}
  if(context.__load){
    for(let i=0;i<6;i++)await context.__load('MD-'+i);
    need(context.v314TickCache.size<=2,`D12: cache de datasets sin cota efectiva; size=${context.v314TickCache.size}`);
  }
  need(app.includes('V314_TICK_CACHE_MAX_DATASETS'),'D12: falta cota explícita por número de datasets.');
  need(app.includes('V314_TICK_CACHE_MAX_TICKS'),'D12: falta cota explícita por ticks aproximados.');
  need(app.includes('v314TickCacheEvictions'),'D12: falta diagnóstico de evictions.');
}

// D13 · force A -> B, B resolves first, then A. Latest selection must win.
{
  const deferred=[];
  const context={
    v315RunningUi:{tab:'running',tradeIndex:0,mode:'pnl',cursor:0,loading:false,error:'',series:null,metaId:'',execId:''},
    v314MarketUi:{
      activeExecId:'EX',
      activeMarketId:'MD',
      execSets:[{id:'EX',marketDatasetId:'MD',offsetHours:0,results:[{id:'A'},{id:'B'}]}],
      metas:[{id:'MD',tickSize:1}]
    },
    v314LoadTicks:()=>new Promise(resolve=>deferred.push(resolve)),
    v315BuildSeries:r=>({points:[{id:r.id}],marker:r.id}),
    render(){},
    console
  };
  vm.createContext(context);
  const pieces=[];
  for(const n of ['v315LoadGeneration','v315DiscardedLoads']){
    const x=extractDeclaration(app,n);if(x)pieces.push(x);
  }
  pieces.push(extractFunction(app,'v315LoadTrade'));
  try{vm.runInContext(pieces.join('\n')+';globalThis.__load=v315LoadTrade;',context);}
  catch(e){fail.push('D13: no se pudo ejecutar loader real: '+e.message);}
  if(context.__load){
    const a=context.__load(0),b=context.__load(1);
    need(deferred.length===2,`D13 fixture: se esperaban 2 cargas pendientes, obtenidas ${deferred.length}`);
    if(deferred[1])deferred[1](['B']);await Promise.resolve();await Promise.resolve();
    if(deferred[0])deferred[0](['A']);await a;await b;
    need(context.v315RunningUi.tradeIndex===1,'D13: la selección final debería seguir en B.');
    need(context.v315RunningUi.series?.marker==='B',
      `D13: respuesta obsoleta A pisó la serie visible; marker=${context.v315RunningUi.series?.marker||'null'}`);
  }
  need(app.includes('v315LoadGeneration'),'D13: falta generation token.');
  need(app.includes('v315DiscardedLoads'),'D13: falta observabilidad de cargas obsoletas descartadas.');
}

// R04 · verified property: marketMeta + marketTicks commit in one IDB transaction.
{
  const txCalls=[];
  const context={
    queueMicrotask,
    v314Db:async()=>({
      transaction(stores,mode){
        const tx={stores:[...stores],mode,puts:[],deletes:[],error:null,oncomplete:null,onerror:null,onabort:null,
          objectStore(store){return {put:value=>tx.puts.push({store,value}),delete:id=>tx.deletes.push({store,id})};}
        };
        txCalls.push(tx);queueMicrotask(()=>tx.oncomplete?.());return tx;
      },
      close(){}
    })
  };
  vm.createContext(context);
  try{
    vm.runInContext(extractFunction(stateRuntime,'trV314ApplyChanges')+';globalThis.__apply=trV314ApplyChanges;',context);
    await context.__apply([
      {type:'put',store:'marketMeta',id:'MD1',value:{id:'MD1'}},
      {type:'put',store:'marketTicks',id:'MD1',value:{id:'MD1',ticks:[]}}
    ]);
  }catch(e){fail.push('R04: no se pudo ejecutar transacción efectiva: '+e.message);}
  need(txCalls.length===1,`R04: meta/ticks deben usar una sola transacción; calls=${txCalls.length}`);
  if(txCalls[0]){
    need(txCalls[0].mode==='readwrite','R04: transacción meta/ticks no es readwrite.');
    need(txCalls[0].stores.includes('marketMeta')&&txCalls[0].stores.includes('marketTicks'),
      'R04: la transacción única no incluye ambos stores marketMeta + marketTicks.');
  }
  need(stateRuntime.includes("trRunAtomicImport('import.ninjatrader.market'")&&stateRuntime.includes('stageMarketData:true'),
    'R04: la importación histórica no pasa por staging Market Data.');
}

if(fail.length){
  console.error('Market Data cache / Running P&L / R04 verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Market Data cache / Running P&L / R04 verification OK');
console.log(' - D12: bounded LRU cache by datasets + approximate ticks');
console.log(' - D13: stale async Running P&L loads cannot overwrite latest selection');
console.log(' - R04: marketMeta + marketTicks commit in one readwrite IndexedDB transaction');
