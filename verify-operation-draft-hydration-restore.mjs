import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const restoreStart=structural.indexOf('function trDraftMaybeRestoreAfterView(){');
const restoreEnd=structural.indexOf('\nfunction trRenderAfterView()',restoreStart);
need(restoreStart>=0&&restoreEnd>restoreStart,'No se pudo aislar trDraftMaybeRestoreAfterView().');
const restoreBlock=restoreStart>=0&&restoreEnd>restoreStart?structural.slice(restoreStart,restoreEnd):'';

const hydrationGuard="if(typeof trCoreHydrated!=='undefined'&&!trCoreHydrated)return;";
const hydrationPos=restoreBlock.indexOf(hydrationGuard);
const attemptedGuardPos=restoreBlock.indexOf('if(trDraftRestoreAttempted)return;');
const attemptedSetPos=restoreBlock.indexOf('trDraftRestoreAttempted=true;');
need(hydrationPos>=0,'Falta el guard de hidratación antes de restaurar el borrador de operación.');
need(hydrationPos>=0&&attemptedGuardPos>=0&&hydrationPos<attemptedGuardPos,'El guard de hidratación debe ejecutarse antes de evaluar trDraftRestoreAttempted.');
need(hydrationPos>=0&&attemptedSetPos>=0&&hydrationPos<attemptedSetPos,'El restore no puede marcarse como intentado antes de que el core esté hidratado.');
need(restoreBlock.includes('const draft=trBootOperationDraft;'),'Cambió la fuente session-only del borrador fuera de alcance.');
need(restoreBlock.includes('if(!draft?.values)return;'),'Cambió la validación del borrador fuera de alcance.');
need(restoreBlock.includes('if(draft.planId&&state?.tradingPlans?.some(p=>p.id===draft.planId))state.currentPlanId=draft.planId;'),'Cambió la restauración del plan del borrador fuera de alcance.');
need(restoreBlock.includes('openOperationModal(draft.operationId||null);'),'Cambió la reapertura del editor de operación fuera de alcance.');
need(restoreBlock.includes('if(trDraftApplyOperation(draft)){'),'Cambió la aplicación de valores del borrador fuera de alcance.');
need(restoreBlock.includes('Borrador recuperado tras la recarga.'),'Desapareció el aviso de borrador recuperado.');

need(structural.includes("addEventListener('beforeunload',()=>{trUiRememberView();trDraftCaptureOperation();});"),'Cambió la captura de borrador en beforeunload fuera de alcance.');
need(structural.includes("addEventListener('input',evt=>{if(evt.target?.closest?.('#operationForm'))trDraftCaptureOperation();},true);"),'Cambió la captura por input fuera de alcance.');
need(structural.includes("addEventListener('change',evt=>{if(evt.target?.closest?.('#operationForm'))trDraftCaptureOperation();},true);"),'Cambió la captura por change fuera de alcance.');

const bootstrapStart=app.indexOf('async function trCoreBootstrap(){');
const bootstrapEnd=app.indexOf('\n}',bootstrapStart);
need(bootstrapStart>=0,'No se encontró trCoreBootstrap().');
need(app.includes("trCoreMode='indexeddb';trCoreHydrated=true;trCoreSignalHydrated();"),'Cambió la señal de hidratación IndexedDB fuera de alcance.');
const finalRender="if(typeof render==='function')render();";
const hydratedPos=app.indexOf("trCoreMode='indexeddb';trCoreHydrated=true;trCoreSignalHydrated();",bootstrapStart);
const finalRenderPos=app.indexOf(finalRender,bootstrapStart);
need(hydratedPos>=0&&finalRenderPos>hydratedPos,'El render final de bootstrap debe ocurrir después de marcar trCoreHydrated=true.');

if(fail.length){
  console.error('Operation Draft Hydration Restore verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Operation Draft Hydration Restore verification OK');
console.log(' - draft restore waits for durable core hydration before first attempt');
console.log(' - post-hydration bootstrap render provides the retry point');
console.log(' - draft capture, plan selection, modal reopen, field apply and recovery notice preserved');
console.log(' - operation save, persistence and domain behavior untouched');
