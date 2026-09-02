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
const MAX_RUNTIME_NAME_OVERLAP=228;
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
  console.log(' - policy: counts may decrease; any growth fails CI');
  console.log(' - security note: Event Runtime does not resolve actions through globalThis');
}else if(moduleTag){
  console.log(' - status: RETIRED (app.js is an ES module)');
}else{
  console.log(' - status: NOT APPLICABLE (app.js script tag not found in expected form)');
}
