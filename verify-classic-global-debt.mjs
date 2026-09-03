import fs from 'node:fs';
import vm from 'node:vm';

const index=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];

const MAX_TOP_LEVEL_UNIQUE=1431;
const MAX_RUNTIME_NAME_OVERLAP=196;
const PLAN_READ_CONTRACT='TradingResearchPlanReadContract';
const PLAN_READ_LEGACY=['getPlan','getCurrentPlan','planLabel'];
const PLAN_READ_CONSUMERS=[
  'reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'operation-cleanup-runtime.js','blob-lifecycle-runtime.js'
];

const CONTENT_ENCODING_CONTRACT='TradingResearchContentEncodingContract';
const CONTENT_ENCODING_LEGACY=['esc','inlineUriToken'];
const CONTENT_ENCODING_CONSUMERS={
  esc:[
    'reports-purity-runtime.js','structural-runtime.js','state-runtime.js','security-runtime.js',
    'event-runtime.js','exit-lab-runtime.js','csp-runtime.js','style-runtime.js',
    'operation-cleanup-runtime.js','render-closure-runtime.js'
  ],
  inlineUriToken:['security-runtime.js']
};

const EXIT_PRESENTATION_CONTRACT='TradingResearchExitPresentationContract';
const EXIT_PRESENTATION_LEGACY=['exitGrossR','exitResultClass','exitFmtR','exitFmtPct','exitPf'];
const EXIT_PRESENTATION_CONSUMER='exit-lab-runtime.js';

const FORM_BOUNDARY_CONTRACT='TradingResearchFormBoundaryContract';
const FORM_BOUNDARY_LEGACY=['formDataFrom','formDataValue','modalShell'];
const FORM_BOUNDARY_CONSUMER='security-runtime.js';

const REPORTS_PRESENTATION_CONTRACT='TradingResearchReportsPresentationContract';
const REPORTS_PRESENTATION_LEGACY=['metricUnitLabel','v313DateRangeText'];
const REPORTS_PRESENTATION_CONSUMER='reports-purity-runtime.js';

const TIMELINE_PRESENTATION_CONTRACT='TradingResearchTimelinePresentationContract';
const TIMELINE_PRESENTATION_LEGACY=['v314SignedTicks','v315Duration','v315GridTime'];
const TIMELINE_PRESENTATION_CONSUMER='structural-runtime.js';

const DATE_PRESENTATION_CONTRACT='TradingResearchDatePresentationContract';
const DATE_PRESENTATION_LEGACY=['fmtDate'];
const DATE_PRESENTATION_CONSUMER='backup-v2-runtime.js';

const NAVIGATION_PRESENTATION_CONTRACT='TradingResearchNavigationPresentationContract';
const NAVIGATION_PRESENTATION_LEGACY=['v318GroupForView'];
const NAVIGATION_PRESENTATION_CONSUMER='structural-runtime.js';

const OPERATIONS_READ_CONTRACT='TradingResearchOperationsReadContract';
const OPERATIONS_READ_LEGACY=['currentOps'];
const OPERATIONS_READ_CONSUMER='reports-purity-runtime.js';

const CONTEXT_HELP_PRESENTATION_CONTRACT='TradingResearchContextHelpPresentationContract';
const CONTEXT_HELP_PRESENTATION_LEGACY=['applyContextHelp','ensureContextHelpObserver'];
const CONTEXT_HELP_PRESENTATION_CONSUMER='structural-runtime.js';

const VIEW_PRESENTATION_CONTRACT='TradingResearchViewPresentationContract';
const VIEW_PRESENTATION_LEGACY=['researchDecisionCenter','researchChangesView','calendarView','goalsView','dataQualityView','complianceView','mistakesView','analyticsLab','reviewView','reportsView','v314MarketDataView','plansView'];
const VIEW_PRESENTATION_CONSUMER='structural-runtime.js';

const RESEARCH_STATUS_CONTRACT='TradingResearchResearchStatusContract';
const RESEARCH_STATUS_LEGACY=['researchUnreadCount'];
const RESEARCH_STATUS_CONSUMER='structural-runtime.js';

const REPORTS_SECTION_PRESENTATION_CONTRACT='TradingResearchReportsSectionPresentationContract';
const REPORTS_SECTION_PRESENTATION_LEGACY=['v313ReportSummary','v313ReportConfidence','v313ReportProcess','v313ReportQuality','v313ReportBreakdowns','v313SectionsControls'];
const REPORTS_SECTION_PRESENTATION_CONSUMER='reports-purity-runtime.js';

const OPERATIONS_PRESENTATION_CONTRACT='TradingResearchOperationsPresentationContract';
const OPERATIONS_PRESENTATION_LEGACY=['operationsFilterPanel','opsAnalyticsHtml'];
const OPERATIONS_PRESENTATION_CONSUMER='structural-runtime.js';

const NAVIGATION_STATE_CONTRACT='TradingResearchNavigationStateContract';
const NAVIGATION_STATE_LEGACY=['v318SaveOpenGroups'];
const NAVIGATION_STATE_CONSUMER='structural-runtime.js';

const NAVIGATION_RUNTIME_STATE_CONTRACT='TradingResearchNavigationRuntimeStateContract';
const NAVIGATION_RUNTIME_STATE_LEGACY=['v318OpenGroups','v318LastView'];
const NAVIGATION_RUNTIME_STATE_CONSUMER='structural-runtime.js';

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];

const runtimeSources=new Map();
const runtimeTokens=new Set();
for(const file of runtimeFiles){
  const src=fs.readFileSync(file,'utf8');
  runtimeSources.set(file,src);
  for(const m of src.matchAll(/\b[A-Za-z_$][\w$]*\b/g))runtimeTokens.add(m[0]);
}
const runtimeOverlap=topNames.filter(name=>runtimeTokens.has(name));

const classicTag=/<script\s+src=["']app\.js["']\s*><\/script>/i.test(index);
const moduleTag=/<script\s+[^>]*type=["']module["'][^>]*src=["']app\.js["'][^>]*><\/script>|<script\s+[^>]*src=["']app\.js["'][^>]*type=["']module["'][^>]*><\/script>/i.test(index);
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

need(!(classicTag&&moduleTag),'app.js aparece simultáneamente como script clásico y módulo.');

if(classicTag&&!moduleTag){
  need(topNames.length<=MAX_TOP_LEVEL_UNIQUE,
    `La deuda top-level clásica creció: ${topNames.length} > ${MAX_TOP_LEVEL_UNIQUE}.`);
  need(runtimeOverlap.length<=MAX_RUNTIME_NAME_OVERLAP,
    `El solapamiento app/runtime creció: ${runtimeOverlap.length} > ${MAX_RUNTIME_NAME_OVERLAP}.`);

  need(app.includes(`Object.defineProperty(globalThis,'${PLAN_READ_CONTRACT}'`),
    'Falta el contrato explícito de lectura de Trading Plan en app.js.');
  need(app.includes('current:getCurrentPlan')&&app.includes('byId:getPlan')&&app.includes('label:planLabel'),
    'El contrato de lectura de Trading Plan no publica exactamente current/byId/label.');

  for(const name of PLAN_READ_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*PlanRead\w*\s*=/.test(src)),
    'El contrato Plan no debe introducir aliases léxicos globales en runtimes clásicos.');
  for(const file of PLAN_READ_CONSUMERS){
    const src=runtimeSources.get(file)||'';
    need(src.includes(`globalThis.${PLAN_READ_CONTRACT}.`),
      `${file} no consume directamente el contrato explícito ${PLAN_READ_CONTRACT}.`);
  }
  const expectedFiles=new Set(PLAN_READ_CONSUMERS);
  const unexpectedConsumers=runtimeFiles.filter(file=>
    !expectedFiles.has(file)&&(runtimeSources.get(file)||'').includes(`globalThis.${PLAN_READ_CONTRACT}.`)
  );
  need(unexpectedConsumers.length===0,
    `Consumidores inesperados del contrato de Plan: ${unexpectedConsumers.join(', ')}.`);

  need(app.includes(`Object.defineProperty(globalThis,'${CONTENT_ENCODING_CONTRACT}'`),
    'Falta el contrato explícito de codificación de contenido en app.js.');
  need(app.includes('html:esc')&&app.includes('uri:inlineUriToken'),
    'El contrato de codificación no publica exactamente html/uri.');

  for(const name of CONTENT_ENCODING_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*ContentEncoding\w*\s*=/.test(src)),
    'El contrato de codificación no debe introducir aliases léxicos globales en runtimes clásicos.');

  for(const file of CONTENT_ENCODING_CONSUMERS.esc){
    const src=runtimeSources.get(file)||'';
    need(src.includes(`globalThis.${CONTENT_ENCODING_CONTRACT}.html(`),
      `${file} no consume directamente ${CONTENT_ENCODING_CONTRACT}.html().`);
  }
  for(const file of CONTENT_ENCODING_CONSUMERS.inlineUriToken){
    const src=runtimeSources.get(file)||'';
    need(src.includes(`globalThis.${CONTENT_ENCODING_CONTRACT}.uri(`),
      `${file} no consume directamente ${CONTENT_ENCODING_CONTRACT}.uri().`);
  }
  for(const [method,expectedList] of [['html',CONTENT_ENCODING_CONSUMERS.esc],['uri',CONTENT_ENCODING_CONSUMERS.inlineUriToken]]){
    const expected=new Set(expectedList);
    const actual=runtimeFiles.filter(file=>(runtimeSources.get(file)||'').includes(`globalThis.${CONTENT_ENCODING_CONTRACT}.${method}(`));
    need(actual.every(file=>expected.has(file))&&expectedList.every(file=>actual.includes(file)),
      `Consumidores inesperados o ausentes para ${CONTENT_ENCODING_CONTRACT}.${method}(): ${actual.join(', ')}.`);
  }

  const escSource=app.match(/function esc\(s\)\{[^\n]+\}/)?.[0]||'';
  const uriSource=app.match(/function inlineUriToken\(value\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(escSource&&uriSource),'No se pudieron extraer las funciones puras de codificación.');
  if(escSource&&uriSource){
    const ctx=vm.createContext({encodeURIComponent});
    vm.runInContext(`${escSource}\n${uriSource}\nthis.__html=esc;this.__uri=inlineUriToken;`,ctx);
    need(ctx.__html(`&<>'"`)===`&amp;&lt;&gt;&#39;&quot;`,
      'La semántica adversarial de escape HTML cambió.');
    need(ctx.__html(null)==='','escape HTML debe normalizar null/undefined a cadena vacía.');
    need(ctx.__uri(`x');PWN();String('x`)===`x%27)%3BPWN()%3BString(%27x`,
      'La semántica adversarial de token URI cambió.');
  }
  need(app.includes(`Object.defineProperty(globalThis,'${EXIT_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de Exit Lab en app.js.');
  need(app.includes('readGrossR:exitGrossR')&&app.includes('classifyResult:exitResultClass')&&app.includes('formatRValue:exitFmtR')&&app.includes('formatPercentValue:exitFmtPct')&&app.includes('formatProfitFactorValue:exitPf'),
    'El contrato Exit no publica exactamente readGrossR/classifyResult/formatRValue/formatPercentValue/formatProfitFactorValue.');

  for(const name of EXIT_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*ExitPresentation\w*\s*=/.test(src)),
    'El contrato Exit no debe introducir aliases léxicos globales en runtimes clásicos.');

  const exitSrc=runtimeSources.get(EXIT_PRESENTATION_CONSUMER)||'';
  for(const method of ['readGrossR','classifyResult','formatRValue','formatPercentValue','formatProfitFactorValue']){
    need(exitSrc.includes(`globalThis.${EXIT_PRESENTATION_CONTRACT}.${method}(`),
      `${EXIT_PRESENTATION_CONSUMER} no consume directamente ${EXIT_PRESENTATION_CONTRACT}.${method}().`);
  }
  const unexpectedExitConsumers=runtimeFiles.filter(file=>
    file!==EXIT_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${EXIT_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedExitConsumers.length===0,
    `Consumidores inesperados del contrato Exit: ${unexpectedExitConsumers.join(', ')}.`);

  const exitGrossRSource=app.match(/function exitGrossR\(o\)\{[^\n]+\}/)?.[0]||'';
  const exitResultClassSource=app.match(/function exitResultClass\(v\)\{[^\n]+\}/)?.[0]||'';
  const exitFmtRSource=app.match(/function exitFmtR\(v,\{signed=true,dec=2\}=\{\}\)\{[^\n]+\}/)?.[0]||'';
  const exitFmtPctSource=app.match(/function exitFmtPct\(v\)\{[^\n]+\}/)?.[0]||'';
  const exitPfSource=app.match(/function exitPf\(v\)\{[^\n]+\}/)?.[0]||'';
  const exitSources=[exitGrossRSource,exitResultClassSource,exitFmtRSource,exitFmtPctSource,exitPfSource];
  need(exitSources.every(Boolean),'No se pudieron extraer todos los helpers puros de Exit Lab.');
  if(exitSources.every(Boolean)){
    const ctx=vm.createContext({});
    vm.runInContext(exitSources.join('\n')+'\nthis.__grossR=exitGrossR;this.__resultClass=exitResultClass;this.__formatR=exitFmtR;this.__formatPct=exitFmtPct;this.__formatPf=exitPf;',ctx);
    need(ctx.__grossR({rMultiple:'1.25'})===1.25&&ctx.__grossR(null)===0,'La semántica de exitGrossR cambió.');
    need(ctx.__resultClass(1)==='positive'&&ctx.__resultClass(-1)==='negative'&&ctx.__resultClass(0)==='','La semántica de exitResultClass cambió.');
    need(ctx.__formatR(1.234,{signed:true,dec:2})==='+1.23R'&&ctx.__formatR(-1.234,{signed:true,dec:1})==='-1.2R','La semántica de exitFmtR cambió.');
    need(ctx.__formatPct(12.34)==='12.3%','La semántica de exitFmtPct cambió.');
    need(ctx.__formatPf(1.234)==='1.23'&&ctx.__formatPf(Infinity)==='∞','La semántica de exitPf cambió.');
  }
  need(app.includes(`Object.defineProperty(globalThis,'${FORM_BOUNDARY_CONTRACT}'`),
    'Falta el contrato explícito de formularios/modales en app.js.');
  need(app.includes('captureFormData:formDataFrom')&&app.includes('readFormValue:formDataValue')&&app.includes('renderLockedModal:modalShell'),
    'El contrato de formularios no publica exactamente captureFormData/readFormValue/renderLockedModal.');

  for(const name of FORM_BOUNDARY_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*FormBoundary\w*\s*=/.test(src)),
    'El contrato Form Boundary no debe introducir aliases léxicos globales en runtimes clásicos.');

  const formSrc=runtimeSources.get(FORM_BOUNDARY_CONSUMER)||'';
  for(const method of ['captureFormData','readFormValue','renderLockedModal']){
    need(formSrc.includes(`globalThis.${FORM_BOUNDARY_CONTRACT}.${method}(`),
      `${FORM_BOUNDARY_CONSUMER} no consume directamente ${FORM_BOUNDARY_CONTRACT}.${method}().`);
  }
  const unexpectedFormConsumers=runtimeFiles.filter(file=>
    file!==FORM_BOUNDARY_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${FORM_BOUNDARY_CONTRACT}.`)
  );
  need(unexpectedFormConsumers.length===0,
    `Consumidores inesperados del contrato Form Boundary: ${unexpectedFormConsumers.join(', ')}.`);

  const escSource2=app.match(/function esc\(s\)\{[^\n]+\}/)?.[0]||'';
  const formDataFromSource=app.match(/function formDataFrom\(formOrSelector\)\{[^\n]+\}/)?.[0]||'';
  const formDataValueSource=app.match(/function formDataValue\(fd,name,fallback=''\)\{[^\n]+\}/)?.[0]||'';
  const modalShellSource=app.match(/function modalShell\(title,body,footer\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(escSource2&&formDataFromSource&&formDataValueSource&&modalShellSource),
    'No se pudieron extraer los helpers del Form Boundary.');
  if(escSource2&&formDataFromSource&&formDataValueSource&&modalShellSource){
    class TestFormData{constructor(form){this.form=form;}}
    const selected={id:'selected'};
    const ctx=vm.createContext({
      document:{querySelector:q=>q==='#f'?selected:null},
      FormData:TestFormData
    });
    vm.runInContext([escSource2,formDataFromSource,formDataValueSource,modalShellSource,
      'this.__from=formDataFrom;this.__value=formDataValue;this.__modal=modalShell;'].join('\n'),ctx);
    const fdBySelector=ctx.__from('#f');
    const direct={id:'direct'};
    const fdDirect=ctx.__from(direct);
    need(fdBySelector instanceof TestFormData&&fdBySelector.form===selected&&fdDirect instanceof TestFormData&&fdDirect.form===direct,
      'La semántica de formDataFrom cambió.');
    need(ctx.__value({get:n=>n==='ok'?'value':42},'ok','fallback')==='value'&&ctx.__value({get:()=>42},'x','fallback')==='fallback',
      'La semántica de formDataValue cambió.');
    const modal=ctx.__modal(`A&B<`, '<p>body</p>', '<button>ok</button>');
    need(modal.includes('<h3>A&amp;B&lt;</h3>')&&modal.includes('data-modal-locked="true"')&&modal.includes('<p>body</p>')&&modal.includes('<button>ok</button>'),
      'La semántica de modalShell cambió.');
  }

  need(app.includes(`Object.defineProperty(globalThis,'${REPORTS_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de Reports en app.js.');
  need(app.includes('formatUnitLabel:metricUnitLabel')&&app.includes('describeOperationDateRange:v313DateRangeText'),
    'El contrato Reports no publica exactamente formatUnitLabel/describeOperationDateRange.');

  for(const name of REPORTS_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*ReportsPresentation\w*\s*=/.test(src)),
    'El contrato Reports no debe introducir aliases léxicos globales en runtimes clásicos.');

  const reportsSrc=runtimeSources.get(REPORTS_PRESENTATION_CONSUMER)||'';
  for(const method of ['formatUnitLabel','describeOperationDateRange']){
    need(reportsSrc.includes(`globalThis.${REPORTS_PRESENTATION_CONTRACT}.${method}(`),
      `${REPORTS_PRESENTATION_CONSUMER} no consume directamente ${REPORTS_PRESENTATION_CONTRACT}.${method}().`);
  }
  const unexpectedReportsConsumers=runtimeFiles.filter(file=>
    file!==REPORTS_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${REPORTS_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedReportsConsumers.length===0,
    `Consumidores inesperados del contrato Reports: ${unexpectedReportsConsumers.join(', ')}.`);

  const metricUnitLabelSource=app.match(/function metricUnitLabel\(unit\)\{[^\n]+\}/)?.[0]||'';
  const dateRangeSource=app.match(/function v313DateRangeText\(ops\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(metricUnitLabelSource&&dateRangeSource),
    'No se pudieron extraer los helpers puros de presentación de Reports.');
  if(metricUnitLabelSource&&dateRangeSource){
    const ctx=vm.createContext({
      v3194CompareOps:(a,b)=>String(a.entryDate).localeCompare(String(b.entryDate)),
      fmtDateOnly:v=>String(v).slice(0,10)
    });
    vm.runInContext([metricUnitLabelSource,dateRangeSource,
      'this.__unit=metricUnitLabel;this.__range=v313DateRangeText;'].join('\n'),ctx);
    need(ctx.__unit('ticks')==='ticks'&&ctx.__unit('usd')==='US$'&&ctx.__unit('r')==='R'&&ctx.__unit('other')==='R',
      'La semántica de metricUnitLabel cambió.');
    need(ctx.__range([])==='Sin operaciones',
      'v313DateRangeText debe mantener el caso vacío.');
    const range=ctx.__range([{entryDate:'2026-09-02T10:00:00Z'},{entryDate:'2026-08-31T10:00:00Z'}]);
    need(range==='2026-08-31 → 2026-09-02',
      'La semántica de v313DateRangeText cambió.');
  }

  need(app.includes(`Object.defineProperty(globalThis,'${TIMELINE_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación temporal/ticks en app.js.');
  need(app.includes('formatSignedTicks:v314SignedTicks')&&app.includes('formatElapsedDuration:v315Duration')&&app.includes('formatGridTimestamp:v315GridTime'),
    'El contrato Timeline no publica exactamente formatSignedTicks/formatElapsedDuration/formatGridTimestamp.');

  for(const name of TIMELINE_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*TimelinePresentation\w*\s*=/.test(src)),
    'El contrato Timeline no debe introducir aliases léxicos globales en runtimes clásicos.');

  const timelineSrc=runtimeSources.get(TIMELINE_PRESENTATION_CONSUMER)||'';
  for(const method of ['formatSignedTicks','formatElapsedDuration','formatGridTimestamp']){
    need(timelineSrc.includes(`globalThis.${TIMELINE_PRESENTATION_CONTRACT}.${method}(`),
      `${TIMELINE_PRESENTATION_CONSUMER} no consume directamente ${TIMELINE_PRESENTATION_CONTRACT}.${method}().`);
  }
  const unexpectedTimelineConsumers=runtimeFiles.filter(file=>
    file!==TIMELINE_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${TIMELINE_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedTimelineConsumers.length===0,
    `Consumidores inesperados del contrato Timeline: ${unexpectedTimelineConsumers.join(', ')}.`);

  const fmtTicksSource=app.match(/function v314FmtTicks\(v\)\{[^\n]+\}/)?.[0]||'';
  const signedTicksSource=app.match(/function v314SignedTicks\(v\)\{[^\n]+\}/)?.[0]||'';
  const durationSource=app.match(/function v315Duration\(ms\)\{[^\n]+\}/)?.[0]||'';
  const gridTimeSource=app.match(/function v315GridTime\(ms,offsetHours,withMs=false\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(fmtTicksSource&&signedTicksSource&&durationSource&&gridTimeSource),
    'No se pudieron extraer los helpers puros de presentación Timeline.');
  if(fmtTicksSource&&signedTicksSource&&durationSource&&gridTimeSource){
    const ctx=vm.createContext({});
    vm.runInContext([fmtTicksSource,signedTicksSource,durationSource,gridTimeSource,
      'this.__signed=v314SignedTicks;this.__duration=v315Duration;this.__grid=v315GridTime;'].join('\n'),ctx);
    need(ctx.__signed(1)==='+1t'&&ctx.__signed(-1.5)==='-1.5t'&&ctx.__signed(NaN)==='—',
      'La semántica de v314SignedTicks cambió.');
    need(ctx.__duration(9000)==='9.0 s'&&ctx.__duration(60000)==='1m 00s'&&ctx.__duration(-1)==='—',
      'La semántica de v315Duration cambió.');
    const ts=Date.UTC(2026,8,2,10,11,12,345);
    need(ctx.__grid(ts,2,true)==='02/09/2026 12:11:12.345'&&ctx.__grid(NaN,0)==='—',
      'La semántica de v315GridTime cambió.');
  }

  need(app.includes(`Object.defineProperty(globalThis,'${DATE_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de fechas en app.js.');
  need(app.includes('formatLocalDateTime:fmtDate'),
    'El contrato Date Presentation no publica exactamente formatLocalDateTime.');

  for(const name of DATE_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*DatePresentation\w*\s*=/.test(src)),
    'El contrato Date Presentation no debe introducir aliases léxicos globales en runtimes clásicos.');

  const dateSrc=runtimeSources.get(DATE_PRESENTATION_CONSUMER)||'';
  need(dateSrc.includes(`globalThis.${DATE_PRESENTATION_CONTRACT}.formatLocalDateTime(`),
    `${DATE_PRESENTATION_CONSUMER} no consume directamente ${DATE_PRESENTATION_CONTRACT}.formatLocalDateTime().`);
  const unexpectedDateConsumers=runtimeFiles.filter(file=>
    file!==DATE_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${DATE_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedDateConsumers.length===0,
    `Consumidores inesperados del contrato Date Presentation: ${unexpectedDateConsumers.join(', ')}.`);

  const fmtDateSource=app.match(/const fmtDate = iso => \{[^\n]+\};/)?.[0]||'';
  need(Boolean(fmtDateSource),'No se pudo extraer el helper puro fmtDate.');
  if(fmtDateSource){
    class TestDate{
      constructor(value){this.value=value;}
      valueOf(){return this.value==='invalid'?NaN:0;}
      toLocaleString(locale,options){return `${locale}|${options.dateStyle}|${options.timeStyle}|${this.value}`;}
    }
    const ctx=vm.createContext({Date:TestDate,isNaN});
    vm.runInContext(`${fmtDateSource}\nthis.__date=fmtDate;`,ctx);
    need(ctx.__date(null)==='—'&&ctx.__date('invalid')==='invalid',
      'fmtDate debe preservar sus fallbacks vacío e inválido.');
    need(ctx.__date('2026-09-02T10:11:12Z')==='es-ES|short|short|2026-09-02T10:11:12Z',
      'fmtDate debe conservar locale es-ES y estilos short/short.');
  }

  need(app.includes(`Object.defineProperty(globalThis,'${NAVIGATION_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de navegación en app.js.');
  need(app.includes('groupForView:v318GroupForView'),
    'El contrato Navigation Presentation no publica exactamente groupForView.');

  for(const name of NAVIGATION_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*NavigationPresentation\w*\s*=/.test(src)),
    'El contrato Navigation Presentation no debe introducir aliases léxicos globales en runtimes clásicos.');

  const navigationSrc=runtimeSources.get(NAVIGATION_PRESENTATION_CONSUMER)||'';
  need(navigationSrc.includes(`globalThis.${NAVIGATION_PRESENTATION_CONTRACT}.groupForView(`),
    `${NAVIGATION_PRESENTATION_CONSUMER} no consume directamente ${NAVIGATION_PRESENTATION_CONTRACT}.groupForView().`);
  const unexpectedNavigationConsumers=runtimeFiles.filter(file=>
    file!==NAVIGATION_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${NAVIGATION_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedNavigationConsumers.length===0,
    `Consumidores inesperados del contrato Navigation Presentation: ${unexpectedNavigationConsumers.join(', ')}.`);

  const navigationGroupsSource=app.match(/const V318_NAV_GROUPS=\[[\s\S]*?\n\];/)?.[0]||'';
  const groupForViewSource=app.match(/function v318GroupForView\(view=currentView\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(navigationGroupsSource&&groupForViewSource),
    'No se pudieron extraer los helpers puros de Navigation Presentation.');
  if(navigationGroupsSource&&groupForViewSource){
    const ctx=vm.createContext({currentView:'lab'});
    vm.runInContext(`${navigationGroupsSource}\n${groupForViewSource}\nthis.__group=v318GroupForView;`,ctx);
    need(ctx.__group('operations')==='operativa'&&ctx.__group('lab')==='research'&&ctx.__group('reports')==='control'&&ctx.__group('market')==='data'&&ctx.__group('config')==='system',
      'La semántica de grupos conocidos de v318GroupForView cambió.');
    need(ctx.__group('unknown')===''&&ctx.__group()==='research',
      'v318GroupForView debe conservar los fallbacks desconocido y currentView.');
  }


  need(app.includes(`Object.defineProperty(globalThis,'${OPERATIONS_READ_CONTRACT}'`),
    'Falta el contrato explícito de lectura de operaciones actuales en app.js.');
  need(app.includes('current:currentOps'),
    'El contrato Operations Read no publica exactamente current.');

  for(const name of OPERATIONS_READ_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*OperationsRead\w*\s*=/.test(src)),
    'El contrato Operations Read no debe introducir aliases léxicos globales en runtimes clásicos.');

  const operationsReadSrc=runtimeSources.get(OPERATIONS_READ_CONSUMER)||'';
  need(operationsReadSrc.includes(`globalThis.${OPERATIONS_READ_CONTRACT}.current()`),
    `${OPERATIONS_READ_CONSUMER} no consume directamente ${OPERATIONS_READ_CONTRACT}.current().`);
  const unexpectedOperationsReadConsumers=runtimeFiles.filter(file=>
    file!==OPERATIONS_READ_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${OPERATIONS_READ_CONTRACT}.`)
  );
  need(unexpectedOperationsReadConsumers.length===0,
    `Consumidores inesperados del contrato Operations Read: ${unexpectedOperationsReadConsumers.join(', ')}.`);

  const currentOpsSource=app.match(/function currentOps\(\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(currentOpsSource),
    'No se pudo extraer currentOps para verificar su semántica de lectura.');
  if(currentOpsSource){
    const ctx=vm.createContext({state:{
      currentPlanId:'P1',
      operations:[
        {id:'A',tradingPlanId:'P1'},
        {id:'B',tradingPlanId:'P2'},
        {id:'C',tradingPlanId:'P1'}
      ]
    }});
    vm.runInContext(currentOpsSource+'\nthis.__current=currentOps;',ctx);
    const rows=ctx.__current();
    need(Array.isArray(rows)&&rows.length===2&&rows[0].id==='A'&&rows[1].id==='C',
      'La semántica de currentOps cambió.');
  }


  need(app.includes(`Object.defineProperty(globalThis,'${CONTEXT_HELP_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de ayuda contextual en app.js.');
  need(app.includes('apply:applyContextHelp')&&app.includes('ensureObserver:ensureContextHelpObserver'),
    'El contrato Context Help Presentation no publica exactamente apply y ensureObserver.');

  for(const name of CONTEXT_HELP_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*ContextHelpPresentation\w*\s*=/.test(src)),
    'El contrato Context Help Presentation no debe introducir aliases léxicos globales en runtimes clásicos.');

  const contextHelpSrc=runtimeSources.get(CONTEXT_HELP_PRESENTATION_CONSUMER)||'';
  need(contextHelpSrc.includes(`globalThis.${CONTEXT_HELP_PRESENTATION_CONTRACT}.ensureObserver()`),
    `${CONTEXT_HELP_PRESENTATION_CONSUMER} no consume directamente ${CONTEXT_HELP_PRESENTATION_CONTRACT}.ensureObserver().`);
  need(contextHelpSrc.includes(`setTimeout(globalThis.${CONTEXT_HELP_PRESENTATION_CONTRACT}.apply,0)`),
    `${CONTEXT_HELP_PRESENTATION_CONSUMER} no difiere apply mediante el contrato Context Help Presentation.`);
  const unexpectedContextHelpConsumers=runtimeFiles.filter(file=>
    file!==CONTEXT_HELP_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${CONTEXT_HELP_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedContextHelpConsumers.length===0,
    `Consumidores inesperados del contrato Context Help Presentation: ${unexpectedContextHelpConsumers.join(', ')}.`);


  need(app.includes(`Object.defineProperty(globalThis,'${VIEW_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de vistas en app.js.');
  const viewMappings=[
    ['decision','researchDecisionCenter'],
    ['changes','researchChangesView'],
    ['calendar','calendarView'],
    ['goals','goalsView'],
    ['quality','dataQualityView'],
    ['compliance','complianceView'],
    ['mistakes','mistakesView'],
    ['lab','analyticsLab'],
    ['review','reviewView'],
    ['reports','reportsView'],
    ['market','v314MarketDataView'],
    ['plans','plansView']
  ];
  for(const [key,name] of viewMappings){
    need(app.includes(`${key}:${name}`),
      `El contrato View Presentation no publica exactamente ${key}:${name}.`);
  }

  for(const name of VIEW_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*ViewPresentation\w*\s*=/.test(src)),
    'El contrato View Presentation no debe introducir aliases léxicos globales en runtimes clásicos.');

  const viewPresentationSrc=runtimeSources.get(VIEW_PRESENTATION_CONSUMER)||'';
  for(const [key] of viewMappings){
    need(viewPresentationSrc.includes(`globalThis.${VIEW_PRESENTATION_CONTRACT}.${key}()`),
      `${VIEW_PRESENTATION_CONSUMER} no consume directamente ${VIEW_PRESENTATION_CONTRACT}.${key}().`);
  }
  const unexpectedViewPresentationConsumers=runtimeFiles.filter(file=>
    file!==VIEW_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${VIEW_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedViewPresentationConsumers.length===0,
    `Consumidores inesperados del contrato View Presentation: ${unexpectedViewPresentationConsumers.join(', ')}.`);


  need(app.includes(`Object.defineProperty(globalThis,'${RESEARCH_STATUS_CONTRACT}'`),
    'Falta el contrato explícito de estado de Research en app.js.');
  need(app.includes('unreadCount:researchUnreadCount'),
    'El contrato Research Status no publica exactamente unreadCount.');

  for(const name of RESEARCH_STATUS_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*ResearchStatus\w*\s*=/.test(src)),
    'El contrato Research Status no debe introducir aliases léxicos globales en runtimes clásicos.');

  const researchStatusSrc=runtimeSources.get(RESEARCH_STATUS_CONSUMER)||'';
  need(researchStatusSrc.includes(`globalThis.${RESEARCH_STATUS_CONTRACT}.unreadCount()`),
    `${RESEARCH_STATUS_CONSUMER} no consume directamente ${RESEARCH_STATUS_CONTRACT}.unreadCount().`);
  const unexpectedResearchStatusConsumers=runtimeFiles.filter(file=>
    file!==RESEARCH_STATUS_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${RESEARCH_STATUS_CONTRACT}.`)
  );
  need(unexpectedResearchStatusConsumers.length===0,
    `Consumidores inesperados del contrato Research Status: ${unexpectedResearchStatusConsumers.join(', ')}.`);

  const researchUnreadSource=app.match(/function researchUnreadCount\(p=getCurrentPlan\(\)\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(researchUnreadSource),
    'No se pudo extraer researchUnreadCount para verificar su semántica.');
  if(researchUnreadSource){
    let ensured=0;
    const ctx=vm.createContext({
      getCurrentPlan:()=>null,
      ensurePlanResearchChanges:()=>{ensured++;}
    });
    vm.runInContext(researchUnreadSource+'\nthis.__unread=researchUnreadCount;',ctx);
    const plan={researchChanges:{events:[{read:false},{read:true},{read:false}]}};
    need(ctx.__unread(plan)===2&&ensured===1,
      'La semántica de researchUnreadCount cambió.');
  }


  need(app.includes(`Object.defineProperty(globalThis,'${REPORTS_SECTION_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de secciones de Informes en app.js.');

  const reportSectionMappings=[
    ['summary','v313ReportSummary'],
    ['confidence','v313ReportConfidence'],
    ['process','v313ReportProcess'],
    ['quality','v313ReportQuality'],
    ['breakdowns','v313ReportBreakdowns'],
    ['controls','v313SectionsControls']
  ];
  for(const [key,name] of reportSectionMappings){
    need(app.includes(`${key}:${name}`),
      `El contrato Reports Section Presentation no publica exactamente ${key}:${name}.`);
  }

  for(const name of REPORTS_SECTION_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*ReportsSectionPresentation\w*\s*=/.test(src)),
    'El contrato Reports Section Presentation no debe introducir aliases léxicos globales en runtimes clásicos.');

  const reportSectionsSrc=runtimeSources.get(REPORTS_SECTION_PRESENTATION_CONSUMER)||'';
  const requiredCalls=[
    'summary(p,ops,s)',
    'confidence(ops,s)',
    'process(p,ops)',
    'quality(p,ops)',
    'breakdowns(ops)',
    'controls()'
  ];
  for(const call of requiredCalls){
    need(reportSectionsSrc.includes(`globalThis.${REPORTS_SECTION_PRESENTATION_CONTRACT}.${call}`),
      `${REPORTS_SECTION_PRESENTATION_CONSUMER} no consume directamente ${REPORTS_SECTION_PRESENTATION_CONTRACT}.${call}.`);
  }

  const unexpectedReportSectionConsumers=runtimeFiles.filter(file=>
    file!==REPORTS_SECTION_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${REPORTS_SECTION_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedReportSectionConsumers.length===0,
    `Consumidores inesperados del contrato Reports Section Presentation: ${unexpectedReportSectionConsumers.join(', ')}.`);


  need(app.includes(`Object.defineProperty(globalThis,'${OPERATIONS_PRESENTATION_CONTRACT}'`),
    'Falta el contrato explícito de presentación de Operaciones en app.js.');
  need(app.includes('filterPanel:operationsFilterPanel')&&app.includes('analytics:opsAnalyticsHtml'),
    'El contrato Operations Presentation no publica exactamente filterPanel y analytics.');

  for(const name of OPERATIONS_PRESENTATION_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*OperationsPresentation\w*\s*=/.test(src)),
    'El contrato Operations Presentation no debe introducir aliases léxicos globales en runtimes clásicos.');

  const operationsPresentationSrc=runtimeSources.get(OPERATIONS_PRESENTATION_CONSUMER)||'';
  need(operationsPresentationSrc.includes(`globalThis.${OPERATIONS_PRESENTATION_CONTRACT}.filterPanel()`),
    `${OPERATIONS_PRESENTATION_CONSUMER} no consume directamente ${OPERATIONS_PRESENTATION_CONTRACT}.filterPanel().`);
  need(operationsPresentationSrc.includes(`globalThis.${OPERATIONS_PRESENTATION_CONTRACT}.analytics(filteredOps())`),
    `${OPERATIONS_PRESENTATION_CONSUMER} no consume directamente ${OPERATIONS_PRESENTATION_CONTRACT}.analytics(filteredOps()).`);

  const unexpectedOperationsPresentationConsumers=runtimeFiles.filter(file=>
    file!==OPERATIONS_PRESENTATION_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${OPERATIONS_PRESENTATION_CONTRACT}.`)
  );
  need(unexpectedOperationsPresentationConsumers.length===0,
    `Consumidores inesperados del contrato Operations Presentation: ${unexpectedOperationsPresentationConsumers.join(', ')}.`);


  need(app.includes(`Object.defineProperty(globalThis,'${NAVIGATION_STATE_CONTRACT}'`),
    'Falta el contrato explícito de estado de navegación en app.js.');
  need(app.includes('saveOpenGroups:v318SaveOpenGroups'),
    'El contrato Navigation State no publica exactamente saveOpenGroups.');

  for(const name of NAVIGATION_STATE_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }
  need(![...runtimeSources.values()].some(src=>/\b(?:const|let|var)\s+\w*NavigationState\w*\s*=/.test(src)),
    'El contrato Navigation State no debe introducir aliases léxicos globales en runtimes clásicos.');

  const navigationStateSrc=runtimeSources.get(NAVIGATION_STATE_CONSUMER)||'';
  need(navigationStateSrc.includes(`globalThis.${NAVIGATION_STATE_CONTRACT}.saveOpenGroups()`),
    `${NAVIGATION_STATE_CONSUMER} no consume directamente ${NAVIGATION_STATE_CONTRACT}.saveOpenGroups().`);

  const unexpectedNavigationStateConsumers=runtimeFiles.filter(file=>
    file!==NAVIGATION_STATE_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${NAVIGATION_STATE_CONTRACT}.`)
  );
  need(unexpectedNavigationStateConsumers.length===0,
    `Consumidores inesperados del contrato Navigation State: ${unexpectedNavigationStateConsumers.join(', ')}.`);

  const saveOpenGroupsSource=app.match(/function v318SaveOpenGroups\(\)\{[^\n]+\}/)?.[0]||'';
  need(Boolean(saveOpenGroupsSource),
    'No se pudo extraer v318SaveOpenGroups para verificar su semántica.');
  if(saveOpenGroupsSource){
    let saved=null;
    const ctx=vm.createContext({
      v318OpenGroups:new Set(['research','data']),
      V318_NAV_KEY:'tr.nav.groups',
      localStorage:{setItem:(k,v)=>{saved=[k,v];}}
    });
    vm.runInContext(saveOpenGroupsSource+'\nthis.__save=v318SaveOpenGroups;',ctx);
    ctx.__save();
    need(saved?.[0]==='tr.nav.groups'&&saved?.[1]===JSON.stringify(['research','data']),
      'La semántica de v318SaveOpenGroups cambió.');
  }


  need(app.includes(`Object.defineProperty(globalThis,'${NAVIGATION_RUNTIME_STATE_CONTRACT}'`),
    'Falta el contrato explícito de runtime state de navegación en app.js.');
  const navRuntimeFields=[
    'isGroupOpen:id=>v318OpenGroups.has(id)',
    'ensureGroupOpen:id=>{if(v318OpenGroups.has(id))return false;v318OpenGroups.add(id);v318SaveOpenGroups();return true;}',
    'setLastView:view=>{v318LastView=view;}'
  ];
  for(const field of navRuntimeFields){
    need(app.includes(field),
      `El contrato Navigation Runtime State no publica exactamente ${field}.`);
  }

  for(const name of NAVIGATION_RUNTIME_STATE_LEGACY){
    need(!runtimeTokens.has(name),
      `El runtime todavía consume el binding clásico ${name} directamente.`);
  }

  const navRuntimeSrc=runtimeSources.get(NAVIGATION_RUNTIME_STATE_CONSUMER)||'';
  need(navRuntimeSrc.includes(`globalThis.${NAVIGATION_RUNTIME_STATE_CONTRACT}.ensureGroupOpen(activeGroup)`),
    `${NAVIGATION_RUNTIME_STATE_CONSUMER} no consume ensureGroupOpen(activeGroup).`);
  need(navRuntimeSrc.includes(`globalThis.${NAVIGATION_RUNTIME_STATE_CONTRACT}.setLastView(currentView)`),
    `${NAVIGATION_RUNTIME_STATE_CONSUMER} no consume setLastView(currentView).`);
  need(navRuntimeSrc.includes(`globalThis.${NAVIGATION_RUNTIME_STATE_CONTRACT}.isGroupOpen(id)`),
    `${NAVIGATION_RUNTIME_STATE_CONSUMER} no consume isGroupOpen(id).`);

  const unexpectedNavigationRuntimeStateConsumers=runtimeFiles.filter(file=>
    file!==NAVIGATION_RUNTIME_STATE_CONSUMER&&(runtimeSources.get(file)||'').includes(`globalThis.${NAVIGATION_RUNTIME_STATE_CONTRACT}.`)
  );
  need(unexpectedNavigationRuntimeStateConsumers.length===0,
    `Consumidores inesperados del contrato Navigation Runtime State: ${unexpectedNavigationRuntimeStateConsumers.join(', ')}.`);

}

if(fail.length){
  console.error('Classic Global Debt verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}

console.log('Classic Global Debt verification OK');
if(classicTag&&!moduleTag){
  console.log(' - status: BOUNDED DEBT (app.js remains a classic script)');
  console.log(` - top-level app bindings proxy: ${topNames.length} <= ${MAX_TOP_LEVEL_UNIQUE}`);
  console.log(` - runtime name-overlap proxy: ${runtimeOverlap.length} <= ${MAX_RUNTIME_NAME_OVERLAP}`);
  console.log(` - explicit plan-read contract: ${PLAN_READ_LEGACY.length} legacy bindings removed across ${PLAN_READ_CONSUMERS.length} runtimes`);
  console.log(` - explicit content-encoding contract: ${CONTENT_ENCODING_LEGACY.length} legacy bindings removed; html across ${CONTENT_ENCODING_CONSUMERS.esc.length} runtimes + uri in security runtime`);
  console.log(` - explicit exit-presentation contract: ${EXIT_PRESENTATION_LEGACY.length} legacy bindings removed from ${EXIT_PRESENTATION_CONSUMER}`);
  console.log(` - explicit form-boundary contract: ${FORM_BOUNDARY_LEGACY.length} legacy bindings removed from ${FORM_BOUNDARY_CONSUMER}`);
  console.log(` - explicit reports-presentation contract: ${REPORTS_PRESENTATION_LEGACY.length} legacy bindings removed from ${REPORTS_PRESENTATION_CONSUMER}`);
  console.log(` - explicit timeline-presentation contract: ${TIMELINE_PRESENTATION_LEGACY.length} legacy bindings removed from ${TIMELINE_PRESENTATION_CONSUMER}`);
  console.log(` - explicit date-presentation contract: ${DATE_PRESENTATION_LEGACY.length} legacy binding removed from ${DATE_PRESENTATION_CONSUMER}`);
  console.log(` - explicit navigation-presentation contract: ${NAVIGATION_PRESENTATION_LEGACY.length} legacy binding removed from ${NAVIGATION_PRESENTATION_CONSUMER}`);
  console.log(` - explicit operations-read contract: ${OPERATIONS_READ_LEGACY.length} legacy binding removed from ${OPERATIONS_READ_CONSUMER}`);
  console.log(` - explicit context-help-presentation contract: ${CONTEXT_HELP_PRESENTATION_LEGACY.length} legacy bindings removed from ${CONTEXT_HELP_PRESENTATION_CONSUMER}`);
  console.log(` - explicit view-presentation contract: ${VIEW_PRESENTATION_LEGACY.length} legacy bindings removed from ${VIEW_PRESENTATION_CONSUMER}`);
  console.log(` - explicit research-status contract: ${RESEARCH_STATUS_LEGACY.length} legacy binding removed from ${RESEARCH_STATUS_CONSUMER}`);
  console.log(` - explicit reports-section-presentation contract: ${REPORTS_SECTION_PRESENTATION_LEGACY.length} legacy bindings removed from ${REPORTS_SECTION_PRESENTATION_CONSUMER}`);
  console.log(` - explicit operations-presentation contract: ${OPERATIONS_PRESENTATION_LEGACY.length} legacy bindings removed from ${OPERATIONS_PRESENTATION_CONSUMER}`);
  console.log(` - explicit navigation-state contract: ${NAVIGATION_STATE_LEGACY.length} legacy binding removed from ${NAVIGATION_STATE_CONSUMER}`);
  console.log(` - explicit navigation-runtime-state contract: ${NAVIGATION_RUNTIME_STATE_LEGACY.length} legacy bindings removed from ${NAVIGATION_RUNTIME_STATE_CONSUMER}`);
  console.log(' - policy: counts may decrease; any growth fails CI');
  console.log(' - security note: Event Runtime does not resolve actions through globalThis');
}else if(moduleTag){
  console.log(' - status: RETIRED (app.js is an ES module)');
}else{
  console.log(' - status: NOT APPLICABLE (app.js script tag not found in expected form)');
}
