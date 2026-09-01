import fs from 'node:fs';
import {globalSurfaceInventory} from './global-surface-inventory.mjs';
import {remainingGlobalContractMap} from './remaining-global-contract-map.mjs';

const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

const invSource=fs.readFileSync('global-surface-inventory.mjs','utf8');
const globalVerifySource=fs.readFileSync('verify-global-surface.mjs','utf8');
const contractSource=fs.readFileSync('remaining-global-contract-map.mjs','utf8');
const finalAudit=fs.readFileSync('verify-source-consolidation-final.mjs','utf8');
const csp=fs.readFileSync('csp-runtime.js','utf8');
const buildSource=fs.readFileSync('build.mjs','utf8');
const appPruneVerify=fs.readFileSync('verify-app-global-prune.mjs','utf8');
const remainingVerify=fs.readFileSync('verify-remaining-global-contract-map.mjs','utf8');
const ownRuntimes=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js','cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js','style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'];
for(const file of ownRuntimes){
  need(globalVerifySource.includes(file),`verify-global-surface omite ${file}.`);
  need(contractSource.includes(file),`remaining-global-contract-map CLI omite ${file}.`);
  need(remainingVerify.includes(file),`verify-remaining-global-contract-map omite ${file}.`);
  need(appPruneVerify.includes(file),`verify-app-global-prune omite ${file}.`);
  need(buildSource.includes(file),`build pruning/contract coverage omite ${file}.`);
}

const fixture=globalSurfaceInventory(`
function classicTopLevelGlobal(){}
var classicVarGlobal=1;
window.explicitPublished=classicTopLevelGlobal;
`);

need(fixture?.semantics?.scope==='explicit-window-assignments',
  'El inventario debe declarar scope=explicit-window-assignments.');
need(fixture?.semantics?.completeClassicScriptGlobalSurface===false,
  'El inventario debe declarar que NO cubre la superficie global completa de scripts clásicos.');
need(fixture?.semantics?.topLevelClassicDeclarationsIncluded===false,
  'El inventario debe declarar que top-level function/var clásicos quedan fuera de su métrica.');
need(fixture.explicitWindowUnique===1,
  `El fixture debe medir solo 1 publicación explícita window; obtuvo ${fixture.explicitWindowUnique}.`);
need(!invSource.includes("console.log('Global surface inventory OK')"),
  'El CLI no debe presentarse como inventario de superficie global completa.');
need(!globalVerifySource.includes("console.log('Global surface verification OK')"),
  'El verificador no debe presentarse como prueba de superficie global completa.');

const contractFixture=remainingGlobalContractMap('Object.assign(window,{foo});',{runtimeSources:[],stateActionTransformSource:"const TARGET_ACTIONS=Object.freeze([]);"});
need(contractFixture?.semantics?.scope==='remaining-explicit-object-assign-exports',
  'Remaining Contract Map debe declarar que clasifica exports explícitos Object.assign, no todos los globals del script.');
need(contractFixture?.semantics?.completeClassicScriptGlobalSurface===false,
  'Remaining Contract Map debe negar cobertura completa de globals clásicos.');

need(finalAudit.includes("persistence-coalescing-runtime"),
  'Final Audit second-pass no incluye persistence-coalescing-runtime.js.');
need(/finalScriptBlocks\.length\)===17|finalScriptBlocks\.length===17/.test(finalAudit),
  'Final Audit debe afirmar explícitamente cobertura 17/17 de scripts propios antes del second-pass.');

need(!csp.includes('ok:s.ok!==false'),
  'CSP diagnostics convierte estado no comprobado en ok=true.');
need(!csp.includes('strictExecutableBoundary:s.ok===true'),
  'CSP runtime usa un claim demasiado amplio: strictExecutableBoundary.');
need(!csp.includes('fullStrictStyles:s.ok===true'),
  'CSP runtime usa un claim demasiado amplio: fullStrictStyles.');
need(csp.includes('headerMatchesExpectedPolicy'),
  'CSP diagnostics debe exponer la propiedad exacta comprobada: headerMatchesExpectedPolicy.');
need(csp.includes('ok:s.checked?'),
  'CSP diagnostics debe mantener ok=null hasta que la sonda HEAD haya terminado.');
need(!/CSP completa<\/span><strong class="positive">Enforced<\/strong>/.test(csp),
  'dataSecurityPanel contiene un Enforced CSP estático independiente de la sonda.');
need(!csp.includes("d.headerOk?'Enforced':'Revisar'"),
  'El panel no debe llamar Enforced a una mera coincidencia textual de cabecera.');

if(fail.length){
  console.error('Verifier honesty gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Verifier honesty gate OK');
console.log(' - explicit-window tooling declares its limited classic-script scope and covers 16/16 runtime source files');
console.log(' - Final Audit Structured Event second-pass covers 17/17 own script blocks');
console.log(' - CSP runtime reports header-policy evidence, never unchecked/broad Enforced claims');
