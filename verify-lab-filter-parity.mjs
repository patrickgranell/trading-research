import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

function extractFunction(source,name){
  const start=source.indexOf(`function ${name}(`);
  if(start<0)throw new Error(`No se encuentra ${name}`);
  const bodyMarker=source.indexOf('){',start);
  const brace=bodyMarker>=0?bodyMarker+1:source.indexOf('{',start);let depth=0,quote='',template=false;
  for(let i=brace;i<source.length;i++){
    const c=source[i],previous=source[i-1];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote&&previous!=='\\')quote='';continue;}
    if(template){if(c==='\\'){i++;continue;}if(c==='`'&&previous!=='\\')template=false;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}if(c==='`'){template=true;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`Función sin cierre: ${name}`);
}

const sharedFields=[
  'q','dateFrom','dateTo','timeFrom','timeTo','days','month','year','direction','setup','vd','nr',
  'hypothesis','risk','source','result','contract','block','emotion','behavior','emotionStatus','riskPolicy'
];
const labControlIds={
  q:'labQ',dateFrom:'labDateFrom',dateTo:'labDateTo',timeFrom:'labTimeFrom',timeTo:'labTimeTo',
  month:'labMonth',year:'labYear',direction:'labDirection',setup:'labSetup',vd:'labVD',nr:'labNR',
  hypothesis:'labHypothesis',risk:'labRisk',source:'labSource',result:'labResult',contract:'labContract',
  block:'labBlock',emotion:'labEmotion',behavior:'labBehavior',emotionStatus:'labEmotionStatus',riskPolicy:'labRiskPolicy'
};

const baseSource=extractFunction(app,'baseFilteredOps');
const labStateSource=extractFunction(app,'labStudyDefaultState');
const labReadSource=extractFunction(app,'labReadFilters');
const labFilterSource=extractFunction(app,'labFilteredOpsForState');
const labPanelSource=extractFunction(app,'labFilterPanel');

need(/function baseFilteredOps\(f=opsViewState,ops=currentOps\(\),blockMap=opBlockMap\(\)\)/.test(baseSource),
  'El pipeline de Operaciones no acepta estado/dataset/mapa explícitos para poder reutilizarse.');
need(/baseFilteredOps\(f,currentOps\(\),opBlockMap\(\)\)/.test(labFilterSource),
  'Laboratorio no reutiliza el pipeline compartido de Operaciones.');
need(/riskPolicy[^\n]+plan/.test(labFilterSource)&&/applyRiskManagementRules\(shared\)/.test(labFilterSource),
  'Laboratorio no aplica riskPolicy=plan sobre el mismo universo compartido.');

for(const field of sharedFields){
  need(new RegExp(`\\b${field}\\s*:`).test(labStateSource),
    `labStudyDefaultState no conserva el filtro compartido ${field}.`);
}
for(const [field,id] of Object.entries(labControlIds)){
  need(labReadSource.includes(`labVal('${id}')`),`labReadFilters no lee ${field} desde #${id}.`);
  need(labPanelSource.includes(id),`labFilterPanel no presenta el control compartido #${id}.`);
}
need(app.includes("case 'lab-toggle-day':"),'Laboratorio no permite seleccionar días de semana.');
need(/days:\[\]/.test(labStateSource)&&/riskPolicy:'raw'/.test(labStateSource),
  'El estado por defecto del estudio no fija days=[] y riskPolicy=raw.');
need(/labState=\{\.\.\.keep,[^}]*q:''[^}]*days:\[\][^}]*riskPolicy:'raw'/.test(app),
  'Limpiar estudio no borra todos los filtros de dataset o no restaura riskPolicy=raw.');
need(/Object\.keys\(lab\)\.forEach/.test(extractFunction(app,'currentStudySnapshot')),
  'Los estudios guardados no copian el contrato completo de labStudyDefaultState.');
need(/lab=clone\(currentStudySnapshot\(\)\.lab\)/.test(extractFunction(app,'freezeCurrentHypothesis')),
  'Forward/OOS no congela el snapshot completo del Laboratorio.');
need(/labFilteredOpsForState\(t\?\.lab\|\|\{\}\)/.test(extractFunction(app,'forwardFrozenOps')),
  'Forward/OOS no reevalúa las operaciones nuevas con la definición congelada.');

const operations=[
  {id:'keep',entryDate:'2026-07-13T13:05:00',direction:'SHORT',setup:'S1',vd:'VD1',nr:'NR1',hypothesis:'H1',riskStrategyId:'R1',result:'loss',contract:'MCL 08-26',raw:{source:'ninjatrader'},emotional:{before:'Calma',behaviors:['Plan']},rMultiple:-1},
  {id:'other',entryDate:'2026-07-14T14:10:00',direction:'LONG',setup:'S2',vd:'VD2',nr:'NR2',hypothesis:'H2',riskStrategyId:'R2',result:'win',contract:'MES 09-26',raw:{source:'manual'},emotional:{before:'Tensión',behaviors:['Impulso'],notes:'registrado'},rMultiple:2},
  {id:'pending',entryDate:'2026-07-15T23:30:00',direction:'SHORT',setup:'S1',vd:'VD1',nr:'NR1',hypothesis:'H1',riskStrategyId:'R1',result:'flat',contract:'MCL 08-26',raw:{source:'ankora'},emotional:{},rMultiple:0}
];
const blockMap=new Map([['keep',1],['other',2],['pending',3]]);
const ctx={
  console,
  opsViewState:{},
  currentOps:()=>operations,
  opBlockMap:()=>blockMap,
  labEmotionsOf:o=>[o.emotional?.before,o.emotional?.during,o.emotional?.after].filter(Boolean),
  opMetricValue:o=>Number(o.rMultiple)||0,
  v3194CompareOps:(a,b)=>new Date(a.entryDate)-new Date(b.entryDate),
  applyRiskManagementRules:ops=>({included:ops.filter(o=>o.id!=='other'),excluded:ops.filter(o=>o.id==='other'),reasons:new Map()})
};
vm.createContext(ctx);
vm.runInContext([
  extractFunction(app,'inputDateValue'),
  extractFunction(app,'operationEmotionValues'),
  extractFunction(app,'hasEmotionalEntry'),
  baseSource,
  labStateSource,
  labFilterSource,
  'globalThis.__base=baseFilteredOps;globalThis.__lab=labFilteredOpsForState;globalThis.__defaults=labStudyDefaultState;'
].join('\n'),ctx);

const only=(filters,expected,message)=>{
  const ids=ctx.__base({...ctx.__defaults(),...filters},operations,blockMap).map(o=>o.id).sort();
  need(JSON.stringify(ids)===JSON.stringify([...expected].sort()),`${message}: ${ids.join(', ')||'∅'}`);
};
only({q:'mcl'},['keep','pending'],'q debe buscar sobre la operación completa');
only({dateFrom:'2026-07-14',dateTo:'2026-07-14'},['other'],'rango de fechas');
only({timeFrom:'13:00',timeTo:'13:59'},['keep'],'rango horario');
only({timeFrom:'22:00',timeTo:'01:00'},['pending'],'rango horario nocturno');
only({days:[1]},['keep'],'día de semana');
only({month:'7',year:'2026'},['keep','other','pending'],'mes/año');
only({direction:'LONG'},['other'],'dirección');
only({setup:'S2'},['other'],'setup');
only({vd:'VD2'},['other'],'VD');
only({nr:'NR2'},['other'],'NR');
only({hypothesis:'H2'},['other'],'hipótesis');
only({risk:'R2'},['other'],'estrategia de riesgo');
only({source:'ninjatrader'},['keep'],'origen');
only({result:'loss'},['keep'],'resultado');
only({contract:'MES'},['other'],'contrato');
only({block:'2'},['other'],'bloque');
only({emotion:'Calma'},['keep'],'emoción');
only({behavior:'Plan'},['keep'],'comportamiento');
only({emotionStatus:'complete'},['keep','other'],'diario emocional completo');
only({emotionStatus:'pending'},['pending'],'diario emocional pendiente');

const parityFilters={setup:'S1',vd:'VD1',nr:'NR1',hypothesis:'H1',risk:'R1',contract:'MCL'};
const operationIds=ctx.__base({...ctx.__defaults(),...parityFilters},operations,blockMap).map(o=>o.id).sort();
const labRawIds=ctx.__lab({...ctx.__defaults(),...parityFilters,riskPolicy:'raw'}).map(o=>o.id).sort();
need(JSON.stringify(operationIds)===JSON.stringify(labRawIds),
  `Paridad raw distinta: Operaciones=${operationIds.join(',')} Laboratorio=${labRawIds.join(',')}`);
const labPlanIds=ctx.__lab({...ctx.__defaults(),riskPolicy:'plan'}).map(o=>o.id).sort();
need(JSON.stringify(labPlanIds)===JSON.stringify(['keep','pending']),
  `riskPolicy=plan no replica las exclusiones del plan: ${labPlanIds.join(',')}`);
const labAllRawIds=ctx.__lab({...ctx.__defaults(),riskPolicy:'raw'}).map(o=>o.id).sort();
need(JSON.stringify(labAllRawIds)===JSON.stringify(['keep','other','pending']),
  `riskPolicy=raw recorta operaciones: ${labAllRawIds.join(',')}`);

if(fail.length){
  console.error('\nIssue #12 · Lab/Operations filter parity FAILED');
  for(const item of fail)console.error(` - ${item}`);
  process.exit(1);
}

console.log('Issue #12 · Lab/Operations filter parity OK');
console.log(' - shared dataset pipeline: 22 dimensions');
console.log(' - riskPolicy raw/plan parity');
console.log(' - saved studies and Forward/OOS freeze the complete filter contract');
console.log(' - reset clears dataset filters and preserves analytical preferences');
