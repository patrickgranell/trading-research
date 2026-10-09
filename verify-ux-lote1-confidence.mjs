import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// Reproduce 124 registered / 123 closed, and 5 selected / 4 closed.
// Confidence must be calculated on the SAME closed rows as the KPI denominator.
const checks=[];
const ctx={
  console,
  state:{operations:[]},
  trCoreHydrated:false,
  persist(){},
  trCanonicalCalcStatsLegacy:null,
  calcStats(){return{};},
  exitStats(){return{};},
  opMetricValue:o=>o.rMultiple??0,
  calcMetricStats(ops){
    const values=ops.map(o=>o.rMultiple??0),wins=values.filter(v=>v>0).length;
    checks.push({values:[...values],wins});
    const n=values.length,mean=n?values.reduce((a,b)=>a+b,0)/n:NaN;
    return {mean,sd:n>=2?1:NaN,se:n>=2?1/Math.sqrt(n):NaN,
      ciLow95:n>=2?mean-.5:NaN,ciHigh95:n>=2?mean+.5:NaN,
      winLow95:n?100*wins/n-1:NaN,winHigh95:n?100*wins/n+1:NaN};
  },
  TradingResearchCoreHydrationReadContract:{ready:()=>false}
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('canonical-metrics-runtime.js','utf8'),ctx);
const make=(i,closed)=>({id:String(i),entryDate:'2026-07-01T10:00',exitDate:closed?'2026-07-01T10:01':'',rMultiple:closed?(i%2===0?2:-1):0});
const all=Array.from({length:124},(_,i)=>make(i,i!==123));
const s=ctx.calcMetricStats(all,'r','gross');
assert.equal(s.n,123);
assert.equal(checks.at(-1).values.length,123);
assert.equal(s.wins,62);
assert(Number.isFinite(s.ciLow95)&&Number.isFinite(s.ciHigh95));
assert(Number.isFinite(s.winLow95)&&Number.isFinite(s.winHigh95));
const filtered=[all[0],all[1],all[2],all[3],all[123]];
const f=ctx.calcMetricStats(filtered,'r','gross');
assert.equal(f.n,4);
assert.equal(checks.at(-1).values.length,4);
assert(Number.isFinite(f.ciLow95)&&Number.isFinite(f.winLow95));
const pendingOnly=ctx.calcMetricStats([all[123]],'r','gross');
assert.equal(pendingOnly.n,0);
assert(Number.isNaN(pendingOnly.ciLow95));
assert(Number.isNaN(pendingOnly.winLow95));
const zero=ctx.calcMetricStats([make(1,true),{...make(2,true),rMultiple:0}],'r','gross');
assert.equal(zero.n,2);
assert(Number.isFinite(zero.ciLow95));
console.log('TR-UX-024 eligible confidence inputs: PASS (124/123, 5/4, pending, real zero)');
