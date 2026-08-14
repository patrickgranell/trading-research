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

/* ===== V10 PATCH · Advanced Analytics Lab ===== */
const V10_APP_LABEL='V10 · Advanced Analytics Lab';
let labState={
  unit:'r',basis:'net',dateFrom:'',dateTo:'',timeFrom:'',timeTo:'',direction:'',setup:'',vd:'',context:'',risk:'',result:'',behavior:'',emotion:'',focus:'',stress:'',
  rMin:'',rMax:'',heatMetric:'expectancy',scatterX:'mae',histBin:0.25,edgeX:'setup',edgeY:'context',rollingWindow:20,rollingMetric:'expectancy'
};

function labVal(id){return document.getElementById(id)?.value??'';}
function labReadFilters(){
  Object.assign(labState,{dateFrom:labVal('labDateFrom'),dateTo:labVal('labDateTo'),timeFrom:labVal('labTimeFrom'),timeTo:labVal('labTimeTo'),direction:labVal('labDirection'),setup:labVal('labSetup'),vd:labVal('labVD'),context:labVal('labContext'),risk:labVal('labRisk'),result:labVal('labResult'),behavior:labVal('labBehavior'),emotion:labVal('labEmotion'),focus:labVal('labFocus'),stress:labVal('labStress'),rMin:labVal('labRMin'),rMax:labVal('labRMax')});render();
}
function labReset(){const keep={unit:labState.unit,basis:labState.basis,heatMetric:labState.heatMetric,scatterX:labState.scatterX,histBin:labState.histBin,edgeX:labState.edgeX,edgeY:labState.edgeY,rollingWindow:labState.rollingWindow,rollingMetric:labState.rollingMetric};labState={...keep,dateFrom:'',dateTo:'',timeFrom:'',timeTo:'',direction:'',setup:'',vd:'',context:'',risk:'',result:'',behavior:'',emotion:'',focus:'',stress:'',rMin:'',rMax:''};render();}
function setLabUnit(v){labState.unit=v;render();}
function setLabBasis(v){labState.basis=v;render();}
function setLabHeatMetric(v){labState.heatMetric=v;render();}
function setLabScatterX(v){labState.scatterX=v;render();}
function setLabHistBin(v){labState.histBin=Number(v)||0.25;render();}
function setLabEdgeAxis(axis,v){if(axis==='x')labState.edgeX=v;else labState.edgeY=v;render();}
function setLabRollingWindow(v){labState.rollingWindow=Number(v)||20;render();}
function setLabRollingMetric(v){labState.rollingMetric=v;render();}
function labEmotionsOf(o){const e=o.emotional||{};return [e.before,e.during,e.after].filter(Boolean);}
function labFilteredOps(){
  const f=labState;
  return currentOps().filter(o=>{
    const d=new Date(o.entryDate);if(isNaN(d))return false;const date=inputDateValue(d),hh=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    if(f.dateFrom&&date<f.dateFrom)return false;if(f.dateTo&&date>f.dateTo)return false;
    if(f.timeFrom&&f.timeTo){if(f.timeFrom<=f.timeTo){if(hh<f.timeFrom||hh>f.timeTo)return false;}else if(hh<f.timeFrom&&hh>f.timeTo)return false;}
    else if(f.timeFrom&&hh<f.timeFrom)return false;else if(f.timeTo&&hh>f.timeTo)return false;
    if(f.direction&&o.direction!==f.direction)return false;if(f.setup&&o.setup!==f.setup)return false;if(f.vd&&o.vd!==f.vd)return false;
    if(f.context&&String(o.h4Context||'')!==f.context)return false;if(f.risk&&o.riskStrategyId!==f.risk)return false;if(f.result&&o.result!==f.result)return false;
    if(f.behavior&&!(o.emotional?.behaviors||[]).includes(f.behavior))return false;if(f.emotion&&!labEmotionsOf(o).includes(f.emotion))return false;
    if(f.focus&&String(o.emotional?.focus||'')!==String(f.focus))return false;if(f.stress&&String(o.emotional?.stress||'')!==String(f.stress))return false;
    const rv=opMetricValue(o,'r',f.basis);if(f.rMin!==''&&rv<Number(f.rMin))return false;if(f.rMax!==''&&rv>Number(f.rMax))return false;
    return true;
  }).sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));
}
function labMetric(ops,metric=labState.heatMetric){
  const s=calcMetricStats(ops,labState.unit,labState.basis);
  if(metric==='winrate')return s.winRate;if(metric==='pf')return Number.isFinite(s.pf)?s.pf:0;if(metric==='sum')return s.sum;return s.expectancy;
}
function labMetricText(v,metric=labState.heatMetric){if(metric==='winrate')return `${Number(v||0).toFixed(1)}%`;if(metric==='pf')return Number(v||0).toFixed(2);return metricStatText(v,labState.unit);}
function labSelect(id,label,values,current,onchange='labReadFilters()'){return `<label class="filter-field"><span>${label}</span><select id="${id}" class="select" onchange="${onchange}"><option value="">Todos</option>${values.map(x=>{const v=typeof x==='object'?x.value:x,l=typeof x==='object'?x.label:x;return `<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(l)}</option>`}).join('')}</select></label>`;}
function labActiveChips(){const chips=[];const add=(label,val,clear)=>{if(val!==''&&val!==null&&val!==undefined)chips.push(`<button class="lab-active-chip" onclick="${clear}"><span>${esc(label)}</span><strong>${esc(val)}</strong> ×</button>`);};add('Setup',labState.setup,"labState.setup='';render()");add('VD',labState.vd,"labState.vd='';render()");add('Contexto',labState.context,"labState.context='';render()");add('Dir.',labState.direction,"labState.direction='';render()");add('Comport.',labState.behavior,"labState.behavior='';render()");add('Emoción',labState.emotion,"labState.emotion='';render()");add('Foco',labState.focus,"labState.focus='';render()");add('Estrés',labState.stress,"labState.stress='';render()");if(labState.rMin!==''||labState.rMax!=='')add('R',`${labState.rMin||'−∞'} → ${labState.rMax||'∞'}`,"labState.rMin='';labState.rMax='';render()");return chips.length?`<div class="lab-active-filters">${chips.join('')}</div>`:'';}
function labFilterPanel(){
  const p=getCurrentPlan(),ops=currentOps(),contexts=uniqueSorted(ops.map(o=>o.h4Context)),beh=uniqueSorted(ops.flatMap(o=>o.emotional?.behaviors||[])),emo=uniqueSorted(ops.flatMap(labEmotionsOf));
  const unitSwitch=`<div class="metric-switch"><span>Unidad analítica</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${labState.unit===v?'active':''}" onclick="setLabUnit('${v}')">${l}</button>`).join('')}<i></i><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([v,l])=>`<button class="seg-btn ${labState.basis===v?'active':''}" onclick="setLabBasis('${v}')">${l}</button>`).join('')}</div>`;
  return `<section class="card filter-hub lab-filter-hub"><div class="filter-hub-top"><div><h3>Dataset del estudio</h3><p>Todos los módulos usan exactamente el mismo subconjunto. Pulsa celdas, puntos o barras para profundizar.</p></div>${unitSwitch}</div><div class="filter-grid"><label class="filter-field"><span>Desde</span><input id="labDateFrom" type="date" class="input" value="${esc(labState.dateFrom)}" onchange="labReadFilters()"></label><label class="filter-field"><span>Hasta</span><input id="labDateTo" type="date" class="input" value="${esc(labState.dateTo)}" onchange="labReadFilters()"></label><label class="filter-field"><span>Hora desde</span><input id="labTimeFrom" type="time" class="input" value="${esc(labState.timeFrom)}" onchange="labReadFilters()"></label><label class="filter-field"><span>Hora hasta</span><input id="labTimeTo" type="time" class="input" value="${esc(labState.timeTo)}" onchange="labReadFilters()"></label>${labSelect('labDirection','Dirección',['LONG','SHORT'],labState.direction)}${labSelect('labSetup','Setup',p?.setups||[],labState.setup)}${labSelect('labVD','VD',p?.vd||[],labState.vd)}${labSelect('labContext','Contexto',contexts,labState.context)}${labSelect('labRisk','Estrategia',(p?.riskStrategies||[]).map(r=>({value:r.id,label:r.name})),labState.risk)}${labSelect('labResult','Resultado',[{value:'win',label:'Ganadoras'},{value:'loss',label:'Perdedoras'},{value:'pending',label:'Pendientes'}],labState.result)}${labSelect('labBehavior','Comportamiento',beh,labState.behavior)}${labSelect('labEmotion','Emoción',emo,labState.emotion)}${labSelect('labFocus','Foco',[1,2,3,4,5],labState.focus)}${labSelect('labStress','Estrés',[1,2,3,4,5],labState.stress)}<label class="filter-field"><span>R mínima</span><input id="labRMin" type="number" step="0.25" class="input" value="${esc(labState.rMin)}" onchange="labReadFilters()"></label><label class="filter-field"><span>R máxima</span><input id="labRMax" type="number" step="0.25" class="input" value="${esc(labState.rMax)}" onchange="labReadFilters()"></label></div><div class="lab-filter-foot"><button class="btn small" onclick="labReset()">Limpiar estudio</button><span>Los filtros del Laboratorio no modifican Operaciones ni el dataset.</span></div>${labActiveChips()}</section>`;
}
function labKpis(ops){const s=calcMetricStats(ops,labState.unit,labState.basis),r=calcMetricStats(ops,'r',labState.basis),em=ops.filter(hasEmotionalEntry).length;return `<div class="analytics-kpis lab-kpis">${kpi('Muestra',s.n,`${em} con diario emocional`)}${kpi('Expectancy',metricStatText(s.expectancy,labState.unit),`${labState.basis==='net'?'neta':'bruta'}`)}${kpi('Win rate',pct(s.winRate),'subconjunto')}${kpi('Profit Factor',Number.isFinite(s.pf)?s.pf.toFixed(2):'∞','subconjunto')}${kpi('Resultado',metricStatText(s.sum,labState.unit),'acumulado')}${kpi('Max DD',metricStatText(s.maxDD,labState.unit),'subconjunto')}${kpi('R media',`${r.expectancy>=0?'+':''}${r.expectancy.toFixed(2)}R`,'normalizado')}${kpi('Comisiones',`${s.commissions.toFixed(2)} US$`,'coste total')}</div>`;}

function labHeatColor(v,maxAbs){if(!Number.isFinite(v)||v===0)return 'rgba(255,255,255,.025)';const a=Math.min(.72,.12+Math.abs(v)/(maxAbs||1)*.6);return v>0?`rgba(62,211,151,${a})`:`rgba(244,84,109,${a})`;}
function labApplyFocusStress(focus,stress){labState.focus=String(focus);labState.stress=String(stress);render();}
function labFocusStressHeatmap(ops){
  const cells={};let maxAbs=0;for(let stress=1;stress<=5;stress++)for(let focus=1;focus<=5;focus++){const subset=ops.filter(o=>Number(o.emotional?.focus)===focus&&Number(o.emotional?.stress)===stress),v=labMetric(subset);cells[`${focus}-${stress}`]={subset,v};maxAbs=Math.max(maxAbs,Math.abs(v));}
  return `<section class="card panel lab-module lab-span-2"><div class="panel-title"><div><h3>Heatmap · Foco × Estrés</h3><small>Color = ${labState.heatMetric==='expectancy'?'Expectancy promedio':labState.heatMetric==='winrate'?'Win rate':labState.heatMetric==='pf'?'Profit Factor':'Resultado total'} · cada celda muestra n</small></div><select class="select compact-select" onchange="setLabHeatMetric(this.value)">${[['expectancy','Expectancy'],['winrate','Win rate'],['pf','Profit Factor'],['sum','Resultado total']].map(([v,l])=>`<option value="${v}" ${labState.heatMetric===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="behavior-heat-layout"><div class="heat-y-label">Estrés ↑</div><table class="behavior-heat"><thead><tr><th></th>${[1,2,3,4,5].map(f=>`<th>Foco ${f}</th>`).join('')}</tr></thead><tbody>${[5,4,3,2,1].map(st=>`<tr><th>${st}</th>${[1,2,3,4,5].map(f=>{const c=cells[`${f}-${st}`],n=c.subset.length;return `<td style="background:${labHeatColor(c.v,maxAbs)}" onclick="labApplyFocusStress(${f},${st})" title="Foco ${f} · Estrés ${st} · ${n} operaciones"><strong>${n?labMetricText(c.v):'—'}</strong><small>n=${n}</small></td>`}).join('')}</tr>`).join('')}</tbody></table><div class="heat-x-label">Nivel de foco →</div></div><div class="lab-note">Las celdas con pocas operaciones son exploratorias. El tamaño de muestra <strong>n</strong> evita interpretar un valor extremo basado en 1–2 trades.</div></section>`;
}

function scatterSvg(points,xMode='mae'){
  if(!points.length)return '<div class="empty">No hay operaciones con datos suficientes de MAE/MFE.</div>';
  const W=860,H=300,padL=54,padR=20,padT=18,padB=42;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),xmin=Math.min(...xs,0),xmax=Math.max(...xs,1),ymin=Math.min(...ys,0),ymax=Math.max(...ys,0),xr=(xmax-xmin)||1,yr=(ymax-ymin)||1;
  const X=x=>padL+(x-xmin)/xr*(W-padL-padR),Y=y=>padT+(H-padT-padB)-(y-ymin)/yr*(H-padT-padB),zeroY=Y(0),oneX=X(1);
  const circles=points.map(p=>`<circle class="scatter-point ${p.win?'win':'loss'}" cx="${X(p.x).toFixed(2)}" cy="${Y(p.y).toFixed(2)}" r="5.5"><title>${esc(p.label)} · ${xMode.toUpperCase()} ${p.x.toFixed(2)}R · ${p.y>=0?'+':''}${p.y.toFixed(2)} US$</title></circle>`).join('');
  const xTicks=Array.from({length:5},(_,i)=>xmin+(xr*i/4)),yTicks=Array.from({length:5},(_,i)=>ymin+(yr*i/4));
  return `<svg class="lab-scatter-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line class="grid-zero" x1="${padL}" y1="${zeroY}" x2="${W-padR}" y2="${zeroY}"/>${xMode==='mae'&&1>=xmin&&1<=xmax?`<line class="stop-line" x1="${oneX}" y1="${padT}" x2="${oneX}" y2="${H-padB}"/><text class="chart-label" x="${oneX+5}" y="${padT+12}">1R</text>`:''}${xTicks.map(v=>`<line class="grid-line" x1="${X(v)}" y1="${padT}" x2="${X(v)}" y2="${H-padB}"/><text class="axis-text" x="${X(v)}" y="${H-12}" text-anchor="middle">${v.toFixed(1)}R</text>`).join('')}${yTicks.map(v=>`<line class="grid-line" x1="${padL}" y1="${Y(v)}" x2="${W-padR}" y2="${Y(v)}"/><text class="axis-text" x="${padL-8}" y="${Y(v)+4}" text-anchor="end">${v.toFixed(0)}</text>`).join('')}${circles}<text class="chart-label" x="${W/2}" y="${H-2}" text-anchor="middle">${xMode.toUpperCase()} (R)</text><text class="chart-label" transform="translate(13 ${H/2}) rotate(-90)" text-anchor="middle">Resultado ${labState.basis==='net'?'neto':'bruto'} (US$)</text></svg>`;
}
function labMaeMfeScatter(ops){
  const xMode=labState.scatterX,points=ops.map(o=>({x:Number(o[xMode]),y:opMetricValue(o,'usd',labState.basis),win:o.result==='win',label:`${o.contract||''} ${fmtDate(o.entryDate)}`})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  const useful=points.filter(p=>p.x!==0);const used=useful.length?useful:points;
  return `<section class="card panel lab-module lab-span-2"><div class="panel-title"><div><h3>Scatter · ${xMode.toUpperCase()} vs Resultado</h3><small>Verde = ganadora · rojo = perdedora · Y siempre en US$ para lectura económica</small></div><select class="select compact-select" onchange="setLabScatterX(this.value)"><option value="mae" ${xMode==='mae'?'selected':''}>MAE</option><option value="mfe" ${xMode==='mfe'?'selected':''}>MFE</option></select></div><div class="lab-scatter-wrap">${scatterSvg(used,xMode)}</div><div class="lab-note">Si muchos trades muestran MAE/MFE = 0, probablemente ese dato todavía no fue registrado. La línea vertical en 1R aparece en MAE para auditar excursiones adversas mayores al riesgo teórico.</div></section>`;
}

function labApplyBehavior(v){labState.behavior=v;render();}
function labBehaviorPenalties(ops){
  const map=new Map();ops.forEach(o=>{const loss=Math.min(0,opMetricValue(o,'usd','net'));if(loss>=0)return;(o.emotional?.behaviors||[]).forEach(b=>{if(!map.has(b))map.set(b,{name:b,loss:0,n:0});const x=map.get(b);x.loss+=Math.abs(loss);x.n++;});});
  const rows=[...map.values()].sort((a,b)=>b.loss-a.loss),max=rows[0]?.loss||1;
  return `<section class="card panel lab-module"><div class="panel-title"><div><h3>Penalizaciones conductuales</h3><small>Pérdida neta asociada en US$ · mayor → menor</small></div><span>${rows.length} conductas</span></div>${rows.length?`<div class="penalty-bars">${rows.map(r=>`<button class="penalty-row" onclick="labApplyBehavior(decodeURIComponent('${encodeURIComponent(r.name)}'))"><span class="penalty-name">${esc(r.name)}</span><span class="penalty-track"><i style="width:${Math.max(4,r.loss/max*100)}%"></i></span><strong>−${r.loss.toFixed(2)} US$</strong><small>${r.n} casos · −${(r.loss/r.n).toFixed(2)}/caso</small></button>`).join('')}</div>`:'<div class="empty">No hay operaciones perdedoras con comportamientos etiquetados.</div>'}<div class="lab-note warn">Esta cifra es <strong>pérdida asociada</strong>, no causalidad demostrada. Si un trade tiene varios comportamientos, su pérdida aparece en cada etiqueta. Más adelante podemos añadir “coste atribuible” cuando registremos la desviación económica respecto al plan.</div></section>`;
}

function histogramBinsR(ops,step){const vals=ops.map(o=>opMetricValue(o,'r',labState.basis)).filter(Number.isFinite);if(!vals.length)return [];const min=Math.floor(Math.min(...vals)/step)*step,max=Math.ceil(Math.max(...vals)/step)*step,b=[];for(let a=min;a<max+step/2;a+=step)b.push({a:Number(a.toFixed(6)),z:Number((a+step).toFixed(6)),n:0});vals.forEach(v=>{let i=Math.floor((v-min)/step);if(i<0)i=0;if(i>=b.length)i=b.length-1;b[i].n++;});return b;}
function labApplyRBin(a,z){labState.rMin=String(a);labState.rMax=String(z);render();}
function labRiskHistogram(ops){
  const step=Number(labState.histBin)||.25,bins=histogramBinsR(ops,step),top=Math.max(...bins.map(b=>b.n),1),losses=ops.map(o=>opMetricValue(o,'r',labState.basis)).filter(v=>v<0),normal=losses.filter(v=>v>=-1.1&&v<=-.9).length,exceeded=losses.filter(v=>v<-1.1).length,early=losses.filter(v=>v>-.9&&v<0).length;
  const pctN=n=>losses.length?`${(n/losses.length*100).toFixed(1)}%`:'0.0%';
  return `<section class="card panel lab-module"><div class="panel-title"><div><h3>Distribución de riesgo</h3><small>Resultados agrupados en fracciones de R</small></div><select class="select compact-select" onchange="setLabHistBin(this.value)">${[.25,.5,1].map(v=>`<option value="${v}" ${step===v?'selected':''}>${v}R / bin</option>`).join('')}</select></div><div class="risk-diagnostic"><div><span>Stop ~1R</span><strong>${pctN(normal)}</strong><small>${normal}/${losses.length}</small></div><div><span>Stop excedido</span><strong class="negative">${pctN(exceeded)}</strong><small>&lt; −1.1R</small></div><div><span>Pérdida cortada antes</span><strong>${pctN(early)}</strong><small>−0.9R → 0R</small></div></div>${bins.length?`<div class="r-hist-wrap"><div class="r-marker-labels"><span>−1R</span><span>0R</span><span>+1R</span><span>+2R</span></div><div class="r-histogram">${bins.map(b=>`<button class="r-hist-col ${b.z<=0?'neg':b.a>=0?'pos':'mix'}" onclick="labApplyRBin(${b.a},${b.z})" title="${b.a.toFixed(2)}R → ${b.z.toFixed(2)}R · ${b.n} operaciones"><span class="r-hist-bar" style="height:${Math.max(3,b.n/top*100)}%"><b>${b.n||''}</b></span><small>${((b.a+b.z)/2).toFixed(2)}</small></button>`).join('')}</div></div>`:'<div class="empty">Sin datos de R.</div>'}<div class="lab-note">Pulsa una barra para filtrar ese rango de R en todo el Laboratorio.</div></section>`;
}

function edgeDimensionValues(o,dim){if(dim==='setup')return o.setup||'Sin setup';if(dim==='vd')return o.vd||'Sin VD';if(dim==='nr')return o.nr||'Sin NR';if(dim==='context')return o.h4Context||'Sin contexto';if(dim==='hypothesis')return o.hypothesis||'Sin H';if(dim==='strategy')return o.riskStrategyName||'No clasificada';if(dim==='direction')return o.direction||'—';if(dim==='hour'){const d=new Date(o.entryDate);return isNaN(d)?'—':`${String(d.getHours()).padStart(2,'0')}:00`;}return '—';}
function edgeDimLabel(dim){return ({setup:'Setup',vd:'VD',nr:'NR',context:'Contexto',hypothesis:'Hipótesis',strategy:'Estrategia',direction:'Dirección',hour:'Hora'})[dim]||dim;}
function labApplyEdge(xDim,xVal,yDim,yVal){if(xDim==='setup')labState.setup=xVal;if(xDim==='vd')labState.vd=xVal;if(xDim==='context')labState.context=xVal;if(xDim==='direction')labState.direction=xVal;if(xDim==='strategy'){const p=getCurrentPlan(),r=(p?.riskStrategies||[]).find(r=>r.name===xVal);if(r)labState.risk=r.id;}if(yDim==='setup')labState.setup=yVal;if(yDim==='vd')labState.vd=yVal;if(yDim==='context')labState.context=yVal;if(yDim==='direction')labState.direction=yVal;if(yDim==='strategy'){const p=getCurrentPlan(),r=(p?.riskStrategies||[]).find(r=>r.name===yVal);if(r)labState.risk=r.id;}render();}
function labEdgeMatrix(ops){
  const xD=labState.edgeX,yD=labState.edgeY,dimOpts=[['setup','Setup'],['context','Contexto'],['vd','VD'],['nr','NR'],['hypothesis','Hipótesis'],['strategy','Estrategia'],['direction','Dirección'],['hour','Hora']];
  let xs=uniqueSorted(ops.map(o=>edgeDimensionValues(o,xD))),ys=uniqueSorted(ops.map(o=>edgeDimensionValues(o,yD)));if(xs.length>10)xs=xs.slice(0,10);if(ys.length>10)ys=ys.slice(0,10);let maxAbs=0;const cells={};ys.forEach(y=>xs.forEach(x=>{const sub=ops.filter(o=>edgeDimensionValues(o,xD)===x&&edgeDimensionValues(o,yD)===y),s=calcMetricStats(sub,labState.unit,labState.basis);cells[`${x}|||${y}`]=s;maxAbs=Math.max(maxAbs,Math.abs(s.expectancy));}));
  return `<section class="card panel lab-module lab-span-2"><div class="panel-title"><div><h3>Matriz de Edge</h3><small>Expectancy por combinación · pulsa una celda para filtrar</small></div><div class="edge-controls"><select class="select compact-select" onchange="setLabEdgeAxis('x',this.value)">${dimOpts.map(([v,l])=>`<option value="${v}" ${xD===v?'selected':''}>X: ${l}</option>`).join('')}</select><select class="select compact-select" onchange="setLabEdgeAxis('y',this.value)">${dimOpts.map(([v,l])=>`<option value="${v}" ${yD===v?'selected':''}>Y: ${l}</option>`).join('')}</select></div></div>${xs.length&&ys.length?`<div class="edge-matrix-wrap"><table class="edge-matrix"><thead><tr><th>${esc(edgeDimLabel(yD))} \ ${esc(edgeDimLabel(xD))}</th>${xs.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${ys.map(y=>`<tr><th>${esc(y)}</th>${xs.map(x=>{const s=cells[`${x}|||${y}`];return `<td style="background:${labHeatColor(s.expectancy,maxAbs)}" onclick="labApplyEdge('${xD}',decodeURIComponent('${encodeURIComponent(x)}'),'${yD}',decodeURIComponent('${encodeURIComponent(y)}'))"><strong>${s.n?metricStatText(s.expectancy,labState.unit):'—'}</strong><small>n=${s.n}</small></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">No hay categorías suficientes para construir la matriz.</div>'}</section>`;
}

function rollingSeries(ops,window,metric){const chrono=[...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),out=[];for(let i=0;i<chrono.length;i++){const start=Math.max(0,i-window+1),slice=chrono.slice(start,i+1);if(slice.length<Math.min(5,window))continue;const s=calcMetricStats(slice,labState.unit,labState.basis);out.push(metric==='pf'?(Number.isFinite(s.pf)?s.pf:0):metric==='winrate'?s.winRate:s.expectancy);}return out;}
function labStability(ops){const w=labState.rollingWindow,m=labState.rollingMetric,series=rollingSeries(ops,w,m),label=m==='expectancy'?`Expectancy (${metricUnitLabel(labState.unit)})`:m==='pf'?'Profit Factor':'Win rate %';return `<section class="card panel lab-module"><div class="panel-title"><div><h3>Estabilidad del Edge</h3><small>Ventana móvil para detectar mejora, estabilidad o deterioro</small></div><div class="edge-controls"><select class="select compact-select" onchange="setLabRollingWindow(this.value)">${[20,40,100].map(v=>`<option value="${v}" ${w===v?'selected':''}>${v} trades</option>`).join('')}</select><select class="select compact-select" onchange="setLabRollingMetric(this.value)"><option value="expectancy" ${m==='expectancy'?'selected':''}>Expectancy</option><option value="pf" ${m==='pf'?'selected':''}>PF</option><option value="winrate" ${m==='winrate'?'selected':''}>Win rate</option></select></div></div><div class="chart-wrap analytics-chart">${series.length?lineChartSvg(series,760,230):'<div class="empty">Muestra insuficiente para esta ventana.</div>'}</div><div class="lab-note">${esc(label)} · ventana móvil de ${w}. Un histórico positivo no garantiza que el edge sea estable en el tiempo.</div></section>`;}

function dualEquitySvg(rawVals,managedVals,W=840,H=250){if(!rawVals.length)return '<div class="empty">Sin datos.</div>';const all=[...rawVals,...managedVals,0],min=Math.min(...all),max=Math.max(...all),range=(max-min)||1,pad=8,X=i=>pad+(i/Math.max(rawVals.length-1,1))*(W-pad*2),Y=v=>pad+(H-pad*2)-((v-min)/range)*(H-pad*2),poly=arr=>arr.map((v,i)=>`${X(i)},${Y(v)}`).join(' '),zero=Y(0);return `<svg class="dual-equity-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line class="axis" x1="${pad}" y1="${zero}" x2="${W-pad}" y2="${zero}"/><polyline class="raw-line" points="${poly(rawVals)}"/><polyline class="managed-line" points="${poly(managedVals)}"/></svg>`;}
function labRiskSimulator(ops){
  const chrono=[...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),managed=applyRiskManagementRules(chrono),includeIds=new Set(managed.included.map(o=>o.id));let rEq=0,mEq=0;const raw=[],mg=[];chrono.forEach(o=>{const v=opMetricValue(o,labState.unit,labState.basis);rEq+=v;if(includeIds.has(o.id))mEq+=v;raw.push(rEq);mg.push(mEq);});const rs=calcMetricStats(chrono,labState.unit,labState.basis),ms=calcMetricStats(managed.included,labState.unit,labState.basis);
  const cell=(label,a,b,fmt=x=>metricStatText(x,labState.unit))=>`<tr><th>${label}</th><td>${fmt(a)}</td><td>${fmt(b)}</td><td class="${b-a>=0?'positive':'negative'}">${fmt(b-a)}</td></tr>`;
  return `<section class="card panel lab-module lab-span-2"><div class="panel-title"><div><h3>Simulador de reglas de riesgo</h3><small>Señales brutas vs operaciones que habrías podido ejecutar respetando el Trading Plan</small></div><div class="risk-legend"><span class="raw-dot"></span> Bruto <span class="managed-dot"></span> Gestión TP</div></div><div class="risk-sim-grid"><div class="dual-chart">${dualEquitySvg(raw,mg)}</div><div class="risk-sim-table"><table><thead><tr><th>Métrica</th><th>Bruto</th><th>Gestión TP</th><th>Δ</th></tr></thead><tbody>${cell('Operaciones',rs.n,ms.n,x=>String(Math.round(x)))}${cell('Resultado',rs.sum,ms.sum)}${cell('Expectancy',rs.expectancy,ms.expectancy)}${cell('Profit Factor',Number.isFinite(rs.pf)?rs.pf:0,Number.isFinite(ms.pf)?ms.pf:0,x=>Number(x).toFixed(2))}${cell('Max DD',rs.maxDD,ms.maxDD)}</tbody></table><div class="risk-excluded"><strong>${managed.excluded.length}</strong><span>operaciones excluidas cronológicamente por las reglas del plan</span></div></div></div></section>`;
}

function labOperationsTable(ops){const rows=[...ops].sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate)).slice(0,100);return `<section class="card panel lab-module lab-span-2"><div class="panel-title"><div><h3>Trades del estudio</h3><small>Hasta 100 operaciones del subconjunto actual</small></div><span>${ops.length} totales</span></div>${opsTable(rows,labState.unit,labState.basis)}</section>`;}
function analyticsLab(){const p=getCurrentPlan(),ops=labFilteredOps();return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: comportamiento, excursiones, riesgo, estabilidad y reglas de gestión.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;}

const shellV10Base=shell;
shell=function(){
  const p=getCurrentPlan();
  return `<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-dot"></div><div><h1>Trading Research</h1><small>Backtest & Trade Lab</small></div></div><div class="plan-switch"><label>Trading plan activo</label><select class="select" onchange="switchPlan(this.value)">${state.tradingPlans.filter(x=>x.status!=='archived'||x.id===p?.id).map(x=>`<option value="${esc(x.id)}" ${x.id===p?.id?'selected':''}>${esc(planLabel(x))}</option>`).join('')}</select></div><nav class="nav">${navBtn('dashboard','◈','Dashboard')}${navBtn('operations','▤','Operaciones')}${navBtn('lab','⌁','Laboratorio')}${navBtn('gallery','▧','Biblioteca visual')}${navBtn('journal','♡','Diario emocional')}${navBtn('blocks','▦','Bloques')}${navBtn('plans','◫','Trading Plans')}${navBtn('config','⚙','Configuración')}</nav><div class="side-bottom"><div class="mini-card"><div class="mini-label">Modo actual</div><div class="mini-value">${V10_APP_LABEL}</div><div class="help">Motor cloud V9.2 Conflict Guard intacto. El Laboratorio es una capa analítica no destructiva.</div></div></div></aside><main class="main"><div id="view"></div></main></div>`;
};
render=function(){document.getElementById('app').innerHTML=shell();const view=document.getElementById('view');view.innerHTML=currentView==='dashboard'?dashboard():currentView==='operations'?operations():currentView==='lab'?analyticsLab():currentView==='gallery'?gallery():currentView==='journal'?journal():currentView==='blocks'?blocks():currentView==='plans'?plansView():config();setTimeout(hydrateImageElements,0);};
Object.assign(window,{labReadFilters,labReset,setLabUnit,setLabBasis,setLabHeatMetric,setLabScatterX,setLabHistBin,setLabEdgeAxis,setLabRollingWindow,setLabRollingMetric,labApplyFocusStress,labApplyBehavior,labApplyRBin,labApplyEdge});
render();
/* ===== END V10 PATCH ===== */

/* ===== V11 PATCH · Master Library ===== */
const V11_APP_LABEL='V11 · Biblioteca Maestra';
const MASTER_LIBRARY_SCHEMA=1;

function emptyMasterLibrary(){return {schema:MASTER_LIBRARY_SCHEMA,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),items:[]};}
function normalizeMasterLibrary(lib){
  const out=lib&&typeof lib==='object'?clone(lib):emptyMasterLibrary();
  out.schema=MASTER_LIBRARY_SCHEMA;
  out.createdAt=out.createdAt||new Date().toISOString();
  out.updatedAt=out.updatedAt||out.createdAt;
  out.items=Array.isArray(out.items)?out.items.map(x=>({
    id:x.id||uid('LIB'),familyId:x.familyId||uid('LIBF'),type:x.type||'setup',name:String(x.name||'Sin nombre'),version:Math.max(1,Number(x.version)||1),
    status:x.status==='archived'?'archived':'active',createdAt:x.createdAt||new Date().toISOString(),updatedAt:x.updatedAt||x.createdAt||new Date().toISOString(),
    sourcePlanId:x.sourcePlanId||'',sourcePlanLabel:x.sourcePlanLabel||'',payload:clone(x.payload??null)
  })):[];
  return out;
}
function ensureMasterLibrary(){state.masterLibrary=normalizeMasterLibrary(state.masterLibrary);return state.masterLibrary;}

const normalizeStateV11Base=normalizeState;
normalizeState=function(raw){
  let src=raw;
  let lib=raw?.masterLibrary||null;
  if(!lib&&Array.isArray(raw?.tradingPlans)){
    const carrier=raw.tradingPlans.find(p=>p&&p.__masterLibrary);
    if(carrier?.__masterLibrary)lib=carrier.__masterLibrary;
  }
  if(raw&&typeof raw==='object'){
    src=clone(raw);
    if(Array.isArray(src.tradingPlans))src.tradingPlans=src.tradingPlans.map(p=>{const q={...p};delete q.__masterLibrary;return q;});
  }
  const out=normalizeStateV11Base(src);
  out.masterLibrary=normalizeMasterLibrary(lib);
  return out;
};
state=normalizeState(state);ensureMasterLibrary();
try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}

function libraryTypeLabel(type){return ({setup:'Setup',vd:'VD',context:'Contexto',nr:'NR',hypothesis:'Hipótesis',riskStrategy:'Estrategia',riskRules:'Gestión del riesgo',discretionaryTarget:'Salida discrecional'})[type]||type;}
function libraryTypeOrder(type){return ['setup','vd','context','nr','hypothesis','riskStrategy','riskRules','discretionaryTarget'].indexOf(type);}
function libraryPayloadComparable(type,payload){
  const p=clone(payload??null);
  if(!p||typeof p!=='object')return p;
  delete p.updatedAt;delete p.createdAt;
  if(['setup','vd','context','hypothesis','riskStrategy'].includes(type))delete p.id;
  if(type==='riskStrategy'&&Array.isArray(p.lots))p.lots=p.lots.map(l=>{const q={...l};delete q.id;return q;});
  return p;
}
function libraryPayloadEqual(type,a,b){return JSON.stringify(libraryPayloadComparable(type,a))===JSON.stringify(libraryPayloadComparable(type,b));}
function libraryFamilyItems(familyId){return ensureMasterLibrary().items.filter(x=>x.familyId===familyId).sort((a,b)=>b.version-a.version);}
function latestLibraryItems(includeArchived=false){
  const groups=new Map();
  ensureMasterLibrary().items.forEach(i=>{if(!includeArchived&&i.status==='archived')return;const prev=groups.get(i.familyId);if(!prev||i.version>prev.version)groups.set(i.familyId,i);});
  return [...groups.values()].sort((a,b)=>libraryTypeOrder(a.type)-libraryTypeOrder(b.type)||a.name.localeCompare(b.name,'es'));
}
function latestLibraryFamilyItem(type,name){return latestLibraryItems(true).find(x=>x.type===type&&x.name===name)||null;}
function upsertLibrarySnapshot(type,name,payload,sourcePlan){
  const lib=ensureMasterLibrary();
  const existing=lib.items.filter(x=>x.type===type&&x.name===name).sort((a,b)=>b.version-a.version)[0];
  if(existing&&libraryPayloadEqual(type,existing.payload,payload)){
    if(existing.status==='archived')existing.status='active';
    return {status:'same',item:existing};
  }
  const now=new Date().toISOString();
  const item={id:uid('LIB'),familyId:existing?.familyId||uid('LIBF'),type,name,version:existing?existing.version+1:1,status:'active',createdAt:now,updatedAt:now,sourcePlanId:sourcePlan?.id||'',sourcePlanLabel:sourcePlan?planLabel(sourcePlan):'',payload:clone(payload)};
  lib.items.push(item);lib.updatedAt=now;return {status:existing?'version':'new',item};
}
function librarySnapshotsFromPlan(p){
  ensurePlanV8Structure(p);
  const rows=[];
  (p.setupDefinitions||[]).forEach(d=>rows.push(['setup',d.key,d]));
  (p.vdDefinitions||[]).forEach(d=>rows.push(['vd',d.key,d]));
  (p.contextDefinitions||[]).forEach(d=>rows.push(['context',d.key,d]));
  (p.nr||[]).forEach(name=>rows.push(['nr',name,{name}]));
  (p.hypotheses||[]).forEach(h=>rows.push(['hypothesis',h.name,h]));
  (p.riskStrategies||[]).forEach(r=>rows.push(['riskStrategy',r.name,r]));
  rows.push(['riskRules','Reglas de gestión del riesgo',p.riskManagement||clone(basePlanConfig.riskManagement)]);
  (p.discretionaryTargets||[]).forEach(name=>rows.push(['discretionaryTarget',name,{name}]));
  return rows;
}
function saveCurrentPlanToLibrary(){
  const p=getCurrentPlan();if(!p)return;
  if(!confirm(`Guardar el material de ${planLabel(p)} en la Biblioteca Maestra?\n\nSi un elemento no ha cambiado, no se duplica. Si cambió, se crea una nueva versión y los planes antiguos no se modifican.`))return;
  let added=0,versions=0,same=0;
  librarySnapshotsFromPlan(p).forEach(([type,name,payload])=>{const r=upsertLibrarySnapshot(type,name,payload,p);if(r.status==='new')added++;else if(r.status==='version')versions++;else same++;});
  persist();render();alert(`Biblioteca actualizada.\nNuevos: ${added}\nNuevas versiones: ${versions}\nSin cambios: ${same}`);
}
function planHasLibraryEquivalent(p,item){
  ensurePlanV8Structure(p);
  if(item.type==='setup')return (p.setups||[]).includes(item.name);
  if(item.type==='vd')return (p.vd||[]).includes(item.name);
  if(item.type==='context')return (p.contextDefinitions||[]).some(d=>d.key===item.name);
  if(item.type==='nr')return (p.nr||[]).includes(item.name);
  if(item.type==='hypothesis')return (p.hypotheses||[]).some(h=>h.name===item.name);
  if(item.type==='riskStrategy')return (p.riskStrategies||[]).some(r=>r.name===item.name);
  if(item.type==='riskRules')return false;
  if(item.type==='discretionaryTarget')return (p.discretionaryTargets||[]).includes(item.name);
  return false;
}
function addLibraryLink(p,item,key=item.name){
  p.libraryLinks=Array.isArray(p.libraryLinks)?p.libraryLinks:[];
  p.libraryLinks=p.libraryLinks.filter(x=>!(x.type===item.type&&x.key===key));
  p.libraryLinks.push({type:item.type,key,itemId:item.id,familyId:item.familyId,version:item.version,linkedAt:new Date().toISOString()});
}
function nextHypothesisId(p,desired=''){
  if(desired&&!p.hypotheses.some(h=>h.id===desired))return desired;
  let n=1,id='H1';while(p.hypotheses.some(h=>h.id===id)){n++;id=`H${n}`;}return id;
}
function applyLibraryItemToPlan(item,p){
  if(!item||!p)return {status:'error'};ensurePlanV8Structure(p);
  if(item.type!=='riskRules'&&planHasLibraryEquivalent(p,item))return {status:'exists'};
  if(item.type==='setup'){
    const d=clone(item.payload);d.id=uid('SETDEF');d.updatedAt=new Date().toISOString();p.setupDefinitions.push(d);p.setups=uniq([...(p.setups||[]),item.name]);
  }else if(item.type==='vd'){
    const d=clone(item.payload);d.id=uid('VDDEF');d.updatedAt=new Date().toISOString();p.vdDefinitions.push(d);p.vd=uniq([...(p.vd||[]),item.name]);
  }else if(item.type==='context'){
    const d=clone(item.payload);d.id=uid('CTXDEF');d.updatedAt=new Date().toISOString();p.contextDefinitions.push(d);
  }else if(item.type==='nr')p.nr=uniq([...(p.nr||[]),item.name]);
  else if(item.type==='hypothesis'){
    const h=clone(item.payload);h.id=nextHypothesisId(p,h.id);p.hypotheses.push(h);
  }else if(item.type==='riskStrategy'){
    const r=normalizeRiskStrategy(clone(item.payload),state.settings.instruments);r.id=uid('R');r.lots=(r.lots||[]).map(l=>({...l,id:uid('L')}));p.riskStrategies.push(r);
  }else if(item.type==='riskRules')p.riskManagement=clone(item.payload);
  else if(item.type==='discretionaryTarget')p.discretionaryTargets=uniq([...(p.discretionaryTargets||[]),item.name]);
  addLibraryLink(p,item,item.name);p.updatedAt=new Date().toISOString();ensurePlanV8Structure(p);return {status:'added'};
}
function applyLibraryItemsToPlan(ids,p){
  const lib=ensureMasterLibrary();let added=0,exists=0;
  ids.forEach(id=>{const item=lib.items.find(x=>x.id===id&&x.status!=='archived');if(!item)return;const r=applyLibraryItemToPlan(item,p);if(r.status==='added')added++;else if(r.status==='exists')exists++;});
  return {added,exists};
}
function libraryItemUsage(item){return state.tradingPlans.filter(p=>(p.libraryLinks||[]).some(x=>x.familyId===item.familyId)).length;}
function libraryUpdateForPlan(p,item){const link=(p.libraryLinks||[]).find(x=>x.familyId===item.familyId);return link&&Number(link.version)<Number(item.version)?item.version:null;}

function libraryPickerGroups(items,checkboxName,targetPlan=null){
  const types=['setup','vd','context','nr','hypothesis','riskStrategy','riskRules','discretionaryTarget'];
  return `<div class="library-picker">${types.map(type=>{const rows=items.filter(x=>x.type===type);if(!rows.length)return '';return `<section class="library-picker-group"><h4>${libraryTypeLabel(type)}</h4>${rows.map(i=>{const exists=targetPlan&&type!=='riskRules'&&planHasLibraryEquivalent(targetPlan,i);return `<label class="library-check ${exists?'disabled':''}"><input type="checkbox" name="${checkboxName}" value="${esc(i.id)}" ${exists?'disabled':''}><span><strong>${esc(i.name)}</strong><small>v${i.version}${i.sourcePlanLabel?` · ${esc(i.sourcePlanLabel)}`:''}${exists?' · Ya está en el plan':''}</small></span></label>`;}).join('')}</section>`;}).join('')}</div>`;
}
function openLibraryPicker(){
  const p=getCurrentPlan(),items=latestLibraryItems(false);if(!p)return;if(!items.length)return alert('La Biblioteca Maestra está vacía. Guarda primero material desde un Trading Plan.');
  const body=`<div class="notice">Selecciona el material que quieres añadir a <strong>${esc(planLabel(p))}</strong>. Se copia como snapshot: futuras versiones de la Biblioteca no modificarán este plan.</div>${libraryPickerGroups(items,'lib-pick-item',p)}`;
  document.body.insertAdjacentHTML('beforeend',modalShell('Seleccionar desde Biblioteca Maestra',body,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="confirmLibraryPicker()">Añadir selección</button>`));
}
function confirmLibraryPicker(){const p=getCurrentPlan();if(!p)return;const ids=[...document.querySelectorAll('input[name="lib-pick-item"]:checked')].map(x=>x.value);if(!ids.length)return alert('Selecciona al menos un elemento.');const r=applyLibraryItemsToPlan(ids,p);persist();closeModal();render();alert(`Añadidos al plan: ${r.added}${r.exists?`\nYa existentes: ${r.exists}`:''}`);}
function addSingleLibraryItem(id){const p=getCurrentPlan(),item=ensureMasterLibrary().items.find(x=>x.id===id);if(!p||!item)return;const r=applyLibraryItemToPlan(item,p);if(r.status==='exists')return alert('Ese elemento ya existe en el Trading Plan actual.');persist();render();}
function archiveLibraryFamily(familyId){const items=libraryFamilyItems(familyId);if(!items.length)return;if(!confirm(`Archivar "${items[0].name}" y todas sus versiones?\n\nNo se borrará de ningún Trading Plan que ya lo utilice.`))return;items.forEach(i=>{i.status='archived';i.updatedAt=new Date().toISOString();});ensureMasterLibrary().updatedAt=new Date().toISOString();persist();render();}
function restoreLibraryFamily(familyId){libraryFamilyItems(familyId).forEach(i=>{i.status='active';i.updatedAt=new Date().toISOString();});ensureMasterLibrary().updatedAt=new Date().toISOString();persist();render();}

function masterLibraryPanel(){
  const p=getCurrentPlan(),lib=ensureMasterLibrary(),latest=latestLibraryItems(false),archivedFamilies=[...new Set(lib.items.filter(x=>x.status==='archived').map(x=>x.familyId))].filter(fid=>!lib.items.some(x=>x.familyId===fid&&x.status==='active'));
  const counts={};latest.forEach(i=>counts[i.type]=(counts[i.type]||0)+1);
  const group=type=>{const items=latest.filter(i=>i.type===type);if(!items.length)return '';return `<section class="card panel config-wide master-lib-section"><div class="panel-title"><div><h3>${libraryTypeLabel(type)}</h3><div class="help">${items.length} elemento(s) reutilizable(s)</div></div></div><div class="master-lib-grid">${items.map(i=>{const versions=libraryFamilyItems(i.familyId).length,usage=libraryItemUsage(i),update=libraryUpdateForPlan(p,i);return `<article class="master-lib-card"><div class="master-lib-head"><div><span class="badge">v${i.version}</span><strong>${esc(i.name)}</strong></div><span>${versions} versión(es)</span></div><div class="master-lib-meta">${i.sourcePlanLabel?`Origen: ${esc(i.sourcePlanLabel)} · `:''}${usage} plan(es) vinculados${update?` · <b class="positive">v${update} disponible</b>`:''}</div><div class="master-lib-actions"><button class="btn small primary" onclick="addSingleLibraryItem('${i.id}')" ${type!=='riskRules'&&planHasLibraryEquivalent(p,i)?'disabled':''}>${type!=='riskRules'&&planHasLibraryEquivalent(p,i)?'Ya en este plan':'Añadir al plan'}</button><button class="btn small danger" onclick="archiveLibraryFamily('${i.familyId}')">Archivar</button></div></article>`;}).join('')}</div></section>`;};
  return `<section class="card panel config-wide master-lib-hero"><div class="panel-title"><div><h3>Biblioteca Maestra</h3><div class="help">Material global reutilizable entre Trading Plans. Cada plan recibe una copia versionada; una actualización futura no reescribe su histórico.</div></div><div class="master-lib-toolbar"><button class="btn" onclick="openLibraryPicker()">Seleccionar para este plan</button><button class="btn primary" onclick="saveCurrentPlanToLibrary()">Guardar plan actual en Biblioteca</button></div></div><div class="master-lib-kpis"><div><span>Familias activas</span><strong>${latest.length}</strong></div><div><span>Setups</span><strong>${counts.setup||0}</strong></div><div><span>Contextos</span><strong>${counts.context||0}</strong></div><div><span>VD</span><strong>${counts.vd||0}</strong></div><div><span>Estrategias</span><strong>${counts.riskStrategy||0}</strong></div></div><div class="notice">Prueba recomendada: guarda el plan actual, crea un plan nuevo desde Biblioteca y selecciona solo 2–3 elementos. El original no cambia y el nuevo recibe sus propias copias.</div></section>${['setup','vd','context','nr','hypothesis','riskStrategy','riskRules','discretionaryTarget'].map(group).join('')}${archivedFamilies.length?`<section class="card panel config-wide"><div class="panel-title"><div><h3>Archivados</h3><div class="help">Se conservan para no perder versiones históricas.</div></div></div><div class="config-list">${archivedFamilies.map(fid=>{const i=libraryFamilyItems(fid)[0];return `<div class="config-row"><div class="config-main"><div class="config-name">${esc(i?.name||'Elemento')}</div><div class="config-meta">${esc(libraryTypeLabel(i?.type||''))} · ${libraryFamilyItems(fid).length} versión(es)</div></div><button class="btn small" onclick="restoreLibraryFamily('${fid}')">Restaurar</button></div>`;}).join('')}</div></section>`:''}`;
}

function openPlanFromLibraryModal(){
  const items=latestLibraryItems(false);if(!items.length)return alert('La Biblioteca Maestra está vacía. Guarda primero el material de un Trading Plan.');
  const body=`<form onsubmit="return false"><div class="form-section"><h4>Identidad del nuevo plan</h4><div class="form-grid">${field('Familia / sistema','lib-plan-family','text','')}${field('Nombre','lib-plan-name','text','')}${field('Versión','lib-plan-version','text','v1')}${field('Descripción','lib-plan-description','textarea','','full')}</div></div><div class="form-section"><h4>Material inicial</h4><div class="help">Elige solamente lo que quieras utilizar. Los elementos se copian y quedan congelados en esta versión del plan.</div>${libraryPickerGroups(items,'lib-create-item',null)}</div></form>`;
  document.body.insertAdjacentHTML('beforeend',modalShell('Nuevo Trading Plan desde Biblioteca',body,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="createPlanFromLibrary()">Crear plan</button>`));
}
function createPlanFromLibrary(){
  const get=n=>document.getElementById(`f-${n}`)?.value||'',name=get('lib-plan-name').trim();if(!name)return alert('El nombre del plan es obligatorio.');
  const family=get('lib-plan-family').trim()||name,version=get('lib-plan-version').trim()||'v1',description=get('lib-plan-description').trim();
  const ids=[...document.querySelectorAll('input[name="lib-create-item"]:checked')].map(x=>x.value);if(!ids.length&&!confirm('No has seleccionado material. ¿Crear igualmente un plan vacío?'))return;
  const p=makeBlankPlan({familyName:family,name,version,description,status:'active'});ensurePlanV8Structure(p);applyLibraryItemsToPlan(ids,p);state.tradingPlans.push(p);state.currentPlanId=p.id;persist();closeModal();currentView='plans';render();
}

const plansViewV11Base=plansView;
plansView=function(){
  let html=plansViewV11Base();
  const old='<button class="btn primary" onclick="openPlanModal()">+ Nuevo plan desde cero</button>';
  const repl='<div class="page-head-actions"><button class="btn" onclick="openPlanModal()">+ Nuevo desde cero</button><button class="btn primary" onclick="openPlanFromLibraryModal()">+ Nuevo desde Biblioteca</button></div>';
  return html.replace(old,repl);
};

configTabs=function(p){const tabs=[['instruments','Contratos','Biblioteca global'],['masterLibrary','Biblioteca Maestra','Material reutilizable'],['management','Gestión','Estrategias y salidas'],['taxonomy','Taxonomías','Setups, VD, contexto y estructura'],['visual','Referencias visuales','Galería del plan'],['emotional','Emocional','Estados y comportamientos'],['riskrules','Riesgo','Reglas diarias/semanales'],['data','Datos y seguridad','Backup e integridad'],['cloud','Nube','Supabase y sincronización']];return `<div class="config-tabs">${tabs.map(([id,label,desc])=>`<button class="config-tab ${configTab===id?'active':''}" onclick="setConfigTab('${id}')"><strong>${label}</strong><span>${desc}</span></button>`).join('')}</div>`;};
const configContentV11Base=configContent;
configContent=function(p){if(configTab==='masterLibrary')return masterLibraryPanel();return configContentV11Base(p);};

const planCloudRowV11Base=planCloudRow;
planCloudRow=function(p,userId){const row=planCloudRowV11Base(p,userId);row.payload={...clone(row.payload),__masterLibrary:clone(ensureMasterLibrary())};return row;};
cloudLocalFingerprintPayload=function(){
  ensureAllPlansV8();ensureMasterLibrary();
  const byId=a=>clone(a||[]).sort((x,y)=>String(x?.id||'').localeCompare(String(y?.id||'')));
  const plans=byId(state.tradingPlans).map(p=>({...p,__masterLibrary:clone(state.masterLibrary)}));
  return {currentPlanId:state.currentPlanId||'',plans,instruments:byId(state.settings?.instruments),operations:byId(state.operations),batches:byId(state.importBatches),opportunities:byId(state.opportunities)};
};

const collectReferencedImageIdsV11Base=collectReferencedImageIds;
collectReferencedImageIds=function(){
  const ids=collectReferencedImageIdsV11Base();
  ensureMasterLibrary().items.forEach(i=>{
    const p=i.payload||{};
    [...(p.images||[]),...(p.imagesLong||[]),...(p.imagesShort||[])].forEach(x=>x?.id&&ids.push(x.id));
  });
  return ids;
};

// Do not delete an image blob if another plan or the Master Library still references it.
deleteTaxonomyAsset=async function(type,key){
  const p=getCurrentPlan();if(!p)return;ensurePlanV8Structure(p);const clean=decodeURIComponent(key||'');
  if(!confirm(`¿Eliminar ${taxonomyLabel(type).toLowerCase()} "${clean}"? Las operaciones históricas no se borrarán.`))return;
  const collName=defCollectionName(type),coll=p[collName],item=coll.find(d=>d.key===clean),imgs=item?[...(item.images||[]),...(item.imagesLong||[]),...(item.imagesShort||[])]:[];
  p[collName]=coll.filter(d=>d.key!==clean);if(type==='setup')p.setups=(p.setups||[]).filter(x=>x!==clean);if(type==='vd')p.vd=(p.vd||[]).filter(x=>x!==clean);p.updatedAt=new Date().toISOString();
  const refs=new Set(collectReferencedImageIds());for(const img of imgs)if(!refs.has(img.id))await deleteImageBlob(img.id);
  persist();render();
};

const shellV11Base=shell;
shell=function(){return shellV11Base().replace(V10_APP_LABEL,V11_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. El Laboratorio es una capa analítica no destructiva.','Motor cloud V9.2 Conflict Guard intacto. Biblioteca Maestra y Laboratorio trabajan encima de la misma base estable.');};
Object.assign(window,{saveCurrentPlanToLibrary,openLibraryPicker,confirmLibraryPicker,addSingleLibraryItem,archiveLibraryFamily,restoreLibraryFamily,openPlanFromLibraryModal,createPlanFromLibrary,deleteTaxonomyAsset});
render();
/* ===== END V11 PATCH ===== */

/* ===== V11.1 PATCH · Simple Reusable Library ===== */
const V111_APP_LABEL='V11.1 · Biblioteca Simple';

function simpleLibraryItems(){
  const lib=ensureMasterLibrary();
  const grouped=new Map();
  lib.items.filter(i=>i.status!=='archived').forEach(i=>{
    const k=`${i.type}::${i.name}`;
    const prev=grouped.get(k);
    if(!prev||new Date(i.updatedAt||i.createdAt||0)>new Date(prev.updatedAt||prev.createdAt||0))grouped.set(k,i);
  });
  return [...grouped.values()].sort((a,b)=>libraryTypeOrder(a.type)-libraryTypeOrder(b.type)||a.name.localeCompare(b.name,'es'));
}
function simpleLibraryItemByName(type,name){return simpleLibraryItems().find(i=>i.type===type&&i.name===name)||null;}
function simpleTemplateDescriptor(type,ref,p=getCurrentPlan()){
  if(!p)return null;ensurePlanV8Structure(p);const clean=decodeURIComponent(String(ref||''));
  if(['setup','vd','context'].includes(type)){
    const d=getTaxonomyDef(type,clean,p);return d?{type,name:d.key,payload:clone(d)}:null;
  }
  if(type==='nr')return (p.nr||[]).includes(clean)?{type,name:clean,payload:{name:clean}}:null;
  if(type==='hypothesis'){
    const h=(p.hypotheses||[]).find(x=>x.id===clean||x.name===clean);return h?{type,name:h.name,payload:clone(h)}:null;
  }
  if(type==='riskStrategy'){
    const r=(p.riskStrategies||[]).find(x=>x.id===clean||x.name===clean);return r?{type,name:r.name,payload:clone(r)}:null;
  }
  if(type==='riskRules')return {type,name:'Reglas de gestión del riesgo',payload:clone(p.riskManagement||basePlanConfig.riskManagement)};
  if(type==='discretionaryTarget')return (p.discretionaryTargets||[]).includes(clean)?{type,name:clean,payload:{name:clean}}:null;
  return null;
}
function simpleTemplateIsSaved(type,ref){
  const d=simpleTemplateDescriptor(type,ref);if(!d)return false;const i=simpleLibraryItemByName(type,d.name);return !!(i&&libraryPayloadEqual(type,i.payload,d.payload));
}
function simpleSaveButton(type,ref){
  const saved=simpleTemplateIsSaved(type,ref);const token=encodeURIComponent(String(ref||''));
  return `<button class="btn small ${saved?'':'primary'}" onclick="savePlanItemToLibrary('${type}','${token}')" ${saved?'disabled':''}>${saved?'Guardado':'Guardar'}</button>`;
}
function savePlanItemToLibrary(type,ref){
  const p=getCurrentPlan(),d=simpleTemplateDescriptor(type,ref,p);if(!d)return alert('No se encontró ese elemento en el Trading Plan actual.');
  const lib=ensureMasterLibrary(),sameName=lib.items.filter(i=>i.type===type&&i.name===d.name);
  const exact=sameName.find(i=>i.status!=='archived'&&libraryPayloadEqual(type,i.payload,d.payload));
  if(exact){render();return;}
  const now=new Date().toISOString();
  if(sameName.length){
    if(!confirm(`Ya existe "${d.name}" en la Biblioteca.\n\n¿Reemplazar la copia guardada por la versión actual de este Trading Plan?`))return;
    const keep=sameName.sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))[0];
    keep.payload=clone(d.payload);keep.name=d.name;keep.status='active';keep.version=1;keep.updatedAt=now;keep.sourcePlanId=p.id;keep.sourcePlanLabel=planLabel(p);
    lib.items=lib.items.filter(i=>i===keep||!(i.type===type&&i.name===d.name));
  }else{
    lib.items.push({id:uid('LIB'),familyId:uid('LIBF'),type,name:d.name,version:1,status:'active',createdAt:now,updatedAt:now,sourcePlanId:p.id,sourcePlanLabel:planLabel(p),payload:clone(d.payload)});
  }
  lib.updatedAt=now;persist();render();
}
function simplePayloadImageIds(payload){
  const p=payload||{};return [...(p.images||[]),...(p.imagesLong||[]),...(p.imagesShort||[])].map(x=>x?.id).filter(Boolean);
}
async function deleteSavedLibraryItem(id){
  const lib=ensureMasterLibrary(),item=lib.items.find(i=>i.id===id);if(!item)return;
  if(!confirm(`¿Eliminar "${item.name}" de la Biblioteca?\n\nNo se borrará de ningún Trading Plan donde ya lo hayas añadido.`))return;
  const targets=lib.items.filter(i=>i.type===item.type&&i.name===item.name),imageIds=targets.flatMap(i=>simplePayloadImageIds(i.payload));
  const familyIds=new Set(targets.map(i=>i.familyId)),itemIds=new Set(targets.map(i=>i.id));
  lib.items=lib.items.filter(i=>!(i.type===item.type&&i.name===item.name));lib.updatedAt=new Date().toISOString();
  state.tradingPlans.forEach(p=>{p.libraryLinks=(p.libraryLinks||[]).filter(x=>!familyIds.has(x.familyId)&&!itemIds.has(x.itemId));});
  const refs=new Set(collectReferencedImageIds());for(const imgId of imageIds)if(!refs.has(imgId))await deleteImageBlob(imgId);
  persist();render();
}
function addSimpleLibraryItem(id){
  const p=getCurrentPlan(),item=simpleLibraryItems().find(i=>i.id===id);if(!p||!item)return;
  if(item.type==='riskRules'&&!confirm('Esto reemplazará las reglas de gestión de riesgo del Trading Plan actual. ¿Continuar?'))return;
  const r=applyLibraryItemToPlan(item,p);if(r.status==='exists')return alert('Ese elemento ya existe en el Trading Plan actual.');
  persist();render();
}
function simpleLibrarySummary(i){
  const p=i.payload||{};
  if(['setup','vd','context'].includes(i.type))return `${(p.timeframes||[]).join(', ')||'Sin timeframe'}${p.description?` · ${p.description}`:''}`;
  if(i.type==='hypothesis')return p.description||'Hipótesis guardada';
  if(i.type==='riskStrategy')return `ATR ${p.atrMin??'—'}–${p.atrMax??'—'} · ${(p.lots||[]).length} lote(s)`;
  if(i.type==='riskRules')return 'Reglas diarias y semanales guardadas';
  return 'Plantilla reutilizable';
}
function simpleLibraryPanel(){
  const p=getCurrentPlan(),items=simpleLibraryItems(),types=['setup','vd','context','nr','hypothesis','riskStrategy','riskRules','discretionaryTarget'];
  const group=type=>{const rows=items.filter(i=>i.type===type);if(!rows.length)return '';return `<section class="card panel config-wide master-lib-section"><div class="panel-title"><div><h3>${libraryTypeLabel(type)}</h3><div class="help">${rows.length} guardado(s)</div></div></div><div class="master-lib-grid">${rows.map(i=>{const exists=type!=='riskRules'&&planHasLibraryEquivalent(p,i);return `<article class="master-lib-card"><div class="master-lib-head"><div><strong>${esc(i.name)}</strong></div></div><div class="master-lib-meta">${esc(simpleLibrarySummary(i))}${i.sourcePlanLabel?`<br>Guardado desde: ${esc(i.sourcePlanLabel)}`:''}</div><div class="master-lib-actions"><button class="btn small primary" onclick="addSimpleLibraryItem('${i.id}')" ${exists?'disabled':''}>${exists?'Ya está en este plan':'Añadir al plan'}</button><button class="btn small danger" onclick="deleteSavedLibraryItem('${i.id}')">Eliminar</button></div></article>`;}).join('')}</div></section>`;};
  return `<section class="card panel config-wide master-lib-hero"><div class="panel-title"><div><h3>Biblioteca</h3><div class="help">Tu cajón de plantillas reutilizables. Guarda cada elemento desde su propia ficha y recupéralo en cualquier Trading Plan.</div></div></div><div class="master-lib-kpis"><div><span>Elementos guardados</span><strong>${items.length}</strong></div><div><span>Setups</span><strong>${items.filter(i=>i.type==='setup').length}</strong></div><div><span>Contextos</span><strong>${items.filter(i=>i.type==='context').length}</strong></div><div><span>VD</span><strong>${items.filter(i=>i.type==='vd').length}</strong></div><div><span>Estrategias</span><strong>${items.filter(i=>i.type==='riskStrategy').length}</strong></div></div><div class="notice">Uso: entra en Taxonomías, Gestión o Riesgo y pulsa <strong>Guardar</strong> junto al elemento que quieras conservar. Aquí podrás añadirlo al plan activo o eliminarlo de la Biblioteca sin afectar a los planes que ya lo usan.</div></section>${items.length?types.map(group).join(''):'<section class="card panel config-wide"><div class="empty">Todavía no has guardado ninguna plantilla. Empieza pulsando Guardar en un Setup, VD, Contexto, Hipótesis, Estrategia o regla de riesgo.</div></section>'}`;
}

taxonomyCard=function(type,def){
  const time=badgeList(def.timeframes),desc=esc(def.description||def.specs||'Sin descripción aún.');
  const media=type==='setup'?`<div class="taxonomy-media-grid"><div><small>Largo</small>${richImageStrip(def.imagesLong,'long')}</div><div><small>Corto</small>${richImageStrip(def.imagesShort,'short')}</div></div>`:`<div class="taxonomy-media-grid single"><div><small>Referencia visual</small>${richImageStrip(def.images,'ejemplo')}</div></div>`;
  return `<article class="taxonomy-card"><div class="taxonomy-head"><div><strong>${esc(def.key)}</strong><div class="taxonomy-sub">${time}</div></div><div class="taxonomy-actions"><button class="btn small" onclick="openTaxonomyAssetModal('${type}','${encodeURIComponent(def.key)}')">Editar</button>${simpleSaveButton(type,def.key)}<button class="btn small danger" onclick="deleteTaxonomyAsset('${type}','${encodeURIComponent(def.key)}')">Eliminar</button></div></div><p>${desc}</p>${def.specs?`<div class="taxonomy-specs">${esc(def.specs)}</div>`:''}${media}</article>`;
};
referenceGalleryCard=function(type,def){
  const label=taxonomyLabel(type),media=type==='setup'?`<div class="reference-showcase split"><div><small>LONG</small>${richImageStrip(def.imagesLong,'long')}</div><div><small>SHORT</small>${richImageStrip(def.imagesShort,'short')}</div></div>`:`<div class="reference-showcase">${richImageStrip(def.images,'ref')}</div>`;
  return `<article class="reference-gallery-card"><div class="reference-gallery-head"><div><span class="badge">${label}</span><strong>${esc(def.key)}</strong></div><span class="tf-pack">${badgeList(def.timeframes)}</span></div><p>${esc(def.description||def.specs||'Sin notas')}</p>${def.specs?`<div class="taxonomy-specs">${esc(def.specs)}</div>`:''}${media}<div class="gallery-edit-row"><button class="btn small" onclick="openTaxonomyAssetModal('${type}','${encodeURIComponent(def.key)}')">Editar ficha</button>${simpleSaveButton(type,def.key)}</div></article>`;
};
configCard=function(title,desc,key){
  const p=getCurrentPlan(),arr=p?.[key]||[],type=key==='nr'?'nr':key==='discretionaryTargets'?'discretionaryTarget':null;
  return `<section class="card panel"><div class="panel-title"><h3>${title}</h3><span>${desc}</span></div><div class="config-list">${arr.map((x,i)=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(x)}</div><div class="config-meta">Disponible dentro de ${esc(planLabel(p))}</div></div><div class="taxonomy-actions">${type?simpleSaveButton(type,x):''}<button class="btn small danger" onclick="removeConfig('${key}',${i})">Eliminar</button></div></div>`).join('')||'<div class="empty">Sin categorías.</div>'}</div><div class="inline-add"><input id="new-${key}" class="input" placeholder="Añadir categoría…"><button class="btn small" onclick="addConfig('${key}')">Añadir</button></div></section>`;
};
hypothesisSection=function(p){
  return `<section class="card panel"><div class="panel-title"><h3>Hipótesis</h3><span>Definiciones propias del plan</span></div><div class="config-list">${(p?.hypotheses||[]).map(h=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(h.name)} <span class="badge">${esc(h.id)}</span></div><div class="config-meta">${esc(h.description||'Sin descripción')}</div></div><div class="taxonomy-actions"><button class="btn small" onclick="editHyp('${h.id}')">Editar</button>${simpleSaveButton('hypothesis',h.id)}</div></div>`).join('')||'<div class="empty">Sin hipótesis configuradas.</div>'}</div><div class="inline-add"><input id="new-hypothesis" class="input" placeholder="Nombre de nueva hipótesis"><button class="btn small" onclick="addHypothesis()">Añadir</button></div></section>`;
};
riskCard=function(r){
  const c=riskCalc(r),inst=c.inst;return `<div class="config-row risk-card"><div class="config-main"><div class="config-name">${esc(r.name)} <span class="badge">${esc(r.id)}</span> ${r.active===false?'<span class="badge">Inactiva</span>':''}</div><div class="config-meta">ATR ${r.atrMin}–${r.atrMax} · ${esc(inst?.symbol||'Sin contrato')} · ${c.contracts} contrato(s) · riesgo teórico ${money(c.riskUsd,inst?.currency)} · comisión estimada ${money(c.commission,inst?.currency)}</div><div class="chips">${(r.lots||[]).map((l,i)=>`<span class="tag">L${i+1}: ${l.quantity} ct · SL ${l.stopTicks}t · ${l.targetType==='ticks'?`TP ${l.targetTicks}t${l.stopTicks?` (${(l.targetTicks/l.stopTicks).toFixed(2)}R bruta)`:''}`:`TP ${esc(l.targetRule||'discrecional')}`}</span>`).join('')}</div></div><div class="taxonomy-actions"><button class="btn small" onclick="openRiskModal('${r.id}')">Editar</button>${simpleSaveButton('riskStrategy',r.id)}</div></div>`;
};
riskManagementPanel=function(p){
  const r=p?.riskManagement||basePlanConfig.riskManagement;return `<section class="card panel config-wide" style="margin-top:16px"><div class="panel-title"><div><h3>Normas de gestión de riesgo · ${esc(planLabel(p))}</h3><div class="help">La estadística puede simular cronológicamente qué operaciones habrías podido tomar después de aplicar estas reglas.</div></div><div class="master-lib-actions"><button class="btn small" onclick="openRiskManagementModal()">Editar reglas</button>${simpleSaveButton('riskRules','riskRules')}</div></div><div class="risk-rule-cards"><div><span>Diario</span><strong>${esc(ruleConfigText(r.daily,'daily'))}</strong></div><div><span>Semanal</span><strong>${esc(ruleConfigText(r.weekly,'weekly'))}</strong></div></div><div class="notice" style="margin-top:12px">El trade que alcanza un límite sí cuenta; se excluyen las operaciones posteriores. El filtro se aplica sobre el subconjunto temporal/contextual que tengas seleccionado en Operaciones.</div></section>`;
};

configTabs=function(p){const tabs=[['instruments','Contratos','Biblioteca global'],['library','Biblioteca','Plantillas guardadas'],['management','Gestión','Estrategias y salidas'],['taxonomy','Taxonomías','Setups, VD, contexto y estructura'],['visual','Referencias visuales','Galería del plan'],['emotional','Emocional','Estados y comportamientos'],['riskrules','Riesgo','Reglas diarias/semanales'],['data','Datos y seguridad','Backup e integridad'],['cloud','Nube','Supabase y sincronización']];return `<div class="config-tabs">${tabs.map(([id,label,desc])=>`<button class="config-tab ${configTab===id?'active':''}" onclick="setConfigTab('${id}')"><strong>${label}</strong><span>${desc}</span></button>`).join('')}</div>`;};
configContent=function(p){if(configTab==='library')return simpleLibraryPanel();return configContentV11Base(p);};
plansView=function(){return plansViewV11Base();};
const shellV111Base=shell;
shell=function(){return shellV111Base().replace(V11_APP_LABEL,V111_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Biblioteca Maestra y Laboratorio trabajan encima de la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Biblioteca reutilizable simple y Laboratorio trabajan encima de la misma base estable.');};
Object.assign(window,{savePlanItemToLibrary,deleteSavedLibraryItem,addSimpleLibraryItem});
render();
/* ===== END V11.1 PATCH ===== */

/* ===== V11.2 PATCH · Legibilidad + color de signos existentes ===== */
const V112_APP_LABEL='V11.2 · Legibilidad';

/*
  No formatea ni modifica cifras. Si un texto ya comienza por +, se pinta verde;
  si ya comienza por - o −, se pinta rojo. Los números sin signo quedan intactos.
*/
function paintExistingSignedNumbers(root=document){
  const elements=[];
  if(root?.nodeType===1) elements.push(root);
  if(root?.querySelectorAll) elements.push(...root.querySelectorAll('*'));
  for(const el of elements){
    if(!el || ['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT','OPTION'].includes(el.tagName)) continue;
    if(el.children?.length) continue;
    const text=String(el.textContent||'').replace(/\u00a0/g,' ').trim();
    if(!text || text.includes('→')) continue;
    const matches=text.match(/[+\-−]\s*(?:[€$£]\s*)?\d/g)||[];
    if(matches.length!==1) continue;
    const m=text.match(/^([+\-−])\s*(?:[€$£]\s*)?\d/);
    if(!m) continue;
    el.classList.remove('signed-existing-positive','signed-existing-negative');
    el.classList.add(m[1]==='+'?'signed-existing-positive':'signed-existing-negative');
  }
}

const signedNumberObserver=new MutationObserver(mutations=>{
  for(const mutation of mutations){
    for(const node of mutation.addedNodes){
      if(node.nodeType===1) paintExistingSignedNumbers(node);
    }
  }
});
signedNumberObserver.observe(document.body,{childList:true,subtree:true});

const shellV112Base=shell;
shell=function(){
  return shellV112Base()
    .replace(V111_APP_LABEL,V112_APP_LABEL)
    .replace(
      'Motor cloud V9.2 Conflict Guard intacto. Biblioteca reutilizable simple y Laboratorio trabajan encima de la misma base estable.',
      'Motor cloud V9.2 Conflict Guard intacto. Biblioteca Simple + Laboratorio, con legibilidad mejorada y color de signos existentes.'
    );
};

paintExistingSignedNumbers(document);
render();
/* ===== END V11.2 PATCH ===== */

/* ===== V11.3 PATCH · Dashboard multiuidad + reset de selecciones gráficas ===== */
const V113_APP_LABEL='V11.3 · Dashboard + Reset';
let dashboardViewState={unit:'r'};

function setDashboardUnit(unit){
  dashboardViewState.unit=['r','ticks','usd'].includes(unit)?unit:'r';
  render();
}
function dashboardPlainMetric(v,unit){
  v=Number(v)||0;
  if(unit==='usd') return `${v.toFixed(2)} US$`;
  if(unit==='ticks') return `${v.toFixed(1)}t`;
  return `${v.toFixed(2)}R`;
}
function dashboardSignedMetric(v,unit){
  v=Number(v)||0;
  return `${v>=0?'+':''}${dashboardPlainMetric(v,unit)}`;
}
function dashboardExcursionAverage(ops,key,unit){
  if(!ops.length)return 0;
  const values=ops.map(o=>{
    const r=Number(o[key])||0;
    if(unit==='r')return r;
    if(unit==='ticks')return r*(Number(o.riskTickExposure)||0);
    return r*(Number(o.riskUsd)||0);
  });
  return values.reduce((a,b)=>a+b,0)/values.length;
}

dashboard=function(){
  const ops=currentOps(),baseStats=calcStats(ops),unit=dashboardViewState.unit||'r',metricStats=calcMetricStats(ops,unit,'gross'),bySetup={};
  ops.forEach(o=>bySetup[o.setup]=(bySetup[o.setup]||0)+1);
  const top=Object.entries(bySetup).sort((a,b)=>b[1]-a[1]).slice(0,6),max=top[0]?.[1]||1;
  const pts=metricStats.equity;let svg='';
  if(pts.length){
    const min=Math.min(...pts,0),maxE=Math.max(...pts,0),range=(maxE-min)||1,W=760,H=250,
      coords=pts.map((v,i)=>`${(i/Math.max(pts.length-1,1))*W},${H-((v-min)/range)*H}`).join(' '),
      area=`0,${H} ${coords} ${W},${H}`;
    svg=`<svg class="equity-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line class="axis" x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"/><polygon class="area" points="${area}"/><polyline class="line" points="${coords}"/></svg>`;
  }else svg='<div class="empty">Registra o importa la primera operación de este plan para ver la curva de equity.</div>';
  const pf=Number.isFinite(metricStats.pf)?metricStats.pf.toFixed(2):'∞',mfe=dashboardExcursionAverage(ops,'mfe',unit),mae=dashboardExcursionAverage(ops,'mae',unit),unitLabel=metricUnitLabel(unit);
  const actions=`<div class="metric-switch dashboard-unit-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${unit===v?'active':''}" onclick="setDashboardUnit('${v}')">${l}</button>`).join('')}</div><button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button><button class="btn" onclick="openImportModal()">Importar Ankora</button>`;
  return `${pageHead('Dashboard','Vista del Trading Plan seleccionado. Cambia R, ticks o US$ sin alterar el dataset.',actions)}${activePlanBanner()}<div class="kpis">${kpi('Operaciones',baseStats.n,'plan activo')}${kpi('Win rate',pct(baseStats.winRate),'resultado cerrado')}${kpi('Expectancy',dashboardSignedMetric(metricStats.expectancy,unit),`por operación · ${unitLabel}`)}${kpi('Profit Factor',pf,'ganancia / pérdida')}${kpi('Drawdown',dashboardPlainMetric(metricStats.maxDD,unit),`máximo · ${unitLabel}`)}${kpi('Bloques',Math.ceil(baseStats.n/20),'de 20 operaciones')}</div><div class="grid two"><section class="card panel"><div class="panel-title"><h3>Equity en ${unitLabel}</h3><span>${baseStats.n?`${dashboardSignedMetric(metricStats.sum,unit)} acumulado`:'sin datos'}</span></div><div class="chart-wrap">${svg}</div></section><section class="card panel"><div class="panel-title"><h3>Operaciones por setup</h3><span>${esc(planLabel(getCurrentPlan()))}</span></div><div class="bar-list">${top.length?top.map(([k,v])=>`<div class="bar-row"><div>${esc(k||'Sin setup')}</div><div class="bar"><span style="width:${(v/max)*100}%"></span></div><div class="value-right">${v}</div></div>`).join(''):'<div class="empty">Aún no hay operaciones.</div>'}</div></section></div><div class="grid three" style="margin-top:16px"><section class="card panel"><div class="panel-title"><h3>MFE medio</h3><span>${unitLabel}</span></div><div class="kpi value">${dashboardPlainMetric(mfe,unit)}</div><div class="help">Potencial favorable y salidas.</div></section><section class="card panel"><div class="panel-title"><h3>MAE medio</h3><span>${unitLabel}</span></div><div class="kpi value">${dashboardPlainMetric(mae,unit)}</div><div class="help">Excursión adversa y stops.</div></section><section class="card panel"><div class="panel-title"><h3>Bloque actual</h3><span>20 trades</span></div><div class="kpi value">${baseStats.n?Math.floor((baseStats.n-1)/20)+1:0}</div><div class="help">Agrupación cronológica dentro de este plan.</div></section></div>`;
};

function opsHeatSelectionActive(){return (opsViewState.days||[]).length===1&&!!opsViewState.timeFrom&&!!opsViewState.timeTo;}
function clearHeatSelection(){opsViewState.days=[];opsViewState.timeFrom='';opsViewState.timeTo='';render();}
applyHeatCell=function(day,hour){
  day=Number(day);hour=Number(hour);
  const from=`${String(hour).padStart(2,'0')}:00`,to=`${String(hour).padStart(2,'0')}:59`;
  const same=(opsViewState.days||[]).length===1&&Number(opsViewState.days[0])===day&&opsViewState.timeFrom===from&&opsViewState.timeTo===to;
  if(same)return clearHeatSelection();
  opsViewState.days=[day];opsViewState.timeFrom=from;opsViewState.timeTo=to;render();
};

function opsDimensionFilterValue(dim){
  if(dim==='setup')return opsViewState.setup||'';
  if(dim==='vd')return opsViewState.vd||'';
  if(dim==='nr')return opsViewState.nr||'';
  if(dim==='hypothesis')return opsViewState.hypothesis||'';
  if(dim==='strategy')return opsViewState.risk||'';
  if(dim==='direction')return opsViewState.direction||'';
  if(dim==='contract')return opsViewState.contract||'';
  if(dim==='source')return opsViewState.source||'';
  if(dim==='result')return opsViewState.result||'';
  if(dim==='month')return opsViewState.year&&opsViewState.month?`${opsViewState.year}-${String(opsViewState.month).padStart(2,'0')}`:'';
  return '';
}
function clearDimensionSelection(dim){
  if(dim==='setup')opsViewState.setup='';
  else if(dim==='vd')opsViewState.vd='';
  else if(dim==='nr')opsViewState.nr='';
  else if(dim==='hypothesis')opsViewState.hypothesis='';
  else if(dim==='strategy')opsViewState.risk='';
  else if(dim==='direction')opsViewState.direction='';
  else if(dim==='contract')opsViewState.contract='';
  else if(dim==='source')opsViewState.source='';
  else if(dim==='result')opsViewState.result='';
  else if(dim==='month'){opsViewState.year='';opsViewState.month='';}
  render();
}
applyDimensionFilter=function(dim,val){
  if(String(opsDimensionFilterValue(dim))===String(val))return clearDimensionSelection(dim);
  if(dim==='setup')opsViewState.setup=val;else if(dim==='vd')opsViewState.vd=val;else if(dim==='nr')opsViewState.nr=val;else if(dim==='hypothesis')opsViewState.hypothesis=val;else if(dim==='strategy')opsViewState.risk=val;else if(dim==='direction')opsViewState.direction=val;else if(dim==='contract')opsViewState.contract=val;else if(dim==='source')opsViewState.source=val;else if(dim==='result')opsViewState.result=val;else if(dim==='month'){const [y,m]=String(val).split('-');opsViewState.year=y;opsViewState.month=String(Number(m));}
  render();
};

heatmapModule=function(ops){
  if(!ops.length)return `<section class="card panel analytics-module wide-module"><div class="panel-title"><div><h3>Mapa de calor · día × hora</h3><small>Expectancy; pulsa una celda para filtrar</small></div>${opsHeatSelectionActive()?'<button class="btn small ghost chart-reset" onclick="clearHeatSelection()">Restablecer selección</button>':''}</div><div class="empty">Sin datos para construir el mapa de calor.</div></section>`;
  const hours=uniqueSorted(ops.map(o=>new Date(o.entryDate).getHours())).map(Number).sort((a,b)=>a-b),days=uniqueSorted(ops.map(o=>new Date(o.entryDate).getDay())).map(Number).sort((a,b)=>((a+6)%7)-((b+6)%7));let maxAbs=0;const cells={};
  days.forEach(d=>hours.forEach(h=>{const subset=ops.filter(o=>{const dt=new Date(o.entryDate);return dt.getDay()===d&&dt.getHours()===h;}),s=calcMetricStats(subset,opsViewState.unit,opsViewState.basis);cells[`${d}-${h}`]=s;maxAbs=Math.max(maxAbs,Math.abs(s.expectancy));}));maxAbs=maxAbs||1;
  return `<section class="card panel analytics-module wide-module"><div class="panel-title"><div><h3>Mapa de calor · día × hora</h3><small>${opsHeatSelectionActive()?'Celda aislada · vuelve a pulsarla o usa Restablecer selección':'Expectancy; pulsa una celda para aislarla'}</small></div><div class="panel-tools"><span>${metricUnitLabel(opsViewState.unit)}</span>${opsHeatSelectionActive()?'<button class="btn small ghost chart-reset" onclick="clearHeatSelection()">Restablecer selección</button>':''}</div></div><div class="heat-wrap"><table class="heat-table"><thead><tr><th></th>${hours.map(h=>`<th>${String(h).padStart(2,'0')}:00</th>`).join('')}</tr></thead><tbody>${days.map(d=>`<tr><th>${DOW_LABELS[d]}</th>${hours.map(h=>{const s=cells[`${d}-${h}`],v=s.expectancy,a=Math.min(.65,.10+Math.abs(v)/maxAbs*.55),bg=v>0?`rgba(124,240,196,${a})`:v<0?`rgba(255,123,138,${a})`:'rgba(255,255,255,.03)',selected=opsHeatSelectionActive()&&Number(opsViewState.days[0])===d&&opsViewState.timeFrom===`${String(h).padStart(2,'0')}:00`;return `<td class="${selected?'chart-cell-selected':''}" onclick="applyHeatCell(${d},${h})" style="background:${bg}" title="${s.n} operaciones · ${metricStatText(v,opsViewState.unit)}"><strong>${s.n?metricStatText(v,opsViewState.unit):'—'}</strong><small>${s.n} op.</small></td>`}).join('')}</tr>`).join('')}</tbody></table></div></section>`;
};

breakdownModule=function(ops){
  const dim=opsViewState.dimension||'setup',activeValue=opsDimensionFilterValue(dim),groups=new Map();
  ops.forEach(o=>{const x=dimensionItem(o,dim);if(!groups.has(x.key))groups.set(x.key,{key:x.key,label:x.label,ops:[]});groups.get(x.key).ops.push(o);});
  const rows=[...groups.values()].map(g=>({...g,stats:calcMetricStats(g.ops,opsViewState.unit,opsViewState.basis)})).sort((a,b)=>b.stats.expectancy-a.stats.expectancy).slice(0,14),maxAbs=Math.max(...rows.map(r=>Math.abs(r.stats.expectancy)),1);
  return `<section class="card panel analytics-module"><div class="panel-title"><div><h3>Desglose interactivo</h3><small>${activeValue?'Categoría aislada · vuelve a pulsarla o restablécela':'Pulsa una categoría para convertirla en filtro'}</small></div><div class="panel-tools"><select id="filterDimension" class="select compact-select" onchange="setOpsDimension(this.value)">${[['setup','Setup'],['vd','VD'],['nr','NR'],['hypothesis','Hipótesis'],['strategy','Estrategia'],['direction','Dirección'],['contract','Contrato'],['source','Origen'],['result','Resultado'],['month','Mes']].map(([v,l])=>`<option value="${v}" ${dim===v?'selected':''}>${l}</option>`).join('')}</select>${activeValue?`<button class="btn small ghost chart-reset" onclick="clearDimensionSelection('${dim}')">Restablecer</button>`:''}</div></div><div class="breakdown-list">${rows.length?rows.map(r=>`<button class="breakdown-row ${String(activeValue)===String(r.key)?'chart-row-selected':''}" onclick="applyDimensionFilter('${dim}',decodeURIComponent('${encodeURIComponent(String(r.key))}'))"><span class="break-label">${esc(r.label)}</span><span class="break-track"><i class="${r.stats.expectancy>=0?'pos':'neg'}" style="width:${Math.max(4,Math.abs(r.stats.expectancy)/maxAbs*100)}%"></i></span><span>${r.stats.n} op.</span><strong>${metricStatText(r.stats.expectancy,opsViewState.unit)}</strong><em>${pct(r.stats.winRate)}</em></button>`).join(''):'<div class="empty">Sin categorías.</div>'}</div></section>`;
};

const shellV113Base=shell;
shell=function(){
  return shellV113Base()
    .replace(V112_APP_LABEL,V113_APP_LABEL)
    .replace('Motor cloud V9.2 Conflict Guard intacto. Biblioteca Simple + Laboratorio, con legibilidad mejorada y color de signos existentes.','Motor cloud V9.2 Conflict Guard intacto. Dashboard multiuidad y selecciones gráficas reversibles sobre la misma base estable.');
};
Object.assign(window,{setDashboardUnit,applyHeatCell,clearHeatSelection,applyDimensionFilter,clearDimensionSelection});
render();
/* ===== END V11.3 PATCH ===== */

/* ===== V11.4 PATCH · Dashboard unidades visibles + reset Laboratorio ===== */
const V114_APP_LABEL='V11.4 · Unidades + Reset Lab';
window.__trDashboardUnit=window.__trDashboardUnit||dashboardViewState?.unit||'r';
let labInteractionState={focusStress:null,behavior:null,rBin:null,edge:null};

setDashboardUnit=function(unit){
  const next=['r','ticks','usd'].includes(unit)?unit:'r';
  window.__trDashboardUnit=next;
  if(typeof dashboardViewState==='object'&&dashboardViewState) dashboardViewState.unit=next;
  render();
};

function dashboardEquitySvgV114(values,unit,W=760,H=250){
  if(!values.length)return '<div class="empty">Registra o importa la primera operación de este plan para ver la curva de equity.</div>';
  const min=Math.min(...values,0),max=Math.max(...values,0),range=(max-min)||1,padL=54,padR=12,padT=16,padB=22;
  const X=i=>padL+(i/Math.max(values.length-1,1))*(W-padL-padR);
  const Y=v=>padT+(H-padT-padB)-((v-min)/range)*(H-padT-padB);
  const coords=values.map((v,i)=>`${X(i)},${Y(v)}`).join(' '),zeroY=Y(0),area=`${padL},${H-padB} ${coords} ${W-padR},${H-padB}`;
  const ticks=[max,(max+min)/2,min];
  return `<svg class="equity-svg dashboard-equity-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line class="axis" x1="${padL}" y1="${zeroY}" x2="${W-padR}" y2="${zeroY}"/><polygon class="area" points="${area}"/><polyline class="line" points="${coords}"/>${ticks.map(v=>`<text class="dashboard-axis-text" x="${padL-8}" y="${Y(v)+4}" text-anchor="end">${esc(dashboardPlainMetric(v,unit))}</text>`).join('')}</svg>`;
}

dashboard=function(){
  const ops=currentOps(),baseStats=calcStats(ops),unit=['r','ticks','usd'].includes(window.__trDashboardUnit)?window.__trDashboardUnit:'r',metricStats=calcMetricStats(ops,unit,'gross'),bySetup={};
  ops.forEach(o=>bySetup[o.setup]=(bySetup[o.setup]||0)+1);
  const top=Object.entries(bySetup).sort((a,b)=>b[1]-a[1]).slice(0,6),maxCount=top[0]?.[1]||1;
  const svg=dashboardEquitySvgV114(metricStats.equity,unit),pf=Number.isFinite(metricStats.pf)?metricStats.pf.toFixed(2):'∞',mfe=dashboardExcursionAverage(ops,'mfe',unit),mae=dashboardExcursionAverage(ops,'mae',unit),unitLabel=metricUnitLabel(unit);
  const unitButtons=`<div class="metric-switch dashboard-unit-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${unit===v?'active':''}" type="button" onclick="window.setDashboardUnit('${v}')">${l}</button>`).join('')}</div>`;
  const actions=`${unitButtons}<button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button><button class="btn" onclick="openImportModal()">Importar Ankora</button>`;
  return `${pageHead('Dashboard','Vista del Trading Plan seleccionado. Cambia R, ticks o US$ sin alterar el dataset.',actions)}${activePlanBanner()}<div class="kpis">${kpi('Operaciones',baseStats.n,'plan activo')}${kpi('Win rate',pct(baseStats.winRate),'resultado cerrado')}${kpi('Expectancy',dashboardSignedMetric(metricStats.expectancy,unit),`por operación · ${unitLabel}`)}${kpi('Profit Factor',pf,'ganancia / pérdida')}${kpi('Drawdown',dashboardPlainMetric(metricStats.maxDD,unit),`máximo · ${unitLabel}`)}${kpi('Bloques',Math.ceil(baseStats.n/20),'de 20 operaciones')}</div><div class="grid two"><section class="card panel"><div class="panel-title dashboard-equity-title"><div><h3>Equity en ${unitLabel}</h3><small>Curva acumulada expresada realmente en ${unitLabel}</small></div><div class="panel-tools">${unitButtons}<strong>${baseStats.n?`${dashboardSignedMetric(metricStats.sum,unit)} acumulado`:'sin datos'}</strong></div></div><div class="chart-wrap">${svg}</div></section><section class="card panel"><div class="panel-title"><h3>Operaciones por setup</h3><span>${esc(planLabel(getCurrentPlan()))}</span></div><div class="bar-list">${top.length?top.map(([k,v])=>`<div class="bar-row"><div>${esc(k||'Sin setup')}</div><div class="bar"><span style="width:${(v/maxCount)*100}%"></span></div><div class="value-right">${v}</div></div>`).join(''):'<div class="empty">Aún no hay operaciones.</div>'}</div></section></div><div class="grid three" style="margin-top:16px"><section class="card panel"><div class="panel-title"><h3>MFE medio</h3><span>${unitLabel}</span></div><div class="kpi value">${dashboardPlainMetric(mfe,unit)}</div><div class="help">Potencial favorable y salidas.</div></section><section class="card panel"><div class="panel-title"><h3>MAE medio</h3><span>${unitLabel}</span></div><div class="kpi value">${dashboardPlainMetric(mae,unit)}</div><div class="help">Excursión adversa y stops.</div></section><section class="card panel"><div class="panel-title"><h3>Bloque actual</h3><span>20 trades</span></div><div class="kpi value">${baseStats.n?Math.floor((baseStats.n-1)/20)+1:0}</div><div class="help">Agrupación cronológica dentro de este plan.</div></section></div>`;
};

if(!('nr' in labState))labState.nr='';
if(!('hypothesis' in labState))labState.hypothesis='';
if(!('hour' in labState))labState.hour='';

function labDimStateValue(dim){
  if(dim==='strategy'){
    const p=getCurrentPlan(),r=(p?.riskStrategies||[]).find(x=>x.id===labState.risk);return r?.name||'';
  }
  return dim==='setup'?labState.setup||'':dim==='vd'?labState.vd||'':dim==='nr'?labState.nr||'':dim==='context'?labState.context||'':dim==='hypothesis'?labState.hypothesis||'':dim==='direction'?labState.direction||'':dim==='hour'?labState.hour||'':'';
}
function labSetDimState(dim,val){
  if(dim==='setup')labState.setup=val;else if(dim==='vd')labState.vd=val;else if(dim==='nr')labState.nr=val;else if(dim==='context')labState.context=val;else if(dim==='hypothesis')labState.hypothesis=val;else if(dim==='direction')labState.direction=val;else if(dim==='hour')labState.hour=val;else if(dim==='strategy'){
    const p=getCurrentPlan(),r=(p?.riskStrategies||[]).find(x=>x.name===val);labState.risk=r?.id||'';
  }
}
function labClearDimState(dim,expected){
  if(expected!==undefined&&String(labDimStateValue(dim))!==String(expected))return;
  if(dim==='setup')labState.setup='';else if(dim==='vd')labState.vd='';else if(dim==='nr')labState.nr='';else if(dim==='context')labState.context='';else if(dim==='hypothesis')labState.hypothesis='';else if(dim==='direction')labState.direction='';else if(dim==='hour')labState.hour='';else if(dim==='strategy')labState.risk='';
}
function labClearFocusStress(){const s=labInteractionState.focusStress;if(s){if(String(labState.focus)===String(s.focus))labState.focus='';if(String(labState.stress)===String(s.stress))labState.stress='';}else{labState.focus='';labState.stress='';}labInteractionState.focusStress=null;render();}
function labClearBehavior(){const v=labInteractionState.behavior;if(!v||String(labState.behavior)===String(v))labState.behavior='';labInteractionState.behavior=null;render();}
function labClearRBin(){const s=labInteractionState.rBin;if(!s||(String(labState.rMin)===String(s.a)&&String(labState.rMax)===String(s.z))){labState.rMin='';labState.rMax='';}labInteractionState.rBin=null;render();}
function labClearEdge(){const s=labInteractionState.edge;if(s){labClearDimState(s.xDim,s.xVal);labClearDimState(s.yDim,s.yVal);}labInteractionState.edge=null;render();}
function labClearGraphSelections(){
  const fs=labInteractionState.focusStress;if(fs){if(String(labState.focus)===String(fs.focus))labState.focus='';if(String(labState.stress)===String(fs.stress))labState.stress='';}
  const b=labInteractionState.behavior;if(b&&String(labState.behavior)===String(b))labState.behavior='';
  const rb=labInteractionState.rBin;if(rb&&String(labState.rMin)===String(rb.a)&&String(labState.rMax)===String(rb.z)){labState.rMin='';labState.rMax='';}
  const e=labInteractionState.edge;if(e){labClearDimState(e.xDim,e.xVal);labClearDimState(e.yDim,e.yVal);}
  labInteractionState={focusStress:null,behavior:null,rBin:null,edge:null};render();
}
function labHasGraphSelection(){return !!(labInteractionState.focusStress||labInteractionState.behavior||labInteractionState.rBin||labInteractionState.edge);}

const labResetV114Base=labReset;
labReset=function(){labInteractionState={focusStress:null,behavior:null,rBin:null,edge:null};labResetV114Base();labState.nr='';labState.hypothesis='';labState.hour='';};

labFilteredOps=function(){
  const f=labState;
  return currentOps().filter(o=>{
    const d=new Date(o.entryDate);if(isNaN(d))return false;const date=inputDateValue(d),hh=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),hour=`${String(d.getHours()).padStart(2,'0')}:00`;
    if(f.dateFrom&&date<f.dateFrom)return false;if(f.dateTo&&date>f.dateTo)return false;
    if(f.timeFrom&&f.timeTo){if(f.timeFrom<=f.timeTo){if(hh<f.timeFrom||hh>f.timeTo)return false;}else if(hh<f.timeFrom&&hh>f.timeTo)return false;}
    else if(f.timeFrom&&hh<f.timeFrom)return false;else if(f.timeTo&&hh>f.timeTo)return false;
    if(f.direction&&edgeDimensionValues(o,'direction')!==f.direction)return false;
    if(f.setup&&edgeDimensionValues(o,'setup')!==f.setup)return false;
    if(f.vd&&edgeDimensionValues(o,'vd')!==f.vd)return false;
    if(f.nr&&edgeDimensionValues(o,'nr')!==f.nr)return false;
    if(f.context&&edgeDimensionValues(o,'context')!==f.context)return false;
    if(f.hypothesis&&edgeDimensionValues(o,'hypothesis')!==f.hypothesis)return false;
    if(f.hour&&hour!==f.hour)return false;
    if(f.risk&&o.riskStrategyId!==f.risk)return false;if(f.result&&o.result!==f.result)return false;
    if(f.behavior&&!(o.emotional?.behaviors||[]).includes(f.behavior))return false;if(f.emotion&&!labEmotionsOf(o).includes(f.emotion))return false;
    if(f.focus&&String(o.emotional?.focus||'')!==String(f.focus))return false;if(f.stress&&String(o.emotional?.stress||'')!==String(f.stress))return false;
    const rv=opMetricValue(o,'r',f.basis);if(f.rMin!==''&&rv<Number(f.rMin))return false;if(f.rMax!==''&&rv>Number(f.rMax))return false;
    return true;
  }).sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));
};

labApplyFocusStress=function(focus,stress){
  const same=labInteractionState.focusStress&&String(labInteractionState.focusStress.focus)===String(focus)&&String(labInteractionState.focusStress.stress)===String(stress);
  if(same)return labClearFocusStress();
  labState.focus=String(focus);labState.stress=String(stress);labInteractionState.focusStress={focus:String(focus),stress:String(stress)};render();
};
labApplyBehavior=function(v){
  if(labInteractionState.behavior&&String(labInteractionState.behavior)===String(v))return labClearBehavior();
  labState.behavior=v;labInteractionState.behavior=v;render();
};
labApplyRBin=function(a,z){
  if(labInteractionState.rBin&&String(labInteractionState.rBin.a)===String(a)&&String(labInteractionState.rBin.z)===String(z))return labClearRBin();
  labState.rMin=String(a);labState.rMax=String(z);labInteractionState.rBin={a:String(a),z:String(z)};render();
};
labApplyEdge=function(xDim,xVal,yDim,yVal){
  const s=labInteractionState.edge,same=s&&s.xDim===xDim&&s.yDim===yDim&&String(s.xVal)===String(xVal)&&String(s.yVal)===String(yVal);
  if(same)return labClearEdge();
  if(s){labClearDimState(s.xDim,s.xVal);labClearDimState(s.yDim,s.yVal);}
  labSetDimState(xDim,xVal);labSetDimState(yDim,yVal);labInteractionState.edge={xDim,xVal,yDim,yVal};render();
};

labFocusStressHeatmap=function(ops){
  const cells={};let maxAbs=0;for(let stress=1;stress<=5;stress++)for(let focus=1;focus<=5;focus++){const subset=ops.filter(o=>Number(o.emotional?.focus)===focus&&Number(o.emotional?.stress)===stress),v=labMetric(subset);cells[`${focus}-${stress}`]={subset,v};maxAbs=Math.max(maxAbs,Math.abs(v));}
  const active=labInteractionState.focusStress;
  return `<section class="card panel lab-module lab-span-2"><div class="panel-title"><div><h3>Heatmap · Foco × Estrés</h3><small>${active?'Selección aislada · pulsa de nuevo la celda o Restablecer':'Color = '+(labState.heatMetric==='expectancy'?'Expectancy promedio':labState.heatMetric==='winrate'?'Win rate':labState.heatMetric==='pf'?'Profit Factor':'Resultado total')+' · cada celda muestra n'}</small></div><div class="panel-tools"><select class="select compact-select" onchange="setLabHeatMetric(this.value)">${[['expectancy','Expectancy'],['winrate','Win rate'],['pf','Profit Factor'],['sum','Resultado total']].map(([v,l])=>`<option value="${v}" ${labState.heatMetric===v?'selected':''}>${l}</option>`).join('')}</select>${active?'<button class="btn small ghost chart-reset" onclick="labClearFocusStress()">Restablecer</button>':''}</div></div><div class="behavior-heat-layout"><div class="heat-y-label">Estrés ↑</div><table class="behavior-heat"><thead><tr><th></th>${[1,2,3,4,5].map(f=>`<th>Foco ${f}</th>`).join('')}</tr></thead><tbody>${[5,4,3,2,1].map(st=>`<tr><th>${st}</th>${[1,2,3,4,5].map(f=>{const c=cells[`${f}-${st}`],n=c.subset.length,sel=active&&String(active.focus)===String(f)&&String(active.stress)===String(st);return `<td class="${sel?'lab-selected-cell':''}" style="background:${labHeatColor(c.v,maxAbs)}" onclick="labApplyFocusStress(${f},${st})" title="Foco ${f} · Estrés ${st} · ${n} operaciones"><strong>${n?labMetricText(c.v):'—'}</strong><small>n=${n}</small></td>`}).join('')}</tr>`).join('')}</tbody></table><div class="heat-x-label">Nivel de foco →</div></div><div class="lab-note">Las celdas con pocas operaciones son exploratorias. El tamaño de muestra <strong>n</strong> evita interpretar un valor extremo basado en 1–2 trades.</div></section>`;
};

labBehaviorPenalties=function(ops){
  const map=new Map();ops.forEach(o=>{const loss=Math.min(0,opMetricValue(o,'usd','net'));if(loss>=0)return;(o.emotional?.behaviors||[]).forEach(b=>{if(!map.has(b))map.set(b,{name:b,loss:0,n:0});const x=map.get(b);x.loss+=Math.abs(loss);x.n++;});});
  const rows=[...map.values()].sort((a,b)=>b.loss-a.loss),max=rows[0]?.loss||1,active=labInteractionState.behavior;
  return `<section class="card panel lab-module"><div class="panel-title"><div><h3>Penalizaciones conductuales</h3><small>Pérdida neta asociada en US$ · mayor → menor</small></div><div class="panel-tools"><span>${rows.length} conductas</span>${active?'<button class="btn small ghost chart-reset" onclick="labClearBehavior()">Restablecer</button>':''}</div></div>${rows.length?`<div class="penalty-bars">${rows.map(r=>`<button class="penalty-row ${active===r.name?'lab-selected-row':''}" onclick="labApplyBehavior(decodeURIComponent('${encodeURIComponent(r.name)}'))"><span class="penalty-name">${esc(r.name)}</span><span class="penalty-track"><i style="width:${Math.max(4,r.loss/max*100)}%"></i></span><strong>−${r.loss.toFixed(2)} US$</strong><small>${r.n} casos · −${(r.loss/r.n).toFixed(2)}/caso</small></button>`).join('')}</div>`:'<div class="empty">No hay operaciones perdedoras con comportamientos etiquetados.</div>'}<div class="lab-note warn">Esta cifra es <strong>pérdida asociada</strong>, no causalidad demostrada. Si un trade tiene varios comportamientos, su pérdida aparece en cada etiqueta.</div></section>`;
};

labRiskHistogram=function(ops){
  const step=Number(labState.histBin)||.25,bins=histogramBinsR(ops,step),top=Math.max(...bins.map(b=>b.n),1),losses=ops.map(o=>opMetricValue(o,'r',labState.basis)).filter(v=>v<0),normal=losses.filter(v=>v>=-1.1&&v<=-.9).length,exceeded=losses.filter(v=>v<-1.1).length,early=losses.filter(v=>v>-.9&&v<0).length,active=labInteractionState.rBin;
  const pctN=n=>losses.length?`${(n/losses.length*100).toFixed(1)}%`:'0.0%';
  return `<section class="card panel lab-module"><div class="panel-title"><div><h3>Distribución de riesgo</h3><small>${active?'Rango aislado · pulsa de nuevo la barra o Restablecer':'Resultados agrupados en fracciones de R'}</small></div><div class="panel-tools"><select class="select compact-select" onchange="setLabHistBin(this.value)">${[.25,.5,1].map(v=>`<option value="${v}" ${step===v?'selected':''}>${v}R / bin</option>`).join('')}</select>${active?'<button class="btn small ghost chart-reset" onclick="labClearRBin()">Restablecer</button>':''}</div></div><div class="risk-diagnostic"><div><span>Stop ~1R</span><strong>${pctN(normal)}</strong><small>${normal}/${losses.length}</small></div><div><span>Stop excedido</span><strong class="negative">${pctN(exceeded)}</strong><small>&lt; −1.1R</small></div><div><span>Pérdida cortada antes</span><strong>${pctN(early)}</strong><small>−0.9R → 0R</small></div></div>${bins.length?`<div class="r-hist-wrap"><div class="r-marker-labels"><span>−1R</span><span>0R</span><span>+1R</span><span>+2R</span></div><div class="r-histogram">${bins.map(b=>{const sel=active&&String(active.a)===String(b.a)&&String(active.z)===String(b.z);return `<button class="r-hist-col ${b.z<=0?'neg':b.a>=0?'pos':'mix'} ${sel?'lab-selected-bar':''}" onclick="labApplyRBin(${b.a},${b.z})" title="${b.a.toFixed(2)}R → ${b.z.toFixed(2)}R · ${b.n} operaciones"><span class="r-hist-bar" style="height:${Math.max(3,b.n/top*100)}%"><b>${b.n||''}</b></span><small>${((b.a+b.z)/2).toFixed(2)}</small></button>`}).join('')}</div></div>`:'<div class="empty">Sin datos de R.</div>'}<div class="lab-note">Pulsa una barra para filtrar ese rango de R en todo el Laboratorio.</div></section>`;
};

labEdgeMatrix=function(ops){
  const xD=labState.edgeX,yD=labState.edgeY,dimOpts=[['setup','Setup'],['context','Contexto'],['vd','VD'],['nr','NR'],['hypothesis','Hipótesis'],['strategy','Estrategia'],['direction','Dirección'],['hour','Hora']];
  let xs=uniqueSorted(ops.map(o=>edgeDimensionValues(o,xD))),ys=uniqueSorted(ops.map(o=>edgeDimensionValues(o,yD)));if(xs.length>10)xs=xs.slice(0,10);if(ys.length>10)ys=ys.slice(0,10);let maxAbs=0;const cells={},active=labInteractionState.edge;ys.forEach(y=>xs.forEach(x=>{const sub=ops.filter(o=>edgeDimensionValues(o,xD)===x&&edgeDimensionValues(o,yD)===y),s=calcMetricStats(sub,labState.unit,labState.basis);cells[`${x}|||${y}`]=s;maxAbs=Math.max(maxAbs,Math.abs(s.expectancy));}));
  return `<section class="card panel lab-module lab-span-2"><div class="panel-title"><div><h3>Matriz de Edge</h3><small>${active?'Combinación aislada · pulsa de nuevo la celda o Restablecer':'Expectancy por combinación · pulsa una celda para filtrar'}</small></div><div class="edge-controls"><select class="select compact-select" onchange="setLabEdgeAxis('x',this.value)">${dimOpts.map(([v,l])=>`<option value="${v}" ${xD===v?'selected':''}>X: ${l}</option>`).join('')}</select><select class="select compact-select" onchange="setLabEdgeAxis('y',this.value)">${dimOpts.map(([v,l])=>`<option value="${v}" ${yD===v?'selected':''}>Y: ${l}</option>`).join('')}</select>${active?'<button class="btn small ghost chart-reset" onclick="labClearEdge()">Restablecer</button>':''}</div></div>${xs.length&&ys.length?`<div class="edge-matrix-wrap"><table class="edge-matrix"><thead><tr><th>${esc(edgeDimLabel(yD))} \\ ${esc(edgeDimLabel(xD))}</th>${xs.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${ys.map(y=>`<tr><th>${esc(y)}</th>${xs.map(x=>{const s=cells[`${x}|||${y}`],sel=active&&active.xDim===xD&&active.yDim===yD&&String(active.xVal)===String(x)&&String(active.yVal)===String(y);return `<td class="${sel?'lab-selected-cell':''}" style="background:${labHeatColor(s.expectancy,maxAbs)}" onclick="labApplyEdge('${xD}',decodeURIComponent('${encodeURIComponent(x)}'),'${yD}',decodeURIComponent('${encodeURIComponent(y)}'))"><strong>${s.n?metricStatText(s.expectancy,labState.unit):'—'}</strong><small>n=${s.n}</small></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">No hay categorías suficientes para construir la matriz.</div>'}</section>`;
};

const labFilterPanelV114Base=labFilterPanel;
labFilterPanel=function(){
  let html=labFilterPanelV114Base();
  if(labHasGraphSelection())html=html.replace('<button class="btn small" onclick="labReset()">Limpiar estudio</button>','<button class="btn small" onclick="labReset()">Limpiar estudio</button><button class="btn small ghost chart-reset" onclick="labClearGraphSelections()">Restablecer selecciones de gráficos</button>');
  return html;
};

const shellV114Base=shell;
shell=function(){return shellV114Base().replace(V113_APP_LABEL,V114_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Dashboard multiuidad y selecciones gráficas reversibles sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Dashboard con unidades visibles y Laboratorio con selecciones reversibles.');};
Object.assign(window,{setDashboardUnit,labApplyFocusStress,labApplyBehavior,labApplyRBin,labApplyEdge,labClearFocusStress,labClearBehavior,labClearRBin,labClearEdge,labClearGraphSelections,labReset});
render();
/* ===== END V11.4 PATCH ===== */

/* V11.4 hotfix interno: reset y cambios de ejes/bin limpian la selección gráfica asociada antes de renderizar. */
labReset=function(){
  const keep={unit:labState.unit,basis:labState.basis,heatMetric:labState.heatMetric,scatterX:labState.scatterX,histBin:labState.histBin,edgeX:labState.edgeX,edgeY:labState.edgeY,rollingWindow:labState.rollingWindow,rollingMetric:labState.rollingMetric};
  labState={...keep,dateFrom:'',dateTo:'',timeFrom:'',timeTo:'',direction:'',setup:'',vd:'',nr:'',context:'',hypothesis:'',hour:'',risk:'',result:'',behavior:'',emotion:'',focus:'',stress:'',rMin:'',rMax:''};
  labInteractionState={focusStress:null,behavior:null,rBin:null,edge:null};render();
};
setLabHistBin=function(v){
  if(labInteractionState.rBin){labState.rMin='';labState.rMax='';labInteractionState.rBin=null;}
  labState.histBin=Number(v)||0.25;render();
};
setLabEdgeAxis=function(axis,v){
  const s=labInteractionState.edge;if(s){labClearDimState(s.xDim,s.xVal);labClearDimState(s.yDim,s.yVal);labInteractionState.edge=null;}
  if(axis==='x')labState.edgeX=v;else labState.edgeY=v;render();
};
Object.assign(window,{labReset,setLabHistBin,setLabEdgeAxis});
/* fin hotfix interno V11.4 */

/* ===== V11.5 PATCH · Apariencia Claro / Oscuro ===== */
const V115_APP_LABEL='V11.5 · Claro / Oscuro';
const TR_THEME_KEY='trading-research-ui-theme-v1';
let appTheme='dark';
try{appTheme=localStorage.getItem(TR_THEME_KEY)==='light'?'light':'dark';}catch{}

function applyAppTheme(theme,{rerender=false}={}){
  appTheme=theme==='light'?'light':'dark';
  document.documentElement.setAttribute('data-theme',appTheme);
  document.documentElement.style.colorScheme=appTheme;
  try{localStorage.setItem(TR_THEME_KEY,appTheme);}catch{}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',appTheme==='light'?'#f6f8fb':'#0b1020');
  if(rerender)render();
}
function setAppTheme(theme){applyAppTheme(theme,{rerender:true});}
function themeSwitchHtml(){
  return `<div class="theme-switch"><div class="theme-switch-label">Apariencia</div><div class="theme-switch-buttons"><button class="theme-btn ${appTheme==='dark'?'active':''}" onclick="setAppTheme('dark')" title="Usar fondos oscuros"><span aria-hidden="true">◐</span> Oscuro</button><button class="theme-btn ${appTheme==='light'?'active':''}" onclick="setAppTheme('light')" title="Usar fondos claros"><span aria-hidden="true">☀</span> Claro</button></div></div>`;
}

/* El color neutro de las matrices se adapta al fondo; verde/rojo conservan significado. */
labHeatColor=function(v,maxAbs){
  if(!Number.isFinite(v)||v===0)return appTheme==='light'?'rgba(42,63,90,.045)':'rgba(255,255,255,.025)';
  const a=Math.min(appTheme==='light'?.48:.72,(appTheme==='light'?.09:.12)+Math.abs(v)/(maxAbs||1)*(appTheme==='light'?.39:.6));
  return v>0?`rgba(31,176,125,${a})`:`rgba(224,69,91,${a})`;
};

const shellV115Base=shell;
shell=function(){
  let html=shellV115Base()
    .replace(V114_APP_LABEL,V115_APP_LABEL)
    .replace('Motor cloud V9.2 Conflict Guard intacto. Dashboard con unidades visibles y Laboratorio con selecciones reversibles.','Motor cloud V9.2 Conflict Guard intacto. Apariencia claro/oscuro local, sin tocar datos ni sincronización.');
  return html.replace('<nav class="nav">',themeSwitchHtml()+'<nav class="nav">');
};

Object.assign(window,{setAppTheme});
applyAppTheme(appTheme,{rerender:false});
render();
/* ===== END V11.5 PATCH ===== */

/* ===== V12 PATCH · Research Grid / Pivot Analytics ===== */
const V12_APP_LABEL='V12 · Research Grid';

let researchGridState={
  rowDim:'setup',
  colDim:'context',
  metric:'expectancy',
  minN:1,
  maxCats:12,
  selection:null
};

const RESEARCH_DIMS=[
  ['setup','Setup'],
  ['context','Contexto'],
  ['vd','VD'],
  ['nr','NR'],
  ['hypothesis','Hipótesis'],
  ['strategy','Estrategia'],
  ['direction','Dirección'],
  ['hour','Hora'],
  ['behavior','Comportamiento'],
  ['emotion','Emoción'],
  ['focus','Foco'],
  ['stress','Estrés']
];
const RESEARCH_METRICS=[
  ['expectancy','Expectancy'],
  ['sum','Resultado total'],
  ['winrate','Win rate'],
  ['pf','Profit Factor'],
  ['n','N.º operaciones'],
  ['avgWin','Media ganadora'],
  ['avgLoss','Media perdedora'],
  ['maxDD','Max drawdown']
];

function researchDimLabel(dim){return RESEARCH_DIMS.find(x=>x[0]===dim)?.[1]||dim;}
function researchDimValues(o,dim){
  if(dim==='behavior')return [...new Set((o.emotional?.behaviors||[]).filter(Boolean).map(String))];
  if(dim==='emotion')return [...new Set(labEmotionsOf(o).filter(Boolean).map(String))];
  if(dim==='focus'){const v=o.emotional?.focus;return v===undefined||v===null||v===''?[]:[String(v)];}
  if(dim==='stress'){const v=o.emotional?.stress;return v===undefined||v===null||v===''?[]:[String(v)];}
  if(dim==='strategy'){
    const name=String(o.riskStrategyName||'').trim();
    if(name)return [name];
    const p=getCurrentPlan(),r=(p?.riskStrategies||[]).find(x=>x.id===o.riskStrategyId);
    return r?.name?[String(r.name)]:[];
  }
  return [String(edgeDimensionValues(o,dim)||'—')];
}
function researchDisplayValue(dim,val){
  if(dim==='focus')return `Foco ${val}`;
  if(dim==='stress')return `Estrés ${val}`;
  return String(val);
}
function researchLabField(dim){
  return ({setup:'setup',context:'context',vd:'vd',nr:'nr',hypothesis:'hypothesis',strategy:'risk',direction:'direction',hour:'hour',behavior:'behavior',emotion:'emotion',focus:'focus',stress:'stress'})[dim]||'';
}
function researchCurrentDimValue(dim){
  if(dim==='strategy'){
    const p=getCurrentPlan(),r=(p?.riskStrategies||[]).find(x=>x.id===labState.risk);
    return r?.name||'';
  }
  const field=researchLabField(dim);return field?String(labState[field]??''):'';
}
function researchSetLabDim(dim,val){
  const field=researchLabField(dim);if(!field)return false;
  if(dim==='strategy'){
    const p=getCurrentPlan(),r=(p?.riskStrategies||[]).find(x=>String(x.name)===String(val));
    if(!r)return false;labState.risk=r.id;return true;
  }
  labState[field]=String(val);return true;
}
function researchRestoreSelectionInternal(){
  const s=researchGridState.selection;if(!s)return;
  const dims=[...new Set([s.rowDim,s.colDim])];
  dims.forEach(dim=>{
    const selected=dim===s.rowDim?s.rowVal:s.colVal;
    if(String(researchCurrentDimValue(dim))!==String(selected))return;
    const field=researchLabField(dim);if(field)labState[field]=s.previous?.[field]??'';
  });
  researchGridState.selection=null;
}
function researchSelectionStillApplied(){
  const s=researchGridState.selection;if(!s)return false;
  const ok=String(researchCurrentDimValue(s.rowDim))===String(s.rowVal)&&String(researchCurrentDimValue(s.colDim))===String(s.colVal);
  if(!ok)researchGridState.selection=null;
  return ok;
}
function researchApplyCell(rowDim,rowVal,colDim,colVal){
  const s=researchGridState.selection;
  if(s&&s.rowDim===rowDim&&s.colDim===colDim&&String(s.rowVal)===String(rowVal)&&String(s.colVal)===String(colVal)){
    researchRestoreSelectionInternal();render();return;
  }
  researchRestoreSelectionInternal();
  const previous={};
  [...new Set([rowDim,colDim])].forEach(dim=>{const f=researchLabField(dim);if(f)previous[f]=labState[f]??'';});
  if(!researchSetLabDim(rowDim,rowVal)||!researchSetLabDim(colDim,colVal)){
    Object.entries(previous).forEach(([k,v])=>labState[k]=v);
    researchGridState.selection=null;render();return;
  }
  researchGridState.selection={rowDim,rowVal:String(rowVal),colDim,colVal:String(colVal),previous};
  render();
}
function researchClearSelection(){researchRestoreSelectionInternal();render();}
function setResearchGridDim(axis,val){
  researchRestoreSelectionInternal();
  if(axis==='row'){
    const old=researchGridState.rowDim;
    if(val===researchGridState.colDim)researchGridState.colDim=old;
    researchGridState.rowDim=val;
  }else{
    const old=researchGridState.colDim;
    if(val===researchGridState.rowDim)researchGridState.rowDim=old;
    researchGridState.colDim=val;
  }
  render();
}
function swapResearchGridAxes(){researchRestoreSelectionInternal();const x=researchGridState.rowDim;researchGridState.rowDim=researchGridState.colDim;researchGridState.colDim=x;render();}
function setResearchGridMetric(v){researchGridState.metric=v;render();}
function setResearchGridMinN(v){researchGridState.minN=Math.max(1,Number(v)||1);render();}
function setResearchGridMaxCats(v){researchGridState.maxCats=Math.max(4,Number(v)||12);render();}

function researchCategoryCounts(ops,dim){
  const m=new Map();
  ops.forEach(o=>[...new Set(researchDimValues(o,dim))].forEach(v=>m.set(v,(m.get(v)||0)+1)));
  return [...m.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'es')).slice(0,researchGridState.maxCats).map(x=>x[0]);
}
function researchSubset(ops,rowDim,rowVal,colDim,colVal){
  return ops.filter(o=>researchDimValues(o,rowDim).includes(String(rowVal))&&researchDimValues(o,colDim).includes(String(colVal)));
}
function researchMetricValue(stats,metric=researchGridState.metric){
  if(metric==='sum')return stats.sum;
  if(metric==='winrate')return stats.winRate;
  if(metric==='pf')return stats.pf;
  if(metric==='n')return stats.n;
  if(metric==='avgWin')return stats.avgWin;
  if(metric==='avgLoss')return stats.avgLoss;
  if(metric==='maxDD')return stats.maxDD;
  return stats.expectancy;
}
function researchMetricText(stats,metric=researchGridState.metric){
  const v=researchMetricValue(stats,metric);
  if(metric==='n')return String(stats.n);
  if(metric==='winrate')return `${Number(v||0).toFixed(1)}%`;
  if(metric==='pf')return Number.isFinite(v)?Number(v||0).toFixed(2):(stats.n?'∞':'—');
  return metricStatText(v,labState.unit);
}
function researchColorScore(stats,metric=researchGridState.metric){
  if(!stats.n)return null;
  if(metric==='pf')return Number.isFinite(stats.pf)?stats.pf-1:2;
  if(metric==='winrate'||metric==='n')return null;
  return Number(researchMetricValue(stats,metric))||0;
}
function researchNeutralCellColor(v,max){
  const ratio=Math.min(1,Math.max(0,Number(v||0))/(max||1));
  const a=(appTheme==='light'?.05:.06)+ratio*(appTheme==='light'?.17:.20);
  return `rgba(47,111,237,${a})`;
}
function researchCellColor(stats,maxScore,maxNeutral){
  if(!stats.n)return '';
  if(researchGridState.metric==='n')return researchNeutralCellColor(stats.n,maxNeutral);
  if(researchGridState.metric==='winrate')return researchNeutralCellColor(stats.winRate,100);
  const score=researchColorScore(stats);return labHeatColor(score,maxScore||1);
}
function researchGridModule(ops){
  const rowDim=researchGridState.rowDim,colDim=researchGridState.colDim,metric=researchGridState.metric,minN=researchGridState.minN;
  const active=researchSelectionStillApplied()?researchGridState.selection:null;
  const rows=researchCategoryCounts(ops,rowDim),cols=researchCategoryCounts(ops,colDim);
  const cells={},rowTotals={},colTotals={};let maxScore=0,maxNeutral=1;
  rows.forEach(r=>{
    const sub=ops.filter(o=>researchDimValues(o,rowDim).includes(String(r)));rowTotals[r]=calcMetricStats(sub,labState.unit,labState.basis);
  });
  cols.forEach(c=>{
    const sub=ops.filter(o=>researchDimValues(o,colDim).includes(String(c)));colTotals[c]=calcMetricStats(sub,labState.unit,labState.basis);
  });
  rows.forEach(r=>cols.forEach(c=>{
    const s=calcMetricStats(researchSubset(ops,rowDim,r,colDim,c),labState.unit,labState.basis);cells[`${r}|||${c}`]=s;
    const score=researchColorScore(s);if(score!==null&&Number.isFinite(score))maxScore=Math.max(maxScore,Math.abs(score));maxNeutral=Math.max(maxNeutral,s.n);
  }));
  maxScore=maxScore||1;
  const global=calcMetricStats(ops,labState.unit,labState.basis);
  const dimOptions=RESEARCH_DIMS.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('');
  const rowOptions=dimOptions.replace(`value="${rowDim}"`,`value="${rowDim}" selected`);
  const colOptions=dimOptions.replace(`value="${colDim}"`,`value="${colDim}" selected`);
  const metricOptions=RESEARCH_METRICS.map(([v,l])=>`<option value="${v}" ${metric===v?'selected':''}>${esc(l)}</option>`).join('');
  const controls=`<div class="research-grid-controls"><label><span>Filas</span><select class="select compact-select" onchange="setResearchGridDim('row',this.value)">${rowOptions}</select></label><button class="btn small ghost research-swap" onclick="swapResearchGridAxes()" title="Intercambiar filas y columnas">⇄</button><label><span>Columnas</span><select class="select compact-select" onchange="setResearchGridDim('col',this.value)">${colOptions}</select></label><label><span>Métrica</span><select class="select compact-select" onchange="setResearchGridMetric(this.value)">${metricOptions}</select></label><label><span>Muestra mín.</span><select class="select compact-select" onchange="setResearchGridMinN(this.value)">${[1,3,5,10,20].map(v=>`<option value="${v}" ${minN===v?'selected':''}>n ≥ ${v}</option>`).join('')}</select></label><label><span>Máx. categorías</span><select class="select compact-select" onchange="setResearchGridMaxCats(this.value)">${[8,12,20].map(v=>`<option value="${v}" ${researchGridState.maxCats===v?'selected':''}>${v}</option>`).join('')}</select></label>${active?'<button class="btn small ghost chart-reset" onclick="researchClearSelection()">Restablecer selección</button>':''}</div>`;
  if(!rows.length||!cols.length)return `<section class="card panel lab-module lab-span-2 research-grid-module"><div class="panel-title"><div><h3>Research Grid</h3><small>Tabla dinámica multidimensional del subconjunto actual</small></div></div>${controls}<div class="empty">No hay categorías suficientes para estos ejes. Prueba con Setup, Contexto, VD o Dirección.</div></section>`;
  const head=cols.map(c=>`<th><span>${esc(researchDisplayValue(colDim,c))}</span><small>n=${colTotals[c]?.n||0}</small></th>`).join('');
  const body=rows.map(r=>`<tr><th class="research-row-head"><span>${esc(researchDisplayValue(rowDim,r))}</span><small>n=${rowTotals[r]?.n||0}</small></th>${cols.map(c=>{
    const s=cells[`${r}|||${c}`],low=s.n>0&&s.n<minN,selected=active&&active.rowDim===rowDim&&active.colDim===colDim&&String(active.rowVal)===String(r)&&String(active.colVal)===String(c),title=`${researchDimLabel(rowDim)}: ${researchDisplayValue(rowDim,r)} · ${researchDimLabel(colDim)}: ${researchDisplayValue(colDim,c)} · ${researchMetricText(s)} · n=${s.n}`;
    return `<td class="research-cell ${low?'low-sample':''} ${selected?'lab-selected-cell':''} ${s.n?'':'empty-cell'}" style="${s.n?`background:${researchCellColor(s,maxScore,maxNeutral)}`:''}" onclick="${s.n?`researchApplyCell('${rowDim}',decodeURIComponent('${encodeURIComponent(r)}'),'${colDim}',decodeURIComponent('${encodeURIComponent(c)}'))`:''}" title="${esc(title)}"><strong>${s.n?researchMetricText(s):'—'}</strong><small>n=${s.n}${low?' · baja':''}</small></td>`;
  }).join('')}<td class="research-total-cell"><strong>${researchMetricText(rowTotals[r])}</strong><small>Total fila</small></td></tr>`).join('');
  const foot=`<tr class="research-total-row"><th>Total columna</th>${cols.map(c=>`<td class="research-total-cell"><strong>${researchMetricText(colTotals[c])}</strong><small>n=${colTotals[c].n}</small></td>`).join('')}<td class="research-grand-total"><strong>${researchMetricText(global)}</strong><small>n=${global.n}</small></td></tr>`;
  const selectionNote=active?`<div class="research-selection-note"><strong>Selección activa:</strong> ${esc(researchDisplayValue(rowDim,active.rowVal))} × ${esc(researchDisplayValue(colDim,active.colVal))}. El resto del Laboratorio está calculado sobre esa combinación.</div>`:'';
  const tagNote=['behavior','emotion'].includes(rowDim)||['behavior','emotion'].includes(colDim)?'<div class="lab-note warn">Comportamiento y Emoción son etiquetas múltiples: una misma operación puede pertenecer a más de una categoría, aunque dentro de cada celda solo se cuenta una vez.</div>':'';
  return `<section class="card panel lab-module lab-span-2 research-grid-module"><div class="panel-title"><div><h3>Research Grid</h3><small>Pivot multidimensional · elige filas, columnas y métrica; usa la unidad/base global del Laboratorio</small></div><span>${ops.length} operaciones</span></div>${controls}${selectionNote}<div class="research-grid-wrap"><table class="research-grid-table"><thead><tr><th>${esc(researchDimLabel(rowDim))} \ ${esc(researchDimLabel(colDim))}</th>${head}<th>Total fila</th></tr></thead><tbody>${body}${foot}</tbody></table></div><div class="lab-note">Pulsa una celda para aislar esa combinación en todo el Laboratorio. Celdas con muestra inferior a <strong>n=${minN}</strong> se muestran atenuadas para evitar sobreinterpretarlas.</div>${tagNote}</section>`;
}

const labHasGraphSelectionV12Base=labHasGraphSelection;
labHasGraphSelection=function(){return researchSelectionStillApplied()||labHasGraphSelectionV12Base();};
const labClearGraphSelectionsV12Base=labClearGraphSelections;
labClearGraphSelections=function(){researchRestoreSelectionInternal();labClearGraphSelectionsV12Base();};
const labResetV12Base=labReset;
labReset=function(){researchGridState.selection=null;labResetV12Base();};

analyticsLab=function(){
  const p=getCurrentPlan(),ops=labFilteredOps();
  return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: comportamiento, excursiones, riesgo, estabilidad y reglas de gestión.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${researchGridModule(ops)}${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;
};

const shellV12Base=shell;
shell=function(){
  return shellV12Base()
    .replace(V115_APP_LABEL,V12_APP_LABEL)
    .replace('Motor cloud V9.2 Conflict Guard intacto. Apariencia claro/oscuro local, sin tocar datos ni sincronización.','Motor cloud V9.2 Conflict Guard intacto. Research Grid multidimensional sobre la misma base estable.');
};

Object.assign(window,{setResearchGridDim,swapResearchGridAxes,setResearchGridMetric,setResearchGridMinN,setResearchGridMaxCats,researchApplyCell,researchClearSelection,labClearGraphSelections,labReset});
render();
/* ===== END V12 PATCH ===== */

/* ===== V13 PATCH · Exit Lab ===== */
const V13_APP_LABEL='V13 · Exit Lab';

let exitLabState={tpR:2,beTrigger:1};

function setExitTpR(v){exitLabState.tpR=Math.max(.25,Number(v)||2);render();}
function setExitBeTrigger(v){exitLabState.beTrigger=Math.max(.25,Number(v)||1);render();}
function exitGrossR(o){return Number(o?.rMultiple)||0;}
function exitMfe(o){return Number(o?.mfe)||0;}
function exitMae(o){return Number(o?.mae)||0;}
function exitHasMfe(o){
  // En el modelo actual un campo vacío termina almacenado como 0. Para no confundir
  // "sin registrar" con una excursión realmente nula, Exit Lab solo usa MFE > 0.
  return Number.isFinite(Number(o?.mfe))&&Number(o?.mfe)>0;
}
function exitHasMae(o){return Number.isFinite(Number(o?.mae))&&Number(o?.mae)>0;}
function exitAverage(arr){const a=arr.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:0;}
function exitCumulative(vals){let x=0;return vals.map(v=>(x+=Number(v)||0));}
function exitStats(vals){
  const a=vals.map(Number).filter(Number.isFinite),n=a.length,w=a.filter(v=>v>0),l=a.filter(v=>v<0),gain=w.reduce((s,v)=>s+v,0),lossAbs=Math.abs(l.reduce((s,v)=>s+v,0)),sum=a.reduce((s,v)=>s+v,0);
  let eq=0,peak=0,maxDD=0;a.forEach(v=>{eq+=v;peak=Math.max(peak,eq);maxDD=Math.min(maxDD,eq-peak);});
  return {n,sum,expectancy:n?sum/n:0,pf:lossAbs?gain/lossAbs:(gain?Infinity:0),maxDD};
}
function exitResultClass(v){return Number(v)>0?'positive':Number(v)<0?'negative':'';}
function exitFmtR(v,{signed=true,dec=2}={}){v=Number(v)||0;return `${signed&&v>0?'+':''}${v.toFixed(dec)}R`;}
function exitFmtPct(v){return `${Number(v||0).toFixed(1)}%`;}
function exitPf(v){return Number.isFinite(v)?Number(v||0).toFixed(2):'∞';}
function exitScenarioR(o,tpR){return exitMfe(o)>=tpR?tpR:exitGrossR(o);}
function exitScenarioRows(valid){
  return [.5,1,1.5,2,2.5,3].map(tp=>{
    const vals=valid.map(o=>exitScenarioR(o,tp)),s=exitStats(vals),hits=valid.filter(o=>exitMfe(o)>=tp).length;
    return {tp,hits,...s};
  });
}
function exitThresholdRows(valid){
  return [.5,1,1.5,2,2.5,3].map(t=>{
    const reached=valid.filter(o=>exitMfe(o)>=t),neg=reached.filter(o=>exitGrossR(o)<0),avgFinal=exitAverage(reached.map(exitGrossR)),giveback=exitAverage(reached.map(o=>Math.max(0,exitMfe(o)-exitGrossR(o))));
    return {t,n:reached.length,neg:neg.length,avgFinal,giveback};
  });
}
function exitLabModule(ops){
  const total=ops.length,valid=ops.filter(exitHasMfe),validMae=ops.filter(exitHasMae),coverage=total?valid.length/total*100:0;
  const consistentWins=valid.filter(o=>{const r=exitGrossR(o),m=exitMfe(o);return r>0&&m>0&&r<=m+.05;});
  const inconsistent=valid.filter(o=>exitGrossR(o)>exitMfe(o)+.05);
  const capture=exitAverage(consistentWins.map(o=>exitGrossR(o)/exitMfe(o)*100));
  const giveback=exitAverage(valid.map(o=>Math.max(0,exitMfe(o)-exitGrossR(o))));
  const roundTrips=valid.filter(o=>exitMfe(o)>=1&&exitGrossR(o)<0);
  const quality=`<div class="exit-quality-grid"><div><span>Trades filtrados</span><strong>${total}</strong><small>subconjunto actual</small></div><div><span>MFE utilizable</span><strong>${valid.length}</strong><small>${exitFmtPct(coverage)} cobertura</small></div><div><span>MAE registrado</span><strong>${validMae.length}</strong><small>MAE &gt; 0</small></div><div><span>Control de consistencia</span><strong>${inconsistent.length}</strong><small>MFE &lt; resultado final</small></div></div>`;
  if(!valid.length){
    return `<section class="card panel lab-module lab-span-2 exit-lab-module"><div class="panel-title"><div><h3>Exit Lab</h3><small>Eficiencia de salida, giveback y escenarios de TP fijo a partir de MFE</small></div><span class="stable-pill">R bruto · observado</span></div>${quality}<div class="exit-empty"><strong>Aún no hay MFE utilizable en este subconjunto.</strong><p>Las importaciones actuales guardan MFE/MAE como 0 cuando ese dato no viene informado. Para evitar conclusiones falsas, Exit Lab trata <strong>MFE = 0</strong> como “no distinguible de dato ausente” y no lo usa en simulaciones.</p><p>Puedes probarlo editando algunas operaciones ficticias y rellenando <strong>MFE (R)</strong> y <strong>MAE (R)</strong>.</p></div></section>`;
  }

  const tp=exitLabState.tpR,actualVals=valid.map(exitGrossR),scenarioVals=valid.map(o=>exitScenarioR(o,tp)),actual=exitStats(actualVals),scenario=exitStats(scenarioVals),delta=scenario.sum-actual.sum,hits=valid.filter(o=>exitMfe(o)>=tp).length;
  const actualEq=exitCumulative(actualVals),scenarioEq=exitCumulative(scenarioVals);
  const metricRow=(label,a,b,fmt=exitFmtR)=>{const d=Number(b)-Number(a);return `<tr><th>${label}</th><td class="${exitResultClass(a)}">${fmt(a)}</td><td class="${exitResultClass(b)}">${fmt(b)}</td><td class="${exitResultClass(d)}">${fmt(d)}</td></tr>`;};
  const pfDelta=Number.isFinite(actual.pf)&&Number.isFinite(scenario.pf)?scenario.pf-actual.pf:null;
  const pfRow=`<tr><th>Profit Factor</th><td>${exitPf(actual.pf)}</td><td>${exitPf(scenario.pf)}</td><td class="${pfDelta===null?'':exitResultClass(pfDelta)}">${pfDelta===null?'—':`${pfDelta>0?'+':''}${pfDelta.toFixed(2)}`}</td></tr>`;
  const tpRows=exitScenarioRows(valid);
  const thresholds=exitThresholdRows(valid);
  const be=exitLabState.beTrigger,beTriggered=valid.filter(o=>exitMfe(o)>=be),beNeg=beTriggered.filter(o=>exitGrossR(o)<0),beFinalLoss=Math.abs(beNeg.reduce((s,o)=>s+Math.min(0,exitGrossR(o)),0));

  return `<section class="card panel lab-module lab-span-2 exit-lab-module">
    <div class="panel-title"><div><h3>Exit Lab</h3><small>MFE → captura del recorrido, cesión desde máximos y escenarios inferibles de salida</small></div><span class="stable-pill">R bruto · MFE observado</span></div>
    ${quality}
    <div class="exit-observed-grid">
      <div class="exit-observed-card"><span>Captura media de ganadoras</span><strong>${consistentWins.length?exitFmtPct(capture):'—'}</strong><small>${consistentWins.length} ganadoras con MFE consistente</small></div>
      <div class="exit-observed-card"><span>Cesión media desde MFE</span><strong>${exitFmtR(giveback,{signed:false})}</strong><small>MFE − resultado final</small></div>
      <div class="exit-observed-card"><span>+1R alcanzado → cierre negativo</span><strong>${roundTrips.length}</strong><small>round trips observados</small></div>
      <div class="exit-observed-card"><span>MFE medio utilizable</span><strong>${exitFmtR(exitAverage(valid.map(exitMfe)),{signed:false})}</strong><small>solo MFE &gt; 0</small></div>
    </div>

    <div class="exit-section-head"><div><h4>Escenario · TP fijo</h4><p>Si MFE alcanzó el objetivo, se asume salida completa en ese TP; si no lo alcanzó, se conserva la salida real.</p></div><label><span>TP hipotético</span><select class="select compact-select" onchange="setExitTpR(this.value)">${[.5,1,1.5,2,2.5,3].map(v=>`<option value="${v}" ${tp===v?'selected':''}>${v}R</option>`).join('')}</select></label></div>
    <div class="exit-scenario-grid">
      <div class="exit-equity-card"><div class="exit-legend"><span><i class="raw-dot"></i>Salida real</span><span><i class="managed-dot"></i>TP fijo ${tp}R</span></div><div class="dual-chart">${dualEquitySvg(actualEq,scenarioEq)}</div><small>${valid.length} operaciones con MFE utilizable · ${hits} alcanzaron ${tp}R</small></div>
      <div class="exit-compare-table"><table><thead><tr><th>Métrica</th><th>Real</th><th>TP ${tp}R</th><th>Δ</th></tr></thead><tbody>${metricRow('Resultado',actual.sum,scenario.sum)}${metricRow('Expectancy',actual.expectancy,scenario.expectancy)}${pfRow}${metricRow('Max DD',actual.maxDD,scenario.maxDD)}</tbody></table><div class="exit-delta-callout"><span>Impacto acumulado del escenario</span><strong class="${exitResultClass(delta)}">${exitFmtR(delta)}</strong></div></div>
    </div>

    <div class="exit-two-tables">
      <div><div class="exit-subtitle"><h4>Mapa de objetivos fijos</h4><small>Haz clic en una fila para usar ese TP en la curva.</small></div><div class="exit-table-wrap"><table class="exit-table"><thead><tr><th>TP</th><th>Alcanzado</th><th>Resultado</th><th>Exp.</th><th>PF</th></tr></thead><tbody>${tpRows.map(r=>`<tr class="${tp===r.tp?'active':''}" onclick="setExitTpR(${r.tp})"><th>${r.tp.toFixed(1)}R</th><td>${r.hits}/${valid.length}</td><td class="${exitResultClass(r.sum)}">${exitFmtR(r.sum)}</td><td class="${exitResultClass(r.expectancy)}">${exitFmtR(r.expectancy)}</td><td>${exitPf(r.pf)}</td></tr>`).join('')}</tbody></table></div></div>
      <div><div class="exit-subtitle"><h4>Qué ocurre después de alcanzar R</h4><small>Datos observados, sin simular órdenes.</small></div><div class="exit-table-wrap"><table class="exit-table"><thead><tr><th>Nivel</th><th>Llegaron</th><th>Acabaron −</th><th>Cierre medio</th><th>Cesión</th></tr></thead><tbody>${thresholds.map(r=>`<tr><th>${r.t.toFixed(1)}R</th><td>${r.n}</td><td>${r.neg}</td><td class="${exitResultClass(r.avgFinal)}">${r.n?exitFmtR(r.avgFinal):'—'}</td><td>${r.n?exitFmtR(r.giveback,{signed:false}):'—'}</td></tr>`).join('')}</tbody></table></div></div>
    </div>

    <div class="exit-be-panel"><div class="exit-section-head"><div><h4>Diagnóstico Break Even</h4><p>Identifica casos observables; no inventa la secuencia intratrade.</p></div><label><span>Trigger BE</span><select class="select compact-select" onchange="setExitBeTrigger(this.value)">${[.5,.75,1,1.5,2].map(v=>`<option value="${v}" ${be===v?'selected':''}>+${v}R</option>`).join('')}</select></label></div><div class="exit-be-grid"><div><span>Alcanzaron trigger</span><strong>${beTriggered.length}</strong></div><div><span>Después cerraron negativos</span><strong>${beNeg.length}</strong></div><div><span>Pérdida final de esos casos</span><strong class="${beFinalLoss?'negative':''}">${beFinalLoss?`−${beFinalLoss.toFixed(2)}R`:'0.00R'}</strong></div><div><span>Secuencia no resoluble</span><strong>${Math.max(0,beTriggered.length-beNeg.length)}</strong></div></div><div class="lab-note warn">Un trade que alcanzó +${be}R y terminó negativo necesariamente devolvió el recorrido hacia la zona de entrada, salvo gaps/slippage. Aun así, <strong>no calculamos un resultado BE para todos los trades</strong>: con solo MAE/MFE no conocemos el orden exacto de los movimientos. Para backtestear BE, trailing stops o salidas parciales de forma completa necesitaremos secuencia intratrade.</div></div>

    <div class="exit-method-note"><strong>Qué es observado y qué es inferido:</strong> captura, giveback y “alcanzó X R” proceden directamente de MFE + resultado final. El escenario TP fijo es inferible porque MFE ≥ TP confirma que ese nivel fue tocado durante la operación original, asumiendo una orden objetivo activa, sin gap/slippage y salida total. No se simulan trailing stops, parciales ni la trayectoria exacta.</div>
  </section>`;
}

analyticsLab=function(){
  const p=getCurrentPlan(),ops=labFilteredOps();
  return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: combinaciones, salidas, comportamiento, riesgo y estabilidad.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${researchGridModule(ops)}${exitLabModule(ops)}${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;
};

const shellV13Base=shell;
shell=function(){
  return shellV13Base()
    .replace(V12_APP_LABEL,V13_APP_LABEL)
    .replace('Motor cloud V9.2 Conflict Guard intacto. Research Grid multidimensional sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Research Grid + Exit Lab sobre la misma base estable.');
};

Object.assign(window,{setExitTpR,setExitBeTrigger});
render();
/* ===== END V13 PATCH ===== */

/* ===== V13.1 PATCH · Unidades analíticas completas ===== */
const V131_APP_LABEL='V13.1 · Unidades analíticas';

function exitRiskTicks(o){
  const direct=Number(o?.riskTickExposure)||0;
  if(direct>0)return direct;
  const r=Number(o?.rMultiple)||0,t=Number(o?.resultTicks)||0;
  return r?Math.abs(t/r):0;
}
function exitRiskUsd(o){
  const direct=Number(o?.riskUsd)||0;
  if(direct>0)return direct;
  const rt=exitRiskTicks(o),tv=Number(o?.instrumentSnapshot?.tickValue)||0;
  return rt*tv;
}
function exitRToMetric(o,r,{unit=labState.unit,basis=labState.basis}={}){
  r=Number(r)||0;
  const commission=Number(o?.commission)||0;
  if(unit==='ticks'){
    const gross=r*exitRiskTicks(o),tv=Number(o?.instrumentSnapshot?.tickValue)||0;
    return basis==='net'&&tv?gross-(commission/tv):gross;
  }
  if(unit==='usd'){
    const gross=r*exitRiskUsd(o);
    return basis==='net'?gross-commission:gross;
  }
  if(basis==='net'){
    const riskUsd=exitRiskUsd(o);
    return riskUsd?r-(commission/riskUsd):r;
  }
  return r;
}
function exitObservedMfeMetric(o,unit=labState.unit){
  // MFE/MAE son excursiones observadas del precio: se convierten de R a la unidad elegida,
  // pero permanecen brutas aunque el P&L del Laboratorio esté en base neta.
  return exitRToMetric(o,exitMfe(o),{unit,basis:'gross'});
}
function exitObservedMaeMetric(o,unit=labState.unit){
  return exitRToMetric(o,exitMae(o),{unit,basis:'gross'});
}
function exitActualMetric(o){return opMetricValue(o,labState.unit,labState.basis);}
function exitGivebackMetric(o){return exitRToMetric(o,Math.max(0,exitMfe(o)-exitGrossR(o)),{unit:labState.unit,basis:'gross'});}
function exitScenarioMetric(o,tpR){return exitMfe(o)>=tpR?exitRToMetric(o,tpR):exitActualMetric(o);}
function exitMetricFormat(v,{signed=true}={}){
  v=Number(v)||0;
  const u=labState.unit;
  if(u==='usd')return `${signed&&v>0?'+':''}${v.toFixed(2)} US$`;
  if(u==='ticks')return `${signed&&v>0?'+':''}${v.toFixed(1)}t`;
  return `${signed&&v>0?'+':''}${v.toFixed(2)}R`;
}
function exitUnitBasisLabel(){
  return `${metricUnitLabel(labState.unit)} ${labState.basis==='net'?'neto':'bruto'} · umbrales en R`;
}
function exitScenarioRowsMetric(valid){
  return [.5,1,1.5,2,2.5,3].map(tp=>{
    const vals=valid.map(o=>exitScenarioMetric(o,tp)),s=exitStats(vals),hits=valid.filter(o=>exitMfe(o)>=tp).length;
    return {tp,hits,...s};
  });
}
function exitThresholdRowsMetric(valid){
  return [.5,1,1.5,2,2.5,3].map(t=>{
    const reached=valid.filter(o=>exitMfe(o)>=t),neg=reached.filter(o=>exitGrossR(o)<0);
    const avgFinal=exitAverage(reached.map(exitActualMetric));
    const giveback=exitAverage(reached.map(exitGivebackMetric));
    return {t,n:reached.length,neg:neg.length,avgFinal,giveback};
  });
}

exitLabModule=function(ops){
  const total=ops.length,valid=ops.filter(exitHasMfe),validMae=ops.filter(exitHasMae),coverage=total?valid.length/total*100:0;
  const consistentWins=valid.filter(o=>{const r=exitGrossR(o),m=exitMfe(o);return r>0&&m>0&&r<=m+.05;});
  const inconsistent=valid.filter(o=>exitGrossR(o)>exitMfe(o)+.05);
  const capture=exitAverage(consistentWins.map(o=>exitGrossR(o)/exitMfe(o)*100));
  const giveback=exitAverage(valid.map(exitGivebackMetric));
  const roundTrips=valid.filter(o=>exitMfe(o)>=1&&exitGrossR(o)<0);
  const unitLabel=metricUnitLabel(labState.unit),basisLabel=labState.basis==='net'?'neto':'bruto';
  const quality=`<div class="exit-quality-grid"><div><span>Trades filtrados</span><strong>${total}</strong><small>subconjunto actual</small></div><div><span>MFE utilizable</span><strong>${valid.length}</strong><small>${exitFmtPct(coverage)} cobertura</small></div><div><span>MAE registrado</span><strong>${validMae.length}</strong><small>MAE &gt; 0</small></div><div><span>Control de consistencia</span><strong>${inconsistent.length}</strong><small>MFE &lt; resultado final</small></div></div>`;
  if(!valid.length){
    return `<section class="card panel lab-module lab-span-2 exit-lab-module"><div class="panel-title"><div><h3>Exit Lab</h3><small>Eficiencia de salida, giveback y escenarios de TP fijo a partir de MFE</small></div><span class="stable-pill">${esc(exitUnitBasisLabel())}</span></div>${quality}<div class="exit-empty"><strong>Aún no hay MFE utilizable en este subconjunto.</strong><p>Las importaciones actuales guardan MFE/MAE como 0 cuando ese dato no viene informado. Para evitar conclusiones falsas, Exit Lab trata <strong>MFE = 0</strong> como “no distinguible de dato ausente” y no lo usa en simulaciones.</p><p>Los niveles de decisión permanecen expresados en <strong>R</strong>; cuando registres MFE/MAE, los resultados se mostrarán en <strong>${esc(unitLabel)}</strong> según el selector global.</p></div></section>`;
  }

  const tp=exitLabState.tpR,actualVals=valid.map(exitActualMetric),scenarioVals=valid.map(o=>exitScenarioMetric(o,tp)),actual=exitStats(actualVals),scenario=exitStats(scenarioVals),delta=scenario.sum-actual.sum,hits=valid.filter(o=>exitMfe(o)>=tp).length;
  const actualEq=exitCumulative(actualVals),scenarioEq=exitCumulative(scenarioVals);
  const metricRow=(label,a,b)=>{const d=Number(b)-Number(a);return `<tr><th>${label}</th><td class="${exitResultClass(a)}">${exitMetricFormat(a)}</td><td class="${exitResultClass(b)}">${exitMetricFormat(b)}</td><td class="${exitResultClass(d)}">${exitMetricFormat(d)}</td></tr>`;};
  const pfDelta=Number.isFinite(actual.pf)&&Number.isFinite(scenario.pf)?scenario.pf-actual.pf:null;
  const pfRow=`<tr><th>Profit Factor</th><td>${exitPf(actual.pf)}</td><td>${exitPf(scenario.pf)}</td><td class="${pfDelta===null?'':exitResultClass(pfDelta)}">${pfDelta===null?'—':`${pfDelta>0?'+':''}${pfDelta.toFixed(2)}`}</td></tr>`;
  const tpRows=exitScenarioRowsMetric(valid),thresholds=exitThresholdRowsMetric(valid);
  const be=exitLabState.beTrigger,beTriggered=valid.filter(o=>exitMfe(o)>=be),beNeg=beTriggered.filter(o=>exitGrossR(o)<0);
  const beFinalLoss=Math.abs(beNeg.reduce((s,o)=>s+Math.min(0,exitActualMetric(o)),0));
  const mfeMean=exitAverage(valid.map(o=>exitObservedMfeMetric(o)));

  return `<section class="card panel lab-module lab-span-2 exit-lab-module">
    <div class="panel-title"><div><h3>Exit Lab</h3><small>MFE → captura del recorrido, cesión desde máximos y escenarios inferibles de salida</small></div><span class="stable-pill">${esc(exitUnitBasisLabel())}</span></div>
    ${quality}
    <div class="exit-observed-grid">
      <div class="exit-observed-card"><span>Captura media de ganadoras</span><strong>${consistentWins.length?exitFmtPct(capture):'—'}</strong><small>${consistentWins.length} ganadoras con MFE consistente</small></div>
      <div class="exit-observed-card"><span>Cesión media desde MFE</span><strong>${exitMetricFormat(giveback,{signed:false})}</strong><small>recorrido cedido · excursión bruta</small></div>
      <div class="exit-observed-card"><span>+1R alcanzado → cierre negativo</span><strong>${roundTrips.length}</strong><small>umbral estructural en R</small></div>
      <div class="exit-observed-card"><span>MFE medio utilizable</span><strong>${exitMetricFormat(mfeMean,{signed:false})}</strong><small>MFE observado convertido a ${esc(unitLabel)}</small></div>
    </div>

    <div class="exit-section-head"><div><h4>Escenario · TP fijo</h4><p>El objetivo sigue definido en R. El resultado del escenario se convierte operación por operación a ${esc(unitLabel)} (${basisLabel}).</p></div><label><span>TP hipotético</span><select class="select compact-select" onchange="setExitTpR(this.value)">${[.5,1,1.5,2,2.5,3].map(v=>`<option value="${v}" ${tp===v?'selected':''}>${v}R</option>`).join('')}</select></label></div>
    <div class="exit-scenario-grid">
      <div class="exit-equity-card"><div class="exit-legend"><span><i class="raw-dot"></i>Salida real · ${esc(unitLabel)}</span><span><i class="managed-dot"></i>TP fijo ${tp}R</span></div><div class="dual-chart">${dualEquitySvg(actualEq,scenarioEq)}</div><small>${valid.length} operaciones con MFE utilizable · ${hits} alcanzaron ${tp}R · curva en ${esc(unitLabel)} ${basisLabel}</small></div>
      <div class="exit-compare-table"><table><thead><tr><th>Métrica</th><th>Real</th><th>TP ${tp}R</th><th>Δ</th></tr></thead><tbody>${metricRow('Resultado',actual.sum,scenario.sum)}${metricRow('Expectancy',actual.expectancy,scenario.expectancy)}${pfRow}${metricRow('Max DD',actual.maxDD,scenario.maxDD)}</tbody></table><div class="exit-delta-callout"><span>Impacto acumulado del escenario</span><strong class="${exitResultClass(delta)}">${exitMetricFormat(delta)}</strong></div></div>
    </div>

    <div class="exit-two-tables">
      <div><div class="exit-subtitle"><h4>Mapa de objetivos fijos</h4><small>TP en R; resultados en ${esc(unitLabel)} ${basisLabel}.</small></div><div class="exit-table-wrap"><table class="exit-table"><thead><tr><th>TP</th><th>Alcanzado</th><th>Resultado</th><th>Exp.</th><th>PF</th></tr></thead><tbody>${tpRows.map(r=>`<tr class="${tp===r.tp?'active':''}" onclick="setExitTpR(${r.tp})"><th>${r.tp.toFixed(1)}R</th><td>${r.hits}/${valid.length}</td><td class="${exitResultClass(r.sum)}">${exitMetricFormat(r.sum)}</td><td class="${exitResultClass(r.expectancy)}">${exitMetricFormat(r.expectancy)}</td><td>${exitPf(r.pf)}</td></tr>`).join('')}</tbody></table></div></div>
      <div><div class="exit-subtitle"><h4>Qué ocurre después de alcanzar R</h4><small>Umbrales en R; cierres y cesión en ${esc(unitLabel)}.</small></div><div class="exit-table-wrap"><table class="exit-table"><thead><tr><th>Nivel</th><th>Llegaron</th><th>Acabaron −</th><th>Cierre medio</th><th>Cesión</th></tr></thead><tbody>${thresholds.map(r=>`<tr><th>${r.t.toFixed(1)}R</th><td>${r.n}</td><td>${r.neg}</td><td class="${exitResultClass(r.avgFinal)}">${r.n?exitMetricFormat(r.avgFinal):'—'}</td><td>${r.n?exitMetricFormat(r.giveback,{signed:false}):'—'}</td></tr>`).join('')}</tbody></table></div></div>
    </div>

    <div class="exit-be-panel"><div class="exit-section-head"><div><h4>Diagnóstico Break Even</h4><p>El trigger permanece en R; el impacto observado se expresa en ${esc(unitLabel)}.</p></div><label><span>Trigger BE</span><select class="select compact-select" onchange="setExitBeTrigger(this.value)">${[.5,.75,1,1.5,2].map(v=>`<option value="${v}" ${be===v?'selected':''}>+${v}R</option>`).join('')}</select></label></div><div class="exit-be-grid"><div><span>Alcanzaron trigger</span><strong>${beTriggered.length}</strong></div><div><span>Después cerraron negativos</span><strong>${beNeg.length}</strong></div><div><span>Pérdida final de esos casos</span><strong class="${beFinalLoss?'negative':''}">${beFinalLoss?`−${exitMetricFormat(beFinalLoss,{signed:false})}`:exitMetricFormat(0,{signed:false})}</strong></div><div><span>Secuencia no resoluble</span><strong>${Math.max(0,beTriggered.length-beNeg.length)}</strong></div></div><div class="lab-note warn">Un trade que alcanzó +${be}R y terminó negativo necesariamente devolvió el recorrido hacia la zona de entrada, salvo gaps/slippage. Aun así, <strong>no calculamos un resultado BE para todos los trades</strong>: con solo MAE/MFE no conocemos el orden exacto de los movimientos.</div></div>

    <div class="exit-method-note"><strong>Lectura de unidades:</strong> R sigue definiendo los umbrales comparables entre operaciones (MFE, TP y trigger BE). P&L, expectancy, drawdown, equity, cierre medio y cesión se convierten operación por operación a <strong>${esc(unitLabel)}</strong> y respetan la base <strong>${basisLabel}</strong>. MFE/MAE observados se mantienen brutos porque describen excursión del precio.</div>
  </section>`;
};

// Research Grid ya calculaba con la unidad global; V13.1 lo hace explícito en la cabecera
// para que sea inequívoco cuándo una matriz está en R, ticks o US$.
const researchGridModuleV131Base=researchGridModule;
researchGridModule=function(ops){
  let html=researchGridModuleV131Base(ops);
  const unitAware=!['winrate','pf','n'].includes(researchGridState.metric);
  const badge=unitAware?`${metricUnitLabel(labState.unit)} · ${labState.basis==='net'?'Neto':'Bruto'}`:'Métrica adimensional';
  html=html.replace(`<span>${ops.length} operaciones</span>`,`<div class="panel-tools"><span class="stable-pill">${esc(badge)}</span><span>${ops.length} operaciones</span></div>`);
  return html;
};

const shellV131Base=shell;
shell=function(){
  return shellV131Base()
    .replace(V13_APP_LABEL,V131_APP_LABEL)
    .replace('Motor cloud V9.2 Conflict Guard intacto. Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Research Grid y Exit Lab con R / ticks / US$ sobre la misma base estable.');
};

render();
/* ===== END V13.1 PATCH ===== */

/* ===== V14 PATCH · Calendario avanzado ===== */
const V14_APP_LABEL='V14 · Calendario avanzado';

let calendarState={
  year:null,month:null,unit:'r',basis:'gross',metric:'result',selectedDate:''
};

function calendarEnsureAnchor(){
  if(Number.isInteger(calendarState.year)&&Number.isInteger(calendarState.month))return;
  const dates=currentOps().map(o=>new Date(o.entryDate)).filter(d=>!isNaN(d));
  const anchor=dates.length?new Date(Math.max(...dates.map(d=>d.getTime()))):new Date();
  calendarState.year=anchor.getFullYear();calendarState.month=anchor.getMonth();
}
function calendarMonthLabel(){calendarEnsureAnchor();return new Date(calendarState.year,calendarState.month,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});}
function calendarSetUnit(v){calendarState.unit=['r','ticks','usd'].includes(v)?v:'r';render();}
function calendarSetBasis(v){calendarState.basis=v==='net'?'net':'gross';render();}
function calendarSetMetric(v){calendarState.metric=['result','expectancy','winrate','discipline'].includes(v)?v:'result';render();}
function calendarMoveMonth(delta){calendarEnsureAnchor();const d=new Date(calendarState.year,calendarState.month+Number(delta||0),1);calendarState.year=d.getFullYear();calendarState.month=d.getMonth();calendarState.selectedDate='';render();}
function calendarGoLatest(){calendarState.year=null;calendarState.month=null;calendarState.selectedDate='';calendarEnsureAnchor();render();}
function calendarSelectDate(dateKey){calendarState.selectedDate=calendarState.selectedDate===dateKey?'':dateKey;render();}
function calendarMonthOps(){
  calendarEnsureAnchor();
  return currentOps().filter(o=>{const d=new Date(o.entryDate);return !isNaN(d)&&d.getFullYear()===calendarState.year&&d.getMonth()===calendarState.month;}).sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));
}
function calendarDateKey(d){return inputDateValue(d);}
function calendarDayOps(ops,key){return ops.filter(o=>calendarDateKey(new Date(o.entryDate))===key);}
function calendarDisciplinePct(ops){
  const tagged=ops.filter(o=>String(o.discipline||'').trim());if(!tagged.length)return null;
  const ok=tagged.filter(o=>String(o.discipline||'').toLowerCase().startsWith('s')).length;
  return ok/tagged.length*100;
}
function calendarDayMetric(ops){
  if(!ops.length)return {value:0,text:'—'};
  const s=calcMetricStats(ops,calendarState.unit,calendarState.basis);
  if(calendarState.metric==='expectancy')return {value:s.expectancy,text:metricStatText(s.expectancy,calendarState.unit)};
  if(calendarState.metric==='winrate')return {value:s.winRate-50,text:`${s.winRate.toFixed(0)}%`};
  if(calendarState.metric==='discipline'){
    const d=calendarDisciplinePct(ops);return {value:d===null?0:d-50,text:d===null?'—':`${d.toFixed(0)}%`};
  }
  return {value:s.sum,text:metricStatText(s.sum,calendarState.unit)};
}
function calendarTone(value,hasData){if(!hasData)return 'empty-day';if(value>0)return 'positive-day';if(value<0)return 'negative-day';return 'flat-day';}
function calendarMetricLabel(){return calendarState.metric==='expectancy'?'Expectancy':calendarState.metric==='winrate'?'Win rate':calendarState.metric==='discipline'?'Disciplina':'Resultado';}
function calendarSelectedDetail(monthOps){
  if(!calendarState.selectedDate)return '';
  const ops=calendarDayOps(monthOps,calendarState.selectedDate),s=calcMetricStats(ops,calendarState.unit,calendarState.basis),disc=calendarDisciplinePct(ops);
  const d=new Date(`${calendarState.selectedDate}T12:00:00`),title=isNaN(d)?calendarState.selectedDate:d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const emo=ops.flatMap(operationEmotionValues).filter(Boolean),beh=ops.flatMap(o=>o.emotional?.behaviors||[]).filter(Boolean);
  const top=(arr)=>{const m={};arr.forEach(x=>m[x]=(m[x]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,3);};
  return `<section class="card panel calendar-detail"><div class="panel-title"><div><h3>${esc(title)}</h3><small>Segundo clic sobre el día para cerrar el detalle</small></div><button class="btn small ghost" onclick="calendarSelectDate('${esc(calendarState.selectedDate)}')">Cerrar día</button></div><div class="calendar-detail-kpis"><div><span>Operaciones</span><strong>${s.n}</strong></div><div><span>Resultado</span><strong class="${s.sum>0?'positive':s.sum<0?'negative':''}">${metricStatText(s.sum,calendarState.unit)}</strong></div><div><span>Expectancy</span><strong class="${s.expectancy>0?'positive':s.expectancy<0?'negative':''}">${metricStatText(s.expectancy,calendarState.unit)}</strong></div><div><span>Win rate</span><strong>${s.winRate.toFixed(1)}%</strong></div><div><span>Profit Factor</span><strong>${Number.isFinite(s.pf)?s.pf.toFixed(2):'∞'}</strong></div><div><span>Disciplina</span><strong>${disc===null?'—':disc.toFixed(0)+'%'}</strong></div></div>${(emo.length||beh.length)?`<div class="calendar-context-row"><div><span>Emociones dominantes</span>${top(emo).map(([k,n])=>`<b>${esc(k)} · ${n}</b>`).join('')||'<em>Sin datos</em>'}</div><div><span>Comportamientos observados</span>${top(beh).map(([k,n])=>`<b>${esc(k)} · ${n}</b>`).join('')||'<em>Sin datos</em>'}</div></div>`:''}<div class="calendar-day-table">${ops.length?opsTable([...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),calendarState.unit,calendarState.basis):'<div class="empty">Sin operaciones este día.</div>'}</div></section>`;
}
function calendarView(){
  calendarEnsureAnchor();const ops=calendarMonthOps(),stats=calcMetricStats(ops,calendarState.unit,calendarState.basis),unitLabel=metricUnitLabel(calendarState.unit),first=new Date(calendarState.year,calendarState.month,1),lastDay=new Date(calendarState.year,calendarState.month+1,0).getDate(),start=(first.getDay()+6)%7;
  const dayData=[];let maxAbs=0;for(let day=1;day<=lastDay;day++){const d=new Date(calendarState.year,calendarState.month,day),key=calendarDateKey(d),dayOps=calendarDayOps(ops,key),metric=calendarDayMetric(dayOps);maxAbs=Math.max(maxAbs,Math.abs(metric.value));dayData.push({day,key,ops:dayOps,metric});}maxAbs=maxAbs||1;
  const cells=[];for(let i=0;i<start;i++)cells.push('<div class="calendar-cell calendar-blank"></div>');
  dayData.forEach(x=>{const s=calcMetricStats(x.ops,calendarState.unit,calendarState.basis),strength=Math.min(1,Math.abs(x.metric.value)/maxAbs),selected=calendarState.selectedDate===x.key;cells.push(`<button class="calendar-cell calendar-day ${calendarTone(x.metric.value,x.ops.length)} ${selected?'selected':''}" style="--calendar-strength:${strength.toFixed(3)}" onclick="calendarSelectDate('${x.key}')"><div class="calendar-day-head"><strong>${x.day}</strong><span>${x.ops.length?`${x.ops.length} trade${x.ops.length===1?'':'s'}`:''}</span></div><div class="calendar-day-result ${x.metric.value>0?'positive':x.metric.value<0?'negative':''}">${x.ops.length?esc(x.metric.text):'—'}</div>${x.ops.length?`<div class="calendar-day-meta"><span>WR ${s.winRate.toFixed(0)}%</span><span>${calendarDisciplinePct(x.ops)===null?'':`Disc ${calendarDisciplinePct(x.ops).toFixed(0)}%`}</span></div>`:''}</button>`);});
  while(cells.length%7)cells.push('<div class="calendar-cell calendar-blank"></div>');
  const monthPf=Number.isFinite(stats.pf)?stats.pf.toFixed(2):(stats.pf===Infinity?'∞':'0.00');
  const controls=`<div class="calendar-actions"><div class="metric-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${calendarState.unit===v?'active':''}" onclick="calendarSetUnit('${v}')">${l}</button>`).join('')}<i></i><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([v,l])=>`<button class="seg-btn ${calendarState.basis===v?'active':''}" onclick="calendarSetBasis('${v}')">${l}</button>`).join('')}</div></div>`;
  return `${pageHead('Calendario de rendimiento','Lectura diaria, semanal y mensual del Trading Plan. Pulsa un día para inspeccionarlo; vuelve a pulsarlo para resetear.',controls)}${activePlanBanner()}<section class="card panel calendar-panel"><div class="calendar-toolbar"><div class="calendar-month-nav"><button class="btn small" onclick="calendarMoveMonth(-1)">←</button><div><h3>${esc(calendarMonthLabel())}</h3><span>${ops.length} operaciones · ${calendarState.basis==='net'?'Neto':'Bruto'} · ${esc(unitLabel)}</span></div><button class="btn small" onclick="calendarMoveMonth(1)">→</button><button class="btn small ghost" onclick="calendarGoLatest()">Último mes con datos</button></div><label class="calendar-metric-select"><span>Color / valor del día</span><select class="select compact-select" onchange="calendarSetMetric(this.value)"><option value="result" ${calendarState.metric==='result'?'selected':''}>Resultado</option><option value="expectancy" ${calendarState.metric==='expectancy'?'selected':''}>Expectancy</option><option value="winrate" ${calendarState.metric==='winrate'?'selected':''}>Win rate</option><option value="discipline" ${calendarState.metric==='discipline'?'selected':''}>Disciplina</option></select></label></div><div class="calendar-month-kpis"><div><span>Operaciones</span><strong>${stats.n}</strong></div><div><span>Resultado</span><strong class="${stats.sum>0?'positive':stats.sum<0?'negative':''}">${metricStatText(stats.sum,calendarState.unit)}</strong></div><div><span>Expectancy</span><strong class="${stats.expectancy>0?'positive':stats.expectancy<0?'negative':''}">${metricStatText(stats.expectancy,calendarState.unit)}</strong></div><div><span>Win rate</span><strong>${stats.winRate.toFixed(1)}%</strong></div><div><span>Profit Factor</span><strong>${monthPf}</strong></div><div><span>Max DD</span><strong class="${stats.maxDD<0?'negative':''}">${metricStatText(stats.maxDD,calendarState.unit)}</strong></div></div><div class="calendar-weekdays">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div>${x}</div>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div><div class="calendar-legend"><span><i class="calendar-dot pos"></i> positivo</span><span><i class="calendar-dot neg"></i> negativo</span><span><i class="calendar-dot flat"></i> neutro / sin muestra</span><em>El color representa ${esc(calendarMetricLabel())}; la intensidad depende del mes visible.</em></div></section>${calendarSelectedDetail(ops)}${calendarState.unit==='ticks'?mixedInstrumentWarning(ops):''}`;
}

const shellV14Base=shell;
shell=function(){
  let html=shellV14Base();
  const labButton=navBtn('lab','⌁','Laboratorio');
  html=html.replace(labButton,navBtn('calendar','▣','Calendario')+labButton);
  return html.replace(V131_APP_LABEL,V14_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Research Grid y Exit Lab con R / ticks / US$ sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Calendario avanzado + Research Grid + Exit Lab sobre la misma base estable.');
};

render=function(){
  document.getElementById('app').innerHTML=shell();const view=document.getElementById('view');
  view.innerHTML=currentView==='dashboard'?dashboard():currentView==='operations'?operations():currentView==='calendar'?calendarView():currentView==='lab'?analyticsLab():currentView==='gallery'?gallery():currentView==='journal'?journal():currentView==='blocks'?blocks():currentView==='plans'?plansView():config();
  setTimeout(hydrateImageElements,0);
};
Object.assign(window,{calendarSetUnit,calendarSetBasis,calendarSetMetric,calendarMoveMonth,calendarGoLatest,calendarSelectDate});
render();
/* ===== END V14 PATCH ===== */

/* ===== V15 PATCH · Dashboard personalizable + cero neutro ===== */
const V15_APP_LABEL='V15 · Dashboard personalizable';

/* Un cero exacto es neutro: no se presenta como "+0". El resto conserva el formato existente. */
const formatMetricV15Base=formatMetric;
formatMetric=function(v,unit,dec=2){
  const n=Number(v)||0;
  if(Math.abs(n)<1e-12){
    if(unit==='usd')return `${n.toFixed(2)} US$`;
    if(unit==='ticks')return `${n.toFixed(dec)}t`;
    return `${n.toFixed(dec)}R`;
  }
  return formatMetricV15Base(n,unit,dec);
};
const dashboardSignedMetricV15Base=dashboardSignedMetric;
dashboardSignedMetric=function(v,unit){
  const n=Number(v)||0;
  return Math.abs(n)<1e-12?dashboardPlainMetric(0,unit):dashboardSignedMetricV15Base(n,unit);
};

const DASHBOARD_DEFAULT_CONFIG={
  kpis:['operations','winRate','expectancy','pf','drawdown','blocks'],
  panels:['equity','setupCount'],
  secondary:['mfe','mae','currentBlock']
};
const DASHBOARD_KPI_DEFS=[
  ['operations','Operaciones'],['winRate','Win rate'],['expectancy','Expectancy'],['result','Resultado total'],
  ['pf','Profit Factor'],['drawdown','Drawdown'],['avgWin','Media ganadora'],['avgLoss','Media perdedora'],
  ['commissions','Comisiones'],['blocks','Bloques']
];
const DASHBOARD_PANEL_DEFS=[
  ['equity','Curva de equity'],['setupCount','Operaciones por setup'],['contextCount','Operaciones por contexto'],
  ['setupExpectancy','Expectancy por setup'],['contextExpectancy','Expectancy por contexto'],['recent20','Últimas 20 operaciones']
];
const DASHBOARD_SECONDARY_DEFS=[
  ['mfe','MFE medio'],['mae','MAE medio'],['currentBlock','Bloque actual']
];
let dashboardCustomizeDraft=null;

function dashboardDefIds(defs){return defs.map(x=>x[0]);}
function normalizeDashboardGroup(value,defs,fallback){
  const allowed=new Set(dashboardDefIds(defs));
  const src=Array.isArray(value)?value:Array.isArray(fallback)?fallback:[];
  const out=[];src.forEach(id=>{if(allowed.has(id)&&!out.includes(id))out.push(id);});return out;
}
function dashboardConfigForPlan(p=getCurrentPlan()){
  const c=p?.dashboardConfig||{};
  return {
    kpis:normalizeDashboardGroup(c.kpis,DASHBOARD_KPI_DEFS,DASHBOARD_DEFAULT_CONFIG.kpis),
    panels:normalizeDashboardGroup(c.panels,DASHBOARD_PANEL_DEFS,DASHBOARD_DEFAULT_CONFIG.panels),
    secondary:normalizeDashboardGroup(c.secondary,DASHBOARD_SECONDARY_DEFS,DASHBOARD_DEFAULT_CONFIG.secondary)
  };
}
function dashboardMetricValueText(v,unit,{signed=true}={}){
  return signed?dashboardSignedMetric(v,unit):dashboardPlainMetric(v,unit);
}
function dashboardKpiHtml(id,ctx){
  const {ops,baseStats,metricStats,unit,unitLabel}=ctx;
  const pf=Number.isFinite(metricStats.pf)?metricStats.pf.toFixed(2):(metricStats.pf===Infinity?'∞':'0.00');
  const blocks=Math.ceil(baseStats.n/20);
  const map={
    operations:()=>kpi('Operaciones',baseStats.n,'plan activo'),
    winRate:()=>kpi('Win rate',pct(baseStats.winRate),'resultado cerrado'),
    expectancy:()=>kpi('Expectancy',dashboardMetricValueText(metricStats.expectancy,unit),`por operación · ${unitLabel}`),
    result:()=>kpi('Resultado total',dashboardMetricValueText(metricStats.sum,unit),`acumulado · ${unitLabel}`),
    pf:()=>kpi('Profit Factor',pf,'ganancia / pérdida'),
    drawdown:()=>kpi('Drawdown',dashboardPlainMetric(metricStats.maxDD,unit),`máximo · ${unitLabel}`),
    avgWin:()=>kpi('Media ganadora',dashboardMetricValueText(metricStats.avgWin,unit),`${metricStats.wins} ganadoras`),
    avgLoss:()=>kpi('Media perdedora',dashboardMetricValueText(metricStats.avgLoss,unit),`${metricStats.losses} perdedoras`),
    commissions:()=>kpi('Comisiones',money(metricStats.commissions,'USD'),'coste total'),
    blocks:()=>kpi('Bloques',blocks,'de 20 operaciones')
  };
  return map[id]?map[id]():'';
}
function dashboardTopCounts(ops,key,limit=7){
  const m={};ops.forEach(o=>{const raw=key==='context'?o.h4Context:o[key],k=String(raw||'').trim()||`Sin ${key==='context'?'contexto':key}`;m[k]=(m[k]||0)+1;});
  return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,limit);
}
function dashboardCountPanel(title,items,subtitle){
  const max=items[0]?.[1]||1;
  return `<section class="card panel dashboard-custom-panel"><div class="panel-title"><h3>${esc(title)}</h3><span>${esc(subtitle||'')}</span></div><div class="bar-list">${items.length?items.map(([k,v])=>`<div class="bar-row"><div>${esc(k)}</div><div class="bar"><span style="width:${(v/max)*100}%"></span></div><div class="value-right">${v}</div></div>`).join(''):'<div class="empty">Aún no hay operaciones.</div>'}</div></section>`;
}
function dashboardGroupedMetric(ops,key,unit){
  const groups=new Map();ops.forEach(o=>{const raw=key==='context'?o.h4Context:o[key],label=String(raw||'').trim()||`Sin ${key==='context'?'contexto':key}`;if(!groups.has(label))groups.set(label,[]);groups.get(label).push(o);});
  return [...groups.entries()].map(([label,items])=>({label,n:items.length,value:calcMetricStats(items,unit,'gross').expectancy})).sort((a,b)=>b.n-a.n).slice(0,7);
}
function dashboardMetricListPanel(title,rows,unit,subtitle){
  const max=Math.max(...rows.map(x=>Math.abs(x.value)),1);
  return `<section class="card panel dashboard-custom-panel"><div class="panel-title"><h3>${esc(title)}</h3><span>${esc(subtitle||'')}</span></div><div class="dashboard-metric-list">${rows.length?rows.map(r=>`<div class="dashboard-metric-row"><div class="dashboard-metric-label"><strong>${esc(r.label)}</strong><small>n=${r.n}</small></div><div class="dashboard-metric-track"><i class="${r.value>0?'pos':r.value<0?'neg':'flat'}" style="width:${Math.max(3,Math.abs(r.value)/max*100)}%"></i></div><b class="${r.value>0?'positive':r.value<0?'negative':''}">${dashboardMetricValueText(r.value,unit)}</b></div>`).join(''):'<div class="empty">Sin muestra.</div>'}</div></section>`;
}
function dashboardRecent20Panel(ops,unit){
  const recent=[...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)).slice(-20),s=calcMetricStats(recent,unit,'gross'),pf=Number.isFinite(s.pf)?s.pf.toFixed(2):(s.pf===Infinity?'∞':'0.00');
  return `<section class="card panel dashboard-custom-panel"><div class="panel-title"><div><h3>Últimas 20 operaciones</h3><small>Lectura de la muestra más reciente</small></div><span>${recent.length}/20</span></div><div class="dashboard-mini-stats"><div><span>Resultado</span><strong class="${s.sum>0?'positive':s.sum<0?'negative':''}">${dashboardMetricValueText(s.sum,unit)}</strong></div><div><span>Expectancy</span><strong class="${s.expectancy>0?'positive':s.expectancy<0?'negative':''}">${dashboardMetricValueText(s.expectancy,unit)}</strong></div><div><span>Win rate</span><strong>${s.winRate.toFixed(1)}%</strong></div><div><span>PF</span><strong>${pf}</strong></div><div><span>Max DD</span><strong class="${s.maxDD<0?'negative':''}">${dashboardPlainMetric(s.maxDD,unit)}</strong></div></div></section>`;
}
function dashboardPanelHtml(id,ctx){
  const {ops,metricStats,unit,unitLabel}=ctx;
  if(id==='equity'){
    const svg=dashboardEquitySvgV114(metricStats.equity,unit);
    return `<section class="card panel dashboard-custom-panel"><div class="panel-title dashboard-equity-title"><div><h3>Equity en ${esc(unitLabel)}</h3><small>Curva acumulada del plan</small></div><strong>${ops.length?`${dashboardMetricValueText(metricStats.sum,unit)} acumulado`:'sin datos'}</strong></div><div class="chart-wrap">${svg}</div></section>`;
  }
  if(id==='setupCount')return dashboardCountPanel('Operaciones por setup',dashboardTopCounts(ops,'setup'),planLabel(getCurrentPlan()));
  if(id==='contextCount')return dashboardCountPanel('Operaciones por contexto',dashboardTopCounts(ops,'context'),'frecuencia de muestra');
  if(id==='setupExpectancy')return dashboardMetricListPanel('Expectancy por setup',dashboardGroupedMetric(ops,'setup',unit),unit,unitLabel);
  if(id==='contextExpectancy')return dashboardMetricListPanel('Expectancy por contexto',dashboardGroupedMetric(ops,'context',unit),unit,unitLabel);
  if(id==='recent20')return dashboardRecent20Panel(ops,unit);
  return '';
}
function dashboardSecondaryHtml(id,ctx){
  const {ops,baseStats,unit,unitLabel}=ctx;
  if(id==='mfe'){const v=dashboardExcursionAverage(ops,'mfe',unit);return `<section class="card panel dashboard-secondary-card"><div class="panel-title"><h3>MFE medio</h3><span>${esc(unitLabel)}</span></div><div class="kpi value">${dashboardPlainMetric(v,unit)}</div><div class="help">Potencial favorable observado.</div></section>`;}
  if(id==='mae'){const v=dashboardExcursionAverage(ops,'mae',unit);return `<section class="card panel dashboard-secondary-card"><div class="panel-title"><h3>MAE medio</h3><span>${esc(unitLabel)}</span></div><div class="kpi value">${dashboardPlainMetric(v,unit)}</div><div class="help">Excursión adversa observada.</div></section>`;}
  if(id==='currentBlock')return `<section class="card panel dashboard-secondary-card"><div class="panel-title"><h3>Bloque actual</h3><span>20 trades</span></div><div class="kpi value">${baseStats.n?Math.floor((baseStats.n-1)/20)+1:0}</div><div class="help">Agrupación cronológica dentro de este plan.</div></section>`;
  return '';
}
function dashboardCustomizerRows(group,defs){
  const active=dashboardCustomizeDraft?.[group]||[],map=new Map(defs),ordered=[...active,...defs.map(x=>x[0]).filter(id=>!active.includes(id))];
  return `<div class="dashboard-config-list">${ordered.map(id=>{const enabled=active.includes(id),idx=active.indexOf(id);return `<div class="dashboard-config-row ${enabled?'enabled':'disabled'}"><label><input type="checkbox" ${enabled?'checked':''} onchange="dashboardToggleDraft('${group}','${id}',this.checked)"><span>${esc(map.get(id)||id)}</span></label><div class="dashboard-config-order">${enabled?`<button class="btn tiny ghost" type="button" onclick="dashboardMoveDraft('${group}','${id}',-1)" ${idx<=0?'disabled':''}>↑</button><button class="btn tiny ghost" type="button" onclick="dashboardMoveDraft('${group}','${id}',1)" ${idx>=active.length-1?'disabled':''}>↓</button>`:'<span>oculto</span>'}</div></div>`;}).join('')}</div>`;
}
function dashboardCustomizerBody(){
  return `<div class="notice dashboard-config-note"><strong>Vista propia de este Trading Plan.</strong> Marca lo que quieras ver y usa ↑ ↓ para decidir el orden. La configuración se guarda con el plan y se sincroniza como el resto de sus datos.</div><div class="dashboard-config-grid"><section><h4>Métricas superiores</h4><p>Tarjetas rápidas de lectura.</p>${dashboardCustomizerRows('kpis',DASHBOARD_KPI_DEFS)}</section><section><h4>Gráficos y paneles</h4><p>Zona analítica principal.</p>${dashboardCustomizerRows('panels',DASHBOARD_PANEL_DEFS)}</section><section><h4>Tarjetas secundarias</h4><p>Información complementaria.</p>${dashboardCustomizerRows('secondary',DASHBOARD_SECONDARY_DEFS)}</section></div>`;
}
function openDashboardCustomizer(){
  dashboardCustomizeDraft=clone(dashboardConfigForPlan());
  document.body.insertAdjacentHTML('beforeend',modalShell('Personalizar Dashboard',dashboardCustomizerBody(),`<button class="btn ghost" onclick="dashboardResetDraft()">Restaurar predeterminado</button><button class="btn" onclick="closeModal();dashboardCustomizeDraft=null">Cancelar</button><button class="btn primary" onclick="saveDashboardCustomization()">Guardar Dashboard</button>`));
}
function dashboardRefreshCustomizer(){const body=document.querySelector('.modal-backdrop .modal-body');if(body)body.innerHTML=dashboardCustomizerBody();}
function dashboardToggleDraft(group,id,checked){
  if(!dashboardCustomizeDraft||!['kpis','panels','secondary'].includes(group))return;
  let arr=dashboardCustomizeDraft[group]||[];arr=arr.filter(x=>x!==id);if(checked)arr.push(id);dashboardCustomizeDraft[group]=arr;dashboardRefreshCustomizer();
}
function dashboardMoveDraft(group,id,delta){
  if(!dashboardCustomizeDraft)return;const arr=dashboardCustomizeDraft[group]||[],i=arr.indexOf(id),j=i+Number(delta||0);if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];dashboardRefreshCustomizer();
}
function dashboardResetDraft(){dashboardCustomizeDraft=clone(DASHBOARD_DEFAULT_CONFIG);dashboardRefreshCustomizer();}
function saveDashboardCustomization(){
  const p=getCurrentPlan();if(!p||!dashboardCustomizeDraft)return;
  const total=(dashboardCustomizeDraft.kpis?.length||0)+(dashboardCustomizeDraft.panels?.length||0)+(dashboardCustomizeDraft.secondary?.length||0);
  if(!total)return alert('Deja al menos una métrica o panel visible.');
  p.dashboardConfig=clone(dashboardCustomizeDraft);p.updatedAt=new Date().toISOString();persist();dashboardCustomizeDraft=null;closeModal();render();
}

/* Dashboard V15: la unidad sigue siendo una vista local; la composición se guarda por Trading Plan. */
dashboard=function(){
  const ops=currentOps(),baseStats=calcStats(ops),unit=['r','ticks','usd'].includes(window.__trDashboardUnit)?window.__trDashboardUnit:'r',metricStats=calcMetricStats(ops,unit,'gross'),unitLabel=metricUnitLabel(unit),config=dashboardConfigForPlan();
  const ctx={ops,baseStats,metricStats,unit,unitLabel};
  const unitButtons=`<div class="metric-switch dashboard-unit-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${unit===v?'active':''}" type="button" onclick="window.setDashboardUnit('${v}')">${l}</button>`).join('')}</div>`;
  const actions=`${unitButtons}<button class="btn" onclick="openDashboardCustomizer()">⚙ Personalizar</button><button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button><button class="btn" onclick="openImportModal()">Importar Ankora</button>`;
  const kpisHtml=config.kpis.map(id=>dashboardKpiHtml(id,ctx)).filter(Boolean).join('');
  const panelsHtml=config.panels.map(id=>dashboardPanelHtml(id,ctx)).filter(Boolean).join('');
  const secondaryHtml=config.secondary.map(id=>dashboardSecondaryHtml(id,ctx)).filter(Boolean).join('');
  return `${pageHead('Dashboard','Tu panel de control del Trading Plan. Unidad local; composición personalizada y guardada por plan.',actions)}${activePlanBanner()}${kpisHtml?`<div class="kpis dashboard-kpis-custom">${kpisHtml}</div>`:''}${panelsHtml?`<div class="dashboard-panel-grid">${panelsHtml}</div>`:''}${secondaryHtml?`<div class="dashboard-secondary-grid">${secondaryHtml}</div>`:''}${!kpisHtml&&!panelsHtml&&!secondaryHtml?'<div class="empty">El Dashboard no tiene módulos visibles. Pulsa Personalizar para añadirlos.</div>':''}`;
};

const shellV15Base=shell;
shell=function(){
  return shellV15Base()
    .replace(V14_APP_LABEL,V15_APP_LABEL)
    .replace('Motor cloud V9.2 Conflict Guard intacto. Calendario avanzado + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Dashboard personalizable + Calendario + Research Grid + Exit Lab sobre la misma base estable.');
};
Object.assign(window,{openDashboardCustomizer,dashboardToggleDraft,dashboardMoveDraft,dashboardResetDraft,saveDashboardCustomization});
render();
/* ===== END V15 PATCH ===== */

/* ===== V16 PATCH · Checklist + Cumplimiento del Trading Plan ===== */
const V16_APP_LABEL='V16 · Plan Compliance';
const COMPLIANCE_CATEGORIES=['Contexto','Entrada','Confirmación','Riesgo','Ejecución','Gestión','Psicológico','Otro'];
let complianceViewState={unit:'r',basis:'net',setup:'',context:'',ruleId:''};
let editingComplianceRuleId=null;

function ensurePlanCompliance(p){
  if(!p)return p;
  p.complianceChecklist=Array.isArray(p.complianceChecklist)?p.complianceChecklist:[];
  p.complianceChecklist=p.complianceChecklist.map((r,i)=>({
    id:r?.id||uid('CHK'),name:String(r?.name||r?.label||`Regla ${i+1}`),category:COMPLIANCE_CATEGORIES.includes(r?.category)?r.category:'Otro',
    description:String(r?.description||''),required:r?.required!==false,active:r?.active!==false,createdAt:r?.createdAt||new Date().toISOString(),updatedAt:r?.updatedAt||new Date().toISOString()
  }));
  return p;
}
state.tradingPlans.forEach(ensurePlanCompliance);

const makeBlankPlanV16Base=makeBlankPlan;
makeBlankPlan=function(meta={}){const p=makeBlankPlanV16Base(meta);ensurePlanCompliance(p);return p;};
const normalizePlanV16Base=normalizePlan;
normalizePlan=function(p,instruments){const out=normalizePlanV16Base(p,instruments);ensurePlanCompliance(out);return out;};
const normalizeStateV16Base=normalizeState;
normalizeState=function(raw){const out=normalizeStateV16Base(raw);(out.tradingPlans||[]).forEach(ensurePlanCompliance);return out;};

function complianceRuleById(id,p=getCurrentPlan()){ensurePlanCompliance(p);return p?.complianceChecklist?.find(r=>r.id===id)||null;}
function complianceRuleForm(rule={}){
  const cats=COMPLIANCE_CATEGORIES.map(x=>({value:x,label:x}));
  return `<div class="form-section"><h4>Regla del checklist</h4><div class="form-grid">${field('Nombre / condición','check-name','text',esc(rule.name||''),'span2')}${selectObjField('Categoría','check-category',cats,rule.category||'Entrada')}${selectObjField('Importancia','check-required',[{value:'true',label:'Obligatoria'},{value:'false',label:'Opcional'}],String(rule.required!==false))}${selectObjField('Estado','check-active',[{value:'true',label:'Activa'},{value:'false',label:'Inactiva'}],String(rule.active!==false))}${field('Descripción / criterio de validación','check-description','textarea',esc(rule.description||''),'full')}</div><div class="notice" style="margin-top:12px">La operación guarda una copia de estas reglas en el momento de evaluarla. Si después cambias el checklist del plan, el histórico no se reescribe.</div></div>`;
}
function openComplianceRuleModal(id=null){
  const p=getCurrentPlan();if(!p)return;ensurePlanCompliance(p);editingComplianceRuleId=id;const r=id?complianceRuleById(id,p):{name:'',category:'Entrada',required:true,active:true,description:''};
  document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar regla de checklist':'Nueva regla de checklist',complianceRuleForm(r),`<button class="btn" onclick="closeModal();editingComplianceRuleId=null">Cancelar</button><button class="btn primary" onclick="saveComplianceRule()">Guardar regla</button>`));
}
function saveComplianceRule(){
  const p=getCurrentPlan(),g=n=>document.getElementById(`f-${n}`)?.value||'';if(!p)return;ensurePlanCompliance(p);const name=g('check-name').trim();if(!name)return alert('Escribe el nombre o condición de la regla.');
  const duplicate=p.complianceChecklist.find(r=>r.name.toLowerCase()===name.toLowerCase()&&r.id!==editingComplianceRuleId);if(duplicate)return alert('Ya existe una regla con ese nombre en este Trading Plan.');
  const old=editingComplianceRuleId?complianceRuleById(editingComplianceRuleId,p):null,now=new Date().toISOString();const item={id:old?.id||uid('CHK'),name,category:COMPLIANCE_CATEGORIES.includes(g('check-category'))?g('check-category'):'Otro',required:g('check-required')!=='false',active:g('check-active')!=='false',description:g('check-description').trim(),createdAt:old?.createdAt||now,updatedAt:now};
  const idx=p.complianceChecklist.findIndex(r=>r.id===item.id);if(idx>=0)p.complianceChecklist[idx]=item;else p.complianceChecklist.push(item);p.updatedAt=now;editingComplianceRuleId=null;persist();closeModal();render();
}
function deleteComplianceRule(id){const p=getCurrentPlan(),r=complianceRuleById(id,p);if(!p||!r)return;if(!confirm(`¿Eliminar "${r.name}" del checklist actual?\n\nLas operaciones ya evaluadas conservarán su copia histórica de esta regla.`))return;p.complianceChecklist=p.complianceChecklist.filter(x=>x.id!==id);p.updatedAt=new Date().toISOString();persist();render();}
function moveComplianceRule(id,delta){const p=getCurrentPlan();if(!p)return;ensurePlanCompliance(p);const i=p.complianceChecklist.findIndex(r=>r.id===id),j=i+Number(delta||0);if(i<0||j<0||j>=p.complianceChecklist.length)return;[p.complianceChecklist[i],p.complianceChecklist[j]]=[p.complianceChecklist[j],p.complianceChecklist[i]];p.updatedAt=new Date().toISOString();persist();render();}
function complianceChecklistPanel(p){
  ensurePlanCompliance(p);const rows=p.complianceChecklist||[],active=rows.filter(r=>r.active).length,required=rows.filter(r=>r.active&&r.required).length;
  return `<section class="card panel config-wide compliance-config-hero"><div class="panel-title"><div><h3>Checklist operativo · ${esc(planLabel(p))}</h3><div class="help">Define las condiciones que quieres verificar trade a trade. El análisis posterior separa cumplimiento de resultado sin modificar la disciplina emocional.</div></div><button class="btn primary small" onclick="openComplianceRuleModal()">+ Nueva regla</button></div><div class="compliance-config-kpis"><div><span>Reglas</span><strong>${rows.length}</strong></div><div><span>Activas</span><strong>${active}</strong></div><div><span>Obligatorias</span><strong>${required}</strong></div></div><div class="notice">Checklist y <strong>Disciplina</strong> son capas distintas: el checklist mide condiciones objetivas del plan; Disciplina puede seguir reflejando tu valoración global de la ejecución.</div></section><section class="card panel config-wide compliance-config-list"><div class="panel-title"><div><h3>Reglas del plan</h3><div class="help">El orden que ves aquí será el orden mostrado al registrar una operación.</div></div></div>${rows.length?rows.map((r,i)=>`<article class="compliance-rule-card ${r.active?'':'inactive'}"><div class="compliance-rule-main"><div class="compliance-rule-tags"><span class="badge">${esc(r.category)}</span><span class="badge ${r.required?'win':''}">${r.required?'Obligatoria':'Opcional'}</span>${r.active?'':'<span class="badge">Inactiva</span>'}</div><strong>${esc(r.name)}</strong><p>${esc(r.description||'Sin descripción adicional.')}</p></div><div class="compliance-rule-actions"><button class="btn tiny ghost" onclick="moveComplianceRule('${r.id}',-1)" ${i===0?'disabled':''}>↑</button><button class="btn tiny ghost" onclick="moveComplianceRule('${r.id}',1)" ${i===rows.length-1?'disabled':''}>↓</button><button class="btn small" onclick="openComplianceRuleModal('${r.id}')">Editar</button>${simpleSaveButton('checklistRule',r.id)}<button class="btn small danger" onclick="deleteComplianceRule('${r.id}')">Eliminar</button></div></article>`).join(''):'<div class="empty">Todavía no hay reglas. Añade únicamente condiciones que realmente quieras medir de forma consistente.</div>'}</section>`;
}

/* Biblioteca Simple: las reglas del checklist también se pueden reutilizar entre Trading Plans. */
const libraryTypeLabelV16Base=libraryTypeLabel;
libraryTypeLabel=function(type){return type==='checklistRule'?'Regla de checklist':libraryTypeLabelV16Base(type);};
const libraryTypeOrderV16Base=libraryTypeOrder;
libraryTypeOrder=function(type){return type==='checklistRule'?8:libraryTypeOrderV16Base(type);};
const libraryPayloadComparableV16Base=libraryPayloadComparable;
libraryPayloadComparable=function(type,payload){const p=libraryPayloadComparableV16Base(type,payload);if(type==='checklistRule'&&p&&typeof p==='object'){delete p.id;delete p.createdAt;delete p.updatedAt;}return p;};
const simpleTemplateDescriptorV16Base=simpleTemplateDescriptor;
simpleTemplateDescriptor=function(type,ref,p=getCurrentPlan()){
  if(type!=='checklistRule')return simpleTemplateDescriptorV16Base(type,ref,p);ensurePlanCompliance(p);const clean=decodeURIComponent(String(ref||'')),r=(p?.complianceChecklist||[]).find(x=>x.id===clean||x.name===clean);return r?{type,name:r.name,payload:clone(r)}:null;
};
const planHasLibraryEquivalentV16Base=planHasLibraryEquivalent;
planHasLibraryEquivalent=function(p,item){if(item?.type==='checklistRule'){ensurePlanCompliance(p);return (p?.complianceChecklist||[]).some(r=>r.name===item.name);}return planHasLibraryEquivalentV16Base(p,item);};
const applyLibraryItemToPlanV16Base=applyLibraryItemToPlan;
applyLibraryItemToPlan=function(item,p){
  if(item?.type!=='checklistRule')return applyLibraryItemToPlanV16Base(item,p);ensurePlanCompliance(p);if(planHasLibraryEquivalent(p,item))return {status:'exists'};const r=clone(item.payload||{});r.id=uid('CHK');r.name=item.name;r.createdAt=new Date().toISOString();r.updatedAt=r.createdAt;p.complianceChecklist.push(r);addLibraryLink(p,item,item.name);p.updatedAt=new Date().toISOString();return {status:'added'};
};
const simpleLibrarySummaryV16Base=simpleLibrarySummary;
simpleLibrarySummary=function(i){if(i?.type==='checklistRule'){const p=i.payload||{};return `${p.category||'Otro'} · ${p.required===false?'Opcional':'Obligatoria'}${p.description?` · ${p.description}`:''}`;}return simpleLibrarySummaryV16Base(i);};
const simpleLibraryPanelV16Base=simpleLibraryPanel;
simpleLibraryPanel=function(){
  const base=simpleLibraryPanelV16Base(),p=getCurrentPlan(),rows=simpleLibraryItems().filter(i=>i.type==='checklistRule');if(!rows.length)return base;
  const section=`<section class="card panel config-wide master-lib-section"><div class="panel-title"><div><h3>Reglas de checklist</h3><div class="help">${rows.length} guardada(s)</div></div></div><div class="master-lib-grid">${rows.map(i=>{const exists=planHasLibraryEquivalent(p,i);return `<article class="master-lib-card"><div class="master-lib-head"><div><strong>${esc(i.name)}</strong></div></div><div class="master-lib-meta">${esc(simpleLibrarySummary(i))}${i.sourcePlanLabel?`<br>Guardado desde: ${esc(i.sourcePlanLabel)}`:''}</div><div class="master-lib-actions"><button class="btn small primary" onclick="addSimpleLibraryItem('${i.id}')" ${exists?'disabled':''}>${exists?'Ya está en este plan':'Añadir al plan'}</button><button class="btn small danger" onclick="deleteSavedLibraryItem('${i.id}')">Eliminar</button></div></article>`;}).join('')}</div></section>`;
  return base+section;
};

const configTabsV16Base=configTabs;
configTabs=function(p){
  const tabs=[['instruments','Contratos','Biblioteca global'],['library','Biblioteca','Plantillas guardadas'],['management','Gestión','Estrategias y salidas'],['taxonomy','Taxonomías','Setups, VD, contexto y estructura'],['checklist','Checklist','Reglas verificables por trade'],['visual','Referencias visuales','Galería del plan'],['emotional','Emocional','Estados y comportamientos'],['riskrules','Riesgo','Reglas diarias/semanales'],['data','Datos y seguridad','Backup e integridad'],['cloud','Nube','Supabase y sincronización']];
  return `<div class="config-tabs">${tabs.map(([id,label,desc])=>`<button class="config-tab ${configTab===id?'active':''}" onclick="setConfigTab('${id}')"><strong>${label}</strong><span>${desc}</span></button>`).join('')}</div>`;
};
const configContentV16Base=configContent;
configContent=function(p){if(configTab==='checklist')return complianceChecklistPanel(p);return configContentV16Base(p);};

function operationChecklistRules(o,p){
  ensurePlanCompliance(p);
  if(o?.compliance?.evaluated&&Array.isArray(o.compliance.responses)&&o.compliance.responses.length)return o.compliance.responses.map(x=>({id:x.id||uid('CHKOLD'),name:x.name||x.label||'Regla histórica',category:x.category||'Otro',description:x.description||'',required:x.required!==false,active:true,checked:!!x.checked,historical:true}));
  return (p?.complianceChecklist||[]).filter(r=>r.active).map(r=>({...clone(r),checked:false}));
}
function operationChecklistSection(o,p){
  const rules=operationChecklistRules(o,p);if(!rules.length)return '';
  const evaluated=o?!!o?.compliance?.evaluated:true;
  return `<div class="form-section operation-checklist-section"><div class="section-title-row"><div><h4>3 · Checklist del Trading Plan</h4><div class="help">Marca las condiciones realmente cumplidas. Se guarda una copia histórica de las reglas evaluadas.</div></div><button class="btn small ghost" type="button" onclick="markAllOperationChecklist(true)">Marcar todas</button></div><div class="form-grid"><label class="field"><span>Evaluación</span><select id="plan-check-evaluated" class="select" onchange="toggleOperationChecklistEvaluation()"><option value="yes" ${evaluated?'selected':''}>Evaluado</option><option value="no" ${!evaluated?'selected':''}>No evaluado</option></select></label><div class="field span2"><label>Resumen</label><div id="plan-check-summary" class="readonly-box">—</div></div></div><div id="plan-check-rules" class="operation-checklist-grid ${evaluated?'':'hidden'}">${rules.map(r=>`<label class="operation-check-item ${r.required?'required':''}"><input type="checkbox" data-plan-check-rule="1" data-check-id="${esc(r.id)}" data-check-name="${esc(r.name)}" data-check-category="${esc(r.category)}" data-check-description="${esc(r.description||'')}" data-check-required="${r.required?'true':'false'}" ${r.checked?'checked':''} onchange="updateOperationChecklistPreview()"><span><strong>${esc(r.name)}</strong><small>${esc(r.category)} · ${r.required?'Obligatoria':'Opcional'}${r.historical?' · snapshot histórico':''}</small>${r.description?`<em>${esc(r.description)}</em>`:''}</span></label>`).join('')}</div></div>`;
}
function toggleOperationChecklistEvaluation(){const yes=document.getElementById('plan-check-evaluated')?.value==='yes';document.getElementById('plan-check-rules')?.classList.toggle('hidden',!yes);updateOperationChecklistPreview();}
function markAllOperationChecklist(checked=true){document.querySelectorAll('[data-plan-check-rule="1"]').forEach(x=>x.checked=!!checked);updateOperationChecklistPreview();}
function updateOperationChecklistPreview(){
  const el=document.getElementById('plan-check-summary');if(!el)return;const evaluated=document.getElementById('plan-check-evaluated')?.value==='yes';if(!evaluated){el.textContent='No evaluado · no entra en estadísticas de cumplimiento';return;}
  const boxes=[...document.querySelectorAll('[data-plan-check-rule="1"]')],checked=boxes.filter(x=>x.checked).length,req=boxes.filter(x=>x.dataset.checkRequired==='true'),reqOk=req.filter(x=>x.checked).length,score=boxes.length?checked/boxes.length*100:0;el.innerHTML=`<strong>${score.toFixed(0)}%</strong> · ${checked}/${boxes.length} reglas · obligatorias ${reqOk}/${req.length}`;
}
function readOperationComplianceDraft(){
  const select=document.getElementById('plan-check-evaluated');if(!select)return null;const evaluated=select.value==='yes',boxes=[...document.querySelectorAll('[data-plan-check-rule="1"]')];if(!evaluated)return {evaluated:false,responses:[],score:null,strict:null,evaluatedAt:new Date().toISOString()};
  const responses=boxes.map(x=>({id:x.dataset.checkId||uid('CHK'),name:x.dataset.checkName||'Regla',category:x.dataset.checkCategory||'Otro',description:x.dataset.checkDescription||'',required:x.dataset.checkRequired==='true',checked:!!x.checked})),required=responses.filter(r=>r.required),basis=required.length?required:responses,strict=basis.every(r=>r.checked),score=responses.length?responses.filter(r=>r.checked).length/responses.length*100:0;
  return {evaluated:true,responses,score,strict,evaluatedAt:new Date().toISOString()};
}
const operationFormV16Base=operationForm;
operationForm=function(o,r,p){let html=operationFormV16Base(o,r,p),section=operationChecklistSection(o,p);if(!section)return html;html=html.replace('<div class="form-section"><h4>3 · Ejecución y resultado</h4>',`${section}<div class="form-section"><h4>4 · Ejecución y resultado</h4>`);setTimeout(updateOperationChecklistPreview,0);return html;};

const saveOperationFromFormV16Base=saveOperationFromForm;
saveOperationFromForm=async function(){
  const draft=readOperationComplianceDraft(),targetId=editingId||null,beforeIds=new Set(state.operations.map(o=>o.id)),planId=state.currentPlanId;
  if(draft?.evaluated){const failed=draft.responses.filter(r=>r.required&&!r.checked);if(failed.length&&!confirm(`Hay ${failed.length} regla(s) obligatoria(s) sin cumplir:\n\n${failed.map(r=>'• '+r.name).join('\n')}\n\n¿Guardar igualmente la operación como incumplimiento del checklist?`))return;}
  await saveOperationFromFormV16Base();
  let op=targetId?state.operations.find(x=>x.id===targetId):state.operations.find(x=>x.tradingPlanId===planId&&!beforeIds.has(x.id));if(op&&draft){op.compliance=clone(draft);op.updatedAt=new Date().toISOString();persist();render();}
};
const openOperationModalV16Base=openOperationModal;
openOperationModal=function(id=null){openOperationModalV16Base(id);setTimeout(updateOperationChecklistPreview,0);};

function complianceOperationDetail(o){
  const c=o?.compliance;if(!c?.evaluated)return `<section class="form-section"><div class="panel-title"><div><h3>Checklist del plan</h3><small>No evaluado en esta operación</small></div></div><div class="empty">Esta operación no contiene evaluación detallada del checklist.</div></section>`;
  const responses=c.responses||[],fails=responses.filter(r=>!r.checked);return `<section class="form-section"><div class="panel-title"><div><h3>Checklist del plan</h3><small>Snapshot guardado con la operación</small></div><strong class="${c.strict?'positive':fails.length?'negative':''}">${Number(c.score||0).toFixed(0)}%</strong></div><div class="trade-checklist-detail">${responses.map(r=>`<div class="${r.checked?'ok':'fail'}"><span>${r.checked?'✓':'×'}</span><div><strong>${esc(r.name)}</strong><small>${esc(r.category||'Otro')} · ${r.required===false?'Opcional':'Obligatoria'}</small></div></div>`).join('')}</div></section>`;
}
const viewOperationV16Base=viewOperation;
viewOperation=function(id){viewOperationV16Base(id);const o=state.operations.find(x=>x.id===id),body=document.querySelector('.modal-backdrop .modal-body');if(o&&body)body.insertAdjacentHTML('beforeend',complianceOperationDetail(o));};

function complianceSetUnit(v){complianceViewState.unit=['r','ticks','usd'].includes(v)?v:'r';render();}
function complianceSetBasis(v){complianceViewState.basis=v==='gross'?'gross':'net';render();}
function complianceSetFilter(key,v){if(['setup','context','ruleId'].includes(key))complianceViewState[key]=v||'';render();}
function complianceResetFilters(){complianceViewState.setup='';complianceViewState.context='';complianceViewState.ruleId='';render();}
function complianceBaseOps(){return currentOps().filter(o=>(!complianceViewState.setup||o.setup===complianceViewState.setup)&&(!complianceViewState.context||String(o.h4Context||'')===complianceViewState.context));}
function complianceIsStrict(o){const c=o?.compliance;if(!c?.evaluated)return null;if(typeof c.strict==='boolean')return c.strict;const rs=c.responses||[],req=rs.filter(r=>r.required!==false),basis=req.length?req:rs;return basis.length?basis.every(r=>r.checked):true;}
function complianceScore(o){const c=o?.compliance;if(!c?.evaluated)return null;if(Number.isFinite(Number(c.score)))return Number(c.score);const rs=c.responses||[];return rs.length?rs.filter(r=>r.checked).length/rs.length*100:100;}
function complianceRuleStats(ops){
  const map=new Map();ops.filter(o=>o?.compliance?.evaluated).forEach(o=>(o.compliance.responses||[]).forEach(r=>{const key=String(r.id||r.name),x=map.get(key)||{id:key,name:r.name||'Regla',category:r.category||'Otro',required:r.required!==false,pass:[],fail:[]};(r.checked?x.pass:x.fail).push(o);map.set(key,x);}));
  return [...map.values()].map(x=>{const all=[...x.pass,...x.fail],passS=calcMetricStats(x.pass,complianceViewState.unit,complianceViewState.basis),failS=calcMetricStats(x.fail,complianceViewState.unit,complianceViewState.basis),failedLoss=x.fail.reduce((a,o)=>{const v=opMetricValue(o,complianceViewState.unit,complianceViewState.basis);return a+(v<0?v:0);},0);return {...x,n:all.length,rate:all.length?x.pass.length/all.length*100:0,passS,failS,delta:passS.expectancy-failS.expectancy,failedLoss};}).sort((a,b)=>b.fail.length-a.fail.length||b.delta-a.delta);
}
function complianceMetricSwitch(){return `<div class="metric-switch compliance-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${complianceViewState.unit===v?'active':''}" onclick="complianceSetUnit('${v}')">${l}</button>`).join('')}<i></i><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([v,l])=>`<button class="seg-btn ${complianceViewState.basis===v?'active':''}" onclick="complianceSetBasis('${v}')">${l}</button>`).join('')}</div>`;}
function complianceRuleImpactPanel(rows){
  const damaging=rows.filter(r=>r.fail.length).sort((a,b)=>a.failS.expectancy-b.failS.expectancy).slice(0,8),max=Math.max(...damaging.map(r=>Math.abs(r.failS.expectancy)),1);
  return `<section class="card panel compliance-impact"><div class="panel-title"><div><h3>Incumplimientos observados</h3><small>Ordenados por expectancy de las operaciones donde la regla falló</small></div><span>asociación, no causalidad</span></div>${damaging.length?`<div class="compliance-impact-list">${damaging.map(r=>`<button onclick="complianceSetFilter('ruleId','${encodeURIComponent(r.id)}')"><div><strong>${esc(r.name)}</strong><small>${r.fail.length} incumplimiento(s) · n=${r.n}</small></div><i><span class="${r.failS.expectancy<0?'neg':'pos'}" style="width:${Math.max(4,Math.abs(r.failS.expectancy)/max*100)}%"></span></i><b class="${r.failS.expectancy<0?'negative':r.failS.expectancy>0?'positive':''}">${metricStatText(r.failS.expectancy,complianceViewState.unit)}</b></button>`).join('')}</div>`:'<div class="empty">Todavía no hay incumplimientos evaluados.</div>'}<div class="lab-note">No atribuimos causalidad: mostramos el resultado asociado a las operaciones en las que esa regla quedó sin cumplir.</div></section>`;
}
function complianceRulesTable(rows){
  return `<section class="card panel compliance-rules-panel"><div class="panel-title"><div><h3>Análisis por regla</h3><small>Cumplida vs incumplida dentro de las operaciones evaluadas</small></div><span>${rows.length} reglas históricas</span></div><div class="table-wrap"><table class="table compliance-table"><thead><tr><th>Regla</th><th>Eval.</th><th>Cumpl.</th><th>Exp. cumplida</th><th>Exp. incumplida</th><th>Δ expectancy</th><th>Resultado negativo asociado</th><th></th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.category)} · ${r.required?'Obligatoria':'Opcional'}</small></td><td>${r.n}</td><td>${r.rate.toFixed(0)}%</td><td class="${r.passS.expectancy>0?'positive':r.passS.expectancy<0?'negative':''}">${r.pass.length?metricStatText(r.passS.expectancy,complianceViewState.unit):'—'}</td><td class="${r.failS.expectancy>0?'positive':r.failS.expectancy<0?'negative':''}">${r.fail.length?metricStatText(r.failS.expectancy,complianceViewState.unit):'—'}</td><td class="${r.delta>0?'positive':r.delta<0?'negative':''}">${r.pass.length&&r.fail.length?metricStatText(r.delta,complianceViewState.unit):'—'}</td><td class="${r.failedLoss<0?'negative':''}">${r.fail.length?metricStatText(r.failedLoss,complianceViewState.unit):'—'}</td><td>${r.fail.length?`<button class="btn tiny" onclick="complianceSetFilter('ruleId','${encodeURIComponent(r.id)}')">Ver fallos</button>`:''}</td></tr>`).join(''):'<tr><td colspan="8"><div class="empty">Sin evaluaciones detalladas.</div></td></tr>'}</tbody></table></div></section>`;
}
function complianceOpsTable(ops,ruleRows){
  let rows=ops.filter(o=>o?.compliance?.evaluated),title='Operaciones evaluadas';
  if(complianceViewState.ruleId){const id=decodeURIComponent(complianceViewState.ruleId),rule=ruleRows.find(r=>String(r.id)===String(id));rows=rows.filter(o=>(o.compliance.responses||[]).some(r=>String(r.id||r.name)===String(id)&&!r.checked));title=rule?`Incumplimientos · ${rule.name}`:'Incumplimientos seleccionados';}
  rows=[...rows].sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate));
  return `<section class="card panel compliance-ops-panel"><div class="panel-title"><div><h3>${esc(title)}</h3><small>${complianceViewState.ruleId?'Pulsa Limpiar selección para volver a todas':'Snapshot objetivo + resultado de cada trade'}</small></div>${complianceViewState.ruleId?'<button class="btn small ghost" onclick="complianceSetFilter(\'ruleId\',\'\')">Limpiar selección</button>':`<span>${rows.length} operaciones</span>`}</div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Setup</th><th>Contexto</th><th>Checklist</th><th>Obligatorias</th><th>Resultado</th><th>Disciplina</th><th></th></tr></thead><tbody>${rows.length?rows.map(o=>{const score=complianceScore(o),strict=complianceIsStrict(o),v=opMetricValue(o,complianceViewState.unit,complianceViewState.basis);return `<tr><td>${fmtDateOnly(o.entryDate)}</td><td>${esc(o.setup||'—')}</td><td>${esc(o.h4Context||'—')}</td><td><strong>${score===null?'—':score.toFixed(0)+'%'}</strong></td><td><span class="badge ${strict?'win':'loss'}">${strict?'Cumplidas':'Incumplimiento'}</span></td><td class="${v>0?'positive':v<0?'negative':''}">${metricStatText(v,complianceViewState.unit)}</td><td>${typeof o.discipline==='boolean'?(o.discipline?'Sí':'No'):'—'}</td><td><button class="btn tiny" onclick="viewOperation('${o.id}')">Ver</button></td></tr>`;}).join(''):'<tr><td colspan="8"><div class="empty">No hay operaciones para esta selección.</div></td></tr>'}</tbody></table></div></section>`;
}
function complianceView(){
  const p=getCurrentPlan();ensurePlanCompliance(p);const ops=complianceBaseOps(),evaluated=ops.filter(o=>o?.compliance?.evaluated),strict=evaluated.filter(o=>complianceIsStrict(o)===true),violated=evaluated.filter(o=>complianceIsStrict(o)===false),scores=evaluated.map(complianceScore).filter(v=>v!==null),avgScore=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,strictS=calcMetricStats(strict,complianceViewState.unit,complianceViewState.basis),violS=calcMetricStats(violated,complianceViewState.unit,complianceViewState.basis),ruleRows=complianceRuleStats(ops),coverage=ops.length?evaluated.length/ops.length*100:0,strictRate=evaluated.length?strict.length/evaluated.length*100:0,diff=strictS.expectancy-violS.expectancy;
  const setups=[...new Set(currentOps().map(o=>o.setup).filter(Boolean))].sort(),contexts=[...new Set(currentOps().map(o=>o.h4Context).filter(Boolean))].sort();
  const controls=`${complianceMetricSwitch()}<button class="btn" onclick="setConfigTab('checklist');navigate('config')">⚙ Configurar checklist</button>`;
  const filters=`<section class="card filter-hub compliance-filter"><div class="filter-hub-top"><div><h3>Ámbito de análisis</h3><p>Solo las operaciones con checklist evaluado entran en las métricas de cumplimiento.</p></div><button class="btn small" onclick="complianceResetFilters()">Limpiar</button></div><div class="filter-grid"><label class="filter-field"><span>Setup</span><select class="select" onchange="complianceSetFilter('setup',this.value)"><option value="">Todos</option>${setups.map(x=>`<option value="${esc(x)}" ${complianceViewState.setup===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label class="filter-field"><span>Contexto</span><select class="select" onchange="complianceSetFilter('context',this.value)"><option value="">Todos</option>${contexts.map(x=>`<option value="${esc(x)}" ${complianceViewState.context===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><div class="filter-field wide"><span>Cobertura</span><div class="readonly-box">${evaluated.length}/${ops.length} operaciones evaluadas · ${coverage.toFixed(1)}%</div></div></div></section>`;
  const kpis=`<div class="compliance-kpis">${kpi('Cobertura checklist',`${coverage.toFixed(1)}%`,`${evaluated.length}/${ops.length} operaciones`)}${kpi('Cumplimiento medio',evaluated.length?`${avgScore.toFixed(1)}%`:'—','todas las reglas evaluadas')}${kpi('Obligatorias 100%',evaluated.length?`${strictRate.toFixed(1)}%`:'—',`${strict.length}/${evaluated.length} evaluadas`)}${kpi('Expectancy · 100%',strict.length?metricStatText(strictS.expectancy,complianceViewState.unit):'—',`${strict.length} operaciones`)}${kpi('Expectancy · con fallos',violated.length?metricStatText(violS.expectancy,complianceViewState.unit):'—',`${violated.length} operaciones`)}${kpi('Δ expectancy',strict.length&&violated.length?metricStatText(diff,complianceViewState.unit):'—','100% − incumplimiento')}</div>`;
  const noRules=!(p.complianceChecklist||[]).length?`<div class="notice compliance-empty-warning"><strong>Este Trading Plan todavía no tiene checklist.</strong> Configura reglas objetivas y empezarán a aparecer en las nuevas operaciones.</div>`:'';
  return `${pageHead('Cumplimiento del Plan','Mide qué reglas se cumplen realmente y contrasta su asociación con el rendimiento. Checklist objetivo separado de la disciplina emocional.',controls)}${activePlanBanner()}${noRules}${filters}${kpis}<div class="compliance-grid">${complianceRuleImpactPanel(ruleRows)}${complianceRulesTable(ruleRows)}</div>${complianceOpsTable(ops,ruleRows)}<div class="notice compliance-method-note"><strong>Criterio estadístico:</strong> una operación antigua o importada sin checklist detallado queda como <em>no evaluada</em>, nunca como incumplimiento. El TPCompliance de Ankora puede seguir alimentando Disciplina, pero no inventamos qué regla concreta se cumplió o falló.</div>${complianceViewState.unit==='ticks'?mixedInstrumentWarning(ops):''}`;
}

/* Dashboard V16: widgets opcionales de cumplimiento. */
if(!DASHBOARD_KPI_DEFS.some(x=>x[0]==='compliance'))DASHBOARD_KPI_DEFS.push(['compliance','Cumplimiento checklist']);
if(!DASHBOARD_PANEL_DEFS.some(x=>x[0]==='complianceRules'))DASHBOARD_PANEL_DEFS.push(['complianceRules','Cumplimiento por regla']);
const dashboardKpiHtmlV16Base=dashboardKpiHtml;
dashboardKpiHtml=function(id,ctx){if(id!=='compliance')return dashboardKpiHtmlV16Base(id,ctx);const evals=ctx.ops.filter(o=>o?.compliance?.evaluated),scores=evals.map(complianceScore).filter(v=>v!==null),avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;return kpi('Cumplimiento checklist',evals.length?`${avg.toFixed(1)}%`:'—',`${evals.length}/${ctx.ops.length} evaluadas`);};
function dashboardComplianceRulesPanel(ops){const prevUnit=complianceViewState.unit,prevBasis=complianceViewState.basis;complianceViewState.unit='r';complianceViewState.basis='net';const rows=complianceRuleStats(ops).sort((a,b)=>a.rate-b.rate).slice(0,7);complianceViewState.unit=prevUnit;complianceViewState.basis=prevBasis;return `<section class="card panel dashboard-custom-panel"><div class="panel-title"><div><h3>Cumplimiento por regla</h3><small>Reglas con menor tasa de cumplimiento</small></div><button class="btn tiny ghost" onclick="navigate('compliance')">Abrir</button></div><div class="dashboard-compliance-list">${rows.length?rows.map(r=>`<div><span><strong>${esc(r.name)}</strong><small>n=${r.n} · ${r.fail.length} fallos</small></span><i><b style="width:${r.rate}%"></b></i><em>${r.rate.toFixed(0)}%</em></div>`).join(''):'<div class="empty">Sin checklist evaluado.</div>'}</div></section>`;}
const dashboardPanelHtmlV16Base=dashboardPanelHtml;
dashboardPanelHtml=function(id,ctx){if(id==='complianceRules')return dashboardComplianceRulesPanel(ctx.ops);return dashboardPanelHtmlV16Base(id,ctx);};

const shellV16Base=shell;
shell=function(){let html=shellV16Base(),labButton=navBtn('lab','⌁','Laboratorio');html=html.replace(labButton,navBtn('compliance','✓','Cumplimiento')+labButton);return html.replace(V15_APP_LABEL,V16_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Dashboard personalizable + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Plan Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');};
render=function(){
  document.getElementById('app').innerHTML=shell();const view=document.getElementById('view');
  view.innerHTML=currentView==='dashboard'?dashboard():currentView==='operations'?operations():currentView==='calendar'?calendarView():currentView==='compliance'?complianceView():currentView==='lab'?analyticsLab():currentView==='gallery'?gallery():currentView==='journal'?journal():currentView==='blocks'?blocks():currentView==='plans'?plansView():config();
  setTimeout(hydrateImageElements,0);
};
Object.assign(window,{openComplianceRuleModal,saveComplianceRule,deleteComplianceRule,moveComplianceRule,toggleOperationChecklistEvaluation,markAllOperationChecklist,updateOperationChecklistPreview,complianceSetUnit,complianceSetBasis,complianceSetFilter,complianceResetFilters});
render();
/* ===== END V16 PATCH ===== */

/* ===== V17 PATCH · Estudios guardados ===== */
const V17_APP_LABEL='V17.1 · Estudios + PF';

function ensurePlanStudies(p){
  if(!p)return p;
  if(!Array.isArray(p.savedStudies))p.savedStudies=[];
  p.savedStudies=p.savedStudies.map(s=>({
    id:s.id||uid('STUDY'),
    name:String(s.name||'Estudio sin nombre'),
    description:String(s.description||''),
    createdAt:s.createdAt||new Date().toISOString(),
    updatedAt:s.updatedAt||s.createdAt||new Date().toISOString(),
    lab:{...labStudyDefaultState(),...(s.lab||{})},
    research:{rowDim:'setup',colDim:'context',metric:'expectancy',minN:1,maxCats:12,...(s.research||{})},
    exit:{tpR:2,beTrigger:1,...(s.exit||{})}
  }));
  return p;
}
function labStudyDefaultState(){
  return {unit:'r',basis:'net',dateFrom:'',dateTo:'',timeFrom:'',timeTo:'',direction:'',setup:'',vd:'',nr:'',hypothesis:'',hour:'',context:'',risk:'',result:'',behavior:'',emotion:'',focus:'',stress:'',rMin:'',rMax:'',heatMetric:'expectancy',scatterX:'mae',histBin:.25,edgeX:'setup',edgeY:'context',rollingWindow:20,rollingMetric:'expectancy'};
}
state.tradingPlans.forEach(ensurePlanStudies);
const makeBlankPlanV17Base=makeBlankPlan;
makeBlankPlan=function(meta={}){const p=makeBlankPlanV17Base(meta);ensurePlanStudies(p);return p;};
const normalizePlanV17Base=normalizePlan;
normalizePlan=function(p,instruments){const out=normalizePlanV17Base(p,instruments);ensurePlanStudies(out);return out;};
const normalizeStateV17Base=normalizeState;
normalizeState=function(raw){const out=normalizeStateV17Base(raw);(out.tradingPlans||[]).forEach(ensurePlanStudies);return out;};

let labStudiesUi={selectedId:'',activeId:'',compareId:''};

function currentStudySnapshot(){
  const lab={...labStudyDefaultState()};
  Object.keys(lab).forEach(k=>{if(labState[k]!==undefined)lab[k]=clone(labState[k]);});
  return {
    lab,
    research:{rowDim:researchGridState.rowDim,colDim:researchGridState.colDim,metric:researchGridState.metric,minN:researchGridState.minN,maxCats:researchGridState.maxCats},
    exit:{tpR:exitLabState.tpR,beTrigger:exitLabState.beTrigger}
  };
}
function studyComparableSnapshot(s){return {lab:s?.lab||{},research:s?.research||{},exit:s?.exit||{}};}
function studySignature(v){try{return JSON.stringify(v);}catch{return '';}}
function activeStudyDirty(){
  const p=getCurrentPlan();ensurePlanStudies(p);const s=p.savedStudies.find(x=>x.id===labStudiesUi.activeId);if(!s)return false;
  return studySignature(currentStudySnapshot())!==studySignature(studyComparableSnapshot(s));
}
function selectedStudy(){const p=getCurrentPlan();ensurePlanStudies(p);return p.savedStudies.find(x=>x.id===labStudiesUi.selectedId)||null;}
function reconcileStudyUi(){
  const p=getCurrentPlan();ensurePlanStudies(p);const ids=new Set(p.savedStudies.map(x=>x.id));
  if(!ids.has(labStudiesUi.selectedId))labStudiesUi.selectedId=p.savedStudies[0]?.id||'';
  if(!ids.has(labStudiesUi.activeId))labStudiesUi.activeId='';
  if(!ids.has(labStudiesUi.compareId))labStudiesUi.compareId='';
}
function studyFilterSummary(s){
  const f=s?.lab||{},parts=[];
  const add=(label,v)=>{if(v!==''&&v!==null&&v!==undefined)parts.push(`${label}: ${v}`);};
  add('Setup',f.setup);add('VD',f.vd);add('NR',f.nr);add('H',f.hypothesis);add('Contexto',f.context);add('Dir.',f.direction);add('Hora',f.hour);add('Desde',f.dateFrom);add('Hasta',f.dateTo);add('Comport.',f.behavior);add('Emoción',f.emotion);add('Foco',f.focus);add('Estrés',f.stress);
  if(f.rMin!==''||f.rMax!=='')parts.push(`R ${f.rMin||'−∞'} → ${f.rMax||'∞'}`);
  return parts.length?parts.slice(0,5).join(' · ')+(parts.length>5?` · +${parts.length-5}`:''):'Sin filtros · dataset completo';
}
function studyUnitText(s){const f=s?.lab||{};return `${metricUnitLabel(f.unit||'r')} · ${(f.basis||'net')==='net'?'Neto':'Bruto'}`;}

function setStudySelection(id){labStudiesUi.selectedId=id;labStudiesUi.compareId='';render();}
function openSaveStudyModal(){
  const p=getCurrentPlan();ensurePlanStudies(p);
  const body=`<form onsubmit="return false"><div class="form-section"><h4>Guardar configuración del Laboratorio</h4><div class="form-grid">${field('Nombre del estudio','study-name','text','')}${field('Descripción / hipótesis','study-description','textarea','','full')}</div><div class="notice" style="margin-top:12px">Se guardarán filtros, unidad/base, configuración del Research Grid y parámetros de Exit Lab. Las operaciones no se duplican: el estudio siempre consulta el dataset actual de este Trading Plan.</div></div></form>`;
  document.body.insertAdjacentHTML('beforeend',modalShell('Nuevo estudio guardado',body,`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveCurrentStudy()">Guardar estudio</button>`));
}
function saveCurrentStudy(){
  const p=getCurrentPlan();if(!p)return;ensurePlanStudies(p);
  const name=(document.getElementById('f-study-name')?.value||'').trim();if(!name)return alert('Escribe un nombre para el estudio.');
  const now=new Date().toISOString(),snap=currentStudySnapshot();
  const s={id:uid('STUDY'),name,description:(document.getElementById('f-study-description')?.value||'').trim(),createdAt:now,updatedAt:now,...snap};
  p.savedStudies.unshift(s);p.updatedAt=now;labStudiesUi.selectedId=s.id;labStudiesUi.activeId=s.id;labStudiesUi.compareId='';persist();closeModal();render();
}
function applyStudySnapshot(s){
  if(!s)return;
  if(typeof researchRestoreSelectionInternal==='function')researchRestoreSelectionInternal();
  labState={...labStudyDefaultState(),...clone(s.lab||{})};
  researchGridState={...researchGridState,...clone(s.research||{}),selection:null};
  exitLabState={...exitLabState,...clone(s.exit||{})};
}
function loadSelectedStudy(){const s=selectedStudy();if(!s)return;applyStudySnapshot(s);labStudiesUi.activeId=s.id;labStudiesUi.compareId='';render();}
function updateActiveStudy(){
  const p=getCurrentPlan();ensurePlanStudies(p);const s=p.savedStudies.find(x=>x.id===labStudiesUi.activeId);if(!s)return alert('Primero carga un estudio guardado.');
  if(!confirm(`Actualizar “${s.name}” con la configuración actual del Laboratorio?`))return;
  Object.assign(s,currentStudySnapshot(),{updatedAt:new Date().toISOString()});p.updatedAt=s.updatedAt;labStudiesUi.selectedId=s.id;persist();render();
}
function duplicateSelectedStudy(){
  const p=getCurrentPlan(),s=selectedStudy();if(!p||!s)return;ensurePlanStudies(p);
  const name=prompt('Nombre de la copia',`${s.name} · copia`);if(name===null||!name.trim())return;
  const now=new Date().toISOString(),copy={...clone(s),id:uid('STUDY'),name:name.trim(),createdAt:now,updatedAt:now};
  p.savedStudies.unshift(copy);p.updatedAt=now;labStudiesUi.selectedId=copy.id;labStudiesUi.compareId='';persist();render();
}
function deleteSelectedStudy(){
  const p=getCurrentPlan(),s=selectedStudy();if(!p||!s)return;if(!confirm(`Eliminar el estudio guardado “${s.name}”?\n\nNo se eliminará ninguna operación.`))return;
  p.savedStudies=p.savedStudies.filter(x=>x.id!==s.id);if(labStudiesUi.activeId===s.id)labStudiesUi.activeId='';if(labStudiesUi.compareId===s.id)labStudiesUi.compareId='';labStudiesUi.selectedId=p.savedStudies[0]?.id||'';p.updatedAt=new Date().toISOString();persist();render();
}
function toggleCompareSelectedStudy(){const s=selectedStudy();if(!s)return;labStudiesUi.compareId=labStudiesUi.compareId===s.id?'':s.id;render();}

function labFilteredOpsForState(f={}){
  return currentOps().filter(o=>{
    const d=new Date(o.entryDate);if(isNaN(d))return false;const date=inputDateValue(d),hh=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),hour=`${String(d.getHours()).padStart(2,'0')}:00`;
    if(f.dateFrom&&date<f.dateFrom)return false;if(f.dateTo&&date>f.dateTo)return false;
    if(f.timeFrom&&f.timeTo){if(f.timeFrom<=f.timeTo){if(hh<f.timeFrom||hh>f.timeTo)return false;}else if(hh<f.timeFrom&&hh>f.timeTo)return false;}
    else if(f.timeFrom&&hh<f.timeFrom)return false;else if(f.timeTo&&hh>f.timeTo)return false;
    if(f.hour&&hour!==String(f.hour))return false;
    if(f.direction&&o.direction!==f.direction)return false;if(f.setup&&o.setup!==f.setup)return false;if(f.vd&&o.vd!==f.vd)return false;if(f.nr&&String(o.nr||'')!==String(f.nr))return false;
    if(f.hypothesis&&String(o.hypothesis||'')!==String(f.hypothesis))return false;if(f.context&&String(o.h4Context||'')!==String(f.context))return false;if(f.risk&&o.riskStrategyId!==f.risk)return false;if(f.result&&o.result!==f.result)return false;
    if(f.behavior&&!(o.emotional?.behaviors||[]).includes(f.behavior))return false;if(f.emotion&&!labEmotionsOf(o).includes(f.emotion))return false;
    if(f.focus&&String(o.emotional?.focus||'')!==String(f.focus))return false;if(f.stress&&String(o.emotional?.stress||'')!==String(f.stress))return false;
    const rv=opMetricValue(o,'r',f.basis||'net');if(f.rMin!==''&&f.rMin!==undefined&&rv<Number(f.rMin))return false;if(f.rMax!==''&&f.rMax!==undefined&&rv>Number(f.rMax))return false;
    return true;
  }).sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));
}
labFilteredOps=function(){return labFilteredOpsForState(labState);};

function studyStatsFor(s,unit=labState.unit,basis=labState.basis){const ops=labFilteredOpsForState(s?.lab||{}),stats=calcMetricStats(ops,unit,basis);return {ops,stats};}
function savedStudyComparePanel(){
  const p=getCurrentPlan();ensurePlanStudies(p);const s=p.savedStudies.find(x=>x.id===labStudiesUi.compareId);if(!s)return '';
  const actual={name:labStudiesUi.activeId?(p.savedStudies.find(x=>x.id===labStudiesUi.activeId)?.name||'Estudio cargado'):'Configuración actual',...studyStatsFor({lab:labState})};
  const saved={name:s.name,...studyStatsFor(s)};const u=labState.unit,b=labState.basis;
  const row=(label,a,z,fmt=x=>metricStatText(x,u))=>`<tr><th>${label}</th><td>${fmt(a)}</td><td>${fmt(z)}</td><td class="${z-a>0?'positive':z-a<0?'negative':''}">${fmt(z-a)}</td></tr>`;
  const pfText=v=>Number.isFinite(v)?Number(v).toFixed(2):'∞';
  const pfCompareRow=()=>{
    const a=actual.stats.pf,z=saved.stats.pf;let deltaText='—',cls='';
    if(Number.isFinite(a)&&Number.isFinite(z)){const d=z-a;deltaText=`${d>0?'+':''}${d.toFixed(2)}`;cls=d>0?'positive':d<0?'negative':'';}
    else if(!Number.isFinite(a)&&Number.isFinite(z)){deltaText='-∞';cls='negative';}
    else if(Number.isFinite(a)&&!Number.isFinite(z)){deltaText='+∞';cls='positive';}
    return `<tr><th>Profit Factor</th><td>${pfText(a)}</td><td>${pfText(z)}</td><td class="${cls}">${deltaText}</td></tr>`;
  };
  return `<section class="study-compare"><div class="study-compare-head"><div><strong>Comparación de estudios</strong><span>${metricUnitLabel(u)} · ${b==='net'?'Neto':'Bruto'} · mismos datos actuales</span></div><button class="btn tiny ghost" onclick="labStudiesUi.compareId='';render()">Cerrar</button></div><div class="study-compare-names"><div><b>Actual</b><span>${esc(actual.name)}</span><small>${actual.ops.length} operaciones</small></div><div><b>Guardado</b><span>${esc(saved.name)}</span><small>${saved.ops.length} operaciones</small></div></div><div class="table-wrap"><table class="table compact-table"><thead><tr><th>Métrica</th><th>Actual</th><th>${esc(saved.name)}</th><th>Δ guardado − actual</th></tr></thead><tbody>${row('Operaciones',actual.stats.n,saved.stats.n,x=>String(Math.round(x)))}${row('Resultado',actual.stats.sum,saved.stats.sum)}${row('Expectancy',actual.stats.expectancy,saved.stats.expectancy)}${row('Win rate',actual.stats.winRate,saved.stats.winRate,x=>`${Number(x||0).toFixed(1)}%`)}${pfCompareRow()}${row('Max DD',actual.stats.maxDD,saved.stats.maxDD)}</tbody></table></div><div class="lab-note">La comparación reutiliza los filtros guardados, pero calcula ambos estudios sobre el dataset actual. Si has añadido operaciones desde que guardaste el estudio, su muestra puede crecer.</div></section>`;
}
function savedStudiesPanel(){
  const p=getCurrentPlan();ensurePlanStudies(p);reconcileStudyUi();const studies=p.savedStudies,selected=selectedStudy(),active=studies.find(x=>x.id===labStudiesUi.activeId),dirty=activeStudyDirty();
  const options=studies.map(s=>`<option value="${esc(s.id)}" ${s.id===labStudiesUi.selectedId?'selected':''}>${esc(s.name)}</option>`).join('');
  return `<section class="card panel saved-studies-panel"><div class="panel-title"><div><h3>Estudios guardados</h3><small>Guarda hipótesis de filtros y recupéralas sin reconstruir el Laboratorio.</small></div><button class="btn primary small" onclick="openSaveStudyModal()">+ Guardar estudio</button></div>${studies.length?`<div class="saved-study-toolbar"><label><span>Estudio</span><select class="select" onchange="setStudySelection(this.value)">${options}</select></label><div class="saved-study-actions"><button class="btn small" onclick="loadSelectedStudy()">Cargar</button><button class="btn small ${active?'':'ghost'}" onclick="updateActiveStudy()" ${active?'':'disabled'}>Actualizar cargado</button><button class="btn small" onclick="duplicateSelectedStudy()">Duplicar</button><button class="btn small" onclick="toggleCompareSelectedStudy()">${labStudiesUi.compareId===selected?.id?'Cerrar comparación':'Comparar con actual'}</button><button class="btn small danger" onclick="deleteSelectedStudy()">Eliminar</button></div></div><div class="saved-study-meta"><div><span>Seleccionado</span><strong>${esc(selected?.name||'—')}</strong><small>${esc(studyFilterSummary(selected))}</small></div><div><span>Configuración</span><strong>${esc(studyUnitText(selected))}</strong><small>Grid: ${esc(researchDimLabel(selected?.research?.rowDim||'setup'))} × ${esc(researchDimLabel(selected?.research?.colDim||'context'))} · ${esc(RESEARCH_METRICS.find(x=>x[0]===(selected?.research?.metric||'expectancy'))?.[1]||'Expectancy')}</small></div><div><span>Estado actual</span><strong>${active?`Cargado: ${esc(active.name)}`:'Sin estudio cargado'}</strong><small class="${dirty?'negative':''}">${active?(dirty?'Cambios sin guardar':'Sin cambios respecto al guardado'):'Puedes trabajar libremente y guardarlo después'}</small></div></div>${savedStudyComparePanel()}`:`<div class="empty compact-empty">Todavía no hay estudios guardados. Configura el Laboratorio y pulsa <strong>Guardar estudio</strong>.</div>`}</section>`;
}

const labActiveChipsV17Base=labActiveChips;
labActiveChips=function(){
  let html=labActiveChipsV17Base();const extra=[];const add=(label,val,field)=>{if(val)extra.push(`<button class="lab-active-chip" onclick="labState.${field}='';render()"><span>${esc(label)}</span><strong>${esc(val)}</strong> ×</button>`);};
  add('NR',labState.nr,'nr');add('Hipótesis',labState.hypothesis,'hypothesis');add('Hora',labState.hour,'hour');
  if(!extra.length)return html;
  if(html)return html.replace('</div>',extra.join('')+'</div>');
  return `<div class="lab-active-filters">${extra.join('')}</div>`;
};

const labFilterPanelV17Base=labFilterPanel;
labFilterPanel=function(){
  const p=getCurrentPlan();let html=labFilterPanelV17Base();
  const insert=`${labSelect('labNR','NR',p?.nr||[],labState.nr||'',"labState.nr=this.value;render()")}${labSelect('labHypothesis','Hipótesis',(p?.hypotheses||[]).map(h=>({value:h.id,label:h.name})),labState.hypothesis||'',"labState.hypothesis=this.value;render()")}`;
  // Inserta NR/Hipótesis antes de Estrategia para que todos los ejes principales puedan guardarse/filtrarse manualmente.
  const marker=labSelect('labRisk','Estrategia',(p?.riskStrategies||[]).map(r=>({value:r.id,label:r.name})),labState.risk);
  if(html.includes(marker))html=html.replace(marker,insert+marker);
  return html;
};

const labResetV17Base=labReset;
labReset=function(){labStudiesUi.activeId='';labStudiesUi.compareId='';labState.nr='';labState.hypothesis='';labState.hour='';labResetV17Base();};

analyticsLab=function(){
  const p=getCurrentPlan(),ops=labFilteredOps();
  return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: combinaciones, salidas, comportamiento, riesgo y estabilidad.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${savedStudiesPanel()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${researchGridModule(ops)}${exitLabModule(ops)}${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;
};

const shellV17Base=shell;
shell=function(){return shellV17Base().replace(V16_APP_LABEL,V17_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Plan Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Estudios guardados + Plan Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');};

Object.assign(window,{labStudiesUi,setStudySelection,openSaveStudyModal,saveCurrentStudy,loadSelectedStudy,updateActiveStudy,duplicateSelectedStudy,deleteSelectedStudy,toggleCompareSelectedStudy});
render();
/* ===== END V17 PATCH ===== */

/* ===== V18 PATCH · Confianza estadística ===== */
const V18_APP_LABEL='V18 · Confianza estadística';

function ensurePlanConfidence(p){
  if(!p)return p;
  const c=p.confidenceConfig||{};
  p.confidenceConfig={targetN:[20,50,100,200].includes(Number(c.targetN))?Number(c.targetN):100};
  return p;
}
state.tradingPlans.forEach(ensurePlanConfidence);
const makeBlankPlanV18Base=makeBlankPlan;
makeBlankPlan=function(meta={}){const p=makeBlankPlanV18Base(meta);ensurePlanConfidence(p);return p;};
const normalizePlanV18Base=normalizePlan;
normalizePlan=function(p,instruments){const out=normalizePlanV18Base(p,instruments);ensurePlanConfidence(out);return out;};
const normalizeStateV18Base=normalizeState;
normalizeState=function(raw){const out=normalizeStateV18Base(raw);(out.tradingPlans||[]).forEach(ensurePlanConfidence);return out;};

function meanOf(vals){return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;}
function sampleSd(vals){
  if(vals.length<2)return NaN;
  const m=meanOf(vals),ss=vals.reduce((a,v)=>a+(v-m)*(v-m),0);
  return Math.sqrt(ss/(vals.length-1));
}
function tCritical95(df){
  if(df<=0)return NaN;
  const exact={1:12.706,2:4.303,3:3.182,4:2.776,5:2.571,6:2.447,7:2.365,8:2.306,9:2.262,10:2.228,11:2.201,12:2.179,13:2.160,14:2.145,15:2.131,16:2.120,17:2.110,18:2.101,19:2.093,20:2.086,21:2.080,22:2.074,23:2.069,24:2.064,25:2.060,26:2.056,27:2.052,28:2.048,29:2.045,30:2.042};
  if(exact[df])return exact[df];
  const bands=[[30,2.042],[40,2.021],[60,2.000],[120,1.980],[1e9,1.960]];
  let prev=[30,2.042];
  for(const next of bands.slice(1)){
    if(df<=next[0]){
      const t=(df-prev[0])/(next[0]-prev[0]);
      return prev[1]+t*(next[1]-prev[1]);
    }
    prev=next;
  }
  return 1.96;
}
function wilson95(wins,n){
  if(!n)return {low:NaN,high:NaN};
  const z=1.959963984540054,p=wins/n,z2=z*z,den=1+z2/n;
  const center=(p+z2/(2*n))/den;
  const half=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/den;
  return {low:Math.max(0,center-half)*100,high:Math.min(1,center+half)*100};
}
function confidenceFromValues(vals,wins=vals.filter(v=>v>0).length){
  const clean=vals.map(Number).filter(Number.isFinite),n=clean.length,mean=meanOf(clean),sd=sampleSd(clean),se=n>1?sd/Math.sqrt(n):NaN,t=tCritical95(n-1),margin=n>1?t*se:NaN;
  const ciLow95=n>1?mean-margin:NaN,ciHigh95=n>1?mean+margin:NaN,wr=wilson95(wins,n);
  return {n,mean,sd,se,ciLow95,ciHigh95,winLow95:wr.low,winHigh95:wr.high};
}

const calcMetricStatsV18Base=calcMetricStats;
calcMetricStats=function(ops,unit='r',basis='gross'){
  const s=calcMetricStatsV18Base(ops,unit,basis),vals=ops.map(o=>opMetricValue(o,unit,basis));
  return {...s,...confidenceFromValues(vals,s.wins)};
};

function confidenceMaturity(n){
  if(n<20)return {key:'exploratory',label:'Exploratoria',detail:'menos de 20 operaciones'};
  if(n<50)return {key:'initial',label:'Inicial',detail:'20–49 operaciones'};
  if(n<100)return {key:'developing',label:'En desarrollo',detail:'50–99 operaciones'};
  return {key:'mature',label:'Muestra amplia',detail:'100+ operaciones'};
}
function confidenceEvidence(s){
  if(s.n<2||!Number.isFinite(s.ciLow95)||!Number.isFinite(s.ciHigh95))return {key:'unknown',label:'Sin estimar',detail:'se necesitan al menos 2 operaciones'};
  if(s.n<20)return {key:'exploratory',label:'Señal exploratoria',detail:'muestra demasiado pequeña para clasificar el edge'};
  if(s.ciLow95>0)return {key:'positive',label:'Evidencia positiva',detail:'el IC 95% de expectancy queda por encima de 0'};
  if(s.ciHigh95<0)return {key:'negative',label:'Evidencia negativa',detail:'el IC 95% de expectancy queda por debajo de 0'};
  return {key:'inconclusive',label:'Inconclusa',detail:'el IC 95% todavía cruza 0'};
}
function confidenceSplit(ops,unit,basis){
  const ordered=[...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)),cut=Math.floor(ordered.length/2);
  if(cut<1||ordered.length-cut<1)return {first:null,second:null,label:'Sin muestra suficiente'};
  const first=calcMetricStats(ordered.slice(0,cut),unit,basis),second=calcMetricStats(ordered.slice(cut),unit,basis);
  const same=(first.expectancy>0&&second.expectancy>0)||(first.expectancy<0&&second.expectancy<0)||(first.expectancy===0&&second.expectancy===0);
  return {first,second,label:same?'Signo consistente':'Cambio de signo'};
}
function confidenceMetric(v){return Number.isFinite(v)?metricStatText(v,labState.unit):'—';}
function confidenceSetTarget(v){
  const p=getCurrentPlan();if(!p)return;ensurePlanConfidence(p);const n=Number(v);
  p.confidenceConfig.targetN=[20,50,100,200].includes(n)?n:100;p.updatedAt=new Date().toISOString();persist();render();
}
function confidencePanel(ops){
  const p=getCurrentPlan();ensurePlanConfidence(p);const target=p.confidenceConfig.targetN||100,s=calcMetricStats(ops,labState.unit,labState.basis),m=confidenceMaturity(s.n),e=confidenceEvidence(s),split=confidenceSplit(ops,labState.unit,labState.basis),progress=Math.min(100,s.n/target*100);
  const ci=s.n>1?`${confidenceMetric(s.ciLow95)} → ${confidenceMetric(s.ciHigh95)}`:'—';
  const wr=s.n?`${Number(s.winLow95).toFixed(1)}% → ${Number(s.winHigh95).toFixed(1)}%`:'—';
  const first=split.first?confidenceMetric(split.first.expectancy):'—',second=split.second?confidenceMetric(split.second.expectancy):'—';
  return `<section class="card panel lab-module lab-span-2 confidence-module">
    <div class="panel-title"><div><h3>Confianza estadística</h3><small>Cuantifica incertidumbre de la muestra actual; no confunde una estimación puntual con evidencia.</small></div><label class="confidence-target"><span>Objetivo de muestra</span><select class="select compact-select" onchange="confidenceSetTarget(this.value)">${[20,50,100,200].map(n=>`<option value="${n}" ${target===n?'selected':''}>${n} trades</option>`).join('')}</select></label></div>
    <div class="confidence-summary">
      <div class="confidence-status ${e.key}"><span>Evidencia del edge</span><strong>${esc(e.label)}</strong><small>${esc(e.detail)}</small></div>
      <div class="confidence-status ${m.key}"><span>Madurez de muestra</span><strong>${esc(m.label)}</strong><small>${esc(m.detail)}</small></div>
      <div class="confidence-progress-card"><div><span>Progreso hacia n=${target}</span><strong>${s.n}/${target}</strong></div><i><b style="width:${progress}%"></b></i><small>${progress.toFixed(0)}% del objetivo seleccionado</small></div>
    </div>
    <div class="confidence-kpis">
      <div><span>Expectancy observada</span><strong class="${s.expectancy>0?'positive':s.expectancy<0?'negative':''}">${confidenceMetric(s.expectancy)}</strong><small>media de la muestra</small></div>
      <div><span>IC 95% · Expectancy</span><strong>${ci}</strong><small>intervalo t aproximado</small></div>
      <div><span>Límite inferior 95%</span><strong class="${Number.isFinite(s.ciLow95)?(s.ciLow95>0?'positive':s.ciLow95<0?'negative':''):''}">${confidenceMetric(s.ciLow95)}</strong><small>lectura conservadora del edge</small></div>
      <div><span>Win rate · IC 95%</span><strong>${wr}</strong><small>intervalo de Wilson</small></div>
      <div><span>Desviación por trade</span><strong>${confidenceMetric(s.sd)}</strong><small>dispersión de resultados</small></div>
      <div><span>Error estándar</span><strong>${confidenceMetric(s.se)}</strong><small>incertidumbre de la media</small></div>
    </div>
    <div class="confidence-split"><div><span>1ª mitad</span><strong class="${split.first?.expectancy>0?'positive':split.first?.expectancy<0?'negative':''}">${first}</strong></div><div class="confidence-arrow">→</div><div><span>2ª mitad</span><strong class="${split.second?.expectancy>0?'positive':split.second?.expectancy<0?'negative':''}">${second}</strong></div><div class="confidence-split-status"><span>Estabilidad temporal básica</span><strong>${esc(split.label)}</strong></div></div>
    <div class="lab-note warn"><strong>Lectura correcta:</strong> el IC 95% es una aproximación para la media y supone una muestra razonablemente estable/independiente. No corrige cambios de régimen, autocorrelación, selección de setups ni el sesgo de probar muchas combinaciones en el Research Grid. Una combinación descubierta explorando muchas celdas debería confirmarse con operaciones nuevas antes de considerarla edge validado.</div>
  </section>`;
}

/* El Grid puede usar el límite inferior del IC95 como métrica conservadora. */
if(!RESEARCH_METRICS.some(x=>x[0]==='lcb95'))RESEARCH_METRICS.push(['lcb95','Límite inferior 95%']);
const researchMetricValueV18Base=researchMetricValue;
researchMetricValue=function(stats,metric=researchGridState.metric){
  if(metric==='lcb95')return Number.isFinite(stats?.ciLow95)?stats.ciLow95:NaN;
  return researchMetricValueV18Base(stats,metric);
};
const researchMetricTextV18Base=researchMetricText;
researchMetricText=function(stats,metric=researchGridState.metric){
  if(metric==='lcb95')return Number.isFinite(stats?.ciLow95)?metricStatText(stats.ciLow95,labState.unit):'—';
  return researchMetricTextV18Base(stats,metric);
};
const researchColorScoreV18Base=researchColorScore;
researchColorScore=function(stats,metric=researchGridState.metric){
  if(metric==='lcb95')return Number.isFinite(stats?.ciLow95)?stats.ciLow95:null;
  return researchColorScoreV18Base(stats,metric);
};

const analyticsLabV18Base=analyticsLab;
analyticsLab=function(){
  const p=getCurrentPlan(),ops=labFilteredOps();
  return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: combinaciones, salidas, comportamiento, riesgo, estabilidad y confianza estadística.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${savedStudiesPanel()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${confidencePanel(ops)}${researchGridModule(ops)}${exitLabModule(ops)}${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;
};

const shellV18Base=shell;
shell=function(){return shellV18Base().replace(V17_APP_LABEL,V18_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Estudios guardados + Plan Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Confianza estadística + Estudios guardados + Plan Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');};

Object.assign(window,{confidenceSetTarget});
render();
/* ===== END V18 PATCH ===== */

/* ===== V19 PATCH · Review / Notas avanzadas ===== */
const V19_APP_LABEL='V19 · Review & Notes';
const REVIEW_TYPES=[
  ['general','General'],['trade','Operación'],['day','Día'],['week','Semana'],['month','Mes'],['block','Bloque'],['study','Estudio']
];
const REVIEW_STATUSES=[
  ['open','Abierta'],['monitoring','En seguimiento'],['validated','Validada'],['discarded','Descartada']
];
let reviewViewState={q:'',type:'',status:'',tag:'',unit:'r',basis:'net'};
let editingReviewNoteId=null;

function ensurePlanReviews(p){
  if(!p)return p;
  p.reviewNotes=Array.isArray(p.reviewNotes)?p.reviewNotes:[];
  p.reviewNotes=p.reviewNotes.map(n=>({
    id:n?.id||uid('REV'),
    type:REVIEW_TYPES.some(x=>x[0]===n?.type)?n.type:'general',
    status:REVIEW_STATUSES.some(x=>x[0]===n?.status)?n.status:'open',
    title:String(n?.title||'Nota sin título'),
    tags:Array.isArray(n?.tags)?uniq(n.tags.map(x=>String(x).trim()).filter(Boolean)):uniq(String(n?.tags||'').split(',').map(x=>x.trim()).filter(Boolean)),
    finding:String(n?.finding||n?.content||''),
    decision:String(n?.decision||''),
    followUpN:Math.max(0,Number(n?.followUpN)||0),
    target:String(n?.target||''),
    operationId:String(n?.operationId||''),
    studyId:String(n?.studyId||''),
    createdAt:n?.createdAt||new Date().toISOString(),
    updatedAt:n?.updatedAt||n?.createdAt||new Date().toISOString()
  }));
  return p;
}
state.tradingPlans.forEach(ensurePlanReviews);
const makeBlankPlanV19Base=makeBlankPlan;
makeBlankPlan=function(meta={}){const p=makeBlankPlanV19Base(meta);ensurePlanReviews(p);return p;};
const normalizePlanV19Base=normalizePlan;
normalizePlan=function(p,instruments){const out=normalizePlanV19Base(p,instruments);ensurePlanReviews(out);return out;};
const normalizeStateV19Base=normalizeState;
normalizeState=function(raw){const out=normalizeStateV19Base(raw);(out.tradingPlans||[]).forEach(ensurePlanReviews);return out;};

function reviewTypeLabel(v){return REVIEW_TYPES.find(x=>x[0]===v)?.[1]||'General';}
function reviewStatusLabel(v){return REVIEW_STATUSES.find(x=>x[0]===v)?.[1]||'Abierta';}
function reviewStatusClass(v){return v==='validated'?'win':v==='discarded'?'loss':v==='monitoring'?'warn':'';}
function reviewIsoWeekKey(date){
  const d=new Date(date);if(isNaN(d))return '';
  const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);
  const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));
  const w=Math.ceil((((x-y0)/86400000)+1)/7);
  return `${x.getUTCFullYear()}-W${String(w).padStart(2,'0')}`;
}
function reviewDefaultTarget(type){
  const ops=[...currentOps()].sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate));
  if(type==='trade')return ops[0]?.id||'';
  if(type==='day'||type==='week')return ops[0]?.entryDate?inputDateValue(new Date(ops[0].entryDate)):inputDateValue(new Date());
  if(type==='month')return ops[0]?.entryDate?inputDateValue(new Date(ops[0].entryDate)).slice(0,7):inputDateValue(new Date()).slice(0,7);
  if(type==='block')return String(Math.max(1,Math.ceil(ops.length/20)));
  if(type==='study')return getCurrentPlan()?.savedStudies?.[0]?.id||'';
  return '';
}
function reviewTargetHtml(type,value=''){
  const p=getCurrentPlan(),v=value||reviewDefaultTarget(type);
  if(type==='trade'){
    const ops=[...currentOps()].sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate)).slice(0,300);
    return `<div class="field span2"><label>Operación vinculada</label><select id="f-review-target" class="select"><option value="">Sin vincular</option>${ops.map(o=>`<option value="${esc(o.id)}" ${o.id===v?'selected':''}>${esc(fmtDate(o.entryDate))} · ${esc(o.setup||'—')} · ${esc(o.direction||'—')} · ${Number(o.rMultiple||0).toFixed(2)}R</option>`).join('')}</select></div>`;
  }
  if(type==='day'||type==='week')return `<div class="field span2"><label>${type==='day'?'Día':'Fecha dentro de la semana'}</label><input id="f-review-target" class="input" type="date" value="${esc(v)}"></div>`;
  if(type==='month')return `<div class="field span2"><label>Mes</label><input id="f-review-target" class="input" type="month" value="${esc(v)}"></div>`;
  if(type==='block'){
    const n=Math.max(1,Math.ceil(currentOps().length/20));
    return `<div class="field span2"><label>Bloque</label><select id="f-review-target" class="select">${Array.from({length:n},(_,i)=>i+1).map(x=>`<option value="${x}" ${String(x)===String(v)?'selected':''}>B${String(x).padStart(2,'0')}</option>`).join('')}</select></div>`;
  }
  if(type==='study'){
    ensurePlanStudies(p);return `<div class="field span2"><label>Estudio guardado</label><select id="f-review-target" class="select"><option value="">Sin vincular</option>${(p?.savedStudies||[]).map(s=>`<option value="${esc(s.id)}" ${s.id===v?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>`;
  }
  return `<div class="field span2"><label>Referencia</label><div class="readonly-box">Nota general del Trading Plan</div><input id="f-review-target" type="hidden" value=""></div>`;
}
function reviewRefreshTarget(){
  const type=document.getElementById('f-review-type')?.value||'general',box=document.getElementById('review-target-box');
  if(box)box.innerHTML=reviewTargetHtml(type,'');
}
function openReviewNoteModal(id=null,type='',target=''){
  const p=getCurrentPlan();if(!p)return;ensurePlanReviews(p);editingReviewNoteId=id;
  const n=id?p.reviewNotes.find(x=>x.id===id):{type:type||'general',status:'open',title:'',tags:[],finding:'',decision:'',followUpN:0,target:target||'',operationId:'',studyId:''};
  const currentTarget=n.type==='trade'?(n.operationId||n.target):n.type==='study'?(n.studyId||n.target):n.target;
  const body=`<form onsubmit="return false"><div class="form-section"><h4>Contexto de la revisión</h4><div class="form-grid">${selectObjField('Tipo','review-type',REVIEW_TYPES.map(([value,label])=>({value,label})),n.type,`onchange="reviewRefreshTarget()"`)}${selectObjField('Estado','review-status',REVIEW_STATUSES.map(([value,label])=>({value,label})),n.status)}<div id="review-target-box" class="review-target-box">${reviewTargetHtml(n.type,currentTarget)}</div>${field('Título','review-title','text',esc(n.title||''),'span2')}${field('Tags separados por coma','review-tags','text',esc((n.tags||[]).join(', ')),'span2')}${field('Revisar tras N operaciones nuevas','review-followup','number',n.followUpN||0,'',`min="0" step="1"`)}</div></div><div class="form-section"><h4>Hallazgo / evidencia</h4>${field('Qué observaste, qué patrón aparece y qué datos lo sostienen','review-finding','textarea',esc(n.finding||''),'full')}</div><div class="form-section"><h4>Decisión / siguiente acción</h4>${field('Qué mantendrás, cambiarás, validarás o dejarás pendiente','review-decision','textarea',esc(n.decision||''),'full')}</div><div class="notice">Una review documenta una conclusión o hipótesis; no modifica operaciones, reglas ni estudios. Vincularla a un día, bloque, trade o estudio permite recuperar después el contexto y sus métricas actuales.</div></form>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar review':'Nueva review',body,`<button class="btn" onclick="closeModal();editingReviewNoteId=null">Cancelar</button><button class="btn primary" onclick="saveReviewNote()">Guardar review</button>`));
}
function saveReviewNote(){
  const p=getCurrentPlan(),g=n=>document.getElementById(`f-${n}`)?.value??'';if(!p)return;ensurePlanReviews(p);
  const title=String(g('review-title')).trim();if(!title)return alert('Escribe un título para la review.');
  const type=REVIEW_TYPES.some(x=>x[0]===g('review-type'))?g('review-type'):'general',status=REVIEW_STATUSES.some(x=>x[0]===g('review-status'))?g('review-status'):'open',rawTarget=String(g('review-target')||'');
  const now=new Date().toISOString(),old=editingReviewNoteId?p.reviewNotes.find(x=>x.id===editingReviewNoteId):null;
  const item={id:old?.id||uid('REV'),type,status,title,tags:uniq(String(g('review-tags')).split(',').map(x=>x.trim()).filter(Boolean)),finding:String(g('review-finding')).trim(),decision:String(g('review-decision')).trim(),followUpN:Math.max(0,Number(g('review-followup'))||0),target:type==='trade'||type==='study'?'':rawTarget,operationId:type==='trade'?rawTarget:'',studyId:type==='study'?rawTarget:'',createdAt:old?.createdAt||now,updatedAt:now};
  const i=p.reviewNotes.findIndex(x=>x.id===item.id);if(i>=0)p.reviewNotes[i]=item;else p.reviewNotes.unshift(item);p.updatedAt=now;editingReviewNoteId=null;persist();closeModal();render();
}
function deleteReviewNote(id){const p=getCurrentPlan();if(!p)return;ensurePlanReviews(p);const n=p.reviewNotes.find(x=>x.id===id);if(!n)return;if(!confirm(`¿Eliminar la review “${n.title}”?`))return;p.reviewNotes=p.reviewNotes.filter(x=>x.id!==id);p.updatedAt=new Date().toISOString();persist();render();}
function setReviewNoteStatus(id,status){const p=getCurrentPlan(),n=p?.reviewNotes?.find(x=>x.id===id);if(!n||!REVIEW_STATUSES.some(x=>x[0]===status))return;n.status=status;n.updatedAt=new Date().toISOString();p.updatedAt=n.updatedAt;persist();render();}
function duplicateReviewNote(id){const p=getCurrentPlan(),n=p?.reviewNotes?.find(x=>x.id===id);if(!p||!n)return;const c=clone(n);c.id=uid('REV');c.title=`${n.title} · copia`;c.status='open';c.createdAt=c.updatedAt=new Date().toISOString();p.reviewNotes.unshift(c);p.updatedAt=c.updatedAt;persist();render();}

function reviewNoteScope(note){
  const p=getCurrentPlan();
  if(note.type==='trade'){
    const o=state.operations.find(x=>x.id===note.operationId);return o?`${fmtDate(o.entryDate)} · ${o.setup||'—'} · ${o.direction||'—'}`:'Operación no disponible';
  }
  if(note.type==='day')return note.target?new Date(`${note.target}T12:00:00`).toLocaleDateString('es-ES'):'Día sin definir';
  if(note.type==='week')return note.target?`Semana ${reviewIsoWeekKey(note.target)}`:'Semana sin definir';
  if(note.type==='month'){
    if(!note.target)return 'Mes sin definir';const [y,m]=note.target.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  }
  if(note.type==='block')return `B${String(Number(note.target)||1).padStart(2,'0')}`;
  if(note.type==='study'){const s=p?.savedStudies?.find(x=>x.id===note.studyId);return s?`Estudio · ${s.name}`:'Estudio no disponible';}
  return planLabel(p);
}
function reviewLinkedOps(note){
  const ops=currentOps();
  if(note.type==='trade')return ops.filter(o=>o.id===note.operationId);
  if(note.type==='day')return ops.filter(o=>inputDateValue(new Date(o.entryDate))===note.target);
  if(note.type==='week'){const key=reviewIsoWeekKey(note.target);return ops.filter(o=>reviewIsoWeekKey(o.entryDate)===key);}
  if(note.type==='month')return ops.filter(o=>inputDateValue(new Date(o.entryDate)).slice(0,7)===note.target);
  if(note.type==='block'){const m=opBlockMap(),n=Number(note.target)||0;return ops.filter(o=>m.get(o.id)===n);}
  if(note.type==='study'){
    const s=getCurrentPlan()?.savedStudies?.find(x=>x.id===note.studyId);return s?labFilteredOpsForState(s.lab||{}):[];
  }
  return [];
}
function reviewNoteMetricStrip(note){
  const ops=reviewLinkedOps(note);if(!ops.length)return '<span class="review-no-metrics">Sin muestra vinculada</span>';
  const s=calcMetricStats(ops,reviewViewState.unit,reviewViewState.basis),pf=Number.isFinite(s.pf)?s.pf.toFixed(2):(s.pf===Infinity?'∞':'—');
  return `<span>n=${s.n}</span><span class="${s.expectancy>0?'positive':s.expectancy<0?'negative':''}">Exp ${metricStatText(s.expectancy,reviewViewState.unit)}</span><span>WR ${s.winRate.toFixed(0)}%</span><span>PF ${pf}</span>`;
}
function reviewFilteredNotes(){
  const p=getCurrentPlan();ensurePlanReviews(p);const q=reviewViewState.q.trim().toLowerCase();
  return [...p.reviewNotes].filter(n=>{
    if(reviewViewState.type&&n.type!==reviewViewState.type)return false;if(reviewViewState.status&&n.status!==reviewViewState.status)return false;if(reviewViewState.tag&&!(n.tags||[]).includes(reviewViewState.tag))return false;
    if(q&&!`${n.title} ${n.finding} ${n.decision} ${(n.tags||[]).join(' ')} ${reviewNoteScope(n)}`.toLowerCase().includes(q))return false;return true;
  }).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
}
function reviewReadFilters(){reviewViewState.q=document.getElementById('reviewQ')?.value||'';reviewViewState.type=document.getElementById('reviewType')?.value||'';reviewViewState.status=document.getElementById('reviewStatus')?.value||'';reviewViewState.tag=document.getElementById('reviewTag')?.value||'';render();}
function reviewResetFilters(){reviewViewState={...reviewViewState,q:'',type:'',status:'',tag:''};render();}
function reviewSetUnit(v){reviewViewState.unit=['r','ticks','usd'].includes(v)?v:'r';render();}
function reviewSetBasis(v){reviewViewState.basis=v==='gross'?'gross':'net';render();}
function reviewOpenLinked(noteId){
  const p=getCurrentPlan(),n=p?.reviewNotes?.find(x=>x.id===noteId);if(!n)return;
  if(n.type==='trade'&&n.operationId)return viewOperation(n.operationId);
  if(n.type==='study'&&n.studyId){labStudiesUi.selectedId=n.studyId;currentView='lab';loadSelectedStudy();return;}
  if(n.type==='day'&&n.target){const d=new Date(`${n.target}T12:00:00`);calendarState.year=d.getFullYear();calendarState.month=d.getMonth();calendarState.selectedDate=n.target;currentView='calendar';render();return;}
  if(n.type==='block'){const b=(Number(n.target)||1)-1;showBlock(b);return;}
  if(n.type==='week'||n.type==='month'){
    const d=n.type==='month'?new Date(`${n.target}-01T12:00:00`):new Date(`${n.target}T12:00:00`);calendarState.year=d.getFullYear();calendarState.month=d.getMonth();calendarState.selectedDate='';currentView='calendar';render();return;
  }
}
function reviewNoteCard(n){
  const canOpen=n.type!=='general';
  return `<article class="review-card"><div class="review-card-head"><div><div class="review-badges"><span class="badge">${esc(reviewTypeLabel(n.type))}</span><span class="badge ${reviewStatusClass(n.status)}">${esc(reviewStatusLabel(n.status))}</span>${(n.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><h3>${esc(n.title)}</h3><small>${esc(reviewNoteScope(n))} · actualizado ${esc(fmtDate(n.updatedAt))}</small></div><div class="review-actions"><button class="btn small" onclick="openReviewNoteModal('${n.id}')">Editar</button><button class="btn small ghost" onclick="duplicateReviewNote('${n.id}')">Duplicar</button>${canOpen?`<button class="btn small ghost" onclick="reviewOpenLinked('${n.id}')">Abrir contexto</button>`:''}<button class="btn small danger" onclick="deleteReviewNote('${n.id}')">Eliminar</button></div></div><div class="review-metrics">${reviewNoteMetricStrip(n)}</div><div class="review-body"><section><span>Hallazgo / evidencia</span><p>${esc(n.finding||'Sin hallazgo documentado.')}</p></section><section><span>Decisión / siguiente acción</span><p>${esc(n.decision||'Sin decisión documentada.')}</p></section></div><div class="review-card-foot"><label>Estado <select class="select compact-select" onchange="setReviewNoteStatus('${n.id}',this.value)">${REVIEW_STATUSES.map(([v,l])=>`<option value="${v}" ${n.status===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>${n.followUpN?`<span>Revisar tras <strong>${n.followUpN}</strong> operaciones nuevas</span>`:'<span>Sin horizonte de seguimiento</span>'}</div></article>`;
}
function reviewView(){
  const p=getCurrentPlan();ensurePlanReviews(p);const notes=reviewFilteredNotes(),all=p.reviewNotes||[],tags=uniqueSorted(all.flatMap(n=>n.tags||[])),open=all.filter(n=>n.status==='open'||n.status==='monitoring').length,validated=all.filter(n=>n.status==='validated').length,withDecision=all.filter(n=>n.decision.trim()).length;
  const controls=`<div class="metric-switch"><span>Unidad</span>${[['r','R'],['ticks','Ticks'],['usd','US$']].map(([v,l])=>`<button class="seg-btn ${reviewViewState.unit===v?'active':''}" onclick="reviewSetUnit('${v}')">${l}</button>`).join('')}<i></i><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([v,l])=>`<button class="seg-btn ${reviewViewState.basis===v?'active':''}" onclick="reviewSetBasis('${v}')">${l}</button>`).join('')}</div><button class="btn primary" onclick="openReviewNoteModal()">+ Nueva review</button>`;
  const filter=`<section class="card filter-hub review-filter"><div class="filter-hub-top"><div><h3>Archivo de investigación</h3><p>Busca conclusiones, decisiones e hipótesis sin perder el contexto que las originó.</p></div><button class="btn small ghost" onclick="reviewResetFilters()">Limpiar</button></div><div class="filter-grid"><label class="filter-field wide"><span>Buscar</span><input id="reviewQ" class="input" value="${esc(reviewViewState.q)}" placeholder="Título, hallazgo, decisión, tag…" onchange="reviewReadFilters()"></label><label class="filter-field"><span>Tipo</span><select id="reviewType" class="select" onchange="reviewReadFilters()"><option value="">Todos</option>${REVIEW_TYPES.map(([v,l])=>`<option value="${v}" ${reviewViewState.type===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label><label class="filter-field"><span>Estado</span><select id="reviewStatus" class="select" onchange="reviewReadFilters()"><option value="">Todos</option>${REVIEW_STATUSES.map(([v,l])=>`<option value="${v}" ${reviewViewState.status===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label><label class="filter-field"><span>Tag</span><select id="reviewTag" class="select" onchange="reviewReadFilters()"><option value="">Todos</option>${tags.map(t=>`<option value="${esc(t)}" ${reviewViewState.tag===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label></div></section>`;
  return `${pageHead('Review & Notes','Convierte observaciones en conocimiento acumulado: documenta hallazgos, decisiones y seguimiento por operación, día, semana, mes, bloque o estudio.',controls)}${activePlanBanner()}<div class="review-kpis">${kpi('Reviews',all.length,'archivo del plan')}${kpi('Abiertas / seguimiento',open,'pendientes de validar')}${kpi('Validadas',validated,'conclusiones consolidadas')}${kpi('Con decisión',withDecision,'acción documentada')}</div>${filter}<section class="review-list">${notes.length?notes.map(reviewNoteCard).join(''):'<div class="card empty">No hay reviews para esta selección. Crea una cuando un bloque, estudio o sesión produzca una conclusión que quieras recordar y volver a comprobar.</div>'}</section>${reviewViewState.unit==='ticks'?mixedInstrumentWarning(currentOps()):''}`;
}

/* Accesos rápidos desde Calendario y Bloques. */
const calendarSelectedDetailV19Base=calendarSelectedDetail;
calendarSelectedDetail=function(monthOps){
  let html=calendarSelectedDetailV19Base(monthOps);if(!calendarState.selectedDate||!html)return html;
  const button=`<button class="btn small" onclick="openReviewNoteModal(null,'day','${esc(calendarState.selectedDate)}')">+ Review del día</button>`;
  return html.replace('<button class="btn small ghost" onclick="calendarSelectDate(',button+'<button class="btn small ghost" onclick="calendarSelectDate(');
};

/* Widget opcional para Dashboard personalizable. */
if(!DASHBOARD_PANEL_DEFS.some(x=>x[0]==='reviews'))DASHBOARD_PANEL_DEFS.push(['reviews','Últimas reviews / decisiones']);
function dashboardReviewsPanel(){
  const p=getCurrentPlan();ensurePlanReviews(p);const rows=[...(p.reviewNotes||[])].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5);
  return `<section class="card panel dashboard-custom-panel"><div class="panel-title"><div><h3>Últimas reviews</h3><small>Conclusiones y decisiones recientes</small></div><button class="btn tiny ghost" onclick="navigate('review')">Abrir</button></div><div class="dashboard-review-list">${rows.length?rows.map(n=>`<button onclick="openReviewNoteModal('${n.id}')"><span><strong>${esc(n.title)}</strong><small>${esc(reviewTypeLabel(n.type))} · ${esc(reviewNoteScope(n))}</small></span><em class="badge ${reviewStatusClass(n.status)}">${esc(reviewStatusLabel(n.status))}</em></button>`).join(''):'<div class="empty compact-empty">Sin reviews todavía.</div>'}</div></section>`;
}
const dashboardPanelHtmlV19Base=dashboardPanelHtml;
dashboardPanelHtml=function(id,ctx){if(id==='reviews')return dashboardReviewsPanel();return dashboardPanelHtmlV19Base(id,ctx);};

const shellV19Base=shell;
shell=function(){
  let html=shellV19Base(),galleryButton=navBtn('gallery','▧','Biblioteca visual');
  html=html.replace(galleryButton,navBtn('review','✎','Review & Notes')+galleryButton);
  return html.replace(V18_APP_LABEL,V19_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Confianza estadística + Estudios guardados + Plan Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Review & Notes + Confianza estadística + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');
};
render=function(){
  document.getElementById('app').innerHTML=shell();const view=document.getElementById('view');
  view.innerHTML=currentView==='dashboard'?dashboard():currentView==='operations'?operations():currentView==='calendar'?calendarView():currentView==='compliance'?complianceView():currentView==='lab'?analyticsLab():currentView==='review'?reviewView():currentView==='gallery'?gallery():currentView==='journal'?journal():currentView==='blocks'?blocks():currentView==='plans'?plansView():config();
  setTimeout(hydrateImageElements,0);
};
Object.assign(window,{reviewViewState,openReviewNoteModal,reviewRefreshTarget,saveReviewNote,deleteReviewNote,setReviewNoteStatus,duplicateReviewNote,reviewReadFilters,reviewResetFilters,reviewSetUnit,reviewSetBasis,reviewOpenLinked});
render();
/* ===== END V19 PATCH ===== */

/* ===== V20 PATCH · Objetivos & Scorecard ===== */
const V20_APP_LABEL='V20 · Objetivos & Scorecard';
const GOAL_METRICS=[
  ['sample','Tamaño de muestra','min'],
  ['expectancy','Expectancy','min'],
  ['result','Resultado acumulado','min'],
  ['winrate','Win rate','min'],
  ['maxdd','Máximo drawdown','max'],
  ['compliance','Cumplimiento checklist','min'],
  ['coverage','Cobertura checklist','min'],
  ['journal','Diario emocional completado','min'],
  ['mfe','MFE registrado','min'],
  ['discipline','Disciplina','min']
];
const GOAL_HORIZONS=[['all','Plan completo'],['20','Últimas 20'],['50','Últimas 50'],['100','Últimas 100'],['month','Mes actual']];
let goalViewState={status:'',horizon:''};
let editingGoalId=null;

function ensurePlanGoals(p){
  if(!p)return p;
  p.goals=Array.isArray(p.goals)?p.goals:[];
  p.goals=p.goals.map(g=>({
    id:g?.id||uid('GOAL'),
    name:String(g?.name||'Objetivo'),
    metric:GOAL_METRICS.some(x=>x[0]===g?.metric)?g.metric:'sample',
    target:Number(g?.target)||0,
    horizon:GOAL_HORIZONS.some(x=>x[0]===String(g?.horizon))?String(g.horizon):'all',
    unit:['r','ticks','usd'].includes(g?.unit)?g.unit:'r',
    basis:g?.basis==='gross'?'gross':'net',
    active:g?.active!==false,
    note:String(g?.note||''),
    createdAt:g?.createdAt||new Date().toISOString(),
    updatedAt:g?.updatedAt||g?.createdAt||new Date().toISOString()
  }));
  return p;
}
state.tradingPlans.forEach(ensurePlanGoals);
const makeBlankPlanV20Base=makeBlankPlan;
makeBlankPlan=function(meta={}){const p=makeBlankPlanV20Base(meta);ensurePlanGoals(p);return p;};
const normalizePlanV20Base=normalizePlan;
normalizePlan=function(p,instruments){const out=normalizePlanV20Base(p,instruments);ensurePlanGoals(out);return out;};
const normalizeStateV20Base=normalizeState;
normalizeState=function(raw){const out=normalizeStateV20Base(raw);(out.tradingPlans||[]).forEach(ensurePlanGoals);return out;};

function goalMetricDef(metric){return GOAL_METRICS.find(x=>x[0]===metric)||GOAL_METRICS[0];}
function goalMetricLabel(metric){return goalMetricDef(metric)[1];}
function goalHorizonLabel(h){return GOAL_HORIZONS.find(x=>x[0]===String(h))?.[1]||'Plan completo';}
function goalOps(goal){
  let ops=[...currentOps()].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));
  if(goal.horizon==='20'||goal.horizon==='50'||goal.horizon==='100')ops=ops.slice(-Number(goal.horizon));
  if(goal.horizon==='month'){
    const now=new Date(),y=now.getFullYear(),m=now.getMonth();
    ops=ops.filter(o=>{const d=new Date(o.entryDate);return !isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m;});
  }
  return ops;
}
function goalEval(goal){
  const ops=goalOps(goal),stats=calcMetricStats(ops,goal.unit,goal.basis),target=Number(goal.target)||0;
  let value=0,hasData=true,display='',targetDisplay='',direction=goalMetricDef(goal.metric)[2];
  if(goal.metric==='sample'){value=ops.length;display=String(value);targetDisplay=String(target);}
  else if(goal.metric==='expectancy'){value=stats.expectancy;display=metricStatText(value,goal.unit);targetDisplay=metricStatText(target,goal.unit);}
  else if(goal.metric==='result'){value=stats.sum;display=metricStatText(value,goal.unit);targetDisplay=metricStatText(target,goal.unit);}
  else if(goal.metric==='winrate'){value=stats.winRate;display=`${value.toFixed(1)}%`;targetDisplay=`${target.toFixed(1)}%`;}
  else if(goal.metric==='maxdd'){value=Math.abs(stats.maxDD);display=`${Math.abs(value).toFixed(goal.unit==='ticks'?1:2)}${goal.unit==='r'?'R':goal.unit==='ticks'?'t':' US$'}`;targetDisplay=`${Math.abs(target).toFixed(goal.unit==='ticks'?1:2)}${goal.unit==='r'?'R':goal.unit==='ticks'?'t':' US$'}`;}
  else if(goal.metric==='compliance'){
    const evals=ops.filter(o=>o?.compliance?.evaluated),scores=evals.map(complianceScore).filter(v=>v!==null);hasData=!!scores.length;value=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;display=hasData?`${value.toFixed(1)}%`:'—';targetDisplay=`${target.toFixed(1)}%`;
  } else if(goal.metric==='coverage'){
    const evals=ops.filter(o=>o?.compliance?.evaluated).length;hasData=!!ops.length;value=ops.length?evals/ops.length*100:0;display=hasData?`${value.toFixed(1)}%`:'—';targetDisplay=`${target.toFixed(1)}%`;
  } else if(goal.metric==='journal'){
    const done=ops.filter(hasEmotionalEntry).length;hasData=!!ops.length;value=ops.length?done/ops.length*100:0;display=hasData?`${value.toFixed(1)}%`:'—';targetDisplay=`${target.toFixed(1)}%`;
  } else if(goal.metric==='mfe'){
    const done=ops.filter(o=>Number(o.mfe)>0).length;hasData=!!ops.length;value=ops.length?done/ops.length*100:0;display=hasData?`${value.toFixed(1)}%`:'—';targetDisplay=`${target.toFixed(1)}%`;
  } else if(goal.metric==='discipline'){
    hasData=!!ops.length;value=ops.length?ops.filter(o=>o.discipline).length/ops.length*100:0;display=hasData?`${value.toFixed(1)}%`:'—';targetDisplay=`${target.toFixed(1)}%`;
  }
  const met=hasData&&(direction==='max'?value<=target:value>=target);
  let progress=0;
  if(hasData){
    if(direction==='max')progress=target<=0?(value<=target?100:0):Math.max(0,Math.min(100,(target/Math.max(value,target))*100));
    else progress=target<=0?(value>=target?100:0):Math.max(0,Math.min(100,value/target*100));
  }
  return {ops,value,target,display,targetDisplay,met,hasData,progress,direction,stats};
}
function goalMetricNeedsUnit(metric){return ['expectancy','result','maxdd'].includes(metric);}
function goalRefreshMetricFields(){
  const metric=document.getElementById('f-goal-metric')?.value||'sample',box=document.getElementById('goal-unit-fields');
  if(box)box.style.display=goalMetricNeedsUnit(metric)?'grid':'none';
  const hint=document.getElementById('goal-target-hint'),def=goalMetricDef(metric);
  if(hint)hint.textContent=def[2]==='max'?'El objetivo se cumple si el valor es igual o menor al límite.':'El objetivo se cumple si el valor alcanza o supera el mínimo.';
}
function openGoalModal(id=null){
  const p=getCurrentPlan();if(!p)return;ensurePlanGoals(p);editingGoalId=id;
  const g=id?p.goals.find(x=>x.id===id):{name:'',metric:'sample',target:100,horizon:'all',unit:'r',basis:'net',active:true,note:''};
  const body=`<form onsubmit="return false"><div class="form-section"><h4>Definición del objetivo</h4><div class="form-grid">${field('Nombre','goal-name','text',esc(g.name||''),'span2')}${selectObjField('Métrica','goal-metric',GOAL_METRICS.map(([value,label])=>({value,label})),g.metric,`onchange="goalRefreshMetricFields()"`)}${field('Objetivo / límite','goal-target','number',g.target,'',`step="0.01"`)}${selectObjField('Horizonte','goal-horizon',GOAL_HORIZONS.map(([value,label])=>({value,label})),g.horizon)}<div class="field"><label>Estado</label><select id="f-goal-active" class="select"><option value="1" ${g.active?'selected':''}>Activo</option><option value="0" ${!g.active?'selected':''}>Pausado</option></select></div><div id="goal-unit-fields" class="goal-unit-fields span2" style="display:${goalMetricNeedsUnit(g.metric)?'grid':'none'}">${selectObjField('Unidad','goal-unit',[{value:'r',label:'R'},{value:'ticks',label:'Ticks'},{value:'usd',label:'US$'}],g.unit)}${selectObjField('Base','goal-basis',[{value:'gross',label:'Bruto'},{value:'net',label:'Neto'}],g.basis)}</div>${field('Nota / criterio','goal-note','textarea',esc(g.note||''),'span2')}</div><div id="goal-target-hint" class="notice" style="margin-top:12px">${goalMetricDef(g.metric)[2]==='max'?'El objetivo se cumple si el valor es igual o menor al límite.':'El objetivo se cumple si el valor alcanza o supera el mínimo.'}</div></div></form>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar objetivo':'Nuevo objetivo',body,`<button class="btn" onclick="closeModal();editingGoalId=null">Cancelar</button><button class="btn primary" onclick="saveGoal()">Guardar objetivo</button>`));
}
function saveGoal(){
  const p=getCurrentPlan(),g=n=>document.getElementById(`f-${n}`)?.value??'';if(!p)return;ensurePlanGoals(p);
  const name=String(g('goal-name')).trim();if(!name)return alert('Escribe un nombre para el objetivo.');
  const old=editingGoalId?p.goals.find(x=>x.id===editingGoalId):null,now=new Date().toISOString();
  const item={id:old?.id||uid('GOAL'),name,metric:GOAL_METRICS.some(x=>x[0]===g('goal-metric'))?g('goal-metric'):'sample',target:Number(g('goal-target'))||0,horizon:GOAL_HORIZONS.some(x=>x[0]===String(g('goal-horizon')))?String(g('goal-horizon')):'all',unit:['r','ticks','usd'].includes(g('goal-unit'))?g('goal-unit'):'r',basis:g('goal-basis')==='gross'?'gross':'net',active:g('goal-active')!=='0',note:String(g('goal-note')).trim(),createdAt:old?.createdAt||now,updatedAt:now};
  const i=p.goals.findIndex(x=>x.id===item.id);if(i>=0)p.goals[i]=item;else p.goals.unshift(item);p.updatedAt=now;editingGoalId=null;persist();closeModal();render();
}
function deleteGoal(id){const p=getCurrentPlan();ensurePlanGoals(p);const g=p?.goals?.find(x=>x.id===id);if(!g)return;if(!confirm(`¿Eliminar el objetivo “${g.name}”?`))return;p.goals=p.goals.filter(x=>x.id!==id);p.updatedAt=new Date().toISOString();persist();render();}
function toggleGoalActive(id){const p=getCurrentPlan(),g=p?.goals?.find(x=>x.id===id);if(!g)return;g.active=!g.active;g.updatedAt=new Date().toISOString();p.updatedAt=g.updatedAt;persist();render();}
function goalReadFilters(){goalViewState.status=document.getElementById('goalStatusFilter')?.value||'';goalViewState.horizon=document.getElementById('goalHorizonFilter')?.value||'';render();}
function goalResetFilters(){goalViewState={status:'',horizon:''};render();}
function goalFilteredRows(){
  const p=getCurrentPlan();ensurePlanGoals(p);
  return (p.goals||[]).map(g=>({g,e:goalEval(g)})).filter(({g,e})=>{
    if(goalViewState.horizon&&g.horizon!==goalViewState.horizon)return false;
    if(goalViewState.status==='active'&&!g.active)return false;
    if(goalViewState.status==='paused'&&g.active)return false;
    if(goalViewState.status==='met'&&(!g.active||!e.met))return false;
    if(goalViewState.status==='pending'&&(!g.active||e.met))return false;
    return true;
  });
}
function goalCard(row){
  const {g,e}=row,status=!g.active?'Pausado':!e.hasData?'Sin datos':e.met?'Cumplido':'En progreso',cls=!g.active?'':!e.hasData?'':e.met?'win':'warn';
  return `<article class="goal-card"><div class="goal-card-head"><div><div class="review-badges"><span class="badge ${cls}">${status}</span><span class="tag">${esc(goalHorizonLabel(g.horizon))}</span></div><h3>${esc(g.name)}</h3><small>${esc(goalMetricLabel(g.metric))}</small></div><div class="goal-actions"><button class="btn small" onclick="openGoalModal('${g.id}')">Editar</button><button class="btn small ghost" onclick="toggleGoalActive('${g.id}')">${g.active?'Pausar':'Activar'}</button><button class="btn small danger" onclick="deleteGoal('${g.id}')">Eliminar</button></div></div><div class="goal-values"><div><span>Actual</span><strong class="${e.met?'positive':''}">${esc(e.display)}</strong></div><div><span>${e.direction==='max'?'Límite':'Objetivo'}</span><strong>${esc(e.targetDisplay)}</strong></div><div><span>Muestra</span><strong>${e.ops.length}</strong></div></div><div class="goal-progress"><i><b style="width:${e.progress}%"></b></i><em>${Math.round(e.progress)}%</em></div>${g.note?`<p class="goal-note">${esc(g.note)}</p>`:''}</article>`;
}
function goalsView(){
  const p=getCurrentPlan();ensurePlanGoals(p);const all=(p.goals||[]).map(g=>({g,e:goalEval(g)})),rows=goalFilteredRows(),active=all.filter(x=>x.g.active),met=active.filter(x=>x.e.met).length,pending=active.filter(x=>!x.e.met).length,noData=active.filter(x=>!x.e.hasData).length;
  const controls=`<button class="btn primary" onclick="openGoalModal()">+ Nuevo objetivo</button>`;
  const filter=`<section class="card filter-hub"><div class="filter-hub-top"><div><h3>Scorecard del plan</h3><p>Objetivos dinámicos: se recalculan sobre los datos actuales del Trading Plan.</p></div><button class="btn small ghost" onclick="goalResetFilters()">Limpiar</button></div><div class="filter-grid"><label class="filter-field"><span>Estado</span><select id="goalStatusFilter" class="select" onchange="goalReadFilters()"><option value="">Todos</option><option value="active" ${goalViewState.status==='active'?'selected':''}>Activos</option><option value="met" ${goalViewState.status==='met'?'selected':''}>Cumplidos</option><option value="pending" ${goalViewState.status==='pending'?'selected':''}>En progreso</option><option value="paused" ${goalViewState.status==='paused'?'selected':''}>Pausados</option></select></label><label class="filter-field"><span>Horizonte</span><select id="goalHorizonFilter" class="select" onchange="goalReadFilters()"><option value="">Todos</option>${GOAL_HORIZONS.map(([v,l])=>`<option value="${v}" ${goalViewState.horizon===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div></section>`;
  return `${pageHead('Objetivos & Scorecard','Define estándares cuantificables para el proceso y el rendimiento. El Scorecard separa objetivos de investigación, ejecución y calidad de datos.',controls)}${activePlanBanner()}<div class="review-kpis">${kpi('Objetivos',all.length,'definidos en el plan')}${kpi('Activos',active.length,'en seguimiento')}${kpi('Cumplidos',met,'objetivo alcanzado')}${kpi('En progreso',pending-noData,'con datos disponibles')}</div>${filter}<section class="goal-grid">${rows.length?rows.map(goalCard).join(''):'<div class="card empty">Todavía no hay objetivos para esta selección. Crea uno para convertir una regla de mejora en un criterio medible.</div>'}</section><div class="notice goal-method-note"><strong>Criterio:</strong> un objetivo describe el estado actual de una muestra, no garantiza que el edge sea estable ni implica causalidad. Los objetivos de calidad de datos (checklist, diario, MFE) sirven para mejorar la fiabilidad del research.</div>`;
}

/* Widget opcional para el Dashboard personalizable. */
if(!DASHBOARD_PANEL_DEFS.some(x=>x[0]==='goals'))DASHBOARD_PANEL_DEFS.push(['goals','Scorecard de objetivos']);
function dashboardGoalsPanel(){
  const p=getCurrentPlan();ensurePlanGoals(p);const rows=(p.goals||[]).filter(g=>g.active).map(g=>({g,e:goalEval(g)})).slice(0,6);
  return `<section class="card panel dashboard-custom-panel"><div class="panel-title"><div><h3>Scorecard de objetivos</h3><small>Estado de los objetivos activos</small></div><button class="btn tiny ghost" onclick="navigate('goals')">Abrir</button></div><div class="dashboard-goal-list">${rows.length?rows.map(({g,e})=>`<div><span><strong>${esc(g.name)}</strong><small>${esc(e.display)} / ${esc(e.targetDisplay)} · ${esc(goalHorizonLabel(g.horizon))}</small></span><i><b style="width:${e.progress}%"></b></i><em class="badge ${e.met?'win':'warn'}">${e.met?'OK':Math.round(e.progress)+'%'}</em></div>`).join(''):'<div class="empty compact-empty">Sin objetivos activos.</div>'}</div></section>`;
}
const dashboardPanelHtmlV20Base=dashboardPanelHtml;
dashboardPanelHtml=function(id,ctx){if(id==='goals')return dashboardGoalsPanel();return dashboardPanelHtmlV20Base(id,ctx);};

const shellV20Base=shell;
shell=function(){
  let html=shellV20Base(),complianceButton=navBtn('compliance','✓','Cumplimiento');
  html=html.replace(complianceButton,navBtn('goals','◎','Objetivos')+complianceButton);
  return html.replace(V19_APP_LABEL,V20_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Review & Notes + Confianza estadística + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');
};
render=function(){
  document.getElementById('app').innerHTML=shell();const view=document.getElementById('view');
  view.innerHTML=currentView==='dashboard'?dashboard():currentView==='operations'?operations():currentView==='calendar'?calendarView():currentView==='goals'?goalsView():currentView==='compliance'?complianceView():currentView==='lab'?analyticsLab():currentView==='review'?reviewView():currentView==='gallery'?gallery():currentView==='journal'?journal():currentView==='blocks'?blocks():currentView==='plans'?plansView():config();
  setTimeout(hydrateImageElements,0);
};
Object.assign(window,{goalViewState,openGoalModal,goalRefreshMetricFields,saveGoal,deleteGoal,toggleGoalActive,goalReadFilters,goalResetFilters});
render();
/* ===== END V20 PATCH ===== */

/* ===== V21 PATCH · Ayuda contextual + Glosario ===== */
const V21_APP_LABEL='V21 · Ayuda contextual';

const CONTEXT_HELP=[
  {id:'operations',terms:['operaciones','trades visibles','muestra'],title:'Operaciones / muestra',summary:'Número de operaciones incluidas en el cálculo actual.',body:'Indica cuántos trades forman el subconjunto que estás analizando. Es esencial leer cualquier métrica junto con su tamaño de muestra: una cifra llamativa con pocas operaciones puede ser puro ruido.',use:'Úsalo para valorar la madurez de una conclusión y para saber cuánto peso dar a Expectancy, Win Rate, Profit Factor o cualquier comparación.'},
  {id:'winrate',terms:['win rate','wr'],title:'Win Rate',summary:'Porcentaje de operaciones cerradas con resultado ganador.',body:'Se calcula como operaciones ganadoras dividido entre operaciones cerradas evaluadas. Un Win Rate alto no implica por sí solo una estrategia rentable: debe interpretarse junto con el tamaño medio de ganancias y pérdidas.',use:'Compáralo con Expectancy, Profit Factor y la relación entre ganancia media y pérdida media.'},
  {id:'expectancy',terms:['expectancy','r media'],title:'Expectancy',summary:'Resultado medio esperado por operación en la muestra seleccionada.',body:'Es la media aritmética del resultado de todas las operaciones del subconjunto, expresada en R, ticks o US$ según la unidad seleccionada. Resume cuánto ha aportado de media cada trade observado.',use:'Sirve para comparar setups, contextos, horarios o reglas. Una Expectancy positiva necesita una muestra suficiente y estabilidad temporal antes de considerarse evidencia sólida.'},
  {id:'pf',terms:['profit factor','pf'],title:'Profit Factor',summary:'Beneficio bruto total dividido entre pérdida bruta total.',body:'Un Profit Factor mayor que 1 indica que las ganancias agregadas superan las pérdidas agregadas. Si no existen operaciones perdedoras, el valor matemático es infinito (∞).',use:'Úsalo como medida complementaria de eficiencia del conjunto, nunca aislado del número de operaciones ni del drawdown.'},
  {id:'drawdown',terms:['drawdown','max drawdown','max dd','máx. dd','mdd'],title:'Maximum Drawdown',summary:'Mayor caída acumulada desde un máximo de equity hasta el mínimo posterior.',body:'Mide la peor contracción observada de la curva dentro del subconjunto y unidad seleccionados. No es la mayor operación perdedora, sino la peor secuencia acumulada desde un pico.',use:'Sirve para evaluar riesgo, tolerancia psicológica y comparar estrategias con rentabilidades parecidas pero trayectorias distintas.'},
  {id:'result',terms:['resultado','resultado total','resultado acumulado','p&l neto','p&l bruto'],title:'Resultado acumulado',summary:'Suma de los resultados de las operaciones seleccionadas.',body:'Representa el resultado agregado del subconjunto. Puede mostrarse en R, ticks o US$. En base Neta se descuentan las comisiones cuando están disponibles.',use:'Sirve para conocer el impacto total, pero no sustituye a Expectancy: un resultado grande puede deberse simplemente a haber realizado más operaciones.'},
  {id:'commissions',terms:['comisiones','comisión'],title:'Comisiones',summary:'Coste de ejecución registrado para las operaciones seleccionadas.',body:'Suma los costes de comisión asociados a los contratos ejecutados. Permite diferenciar P&L bruto de P&L neto y cuantificar cuánto edge consume la fricción operativa.',use:'Es especialmente relevante en estrategias de alta frecuencia de trades o con objetivos pequeños.'},
  {id:'avgwin',terms:['media ganadora','media ganancia','máx. ganancia'],title:'Ganancia media',summary:'Resultado medio de las operaciones ganadoras.',body:'Calcula la media únicamente sobre trades positivos. Ayuda a entender el tamaño típico de una ganancia y a interpretar correctamente el Win Rate.',use:'Compárala con la pérdida media para entender la asimetría del sistema.'},
  {id:'avgloss',terms:['media perdedora','media pérdida','máx. pérdida'],title:'Pérdida media',summary:'Resultado medio de las operaciones perdedoras.',body:'Calcula la media únicamente sobre trades negativos. Una pérdida media estable cerca del stop planificado suele indicar consistencia en la ejecución del riesgo.',use:'Compárala con la ganancia media, distribución de R y reglas de gestión.'},
  {id:'equity',terms:['equity','equity filtrada','equity en r','equity en ticks','equity en us$'],title:'Curva de Equity',summary:'Evolución acumulada del resultado operación a operación.',body:'Ordena cronológicamente las operaciones y acumula su resultado. Permite observar crecimiento, estancamiento, rachas, drawdowns y cambios de régimen que una métrica agregada puede ocultar.',use:'Busca estabilidad del crecimiento y deterioros persistentes, no solo el valor final.'},
  {id:'distribution',terms:['distribución','distribución de resultados','distribución de riesgo'],title:'Distribución de resultados',summary:'Frecuencia con la que aparecen distintos tamaños de resultado.',body:'Agrupa los trades por rangos para mostrar la forma de la distribución. En R permite comprobar si las pérdidas se concentran cerca de -1R y cómo se distribuyen las ganancias.',use:'Sirve para detectar colas, salidas anticipadas, stops excedidos y concentración excesiva de resultados.'},
  {id:'heatmap',terms:['mapa de calor','heatmap','mapa de calor · día × hora','heatmap · foco × estrés'],title:'Heatmap',summary:'Matriz que compara dos dimensiones mediante color e intensidad.',body:'Cada celda agrupa las operaciones que comparten dos características. El color representa la métrica elegida y el número n indica cuántas operaciones sostienen esa lectura.',use:'Úsalo para descubrir interacciones, pero evita concluir demasiado a partir de celdas con muestra pequeña.'},
  {id:'mfe',terms:['mfe','mfe medio','maximum favorable excursion'],title:'MFE · Maximum Favorable Excursion',summary:'Máximo recorrido favorable alcanzado mientras la operación estuvo abierta.',body:'Mide cuánto llegó a avanzar el precio a favor antes del cierre. En R normaliza ese recorrido respecto al riesgo inicial.',use:'Sirve para estudiar calidad de salida, objetivos potenciales y cuánto recorrido favorable se devuelve antes de cerrar.'},
  {id:'mae',terms:['mae','mae medio','maximum adverse excursion'],title:'MAE · Maximum Adverse Excursion',summary:'Máximo recorrido adverso sufrido mientras la operación estuvo abierta.',body:'Mide la peor excursión en contra antes del cierre. En R permite comparar operaciones con stops de distinto tamaño.',use:'Sirve para estudiar ubicación de stops, calidad de entrada y cuánto riesgo intratrade soportan las operaciones ganadoras.'},
  {id:'researchgrid',terms:['research grid','matriz de edge'],title:'Research Grid',summary:'Tabla dinámica multidimensional para cruzar variables y buscar diferencias de rendimiento.',body:'Permite elegir filas, columnas y métrica para comparar Setup, Contexto, VD, NR, Hipótesis, horario, comportamiento y otras dimensiones. Cada celda se calcula sobre el dataset actual.',use:'Es una herramienta exploratoria. Las combinaciones prometedoras deben confirmarse con muestra suficiente y operaciones nuevas para reducir sesgo de selección.'},
  {id:'exitlab',terms:['exit lab'],title:'Exit Lab',summary:'Laboratorio para estudiar MFE, MAE y eficiencia de las salidas.',body:'Analiza cuánto recorrido favorable se capturó, cuánto se devolvió y escenarios de TP que sí pueden inferirse de los datos disponibles.',use:'Úsalo para evaluar la gestión de salidas sin atribuir a los datos más información de la que realmente contienen.'},
  {id:'capture',terms:['captura media del mfe','captura del mfe','eficiencia de salida'],title:'Captura del MFE',summary:'Proporción del máximo recorrido favorable que terminó convertida en resultado.',body:'Compara el resultado final con el MFE observado. Una captura baja puede señalar cesión de beneficio, aunque no implica automáticamente que una salida anterior hubiera sido óptima.',use:'Sirve para comparar estilos de salida y estudiar si determinados setups devuelven demasiado recorrido.'},
  {id:'confidence',terms:['confianza estadística','evidencia del edge','madurez de muestra'],title:'Confianza estadística',summary:'Capa que cuantifica la incertidumbre de las métricas observadas.',body:'Distingue la estimación puntual de la evidencia que la sostiene. Una muestra amplia reduce incertidumbre, pero no elimina sesgos de selección, cambios de régimen ni dependencia entre operaciones.',use:'Úsala para decidir cuándo una hipótesis merece seguimiento y cuándo todavía es exploratoria.'},
  {id:'ci95',terms:['ic 95% · expectancy','ic 95%','intervalo 95%'],title:'IC 95% de la Expectancy',summary:'Rango aproximado de valores plausibles para la media de la muestra.',body:'Se construye alrededor de la Expectancy observada usando su error estándar. Un intervalo ancho indica mucha incertidumbre; uno estrecho indica mayor precisión estadística.',use:'Si todo el intervalo está por encima de cero, la evidencia positiva es más fuerte que una Expectancy positiva aislada, aunque no constituye una prueba absoluta de edge.'},
  {id:'lower95',terms:['límite inferior 95%'],title:'Límite inferior 95%',summary:'Extremo conservador del intervalo de confianza de la Expectancy.',body:'Representa una lectura prudente de la media compatible con el IC aproximado. Penaliza automáticamente las muestras pequeñas o muy variables.',use:'Es útil para ordenar combinaciones del Research Grid evitando favorecer únicamente valores espectaculares con n muy pequeño.'},
  {id:'stddev',terms:['desviación por trade','desviación estándar'],title:'Desviación por trade',summary:'Dispersión de los resultados individuales alrededor de la media.',body:'Cuanto mayor es, más variables son los resultados operación a operación. Una alta dispersión ensancha el intervalo de confianza de la Expectancy.',use:'Sirve para entender cuánta volatilidad existe detrás de una media aparentemente buena.'},
  {id:'stderr',terms:['error estándar'],title:'Error estándar',summary:'Incertidumbre estimada de la media de la muestra.',body:'Aproximadamente es la desviación estándar dividida por la raíz del número de operaciones. Disminuye al crecer la muestra si la distribución permanece comparable.',use:'Es la base para construir el intervalo de confianza aproximado de la Expectancy.'},
  {id:'compliance',terms:['cobertura checklist','cumplimiento medio','obligatorias 100%','cumplimiento checklist','cumplimiento por regla'],title:'Plan Compliance',summary:'Mide cuánto se cumplen las reglas objetivas definidas en el Trading Plan.',body:'Solo las operaciones evaluadas entran en estas métricas. Las operaciones antiguas sin checklist permanecen como no evaluadas, nunca como incumplimientos.',use:'Permite separar el resultado del mercado de la calidad de ejecución y estudiar asociaciones entre reglas incumplidas y rendimiento.'},
  {id:'discipline',terms:['disciplina'],title:'Disciplina',summary:'Valoración registrada de la calidad de ejecución del trade.',body:'Es una capa distinta del checklist objetivo del plan. Puede reflejar tu evaluación global de la ejecución aunque todas las reglas técnicas se hayan cumplido o viceversa.',use:'Úsala junto al diario emocional y Compliance para detectar patrones de proceso.'},
  {id:'stress',terms:['estrés','estrés medio'],title:'Nivel de Estrés',summary:'Intensidad de estrés registrada en el diario emocional.',body:'Escala subjetiva de 1 a 5 asociada a cada operación cuando el diario está completado.',use:'Sirve para cruzar estado psicológico y rendimiento, especialmente mediante el heatmap Foco × Estrés.'},
  {id:'focus',terms:['foco','foco medio'],title:'Nivel de Foco',summary:'Nivel de concentración percibido durante la operación.',body:'Escala subjetiva de 1 a 5 registrada en el diario emocional.',use:'Permite estudiar si determinados niveles de concentración se asocian con mejor cumplimiento o rendimiento.'},
  {id:'scorecard',terms:['objetivos & scorecard','scorecard del plan','scorecard de objetivos'],title:'Objetivos & Scorecard',summary:'Seguimiento de criterios cuantificables definidos para el Trading Plan.',body:'Cada objetivo se recalcula sobre los datos actuales y puede medir rendimiento, riesgo, cumplimiento o calidad del dataset.',use:'Sirve para convertir intenciones como “registrar MFE en el 95%” o “mantener DD bajo X” en condiciones medibles.'},
  {id:'goalprogress',terms:['progreso','objetivo','límite'],title:'Progreso de objetivo',summary:'Grado de avance del valor actual respecto al objetivo o límite definido.',body:'Para objetivos mínimos, el progreso aumenta al acercarse o superar el valor deseado. Para límites máximos, el estado se evalúa comprobando que el valor no exceda el umbral.',use:'Es un indicador de estado, no una evidencia de causalidad ni de estabilidad futura.'},
  {id:'reviews',terms:['review & notes','archivo de investigación'],title:'Review & Notes',summary:'Archivo de hallazgos, decisiones y conclusiones del proceso de investigación.',body:'Permite vincular una observación a un trade, día, semana, mes, bloque, estudio o Trading Plan y conservar la decisión que surgió de ella.',use:'Sirve para transformar análisis dispersos en conocimiento acumulado y revisar hipótesis cuando crece la muestra.'},
  {id:'savedstudies',terms:['estudios guardados','comparación de estudios'],title:'Estudios guardados',summary:'Configuraciones reutilizables de filtros y parámetros del Laboratorio.',body:'Un estudio guarda la definición del análisis, no una copia congelada de las operaciones. Al abrirlo más adelante consulta el dataset actual.',use:'Sirve para seguir hipótesis a lo largo del tiempo y comparar muestras sin reconstruir filtros manualmente.'},
  {id:'calendar',terms:['calendario de rendimiento'],title:'Calendario de rendimiento',summary:'Vista temporal diaria y mensual del rendimiento y proceso.',body:'Agrupa las operaciones por día y permite colorearlas por Resultado, Expectancy, Win Rate o Disciplina.',use:'Ayuda a localizar rachas, días anómalos, patrones temporales y jornadas que merecen una review.'},
  {id:'r',terms:['unidad analítica'],title:'Unidad analítica · R / Ticks / US$',summary:'Cambia la unidad con la que se expresan las métricas financieras.',body:'R normaliza el resultado por el riesgo inicial de cada operación; Ticks expresa movimiento de precio; US$ expresa impacto monetario según contrato y tamaño.',use:'Usa R para comparar riesgos distintos, ticks para estudiar comportamiento del instrumento y US$ para impacto económico real.'},
  {id:'basis',terms:['base'],title:'Bruto / Neto',summary:'Define si el resultado se calcula antes o después de costes registrados.',body:'Bruto refleja el resultado de mercado. Neto descuenta comisiones cuando están disponibles.',use:'Para evaluar rendimiento económico real suele ser preferible Neto; para estudiar comportamiento puro del precio puede ser útil Bruto.'},
  {id:'conflictguard',terms:['conflict guard'],title:'Conflict Guard',summary:'Protección frente a sobrescrituras entre dispositivos con revisiones diferentes.',body:'Cada dispositivo conserva una revisión base de Supabase. Si la nube cambió desde esa revisión y existen cambios locales, la aplicación bloquea una subida normal para evitar perder trabajo.',use:'Sirve como barrera de seguridad al trabajar con varios navegadores o dispositivos.'},
  {id:'snapshots',terms:['snapshots locales de seguridad'],title:'Snapshots locales',summary:'Copias de seguridad del estado local antes de operaciones sensibles.',body:'Guardan estados recientes antes de subidas o descargas importantes para permitir recuperar trabajo descartado accidentalmente.',use:'Son una red de seguridad adicional; no sustituyen a Supabase ni al backup completo.'}
];

function helpNormalizeText(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9%$+\/·× -]+/g,' ').replace(/\s+/g,' ').trim();}
function helpEntryForText(text){
  const t=helpNormalizeText(text);
  if(!t)return null;
  let best=null,bestLen=0;
  for(const item of CONTEXT_HELP){
    for(const term of item.terms){const n=helpNormalizeText(term);if(!n)continue;if((t===n||t.startsWith(n+' ')||t.includes(n))&&n.length>bestLen){best=item;bestLen=n.length;}}
  }
  return best;
}
function helpButtonHtml(id){return `<button type="button" class="info-dot" data-help-id="${esc(id)}" aria-label="Información" title="Información">i</button>`;}
function ensureHelpPopover(){
  let el=document.getElementById('context-help-popover');
  if(el)return el;
  el=document.createElement('div');el.id='context-help-popover';el.className='context-help-popover';el.setAttribute('role','tooltip');el.innerHTML='<strong></strong><p></p>';
  document.body.appendChild(el);return el;
}
function positionHelpPopover(btn,el){
  const r=btn.getBoundingClientRect(),pad=12,w=Math.min(330,window.innerWidth-pad*2);el.style.width=w+'px';
  let left=Math.min(window.innerWidth-w-pad,Math.max(pad,r.left+r.width/2-w/2));
  let top=r.bottom+8;if(top+150>window.innerHeight)top=Math.max(pad,r.top-138);
  el.style.left=left+'px';el.style.top=top+'px';
}
function showHelpHover(btn){
  const item=CONTEXT_HELP.find(x=>x.id===btn.dataset.helpId);if(!item)return;
  const el=ensureHelpPopover();el.querySelector('strong').textContent=item.title;el.querySelector('p').textContent=item.summary;positionHelpPopover(btn,el);el.classList.add('show');
}
function hideHelpHover(){document.getElementById('context-help-popover')?.classList.remove('show');}
function openContextHelp(id){
  hideHelpHover();const item=CONTEXT_HELP.find(x=>x.id===id);if(!item)return;
  const body=`<div class="context-help-modal"><div class="context-help-summary">${esc(item.summary)}</div><div><span>Qué significa</span><p>${esc(item.body)}</p></div><div><span>Para qué sirve</span><p>${esc(item.use)}</p></div></div>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(`ⓘ ${esc(item.title)}`,body,`<button class="btn primary" onclick="closeModal()">Entendido</button>`));
}
function openGlossary(){
  const body=`<div class="glossary-search"><input class="input" id="glossary-search" placeholder="Buscar métrica o concepto…" oninput="filterGlossary(this.value)"></div><div id="glossary-list" class="glossary-list">${CONTEXT_HELP.map(x=>`<button type="button" data-glossary-search="${esc(helpNormalizeText(x.title+' '+x.summary+' '+x.body))}" onclick="openContextHelp('${x.id}')"><strong>${esc(x.title)}</strong><span>${esc(x.summary)}</span></button>`).join('')}</div>`;
  document.body.insertAdjacentHTML('beforeend',modalShell('Glosario de Trading Research',body,`<button class="btn" onclick="closeModal()">Cerrar</button>`));
}
function filterGlossary(q){const n=helpNormalizeText(q);document.querySelectorAll('#glossary-list [data-glossary-search]').forEach(el=>el.classList.toggle('hidden',n&&!el.dataset.glossarySearch.includes(n)));}
function attachInfoButton(el,item){
  if(!el||!item||el.dataset.helpAttached)return;el.dataset.helpAttached=item.id;
  const btn=document.createElement('button');btn.type='button';btn.className='info-dot';btn.dataset.helpId=item.id;btn.textContent='i';btn.setAttribute('aria-label',`Información: ${item.title}`);btn.title='Información';
  btn.addEventListener('mouseenter',()=>showHelpHover(btn));btn.addEventListener('mouseleave',hideHelpHover);btn.addEventListener('focus',()=>showHelpHover(btn));btn.addEventListener('blur',hideHelpHover);btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openContextHelp(item.id);});
  el.appendChild(btn);
}
function applyContextHelp(){
  const selectors=['.kpi .label','.panel-title h3','.calendar-month-kpis span','.calendar-detail-kpis span','.dashboard-mini-stats span','.block-core-grid span','.block-detail-kpis span','.confidence-stats span','.confidence-main-card span','.confidence-split span','.compliance-kpis .label','.goal-values span','.filter-hub-top h3','.page-title h2','.trade-detail-kpis span','.research-grid-controls label>span','.exit-kpis span','th'];
  document.querySelectorAll(selectors.join(',')).forEach(el=>{if(el.closest('.context-help-modal,.glossary-list'))return;const item=helpEntryForText(el.childNodes?.[0]?.textContent||el.textContent);if(item)attachInfoButton(el,item);});
  document.querySelectorAll('.metric-switch>span,.calendar-metric-select>span').forEach(el=>{const item=helpEntryForText(el.textContent);if(item)attachInfoButton(el,item);});
  const side=document.querySelector('.side-bottom .mini-card');if(side&&!side.querySelector('.open-glossary-btn'))side.insertAdjacentHTML('beforeend',`<button type="button" class="open-glossary-btn" onclick="openGlossary()">ⓘ Glosario</button>`);
}

const shellV21Base=shell;
shell=function(){
  return shellV21Base().replace(V20_APP_LABEL,V21_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Ayuda contextual + Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');
};
let contextHelpObserver=null,contextHelpTimer=null;
function ensureContextHelpObserver(){
  const root=document.getElementById('app');if(!root||contextHelpObserver)return;
  contextHelpObserver=new MutationObserver(()=>{clearTimeout(contextHelpTimer);contextHelpTimer=setTimeout(applyContextHelp,20);});
  contextHelpObserver.observe(root,{childList:true,subtree:true});
}
const renderV21Base=render;
render=function(){renderV21Base();ensureContextHelpObserver();setTimeout(applyContextHelp,0);};
Object.assign(window,{openContextHelp,openGlossary,filterGlossary});
render();
/* ===== END V21 PATCH ===== */

/* ===== V22 PATCH · Robustez / Monte Carlo ===== */
const V22_APP_LABEL='V22 · Robustez Monte Carlo';
let robustnessState={horizon:'sample',iterations:1000};
const robustnessCache=new Map();

function robustHash(str){
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function robustRng(seed){
  let a=seed>>>0;
  return function(){
    a|=0;a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function robustQuantile(sorted,p){
  if(!sorted.length)return NaN;
  const pos=(sorted.length-1)*Math.max(0,Math.min(1,p)),lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return sorted[lo];
  const t=pos-lo;return sorted[lo]*(1-t)+sorted[hi]*t;
}
function robustMaxDrawdown(vals){
  let eq=0,peak=0,worst=0;
  for(const v of vals){eq+=v;if(eq>peak)peak=eq;const dd=eq-peak;if(dd<worst)worst=dd;}
  return worst;
}
function robustMaxLosingStreak(vals){
  let run=0,best=0;
  for(const v of vals){if(v<0){run++;if(run>best)best=run;}else run=0;}
  return best;
}
function robustHorizon(n){return robustnessState.horizon==='sample'?Math.max(1,n):Math.max(1,Number(robustnessState.horizon)||100);}
function robustnessSetHorizon(v){robustnessState.horizon=v==='sample'?'sample':String([20,50,100,200].includes(Number(v))?Number(v):100);render();}
function robustnessSetIterations(v){const n=Number(v);robustnessState.iterations=[500,1000,2500].includes(n)?n:1000;render();}
function robustSimulation(ops){
  const vals=ops.map(o=>opMetricValue(o,labState.unit,labState.basis)).filter(Number.isFinite),n=vals.length;
  if(!n)return null;
  const horizon=robustHorizon(n),iterations=robustnessState.iterations;
  const signature=`${labState.unit}|${labState.basis}|${horizon}|${iterations}|${ops.map(o=>`${o.id}:${Number(opMetricValue(o,labState.unit,labState.basis)||0).toFixed(6)}`).join('|')}`;
  const key=String(robustHash(signature));if(robustnessCache.has(key))return robustnessCache.get(key);
  const rnd=robustRng(robustHash(signature+'|seed'));
  const terminal=[],means=[],dds=[],streaks=[];
  const fanCount=Math.min(horizon,60),steps=[];
  for(let i=0;i<=fanCount;i++)steps.push(Math.round(i*horizon/fanCount));
  const uniqueSteps=[...new Set(steps)],buckets=uniqueSteps.map(()=>[]);
  for(let s=0;s<iterations;s++){
    let cum=0,peak=0,worst=0,run=0,maxRun=0,cp=1;buckets[0].push(0);
    for(let j=1;j<=horizon;j++){
      const v=vals[Math.floor(rnd()*n)];cum+=v;
      if(cum>peak)peak=cum;const dd=cum-peak;if(dd<worst)worst=dd;
      if(v<0){run++;if(run>maxRun)maxRun=run;}else run=0;
      if(cp<uniqueSteps.length&&j===uniqueSteps[cp]){buckets[cp].push(cum);cp++;}
    }
    terminal.push(cum);means.push(cum/horizon);dds.push(worst);streaks.push(maxRun);
  }
  terminal.sort((a,b)=>a-b);means.sort((a,b)=>a-b);dds.sort((a,b)=>a-b);streaks.sort((a,b)=>a-b);
  const fan=uniqueSteps.map((step,i)=>{const b=buckets[i].sort((a,b)=>a-b);return {step,low:robustQuantile(b,.05),median:robustQuantile(b,.5),high:robustQuantile(b,.95)};});
  const out={n,horizon,iterations,terminal,means,dds,streaks,fan,
    positivePct:terminal.filter(v=>v>0).length/iterations*100,
    negativePct:terminal.filter(v=>v<0).length/iterations*100,
    finalP5:robustQuantile(terminal,.05),finalP50:robustQuantile(terminal,.5),finalP95:robustQuantile(terminal,.95),
    expP5:robustQuantile(means,.05),expP50:robustQuantile(means,.5),expP95:robustQuantile(means,.95),
    ddMedian:robustQuantile(dds,.5),ddTail:robustQuantile(dds,.05),streakP95:Math.round(robustQuantile(streaks,.95))
  };
  robustnessCache.set(key,out);if(robustnessCache.size>16)robustnessCache.delete(robustnessCache.keys().next().value);return out;
}
function robustText(v){return Number.isFinite(v)?metricStatText(v,labState.unit):'—';}
function robustnessFanSvg(sim){
  const w=920,h=260,padL=54,padR=18,padT=22,padB=38,all=sim.fan.flatMap(x=>[x.low,x.high,0]),min=Math.min(...all),max=Math.max(...all),span=max-min||1;
  const x=v=>padL+(v/sim.horizon)*(w-padL-padR),y=v=>padT+(max-v)/span*(h-padT-padB);
  const high=sim.fan.map(d=>`${x(d.step).toFixed(1)},${y(d.high).toFixed(1)}`).join(' L '),low=[...sim.fan].reverse().map(d=>`${x(d.step).toFixed(1)},${y(d.low).toFixed(1)}`).join(' L '),med=sim.fan.map(d=>`${x(d.step).toFixed(1)},${y(d.median).toFixed(1)}`).join(' L ');
  const zero=y(0),mid=Math.round(sim.horizon/2);
  return `<div class="robust-chart-wrap"><svg class="robust-fan-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Distribución bootstrap acumulada entre percentiles 5 y 95"><line x1="${padL}" y1="${zero}" x2="${w-padR}" y2="${zero}" class="robust-zero"/><path d="M ${high} L ${low} Z" class="robust-band"/><path d="M ${med}" class="robust-median"/><text x="${padL}" y="${h-12}" class="robust-axis">0</text><text x="${x(mid)}" y="${h-12}" text-anchor="middle" class="robust-axis">${mid}</text><text x="${w-padR}" y="${h-12}" text-anchor="end" class="robust-axis">${sim.horizon} trades</text><text x="${padL-8}" y="${y(max)+4}" text-anchor="end" class="robust-axis">${esc(robustText(max))}</text><text x="${padL-8}" y="${y(min)+4}" text-anchor="end" class="robust-axis">${esc(robustText(min))}</text></svg><div class="robust-legend"><span><i class="median"></i>Mediana</span><span><i class="band"></i>Percentiles 5–95</span></div></div>`;
}
function robustnessModule(ops){
  const sim=robustSimulation(ops),n=ops.length;
  const controls=`<div class="robust-controls"><label><span>Horizonte</span><select class="select compact-select" onchange="robustnessSetHorizon(this.value)"><option value="sample" ${robustnessState.horizon==='sample'?'selected':''}>Muestra actual (${n})</option>${[20,50,100,200].map(v=>`<option value="${v}" ${String(robustnessState.horizon)===String(v)?'selected':''}>${v} trades</option>`).join('')}</select></label><label><span>Simulaciones</span><select class="select compact-select" onchange="robustnessSetIterations(this.value)">${[500,1000,2500].map(v=>`<option value="${v}" ${robustnessState.iterations===v?'selected':''}>${v.toLocaleString('es-ES')}</option>`).join('')}</select></label></div>`;
  if(!sim)return `<section class="card panel lab-module lab-span-2 robustness-module"><div class="panel-title"><div><h3>Robustez · Bootstrap / Monte Carlo</h3><small>Reordena y remuestrea la distribución observada para estudiar sensibilidad de secuencia.</small></div>${controls}</div><div class="empty">No hay operaciones en el subconjunto actual.</div></section>`;
  const observed=calcMetricStats(ops,labState.unit,labState.basis),actualStreak=robustMaxLosingStreak(ops.map(o=>opMetricValue(o,labState.unit,labState.basis)).filter(Number.isFinite));
  return `<section class="card panel lab-module lab-span-2 robustness-module">
    <div class="panel-title"><div><h3>Robustez · Bootstrap / Monte Carlo</h3><small>${sim.iterations.toLocaleString('es-ES')} remuestreos con reemplazo sobre la distribución de ${sim.n} trades observados.</small></div>${controls}</div>
    <div class="robust-kpis">
      <div><span>Secuencias positivas</span><strong class="${sim.positivePct>=50?'positive':'negative'}">${sim.positivePct.toFixed(1)}%</strong><small>resultado final &gt; 0 en ${sim.horizon} trades</small></div>
      <div><span>Resultado final · p5 → p95</span><strong>${robustText(sim.finalP5)} → ${robustText(sim.finalP95)}</strong><small>rango central del 90% simulado</small></div>
      <div><span>Expectancy · p5 → p95</span><strong>${robustText(sim.expP5)} → ${robustText(sim.expP95)}</strong><small>bootstrap del promedio por trade</small></div>
      <div><span>Max DD mediano</span><strong class="${sim.ddMedian<0?'negative':''}">${robustText(sim.ddMedian)}</strong><small>mediana del peor DD por secuencia</small></div>
      <div><span>DD severo · peor 5%</span><strong class="negative">${robustText(sim.ddTail)}</strong><small>cola adversa de las simulaciones</small></div>
      <div><span>Racha perdedora · p95</span><strong>${sim.streakP95}</strong><small>95% de secuencias no supera esta racha</small></div>
    </div>
    <div class="robust-layout"><div>${robustnessFanSvg(sim)}</div><div class="robust-readout">
      <div><span>Mediana final</span><strong class="${sim.finalP50>0?'positive':sim.finalP50<0?'negative':''}">${robustText(sim.finalP50)}</strong></div>
      <div><span>Expectancy mediana bootstrap</span><strong class="${sim.expP50>0?'positive':sim.expP50<0?'negative':''}">${robustText(sim.expP50)}</strong></div>
      <div><span>DD observado · muestra actual</span><strong class="${observed.maxDD<0?'negative':''}">${robustText(observed.maxDD)}</strong></div>
      <div><span>Racha perdedora observada</span><strong>${actualStreak}</strong></div>
      <div><span>Riesgo de cierre negativo</span><strong class="${sim.negativePct>25?'negative':''}">${sim.negativePct.toFixed(1)}%</strong></div>
    </div></div>
    <div class="lab-note warn"><strong>Interpretación:</strong> esto es un análisis de robustez, no una predicción. El bootstrap supone que la distribución observada puede remuestrearse como si los trades fueran razonablemente intercambiables. No modela cambios de régimen, dependencia temporal, slippage futuro ni deterioro del edge. Úsalo para preguntar “¿qué tan sensible es mi resultado al orden y a la variabilidad de mi muestra?”, no “¿qué ganaré en los próximos ${sim.horizon} trades?”.</div>
  </section>`;
}


if(typeof CONTEXT_HELP!=='undefined'){
  CONTEXT_HELP.push(
    {id:'montecarlo',terms:['robustez monte carlo','bootstrap monte carlo','secuencias positivas'],title:'Robustez · Bootstrap / Monte Carlo',summary:'Remuestrea los resultados observados muchas veces para estudiar cuánto puede cambiar el resultado por variabilidad y orden de la muestra.',body:'Cada secuencia se construye tomando operaciones de la distribución observada con reemplazo. Se calculan resultado final, expectancy, drawdown y rachas para muchas secuencias alternativas.',use:'Sirve para comprobar sensibilidad de secuencia y dimensionar escenarios adversos. No es una predicción del futuro y depende de que la muestra histórica sea representativa.'},
    {id:'robustdd',terms:['dd severo','max dd mediano','racha perdedora p95'],title:'Riesgo de secuencia',summary:'Resume drawdowns y rachas que aparecen al cambiar el orden y remuestrear los trades.',body:'El DD severo representa la cola adversa de las simulaciones; la racha p95 indica un nivel que el 95% de las secuencias simuladas no supera.',use:'Ayuda a evitar diseñar límites de riesgo usando únicamente el drawdown histórico observado, que puede haber sido una secuencia especialmente favorable o desfavorable.'}
  );
}

const analyticsLabV22Base=analyticsLab;
analyticsLab=function(){
  const p=getCurrentPlan(),ops=labFilteredOps();
  return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: combinaciones, salidas, confianza, robustez, comportamiento, riesgo y estabilidad.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${savedStudiesPanel()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${confidencePanel(ops)}${robustnessModule(ops)}${researchGridModule(ops)}${exitLabModule(ops)}${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;
};

const shellV22Base=shell;
shell=function(){
  return shellV22Base().replace(V21_APP_LABEL,V22_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Ayuda contextual + Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Robustez Monte Carlo + Ayuda contextual + Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');
};
Object.assign(window,{robustnessSetHorizon,robustnessSetIterations});
render();
/* ===== END V22 PATCH ===== */

/* ===== V23 PATCH · Risk & Stress Lab ===== */
const V23_APP_LABEL='V23 · Risk & Stress Lab';
let riskStressState={
  method:'block',blockSize:5,horizon:'sample',iterations:1000,edgeShock:20,extraCost:0,
  capital:0,ddTolerancePct:20,
  thresholds:{r:[5,10,15],ticks:[100,200,300],usd:[100,250,500]}
};
const riskStressCache=new Map();

function riskStressHorizon(n){return riskStressState.horizon==='sample'?Math.max(1,n):Math.max(1,Number(riskStressState.horizon)||100);}
function riskStressSetMethod(v){riskStressState.method=v==='iid'?'iid':'block';render();}
function riskStressSetBlockSize(v){const n=Number(v);riskStressState.blockSize=[3,5,10].includes(n)?n:5;render();}
function riskStressSetHorizon(v){riskStressState.horizon=v==='sample'?'sample':String([20,50,100,200].includes(Number(v))?Number(v):100);render();}
function riskStressSetIterations(v){const n=Number(v);riskStressState.iterations=[500,1000,2500].includes(n)?n:1000;render();}
function riskStressSetShock(v){const n=Number(v);riskStressState.edgeShock=[0,10,20,30,40].includes(n)?n:20;render();}
function riskStressSetExtraCost(v){riskStressState.extraCost=Math.max(0,Number(v)||0);render();}
function riskStressSetCapital(v){riskStressState.capital=Math.max(0,Number(v)||0);render();}
function riskStressSetTolerance(v){riskStressState.ddTolerancePct=Math.max(1,Math.min(100,Number(v)||20));render();}
function riskStressSetThreshold(i,v){const u=labState.unit||'r',arr=[...(riskStressState.thresholds[u]||[5,10,15])];arr[i]=Math.max(0,Number(v)||0);riskStressState.thresholds[u]=arr;render();}

function riskStressCostForOp(o,targetUnit){
  const c=Math.max(0,Number(riskStressState.extraCost)||0),src=labState.unit||'r';
  if(!c)return 0;if(targetUnit===src)return c;
  if(targetUnit==='usd'){
    if(src==='ticks')return c*(Number(o.instrumentSnapshot?.tickValue)||0);
    if(src==='r')return c*(Number(o.riskUsd)||0);
  }
  return 0;
}
function riskStressText(v,unit=labState.unit){return Number.isFinite(v)?metricStatText(v,unit):'—';}
function riskStressPct(v){return Number.isFinite(v)?`${v.toFixed(1)}%`:'—';}
function riskStressMaxUnderwater(vals){
  let eq=0,peak=0,run=0,best=0;
  for(const v of vals){eq+=v;if(eq>=peak){peak=eq;run=0;}else{run++;if(run>best)best=run;}}
  return best;
}
function riskStressSimulation(ops,targetUnit=labState.unit){
  const rows=ops.filter(o=>Number.isFinite(opMetricValue(o,targetUnit,labState.basis))),n=rows.length;if(!n)return null;
  const raw=rows.map(o=>opMetricValue(o,targetUnit,labState.basis)),mean=raw.reduce((a,b)=>a+b,0)/n;
  const shockPct=Math.max(0,Number(riskStressState.edgeShock)||0),shift=Math.abs(mean)*(shockPct/100);
  const horizon=riskStressHorizon(n),iterations=riskStressState.iterations,method=riskStressState.method,block=Math.min(n,method==='block'?riskStressState.blockSize:1);
  const signature=`stress23|${targetUnit}|${labState.basis}|${method}|${block}|${horizon}|${iterations}|${shockPct}|${riskStressState.extraCost}|${rows.map(o=>`${o.id}:${Number(opMetricValue(o,targetUnit,labState.basis)||0).toFixed(6)}:${Number(riskStressCostForOp(o,targetUnit)||0).toFixed(6)}`).join('|')}`;
  const key=String(robustHash(signature));if(riskStressCache.has(key))return riskStressCache.get(key);
  const rnd=robustRng(robustHash(signature+'|seed'));
  const terminal=[],means=[],dds=[],streaks=[],underwater=[];
  const fanCount=Math.min(horizon,60),steps=[];for(let i=0;i<=fanCount;i++)steps.push(Math.round(i*horizon/fanCount));
  const uniqueSteps=[...new Set(steps)],buckets=uniqueSteps.map(()=>[]);
  for(let s=0;s<iterations;s++){
    let cum=0,peak=0,worst=0,lossRun=0,maxLossRun=0,waterRun=0,maxWater=0,j=0,cp=1;buckets[0].push(0);
    while(j<horizon){
      const start=method==='block'?(n>block?Math.floor(rnd()*(n-block+1)):0):Math.floor(rnd()*n);
      const take=method==='block'?block:1;
      for(let b=0;b<take&&j<horizon;b++){
        const idx=method==='block'?Math.min(n-1,start+b):start,o=rows[idx];
        const v=raw[idx]-shift-riskStressCostForOp(o,targetUnit);j++;cum+=v;
        if(cum>=peak){peak=cum;waterRun=0;}else{waterRun++;if(waterRun>maxWater)maxWater=waterRun;}
        const dd=cum-peak;if(dd<worst)worst=dd;
        if(v<0){lossRun++;if(lossRun>maxLossRun)maxLossRun=lossRun;}else lossRun=0;
        if(cp<uniqueSteps.length&&j===uniqueSteps[cp]){buckets[cp].push(cum);cp++;}
      }
    }
    terminal.push(cum);means.push(cum/horizon);dds.push(worst);streaks.push(maxLossRun);underwater.push(maxWater);
  }
  terminal.sort((a,b)=>a-b);means.sort((a,b)=>a-b);dds.sort((a,b)=>a-b);streaks.sort((a,b)=>a-b);underwater.sort((a,b)=>a-b);
  const fan=uniqueSteps.map((step,i)=>{const b=buckets[i].sort((a,b)=>a-b);return {step,low:robustQuantile(b,.05),median:robustQuantile(b,.5),high:robustQuantile(b,.95)};});
  const out={unit:targetUnit,n,horizon,iterations,method,block,mean,shift,fan,terminal,dds,
    positivePct:terminal.filter(v=>v>0).length/iterations*100,negativePct:terminal.filter(v=>v<0).length/iterations*100,
    finalP5:robustQuantile(terminal,.05),finalP50:robustQuantile(terminal,.5),finalP95:robustQuantile(terminal,.95),
    expP50:robustQuantile(means,.5),ddMedian:robustQuantile(dds,.5),ddP95:robustQuantile(dds,.05),ddP99:robustQuantile(dds,.01),
    streakP95:Math.round(robustQuantile(streaks,.95)),streakP99:Math.round(robustQuantile(streaks,.99)),underwaterP95:Math.round(robustQuantile(underwater,.95))
  };
  riskStressCache.set(key,out);if(riskStressCache.size>24)riskStressCache.delete(riskStressCache.keys().next().value);return out;
}
function riskStressThresholdProbability(sim,t){return sim&&t>0?sim.dds.filter(dd=>dd<=-Math.abs(t)).length/sim.iterations*100:0;}
function riskStressFanSvg(sim){
  const w=920,h=245,padL=58,padR=18,padT=22,padB=38,all=sim.fan.flatMap(x=>[x.low,x.high,0]),min=Math.min(...all),max=Math.max(...all),span=max-min||1;
  const x=v=>padL+(v/sim.horizon)*(w-padL-padR),y=v=>padT+(max-v)/span*(h-padT-padB);
  const high=sim.fan.map(d=>`${x(d.step).toFixed(1)},${y(d.high).toFixed(1)}`).join(' L '),low=[...sim.fan].reverse().map(d=>`${x(d.step).toFixed(1)},${y(d.low).toFixed(1)}`).join(' L '),med=sim.fan.map(d=>`${x(d.step).toFixed(1)},${y(d.median).toFixed(1)}`).join(' L '),zero=y(0),mid=Math.round(sim.horizon/2);
  return `<div class="stress-chart-wrap"><svg class="stress-fan-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Escenarios de estrés acumulados, percentiles 5 a 95"><line x1="${padL}" y1="${zero}" x2="${w-padR}" y2="${zero}" class="stress-zero"/><path d="M ${high} L ${low} Z" class="stress-band"/><path d="M ${med}" class="stress-median"/><text x="${padL}" y="${h-12}" class="stress-axis">0</text><text x="${x(mid)}" y="${h-12}" text-anchor="middle" class="stress-axis">${mid}</text><text x="${w-padR}" y="${h-12}" text-anchor="end" class="stress-axis">${sim.horizon} trades</text><text x="${padL-8}" y="${y(max)+4}" text-anchor="end" class="stress-axis">${esc(riskStressText(max,sim.unit))}</text><text x="${padL-8}" y="${y(min)+4}" text-anchor="end" class="stress-axis">${esc(riskStressText(min,sim.unit))}</text></svg><div class="stress-legend"><span><i class="median"></i>Mediana</span><span><i class="band"></i>p5–p95</span></div></div>`;
}
function riskStressModule(ops){
  const sim=riskStressSimulation(ops,labState.unit),usdSim=riskStressSimulation(ops,'usd'),n=ops.length,u=labState.unit||'r',thresholds=riskStressState.thresholds[u]||[5,10,15];
  const unitLabel=metricUnitLabel(u),methodLabel=riskStressState.method==='block'?`Block bootstrap · ${riskStressState.blockSize}`:'Bootstrap independiente';
  const controls=`<div class="stress-controls">
    <label><span>Método</span><select class="select compact-select" onchange="riskStressSetMethod(this.value)"><option value="iid" ${riskStressState.method==='iid'?'selected':''}>Independiente</option><option value="block" ${riskStressState.method==='block'?'selected':''}>Bloques consecutivos</option></select></label>
    <label><span>Bloque</span><select class="select compact-select" onchange="riskStressSetBlockSize(this.value)" ${riskStressState.method!=='block'?'disabled':''}>${[3,5,10].map(v=>`<option value="${v}" ${riskStressState.blockSize===v?'selected':''}>${v} trades</option>`).join('')}</select></label>
    <label><span>Horizonte</span><select class="select compact-select" onchange="riskStressSetHorizon(this.value)"><option value="sample" ${riskStressState.horizon==='sample'?'selected':''}>Muestra (${n})</option>${[20,50,100,200].map(v=>`<option value="${v}" ${String(riskStressState.horizon)===String(v)?'selected':''}>${v}</option>`).join('')}</select></label>
    <label><span>Simulaciones</span><select class="select compact-select" onchange="riskStressSetIterations(this.value)">${[500,1000,2500].map(v=>`<option value="${v}" ${riskStressState.iterations===v?'selected':''}>${v.toLocaleString('es-ES')}</option>`).join('')}</select></label>
    <label><span>Deterioro expectancy</span><select class="select compact-select" onchange="riskStressSetShock(this.value)">${[0,10,20,30,40].map(v=>`<option value="${v}" ${riskStressState.edgeShock===v?'selected':''}>−${v}%</option>`).join('')}</select></label>
    <label><span>Coste extra / trade · ${esc(unitLabel)}</span><input class="input compact-input" type="number" min="0" step="0.01" value="${Number(riskStressState.extraCost)||0}" onchange="riskStressSetExtraCost(this.value)"></label>
  </div>`;
  if(!sim)return `<section class="card panel lab-module lab-span-2 stress-module"><div class="panel-title"><div><h3>Risk & Stress Lab</h3><small>Dependencia temporal, deterioro del edge y tolerancia al drawdown.</small></div></div>${controls}<div class="empty">No hay operaciones en el subconjunto actual.</div></section>`;
  const probs=thresholds.map(t=>({t,p:riskStressThresholdProbability(sim,t)}));
  const tol=Math.max(.01,riskStressState.ddTolerancePct/100),capitalP95=usdSim?Math.abs(usdSim.ddP95)/tol:NaN,capitalP99=usdSim?Math.abs(usdSim.ddP99)/tol:NaN;
  const capital=Number(riskStressState.capital)||0,accountLimit=capital*tol,breach=usdSim&&accountLimit>0?riskStressThresholdProbability(usdSim,accountLimit):NaN;
  return `<section class="card panel lab-module lab-span-2 stress-module">
    <div class="panel-title"><div><h3>Risk & Stress Lab</h3><small>${methodLabel} · escenario con deterioro de expectancy del ${riskStressState.edgeShock}%${riskStressState.extraCost?` + ${riskStressState.extraCost} ${unitLabel}/trade`:''}.</small></div></div>
    ${controls}
    <div class="stress-kpis">
      <div><span>Secuencias positivas</span><strong class="${sim.positivePct>=50?'positive':'negative'}">${riskStressPct(sim.positivePct)}</strong><small>cierre &gt; 0 tras ${sim.horizon} trades</small></div>
      <div><span>Resultado final · p5 → p95</span><strong>${riskStressText(sim.finalP5)} → ${riskStressText(sim.finalP95)}</strong><small>rango central de estrés</small></div>
      <div><span>DD p95</span><strong class="negative">${riskStressText(sim.ddP95)}</strong><small>95% de secuencias tiene DD no peor</small></div>
      <div><span>DD p99</span><strong class="negative">${riskStressText(sim.ddP99)}</strong><small>cola extrema simulada</small></div>
      <div><span>Racha perdedora p95 / p99</span><strong>${sim.streakP95} / ${sim.streakP99}</strong><small>número de trades consecutivos</small></div>
      <div><span>Tiempo bajo agua · p95</span><strong>${sim.underwaterP95}</strong><small>máx. trades consecutivos por debajo del pico</small></div>
    </div>
    <div class="stress-main"><div>${riskStressFanSvg(sim)}</div><div class="stress-thresholds">
      <h4>Probabilidad de superar un DD</h4>
      ${probs.map((x,i)=>`<div class="stress-threshold-row"><label><span>Umbral ${i+1}</span><input class="input compact-input" type="number" min="0" step="${u==='r'?'.5':u==='ticks'?'10':'25'}" value="${x.t}" onchange="riskStressSetThreshold(${i},this.value)"></label><strong class="${x.p>=25?'negative':x.p<=5?'positive':''}">${riskStressPct(x.p)}</strong><small>${esc(riskStressText(-Math.abs(x.t),u))}</small></div>`).join('')}
      <div class="stress-scenario-readout"><span>Expectancy mediana estresada</span><strong class="${sim.expP50>0?'positive':sim.expP50<0?'negative':''}">${riskStressText(sim.expP50)}</strong></div>
      <div class="stress-scenario-readout"><span>DD mediano</span><strong class="negative">${riskStressText(sim.ddMedian)}</strong></div>
    </div></div>
    <div class="stress-capital">
      <div class="stress-capital-head"><div><h4>Capital y límite de cuenta · cálculo auxiliar en US$</h4><small>Usa la misma muestra y escenario, recalculados en dólares operación por operación.</small></div><div class="stress-capital-inputs"><label><span>Capital cuenta · US$</span><input class="input compact-input" type="number" min="0" step="100" placeholder="Opcional" value="${capital||''}" onchange="riskStressSetCapital(this.value)"></label><label><span>DD máximo tolerado</span><div class="stress-inline-input"><input class="input compact-input" type="number" min="1" max="100" step="1" value="${riskStressState.ddTolerancePct}" onchange="riskStressSetTolerance(this.value)"><em>%</em></div></label></div></div>
      <div class="stress-capital-kpis">
        <div><span>DD p95 · US$</span><strong class="negative">${usdSim?riskStressText(usdSim.ddP95,'usd'):'—'}</strong></div>
        <div><span>DD p99 · US$</span><strong class="negative">${usdSim?riskStressText(usdSim.ddP99,'usd'):'—'}</strong></div>
        <div><span>Capital mínimo p95</span><strong>${Number.isFinite(capitalP95)?money(capitalP95,'USD'):'—'}</strong><small>para que DD p95 ≈ ${riskStressState.ddTolerancePct}%</small></div>
        <div><span>Capital mínimo p99</span><strong>${Number.isFinite(capitalP99)?money(capitalP99,'USD'):'—'}</strong><small>para que DD p99 ≈ ${riskStressState.ddTolerancePct}%</small></div>
        <div><span>Prob. violar límite de cuenta</span><strong class="${Number.isFinite(breach)&&breach>10?'negative':Number.isFinite(breach)?'positive':''}">${Number.isFinite(breach)?riskStressPct(breach):'Introduce capital'}</strong><small>${capital?`límite: ${money(accountLimit,'USD')}`:'capital opcional'}</small></div>
      </div>
    </div>
    <div class="lab-note warn"><strong>Lectura correcta:</strong> Block Bootstrap preserva pequeñas secuencias consecutivas, pero no reproduce cambios de régimen completos. “Deterioro de expectancy” es un escenario mecánico: desplaza cada trade para reducir la media observada en el porcentaje elegido. El coste extra es una penalización adicional por operación. Los capitales p95/p99 son cálculos de tolerancia al DD, no recomendaciones de capital ni garantías de supervivencia.</div>
  </section>`;
}

// Los estudios guardados conservan también el escenario de estrés del Laboratorio.
const V23_STRESS_DEFAULT=clone(riskStressState);
function normalizeStudyStress(v={}){
  const out={...clone(V23_STRESS_DEFAULT),...(v||{})};
  out.thresholds={...clone(V23_STRESS_DEFAULT.thresholds),...((v||{}).thresholds||{})};
  return out;
}
const ensurePlanStudiesV23Base=ensurePlanStudies;
ensurePlanStudies=function(p){
  const out=ensurePlanStudiesV23Base(p);if(out?.savedStudies)out.savedStudies=out.savedStudies.map(s=>({...s,stress:normalizeStudyStress(s.stress)}));return out;
};
state.tradingPlans.forEach(ensurePlanStudies);
const currentStudySnapshotV23Base=currentStudySnapshot;
currentStudySnapshot=function(){return {...currentStudySnapshotV23Base(),stress:clone(riskStressState)};};
const studyComparableSnapshotV23Base=studyComparableSnapshot;
studyComparableSnapshot=function(s){return {...studyComparableSnapshotV23Base(s),stress:normalizeStudyStress(s?.stress)};};
const applyStudySnapshotV23Base=applyStudySnapshot;
applyStudySnapshot=function(s){applyStudySnapshotV23Base(s);riskStressState=normalizeStudyStress(s?.stress);};

if(typeof CONTEXT_HELP!=='undefined'){
  CONTEXT_HELP.push(
    {id:'blockbootstrap',terms:['block bootstrap','bloques consecutivos','risk stress lab'],title:'Block Bootstrap',summary:'Remuestreo que conserva pequeños bloques consecutivos de operaciones en vez de tratar cada trade como independiente.',body:'Selecciona bloques históricos de 3, 5 o 10 trades y los combina hasta completar el horizonte. Así mantiene parte de las rachas y dependencia temporal local observada.',use:'Sirve para comprobar si el riesgo empeora cuando se preservan secuencias de mercado. No modela por completo cambios de régimen ni autocorrelación de largo plazo.'},
    {id:'edgeshock',terms:['deterioro expectancy','stress edge','deterioro del edge'],title:'Deterioro del edge',summary:'Escenario adverso que reduce mecánicamente la expectancy observada antes de simular.',body:'La aplicación resta a cada operación una cantidad constante igual al porcentaje elegido de la expectancy absoluta observada. Con una expectancy positiva, un deterioro del 20% reduce la media esperada aproximadamente un 20%.',use:'Permite estudiar qué ocurre si el rendimiento futuro es peor que el histórico sin fingir que conocemos la causa de ese deterioro.'},
    {id:'capitalstress',terms:['capital mínimo p95','capital mínimo p99','límite de cuenta'],title:'Capital bajo estrés',summary:'Relaciona el drawdown simulado en US$ con el porcentaje máximo de cuenta que estás dispuesto a tolerar.',body:'Capital mínimo = |drawdown simulado| / porcentaje tolerado. La probabilidad de violar el límite compara cada drawdown simulado con capital × porcentaje tolerado.',use:'Es una referencia de dimensionamiento y sensibilidad. No sustituye requisitos de margen, reglas del broker, riesgo de gap, slippage extremo ni una política formal de capital.'}
  );
}

const analyticsLabV23Base=analyticsLab;
analyticsLab=function(){
  const p=getCurrentPlan(),ops=labFilteredOps();
  return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: combinaciones, salidas, confianza, robustez, estrés, comportamiento, riesgo y estabilidad.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${savedStudiesPanel()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${confidencePanel(ops)}${robustnessModule(ops)}${riskStressModule(ops)}${researchGridModule(ops)}${exitLabModule(ops)}${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;
};

const shellV23Base=shell;
shell=function(){
  return shellV23Base().replace(V22_APP_LABEL,V23_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Robustez Monte Carlo + Ayuda contextual + Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Risk & Stress Lab + Robustez Monte Carlo + Ayuda contextual + Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');
};
Object.assign(window,{riskStressSetMethod,riskStressSetBlockSize,riskStressSetHorizon,riskStressSetIterations,riskStressSetShock,riskStressSetExtraCost,riskStressSetCapital,riskStressSetTolerance,riskStressSetThreshold});
render();
/* ===== END V23 PATCH ===== */

/* ===== V24 PATCH · Validación Walk-Forward ===== */
const V24_APP_LABEL='V24 · Walk-Forward Validation';

let walkForwardState={mode:'holdout',splitPct:70,initialTrain:60,testSize:20};
function normalizeWalkForwardState(v={}){
  const out={...walkForwardState,...(v||{})};
  out.mode=['holdout','anchored'].includes(out.mode)?out.mode:'holdout';
  out.splitPct=[60,70,80].includes(Number(out.splitPct))?Number(out.splitPct):70;
  out.initialTrain=[40,60,80,100].includes(Number(out.initialTrain))?Number(out.initialTrain):60;
  out.testSize=[10,20,30].includes(Number(out.testSize))?Number(out.testSize):20;
  return out;
}
function wfSetMode(v){walkForwardState.mode=v==='anchored'?'anchored':'holdout';render();}
function wfSetSplit(v){walkForwardState.splitPct=[60,70,80].includes(Number(v))?Number(v):70;render();}
function wfSetInitialTrain(v){walkForwardState.initialTrain=[40,60,80,100].includes(Number(v))?Number(v):60;render();}
function wfSetTestSize(v){walkForwardState.testSize=[10,20,30].includes(Number(v))?Number(v):20;render();}
function wfOrdered(ops){return [...ops].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate));}
function wfMetric(v){return Number.isFinite(v)?metricStatText(v,labState.unit):'—';}
function wfPf(v){return v===Infinity?'∞':Number.isFinite(v)?Number(v).toFixed(2):'—';}
function wfCi(s){return s?.n>1&&Number.isFinite(s.ciLow95)&&Number.isFinite(s.ciHigh95)?`${wfMetric(s.ciLow95)} → ${wfMetric(s.ciHigh95)}`:'—';}
function wfSignClass(v){return v>0?'positive':v<0?'negative':'';}
function wfEvidenceLabel(s){
  const e=confidenceEvidence(s||{});
  return `<span class="wf-evidence ${e.key}">${esc(e.label)}</span>`;
}
function wfHoldout(ops){
  const ordered=wfOrdered(ops),n=ordered.length;
  if(n<4)return null;
  let cut=Math.floor(n*(walkForwardState.splitPct/100));cut=Math.max(2,Math.min(n-2,cut));
  const trainOps=ordered.slice(0,cut),testOps=ordered.slice(cut),train=calcMetricStats(trainOps,labState.unit,labState.basis),test=calcMetricStats(testOps,labState.unit,labState.basis);
  const sameSign=(train.expectancy>0&&test.expectancy>0)||(train.expectancy<0&&test.expectancy<0)||(train.expectancy===0&&test.expectancy===0);
  const retention=Math.abs(train.expectancy)>1e-12?test.expectancy/train.expectancy*100:NaN;
  return {n,cut,trainOps,testOps,train,test,sameSign,retention};
}
function wfAnchored(ops){
  const ordered=wfOrdered(ops),n=ordered.length,initial=Math.min(walkForwardState.initialTrain,Math.max(0,n-1)),testSize=walkForwardState.testSize;
  if(n<initial+2||initial<2)return {n,initial,testSize,folds:[],oosOps:[],oos:null};
  const folds=[],oosOps=[];
  for(let trainEnd=initial,idx=1;trainEnd<n;trainEnd+=testSize,idx++){
    const end=Math.min(n,trainEnd+testSize),testOps=ordered.slice(trainEnd,end);if(!testOps.length)break;
    const trainOps=ordered.slice(0,trainEnd),train=calcMetricStats(trainOps,labState.unit,labState.basis),test=calcMetricStats(testOps,labState.unit,labState.basis);
    folds.push({idx,trainOps,testOps,train,test,start:trainEnd+1,end});oosOps.push(...testOps);
  }
  const oos=oosOps.length?calcMetricStats(oosOps,labState.unit,labState.basis):null;
  return {n,initial,testSize,folds,oosOps,oos};
}
function wfHoldoutPanel(data){
  if(!data)return `<div class="empty">Se necesitan al menos 4 operaciones para separar entrenamiento y validación.</div>`;
  const {train,test,sameSign,retention}=data;
  return `<div class="wf-summary-grid">
    <div class="wf-segment train"><div class="wf-segment-head"><span>Entrenamiento</span><strong>n=${train.n}</strong></div><div class="wf-metric"><span>Expectancy</span><strong class="${wfSignClass(train.expectancy)}">${wfMetric(train.expectancy)}</strong></div><div class="wf-metric"><span>IC 95%</span><strong>${wfCi(train)}</strong></div><div class="wf-metric"><span>Win rate</span><strong>${train.winRate.toFixed(1)}%</strong></div><div class="wf-metric"><span>PF</span><strong>${wfPf(train.pf)}</strong></div><div class="wf-metric"><span>Max DD</span><strong class="negative">${wfMetric(train.maxDD)}</strong></div></div>
    <div class="wf-arrow">→</div>
    <div class="wf-segment validation"><div class="wf-segment-head"><span>Validación cronológica</span><strong>n=${test.n}</strong></div><div class="wf-metric"><span>Expectancy</span><strong class="${wfSignClass(test.expectancy)}">${wfMetric(test.expectancy)}</strong></div><div class="wf-metric"><span>IC 95%</span><strong>${wfCi(test)}</strong></div><div class="wf-metric"><span>Win rate</span><strong>${test.winRate.toFixed(1)}%</strong></div><div class="wf-metric"><span>PF</span><strong>${wfPf(test.pf)}</strong></div><div class="wf-metric"><span>Max DD</span><strong class="negative">${wfMetric(test.maxDD)}</strong></div></div>
  </div>
  <div class="wf-kpis"><div><span>Consistencia de signo</span><strong class="${sameSign?'positive':'negative'}">${sameSign?'Consistente':'Cambio de signo'}</strong></div><div><span>Retención de expectancy</span><strong>${Number.isFinite(retention)?retention.toFixed(0)+'%':'—'}</strong><small>validación / entrenamiento</small></div><div><span>Evidencia en validación</span><strong>${wfEvidenceLabel(test)}</strong><small>clasificación basada en IC95 y n</small></div><div><span>Límite inferior 95%</span><strong class="${wfSignClass(test.ciLow95)}">${wfMetric(test.ciLow95)}</strong><small>solo segmento de validación</small></div></div>`;
}
function wfAnchoredPanel(data){
  if(!data?.folds?.length)return `<div class="empty">Muestra insuficiente. Reduce el entrenamiento inicial o añade operaciones.</div>`;
  const positive=data.folds.filter(f=>f.test.expectancy>0).length,ciPositive=data.folds.filter(f=>Number.isFinite(f.test.ciLow95)&&f.test.ciLow95>0).length,worst=data.folds.reduce((a,f)=>Math.min(a,f.test.expectancy),Infinity),oos=data.oos;
  return `<div class="wf-kpis wf-kpis-anchored"><div><span>Validación OOS agregada</span><strong class="${wfSignClass(oos?.expectancy)}">${oos?wfMetric(oos.expectancy):'—'}</strong><small>n=${oos?.n||0}</small></div><div><span>Folds positivos</span><strong>${positive}/${data.folds.length}</strong><small>${(positive/data.folds.length*100).toFixed(0)}%</small></div><div><span>Folds con IC95 &gt; 0</span><strong>${ciPositive}/${data.folds.length}</strong><small>criterio conservador</small></div><div><span>Peor fold</span><strong class="${wfSignClass(worst)}">${wfMetric(worst)}</strong><small>expectancy de validación</small></div><div><span>IC95 OOS agregado</span><strong>${oos?wfCi(oos):'—'}</strong><small>todos los tramos de validación</small></div></div>
  <div class="table-wrap wf-table-wrap"><table class="table compact-table wf-table"><thead><tr><th>Fold</th><th>Train</th><th>Validación</th><th>Exp. train</th><th>Exp. OOS</th><th>IC95 OOS</th><th>WR OOS</th><th>PF OOS</th><th>DD OOS</th></tr></thead><tbody>${data.folds.map(f=>`<tr><td><strong>#${f.idx}</strong></td><td>${f.train.n}</td><td>${f.test.n}</td><td class="${wfSignClass(f.train.expectancy)}">${wfMetric(f.train.expectancy)}</td><td class="${wfSignClass(f.test.expectancy)}">${wfMetric(f.test.expectancy)}</td><td>${wfCi(f.test)}</td><td>${f.test.winRate.toFixed(1)}%</td><td>${wfPf(f.test.pf)}</td><td class="negative">${wfMetric(f.test.maxDD)}</td></tr>`).join('')}</tbody></table></div>`;
}
function walkForwardModule(ops){
  const mode=walkForwardState.mode,controls=`<div class="wf-controls"><label><span>Método</span><select class="select compact-select" onchange="wfSetMode(this.value)"><option value="holdout" ${mode==='holdout'?'selected':''}>Holdout cronológico</option><option value="anchored" ${mode==='anchored'?'selected':''}>Walk-forward anclado</option></select></label>${mode==='holdout'?`<label><span>Split train / validación</span><select class="select compact-select" onchange="wfSetSplit(this.value)">${[60,70,80].map(v=>`<option value="${v}" ${walkForwardState.splitPct===v?'selected':''}>${v}% / ${100-v}%</option>`).join('')}</select></label>`:`<label><span>Train inicial</span><select class="select compact-select" onchange="wfSetInitialTrain(this.value)">${[40,60,80,100].map(v=>`<option value="${v}" ${walkForwardState.initialTrain===v?'selected':''}>${v} trades</option>`).join('')}</select></label><label><span>Validación / fold</span><select class="select compact-select" onchange="wfSetTestSize(this.value)">${[10,20,30].map(v=>`<option value="${v}" ${walkForwardState.testSize===v?'selected':''}>${v} trades</option>`).join('')}</select></label>`}</div>`;
  const body=mode==='holdout'?wfHoldoutPanel(wfHoldout(ops)):wfAnchoredPanel(wfAnchored(ops));
  return `<section class="card panel lab-module lab-span-2 walkforward-module"><div class="panel-title"><div><h3>Validación temporal · Walk-Forward</h3><small>Separa cronológicamente descubrimiento y validación para comprobar si el edge sobrevive fuera del tramo inicial.</small></div></div>${controls}${body}<div class="lab-note warn"><strong>Lectura correcta:</strong> esta prueba reduce el autoengaño temporal, pero no convierte automáticamente una hipótesis en out-of-sample real. Si elegiste Setup, Contexto o filtros después de mirar toda la historia, el segmento de validación también ha influido indirectamente en la selección. La validación más fuerte empieza cuando congelas la hipótesis y esperas operaciones nuevas.</div></section>`;
}

// Los estudios guardados conservan también la configuración de validación temporal.
const V24_WF_DEFAULT=clone(walkForwardState);
function normalizeStudyWalkForward(v={}){return normalizeWalkForwardState({...clone(V24_WF_DEFAULT),...(v||{})});}
const ensurePlanStudiesV24Base=ensurePlanStudies;
ensurePlanStudies=function(p){const out=ensurePlanStudiesV24Base(p);if(out?.savedStudies)out.savedStudies=out.savedStudies.map(s=>({...s,walkForward:normalizeStudyWalkForward(s.walkForward)}));return out;};
state.tradingPlans.forEach(ensurePlanStudies);
const currentStudySnapshotV24Base=currentStudySnapshot;
currentStudySnapshot=function(){return {...currentStudySnapshotV24Base(),walkForward:clone(walkForwardState)};};
const studyComparableSnapshotV24Base=studyComparableSnapshot;
studyComparableSnapshot=function(s){return {...studyComparableSnapshotV24Base(s),walkForward:normalizeStudyWalkForward(s?.walkForward)};};
const applyStudySnapshotV24Base=applyStudySnapshot;
applyStudySnapshot=function(s){applyStudySnapshotV24Base(s);walkForwardState=normalizeStudyWalkForward(s?.walkForward);};

if(typeof CONTEXT_HELP!=='undefined'){
  CONTEXT_HELP.push(
    {id:'walkforward',terms:['walk forward','walk-forward','holdout cronológico','validación temporal'],title:'Validación Walk-Forward',summary:'Divide la muestra cronológicamente para comprobar si el rendimiento observado en un tramo se mantiene en datos posteriores.',body:'El holdout usa un bloque inicial como entrenamiento y reserva el tramo final como validación. El walk-forward anclado repite el proceso: entrena con toda la historia disponible hasta ese punto y valida el siguiente bloque de operaciones.',use:'Sirve para detectar edges que solo funcionan en el tramo donde fueron descubiertos. No elimina el sesgo si los filtros se eligieron después de observar toda la historia.'},
    {id:'oos',terms:['out of sample','oos','fuera de muestra'],title:'Out-of-sample (OOS)',summary:'Datos que no deberían haber participado en la formulación o ajuste de la hipótesis.',body:'Una validación OOS genuina exige fijar previamente las reglas, filtros y criterios y evaluar después observaciones que no se utilizaron para diseñarlos.',use:'Cuanto más se ajusta una idea mirando el mismo histórico, más importante es reservar o acumular datos nuevos para comprobarla.'}
  );
}

const analyticsLabV24Base=analyticsLab;
analyticsLab=function(){
  const p=getCurrentPlan(),ops=labFilteredOps();
  return `${pageHead('Laboratorio Analítico Avanzado',`Disecciona el edge de ${esc(planLabel(p))}: combinaciones, validación temporal, salidas, confianza, robustez, estrés, comportamiento, riesgo y estabilidad.`,`<button class="btn" onclick="navigate('operations')">Ver registro</button>`)}${activePlanBanner()}${savedStudiesPanel()}${labFilterPanel()}${labKpis(ops)}${labState.unit==='ticks'?mixedInstrumentWarning(ops):''}<div class="lab-grid">${confidencePanel(ops)}${walkForwardModule(ops)}${robustnessModule(ops)}${riskStressModule(ops)}${researchGridModule(ops)}${exitLabModule(ops)}${labFocusStressHeatmap(ops)}${labMaeMfeScatter(ops)}${labBehaviorPenalties(ops)}${labRiskHistogram(ops)}${labEdgeMatrix(ops)}${labStability(ops)}${labRiskSimulator(ops)}${labOperationsTable(ops)}</div>`;
};

const shellV24Base=shell;
shell=function(){
  return shellV24Base().replace(V23_APP_LABEL,V24_APP_LABEL).replace('Motor cloud V9.2 Conflict Guard intacto. Risk & Stress Lab + Robustez Monte Carlo + Ayuda contextual + Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.','Motor cloud V9.2 Conflict Guard intacto. Walk-Forward + Risk & Stress + Robustez Monte Carlo + Ayuda contextual + Objetivos + Review & Notes + Confianza + Estudios + Compliance + Dashboard + Calendario + Research Grid + Exit Lab sobre la misma base estable.');
};
Object.assign(window,{wfSetMode,wfSetSplit,wfSetInitialTrain,wfSetTestSize});
render();
/* ===== END V24 PATCH ===== */
