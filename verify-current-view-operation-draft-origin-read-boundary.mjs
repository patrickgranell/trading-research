import fs from 'node:fs';

const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const captureStart=structural.indexOf('function trDraftCaptureOperation(){');
const captureEnd=structural.indexOf('\nfunction trDraftClearOperation()',captureStart);
need(captureStart>=0&&captureEnd>captureStart,'No se pudo aislar trDraftCaptureOperation().');
const captureBlock=captureStart>=0&&captureEnd>captureStart?structural.slice(captureStart,captureEnd):'';
const captureContractReads=(captureBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
need(captureContractReads===1,`Lecturas Current View Read Contract en trDraftCaptureOperation(): ${captureContractReads} (esperado 1).`);
need(!captureBlock.includes('originView:trOperationDraftContext.originView||currentView'),'trDraftCaptureOperation() conserva la lectura directa legacy de currentView.');
need(captureBlock.includes('originView:trOperationDraftContext.originView||globalThis.TradingResearchCurrentViewReadContract.current()'),'El borrador de operación no usa Current View Read Contract para originView.');
need(captureBlock.includes('operationId:trOperationDraftContext.operationId??null'),'Cambió operationId del borrador fuera de alcance.');
need(captureBlock.includes('planId:trOperationDraftContext.planId||state.currentPlanId||null'),'Cambió planId del borrador fuera de alcance.');
need(captureBlock.includes('return trSessionSet(TR_OPERATION_DRAFT_KEY,draft);'),'Cambió la persistencia de sesión del borrador fuera de alcance.');

const modalStart=structural.indexOf('openOperationModal=function(id=null){');
const modalEnd=structural.indexOf('\nwindow.openOperationModal=openOperationModal;',modalStart);
need(modalStart>=0&&modalEnd>modalStart,'No se pudo aislar el wrapper openOperationModal().');
const modalBlock=modalStart>=0&&modalEnd>modalStart?structural.slice(modalStart,modalEnd):'';
const modalContractReads=(modalBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
need(modalContractReads===1,`Lecturas Current View Read Contract en openOperationModal(): ${modalContractReads} (esperado 1).`);
need(!modalBlock.includes('originView:currentView'),'openOperationModal() conserva la lectura directa legacy de currentView.');
need(modalBlock.includes('originView:globalThis.TradingResearchCurrentViewReadContract.current()'),'El contexto del editor no usa Current View Read Contract para originView.');
need(modalBlock.includes('const result=trOpenOperationModalBase(id);'),'Cambió la llamada al modal base fuera de alcance.');
need(modalBlock.includes("document.getElementById('operationForm')"),'Cambió el guard del formulario de operación fuera de alcance.');
need(modalBlock.includes('planId:state.currentPlanId||null'),'Cambió el planId del contexto del editor fuera de alcance.');

need(structural.includes('if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))currentView=ui.currentView;'),'Cambió la restauración de currentView en boot fuera de alcance.');
need(structural.includes("currentView='dashboard';"),'Cambió el fallback de router currentView fuera de alcance.');
need(structural.includes("if(!view)return;if(currentView==='operations')trPartialPrepareOperations(view);else if(currentView==='market')trPartialPrepareMarket(view);"),'Cambió el routing de preparación parcial fuera de alcance.');
need(structural.includes("const previous=view.dataset.trView||trRenderLastView||'',sameView=previous===currentView;"),'Cambió el coordinador central de render fuera de alcance.');

if(fail.length){
  console.error('Current View Operation Draft Origin Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Operation Draft Origin Read Boundary verification OK');
console.log(' - draft capture originView: 1 direct -> 1 read-contract');
console.log(' - operation modal context originView: 1 direct -> 1 read-contract');
console.log(' - draft persistence, navigation writes and partial/render routing preserved');
await import('./verify-current-view-partial-runtime-read-boundary.mjs');
