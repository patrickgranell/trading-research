const TR_CANONICAL_METRICS_VERSION='31.24.0';

let trCanonicalBootstrapNormalizations=0;
let trCanonicalPersistNormalizations=0;

function trCanonicalHasCloseEvidence(op){
  if(!op||typeof op!=='object')return false;
  if(String(op.exitDate??'').trim())return true;
  const ev=op.executionEvidence;
  if(ev&&typeof ev==='object'){
    if(String(ev.exitDate??'').trim())return true;
    if(Array.isArray(ev.exitExecutionIds)&&ev.exitExecutionIds.length)return true;
    if(ev.linkedAt&&ev.tradeId)return true;
  }
  const cols=op.raw?.columns;
  if(cols&&typeof cols==='object'&&String(cols.ExitDateTime??cols.ExitTime??'').trim())return true;
  return false;
}

function trCanonicalFiniteMetric(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function trCanonicalOperationOutcome(op,metricValue){
  if(!trCanonicalHasCloseEvidence(op))return 'pending';
  const value=trCanonicalFiniteMetric(metricValue);
  if(value===null)return 'pending';
  return value>0?'win':value<0?'loss':'flat';
}

function trCanonicalOperationResultMetric(op){
  for(const value of [op?.resultTicks,op?.rMultiple,op?.pnlGross]){
    const n=trCanonicalFiniteMetric(value);
    if(n!==null)return n;
  }
  return null;
}

function trCanonicalNormalizeOperationOutcome(op){
  if(!op||typeof op!=='object')return false;
  const outcome=trCanonicalOperationOutcome(op,trCanonicalOperationResultMetric(op));
  if(op.result===outcome)return false;
  op.result=outcome;
  return true;
}

function trCanonicalNormalizeStateOutcomes(){
  if(typeof state==='undefined'||!Array.isArray(state?.operations))return 0;
  let changed=0;
  for(const op of state.operations)if(trCanonicalNormalizeOperationOutcome(op))changed++;
  return changed;
}

function trCanonicalStatsFromValues(values){
  const a=(values||[]).map(trCanonicalFiniteMetric).filter(v=>v!==null);
  const n=a.length,w=a.filter(v=>v>0),l=a.filter(v=>v<0),flats=a.filter(v=>v===0).length;
  const wins=w.length,losses=l.length,sum=a.reduce((x,y)=>x+y,0),gain=w.reduce((x,y)=>x+y,0),lossAbs=Math.abs(l.reduce((x,y)=>x+y,0));
  let eq=0,peak=0,trough=0,maxDD=0,maxDU=0;const equity=[];
  for(const v of a){eq+=v;peak=Math.max(peak,eq);trough=Math.min(trough,eq);maxDD=Math.min(maxDD,eq-peak);maxDU=Math.max(maxDU,eq-trough);equity.push(eq);}
  const avgWin=wins?gain/wins:0,avgLoss=losses?l.reduce((x,y)=>x+y,0)/losses:0;
  return {
    n,wins,losses,flats,
    winRate:n?wins/n*100:0,
    sum,
    expectancy:n?sum/n:0,
    pf:lossAbs?gain/lossAbs:(gain?Infinity:0),
    maxDD,maxDU,equity,
    avgWin,avgLoss,
    maxWin:wins?Math.max(...w):0,
    maxLoss:losses?Math.min(...l):0,
    payoff:avgLoss?Math.abs(avgWin/avgLoss):0
  };
}

function trCanonicalOperationRows(ops,valueOf){
  const rows=[];
  for(const op of ops||[]){
    const value=trCanonicalFiniteMetric(valueOf(op));
    if(value===null)continue;
    const outcome=trCanonicalOperationOutcome(op,value);
    if(outcome==='pending')continue;
    rows.push({op,value,outcome});
  }
  return rows;
}

const trCanonicalCalcStatsLegacy=calcStats;
calcStats=function(ops){
  const rows=trCanonicalOperationRows(ops,o=>o?.rMultiple);
  const base=trCanonicalStatsFromValues(rows.map(x=>x.value));
  const included=rows.map(x=>x.op),n=base.n;
  return {
    n,wins:base.wins,losses:base.losses,flats:base.flats,winRate:base.winRate,
    sumR:base.sum,expectancy:base.expectancy,pf:base.pf,maxDD:base.maxDD,
    avgMfe:n?included.reduce((a,o)=>a+(Number(o.mfe)||0),0)/n:0,
    avgMae:n?included.reduce((a,o)=>a+(Number(o.mae)||0),0)/n:0,
    equity:base.equity
  };
};

const trCanonicalCalcMetricStatsLegacy=calcMetricStats;
calcMetricStats=function(ops,unit='r',basis='gross'){
  const rows=trCanonicalOperationRows(ops,o=>opMetricValue(o,unit,basis));
  const base=trCanonicalStatsFromValues(rows.map(x=>x.value)),included=rows.map(x=>x.op);
  const commissions=included.reduce((a,o)=>a+(Number(o.commission)||0),0);
  const netUsd=included.reduce((a,o)=>a+(Number(o.pnlNet)||0),0);
  const grossUsd=included.reduce((a,o)=>a+(Number(o.pnlGross)||0),0);
  return {
    n:base.n,wins:base.wins,losses:base.losses,flats:base.flats,winRate:base.winRate,
    sum:base.sum,expectancy:base.expectancy,pf:base.pf,maxDD:base.maxDD,maxDU:base.maxDU,
    equity:base.equity,avgWin:base.avgWin,avgLoss:base.avgLoss,maxWin:base.maxWin,maxLoss:base.maxLoss,
    commissions,netUsd,grossUsd,payoff:base.payoff
  };
};

const trCanonicalExitStatsLegacy=exitStats;
exitStats=function(vals){
  const base=trCanonicalStatsFromValues(vals);
  return {
    n:base.n,wins:base.wins,losses:base.losses,flats:base.flats,winRate:base.winRate,
    sum:base.sum,expectancy:base.expectancy,pf:base.pf,maxDD:base.maxDD,maxDU:base.maxDU,equity:base.equity
  };
};

function trCanonicalNormalizeAfterHydration(){
  if(typeof trCoreHydrated!=='undefined'&&!trCoreHydrated)return 0;
  const changed=trCanonicalNormalizeStateOutcomes();
  trCanonicalBootstrapNormalizations+=changed;
  return changed;
}
if(typeof trCoreHydrated!=='undefined'&&trCoreHydrated){
  trCanonicalNormalizeAfterHydration();
}else if(typeof addEventListener==='function'){
  addEventListener('tradingresearch:core-hydrated',()=>trCanonicalNormalizeAfterHydration(),{once:true});
}

if(typeof persist==='function'){
  const trCanonicalPersistBaseV31_24=persist;
  persist=function(...args){
    trCanonicalPersistNormalizations+=trCanonicalNormalizeStateOutcomes();
    return trCanonicalPersistBaseV31_24.apply(this,args);
  };
}

if(typeof window!=='undefined'){
  window.TradingResearchCanonicalMetrics=Object.freeze({
    version:TR_CANONICAL_METRICS_VERSION,
    outcome:trCanonicalOperationOutcome,
    stats:trCanonicalStatsFromValues,
    diagnostics:()=>({
      version:TR_CANONICAL_METRICS_VERSION,
      bootstrapNormalizations:trCanonicalBootstrapNormalizations,
      persistNormalizations:trCanonicalPersistNormalizations,
      pfNoLoss:'Infinity',
      zeroOutcome:'flat',
      settledRequiresCloseEvidence:true
    })
  });
  if(trCanonicalBootstrapNormalizations&&typeof setTimeout==='function'){
    setTimeout(()=>{try{if(typeof window.render==='function')window.render();}catch(_){}},0);
  }
}
