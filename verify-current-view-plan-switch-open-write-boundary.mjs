import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const WRITE_CONTRACT='TradingResearchCurrentViewPlanSwitchOpenWriteContract';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;

const switchStart=stateRuntime.indexOf('switchPlanAndOpen=function(id){');
const switchEnd=stateRuntime.indexOf('\n  window.switchPlanAndOpen=switchPlanAndOpen;',switchStart);
need(switchStart>=0&&switchEnd>switchStart,'No se pudo aislar switchPlanAndOpen().');
const switchBlock=switchStart>=0&&switchEnd>switchStart?stateRuntime.slice(switchStart,switchEnd):'';
const contractWrites=(switchBlock.match(/TradingResearchCurrentViewPlanSwitchOpenWriteContract\.toDashboard\(\)/g)||[]).length;
need(contractWrites===1,`Escrituras Plan Switch Open Write Contract en switchPlanAndOpen(): ${contractWrites} (esperado 1).`);
need(!switchBlock.includes("currentView='dashboard';"),'switchPlanAndOpen() conserva la escritura directa legacy currentView=dashboard.');
need(switchBlock.includes('globalThis.TradingResearchCurrentViewPlanSwitchOpenWriteContract.toDashboard();'),'switchPlanAndOpen() no usa Plan Switch Open Write Contract para Dashboard.');
need(switchBlock.includes("if(!globalThis.TradingResearchPlanReadContract.byId(id))return;"),'Cambió la validación de plan en switchPlanAndOpen() fuera de alcance.');
need(switchBlock.includes("return TRDomainStore.commit('plan.switch-open',()=>{"),'Cambió la transacción plan.switch-open fuera de alcance.');
need(switchBlock.includes('state.currentPlanId=id;'),'Cambió la selección durable del plan fuera de alcance.');
need(switchBlock.includes('trDomainNormalizePlanSchema(globalThis.TradingResearchPlanReadContract.byId(id));'),'Cambió la normalización del plan fuera de alcance.');
need(switchBlock.includes("if(typeof v30EnsureBaselineLocal==='function')v30EnsureBaselineLocal();"),'Cambió ensureBaseline fuera de alcance.');
need(switchBlock.includes('},{persist:true,render:true});'),'Cambió persist/render de plan.switch-open fuera de alcance.');

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${WRITE_CONTRACT}'`),'El build transform no publica Plan Switch Open Current View Write Contract.');
need(bundledAppStage.includes("toDashboard:()=>{currentView='dashboard';}"),'Plan Switch Open Current View Write Contract no conserva la asignación fija a dashboard.');
need((stateRuntime.match(/TradingResearchCurrentViewPlanSwitchOpenWriteContract/g)||[]).length===1,'Plan Switch Open Write Contract debe tener un único consumidor runtime en Batch 50.');
need(!structural.includes(WRITE_CONTRACT),'Batch 50 no debe usar Plan Switch Open Write Contract desde Structural Runtime.');

need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewReadContract'"),'Desapareció Current View Read Contract.');
need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewNavigationWriteContract'"),'Desapareció Navigation Current View Write Contract.');
need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewSessionRestoreWriteContract'"),'Desapareció Session Restore Current View Write Contract.');
need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewRouterFallbackWriteContract'"),'Desapareció Router Fallback Current View Write Contract.');
need(structural.includes('globalThis.TradingResearchCurrentViewRouterFallbackWriteContract.toDashboard();'),'Cambió router fallback fuera de alcance.');
need(structural.includes('globalThis.TradingResearchCurrentViewSessionRestoreWriteContract.restore(ui.currentView)'),'Cambió session restore fuera de alcance.');
need(stateRuntime.includes('globalThis.TradingResearchCurrentViewNavigationWriteContract.navigate(view);render();return true;'),'Cambió navegación explícita fuera de alcance.');

if(fail.length){
  console.error('Current View Plan Switch Open Write Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Plan Switch Open Write Boundary verification OK');
console.log(' - switchPlanAndOpen: 1 direct write -> 1 plan-switch-open write-contract');
console.log(' - plan validation, durable selection, normalization, persist and render preserved');
console.log(' - read/navigation/session-restore/router-fallback contracts preserved');
console.log(' - direct currentView runtime frontier closed');
