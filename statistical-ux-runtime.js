/* TR-UX-001 / 004 / 014 · Context and sample-state presentation.
   Read-only: this file does not persist, reclassify or reorder operations. */
(()=>{
'use strict';
const envContract=globalThis.TradingResearchOperationSemanticsContract;
const envLabels={backtest:'Backtesting',replay:'Market Replay',sim:'SIM',live:'Live',pending:'Pendiente',unclassified:'Sin clasificar'};
/* The Builder sorts the derived sample chronologically but keeps the source
   in storage order. Drawdown is path-dependent: reuse the existing calculator
   with chronological inputs for BOTH Builder preview and frozen provenance.
   No new formula and no effect outside the Builder view. */
const trUXCalcMetricBase=calcMetricStats;
calcMetricStats=function(ops,unit='r',basis='gross'){
  const ordered=typeof currentView!=='undefined'&&currentView==='tpbuilder'&&Array.isArray(ops)
    ? [...ops].sort(v3194CompareOps):ops;
  return trUXCalcMetricBase(ordered,unit,basis);
};
const htmlValue=v=>typeof esc==='function'?esc(String(v)):String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const countRows=(ops,unit='r',basis='gross')=>{
  const input=Array.isArray(ops)?ops:[];
  const closed=input.filter(o=>trCanonicalHasCloseEvidence(o));
  const eligible=trCanonicalOperationRows(input,o=>opMetricValue(o,unit,basis));
  return Object.freeze({total:input.length,closed:closed.length,eligible:eligible.length,
    noClose:input.length-closed.length,noFinite:closed.length-eligible.length,
    unit,basis});
};
const stateLabel=(total,visible,eligible)=>{
  if(!total)return 'Sin operaciones';
  if(!visible)return 'Sin resultados por filtros';
  if(!eligible)return 'Sin operaciones cerradas elegibles';
  if(eligible===1)return 'Muestra insuficiente para IC95 (n=1)';
  return '';
};
function planEnvironment(p){return p&&envContract?.planEnvironment?.(p)||'unclassified';}
function isBacktest(p){return planEnvironment(p)==='backtest';}
function sampleForView(){
  const view=String(typeof currentView!=='undefined'?currentView:'');
  if(['plans','config','gallery','builder','tpbuilder'].includes(view))return null;
  const all=typeof currentOps==='function'?currentOps():[];
  let shown=all,unit='r',basis='gross',filterNote='';
  try{
    if(view==='operations'){
      shown=filteredOps();unit=opsViewState.unit;basis=opsViewState.basis;
      const excluded=all.length-shown.length;filterNote=excluded?excluded+' apartadas por filtros/gestión':'Sin exclusiones por filtros';
    }else if(view==='lab'){
      shown=labFilteredOps();unit=labState.unit;basis=labState.basis;
      const excluded=all.length-shown.length;filterNote=excluded?excluded+' apartadas por filtros':'Sin exclusiones por filtros';
    }else if(view==='reports'||view==='report'){
      shown=v313ReportOps();unit=reportsViewState.unit;basis=reportsViewState.basis;
      filterNote=typeof v313ReportScopeLabel==='function'?v313ReportScopeLabel(getCurrentPlan()):'Alcance del informe';
    }else if(view==='blocks'){unit=blockViewState.unit;basis=blockViewState.basis;}
    else if(view==='calendar'&&typeof calendarViewState!=='undefined'){unit=calendarViewState.unit||unit;basis=calendarViewState.basis||basis;}
    else if(view==='dashboard'&&typeof dashboardViewState!=='undefined'){unit=dashboardViewState.unit||unit;}
  }catch(e){return null;}
  return {view,all,shown,unit,basis,filterNote};
}
function contextMarkup(){
  const p=getCurrentPlan(),q=sampleForView();if(!p||!q)return '';
  const c=countRows(q.shown,q.unit,q.basis),layers=new Map();
  for(const o of q.shown){
    const klass=envContract?.recordClass?.(o);
    const key=klass==='backtest'?'backtest':envContract?.executionEnvironment?.(o)||'unclassified';
    layers.set(key,(layers.get(key)||0)+1);
  }
  const environment=layers.size>1?'Mixto ('+[...layers].map(([k,n])=>(envLabels[k]||k)+' '+n).join(' · ')+')':
    envLabels[[...layers.keys()][0]||planEnvironment(p)]||'Sin clasificar';
  const status=stateLabel(q.all.length,c.total,c.eligible);
  const note=q.filterNote?' · '+q.filterNote:'';
  const units=q.unit==='ticks'?'Ticks':q.unit==='usd'?'US$':'R';
  const unusual=q.view==='journalstreaks'?' · Drawdown de rachas: ticks netos (escala fija)':'';
  const body=`<span><b>${htmlValue(planLabel(p))}</b></span><span>${htmlValue(environment)}</span><span title="Los pendientes y los resultados no finitos no entran en el denominador del KPI">Registros <b>${c.total}</b> · Cerradas <b>${c.closed}</b> · Elegibles <b>${c.eligible}</b>${c.noClose?` · ${c.noClose} sin cierre`:''}${c.noFinite?` · ${c.noFinite} sin métrica válida`:''}</span><span>${htmlValue(units)} · ${q.basis==='net'?'Neto':'Bruto'}${htmlValue(unusual)}</span>${note?`<span>${htmlValue(note.slice(3))}</span>`:''}${status?`<span class="tr-ux-absence">${htmlValue(status)}</span>`:''}`;
  return '<div class="tr-analytic-context" aria-label="Contexto y denominador del análisis">'+body+'</div>';
}
const prevPageHead=pageHead;
pageHead=function(...args){
  const output=prevPageHead.apply(this,args),bar=contextMarkup();
  return bar?output.replace('</p></div><div class="actions">','</p>'+bar+'</div><div class="actions">'):output;
};

const prevConfidenceMaturity=confidenceMaturity;
confidenceMaturity=function(n){return n===0?{key:'unknown',label:'Sin operaciones',detail:'No existe muestra evaluable'}:prevConfidenceMaturity(n);};
const prevConfidenceEvidence=confidenceEvidence;
confidenceEvidence=function(s){
  if(!s?.n)return {key:'unknown',label:'Sin operaciones',detail:'No hay operaciones cerradas elegibles'};
  if(s.n>=2&&(!finite(s.ciLow95)||!finite(s.ciHigh95)))
    return {key:'unknown',label:'Sin estimar',detail:'Intervalo no finito en la muestra elegible; revisar valores o varianza'};
  return prevConfidenceEvidence(s);
};

/* Explicit sample-independent applicability: the emotional diary is optional
   in Backtesting. Do not mark historic missing notes as bad performance data. */
const originalAnalyzeDataQuality=analyzeDataQuality;
analyzeDataQuality=function(p=getCurrentPlan(),ops=currentOps()){
  const a=originalAnalyzeDataQuality(p,ops);
  if(!isBacktest(p)||!Array.isArray(a.coverage))return a;
  const journal=a.coverage.find(x=>x.id==='journal');if(!journal)return a;
  const coverage=a.coverage.map(x=>x.id==='journal'?{...x,ok:0,total:0,pct:0,weight:0,missingIds:[],notApplicable:true,note:'No aplica como requisito de Backtesting; registro emocional voluntario.'}:x);
  const denominator=100-(Number(journal.weight)||0),base=(a.baseScore-(Number(journal.pct)||0)*(Number(journal.weight)||0)/100)*100/denominator;
  const score=Math.max(0,Math.min(100,base-a.penalty));
  return {...a,coverage,baseScore:base,score};
};
const originalCoverageCard=dqCoverageCard;
dqCoverageCard=function(c){
  if(c?.notApplicable)return '<article class="dq-coverage-card tr-ux-na"><div class="dq-cov-head"><span>'+htmlValue(c.label)+'</span><strong>No aplica</strong></div><div class="dq-cov-meta"><span>Backtesting</span><small>'+htmlValue(c.note)+'</small></div></article>';
  if(!c?.total)return '<article class="dq-coverage-card tr-ux-na"><div class="dq-cov-head"><span>'+htmlValue(c?.label||'Cobertura')+'</span><strong>Sin evaluar</strong></div><div class="dq-cov-meta"><span>0/0</span><small>No hay operaciones; no se calcula cobertura.</small></div></article>';
  return originalCoverageCard(c);
};
const originalDqReadiness=dqReadiness;
dqReadiness=function(ops=currentOps(),p=getCurrentPlan()){
  const r=originalDqReadiness(ops,p),checks=isBacktest(p)?r.checks.filter(x=>x.id!=='journal'):r.checks;
  if(isBacktest(p)){
    const score=checks.find(x=>x.id==='score');if(score){score.value=r.a.score;score.ok=r.a.score>=score.target;}
  }
  return {...r,checks,ready:ops.length>0&&checks.every(x=>x.ok)};
};
const originalDqReadinessPanel=dqReadinessPanel;
dqReadinessPanel=function(){
  if(!currentOps().length)return '<section class="card panel dq-readiness tr-ux-neutral"><div class="panel-title"><div><h3>Estándar sin evaluar</h3><small>No hay operaciones para puntuar o exigir cobertura (0/0). No representa incumplimiento.</small></div></div></section>';
  return originalDqReadinessPanel();
};
const originalDataQualityView=dataQualityView;
dataQualityView=function(){
  if(!currentOps().length)return pageHead('Data Quality & Integrity','Cobertura e integridad de la muestra seleccionada.')+activePlanBanner()+'<section class="card panel tr-ux-neutral"><h3>Sin operaciones · calidad no evaluada</h3><p>Sin muestra, el score y la integridad no se califican. Registra o importa operaciones antes de evaluar cobertura.</p></section>';
  return originalDataQualityView();
};

/* Never treat missing evaluation as a zero result in Drift. */
if(typeof trJournalDriftRender==='function'){
  const originalDriftRender=trJournalDriftRender;
  trJournalDriftRender=function(...args){
    let out=originalDriftRender.apply(this,args);
    const p=getCurrentPlan(),d=typeof trDriftData==='function'&&p?trDriftData(p):null;
    if(d&&d.recent.known.length<3){
      out=out.replace('No hay desviaciones de disciplina en las últimas 5 operaciones.','Sin observaciones suficientes para afirmar que no hubo desviaciones.');
      if(!d.recent.operations.length)out=out.replace(/(<div class="label">Resultado reciente<\/div><div class="value">)[^<]*/,'$1—');
    }
    return out;
  };
}

function decorateKpiEmpty(root,rows){
  if(rows.total>0&&rows.eligible>0)return;
  const blocks=root.querySelectorAll('.analytics-kpis .kpi, .lab-kpis .kpi, .report-kpis .kpi');
  for(const card of blocks){
    const title=card.querySelector('.label, span')?.textContent?.trim().toLowerCase()||'';
    if(!/win rate|expectancy|profit factor|drawdown|max dd|media ganadora|media perdedora|r media|resultado/.test(title))continue;
    const value=card.querySelector('.value, strong');
    if(!value)continue;
    value.textContent='—';value.classList.remove('positive','negative');
    const sub=card.querySelector('.sub,small');if(sub)sub.textContent=rows.total?'No evaluado · sin cierre elegible':'Sin muestra';
  }
}
function decorate(){
  if(typeof document==='undefined')return;
  const root=document.getElementById('view');if(!root)return;
  const q=sampleForView(),p=getCurrentPlan();
  if(q){
    const rows=countRows(q.shown,q.unit,q.basis);
    if(['operations','lab','reports','report','dashboard'].includes(q.view))decorateKpiEmpty(root,rows);
    if(q.view==='operations'){
      const card=[...root.querySelectorAll('.analytics-kpis .kpi')].find(x=>x.querySelector('.label')?.textContent?.trim()==='Operaciones');
      if(card){
        const sub=card.querySelector('.sub');
        if(sub){
          const outOfFilter=q.all.length-q.shown.length;
          sub.textContent=q.shown.length+' visibles · '+rows.eligible+' cerradas elegibles'+(rows.noClose?' · '+rows.noClose+' sin cierre':'')+(rows.noFinite?' · '+rows.noFinite+' sin métrica':'')+(outOfFilter?' · '+outOfFilter+' fuera por filtros/gestión':'');
        }
      }
    }
    if(q.view==='lab'){
      const confidence=root.querySelector('.confidence-module');
      if(confidence){
        const evidence=confidence.querySelector('.confidence-status:first-child');
        const maturity=confidence.querySelector('.confidence-status:nth-child(2)');
        if(!rows.total&&q.all.length){
          for(const panel of [evidence,maturity]){
            const title=panel?.querySelector('strong'),sub=panel?.querySelector('small');
            if(title)title.textContent='Sin resultados por filtros';
            if(sub)sub.textContent='La selección actual no contiene operaciones';
          }
        }
        if(rows.eligible===0){
          const cells=confidence.querySelectorAll('.confidence-kpis>div');
          for(const cell of cells){
            const value=cell.querySelector('strong');
            if(value){value.textContent='—';value.classList.remove('positive','negative');}
            const sub=cell.querySelector('small');
            if(sub)sub.textContent=rows.total?'Sin cierre elegible':'Sin muestra';
          }
        }
      }
    }
    if(['reports','report'].includes(q.view)&&rows.eligible===0){
      for(const section of root.querySelectorAll('.report-section')){
        const heading=section.querySelector('h3')?.textContent||'';
        if(!heading.includes('Confianza')&&!heading.includes('Desglose'))continue;
        for(const cell of section.querySelectorAll('.report-grid-3>div, .report-two-col td')){
          if(heading.includes('Confianza')){
            const label=cell.querySelector('span')?.textContent||'';
            if(!/IC95|primera mitad|segunda mitad|límite inferior|evidencia/i.test(label))continue;
          }
          const strong=cell.querySelector('strong');
          if(strong&&(/^(?:0(?:\\.0+)?%?|NaN%?|—|Sin estimar|0\\.00R)/i.test(strong.textContent.trim())||heading.includes('Desglose'))){
            strong.textContent='—';strong.classList.remove('positive','negative');
          }
        }
      }
    }
    if(q.view==='lab'&&isBacktest(p)){
      const card=[...root.querySelectorAll('.lab-kpis .kpi')].find(x=>x.querySelector('.label')?.textContent?.trim()==='Muestra');
      const sub=card?.querySelector('.sub');if(sub)sub.textContent=rows.eligible+' elegibles · diario emocional opcional en Backtesting';
    }
    if(q.view==='blocks'){
      const all=[...q.all].sort(v3194CompareOps);
      root.querySelectorAll('.block-card').forEach((card,i)=>{
        const slice=all.slice(i*20,i*20+20),c=countRows(slice,q.unit,q.basis);
        const label=card.querySelector('.block-core-grid>div:first-child span');
        if(label)label.textContent='Ops elegibles';
        const strong=card.querySelector('.block-core-grid>div:first-child strong');
        if(strong)strong.title=c.total+' registros · '+c.closed+' cerradas · '+c.eligible+' elegibles';
        const box=card.querySelector('.block-top');
        if(box&&!box.querySelector('.tr-ux-block-n'))box.insertAdjacentHTML('beforeend','<small class="tr-ux-block-n">'+c.total+' registros · '+c.eligible+' elegibles</small>');
        if(!c.eligible)for(const block of card.querySelectorAll('.block-core-grid>div:not(:first-child)')){const v=block.querySelector('strong');if(v)v.textContent='—';}
      });
    }
  }
  // A plan comparison is grouped for navigation only; every row owns its TP
  // and version. 'Trades' uses the closed/finite denominator, not total records.
  for(const table of root.querySelectorAll('.plan-table')){
    const heading=table.querySelector('thead th:nth-child(4)');
    if(heading)heading.textContent='Cerradas elegibles';
    for(const row of table.querySelectorAll('tbody tr')){
      const identity=row.querySelector('td:first-child strong')?.textContent?.trim();
      if(!identity)continue;
      const candidates=state.tradingPlans.filter(x=>planLabel(x)===identity);
      if(candidates.length!==1)continue; // Ambiguous names: never guess an ID.
      const ops=state.operations.filter(x=>x.tradingPlanId===candidates[0].id);
      const c=countRows(ops,'r','gross');
      const count=row.querySelector('td:nth-child(4)');
      if(count){count.title=c.total+' registros · '+c.closed+' cerradas · '+c.eligible+' elegibles'+(c.noClose?' · '+c.noClose+' sin cierre':'');}
      if(!c.eligible){
        for(const td of [...row.querySelectorAll('td')].slice(4)){
          td.textContent='—';td.classList.remove('positive','negative');
        }
      }
    }
  }
  if(root.querySelector('.plan-card')){
    for(const card of root.querySelectorAll('.plan-card[data-tr-plan-card-id]')){
      const p0=getPlan(card.dataset.trPlanCardId);if(!p0)continue;
      const all=state.operations.filter(o=>o.tradingPlanId===p0.id),c=countRows(all);
      const metric=card.querySelector('.plan-metrics>div:first-child');
      if(metric){
        const label=metric.querySelector('span');if(label)label.textContent='Trades elegibles';
        if(!metric.querySelector('.tr-ux-plan-n'))metric.insertAdjacentHTML('beforeend','<small class="tr-ux-plan-n">'+c.total+' registros · '+c.closed+' cerradas'+(c.noClose?' · '+c.noClose+' sin cierre':'')+'</small>');
      }
    }
  }
  const builder=root.querySelector('#tp-builder-view');
  if(builder){
    const sourceId=builder.querySelector('#tpb-source')?.value;
    const source=state.operations.filter(o=>o.tradingPlanId===sourceId),original=builder.querySelector('.grid.two .plan-metrics');
    if(original&&!original.querySelector('.tr-ux-plan-n')){
      const c=countRows(source,'r','net'),first=original.querySelector('div:first-child');
      first?.insertAdjacentHTML('beforeend','<small class="tr-ux-plan-n">'+c.total+' registros · '+c.closed+' cerradas · '+c.eligible+' elegibles</small>');
    }
    // Derived universe has distinct source and filter counts; do not infer its
    // drawdown from the unfiltered row order.
    const cards=builder.querySelectorAll('.grid.two .plan-metrics');
    const matched=builder.querySelector('.panel-title .help')?.textContent||'';
    if(cards.length>1&&!cards[1].querySelector('.tr-ux-plan-n')){
      const marker=builder.textContent.match(/(\d+) incluidas · (\d+) apartadas/);
      const metric=cards[1].querySelector('div:first-child');
      if(metric&&marker)metric.insertAdjacentHTML('beforeend','<small class="tr-ux-plan-n">'+marker[1]+' registros filtrados · '+marker[2]+' excluidos por filtros</small>');
    }
  }
  if(isBacktest(p)){
    root.querySelectorAll('.report-grid-3>div').forEach(el=>{
      if(el.querySelector('span')?.textContent?.trim()==='Diario emocional'){
        const strong=el.querySelector('strong'),note=el.querySelector('small');
        if(strong)strong.textContent='No aplica';if(note)note.textContent='Opcional en Backtesting';
      }
    });
  }
  if(q&&q.view==='journalstreaks'){
    root.querySelectorAll('.panel-title').forEach(el=>{
      if(el.textContent.includes('Drawdown')&&!el.querySelector('.tr-ux-dd-scope'))el.insertAdjacentHTML('beforeend','<small class="tr-ux-dd-scope">Drawdown: ticks netos (unidad fija)</small>');
    });
  }
}
const prevRender=render;
render=function(...args){const out=prevRender.apply(this,args);decorate();return out;};
if(typeof window!=='undefined')window.render=render;
if(typeof refreshOpsAnalytics==='function'){
  const prevRefresh=refreshOpsAnalytics;
  refreshOpsAnalytics=function(...args){const out=prevRefresh.apply(this,args);decorate();return out;};
}
if(typeof window!=='undefined'){
  window.TradingResearchStatisticalUX=Object.freeze({countRows,stateLabel,contextMarkup,isBacktest,decorate});
}
})();
