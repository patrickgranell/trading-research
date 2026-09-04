import fs from 'node:fs';
import {transformStateActions,stateActionInventory} from './state-action-transform.mjs';

const state=fs.readFileSync('state-runtime.js','utf8');
const events=fs.readFileSync('event-runtime.js','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};
let transformed=null;
try{transformed=transformStateActions(state);}catch(e){fail.push(e?.message||String(e));}
const inv=transformed?.inventory||stateActionInventory('');

need(!state.includes('V31.23.6 STATE ACTION BRIDGE'),'state-runtime.js fuente fue modificado físicamente; esta subfase debe mantener el source legacy intacto.');
need(inv.bridge===true,'El transform no inyecta el State Action Bridge.');
need(inv.crossRuntimeWindowReads===0,`Quedan ${inv.crossRuntimeWindowReads} lecturas window directas cross-runtime tras el transform.`);
need(inv.resolveCalls>=14,`Solo hay ${inv.resolveCalls} resoluciones registry-aware; la migración parece incompleta.`);
need(inv.publishCalls>=19,`Solo hay ${inv.publishCalls} publicaciones registry-aware; la migración parece incompleta.`);
need(transformed?.source.includes("const trStateActionRegistry=(window.TradingResearchActions"),'State Runtime transformado no reutiliza TradingResearchActions.');
need(transformed?.source.includes("const trStateActionResolve=(name)=>"),'Falta resolver registry-first.');
need(transformed?.source.includes("const trStateActionPublish=(name,value)=>"),'Falta publicación dual registry + window durante transición.');
need(transformed?.source.includes("actionBridge:trStateActionDiagnostics()"),'TradingResearchStores no expone diagnóstico del bridge.');
need(transformed?.source.includes("actions:trStateActionRegistry"),'TradingResearchStores no expone el registro compartido.');
for(const name of ['saveOperationFromForm','openOperationModal','editOperation','saveInstrument','confirmImportPreview','deleteImportBatch','v314ImportMarketFile','v314ImportExecFile','v319SyncExecutionSetsToOperations']){
  need(transformed?.source.includes(`trStateActionResolve('${name}')`),`Falta resolución registry-aware de ${name}.`);
}
for(const name of ['navigate','setConfigTab','saveOperationFromForm','openOperationModal','editOperation','confirmImportPreview','deleteImportBatch','v314ImportMarketFile','v314ImportExecFile']){
  need(transformed?.source.includes(`trStateActionPublish('${name}'`),`Falta publicación registry-aware de ${name}.`);
}
need(transformed?.source.includes("trAssignDomainWrappedGlobal('saveInstrument',commandAware);"),'saveInstrument no vuelve a publicarse mediante el helper registry-aware.');
const resetParityBase="const trOperationsResetParityBase=resetOpsFilters;";
const resetParityWrapper="resetOpsFilters=function(...args){opsViewState.riskPolicy='raw';return trOperationsResetParityBase.apply(this,args);};";
const resetWrapAnchor="['resetOpsFilters','operations.reset']";
const resetParityIndex=transformed?.source.indexOf(resetParityBase)??-1;
const resetWrapIndex=transformed?.source.indexOf(resetWrapAnchor)??-1;
need(resetParityIndex>=0&&transformed?.source.includes(resetParityWrapper),'Operations reset no restaura Gestión de riesgo a raw antes del reset legacy.');
need(resetWrapIndex>=0&&resetParityIndex>=0&&resetParityIndex<resetWrapIndex,'Operations reset parity no se aplica antes de envolver resetOpsFilters en el Action Registry.');
need(events.includes("const trActionRegistry=(window.TradingResearchActions"),'Event Runtime no reutiliza el mismo TradingResearchActions.');
need(events.includes("Object.prototype.hasOwnProperty.call(trActionRegistry,name)"),'Event Runtime no resuelve registry-first.');
need(build.includes("transformStateActions(stateSource)"),'build.mjs no aplica el State Action Bridge.');
need(build.includes("dist/state-action-inventory.json"),'build.mjs no publica inventario del State Action Bridge.');

if(fail.length){console.error('\nState Action Bridge verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('State Action Bridge verification OK');
console.log(` - Registry-aware resolves in bundled State Runtime: ${inv.resolveCalls}`);
console.log(` - Registry-aware publishes in bundled State Runtime: ${inv.publishCalls}`);
console.log(` - Direct cross-runtime window reads after transform: ${inv.crossRuntimeWindowReads}`);
console.log(` - State action inventory: ${inv.targetActions}`);
console.log(' - Resolution order: TradingResearchActions -> legacy window fallback');
console.log(' - Publication during transition: TradingResearchActions + window mirror');
console.log(' - Operations reset parity: riskPolicy -> raw before registry wrapping');
