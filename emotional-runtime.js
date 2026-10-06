/* ===== V31.29 RUNTIME · Emotional Journal Foundation ===== */
(()=>{
'use strict';

const TR_EMOTIONAL_VERSION='31.29.0';
const registry=window.TradingResearchActions;
if(!registry||typeof registry!=='object')throw new Error('Emotional Journal: TradingResearchActions no disponible.');

const confidenceLevels=Object.freeze([
  ['very_low','Muy baja'],['low','Baja'],['normal','Normal'],['high','Alta'],['very_high','Muy alta']
]);
const simpleLevels=Object.freeze([
  ['low','Bajo'],['medium','Medio'],['high','Alto']
]);
const environments=Object.freeze([
  ['live','Live'],['sim','Sim'],['replay','Market Replay']
]);
let trEmotionalEnvironmentFilter='all';

function trEClone(v){return typeof clone==='function'?clone(v):JSON.parse(JSON.stringify(v));}
function trENow(){return new Date().toISOString();}
function trEEsc(v){return globalThis.TradingResearchContentEncodingContract?.html?.(v)??String(v??'');}
function trEUid(prefix='EJ'){return typeof uid==='function'?uid(prefix):`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;}
function trEPlanById(id){return globalThis.TradingResearchPlanReadContract?.byId?.(id)||null;}
function trECurrentPlan(){return globalThis.TradingResearchPlanReadContract?.current?.()||null;}
function trEPlanLabel(p){return p?(typeof planLabel==='function'?planLabel(p):`${p.name||'Plan'} · ${p.version||''}`):'Sin Trading Plan';}
function trELayer(o){return globalThis.TradingResearchOperationSemanticsContract?.layer?.(o)||'unclassified';}
function trEEligible(o){return trELayer(o)!=='backtest';}
function trEEnvironment(o){
  const layer=trELayer(o);
  return ['live','sim','replay'].includes(layer)?layer:(layer==='backtest'?'backtest':'unclassified');
}
function trEEnvironmentLabel(value){return environments.find(x=>x[0]===value)?.[1]||(value==='unclassified'?'Sin clasificar':value||'—');}
function trELevelLabel(value,kind='simple'){
  const rows=kind==='confidence'?confidenceLevels:simpleLevels;
  return rows.find(x=>x[0]===value)?.[1]||'—';
}
function trEBlankJournal(){return {schemaVersion:1,sessions:[],entries:[],streakEpisodes:[],weeklyReviews:[]};}
function trENormalizePoint(raw={}){
  const confidence=new Set(confidenceLevels.map(x=>x[0]));
  const simple=new Set(simpleLevels.map(x=>x[0]));
  const cv=v=>confidence.has(String(v||''))?String(v):null;
  const sv=v=>simple.has(String(v||''))?String(v):null;
  return {
    confidencePersonal:cv(raw.confidencePersonal),
    confidenceSystem:cv(raw.confidenceSystem),
    stress:sv(raw.stress),
    focus:sv(raw.focus),
    fatigue:sv(raw.fatigue),
    emotionalWear:sv(raw.emotionalWear),
    emotion:String(raw.emotion||''),
    note:String(raw.note||'')
  };
}
function trENormalizeSession(raw={}){
  const environment=['live','sim','replay'].includes(raw.environment)?raw.environment:'live';
  const startedAt=String(raw.startedAt||raw.createdAt||trENow());
  const endedAt=String(raw.endedAt||'');
  return {
    id:String(raw.id||trEUid('EJS')),
    schemaVersion:1,
    environment,
    tradingPlanId:String(raw.tradingPlanId||''),
    tradingPlanSnapshot:raw.tradingPlanSnapshot&&typeof raw.tradingPlanSnapshot==='object'?trEClone(raw.tradingPlanSnapshot):null,
    startedAt,
    endedAt,
    start:trENormalizePoint(raw.start||{}),
    end:endedAt?trENormalizePoint(raw.end||{}):trENormalizePoint({}),
    createdAt:String(raw.createdAt||startedAt),
    updatedAt:String(raw.updatedAt||raw.createdAt||startedAt)
  };
}
function trEEnsureJournal(){
  const raw=state.emotionalJournal&&typeof state.emotionalJournal==='object'?state.emotionalJournal:trEBlankJournal();
  state.emotionalJournal={
    schemaVersion:1,
    sessions:Array.isArray(raw.sessions)?raw.sessions.map(trENormalizeSession):[],
    entries:Array.isArray(raw.entries)?raw.entries:[],
    streakEpisodes:Array.isArray(raw.streakEpisodes)?raw.streakEpisodes:[],
    weeklyReviews:Array.isArray(raw.weeklyReviews)?raw.weeklyReviews:[]
  };
  return state.emotionalJournal;
}
function trEJournal(){return state.emotionalJournal&&typeof state.emotionalJournal==='object'?state.emotionalJournal:trEBlankJournal();}
function trESessionById(id){return (trEJournal().sessions||[]).find(x=>String(x.id)===String(id))||null;}
function trEPlanSnapshot(p){
  if(!p)return null;
  return {id:p.id||'',familyId:p.familyId||'',name:p.name||'',familyName:p.familyName||'',version:p.version||'',planEnvironment:p.planEnvironment||'unclassified',capturedAt:trENow()};
}
function trESessionPlanLabel(s){
  const p=trEPlanById(s.tradingPlanId);
  if(p)return trEPlanLabel(p);
  const snap=s.tradingPlanSnapshot;
  if(snap)return `${snap.name||snap.familyName||'TP histórico'} · ${snap.version||''}`.trim();
  return 'Sin Trading Plan';
}
function trESessionOps(s){return (state.operations||[]).filter(o=>String(o.journalSessionId||'')===String(s.id));}
function trEDatetimeLocal(iso){
  if(!iso)return '';
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function trEIsoFromLocal(value){
  if(!value)return '';
  const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString();
}
function trESelect(name,label,rows,current='',blank='— Sin informar —'){
  return `<label class="field"><span>${trEEsc(label)}</span><select id="f-${trEEsc(name)}" name="${trEEsc(name)}" class="select"><option value="">${trEEsc(blank)}</option>${rows.map(([v,l])=>`<option value="${trEEsc(v)}" ${String(v)===String(current||'')?'selected':''}>${trEEsc(l)}</option>`).join('')}</select></label>`;
}
function trEEmotionOptions(plan,current=''){
  const configured=Array.isArray(plan?.emotionConfig?.emotions)?plan.emotionConfig.emotions:[];
  const values=[...new Set(configured.map(String).filter(Boolean))];
  if(current&&!values.includes(current))values.unshift(current);
  return values.map(v=>[v,v]);
}
function trEPointForm(prefix,title,point,plan){
  return `<div class="form-section"><h4>${trEEsc(title)}</h4><div class="form-grid">
    ${trESelect(prefix+'-confidence-personal','Confianza personal',confidenceLevels,point.confidencePersonal)}
    ${trESelect(prefix+'-confidence-system','Confianza en el sistema',confidenceLevels,point.confidenceSystem)}
    ${trESelect(prefix+'-stress','Estrés',simpleLevels,point.stress)}
    ${trESelect(prefix+'-focus','Foco',simpleLevels,point.focus)}
    ${trESelect(prefix+'-fatigue','Fatiga',simpleLevels,point.fatigue)}
    ${trESelect(prefix+'-wear','Desgaste emocional',simpleLevels,point.emotionalWear)}
    ${trESelect(prefix+'-emotion','Emoción predominante',trEEmotionOptions(plan,point.emotion),point.emotion)}
    <label class="field span2"><span>Nota opcional</span><textarea id="f-${prefix}-note" name="${prefix}-note" class="input">${trEEsc(point.note||'')}</textarea></label>
  </div></div>`;
}
function trEOpenSessionModal(id=''){
  const existing=id?trESessionById(id):null;
  const current=trECurrentPlan();
  const s=existing||trENormalizeSession({environment:'live',tradingPlanId:current?.id||'',tradingPlanSnapshot:trEPlanSnapshot(current),startedAt:trENow()});
  const plan=trEPlanById(s.tradingPlanId)||current;
  const planOptions=[['','Sin Trading Plan'],...(state.tradingPlans||[]).filter(p=>p.status!=='archived'||p.id===s.tradingPlanId).map(p=>[p.id,trEPlanLabel(p)])];
  const body=`<form id="emotional-session-form" data-tr-onsubmit="return false">
    <input type="hidden" name="session-id" value="${trEEsc(existing?.id||'')}">
    <div class="form-section"><h4>Sesión</h4><div class="form-grid">
      ${trESelect('session-environment','Entorno',environments,s.environment,'Selecciona entorno')}
      ${trESelect('session-plan','Trading Plan',planOptions,s.tradingPlanId,'Sin Trading Plan')}
      <label class="field"><span>Inicio</span><input id="f-session-started" name="session-started" class="input" type="datetime-local" value="${trEEsc(trEDatetimeLocal(s.startedAt))}"></label>
      <label class="field"><span>Fin · opcional</span><input id="f-session-ended" name="session-ended" class="input" type="datetime-local" value="${trEEsc(trEDatetimeLocal(s.endedAt))}"></label>
    </div><div class="help">Backtesting no aparece: el Diario Emocional se aplica a Live, Sim y Market Replay. Un campo vacío significa “sin dato”, nunca “bajo”.</div></div>
    ${trEPointForm('start','Estado al comenzar',s.start,plan)}
    ${trEPointForm('end','Estado al terminar · solo si cierras la sesión',s.end,plan)}
  </form>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(existing?'Editar sesión emocional':'Nueva sesión emocional',body,`<button class="btn" data-tr-onclick="closeModal()">Cancelar</button><button class="btn primary" data-tr-action-click="emotionalSaveSession">Guardar sesión</button>`));
}
function trEReadPoint(fd,prefix){
  const g=n=>String(formDataValue(fd,n)||'');
  return trENormalizePoint({
    confidencePersonal:g(prefix+'-confidence-personal'),
    confidenceSystem:g(prefix+'-confidence-system'),
    stress:g(prefix+'-stress'),
    focus:g(prefix+'-focus'),
    fatigue:g(prefix+'-fatigue'),
    emotionalWear:g(prefix+'-wear'),
    emotion:g(prefix+'-emotion'),
    note:g(prefix+'-note')
  });
}
function trESaveSession(){
  const form=document.getElementById('emotional-session-form');if(!form)return;
  const fd=formDataFrom(form),g=n=>String(formDataValue(fd,n)||'');
  const id=g('session-id'),environment=g('session-environment');
  if(!['live','sim','replay'].includes(environment))return alert('Selecciona Live, Sim o Market Replay.');
  const startedAt=trEIsoFromLocal(g('session-started'));if(!startedAt)return alert('Indica una fecha/hora de inicio válida.');
  const endedAt=trEIsoFromLocal(g('session-ended'));
  if(endedAt&&new Date(endedAt)<new Date(startedAt))return alert('El fin de la sesión no puede ser anterior al inicio.');
  const plan=trEPlanById(g('session-plan'));
  const existing=id?trESessionById(id):null;
  const item=trENormalizeSession({
    ...(existing||{}),
    id:existing?.id||trEUid('EJS'),
    environment,
    tradingPlanId:plan?.id||'',
    tradingPlanSnapshot:plan?trEPlanSnapshot(plan):(existing?.tradingPlanSnapshot||null),
    startedAt,
    endedAt,
    start:trEReadPoint(fd,'start'),
    end:endedAt?trEReadPoint(fd,'end'):{},
    createdAt:existing?.createdAt||trENow(),
    updatedAt:trENow()
  });
  const run=()=>{
    trEEnsureJournal();
    const rows=state.emotionalJournal.sessions||[],idx=rows.findIndex(x=>String(x.id)===String(item.id));
    if(idx>=0)rows[idx]=item;else rows.push(item);
    persist();closeModal();render();
  };
  if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.command)return TRDomainStore.command('emotional.session.save',run,{persist:true,render:true});
  return run();
}
function trEDeleteSession(id){
  const s=trESessionById(id);if(!s)return;
  const linked=trESessionOps(s).length;
  if(!confirm(`¿Eliminar esta sesión emocional?${linked?`\n\nTiene ${linked} operación(es) vinculada(s). La operación se conservará y solo perderá el vínculo con la sesión.`:''}`))return;
  const run=()=>{
    state.emotionalJournal.sessions=(state.emotionalJournal.sessions||[]).filter(x=>String(x.id)!==String(id));
    for(const o of state.operations||[])if(String(o.journalSessionId||'')===String(id))o.journalSessionId='';
    persist();render();
  };
  if(typeof TRDomainStore!=='undefined'&&TRDomainStore?.command)return TRDomainStore.command('emotional.session.delete',run,{persist:true,render:true});
  return run();
}
function trESessionCard(s){
  const linked=trESessionOps(s).length,closed=!!s.endedAt,start=s.start||{},end=s.end||{};
  return `<article class="compliance-rule-card"><div class="compliance-rule-main">
    <div class="compliance-rule-tags"><span class="badge">${trEEsc(trEEnvironmentLabel(s.environment))}</span><span class="badge ${closed?'win':''}">${closed?'Cerrada':'En curso'}</span><span class="badge">${linked} trade(s)</span></div>
    <strong>${trEEsc(typeof fmtDate==='function'?fmtDate(s.startedAt):s.startedAt)}</strong>
    <p>${trEEsc(trESessionPlanLabel(s))}</p>
    <small>Inicio · confianza personal ${trEEsc(trELevelLabel(start.confidencePersonal,'confidence'))} · sistema ${trEEsc(trELevelLabel(start.confidenceSystem,'confidence'))} · estrés ${trEEsc(trELevelLabel(start.stress))} · desgaste ${trEEsc(trELevelLabel(start.emotionalWear))}</small>
    ${closed?`<small>Fin · confianza personal ${trEEsc(trELevelLabel(end.confidencePersonal,'confidence'))} · sistema ${trEEsc(trELevelLabel(end.confidenceSystem,'confidence'))} · estrés ${trEEsc(trELevelLabel(end.stress))} · desgaste ${trEEsc(trELevelLabel(end.emotionalWear))}</small>`:''}
  </div><div class="compliance-rule-actions"><button class="btn small" data-session-id="${trEEsc(s.id)}" data-tr-action-click="emotionalEditSession">Editar</button><button class="btn small danger" data-session-id="${trEEsc(s.id)}" data-tr-action-click="emotionalDeleteSession">Eliminar</button></div></article>`;
}
function trESessionsPanel(){
  const all=trEJournal().sessions||[];
  const rows=all.filter(s=>trEmotionalEnvironmentFilter==='all'||s.environment===trEmotionalEnvironmentFilter).slice().sort((a,b)=>String(b.startedAt||'').localeCompare(String(a.startedAt||'')));
  const counts=Object.fromEntries(environments.map(([id])=>[id,all.filter(s=>s.environment===id).length]));
  return `<section class="card panel"><div class="panel-title"><div><h3>Sesiones emocionales</h3><small>Una sesión puede existir aunque no haya ninguna operación. Backtesting queda fuera del Diario.</small></div><button class="btn primary small" data-tr-action-click="emotionalOpenSession">+ Nueva sesión</button></div>
    <div class="chip-row"><button class="filter-chip ${trEmotionalEnvironmentFilter==='all'?'active':''}" data-environment="all" data-tr-action-click="emotionalFilterEnvironment">Todas</button>${environments.map(([id,label])=>`<button class="filter-chip ${trEmotionalEnvironmentFilter===id?'active':''}" data-environment="${id}" data-tr-action-click="emotionalFilterEnvironment">${trEEsc(label)} · ${counts[id]||0}</button>`).join('')}</div>
    ${rows.length?rows.slice(0,20).map(trESessionCard).join(''):'<div class="empty">Todavía no hay sesiones emocionales registradas.</div>'}
  </section>`;
}

/* Backtesting is the only operation layer excluded from emotional coverage. */
const trEJournalFilteredOpsBase=typeof journalFilteredOps==='function'?journalFilteredOps:null;
if(trEJournalFilteredOpsBase)journalFilteredOps=function(){
  return trEJournalFilteredOpsBase().filter(o=>trEEligible(o)&&(trEmotionalEnvironmentFilter==='all'||trEEnvironment(o)===trEmotionalEnvironmentFilter));
};

/* Goal coverage: denominator is execution-only; backtests are N/A, not pending. */
const trEGoalEvalBase=typeof goalEval==='function'?goalEval:null;
if(trEGoalEvalBase)goalEval=function(goal){
  if(goal?.metric!=='journal')return trEGoalEvalBase(goal);
  const ops=(typeof goalOps==='function'?goalOps(goal):[]).filter(trEEligible),target=Number(goal.target)||0;
  const done=ops.filter(hasEmotionalEntry).length,hasData=!!ops.length,value=ops.length?done/ops.length*100:0;
  return {value,hasData,display:hasData?`${value.toFixed(1)}%`:'—',targetDisplay:`${target.toFixed(1)}%`,direction:'min',met:hasData&&value>=target,progress:target?Math.max(0,Math.min(100,value/target*100)):100};
};

/* Data Quality uses N/A semantics for backtesting journal coverage. */
const trEDqCoverageDefsBase=typeof dqCoverageDefs==='function'?dqCoverageDefs:null;
if(trEDqCoverageDefsBase)dqCoverageDefs=function(ops){
  const defs=trEDqCoverageDefsBase(ops),eligible=(ops||[]).filter(trEEligible),done=eligible.filter(hasEmotionalEntry),idx=defs.findIndex(x=>x.id==='journal');
  if(idx>=0)defs[idx]={...defs[idx],ok:done.length,total:eligible.length,pct:eligible.length?done.length/eligible.length*100:100,missingIds:eligible.filter(o=>!hasEmotionalEntry(o)).map(o=>o.id),note:'Diario emocional sobre ejecución; Backtesting está excluido.'};
  return defs;
};
const trEDqV28CoverageBase=typeof dqV28Coverage==='function'?dqV28Coverage:null;
if(trEDqV28CoverageBase)dqV28Coverage=function(ops,key){
  if(!['journal','focus','stress','behavior','emotion'].includes(key))return trEDqV28CoverageBase(ops,key);
  const eligible=(ops||[]).filter(trEEligible),total=eligible.length;
  let ok=0,label='Diario',focus='journal';
  if(key==='journal'){ok=eligible.filter(hasEmotionalEntry).length;label='Diario';}
  else if(key==='focus'){ok=eligible.filter(o=>Number(o?.emotional?.focus)>=1&&Number(o?.emotional?.focus)<=5).length;label='Foco';}
  else if(key==='stress'){ok=eligible.filter(o=>Number(o?.emotional?.stress)>=1&&Number(o?.emotional?.stress)<=5).length;label='Estrés';}
  else if(key==='behavior'){ok=eligible.filter(hasEmotionalEntry).length;label='Conducta';}
  else if(key==='emotion'){ok=eligible.filter(hasEmotionalEntry).length;label='Emoción';}
  return {key,label,ok,total,pct:total?ok/total*100:100,focus};
};
const trEProcessSummaryBase=typeof v313ProcessSummary==='function'?v313ProcessSummary:null;
if(trEProcessSummaryBase)v313ProcessSummary=function(plan,ops){
  const out=trEProcessSummaryBase(plan,ops),eligible=(ops||[]).filter(trEEligible),done=eligible.filter(hasEmotionalEntry);
  out.journalCoverage=eligible.length?done.length/eligible.length*100:100;
  return out;
};

function trERenderJournal(){
  const p=trECurrentPlan(),all=currentOps(),backtests=all.filter(o=>trELayer(o)==='backtest').length,ops=journalFilteredOps(),st=journalStats(ops),em=p?.emotionConfig?.emotions||[],bh=p?.emotionConfig?.behaviors||[];
  const sel=(id,label,arr,val)=>`<label class="filter-field"><span>${label}</span><select id="${id}" class="select" data-tr-onchange="readJournalFilters()"><option value="">Todos</option>${arr.map(x=>`<option value="${trEEsc(typeof x==='object'?x.value:x)}" ${String(val)===String(typeof x==='object'?x.value:x)?'selected':''}>${trEEsc(typeof x==='object'?x.label:x)}</option>`).join('')}</select></label>`;
  const eligibleAll=all.filter(trEEligible),done=eligibleAll.filter(hasEmotionalEntry).length,coverage=eligibleAll.length?done/eligibleAll.length*100:0;
  const envCounts={
    live:eligibleAll.filter(o=>trEEnvironment(o)==='live').length,
    sim:eligibleAll.filter(o=>trEEnvironment(o)==='sim').length,
    replay:eligibleAll.filter(o=>trEEnvironment(o)==='replay').length
  };
  return `${pageHead('Diario emocional','Registro de ejecución para Live, Sim y Market Replay. Backtesting queda fuera porque su finalidad es estadística, no emocional.',`<button class="btn primary" data-tr-action-click="emotionalOpenSession">+ Nueva sesión</button>`)}
    ${activePlanBanner()}
    ${backtests?`<div class="notice"><strong>Backtesting excluido:</strong> ${backtests} operación(es) del TP activo no cuentan como pendientes ni reducen la cobertura del Diario Emocional.</div>`:''}
    <div class="journal-kpis">${kpi('Sesiones',(trEJournal().sessions||[]).length,'Live · Sim · Replay')}${kpi('Cobertura',eligibleAll.length?pct(coverage):'—',eligibleAll.length?`${done}/${eligibleAll.length} operaciones de ejecución`:'sin operaciones de ejecución')}${kpi('Live',envCounts.live,'operaciones')}${kpi('Sim',envCounts.sim,'operaciones')}${kpi('Replay',envCounts.replay,'operaciones')}</div>
    ${trESessionsPanel()}
    <section class="card filter-hub"><div class="filter-hub-top"><div><h3>Diario por operación</h3><p>El registro por trade se mantiene compatible; esta primera fase añade sesiones y corrige la elegibilidad.</p></div><button class="btn small" data-tr-onclick="trLegacyStateCommand('journal-reset')">Limpiar</button></div><div class="filter-grid"><label class="filter-field wide"><span>Buscar</span><input id="journalQ" class="input" value="${trEEsc(journalViewState.q)}" placeholder="Setup, contrato, notas…" data-tr-onchange="readJournalFilters()"></label>${sel('journalEmotion','Emoción',em,journalViewState.emotion)}${sel('journalBehavior','Comportamiento',bh,journalViewState.behavior)}${sel('journalDiscipline','Disciplina',[{value:'yes',label:'Disciplinada'},{value:'no',label:'No disciplinada'}],journalViewState.discipline)}${sel('journalStatus','Estado del diario',[{value:'complete',label:'Completado'},{value:'pending',label:'Pendiente'}],journalViewState.status)}</div></section>
    <div class="journal-kpis">${kpi('Trades visibles',ops.length,'Backtesting excluido')}${kpi('Diario completado',ops.length?pct(st.completion):'—',`${st.complete}/${ops.length}`)}${kpi('Disciplina',ops.length?pct(st.discipline):'—','sobre selección')}</div>
    <div class="grid two journal-charts"><section class="card panel"><div class="panel-title"><h3>Resultados por emoción</h3><span>Expectancy R neta</span></div>${emotionalBreakdown(ops,'emotion')}</section><section class="card panel"><div class="panel-title"><h3>Resultados por comportamiento</h3><span>Expectancy R neta</span></div>${emotionalBreakdown(ops,'behavior')}</section></div>
    <section class="card panel"><div class="panel-title"><div><h3>Operaciones + diario</h3><small>Solo ejecución. Las operaciones de Backtesting no aparecen como pendientes emocionales.</small></div><span>${ops.length} operaciones</span></div>${journalTable(ops)}</section>`;
}

registry.emotionalOpenSession=function(){trEOpenSessionModal('');};
registry.emotionalEditSession=function(){trEOpenSessionModal(String(this.dataset.sessionId||''));};
registry.emotionalDeleteSession=function(){trEDeleteSession(String(this.dataset.sessionId||''));};
registry.emotionalSaveSession=function(){return trESaveSession();};
registry.emotionalFilterEnvironment=function(){trEmotionalEnvironmentFilter=String(this.dataset.environment||'all');render();};

Object.defineProperty(globalThis,'TradingResearchEmotionalJournalDomain',{value:Object.freeze({
  version:TR_EMOTIONAL_VERSION,
  eligibleOperation:trEEligible,
  environment:trEEnvironment,
  normalizeSession:trENormalizeSession,
  sessionById:trESessionById,
  journal:trEJournal,
  confidenceLevels,
  simpleLevels
}),writable:false,enumerable:false,configurable:false});
Object.defineProperty(globalThis,'TradingResearchEmotionalJournalPresentationContract',{value:Object.freeze({render:trERenderJournal}),writable:false,enumerable:false,configurable:false});

if(!state.emotionalJournal)trEEnsureJournal();
render();
})();
