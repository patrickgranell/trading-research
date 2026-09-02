import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];

const MAX_TOP_LEVEL_UNIQUE=1431;
const MAX_RUNTIME_NAME_OVERLAP=240;
const PLAN_READ_CONTRACT='TradingResearchPlanReadContract';
const PLAN_READ_LEGACY=['getPlan','getCurrentPlan','planLabel'];
const PLAN_READ_CONSUMERS=[
  'reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'operation-cleanup-runtime.js','blob-lifecycle-runtime.js'
];

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
  console.log(' - policy: counts may decrease; any growth fails CI');
  console.log(' - security note: Event Runtime does not resolve actions through globalThis');
}else if(moduleTag){
  console.log(' - status: RETIRED (app.js is an ES module)');
}else{
  console.log(' - status: NOT APPLICABLE (app.js script tag not found in expected form)');
}
