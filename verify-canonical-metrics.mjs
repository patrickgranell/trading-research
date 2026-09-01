import fs from 'node:fs';
import vm from 'node:vm';

const fail=[];
const assert=(cond,msg)=>{if(!cond)fail.push(msg);};
const near=(a,b,eps=1e-12)=>Number.isFinite(a)&&Math.abs(a-b)<=eps;

const app=fs.readFileSync('app.js','utf8');
function extractFunction(name){
  const token='function '+name;
  const start=app.indexOf(token);
  if(start<0)throw new Error('No se encontró '+token);
  const open=app.indexOf('{',start);
  let depth=0,quote='',escape=false;
  for(let i=open;i<app.length;i++){
    const c=app[i];
    if(quote){
      if(escape){escape=false;continue;}
      if(c==='\\'){escape=true;continue;}
      if(c===quote)quote='';
      continue;
    }
    if(c==="'"||c==='"' || c==='\`'){quote=c;continue;}
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error('Función sin cierre: '+name);
}

const bootstrapFlat={id:'bootstrap-flat',exitDate:'2026-09-01T09:05',result:'pending',resultTicks:0,rMultiple:0};
const bootstrapPending={id:'bootstrap-pending',exitDate:'',result:'pending',resultTicks:0,rMultiple:0};
const persistSnapshots=[];
const ctx={console,state:{operations:[bootstrapFlat,bootstrapPending]},persist(){persistSnapshots.push(ctx.state.operations.map(o=>o.result));return true;},setTimeout(){return 0;}};
vm.createContext(ctx);
vm.runInContext([
  extractFunction('opMetricValue'),
  extractFunction('calcStats'),
  extractFunction('calcMetricStats'),
  extractFunction('exitStats')
].join('\n'),ctx,{filename:'legacy-metric-adapters.js'});

if(fs.existsSync('canonical-metrics-runtime.js')){
  vm.runInContext(fs.readFileSync('canonical-metrics-runtime.js','utf8'),ctx,{filename:'canonical-metrics-runtime.js'});
}

assert(bootstrapFlat.result==='flat','Bootstrap en memoria debe elevar pending cerrado 0 a flat.');
assert(bootstrapPending.result==='pending','Bootstrap no debe convertir un pending real en flat.');
assert(persistSnapshots.length===0,'La normalización bootstrap no debe persistir ni migrar el dataset por sí sola.');

const win={id:'win',entryDate:'2026-09-01T10:00',exitDate:'2026-09-01T10:05',result:'win',resultTicks:20,rMultiple:2,mfe:3,mae:.5,pnlGross:200,pnlNet:190,commission:10};
const loss={id:'loss',entryDate:'2026-09-01T11:00',exitDate:'2026-09-01T11:04',result:'loss',resultTicks:-10,rMultiple:-1,mfe:.2,mae:1.2,pnlGross:-100,pnlNet:-110,commission:10};
const flatLegacy={id:'flat',entryDate:'2026-09-01T12:00',exitDate:'2026-09-01T12:03',result:'pending',resultTicks:0,rMultiple:0,mfe:.4,mae:.4,pnlGross:0,pnlNet:-10,commission:10};
const pending={id:'pending',entryDate:'2026-09-01T13:00',exitDate:'',result:'pending',resultTicks:50,rMultiple:5,mfe:7,mae:.1,pnlGross:500,pnlNet:490,commission:10};

const legacyCtx={console};
vm.createContext(legacyCtx);
vm.runInContext([
  extractFunction('opMetricValue'),
  extractFunction('calcStats'),
  extractFunction('calcMetricStats'),
  extractFunction('exitStats')
].join('\n'),legacyCtx,{filename:'legacy-red-reproduction.js'});
legacyCtx.__win=win;legacyCtx.__pending=pending;legacyCtx.__flat=flatLegacy;
const legacyRed=vm.runInContext(`({
  pfNoLoss:calcStats([__win]).pf,
  pendingN:calcMetricStats([__pending],'r','gross').n,
  zeroStoredResult:__flat.result
})`,legacyCtx);
assert(legacyRed.pfNoLoss===0,'Reproducción legado: calcStats debe demostrar el bug histórico PF=0 sin pérdidas.');
assert(legacyRed.pendingN===1,'Reproducción legado: calcMetricStats histórico debe demostrar que pending entraba en n.');
assert(legacyRed.zeroStoredResult==='pending','Reproducción legado: un cierre 0 histórico debe estar representado como pending antes del runtime canónico.');

assert(typeof ctx.trCanonicalOperationOutcome==='function','Falta la autoridad trCanonicalOperationOutcome().');
if(typeof ctx.trCanonicalOperationOutcome==='function'){
  assert(ctx.trCanonicalOperationOutcome(win,2)==='win','Cierre positivo debe clasificar win.');
  assert(ctx.trCanonicalOperationOutcome(loss,-1)==='loss','Cierre negativo debe clasificar loss.');
  assert(ctx.trCanonicalOperationOutcome(flatLegacy,0)==='flat','Cierre con métrica 0 debe clasificar flat, aunque el legado guarde pending.');
  assert(ctx.trCanonicalOperationOutcome(pending,5)==='pending','Sin evidencia de cierre debe seguir pending aunque exista una métrica stale.');
}

const pfOnlyWins=ctx.calcStats([win]);
assert(pfOnlyWins.pf===Infinity,'calcStats(): ganancias > 0 y pérdidas = 0 debe dar PF=Infinity.');

const ops=[win,flatLegacy,loss,pending];
const sR=ctx.calcStats(ops);
const sM=ctx.calcMetricStats(ops,'r','gross');
const sE=ctx.exitStats([2,0,-1]);

for(const [name,s] of [['calcStats',sR],['calcMetricStats',sM],['exitStats',sE]]){
  assert(s.n===3,name+': n debe incluir win/loss/flat y excluir pending.');
  assert(s.wins===1,name+': wins debe ser 1.');
  assert(s.losses===1,name+': losses debe ser 1.');
  assert(s.flats===1,name+': flats debe ser 1.');
  assert(near(s.expectancy,1/3),name+': expectancy canónica debe ser (2+0-1)/3.');
  assert(s.pf===2,name+': PF canónico debe ser 2.');
  assert(near(s.winRate,100/3),name+': win rate debe usar n canónico e incluir flat en denominador.');
}

assert(near(sR.sumR,1),'calcStats(): sumR debe ser 1.');
assert(near(sM.sum,1),'calcMetricStats(): sum debe ser 1.');
assert(near(sE.sum,1),'exitStats(): sum debe ser 1.');

const pendingOnly=ctx.calcMetricStats([pending],'r','gross');
assert(pendingOnly.n===0,'Pending real debe quedar fuera de n.');
assert(pendingOnly.expectancy===0,'Pending real debe quedar fuera de expectancy.');
assert(pendingOnly.pf===0,'Pending real debe quedar fuera de PF.');
assert(pendingOnly.winRate===0,'Pending real debe quedar fuera de win rate.');

const flatOnly=ctx.calcMetricStats([flatLegacy],'r','gross');
assert(flatOnly.n===1&&flatOnly.flats===1&&flatOnly.wins===0&&flatOnly.losses===0,'Flat cerrado debe contar en n, no como win/loss.');
assert(flatOnly.expectancy===0&&flatOnly.pf===0,'Flat-only debe tener expectancy 0 y PF 0.');

const futureFlat={id:'future-flat',exitDate:'2026-09-01T14:05',result:'pending',resultTicks:0,rMultiple:0};
const futurePending={id:'future-pending',exitDate:'',result:'pending',resultTicks:0,rMultiple:0};
ctx.state.operations=[futureFlat,futurePending];
ctx.persist();
assert(futureFlat.result==='flat','Antes de persistir, un cierre 0 debe canonicalizarse como flat.');
assert(futurePending.result==='pending','Antes de persistir, un pending real debe permanecer pending.');
assert(persistSnapshots.at(-1)?.[0]==='flat'&&persistSnapshots.at(-1)?.[1]==='pending','El persist base debe recibir outcomes ya canonicalizados.');

assert((app.match(/value:'flat',label:'Flat'/g)||[]).length>=3,'Los filtros principales deben exponer Flat.');
assert((app.match(/o\.result==='flat'\?'Flat':'Pendiente'/g)||[]).length>=2,'Las tablas/dimensiones deben distinguir Flat de Pendiente.');
assert(app.includes('<option value="flat"'),'El filtro de Mistakes debe exponer Flat.');

const metricWins=ctx.calcMetricStats([win],'r','gross');
assert(metricWins.pf===Infinity,'calcMetricStats(): ganancias > 0 y pérdidas = 0 debe dar PF=Infinity.');
const exitWins=ctx.exitStats([1,2]);
assert(exitWins.pf===Infinity,'exitStats(): ganancias > 0 y pérdidas = 0 debe dar PF=Infinity.');

if(fail.length){
  console.error('Canonical metrics verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Canonical metrics verification OK');
console.log(' - legacy red reproduced: PF=0 without losses + pending included before canonical authority');
console.log(' - pending excluded from n / PF / expectancy / win rate');
console.log(' - closed zero => flat in stats, in-memory state and future persistence');
console.log(' - PF: gain/no-loss => Infinity; zero/zero => 0');
console.log(' - calcStats / calcMetricStats / exitStats share canonical semantics');
