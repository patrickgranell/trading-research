import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const WRITE_CONTRACT='TradingResearchCurrentViewRouterFallbackWriteContract';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;

const routerStart=structural.indexOf('function trRenderViewHtml(');
const routerEnd=structural.indexOf('\n}\n\nfunction trRenderEditable',routerStart);
need(routerStart>=0&&routerEnd>routerStart,'No se pudo aislar trRenderViewHtml().');
const routerBlock=routerStart>=0&&routerEnd>routerStart?structural.slice(routerStart,routerEnd+2):'';
const fallbackContractWrites=(routerBlock.match(/TradingResearchCurrentViewRouterFallbackWriteContract\.toDashboard\(\)/g)||[]).length;
need(fallbackContractWrites===1,`Escrituras Router Fallback Write Contract en trRenderViewHtml(): ${fallbackContractWrites} (esperado 1).`);
need(!routerBlock.includes("currentView='dashboard';"),'trRenderViewHtml() conserva la escritura directa legacy currentView=dashboard.');
need(routerBlock.includes("console.warn('[Trading Research · router] Vista desconocida:',view);"),'Cambió el warning de vista desconocida fuera de alcance.');
need(routerBlock.includes('globalThis.TradingResearchDashboardViewPresentationContract.render()'),'Cambió el render de Dashboard del fallback fuera de alcance.');
need(routerBlock.includes("default:"),'Desapareció la rama default del router.');

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${WRITE_CONTRACT}'`),'El build transform no publica Router Fallback Current View Write Contract.');
need(bundledAppStage.includes("toDashboard:()=>{currentView='dashboard';}"),'Router Fallback Current View Write Contract no conserva la asignación fija a dashboard.');
need((structural.match(/TradingResearchCurrentViewRouterFallbackWriteContract/g)||[]).length===1,'Router Fallback Write Contract debe tener un único consumidor runtime en Batch 49.');
need(!stateRuntime.includes(WRITE_CONTRACT),'Batch 49 no debe usar Router Fallback Write Contract desde State Runtime.');

need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewReadContract'"),'Desapareció Current View Read Contract.');
need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewNavigationWriteContract'"),'Desapareció Navigation Current View Write Contract.');
need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewSessionRestoreWriteContract'"),'Desapareció Session Restore Current View Write Contract.');
need(structural.includes("globalThis.TradingResearchCurrentViewSessionRestoreWriteContract.restore(ui.currentView)"),'Cambió boot/session restore fuera de alcance.');
need(stateRuntime.includes("currentView='dashboard';"),'Cambió switchPlanAndOpen currentView fuera de alcance.');
need(stateRuntime.includes('globalThis.TradingResearchCurrentViewNavigationWriteContract.navigate(view);render();return true;'),'Cambió navegación explícita fuera de alcance.');

if(fail.length){
  console.error('Current View Router Fallback Write Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Router Fallback Write Boundary verification OK');
console.log(' - unknown-view fallback: 1 direct write -> 1 router-fallback write-contract');
console.log(' - warning + Dashboard render preserved');
console.log(' - read/navigation/session-restore contracts preserved');
console.log(' - plan-switch-open write preserved direct and out of scope');
