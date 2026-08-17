/* ===== V31.21.1 RUNTIME · Reports Render Purity ===== */
(()=>{
'use strict';
const TR_REPORTS_PURITY_VERSION='31.21.1';

function trReportNormalizedPresets(p){
  const src=Array.isArray(p?.reportPresets)?p.reportPresets:[];
  return src.map((x,i)=>({
    id:x?.id||`RPT_VIEW_${i}`,
    name:x?.name||'Informe',
    createdAt:x?.createdAt||'',
    updatedAt:x?.updatedAt||x?.createdAt||'',
    config:{
      unit:['r','ticks','usd'].includes(x?.config?.unit)?x.config.unit:'r',
      basis:x?.config?.basis==='gross'?'gross':'net',
      scope:x?.config?.scope||'full',
      dateFrom:x?.config?.dateFrom||'',
      dateTo:x?.config?.dateTo||'',
      block:String(x?.config?.block||'1'),
      studyId:x?.config?.studyId||'',
      title:x?.config?.title||'',
      sections:{summary:true,confidence:true,process:true,quality:true,breakdowns:true,reviewsGoals:true,...(x?.config?.sections||{})}
    }
  }));
}

function trReportSavedStudies(p){return Array.isArray(p?.savedStudies)?p.savedStudies:[];}
function trReportReviews(p){return Array.isArray(p?.reviewNotes)?p.reviewNotes:[];}
function trReportGoals(p){return Array.isArray(p?.goals)?p.goals:[];}

if(typeof window.v313ReportScopeLabel==='function'){
  window.v313ReportScopeLabel=function(p=getCurrentPlan()){
    const s=reportsViewState.scope;
    if(s==='last20')return 'Últimas 20 operaciones';
    if(s==='last50')return 'Últimas 50 operaciones';
    if(s==='last100')return 'Últimas 100 operaciones';
    if(s==='month')return 'Mes actual';
    if(s==='block')return `Bloque ${String(Number(reportsViewState.block)||1).padStart(2,'0')}`;
    if(s==='study'){
      const st=trReportSavedStudies(p).find(x=>x.id===reportsViewState.studyId);
      return st?`Estudio · ${st.name}`:'Estudio guardado';
    }
    if(s==='date')return `${reportsViewState.dateFrom||'inicio'} → ${reportsViewState.dateTo||'fin'}`;
    return 'Trading Plan completo';
  };
  try{v313ReportScopeLabel=window.v313ReportScopeLabel;}catch(_){/* global binding already resolves through window */}
}

if(typeof window.v313ScopeControls==='function'){
  window.v313ScopeControls=function(p){
    const blocks=Math.max(1,Math.ceil(currentOps().length/20));
    let extra='';
    if(reportsViewState.scope==='block')extra=`<label class="filter-field"><span>Bloque</span><select class="select" data-tr-onchange="v313SetReportField('block',this.value)">${Array.from({length:blocks},(_,i)=>String(i+1)).map(v=>`<option value="${v}" ${String(reportsViewState.block)===v?'selected':''}>B${String(v).padStart(2,'0')}</option>`).join('')}</select></label>`;
    if(reportsViewState.scope==='date')extra=`<label class="filter-field"><span>Desde</span><input class="input" type="date" value="${esc(reportsViewState.dateFrom)}" data-tr-onchange="v313SetReportField('dateFrom',this.value)"></label><label class="filter-field"><span>Hasta</span><input class="input" type="date" value="${esc(reportsViewState.dateTo)}" data-tr-onchange="v313SetReportField('dateTo',this.value)"></label>`;
    if(reportsViewState.scope==='study')extra=`<label class="filter-field wide"><span>Estudio guardado</span><select class="select" data-tr-onchange="v313SetReportField('studyId',this.value)"><option value="">Seleccionar…</option>${trReportSavedStudies(p).map(s=>`<option value="${esc(s.id)}" ${s.id===reportsViewState.studyId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`;
    return `<div class="report-scope-grid"><label class="filter-field"><span>Alcance</span><select class="select" data-tr-onchange="v313SetScope(this.value)">${[['full','Plan completo'],['last20','Últimas 20'],['last50','Últimas 50'],['last100','Últimas 100'],['month','Mes actual'],['block','Bloque'],['study','Estudio guardado'],['date','Rango de fechas']].map(([v,l])=>`<option value="${v}" ${reportsViewState.scope===v?'selected':''}>${l}</option>`).join('')}</select></label>${extra}</div>`;
  };
  try{v313ScopeControls=window.v313ScopeControls;}catch(_){/* classic script global */}
}

if(typeof window.v313ReportReviewsGoals==='function'){
  window.v313ReportReviewsGoals=function(plan){
    const rev=trReportReviews(plan),open=rev.filter(x=>x.status==='open'||x.status==='monitoring'),valid=rev.filter(x=>x.status==='validated'),goals=trReportGoals(plan).filter(g=>g.active),evaluated=goals.map(g=>({g,e:goalEval(g)})),met=evaluated.filter(x=>x.e.met);
    return `<section class="card panel report-section"><div class="panel-title"><div><h3>Reviews & objetivos</h3><small>Decisiones documentadas y scorecard vigente del Trading Plan.</small></div></div><div class="report-grid-3"><div><span>Reviews abiertas</span><strong>${open.length}</strong><small>abiertas / seguimiento</small></div><div><span>Reviews validadas</span><strong>${valid.length}</strong><small>conclusiones consolidadas</small></div><div><span>Objetivos activos</span><strong>${goals.length}</strong><small>${met.length} cumplidos</small></div></div>${open.length?`<div class="report-note-list">${open.slice(0,5).map(x=>`<div><strong>${esc(x.title)}</strong><span>${esc(x.status)} · ${esc(x.decision||x.finding||'Sin decisión registrada')}</span></div>`).join('')}</div>`:''}</section>`;
  };
  try{v313ReportReviewsGoals=window.v313ReportReviewsGoals;}catch(_){/* classic script global */}
}

if(typeof window.v313ReportDocument==='function'){
  window.v313ReportDocument=function(){
    const p=getCurrentPlan();
    const ops=v313ReportOps(),s=calcMetricStats(ops,reportsViewState.unit,reportsViewState.basis),sec=reportsViewState.sections,title=reportsViewState.title.trim()||`Informe · ${planLabel(p)}`;
    return `<article class="report-document"><header class="report-doc-head"><div><small>Trading Research · informe dinámico</small><h2>${esc(title)}</h2><p>${esc(planLabel(p))} · ${esc(v313ReportScopeLabel(p))} · ${esc(v313DateRangeText(ops))}</p></div><div><strong>${metricUnitLabel(reportsViewState.unit)}</strong><span>${reportsViewState.basis==='net'?'Neto':'Bruto'}</span></div></header>${!ops.length?'<div class="card empty">El alcance seleccionado no contiene operaciones.</div>':''}${sec.summary?v313ReportSummary(p,ops,s):''}${sec.confidence?v313ReportConfidence(ops,s):''}${sec.process?v313ReportProcess(p,ops):''}${sec.quality?v313ReportQuality(p,ops):''}${sec.breakdowns?v313ReportBreakdowns(ops):''}${sec.reviewsGoals?v313ReportReviewsGoals(p):''}<div class="notice report-method"><strong>Lectura:</strong> este informe recalcula métricas sobre el dataset actual. Expectancy, diferencias entre grupos y asociaciones con errores describen la muestra; no demuestran causalidad ni garantizan rendimiento futuro.</div></article>`;
  };
  try{v313ReportDocument=window.v313ReportDocument;}catch(_){/* classic script global */}
}

if(typeof window.v313BuilderView==='function'){
  window.v313BuilderView=function(){
    const p=getCurrentPlan(),presets=trReportNormalizedPresets(p);
    const toolbar=`<div class="report-builder-toolbar"><label class="filter-field wide"><span>Título del informe</span><input class="input" value="${esc(reportsViewState.title)}" placeholder="Informe · ${esc(planLabel(p))}" data-tr-onchange="v313SetReportField('title',this.value)"></label>${v313ScopeControls(p)}<div class="metric-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${reportsViewState.unit===v?'active':''}" data-tr-onclick="v313SetUnit('${v}')">${l}</button>`).join('')}<i></i><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([v,l])=>`<button class="seg-btn ${reportsViewState.basis===v?'active':''}" data-tr-onclick="v313SetBasis('${v}')">${l}</button>`).join('')}</div>${v313SectionsControls()}<div class="report-actions"><button class="btn" data-tr-onclick="v313SavePresetPrompt()">Guardar plantilla</button><button class="btn" data-tr-onclick="v313PrintReport()">Imprimir / PDF</button></div></div>`;
    const presetPanel=`<section class="card panel report-presets"><div class="panel-title"><div><h3>Plantillas guardadas</h3><small>Guardan la definición del informe, no congelan las operaciones.</small></div><span>${presets.length}</span></div>${presets.length?`<div class="report-preset-list">${presets.map(x=>`<div class="config-row"><div class="config-main"><strong>${esc(x.name)}</strong><small>${esc(x.config?.scope||'full')} · ${String(x.config?.unit||'r').toUpperCase()} · ${x.config?.basis==='gross'?'Bruto':'Neto'}</small></div><div><button class="btn small" data-tr-onclick="v313LoadPreset('${x.id}')">Cargar</button> <button class="btn small danger" data-tr-onclick="v313DeletePreset('${x.id}')">Eliminar</button></div></div>`).join('')}</div>`:'<div class="empty compact-empty">Todavía no hay plantillas guardadas.</div>'}</section>`;
    return `${toolbar}${presetPanel}${v313ReportDocument()}`;
  };
  try{v313BuilderView=window.v313BuilderView;}catch(_){/* classic script global */}
}

window.TradingResearchReportsPurity=Object.freeze({version:TR_REPORTS_PURITY_VERSION,normalizePresets:trReportNormalizedPresets});
})();
/* ===== END V31.21.1 REPORTS PURITY RUNTIME ===== */
