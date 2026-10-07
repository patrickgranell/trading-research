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
  const answers=value?.answers&&typeof value.answers==='object'?Object.fromEntries(Object.entries(value.answers).map(([k,v])=>[trText(k),trText(v)]).filter(([k])=>k)):{};
  const out={
    confidencePersonal:TR_CONFIDENCE_LEVELS.includes(value?.confidencePersonal)?value.confidencePersonal:'',
    confidenceSystem:TR_CONFIDENCE_LEVELS.includes(value?.confidenceSystem)?value.confidenceSystem:'',
    stress:TR_TRI_LEVELS.includes(value?.stress)?value.stress:'',
    focus:TR_TRI_LEVELS.includes(value?.focus)?value.focus:'',
    fatigue:TR_TRI_LEVELS.includes(value?.fatigue)?value.fatigue:'',
    emotionalWear:TR_TRI_LEVELS.includes(value?.emotionalWear)?value.emotionalWear:'',
    emotion:trText(value?.emotion),
    note:trText(value?.note),
    answers
  };
  for(const key of ['confidencePersonal','confidenceSystem','stress','focus','fatigue','emotionalWear','emotion','note'])if(out[key]&&!out.answers[key])out.answers[key]=out[key];
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
function trNormalizeLog(value={},plan=null){
  const at=trText(value?.at)||trNow(),intensity=String(value?.intensity??'');
  return {
    id:trText(value?.id)||trId('EL'),
    schemaVersion:1,
    tradingPlanId:trText(value?.tradingPlanId)||trText(plan?.id),
    tradingPlanSnapshot:value?.tradingPlanSnapshot?trCopy(value.tradingPlanSnapshot):null,
    at,
    text:trText(value?.text),
    context:trText(value?.context),
    sessionId:trText(value?.sessionId),
    confidence:TR_CONFIDENCE_LEVELS.includes(value?.confidence)?value.confidence:'',
    emotionalWear:TR_TRI_LEVELS.includes(value?.emotionalWear)?value.emotionalWear:'',
    intensity:['1','2','3','4','5'].includes(intensity)?intensity:'',
    relatedReflection:trText(value?.relatedReflection),
    remember:value?.remember===true||String(value?.remember)==='true',
    createdAt:trText(value?.createdAt)||at,
    updatedAt:trText(value?.updatedAt)||at
  };
}
function trSessionScales(plan){
  const cfg=plan?.emotionConfig?.sessionScales||{};
  return {confidence:{...TR_CONFIDENCE_LABELS,...(cfg.confidence||{})},tri:{...TR_TRI_LABELS,...(cfg.tri||{})}};
}
function trSessionQuestions(plan){
  const rows=plan?.emotionConfig?.sessionQuestions;
  return Array.isArray(rows)?rows.filter(q=>q&&trText(q.id)&&trText(q.label)).map(q=>({id:trText(q.id),label:trText(q.label),type:['scale5','scale3','emotion','boolean','text'].includes(q.type)?q.type:'scale3'})):[];
}
function trEnsurePlan(plan){
  if(!plan||typeof plan!=='object')return plan;
  plan.emotionConfig=plan.emotionConfig&&typeof plan.emotionConfig==='object'?plan.emotionConfig:{};
  const scales=trSessionScales(plan);
  plan.emotionConfig.sessionScales={confidence:{...scales.confidence},tri:{...scales.tri}};
  plan.emotionConfig.sessionQuestions=Array.isArray(plan.emotionConfig.sessionQuestions)?plan.emotionConfig.sessionQuestions:[
    {id:'confidencePersonal',label:'Confianza personal',type:'scale5'},{id:'confidenceSystem',label:'Confianza en el sistema',type:'scale5'},
    {id:'stress',label:'Estrés',type:'scale3'},{id:'focus',label:'Foco',type:'scale3'},{id:'fatigue',label:'Fatiga',type:'scale3'},
    {id:'emotionalWear',label:'Desgaste emocional',type:'scale3'},{id:'emotion',label:'Emoción predominante',type:'emotion'},{id:'note',label:'Nota',type:'text'}
  ];
  const confidenceCore=[
    {id:'confidencePersonal',label:'Confianza personal',type:'scale5'},
    {id:'confidenceSystem',label:'Confianza en el sistema',type:'scale5'}
  ];
  for(let i=confidenceCore.length-1;i>=0;i--){
    const core=confidenceCore[i],existing=plan.emotionConfig.sessionQuestions.find(q=>q?.id===core.id);
    if(existing){existing.label=core.label;existing.type=core.type;}
    else plan.emotionConfig.sessionQuestions.unshift({...core});
  }
  const streakCriteria=plan.emotionConfig.streakCriteria&&typeof plan.emotionConfig.streakCriteria==='object'?plan.emotionConfig.streakCriteria:{};
  plan.emotionConfig.streakCriteria={
    mode:streakCriteria.mode==='manual'?'manual':'reference',
    manualLossCount:Math.max(2,Number(streakCriteria.manualLossCount)||3)
  };
  const rows=Array.isArray(plan.emotionalSessions)?plan.emotionalSessions:[];
  plan.emotionalSessions=rows.map(row=>trNormalizeSession(row,plan));
  const logs=Array.isArray(plan.emotionalLogs)?plan.emotionalLogs:[];
  plan.emotionalLogs=logs.map(row=>trNormalizeLog(row,plan));
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
  normalizeLog:trNormalizeLog,
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
  Object.defineProperty(globalThis,'TradingResearchEmotionalJournalPresentationContract',{value:Object.freeze({render:()=>trJournalSessionsRender(),renderOperations:()=>trJournalOperationsRender(),renderConfidence:()=>trJournalConfidenceRender(),renderStreaks:()=>trJournalStreaksRender(),renderNotes:()=>trJournalNotesRender(),renderStatements:()=>trJournalStatementsRender()}),writable:false,enumerable:false,configurable:false});
}
globalThis.__trEmotionalJournalStage='presentation-published';

/* Keep Dejar constancia as a first-class child of Diario emocional without
 * reopening the legacy app.js navigation implementation in this PR. */
try{
  if(typeof V318_NAV_GROUPS!=='undefined'){
    const group=V318_NAV_GROUPS.find(x=>x?.id==='emotional');
    if(group){
      if(!group.items.some(x=>x?.[0]==='journalconfidence')){
        const notesIndex=group.items.findIndex(x=>x?.[0]==='journalnotes');
        group.items.splice(notesIndex>=0?notesIndex:group.items.length,0,['journalconfidence','◇','Confianza']);
      }
      if(!group.items.some(x=>x?.[0]==='journalstreaks')){
        const confidenceIndex=group.items.findIndex(x=>x?.[0]==='journalconfidence');
        const notesIndex=group.items.findIndex(x=>x?.[0]==='journalnotes');
        group.items.splice(confidenceIndex>=0?confidenceIndex+1:(notesIndex>=0?notesIndex:group.items.length),0,['journalstreaks','≈','Rachas y adaptación']);
      }
      if(!group.items.some(x=>x?.[0]==='journalstatements'))group.items.push(['journalstatements','✎','Dejar constancia']);
    }
  }
}catch{}

if(typeof state==='undefined'||typeof document==='undefined')return;

/* Register actions only after the presentation contract is guaranteed to exist. */
const trNotesFilter={planId:'',period:'all',value:'',kind:'all',query:''};
let trJournalResultUnit='ticks';
function trJournalMetricSwitch(){
  const usdLabel='US\u0024';
  return '<div class="metric-switch emotional-result-unit"><span>Resultado</span>'+[['ticks','Ticks'],['r','R'],['usd',usdLabel]].map(([value,label])=>'<button class="seg-btn '+(trJournalResultUnit===value?'active':'')+'" data-result-unit="'+value+'" data-tr-action-click="emotionalResultUnit">'+label+'</button>').join('')+'</div>';
}
function trJournalMetricValue(operation){return opMetricValue(operation,trJournalResultUnit,'net');}
function trJournalMetricText(value){return metricStatText(value,trJournalResultUnit);}
function trJournalMetricLabel(){return metricUnitLabel(trJournalResultUnit);}
const trEarlyActions=window.TradingResearchActions||(window.TradingResearchActions=Object.create(null));
trEarlyActions.emotionalSessionOpenStart=function(){trSessionEditor(null,'start');};
trEarlyActions.emotionalSessionEditStart=function(){const s=trSessionById(this.dataset.sessionId);if(s)trSessionEditor(s,'start');};
trEarlyActions.emotionalSessionClose=function(){const s=trSessionById(this.dataset.sessionId);if(s)trSessionEditor(s,'end');};
trEarlyActions.emotionalSessionEditEnd=function(){const s=trSessionById(this.dataset.sessionId);if(s)trSessionEditor(s,'end');};
trEarlyActions.emotionalSessionSaveStart=function(){return trSaveSessionStart(String(this.dataset.sessionId||''));};
trEarlyActions.emotionalSessionSaveEnd=function(){return trSaveSessionEnd(String(this.dataset.sessionId||''));};
trEarlyActions.emotionalSessionDelete=function(){return trDeleteSession(String(this.dataset.sessionId||''));};
trEarlyActions.emotionalOpenOperation=function(){return openEmotionalEditor(String(this.dataset.operationId||''));};
trEarlyActions.emotionalResultUnit=function(){const unit=String(this.dataset.resultUnit||'');if(['ticks','r','usd'].includes(unit)){trJournalResultUnit=unit;render();}};
trEarlyActions.emotionalBreakdownFilter=function(){
  const key=String(this.dataset.filterKey||'');
  const value=decodeURIComponent(String(this.dataset.filterValue||''));
  if(key==='emotion'||key==='behavior')return trLegacyStateCommand('journal-set',key,value);
  return false;
};
trEarlyActions.emotionalNotesFilterChange=function(){
  const key=String(this.dataset.notesKey||''),value=String(this.value||'');
  if(key==='period'){trNotesFilter.period=value||'all';trNotesFilter.value='';}
  else if(key==='value')trNotesFilter.value=value;
  else if(key==='kind')trNotesFilter.kind=value||'all';
  else if(key==='query')trNotesFilter.query=value;
  render();
};
trEarlyActions.emotionalNotesFilterReset=function(){
  trNotesFilter.period='all';trNotesFilter.value='';trNotesFilter.kind='all';trNotesFilter.query='';render();
};
trEarlyActions.emotionalLogOpen=function(){trLogEditor(String(this.dataset.logId||''));};
trEarlyActions.emotionalLogSave=function(){return trSaveLog(String(this.dataset.logId||''));};
trEarlyActions.emotionalLogDelete=function(){return trDeleteLog(String(this.dataset.logId||''));};
trEarlyActions.emotionalStreakCriteriaOpen=function(){return trStreakCriteriaEditor();};
trEarlyActions.emotionalStreakCriteriaSave=function(){return trSaveStreakCriteria();};

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

/* Confidence personal/system are schema-level dimensions because the Confidence view
 * consumes their stable IDs. Only these two variables are locked; every other
 * emotional/session variable remains user-configurable. */
const TR_LOCKED_CONFIDENCE_QUESTIONS=Object.freeze({
  confidencePersonal:Object.freeze({label:'Confianza personal',type:'scale5'}),
  confidenceSystem:Object.freeze({label:'Confianza en el sistema',type:'scale5'})
});
function trConfidenceQuestionLocked(question){return !!TR_LOCKED_CONFIDENCE_QUESTIONS[trText(question?.id)];}
if(typeof emotionConfigPanel==='function'){
  const baseEmotionConfigPanel=emotionConfigPanel;
  emotionConfigPanel=function(plan){
    let html=baseEmotionConfigPanel(plan);
    const questions=Array.isArray(plan?.emotionConfig?.sessionQuestions)?plan.emotionConfig.sessionQuestions:[];
    questions.forEach((question,index)=>{
      if(!trConfidenceQuestionLocked(question))return;
      const inputNeedle=`id="emotion-session-question-label-${index}" class="input"`;
      const selectNeedle=`id="emotion-session-question-type-${index}" class="select"`;
      const removeNeedle=`<button class="btn small danger" data-tr-onclick="removeEmotionConfig('sessionQuestions',${index})">Eliminar</button>`;
      html=html.replace(inputNeedle,`id="emotion-session-question-label-${index}" class="input confidence-taxonomy-locked" readonly aria-readonly="true"`);
      html=html.replace(selectNeedle,`id="emotion-session-question-type-${index}" class="select confidence-taxonomy-locked" disabled aria-disabled="true"`);
      html=html.replace(removeNeedle,`<div class="confidence-taxonomy-lock" title="Variable base usada por el apartado Confianza">Bloqueada</div>`);
    });
    return html;
  };
}
if(typeof removeEmotionConfig==='function'){
  const baseRemoveEmotionConfig=removeEmotionConfig;
  removeEmotionConfig=function(type,index){
    const plan=getCurrentPlan?.();
    if(type==='sessionQuestions'&&trConfidenceQuestionLocked(plan?.emotionConfig?.sessionQuestions?.[index]))return false;
    return baseRemoveEmotionConfig(type,index);
  };
}
if(typeof addEmotionConfig==='function'){
  const baseAddEmotionConfig=addEmotionConfig;
  addEmotionConfig=function(type){
    const plan=getCurrentPlan?.();
    if(type==='sessionQuestionsSave'&&plan){
      for(const question of plan.emotionConfig?.sessionQuestions||[]){
        const core=TR_LOCKED_CONFIDENCE_QUESTIONS[question?.id];
        if(!core)continue;
        const label=document.getElementById(`emotion-session-question-label-${plan.emotionConfig.sessionQuestions.indexOf(question)}`);
        const response=document.getElementById(`emotion-session-question-type-${plan.emotionConfig.sessionQuestions.indexOf(question)}`);
        if(label)label.value=core.label;
        if(response)response.value=core.type;
      }
    }
    return baseAddEmotionConfig(type);
  };
}

if(typeof makeBlankPlan==='function'){
  const baseMakeBlankPlan=makeBlankPlan;
  makeBlankPlan=function(meta={}){const plan=baseMakeBlankPlan(meta);plan.emotionalSessions=[];plan.emotionalLogs=[];return trEnsurePlan(plan);};
}
if(typeof normalizePlan==='function'){
  const baseNormalizePlan=normalizePlan;
  normalizePlan=function(plan,instruments){return trEnsurePlan(baseNormalizePlan(plan,instruments));};
}
if(typeof clonePlanForVersion==='function'){
  const baseClonePlanForVersion=clonePlanForVersion;
  clonePlanForVersion=function(source,meta={}){const plan=baseClonePlanForVersion(source,meta);plan.emotionalSessions=[];plan.emotionalLogs=[];return trEnsurePlan(plan);};
}

function trLogs(plan=getCurrentPlan()){
  trEnsurePlan(plan);
  return plan?.emotionalLogs||[];
}
function trLogById(id,plan=getCurrentPlan()){return trLogs(plan).find(x=>x.id===id)||null;}
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
function trSessionContainsOperation(session,operation){
  if(!session||!operation||session.tradingPlanId!==operation.tradingPlanId)return false;
  const mode=trSessionModeForOperation(operation);
  if(!mode||session.mode!==mode)return false;
  const at=Date.parse(operation.entryDate||''),start=Date.parse(session.startedAt||''),end=session.endedAt?Date.parse(session.endedAt):Infinity;
  return Number.isFinite(at)&&Number.isFinite(start)&&at>=start&&at<=end;
}
function trSessionForOperation(operation,plan=getPlan(operation?.tradingPlanId)){
  if(!operation||!plan)return null;
  const explicit=operation.journalSessionId?trSessionById(operation.journalSessionId,plan):null;
  if(explicit)return explicit;
  const matches=trSessions(plan).filter(session=>trSessionContainsOperation(session,operation));
  if(matches.length!==1)return null;
  return matches[0];
}
function trRelinkSessionOperations(session,plan=getPlan(session?.tradingPlanId)){
  if(!session||!plan)return 0;
  let linked=0;
  for(const operation of state.operations||[]){
    if(operation.journalSessionId===session.id)operation.journalSessionId='';
  }
  for(const operation of state.operations||[]){
    if(!trOperationEligible(operation)||operation.tradingPlanId!==plan.id||operation.journalSessionId)continue;
    if(trSessionContainsOperation(session,operation)){operation.journalSessionId=session.id;linked++;}
  }
  return linked;
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
function trLogEditor(id=''){
  const plan=getCurrentPlan();if(!plan)return;
  if(trJournalPlanEnvironment(plan)==='backtest')return alert('Backtesting queda fuera del Diario Emocional.');
  trEnsurePlan(plan);
  const existing=id?trLogById(id,plan):null;
  const body=`<form id="emotional-log-form" data-tr-onsubmit="return false">
    <div class="form-section emotional-log-primary"><h4>${existing?'Editar constancia':'Dejar constancia'}</h4>
      <label class="field"><span>Texto libre</span><textarea id="em-log-text" class="input emotional-log-text" placeholder="Escribe libremente lo que quieras dejar aquí…">${esc(existing?.text||'')}</textarea></label>
      <div class="help">Sin preguntas ni campos adicionales. La fecha y la hora se guardan automáticamente.</div>
    </div>
  </form>`;
  const footer=`${existing?'<button class="btn danger" data-log-id="'+esc(existing.id)+'" data-tr-action-click="emotionalLogDelete">Eliminar</button>':''}<button class="btn" data-tr-action-click="closeModal">Cancelar</button><button class="btn primary" data-log-id="${esc(existing?.id||'')}" data-tr-action-click="emotionalLogSave">Guardar constancia</button>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(existing?'Editar constancia':'Dejar constancia',body,footer));
}
function trSaveLog(id=''){
  const plan=getCurrentPlan();if(!plan)return false;
  if(trJournalPlanEnvironment(plan)==='backtest')return false;
  trEnsurePlan(plan);
  const existing=id?trLogById(id,plan):null,now=trNow(),at=existing?.at||now;
  const item=trNormalizeLog({
    ...(existing||{}),
    id:id||undefined,tradingPlanId:plan.id,tradingPlanSnapshot:existing?.tradingPlanSnapshot||trPlanSnapshot(plan),at,
    text:document.getElementById('em-log-text')?.value||'',
    createdAt:existing?.createdAt||at,updatedAt:now
  },plan);
  if(!item.text)return alert('Escribe algo antes de guardar la constancia.');
  if(existing)Object.assign(existing,item,{id:existing.id,createdAt:existing.createdAt});
  else plan.emotionalLogs.unshift(item);
  plan.updatedAt=now;persist();closeModal();render();return true;
}
function trDeleteLog(id){
  const plan=getCurrentPlan();if(!plan)return false;
  const item=trLogById(id,plan);if(!item)return false;
  if(!confirm('¿Eliminar esta constancia emocional?'))return false;
  plan.emotionalLogs=trLogs(plan).filter(x=>x.id!==id);plan.updatedAt=trNow();persist();closeModal();render();return true;
}
function trPointFields(prefix,point,plan){
  const scales=trSessionScales(plan),questions=trSessionQuestions(plan);
  const answer=id=>trText(point?.answers?.[id]??point?.[id]??'');
  const control=q=>{
    const id=prefix+'-q-'+q.id,current=answer(q.id);
    if(q.type==='scale5')return trSelect(id,q.label,TR_CONFIDENCE_LEVELS.map(value=>({value,label:scales.confidence[value]||TR_CONFIDENCE_LABELS[value]})),current);
    if(q.type==='scale3')return trSelect(id,q.label,TR_TRI_LEVELS.map(value=>({value,label:scales.tri[value]||TR_TRI_LABELS[value]})),current);
    if(q.type==='emotion')return trSelect(id,q.label,(plan?.emotionConfig?.emotions||[]).map(value=>({value,label:value})),current);
    if(q.type==='boolean')return trSelect(id,q.label,[{value:'yes',label:'Sí'},{value:'no',label:'No'}],current);
    return `<label class="field span2"><span>${esc(q.label)}</span><textarea id="${esc(id)}" class="input">${esc(current)}</textarea></label>`;
  };
  return questions.length?questions.map(control).join(''):'<div class="empty">No hay variables configuradas para esta sesión.</div>';
}
function trReadPoint(prefix,plan){
  const answers={};
  for(const q of trSessionQuestions(plan)){
    const value=document.getElementById(prefix+'-q-'+q.id)?.value||'';
    if(value!=='')answers[q.id]=value;
  }
  const legacy={answers};
  for(const key of ['confidencePersonal','confidenceSystem','stress','focus','fatigue','emotionalWear','emotion','note'])if(answers[key])legacy[key]=answers[key];
  return trNormalizePoint(legacy);
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
    existing.mode=mode;existing.startedAt=startedAt;existing.start=trReadPoint('em-session-point',plan);existing.updatedAt=now;
  }else{
    plan.emotionalSessions.unshift(trNormalizeSession({
      id:trId('ES'),tradingPlanId:plan.id,tradingPlanSnapshot:trPlanSnapshot(plan),mode,startedAt,
      start:trReadPoint('em-session-point',plan),end:{},createdAt:now,updatedAt:now
    },plan));
  }
  const saved=id?trSessionById(id,plan):trSessions(plan)[0];
  if(saved?.endedAt)trRelinkSessionOperations(saved,plan);
  plan.updatedAt=now;persist();closeModal();render();return true;
}
function trSaveSessionEnd(id){
  const plan=getCurrentPlan(),session=trSessionById(id,plan);if(!session)return false;
  session.endedAt=trInputIso(document.getElementById('em-session-time')?.value,trNow());
  session.end=trReadPoint('em-session-point',plan);session.updatedAt=trNow();plan.updatedAt=session.updatedAt;
  trRelinkSessionOperations(session,plan);
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
  const scales=trSessionScales(plan),answers=point?.answers||{},bits=[];
  const display=(q,value)=>{
    if(q.type==='scale5')return scales.confidence[value]||TR_CONFIDENCE_LABELS[value]||value;
    if(q.type==='scale3')return scales.tri[value]||TR_TRI_LABELS[value]||value;
    if(q.type==='boolean')return value==='yes'?'Sí':value==='no'?'No':value;
    return value;
  };
  for(const q of trSessionQuestions(plan)){
    const value=trText(answers[q.id]??point?.[q.id]??'');
    if(!value||q.type==='text')continue;
    bits.push(q.label+' '+display(q,value));
    if(bits.length>=4)break;
  }
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
  return `<div class="table-wrap"><table class="table journal-table"><thead><tr><th>Fecha</th><th>Contrato</th><th>Dir.</th><th>Setup</th><th>Resultado</th><th>Disciplina</th><th>Antes</th><th>Durante</th><th>Final</th><th>Comportamientos</th><th>Diario</th></tr></thead><tbody>${ops.map(o=>{const e=o.emotional||{};return `<tr><td>${fmtDate(o.entryDate)}</td><td>${esc(o.contract||'—')}</td><td>${esc(o.direction||'—')}</td><td>${esc(o.setup||'—')}</td><td class="${Number(o.pnlNet)>=0?'positive':'negative'}">${esc(trJournalMetricText(trJournalMetricValue(o)))}</td><td><span class="badge ${o.discipline?'win':'loss'}">${typeof o.discipline==='boolean'?(o.discipline?'Sí':'No'):'—'}</span></td><td>${esc(e.before||'—')}</td><td>${esc(e.during||'—')}</td><td>${esc(e.after||'—')}</td><td>${(e.behaviors||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join(' ')||'—'}</td><td><button class="btn small ${hasEmotionalEntry(o)?'':'primary'}" data-operation-id="${esc(o.id)}" data-tr-action-click="emotionalOpenOperation">${hasEmotionalEntry(o)?'Editar':'Completar'}</button></td></tr>`}).join('')}</tbody></table></div>`;
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
function trEmotionalBreakdownMetric(ops,key='emotion'){
  const groups=new Map(),filterKey=key==='emotion'?'emotion':'behavior';
  ops.forEach(o=>{const vals=key==='emotion'?operationEmotionValues(o):(o.emotional?.behaviors||[]);[...new Set(vals)].forEach(v=>{if(!groups.has(v))groups.set(v,[]);groups.get(v).push(o);});});
  const rows=[...groups.entries()].map(([label,x])=>({label,ops:x,s:calcMetricStats(x,trJournalResultUnit,'net')})).sort((a,b)=>b.ops.length-a.ops.length);
  const max=Math.max(...rows.map(x=>x.ops.length),1);
  return '<div class="emotion-break-list">'+(rows.length?rows.map(row=>'<button data-filter-key="'+filterKey+'" data-filter-value="'+inlineUriToken(row.label)+'" data-tr-action-click="emotionalBreakdownFilter"><span>'+esc(row.label)+'</span><progress class="emotion-break-progress" max="100" value="'+Math.min(100,row.ops.length/max*100).toFixed(1)+'"></progress><strong>'+row.ops.length+'</strong><em>'+esc(trJournalMetricText(row.s.expectancy))+'</em></button>').join(''):'<div class="empty">Aún no hay datos emocionales.</div>')+'</div>';
}
function trJournalOperationsRender(){
  const plan=getCurrentPlan();if(!plan)return '';
  const env=trJournalPlanEnvironment(plan);
  if(env==='backtest')return '';
  const ops=trEligibleOperations(journalFilteredOps()),st=journalStats(ops),em=plan?.emotionConfig?.emotions||[],bh=plan?.emotionConfig?.behaviors||[];
  const sel=(id,label,arr,val)=>`<label class="filter-field"><span>${label}</span><select id="${id}" class="select" data-tr-onchange="readJournalFilters()"><option value="">Todos</option>${arr.map(x=>`<option value="${esc(typeof x==='object'?x.value:x)}" ${String(val)===String(typeof x==='object'?x.value:x)?'selected':''}>${esc(typeof x==='object'?x.label:x)}</option>`).join('')}</select></label>`;
  return `${pageHead('Diario emocional · Registro por operación','Registro emocional de cada trade, separado de las sesiones.',trJournalMetricSwitch())}
    ${activePlanBanner()}
    <section class="card filter-hub"><div class="filter-hub-top"><div><h3>Filtro emocional</h3><p>El registro conserva el contexto técnico de cada operación.</p></div><button class="btn small" data-tr-onclick="trLegacyStateCommand('journal-reset')">Limpiar</button></div><div class="filter-grid"><label class="filter-field wide"><span>Buscar</span><input id="journalQ" class="input" value="${esc(journalViewState.q)}" placeholder="Setup, contrato, notas…" data-tr-onchange="readJournalFilters()"></label>${sel('journalEmotion','Emoción',em,journalViewState.emotion)}${sel('journalBehavior','Comportamiento',bh,journalViewState.behavior)}${sel('journalDiscipline','Disciplina',[{value:'yes',label:'Disciplinada'},{value:'no',label:'No disciplinada'}],journalViewState.discipline)}${sel('journalStatus','Estado del diario',[{value:'complete',label:'Completado'},{value:'pending',label:'Pendiente'}],journalViewState.status)}</div></section>
    <div class="journal-kpis">${kpi('Trades visibles',ops.length,'con contexto técnico')}${kpi('Diario completado',pct(st.completion),`${st.complete}/${ops.length}`)}${kpi('Disciplina',pct(st.discipline),'sobre selección')}${kpi('Estrés medio',trLegacyMetric(st.stress),'trades registrados')}${kpi('Foco medio',trLegacyMetric(st.focus),'trades registrados')}${kpi('Intensidad',trLegacyMetric(st.intensity),'carga emocional')}</div>
    <div class="grid two journal-charts"><section class="card panel"><div class="panel-title"><h3>Resultados por emoción</h3><span>Expectancy · ${esc(trJournalMetricLabel())}</span></div>${trEmotionalBreakdownMetric(ops,'emotion')}</section><section class="card panel"><div class="panel-title"><h3>Resultados por comportamiento</h3><span>Expectancy · ${esc(trJournalMetricLabel())}</span></div>${trEmotionalBreakdownMetric(ops,'behavior')}</section></div>
    <section class="card panel"><div class="panel-title"><div><h3>Operaciones + diario</h3><small>Antes · Durante · Final. Backtesting no participa en este diario.</small></div><span>${ops.length} visibles</span></div>${trOperationTable(ops)}</section>`;
}
function trConfidenceValue(value){const i=TR_CONFIDENCE_LEVELS.indexOf(value);return i>=0?i+1:null;}
function trConfidenceLabel(value,plan){if(!value)return 'Sin informar';return trSessionScales(plan).confidence[value]||TR_CONFIDENCE_LABELS[value]||value;}
function trConfidenceDisplay(start,end,plan){
  const a=trConfidenceLabel(start,plan),b=trConfidenceLabel(end,plan);
  if(start&&end)return a===b?a:`${a} → ${b}`;
  return end?b:start?a:'Sin informar';
}
function trConfidenceLatestPoint(session){
  const end=session?.end||{},start=session?.start||{};
  const endHas=!!(end.confidencePersonal||end.confidenceSystem);
  return endHas?{point:end,phase:'cierre',at:session.endedAt||session.startedAt}:{point:start,phase:'inicio',at:session.startedAt};
}
function trConfidenceReading(personal,system){
  const p=trConfidenceValue(personal),s=trConfidenceValue(system);
  if(p===null&&s===null)return {title:'Sin lectura todavía',text:'Registra confianza personal y confianza en el sistema en una sesión para empezar a construir el historial.'};
  if(p===null||s===null)return {title:'Datos parciales',text:'Hay una de las dos confianzas sin informar; se conserva como dato desconocido.'};
  if(p<=2&&s>=3)return {title:'Confianza personal por debajo del sistema',text:'La confianza en el sistema se mantiene por encima de tu confianza personal. La separación queda registrada sin asumir que exista un problema de ejecución.'};
  if(s<=2&&p>=3)return {title:'Confianza en el sistema por debajo de la personal',text:'Tu confianza personal se mantiene por encima de la confianza que declaras en el sistema.'};
  if(p<=2&&s<=2)return {title:'Confianza baja en ambas',text:'La última lectura sitúa bajas tanto la confianza personal como la confianza en el sistema.'};
  if(p>=4&&s>=4)return {title:'Confianza alta en ambas',text:'La última lectura sitúa altas tanto la confianza personal como la confianza en el sistema.'};
  const gap=p-s;
  if(Math.abs(gap)>=2)return {title:'Brecha relevante entre ambas',text:gap>0?'La confianza personal está claramente por encima de la confianza en el sistema.':'La confianza en el sistema está claramente por encima de tu confianza personal.'};
  return {title:'Confianza relativamente equilibrada',text:'La última lectura mantiene ambas dimensiones próximas entre sí.'};
}
function trJournalConfidenceRender(){
  const plan=getCurrentPlan();if(!plan)return '';
  const env=trJournalPlanEnvironment(plan);if(env==='backtest')return '';
  trEnsurePlan(plan);
  const sessions=trSessions(plan).slice().sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||'')));
  const rows=sessions.filter(s=>s?.start?.confidencePersonal||s?.start?.confidenceSystem||s?.end?.confidencePersonal||s?.end?.confidenceSystem);
  const latest=rows.length?trConfidenceLatestPoint(rows[0]):{point:{},phase:'',at:''};
  const personal=latest.point?.confidencePersonal||'',system=latest.point?.confidenceSystem||'';
  const reading=trConfidenceReading(personal,system);
  const pValue=trConfidenceValue(personal),sValue=trConfidenceValue(system);
  const gap=(pValue!==null&&sValue!==null)?pValue-sValue:null;
  const gapText=gap===null?'—':gap===0?'Sin brecha':gap>0?`Personal +${gap}`:`Sistema +${Math.abs(gap)}`;
  const feed=rows.length?rows.map(session=>{
    const last=trConfidenceLatestPoint(session),lastPersonal=last.point?.confidencePersonal||'',lastSystem=last.point?.confidenceSystem||'';
    const state=trConfidenceReading(lastPersonal,lastSystem);
    const operations=trSessionOperationCount(session.id);
    return `<article class="confidence-session-card">
      <header class="confidence-session-head"><div><strong>${esc(fmtDate(session.startedAt))}</strong><span>${esc(TR_SESSION_MODE_LABELS[session.mode]||session.mode)}</span></div><span>${operations} ${operations===1?'operación':'operaciones'}</span></header>
      <div class="confidence-session-grid">
        <div><span>Confianza personal</span><strong>${esc(trConfidenceDisplay(session.start?.confidencePersonal,session.end?.confidencePersonal,plan))}</strong></div>
        <div><span>Confianza en el sistema</span><strong>${esc(trConfidenceDisplay(session.start?.confidenceSystem,session.end?.confidenceSystem,plan))}</strong></div>
      </div>
      <footer><span>${esc(state.title)}</span><button class="btn small" data-session-id="${esc(session.id)}" data-tr-action-click="${session.endedAt?'emotionalSessionEditEnd':'emotionalSessionEditStart'}">Abrir sesión</button></footer>
    </article>`;
  }).join(''):'<div class="empty">Todavía no hay sesiones con datos de confianza.</div>';
  return `${pageHead('Diario emocional · Confianza','Seguimiento de la confianza personal y de la confianza en el sistema a partir de las sesiones ya registradas.','')}
    ${activePlanBanner()}
    <div class="confidence-kpis">
      ${kpi('Confianza personal',trConfidenceLabel(personal,plan),latest.at?`${latest.phase} · ${fmtDate(latest.at)}`:'sin datos')}
      ${kpi('Confianza en el sistema',trConfidenceLabel(system,plan),latest.at?`${latest.phase} · ${fmtDate(latest.at)}`:'sin datos')}
      ${kpi('Brecha actual',gapText,'personal vs sistema')}
      ${kpi('Sesiones con confianza',rows.length,`${sessions.length} sesiones totales`)}
    </div>
    <section class="card panel confidence-reading"><div class="panel-title"><div><h3>Lectura actual</h3><small>No diagnostica ni prescribe; organiza lo que ya has registrado.</small></div></div><strong>${esc(reading.title)}</strong><p>${esc(reading.text)}</p></section>
    <section class="card panel confidence-history"><div class="panel-title"><div><h3>Evolución por sesión</h3><small>Inicio → cierre cuando ambos puntos están informados.</small></div><span>${rows.length} sesiones</span></div><div class="confidence-session-feed">${feed}</div></section>`;
}


function trStreakOutcome(operation){
  const value=Number(operation?.pnlNet);
  if(!Number.isFinite(value)||value===0)return 'flat';
  return value>0?'win':'loss';
}
function trStreaks(plan){
  const ordered=trEligibleOperations(currentOps()).filter(o=>o?.tradingPlanId===plan?.id).slice().sort((a,b)=>typeof v3194CompareOps==='function'?v3194CompareOps(a,b):String(a.entryDate||'').localeCompare(String(b.entryDate||'')));
  const streaks=[];let current=null;
  const close=()=>{if(current){streaks.push(current);current=null;}};
  for(const operation of ordered){
    const outcome=trStreakOutcome(operation);
    if(outcome==='flat'){close();continue;}
    if(!current||current.type!==outcome){close();current={type:outcome,operations:[]};}
    current.operations.push(operation);
  }
  close();
  return streaks.map((streak,index)=>{
    const operations=streak.operations,first=operations[0],last=operations[operations.length-1];
    const known=operations.filter(o=>typeof o.discipline==='boolean');
    const disciplined=known.filter(o=>o.discipline).length;
    const deviations=known.filter(o=>!o.discipline).length;
    const disciplineState=!known.length?'unknown':deviations?'deviation':known.length===operations.length?'clean':'partial';
    const rValues=operations.map(o=>{const risk=Number(o.riskUsd),pnl=Number(o.pnlNet);return Number.isFinite(risk)&&risk>0&&Number.isFinite(pnl)?pnl/risk:null;}).filter(v=>v!==null);
    const pnl=operations.reduce((sum,o)=>sum+(Number(o.pnlNet)||0),0);
    const sessions=[...new Map(operations.map(o=>trSessionForOperation(o,plan)).filter(Boolean).map(s=>[s.id,s])).values()].sort((a,b)=>String(a.startedAt||'').localeCompare(String(b.startedAt||'')));
    const firstSession=sessions[0]||null,lastSession=sessions[sessions.length-1]||null;
    const latest=lastSession?trConfidenceLatestPoint(lastSession):{point:{}};
    const startPoint=firstSession?.start||{};
    return {
      index,type:streak.type,operations,count:operations.length,first,last,pnl,
      r:rValues.length?rValues.reduce((a,b)=>a+b,0):null,rCount:rValues.length,
      disciplineState,known:known.length,disciplined,deviations,
      sessions,startConfidencePersonal:startPoint.confidencePersonal||'',startConfidenceSystem:startPoint.confidenceSystem||'',
      endConfidencePersonal:latest.point?.confidencePersonal||'',endConfidenceSystem:latest.point?.confidenceSystem||''
    };
  });
}
function trStreakDisciplineLabel(streak){
  if(streak.disciplineState==='clean')return 'Disciplina íntegra';
  if(streak.disciplineState==='deviation')return `${streak.deviations} desviación${streak.deviations===1?'':'es'} registrada${streak.deviations===1?'':'s'}`;
  if(streak.disciplineState==='partial')return `Disciplina parcial · ${streak.known}/${streak.count}`;
  return 'Disciplina sin informar';
}
function trStreakConfidenceText(streak,plan,key){
  const start=key==='personal'?streak.startConfidencePersonal:streak.startConfidenceSystem;
  const end=key==='personal'?streak.endConfidencePersonal:streak.endConfidenceSystem;
  if(start&&end)return start===end?trConfidenceLabel(start,plan):`${trConfidenceLabel(start,plan)} → ${trConfidenceLabel(end,plan)}`;
  return trConfidenceLabel(end||start,plan);
}
function trStreakReferencePlan(plan){
  if(!plan?.validationGroupId)return null;
  const members=globalThis.TradingResearchOperationSemanticsContract?.validationGroupMembers?.(state,plan.validationGroupId)||[];
  const candidates=members.filter(p=>globalThis.TradingResearchOperationSemanticsContract?.planEnvironment?.(p)==='backtest');
  if(!candidates.length)return null;
  return candidates.slice().sort((a,b)=>{
    const an=(state.operations||[]).filter(o=>o.tradingPlanId===a.id&&trOperationLayer(o)==='backtest').length;
    const bn=(state.operations||[]).filter(o=>o.tradingPlanId===b.id&&trOperationLayer(o)==='backtest').length;
    return bn-an;
  })[0];
}
function trLossStreakLengths(operations){
  const ordered=operations.slice().sort((a,b)=>typeof v3194CompareOps==='function'?v3194CompareOps(a,b):String(a.entryDate||'').localeCompare(String(b.entryDate||'')));
  const lengths=[];let count=0;
  for(const operation of ordered){
    const outcome=trStreakOutcome(operation);
    if(outcome==='loss')count++;
    else{if(count)lengths.push(count);count=0;}
  }
  if(count)lengths.push(count);
  return lengths.filter(x=>x>=2);
}
function trQuantile(values,q){
  const rows=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if(!rows.length)return null;
  if(rows.length===1)return rows[0];
  const pos=(rows.length-1)*q,base=Math.floor(pos),rest=pos-base;
  return rows[base+1]!==undefined?rows[base]+rest*(rows[base+1]-rows[base]):rows[base];
}
function trStreakCriterion(plan){
  trEnsurePlan(plan);
  const cfg=plan?.emotionConfig?.streakCriteria||{mode:'reference',manualLossCount:3};
  const referencePlan=trStreakReferencePlan(plan);
  const referenceOps=referencePlan?(state.operations||[]).filter(o=>o.tradingPlanId===referencePlan.id&&trOperationLayer(o)==='backtest'):[];
  const lossLengths=trLossStreakLengths(referenceOps),sufficient=referenceOps.length>=20&&lossLengths.length>=3;
  const p75=sufficient?Math.max(3,Math.ceil(trQuantile(lossLengths,.75)||3)):null;
  const maxLoss=lossLengths.length?Math.max(...lossLengths):null;
  if(cfg.mode==='manual'){
    return {mode:'manual',threshold:Math.max(2,Number(cfg.manualLossCount)||3),referencePlan,referenceOps,lossLengths,sufficient,p75,maxLoss};
  }
  return {mode:'reference',threshold:sufficient?p75:null,referencePlan,referenceOps,lossLengths,sufficient,p75,maxLoss};
}
function trStreakCriterionLabel(criterion){
  if(criterion.mode==='manual')return `Manual · desde ${criterion.threshold} pérdidas consecutivas`;
  if(!criterion.referencePlan)return 'Automático · sin Backtesting de referencia';
  if(!criterion.sufficient)return `Automático · referencia insuficiente (${criterion.referenceOps.length} operaciones)`;
  return `Automático · P75 del Backtesting = ${criterion.threshold} pérdidas · máximo histórico ${criterion.maxLoss}`;
}
function trStreakSeverity(streak,criterion){
  if(!streak||streak.type!=='loss')return {key:'none',label:'No aplica'};
  if(!criterion.threshold)return {key:'unknown',label:'Sin criterio suficiente'};
  if(criterion.mode==='reference'&&criterion.maxLoss!==null&&streak.count>criterion.maxLoss)return {key:'outside',label:'Fuera del histórico'};
  if(streak.count>=criterion.threshold)return {key:'bad',label:'Mala racha'};
  return {key:'normal',label:'Racha perdedora dentro del rango'};
}
function trDrawdownEpisodes(operations){
  const ordered=operations.slice().sort((a,b)=>typeof v3194CompareOps==='function'?v3194CompareOps(a,b):String(a.entryDate||'').localeCompare(String(b.entryDate||'')));
  const episodes=[];let equity=0,peak=0,current=null;
  const close=at=>{if(current){current.endAt=at;current.recovered=true;episodes.push(current);current=null;}};
  for(const operation of ordered){
    const value=Number(opMetricValue(operation,'ticks','net'))||0;
    equity+=value;
    if(equity>=peak){
      close(operation.entryDate||'');
      peak=equity;
      continue;
    }
    if(!current)current={startAt:operation.entryDate||'',endAt:'',depth:0,recovered:false,operations:[]};
    current.operations.push(operation);
    current.depth=Math.min(current.depth,equity-peak);
  }
  if(current)episodes.push(current);
  return episodes;
}
function trStreakCriteriaEditor(){
  const plan=getCurrentPlan();if(!plan)return false;
  const criterion=trStreakCriterion(plan),cfg=plan.emotionConfig.streakCriteria||{};
  const ref=criterion.referencePlan?planLabel(criterion.referencePlan):'No disponible';
  const info=criterion.referencePlan
    ?`Referencia: ${esc(ref)} · ${criterion.referenceOps.length} operaciones · ${criterion.lossLengths.length} rachas perdedoras ≥2.`
    :'Este TP no tiene un Backtesting de referencia dentro de su grupo de validación.';
  const body=`<form id="streak-criteria-form" data-tr-onsubmit="return false"><div class="form-section"><h4>Definición de mala racha</h4>
    <div class="form-grid">
      <label class="field span2"><span>Criterio</span><select id="streak-criteria-mode" class="select"><option value="reference" ${cfg.mode!=='manual'?'selected':''}>Automático desde Backtesting de referencia</option><option value="manual" ${cfg.mode==='manual'?'selected':''}>Umbral manual</option></select></label>
      <label class="field"><span>Pérdidas consecutivas · manual</span><input id="streak-manual-loss-count" class="input" type="number" min="2" step="1" value="${Math.max(2,Number(cfg.manualLossCount)||3)}"></label>
    </div>
    <div class="notice">${info}<br>El modo automático solo se activa con al menos 20 operaciones y 3 episodios perdedores en el Backtesting; el umbral se toma del P75 de sus rachas perdedoras, con mínimo de 3.</div>
  </div></form>`;
  document.body.insertAdjacentHTML('beforeend',modalShell('Criterio de mala racha',body,'<button class="btn" data-tr-action-click="closeModal">Cancelar</button><button class="btn primary" data-tr-action-click="emotionalStreakCriteriaSave">Guardar criterio</button>'));
  return true;
}
function trSaveStreakCriteria(){
  const plan=getCurrentPlan();if(!plan)return false;
  const mode=document.getElementById('streak-criteria-mode')?.value==='manual'?'manual':'reference';
  const manualLossCount=Math.max(2,Number(document.getElementById('streak-manual-loss-count')?.value)||3);
  trEnsurePlan(plan);plan.emotionConfig.streakCriteria={mode,manualLossCount};plan.updatedAt=trNow();
  persist();closeModal();render();return true;
}
function trStreakReading(streak,criterion){
  if(!streak)return {title:'Sin racha registrada',text:'Todavía no hay operaciones suficientes para describir una racha.'};
  const type=streak.type==='loss'?'perdedora':'ganadora',severity=trStreakSeverity(streak,criterion);
  if(streak.type==='loss'&&severity.key==='outside')return {title:'Racha fuera del histórico',text:'La longitud de la racha supera la máxima racha perdedora observada en el Backtesting de referencia.'};
  if(streak.type==='loss'&&severity.key==='bad'&&streak.disciplineState==='clean')return {title:'Mala racha con disciplina intacta',text:'La racha ha alcanzado el umbral definido como mala racha, pero la ejecución registrada mantiene la disciplina.'};
  if(streak.type==='loss'&&severity.key==='bad'&&streak.disciplineState==='deviation')return {title:'Mala racha con desviaciones registradas',text:'La racha ha alcanzado el umbral definido y contiene al menos una desviación de disciplina registrada.'};
  if(streak.type==='loss'&&severity.key==='bad'&&streak.disciplineState==='partial')return {title:'Mala racha con disciplina parcial',text:'La racha ha alcanzado el umbral definido, aunque solo parte de la disciplina está informada.'};
  if(streak.type==='loss'&&severity.key==='bad'&&streak.disciplineState==='unknown')return {title:'Mala racha sin disciplina informada',text:'La racha ha alcanzado el umbral definido, pero no hay datos de disciplina suficientes para valorar el proceso.'};
  if(streak.type==='loss'&&severity.key==='normal')return {title:'Racha perdedora dentro del rango',text:'Hay pérdidas consecutivas, pero todavía no alcanzan el criterio definido como mala racha.'};
  if(streak.type==='loss'&&severity.key==='unknown')return {title:'Racha perdedora sin criterio suficiente',text:'La secuencia está detectada, pero falta una referencia estadística suficiente o un umbral manual para llamarla mala racha.'};
  if(streak.disciplineState==='clean'){
    return streak.type==='loss'
      ?{title:'Mala racha con disciplina intacta',text:'El resultado es negativo, pero todas las operaciones de la racha están registradas como disciplinadas.'}
      :{title:'Buena racha con disciplina intacta',text:'El resultado es positivo y la disciplina registrada se mantiene íntegra.'};
  }
  if(streak.disciplineState==='deviation'){
    return streak.type==='loss'
      ?{title:'Mala racha con desviaciones registradas',text:'La racha combina pérdidas con al menos una desviación de disciplina registrada.'}
      :{title:'Buena racha con desviaciones registradas',text:'La racha es ganadora, aunque contiene desviaciones de disciplina registradas; conviene observarlas sin confundir resultado con proceso.'};
  }
  if(streak.disciplineState==='partial')return {title:`Racha ${type} con datos parciales`,text:'Parte de la disciplina está registrada y parte permanece sin informar.'};
  return {title:`Racha ${type} sin disciplina informada`,text:'Se describe el resultado, pero no hay datos suficientes para valorar el proceso.'};
}
function trJournalStreaksRender(){
  const plan=getCurrentPlan();if(!plan)return '';
  const env=trJournalPlanEnvironment(plan);if(env==='backtest')return '';
  trEnsurePlan(plan);
  const streaks=trStreaks(plan),current=streaks[streaks.length-1]||null,criterion=trStreakCriterion(plan);
  const losing=streaks.filter(s=>s.type==='loss'&&s.count>=2),winning=streaks.filter(s=>s.type==='win'&&s.count>=2);
  const badLosing=losing.filter(s=>['bad','outside'].includes(trStreakSeverity(s,criterion).key));
  const reading=trStreakReading(current,criterion);
  const currentText=current?`${current.count} ${current.type==='loss'?(current.count===1?'pérdida':'pérdidas'):(current.count===1?'ganancia':'ganancias')}`:'—';
  const currentMetric=current?calcMetricStats(current.operations,trJournalResultUnit,'net').sum:null;
  const currentResult=current?trJournalMetricText(currentMetric):'—';
  const relevant=streaks.filter(s=>s.count>=2).slice().reverse();
  const drawdowns=trDrawdownEpisodes(trEligibleOperations(currentOps()).filter(o=>o.tradingPlanId===plan.id));
  const recoveredDD=drawdowns.filter(d=>d.recovered),currentDD=drawdowns.find(d=>!d.recovered)||null;
  const maxDD=drawdowns.length?Math.min(...drawdowns.map(d=>d.depth)):0;
  const feed=relevant.length?relevant.map(streak=>{
    const kind=streak.type==='loss'?'Racha perdedora':'Racha ganadora';
    const result=trJournalMetricText(calcMetricStats(streak.operations,trJournalResultUnit,'net').sum),severity=trStreakSeverity(streak,criterion);
    return `<article class="streak-card ${streak.type}">
      <header class="streak-card-head"><div><strong>${kind} · ${streak.count}</strong><span>${esc(fmtDate(streak.first?.entryDate))} → ${esc(fmtDate(streak.last?.entryDate))}</span></div><b>${esc(result)}</b></header>
      <div class="streak-card-grid">
        <div><span>Clasificación</span><strong>${esc(severity.label)}</strong></div>
        <div><span>Disciplina</span><strong>${esc(trStreakDisciplineLabel(streak))}</strong></div>
        <div><span>Confianza personal</span><strong>${esc(trStreakConfidenceText(streak,plan,'personal'))}</strong></div>
        <div><span>Confianza en el sistema</span><strong>${esc(trStreakConfidenceText(streak,plan,'system'))}</strong></div>
      </div>
      <footer><span>${streak.sessions.length?`${streak.sessions.length} sesión${streak.sessions.length===1?'':'es'} vinculada${streak.sessions.length===1?'':'s'}`:'Sin sesión emocional vinculada'}</span></footer>
    </article>`;
  }).join(''):'<div class="empty">Todavía no hay rachas de 2 o más operaciones.</div>';
  const refText=criterion.referencePlan?`${planLabel(criterion.referencePlan)} · ${criterion.referenceOps.length} operaciones`:'Sin Backtesting vinculado';
  return `${pageHead('Diario emocional · Rachas y adaptación','Separa rachas consecutivas, malas rachas definidas y drawdown real del Trading Plan.',trJournalMetricSwitch())}
    ${activePlanBanner()}
    <div class="streak-kpis">
      ${kpi('Racha actual',currentText,current?trStreakSeverity(current,criterion).label:'sin datos')}
      ${kpi('Resultado de la racha',currentResult,current?'acumulado':'sin datos')}
      ${kpi('Rachas perdedoras ≥2',losing.length,`${badLosing.length} calificadas como mala racha`)}
      ${kpi('Rachas ganadoras ≥2',winning.length,'histórico del TP')}
    </div>
    <section class="card panel streak-criterion"><div class="panel-title"><div><h3>Criterio de mala racha</h3><small>${esc(refText)}</small></div><button class="btn small" data-tr-action-click="emotionalStreakCriteriaOpen">Configurar criterio</button></div><strong>${esc(trStreakCriterionLabel(criterion))}</strong><p>Una racha perdedora es un hecho descriptivo. Solo se etiqueta como <b>mala racha</b> cuando alcanza este criterio.</p></section>
    <section class="card panel streak-reading"><div class="panel-title"><div><h3>Lectura de la racha actual</h3><small>Resultado, criterio y disciplina se mantienen separados.</small></div></div><strong>${esc(reading.title)}</strong><p>${esc(reading.text)}</p></section>
    <section class="card panel streak-adaptation"><div class="panel-title"><div><h3>Drawdown real</h3><small>Caídas desde un máximo acumulado de la curva en ticks netos; no equivale a pérdidas consecutivas.</small></div></div>
      <div class="streak-adaptation-grid">
        <div><span>Episodios de drawdown</span><strong>${drawdowns.length}</strong></div>
        <div><span>Recuperados</span><strong>${recoveredDD.length}</strong></div>
        <div><span>Máximo drawdown</span><strong>${metricStatText(maxDD,'ticks')}</strong></div>
        <div><span>Drawdown actual</span><strong>${currentDD?metricStatText(currentDD.depth,'ticks'):'0.0t'}</strong></div>
      </div>
    </section>
    <section class="card panel streak-history"><div class="panel-title"><div><h3>Historial de rachas</h3><small>Solo episodios de 2 o más operaciones consecutivas con el mismo signo.</small></div><span>${relevant.length} episodios</span></div><div class="streak-feed">${feed}</div></section>`;
}

function trJournalNotesRender(){
  const plan=getCurrentPlan();if(!plan)return '';
  const env=trJournalPlanEnvironment(plan);if(env==='backtest')return '';
  trEnsurePlan(plan);
  if(trNotesFilter.planId!==plan.id){trNotesFilter.planId=plan.id;trNotesFilter.period='all';trNotesFilter.value='';trNotesFilter.kind='all';trNotesFilter.query='';}
  const allRows=[];
  for(const o of trEligibleOperations(currentOps())){
    const note=trText(o?.emotional?.notes);
    if(!note)continue;
    allRows.push({
      kind:'operation',at:o.entryDate||o.emotional?.updatedAt||'',title:'Operación',
      context:[o.contract,o.direction,o.setup].filter(Boolean).join(' · ')||'Operación sin contexto',
      label:'Nota emocional de la operación',text:note,operationId:o.id
    });
  }
  const textQuestions=new Map(trSessionQuestions(plan).filter(q=>q.type==='text').map(q=>[q.id,q.label]));
  for(const session of trSessions(plan)){
    for(const [phase,point,at] of [['Inicio',session.start,session.startedAt],['Cierre',session.end,session.endedAt]]){
      if(!point||!at)continue;
      const answers=point.answers||{};
      for(const [id,label] of textQuestions){
        const note=trText(answers[id]??point?.[id]??'');
        if(!note)continue;
        allRows.push({
          kind:'session',at,title:'Sesión · '+phase,
          context:(TR_SESSION_MODE_LABELS[session.mode]||session.mode)+' · '+label,
          label,text:note,sessionId:session.id,phase:phase.toLowerCase()
        });
      }
    }
  }
  const localDay=at=>{const d=new Date(at);if(Number.isNaN(d.getTime()))return String(at||'').slice(0,10);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const localWeek=at=>{const d=new Date(at);if(Number.isNaN(d.getTime()))return '';const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day+3);const first=new Date(x.getFullYear(),0,4);const firstDay=(first.getDay()+6)%7;first.setDate(first.getDate()-firstDay+3);const week=1+Math.round((x-first)/604800000);return x.getFullYear()+'-W'+String(week).padStart(2,'0');};
  const q=trNotesFilter.query.trim().toLowerCase();
  const rows=allRows.filter(row=>{
    if(trNotesFilter.kind!=='all'&&row.kind!==trNotesFilter.kind)return false;
    if(trNotesFilter.period==='day'&&trNotesFilter.value&&localDay(row.at)!==trNotesFilter.value)return false;
    if(trNotesFilter.period==='week'&&trNotesFilter.value&&localWeek(row.at)!==trNotesFilter.value)return false;
    if(q&&!([row.text,row.context,row.label,row.title].join(' ').toLowerCase().includes(q)))return false;
    return true;
  }).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  const operationCount=rows.filter(x=>x.kind==='operation').length,sessionCount=rows.filter(x=>x.kind==='session').length;
  const periodControl=trNotesFilter.period==='day'
    ?`<label class="filter-field"><span>Día</span><input class="input" type="date" value="${esc(trNotesFilter.value)}" data-notes-key="value" data-tr-action-change="emotionalNotesFilterChange"></label>`
    :trNotesFilter.period==='week'
      ?`<label class="filter-field"><span>Semana</span><input class="input" type="week" value="${esc(trNotesFilter.value)}" data-notes-key="value" data-tr-action-change="emotionalNotesFilterChange"></label>`
      :'';
  const filterActive=trNotesFilter.period!=='all'||trNotesFilter.kind!=='all'||!!trNotesFilter.query.trim();
  const filterBar=`<div class="emotional-notes-filter">
    <label class="filter-field"><span>Periodo</span><select class="select" data-notes-key="period" data-tr-action-change="emotionalNotesFilterChange"><option value="all" ${trNotesFilter.period==='all'?'selected':''}>Todo</option><option value="day" ${trNotesFilter.period==='day'?'selected':''}>Día concreto</option><option value="week" ${trNotesFilter.period==='week'?'selected':''}>Semana concreta</option></select></label>
    ${periodControl}
    <label class="filter-field"><span>Origen</span><select class="select" data-notes-key="kind" data-tr-action-change="emotionalNotesFilterChange"><option value="all" ${trNotesFilter.kind==='all'?'selected':''}>Todos</option><option value="session" ${trNotesFilter.kind==='session'?'selected':''}>Sesiones</option><option value="operation" ${trNotesFilter.kind==='operation'?'selected':''}>Operaciones</option></select></label>
    <label class="filter-field emotional-notes-search"><span>Buscar en notas</span><input class="input" value="${esc(trNotesFilter.query)}" placeholder="Texto, contexto, contrato…" data-notes-key="query" data-tr-action-change="emotionalNotesFilterChange"></label>
    <button class="btn small" data-tr-action-click="emotionalNotesFilterReset" ${filterActive?'':'disabled'}>Limpiar</button>
  </div>`;
  const feed=rows.length?rows.map(row=>`<article class="emotional-note-card">
    <header class="emotional-note-head">
      <div class="emotional-note-meta"><span class="emotional-note-kind">${row.kind==='operation'?'Operación':'Sesión'}</span><span>${esc(row.title)}</span><span>·</span><time>${esc(fmtDate(row.at))}</time></div>
      <div class="emotional-note-context">${esc(row.context)}</div>
    </header>
    <div class="emotional-note-body"><div class="emotional-note-label">${esc(row.label)}</div><div class="emotional-note-text">${esc(row.text)}</div></div>
    <footer class="emotional-note-foot">${row.kind==='operation'?'<button class="btn small" data-operation-id="'+esc(row.operationId)+'" data-tr-action-click="emotionalOpenOperation">Abrir diario</button>':'<button class="btn small" data-session-id="'+esc(row.sessionId)+'" data-tr-action-click="'+(row.phase==='cierre'?'emotionalSessionEditEnd':'emotionalSessionEditStart')+'">Abrir sesión</button>'}</footer>
  </article>`).join(''):'<div class="empty">No hay notas emocionales que coincidan con estos filtros.</div>';
  return `${pageHead('Diario emocional · Notas emocionales','Archivo de texto emocional procedente de sesiones y operaciones, separado de los apuntes técnicos.', '')}
    ${activePlanBanner()}
    <div class="emotional-notes-scope">Solo texto del Diario emocional procedente de sesiones y operaciones. Las constancias libres tienen su propio apartado.</div>
    ${filterBar}
    <div class="emotional-notes-summary"><span><strong>${rows.length}</strong> ${filterActive?'de '+allRows.length+' ':''}notas</span><span><strong>${sessionCount}</strong> de sesiones</span><span><strong>${operationCount}</strong> de operaciones</span></div>
    <section class="card panel emotional-notes-panel"><div class="panel-title emotional-notes-title"><div><h3>Historial de notas emocionales</h3><small>De más reciente a más antigua.</small></div></div><div class="emotional-notes-feed">${feed}</div></section>`;
}
function trJournalStatementsRender(){
  const plan=getCurrentPlan();if(!plan)return '';
  const env=trJournalPlanEnvironment(plan);if(env==='backtest')return '';
  trEnsurePlan(plan);
  const logs=trLogs(plan).slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  const feed=logs.length?logs.map(log=>{
    const text=trText(log.text)||trText(log.context)||trText(log.relatedReflection)||'Constancia histórica sin texto libre.';
    return `<article class="emotional-note-card">
      <header class="emotional-note-head"><div class="emotional-note-meta"><span class="emotional-note-kind">Constancia</span><time>${esc(fmtDate(log.at))}</time></div></header>
      <div class="emotional-note-body"><div class="emotional-note-text">${esc(text)}</div></div>
      <footer class="emotional-note-foot"><button class="btn small" data-log-id="${esc(log.id)}" data-tr-action-click="emotionalLogOpen">Editar</button></footer>
    </article>`;
  }).join(''):'<div class="empty">Todavía no has dejado ninguna constancia.</div>';
  return `${pageHead('Diario emocional · Dejar constancia','Un espacio de escritura libre, sin preguntas, métricas ni campos obligatorios adicionales.','<button class="btn primary" data-tr-action-click="emotionalLogOpen">+ Nueva constancia</button>')}
    ${activePlanBanner()}
    <div class="emotional-notes-scope">Escribe lo que quieras dejar registrado. Al guardar se asignan automáticamente la fecha y la hora.</div>
    <div class="emotional-notes-summary"><span><strong>${logs.length}</strong> constancias</span></div>
    <section class="card panel emotional-notes-panel"><div class="panel-title emotional-notes-title"><div><h3>Historial de constancias</h3><small>De más reciente a más antigua.</small></div></div><div class="emotional-notes-feed">${feed}</div></section>`;
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
  if(['journal','journalops','journalconfidence','journalstreaks','journalnotes','journalstatements'].includes(globalThis.TradingResearchCurrentViewReadContract?.current?.())){
    setTimeout(()=>{try{window.render?.();}catch(e){console.warn('[Trading Research · Emotional Journal boot repaint]',e);}},0);
  }
}catch{}
})();
/* ===== END V31.29 RUNTIME ===== */
