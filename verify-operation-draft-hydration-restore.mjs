import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const restoreStart=structural.indexOf('function trDraftMaybeRestoreAfterView(){');
const restoreEnd=structural.indexOf('\n\nconst trOpenOperationModalBase=',restoreStart);
need(restoreStart>=0&&restoreEnd>restoreStart,'No se pudo aislar trDraftMaybeRestoreAfterView().');
const restoreBlock=restoreStart>=0&&restoreEnd>restoreStart?structural.slice(restoreStart,restoreEnd):'';

const hydrationGuard="if(typeof trCoreHydrated!=='undefined'&&!trCoreHydrated)return;";
const hydrationPos=restoreBlock.indexOf(hydrationGuard);
const attemptedGuardPos=restoreBlock.indexOf('if(trDraftRestoreAttempted)return;');
const attemptedSetPos=restoreBlock.indexOf('trDraftRestoreAttempted=true;');
need(hydrationPos>=0,'Falta el guard de hidratación antes de restaurar el borrador de operación.');
need(hydrationPos>=0&&attemptedGuardPos>=0&&hydrationPos<attemptedGuardPos,'El guard de hidratación debe ejecutarse antes de evaluar trDraftRestoreAttempted.');
need(hydrationPos>=0&&attemptedSetPos>=0&&hydrationPos<attemptedSetPos,'El restore no puede marcarse como intentado antes de que el core esté hidratado.');
need(restoreBlock.includes('const draft=trBootOperationDraft;if(!draft||draft.kind!==\'operation\')return;'),'Cambió la fuente/validación session-only del borrador fuera de alcance.');
need(restoreBlock.includes('if(draft.planId&&state?.tradingPlans?.some(p=>p.id===draft.planId)&&state.currentPlanId!==draft.planId)state.currentPlanId=draft.planId;'),'Cambió la selección del plan del borrador fuera de alcance.');
need(restoreBlock.includes("if(draft.operationId&&!state?.operations?.some(o=>o.id===draft.operationId)){trDraftClearOperation();trDraftLastError='El borrador apuntaba a una operación que ya no existe.';return;}"),'Cambió la protección de borrador de operación inexistente fuera de alcance.');
need(restoreBlock.includes('openOperationModal(draft.operationId||null);'),'Cambió la reapertura del editor de operación fuera de alcance.');
need(restoreBlock.includes("setTimeout(()=>{if(!trDraftApplyOperation(draft)){trDraftLastError='No se pudo reconstruir el editor del borrador.';}},25);"),'Cambió la aplicación post-modal del borrador fuera de alcance.');
need(restoreBlock.includes("console.error('[Trading Research · draft restore]',e)"),'Cambió el diagnóstico de error del restore fuera de alcance.');

need(structural.includes("document.addEventListener('input',e=>{if(e.target?.closest?.('#operationForm'))trDraftCaptureOperation();},true);"),'Cambió la captura por input fuera de alcance.');
need(structural.includes("document.addEventListener('change',e=>{if(e.target?.closest?.('#operationForm'))trDraftCaptureOperation();},true);"),'Cambió la captura por change fuera de alcance.');
need(structural.includes("window.addEventListener('beforeunload',()=>{trUiRememberView();trDraftCaptureOperation();});"),'Cambió la captura de borrador en beforeunload fuera de alcance.');
need(structural.includes('notice.innerHTML=`<strong>Borrador recuperado tras la recarga.</strong>'),'Desapareció el aviso de borrador recuperado.');

const actionRegistry="globalThis.TradingResearchActions&&typeof globalThis.TradingResearchActions==='object'";
const openWindow="window.openOperationModal=openOperationModal;";
const openRegistry=`if(${actionRegistry})globalThis.TradingResearchActions.openOperationModal=openOperationModal;`;
const closeWindow="window.closeModal=closeModal;";
const closeRegistry=`if(${actionRegistry})globalThis.TradingResearchActions.closeModal=closeModal;`;
const saveWindow="window.saveOperationFromForm=saveOperationFromForm;";
const saveRegistry=`if(${actionRegistry})globalThis.TradingResearchActions.saveOperationFromForm=saveOperationFromForm;`;
for(const [windowAnchor,registryAnchor,label] of [
  [openWindow,openRegistry,'openOperationModal'],
  [closeWindow,closeRegistry,'closeModal'],
  [saveWindow,saveRegistry,'saveOperationFromForm']
]){
  const windowPos=structural.indexOf(windowAnchor),registryPos=structural.indexOf(registryAnchor);
  need(windowPos>=0,`Desapareció el wrapper window de ${label}.`);
  need(registryPos>=0,`El wrapper de borrador ${label} no se republica en TradingResearchActions.`);
  need(windowPos>=0&&registryPos>windowPos,`La republicación de ${label} debe ocurrir después de instalar el wrapper.`);
}

const bootstrapStart=app.indexOf('async function trCoreBootstrap(){');
need(bootstrapStart>=0,'No se encontró trCoreBootstrap().');
const hydratedLiteral="trCoreMode='indexeddb';trCoreHydrated=true;trCoreSignalHydrated();";
const finalRender="if(typeof render==='function')render();";
const hydratedPos=app.indexOf(hydratedLiteral,bootstrapStart);
const finalRenderPos=app.indexOf(finalRender,bootstrapStart);
need(hydratedPos>=0,'Cambió la señal de hidratación IndexedDB fuera de alcance.');
need(hydratedPos>=0&&finalRenderPos>hydratedPos,'El render final de bootstrap debe ocurrir después de marcar trCoreHydrated=true.');
need(app.includes("trCoreMode='localStorage-fallback';trCoreHydrated=true;trCoreSignalHydrated();"),'El fallback durable dejó de marcar hidratación antes del render final.');

if(fail.length){
  console.error('Operation Draft Hydration Restore verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Operation Draft Hydration Restore verification OK');
console.log(' - draft restore waits for core hydration before consuming its one-shot attempt');
console.log(' - draft modal open/close/save wrappers remain effective through TradingResearchActions');
console.log(' - post-hydration bootstrap render provides the retry point');
console.log(' - session capture, plan selection, modal reopen, field apply and recovery notice preserved');
console.log(' - operation save, persistence and domain behavior untouched');
await import('./verify-diagnostics-current-view-read-closure.mjs');
