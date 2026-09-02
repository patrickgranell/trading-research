(()=>{
'use strict';

const TR_EXIT_LAB_V31_24_VERSION='31.24.0';
let trExitSimState={tpR:2,slR:1,loading:false,error:'',results:[],signature:'',generation:0,ranAt:''};
let trExitSimVisibleIds=[];

function trExitSimFirstTouch(result,ticks,tickSize,riskTicks,tpR,slR){
  const direction=String(result?.direction||'').toUpperCase();
  const entry=Number(result?.entryPrice),tick=Number(tickSize),risk=Number(riskTicks),tp=Number(tpR),sl=Number(slR);
  const start=Number(result?.entryMatch?.i),end=Number(result?.exitMatch?.i);
  if(!['LONG','SHORT'].includes(direction)||!Number.isFinite(entry)||!(tick>0)||!(risk>0)||!(tp>0)||!(sl>0)||!Number.isInteger(start)||!Number.isInteger(end)||end<start||!Array.isArray(ticks)){
    return {status:'unavailable',resultR:null,reason:'invalid_evidence'};
  }
  const tpPrice=direction==='LONG'?entry+tp*risk*tick:entry-tp*risk*tick;
  const slPrice=direction==='LONG'?entry-sl*risk*tick:entry+sl*risk*tick;
  const eps=Math.max(1e-9,tick*.05);
  for(let i=start;i<=end&&i<ticks.length;i++){
    const last=Number(ticks[i]?.[2]);if(!Number.isFinite(last))continue;
    const tpHit=direction==='LONG'?last>=tpPrice-eps:last<=tpPrice+eps;
    const slHit=direction==='LONG'?last<=slPrice+eps:last>=slPrice-eps;
    if(tpHit)return {status:'tp',resultR:tp,touchIndex:i,touchLast:last,touchMs:Number(ticks[i]?.[0])||null,tpPrice,slPrice};
    if(slHit)return {status:'sl',resultR:-sl,touchIndex:i,touchLast:last,touchMs:Number(ticks[i]?.[0])||null,tpPrice,slPrice};
  }
  return {status:'unresolved',resultR:null,tpPrice,slPrice,startIndex:start,endIndex:end};
}

function trExitSimRiskTicks(op){
  const raw=Number(op?.raw?.columns?.StopLossTicks??op?.raw?.StopLossTicks);
  if(raw>0)return {ticks:raw,source:'raw_stop'};
  const stops=(op?.strategyPlanSnapshot?.lots||[]).map(x=>Number(x?.stopTicks)).filter(x=>x>0);
  const unique=[...new Set(stops.map(x=>x.toFixed(8)))].map(Number);
  if(unique.length===1)return {ticks:unique[0],source:'uniform_strategy_stop'};
  return {ticks:null,source:stops.length?'non_uniform_stop':'missing_stop'};
}

function trExitSimSignature(ids=trExitSimVisibleIds){
  return (ids||[]).map(String).sort().join('|');
}
function trExitSimSetTp(v){trExitSimState.tpR=Math.max(.25,Number(v)||2);trExitSimState.results=[];trExitSimState.signature='';render();}
function trExitSimSetSl(v){trExitSimState.slR=Math.max(.25,Number(v)||1);trExitSimState.results=[];trExitSimState.signature='';render();}

async function trExitSimOperation(op,cache){
  const ev=op?.executionEvidence||{};
  const risk=trExitSimRiskTicks(op);
  if(!(risk.ticks>0))return {opId:op.id,status:'unavailable',resultR:null,reason:risk.source};
  if(!ev.execSetId||!ev.tradeId||!ev.marketDatasetId)return {opId:op.id,status:'unavailable',resultR:null,reason:'missing_market_evidence'};

  let set=cache.sets.get(ev.execSetId);
  if(!set){set=await v314StoreGet('execSets',ev.execSetId);if(set)cache.sets.set(ev.execSetId,set);}
  const result=(set?.results||[]).find(x=>x.id===ev.tradeId);
  if(!result?.entryMatch||!result?.exitMatch)return {opId:op.id,status:'unavailable',resultR:null,reason:'missing_fill_matches'};

  let meta=cache.metas.get(ev.marketDatasetId);
  if(!meta){meta=await v314StoreGet('marketMeta',ev.marketDatasetId);if(meta)cache.metas.set(ev.marketDatasetId,meta);}
  if(!meta)return {opId:op.id,status:'unavailable',resultR:null,reason:'missing_market_meta'};

  let ticks=cache.ticks.get(ev.marketDatasetId);
  if(!ticks){ticks=await v314LoadTicks(ev.marketDatasetId);if(ticks)cache.ticks.set(ev.marketDatasetId,ticks);}
  if(!ticks?.length)return {opId:op.id,status:'unavailable',resultR:null,reason:'missing_ticks'};

  return {
    opId:op.id,
    riskSource:risk.source,
    ...trExitSimFirstTouch(result,ticks,Number(meta.tickSize)||Number(op?.instrumentSnapshot?.tickSize)||.01,risk.ticks,trExitSimState.tpR,trExitSimState.slR)
  };
}

async function trExitLabRunSimulation(){
  const generation=++trExitSimState.generation;
  const ids=[...trExitSimVisibleIds],idSet=new Set(ids),ops=(state.operations||[]).filter(o=>idSet.has(o.id));
  trExitSimState.loading=true;trExitSimState.error='';trExitSimState.results=[];trExitSimState.signature=trExitSimSignature(ids);render();
  try{
    const cache={sets:new Map(),metas:new Map(),ticks:new Map()},results=[];
    for(const op of ops){
      const row=await trExitSimOperation(op,cache);
      if(generation!==trExitSimState.generation)return;
      results.push(row);
    }
    if(generation!==trExitSimState.generation)return;
    trExitSimState.results=results;trExitSimState.ranAt=new Date().toISOString();
  }catch(e){
    if(generation!==trExitSimState.generation)return;
    trExitSimState.error=e?.message||String(e);trExitSimState.results=[];
  }finally{
    if(generation===trExitSimState.generation){trExitSimState.loading=false;render();}
  }
}

function trExitSimReason(reason){
  return ({
    missing_market_evidence:'sin Execution Evidence + Market Data',
    missing_fill_matches:'sin matches exactos entrada/salida',
    missing_market_meta:'histórico Market Data no disponible',
    missing_ticks:'ticks no disponibles',
    missing_stop:'stop inicial no definido',
    non_uniform_stop:'stops por lote no uniformes',
    invalid_evidence:'evidencia inválida'
  })[reason]||reason||'no simulable';
}

function trExitSimPanel(ops){
  const sig=trExitSimSignature((ops||[]).map(o=>o.id));
  const fresh=trExitSimState.signature===sig,rows=fresh?trExitSimState.results:[];
  const tp=trExitSimState.tpR,sl=trExitSimState.slR;
  const settled=rows.filter(x=>x.status==='tp'||x.status==='sl');
  const tpHits=rows.filter(x=>x.status==='tp').length,slHits=rows.filter(x=>x.status==='sl').length;
  const unresolved=rows.filter(x=>x.status==='unresolved').length,unavailable=rows.filter(x=>x.status==='unavailable').length;
  const byId=new Map((ops||[]).map(o=>[o.id,o]));
  const simVals=settled.map(x=>Number(x.resultR));
  const actualVals=settled.map(x=>Number(globalThis.TradingResearchExitPresentationContract.readGrossR(byId.get(x.opId))));
  const sim=exitStats(simVals),actual=exitStats(actualVals),delta=sim.sum-actual.sum;
  const controls=`<div class="exit-section-head"><div><h4>TP + SL Simulation · first-touch</h4><p>Market Data real, desde el fill de entrada hasta el fill de salida final observado. Si ninguno toca antes de la salida real, queda <b>unresolved</b>; nunca se hereda el resultado histórico.</p></div><div class="actions"><label><span>TP</span><select class="select compact-select" data-tr-onchange="trExitSimSetTp(this.value)">${[.5,1,1.5,2,2.5,3].map(v=>`<option value="${v}" ${tp===v?'selected':''}>${v}R</option>`).join('')}</select></label><label><span>SL</span><select class="select compact-select" data-tr-onchange="trExitSimSetSl(this.value)">${[.5,.75,1,1.25,1.5,2].map(v=>`<option value="${v}" ${sl===v?'selected':''}>${v}R</option>`).join('')}</select></label><button class="btn primary" data-tr-onclick="trExitLabRunSimulation()" ${trExitSimState.loading?'disabled':''}>${trExitSimState.loading?'Calculando…':'Calcular con Market Data'}</button></div></div>`;

  let body='';
  if(trExitSimState.error)body=`<div class="notice danger"><strong>TP + SL Simulation:</strong> ${globalThis.TradingResearchContentEncodingContract.html(trExitSimState.error)}</div>`;
  else if(!fresh||!rows.length)body=`<div class="notice"><strong>Simulación separada del TP Overlay.</strong> Requiere Execution Evidence, histórico Tick, matches de entrada/salida y un stop inicial inequívoco. Usa Last para determinar qué nivel fue tocado primero; no modela cola de limit ni slippage.</div>`;
  else{
    const coverage=(ops||[]).length?settled.length/(ops||[]).length*100:0;
    body=`<div class="exit-observed-grid"><div class="exit-observed-card"><span>Settled</span><strong>${settled.length}/${(ops||[]).length}</strong><small>${globalThis.TradingResearchExitPresentationContract.formatPercentValue(coverage)} del subconjunto</small></div><div class="exit-observed-card"><span>TP primero</span><strong>${tpHits}</strong><small>+${tp}R</small></div><div class="exit-observed-card"><span>SL primero</span><strong>${slHits}</strong><small>−${sl}R</small></div><div class="exit-observed-card"><span>Unresolved / no simulable</span><strong>${unresolved} / ${unavailable}</strong><small>sin imputar salida real</small></div></div>
    <div class="exit-two-tables"><div><div class="exit-subtitle"><h4>Comparación solo sobre settled</h4><small>No mezcla unresolved ni no simulables.</small></div><div class="exit-table-wrap"><table class="exit-table"><thead><tr><th>Métrica</th><th>Real</th><th>TP+SL</th><th>Δ</th></tr></thead><tbody><tr><th>Resultado</th><td>${globalThis.TradingResearchExitPresentationContract.formatRValue(actual.sum)}</td><td>${globalThis.TradingResearchExitPresentationContract.formatRValue(sim.sum)}</td><td class="${globalThis.TradingResearchExitPresentationContract.classifyResult(delta)}">${globalThis.TradingResearchExitPresentationContract.formatRValue(delta)}</td></tr><tr><th>Expectancy</th><td>${globalThis.TradingResearchExitPresentationContract.formatRValue(actual.expectancy)}</td><td>${globalThis.TradingResearchExitPresentationContract.formatRValue(sim.expectancy)}</td><td>${globalThis.TradingResearchExitPresentationContract.formatRValue(sim.expectancy-actual.expectancy)}</td></tr><tr><th>PF</th><td>${globalThis.TradingResearchExitPresentationContract.formatProfitFactorValue(actual.pf)}</td><td>${globalThis.TradingResearchExitPresentationContract.formatProfitFactorValue(sim.pf)}</td><td>—</td></tr></tbody></table></div></div>
    <div><div class="exit-subtitle"><h4>Casos no resueltos</h4><small>Razón explícita en vez de rellenar con el cierre histórico.</small></div><div class="exit-table-wrap"><table class="exit-table"><thead><tr><th>Estado</th><th>N</th></tr></thead><tbody>${Object.entries(rows.filter(x=>x.status==='unavailable').reduce((m,x)=>(m[trExitSimReason(x.reason)]=(m[trExitSimReason(x.reason)]||0)+1,m),{})).map(([k,n])=>`<tr><th>${globalThis.TradingResearchContentEncodingContract.html(k)}</th><td>${n}</td></tr>`).join('')||'<tr><th>Sin incidencias</th><td>0</td></tr>'}<tr><th>Ni TP ni SL antes de salida real</th><td>${unresolved}</td></tr></tbody></table></div></div></div>`;
  }
  return `<div class="exit-be-panel">${controls}${body}<div class="help">Supuesto de microestructura: toque por <b>Last</b>. Resultado bruto en R. No se atribuye fill exacto de limit, slippage ni comisión; esas hipótesis deben modelarse por separado.</div></div>`;
}

const trExitLabModuleBase=exitLabModule;
exitLabModule=function(ops){
  trExitSimVisibleIds=(ops||[]).map(o=>o.id);
  let html=trExitLabModuleBase(ops);
  html=html.replace(/Escenario · TP fijo/g,'TP Overlay · MFE')
    .replace(/escenarios de TP fijo a partir de MFE/g,'TP Overlay a partir de MFE')
    .replace(/TP fijo/g,'TP Overlay')
    .replace(/Mapa de objetivos fijos/g,'Mapa TP Overlay');
  const panel=trExitSimPanel(ops),at=html.lastIndexOf('</section>');
  return at>=0?html.slice(0,at)+panel+html.slice(at):html+panel;
};

const registry=window.TradingResearchActions;
if(registry&&typeof registry==='object'){
  registry.trExitSimSetTp=trExitSimSetTp;
  registry.trExitSimSetSl=trExitSimSetSl;
  registry.trExitLabRunSimulation=trExitLabRunSimulation;
}

window.TradingResearchExitLabV31_24=Object.freeze({
  version:TR_EXIT_LAB_V31_24_VERSION,
  firstTouch:trExitSimFirstTouch,
  diagnostics:()=>({
    version:TR_EXIT_LAB_V31_24_VERSION,
    tpR:trExitSimState.tpR,slR:trExitSimState.slR,
    loading:trExitSimState.loading,
    rows:trExitSimState.results.length,
    settled:trExitSimState.results.filter(x=>x.status==='tp'||x.status==='sl').length,
    unresolved:trExitSimState.results.filter(x=>x.status==='unresolved').length,
    unavailable:trExitSimState.results.filter(x=>x.status==='unavailable').length,
    model:'Last first-touch within observed entry-to-final-exit window'
  })
});
})();
