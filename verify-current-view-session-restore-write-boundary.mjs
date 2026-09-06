import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const WRITE_CONTRACT='TradingResearchCurrentViewSessionRestoreWriteContract';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;

const restoreStart=structural.indexOf('function trUiRestoreViewAtBoot(){');
const restoreEnd=structural.indexOf('\nfunction trUiRememberView()',restoreStart);
need(restoreStart>=0&&restoreEnd>restoreStart,'No se pudo aislar trUiRestoreViewAtBoot().');
const restoreBlock=restoreStart>=0&&restoreEnd>restoreStart?structural.slice(restoreStart,restoreEnd):'';
const restoreContractWrites=(restoreBlock.match(/TradingResearchCurrentViewSessionRestoreWriteContract\.restore\(ui\.currentView\)/g)||[]).length;
need(restoreContractWrites===1,`Escrituras Session Restore Write Contract en trUiRestoreViewAtBoot(): ${restoreContractWrites} (esperado 1).`);
need(!restoreBlock.includes('currentView=ui.currentView;'),'trUiRestoreViewAtBoot() conserva la escritura directa legacy currentView=ui.currentView.');
need(restoreBlock.includes("const ui=trSessionGet(TR_UI_SESSION_KEY);"),'Cambió la lectura de sesión en boot fuera de alcance.');
need(restoreBlock.includes("if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))globalThis.TradingResearchCurrentViewSessionRestoreWriteContract.restore(ui.currentView);"),'Boot restore no conserva validación + write-contract exactos.');

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${WRITE_CONTRACT}'`),'El build transform no publica Session Restore Current View Write Contract.');
need(bundledAppStage.includes('restore:view=>{currentView=view;}'),'Session Restore Current View Write Contract no conserva la asignación exacta currentView=view.');
need((structural.match(/TradingResearchCurrentViewSessionRestoreWriteContract/g)||[]).length===1,'Session Restore Write Contract debe tener un único consumidor runtime en Batch 48.');
need(!stateRuntime.includes(WRITE_CONTRACT),'Batch 48 no debe usar Session Restore Write Contract desde State Runtime.');

need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewReadContract'"),'Desapareció Current View Read Contract.');
need(bundledAppStage.includes('current:()=>currentView'),'Current View Read Contract dejó de ser lectura tardía.');
need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewNavigationWriteContract'"),'Desapareció Navigation Current View Write Contract.');
need(bundledAppStage.includes('navigate:view=>{currentView=view;}'),'Navigation Current View Write Contract cambió fuera de alcance.');
need(structural.includes("currentView='dashboard';"),'Cambió router fallback currentView fuera de alcance.');
need(stateRuntime.includes("currentView='dashboard';"),'Cambió switchPlanAndOpen currentView fuera de alcance.');
need(stateRuntime.includes('globalThis.TradingResearchCurrentViewNavigationWriteContract.navigate(view);render();return true;'),'Cambió navegación explícita fuera de alcance.');

if(fail.length){
  console.error('Current View Session Restore Write Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Session Restore Write Boundary verification OK');
console.log(' - boot session restore: 1 direct write -> 1 session-restore write-contract');
console.log(' - session read + valid-view guard preserved');
console.log(' - read/navigation contracts preserved');
console.log(' - router fallback and plan-switch-open writes preserved');
