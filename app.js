const STORAGE_KEY = 'tradingResearchState_v4';
const LEGACY_V3_KEY = 'tradingResearchState_v3';
const LEGACY_V2_KEY = 'tradingResearchState_v2';
const LEGACY_V1_KEY = 'tradingResearchState_v1';

const basePlanConfig = {
  setups: ['Continuación','Estructura','Facilidad','Giro'],
  vd: ['RECH','A1','B3','ENV'],
  nr: ['Max Europe','Min Europe','Max America','Min America','Dynamic Pivot','Punto de Control','GAP'],
  hypotheses: [
    {id:'H1', name:'Hipótesis 1', description:''},
    {id:'H2', name:'Hipótesis 2', description:''},
    {id:'H3', name:'Hipótesis 3', description:''}
  ],
  discretionaryTargets: ['Soporte / resistencia próxima','Vela contraria','Pivote / nivel de liquidez'],
  riskStrategies: [
    {id:'R1', name:'Estrategia 1', atrMin:0, atrMax:0.5, instrumentId:'I_CL', active:true, lots:[
      {id:'L1', quantity:1, stopTicks:10, targetType:'ticks', targetTicks:20, targetRule:''}
    ]},
    {id:'R2', name:'Estrategia 2', atrMin:0.51, atrMax:1.0, instrumentId:'I_MCL', active:true, lots:[
      {id:'L1', quantity:1, stopTicks:20, targetType:'ticks', targetTicks:40, targetRule:''},
      {id:'L2', quantity:1, stopTicks:20, targetType:'ticks', targetTicks:40, targetRule:''}
    ]},
    {id:'R3', name:'Estrategia 3', atrMin:1.1, atrMax:1.5, instrumentId:'I_MCL', active:true, lots:[
      {id:'L1', quantity:1, stopTicks:30, targetType:'ticks', targetTicks:60, targetRule:''}
    ]}
  ],
  emotionConfig: {
    emotions:['Calma','Confianza','Concentración','Duda','Ansiedad','Prisa','Miedo','Frustración','Euforia','Cansancio'],
    behaviors:['Ejecución limpia','Duda / bloqueo','FOMO','Entrada impulsiva','Sobreoperativa','Revenge trading','Mover stop','Salir antes de tiempo','Aguantar de más','Distracción']
  },
  riskManagement: {
    daily:{maxConsecutiveLosses:2,maxLossValue:0,maxLossUnit:'usd',maxLossBasis:'net',stopAfterWinThenLoss:false},
    weekly:{maxLosingDays:0,maxConsecutiveLosses:0,maxLossValue:0,maxLossUnit:'usd',maxLossBasis:'net'}
  },
  visualReferences: []
};

const defaultState = {
  operations: [],
  opportunities: [],
  importBatches: [],
  settings: {
    instruments: [
      {id:'I_MCL', symbol:'MCL', name:'Micro Crude Oil', tickSize:0.01, tickValue:1, commission:1.60, currency:'USD', active:true},
      {id:'I_CL', symbol:'CL', name:'Crude Oil', tickSize:0.01, tickValue:10, commission:0, currency:'USD', active:true}
    ]
  },
  tradingPlans: [
    {
      id:'TP01_V1', familyName:'TP01', name:'TP01', version:'v1', description:'Plan principal migrado desde la configuración inicial.',
      status:'active', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      ...JSON.parse(JSON.stringify(basePlanConfig))
    }
  ],
  currentPlanId:'TP01_V1'
};

let state = loadState();
let currentView = 'dashboard';
let editingId = null;
let editingInstrumentId = null;
let editingRiskId = null;
let editingPlanId = null;
let cloningPlanId = null;
let pendingImportPlanId = null;
let pendingImportPreview = null;

// V5 · Estado de análisis visual (no altera el dataset)
let opsViewState = {
  unit:'r', basis:'gross', q:'', dateFrom:'', dateTo:'', timeFrom:'', timeTo:'', days:[], month:'', year:'',
  direction:'', setup:'', vd:'', nr:'', hypothesis:'', risk:'', source:'', result:'', contract:'', block:'', dimension:'setup',
  emotion:'', behavior:'', emotionStatus:'', riskPolicy:'raw', modules:['equity','distribution','heatmap','breakdown','table']
};
let journalViewState={q:'',emotion:'',behavior:'',discipline:'',status:''};
let blockViewState = {unit:'r', basis:'gross', commissionUnit:'usd'};
let configTab='instruments';
let galleryViewState={q:'',setup:'',vd:'',nr:'',result:'',direction:'',label:'',context:''};
let gallerySelected=[];
let editingVisualReferenceId=null;

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function uid(p){ return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`; }
function esc(s){ return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function money(v,currency='USD'){ try{return new Intl.NumberFormat('es-ES',{style:'currency',currency:currency||'USD',maximumFractionDigits:2}).format(Number(v)||0)}catch{return `${Number(v||0).toFixed(2)} ${currency||''}`;} }
const pct = v => `${(Number(v)||0).toFixed(1)}%`;
const fmtDate = iso => { if(!iso)return '—'; const d=new Date(iso); return isNaN(d)?iso:d.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}); };
const fmtDateOnly = iso => { if(!iso)return '—'; const d=new Date(iso); return isNaN(d)?iso:d.toLocaleDateString('es-ES'); };

function makeBlankPlan(meta={}){
  return {
    id:meta.id||uid('TP'), familyName:meta.familyName||meta.name||'Nuevo plan', name:meta.name||'Nuevo plan', version:meta.version||'v1',
    description:meta.description||'', status:meta.status||'active', createdAt:meta.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString(),
    setups:[], vd:[], nr:[], hypotheses:[], discretionaryTargets:[], riskStrategies:[],
    emotionConfig:clone(basePlanConfig.emotionConfig), riskManagement:clone(basePlanConfig.riskManagement), visualReferences:[]
  };
}
function clonePlanForVersion(source, meta={}){
  const p=clone(source);
  p.id=uid('TP');
  p.familyName=meta.familyName||source.familyName||source.name;
  p.name=meta.name||source.name;
  p.version=meta.version||nextVersionLabel(source.version);
  p.description=meta.description??source.description;
  p.status='active'; p.createdAt=new Date().toISOString(); p.updatedAt=p.createdAt;
  const riskMap=new Map();
  p.riskStrategies=(p.riskStrategies||[]).map(r=>{const old=r.id,nid=uid('R');riskMap.set(old,nid);return {...r,id:nid,lots:(r.lots||[]).map(l=>({...l,id:uid('L')}))};});
  return p;
}
function nextVersionLabel(v){const m=String(v||'').match(/^(.*?)(\d+)$/);if(!m)return 'v2';return `${m[1]}${Number(m[2])+1}`;}
function normalizeRiskStrategy(r, instruments){
  if(r.lots && Array.isArray(r.lots)){
    return {...r,id:r.id||uid('R'),active:r.active!==false,instrumentId:r.instrumentId||instruments.find(i=>i.symbol===r.instrument)?.id||instruments[0]?.id||'',lots:r.lots.map((l,i)=>({id:l.id||uid('L'),quantity:Number(l.quantity)||1,stopTicks:Number(l.stopTicks)||0,targetType:l.targetType==='discretionary'?'discretionary':'ticks',targetTicks:Number(l.targetTicks)||0,targetRule:l.targetRule||''}))};
  }
  const qty=Math.max(1,Number(r.contracts)||1),lots=[];
  for(let i=0;i<qty;i++) lots.push({id:uid('L'),quantity:1,stopTicks:Number(r.stopTicks)||0,targetType:(String(r.targetMode||'').toLowerCase().includes('discre')||String(r.targetMode||'').toLowerCase().includes('liqu'))?'discretionary':'ticks',targetTicks:(Number(r.stopTicks)||0)*(Number(r.targetR)||2),targetRule:(String(r.targetMode||'').toLowerCase().includes('discre')||String(r.targetMode||'').toLowerCase().includes('liqu'))?(r.targetText||r.targetMode||''):''});
  return {id:r.id||uid('R'),name:r.name||'Estrategia',atrMin:Number(r.atrMin)||0,atrMax:Number(r.atrMax)||0,instrumentId:instruments.find(i=>i.symbol===r.instrument)?.id||instruments[0]?.id||'',active:r.active!==false,lots};
}
function normalizePlan(p,instruments){
  const out={...makeBlankPlan(p),...p};
  out.id=out.id||uid('TP'); out.familyName=out.familyName||out.name||'Plan'; out.name=out.name||out.familyName; out.version=out.version||'v1'; out.status=out.status==='archived'?'archived':'active';
  out.setups=Array.isArray(out.setups)?out.setups:[]; out.vd=Array.isArray(out.vd)?out.vd:[]; out.nr=Array.isArray(out.nr)?out.nr:[];
  out.hypotheses=Array.isArray(out.hypotheses)?out.hypotheses:[]; out.discretionaryTargets=Array.isArray(out.discretionaryTargets)?out.discretionaryTargets:[];
  out.riskStrategies=(Array.isArray(out.riskStrategies)?out.riskStrategies:[]).map(r=>normalizeRiskStrategy(r,instruments));
  out.emotionConfig={...clone(basePlanConfig.emotionConfig),...(out.emotionConfig||{})};
  out.emotionConfig.emotions=Array.isArray(out.emotionConfig.emotions)?out.emotionConfig.emotions:clone(basePlanConfig.emotionConfig.emotions);
  out.emotionConfig.behaviors=Array.isArray(out.emotionConfig.behaviors)?out.emotionConfig.behaviors:clone(basePlanConfig.emotionConfig.behaviors);
  out.riskManagement={...clone(basePlanConfig.riskManagement),...(out.riskManagement||{})};
  out.riskManagement.daily={...clone(basePlanConfig.riskManagement.daily),...(out.riskManagement.daily||{})};
  out.riskManagement.weekly={...clone(basePlanConfig.riskManagement.weekly),...(out.riskManagement.weekly||{})};
  out.visualReferences=Array.isArray(out.visualReferences)?out.visualReferences:[];
  return out;
}
function migrateLegacy(raw){
  const instruments=Array.isArray(raw?.settings?.instruments)&&raw.settings.instruments.length?raw.settings.instruments.map(i=>({...i,id:i.id||uid('I'),symbol:String(i.symbol||'').toUpperCase(),tickSize:Number(i.tickSize)||0,tickValue:Number(i.tickValue)||0,commission:Number(i.commission)||0,currency:i.currency||'USD',active:i.active!==false})):clone(defaultState.settings.instruments);
  const s=raw?.settings||{};
  const plan={id:'TP_MIGRATED_V1',familyName:'Plan migrado',name:'Plan migrado',version:'v1',description:'Configuración migrada automáticamente desde Trading Research V2.',status:'active',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),setups:Array.isArray(s.setups)?s.setups:clone(basePlanConfig.setups),vd:Array.isArray(s.vd)?s.vd:clone(basePlanConfig.vd),nr:Array.isArray(s.nr)?s.nr:clone(basePlanConfig.nr),hypotheses:Array.isArray(s.hypotheses)?s.hypotheses:clone(basePlanConfig.hypotheses),discretionaryTargets:Array.isArray(s.discretionaryTargets)?s.discretionaryTargets:clone(basePlanConfig.discretionaryTargets),emotionConfig:clone(basePlanConfig.emotionConfig),riskManagement:clone(basePlanConfig.riskManagement),riskStrategies:(Array.isArray(s.riskStrategies)?s.riskStrategies:clone(basePlanConfig.riskStrategies)).map(r=>normalizeRiskStrategy(r,instruments))};
  const planSnap=planSnapshot(plan);
  return {operations:(Array.isArray(raw?.operations)?raw.operations:[]).map(o=>({...o,tradingPlanId:plan.id,tradingPlanName:plan.name,tradingPlanVersion:plan.version,tradingPlanSnapshot:o.tradingPlanSnapshot||planSnap})),opportunities:Array.isArray(raw?.opportunities)?raw.opportunities:[],importBatches:[],settings:{instruments},tradingPlans:[plan],currentPlanId:plan.id};
}
function normalizeState(raw){
  if(!raw||typeof raw!=='object') return clone(defaultState);
  if(!Array.isArray(raw.tradingPlans)) return migrateLegacy(raw);
  const out=clone(defaultState);
  out.settings.instruments=Array.isArray(raw.settings?.instruments)&&raw.settings.instruments.length?raw.settings.instruments.map(i=>({...i,id:i.id||uid('I'),symbol:String(i.symbol||'').toUpperCase(),tickSize:Number(i.tickSize)||0,tickValue:Number(i.tickValue)||0,commission:Number(i.commission)||0,currency:i.currency||'USD',active:i.active!==false})):out.settings.instruments;
  out.tradingPlans=raw.tradingPlans.map(p=>normalizePlan(p,out.settings.instruments));
  if(!out.tradingPlans.length) out.tradingPlans=[normalizePlan(clone(defaultState.tradingPlans[0]),out.settings.instruments)];
  out.currentPlanId=out.tradingPlans.some(p=>p.id===raw.currentPlanId)?raw.currentPlanId:out.tradingPlans[0].id;
  out.operations=Array.isArray(raw.operations)?raw.operations.map(o=>({...o,tradingPlanId:o.tradingPlanId||out.currentPlanId})):[];
  out.opportunities=Array.isArray(raw.opportunities)?raw.opportunities:[];
  out.importBatches=Array.isArray(raw.importBatches)?raw.importBatches:[];
  return out;
}
function loadState(){
  try{
    const v4=localStorage.getItem(STORAGE_KEY); if(v4)return normalizeState(JSON.parse(v4));
    const legacy=localStorage.getItem(LEGACY_V3_KEY)||localStorage.getItem(LEGACY_V2_KEY)||localStorage.getItem(LEGACY_V1_KEY); return legacy?normalizeState(JSON.parse(legacy)):clone(defaultState);
  }catch(e){return clone(defaultState);}
}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function saveState(){persist();render();}

function getCurrentPlan(){return state.tradingPlans.find(p=>p.id===state.currentPlanId)||state.tradingPlans[0];}
function getPlan(id){return state.tradingPlans.find(p=>p.id===id);}
function planLabel(p){return p?`${p.name} · ${p.version}`:'Sin plan';}
function planSnapshot(p){if(!p)return null;return {id:p.id,familyName:p.familyName,name:p.name,version:p.version,description:p.description||'',capturedAt:new Date().toISOString()};}
function switchPlan(id){if(!getPlan(id))return;state.currentPlanId=id;persist();render();}
function currentOps(){return state.operations.filter(o=>o.tradingPlanId===state.currentPlanId);}
function getInstrument(id){return state.settings.instruments.find(i=>i.id===id);}
function getRisk(id,plan=getCurrentPlan()){return plan?.riskStrategies?.find(r=>r.id===id);}
function riskCalc(r){
  const inst=getInstrument(r?.instrumentId),lots=r?.lots||[];
  const contracts=lots.reduce((a,l)=>a+(Number(l.quantity)||0),0);
  const riskTickExposure=lots.reduce((a,l)=>a+(Number(l.quantity)||0)*(Number(l.stopTicks)||0),0);
  const riskUsd=riskTickExposure*(Number(inst?.tickValue)||0),commission=contracts*(Number(inst?.commission)||0);
  const fixedRewardTicks=lots.filter(l=>l.targetType==='ticks').reduce((a,l)=>a+(Number(l.quantity)||0)*(Number(l.targetTicks)||0),0);
  const fixedRewardUsd=fixedRewardTicks*(Number(inst?.tickValue)||0),hasVariable=lots.some(l=>l.targetType==='discretionary');
  return {inst,contracts,riskTickExposure,riskUsd,commission,fixedRewardTicks,fixedRewardUsd,hasVariable,fixedR:riskTickExposure?fixedRewardTicks/riskTickExposure:0};
}
function instrumentSnapshot(inst){if(!inst)return null;return {id:inst.id,symbol:inst.symbol,name:inst.name,tickSize:Number(inst.tickSize)||0,tickValue:Number(inst.tickValue)||0,commission:Number(inst.commission)||0,currency:inst.currency||'USD'};}
function strategySnapshot(r){if(!r)return null;return {id:r.id,name:r.name,atrMin:r.atrMin,atrMax:r.atrMax,instrumentId:r.instrumentId,lots:clone(r.lots||[]),instrument:instrumentSnapshot(getInstrument(r.instrumentId))};}

function calcStats(ops){
  const n=ops.length,wins=ops.filter(o=>o.result==='win').length,losses=ops.filter(o=>o.result==='loss').length;
  const rs=ops.map(o=>Number(o.rMultiple)||0),sumR=rs.reduce((a,b)=>a+b,0),gains=rs.filter(r=>r>0).reduce((a,b)=>a+b,0),lossesR=Math.abs(rs.filter(r=>r<0).reduce((a,b)=>a+b,0));
  let eq=0,peak=0,maxDD=0;const equity=[];for(const r of rs){eq+=r;peak=Math.max(peak,eq);maxDD=Math.min(maxDD,eq-peak);equity.push(eq)}
  return {n,wins,losses,winRate:n?wins/n*100:0,sumR,expectancy:n?sumR/n:0,pf:lossesR?gains/lossesR:0,maxDD,avgMfe:n?ops.reduce((a,o)=>a+(Number(o.mfe)||0),0)/n:0,avgMae:n?ops.reduce((a,o)=>a+(Number(o.mae)||0),0)/n:0,equity};
}
function resultClass(o){return o.result==='win'?'win':o.result==='loss'?'loss':'';}

// ---------- V5 · Motor de visualización / filtrado ----------
const DOW_LABELS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MONTH_LABELS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function inputDateValue(d){if(!(d instanceof Date)||isNaN(d))return '';const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function opMetricValue(o,unit='r',basis='gross'){
  const grossTicks=Number(o.resultTicks)||0,tv=Number(o.instrumentSnapshot?.tickValue)||0,commission=Number(o.commission)||0;
  if(unit==='ticks') return basis==='net' && tv ? grossTicks-(commission/tv) : grossTicks;
  if(unit==='usd') return basis==='net' ? (Number(o.pnlNet)||0) : (Number(o.pnlGross)||0);
  if(basis==='net') return Number(o.riskUsd)?(Number(o.pnlNet)||0)/Number(o.riskUsd):(Number(o.rMultiple)||0);
  return Number(o.rMultiple)||0;
}
function metricUnitLabel(unit){return unit==='ticks'?'ticks':unit==='usd'?'US$':'R';}
function formatMetric(v,unit,dec=2){v=Number(v)||0;if(unit==='usd')return `${v>=0?'+':''}${v.toFixed(2)} US$`;if(unit==='ticks')return `${v>=0?'+':''}${v.toFixed(dec)}t`;return `${v>=0?'+':''}${v.toFixed(dec)}R`;}
function calcMetricStats(ops,unit='r',basis='gross'){
  const vals=ops.map(o=>opMetricValue(o,unit,basis)),n=vals.length,winVals=vals.filter(v=>v>0),lossVals=vals.filter(v=>v<0),wins=winVals.length,losses=lossVals.length;
  const sum=vals.reduce((a,b)=>a+b,0),gain=winVals.reduce((a,b)=>a+b,0),lossAbs=Math.abs(lossVals.reduce((a,b)=>a+b,0));
  let eq=0,peak=0,trough=0,maxDD=0,maxDU=0;const equity=[];
  vals.forEach(v=>{eq+=v;peak=Math.max(peak,eq);trough=Math.min(trough,eq);maxDD=Math.min(maxDD,eq-peak);maxDU=Math.max(maxDU,eq-trough);equity.push(eq);});
  const avgWin=wins?gain/wins:0,avgLoss=losses?lossVals.reduce((a,b)=>a+b,0)/losses:0;
  const commissions=ops.reduce((a,o)=>a+(Number(o.commission)||0),0),netUsd=ops.reduce((a,o)=>a+(Number(o.pnlNet)||0),0),grossUsd=ops.reduce((a,o)=>a+(Number(o.pnlGross)||0),0);
  return {n,wins,losses,winRate:n?wins/n*100:0,sum,expectancy:n?sum/n:0,pf:lossAbs?gain/lossAbs:(gain?Infinity:0),maxDD,maxDU,equity,avgWin,avgLoss,maxWin:winVals.length?Math.max(...winVals):0,maxLoss:lossVals.length?Math.min(...lossVals):0,commissions,netUsd,grossUsd,payoff:avgLoss?Math.abs(avgWin/avgLoss):0};
}
function metricStatText(v,unit){return formatMetric(v,unit,unit==='ticks'?1:2);}
function lineChartSvg(values,W=800,H=220,compact=false){
  if(!values.length)return '<div class="empty">Sin datos para este gráfico.</div>';
  const min=Math.min(...values,0),max=Math.max(...values,0),range=(max-min)||1,pad=compact?3:8;
  const coords=values.map((v,i)=>`${pad+(i/Math.max(values.length-1,1))*(W-pad*2)},${pad+(H-pad*2)-((v-min)/range)*(H-pad*2)}`).join(' ');
  const zeroY=pad+(H-pad*2)-((0-min)/range)*(H-pad*2),area=`${pad},${H-pad} ${coords} ${W-pad},${H-pad}`;
  return `<svg class="${compact?'spark-svg':'equity-svg'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line class="axis" x1="${pad}" y1="${zeroY}" x2="${W-pad}" y2="${zeroY}"/><polygon class="area" points="${area}"/><polyline class="line" points="${coords}"/></svg>`;
}
function opBlockMap(){const m=new Map();[...currentOps()].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)).forEach((o,i)=>m.set(o.id,Math.floor(i/20)+1));return m;}
function uniqueSorted(arr){return [...new Set(arr.filter(v=>v!==undefined&&v!==null&&String(v).trim()!==''))].sort((a,b)=>String(a).localeCompare(String(b),'es',{numeric:true}));}
function readOpsFilters(){
  const val=id=>document.getElementById(id)?.value??'';
  Object.assign(opsViewState,{q:val('searchOps'),dateFrom:val('filterDateFrom'),dateTo:val('filterDateTo'),timeFrom:val('filterTimeFrom'),timeTo:val('filterTimeTo'),month:val('filterMonth'),year:val('filterYear'),direction:val('filterDirection'),setup:val('filterSetup'),vd:val('filterVD'),nr:val('filterNR'),hypothesis:val('filterHypothesis'),risk:val('filterRisk'),source:val('filterSource'),result:val('filterResult'),contract:val('filterContract'),block:val('filterBlock'),emotion:val('filterEmotion'),behavior:val('filterBehavior'),emotionStatus:val('filterEmotionStatus'),riskPolicy:val('filterRiskPolicy')||opsViewState.riskPolicy,dimension:val('filterDimension')||opsViewState.dimension});
}
function operationEmotionValues(o){const e=o.emotional||{};return [e.before,e.during,e.after].filter(Boolean);}
function hasEmotionalEntry(o){const e=o.emotional||{};return !!(e.before||e.during||e.after||e.notes||(e.behaviors||[]).length||Number(e.intensity)||Number(e.stress)||Number(e.focus)||Number(e.confidence)||Number(e.impulse)||Number(e.fatigue));}
function ruleMetric(o,unit,basis){return opMetricValue(o,unit||'usd',basis||'net');}
function weekKey(d){const x=new Date(d);x.setHours(0,0,0,0);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return inputDateValue(x);}
function applyRiskManagementRules(ops,plan=getCurrentPlan()){
  const cfg=plan?.riskManagement||basePlanConfig.riskManagement, daily=cfg.daily||{}, weekly=cfg.weekly||{};
  const sorted=[...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),included=[],excluded=[],reasons=new Map();
  let dayKey='',wkKey='',dayStopped=false,weekStopped=false,dayLossStreak=0,weekLossStreak=0,dayMetric=0,weekMetric=0,dayNetUsd=0,dayHadWin=false,weekLosingDays=0;
  const finishDay=()=>{if(dayKey&&dayNetUsd<0){weekLosingDays++;if(Number(weekly.maxLosingDays)>0&&weekLosingDays>=Number(weekly.maxLosingDays))weekStopped=true;}};
  for(const o of sorted){const d=new Date(o.entryDate);if(isNaN(d))continue;const dk=inputDateValue(d),wk=weekKey(d);
    if(wk!==wkKey){if(wkKey)finishDay();wkKey=wk;dayKey='';weekStopped=false;weekLossStreak=0;weekMetric=0;weekLosingDays=0;}
    if(dk!==dayKey){if(dayKey)finishDay();dayKey=dk;dayStopped=false;dayLossStreak=0;dayMetric=0;dayNetUsd=0;dayHadWin=false;}
    if(dayStopped||weekStopped){excluded.push(o);reasons.set(o.id,dayStopped?'Límite diario alcanzado':'Límite semanal alcanzado');continue;}
    included.push(o);const loss=o.result==='loss'||Number(o.resultTicks)<0,win=o.result==='win'||Number(o.resultTicks)>0,hadWinBefore=dayHadWin;
    if(loss){dayLossStreak++;weekLossStreak++;}else if(win){dayLossStreak=0;weekLossStreak=0;dayHadWin=true;}
    dayMetric+=ruleMetric(o,daily.maxLossUnit,daily.maxLossBasis);weekMetric+=ruleMetric(o,weekly.maxLossUnit,weekly.maxLossBasis);dayNetUsd+=Number(o.pnlNet)||0;
    if(Number(daily.maxConsecutiveLosses)>0&&dayLossStreak>=Number(daily.maxConsecutiveLosses))dayStopped=true;
    if(Number(daily.maxLossValue)>0&&dayMetric<=-Math.abs(Number(daily.maxLossValue)))dayStopped=true;
    if(daily.stopAfterWinThenLoss&&hadWinBefore&&loss)dayStopped=true;
    if(Number(weekly.maxConsecutiveLosses)>0&&weekLossStreak>=Number(weekly.maxConsecutiveLosses))weekStopped=true;
    if(Number(weekly.maxLossValue)>0&&weekMetric<=-Math.abs(Number(weekly.maxLossValue)))weekStopped=true;
  }
  return {included,excluded,reasons};
}
function baseFilteredOps(){
  const f=opsViewState,q=String(f.q||'').toLowerCase(),blockMap=opBlockMap();
  return currentOps().filter(o=>{
    const d=new Date(o.entryDate);if(isNaN(d))return false;const date=inputDateValue(d),hh=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    if(q&&!JSON.stringify(o).toLowerCase().includes(q))return false;
    if(f.dateFrom&&date<f.dateFrom)return false;if(f.dateTo&&date>f.dateTo)return false;
    if(f.timeFrom&&f.timeTo){if(f.timeFrom<=f.timeTo){if(hh<f.timeFrom||hh>f.timeTo)return false;}else{if(hh<f.timeFrom&&hh>f.timeTo)return false;}}
    else if(f.timeFrom&&hh<f.timeFrom)return false; else if(f.timeTo&&hh>f.timeTo)return false;
    if(f.days?.length&&!f.days.includes(d.getDay()))return false;
    if(f.month&&String(d.getMonth()+1)!==String(f.month))return false;if(f.year&&String(d.getFullYear())!==String(f.year))return false;
    if(f.direction&&o.direction!==f.direction)return false;if(f.setup&&o.setup!==f.setup)return false;if(f.vd&&o.vd!==f.vd)return false;if(f.nr&&o.nr!==f.nr)return false;if(f.hypothesis&&o.hypothesis!==f.hypothesis)return false;
    if(f.risk&&o.riskStrategyId!==f.risk)return false;if(f.source&&(o.raw?.source||'manual')!==f.source)return false;if(f.result&&o.result!==f.result)return false;
    const symbol=String(o.contract||o.instrumentSnapshot?.symbol||'').trim().split(/\s+/)[0];if(f.contract&&symbol!==f.contract)return false;
    if(f.block&&String(blockMap.get(o.id)||'')!==String(f.block))return false;
    if(f.emotion&&!operationEmotionValues(o).includes(f.emotion))return false;if(f.behavior&&!(o.emotional?.behaviors||[]).includes(f.behavior))return false;
    if(f.emotionStatus==='complete'&&!hasEmotionalEntry(o))return false;if(f.emotionStatus==='pending'&&hasEmotionalEntry(o))return false;
    return true;
  });
}
function filteredOps(){const base=baseFilteredOps();const out=opsViewState.riskPolicy==='plan'?applyRiskManagementRules(base).included:base;return [...out].sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate));}
function setOpsUnit(unit){opsViewState.unit=unit;document.querySelectorAll('[data-op-unit]').forEach(el=>el.classList.toggle('active',el.dataset.opUnit===unit));refreshOpsAnalytics();}
function setOpsBasis(basis){opsViewState.basis=basis;document.querySelectorAll('[data-op-basis]').forEach(el=>el.classList.toggle('active',el.dataset.opBasis===basis));refreshOpsAnalytics();}
function toggleOpsDay(day){day=Number(day);const a=opsViewState.days||[];opsViewState.days=a.includes(day)?a.filter(x=>x!==day):[...a,day];document.querySelectorAll('[data-day-chip]').forEach(el=>el.classList.toggle('active',opsViewState.days.includes(Number(el.dataset.dayChip))));refreshOpsAnalytics(false);}
function toggleOpsModule(name){const a=opsViewState.modules||[];opsViewState.modules=a.includes(name)?a.filter(x=>x!==name):[...a,name];document.querySelectorAll('[data-module-chip]').forEach(el=>el.classList.toggle('active',opsViewState.modules.includes(el.dataset.moduleChip)));refreshOpsAnalytics(false);}
function resetOpsFilters(){const keepUnit=opsViewState.unit,keepBasis=opsViewState.basis,keepModules=opsViewState.modules,keepDim=opsViewState.dimension,keepRiskPolicy=opsViewState.riskPolicy;opsViewState={unit:keepUnit,basis:keepBasis,q:'',dateFrom:'',dateTo:'',timeFrom:'',timeTo:'',days:[],month:'',year:'',direction:'',setup:'',vd:'',nr:'',hypothesis:'',risk:'',source:'',result:'',contract:'',block:'',emotion:'',behavior:'',emotionStatus:'',riskPolicy:keepRiskPolicy,dimension:keepDim,modules:keepModules};render();}
function setOpsQuickPeriod(mode){const dates=currentOps().map(o=>new Date(o.entryDate)).filter(d=>!isNaN(d));if(!dates.length)return;const anchor=new Date(Math.max(...dates.map(d=>d.getTime()))),end=new Date(anchor),start=new Date(anchor);if(mode==='all'){opsViewState.dateFrom='';opsViewState.dateTo='';}else if(mode==='7d'){start.setDate(start.getDate()-6);opsViewState.dateFrom=inputDateValue(start);opsViewState.dateTo=inputDateValue(end);}else if(mode==='30d'){start.setDate(start.getDate()-29);opsViewState.dateFrom=inputDateValue(start);opsViewState.dateTo=inputDateValue(end);}else if(mode==='month'){start.setDate(1);const e=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);opsViewState.dateFrom=inputDateValue(start);opsViewState.dateTo=inputDateValue(e);}render();}
function setOpsDimension(dim){opsViewState.dimension=dim;const el=document.getElementById('filterDimension');if(el)el.value=dim;refreshOpsAnalytics(false);}
function applyDimensionFilter(dim,val){
  if(dim==='setup')opsViewState.setup=val;else if(dim==='vd')opsViewState.vd=val;else if(dim==='nr')opsViewState.nr=val;else if(dim==='hypothesis')opsViewState.hypothesis=val;else if(dim==='strategy')opsViewState.risk=val;else if(dim==='direction')opsViewState.direction=val;else if(dim==='contract')opsViewState.contract=val;else if(dim==='source')opsViewState.source=val;else if(dim==='result')opsViewState.result=val;else if(dim==='month'){const [y,m]=String(val).split('-');opsViewState.year=y;opsViewState.month=String(Number(m));}
  render();
}
function applyHeatCell(day,hour){opsViewState.days=[Number(day)];opsViewState.timeFrom=`${String(hour).padStart(2,'0')}:00`;opsViewState.timeTo=`${String(hour).padStart(2,'0')}:59`;render();}
function refreshOpsAnalytics(read=true){if(read)readOpsFilters();const area=document.getElementById('opsAnalyticsArea');if(area)area.innerHTML=opsAnalyticsHtml(filteredOps());}
function filterOperations(){refreshOpsAnalytics(true);}
function mixedInstrumentWarning(ops){const symbols=uniqueSorted(ops.map(o=>String(o.contract||o.instrumentSnapshot?.symbol||'').trim().split(/\s+/)[0]));return opsViewState.unit==='ticks'&&symbols.length>1?`<div class="notice warn-notice">Estás agregando ticks de ${symbols.length} instrumentos (${symbols.join(', ')}). Para comparar instrumentos distintos, R o US$ son más interpretables.</div>`:'';}
function opsSummaryHtml(ops){
  const s=calcMetricStats(ops,opsViewState.unit,opsViewState.basis),all=calcMetricStats(currentOps(),opsViewState.unit,opsViewState.basis),delta=(a,b,suffix='')=>`${a-b>=0?'+':''}${(a-b).toFixed(2)}${suffix} vs total`;
  const baseN=baseFilteredOps().length,riskExcluded=opsViewState.riskPolicy==='plan'?Math.max(0,baseN-s.n):0;
  const pf=Number.isFinite(s.pf)?s.pf.toFixed(2):'∞',totalTxt=metricStatText(s.sum,opsViewState.unit),expTxt=metricStatText(s.expectancy,opsViewState.unit);
  return `<div class="analytics-kpis">${kpi('Operaciones',s.n,opsViewState.riskPolicy==='plan'?`${riskExcluded} excluidas por gestión TP`:`${currentOps().length-s.n} fuera del filtro`)}${kpi('Win rate',pct(s.winRate),delta(s.winRate,all.winRate,' pp'))}${kpi(`Resultado ${opsViewState.basis==='net'?'neto':'bruto'}`,totalTxt,metricUnitLabel(opsViewState.unit))}${kpi('Expectancy',expTxt,delta(s.expectancy,all.expectancy))}${kpi('Profit Factor',pf,'ganancia / pérdida')}${kpi('Max drawdown',metricStatText(s.maxDD,opsViewState.unit),'del subconjunto')}${kpi('Media ganadora',metricStatText(s.avgWin,opsViewState.unit),`${s.wins} ganadoras`)}${kpi('Media perdedora',metricStatText(s.avgLoss,opsViewState.unit),`${s.losses} perdedoras`)}${kpi('Comisiones',`${s.commissions.toFixed(2)} US$`,'coste total')}</div>`;
}
function opsEquityModule(ops){const chrono=[...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),s=calcMetricStats(chrono,opsViewState.unit,opsViewState.basis);return `<section class="card panel analytics-module"><div class="panel-title"><div><h3>Equity filtrada</h3><small>${opsViewState.basis==='net'?'Neta':'Bruta'} · ${metricUnitLabel(opsViewState.unit)}</small></div><span>${metricStatText(s.sum,opsViewState.unit)}</span></div><div class="chart-wrap analytics-chart">${lineChartSvg(s.equity,820,230)}</div></section>`;}
function distributionModule(ops){
  const vals=ops.map(o=>opMetricValue(o,opsViewState.unit,opsViewState.basis));if(!vals.length)return `<section class="card panel analytics-module"><div class="panel-title"><h3>Distribución</h3></div><div class="empty">Sin datos.</div></section>`;
  let min=Math.min(...vals),max=Math.max(...vals);if(min===max){min-=1;max+=1;}const bins=9,step=(max-min)/bins,b=Array.from({length:bins},(_,i)=>({a:min+i*step,z:min+(i+1)*step,n:0}));vals.forEach(v=>{let i=Math.floor((v-min)/step);if(i>=bins)i=bins-1;if(i<0)i=0;b[i].n++;});const top=Math.max(...b.map(x=>x.n),1);
  return `<section class="card panel analytics-module"><div class="panel-title"><div><h3>Distribución de resultados</h3><small>${metricUnitLabel(opsViewState.unit)} por operación</small></div><span>${vals.length} trades</span></div><div class="histogram">${b.map(x=>`<div class="hist-col"><div class="hist-bar ${x.z<=0?'neg':x.a>=0?'pos':'mix'}" style="height:${Math.max(5,x.n/top*100)}%"><span>${x.n||''}</span></div><div class="hist-label">${(x.a+x.z<0?'-':'')}${Math.abs((x.a+x.z)/2).toFixed(opsViewState.unit==='ticks'?0:1)}</div></div>`).join('')}</div></section>`;
}
function heatmapModule(ops){
  if(!ops.length)return `<section class="card panel analytics-module wide-module"><div class="panel-title"><h3>Día × hora</h3></div><div class="empty">Sin datos.</div></section>`;
  const hours=uniqueSorted(ops.map(o=>new Date(o.entryDate).getHours())).map(Number).sort((a,b)=>a-b),days=uniqueSorted(ops.map(o=>new Date(o.entryDate).getDay())).map(Number).sort((a,b)=>((a+6)%7)-((b+6)%7));let maxAbs=0;const cells={};days.forEach(d=>hours.forEach(h=>{const subset=ops.filter(o=>{const dt=new Date(o.entryDate);return dt.getDay()===d&&dt.getHours()===h;}),s=calcMetricStats(subset,opsViewState.unit,opsViewState.basis);cells[`${d}-${h}`]=s;maxAbs=Math.max(maxAbs,Math.abs(s.expectancy));}));maxAbs=maxAbs||1;
  return `<section class="card panel analytics-module wide-module"><div class="panel-title"><div><h3>Mapa de calor · día × hora</h3><small>Expectancy; pulsa una celda para filtrar</small></div><span>${metricUnitLabel(opsViewState.unit)}</span></div><div class="heat-wrap"><table class="heat-table"><thead><tr><th></th>${hours.map(h=>`<th>${String(h).padStart(2,'0')}:00</th>`).join('')}</tr></thead><tbody>${days.map(d=>`<tr><th>${DOW_LABELS[d]}</th>${hours.map(h=>{const s=cells[`${d}-${h}`],v=s.expectancy,a=Math.min(.65,.10+Math.abs(v)/maxAbs*.55),bg=v>0?`rgba(124,240,196,${a})`:v<0?`rgba(255,123,138,${a})`:'rgba(255,255,255,.03)';return `<td onclick="applyHeatCell(${d},${h})" style="background:${bg}" title="${s.n} operaciones · ${metricStatText(v,opsViewState.unit)}"><strong>${s.n?metricStatText(v,opsViewState.unit):'—'}</strong><small>${s.n} op.</small></td>`}).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}
function dimensionItem(o,dim){
  if(dim==='setup')return {key:o.setup||'Sin setup',label:o.setup||'Sin setup'};if(dim==='vd')return {key:o.vd||'Sin VD',label:o.vd||'Sin VD'};if(dim==='nr')return {key:o.nr||'Sin NR',label:o.nr||'Sin NR'};if(dim==='hypothesis')return {key:o.hypothesis||'Sin hipótesis',label:o.hypothesis||'Sin hipótesis'};if(dim==='strategy')return {key:o.riskStrategyId||'',label:o.riskStrategyName||'No clasificada'};if(dim==='direction')return {key:o.direction||'—',label:o.direction||'—'};if(dim==='contract'){const x=String(o.contract||o.instrumentSnapshot?.symbol||'—').trim().split(/\s+/)[0];return {key:x,label:x};}if(dim==='source'){const x=o.raw?.source==='ankora'?'ankora':'manual';return {key:x,label:x==='ankora'?'Ankora':'Manual'};}if(dim==='result')return {key:o.result||'pending',label:o.result==='win'?'Ganadora':o.result==='loss'?'Perdedora':'Pendiente'};if(dim==='month'){const d=new Date(o.entryDate),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return {key,label:`${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`};}return {key:'',label:'—'};
}
function breakdownModule(ops){
  const dim=opsViewState.dimension||'setup',groups=new Map();ops.forEach(o=>{const x=dimensionItem(o,dim);if(!groups.has(x.key))groups.set(x.key,{key:x.key,label:x.label,ops:[]});groups.get(x.key).ops.push(o);});const rows=[...groups.values()].map(g=>({...g,stats:calcMetricStats(g.ops,opsViewState.unit,opsViewState.basis)})).sort((a,b)=>b.stats.expectancy-a.stats.expectancy).slice(0,14),maxAbs=Math.max(...rows.map(r=>Math.abs(r.stats.expectancy)),1);
  return `<section class="card panel analytics-module"><div class="panel-title"><div><h3>Desglose interactivo</h3><small>Pulsa una categoría para convertirla en filtro</small></div><select id="filterDimension" class="select compact-select" onchange="setOpsDimension(this.value)">${[['setup','Setup'],['vd','VD'],['nr','NR'],['hypothesis','Hipótesis'],['strategy','Estrategia'],['direction','Dirección'],['contract','Contrato'],['source','Origen'],['result','Resultado'],['month','Mes']].map(([v,l])=>`<option value="${v}" ${dim===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="breakdown-list">${rows.length?rows.map(r=>`<button class="breakdown-row" onclick="applyDimensionFilter('${dim}',decodeURIComponent('${encodeURIComponent(String(r.key))}'))"><span class="break-label">${esc(r.label)}</span><span class="break-track"><i class="${r.stats.expectancy>=0?'pos':'neg'}" style="width:${Math.max(4,Math.abs(r.stats.expectancy)/maxAbs*100)}%"></i></span><span>${r.stats.n} op.</span><strong>${metricStatText(r.stats.expectancy,opsViewState.unit)}</strong><em>${pct(r.stats.winRate)}</em></button>`).join(''):'<div class="empty">Sin categorías.</div>'}</div></section>`;
}


function opsTable(ops,unit=opsViewState.unit,basis=opsViewState.basis){
  if(!ops.length)return '<div class="empty">No hay operaciones con estos filtros.</div>';const blocks=opBlockMap();
  return `<div class="table-wrap"><table class="table analytics-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Día</th><th>Bloque</th><th>Símbolo</th><th>Dirección</th><th>Setup</th><th>VD</th><th>NR</th><th>Hipótesis</th><th>Régimen</th><th>Origen</th><th>Resultado</th><th>${metricUnitLabel(unit)} ${basis==='net'?'neto':'bruto'}</th><th>Ticks</th><th>P&L neto</th><th>Comisión</th><th>Acciones</th></tr></thead><tbody>${ops.map(o=>{const d=new Date(o.entryDate);return `<tr><td>${fmtDateOnly(o.entryDate)}</td><td>${isNaN(d)?'—':d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</td><td>${isNaN(d)?'—':DOW_LABELS[d.getDay()]}</td><td>B${String(blocks.get(o.id)||'—').padStart(2,'0')}</td><td>${esc(o.contract||o.instrumentSnapshot?.symbol||'—')}</td><td>${esc(o.direction||'—')}</td><td>${esc(o.setup||'—')}</td><td>${esc(o.vd||'—')}</td><td>${esc(o.nr||'—')}</td><td>${esc(o.hypothesis||'—')}</td><td>${esc(o.riskStrategyName||o.riskStrategyId||'—')}</td><td><span class="badge">${o.raw?.source==='ankora'?'Ankora':'Manual'}</span></td><td><span class="badge ${resultClass(o)}">${o.result==='win'?'Ganadora':o.result==='loss'?'Perdedora':'Pendiente'}</span></td><td class="${opMetricValue(o,unit,basis)>=0?'positive':'negative'}"><strong>${metricStatText(opMetricValue(o,unit,basis),unit)}</strong></td><td>${Number(o.resultTicks||0)>=0?'+':''}${Number(o.resultTicks||0).toFixed(1)}t</td><td>${money(o.pnlNet||0,o.instrumentSnapshot?.currency||'USD')}</td><td>${money(o.commission||0,o.instrumentSnapshot?.currency||'USD')}</td><td><button class="btn small" onclick="viewOperation('${o.id}')">Ver</button> <button class="btn small" onclick="editOperation('${o.id}')">Editar</button></td></tr>`}).join('')}</tbody></table></div>`;
}
function opsAnalyticsHtml(ops){
  const mods=opsViewState.modules||[];return `${mixedInstrumentWarning(ops)}${opsSummaryHtml(ops)}<div class="analytics-grid">${mods.includes('equity')?opsEquityModule(ops):''}${mods.includes('distribution')?distributionModule(ops):''}${mods.includes('heatmap')?heatmapModule(ops):''}${mods.includes('breakdown')?breakdownModule(ops):''}</div>${mods.includes('table')?`<section class="card panel table-module"><div class="panel-title"><div><h3>Registro filtrado</h3><small>${ops.length} operaciones visibles</small></div><span>${metricUnitLabel(opsViewState.unit)} · ${opsViewState.basis==='net'?'Neto':'Bruto'}</span></div>${opsTable(ops)}</section>`:''}`;
}
function dayChips(){return [1,2,3,4,5,6,0].map(d=>`<button type="button" class="filter-chip ${opsViewState.days.includes(d)?'active':''}" data-day-chip="${d}" onclick="toggleOpsDay(${d})">${DOW_LABELS[d]}</button>`).join('');}
function moduleChips(){const labels={equity:'Equity',distribution:'Distribución',heatmap:'Día × hora',breakdown:'Desglose',table:'Tabla'};return Object.entries(labels).map(([k,l])=>`<button type="button" class="filter-chip ${opsViewState.modules.includes(k)?'active':''}" data-module-chip="${k}" onclick="toggleOpsModule('${k}')">${l}</button>`).join('');}
function operationsFilterPanel(){
  const p=getCurrentPlan(),ops=currentOps(),years=uniqueSorted(ops.map(o=>new Date(o.entryDate).getFullYear())).sort((a,b)=>b-a),contracts=uniqueSorted(ops.map(o=>String(o.contract||o.instrumentSnapshot?.symbol||'').trim().split(/\s+/)[0])),blocks=Math.ceil(ops.length/20),emotions=p?.emotionConfig?.emotions||[],behaviors=p?.emotionConfig?.behaviors||[];
  const sel=(id,label,values,current)=>`<label class="filter-field"><span>${label}</span><select id="${id}" class="select" onchange="filterOperations()"><option value="">Todos</option>${values.map(x=>{const v=typeof x==='object'?x.value:x,l=typeof x==='object'?x.label:x;return `<option value="${esc(v)}" ${String(current)===String(v)?'selected':''}>${esc(l)}</option>`}).join('')}</select></label>`;
  return `<section class="card filter-hub"><div class="filter-hub-top"><div><h3>Explorador de operaciones</h3><p>Filtra el dataset y todos los módulos se recalculan al instante.</p></div><div class="metric-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${opsViewState.unit===v?'active':''}" data-op-unit="${v}" onclick="setOpsUnit('${v}')">${l}</button>`).join('')}<i></i><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([v,l])=>`<button class="seg-btn ${opsViewState.basis===v?'active':''}" data-op-basis="${v}" onclick="setOpsBasis('${v}')">${l}</button>`).join('')}<i></i><span>Gestión</span>${[['raw','Bruta'],['plan','Reglas TP']].map(([v,l])=>`<button class="seg-btn ${opsViewState.riskPolicy===v?'active':''}" onclick="opsViewState.riskPolicy='${v}';render()">${l}</button>`).join('')}</div></div><div class="quick-row"><strong>Periodo rápido</strong><button class="filter-chip" onclick="setOpsQuickPeriod('all')">Todo</button><button class="filter-chip" onclick="setOpsQuickPeriod('7d')">Últimas 7 sesiones/días</button><button class="filter-chip" onclick="setOpsQuickPeriod('30d')">Últimos 30</button><button class="filter-chip" onclick="setOpsQuickPeriod('month')">Mes más reciente</button><span class="filter-sep"></span><strong>Módulos</strong>${moduleChips()}</div><div class="filter-grid"><label class="filter-field wide"><span>Buscar</span><input id="searchOps" class="input" value="${esc(opsViewState.q)}" placeholder="Símbolo, setup, VD, NR, notas…" oninput="filterOperations()"></label><label class="filter-field"><span>Desde</span><input id="filterDateFrom" type="date" class="input" value="${esc(opsViewState.dateFrom)}" onchange="filterOperations()"></label><label class="filter-field"><span>Hasta</span><input id="filterDateTo" type="date" class="input" value="${esc(opsViewState.dateTo)}" onchange="filterOperations()"></label><label class="filter-field"><span>Hora desde</span><input id="filterTimeFrom" type="time" class="input" value="${esc(opsViewState.timeFrom)}" onchange="filterOperations()"></label><label class="filter-field"><span>Hora hasta</span><input id="filterTimeTo" type="time" class="input" value="${esc(opsViewState.timeTo)}" onchange="filterOperations()"></label>${sel('filterMonth','Mes',MONTH_LABELS.map((m,i)=>({value:i+1,label:m})),opsViewState.month)}${sel('filterYear','Año',years,opsViewState.year)}${sel('filterContract','Contrato',contracts,opsViewState.contract)}${sel('filterDirection','Dirección',['LONG','SHORT'],opsViewState.direction)}${sel('filterSetup','Setup',uniqueSorted(p?.setups||[]),opsViewState.setup)}${sel('filterVD','VD',uniqueSorted(p?.vd||[]),opsViewState.vd)}${sel('filterNR','NR',uniqueSorted(p?.nr||[]),opsViewState.nr)}${sel('filterHypothesis','Hipótesis',(p?.hypotheses||[]).map(h=>({value:h.id,label:h.name||h.id})),opsViewState.hypothesis)}${sel('filterRisk','Régimen',(p?.riskStrategies||[]).map(r=>({value:r.id,label:r.name})),opsViewState.risk)}${sel('filterSource','Origen',[{value:'manual',label:'Manual'},{value:'ankora',label:'Ankora'}],opsViewState.source)}${sel('filterResult','Resultado',[{value:'win',label:'Ganadoras'},{value:'loss',label:'Perdedoras'},{value:'pending',label:'Pendientes'}],opsViewState.result)}${sel('filterBlock','Bloque',Array.from({length:blocks},(_,i)=>({value:i+1,label:`Bloque ${String(i+1).padStart(2,'0')}`})),opsViewState.block)}${sel('filterEmotion','Emoción',emotions,opsViewState.emotion)}${sel('filterBehavior','Comportamiento',behaviors,opsViewState.behavior)}${sel('filterEmotionStatus','Diario emocional',[{value:'complete',label:'Completado'},{value:'pending',label:'Pendiente'}],opsViewState.emotionStatus)}<label class="filter-field"><span>Gestión de riesgo</span><select id="filterRiskPolicy" class="select" onchange="filterOperations()"><option value="raw" ${opsViewState.riskPolicy==='raw'?'selected':''}>Sin recorte</option><option value="plan" ${opsViewState.riskPolicy==='plan'?'selected':''}>Aplicar reglas del plan</option></select></label></div><div class="day-filter-row"><strong>Día de semana</strong>${dayChips()}<button class="btn small ghost reset-filter" onclick="resetOpsFilters()">Limpiar filtros</button></div></section>`;
}


/* V6 · Diario emocional + capa de gestión de riesgo */

// ---------- V7 · Biblioteca visual ----------
const IMAGE_DB_NAME='tradingResearchImages_v1';
const IMAGE_STORE='images';
let _imageDbPromise=null;
function imageDb(){if(_imageDbPromise)return _imageDbPromise;_imageDbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(IMAGE_DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(IMAGE_STORE))db.createObjectStore(IMAGE_STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return _imageDbPromise;}
async function storeImageFile(file,id){const db=await imageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).put({id,blob:file,name:file.name,type:file.type,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
async function getImageBlob(id){try{const db=await imageDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readonly'),r=tx.objectStore(IMAGE_STORE).get(id);r.onsuccess=()=>resolve(r.result?.blob||null);r.onerror=()=>reject(r.error);});}catch{return null;}}
async function deleteImageBlob(id){try{const db=await imageDb();await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{}}
async function hydrateImageElements(root=document){const els=[...root.querySelectorAll('img[data-img-id]:not([data-hydrated])')];for(const el of els){el.dataset.hydrated='1';const blob=await getImageBlob(el.dataset.imgId);if(blob){const u=URL.createObjectURL(blob);el.src=u;el.onload=()=>setTimeout(()=>URL.revokeObjectURL(u),2000);}else{el.alt='Imagen no disponible en este navegador';el.classList.add('missing-image');}}}
function imageThumb(meta,cls=''){return `<button class="image-thumb-btn ${cls}" type="button" onclick="openImageLightbox('${esc(meta.id)}','${encodeURIComponent(meta.caption||meta.name||meta.label||'Imagen')}')"><img data-img-id="${esc(meta.id)}" alt="${esc(meta.caption||meta.label||'Captura')}"/><span>${esc(meta.label||'Captura')}</span></button>`;}
function imageLabelOptions(value='Contexto'){return ['Contexto','Entrada','Salida','Gestión','Error','Review'].map(x=>`<option value="${x}" ${x===value?'selected':''}>${x}</option>`).join('');}
function openImageLightbox(id,title=''){document.body.insertAdjacentHTML('beforeend',modalShell(decodeURIComponent(title||'Imagen'),`<div class="lightbox-wrap"><img class="lightbox-image" data-img-id="${esc(id)}" alt="Imagen ampliada"></div>`,`<button class="btn" onclick="closeModal()">Cerrar</button>`));setTimeout(hydrateImageElements,0);}
function referencesForOperation(o){const p=getPlan(o.tradingPlanId);return (p?.visualReferences||[]).filter(r=>(r.kind==='setup'&&r.key===o.setup)||(r.kind==='vd'&&r.key===o.vd)||(r.kind==='nr'&&r.key===o.nr)||(r.kind==='context'&&String(r.key).trim()&&String(r.key).trim()===String(o.h4Context||'').trim()));}
function relatedReferenceHtml(o){const refs=referencesForOperation(o);if(!refs.length)return '<div class="empty compact-empty">Sin referencias visuales asociadas exactamente a este trade.</div>';return `<div class="reference-related-grid">${refs.map(r=>`<div class="reference-mini-card"><div><span class="badge">${esc(referenceKindLabel(r.kind))}</span><strong>${esc(r.title||r.key)}</strong><small>${esc(r.note||r.key)}</small></div><div class="thumb-strip">${(r.images||[]).slice(0,4).map(x=>imageThumb(x,'mini')).join('')}</div></div>`).join('')}</div>`;}
function operationImagesHtml(o,limit=99){const imgs=o?.images||[];if(!imgs.length)return '<div class="empty compact-empty">Todavía no hay capturas asociadas.</div>';return `<div class="operation-image-grid">${imgs.slice(0,limit).map(x=>imageThumb(x)).join('')}</div>`;}
function galleryFilteredOps(){const f=galleryViewState,q=String(f.q||'').toLowerCase();return currentOps().filter(o=>{if(!(o.images||[]).length)return false;if(q&&!JSON.stringify(o).toLowerCase().includes(q))return false;if(f.setup&&o.setup!==f.setup)return false;if(f.vd&&o.vd!==f.vd)return false;if(f.nr&&o.nr!==f.nr)return false;if(f.result&&o.result!==f.result)return false;if(f.direction&&o.direction!==f.direction)return false;if(f.context&&o.h4Context!==f.context)return false;if(f.label&&!(o.images||[]).some(i=>i.label===f.label))return false;return true;}).sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate));}
function readGalleryFilters(){const v=id=>document.getElementById(id)?.value||'';galleryViewState={q:v('galQ'),setup:v('galSetup'),vd:v('galVD'),nr:v('galNR'),result:v('galResult'),direction:v('galDirection'),label:v('galLabel'),context:v('galContext')};render();}
function toggleGallerySelect(id,on){if(on){if(!gallerySelected.includes(id)&&gallerySelected.length>=4){alert('Puedes comparar hasta 4 operaciones a la vez.');render();return;}if(!gallerySelected.includes(id))gallerySelected.push(id);}else gallerySelected=gallerySelected.filter(x=>x!==id);const el=document.getElementById('galleryCompareCount');if(el)el.textContent=gallerySelected.length;}
function gallery(){const p=getCurrentPlan(),ops=galleryFilteredOps(),all=currentOps(),images=ops.reduce((a,o)=>a+(o.images?.length||0),0),labels=uniqueSorted(all.flatMap(o=>(o.images||[]).map(i=>i.label))),contexts=uniqueSorted(all.map(o=>o.h4Context));const sel=(id,label,vals,val)=>`<label class="filter-field"><span>${label}</span><select id="${id}" class="select" onchange="readGalleryFilters()"><option value="">Todos</option>${vals.map(x=>{const v=typeof x==='object'?x.value:x,l=typeof x==='object'?x.label:x;return `<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(l)}</option>`}).join('')}</select></label>`;return `${pageHead('Biblioteca visual','Capturas reales separadas por operación, con filtros técnicos y comparación visual.',`<button class="btn" onclick="openGalleryCompare()">Comparar (<span id="galleryCompareCount">${gallerySelected.length}</span>)</button><button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button>`)}${activePlanBanner()}<section class="card filter-hub"><div class="filter-hub-top"><div><h3>Explorador visual</h3><p>Filtra las capturas por contexto técnico; el dataset no se modifica.</p></div><button class="btn small" onclick="galleryViewState={q:'',setup:'',vd:'',nr:'',result:'',direction:'',label:'',context:''};gallerySelected=[];render()">Limpiar</button></div><div class="filter-grid"><label class="filter-field wide"><span>Buscar</span><input id="galQ" class="input" value="${esc(galleryViewState.q)}" placeholder="Setup, notas, contrato, contexto…" onchange="readGalleryFilters()"></label>${sel('galSetup','Setup',p?.setups||[],galleryViewState.setup)}${sel('galVD','VD',p?.vd||[],galleryViewState.vd)}${sel('galNR','NR',p?.nr||[],galleryViewState.nr)}${sel('galResult','Resultado',[{value:'win',label:'Ganadora'},{value:'loss',label:'Perdedora'},{value:'pending',label:'Pendiente'}],galleryViewState.result)}${sel('galDirection','Dirección',['LONG','SHORT'],galleryViewState.direction)}${sel('galLabel','Tipo de imagen',labels,galleryViewState.label)}${sel('galContext','Contexto H4',contexts,galleryViewState.context)}</div></section><div class="gallery-kpis">${kpi('Operaciones visuales',ops.length,`${all.filter(o=>(o.images||[]).length).length} en el plan`)}${kpi('Imágenes visibles',images,'capturas filtradas')}${kpi('Seleccionadas',gallerySelected.length,'máximo 4 para comparar')}</div>${ops.length?`<div class="trade-gallery-grid">${ops.map(galleryTradeCard).join('')}</div>`:'<div class="empty">No hay capturas con estos filtros. Añade imágenes desde una operación.</div>'}`;}
function galleryTradeCard(o){const checked=gallerySelected.includes(o.id);return `<article class="card gallery-trade-card ${checked?'selected':''}"><div class="gallery-card-head"><div><strong>${esc(o.contract||o.instrumentSnapshot?.symbol||'Trade')} · ${esc(o.direction||'—')}</strong><span>${fmtDate(o.entryDate)}</span></div><label class="compare-check"><input type="checkbox" ${checked?'checked':''} onchange="toggleGallerySelect('${o.id}',this.checked)"> comparar</label></div><div class="gallery-metrics"><span>${esc(o.setup||'—')}</span><span>${esc(o.vd||'—')}</span><span>${esc(o.nr||'—')}</span><b class="${Number(o.rMultiple)>=0?'positive':'negative'}">${Number(o.rMultiple)>=0?'+':''}${Number(o.rMultiple||0).toFixed(2)}R</b></div><div class="gallery-thumbs">${(o.images||[]).slice(0,4).map(x=>imageThumb(x,'gallery')).join('')}</div><div class="gallery-card-foot"><small>${esc(o.h4Context||'Sin contexto H4')}</small><button class="btn small" onclick="viewOperation('${o.id}')">Ficha completa</button></div></article>`;}
function openGalleryCompare(){const ops=gallerySelected.map(id=>state.operations.find(o=>o.id===id)).filter(Boolean);if(ops.length<2)return alert('Selecciona al menos 2 operaciones para comparar.');const body=`<div class="compare-grid">${ops.map(o=>`<section class="compare-trade"><div class="compare-title"><strong>${esc(o.contract||'Trade')} · ${esc(o.direction)}</strong><span>${fmtDate(o.entryDate)}</span></div><div class="compare-stats"><span>${esc(o.setup||'—')}</span><span>${esc(o.vd||'—')}</span><span>${esc(o.nr||'—')}</span><b>${Number(o.rMultiple)>=0?'+':''}${Number(o.rMultiple||0).toFixed(2)}R</b></div>${operationImagesHtml(o,6)}<small>${esc(o.h4Context||'')}</small></section>`).join('')}</div>`;document.body.insertAdjacentHTML('beforeend',modalShell('Comparación visual de operaciones',body,`<button class="btn" onclick="closeModal()">Cerrar</button>`));setTimeout(hydrateImageElements,0);}
function referenceKindLabel(k){return ({setup:'Setup',vd:'VD / vela',nr:'NR / nivel',context:'Contexto'})[k]||k;}
function referenceCategoryOptions(kind,p,current=''){const arr=kind==='setup'?p.setups:kind==='vd'?p.vd:kind==='nr'?p.nr:[];if(kind==='context')return `<input id="f-ref-key" class="input" value="${esc(current)}" placeholder="Ej. H4 EA NORM + IMPULSO">`;return `<select id="f-ref-key" class="select">${arr.map(x=>`<option value="${esc(x)}" ${x===current?'selected':''}>${esc(x)}</option>`).join('')}</select>`;}
function refreshReferenceKey(){const kind=document.getElementById('f-ref-kind')?.value||'setup',p=getCurrentPlan(),box=document.getElementById('referenceKeyBox');if(box)box.innerHTML=`<label>Categoría / contexto</label>${referenceCategoryOptions(kind,p,'')}`;}
function openVisualReferenceModal(id=null){const p=getCurrentPlan();if(!p)return;editingVisualReferenceId=id;const r=id?(p.visualReferences||[]).find(x=>x.id===id):{kind:'setup',key:p.setups?.[0]||'',title:'',note:'',images:[]};const body=`<form onsubmit="return false"><div class="form-section"><h4>Referencia visual</h4><div class="form-grid"><div class="field"><label>Tipo</label><select id="f-ref-kind" class="select" onchange="refreshReferenceKey()">${['setup','vd','nr','context'].map(k=>`<option value="${k}" ${r.kind===k?'selected':''}>${referenceKindLabel(k)}</option>`).join('')}</select></div><div class="field" id="referenceKeyBox"><label>Categoría / contexto</label>${referenceCategoryOptions(r.kind,p,r.key)}</div>${field('Título','ref-title','text',esc(r.title||''),'span2')}${field('Notas / qué buscar','ref-note','textarea',esc(r.note||''),'full')}<div class="field full"><label>Añadir imágenes ejemplo</label><input id="referenceFiles" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="help">Las imágenes se guardan localmente en IndexedDB en esta fase; después las migraremos a Supabase.</div></div></div></div>${r.images?.length?`<div class="form-section"><h4>Imágenes actuales</h4><div class="operation-image-grid">${r.images.map(x=>imageThumb(x)).join('')}</div></div>`:''}</form>`;document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar referencia visual':'Nueva referencia visual',body,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveVisualReference()">Guardar referencia</button>`));setTimeout(hydrateImageElements,0);}
async function saveVisualReference(){const p=getCurrentPlan(),get=n=>document.getElementById(`f-${n}`)?.value||'';if(!p)return;const kind=get('ref-kind'),key=get('ref-key').trim();if(!key)return alert('Selecciona o escribe una categoría/contexto.');const old=editingVisualReferenceId?(p.visualReferences||[]).find(x=>x.id===editingVisualReferenceId):null,images=clone(old?.images||[]),files=[...(document.getElementById('referenceFiles')?.files||[])];for(const file of files){const id=uid('IMG');await storeImageFile(file,id);images.push({id,label:'Referencia',caption:file.name,name:file.name,type:file.type,createdAt:new Date().toISOString()});}if(!images.length)return alert('Añade al menos una imagen de referencia.');const item={id:old?.id||uid('REF'),kind,key,title:get('ref-title').trim()||key,note:get('ref-note').trim(),images,updatedAt:new Date().toISOString()};const idx=(p.visualReferences||[]).findIndex(x=>x.id===item.id);if(idx>=0)p.visualReferences[idx]=item;else p.visualReferences.push(item);p.updatedAt=new Date().toISOString();persist();closeModal();render();}
async function deleteVisualReference(id){const p=getCurrentPlan(),r=(p?.visualReferences||[]).find(x=>x.id===id);if(!p||!r||!confirm('¿Eliminar esta referencia visual y sus imágenes?'))return;for(const im of r.images||[])await deleteImageBlob(im.id);p.visualReferences=p.visualReferences.filter(x=>x.id!==id);persist();render();}
function visualReferencePanel(p){const refs=p?.visualReferences||[];return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Referencias visuales del Trading Plan</h3><div class="help">Ejemplos de lo que buscas en Setups, VD, NR y contextos. Se muestran también en la ficha de cada trade relacionado.</div></div><button class="btn primary small" onclick="openVisualReferenceModal()">+ Añadir referencia</button></div>${refs.length?`<div class="reference-config-grid">${refs.map(r=>`<article class="reference-config-card"><div class="reference-config-head"><div><span class="badge">${esc(referenceKindLabel(r.kind))}</span><strong>${esc(r.title||r.key)}</strong><small>${esc(r.key)}</small></div><div><button class="btn small" onclick="openVisualReferenceModal('${r.id}')">Editar</button> <button class="btn small danger" onclick="deleteVisualReference('${r.id}')">Eliminar</button></div></div><p>${esc(r.note||'Sin notas')}</p><div class="thumb-strip">${(r.images||[]).map(x=>imageThumb(x,'mini')).join('')}</div></article>`).join('')}</div>`:'<div class="empty">Todavía no hay referencias visuales. Añade ejemplos de setup, velas, niveles o contextos.</div>'}</section>`;}

function emotionConfigPanel(p){
  const e=p?.emotionConfig||basePlanConfig.emotionConfig;
  const list=(arr,type)=>`<div class="emotion-config-list">${(arr||[]).map((x,i)=>`<span class="emotion-token">${esc(x)}<button onclick="removeEmotionConfig('${type}',${i})">×</button></span>`).join('')||'<span class="help">Sin categorías.</span>'}</div><div class="inline-add"><input id="new-emotion-${type}" class="input" placeholder="Añadir ${type==='emotions'?'emoción':'comportamiento'}…"><button class="btn small" onclick="addEmotionConfig('${type}')">Añadir</button></div>`;
  return `<section class="card panel config-wide" style="margin-top:16px"><div class="panel-title"><div><h3>Taxonomía emocional · ${esc(planLabel(p))}</h3><div class="help">Estas categorías se usan en el Diario y en los filtros de resultados. Puedes adaptarlas a tu lenguaje operativo.</div></div><button class="btn small" onclick="navigate('journal')">Abrir diario</button></div><div class="grid two emotion-config-grid"><div><h4>Emociones / estados</h4>${list(e.emotions,'emotions')}</div><div><h4>Comportamientos observables</h4>${list(e.behaviors,'behaviors')}</div></div></section>`;
}
function addEmotionConfig(type){const p=getCurrentPlan(),el=document.getElementById(`new-emotion-${type}`),v=el?.value.trim();if(!p||!v)return;p.emotionConfig=p.emotionConfig||clone(basePlanConfig.emotionConfig);if(!p.emotionConfig[type].includes(v))p.emotionConfig[type].push(v);p.updatedAt=new Date().toISOString();saveState();}
function removeEmotionConfig(type,i){const p=getCurrentPlan();if(!p?.emotionConfig?.[type])return;p.emotionConfig[type].splice(i,1);p.updatedAt=new Date().toISOString();saveState();}
function ruleConfigText(rule,scope){const bits=[];if(Number(rule.maxConsecutiveLosses)>0)bits.push(`${rule.maxConsecutiveLosses} pérdidas consecutivas`);if(Number(rule.maxLossValue)>0)bits.push(`pérdida máx. ${rule.maxLossValue} ${String(rule.maxLossUnit||'usd').toUpperCase()} ${rule.maxLossBasis==='gross'?'bruto':'neto'}`);if(scope==='daily'&&rule.stopAfterWinThenLoss)bits.push('tras beneficio: primera pérdida cierra sesión');if(scope==='weekly'&&Number(rule.maxLosingDays)>0)bits.push(`${rule.maxLosingDays} días perdedores`);return bits.length?bits.join(' · '):'Sin límites activos';}
function riskManagementPanel(p){const r=p?.riskManagement||basePlanConfig.riskManagement;return `<section class="card panel config-wide" style="margin-top:16px"><div class="panel-title"><div><h3>Normas de gestión de riesgo · ${esc(planLabel(p))}</h3><div class="help">La estadística puede simular cronológicamente qué operaciones habrías podido tomar después de aplicar estas reglas.</div></div><button class="btn primary small" onclick="openRiskManagementModal()">Editar reglas</button></div><div class="risk-rule-cards"><div><span>Diario</span><strong>${esc(ruleConfigText(r.daily,'daily'))}</strong></div><div><span>Semanal</span><strong>${esc(ruleConfigText(r.weekly,'weekly'))}</strong></div></div><div class="notice" style="margin-top:12px">El trade que alcanza un límite sí cuenta; se excluyen las operaciones posteriores. El filtro se aplica sobre el subconjunto temporal/contextual que tengas seleccionado en Operaciones.</div></section>`;}
function openRiskManagementModal(){const p=getCurrentPlan(),r=clone(p?.riskManagement||basePlanConfig.riskManagement),d=r.daily||{},w=r.weekly||{};const units=[{value:'usd',label:'US$'},{value:'ticks',label:'Ticks'},{value:'r',label:'R'}],bases=[{value:'net',label:'Neto'},{value:'gross',label:'Bruto'}];const body=`<div class="form-section"><h4>Límites diarios</h4><div class="form-grid">${field('Máx. pérdidas consecutivas','rm-d-consec','number',d.maxConsecutiveLosses||0,'',`min="0" step="1"`)}${field('Pérdida máxima diaria','rm-d-loss','number',d.maxLossValue||0,'',`min="0" step="any"`)}${selectObjField('Unidad del límite','rm-d-unit',units,d.maxLossUnit||'usd')}${selectObjField('Base','rm-d-basis',bases,d.maxLossBasis||'net')}${selectObjField('Tras haber ganado, primera pérdida cierra sesión','rm-d-afterwin',[{value:'false',label:'No'},{value:'true',label:'Sí'}],String(!!d.stopAfterWinThenLoss))}</div></div><div class="form-section"><h4>Límites semanales</h4><div class="form-grid">${field('Máx. días perdedores','rm-w-days','number',w.maxLosingDays||0,'',`min="0" step="1"`)}${field('Máx. pérdidas consecutivas','rm-w-consec','number',w.maxConsecutiveLosses||0,'',`min="0" step="1"`)}${field('Pérdida máxima semanal','rm-w-loss','number',w.maxLossValue||0,'',`min="0" step="any"`)}${selectObjField('Unidad del límite','rm-w-unit',units,w.maxLossUnit||'usd')}${selectObjField('Base','rm-w-basis',bases,w.maxLossBasis||'net')}</div></div><div class="notice">Un valor 0 desactiva esa regla. Las semanas se agrupan de lunes a domingo.</div>`;document.body.insertAdjacentHTML('beforeend',modalShell('Gestión de riesgo del Trading Plan',body,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveRiskManagement()">Guardar reglas</button>`));}
function saveRiskManagement(){const p=getCurrentPlan(),g=n=>document.getElementById(`f-${n}`)?.value||'';if(!p)return;p.riskManagement={daily:{maxConsecutiveLosses:Number(g('rm-d-consec'))||0,maxLossValue:Number(g('rm-d-loss'))||0,maxLossUnit:g('rm-d-unit')||'usd',maxLossBasis:g('rm-d-basis')||'net',stopAfterWinThenLoss:g('rm-d-afterwin')==='true'},weekly:{maxLosingDays:Number(g('rm-w-days'))||0,maxConsecutiveLosses:Number(g('rm-w-consec'))||0,maxLossValue:Number(g('rm-w-loss'))||0,maxLossUnit:g('rm-w-unit')||'usd',maxLossBasis:g('rm-w-basis')||'net'}};p.updatedAt=new Date().toISOString();persist();closeModal();render();}
function journalFilteredOps(){const q=String(journalViewState.q||'').toLowerCase();return currentOps().filter(o=>{if(q&&!JSON.stringify(o).toLowerCase().includes(q))return false;if(journalViewState.emotion&&!operationEmotionValues(o).includes(journalViewState.emotion))return false;if(journalViewState.behavior&&!(o.emotional?.behaviors||[]).includes(journalViewState.behavior))return false;if(journalViewState.discipline==='yes'&&!o.discipline)return false;if(journalViewState.discipline==='no'&&o.discipline)return false;if(journalViewState.status==='complete'&&!hasEmotionalEntry(o))return false;if(journalViewState.status==='pending'&&hasEmotionalEntry(o))return false;return true;}).sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate));}
function journalStats(ops){const complete=ops.filter(hasEmotionalEntry),avg=k=>complete.length?complete.reduce((a,o)=>a+(Number(o.emotional?.[k])||0),0)/complete.length:0,discipline=ops.length?ops.filter(o=>o.discipline).length/ops.length*100:0;return {complete:complete.length,completion:ops.length?complete.length/ops.length*100:0,discipline,stress:avg('stress'),focus:avg('focus'),intensity:avg('intensity'),confidence:avg('confidence')};}
function emotionalBreakdown(ops,key='emotion'){const groups=new Map();ops.forEach(o=>{const vals=key==='emotion'?operationEmotionValues(o):(o.emotional?.behaviors||[]);[...new Set(vals)].forEach(v=>{if(!groups.has(v))groups.set(v,[]);groups.get(v).push(o);});});const rows=[...groups.entries()].map(([label,x])=>({label,ops:x,s:calcMetricStats(x,'r','net')})).sort((a,b)=>b.ops.length-a.ops.length);return `<div class="emotion-break-list">${rows.length?rows.map(r=>`<button onclick="journalViewState.${key==='emotion'?'emotion':'behavior'}=decodeURIComponent('${encodeURIComponent(r.label)}');render()"><span>${esc(r.label)}</span><i><b style="width:${Math.min(100,r.ops.length/Math.max(...rows.map(x=>x.ops.length),1)*100)}%"></b></i><strong>${r.ops.length}</strong><em>${r.s.expectancy>=0?'+':''}${r.s.expectancy.toFixed(2)}R</em></button>`).join(''):'<div class="empty">Aún no hay datos emocionales.</div>'}</div>`;}
function readJournalFilters(){const v=id=>document.getElementById(id)?.value||'';journalViewState={q:v('journalQ'),emotion:v('journalEmotion'),behavior:v('journalBehavior'),discipline:v('journalDiscipline'),status:v('journalStatus')};render();}
function journal(){const p=getCurrentPlan(),ops=journalFilteredOps(),st=journalStats(ops),em=p?.emotionConfig?.emotions||[],bh=p?.emotionConfig?.behaviors||[];const sel=(id,label,arr,val)=>`<label class="filter-field"><span>${label}</span><select id="${id}" class="select" onchange="readJournalFilters()"><option value="">Todos</option>${arr.map(x=>`<option value="${esc(typeof x==='object'?x.value:x)}" ${String(val)===String(typeof x==='object'?x.value:x)?'selected':''}>${esc(typeof x==='object'?x.label:x)}</option>`).join('')}</select></label>`;return `${pageHead('Diario emocional','Una capa operativa separada del backtesting: cada trade puede registrar estado, intensidad y comportamientos sin perder su contexto técnico.',`<button class="btn" onclick="navigate('operations')">Ver laboratorio</button>`)}${activePlanBanner()}<section class="card filter-hub"><div class="filter-hub-top"><div><h3>Filtro emocional</h3><p>Los resultados técnicos permanecen vinculados a la operación original.</p></div><button class="btn small" onclick="journalViewState={q:'',emotion:'',behavior:'',discipline:'',status:''};render()">Limpiar</button></div><div class="filter-grid"><label class="filter-field wide"><span>Buscar</span><input id="journalQ" class="input" value="${esc(journalViewState.q)}" placeholder="Setup, contrato, notas…" onchange="readJournalFilters()"></label>${sel('journalEmotion','Emoción',em,journalViewState.emotion)}${sel('journalBehavior','Comportamiento',bh,journalViewState.behavior)}${sel('journalDiscipline','Disciplina',[{value:'yes',label:'Disciplinada'},{value:'no',label:'No disciplinada'}],journalViewState.discipline)}${sel('journalStatus','Estado del diario',[{value:'complete',label:'Completado'},{value:'pending',label:'Pendiente'}],journalViewState.status)}</div></section><div class="journal-kpis">${kpi('Trades visibles',ops.length,'con contexto técnico')}${kpi('Diario completado',pct(st.completion),`${st.complete}/${ops.length}`)}${kpi('Disciplina',pct(st.discipline),'sobre selección')}${kpi('Estrés medio',st.stress.toFixed(1)+'/5','trades registrados')}${kpi('Foco medio',st.focus.toFixed(1)+'/5','trades registrados')}${kpi('Intensidad',st.intensity.toFixed(1)+'/5','carga emocional')}</div><div class="grid two journal-charts"><section class="card panel"><div class="panel-title"><h3>Resultados por emoción</h3><span>Expectancy R neta</span></div>${emotionalBreakdown(ops,'emotion')}</section><section class="card panel"><div class="panel-title"><h3>Resultados por comportamiento</h3><span>Expectancy R neta</span></div>${emotionalBreakdown(ops,'behavior')}</section></div><section class="card panel" style="margin-top:16px"><div class="panel-title"><div><h3>Operaciones + diario</h3><small>Las importadas también aparecen; si no tienen diario quedan como pendientes.</small></div><span>${ops.length} operaciones</span></div>${journalTable(ops)}</section>`;}
function journalTable(ops){if(!ops.length)return '<div class="empty">No hay operaciones con estos filtros.</div>';return `<div class="table-wrap"><table class="table journal-table"><thead><tr><th>Fecha</th><th>Contrato</th><th>Dir.</th><th>Setup</th><th>Resultado</th><th>Disciplina</th><th>Antes</th><th>Durante</th><th>Después</th><th>Estrés</th><th>Foco</th><th>Impulso</th><th>Comportamientos</th><th>Diario</th></tr></thead><tbody>${ops.map(o=>{const e=o.emotional||{};return `<tr><td>${fmtDate(o.entryDate)}</td><td>${esc(o.contract||'—')}</td><td>${esc(o.direction||'—')}</td><td>${esc(o.setup||'—')}</td><td class="${Number(o.pnlNet)>=0?'positive':'negative'}">${o.riskUsd?((Number(o.pnlNet)||0)/Number(o.riskUsd)).toFixed(2)+'R':'—'}</td><td><span class="badge ${o.discipline?'win':'loss'}">${o.discipline?'Sí':'No'}</span></td><td>${esc(e.before||'—')}</td><td>${esc(e.during||'—')}</td><td>${esc(e.after||'—')}</td><td>${e.stress||'—'}</td><td>${e.focus||'—'}</td><td>${e.impulse||'—'}</td><td>${(e.behaviors||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join(' ')||'—'}</td><td><button class="btn small ${hasEmotionalEntry(o)?'':'primary'}" onclick="openEmotionalEditor('${o.id}')">${hasEmotionalEntry(o)?'Editar':'Completar'}</button></td></tr>`}).join('')}</tbody></table></div>`;}
function ratingField(label,name,value){return `<div class="field"><label>${label} · 1–5</label><input id="f-${name}" class="input" type="number" min="1" max="5" step="1" value="${value||''}"></div>`;}
function openEmotionalEditor(id){const o=state.operations.find(x=>x.id===id);if(!o)return;const p=getPlan(o.tradingPlanId),e=o.emotional||{},em=['',...(p?.emotionConfig?.emotions||[])],beh=p?.emotionConfig?.behaviors||[];const behaviors=`<div class="emotion-check-grid">${beh.map(x=>`<label><input type="checkbox" name="emotion-behavior" value="${esc(x)}" ${(e.behaviors||[]).includes(x)?'checked':''}> <span>${esc(x)}</span></label>`).join('')}</div>`;const body=`<div class="trade-context-strip"><strong>${fmtDate(o.entryDate)} · ${esc(o.contract||'—')} · ${esc(o.direction||'—')}</strong><span>${esc(o.setup||'—')} · ${esc(o.vd||'—')} · ${esc(o.riskStrategyName||'—')}</span><em class="${Number(o.pnlNet)>=0?'positive':'negative'}">${money(o.pnlNet||0,o.instrumentSnapshot?.currency||'USD')}</em></div><div class="form-section"><h4>Carga emocional</h4><div class="form-grid">${selectField('Antes de entrar','emo-before',em,e.before||'')}${selectField('Durante','emo-during',em,e.during||'')}${selectField('Después','emo-after',em,e.after||'')}${ratingField('Intensidad emocional','emo-intensity',e.intensity)}${ratingField('Estrés','emo-stress',e.stress)}${ratingField('Foco','emo-focus',e.focus)}${ratingField('Confianza','emo-confidence',e.confidence)}${ratingField('Impulsividad','emo-impulse',e.impulse)}${ratingField('Fatiga','emo-fatigue',e.fatigue)}${selectField('Disciplina','emo-discipline',['Sí','No'],o.discipline?'Sí':'No')}${field('Motivo de indisciplina','emo-disciplineReason','text',esc(o.disciplineReason||''),'span2')}</div></div><div class="form-section"><h4>Comportamientos observados</h4>${behaviors}</div><div class="form-section"><h4>Notas emocionales</h4>${field('Qué ocurrió / qué sentiste / qué repetir o evitar','emo-notes','textarea',esc(e.notes||''),'full')}</div>`;document.body.insertAdjacentHTML('beforeend',modalShell('Diario de la operación',body,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveEmotionalEditor('${id}')">Guardar diario</button>`));}
function saveEmotionalEditor(id){const o=state.operations.find(x=>x.id===id);if(!o)return;const g=n=>document.getElementById(`f-${n}`)?.value||'',num=n=>{const v=Number(g(n));return v>=1&&v<=5?v:null};o.emotional={before:g('emo-before'),during:g('emo-during'),after:g('emo-after'),intensity:num('emo-intensity'),stress:num('emo-stress'),focus:num('emo-focus'),confidence:num('emo-confidence'),impulse:num('emo-impulse'),fatigue:num('emo-fatigue'),behaviors:[...document.querySelectorAll('input[name="emotion-behavior"]:checked')].map(x=>x.value),notes:g('emo-notes'),updatedAt:new Date().toISOString()};o.discipline=g('emo-discipline')==='Sí';o.disciplineReason=g('emo-disciplineReason');persist();closeModal();render();}
function shell(){
  const p=getCurrentPlan();
  return `<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-dot"></div><div><h1>Trading Research</h1><small>Backtest & Trade Lab</small></div></div><div class="plan-switch"><label>Trading plan activo</label><select class="select" onchange="switchPlan(this.value)">${state.tradingPlans.filter(x=>x.status!=='archived'||x.id===p?.id).map(x=>`<option value="${esc(x.id)}" ${x.id===p?.id?'selected':''}>${esc(planLabel(x))}</option>`).join('')}</select></div><nav class="nav">${navBtn('dashboard','◈','Dashboard')}${navBtn('operations','▤','Operaciones')}${navBtn('gallery','▧','Biblioteca visual')}${navBtn('journal','♡','Diario emocional')}${navBtn('blocks','▦','Bloques')}${navBtn('plans','◫','Trading Plans')}${navBtn('config','⚙','Configuración')}</nav><div class="side-bottom"><div class="mini-card"><div class="mini-label">Modo actual</div><div class="mini-value">V7 · Visual Library</div><div class="help">Biblioteca visual, referencias del plan y Configuración organizada por pestañas.</div></div></div></aside><main class="main"><div id="view"></div></main></div>`;
}
function navBtn(id,icon,label){return `<button class="${currentView===id?'active':''}" onclick="navigate('${id}')"><span class="icon">${icon}</span><span>${label}</span></button>`;}
function pageHead(title,desc,actions=''){return `<div class="topbar"><div class="page-title"><h2>${title}</h2><p>${desc}</p></div><div class="actions">${actions}</div></div>`;}
function kpi(label,value,sub){return `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;}
function activePlanBanner(){const p=getCurrentPlan();return `<div class="plan-banner"><div><span class="mini-label">Dataset activo</span><strong>${esc(planLabel(p))}</strong><span>${esc(p?.description||'Sin descripción')}</span></div><button class="btn small" onclick="navigate('plans')">Cambiar / gestionar</button></div>`;}

function dashboard(){
  const ops=currentOps(),stats=calcStats(ops),bySetup={};ops.forEach(o=>bySetup[o.setup]=(bySetup[o.setup]||0)+1);const top=Object.entries(bySetup).sort((a,b)=>b[1]-a[1]).slice(0,6),max=top[0]?.[1]||1;
  const pts=stats.equity;let svg='';if(pts.length){const min=Math.min(...pts,0),maxE=Math.max(...pts,0),range=(maxE-min)||1,W=760,H=250,coords=pts.map((v,i)=>`${(i/Math.max(pts.length-1,1))*W},${H-((v-min)/range)*H}`).join(' '),area=`0,${H} ${coords} ${W},${H}`;svg=`<svg class="equity-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line class="axis" x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"/><polygon class="area" points="${area}"/><polyline class="line" points="${coords}"/></svg>`}else svg='<div class="empty">Registra o importa la primera operación de este plan para ver la curva de equity.</div>';
  return `${pageHead('Dashboard','Vista del Trading Plan seleccionado. Cada plan mantiene su dataset completamente separado.',`<button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button><button class="btn" onclick="openImportModal()">Importar Ankora</button>`)}${activePlanBanner()}<div class="kpis">${kpi('Operaciones',stats.n,'plan activo')}${kpi('Win rate',pct(stats.winRate),'resultado cerrado')}${kpi('Expectancy',`${stats.expectancy>=0?'+':''}${stats.expectancy.toFixed(2)}R`,'por operación')}${kpi('Profit Factor',stats.pf.toFixed(2),'ganancia / pérdida')}${kpi('Drawdown',`${stats.maxDD.toFixed(2)}R`,'máximo actual')}${kpi('Bloques',Math.ceil(stats.n/20),'de 20 operaciones')}</div><div class="grid two"><section class="card panel"><div class="panel-title"><h3>Equity en R</h3><span>${stats.n?`${stats.sumR>=0?'+':''}${stats.sumR.toFixed(2)}R acumulado`:'sin datos'}</span></div><div class="chart-wrap">${svg}</div></section><section class="card panel"><div class="panel-title"><h3>Operaciones por setup</h3><span>${esc(planLabel(getCurrentPlan()))}</span></div><div class="bar-list">${top.length?top.map(([k,v])=>`<div class="bar-row"><div>${esc(k||'Sin setup')}</div><div class="bar"><span style="width:${(v/max)*100}%"></span></div><div class="value-right">${v}</div></div>`).join(''):'<div class="empty">Aún no hay operaciones.</div>'}</div></section></div><div class="grid three" style="margin-top:16px"><section class="card panel"><div class="panel-title"><h3>MFE medio</h3><span>R</span></div><div class="kpi value">${stats.avgMfe.toFixed(2)}R</div><div class="help">Potencial favorable y salidas.</div></section><section class="card panel"><div class="panel-title"><h3>MAE medio</h3><span>R</span></div><div class="kpi value">${stats.avgMae.toFixed(2)}R</div><div class="help">Excursión adversa y stops.</div></section><section class="card panel"><div class="panel-title"><h3>Bloque actual</h3><span>20 trades</span></div><div class="kpi value">${stats.n?Math.floor((stats.n-1)/20)+1:0}</div><div class="help">Agrupación cronológica dentro de este plan.</div></section></div>`;
}

function operations(){
  const p=getCurrentPlan();
  return `${pageHead('Operaciones',`Registro + laboratorio interactivo de ${esc(planLabel(p))}. Filtra por tiempo, contexto y clasificación sin tocar el dataset.`,`<button class="btn" onclick="openImportModal()">Importar Ankora</button><button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button>`)}${activePlanBanner()}${operationsFilterPanel()}<div id="opsAnalyticsArea">${opsAnalyticsHtml(filteredOps())}</div>`;
}

function setBlockUnit(unit){blockViewState.unit=unit;render();}
function setBlockBasis(basis){blockViewState.basis=basis;render();}
function setBlockCommissionUnit(unit){blockViewState.commissionUnit=unit;render();}
function commissionTicksForOps(ops){return ops.reduce((a,o)=>{const tv=Number(o.instrumentSnapshot?.tickValue)||0;return a+(tv?(Number(o.commission)||0)/tv:0);},0);}
function blockCommissionText(slice){return blockViewState.commissionUnit==='ticks'?`${commissionTicksForOps(slice).toFixed(2)}t`:`${slice.reduce((a,o)=>a+(Number(o.commission)||0),0).toFixed(2)} US$`;}
function blockPeriodDays(slice){if(!slice.length)return 0;const ds=slice.map(o=>new Date(o.entryDate)).filter(d=>!isNaN(d));if(!ds.length)return 0;return Math.floor((Math.max(...ds)-Math.min(...ds))/86400000)+1;}
function blockTpAlignment(slice){const vals=slice.map(o=>{const raw=o.raw?.columns?.TPCompliance;if(raw==='True'||raw===true)return true;if(raw==='False'||raw===false)return false;return typeof o.discipline==='boolean'?o.discipline:null;}).filter(v=>v!==null);return vals.length?vals.filter(Boolean).length/vals.length*100:0;}
function blockCore(slice){
  const s=calcMetricStats(slice,blockViewState.unit,blockViewState.basis),net=calcMetricStats(slice,'usd','net');return {...s,netUsd:net.sum,rrrNet:net.payoff,periodDays:blockPeriodDays(slice),tpAlignment:blockTpAlignment(slice)};
}
function blockCard(slice,i){
  const s=blockCore(slice),from=i*20+1,to=i*20+slice.length,chrono=[...slice].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));
  return `<section class="card block-card v5-block"><div class="block-top"><div><div class="block-num">Bloque ${String(i+1).padStart(2,'0')}</div><div class="block-dates">${fmtDateOnly(chrono[0]?.entryDate)} → ${fmtDateOnly(chrono.at(-1)?.entryDate)}</div></div><div class="block-range">${from}–${to}</div></div><div class="block-spark">${lineChartSvg(s.equity,360,72,true)}</div><div class="block-core-grid"><div><span>Ops</span><strong>${s.n}</strong></div><div><span>WR</span><strong>${pct(s.winRate)}</strong></div><div><span>Resultado</span><strong class="${s.sum>=0?'positive':'negative'}">${metricStatText(s.sum,blockViewState.unit)}</strong></div><div><span>Expectancy</span><strong class="${s.expectancy>=0?'positive':'negative'}">${metricStatText(s.expectancy,blockViewState.unit)}</strong></div><div><span>PF</span><strong>${Number.isFinite(s.pf)?s.pf.toFixed(2):'∞'}</strong></div><div><span>Max DD</span><strong>${metricStatText(s.maxDD,blockViewState.unit)}</strong></div><div><span>Comisión</span><strong>${blockCommissionText(slice)}</strong></div></div><div class="block-actions"><button class="btn small primary" onclick="showBlock(${i})">Detalle + 20 operaciones</button><button class="btn small" onclick="openBlockInOperations(${i})">Filtrar en registro</button></div></section>`;
}
function blockComparisonTable(chunks){return `<section class="card panel block-compare"><div class="panel-title"><div><h3>Comparativa de bloques</h3><small>Métricas del Excel + métricas estadísticas</small></div><span>${metricUnitLabel(blockViewState.unit)} · ${blockViewState.basis==='net'?'Neto':'Bruto'}</span></div><div class="table-wrap"><table class="table block-table"><thead><tr><th>Bloque</th><th>Ops</th><th>G/P</th><th>WR</th><th>Resultado</th><th>Expectancy</th><th>PF</th><th>Máx. ganancia</th><th>Máx. pérdida</th><th>Media ganancia</th><th>Media pérdida</th><th>MDU</th><th>MDD</th><th>RRR neto</th><th>Beneficio neto</th><th>Comisiones</th><th>Alineación TP/plan</th><th>Periodo</th></tr></thead><tbody>${chunks.map((slice,i)=>{const s=blockCore(slice);return `<tr onclick="showBlock(${i})"><td><strong>B${String(i+1).padStart(2,'0')}</strong></td><td>${s.n}</td><td>${s.wins}/${s.losses}</td><td>${pct(s.winRate)}</td><td class="${s.sum>=0?'positive':'negative'}">${metricStatText(s.sum,blockViewState.unit)}</td><td>${metricStatText(s.expectancy,blockViewState.unit)}</td><td>${Number.isFinite(s.pf)?s.pf.toFixed(2):'∞'}</td><td>${metricStatText(s.maxWin,blockViewState.unit)}</td><td>${metricStatText(s.maxLoss,blockViewState.unit)}</td><td>${metricStatText(s.avgWin,blockViewState.unit)}</td><td>${metricStatText(s.avgLoss,blockViewState.unit)}</td><td>${metricStatText(s.maxDU,blockViewState.unit)}</td><td>${metricStatText(s.maxDD,blockViewState.unit)}</td><td>${s.rrrNet.toFixed(2)}</td><td>${s.netUsd>=0?'+':''}${s.netUsd.toFixed(2)} US$</td><td>${blockCommissionText(slice)}</td><td>${pct(s.tpAlignment)}</td><td>${s.periodDays} d</td></tr>`}).join('')}</tbody></table></div></section>`;}
function blocks(){
  const ops=[...currentOps()].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),chunks=Array.from({length:Math.ceil(ops.length/20)},(_,i)=>ops.slice(i*20,i*20+20));
  const switches=`<div class="metric-switch block-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${blockViewState.unit===v?'active':''}" onclick="setBlockUnit('${v}')">${l}</button>`).join('')}<i></i><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([v,l])=>`<button class="seg-btn ${blockViewState.basis===v?'active':''}" onclick="setBlockBasis('${v}')">${l}</button>`).join('')}<i></i><span>Comisión</span>${[['usd','US$'],['ticks','Ticks']].map(([v,l])=>`<button class="seg-btn ${blockViewState.commissionUnit===v?'active':''}" onclick="setBlockCommissionUnit('${v}')">${l}</button>`).join('')}</div>`;
  return `${pageHead('Bloques','Revisión cronológica de 20 operaciones con curva propia, métricas del registro original y acceso a cada trade.',`<button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button>`)}${activePlanBanner()}<div class="block-toolbar">${switches}<div class="help">Cada bloque pertenece exclusivamente a este Trading Plan.</div></div>${!ops.length?'<div class="empty">Aún no hay operaciones en este plan.</div>':`${blockViewState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="block-grid v5-block-grid">${chunks.map((slice,i)=>blockCard(slice,i)).join('')}</div>${blockComparisonTable(chunks)}`}`;
}
function showBlock(i){
  const all=[...currentOps()].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),slice=all.slice(i*20,i*20+20),s=blockCore(slice),chrono=[...slice].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));if(!slice.length)return;
  const metrics=`<div class="block-detail-kpis"><div><span>Operaciones</span><strong>${s.n}</strong></div><div><span>Ganadoras / perdedoras</span><strong>${s.wins} / ${s.losses}</strong></div><div><span>Win rate</span><strong>${pct(s.winRate)}</strong></div><div><span>Resultado</span><strong>${metricStatText(s.sum,blockViewState.unit)}</strong></div><div><span>Expectancy</span><strong>${metricStatText(s.expectancy,blockViewState.unit)}</strong></div><div><span>Profit Factor</span><strong>${Number.isFinite(s.pf)?s.pf.toFixed(2):'∞'}</strong></div><div><span>Máx. ganancia</span><strong>${metricStatText(s.maxWin,blockViewState.unit)}</strong></div><div><span>Máx. pérdida</span><strong>${metricStatText(s.maxLoss,blockViewState.unit)}</strong></div><div><span>Media ganancia</span><strong>${metricStatText(s.avgWin,blockViewState.unit)}</strong></div><div><span>Media pérdida</span><strong>${metricStatText(s.avgLoss,blockViewState.unit)}</strong></div><div><span>MDU / MDD</span><strong>${metricStatText(s.maxDU,blockViewState.unit)} / ${metricStatText(s.maxDD,blockViewState.unit)}</strong></div><div><span>RRR neto</span><strong>${s.rrrNet.toFixed(2)}</strong></div><div><span>Beneficio neto</span><strong>${s.netUsd>=0?'+':''}${s.netUsd.toFixed(2)} US$</strong></div><div><span>Comisiones</span><strong>${blockCommissionText(slice)}</strong></div><div><span>Alineación TP/plan</span><strong>${pct(s.tpAlignment)}</strong></div><div><span>Periodo</span><strong>${s.periodDays} días</strong></div></div>`;
  const body=`<div class="block-detail-head"><div><strong>Bloque ${String(i+1).padStart(2,'0')}</strong><span>${fmtDateOnly(chrono[0]?.entryDate)} → ${fmtDateOnly(chrono.at(-1)?.entryDate)}</span></div><span>${metricUnitLabel(blockViewState.unit)} · ${blockViewState.basis==='net'?'Neto':'Bruto'}</span></div>${metrics}<section class="form-section"><div class="panel-title"><h3>Curva del bloque</h3><span>${metricStatText(s.sum,blockViewState.unit)}</span></div><div class="block-detail-chart">${lineChartSvg(s.equity,900,230)}</div></section><section class="form-section"><div class="panel-title"><h3>Operaciones del bloque</h3><span>${slice.length} trades</span></div>${opsTable([...slice].sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate)),blockViewState.unit,blockViewState.basis)}</section>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(`Bloque ${String(i+1).padStart(2,'0')} · análisis`,body,`<button class="btn" onclick="closeModal()">Cerrar</button><button class="btn primary" onclick="openBlockInOperations(${i});closeModal()">Abrir filtrado en Operaciones</button>`));
}
function openBlockInOperations(i){opsViewState.block=String(i+1);currentView='operations';render();}

function plansView(){
  const cards=state.tradingPlans.map(p=>{const s=calcStats(state.operations.filter(o=>o.tradingPlanId===p.id)),imports=state.importBatches.filter(b=>b.tradingPlanId===p.id).length;return `<section class="card plan-card ${p.id===state.currentPlanId?'selected-plan':''}"><div class="plan-card-head"><div><div class="plan-title">${esc(p.name)} <span class="badge">${esc(p.version)}</span> ${p.status==='archived'?'<span class="badge">Archivado</span>':''}</div><div class="config-meta">Familia: ${esc(p.familyName||p.name)} · creado ${fmtDateOnly(p.createdAt)}</div></div>${p.id===state.currentPlanId?'<span class="badge win">Activo</span>':''}</div><p>${esc(p.description||'Sin descripción')}</p><div class="plan-metrics"><div><span>Trades</span><strong>${s.n}</strong></div><div><span>Expectancy</span><strong class="${s.expectancy>=0?'positive':'negative'}">${s.expectancy>=0?'+':''}${s.expectancy.toFixed(2)}R</strong></div><div><span>Setups</span><strong>${p.setups.length}</strong></div><div><span>Estrategias</span><strong>${p.riskStrategies.length}</strong></div><div><span>Importaciones</span><strong>${imports}</strong></div></div><div class="actions plan-actions"><button class="btn small primary" onclick="switchPlanAndOpen('${p.id}')">Abrir</button><button class="btn small" onclick="openPlanModal('${p.id}')">Editar</button><button class="btn small" onclick="openPlanModal(null,'${p.id}')">Clonar versión</button><button class="btn small" onclick="togglePlanStatus('${p.id}')">${p.status==='archived'?'Reactivar':'Archivar'}</button></div></section>`}).join('');
  const batches=[...state.importBatches].sort((a,b)=>new Date(b.importedAt)-new Date(a.importedAt));
  return `${pageHead('Trading Plans','Cada plan y versión es un experimento separado. Los contratos son globales; categorías, estrategias, operaciones e importaciones pertenecen al plan.',`<button class="btn primary" onclick="openPlanModal()">+ Nuevo plan desde cero</button>`)}<div class="plan-grid">${cards}</div><section class="card panel" style="margin-top:18px"><div class="panel-title"><div><h3>Comparación rápida de planes</h3><div class="help">Primera capa comparativa. El Laboratorio multidimensional vendrá encima de esta estructura.</div></div></div>${planComparisonTable()}</section><section class="card panel" style="margin-top:18px"><div class="panel-title"><div><h3>Historial de importaciones</h3><div class="help">Cada fichero queda identificado y asociado a un Trading Plan concreto.</div></div><button class="btn small" onclick="openImportModal()">+ Importar Ankora</button></div>${importBatchTable(batches)}</section>`;
}
function planComparisonTable(){return `<div class="table-wrap"><table class="table plan-table"><thead><tr><th>Plan</th><th>Estado</th><th>Trades</th><th>WR</th><th>Expectancy</th><th>PF</th><th>Max DD</th></tr></thead><tbody>${state.tradingPlans.map(p=>{const s=calcStats(state.operations.filter(o=>o.tradingPlanId===p.id));return `<tr><td><strong>${esc(planLabel(p))}</strong></td><td>${p.status==='archived'?'Archivado':'Activo'}</td><td>${s.n}</td><td>${pct(s.winRate)}</td><td class="${s.expectancy>=0?'positive':'negative'}">${s.expectancy>=0?'+':''}${s.expectancy.toFixed(2)}R</td><td>${s.pf.toFixed(2)}</td><td>${s.maxDD.toFixed(2)}R</td></tr>`}).join('')}</tbody></table></div>`;}
function importBatchTable(batches){if(!batches.length)return '<div class="empty">Todavía no hay importaciones registradas.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Archivo</th><th>Trading Plan</th><th>Operaciones</th><th>Nuevos datos</th><th>Advertencias</th><th>Acciones</th></tr></thead><tbody>${batches.map(b=>{const p=getPlan(b.tradingPlanId),newCount=(b.detected?.setups?.length||0)+(b.detected?.vd?.length||0)+(b.detected?.nr?.length||0)+(b.detected?.hypotheses?.length||0),warn=(b.unknownInstruments?.length||0)+(b.unmatchedStrategies||0);return `<tr><td>${fmtDate(b.importedAt)}</td><td>${esc(b.fileName)}</td><td>${esc(planLabel(p))}</td><td>${b.operationCount||0}</td><td>${newCount}</td><td>${warn}</td><td><button class="btn small" onclick="viewImportBatch('${b.id}')">Ver trades</button> <button class="btn small danger" onclick="deleteImportBatch('${b.id}')">Eliminar lote</button></td></tr>`}).join('')}</tbody></table></div>`;}
function switchPlanAndOpen(id){state.currentPlanId=id;currentView='dashboard';saveState();}
function togglePlanStatus(id){const p=getPlan(id);if(!p)return;if(p.id===state.currentPlanId&&p.status!=='archived')return alert('No puedes archivar el plan que está activo. Cambia primero a otro plan.');p.status=p.status==='archived'?'active':'archived';p.updatedAt=new Date().toISOString();saveState();}

function setConfigTab(tab){configTab=tab;render();}
function configTabs(p){const tabs=[['instruments','Contratos','Biblioteca global'],['management','Gestión','Estrategias y salidas'],['taxonomy','Taxonomías','Setup, VD, NR e hipótesis'],['visual','Referencias visuales','Ejemplos del plan'],['emotional','Emocional','Estados y comportamientos'],['riskrules','Riesgo','Reglas diarias/semanales']];return `<div class="config-tabs">${tabs.map(([id,label,desc])=>`<button class="config-tab ${configTab===id?'active':''}" onclick="setConfigTab('${id}')"><strong>${label}</strong><span>${desc}</span></button>`).join('')}</div>`;}
function configTaxonomyPanel(p){return `<div class="grid two">${configCard('Setups','Clasificaciones libres de patrón','setups')}${configCard('VD','Tipo de vela / disparador','vd')}${configCard('NR','Referencia de nivel / liquidez','nr')}<section class="card panel"><div class="panel-title"><h3>Hipótesis</h3><span>Definiciones propias del plan</span></div><div class="config-list">${(p?.hypotheses||[]).map(h=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(h.name)} <span class="badge">${esc(h.id)}</span></div><div class="config-meta">${esc(h.description||'Sin descripción')}</div></div><button class="btn small" onclick="editHyp('${h.id}')">Editar</button></div>`).join('')||'<div class="empty">Sin hipótesis configuradas.</div>'}</div><div class="inline-add"><input id="new-hypothesis" class="input" placeholder="Nombre de nueva hipótesis"><button class="btn small" onclick="addHypothesis()">Añadir</button></div></section></div>`;}
function configContent(p){if(configTab==='management')return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Regímenes / estrategias de gestión · ${esc(planLabel(p))}</h3><div class="help">Las estrategias consumen los contratos globales y construyen lotes, stops y objetivos.</div></div><button class="btn primary small" onclick="openRiskModal()">+ Nueva estrategia</button></div><div class="config-list">${(p?.riskStrategies||[]).length?p.riskStrategies.map(r=>riskCard(r)).join(''):'<div class="empty">Este plan todavía no tiene estrategias de gestión.</div>'}</div></section><div style="margin-top:16px">${configCard('Salidas discrecionales','Módulos disponibles para TP variable','discretionaryTargets')}</div>`;if(configTab==='taxonomy')return configTaxonomyPanel(p);if(configTab==='visual')return visualReferencePanel(p);if(configTab==='emotional')return emotionConfigPanel(p);if(configTab==='riskrules')return riskManagementPanel(p);return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Biblioteca global de contratos / instrumentos</h3><div class="help">Fuente única para tick size, valor del tick, comisión y moneda. Todos los Trading Plans pueden reutilizar estos contratos.</div></div><button class="btn primary small" onclick="openInstrumentModal()">+ Añadir contrato</button></div>${instrumentTable()}</section>`;}
function config(){const p=getCurrentPlan();return `${pageHead('Configuración',`Configura ${esc(planLabel(p))} por áreas sin mezclar todos los módulos en una única pantalla.`,`<button class="btn" onclick="resetPlanConfig()">Restaurar estructura base del plan</button>`)}${activePlanBanner()}${configTabs(p)}<div class="config-tab-content">${configContent(p)}</div>`;}
function instrumentTable(){if(!state.settings.instruments.length)return '<div class="empty">Añade el primer contrato para construir estrategias.</div>';return `<div class="table-wrap"><table class="table instrument-table"><thead><tr><th>Símbolo</th><th>Nombre</th><th>Tick size</th><th>Valor tick</th><th>Comisión / contrato</th><th>Comisión en ticks</th><th>Estado</th><th></th></tr></thead><tbody>${state.settings.instruments.map(i=>{const ct=Number(i.tickValue)?Number(i.commission||0)/Number(i.tickValue):0;return `<tr><td><strong>${esc(i.symbol)}</strong></td><td>${esc(i.name||'—')}</td><td>${Number(i.tickSize||0)}</td><td>${money(i.tickValue,i.currency)}</td><td>${money(i.commission,i.currency)}</td><td>${ct.toFixed(2)} ticks</td><td><span class="badge ${i.active?'win':''}">${i.active?'Activo':'Inactivo'}</span></td><td><button class="btn small" onclick="openInstrumentModal('${i.id}')">Editar</button></td></tr>`}).join('')}</tbody></table></div>`;}
function riskCard(r){const c=riskCalc(r),inst=c.inst;return `<div class="config-row risk-card"><div class="config-main"><div class="config-name">${esc(r.name)} <span class="badge">${esc(r.id)}</span> ${r.active===false?'<span class="badge">Inactiva</span>':''}</div><div class="config-meta">ATR ${r.atrMin}–${r.atrMax} · ${esc(inst?.symbol||'Sin contrato')} · ${c.contracts} contrato(s) · riesgo teórico ${money(c.riskUsd,inst?.currency)} · comisión estimada ${money(c.commission,inst?.currency)}</div><div class="chips">${(r.lots||[]).map((l,i)=>`<span class="tag">L${i+1}: ${l.quantity} ct · SL ${l.stopTicks}t · ${l.targetType==='ticks'?`TP ${l.targetTicks}t${l.stopTicks?` (${(l.targetTicks/l.stopTicks).toFixed(2)}R bruta)`:''}`:`TP ${esc(l.targetRule||'discrecional')}`}</span>`).join('')}</div></div><button class="btn small" onclick="openRiskModal('${r.id}')">Editar</button></div>`;}
function configCard(title,desc,key){const p=getCurrentPlan(),arr=p?.[key]||[];return `<section class="card panel"><div class="panel-title"><h3>${title}</h3><span>${desc}</span></div><div class="config-list">${arr.map((x,i)=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(x)}</div><div class="config-meta">Disponible dentro de ${esc(planLabel(p))}</div></div><button class="btn small danger" onclick="removeConfig('${key}',${i})">Eliminar</button></div>`).join('')||'<div class="empty">Sin categorías.</div>'}</div><div class="inline-add"><input id="new-${key}" class="input" placeholder="Añadir categoría…"><button class="btn small" onclick="addConfig('${key}')">Añadir</button></div></section>`;}
function addConfig(key){const p=getCurrentPlan(),el=document.getElementById(`new-${key}`),v=el?.value.trim();if(v&&p&&!p[key].includes(v)){p[key].push(v);p.updatedAt=new Date().toISOString();saveState();}}
function removeConfig(key,i){const p=getCurrentPlan();if(p&&confirm('¿Eliminar esta categoría de las opciones futuras de este plan? Las operaciones antiguas no se modifican.')){p[key].splice(i,1);p.updatedAt=new Date().toISOString();saveState();}}
function addHypothesis(){const p=getCurrentPlan(),el=document.getElementById('new-hypothesis'),name=el?.value.trim();if(!p||!name)return;let n=1,id='H1';while(p.hypotheses.some(h=>h.id===id)){n++;id=`H${n}`;}p.hypotheses.push({id,name,description:''});p.updatedAt=new Date().toISOString();saveState();}
function editHyp(id){const p=getCurrentPlan(),h=p?.hypotheses.find(x=>x.id===id);if(!h)return;const name=prompt('Nombre',h.name);if(name===null)return;const desc=prompt('Descripción / lógica de la hipótesis',h.description||'');h.name=name.trim()||h.name;h.description=desc??h.description;p.updatedAt=new Date().toISOString();saveState();}
function resetPlanConfig(){const p=getCurrentPlan();if(!p)return;if(confirm(`¿Restaurar la estructura base dentro de ${planLabel(p)}? Las operaciones e importaciones del plan se conservarán.`)){const base=clone(basePlanConfig);p.setups=base.setups;p.vd=base.vd;p.nr=base.nr;p.hypotheses=base.hypotheses;p.discretionaryTargets=base.discretionaryTargets;p.emotionConfig=base.emotionConfig;p.riskManagement=base.riskManagement;p.visualReferences=[];p.riskStrategies=base.riskStrategies.map(r=>normalizeRiskStrategy({...r,id:uid('R')},state.settings.instruments));p.updatedAt=new Date().toISOString();saveState();}}

function modalShell(title,body,footer){return `<div class="modal-backdrop" data-modal-locked="true"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>${title}</h3><span class="modal-lock-note" title="Esta ventana solo se cierra con sus botones de acción">● Protegido</span></div><div class="modal-body">${body}</div><div class="modal-foot">${footer}</div></div></div>`;}
function closeModal(){document.querySelector('.modal-backdrop')?.remove();editingId=null;editingInstrumentId=null;editingRiskId=null;editingPlanId=null;cloningPlanId=null;editingVisualReferenceId=null;}
function field(label,name,type,value='',span='',extra=''){return `<div class="field ${span==='full'?'full':span==='span2'?'span2':''}"><label>${label}</label>${type==='textarea'?`<textarea id="f-${name}" class="textarea" ${extra}>${value}</textarea>`:`<input id="f-${name}" class="input" type="${type}" value="${value}" ${extra}>`}</div>`;}
function selectField(label,name,options,value,extra=''){return `<div class="field"><label>${label}</label><select id="f-${name}" class="select" ${extra}>${options.map(x=>`<option value="${esc(x)}" ${String(x)===String(value)?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`;}
function selectObjField(label,name,options,value,extra=''){return `<div class="field"><label>${label}</label><select id="f-${name}" class="select" ${extra}>${options.map(x=>`<option value="${esc(x.value)}" ${String(x.value)===String(value)?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>`;}

function openPlanModal(id=null,cloneFrom=null){
  editingPlanId=id;cloningPlanId=cloneFrom;
  const source=cloneFrom?getPlan(cloneFrom):null,p=id?getPlan(id):source?{familyName:source.familyName,name:source.name,version:nextVersionLabel(source.version),description:source.description}:{familyName:'',name:'',version:'v1',description:''};
  const title=id?'Editar Trading Plan':source?'Clonar nueva versión':'Nuevo Trading Plan desde cero';
  const notice=source?`Se copiarán categorías, hipótesis, salidas y estrategias de <strong>${esc(planLabel(source))}</strong>. No se copiarán operaciones ni importaciones.`:'El nuevo plan empezará sin setups, VD, NR, hipótesis ni estrategias. Los contratos globales seguirán disponibles.';
  document.body.insertAdjacentHTML('beforeend',modalShell(title,`<form onsubmit="return false"><div class="form-section"><h4>Identidad del plan</h4><div class="form-grid">${field('Familia / sistema','plan-family','text',esc(p?.familyName||''))}${field('Nombre','plan-name','text',esc(p?.name||''))}${field('Versión','plan-version','text',esc(p?.version||'v1'))}${selectObjField('Estado','plan-status',[{value:'active',label:'Activo'},{value:'archived',label:'Archivado'}],p?.status||'active')}${field('Descripción','plan-description','textarea',esc(p?.description||''),'full')}</div><div class="notice" style="margin-top:12px">${notice}</div></div></form>`,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="savePlan()">${id?'Guardar cambios':source?'Crear versión':'Crear plan'}</button>`));
}
function savePlan(){const get=n=>document.getElementById(`f-${n}`)?.value||'',name=get('plan-name').trim(),family=get('plan-family').trim()||name,version=get('plan-version').trim()||'v1',description=get('plan-description').trim(),status=get('plan-status')||'active';if(!name)return alert('El nombre del plan es obligatorio.');if(editingPlanId){const p=getPlan(editingPlanId);if(!p)return;p.familyName=family;p.name=name;p.version=version;p.description=description;p.status=status;p.updatedAt=new Date().toISOString();}else if(cloningPlanId){const source=getPlan(cloningPlanId);if(!source)return;const p=clonePlanForVersion(source,{familyName:family,name,version,description});p.status=status;state.tradingPlans.push(p);state.currentPlanId=p.id;}else{const p=makeBlankPlan({familyName:family,name,version,description,status});state.tradingPlans.push(p);state.currentPlanId=p.id;}persist();closeModal();currentView='plans';render();}

function openInstrumentModal(id=null){editingInstrumentId=id;const i=id?getInstrument(id):{symbol:'',name:'',tickSize:'',tickValue:'',commission:'',currency:'USD',active:true};document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar contrato':'Añadir contrato',`<form onsubmit="return false"><div class="form-section"><h4>Especificaciones del contrato</h4><div class="form-grid">${field('Símbolo','ins-symbol','text',esc(i.symbol),'',`oninput="this.value=this.value.toUpperCase();refreshInstrumentCommissionTicks()"`)}${field('Nombre','ins-name','text',esc(i.name))}${field('Movimiento mínimo / tick size','ins-tickSize','number',i.tickSize,'',`step="any" oninput="refreshInstrumentCommissionTicks()"`)}${field('Valor del tick / contrato','ins-tickValue','number',i.tickValue,'',`step="any" oninput="refreshInstrumentCommissionTicks()"`)}${field('Comisión round-turn / contrato','ins-commission','number',i.commission,'',`step="any" oninput="refreshInstrumentCommissionTicks()"`)}${selectField('Moneda','ins-currency',['USD','EUR','GBP'],i.currency||'USD')}${selectObjField('Estado','ins-active',[{value:'true',label:'Activo'},{value:'false',label:'Inactivo'}],String(i.active!==false))}<div class="field"><label>Comisión equivalente</label><div id="instrumentCommissionTicks" class="readonly-box">—</div></div></div><div class="notice" style="margin-top:12px">La comisión en ticks se calcula como comisión por contrato ÷ valor del tick. Cada operación conserva un snapshot para que futuros cambios de comisión no reescriban el histórico.</div></div></form>`,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveInstrument()">Guardar contrato</button>`));setTimeout(refreshInstrumentCommissionTicks,0);}
function refreshInstrumentCommissionTicks(){const tv=Number(document.getElementById('f-ins-tickValue')?.value||0),c=Number(document.getElementById('f-ins-commission')?.value||0),el=document.getElementById('instrumentCommissionTicks');if(el)el.textContent=tv?`${(c/tv).toFixed(2)} ticks`:'—';}
function saveInstrument(){const get=n=>document.getElementById(`f-${n}`)?.value||'',symbol=get('ins-symbol').trim().toUpperCase();if(!symbol)return alert('El símbolo es obligatorio.');const duplicate=state.settings.instruments.find(i=>i.symbol.toUpperCase()===symbol&&i.id!==editingInstrumentId);if(duplicate)return alert('Ya existe un contrato con ese símbolo.');const item={id:editingInstrumentId||uid('I'),symbol,name:get('ins-name').trim(),tickSize:Number(get('ins-tickSize')||0),tickValue:Number(get('ins-tickValue')||0),commission:Number(get('ins-commission')||0),currency:get('ins-currency')||'USD',active:get('ins-active')==='true'};if(item.tickSize<=0||item.tickValue<=0)return alert('Tick size y valor del tick deben ser mayores que cero.');const idx=state.settings.instruments.findIndex(i=>i.id===item.id);if(idx>=0)state.settings.instruments[idx]=item;else state.settings.instruments.push(item);persist();closeModal();render();}

function openRiskModal(id=null){const p=getCurrentPlan();if(!p)return;editingRiskId=id;const r=id?getRisk(id,p):{id:uid('R'),name:'Nueva estrategia',atrMin:0,atrMax:0,instrumentId:state.settings.instruments.find(i=>i.active)?.id||state.settings.instruments[0]?.id||'',active:true,lots:[{id:uid('L'),quantity:1,stopTicks:10,targetType:'ticks',targetTicks:20,targetRule:''}]};const instrumentOptions=state.settings.instruments.filter(i=>i.active||i.id===r.instrumentId).map(i=>({value:i.id,label:`${i.symbol} · ${i.name||'sin nombre'}`}));document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar estrategia':'Nueva estrategia',`<form onsubmit="return false"><div class="form-section"><h4>Definición · ${esc(planLabel(p))}</h4><div class="form-grid">${field('Nombre','risk-name','text',esc(r.name))}${field('ATR mínimo','risk-atrMin','number',r.atrMin,'',`step="any"`)}${field('ATR máximo','risk-atrMax','number',r.atrMax,'',`step="any"`)}${selectObjField('Contrato','risk-instrument',instrumentOptions,r.instrumentId,`onchange="refreshRiskEditorSummary()"`)}${selectObjField('Estado','risk-active',[{value:'true',label:'Activa'},{value:'false',label:'Inactiva'}],String(r.active!==false))}</div></div><div class="form-section"><div class="section-title-row"><div><h4>Lotes de gestión</h4><div class="help">Cada lote puede tener cantidad, stop y modalidad de salida independientes.</div></div><button class="btn small" type="button" onclick="addRiskLotRow()">+ Añadir lote</button></div><div id="riskLots" class="lot-list">${(r.lots||[]).map((l,i)=>riskLotRow(l,i)).join('')}</div></div><div id="riskEditorSummary" class="strategy-summary"></div></form>`,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveRiskStrategy()">Guardar estrategia</button>`));setTimeout(()=>{refreshRiskLotVisibility();refreshRiskEditorSummary();},0);}
function riskLotRow(l,i){const p=getCurrentPlan(),targets=p?.discretionaryTargets||[];return `<div class="lot-row" data-lot-id="${esc(l.id||uid('L'))}"><div class="lot-number">Lote ${i+1}</div><div class="lot-fields"><div class="field"><label>Contratos</label><input class="input lot-qty" type="number" min="1" step="1" value="${Number(l.quantity)||1}" oninput="refreshRiskEditorSummary()"></div><div class="field"><label>Stop loss (ticks)</label><input class="input lot-stop" type="number" min="0" step="1" value="${Number(l.stopTicks)||0}" oninput="refreshRiskEditorSummary()"></div><div class="field"><label>Take profit</label><select class="select lot-target-type" onchange="refreshRiskLotVisibility();refreshRiskEditorSummary()"><option value="ticks" ${l.targetType!=='discretionary'?'selected':''}>Por ticks</option><option value="discretionary" ${l.targetType==='discretionary'?'selected':''}>Módulo discrecional</option></select></div><div class="field lot-fixed"><label>TP fijo (ticks)</label><input class="input lot-target-ticks" type="number" min="0" step="1" value="${Number(l.targetTicks)||0}" oninput="refreshRiskEditorSummary()"></div><div class="field lot-disc"><label>Módulo de salida</label><select class="select lot-target-rule" onchange="refreshRiskEditorSummary()">${targets.map(x=>`<option value="${esc(x)}" ${x===l.targetRule?'selected':''}>${esc(x)}</option>`).join('')}</select></div></div><div class="lot-actions"><div class="lot-r" data-lot-r>—</div><button class="btn small danger" type="button" onclick="removeRiskLotRow(this)">Eliminar</button></div></div>`;}
function addRiskLotRow(){const box=document.getElementById('riskLots'),p=getCurrentPlan();if(!box)return;const count=box.querySelectorAll('.lot-row').length;box.insertAdjacentHTML('beforeend',riskLotRow({id:uid('L'),quantity:1,stopTicks:10,targetType:'ticks',targetTicks:20,targetRule:p?.discretionaryTargets?.[0]||''},count));refreshRiskLotVisibility();refreshRiskEditorSummary();}
function removeRiskLotRow(btn){const rows=document.querySelectorAll('#riskLots .lot-row');if(rows.length<=1)return alert('Una estrategia debe tener al menos un lote.');btn.closest('.lot-row')?.remove();renumberRiskLots();refreshRiskEditorSummary();}
function renumberRiskLots(){document.querySelectorAll('#riskLots .lot-row').forEach((r,i)=>{const el=r.querySelector('.lot-number');if(el)el.textContent=`Lote ${i+1}`;});}
function refreshRiskLotVisibility(){document.querySelectorAll('#riskLots .lot-row').forEach(row=>{const type=row.querySelector('.lot-target-type')?.value;row.querySelector('.lot-fixed')?.classList.toggle('hidden',type!=='ticks');row.querySelector('.lot-disc')?.classList.toggle('hidden',type!=='discretionary');});}
function readRiskLots(){return [...document.querySelectorAll('#riskLots .lot-row')].map((row,i)=>({id:row.dataset.lotId||uid('L'),quantity:Number(row.querySelector('.lot-qty')?.value||0),stopTicks:Number(row.querySelector('.lot-stop')?.value||0),targetType:row.querySelector('.lot-target-type')?.value||'ticks',targetTicks:Number(row.querySelector('.lot-target-ticks')?.value||0),targetRule:row.querySelector('.lot-target-rule')?.value||''}));}
function refreshRiskEditorSummary(){const instrumentId=document.getElementById('f-risk-instrument')?.value,inst=getInstrument(instrumentId),lots=readRiskLots();let contracts=0,riskTicks=0,fixedTicks=0,variable=false;lots.forEach((l,i)=>{contracts+=l.quantity;riskTicks+=l.quantity*l.stopTicks;if(l.targetType==='ticks')fixedTicks+=l.quantity*l.targetTicks;else variable=true;const rEl=document.querySelectorAll('[data-lot-r]')[i];if(rEl)rEl.textContent=l.targetType==='ticks'&&l.stopTicks?`${(l.targetTicks/l.stopTicks).toFixed(2)}R bruta`:'R variable';});const riskUsd=riskTicks*(Number(inst?.tickValue)||0),fixedUsd=fixedTicks*(Number(inst?.tickValue)||0),comm=contracts*(Number(inst?.commission)||0),el=document.getElementById('riskEditorSummary');if(el)el.innerHTML=`<div><span>Contrato</span><strong>${esc(inst?.symbol||'—')}</strong></div><div><span>Contratos totales</span><strong>${contracts}</strong></div><div><span>Riesgo máximo</span><strong>${money(riskUsd,inst?.currency)}</strong></div><div><span>Comisión estimada</span><strong>${money(comm,inst?.currency)}</strong></div><div><span>Reward fijo conocido</span><strong>${money(fixedUsd,inst?.currency)}${variable?' + variable':''}</strong></div><div><span>R bruta conocida</span><strong>${riskTicks?(fixedTicks/riskTicks).toFixed(2):'0.00'}R${variable?' + variable':''}</strong></div>`;}
function saveRiskStrategy(){const p=getCurrentPlan(),get=n=>document.getElementById(`f-${n}`)?.value||'',lots=readRiskLots();if(!p)return;if(!get('risk-name').trim())return alert('El nombre es obligatorio.');if(!get('risk-instrument'))return alert('Selecciona un contrato.');if(!lots.length||lots.some(l=>l.quantity<=0||l.stopTicks<0||(l.targetType==='ticks'&&l.targetTicks<0)))return alert('Revisa los lotes.');const item={id:editingRiskId||uid('R'),name:get('risk-name').trim(),atrMin:Number(get('risk-atrMin')||0),atrMax:Number(get('risk-atrMax')||0),instrumentId:get('risk-instrument'),active:get('risk-active')==='true',lots};const idx=p.riskStrategies.findIndex(r=>r.id===item.id);if(idx>=0)p.riskStrategies[idx]=item;else p.riskStrategies.push(item);p.updatedAt=new Date().toISOString();persist();closeModal();render();}

function openOperationModal(id=null){const p=getCurrentPlan();if(!p)return;if(!(p.riskStrategies||[]).length)return alert('Este Trading Plan todavía no tiene estrategias de gestión. Configura al menos una estrategia antes de registrar operaciones.');editingId=id;const o=id?state.operations.find(x=>x.id===id):null;if(o&&o.tradingPlanId!==p.id)return alert('Esa operación pertenece a otro Trading Plan. Abre primero ese plan.');const r=o?.riskStrategyId?getRisk(o.riskStrategyId,p):p.riskStrategies.find(x=>x.active)||p.riskStrategies[0];document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar operación':'Nueva operación',operationForm(o,r,p),`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveOperationFromForm()">Guardar operación</button>`));setTimeout(()=>{applyRiskToOperation(false);hydrateImageElements();},0);}
function operationForm(o,r,p){const v=(k,d='')=>esc(o?.[k]??d),riskOptions=p.riskStrategies.filter(x=>x.active||x.id===o?.riskStrategyId).map(x=>({value:x.id,label:x.name})),hypOpts=(p.hypotheses||[]).map(x=>({value:x.id,label:x.name}));return `<form id="operationForm" onsubmit="return false"><div class="form-section"><h4>0 · Trading Plan</h4><div class="plan-readonly"><strong>${esc(planLabel(p))}</strong><span>${esc(p.description||'Sin descripción')}</span></div></div><div class="form-section"><h4>1 · Sesión y régimen</h4><div class="form-grid">${field('Fecha/hora de entrada','entryDate','datetime-local',v('entryDate',new Date().toISOString().slice(0,16)))}${field('Fecha/hora de salida','exitDate','datetime-local',v('exitDate',''))}${selectField('Muestra','sample',['A','B'],v('sample','B'))}${selectObjField('Régimen de gestión','riskStrategyId',riskOptions,o?.riskStrategyId||r?.id,`onchange="applyRiskToOperation(true)"`)}${field('ATR observado (opcional)','atr','number',v('atr',''),'','step="any"')}${hypOpts.length?selectObjField('Hipótesis','hypothesis',hypOpts,v('hypothesis',hypOpts[0]?.value||'')):field('Hipótesis','hypothesis','text',v('hypothesis',''))}${field('Contexto H4','h4Context','text',v('h4Context',''))}${selectField('Fase H4','h4Phase',['Impulso','Retroceso','No definida'],v('h4Phase','Impulso'))}</div><div id="opRiskPreview" class="strategy-preview"></div></div><div class="form-section"><h4>2 · Oportunidad</h4><div class="form-grid">${p.setups.length?selectField('Setup','setup',p.setups,v('setup',p.setups[0])):field('Setup','setup','text',v('setup',''))}${p.vd.length?selectField('VD','vd',p.vd,v('vd',p.vd[0])):field('VD','vd','text',v('vd',''))}${p.nr.length?selectField('NR','nr',p.nr,v('nr',p.nr[0])):field('NR','nr','text',v('nr',''))}${selectField('Tipo de operación','tradeType',['Rápida','Liquidez','Otra'],v('tradeType','Rápida'))}${selectField('Dirección','direction',['LONG','SHORT'],v('direction','LONG'))}${field('Timeframe','timeframe','text',v('timeframe','5M'))}${field('Precio dinámico / objetivo','dtPrice','number',v('dtPrice',''),'','step="any"')}${field('Notas','notes','textarea',v('notes',''),'full')}</div></div><div class="form-section"><h4>3 · Ejecución y resultado</h4><div class="form-grid">${field('Contrato / vencimiento','contract','text',v('contract',getInstrument(r?.instrumentId)?.symbol||''))}${field('Contratos totales','contracts','number',v('contracts',riskCalc(r).contracts),'','readonly')}${selectField('Tipo de entrada','entryType',['LMT','STP'],v('entryType','LMT'))}${field('Precio de entrada','entryPrice','number',v('entryPrice',''),'','step="any"')}${field('Ticks resultado agregados','resultTicks','number',v('resultTicks',''),'','step="any" oninput="recalcOperation()"')}${field('Comisiones','commission','number',v('commission',''),'','readonly step="any"')}${field('P&L bruto','pnlGross','number',v('pnlGross',''),'','readonly step="any"')}${field('P&L neto','pnlNet','number',v('pnlNet',''),'','readonly step="any"')}${field('R múltiple bruta','rMultiple','number',v('rMultiple',''),'','readonly step="any"')}${field('MFE (R)','mfe','number',v('mfe',''),'','step="any"')}${field('MAE (R)','mae','number',v('mae',''),'','step="any"')}${selectField('Disciplina','discipline',['Sí','No'],v('discipline','Sí'))}${field('Motivo de indisciplina','disciplineReason','text',v('disciplineReason',''),'span2')}<div class="field span2"><label>Nuevas capturas</label><input id="screens" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="image-upload-meta"><select id="screenCategory" class="select">${imageLabelOptions('Contexto')}</select><input id="screenCaption" class="input" placeholder="Nota común para estas imágenes (opcional)"></div><div class="help">Puedes añadir varias imágenes. Se guardan localmente en IndexedDB hasta conectar Supabase.</div>${o?.images?.length?`<div class="existing-images"><span>${o.images.length} imagen(es) ya asociadas</span><div class="thumb-strip">${o.images.map(x=>imageThumb(x,'mini')).join('')}</div></div>`:''}</div></div><div class="notice" style="margin-top:12px">La R mostrada aquí es bruta: relación entre ticks obtenidos y riesgo inicial. Las comisiones se conservan separadas para las métricas netas.</div></div></form>`;}
function applyRiskToOperation(overwrite=true){const p=getCurrentPlan(),risk=getRisk(document.getElementById('f-riskStrategyId')?.value,p),c=riskCalc(risk),inst=c.inst;if(!risk)return;const preview=document.getElementById('opRiskPreview');if(preview)preview.innerHTML=`<strong>${esc(risk.name)}</strong> · ${esc(inst?.symbol||'—')} · ${c.contracts} contratos · riesgo ${money(c.riskUsd,inst?.currency)} · comisión estimada ${money(c.commission,inst?.currency)}<div class="chips">${risk.lots.map((l,i)=>`<span class="tag">L${i+1}: ${l.quantity} ct · SL ${l.stopTicks}t · ${l.targetType==='ticks'?`TP ${l.targetTicks}t`:esc(l.targetRule)}</span>`).join('')}</div>`;const set=(n,val,force=overwrite)=>{const el=document.getElementById(`f-${n}`);if(el&&(force||!el.value))el.value=val??'';};set('contracts',c.contracts,true);set('commission',c.commission,true);if(overwrite){const contractEl=document.getElementById('f-contract');if(contractEl&&(contractEl.value.trim()===''||/^[A-Z0-9]+(?:\s+\d{2}-\d{2})?$/.test(contractEl.value.trim())))contractEl.value=inst?.symbol||'';}recalcOperation();}
function recalcOperation(){const p=getCurrentPlan(),risk=getRisk(document.getElementById('f-riskStrategyId')?.value,p),c=riskCalc(risk),ticks=Number(document.getElementById('f-resultTicks')?.value||0),tv=Number(c.inst?.tickValue)||0,gross=ticks*tv,net=gross-c.commission,r=c.riskTickExposure?ticks/c.riskTickExposure:0;const set=(n,val)=>{const el=document.getElementById(`f-${n}`);if(el)el.value=Number.isFinite(val)?Number(val.toFixed(4)):'';};set('commission',c.commission);set('pnlGross',gross);set('pnlNet',net);set('rMultiple',r);}
async function saveOperationFromForm(){const p=getCurrentPlan(),get=n=>document.getElementById(`f-${n}`)?.value||'',risk=getRisk(get('riskStrategyId'),p),c=riskCalc(risk),inst=c.inst,ticks=Number(get('resultTicks')||0),gross=ticks*(Number(inst?.tickValue)||0),commission=c.commission,net=gross-commission,rMultiple=c.riskTickExposure?ticks/c.riskTickExposure:0,result=ticks>0?'win':ticks<0?'loss':'pending',previous=state.operations.find(x=>x.id===(editingId||'')),images=clone(previous?.images||[]);const files=[...(document.getElementById('screens')?.files||[])],label=document.getElementById('screenCategory')?.value||'Contexto',caption=document.getElementById('screenCaption')?.value?.trim()||'';for(const file of files){const id=uid('IMG');await storeImageFile(file,id);images.push({id,label,caption:caption||file.name,name:file.name,type:file.type,createdAt:new Date().toISOString()});}const op={id:editingId||uid('op'),tradingPlanId:p.id,tradingPlanName:p.name,tradingPlanVersion:p.version,tradingPlanSnapshot:planSnapshot(p),entryDate:get('entryDate'),exitDate:get('exitDate'),sample:get('sample'),riskStrategyId:risk?.id||'',riskStrategyName:risk?.name||'',strategyPlanSnapshot:strategySnapshot(risk),instrumentId:inst?.id||'',instrumentSnapshot:instrumentSnapshot(inst),atr:Number(get('atr')||0)||null,hypothesis:get('hypothesis'),h4Context:get('h4Context'),h4Phase:get('h4Phase'),setup:get('setup'),vd:get('vd'),nr:get('nr'),tradeType:get('tradeType'),direction:get('direction'),timeframe:get('timeframe'),dtPrice:Number(get('dtPrice')||0)||null,notes:get('notes'),contract:get('contract'),contracts:c.contracts,entryType:get('entryType'),entryPrice:Number(get('entryPrice')||0)||null,resultTicks:ticks,riskTickExposure:c.riskTickExposure,riskUsd:c.riskUsd,pnlGross:gross,commission,pnlNet:net,mfe:Number(get('mfe')||0)||0,mae:Number(get('mae')||0)||0,discipline:get('discipline')==='Sí',disciplineReason:get('disciplineReason'),result,rMultiple,emotional:clone(previous?.emotional||{}),images,raw:previous?.raw||{source:'manual'},updatedAt:new Date().toISOString()};const idx=state.operations.findIndex(x=>x.id===op.id);if(idx>=0)state.operations[idx]=op;else state.operations.push(op);persist();closeModal();render();}
function editOperation(id){const o=state.operations.find(x=>x.id===id);if(!o)return;if(o.tradingPlanId!==state.currentPlanId){state.currentPlanId=o.tradingPlanId;persist();render();setTimeout(()=>openOperationModal(id),0);}else openOperationModal(id);}
function viewOperation(id){const o=state.operations.find(x=>x.id===id);if(!o)return;const p=getPlan(o.tradingPlanId),currency=o.instrumentSnapshot?.currency||'USD',body=`<div class="trade-detail-hero"><div><span>${fmtDate(o.entryDate)}</span><h3>${esc(o.contract||o.instrumentSnapshot?.symbol||'Trade')} · ${esc(o.direction||'—')}</h3><p>${esc(o.setup||'—')} · ${esc(o.vd||'—')} · ${esc(o.nr||'—')} · ${esc(o.hypothesis||'—')}</p></div><div class="trade-detail-result ${Number(o.rMultiple)>=0?'positive':'negative'}">${Number(o.rMultiple)>=0?'+':''}${Number(o.rMultiple||0).toFixed(2)}R <small>${money(o.pnlNet||0,currency)} neto</small></div></div><div class="trade-detail-kpis"><div><span>Ticks</span><strong>${Number(o.resultTicks)>=0?'+':''}${Number(o.resultTicks||0).toFixed(1)}t</strong></div><div><span>Comisión</span><strong>${money(o.commission||0,currency)}</strong></div><div><span>Régimen</span><strong>${esc(o.riskStrategyName||'—')}</strong></div><div><span>Disciplina</span><strong>${o.discipline?'Sí':'No'}</strong></div><div><span>MFE</span><strong>${Number(o.mfe||0).toFixed(2)}R</strong></div><div><span>MAE</span><strong>${Number(o.mae||0).toFixed(2)}R</strong></div></div><section class="form-section"><div class="panel-title"><div><h3>Contexto técnico</h3><small>${esc(planLabel(p))}</small></div></div><div class="trade-facts"><div><span>Contexto H4</span><strong>${esc(o.h4Context||'—')}</strong></div><div><span>Fase H4</span><strong>${esc(o.h4Phase||'—')}</strong></div><div><span>Tipo de operación</span><strong>${esc(o.tradeType||'—')}</strong></div><div><span>Timeframe</span><strong>${esc(o.timeframe||'—')}</strong></div><div><span>Notas</span><strong>${esc(o.notes||'—')}</strong></div></div></section><section class="form-section"><div class="panel-title"><div><h3>Capturas de la operación</h3><small>${(o.images||[]).length} imagen(es)</small></div></div>${operationImagesHtml(o)}</section><section class="form-section"><div class="panel-title"><div><h3>Referencias visuales relacionadas</h3><small>Ejemplos del Trading Plan para este Setup / VD / NR / contexto.</small></div></div>${relatedReferenceHtml(o)}</section>`;document.body.insertAdjacentHTML('beforeend',modalShell('Ficha visual de operación',body,`<button class="btn" onclick="closeModal()">Cerrar</button><button class="btn primary" onclick="closeModal();editOperation('${id}')">Editar operación</button>`));setTimeout(hydrateImageElements,0);}

function openImportModal(){const p=getCurrentPlan();const options=state.tradingPlans.filter(x=>x.status!=='archived').map(x=>({value:x.id,label:planLabel(x)}));document.body.insertAdjacentHTML('beforeend',modalShell('Importar backtest de Ankora',`<div class="form-section"><h4>Destino de la importación</h4><div class="form-grid">${selectObjField('Trading Plan','import-plan',options,p?.id||options[0]?.value)}<div class="field span2"><label>Qué hará la aplicación</label><div class="readonly-box">El fichero se guardará como un lote de importación independiente. Todos sus trades quedarán asociados al plan seleccionado.</div></div></div><div class="notice" style="margin-top:12px">Si el fichero contiene Setup, VD, NR o Hipótesis nuevos, se añadirán solamente a ese Trading Plan. Los contratos siguen saliendo de la biblioteca global.</div></div>`,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="startImportSelection()">Elegir fichero</button>`));}
function startImportSelection(){pendingImportPlanId=document.getElementById('f-import-plan')?.value||state.currentPlanId;document.querySelector('.modal-backdrop')?.remove();document.getElementById('importFile').click();}
function matchImportedStrategy(plan,src,symbol){const totalQty=Number(src.TotQuantity)||(Number(src.Lot1Quantity)||0)+(Number(src.Lot2Quantity)||0),stop=Number(src.StopLossTicks)||0;const byInstrument=(plan.riskStrategies||[]).filter(r=>getInstrument(r.instrumentId)?.symbol.toUpperCase()===symbol.toUpperCase()&&riskCalc(r).contracts===totalQty);const strict=byInstrument.filter(r=>(r.lots||[]).every(l=>Number(l.stopTicks)===stop));if(strict.length===1)return strict[0];if(byInstrument.length===1)return byInstrument[0];return null;}
function ensureImportedCategories(plan,src,detected){for(const [key,val] of [['setups',src.Setup],['vd',src.VD],['nr',src.NR]]){const v=String(val||'').trim();if(v&&!plan[key].includes(v)){plan[key].push(v);detected[key].push(v);}}const hNum=String(src.Hypothesis||'').trim();if(hNum){const id=hNum.startsWith('H')?hNum:`H${hNum}`;if(!plan.hypotheses.some(h=>h.id===id)){plan.hypotheses.push({id,name:`Hipótesis ${hNum.replace(/^H/,'')}`,description:'Detectada automáticamente durante una importación de Ankora.'});detected.hypotheses.push(id);}}}
function handleImport(file){const plan=getPlan(pendingImportPlanId||state.currentPlanId);pendingImportPlanId=null;if(!plan)return alert('No se encontró el Trading Plan seleccionado.');const reader=new FileReader();reader.onload=()=>{try{const text=String(reader.result).replace(/^\uFEFF/,'').trim(),lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('No hay filas de datos');const header=lines[0].split('|'),batchId=uid('BATCH'),detected={setups:[],vd:[],nr:[],hypotheses:[]},unknownInstruments=new Set();let unmatchedStrategies=0;const rows=lines.slice(1).map(line=>{const vals=line.split('|'),raw={source:'ankora',line},src={};header.forEach((h,i)=>src[h]=vals[i]??'');ensureImportedCategories(plan,src,detected);const symbol=String(src.Contract||'').trim().split(/\s+/)[0].toUpperCase(),inst=state.settings.instruments.find(i=>i.symbol.toUpperCase()===symbol);if(!inst&&symbol)unknownInstruments.add(symbol);const matchedRisk=matchImportedStrategy(plan,src,symbol);if(!matchedRisk)unmatchedStrategies++;const q1=Number(src.Lot1Quantity)||0,q2=Number(src.Lot2Quantity)||0,t1=Number(src.Lot1Ticks)||0,t2=Number(src.Lot2Ticks)||0,totalQty=Number(src.TotQuantity)||q1+q2,resultTickExposure=t1*q1+t2*q2,stop=Number(src.StopLossTicks)||0,c=matchedRisk?riskCalc(matchedRisk):null,riskTickExposure=matchedRisk?c.riskTickExposure:stop*totalQty,commission=(Number(inst?.commission)||0)*totalQty,pnlGross=resultTickExposure*(Number(inst?.tickValue)||0),pnlNet=pnlGross-commission,rMultiple=riskTickExposure?resultTickExposure/riskTickExposure:0,hyp=src.Hypothesis?(String(src.Hypothesis).startsWith('H')?String(src.Hypothesis):`H${src.Hypothesis}`):'';return {id:uid('imp'),tradingPlanId:plan.id,tradingPlanName:plan.name,tradingPlanVersion:plan.version,tradingPlanSnapshot:planSnapshot(plan),importBatchId:batchId,raw,entryDate:parseDateTime(src.EntryDateTime),exitDate:parseDateTime(src.ExitDateTime),direction:src.BuySell==='BUY'?'LONG':src.BuySell==='SELL'?'SHORT':src.BuySell,contract:src.Contract,timeframe:src.TimeFrame,contracts:totalQty,setup:src.Setup,vd:src.VD,nr:src.NR,hypothesis:hyp,resultTicks:resultTickExposure,riskTickExposure,riskUsd:riskTickExposure*(Number(inst?.tickValue)||0),instrumentId:inst?.id||'',instrumentSnapshot:instrumentSnapshot(inst),commission,pnlGross,pnlNet,rMultiple,result:resultTickExposure>0?'win':resultTickExposure<0?'loss':'pending',riskStrategyId:matchedRisk?.id||'',riskStrategyName:matchedRisk?.name||'No clasificada',strategyPlanSnapshot:matchedRisk?strategySnapshot(matchedRisk):null,h4Context:src.Custom1||'',tradeType:src.Custom2||'',notes:src.Notes||'',mfe:0,mae:0,sample:'',discipline:src.TPCompliance==='True',emotional:{}};});const batch={id:batchId,tradingPlanId:plan.id,fileName:file.name,importedAt:new Date().toISOString(),operationCount:rows.length,detected,unknownInstruments:[...unknownInstruments],unmatchedStrategies};state.operations.push(...rows);state.importBatches.push(batch);plan.updatedAt=new Date().toISOString();state.currentPlanId=plan.id;persist();alert(`Importación completada: ${rows.length} operación(es) en ${planLabel(plan)}.\nNuevas categorías: ${detected.setups.length+detected.vd.length+detected.nr.length+detected.hypotheses.length}.\nInstrumentos no configurados: ${unknownInstruments.size}.\nEstrategias no clasificadas: ${unmatchedStrategies}.`);currentView='operations';render();}catch(e){alert('No se pudo importar: '+e.message);}};reader.readAsText(file,'utf-8');}
function viewImportBatch(id){const b=state.importBatches.find(x=>x.id===id);if(!b)return;state.currentPlanId=b.tradingPlanId;currentView='operations';persist();render();setTimeout(()=>document.getElementById('opsTable').innerHTML=opsTable(state.operations.filter(o=>o.importBatchId===id).sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate))),0);}
function deleteImportBatch(id){const b=state.importBatches.find(x=>x.id===id);if(!b)return;if(!confirm(`¿Eliminar la importación ${b.fileName} y sus ${b.operationCount} operaciones? Esta acción solo afecta a ese lote importado.`))return;state.operations=state.operations.filter(o=>o.importBatchId!==id);state.importBatches=state.importBatches.filter(x=>x.id!==id);saveState();}
function parseDateTime(v){if(!v)return '';const [date,time='00:00:00']=String(v).split(' '),[dd,mm,yyyy]=date.split('/');return `${yyyy}-${mm}-${dd}T${time.slice(0,5)}`;}



/* V4 · Import Inspector: staging, auditoría RAW/normalizada y edición post-importación */
const ANKORA_COLUMN_MAP = {
  EntryDateTime:'Fecha/hora de entrada', BuySell:'Dirección', TotQuantity:'Contratos totales', Setup:'Setup / patrón',
  Lot1Ticks:'Lote 1 · ticks realizados', Lot2Ticks:'Lote 2 · ticks realizados', ExitDateTime:'Fecha/hora de salida',
  LmtStp:'Tipo de entrada', EntryPrice:'Precio de entrada', StopLossTicks:'Stop común (ticks)', BETrigger:'BE trigger', BEPlus:'BE plus',
  Lot1Quantity:'Lote 1 · cantidad', Lot1Type:'Lote 1 · gestión', Lot1TargetTicks:'Lote 1 · TP previsto', Lot1ExitPrice:'Lote 1 · precio salida', Lot1ExitDateTime:'Lote 1 · hora salida',
  Lot2Quantity:'Lote 2 · cantidad', Lot2Type:'Lote 2 · gestión', Lot2TargetTicks:'Lote 2 · TP previsto', Lot2ExitPrice:'Lote 2 · precio salida', Lot2ExitDateTime:'Lote 2 · hora salida',
  NR:'NR / referencia', VD:'VD / vela disparadora', FV:'Falta de volumen', TPCompliance:'Cumplimiento TP', Hypothesis:'Hipótesis', DTPrice:'Dynamic Target Price',
  Custom1:'Contexto / Custom 1', Custom2:'Tipo de operación / Custom 2', Notes:'Notas', Contract:'Contrato', TimeFrame:'Timeframe'
};
function nnum(v){const x=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(x)?x:0;}
function nullableImportDate(v){const x=String(v||'').trim();return (!x||x.startsWith('01/01/0001'))?'':parseDateTime(x);}
function importKey(src){return [src.EntryDateTime,src.BuySell,src.Contract,src.EntryPrice,src.Setup,src.TotQuantity].map(x=>String(x||'').trim()).join('|');}
function collectPreviewCategories(plan,drafts){
  const d={setups:[],vd:[],nr:[],hypotheses:[]};
  for(const x of drafts.filter(r=>r.include)){
    if(x.setup&&!plan.setups.includes(x.setup)&&!d.setups.includes(x.setup))d.setups.push(x.setup);
    if(x.vd&&!plan.vd.includes(x.vd)&&!d.vd.includes(x.vd))d.vd.push(x.vd);
    if(x.nr&&!plan.nr.includes(x.nr)&&!d.nr.includes(x.nr))d.nr.push(x.nr);
    if(x.hypothesis&&!plan.hypotheses.some(h=>h.id===x.hypothesis)&&!d.hypotheses.includes(x.hypothesis))d.hypotheses.push(x.hypothesis);
  }
  return d;
}
function makeImportDraft(src,plan,line,rowIndex){
  const symbol=String(src.Contract||'').trim().split(/\s+/)[0].toUpperCase();
  const inst=state.settings.instruments.find(i=>i.symbol.toUpperCase()===symbol);
  const matchedRisk=matchImportedStrategy(plan,src,symbol);
  const q1=nnum(src.Lot1Quantity),q2=nnum(src.Lot2Quantity),t1=nnum(src.Lot1Ticks),t2=nnum(src.Lot2Ticks);
  const totalQty=nnum(src.TotQuantity)||(q1+q2), stop=nnum(src.StopLossTicks), resultTickExposure=t1*q1+t2*q2;
  const hyp=src.Hypothesis?(String(src.Hypothesis).startsWith('H')?String(src.Hypothesis):`H${src.Hypothesis}`):'';
  const lots=[];
  if(q1||String(src.Lot1Type||'').trim()) lots.push({number:1,quantity:q1,type:String(src.Lot1Type||'').trim(),targetTicks:String(src.Lot1Type||'').toUpperCase()==='MANUAL'?null:nnum(src.Lot1TargetTicks),realizedTicks:t1,exitPrice:nnum(src.Lot1ExitPrice)||null,exitDate:nullableImportDate(src.Lot1ExitDateTime),stopTicks:stop});
  if(q2||String(src.Lot2Type||'').trim()) lots.push({number:2,quantity:q2,type:String(src.Lot2Type||'').trim(),targetTicks:String(src.Lot2Type||'').toUpperCase()==='MANUAL'?null:nnum(src.Lot2TargetTicks),realizedTicks:t2,exitPrice:nnum(src.Lot2ExitPrice)||null,exitDate:nullableImportDate(src.Lot2ExitDateTime),stopTicks:stop});
  return {rowIndex,include:true,src,line,key:importKey(src),entryDate:parseDateTime(src.EntryDateTime),exitDate:parseDateTime(src.ExitDateTime),direction:src.BuySell==='BUY'?'LONG':src.BuySell==='SELL'?'SHORT':src.BuySell,contract:src.Contract||'',symbol,timeframe:src.TimeFrame||'',contracts:totalQty,setup:src.Setup||'',vd:src.VD||'',nr:src.NR||'',hypothesis:hyp,h4Context:src.Custom1||'',tradeType:src.Custom2||'',notes:src.Notes||'',entryType:src.LmtStp||'',entryPrice:nnum(src.EntryPrice)||null,stopTicks:stop,resultTicks:resultTickExposure,lots,instrumentId:inst?.id||'',riskStrategyId:matchedRisk?.id||'',riskStrategyName:matchedRisk?.name||'No clasificada',unknownInstrument:!inst&&!!symbol,possibleUpdate:false};
}
function buildPreviewFromText(text,file,plan){
  const lines=String(text).replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('No hay filas de datos');
  const headers=lines[0].split('|').map(x=>x.trim());
  const drafts=lines.slice(1).map((line,i)=>{const vals=line.split('|'),src={};headers.forEach((h,j)=>src[h]=vals[j]??'');return makeImportDraft(src,plan,line,i+1);});
  const groups={};drafts.forEach(d=>(groups[d.key]??=[]).push(d));Object.values(groups).filter(g=>g.length>1).forEach(g=>g.forEach((d,i)=>{d.possibleUpdate=true;d.updateOrder=i+1;d.updateCount=g.length;}));
  return {fileName:file.name,planId:plan.id,headers,drafts,createdAt:new Date().toISOString()};
}
function importColumnMapTable(headers){return `<div class="table-wrap compact-map"><table class="table"><thead><tr><th>Columna TXT</th><th>Interpretación en la app</th><th>Estado</th></tr></thead><tbody>${headers.map(h=>`<tr><td><code>${esc(h)}</code></td><td>${esc(ANKORA_COLUMN_MAP[h]||'Se conserva en RAW; aún sin mapeo analítico')}</td><td><span class="badge ${ANKORA_COLUMN_MAP[h]?'win':''}">${ANKORA_COLUMN_MAP[h]?'Mapeada':'RAW'}</span></td></tr>`).join('')}</tbody></table></div>`;}
function importPreviewRow(d,i,plan){
  const risks=(plan.riskStrategies||[]).map(r=>`<option value="${esc(r.id)}" ${r.id===d.riskStrategyId?'selected':''}>${esc(r.name)}</option>`).join('');
  const l1=d.lots.find(l=>l.number===1),l2=d.lots.find(l=>l.number===2);
  return `<tr class="${d.possibleUpdate?'import-warning-row':''}"><td><input type="checkbox" ${d.include?'checked':''} onchange="updatePreviewField(${i},'include',this.checked)"></td><td>${d.rowIndex}${d.possibleUpdate?` <span class="badge warn">${d.updateOrder}/${d.updateCount} misma entrada</span>`:''}</td><td>${fmtDate(d.entryDate)}</td><td>${esc(d.direction)}</td><td><input class="input compact-input" value="${esc(d.contract)}" onchange="updatePreviewField(${i},'contract',this.value)"></td><td><input class="input compact-input" value="${esc(d.setup)}" onchange="updatePreviewField(${i},'setup',this.value)"></td><td><input class="input compact-input" value="${esc(d.vd)}" onchange="updatePreviewField(${i},'vd',this.value)"></td><td><input class="input compact-input" value="${esc(d.nr)}" onchange="updatePreviewField(${i},'nr',this.value)"></td><td><input class="input compact-input tiny" value="${esc(d.hypothesis)}" onchange="updatePreviewField(${i},'hypothesis',this.value)"></td><td><select class="select compact-input" onchange="updatePreviewField(${i},'riskStrategyId',this.value)"><option value="">No clasificada</option>${risks}</select></td><td>${l1?`${l1.realizedTicks}t · ${esc(l1.type||'—')} · TP ${l1.targetTicks==null?'disc.':l1.targetTicks+'t'}`:'—'}</td><td>${l2?`${l2.realizedTicks}t · ${esc(l2.type||'—')} · TP ${l2.targetTicks==null?'disc.':l2.targetTicks+'t'}`:'—'}</td><td>${d.resultTicks>=0?'+':''}${d.resultTicks}t</td><td><button class="btn small" onclick="togglePreviewRaw(${i})">RAW</button></td></tr><tr id="preview-raw-${i}" class="raw-expand hidden"><td colspan="14">${rawGrid(d.src)}</td></tr>`;
}
function rawGrid(cols){return `<div class="raw-grid">${Object.entries(cols||{}).map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v||'—')}</strong></div>`).join('')}</div>`;}
function openImportPreviewModal(){
  const pv=pendingImportPreview,plan=getPlan(pv?.planId);if(!pv||!plan)return;
  const cats=collectPreviewCategories(plan,pv.drafts),updates=pv.drafts.filter(d=>d.possibleUpdate).length,unknown=pv.drafts.filter(d=>d.unknownInstrument).length,unmatched=pv.drafts.filter(d=>!d.riskStrategyId).length;
  const body=`<div class="import-summary"><div><span>Archivo</span><strong>${esc(pv.fileName)}</strong></div><div><span>Plan</span><strong>${esc(planLabel(plan))}</strong></div><div><span>Filas TXT</span><strong>${pv.drafts.length}</strong></div><div><span>Posibles actualizaciones</span><strong>${updates}</strong></div><div><span>Instrumentos desconocidos</span><strong>${unknown}</strong></div><div><span>Sin estrategia</span><strong>${unmatched}</strong></div></div><div class="form-section"><div class="section-title-row"><div><h4>1. Mapa de columnas</h4><div class="help">Comprueba exactamente qué columna del Bloc de notas llega a cada concepto de la aplicación. Nada RAW se destruye.</div></div></div>${importColumnMapTable(pv.headers)}</div><div class="form-section"><div class="section-title-row"><div><h4>2. Revisar y corregir filas antes de importar</h4><div class="help">Puedes corregir Setup, VD, NR, hipótesis, contrato o estrategia. Las celdas RAW originales siguen guardadas sin cambios.</div></div></div><div class="notice">Categorías nuevas si confirmas: Setups ${cats.setups.length}, VD ${cats.vd.length}, NR ${cats.nr.length}, Hipótesis ${cats.hypotheses.length}. Las filas con la misma entrada se marcan para que decidas cuál importar.</div><div class="table-wrap import-preview-table"><table class="table"><thead><tr><th>✓</th><th>Fila</th><th>Entrada</th><th>Dir.</th><th>Contrato</th><th>Setup</th><th>VD</th><th>NR</th><th>H</th><th>Estrategia</th><th>Lote 1</th><th>Lote 2</th><th>Ticks</th><th>RAW</th></tr></thead><tbody>${pv.drafts.map((d,i)=>importPreviewRow(d,i,plan)).join('')}</tbody></table></div></div>`;
  document.body.insertAdjacentHTML('beforeend',modalShell('Inspector de importación Ankora',body,`<button class="btn" onclick="cancelImportPreview()">Cancelar</button><button class="btn primary" onclick="confirmImportPreview()">Confirmar importación revisada</button>`));
}
function updatePreviewField(i,key,value){const d=pendingImportPreview?.drafts?.[i];if(!d)return;d[key]=value;if(key==='contract'){const symbol=String(value||'').trim().split(/\s+/)[0].toUpperCase(),inst=state.settings.instruments.find(x=>x.symbol.toUpperCase()===symbol);d.symbol=symbol;d.instrumentId=inst?.id||'';d.unknownInstrument=!inst&&!!symbol;}if(key==='riskStrategyId'){const p=getPlan(pendingImportPreview.planId),r=p?.riskStrategies.find(x=>x.id===value);d.riskStrategyName=r?.name||'No clasificada';}}
function togglePreviewRaw(i){document.getElementById(`preview-raw-${i}`)?.classList.toggle('hidden');}
function cancelImportPreview(){pendingImportPreview=null;closeModal();}
function applyDraftCategories(plan,d,detected){
  for(const [key,val] of [['setups',d.setup],['vd',d.vd],['nr',d.nr]]){const v=String(val||'').trim();if(v&&!plan[key].includes(v)){plan[key].push(v);detected[key].push(v);}}
  const id=String(d.hypothesis||'').trim();if(id&&!plan.hypotheses.some(h=>h.id===id)){plan.hypotheses.push({id,name:`Hipótesis ${id.replace(/^H/,'')}`,description:'Detectada y confirmada durante una importación de Ankora.'});detected.hypotheses.push(id);}
}
function operationFromDraft(d,plan,batchId){
  const inst=state.settings.instruments.find(i=>i.id===d.instrumentId)||state.settings.instruments.find(i=>i.symbol.toUpperCase()===d.symbol),risk=(plan.riskStrategies||[]).find(r=>r.id===d.riskStrategyId),totalQty=d.contracts,resultTickExposure=d.resultTicks,stop=d.stopTicks,c=risk?riskCalc(risk):null,riskTickExposure=risk?c.riskTickExposure:stop*totalQty,commission=nnum(inst?.commission)*totalQty,pnlGross=resultTickExposure*nnum(inst?.tickValue),pnlNet=pnlGross-commission,rMultiple=riskTickExposure?resultTickExposure/riskTickExposure:0;
  return {id:uid('imp'),tradingPlanId:plan.id,tradingPlanName:plan.name,tradingPlanVersion:plan.version,tradingPlanSnapshot:planSnapshot(plan),importBatchId:batchId,raw:{source:'ankora',line:d.line,columns:clone(d.src),rowIndex:d.rowIndex},entryDate:d.entryDate,exitDate:d.exitDate,direction:d.direction,contract:d.contract,timeframe:d.timeframe,contracts:totalQty,setup:d.setup,vd:d.vd,nr:d.nr,hypothesis:d.hypothesis,resultTicks:resultTickExposure,riskTickExposure,riskUsd:riskTickExposure*nnum(inst?.tickValue),instrumentId:inst?.id||'',instrumentSnapshot:instrumentSnapshot(inst),commission,pnlGross,pnlNet,rMultiple,result:resultTickExposure>0?'win':resultTickExposure<0?'loss':'pending',riskStrategyId:risk?.id||'',riskStrategyName:risk?.name||'No clasificada',strategyPlanSnapshot:risk?strategySnapshot(risk):null,h4Context:d.h4Context,tradeType:d.tradeType,notes:d.notes,mfe:0,mae:0,sample:'',discipline:String(d.src.TPCompliance)==='True',emotional:{},entryType:d.entryType,entryPrice:d.entryPrice,stopLossTicks:d.stopTicks,lots:clone(d.lots),possibleImportUpdate:d.possibleUpdate};
}
function confirmImportPreview(){
  const pv=pendingImportPreview,plan=getPlan(pv?.planId);if(!pv||!plan)return;const selected=pv.drafts.filter(d=>d.include);if(!selected.length)return alert('No hay filas seleccionadas para importar.');
  const batchId=uid('BATCH'),detected={setups:[],vd:[],nr:[],hypotheses:[]};selected.forEach(d=>applyDraftCategories(plan,d,detected));const rows=selected.map(d=>operationFromDraft(d,plan,batchId));
  const unknown=[...new Set(selected.filter(d=>d.unknownInstrument).map(d=>d.symbol))],unmatched=selected.filter(d=>!d.riskStrategyId).length,possibleUpdates=selected.filter(d=>d.possibleUpdate).length;
  const batch={id:batchId,tradingPlanId:plan.id,fileName:pv.fileName,importedAt:new Date().toISOString(),operationCount:rows.length,rawRowCount:pv.drafts.length,headers:clone(pv.headers),detected,unknownInstruments:unknown,unmatchedStrategies:unmatched,possibleUpdates,schemaVersion:4};
  state.operations.push(...rows);state.importBatches.push(batch);plan.updatedAt=new Date().toISOString();state.currentPlanId=plan.id;pendingImportPreview=null;persist();closeModal();currentView='plans';render();setTimeout(()=>openImportBatchInspector(batchId),50);
}
function handleImport(file){const plan=getPlan(pendingImportPlanId||state.currentPlanId);pendingImportPlanId=null;if(!plan)return alert('No se encontró el Trading Plan seleccionado.');const reader=new FileReader();reader.onload=()=>{try{pendingImportPreview=buildPreviewFromText(reader.result,file,plan);openImportPreviewModal();}catch(e){alert('No se pudo leer el fichero: '+e.message);}};reader.readAsText(file,'utf-8');}
function importBatchTable(batches){if(!batches.length)return '<div class="empty">Todavía no hay importaciones registradas.</div>';return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Archivo</th><th>Trading Plan</th><th>Filas RAW</th><th>Importadas</th><th>Nuevos datos</th><th>Advertencias</th><th>Acciones</th></tr></thead><tbody>${batches.map(b=>{const p=getPlan(b.tradingPlanId),newCount=(b.detected?.setups?.length||0)+(b.detected?.vd?.length||0)+(b.detected?.nr?.length||0)+(b.detected?.hypotheses?.length||0),warn=(b.unknownInstruments?.length||0)+(b.unmatchedStrategies||0)+(b.possibleUpdates||0);return `<tr><td>${fmtDate(b.importedAt)}</td><td>${esc(b.fileName)}</td><td>${esc(planLabel(p))}</td><td>${b.rawRowCount||b.operationCount||0}</td><td>${b.operationCount||0}</td><td>${newCount}</td><td>${warn}</td><td><button class="btn small primary" onclick="openImportBatchInspector('${b.id}')">Revisar dataset</button> <button class="btn small" onclick="viewImportBatchTrades('${b.id}')">Ver trades</button> <button class="btn small danger" onclick="deleteImportBatch('${b.id}')">Eliminar</button></td></tr>`}).join('')}</tbody></table></div>`;}
function viewImportBatchTrades(id){const b=state.importBatches.find(x=>x.id===id);if(!b)return;state.currentPlanId=b.tradingPlanId;currentView='operations';persist();render();setTimeout(()=>document.getElementById('opsTable').innerHTML=opsTable(state.operations.filter(o=>o.importBatchId===id).sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate))),0);}
function openImportBatchInspector(id){
  const b=state.importBatches.find(x=>x.id===id);if(!b)return;const p=getPlan(b.tradingPlanId),ops=state.operations.filter(o=>o.importBatchId===id).sort((a,b)=>nnum(a.raw?.rowIndex)-nnum(b.raw?.rowIndex));const headers=b.headers?.length?b.headers:Object.keys(ops[0]?.raw?.columns||{});
  const body=`<div class="import-summary"><div><span>Archivo</span><strong>${esc(b.fileName)}</strong></div><div><span>Plan</span><strong>${esc(planLabel(p))}</strong></div><div><span>Filas RAW</span><strong>${b.rawRowCount||b.operationCount||ops.length}</strong></div><div><span>Trades guardados</span><strong>${ops.length}</strong></div><div><span>Actualizaciones posibles</span><strong>${b.possibleUpdates||ops.filter(o=>o.possibleImportUpdate).length}</strong></div><div><span>Esquema</span><strong>v${b.schemaVersion||3}</strong></div></div><div class="form-section"><h4>Columnas recibidas</h4><div class="help" style="margin-bottom:10px">Este mapa te permite comprobar si Setup, VD, NR, lotes, hipótesis y campos Custom llegaron a la columna correcta.</div>${headers.length?importColumnMapTable(headers):'<div class="notice">Esta importación es anterior a V4 y no guardó la cabecera por separado. El RAW de cada fila se conserva cuando está disponible.</div>'}</div><div class="form-section"><div class="section-title-row"><div><h4>Dataset normalizado</h4><div class="help">Puedes corregir la clasificación sin modificar el texto RAW original.</div></div></div>${importInspectorOpsTable(ops,p)}</div>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(`Dataset · ${esc(b.fileName)}`,body,`<button class="btn" onclick="closeModal()">Cerrar</button><button class="btn" onclick="viewImportBatchTrades('${b.id}');closeModal()">Abrir en Operaciones</button>`));
}
function importInspectorOpsTable(ops,p){if(!ops.length)return '<div class="empty">Este lote no contiene operaciones.</div>';return `<div class="table-wrap import-inspector-table"><table class="table"><thead><tr><th>RAW</th><th>Entrada</th><th>Dir.</th><th>Contrato</th><th>Setup</th><th>VD</th><th>NR</th><th>H</th><th>Contexto</th><th>Tipo</th><th>Lotes</th><th>Resultado</th><th>Estrategia</th><th>Acción</th></tr></thead><tbody>${ops.map((o,i)=>`<tr><td>${o.raw?.rowIndex||i+1}</td><td>${fmtDate(o.entryDate)}</td><td>${esc(o.direction)}</td><td>${esc(o.contract||'—')}</td><td>${esc(o.setup||'—')}</td><td>${esc(o.vd||'—')}</td><td>${esc(o.nr||'—')}</td><td>${esc(o.hypothesis||'—')}</td><td>${esc(o.h4Context||'—')}</td><td>${esc(o.tradeType||'—')}</td><td>${(o.lots||[]).map(l=>`L${l.number}: ${l.realizedTicks}t/${esc(l.type||'—')}`).join(' · ')||'—'}</td><td>${o.resultTicks>=0?'+':''}${o.resultTicks}t</td><td>${esc(o.riskStrategyName||'—')}</td><td><button class="btn small" onclick="openImportedRowEditor('${o.id}')">Editar</button> <button class="btn small" onclick="toggleSavedRaw('${o.id}')">RAW</button></td></tr><tr id="saved-raw-${o.id}" class="raw-expand hidden"><td colspan="14">${rawGrid(o.raw?.columns||recoverRawColumns(o.raw?.line,[]))}</td></tr>`).join('')}</tbody></table></div>`;}
function recoverRawColumns(line,headers){const out={};if(!line)return out;const vals=String(line).split('|');(headers||[]).forEach((h,i)=>out[h]=vals[i]??'');if(!headers?.length)out['Línea RAW']=line;return out;}
function toggleSavedRaw(id){document.getElementById(`saved-raw-${id}`)?.classList.toggle('hidden');}
function openImportedRowEditor(id){
  const o=state.operations.find(x=>x.id===id);if(!o)return;closeModal();const p=getPlan(o.tradingPlanId),riskOpts=[{value:'',label:'No clasificada'},...(p?.riskStrategies||[]).map(r=>({value:r.id,label:r.name}))];
  const body=`<div class="notice">Estás editando la capa normalizada. El RAW original del Bloc de notas no se modifica y siempre podrá auditarse.</div><div class="form-section"><h4>Clasificación</h4><div class="form-grid">${field('Contrato','imp-contract','text',esc(o.contract||''))}${field('Setup','imp-setup','text',esc(o.setup||''))}${field('VD','imp-vd','text',esc(o.vd||''))}${field('NR','imp-nr','text',esc(o.nr||''))}${field('Hipótesis','imp-hyp','text',esc(o.hypothesis||''))}${selectObjField('Estrategia','imp-risk',riskOpts,o.riskStrategyId||'')}${field('Contexto / Custom1','imp-context','text',esc(o.h4Context||''),'span2')}${field('Tipo operación / Custom2','imp-type','text',esc(o.tradeType||''),'span2')}${field('Notas','imp-notes','textarea',esc(o.notes||''),'full')}</div></div><div class="form-section"><h4>RAW original</h4>${rawGrid(o.raw?.columns||recoverRawColumns(o.raw?.line,[]))}</div>`;
  document.body.insertAdjacentHTML('beforeend',modalShell('Editar fila importada',body,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveImportedRowEdit('${id}')">Guardar corrección</button>`));
}
function saveImportedRowEdit(id){
  const o=state.operations.find(x=>x.id===id);if(!o)return;const p=getPlan(o.tradingPlanId),get=n=>document.getElementById(`f-${n}`)?.value||'';o.contract=get('imp-contract').trim();o.setup=get('imp-setup').trim();o.vd=get('imp-vd').trim();o.nr=get('imp-nr').trim();o.hypothesis=get('imp-hyp').trim();o.h4Context=get('imp-context').trim();o.tradeType=get('imp-type').trim();o.notes=get('imp-notes');o.riskStrategyId=get('imp-risk');
  for(const [key,val] of [['setups',o.setup],['vd',o.vd],['nr',o.nr]])if(val&&!p[key].includes(val))p[key].push(val);if(o.hypothesis&&!p.hypotheses.some(h=>h.id===o.hypothesis))p.hypotheses.push({id:o.hypothesis,name:`Hipótesis ${o.hypothesis.replace(/^H/,'')}`,description:'Añadida al corregir una importación.'});
  recalcImportedOperation(o);p.updatedAt=new Date().toISOString();persist();closeModal();render();setTimeout(()=>openImportBatchInspector(o.importBatchId),30);
}
function recalcImportedOperation(o){
  const p=getPlan(o.tradingPlanId),symbol=String(o.contract||'').trim().split(/\s+/)[0].toUpperCase(),inst=state.settings.instruments.find(i=>i.symbol.toUpperCase()===symbol),risk=(p?.riskStrategies||[]).find(r=>r.id===o.riskStrategyId),c=risk?riskCalc(risk):null,totalQty=nnum(o.contracts),riskTickExposure=risk?c.riskTickExposure:nnum(o.stopLossTicks)*totalQty,commission=nnum(inst?.commission)*totalQty,pnlGross=nnum(o.resultTicks)*nnum(inst?.tickValue);o.instrumentId=inst?.id||'';o.instrumentSnapshot=instrumentSnapshot(inst);o.riskStrategyName=risk?.name||'No clasificada';o.strategyPlanSnapshot=risk?strategySnapshot(risk):null;o.riskTickExposure=riskTickExposure;o.riskUsd=riskTickExposure*nnum(inst?.tickValue);o.commission=commission;o.pnlGross=pnlGross;o.pnlNet=pnlGross-commission;o.rMultiple=riskTickExposure?nnum(o.resultTicks)/riskTickExposure:0;
}
document.getElementById('importFile').addEventListener('change',e=>{if(e.target.files[0])handleImport(e.target.files[0]);e.target.value='';});
function navigate(view){currentView=view;render();}
function render(){document.getElementById('app').innerHTML=shell();const view=document.getElementById('view');view.innerHTML=currentView==='dashboard'?dashboard():currentView==='operations'?operations():currentView==='gallery'?gallery():currentView==='journal'?journal():currentView==='blocks'?blocks():currentView==='plans'?plansView():config();setTimeout(hydrateImageElements,0);}
render();
Object.assign(window,{navigate,switchPlan,switchPlanAndOpen,openPlanModal,savePlan,togglePlanStatus,openOperationModal,closeModal,saveOperationFromForm,filterOperations,editOperation,viewOperation,showBlock,openBlockInOperations,setBlockUnit,setBlockBasis,setBlockCommissionUnit,setOpsUnit,setOpsBasis,toggleOpsDay,toggleOpsModule,resetOpsFilters,setOpsQuickPeriod,setOpsDimension,applyDimensionFilter,applyHeatCell,addConfig,removeConfig,addHypothesis,resetPlanConfig,editHyp,openInstrumentModal,refreshInstrumentCommissionTicks,saveInstrument,openRiskModal,addRiskLotRow,removeRiskLotRow,refreshRiskLotVisibility,refreshRiskEditorSummary,saveRiskStrategy,applyRiskToOperation,recalcOperation,openImportModal,startImportSelection,viewImportBatch,deleteImportBatch,openImportPreviewModal,updatePreviewField,togglePreviewRaw,cancelImportPreview,confirmImportPreview,openImportBatchInspector,viewImportBatchTrades,toggleSavedRaw,openImportedRowEditor,saveImportedRowEdit,addEmotionConfig,removeEmotionConfig,openRiskManagementModal,saveRiskManagement,readJournalFilters,openEmotionalEditor,saveEmotionalEditor,setConfigTab,openVisualReferenceModal,refreshReferenceKey,saveVisualReference,deleteVisualReference,openImageLightbox,readGalleryFilters,toggleGallerySelect,openGalleryCompare});


/* ===== V8 PATCH · taxonomy assets + integrated setup/context visuals ===== */
let editingTaxonomyAsset = null;

const V8_DEFAULT_CONTEXT_DEFS = [
  {key:'EB Norm', description:'Estructura bajista normal.', specs:'Ejemplo: continuidad bajista con secuencia ordenada.', timeframes:['4H'], images:[]},
  {key:'EA Norm', description:'Estructura alcista normal.', specs:'Ejemplo: continuidad alcista con secuencia ordenada.', timeframes:['4H'], images:[]},
  {key:'Impulso', description:'Contexto de impulso dominante.', specs:'Velocidad, intención y desplazamiento claros.', timeframes:['1H','4H'], images:[]},
  {key:'Retroceso', description:'Contexto de retroceso / pausa.', specs:'Pérdida temporal de desplazamiento, búsqueda de reenganche.', timeframes:['1H','4H'], images:[]}
];

function uniq(arr){return [...new Set((arr||[]).filter(Boolean))];}
function splitTimeframes(v){return uniq(String(v||'').split(/[;,/|]+/).map(x=>x.trim()).filter(Boolean));}
function tfText(list){return (list||[]).length?(list||[]).join(' · '):'Sin TF';}
function badgeList(list){return (list||[]).length?(list||[]).map(x=>`<span class="mini-badge">${esc(x)}</span>`).join(' '):'<span class="mini-badge muted">Sin TF</span>';}
function ensurePlanV8Structure(p){
  if(!p) return p;
  p.setups = uniq((p.setups||[]).map(x=>String(x).trim()));
  p.vd = uniq((p.vd||[]).map(x=>String(x).trim()));
  p.nr = uniq((p.nr||[]).map(x=>String(x).trim()));
  p.setupDefinitions = Array.isArray(p.setupDefinitions) ? p.setupDefinitions : [];
  p.vdDefinitions = Array.isArray(p.vdDefinitions) ? p.vdDefinitions : [];
  p.contextDefinitions = Array.isArray(p.contextDefinitions) ? p.contextDefinitions : [];
  p.setupDefinitions = p.setupDefinitions.map(d => ({
    id:d.id||uid('SETDEF'), key:String(d.key||d.name||'').trim(), title:d.title||d.key||d.name||'', description:d.description||'',
    specs:d.specs||'', timeframes:Array.isArray(d.timeframes)?uniq(d.timeframes):splitTimeframes(d.timeframes),
    imagesLong:Array.isArray(d.imagesLong)?d.imagesLong:[], imagesShort:Array.isArray(d.imagesShort)?d.imagesShort:[], updatedAt:d.updatedAt||new Date().toISOString()
  })).filter(d=>d.key);
  p.vdDefinitions = p.vdDefinitions.map(d => ({
    id:d.id||uid('VDDEF'), key:String(d.key||d.name||'').trim(), title:d.title||d.key||d.name||'', description:d.description||'', specs:d.specs||'',
    timeframes:Array.isArray(d.timeframes)?uniq(d.timeframes):splitTimeframes(d.timeframes), images:Array.isArray(d.images)?d.images:[], updatedAt:d.updatedAt||new Date().toISOString()
  })).filter(d=>d.key);
  p.contextDefinitions = p.contextDefinitions.map(d => ({
    id:d.id||uid('CTXDEF'), key:String(d.key||d.name||'').trim(), title:d.title||d.key||d.name||'', description:d.description||'', specs:d.specs||'',
    timeframes:Array.isArray(d.timeframes)?uniq(d.timeframes):splitTimeframes(d.timeframes), images:Array.isArray(d.images)?d.images:[], updatedAt:d.updatedAt||new Date().toISOString()
  })).filter(d=>d.key);
  p.setups.forEach(name=>{ if(!p.setupDefinitions.some(d=>d.key===name)) p.setupDefinitions.push({id:uid('SETDEF'), key:name, title:name, description:'', specs:'', timeframes:['5M'], imagesLong:[], imagesShort:[], updatedAt:new Date().toISOString()}); });
  p.vd.forEach(name=>{ if(!p.vdDefinitions.some(d=>d.key===name)) p.vdDefinitions.push({id:uid('VDDEF'), key:name, title:name, description:'', specs:'', timeframes:['5M'], images:[], updatedAt:new Date().toISOString()}); });
  if(!(p.contextDefinitions||[]).length && (p.visualReferences||[]).some(r=>r.kind==='context')){
    p.visualReferences.filter(r=>r.kind==='context').forEach(r=>{ if(!p.contextDefinitions.some(d=>d.key===r.key)) p.contextDefinitions.push({id:uid('CTXDEF'), key:r.key, title:r.title||r.key, description:r.note||'', specs:'', timeframes:['4H'], images:Array.isArray(r.images)?clone(r.images):[], updatedAt:r.updatedAt||new Date().toISOString()}); });
  }
  if(!(p.contextDefinitions||[]).length){
    p.contextDefinitions = V8_DEFAULT_CONTEXT_DEFS.map(x=>({...clone(x), id:uid('CTXDEF'), title:x.key, updatedAt:new Date().toISOString()}));
  }
  return p;
}
function ensureAllPlansV8(){ state.tradingPlans.forEach(ensurePlanV8Structure); }
ensureAllPlansV8();
persist();

function defCollectionName(type){ return type==='setup'?'setupDefinitions':type==='vd'?'vdDefinitions':'contextDefinitions'; }
function defArrayFor(type,p=getCurrentPlan()){ ensurePlanV8Structure(p); return p?.[defCollectionName(type)]||[]; }
function getTaxonomyDef(type,key,p=getCurrentPlan()){ return defArrayFor(type,p).find(d=>d.key===key); }
function taxonomyLabel(type){ return type==='setup'?'Setup':type==='vd'?'VD':'Contexto'; }
function taxonomyHelp(type){ return type==='setup'?'Patrón operativo con imágenes LONG y SHORT.':type==='vd'?'Vela direccional / disparador con ejemplo visual.':'Contexto superior con especificaciones y ejemplo visual.'; }

function richImageStrip(list,label){
  if(!(list||[]).length) return `<div class="mini-strip empty-strip">Sin imagen ${esc(label||'')}</div>`;
  return `<div class="mini-strip">${(list||[]).map(x=>imageThumb(x,'mini')).join('')}</div>`;
}

function taxonomyCard(type, def){
  const time = badgeList(def.timeframes);
  const desc = esc(def.description||def.specs||'Sin descripción aún.');
  const media = type==='setup'
    ? `<div class="taxonomy-media-grid"><div><small>Largo</small>${richImageStrip(def.imagesLong,'long')}</div><div><small>Corto</small>${richImageStrip(def.imagesShort,'short')}</div></div>`
    : `<div class="taxonomy-media-grid single"><div><small>Referencia visual</small>${richImageStrip(def.images,'ejemplo')}</div></div>`;
  return `<article class="taxonomy-card">
    <div class="taxonomy-head"><div><strong>${esc(def.key)}</strong><div class="taxonomy-sub">${time}</div></div><div class="taxonomy-actions"><button class="btn small" onclick="openTaxonomyAssetModal('${type}','${encodeURIComponent(def.key)}')">Editar</button><button class="btn small danger" onclick="deleteTaxonomyAsset('${type}','${encodeURIComponent(def.key)}')">Eliminar</button></div></div>
    <p>${desc}</p>
    ${def.specs?`<div class="taxonomy-specs">${esc(def.specs)}</div>`:''}
    ${media}
  </article>`;
}
function taxonomySection(type,title,subtitle){
  const p=getCurrentPlan();ensurePlanV8Structure(p);const defs=defArrayFor(type,p);
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>${title}</h3><div class="help">${subtitle}</div></div><button class="btn primary small" onclick="openTaxonomyAssetModal('${type}')">+ Añadir ${title.slice(0,-1)||title}</button></div>${defs.length?`<div class="taxonomy-grid">${defs.map(d=>taxonomyCard(type,d)).join('')}</div>`:'<div class="empty">Sin elementos todavía.</div>'}</section>`;
}
function nrSection(){ return configCard('NR','Referencia de nivel / liquidez','nr'); }
function hypothesisSection(p){
  return `<section class="card panel"><div class="panel-title"><h3>Hipótesis</h3><span>Definiciones propias del plan</span></div><div class="config-list">${(p?.hypotheses||[]).map(h=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(h.name)} <span class="badge">${esc(h.id)}</span></div><div class="config-meta">${esc(h.description||'Sin descripción')}</div></div><button class="btn small" onclick="editHyp('${h.id}')">Editar</button></div>`).join('')||'<div class="empty">Sin hipótesis configuradas.</div>'}</div><div class="inline-add"><input id="new-hypothesis" class="input" placeholder="Nombre de nueva hipótesis"><button class="btn small" onclick="addHypothesis()">Añadir</button></div></section>`;
}

function configTaxonomyPanel(p){ ensurePlanV8Structure(p); return `<div class="taxonomy-layout">${taxonomySection('setup','Setups','Añade el setup y desde el mismo lugar define timeframe, descripción e imágenes de largo y corto.')}${taxonomySection('vd','VD','Cada vela direccional puede tener su propio ejemplo visual y timeframe de lectura.')}${taxonomySection('context','Contextos','Añade contextos como EB Norm, EA Norm o Impulso con especificaciones y ejemplo visual.')}<div class="grid two">${nrSection()}${hypothesisSection(p)}</div></div>`; }

function referenceGalleryCard(type, def){
  const label = taxonomyLabel(type);
  const media = type==='setup' ? `<div class="reference-showcase split"><div><small>LONG</small>${richImageStrip(def.imagesLong,'long')}</div><div><small>SHORT</small>${richImageStrip(def.imagesShort,'short')}</div></div>` : `<div class="reference-showcase">${richImageStrip(def.images,'ref')}</div>`;
  return `<article class="reference-gallery-card"><div class="reference-gallery-head"><div><span class="badge">${label}</span><strong>${esc(def.key)}</strong></div><span class="tf-pack">${badgeList(def.timeframes)}</span></div><p>${esc(def.description||def.specs||'Sin notas')}</p>${def.specs?`<div class="taxonomy-specs">${esc(def.specs)}</div>`:''}${media}<div class="gallery-edit-row"><button class="btn small" onclick="openTaxonomyAssetModal('${type}','${encodeURIComponent(def.key)}')">Editar ficha</button></div></article>`;
}
function legacyReferenceCards(p){
  const refs=(p.visualReferences||[]).filter(r=>!['setup','vd','context'].includes(r.kind));
  if(!refs.length) return '';
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Referencias legacy</h3><div class="help">Material heredado del modelo anterior.</div></div><button class="btn small" onclick="openVisualReferenceModal()">+ Añadir legacy</button></div><div class="reference-config-grid">${refs.map(r=>`<article class="reference-config-card"><div class="reference-config-head"><div><span class="badge">${esc(referenceKindLabel(r.kind))}</span><strong>${esc(r.title||r.key)}</strong><small>${esc(r.key)}</small></div><div><button class="btn small" onclick="openVisualReferenceModal('${r.id}')">Editar</button></div></div><p>${esc(r.note||'Sin notas')}</p><div class="thumb-strip">${(r.images||[]).map(x=>imageThumb(x,'mini')).join('')}</div></article>`).join('')}</div></section>`;
}
function visualReferencePanel(p){
  ensurePlanV8Structure(p);
  return `<div class="reference-library-v8">${taxonomySection('setup','Setups','Biblioteca de ejemplos de entrada / ejecución por patrón.')}${taxonomySection('vd','VD','Biblioteca de velas direccionales y disparadores.')}${taxonomySection('context','Contextos','Biblioteca de contextos superiores que quieres buscar.')}<section class="card panel config-wide"><div class="panel-title"><div><h3>Biblioteca visual consolidada</h3><div class="help">Vista de conjunto para revisar todas las referencias del plan.</div></div></div><div class="reference-gallery-grid">${defArrayFor('setup',p).map(d=>referenceGalleryCard('setup',d)).join('')}${defArrayFor('vd',p).map(d=>referenceGalleryCard('vd',d)).join('')}${defArrayFor('context',p).map(d=>referenceGalleryCard('context',d)).join('')}</div></section>${legacyReferenceCards(p)}`;
}

function openTaxonomyAssetModal(type,key=''){
  const p=getCurrentPlan(); if(!p) return; ensurePlanV8Structure(p);
  const cleanKey = decodeURIComponent(key||'');
  editingTaxonomyAsset = {type, key:cleanKey||''};
  const old = cleanKey ? getTaxonomyDef(type, cleanKey, p) : null;
  const def = old || (type==='setup'
    ? {key:'', description:'', specs:'', timeframes:type==='context'?['4H']:['5M'], imagesLong:[], imagesShort:[]}
    : {key:'', description:'', specs:'', timeframes:type==='context'?['4H']:['5M'], images:[]});
  const title = `${old?'Editar':'Nueva'} ficha de ${taxonomyLabel(type)}`;
  const timeframes = tfText(def.timeframes||[]);
  const body = `<form onsubmit="return false"><div class="form-section"><h4>${esc(taxonomyLabel(type))}</h4><div class="form-grid">${field('Nombre','asset-key','text',esc(def.key||''))}${field('Marcos temporales','asset-timeframes','text',esc(timeframes),'span2',`placeholder="Ej. 5M, 15M, 1H, 4H"`)}${field(type==='context'?'Descripción del contexto':'Descripción','asset-description','textarea',esc(def.description||''),'full')}${field(type==='context'?'Especificaciones / checklist':'Checklist / qué buscar','asset-specs','textarea',esc(def.specs||''),'full')}</div></div>${type==='setup'?`<div class="form-section"><div class="section-title-row"><div><h4>Ejemplos visuales</h4><div class="help">Puedes diferenciar largo y corto dentro del mismo setup.</div></div></div><div class="form-grid"><div class="field span2"><label>Imagen ejemplo LONG</label><input id="f-asset-files-long" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="help">Añade una o varias imágenes de ejemplo de entrada LONG.</div>${(def.imagesLong||[]).length?`<div class="thumb-strip">${def.imagesLong.map(x=>imageThumb(x,'mini')).join('')}</div>`:''}</div><div class="field span2"><label>Imagen ejemplo SHORT</label><input id="f-asset-files-short" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="help">Añade una o varias imágenes de ejemplo de entrada SHORT.</div>${(def.imagesShort||[]).length?`<div class="thumb-strip">${def.imagesShort.map(x=>imageThumb(x,'mini')).join('')}</div>`:''}</div></div></div>`:`<div class="form-section"><div class="section-title-row"><div><h4>Imagen de referencia</h4><div class="help">Añade un ejemplo visual de ${taxonomyLabel(type).toLowerCase()}.</div></div></div><div class="field full"><label>Imágenes ejemplo</label><input id="f-asset-files" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="help">Puedes subir varias imágenes del mismo concepto.</div>${(def.images||[]).length?`<div class="thumb-strip">${def.images.map(x=>imageThumb(x,'mini')).join('')}</div>`:''}</div></div>`}</form>`;
  document.body.insertAdjacentHTML('beforeend', modalShell(title, body, `<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveTaxonomyAsset()">Guardar ficha</button>`));
  setTimeout(hydrateImageElements,0);
}
async function saveTaxonomyAsset(){
  const p=getCurrentPlan(); if(!p||!editingTaxonomyAsset) return; ensurePlanV8Structure(p);
  const type=editingTaxonomyAsset.type, get=n=>document.getElementById(`f-${n}`)?.value||'';
  const newKey=get('asset-key').trim(); if(!newKey) return alert('El nombre es obligatorio.');
  const oldKey=editingTaxonomyAsset.key||'';
  const collName=defCollectionName(type), coll=p[collName];
  let old=oldKey?coll.find(d=>d.key===oldKey):null;
  const base={ id:old?.id||uid('CFG'), key:newKey, title:newKey, description:get('asset-description').trim(), specs:get('asset-specs').trim(), timeframes:splitTimeframes(get('asset-timeframes')), updatedAt:new Date().toISOString() };
  if(type==='setup'){
    const imagesLong=clone(old?.imagesLong||[]), imagesShort=clone(old?.imagesShort||[]);
    for(const file of [...(document.getElementById('f-asset-files-long')?.files||[])]){ const id=uid('IMG'); await storeImageFile(file,id); imagesLong.push({id,label:'LONG',caption:file.name,name:file.name,type:file.type,createdAt:new Date().toISOString()}); }
    for(const file of [...(document.getElementById('f-asset-files-short')?.files||[])]){ const id=uid('IMG'); await storeImageFile(file,id); imagesShort.push({id,label:'SHORT',caption:file.name,name:file.name,type:file.type,createdAt:new Date().toISOString()}); }
    base.imagesLong=imagesLong; base.imagesShort=imagesShort;
  } else {
    const images=clone(old?.images||[]);
    for(const file of [...(document.getElementById('f-asset-files')?.files||[])]){ const id=uid('IMG'); await storeImageFile(file,id); images.push({id,label:'Referencia',caption:file.name,name:file.name,type:file.type,createdAt:new Date().toISOString()}); }
    base.images=images;
  }
  const duplicate = coll.find(d=>d.key===newKey && d.id!==base.id);
  if(duplicate) return alert('Ya existe una ficha con ese nombre en esta categoría.');
  const idx = coll.findIndex(d=>d.id===base.id || (oldKey && d.key===oldKey));
  if(idx>=0) coll[idx] = {...(coll[idx]||{}), ...base}; else coll.push(base);
  if(type==='setup'){
    if(oldKey && oldKey!==newKey) p.setups = p.setups.map(x=>x===oldKey?newKey:x);
    if(!p.setups.includes(newKey)) p.setups.push(newKey);
    if(oldKey && oldKey!==newKey){ state.operations.filter(o=>o.tradingPlanId===p.id && o.setup===oldKey).forEach(o=>o.setup=newKey); (p.visualReferences||[]).forEach(r=>{ if(r.kind==='setup' && r.key===oldKey) r.key=newKey;}); }
  } else if(type==='vd'){
    if(oldKey && oldKey!==newKey) p.vd = p.vd.map(x=>x===oldKey?newKey:x);
    if(!p.vd.includes(newKey)) p.vd.push(newKey);
    if(oldKey && oldKey!==newKey){ state.operations.filter(o=>o.tradingPlanId===p.id && o.vd===oldKey).forEach(o=>o.vd=newKey); (p.visualReferences||[]).forEach(r=>{ if(r.kind==='vd' && r.key===oldKey) r.key=newKey;}); }
  } else {
    if(oldKey && oldKey!==newKey){ state.operations.filter(o=>o.tradingPlanId===p.id && String(o.h4Context||'').trim()===oldKey).forEach(o=>o.h4Context=newKey); (p.visualReferences||[]).forEach(r=>{ if(r.kind==='context' && r.key===oldKey) r.key=newKey;}); }
  }
  p.updatedAt=new Date().toISOString(); persist(); closeModal(); editingTaxonomyAsset=null; render();
}
async function deleteTaxonomyAsset(type,key){
  const p=getCurrentPlan(); if(!p) return; ensurePlanV8Structure(p);
  const clean = decodeURIComponent(key||'');
  if(!confirm(`¿Eliminar ${taxonomyLabel(type).toLowerCase()} "${clean}"? Las operaciones históricas no se borrarán.`)) return;
  const collName=defCollectionName(type), coll=p[collName], item=coll.find(d=>d.key===clean);
  if(item){
    const imgs=[...(item.images||[]), ...(item.imagesLong||[]), ...(item.imagesShort||[])];
    for(const img of imgs) await deleteImageBlob(img.id);
  }
  p[collName]=coll.filter(d=>d.key!==clean);
  if(type==='setup') p.setups=(p.setups||[]).filter(x=>x!==clean);
  if(type==='vd') p.vd=(p.vd||[]).filter(x=>x!==clean);
  p.updatedAt=new Date().toISOString(); persist(); render();
}

function definitionToVisualRef(type, def, operation){
  if(!def) return null;
  let images=[];
  if(type==='setup') images = operation?.direction==='SHORT' ? ((def.imagesShort||[]).length ? def.imagesShort : def.imagesLong||[]) : ((def.imagesLong||[]).length ? def.imagesLong : def.imagesShort||[]);
  else images = def.images||[];
  if(!images.length && !(def.description||def.specs)) return null;
  return {kind:type,key:def.key,title:def.title||def.key,note:[def.description, def.specs].filter(Boolean).join(' · '), images};
}
function referencesForOperation(o){
  const p=getPlan(o.tradingPlanId); ensurePlanV8Structure(p); const refs=[];
  const sref=definitionToVisualRef('setup', getTaxonomyDef('setup', o.setup, p), o); if(sref) refs.push(sref);
  const vref=definitionToVisualRef('vd', getTaxonomyDef('vd', o.vd, p), o); if(vref) refs.push(vref);
  const cref=definitionToVisualRef('context', getTaxonomyDef('context', String(o.h4Context||'').trim(), p), o); if(cref) refs.push(cref);
  (p.visualReferences||[]).forEach(r=>{ if((r.kind==='nr'&&r.key===o.nr)||(r.kind==='setup'&&r.key===o.setup)||(r.kind==='vd'&&r.key===o.vd)||(r.kind==='context'&&String(r.key).trim()===String(o.h4Context||'').trim())) refs.push(r); });
  return refs;
}
function relatedReferenceHtml(o){
  const refs=referencesForOperation(o);
  if(!refs.length) return '<div class="empty compact-empty">Sin referencias visuales asociadas exactamente a este trade.</div>';
  return `<div class="reference-related-grid">${refs.map(r=>`<div class="reference-mini-card"><div><span class="badge">${esc(referenceKindLabel(r.kind)||taxonomyLabel(r.kind)||r.kind)}</span><strong>${esc(r.title||r.key)}</strong><small>${esc(r.note||r.key)}</small></div>${(r.images||[]).length?`<div class="thumb-strip">${(r.images||[]).slice(0,4).map(x=>imageThumb(x,'mini')).join('')}</div>`:'<div class="empty compact-empty">Sin imagen aún.</div>'}</div>`).join('')}</div>`;
}

function configTabs(p){ const tabs=[['instruments','Contratos','Biblioteca global'],['management','Gestión','Estrategias y salidas'],['taxonomy','Taxonomías','Setups, VD, contexto y estructura'],['visual','Referencias visuales','Galería del plan'],['emotional','Emocional','Estados y comportamientos'],['riskrules','Riesgo','Reglas diarias/semanales']]; return `<div class="config-tabs">${tabs.map(([id,label,desc])=>`<button class="config-tab ${configTab===id?'active':''}" onclick="setConfigTab('${id}')"><strong>${label}</strong><span>${desc}</span></button>`).join('')}</div>`; }
function configContent(p){ ensurePlanV8Structure(p); if(configTab==='management')return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Regímenes / estrategias de gestión · ${esc(planLabel(p))}</h3><div class="help">Las estrategias consumen los contratos globales y construyen lotes, stops y objetivos.</div></div><button class="btn primary small" onclick="openRiskModal()">+ Nueva estrategia</button></div><div class="config-list">${(p?.riskStrategies||[]).length?p.riskStrategies.map(r=>riskCard(r)).join(''):'<div class="empty">Este plan todavía no tiene estrategias de gestión.</div>'}</div></section><div style="margin-top:16px">${configCard('Salidas discrecionales','Módulos disponibles para TP variable','discretionaryTargets')}</div>`; if(configTab==='taxonomy')return configTaxonomyPanel(p); if(configTab==='visual')return visualReferencePanel(p); if(configTab==='emotional')return emotionConfigPanel(p); if(configTab==='riskrules')return riskManagementPanel(p); return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Biblioteca global de contratos / instrumentos</h3><div class="help">Fuente única para tick size, valor del tick, comisión y moneda. Todos los Trading Plans pueden reutilizar estos contratos.</div></div><button class="btn primary small" onclick="openInstrumentModal()">+ Añadir contrato</button></div>${instrumentTable()}</section>`; }
function resetPlanConfig(){ const p=getCurrentPlan(); if(!p) return; if(confirm(`¿Restaurar la estructura base dentro de ${planLabel(p)}? Las operaciones e importaciones del plan se conservarán.`)){ const base=clone(basePlanConfig); p.setups=base.setups; p.vd=base.vd; p.nr=base.nr; p.hypotheses=base.hypotheses; p.discretionaryTargets=base.discretionaryTargets; p.emotionConfig=base.emotionConfig; p.riskManagement=base.riskManagement; p.visualReferences=[]; p.setupDefinitions=[]; p.vdDefinitions=[]; p.contextDefinitions=clone(V8_DEFAULT_CONTEXT_DEFS).map(x=>({...x,id:uid('CTXDEF'),title:x.key,updatedAt:new Date().toISOString()})); ensurePlanV8Structure(p); p.riskStrategies=base.riskStrategies.map(r=>normalizeRiskStrategy({...r,id:uid('R')},state.settings.instruments)); p.updatedAt=new Date().toISOString(); saveState(); } }

function operationForm(o,r,p){ ensurePlanV8Structure(p); const v=(k,d='')=>esc(o?.[k]??d),riskOptions=p.riskStrategies.filter(x=>x.active||x.id===o?.riskStrategyId).map(x=>({value:x.id,label:x.name})),hypOpts=(p.hypotheses||[]).map(x=>({value:x.id,label:x.name})),contextOpts=(p.contextDefinitions||[]).map(x=>x.key); return `<form id="operationForm" onsubmit="return false"><div class="form-section"><h4>0 · Trading Plan</h4><div class="plan-readonly"><strong>${esc(planLabel(p))}</strong><span>${esc(p.description||'Sin descripción')}</span></div></div><div class="form-section"><h4>1 · Sesión y régimen</h4><div class="form-grid">${field('Fecha/hora de entrada','entryDate','datetime-local',v('entryDate',new Date().toISOString().slice(0,16)))}${field('Fecha/hora de salida','exitDate','datetime-local',v('exitDate',''))}${selectField('Muestra','sample',['A','B'],v('sample','B'))}${selectObjField('Régimen de gestión','riskStrategyId',riskOptions,o?.riskStrategyId||r?.id,`onchange="applyRiskToOperation(true)"`)}${field('ATR observado (opcional)','atr','number',v('atr',''),'','step="any"')}${hypOpts.length?selectObjField('Hipótesis','hypothesis',hypOpts,v('hypothesis',hypOpts[0]?.value||'')):field('Hipótesis','hypothesis','text',v('hypothesis',''))}${contextOpts.length?selectField('Contexto H4','h4Context',contextOpts,v('h4Context',contextOpts[0]||'')):field('Contexto H4','h4Context','text',v('h4Context',''))}${selectField('Fase H4','h4Phase',['Impulso','Retroceso','No definida'],v('h4Phase','Impulso'))}</div><div id="opRiskPreview" class="strategy-preview"></div></div><div class="form-section"><h4>2 · Oportunidad</h4><div class="form-grid">${p.setups.length?selectField('Setup','setup',p.setups,v('setup',p.setups[0])):field('Setup','setup','text',v('setup',''))}${p.vd.length?selectField('VD','vd',p.vd,v('vd',p.vd[0])):field('VD','vd','text',v('vd',''))}${p.nr.length?selectField('NR','nr',p.nr,v('nr',p.nr[0])):field('NR','nr','text',v('nr',''))}${selectField('Tipo de operación','tradeType',['Rápida','Liquidez','Otra'],v('tradeType','Rápida'))}${selectField('Dirección','direction',['LONG','SHORT'],v('direction','LONG'))}${field('Timeframe','timeframe','text',v('timeframe','5M'))}${field('Precio dinámico / objetivo','dtPrice','number',v('dtPrice',''),'','step="any"')}${field('Notas','notes','textarea',v('notes',''),'full')}</div></div><div class="form-section"><h4>3 · Ejecución y resultado</h4><div class="form-grid">${field('Contrato / vencimiento','contract','text',v('contract',getInstrument(r?.instrumentId)?.symbol||''))}${field('Contratos totales','contracts','number',v('contracts',riskCalc(r).contracts),'','readonly')}${selectField('Tipo de entrada','entryType',['LMT','STP'],v('entryType','LMT'))}${field('Precio de entrada','entryPrice','number',v('entryPrice',''),'','step="any"')}${field('Ticks resultado agregados','resultTicks','number',v('resultTicks',''),'','step="any" oninput="recalcOperation()"')}${field('Comisiones','commission','number',v('commission',''),'','readonly step="any"')}${field('P&L bruto','pnlGross','number',v('pnlGross',''),'','readonly step="any"')}${field('P&L neto','pnlNet','number',v('pnlNet',''),'','readonly step="any"')}${field('R múltiple bruta','rMultiple','number',v('rMultiple',''),'','readonly step="any"')}${field('MFE (R)','mfe','number',v('mfe',''),'','step="any"')}${field('MAE (R)','mae','number',v('mae',''),'','step="any"')}${selectField('Disciplina','discipline',['Sí','No'],v('discipline','Sí'))}${field('Motivo de indisciplina','disciplineReason','text',v('disciplineReason',''),'span2')}<div class="field span2"><label>Nuevas capturas</label><input id="screens" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="image-upload-meta"><select id="screenCategory" class="select">${imageLabelOptions('Contexto')}</select><input id="screenCaption" class="input" placeholder="Nota común para estas imágenes (opcional)"></div><div class="help">Puedes añadir varias imágenes. Se guardan localmente en IndexedDB hasta conectar Supabase.</div>${o?.images?.length?`<div class="existing-images"><span>${o.images.length} imagen(es) ya asociadas</span><div class="thumb-strip">${o.images.map(x=>imageThumb(x,'mini')).join('')}</div></div>`:''}</div></div><div class="notice" style="margin-top:12px">La R mostrada aquí es bruta: relación entre ticks obtenidos y riesgo inicial. Las comisiones se conservan separadas para las métricas netas.</div></div></form>`; }

Object.assign(window,{openTaxonomyAssetModal,saveTaxonomyAsset,deleteTaxonomyAsset});
render();
/* ===== END V8 PATCH ===== */


/* ===== V8.1 PATCH · stable backup + integrity audit ===== */
const BACKUP_FORMAT = 'TradingResearchBackup';
const BACKUP_SCHEMA = 1;
let integrityAuditCache = null;

function blobToBase64(blob){
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
}
function base64ToBlob(base64,type='application/octet-stream'){
  const bin=atob(base64||''), bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type});
}
async function getAllImageRecords(){
  try{const db=await imageDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readonly'),req=tx.objectStore(IMAGE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}catch{return [];}
}
async function clearImageStore(){
  const db=await imageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
async function exportFullBackup(){
  try{
    const records=await getAllImageRecords(), images=[];
    for(const rec of records){images.push({id:rec.id,name:rec.name||'',type:rec.type||rec.blob?.type||'application/octet-stream',updatedAt:rec.updatedAt||'',data:await blobToBase64(rec.blob)});}
    const payload={format:BACKUP_FORMAT,schema:BACKUP_SCHEMA,appVersion:'8.1.0',exportedAt:new Date().toISOString(),state:clone(state),images};
    const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a'),d=new Date(),stamp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}`;
    a.href=url;a.download=`Trading-Research-backup-${stamp}.trbackup`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    alert(`Copia completa creada.\nPlanes: ${state.tradingPlans.length}\nOperaciones: ${state.operations.length}\nImágenes: ${images.length}`);
  }catch(e){alert('No se pudo crear la copia de seguridad: '+e.message);}
}
function openBackupImportPicker(){document.getElementById('backupImportFile')?.click();}
async function importFullBackup(file){
  if(!file)return;
  try{
    const raw=JSON.parse(await file.text());
    if(raw?.format!==BACKUP_FORMAT||!raw?.state||!Array.isArray(raw?.images))throw new Error('El archivo no es una copia válida de Trading Research.');
    const info=`${raw.state?.tradingPlans?.length||0} plan(es), ${raw.state?.operations?.length||0} operación(es), ${raw.images.length} imagen(es)`;
    if(!confirm(`Esta restauración sustituirá los datos locales actuales de este navegador.\n\nCopia seleccionada: ${info}\nFecha: ${raw.exportedAt?fmtDate(raw.exportedAt):'—'}\n\n¿Continuar?`))return;
    const restored=normalizeState(raw.state);state=restored;ensureAllPlansV8();
    await clearImageStore();
    for(const im of raw.images){if(!im?.id||!im?.data)continue;const blob=base64ToBlob(im.data,im.type);await storeImageFile(new File([blob],im.name||'imagen',{type:im.type||blob.type}),im.id);}
    persist();integrityAuditCache=null;currentView='config';configTab='data';render();alert(`Restauración completada.\n${info}`);
  }catch(e){alert('No se pudo restaurar la copia: '+e.message);}
  finally{const input=document.getElementById('backupImportFile');if(input)input.value='';}
}

function collectReferencedImageIds(){
  const ids=[];
  state.operations.forEach(o=>(o.images||[]).forEach(x=>x?.id&&ids.push(x.id)));
  state.tradingPlans.forEach(p=>{
    ensurePlanV8Structure(p);
    (p.visualReferences||[]).forEach(r=>(r.images||[]).forEach(x=>x?.id&&ids.push(x.id)));
    (p.setupDefinitions||[]).forEach(d=>[...(d.imagesLong||[]),...(d.imagesShort||[])].forEach(x=>x?.id&&ids.push(x.id)));
    (p.vdDefinitions||[]).forEach(d=>(d.images||[]).forEach(x=>x?.id&&ids.push(x.id)));
    (p.contextDefinitions||[]).forEach(d=>(d.images||[]).forEach(x=>x?.id&&ids.push(x.id)));
  });
  return ids;
}
async function runIntegrityAudit(){
  const issues=[],planIds=new Set(state.tradingPlans.map(p=>p.id)),instIds=new Set(state.settings.instruments.map(i=>i.id)),seenIds=new Set();
  for(const o of state.operations){
    if(seenIds.has(o.id))issues.push({level:'error',kind:'ID duplicado',detail:`Operación ${o.id} aparece más de una vez.`});seenIds.add(o.id);
    const p=getPlan(o.tradingPlanId);
    if(!planIds.has(o.tradingPlanId))issues.push({level:'error',kind:'Plan inexistente',detail:`${fmtDate(o.entryDate)} · ${o.contract||'—'} referencia un Trading Plan que ya no existe.`});
    if(o.instrumentId&&!instIds.has(o.instrumentId))issues.push({level:'error',kind:'Contrato huérfano',detail:`${fmtDate(o.entryDate)} · ${o.contract||'—'} usa un instrumento inexistente.`});
    if(p){
      ensurePlanV8Structure(p);
      if(o.riskStrategyId&&!p.riskStrategies.some(r=>r.id===o.riskStrategyId))issues.push({level:'warning',kind:'Estrategia huérfana',detail:`${fmtDate(o.entryDate)} · ${o.contract||'—'} tiene una estrategia que ya no existe en ${planLabel(p)}.`});
      if(!o.riskStrategyId)issues.push({level:'info',kind:'Sin estrategia',detail:`${fmtDate(o.entryDate)} · ${o.contract||'—'} está sin clasificar por régimen.`});
      if(o.setup&&!p.setups.includes(o.setup))issues.push({level:'warning',kind:'Setup fuera del plan',detail:`${fmtDate(o.entryDate)} · ${o.setup} no está en las taxonomías actuales de ${planLabel(p)}.`});
      if(o.vd&&!p.vd.includes(o.vd))issues.push({level:'warning',kind:'VD fuera del plan',detail:`${fmtDate(o.entryDate)} · ${o.vd} no está en las taxonomías actuales de ${planLabel(p)}.`});
      if(o.h4Context&&!p.contextDefinitions.some(c=>c.key===String(o.h4Context).trim()))issues.push({level:'info',kind:'Contexto libre',detail:`${fmtDate(o.entryDate)} · ${o.h4Context} todavía no tiene ficha de Contexto.`});
    }
  }
  const records=await getAllImageRecords(),storedIds=new Set(records.map(r=>r.id)),refIds=collectReferencedImageIds(),refSet=new Set(refIds);
  for(const id of refSet)if(!storedIds.has(id))issues.push({level:'warning',kind:'Imagen ausente',detail:`La metadata referencia la imagen ${id}, pero el blob no está en IndexedDB.`});
  const orphan=records.filter(r=>!refSet.has(r.id));if(orphan.length)issues.push({level:'info',kind:'Imágenes sin referencia',detail:`Hay ${orphan.length} blob(s) de imagen no vinculados a operaciones o fichas actuales.`});
  integrityAuditCache={ranAt:new Date().toISOString(),issues,counts:{plans:state.tradingPlans.length,operations:state.operations.length,batches:state.importBatches.length,instruments:state.settings.instruments.length,imageRefs:refSet.size,imageBlobs:records.length}};
  render();
}
function issueBadge(level){return `<span class="integrity-badge ${level}">${level==='error'?'Error':level==='warning'?'Aviso':'Info'}</span>`;}
function dataSecurityPanel(){
  const a=integrityAuditCache,c=a?.counts||{plans:state.tradingPlans.length,operations:state.operations.length,batches:state.importBatches.length,instruments:state.settings.instruments.length,imageRefs:collectReferencedImageIds().length,imageBlobs:'—'};
  const errs=a?.issues?.filter(x=>x.level==='error').length||0,warns=a?.issues?.filter(x=>x.level==='warning').length||0,infos=a?.issues?.filter(x=>x.level==='info').length||0;
  return `<div class="data-security-layout"><section class="card panel config-wide"><div class="panel-title"><div><h3>Copias de seguridad</h3><div class="help">Exporta estado + imágenes en un único archivo. La restauración sustituye los datos locales de este navegador.</div></div><span class="stable-pill">V8.1 estable</span></div><div class="security-actions"><button class="btn primary" onclick="exportFullBackup()">Exportar copia completa</button><button class="btn" onclick="openBackupImportPicker()">Restaurar copia</button></div><div class="notice">La copia incluye Trading Plans, operaciones, importaciones, contratos, reglas, diario emocional, taxonomías y blobs de imágenes de IndexedDB.</div></section><section class="card panel config-wide"><div class="panel-title"><div><h3>Integridad del dataset</h3><div class="help">Busca referencias rotas, operaciones huérfanas y diferencias entre el histórico y la configuración actual.</div></div><button class="btn primary small" onclick="runIntegrityAudit()">Ejecutar auditoría</button></div><div class="integrity-kpis"><div><span>Planes</span><strong>${c.plans}</strong></div><div><span>Operaciones</span><strong>${c.operations}</strong></div><div><span>Importaciones</span><strong>${c.batches}</strong></div><div><span>Contratos</span><strong>${c.instruments}</strong></div><div><span>Imágenes referenciadas</span><strong>${c.imageRefs}</strong></div><div><span>Blobs presentes</span><strong>${c.imageBlobs}</strong></div></div>${a?`<div class="audit-summary"><span>${issueBadge('error')} ${errs}</span><span>${issueBadge('warning')} ${warns}</span><span>${issueBadge('info')} ${infos}</span><small>Auditoría: ${fmtDate(a.ranAt)}</small></div>${a.issues.length?`<div class="integrity-list">${a.issues.slice(0,120).map(x=>`<div class="integrity-row">${issueBadge(x.level)}<div><strong>${esc(x.kind)}</strong><span>${esc(x.detail)}</span></div></div>`).join('')}</div>`:'<div class="integrity-ok">✓ No se han detectado incidencias.</div>'}`:'<div class="empty">Ejecuta la auditoría para comprobar el estado actual.</div>'}</section></div>`;
}

function configTabs(p){ const tabs=[['instruments','Contratos','Biblioteca global'],['management','Gestión','Estrategias y salidas'],['taxonomy','Taxonomías','Setups, VD, contexto y estructura'],['visual','Referencias visuales','Galería del plan'],['emotional','Emocional','Estados y comportamientos'],['riskrules','Riesgo','Reglas diarias/semanales'],['data','Datos y seguridad','Backup e integridad']]; return `<div class="config-tabs">${tabs.map(([id,label,desc])=>`<button class="config-tab ${configTab===id?'active':''}" onclick="setConfigTab('${id}')"><strong>${label}</strong><span>${desc}</span></button>`).join('')}</div>`; }
function configContent(p){ ensurePlanV8Structure(p); if(configTab==='management')return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Regímenes / estrategias de gestión · ${esc(planLabel(p))}</h3><div class="help">Las estrategias consumen los contratos globales y construyen lotes, stops y objetivos.</div></div><button class="btn primary small" onclick="openRiskModal()">+ Nueva estrategia</button></div><div class="config-list">${(p?.riskStrategies||[]).length?p.riskStrategies.map(r=>riskCard(r)).join(''):'<div class="empty">Este plan todavía no tiene estrategias de gestión.</div>'}</div></section><div style="margin-top:16px">${configCard('Salidas discrecionales','Módulos disponibles para TP variable','discretionaryTargets')}</div>`; if(configTab==='taxonomy')return configTaxonomyPanel(p); if(configTab==='visual')return visualReferencePanel(p); if(configTab==='emotional')return emotionConfigPanel(p); if(configTab==='riskrules')return riskManagementPanel(p); if(configTab==='data')return dataSecurityPanel(); return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Biblioteca global de contratos / instrumentos</h3><div class="help">Fuente única para tick size, valor del tick, comisión y moneda. Todos los Trading Plans pueden reutilizar estos contratos.</div></div><button class="btn primary small" onclick="openInstrumentModal()">+ Añadir contrato</button></div>${instrumentTable()}</section>`; }

if(!document.getElementById('backupImportFile')){const inp=document.createElement('input');inp.id='backupImportFile';inp.type='file';inp.accept='.trbackup,.json,application/json';inp.hidden=true;inp.addEventListener('change',e=>{if(e.target.files?.[0])importFullBackup(e.target.files[0]);});document.body.appendChild(inp);}
Object.assign(window,{exportFullBackup,openBackupImportPicker,importFullBackup,runIntegrityAudit});
render();
/* ===== END V8.1 PATCH ===== */


/* ===== V9 PATCH · Supabase secure cloud sync ===== */
const CLOUD_CONFIG_KEY='tradingResearchCloudConfig_v1';
const CLOUD_BUCKET='trading-images';
const CLOUD_APP_VERSION='9.0.0';
const CLOUD_SCHEMA_VERSION=1;
let cloudClient=null;
let cloudAuthUser=null;
let cloudBusy=false;
let cloudSuppressAutoSync=false;
let cloudSyncTimer=null;
let cloudStatus={message:'Sin conectar',kind:'idle',remote:null};
let cloudConfig=loadCloudConfig();

function loadCloudConfig(){
  const base={url:'https://ddzppjakpcyepuiekioj.supabase.co',publishableKey:'',autoSync:false,lastPush:'',lastPull:'',syncedImageIds:[]};
  try{return {...base,...JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)||'{}')};}catch{return base;}
}
function saveCloudConfigLocal(){localStorage.setItem(CLOUD_CONFIG_KEY,JSON.stringify(cloudConfig));}
function cloudConfigured(){return !!(cloudConfig.url&&cloudConfig.publishableKey);}
function cloudUserLabel(){return cloudAuthUser?.email||cloudAuthUser?.id||'Sin sesión';}
function cloudStatusText(){return cloudStatus?.message||'Sin estado';}
function cloudSetStatus(message,kind='idle',remote=null){cloudStatus={message,kind,remote:remote??cloudStatus.remote};}
function cloudEnsureSdk(){if(!window.supabase?.createClient)throw new Error('No se pudo cargar la librería oficial de Supabase. Comprueba la conexión a Internet.');}
async function initCloudClient(){
  cloudAuthUser=null;cloudClient=null;
  if(!cloudConfigured()){cloudSetStatus('Falta configurar la Publishable key','idle');return;}
  try{
    cloudEnsureSdk();
    cloudClient=window.supabase.createClient(cloudConfig.url.trim(),cloudConfig.publishableKey.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const {data}=await cloudClient.auth.getSession();cloudAuthUser=data?.session?.user||null;
    cloudClient.auth.onAuthStateChange((_event,session)=>{cloudAuthUser=session?.user||null;cloudSetStatus(cloudAuthUser?`Sesión activa: ${cloudUserLabel()}`:'Sin sesión','ok');setTimeout(()=>{if(currentView==='config'&&configTab==='cloud')render();},0);});
    cloudSetStatus(cloudAuthUser?`Sesión activa: ${cloudUserLabel()}`:'Conexión preparada · inicia sesión',cloudAuthUser?'ok':'idle');
  }catch(e){cloudSetStatus('Error de configuración: '+e.message,'error');}
}

function cloudConfigPanel(){
  const logged=!!cloudAuthUser, remote=cloudStatus.remote;
  return `<div class="cloud-layout">
  <section class="card panel config-wide"><div class="panel-title"><div><h3>Supabase · conexión segura</h3><div class="help">El navegador usa únicamente Project URL + Publishable key. La Secret key / service_role nunca debe introducirse aquí.</div></div><span class="cloud-pill ${cloudStatus.kind}">${esc(cloudStatusText())}</span></div>
    <div class="form-grid cloud-config-grid">
      ${field('Project URL','cloud-url','text',esc(cloudConfig.url||''),'span2')}
      ${field('Publishable key','cloud-key','password',esc(cloudConfig.publishableKey||''),'span2',`autocomplete="off" placeholder="sb_publishable_… (o anon legacy)"`)}
    </div>
    <div class="security-actions"><button class="btn primary" onclick="saveCloudConnection()">Guardar conexión</button><button class="btn" onclick="testCloudConnection()">Probar conexión</button></div>
    <div class="notice">Proyecto preconfigurado: <strong>ddzppjakpcyepuiekioj</strong>. Antes de sincronizar hay que ejecutar el SQL de estructura/RLS que te he preparado.</div>
  </section>
  <section class="card panel config-wide"><div class="panel-title"><div><h3>Cuenta</h3><div class="help">Supabase Auth identifica al propietario de los datos; las políticas RLS solo permiten acceder a tus propias filas.</div></div><span class="badge ${logged?'win':''}">${logged?esc(cloudUserLabel()):'No autenticado'}</span></div>
    ${logged?`<div class="cloud-user-row"><div><span>Usuario</span><strong>${esc(cloudUserLabel())}</strong></div><button class="btn" onclick="cloudSignOut()">Cerrar sesión</button></div>`:`<div class="form-grid">${field('Email','cloud-email','email','')}${field('Contraseña','cloud-password','password','','autocomplete="current-password"')}</div><div class="security-actions"><button class="btn primary" onclick="cloudSignIn()">Entrar</button><button class="btn" onclick="cloudSignUp()">Crear cuenta</button></div>`}
  </section>
  <section class="card panel config-wide"><div class="panel-title"><div><h3>Sincronización</h3><div class="help">Local sigue siendo una copia funcional. Supabase se convierte en la persistencia entre dispositivos.</div></div><span class="stable-pill">V9 Cloud Sync</span></div>
    <div class="cloud-sync-grid"><div><span>Última subida</span><strong>${cloudConfig.lastPush?fmtDate(cloudConfig.lastPush):'Nunca'}</strong></div><div><span>Última descarga</span><strong>${cloudConfig.lastPull?fmtDate(cloudConfig.lastPull):'Nunca'}</strong></div><div><span>Estado remoto</span><strong>${remote?`${remote.plans||0} planes · ${remote.operations||0} operaciones`:'Sin consultar'}</strong></div></div>
    <div class="security-actions"><button class="btn primary" ${logged?'':'disabled'} onclick="cloudPushState()">Subir local → Supabase</button><button class="btn" ${logged?'':'disabled'} onclick="cloudPullState()">Cargar Supabase → este dispositivo</button><label class="cloud-auto"><input type="checkbox" ${cloudConfig.autoSync?'checked':''} ${logged?'':'disabled'} onchange="setCloudAutoSync(this.checked)"> Sincronización automática tras guardar cambios</label></div>
    <div class="notice warning-note">La primera vez usa <strong>Subir local → Supabase</strong>. En otro ordenador, inicia sesión y usa <strong>Cargar Supabase → este dispositivo</strong>. La descarga sustituye el estado local después de pedir confirmación.</div>
  </section>
  <section class="card panel config-wide"><div class="panel-title"><div><h3>Qué se guarda</h3><div class="help">La estructura está preparada para crecer sin encerrar toda la aplicación en una única fila JSON.</div></div></div><div class="cloud-entities"><span>Workspace</span><span>Trading Plans</span><span>Contratos</span><span>Operaciones</span><span>Importaciones</span><span>Oportunidades</span><span>Imágenes privadas</span></div></section>
  </div>`;
}

async function saveCloudConnection(){
  cloudConfig.url=(document.getElementById('f-cloud-url')?.value||'').trim().replace(/\/$/,'');
  cloudConfig.publishableKey=(document.getElementById('f-cloud-key')?.value||'').trim();saveCloudConfigLocal();await initCloudClient();render();
}
async function testCloudConnection(){
  if(!cloudClient)await initCloudClient();if(!cloudClient)return alert('Configura primero Project URL y Publishable key.');
  if(!cloudAuthUser)return alert('La conexión está preparada. Inicia sesión para probar también el acceso protegido por RLS.');
  cloudSetStatus('Probando conexión…','busy');render();
  try{const {data,error}=await cloudClient.from('trading_workspace').select('user_id,updated_at').eq('user_id',cloudAuthUser.id).maybeSingle();if(error)throw error;cloudSetStatus(data?'Supabase conectado · workspace encontrado':'Supabase conectado · workspace todavía vacío','ok');}
  catch(e){cloudSetStatus('Error: '+e.message,'error');}
  render();
}
function cloudCredentials(){return {email:(document.getElementById('f-cloud-email')?.value||'').trim(),password:document.getElementById('f-cloud-password')?.value||''};}
async function cloudSignIn(){
  if(!cloudClient)await saveCloudConnection();if(!cloudClient)return;
  const {email,password}=cloudCredentials();if(!email||!password)return alert('Introduce email y contraseña.');
  cloudSetStatus('Iniciando sesión…','busy');render();
  const {data,error}=await cloudClient.auth.signInWithPassword({email,password});if(error){cloudSetStatus('Login fallido: '+error.message,'error');render();return;}
  cloudAuthUser=data.user;cloudSetStatus(`Sesión activa: ${cloudUserLabel()}`,'ok');render();
}
async function cloudSignUp(){
  if(!cloudClient)await saveCloudConnection();if(!cloudClient)return;
  const {email,password}=cloudCredentials();if(!email||!password)return alert('Introduce email y contraseña.');
  cloudSetStatus('Creando cuenta…','busy');render();
  const {data,error}=await cloudClient.auth.signUp({email,password});if(error){cloudSetStatus('No se pudo crear la cuenta: '+error.message,'error');render();return;}
  cloudAuthUser=data.session?.user||null;cloudSetStatus(cloudAuthUser?'Cuenta creada y sesión activa':'Cuenta creada · revisa el email si Supabase exige confirmación','ok');render();
}
async function cloudSignOut(){if(!cloudClient)return;await cloudClient.auth.signOut();cloudAuthUser=null;cloudSetStatus('Sesión cerrada','idle');render();}
function setCloudAutoSync(v){cloudConfig.autoSync=!!v;saveCloudConfigLocal();if(v)cloudScheduleAutoSync();render();}

function validIso(v){if(!v)return null;const d=new Date(v);return isNaN(d)?null:d.toISOString();}
function chunk(arr,n=200){const out=[];for(let i=0;i<arr.length;i+=n)out.push(arr.slice(i,i+n));return out;}
async function cloudRequireUser(){if(!cloudClient)await initCloudClient();if(!cloudClient)throw new Error('Supabase no está configurado.');const {data,error}=await cloudClient.auth.getUser();if(error||!data?.user)throw new Error('Debes iniciar sesión en Supabase.');cloudAuthUser=data.user;return data.user;}
async function cloudUpsertChunks(table,rows,onConflict='user_id,id'){
  for(const part of chunk(rows,150)){const {error}=await cloudClient.from(table).upsert(part,{onConflict});if(error)throw new Error(`${table}: ${error.message}`);}
}
async function cloudDeleteStale(table,localIds,userId){
  const {data,error}=await cloudClient.from(table).select('id').eq('user_id',userId);if(error)throw new Error(`${table}: ${error.message}`);
  const keep=new Set(localIds),stale=(data||[]).map(x=>x.id).filter(id=>!keep.has(id));for(const part of chunk(stale,100)){if(!part.length)continue;const {error:e}=await cloudClient.from(table).delete().eq('user_id',userId).in('id',part);if(e)throw new Error(`${table}: ${e.message}`);}
}
function planCloudRow(p,userId){return {user_id:userId,id:p.id,family_name:p.familyName||'',name:p.name||'',version:p.version||'',status:p.status||'active',updated_at:validIso(p.updatedAt)||new Date().toISOString(),payload:clone(p)};}
function instrumentCloudRow(i,userId){return {user_id:userId,id:i.id,symbol:i.symbol||'',name:i.name||'',active:i.active!==false,updated_at:new Date().toISOString(),payload:clone(i)};}
function operationCloudRow(o,userId){return {user_id:userId,id:o.id,trading_plan_id:o.tradingPlanId||'',entry_date:validIso(o.entryDate),direction:o.direction||'',setup:o.setup||'',vd:o.vd||'',nr:o.nr||'',result:o.result||'',r_multiple:Number(o.rMultiple)||0,pnl_net:Number(o.pnlNet)||0,result_ticks:Number(o.resultTicks)||0,updated_at:validIso(o.updatedAt)||new Date().toISOString(),payload:clone(o)};}
function batchCloudRow(b,userId){return {user_id:userId,id:b.id,trading_plan_id:b.tradingPlanId||'',imported_at:validIso(b.importedAt)||new Date().toISOString(),updated_at:new Date().toISOString(),payload:clone(b)};}
function opportunityCloudRow(o,userId){return {user_id:userId,id:o.id||uid('opp'),trading_plan_id:o.tradingPlanId||'',updated_at:new Date().toISOString(),payload:clone(o)};}
async function cloudSyncImages(user){
  const refs=new Set(collectReferencedImageIds()),records=await getAllImageRecords(),synced=new Set(cloudConfig.syncedImageIds||[]);let uploaded=0;
  for(const rec of records){if(!rec?.id||!refs.has(rec.id)||synced.has(rec.id))continue;const path=`${user.id}/${rec.id}`;const {error}=await cloudClient.storage.from(CLOUD_BUCKET).upload(path,rec.blob,{upsert:true,contentType:rec.type||rec.blob?.type||'application/octet-stream',cacheControl:'3600'});if(error)throw new Error(`Imagen ${rec.id}: ${error.message}`);synced.add(rec.id);uploaded++;}
  cloudConfig.syncedImageIds=[...synced];saveCloudConfigLocal();return uploaded;
}
async function cloudPushState(options={}){
  if(cloudBusy)return;cloudBusy=true;cloudSetStatus('Sincronizando hacia Supabase…','busy');if(!options.silent)render();
  try{
    const user=await cloudRequireUser();ensureAllPlansV8();
    const plans=state.tradingPlans.map(p=>planCloudRow(p,user.id)),inst=state.settings.instruments.map(i=>instrumentCloudRow(i,user.id)),ops=state.operations.map(o=>operationCloudRow(o,user.id)),batches=state.importBatches.map(b=>batchCloudRow(b,user.id)),opps=(state.opportunities||[]).map(o=>opportunityCloudRow(o,user.id));
    const {error:werr}=await cloudClient.from('trading_workspace').upsert({user_id:user.id,current_plan_id:state.currentPlanId||'',app_version:CLOUD_APP_VERSION,schema_version:CLOUD_SCHEMA_VERSION,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(werr)throw werr;
    await cloudUpsertChunks('trading_plans',plans);await cloudDeleteStale('trading_plans',plans.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_instruments',inst);await cloudDeleteStale('trading_instruments',inst.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_operations',ops);await cloudDeleteStale('trading_operations',ops.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_import_batches',batches);await cloudDeleteStale('trading_import_batches',batches.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_opportunities',opps);await cloudDeleteStale('trading_opportunities',opps.map(x=>x.id),user.id);
    const uploaded=await cloudSyncImages(user);cloudConfig.lastPush=new Date().toISOString();saveCloudConfigLocal();cloudSetStatus(`Sincronizado · ${ops.length} operaciones · ${uploaded} imagen(es) nuevas`,'ok',{plans:plans.length,operations:ops.length,batches:batches.length,instruments:inst.length});
  }catch(e){cloudSetStatus('Error de sincronización: '+e.message,'error');if(!options.silent)alert('No se pudo sincronizar con Supabase:\n'+e.message);}
  finally{cloudBusy=false;if(!options.silent&&currentView==='config'&&configTab==='cloud')render();}
}
async function cloudFetchRows(table,userId){const {data,error}=await cloudClient.from(table).select('*').eq('user_id',userId);if(error)throw new Error(`${table}: ${error.message}`);return data||[];}
async function cloudPullState(){
  if(cloudBusy)return;cloudBusy=true;cloudSetStatus('Leyendo Supabase…','busy');render();
  try{
    const user=await cloudRequireUser();const {data:ws,error:werr}=await cloudClient.from('trading_workspace').select('*').eq('user_id',user.id).maybeSingle();if(werr)throw werr;if(!ws)throw new Error('Todavía no hay un workspace guardado en Supabase. Primero sube tus datos desde el dispositivo principal.');
    const [plans,inst,ops,batches,opps]=await Promise.all(['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'].map(t=>cloudFetchRows(t,user.id)));
    if(!confirm(`Supabase contiene ${plans.length} plan(es) y ${ops.length} operación(es).\n\nEsto sustituirá el estado local de este navegador. ¿Continuar?`)){cloudSetStatus('Descarga cancelada','idle');return;}
    const incoming={operations:ops.map(x=>x.payload),opportunities:opps.map(x=>x.payload),importBatches:batches.map(x=>x.payload),settings:{instruments:inst.map(x=>x.payload)},tradingPlans:plans.map(x=>x.payload),currentPlanId:ws.current_plan_id||plans[0]?.id||''};
    state=normalizeState(incoming);ensureAllPlansV8();cloudSuppressAutoSync=true;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloudSuppressAutoSync=false;cloudConfig.lastPull=new Date().toISOString();saveCloudConfigLocal();cloudSetStatus(`Datos cargados · ${state.operations.length} operaciones`,'ok',{plans:state.tradingPlans.length,operations:state.operations.length,batches:state.importBatches.length,instruments:state.settings.instruments.length});currentView='dashboard';render();
  }catch(e){cloudSetStatus('Error al cargar: '+e.message,'error');alert('No se pudo cargar desde Supabase:\n'+e.message);}
  finally{cloudBusy=false;}
}
function cloudScheduleAutoSync(){if(cloudSuppressAutoSync||!cloudConfig.autoSync||!cloudAuthUser||cloudBusy)return;clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>cloudPushState({silent:true}),2200);}
const persistV9Local=persist;
persist=function(){persistV9Local();cloudScheduleAutoSync();};

async function cloudSignedImageUrl(id){if(!cloudClient||!cloudAuthUser||!id)return null;const {data,error}=await cloudClient.storage.from(CLOUD_BUCKET).createSignedUrl(`${cloudAuthUser.id}/${id}`,3600);if(error)return null;return data?.signedUrl||null;}
async function hydrateImageElements(root=document){
  const els=[...root.querySelectorAll('img[data-img-id]:not([data-hydrated])')];for(const el of els){el.dataset.hydrated='1';const blob=await getImageBlob(el.dataset.imgId);if(blob){const u=URL.createObjectURL(blob);el.src=u;el.onload=()=>setTimeout(()=>URL.revokeObjectURL(u),2000);continue;}const url=await cloudSignedImageUrl(el.dataset.imgId);if(url){el.src=url;el.classList.add('cloud-image');}else{el.alt='Imagen no disponible localmente ni en Supabase';el.classList.add('missing-image');}}
}
async function cloudDownloadImageBlob(id){if(!cloudClient||!cloudAuthUser)return null;const {data,error}=await cloudClient.storage.from(CLOUD_BUCKET).download(`${cloudAuthUser.id}/${id}`);return error?null:data;}
async function exportFullBackup(){
  try{
    const local=await getAllImageRecords(),map=new Map(local.map(x=>[x.id,x])),refs=[...new Set(collectReferencedImageIds())],images=[];
    for(const id of refs){let rec=map.get(id),blob=rec?.blob;if(!blob)blob=await cloudDownloadImageBlob(id);if(!blob)continue;const meta=findImageMetaByIdV9(id)||rec||{};images.push({id,name:meta.name||rec?.name||'imagen',type:meta.type||rec?.type||blob.type||'application/octet-stream',updatedAt:rec?.updatedAt||'',data:await blobToBase64(blob)});}
    const payload={format:BACKUP_FORMAT,schema:BACKUP_SCHEMA,appVersion:CLOUD_APP_VERSION,exportedAt:new Date().toISOString(),state:clone(state),images};const blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a'),d=new Date(),stamp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}-${String(d.getMinutes()).padStart(2,'0')}`;a.href=url;a.download=`Trading-Research-backup-${stamp}.trbackup`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);alert(`Copia completa creada.\nPlanes: ${state.tradingPlans.length}\nOperaciones: ${state.operations.length}\nImágenes: ${images.length}`);
  }catch(e){alert('No se pudo crear la copia de seguridad: '+e.message);}
}
function findImageMetaByIdV9(id){let found=null;state.operations.some(o=>{found=(o.images||[]).find(x=>x.id===id)||null;return !!found;});if(found)return found;for(const p of state.tradingPlans){ensurePlanV8Structure(p);for(const r of p.visualReferences||[]){found=(r.images||[]).find(x=>x.id===id);if(found)return found;}for(const d of p.setupDefinitions||[]){found=[...(d.imagesLong||[]),...(d.imagesShort||[])].find(x=>x.id===id);if(found)return found;}for(const d of p.vdDefinitions||[]){found=(d.images||[]).find(x=>x.id===id);if(found)return found;}for(const d of p.contextDefinitions||[]){found=(d.images||[]).find(x=>x.id===id);if(found)return found;}}return null;}

function configTabs(p){const tabs=[['instruments','Contratos','Biblioteca global'],['management','Gestión','Estrategias y salidas'],['taxonomy','Taxonomías','Setups, VD, contexto y estructura'],['visual','Referencias visuales','Galería del plan'],['emotional','Emocional','Estados y comportamientos'],['riskrules','Riesgo','Reglas diarias/semanales'],['data','Datos y seguridad','Backup e integridad'],['cloud','Nube','Supabase y sincronización']];return `<div class="config-tabs">${tabs.map(([id,label,desc])=>`<button class="config-tab ${configTab===id?'active':''}" onclick="setConfigTab('${id}')"><strong>${label}</strong><span>${desc}</span></button>`).join('')}</div>`;}
function configContent(p){ensurePlanV8Structure(p);if(configTab==='management')return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Regímenes / estrategias de gestión · ${esc(planLabel(p))}</h3><div class="help">Las estrategias consumen los contratos globales y construyen lotes, stops y objetivos.</div></div><button class="btn primary small" onclick="openRiskModal()">+ Nueva estrategia</button></div><div class="config-list">${(p?.riskStrategies||[]).length?p.riskStrategies.map(r=>riskCard(r)).join(''):'<div class="empty">Este plan todavía no tiene estrategias de gestión.</div>'}</div></section><div style="margin-top:16px">${configCard('Salidas discrecionales','Módulos disponibles para TP variable','discretionaryTargets')}</div>`;if(configTab==='taxonomy')return configTaxonomyPanel(p);if(configTab==='visual')return visualReferencePanel(p);if(configTab==='emotional')return emotionConfigPanel(p);if(configTab==='riskrules')return riskManagementPanel(p);if(configTab==='data')return dataSecurityPanel();if(configTab==='cloud')return cloudConfigPanel();return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Biblioteca global de contratos / instrumentos</h3><div class="help">Fuente única para tick size, valor del tick, comisión y moneda. Todos los Trading Plans pueden reutilizar estos contratos.</div></div><button class="btn primary small" onclick="openInstrumentModal()">+ Añadir contrato</button></div>${instrumentTable()}</section>`;}
Object.assign(window,{saveCloudConnection,testCloudConnection,cloudSignIn,cloudSignUp,cloudSignOut,setCloudAutoSync,cloudPushState,cloudPullState});
initCloudClient().then(()=>{if(currentView==='config'&&configTab==='cloud')render();});
render();
/* ===== END V9 PATCH ===== */


/* V9.0.1 · fix auth form preservation when initializing client */
async function cloudSignIn(){
  const creds=cloudCredentials();
  if(!cloudClient){
    cloudConfig.url=(document.getElementById('f-cloud-url')?.value||cloudConfig.url||'').trim().replace(/\/$/,'');
    cloudConfig.publishableKey=(document.getElementById('f-cloud-key')?.value||cloudConfig.publishableKey||'').trim();
    saveCloudConfigLocal();await initCloudClient();
  }
  if(!cloudClient)return alert('Configura primero Project URL y Publishable key.');
  const {email,password}=creds;if(!email||!password)return alert('Introduce email y contraseña.');
  cloudSetStatus('Iniciando sesión…','busy');
  const {data,error}=await cloudClient.auth.signInWithPassword({email,password});if(error){cloudSetStatus('Login fallido: '+error.message,'error');render();return;}
  cloudAuthUser=data.user;cloudSetStatus(`Sesión activa: ${cloudUserLabel()}`,'ok');render();
}
async function cloudSignUp(){
  const creds=cloudCredentials();
  if(!cloudClient){
    cloudConfig.url=(document.getElementById('f-cloud-url')?.value||cloudConfig.url||'').trim().replace(/\/$/,'');
    cloudConfig.publishableKey=(document.getElementById('f-cloud-key')?.value||cloudConfig.publishableKey||'').trim();
    saveCloudConfigLocal();await initCloudClient();
  }
  if(!cloudClient)return alert('Configura primero Project URL y Publishable key.');
  const {email,password}=creds;if(!email||!password)return alert('Introduce email y contraseña.');
  cloudSetStatus('Creando cuenta…','busy');
  const {data,error}=await cloudClient.auth.signUp({email,password});if(error){cloudSetStatus('No se pudo crear la cuenta: '+error.message,'error');render();return;}
  cloudAuthUser=data.session?.user||null;cloudSetStatus(cloudAuthUser?'Cuenta creada y sesión activa':'Cuenta creada · revisa el email si Supabase exige confirmación','ok');render();
}
function opportunityCloudRow(o,userId){if(!o.id)o.id=uid('opp');return {user_id:userId,id:o.id,trading_plan_id:o.tradingPlanId||'',updated_at:new Date().toISOString(),payload:clone(o)};}
Object.assign(window,{cloudSignIn,cloudSignUp});

/* ===== V9.1 PATCH · destructive sync protection ===== */
const CLOUD_SAFETY_SNAPSHOT_KEY='tradingResearchCloudSafetySnapshot_v1';
const CLOUD_APP_VERSION_V91='9.1.0';

function cloudLocalInventory(){
  return {
    plans:(state.tradingPlans||[]).map(x=>x.id),
    instruments:(state.settings?.instruments||[]).map(x=>x.id),
    operations:(state.operations||[]).map(x=>x.id),
    batches:(state.importBatches||[]).map(x=>x.id),
    opportunities:(state.opportunities||[]).map(x=>x.id)
  };
}
async function cloudRemoteInventory(userId){
  const tables={plans:'trading_plans',instruments:'trading_instruments',operations:'trading_operations',batches:'trading_import_batches',opportunities:'trading_opportunities'};
  const out={};
  for(const [key,table] of Object.entries(tables)){
    const {data,error}=await cloudClient.from(table).select('id').eq('user_id',userId);
    if(error)throw new Error(`${table}: ${error.message}`);
    out[key]=(data||[]).map(x=>x.id);
  }
  return out;
}
function cloudDiffInventory(local,remote){
  const deleted={},missingLocal={};let deleteCount=0,localLossCount=0;
  for(const key of ['plans','instruments','operations','batches','opportunities']){
    const l=new Set(local[key]||[]),r=new Set(remote[key]||[]);
    deleted[key]=[...r].filter(id=>!l.has(id));
    missingLocal[key]=[...l].filter(id=>!r.has(id));
    deleteCount+=deleted[key].length;
    localLossCount+=missingLocal[key].length;
  }
  return {deleted,missingLocal,deleteCount,localLossCount};
}
function saveCloudSafetySnapshot(reason){
  try{
    localStorage.setItem(CLOUD_SAFETY_SNAPSHOT_KEY,JSON.stringify({savedAt:new Date().toISOString(),reason,state:clone(state)}));
  }catch{}
}
function cloudCounts(inv){return {plans:(inv.plans||[]).length,operations:(inv.operations||[]).length,instruments:(inv.instruments||[]).length,batches:(inv.batches||[]).length,opportunities:(inv.opportunities||[]).length};}
async function refreshCloudRemoteStatus(){
  try{
    const user=await cloudRequireUser(),inv=await cloudRemoteInventory(user.id),c=cloudCounts(inv);
    cloudSetStatus(`Remoto consultado · ${c.operations} operaciones`,'ok',{plans:c.plans,operations:c.operations,batches:c.batches,instruments:c.instruments});
    if(currentView==='config'&&configTab==='cloud')render();
    return inv;
  }catch(e){cloudSetStatus('No se pudo consultar remoto: '+e.message,'error');if(currentView==='config'&&configTab==='cloud')render();return null;}
}

cloudPushState = async function(options={}){
  if(cloudBusy)return;cloudBusy=true;cloudSetStatus('Verificando seguridad antes de subir…','busy');if(!options.silent)render();
  try{
    const user=await cloudRequireUser();ensureAllPlansV8();
    const localInv=cloudLocalInventory(),remoteInv=await cloudRemoteInventory(user.id),diff=cloudDiffInventory(localInv,remoteInv),lc=cloudCounts(localInv),rc=cloudCounts(remoteInv);
    if(diff.deleteCount>0){
      if(options.silent){
        cloudConfig.autoSync=false;saveCloudConfigLocal();
        cloudSetStatus(`Auto-sync bloqueado: la subida borraría ${diff.deleteCount} registro(s) remotos`,'error',{plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments});
        return;
      }
      const msg=`PROTECCIÓN DE DATOS\n\nLocal: ${lc.plans} planes · ${lc.operations} operaciones\nNube: ${rc.plans} planes · ${rc.operations} operaciones\n\nEsta subida eliminaría ${diff.deleteCount} registro(s) que existen en Supabase y no existen en este dispositivo.\n\nPara continuar deliberadamente escribe exactamente:\nSOBRESCRIBIR NUBE`;
      const typed=prompt(msg,'');
      if(typed!=='SOBRESCRIBIR NUBE'){cloudSetStatus('Subida cancelada por protección de datos','idle',{plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments});return;}
    }
    saveCloudSafetySnapshot('before-cloud-push');
    const plans=state.tradingPlans.map(p=>planCloudRow(p,user.id)),inst=state.settings.instruments.map(i=>instrumentCloudRow(i,user.id)),ops=state.operations.map(o=>operationCloudRow(o,user.id)),batches=state.importBatches.map(b=>batchCloudRow(b,user.id)),opps=(state.opportunities||[]).map(o=>opportunityCloudRow(o,user.id));
    const {error:werr}=await cloudClient.from('trading_workspace').upsert({user_id:user.id,current_plan_id:state.currentPlanId||'',app_version:CLOUD_APP_VERSION_V91,schema_version:CLOUD_SCHEMA_VERSION,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(werr)throw werr;
    await cloudUpsertChunks('trading_plans',plans);await cloudDeleteStale('trading_plans',plans.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_instruments',inst);await cloudDeleteStale('trading_instruments',inst.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_operations',ops);await cloudDeleteStale('trading_operations',ops.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_import_batches',batches);await cloudDeleteStale('trading_import_batches',batches.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_opportunities',opps);await cloudDeleteStale('trading_opportunities',opps.map(x=>x.id),user.id);
    const uploaded=await cloudSyncImages(user);cloudConfig.lastPush=new Date().toISOString();saveCloudConfigLocal();cloudSetStatus(`Sincronizado · ${ops.length} operaciones · ${uploaded} imagen(es) nuevas`,'ok',{plans:plans.length,operations:ops.length,batches:batches.length,instruments:inst.length});
  }catch(e){cloudSetStatus('Error de sincronización: '+e.message,'error');if(!options.silent)alert('No se pudo sincronizar con Supabase:\n'+e.message);}
  finally{cloudBusy=false;if(!options.silent&&currentView==='config'&&configTab==='cloud')render();}
};

cloudPullState = async function(){
  if(cloudBusy)return;cloudBusy=true;cloudSetStatus('Verificando nube antes de descargar…','busy');render();
  try{
    const user=await cloudRequireUser();const {data:ws,error:werr}=await cloudClient.from('trading_workspace').select('*').eq('user_id',user.id).maybeSingle();if(werr)throw werr;if(!ws)throw new Error('Todavía no hay un workspace guardado en Supabase. Primero sube tus datos desde el dispositivo principal.');
    const [plans,inst,ops,batches,opps]=await Promise.all(['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'].map(t=>cloudFetchRows(t,user.id)));
    const remoteInv={plans:plans.map(x=>x.id),instruments:inst.map(x=>x.id),operations:ops.map(x=>x.id),batches:batches.map(x=>x.id),opportunities:opps.map(x=>x.id)},localInv=cloudLocalInventory(),diff=cloudDiffInventory(remoteInv,localInv),lc=cloudCounts(localInv),rc=cloudCounts(remoteInv);
    const localWouldBeLost=diff.deleteCount; // IDs que están localmente y no vienen de la nube
    if(localWouldBeLost>0){
      const msg=`PROTECCIÓN DE DATOS\n\nLocal: ${lc.plans} planes · ${lc.operations} operaciones\nNube: ${rc.plans} planes · ${rc.operations} operaciones\n\nLa descarga sustituirá este dispositivo y eliminaría ${localWouldBeLost} registro(s) locales que no existen en Supabase.\n\nPara continuar deliberadamente escribe exactamente:\nREEMPLAZAR LOCAL`;
      const typed=prompt(msg,'');
      if(typed!=='REEMPLAZAR LOCAL'){cloudSetStatus('Descarga cancelada por protección de datos','idle',{plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments});return;}
    }else{
      if(!confirm(`Supabase contiene ${plans.length} plan(es) y ${ops.length} operación(es).\n\nEste navegador tiene ${lc.plans} plan(es) y ${lc.operations} operación(es).\n\nSe cargará la nube en este dispositivo. ¿Continuar?`)){cloudSetStatus('Descarga cancelada','idle',{plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments});return;}
    }
    saveCloudSafetySnapshot('before-cloud-pull');
    const incoming={operations:ops.map(x=>x.payload),opportunities:opps.map(x=>x.payload),importBatches:batches.map(x=>x.payload),settings:{instruments:inst.map(x=>x.payload)},tradingPlans:plans.map(x=>x.payload),currentPlanId:ws.current_plan_id||plans[0]?.id||''};
    state=normalizeState(incoming);ensureAllPlansV8();cloudSuppressAutoSync=true;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloudSuppressAutoSync=false;cloudConfig.lastPull=new Date().toISOString();saveCloudConfigLocal();cloudSetStatus(`Datos cargados · ${state.operations.length} operaciones`,'ok',{plans:state.tradingPlans.length,operations:state.operations.length,batches:state.importBatches.length,instruments:state.settings.instruments.length});currentView='dashboard';render();
  }catch(e){cloudSetStatus('Error al cargar: '+e.message,'error');alert('No se pudo cargar desde Supabase:\n'+e.message);}
  finally{cloudBusy=false;}
};

setCloudAutoSync = function(v){
  if(v && !confirm('La sincronización automática solo se activará si el dispositivo y la nube son compatibles. Si una subida implicase borrar registros remotos, V9.1 la bloqueará automáticamente. ¿Activar?')){render();return;}
  cloudConfig.autoSync=!!v;saveCloudConfigLocal();if(v)cloudScheduleAutoSync();render();
};

const cloudConfigPanelV91Base=cloudConfigPanel;
cloudConfigPanel=function(){
  const html=cloudConfigPanelV91Base();
  return html.replace('<span class="stable-pill">V9 Cloud Sync</span>','<span class="stable-pill">V9.1 Safe Sync</span>')
    .replace('<div class="security-actions"><button class="btn primary"','<div class="security-actions"><button class="btn small" onclick="refreshCloudRemoteStatus()">Actualizar estado remoto</button><button class="btn primary"')
    .replace('La primera vez usa <strong>Subir local → Supabase</strong>. En otro ordenador, inicia sesión y usa <strong>Cargar Supabase → este dispositivo</strong>. La descarga sustituye el estado local después de pedir confirmación.','<strong>Protección V9.1:</strong> una subida que vaya a borrar registros remotos queda bloqueada en auto-sync y exige escribir <strong>SOBRESCRIBIR NUBE</strong> en modo manual. Una descarga que vaya a borrar datos locales exige <strong>REEMPLAZAR LOCAL</strong>.');
};

Object.assign(window,{cloudPushState,cloudPullState,setCloudAutoSync,refreshCloudRemoteStatus});
if(cloudAuthUser)setTimeout(refreshCloudRemoteStatus,300);
render();
/* ===== END V9.1 PATCH ===== */


/* ===== V9.2 PATCH · revision conflict guard + snapshot history ===== */
const CLOUD_APP_VERSION_V92='9.2.0';
const CLOUD_SNAPSHOT_HISTORY_KEY='tradingResearchCloudSnapshotHistory_v2';
const CLOUD_SNAPSHOT_LIMIT=3;

cloudConfig.baseRemoteRevision=cloudConfig.baseRemoteRevision||'';
cloudConfig.localDirty=!!cloudConfig.localDirty;
cloudConfig.localDirtyAt=cloudConfig.localDirtyAt||'';
cloudConfig.deviceId=cloudConfig.deviceId||uid('DEV');
cloudConfig.conflict=cloudConfig.conflict||null;
saveCloudConfigLocal();

function cloudShortRevision(v){if(!v)return 'No vinculada';try{return fmtDate(v);}catch{return String(v).slice(0,19);}}
function cloudSetConflict(remoteRevision,reason='remote-changed'){
  cloudConfig.conflict={remoteRevision:remoteRevision||'',baseRevision:cloudConfig.baseRemoteRevision||'',reason,detectedAt:new Date().toISOString()};
  cloudConfig.autoSync=false;saveCloudConfigLocal();
}
function cloudClearConflict(){cloudConfig.conflict=null;saveCloudConfigLocal();}

function cloudStableValue(value){
  if(Array.isArray(value))return value.map(cloudStableValue);
  if(value&&typeof value==='object')return Object.keys(value).sort().reduce((o,k)=>{o[k]=cloudStableValue(value[k]);return o;},{});
  return value;
}
async function cloudSha256(value){
  const text=JSON.stringify(cloudStableValue(value));
  if(!globalThis.crypto?.subtle){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function cloudLocalFingerprintPayload(){
  ensureAllPlansV8();
  const byId=a=>clone(a||[]).sort((x,y)=>String(x?.id||'').localeCompare(String(y?.id||'')));
  return {currentPlanId:state.currentPlanId||'',plans:byId(state.tradingPlans),instruments:byId(state.settings?.instruments),operations:byId(state.operations),batches:byId(state.importBatches),opportunities:byId(state.opportunities)};
}
async function cloudWorkspaceMeta(userId){
  const {data,error}=await cloudClient.from('trading_workspace').select('user_id,current_plan_id,app_version,schema_version,updated_at').eq('user_id',userId).maybeSingle();
  if(error)throw new Error('trading_workspace: '+error.message);return data||null;
}
async function cloudRemoteBundle(userId){
  const ws=await cloudWorkspaceMeta(userId);
  if(!ws)return {ws:null,plans:[],inst:[],ops:[],batches:[],opps:[]};
  const [plans,inst,ops,batches,opps]=await Promise.all(['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'].map(t=>cloudFetchRows(t,userId)));
  return {ws,plans,inst,ops,batches,opps};
}
function cloudRemoteFingerprintPayload(bundle){
  const byId=a=>(a||[]).slice().sort((x,y)=>String(x?.id||'').localeCompare(String(y?.id||''))).map(x=>clone(x.payload));
  return {currentPlanId:bundle.ws?.current_plan_id||'',plans:byId(bundle.plans),instruments:byId(bundle.inst),operations:byId(bundle.ops),batches:byId(bundle.batches),opportunities:byId(bundle.opps)};
}
async function cloudTryBootstrapRevision(user){
  if(cloudConfig.baseRemoteRevision)return {ok:true,revision:cloudConfig.baseRemoteRevision,bootstrapped:false};
  const bundle=await cloudRemoteBundle(user.id);
  if(!bundle.ws)return {ok:true,revision:'',bootstrapped:false,newWorkspace:true};
  const [localHash,remoteHash]=await Promise.all([cloudSha256(cloudLocalFingerprintPayload()),cloudSha256(cloudRemoteFingerprintPayload(bundle))]);
  if(localHash!==remoteHash)return {ok:false,revision:bundle.ws.updated_at,bundle,reason:'baseline-mismatch'};
  cloudConfig.baseRemoteRevision=bundle.ws.updated_at||'';cloudConfig.localDirty=false;cloudConfig.localDirtyAt='';cloudClearConflict();saveCloudConfigLocal();
  return {ok:true,revision:cloudConfig.baseRemoteRevision,bootstrapped:true,bundle};
}
async function cloudAcquireRevisionLock(user,expectedRevision,forceExpected=''){
  const nextRevision=new Date().toISOString();
  const expected=forceExpected||expectedRevision||'';
  if(!expected){
    const {data,error}=await cloudClient.from('trading_workspace').insert({user_id:user.id,current_plan_id:state.currentPlanId||'',app_version:CLOUD_APP_VERSION_V92,schema_version:CLOUD_SCHEMA_VERSION,updated_at:nextRevision}).select('updated_at').single();
    if(error)throw new Error('No se pudo crear la revisión de nube: '+error.message);
    const rev=data?.updated_at||nextRevision;cloudConfig.baseRemoteRevision=rev;saveCloudConfigLocal();return rev;
  }
  const {data,error}=await cloudClient.from('trading_workspace').update({current_plan_id:state.currentPlanId||'',app_version:CLOUD_APP_VERSION_V92,schema_version:CLOUD_SCHEMA_VERSION,updated_at:nextRevision}).eq('user_id',user.id).eq('updated_at',expected).select('updated_at');
  if(error)throw new Error('No se pudo reservar la revisión de nube: '+error.message);
  if(!data?.length){const latest=await cloudWorkspaceMeta(user.id);const err=new Error('CONFLICT_REVISION');err.remoteRevision=latest?.updated_at||'';throw err;}
  const rev=data[0]?.updated_at||nextRevision;cloudConfig.baseRemoteRevision=rev;saveCloudConfigLocal();return rev;
}

function loadCloudSnapshotHistory(){try{return JSON.parse(localStorage.getItem(CLOUD_SNAPSHOT_HISTORY_KEY)||'[]')||[];}catch{return [];}}
function saveCloudSnapshotHistory(items){try{localStorage.setItem(CLOUD_SNAPSHOT_HISTORY_KEY,JSON.stringify(items));return true;}catch{return false;}}
function cloudSnapshotReasonLabel(r){return ({'before-cloud-push':'Antes de subida','before-cloud-pull':'Antes de descarga','before-conflict-force-push':'Antes de resolver conflicto con local','manual':'Snapshot manual'}[r]||r||'Snapshot');}
function saveCloudSafetySnapshot(reason){
  const snap={id:uid('SNAP'),savedAt:new Date().toISOString(),reason,counts:{plans:state.tradingPlans?.length||0,operations:state.operations?.length||0,instruments:state.settings?.instruments?.length||0},state:clone(state)};
  let hist=loadCloudSnapshotHistory();hist.unshift(snap);hist=hist.slice(0,CLOUD_SNAPSHOT_LIMIT);
  if(!saveCloudSnapshotHistory(hist)){hist=hist.slice(0,1);saveCloudSnapshotHistory(hist);}
  try{localStorage.setItem(CLOUD_SAFETY_SNAPSHOT_KEY,JSON.stringify(snap));}catch{}
  return snap;
}
function createManualCloudSnapshot(){saveCloudSafetySnapshot('manual');cloudSetStatus('Snapshot local creado','ok');render();}
function restoreCloudSnapshot(id){
  const snap=loadCloudSnapshotHistory().find(x=>x.id===id);if(!snap)return alert('Snapshot no encontrado.');
  if(!confirm(`Restaurar snapshot de ${fmtDate(snap.savedAt)} con ${snap.counts?.operations||0} operaciones?\n\nLa sincronización automática quedará desactivada hasta que revises el estado.`))return;
  cloudConfig.autoSync=false;cloudConfig.localDirty=true;cloudConfig.localDirtyAt=new Date().toISOString();cloudClearConflict();saveCloudConfigLocal();
  cloudSuppressAutoSync=true;state=normalizeState(clone(snap.state));ensureAllPlansV8();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloudSuppressAutoSync=false;currentView='dashboard';render();
}
function deleteCloudSnapshot(id){const hist=loadCloudSnapshotHistory().filter(x=>x.id!==id);saveCloudSnapshotHistory(hist);render();}
function cloudSnapshotPanelV92(){
  const hist=loadCloudSnapshotHistory();
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Snapshots locales de seguridad</h3><div class="help">V9.2 guarda hasta ${CLOUD_SNAPSHOT_LIMIT} estados locales antes de subidas/descargas importantes. No incluyen blobs de imagen, pero las referencias pueden recuperarlas desde Supabase Storage.</div></div><button class="btn small" onclick="createManualCloudSnapshot()">Crear snapshot</button></div>${hist.length?`<div class="snapshot-list">${hist.map(s=>`<div class="snapshot-row"><div><strong>${esc(cloudSnapshotReasonLabel(s.reason))}</strong><span>${fmtDate(s.savedAt)} · ${s.counts?.plans||0} planes · ${s.counts?.operations||0} operaciones</span></div><div class="snapshot-actions"><button class="btn small" onclick="restoreCloudSnapshot('${s.id}')">Restaurar</button><button class="btn small danger" onclick="deleteCloudSnapshot('${s.id}')">Eliminar</button></div></div>`).join('')}</div>`:'<div class="empty compact-empty">Todavía no hay snapshots.</div>'}</section>`;
}

const persistV92Base=persist;
persist=function(){
  if(!cloudSuppressAutoSync){cloudConfig.localDirty=true;cloudConfig.localDirtyAt=new Date().toISOString();saveCloudConfigLocal();}
  persistV92Base();
};

async function refreshCloudRemoteStatus(){
  try{
    const user=await cloudRequireUser(),meta=await cloudWorkspaceMeta(user.id),inv=await cloudRemoteInventory(user.id),c=cloudCounts(inv);
    let extra='';
    if(meta){
      if(!cloudConfig.baseRemoteRevision){
        const boot=await cloudTryBootstrapRevision(user);
        if(boot.ok&&boot.bootstrapped)extra=' · revisión vinculada';
        else if(!boot.ok){cloudSetConflict(meta.updated_at,'baseline-mismatch');extra=' · revisión NO vinculada';}
      }else if(meta.updated_at!==cloudConfig.baseRemoteRevision){cloudSetConflict(meta.updated_at,'remote-changed');extra=' · CAMBIO REMOTO';}
      else cloudClearConflict();
    }
    const conflict=cloudConfig.conflict;
    cloudSetStatus(conflict?`Cambio remoto detectado · descarga/revisa antes de subir`:`Remoto consultado · ${c.operations} operaciones${extra}`,conflict?'error':'ok',{plans:c.plans,operations:c.operations,batches:c.batches,instruments:c.instruments,revision:meta?.updated_at||''});
    if(currentView==='config'&&configTab==='cloud')render();return inv;
  }catch(e){cloudSetStatus('No se pudo consultar remoto: '+e.message,'error');if(currentView==='config'&&configTab==='cloud')render();return null;}
}

cloudPushState=async function(options={}){
  if(cloudBusy)return;cloudBusy=true;cloudSetStatus('Comprobando revisión y seguridad…','busy');if(!options.silent)render();
  try{
    const user=await cloudRequireUser();ensureAllPlansV8();
    let meta=await cloudWorkspaceMeta(user.id),forceExpected='';
    if(meta&&!cloudConfig.baseRemoteRevision){
      const boot=await cloudTryBootstrapRevision(user);
      if(!boot.ok){
        cloudSetConflict(meta.updated_at,'baseline-mismatch');
        if(options.silent){cloudSetStatus('Auto-sync bloqueado: este dispositivo no comparte la misma revisión que la nube','error');return;}
        const typed=prompt(`CONFLICT GUARD V9.2\n\nEste dispositivo no tiene una revisión base compatible con Supabase. La nube y el estado local contienen diferencias de contenido.\n\nRecomendado: cancelar y usar Cargar Supabase → este dispositivo.\n\nSi deliberadamente quieres que ESTE dispositivo prevalezca, escribe exactamente:\nRESOLVER CON LOCAL`,'');
        if(typed!=='RESOLVER CON LOCAL'){cloudSetStatus('Subida cancelada por Conflict Guard','idle');return;}
        saveCloudSafetySnapshot('before-conflict-force-push');forceExpected=meta.updated_at;
      }
    }
    meta=await cloudWorkspaceMeta(user.id);
    if(meta&&cloudConfig.baseRemoteRevision&&meta.updated_at!==cloudConfig.baseRemoteRevision&&!forceExpected){
      cloudSetConflict(meta.updated_at,'remote-changed');
      if(options.silent){cloudSetStatus('Auto-sync bloqueado: Supabase cambió desde la última sincronización','error');return;}
      const typed=prompt(`CONFLICT GUARD V9.2\n\nLa nube cambió desde la última sincronización de este dispositivo.\n\nBase del dispositivo: ${cloudShortRevision(cloudConfig.baseRemoteRevision)}\nNube actual: ${cloudShortRevision(meta.updated_at)}\nCambios locales pendientes: ${cloudConfig.localDirty?'SÍ':'No'}\n\nRecomendado: cancelar y descargar/revisar la nube.\n\nPara hacer prevalecer deliberadamente ESTE dispositivo escribe:\nRESOLVER CON LOCAL`,'');
      if(typed!=='RESOLVER CON LOCAL'){cloudSetStatus('Subida cancelada: conflicto remoto pendiente','error');return;}
      saveCloudSafetySnapshot('before-conflict-force-push');forceExpected=meta.updated_at;
    }
    const localInv=cloudLocalInventory(),remoteInv=await cloudRemoteInventory(user.id),diff=cloudDiffInventory(localInv,remoteInv),lc=cloudCounts(localInv),rc=cloudCounts(remoteInv);
    if(diff.deleteCount>0){
      if(options.silent){cloudConfig.autoSync=false;saveCloudConfigLocal();cloudSetStatus(`Auto-sync bloqueado: la subida borraría ${diff.deleteCount} registro(s) remotos`,'error',{plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments,revision:meta?.updated_at||''});return;}
      const typed=prompt(`PROTECCIÓN DE DATOS\n\nLocal: ${lc.plans} planes · ${lc.operations} operaciones\nNube: ${rc.plans} planes · ${rc.operations} operaciones\n\nEsta subida eliminaría ${diff.deleteCount} registro(s) remotos.\n\nPara continuar deliberadamente escribe exactamente:\nSOBRESCRIBIR NUBE`,'');
      if(typed!=='SOBRESCRIBIR NUBE'){cloudSetStatus('Subida cancelada por protección de datos','idle');return;}
    }
    saveCloudSafetySnapshot('before-cloud-push');
    try{await cloudAcquireRevisionLock(user,cloudConfig.baseRemoteRevision,forceExpected);}catch(lockErr){
      if(lockErr.message==='CONFLICT_REVISION'){cloudSetConflict(lockErr.remoteRevision,'race-conflict');cloudSetStatus('Conflicto detectado: otro dispositivo ganó la revisión mientras sincronizabas','error');return;}throw lockErr;
    }
    const plans=state.tradingPlans.map(p=>planCloudRow(p,user.id)),inst=state.settings.instruments.map(i=>instrumentCloudRow(i,user.id)),ops=state.operations.map(o=>operationCloudRow(o,user.id)),batches=state.importBatches.map(b=>batchCloudRow(b,user.id)),opps=(state.opportunities||[]).map(o=>opportunityCloudRow(o,user.id));
    await cloudUpsertChunks('trading_plans',plans);await cloudDeleteStale('trading_plans',plans.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_instruments',inst);await cloudDeleteStale('trading_instruments',inst.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_operations',ops);await cloudDeleteStale('trading_operations',ops.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_import_batches',batches);await cloudDeleteStale('trading_import_batches',batches.map(x=>x.id),user.id);
    await cloudUpsertChunks('trading_opportunities',opps);await cloudDeleteStale('trading_opportunities',opps.map(x=>x.id),user.id);
    const uploaded=await cloudSyncImages(user);cloudConfig.lastPush=new Date().toISOString();cloudConfig.localDirty=false;cloudConfig.localDirtyAt='';cloudClearConflict();saveCloudConfigLocal();
    cloudSetStatus(`Sincronizado V9.2 · ${ops.length} operaciones · ${uploaded} imagen(es) nuevas`,'ok',{plans:plans.length,operations:ops.length,batches:batches.length,instruments:inst.length,revision:cloudConfig.baseRemoteRevision});
  }catch(e){cloudSetStatus('Error de sincronización: '+e.message,'error');if(!options.silent)alert('No se pudo sincronizar con Supabase:\n'+e.message);}
  finally{cloudBusy=false;if(!options.silent&&currentView==='config'&&configTab==='cloud')render();}
};

cloudPullState=async function(){
  if(cloudBusy)return;cloudBusy=true;cloudSetStatus('Verificando revisión antes de descargar…','busy');render();
  try{
    const user=await cloudRequireUser(),bundle=await cloudRemoteBundle(user.id),ws=bundle.ws;if(!ws)throw new Error('Todavía no hay un workspace guardado en Supabase.');
    const {plans,inst,ops,batches,opps}=bundle;
    const remoteInv={plans:plans.map(x=>x.id),instruments:inst.map(x=>x.id),operations:ops.map(x=>x.id),batches:batches.map(x=>x.id),opportunities:opps.map(x=>x.id)},localInv=cloudLocalInventory(),diff=cloudDiffInventory(remoteInv,localInv),lc=cloudCounts(localInv),rc=cloudCounts(remoteInv);
    const localWouldBeLost=diff.deleteCount,remoteChanged=!!cloudConfig.baseRemoteRevision&&ws.updated_at!==cloudConfig.baseRemoteRevision;
    const destructiveToLocal=localWouldBeLost>0||cloudConfig.localDirty;
    if(destructiveToLocal){
      const typed=prompt(`CONFLICT GUARD V9.2\n\nLocal: ${lc.plans} planes · ${lc.operations} operaciones\nNube: ${rc.plans} planes · ${rc.operations} operaciones\nCambio remoto desde tu base: ${remoteChanged?'SÍ':'No'}\nCambios locales pendientes: ${cloudConfig.localDirty?'SÍ':'No'}\n\nLa descarga descartará el estado local actual. Se creará antes un snapshot de seguridad.\n\nPara continuar escribe exactamente:\nREEMPLAZAR LOCAL`,'');
      if(typed!=='REEMPLAZAR LOCAL'){cloudSetStatus('Descarga cancelada por Conflict Guard','idle',{plans:rc.plans,operations:rc.operations,batches:rc.batches,instruments:rc.instruments,revision:ws.updated_at});return;}
    }else if(!confirm(`Supabase contiene ${plans.length} plan(es) y ${ops.length} operación(es).\n\nSe cargará la revisión remota ${cloudShortRevision(ws.updated_at)} en este dispositivo. ¿Continuar?`)){cloudSetStatus('Descarga cancelada','idle');return;}
    saveCloudSafetySnapshot('before-cloud-pull');
    const incoming={operations:ops.map(x=>x.payload),opportunities:opps.map(x=>x.payload),importBatches:batches.map(x=>x.payload),settings:{instruments:inst.map(x=>x.payload)},tradingPlans:plans.map(x=>x.payload),currentPlanId:ws.current_plan_id||plans[0]?.id||''};
    state=normalizeState(incoming);ensureAllPlansV8();cloudSuppressAutoSync=true;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));cloudSuppressAutoSync=false;
    cloudConfig.lastPull=new Date().toISOString();cloudConfig.baseRemoteRevision=ws.updated_at||'';cloudConfig.localDirty=false;cloudConfig.localDirtyAt='';cloudClearConflict();saveCloudConfigLocal();
    cloudSetStatus(`Datos cargados V9.2 · ${state.operations.length} operaciones`,'ok',{plans:state.tradingPlans.length,operations:state.operations.length,batches:state.importBatches.length,instruments:state.settings.instruments.length,revision:ws.updated_at});currentView='dashboard';render();
  }catch(e){cloudSetStatus('Error al cargar: '+e.message,'error');alert('No se pudo cargar desde Supabase:\n'+e.message);}
  finally{cloudBusy=false;}
};

setCloudAutoSync=function(v){
  if(v&&cloudConfig.conflict){alert('No puedes activar auto-sync mientras exista un conflicto remoto. Carga Supabase o resuelve el conflicto primero.');render();return;}
  if(v&&!confirm('V9.2 comprobará una revisión remota antes de cada subida. Si otro dispositivo ha sincronizado desde tu última revisión, el auto-sync se bloqueará en vez de sobrescribirlo. ¿Activar?')){render();return;}
  cloudConfig.autoSync=!!v;saveCloudConfigLocal();if(v)cloudScheduleAutoSync();render();
};

const cloudConfigPanelV92Base=cloudConfigPanel;
cloudConfigPanel=function(){
  let html=cloudConfigPanelV92Base();
  html=html.replace('<span class="stable-pill">V9.1 Safe Sync</span>','<span class="stable-pill">V9.2 Conflict Guard</span>');
  const rev=`<div class="v92-revision-strip"><div><span>Revisión base del dispositivo</span><strong>${esc(cloudShortRevision(cloudConfig.baseRemoteRevision))}</strong></div><div><span>Cambios locales</span><strong class="${cloudConfig.localDirty?'warn-text':'ok-text'}">${cloudConfig.localDirty?'Pendientes':'Sin cambios'}</strong></div><div><span>Conflict Guard</span><strong class="${cloudConfig.conflict?'danger-text':'ok-text'}">${cloudConfig.conflict?'Conflicto detectado':'Compatible'}</strong></div></div>`;
  html=html.replace('<div class="security-actions"><button class="btn primary"',rev+'<div class="security-actions"><button class="btn primary"');
  html=html.replace('<strong>Protección V9.1:</strong> una subida que vaya a borrar registros remotos queda bloqueada en auto-sync y exige escribir <strong>SOBRESCRIBIR NUBE</strong> en modo manual. Una descarga que vaya a borrar datos locales exige <strong>REEMPLAZAR LOCAL</strong>.','<strong>V9.2 Conflict Guard:</strong> además de proteger borrados, cada dispositivo conserva una revisión base. Si Supabase cambia desde esa revisión, el auto-sync se bloquea. Para forzar una resolución local exige <strong>RESOLVER CON LOCAL</strong>; para descartar cambios locales exige <strong>REEMPLAZAR LOCAL</strong>.');
  html=html.replace('<section class="card panel config-wide"><div class="panel-title"><div><h3>Qué se guarda</h3>',cloudSnapshotPanelV92()+'<section class="card panel config-wide"><div class="panel-title"><div><h3>Qué se guarda</h3>');
  return html;
};

Object.assign(window,{cloudPushState,cloudPullState,setCloudAutoSync,refreshCloudRemoteStatus,createManualCloudSnapshot,restoreCloudSnapshot,deleteCloudSnapshot});
if(cloudAuthUser)setTimeout(refreshCloudRemoteStatus,400);
render();
/* ===== END V9.2 PATCH ===== */
