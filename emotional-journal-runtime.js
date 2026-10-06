/* ===== V31.29 RUNTIME · Emotional Journal Sessions Foundation ===== */
(()=>{
'use strict';

if(globalThis.__trEmotionalJournalRuntimeInstalled)return;
globalThis.__trEmotionalJournalRuntimeInstalled=true;
globalThis.__trEmotionalJournalStage='runtime-entered';

const TR_EMOTIONAL_JOURNAL_VERSION='31.29.0';
const TR_SESSION_MODES=Object.freeze(['replay','sim','live']);
const TR_SESSION_MODE_LABELS=Object.freeze({replay:'Market Replay',sim:'SIM',live:'Live'});
const TR_CONFIDENCE_LEVELS=Object.freeze(['very_low','low','normal','high','very_high']);
const TR_TRI_LEVELS=Object.freeze(['low','medium','high']);
const TR_CONFIDENCE_LABELS=Object.freeze({very_low:'Muy baja',low:'Baja',normal:'Normal',high:'Alta',very_high:'Muy alta'});
const TR_TRI_LABELS=Object.freeze({low:'Bajo',medium:'Medio',high:'Alto'});
const TR_DEFAULT_SESSION_SCALES=Object.freeze({confidence:TR_CONFIDENCE_LABELS,tri:TR_TRI_LABELS});

const trCopy=value=>JSON.parse(JSON.stringify(value??null));
const trText=value=>String(value??'').trim();
const trNow=()=>new Date().toISOString();
const trId=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;

function trNormalizePoint(value={}){
  const out={
    confidencePersonal:TR_CONFIDENCE_LEVELS.includes(value?.confidencePersonal)?value.confidencePersonal:'',
    confidenceSystem:TR_CONFIDENCE_LEVELS.includes(value?.confidenceSystem)?value.confidenceSystem:'',
    stress:TR_TRI_LEVELS.includes(value?.stress)?value.stress:'',
    focus:TR_TRI_LEVELS.includes(value?.focus)?value.focus:'',
    fatigue:TR_TRI_LEVELS.includes(value?.fatigue)?value.fatigue:'',
    emotionalWear:TR_TRI_LEVELS.includes(value?.emotionalWear)?value.emotionalWear:'',
    emotion:trText(value?.emotion),
    note:trText(value?.note)
  };
  return out;
}
function trOperationLayer(operation){
  const semantics=globalThis.TradingResearchOperationSemanticsContract;
  if(semantics?.layer)return semantics.layer(operation);
  if(operation?.raw?.source==='ankora'||operation?.recordClass==='backtest')return 'backtest';
  return trText(operation?.executionEnvironment||operation?.executionIntent||operation?.executionEvidence?.environment||'').toLowerCase()||'unclassified';
}
function trOperationEligible(operation){return trOperationLayer(operation)!=='backtest';}
function trEligibleOperations(operations){return (Array.isArray(operations)?operations:[]).filter(trOperationEligible);}
function trSessionModeForOperation(operation){
  const plan=typeof getPlan==='function'?getPlan(operation?.tradingPlanId):null;
  const planMode=globalThis.TradingResearchOperationSemanticsContract?.planEnvironment?.(plan)||'';
  if(TR_SESSION_MODES.includes(planMode))return planMode;
  const layer=trOperationLayer(operation);
  return TR_SESSION_MODES.includes(layer)?layer:'';
}
function trNormalizeSession(value={},plan=null){
  const startedAt=trText(value?.startedAt)||trNow();
  return {
    id:trText(value?.id)||trId('ES'),
    schemaVersion:1,
    tradingPlanId:trText(value?.tradingPlanId)||trText(plan?.id),
    tradingPlanSnapshot:value?.tradingPlanSnapshot?trCopy(value.tradingPlanSnapshot):null,
    mode:TR_SESSION_MODES.includes(value?.mode)?value.mode:'live',
    startedAt,
    endedAt:trText(value?.endedAt),
    start:trNormalizePoint(value?.start),
    end:trNormalizePoint(value?.end),
    createdAt:trText(value?.createdAt)||startedAt,
    updatedAt:trText(value?.updatedAt)||startedAt
  };
}
function trSessionScales(plan){
  const cfg=plan?.emotionConfig?.sessionScales||{};
  return {confidence:{...TR_CONFIDENCE_LABELS,...(cfg.confidence||{})},tri:{...TR_TRI_LABELS,...(cfg.tri||{})}};
}
function trEnsurePlan(plan){
  if(!plan||typeof plan!=='object')return plan;
  plan.emotionConfig=plan.emotionConfig&&typeof plan.emotionConfig==='object'?plan.emotionConfig:{};
  const scales=trSessionScales(plan);
  plan.emotionConfig.sessionScales={confidence:{...scales.confidence},tri:{...scales.tri}};
  const rows=Array.isArray(plan.emotionalSessions)?plan.emotionalSessions:[];
  plan.emotionalSessions=rows.map(row=>trNormalizeSession(row,plan));
  return plan;
}
function trCoverage(operations,hasEntry){
  const eligible=trEligibleOperations(operations);
  const complete=eligible.filter(o=>!!hasEntry(o));
  return {eligible,complete,total:eligible.length,done:complete.length,pct:eligible.length?complete.length/eligible.length*100:0};
}

const domain=Object.freeze({
  version:TR_EMOTIONAL_JOURNAL_VERSION,
  sessionModes:TR_SESSION_MODES,
  confidenceLevels:TR_CONFIDENCE_LEVELS,
  triLevels:TR_TRI_LEVELS,
  confidenceLabels:TR_CONFIDENCE_LABELS,
  triLabels:TR_TRI_LABELS,
  operationLayer:trOperationLayer,
  operationEligible:trOperationEligible,
  eligibleOperations:trEligibleOperations,
  sessionModeForOperation:trSessionModeForOperation,
  normalizePoint:trNormalizePoint,
  normalizeSession:trNormalizeSession,
  ensurePlan:trEnsurePlan,
  coverage:trCoverage
});
if(!globalThis.TradingResearchEmotionalJournalDomain){
  Object.defineProperty(globalThis,'TradingResearchEmotionalJournalDomain',{value:domain,writable:false,enumerable:false,configurable:false});
}
globalThis.__trEmotionalJournalStage='domain-published';

/* Publish the V31.29 presentation contract before any state/bootstrap compatibility work.
 * Function declarations are hoisted, so trJournalRender is safe to resolve lazily here. */
if(!globalThis.TradingResearchEmotionalJournalPresentationContract){
  Object.defineProperty(globalThis,'TradingResearchEmotionalJournalPresentationContract',{value:Object.freeze({render:()=>trJournalSessionsRender(),renderOperations:()=>trJournalOperationsRender()}),writable:false,enumerable:false,configurable:false});
}
globalThis.__trEmotionalJournalStage='presentation-published';

if(typeof state==='undefined'||typeof document==='undefined')return;

/* Register actions only after the presentation contract is guaranteed to exist. */
const trEarlyActions=window.TradingResearchActions||(window.TradingResearchActions=Object.create(null));
trEarlyActions.emotionalSessionOpenStart=function(){trSessionEditor(null,'start');};
trEarlyActions.emotionalSessionEditStart=function(){const s=trSessionById(this.dataset.sessionId);if(s)trSessionEditor(s,'start');};
trEarlyActions.emotionalSessionClose=function(){const s=trSessionById(this.dataset.sessionId);if(s)trSessionEditor(s,'end');};
trEarlyActions.emotionalSessionEditEnd=function(){const s=trSessionById(this.dataset.sessionId);if(s)trSessionEditor(s,'end');};
trEarlyActions.emotionalSessionSaveStart=function(){return trSaveSessionStart(String(this.dataset.sessionId||''));};
trEarlyActions.emotionalSessionSaveEnd=function(){return trSaveSessionEnd(String(this.dataset.sessionId||''));};
trEarlyActions.emotionalSessionDelete=function(){return trDeleteSession(String(this.dataset.sessionId||''));};
trEarlyActions.emotionalOpenOperation=function(){return openEmotionalEditor(String(this.dataset.operationId||''));};

window.TradingResearchEmotionalJournal=Object.freeze({
  version:TR_EMOTIONAL_JOURNAL_VERSION,
  ensurePlan:trEnsurePlan,
  eligible:trOperationEligible,
  sessions:planId=>trSessions(getPlan(planId||state.currentPlanId)),
  diagnostics:()=>({version:TR_EMOTIONAL_JOURNAL_VERSION,planId:state.currentPlanId,sessions:trSessions().length,eligibleOperations:trEligibleOperations(currentOps()).length,excludedBacktests:currentOps().filter(o=>trOperationLayer(o)==='backtest').length})
});

function trPlanSnapshot(plan){
  if(typeof planSnapshot==='function')return planSnapshot(plan);
  return plan?{id:plan.id,name:plan.name,version:plan.version}:null;
}
function trEnsureAll(){
  for(const plan of state.tradingPlans||[])trEnsurePlan(plan);
}
trEnsureAll();
try{addEventListener('tradingresearch:core-hydrated',()=>trEnsureAll());}catch{}

if(typeof makeBlankPlan==='function'){
  const baseMakeBlankPlan=makeBlankPlan;
  makeBlankPlan=function(meta={}){const plan=baseMakeBlankPlan(meta);plan.emotionalSessions=[];return trEnsurePlan(plan);};
}
if(typeof normalizePlan==='function'){
  const baseNormalizePlan=normalizePlan;
  normalizePlan=function(plan,instruments){return trEnsurePlan(baseNormalizePlan(plan,instruments));};
}
if(typeof clonePlanForVersion==='function'){
  const baseClonePlanForVersion=clonePlanForVersion;
  clonePlanForVersion=function(source,meta={}){const plan=baseClonePlanForVersion(source,meta);plan.emotionalSessions=[];return trEnsurePlan(plan);};
}

function trSessions(plan=getCurrentPlan()){
  trEnsurePlan(plan);
  return plan?.emotionalSessions||[];
}
function trSessionById(id,plan=getCurrentPlan()){return trSessions(plan).find(s=>s.id===id)||null;}
function trSessionOperationCount(id){return (state.operations||[]).filter(o=>o.journalSessionId===id).length;}
function trOpenSessions(planId){
  const plan=getPlan(planId);
  return trSessions(plan).filter(s=>!s.endedAt);
}
function trMatchingOpenSession(operation){
  if(!trOperationEligible(operation))return null;
  const mode=trSessionModeForOperation(operation);
  if(!mode)return null;
  return trOpenSessions(operation.tradingPlanId).find(s=>s.mode===mode)||null;
}
function trPersistRender(){
  persist();
  render();
}
function trSessionDateInput(iso){
  if(!iso)return '';
  const d=new Date(iso);if(isNaN(d))return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function trInputIso(value,fallback=''){
  const text=trText(value);if(!text)return fallback;
  const d=new Date(text);return isNaN(d)?fallback:d.toISOString();
}
function trSelect(id,label,options,current=''){
  return `<label class="field"><span>${esc(label)}</span><select id="${esc(id)}" class="select"><option value="">Sin informar</option>${options.map(x=>`<option value="${esc(x.value)}" ${x.value===current?'selected':''}>${esc(x.label)}</option>`).join('')}</select></label>`;
}
function trPointFields(prefix,point,plan){
  const scales=trSessionScales(plan);
  const conf=TR_CONFIDENCE_LEVELS.map(value=>({value,label:scales.confidence[value]||TR_CONFIDENCE_LABELS[value]}));
  const tri=TR_TRI_LEVELS.map(value=>({value,label:scales.tri[value]||TR_TRI_LABELS[value]}));
  const emotions=(plan?.emotionConfig?.emotions||[]).map(value=>({value,label:value}));
  return `${trSelect(prefix+'-confidence-personal','Confianza personal',conf,point.confidencePersonal)}
    ${trSelect(prefix+'-confidence-system','Confianza en el sistema',conf,point.confidenceSystem)}
    ${trSelect(prefix+'-stress','Estrés',tri,point.stress)}
    ${trSelect(prefix+'-focus','Foco',tri,point.focus)}
    ${trSelect(prefix+'-fatigue','Fatiga',tri,point.fatigue)}
    ${trSelect(prefix+'-wear','Desgaste emocional',tri,point.emotionalWear)}
    ${trSelect(prefix+'-emotion','Emoción predominante',emotions,point.emotion)}
    <label class="field span2"><span>Nota</span><textarea id="${esc(prefix+'-note')}" class="input">${esc(point.note||'')}</textarea></label>`;
}
function trReadPoint(prefix){
  const val=id=>document.getElementById(prefix+'-'+id)?.value||'';
  return trNormalizePoint({
    confidencePersonal:val('confidence-personal'),
    confidenceSystem:val('confidence-system'),
    stress:val('stress'),
    focus:val('focus'),
    fatigue:val('fatigue'),
    emotionalWear:val('wear'),
    emotion:val('emotion'),
    note:document.getElementById(prefix+'-note')?.value||''
  });
}
function trSessionEditor(session=null,phase='start'){
  const plan=getCurrentPlan();if(!plan)return;
  trEnsurePlan(plan);
  const mode=globalThis.TradingResearchOperationSemanticsContract?.planEnvironment?.(plan)||'unclassified';
  if(mode==='backtest')return alert('Backtesting queda fuera del Diario Emocional.');
  if(!TR_SESSION_MODES.includes(mode))return alert('Define primero este Trading Plan como Market Replay, SIM o Live.');
  const editing=!!session;
  const point=phase==='end'?trNormalizePoint(session?.end):trNormalizePoint(session?.start);
  const timeValue=phase==='end'?trSessionDateInput(session?.endedAt||trNow()):trSessionDateInput(session?.startedAt||trNow());
  const modeField=`<div class="field"><span>Entorno</span><div class="readonly-box">${esc(TR_SESSION_MODE_LABELS[mode]||mode)}</div></div>`;
  const body=`<form id="emotional-session-form" data-tr-onsubmit="return false"><div class="form-section"><h4>${phase==='end'?'Cierre de sesión':'Inicio de sesión'}</h4><div class="form-grid">
    ${modeField}
    <label class="field"><span>Fecha / hora</span><input id="em-session-time" class="input" type="datetime-local" value="${esc(timeValue)}"></label>
    ${trPointFields('em-session-point',point,plan)}
  </div><div class="notice">El entorno viene fijado por el Trading Plan. Los campos emocionales son opcionales; <strong>Sin informar</strong> nunca se interpreta como una respuesta negativa.</div></div></form>`;
  const title=phase==='end'?'Cerrar sesión emocional':editing?'Editar inicio de sesión':'Iniciar sesión emocional';
  const action=phase==='end'?'emotionalSessionSaveEnd':'emotionalSessionSaveStart';
  const id=session?.id||'';
  document.body.insertAdjacentHTML('beforeend',modalShell(title,body,`<button class="btn" data-tr-action-click="closeModal">Cancelar</button><button class="btn primary" data-session-id="${esc(id)}" data-tr-action-click="${action}">Guardar</button>`));
}
function trSaveSessionStart(id=''){
  const plan=getCurrentPlan();if(!plan)return false;
  const mode=globalThis.TradingResearchOperationSemanticsContract?.planEnvironment?.(plan)||'unclassified';
  if(mode==='backtest')return alert('Backtesting queda fuera del Diario Emocional.');
  if(!TR_SESSION_MODES.includes(mode))return alert('Define primero este Trading Plan como Market Replay, SIM o Live.');
  trEnsurePlan(plan);
  const existing=id?trSessionById(id,plan):null;
  if(!existing&&trSessions(plan).some(s=>!s.endedAt&&s.mode===mode))return alert('Ya hay una sesión abierta para este Trading Plan. Ciérrala antes de iniciar otra.');
  const startedAt=trInputIso(document.getElementById('em-session-time')?.value,trNow());
  const now=trNow();
  if(existing){
    existing.mode=mode;existing.startedAt=startedAt;existing.start=trReadPoint('em-session-point');existing.updatedAt=now;
  }else{
    plan.emotionalSessions.unshift(trNormalizeSession({
      id:trId('ES'),tradingPlanId:plan.id,tradingPlanSnapshot:trPlanSnapshot(plan),mode,startedAt,
      start:trReadPoint('em-session-point'),end:{},createdAt:now,updatedAt:now
    },plan));
  }
  plan.updatedAt=now;persist();closeModal();render();return true;
}
function trSaveSessionEnd(id){
  const plan=getCurrentPlan(),session=trSessionById(id,plan);if(!session)return false;
  session.endedAt=trInputIso(document.getElementById('em-session-time')?.value,trNow());
  session.end=trReadPoint('em-session-point');session.updatedAt=trNow();plan.updatedAt=session.updatedAt;
  persist();closeModal();render();return true;
}
function trDeleteSession(id){
  const plan=getCurrentPlan(),session=trSessionById(id,plan);if(!session)return false;
  const count=trSessionOperationCount(id);
  if(!confirm(`¿Eliminar esta sesión emocional?${count?'\\n\\nSe desvincularán '+count+' operación(es), pero sus diarios individuales se conservarán.':''}`))return false;
  for(const operation of state.operations||[])if(operation.journalSessionId===id)operation.journalSessionId='';
  plan.emotionalSessions=trSessions(plan).filter(s=>s.id!==id);plan.updatedAt=trNow();trPersistRender();return true;
}
function trSessionPointSummary(point,plan){
  const scales=trSessionScales(plan),bits=[];
  if(point?.confidencePersonal)bits.push('Personal '+(scales.confidence[point.confidencePersonal]||TR_CONFIDENCE_LABELS[point.confidencePersonal]));
  if(point?.confidenceSystem)bits.push('Sistema '+(scales.confidence[point.confidenceSystem]||TR_CONFIDENCE_LABELS[point.confidenceSystem]));
  if(point?.stress)bits.push('Estrés '+(scales.tri[point.stress]||TR_TRI_LABELS[point.stress]));
  if(point?.emotionalWear)bits.push('Desgaste '+(scales.tri[point.emotionalWear]||TR_TRI_LABELS[point.emotionalWear]));
  return bits.join(' · ')||'Sin valoración';
}
function trSessionsPanel(plan){
  const sessions=[...trSessions(plan)].sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));
  const open=sessions.filter(s=>!s.endedAt);
  const rows=sessions.slice(0,12);
  return `<section class="card panel"><div class="panel-title"><div><h3>Sesiones emocionales</h3><small>Una sesión puede existir aunque no haya ninguna operación.</small></div><span>${open.length} abierta(s) · ${sessions.length} total</span></div>
    ${rows.length?rows.map(s=>`<article class="compliance-rule-card"><div class="compliance-rule-main"><div class="compliance-rule-tags"><span class="badge">${esc(TR_SESSION_MODE_LABELS[s.mode]||s.mode)}</span><span class="badge ${s.endedAt?'':'win'}">${s.endedAt?'Cerrada':'Abierta'}</span><span class="badge">${trSessionOperationCount(s.id)} trade(s)</span></div><strong>${esc(fmtDate(s.startedAt))}${s.endedAt?' → '+esc(fmtDate(s.endedAt)):''}</strong><p><b>Inicio:</b> ${esc(trSessionPointSummary(s.start,plan))}${s.endedAt?'<br><b>Cierre:</b> '+esc(trSessionPointSummary(s.end,plan)):''}</p></div><div class="compliance-rule-actions"><button class="btn small" data-session-id="${esc(s.id)}" data-tr-action-click="emotionalSessionEditStart">Editar inicio</button>${s.endedAt?'<button class="btn small" data-session-id="'+esc(s.id)+'" data-tr-action-click="emotionalSessionEditEnd">Editar cierre</button>':'<button class="btn small primary" data-session-id="'+esc(s.id)+'" data-tr-action-click="emotionalSessionClose">Cerrar sesión</button>'}<button class="btn small danger" data-session-id="${esc(s.id)}" data-tr-action-click="emotionalSessionDelete">Eliminar</button></div></article>`).join(''):'<div class="empty">Todavía no hay sesiones emocionales.</div>'}
  </section>`;
}

journalFilteredOps=function(){
  const q=String(journalViewState.q||'').toLowerCase();
  return trEligibleOperations(currentOps()).filter(o=>{
    if(q&&!JSON.stringify(o).toLowerCase().includes(q))return false;
    if(journalViewState.emotion&&!operationEmotionValues(o).includes(journalViewState.emotion))return false;
    if(journalViewState.behavior&&!(o.emotional?.behaviors||[]).includes(journalViewState.behavior))return false;
    if(journalViewState.discipline==='yes'&&!o.discipline)return false;
    if(journalViewState.discipline==='no'&&o.discipline)return false;
    if(journalViewState.status==='complete'&&!hasEmotionalEntry(o))return false;
    if(journalViewState.status==='pending'&&hasEmotionalEntry(o))return false;
    return true;
  }).sort((a,b)=>v3194CompareOps(b,a));
};
journalStats=function(ops){
  const complete=ops.filter(hasEmotionalEntry);
  const avg=key=>{
    const values=complete.map(o=>Number(o.emotional?.[key])).filter(v=>Number.isFinite(v)&&v>=1);
    return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  };
  const discipline=ops.filter(o=>typeof o.discipline==='boolean');
  return {complete:complete.length,completion:ops.length?complete.length/ops.length*100:0,discipline:discipline.length?discipline.filter(o=>o.discipline).length/discipline.length*100:0,stress:avg('stress'),focus:avg('focus'),intensity:avg('intensity'),confidence:avg('confidence')};
};
function trLegacyMetric(value){return value===null?'—':value.toFixed(1)+'/5';}
function trSessionLabelForOperation(operation){
  const id=operation?.journalSessionId;if(!id)return '—';
  const session=trSessionById(id,getPlan(operation.tradingPlanId));
  return session?`${TR_SESSION_MODE_LABELS[session.mode]||session.mode} · ${fmtDate(session.startedAt)}`:'Sesión histórica';
}
function trOperationTable(ops){
  if(!ops.length)return '<div class="empty">No hay operaciones con estos filtros.</div>';
  return `<div class="table-wrap"><table class="table journal-table"><thead><tr><th>Fecha</th><th>Contrato</th><th>Dir.</th><th>Setup</th><th>Resultado</th><th>Disciplina</th><th>Antes</th><th>Durante</th><th>Final</th><th>Comportamientos</th><th>Diario</th></tr></thead><tbody>${ops.map(o=>{const e=o.emotional||{};return `<tr><td>${fmtDate(o.entryDate)}</td><td>${esc(o.contract||'—')}</td><td>${esc(o.direction||'—')}</td><td>${esc(o.setup||'—')}</td><td class="${Number(o.pnlNet)>=0?'positive':'negative'}">${o.riskUsd?((Number(o.pnlNet)||0)/Number(o.riskUsd)).toFixed(2)+'R':'—'}</td><td><span class="badge ${o.discipline?'win':'loss'}">${typeof o.discipline==='boolean'?(o.discipline?'Sí':'No'):'—'}</span></td><td>${esc(e.before||'—')}</td><td>${esc(e.during||'—')}</td><td>${esc(e.after||'—')}</td><td>${(e.behaviors||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join(' ')||'—'}</td><td><button class="btn small ${hasEmotionalEntry(o)?'':'primary'}" data-operation-id="${esc(o.id)}" data-tr-action-click="emotionalOpenOperation">${hasEmotionalEntry(o)?'Editar':'Completar'}</button></td></tr>`}).join('')}</tbody></table></div>`;
}
function trJournalPlanEnvironment(plan){
  return globalThis.TradingResearchOperationSemanticsContract?.planEnvironment?.(plan)||'unclassified';
}
function trJournalSessionsRender(){
  const plan=getCurrentPlan();if(!plan)return '';
  trEnsurePlan(plan);
  const env=trJournalPlanEnvironment(plan);
  if(env==='backtest')return '';
  const sessions=trSessions(plan),open=sessions.filter(x=>!x.endedAt),linked=sessions.reduce((n,x)=>n+trSessionOperationCount(x.id),0);
  const action=TR_SESSION_MODES.includes(env)?'<button class="btn primary" data-tr-action-click="emotionalSessionOpenStart">+ Iniciar sesión</button>':'<button class="btn primary" disabled title="Define el entorno del Trading Plan">+ Iniciar sesión</button>';
  return `${pageHead('Diario emocional · Sesiones','Estado emocional de la jornada o sesión. El entorno se hereda del Trading Plan.',action)}
    ${activePlanBanner()}
    <div class="notice"><strong>Entorno del TP:</strong> ${esc(globalThis.TradingResearchOperationSemanticsContract?.planEnvironmentLabel?.(plan)||env)}. No se selecciona de nuevo al iniciar una sesión.</div>
    <div class="journal-kpis">${kpi('Sesiones',sessions.length,'total')}${kpi('Abiertas',open.length,'pendientes de cierre')}${kpi('Operaciones vinculadas',linked,'a sesiones emocionales')}</div>
    ${trSessionsPanel(plan)}`;
}
function trJournalOperationsRender(){
  const plan=getCurrentPlan();if(!plan)return '';
  const env=trJournalPlanEnvironment(plan);
  if(env==='backtest')return '';
  const ops=trEligibleOperations(journalFilteredOps()),st=journalStats(ops),em=plan?.emotionConfig?.emotions||[],bh=plan?.emotionConfig?.behaviors||[];
  const sel=(id,label,arr,val)=>`<label class="filter-field"><span>${label}</span><select id="${id}" class="select" data-tr-onchange="readJournalFilters()"><option value="">Todos</option>${arr.map(x=>`<option value="${esc(typeof x==='object'?x.value:x)}" ${String(val)===String(typeof x==='object'?x.value:x)?'selected':''}>${esc(typeof x==='object'?x.label:x)}</option>`).join('')}</select></label>`;
  return `${pageHead('Diario emocional · Registro por operación','Registro emocional de cada trade, separado de las sesiones.', '')}
    ${activePlanBanner()}
    <section class="card filter-hub"><div class="filter-hub-top"><div><h3>Filtro emocional</h3><p>El registro conserva el contexto técnico de cada operación.</p></div><button class="btn small" data-tr-onclick="trLegacyStateCommand('journal-reset')">Limpiar</button></div><div class="filter-grid"><label class="filter-field wide"><span>Buscar</span><input id="journalQ" class="input" value="${esc(journalViewState.q)}" placeholder="Setup, contrato, notas…" data-tr-onchange="readJournalFilters()"></label>${sel('journalEmotion','Emoción',em,journalViewState.emotion)}${sel('journalBehavior','Comportamiento',bh,journalViewState.behavior)}${sel('journalDiscipline','Disciplina',[{value:'yes',label:'Disciplinada'},{value:'no',label:'No disciplinada'}],journalViewState.discipline)}${sel('journalStatus','Estado del diario',[{value:'complete',label:'Completado'},{value:'pending',label:'Pendiente'}],journalViewState.status)}</div></section>
    <div class="journal-kpis">${kpi('Trades visibles',ops.length,'con contexto técnico')}${kpi('Diario completado',pct(st.completion),`${st.complete}/${ops.length}`)}${kpi('Disciplina',pct(st.discipline),'sobre selección')}${kpi('Estrés medio',trLegacyMetric(st.stress),'trades registrados')}${kpi('Foco medio',trLegacyMetric(st.focus),'trades registrados')}${kpi('Intensidad',trLegacyMetric(st.intensity),'carga emocional')}</div>
    <div class="grid two journal-charts"><section class="card panel"><div class="panel-title"><h3>Resultados por emoción</h3><span>Expectancy R neta</span></div>${emotionalBreakdown(ops,'emotion')}</section><section class="card panel"><div class="panel-title"><h3>Resultados por comportamiento</h3><span>Expectancy R neta</span></div>${emotionalBreakdown(ops,'behavior')}</section></div>
    <section class="card panel"><div class="panel-title"><div><h3>Operaciones + diario</h3><small>Antes · Durante · Final. Backtesting no participa en este diario.</small></div><span>${ops.length} visibles</span></div>${trOperationTable(ops)}</section>`;
}
if(typeof dqCoverageDefs==='function'){
  const baseDqCoverageDefs=dqCoverageDefs;
  dqCoverageDefs=function(ops){
    const rows=baseDqCoverageDefs(ops);
    const eligible=trEligibleOperations(ops),done=eligible.filter(hasEmotionalEntry);
    return rows.map(row=>row.id==='journal'?{...row,ok:done.length,total:eligible.length,pct:eligible.length?done.length/eligible.length*100:100,missingIds:eligible.filter(o=>!hasEmotionalEntry(o)).map(o=>o.id),note:'Solo Replay, SIM, Live y ejecución no clasificada; Backtesting queda excluido.'}:row);
  };
}
if(typeof dqV28Coverage==='function'){
  const baseDqV28Coverage=dqV28Coverage;
  dqV28Coverage=function(ops,key){
    if(!['journal','focus','stress','behavior','emotion'].includes(key))return baseDqV28Coverage(ops,key);
    const eligible=trEligibleOperations(ops),total=eligible.length;let ok=0,label=key,focus='journal';
    if(key==='journal'){ok=eligible.filter(hasEmotionalEntry).length;label='Diario';}
    else if(key==='focus'){ok=eligible.filter(o=>Number(o?.emotional?.focus)>=1&&Number(o?.emotional?.focus)<=5).length;label='Foco';}
    else if(key==='stress'){ok=eligible.filter(o=>Number(o?.emotional?.stress)>=1&&Number(o?.emotional?.stress)<=5).length;label='Estrés';}
    else if(key==='behavior'){ok=eligible.filter(hasEmotionalEntry).length;label='Conducta';}
    else {ok=eligible.filter(hasEmotionalEntry).length;label='Emoción';}
    return {key,label,ok,total,pct:total?ok/total*100:100,focus};
  };
}
if(typeof goalEval==='function'){
  const baseGoalEval=goalEval;
  goalEval=function(goal){
    if(goal?.metric!=='journal')return baseGoalEval(goal);
    const ops=trEligibleOperations(goalOps(goal)),stats=calcMetricStats(ops,goal.unit,goal.basis),target=Number(goal.target)||0,done=ops.filter(hasEmotionalEntry).length;
    const hasData=!!ops.length,value=ops.length?done/ops.length*100:0,display=hasData?`${value.toFixed(1)}%`:'—',targetDisplay=`${target.toFixed(1)}%`,direction=goalMetricDef(goal.metric)[2],met=hasData&&(direction==='max'?value<=target:value>=target);
    let progress=0;if(hasData)progress=target<=0?(value>=target?100:0):Math.max(0,Math.min(100,value/target*100));
    return {ops,value,target,display,targetDisplay,met,hasData,progress,direction,stats};
  };
}
if(typeof v313ProcessSummary==='function'){
  const baseProcessSummary=v313ProcessSummary;
  v313ProcessSummary=function(plan,ops){
    const out=baseProcessSummary(plan,ops),eligible=trEligibleOperations(ops),done=eligible.filter(hasEmotionalEntry).length;
    out.journalCoverage=eligible.length?done/eligible.length*100:100;return out;
  };
}

const baseOpenEmotionalEditor=typeof openEmotionalEditor==='function'?openEmotionalEditor:null;
if(baseOpenEmotionalEditor)openEmotionalEditor=function(id){
  const operation=state.operations.find(x=>x.id===id);if(!operation)return;
  if(!trOperationEligible(operation))return alert('Backtesting queda fuera del Diario Emocional.');
  return baseOpenEmotionalEditor(id);
};
const baseSaveEmotionalEditor=typeof saveEmotionalEditor==='function'?saveEmotionalEditor:null;
if(baseSaveEmotionalEditor)saveEmotionalEditor=function(id){
  const operation=state.operations.find(x=>x.id===id);if(!operation)return;
  if(!trOperationEligible(operation))return alert('Backtesting queda fuera del Diario Emocional.');
  const session=trMatchingOpenSession(operation);if(session)operation.journalSessionId=session.id;
  return baseSaveEmotionalEditor(id);
};

/* Structural Runtime can render a session-restored Journal before this later runtime is loaded.
 * Repaint once after the script chain completes so V31.29 becomes visible on first boot/F5 too. */
try{
  if(['journal','journalops'].includes(globalThis.TradingResearchCurrentViewReadContract?.current?.())){
    setTimeout(()=>{try{window.render?.();}catch(e){console.warn('[Trading Research · Emotional Journal boot repaint]',e);}},0);
  }
}catch{}
})();
/* ===== END V31.29 RUNTIME ===== */
