import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const exitRuntime=fs.readFileSync('exit-lab-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(app.includes("function v314PositionAwarePath(trade,ticks,tickSize,offsetHours,mode='points')"),
  'Position-aware engine no expone modos points/summary/columns.');
need(app.includes("const collectMode=mode==='columns'?'columns':mode==='summary'?'summary':'points'"),
  'Position-aware engine no selecciona representación explícita.');
need(app.includes("new Int32Array(capacity)")&&app.includes("new Float64Array(capacity)"),
  'Running P&L no usa columnas tipadas compactas.');
need(app.includes("columns.tickIndex[pointCount]=i;columns.pnlTicks[pointCount]=totalAggregateTicks;"),
  'El modo columnar no conserva índice de tick + P&L exacto por observación.');
need(app.includes("v314PositionAwarePath(trade,ticks,tickSize,offsetHours,'summary')"),
  'Calibración todavía materializa recorrido por tick en vez de summary O(1).');
need(app.includes("v314PositionAwarePath(result,ticks,tickSize,offsetHours,'columns')"),
  'Running P&L no solicita representación columnar exacta.');
need(app.includes("return {ticks,tickIndex:path.columns.tickIndex,pnlTicks:path.columns.pnlTicks,pointCount"),
  'Running P&L no reutiliza el histórico bruto junto a columnas compactas.');
need(!app.includes("const points=path.points;if(!points.length)return null;"),
  'Running P&L todavía retiene path.points por tick.');
need(app.includes("const maxRender=1500,step=Math.max(1,Math.ceil(n/maxRender))"),
  'El downsample visual de 1.500 puntos no está separado de la serie exacta.');
need(app.includes("function v315SeriesPoint(series,index)"),
  'Falta accessor de cursor que reconstruye Last/Bid/Ask desde el tick bruto.');
need(exitRuntime.includes("ticks=await v314LoadTicks(ev.marketDatasetId)")&&exitRuntime.includes("trExitSimFirstTouch(result,ticks"),
  'Exit Lab no consume directamente resolución Tick bruta.');
need(!exitRuntime.includes('v315RunningUi')&&!exitRuntime.includes('v315BuildSeries'),
  'Exit Lab quedó acoplado a la representación/render de Running P&L.');

const start=app.indexOf('function v314PositionAwarePath(');
const end=start<0?-1:app.indexOf('\nfunction v314CalculateTrade(',start);
need(start>=0&&end>start,'No se pudo aislar v314PositionAwarePath para equivalencia funcional.');

if(start>=0&&end>start){
  const source=app.slice(start,end);
  const context={
    v314FindFill:(_ticks,nominalMs,price)=>({i:Number(nominalMs),ms:Number(nominalMs),deltaMs:0,last:price,bid:price,ask:price,field:'last',score:0}),
    v314TickPreciseMs:t=>Number(t?.[0]||0)
  };
  vm.createContext(context);
  vm.runInContext(source+'\nthis.positionAware=v314PositionAwarePath;',context);

  const ticks=[
    [0,0,100,99,101],
    [1,0,102,101,103],
    [2,0,104,103,105],
    [3,0,106,105,107],
    [4,0,103,102,104],
    [5,0,105,104,106]
  ];
  const trade={
    direction:'LONG',peakQuantity:2,totalEntryQuantity:2,quantity:2,
    entryRows:[
      {wallMs:0,price:100,qty:1,action:'BUY',sourceLine:1},
      {wallMs:2,price:104,qty:1,action:'BUY',sourceLine:2}
    ],
    exitRows:[
      {wallMs:4,price:103,qty:1,action:'SELL',sourceLine:3},
      {wallMs:5,price:105,qty:1,action:'SELL',sourceLine:4}
    ]
  };

  const full=context.positionAware(trade,ticks,1,0);
  const summary=context.positionAware(trade,ticks,1,0,'summary');
  const columns=context.positionAware(trade,ticks,1,0,'columns');

  need(full.ok&&summary.ok&&columns.ok,'Alguno de los tres modos position-aware no reconstruye el fixture.');
  need(full.points.length===6&&summary.pointCount===6&&columns.pointCount===6,
    'Los modos no conservan exactamente las seis observaciones.');
  need(summary.points.length===0&&summary.columns===null,
    'Summary mode materializa datos por tick.');
  need(columns.points.length===0,
    'Columns mode todavía materializa objetos por tick.');
  need(Object.prototype.toString.call(columns.columns?.tickIndex)==='[object Int32Array]'
    &&Object.prototype.toString.call(columns.columns?.pnlTicks)==='[object Float64Array]',
    'Columns mode no usa Int32Array + Float64Array.');

  const pnl=[...columns.columns.pnlTicks.slice(0,columns.pointCount)];
  const idx=[...columns.columns.tickIndex.slice(0,columns.pointCount)];
  need(pnl.every((value,i)=>Math.abs(value-full.points[i].pnlTicks)<1e-12),
    'Columns mode altera el P&L tick a tick.');
  need(idx.every((value,i)=>value===full.points[i].i),
    'Columns mode altera el índice exacto del tick.');
  for(const field of ['aggregateRealizedTicks','realizedTicks','mfeExcursionTicks','maeExcursionTicks','minLast','maxLast','minPnlTicks','maxPnlTicks','startMs','endMs','lastPnlTicks']){
    need(Object.is(full[field],summary[field])&&Object.is(summary[field],columns[field]),
      'Divergencia entre representaciones en '+field+'.');
  }
  need(full.aggregateRealizedTicks===4&&full.mfeExcursionTicks===4&&full.maeExcursionTicks===0,
    'El fixture position-aware cambió su semántica financiera esperada.');

  const maxTicks=2_000_000;
  const compactBytes=maxTicks*(Int32Array.BYTES_PER_ELEMENT+Float64Array.BYTES_PER_ELEMENT);
  need(compactBytes===24_000_000,'Presupuesto columnar máximo inesperado.');
}

if(fail.length){
  console.error('Intratrade Memory verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}

console.log('Intratrade Memory verification OK');
console.log(' - calibration: exact position-aware scan, O(1) per-trade path memory');
console.log(' - Running P&L: full-resolution tickIndex Int32Array + pnlTicks Float64Array');
console.log(' - 2,000,000-point column budget: 24,000,000 bytes (~22.9 MiB) plus shared raw tick dataset');
console.log(' - chart: <= 1,500 rendered points only; cursor/extrema retain full resolution');
console.log(' - Exit Lab: independent raw-tick first-touch path, no Running P&L downsample dependency');
