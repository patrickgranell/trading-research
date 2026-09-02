import fs from 'node:fs';
import crypto from 'node:crypto';
const app=fs.readFileSync('app.js','utf8');
const runtime=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const securityRuntime=fs.readFileSync('security-runtime.js','utf8');
const eventRuntime=fs.readFileSync('event-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const baseline=JSON.parse(fs.readFileSync('financial-regression-baseline.json','utf8'));
const fail=[];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
/* Preserve the audited V31.25 Best Exit source baseline byte-for-byte.
 * The only permitted architectural delta is the exact terminal contract chain:
 * Plan read followed by content encoding. Removing both suffixes must reproduce
 * the audited app.js exactly; this is intentionally stronger than replacing the
 * historical baseline hash. */
const expectedAuditedAppSha='a0c92b82d73b55d30ecd9f6388d1424fdce3f209356ae15391f3ba2182bbb98d';
const planReadContractSuffix="\n/* V31.25 · bounded classic-global debt · explicit read-only Plan contract */\nObject.defineProperty(globalThis,'TradingResearchPlanReadContract',{value:Object.freeze({current:getCurrentPlan,byId:getPlan,label:planLabel}),writable:false,enumerable:false,configurable:false});\n";
const contentEncodingContractSuffix="/* V31.25 · bounded classic-global debt · explicit content encoding contract */\nObject.defineProperty(globalThis,'TradingResearchContentEncodingContract',{value:Object.freeze({html:esc,uri:inlineUriToken}),writable:false,enumerable:false,configurable:false});\n";
const architecturalContractSuffix=planReadContractSuffix+contentEncodingContractSuffix;
if(!app.endsWith(architecturalContractSuffix)){
  fail.push('app.js no termina exactamente con la cadena contractual Plan + Content Encoding permitida.');
}else{
  const auditedApp=app.slice(0,-architecturalContractSuffix.length);
  if(sha(auditedApp)!==expectedAuditedAppSha)fail.push(`El source previo a los contratos arquitectónicos ya no coincide con el V31.25 Best Exit auditado (${sha(auditedApp)} != ${expectedAuditedAppSha}).`);
}
if((app.match(/TradingResearchPlanReadContract/g)||[]).length!==1)fail.push('TradingResearchPlanReadContract debe publicarse exactamente una vez en app.js.');
if((app.match(/TradingResearchContentEncodingContract/g)||[]).length!==1)fail.push('TradingResearchContentEncodingContract debe publicarse exactamente una vez en app.js.');
const chunk=(start,end)=>{const a=app.indexOf(start),b=a<0?-1:app.indexOf(end,a+start.length);if(a<0||b<0){fail.push(`No se encuentra región ${start}`);return '';}return app.slice(a,b);};
if(pkg.version!=='31.25.0')fail.push(`Versión inesperada: ${pkg.version}`);
if(!app.includes("const TR_CORE_DB_NAME='tradingResearchCoreV1'"))fail.push('Falta IndexedDB core.');
if(!app.includes("let trCoreWriteBlockReason=''"))fail.push('Falta recovery write lock del core durable.');
if(!app.includes('function trCoreSetWriteBlock(')||!app.includes('function trCoreClearWriteBlock(')||!app.includes('function trCoreWriteBlocked('))fail.push('Falta ciclo set/clear/query del recovery write lock.');
if(!app.includes("return String(reason||'').startsWith('backup-v2-restore');"))fail.push('El core write lock no reserva exclusivamente la persistencia Backup V2.');
if((app.match(/if\(!trCoreWriteAllowed\(reason\)\)/g)||[]).length<2)fail.push('El core write lock no cubre persist-now y queue-state-write.');
if(!app.includes("function persist(){return trCorePersistStateBridge('persist');}"))fail.push('persist() no usa el bridge durable.');
if(/localStorage\.setItem\(STORAGE_KEY/.test(app))fail.push('Queda una escritura directa del estado a localStorage.');
if(!app.includes('trCoreBootstrap();'))fail.push('Falta bootstrap IndexedDB.');
if(!runtime.includes("const TR_RENDER_RUNTIME_VERSION='31.13'"))fail.push('Falta runtime de render parcial V31.13.');
if(!runtime.includes('function trRenderViewHtml('))fail.push('Falta router central de vistas.');
if(!runtime.includes('function trRenderEnsureShell('))fail.push('Falta shell persistente.');
if(!runtime.includes('function trPartialRenderOperations('))fail.push('Falta render parcial de Operaciones.');
if(!runtime.includes('function trPartialRenderMarket('))fail.push('Falta render parcial de Market Data.');
if(!runtime.includes('TR_OPERATION_DRAFT_KEY'))fail.push('Falta recuperación temporal de borradores.');
if(!stateRuntime.includes("const TR_STATE_RUNTIME_VERSION='31.17.1'"))fail.push('Falta State Runtime V31.17.1.');
if(!stateRuntime.includes('const TRDomainStore=Object.freeze'))fail.push('Falta DomainStore.');
if(!stateRuntime.includes('const TRUIStore=Object.freeze'))fail.push('Falta UIStore.');
if(!stateRuntime.includes('new Proxy(value'))fail.push('Falta proxy profundo de mutaciones de dominio.');
if(!stateRuntime.includes('function trStateSemanticEqual('))fail.push('Falta comparación semántica de mutaciones.');
if(!stateRuntime.includes('suppressedNoopWrites'))fail.push('Falta diagnóstico de no-op suprimidos.');
if(!stateRuntime.includes('function trDomainNormalizeHydratedSchema('))fail.push('Falta normalización eager de esquema.');
if(!stateRuntime.includes('renderSideEffects'))fail.push('Falta detector de efectos laterales de render.');
if(!stateRuntime.includes('function trDomainRenderGuardBegin(')||!stateRuntime.includes('function trDomainRenderGuardEnd('))fail.push('Falta boundary read-only de render.');
if(!stateRuntime.includes('trDomainRenderGuardSuppressedPersists'))fail.push('Falta supresión de persistencia dentro de render.');
if(runtime.includes("if(typeof v30EnsureBaselineLocal==='function')v30EnsureBaselineLocal();"))fail.push('El motor de render todavía inicializa la baseline del dominio.');
if(!stateRuntime.includes('trV3192ApplyConfiguredEconomicsBase'))fail.push('Falta guardia idempotente de contractEconomics Ankora.');
if(!stateRuntime.includes("trDomainNormalizeHydratedSchema('render')"))fail.push('El render no estabiliza el esquema antes de proyectar la UI.');
if(!stateRuntime.includes('trDomainFlush(trDomainCallerLabel'))fail.push('Persistencia no publica lotes de mutación.');
if(!stateRuntime.includes("TRDomainStore.commit('plan.switch'"))fail.push('No hay ningún comando durable migrado a commit explícito.');
if(!stateRuntime.includes('function trDomainCommand(')||!stateRuntime.includes('command:trDomainCommand'))fail.push('Falta command boundary controlado.');
if(!stateRuntime.includes("targetId?'operation.update':'operation.create'"))fail.push('Guardado de Operaciones no está clasificado create/update.');
if(!stateRuntime.includes('if(trDomainCommandDepth){trDomainCommandPersistRequests++;return true;}'))fail.push('Persistencias legacy no se coalescen dentro de comandos.');
if(!stateRuntime.includes('if(trDomainCommandDepth){trDomainCommandRenderRequests++;return;}'))fail.push('Renders legacy no se coalescen dentro de comandos.');
for(const label of ['operation.emotional.update','operation.imported.update','operation.data-quality.update','operation.execution.link','operation.execution.unlink'])if(!stateRuntime.includes(label))fail.push(`Falta comando migrado ${label}.`);
for(const label of ['contract.create','contract.update','plan.create','plan.update','plan.clone','plan.status.update','plan.risk-strategy.create','plan.risk-strategy.update','plan.risk-rules.update','plan.config.reset','plan.taxonomy.option.add','plan.taxonomy.option.remove','plan.hypothesis.create','plan.hypothesis.update','plan.emotion-taxonomy.add','plan.emotion-taxonomy.remove','plan.taxonomy.asset.create','plan.taxonomy.asset.update','plan.taxonomy.asset.delete','plan.visual-reference.create','plan.visual-reference.update','plan.visual-reference.delete','plan.checklist.create','plan.checklist.update','plan.checklist.delete','plan.checklist.reorder','plan.mistake-rule.create','plan.mistake-rule.update','plan.mistake-rule.delete','plan.mistake-rule.reorder','goal.create','goal.update','goal.delete','goal.status.update'])if(!stateRuntime.includes(label))fail.push(`Falta comando de configuración migrado ${label}.`);
if(!stateRuntime.includes('function trWrapDomainCommandGlobal('))fail.push('Falta wrapper genérico de comandos de configuración.');
if(!stateRuntime.includes('trInstallContractAsyncCascadeBoundary')||!stateRuntime.includes('deferredSync')||!stateRuntime.includes('await syncBase'))fail.push('Falta boundary de cascada asíncrona de contratos V31.16.1.');

for(const label of ['import.ankora.commit','import.ankora.delete','import.ninjatrader.market','import.ninjatrader.executions'])if(!stateRuntime.includes(label))fail.push(`Falta boundary transaccional ${label}.`);
if(!stateRuntime.includes('function trWithV314Staging(')||!stateRuntime.includes('function trV314ApplyChanges('))fail.push('Falta staging atómico de Market Data IndexedDB.');
if(!stateRuntime.includes('trImportRollbackFailures')||!stateRuntime.includes('trDomainRollbackMemory'))fail.push('Falta rollback/diagnóstico de imports.');
if(!stateRuntime.includes('if(trDomainCommandDepth)return mutator?.(state);'))fail.push('Los commits explícitos anidados no se coalescen en el command boundary.');
if(!stateRuntime.includes('if(persist)trDomainNormalizeAllPlanSchemas();'))fail.push('Imports durables no cierran el esquema dentro de su propio commit.');
if(!stateRuntime.includes("typeof v311EnsureDashboardProfiles==='function'?v311EnsureDashboardProfiles:null"))fail.push('La normalización durable no incluye perfiles de Dashboard.');

if(!stateRuntime.includes("navigate=function(view){return TRUIStore.navigate(view);}"))fail.push('Navegación no migrada a UIStore.');
if(!stateRuntime.includes("['v316SetTab','market.phase']"))fail.push('Market Data no está instrumentado por UIStore.');
if(!stateRuntime.includes("['setOpsUnit','operations.unit']"))fail.push('Operaciones no está instrumentado por UIStore.');
if(!index.includes('<script src="state-runtime.js"></script>'))fail.push('index.html no carga state-runtime.js.');
if(!index.includes('<script src="security-runtime.js"></script>'))fail.push('index.html no carga security-runtime.js.');
if(!index.includes('<script src="event-runtime.js"></script>'))fail.push('index.html no carga event-runtime.js.');
if(!eventRuntime.includes("const TR_EVENT_RUNTIME_VERSION='31.24.0'"))fail.push('Falta Event Runtime V31.24 estructurado.');
if(!eventRuntime.includes('document.addEventListener(t,trEventDispatch,false)'))fail.push('Falta delegación central de eventos.');
if(!eventRuntime.includes('function trActionResolve(name)')||!eventRuntime.includes('window.TradingResearchActions'))fail.push('Falta Action Registry V31.24.');
if(eventRuntime.includes('function trEventParser(')||eventRuntime.includes('function trEventTokenize(')||eventRuntime.includes('if(name in globalThis)'))fail.push('Event Runtime reabrió parser/tokenizer/fallback global.');
if(/new\s+Function\s*\(/.test(eventRuntime)||/\beval\s*\(/.test(eventRuntime))fail.push('Event Runtime usa ejecución dinámica incompatible con CSP.');
if(!securityRuntime.includes("const TR_SECURITY_RUNTIME_VERSION='31.18.0'"))fail.push('Falta Security Runtime V31.18.');
if(!securityRuntime.includes('function trSecurityProbeModalTitle(')||!securityRuntime.includes('function trSecurityProbeFormData('))fail.push('Faltan sondas de seguridad de render/FormData.');
if(/document\.getElementById\(['"]app['"]\)\.innerHTML\s*=\s*shell\(\)/.test(stateRuntime))fail.push('State Runtime contiene un render global.');
for(const [name,[start,end]] of Object.entries(baseline.regions)){const got=sha(chunk(start,end)),want=baseline.hashes[name];if(got!==want)fail.push(`REGRESIÓN FINANCIERA: ${name} cambió (${got} != ${want}).`);}
if(fail.length){console.error('\nStructural verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('Structural verification OK');
console.log(' - app.js: audited V31.25 source preserved byte-for-byte beneath exact terminal Plan-read + content-encoding contracts');
console.log(' - Core state: IndexedDB');
console.log(' - Render runtime: persistent shell + Partial DOM + draft recovery');
console.log(' - State runtime: Operations + Plan Configuration + Atomic Imports + schema closure + read-only render + DomainStore/UIStore');
console.log(' - Security runtime: modal-title text sink + safe handler tokens + FormData diagnostics');
console.log(' - Event runtime: structured action IDs + encoded JSON args + own-property Action Registry; no runtime parser/global fallback');
console.log(' - Direct state localStorage writes: 0');
console.log(` - Financial regions unchanged vs ${baseline.sourceVersion}: ${Object.keys(baseline.hashes).length}/${Object.keys(baseline.hashes).length}`);
