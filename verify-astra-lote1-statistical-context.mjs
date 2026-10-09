import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const canonical=fs.readFileSync(new URL('./canonical-metrics-runtime.js',import.meta.url),'utf8');
const ux=fs.readFileSync(new URL('./statistical-ux-runtime.js',import.meta.url),'utf8');
const calc=app.slice(app.indexOf('function meanOf(vals)'),app.indexOf('const calcMetricStatsV18Base',app.indexOf('function meanOf(vals)')));
assert(calc.includes('function confidenceFromValues('),'Original t/Wilson estimator required');
const ctx=vm.createContext({
  console,
  state:{operations:[],tradingPlans:[],currentPlanId:'tp'},
  window:{},
  TradingResearchCoreHydrationReadContract:{ready:()=>true},
  TradingResearchOperationSemanticsContract:{
    planEnvironment:p=>p.environment,
    recordClass:o=>o.environment==='backtest'?'backtest':'execution',
    executionEnvironment:o=>o.environment
  },
  calcStats:()=>({}),calcMetricStats:()=>({}),exitStats:()=>({}),
  opMetricValue:(o,unit='r',basis='gross')=>unit==='r'?(basis==='net'?o.netR:o.rMultiple):unit==='ticks'?o.resultTicks:o.pnlGross,
  pageHead:()=>'<div class="topbar"><div class="page-title"><h2>Panel</h2><p>Intro</p></div><div class="actions"></div></div>',
  confidenceMaturity:n=>({label:n>100?'Muestra amplia':'Exploratoria'}),
  confidenceEvidence:s=>({label:s.n<2?'Sin estimar':'Calculada'}),
  analyzeDataQuality:(p,ops)=>({
    coverage:[{id:'journal',weight:10,pct:0,total:ops.length,ok:0,missingIds:ops.map(o=>o.id),label:'Diario emocional'}],
    baseScore:72,penalty:2,score:70,issues:[]}),
  dqCoverageCard:c=>String(c.pct)+'%',
  dqReadiness:(ops,p)=>({a:{score:70},checks:[{id:'score',value:70,target:75,ok:false},{id:'journal',value:0,target:90,ok:false}],ready:false}),
  dqReadinessPanel:()=>'<div>old</div>',
  dataQualityView:()=>'<div>quality</div>',
  render:()=>'<div>render</div>',
  refreshOpsAnalytics:()=>null,
  planLabel:p=>p.name+' · '+p.version,
  currentOps:()=>ctx.state.operations.filter(o=>o.tradingPlanId===ctx.state.currentPlanId),
  filteredOps:()=>ctx.state.operations.filter(o=>o.tradingPlanId===ctx.state.currentPlanId&&!o.hidden),
  labFilteredOps:()=>ctx.state.operations.filter(o=>o.tradingPlanId===ctx.state.currentPlanId),
  getCurrentPlan:()=>({id:'tp',name:'prova1',version:'v1',environment:ctx.planEnv||'backtest'}),
  v313ReportOps:()=>[],
  esc:s=>String(s),
  opsViewState:{unit:'r',basis:'gross'},labState:{unit:'r',basis:'net'},reportsViewState:{unit:'r',basis:'net'},blockViewState:{unit:'r',basis:'gross'},
  currentView:'operations',
  v3194CompareOps:(a,b)=>new Date(a.entryDate)-new Date(b.entryDate),
  document:{getElementById:()=>null}
});
ctx.globalThis=ctx;
vm.runInContext(calc,ctx);
vm.runInContext(canonical,ctx);
function op(id,r,{closed=true,env='backtest',plan='tp',hidden=false}={}){
 return {id,tradingPlanId:plan,entryDate:'2026-01-01T12:00',exitDate:closed?'2026-01-01T12:05':'',
   rMultiple:r,netR:r,resultTicks:r*10,pnlGross:r*10,environment:env,hidden};
}
const sample123=Array.from({length:123},(_,i)=>op('p'+i,i<82?2:-1));
const sample5=[op('a',1),op('b',-1),op('c',2),op('d',0),op('e',-1)];
for(const [label,sample,n] of [['n=123',sample123,123],['n=5',sample5,5]]){
  const s=ctx.calcMetricStats(sample,'r','gross');
  assert.equal(s.n,n);
  for(const key of ['ciLow95','ciHigh95','winLow95','winHigh95'])
    assert(Number.isFinite(s[key]),label+' missing finite '+key);
  assert(s.winLow95>=0&&s.winHigh95<=100&&s.winLow95<=s.winHigh95);
  assert(s.ciLow95<=s.expectancy&&s.ciHigh95>=s.expectancy);
  console.log('PASS confidence '+label+'; WR Wilson '+s.winLow95.toFixed(1)+'% → '+s.winHigh95.toFixed(1)+'%');
}
const missing=[op('pending',-0.16,{closed:false})],zero=[op('flat',0)];
assert.equal(ctx.calcMetricStats(missing).n,0,'Pending trades cannot count in KPIs');
assert.equal(ctx.calcMetricStats(zero).n,1,'Closed flat with finite zero is a real observation');
assert.equal(ctx.calcMetricStats([sample5[0],missing[0]]).n,1,'Exclude pending from confidence denominator');
assert.equal(ctx.calcMetricStats([op('other',12,{plan:'other'})].filter(o=>o.tradingPlanId==='tp')).n,0);
const unordered=[{...op('c',-2),entryDate:'2026-01-03T12:00'},{...op('a',1),entryDate:'2026-01-01T12:00'},{...op('b',1),entryDate:'2026-01-02T12:00'}];
vm.runInContext(ux,ctx);
ctx.state.operations=[...sample123,op('pending',-.16,{closed:false})];
const api=ctx.window.TradingResearchStatisticalUX;
ctx.currentView='tpbuilder';
assert.equal(ctx.calcMetricStats(unordered,'r','gross').maxDD,-2,'Builder chronological drawdown must use time order');
ctx.currentView='operations';
assert.equal(ctx.calcMetricStats(unordered,'r','gross').maxDD,-2,'Outside the Builder the canonical estimator remains unchanged');

const counts=api.countRows(ctx.state.operations);
assert.equal(counts.total,124);assert.equal(counts.closed,123);assert.equal(counts.eligible,123);
assert.equal(counts.noClose,1);assert.equal(counts.noFinite,0);
const context=api.contextMarkup();
assert(context.includes('prova1')&&context.includes('Backtesting')&&context.includes('Registros <b>124</b>')&&context.includes('Elegibles <b>123</b>'));
assert(api.stateLabel(0,0,0)==='Sin operaciones');
assert(api.stateLabel(12,0,0)==='Sin resultados por filtros');
assert(api.stateLabel(2,2,0)==='Sin operaciones cerradas elegibles');
assert(api.stateLabel(2,2,1).includes('Muestra insuficiente'));
assert(api.stateLabel(2,2,2)==='');
const empty=api.countRows([]);
assert.equal(empty.eligible,0);
assert(ctx.dqCoverageCard({id:'mfe',label:'MFE',pct:0,total:0}).includes('Sin evaluar'));
const plan={environment:'backtest'};
const quality=ctx.analyzeDataQuality(plan,[sample5[0]]);
assert(quality.coverage[0].notApplicable,'Backtesting diary must be N/A');
assert(quality.score>70,'Quality score must not penalize unavailable backtest diary');
assert(!ctx.dqReadiness([sample5[0]],plan).checks.some(x=>x.id==='journal'));
assert(ctx.dqReadinessPanel().includes('old'),'Populated samples preserve readiness rules');
ctx.state.operations=[];
assert(ctx.dqReadinessPanel().includes('Estándar sin evaluar'));
assert(ctx.dataQualityView().includes('calidad no evaluada'));
const mature=ctx.confidenceMaturity(0);
assert.equal(mature.label,'Sin operaciones');
const nonfinite=ctx.confidenceEvidence({n:3,ciLow95:NaN,ciHigh95:NaN});
assert(nonfinite.detail.includes('no finito'),'Do not wrongly claim n<2 when n=3');
assert(ux.includes("currentView==='tpbuilder'")&&ux.includes('[...ops].sort(v3194CompareOps)'),
  'Constructor source/filtered samples must use matching chronological inputs for Max DD');
assert(ux.includes('No hay desviaciones de disciplina en las últimas 5 operaciones.')&&ux.includes('Sin observaciones suficientes'),'Drift empty-state guard');
console.log('PASS 001 / 004 / 014 / 024: denominators, pending, flat 0, empty, filters, backtesting, nonfinite and DD order');
