import fs from 'node:fs';
import {consolidateLegacyRenderAssignments} from './render-source-transform.mjs';

const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const WRITE_CONTRACT='TradingResearchCurrentViewNavigationWriteContract';
const bundledAppStage=consolidateLegacyRenderAssignments(app,{expected:12}).source;

const navStart=stateRuntime.indexOf('function trUiNavigate(view){');
const navEnd=stateRuntime.indexOf('\nfunction trUiSetConfigTab(',navStart);
need(navStart>=0&&navEnd>navStart,'No se pudo aislar trUiNavigate().');
const navBlock=navStart>=0&&navEnd>navStart?stateRuntime.slice(navStart,navEnd):'';
const navContractWrites=(navBlock.match(/TradingResearchCurrentViewNavigationWriteContract\.navigate\(view\)/g)||[]).length;
need(navContractWrites===1,`Escrituras Navigation Write Contract en trUiNavigate(): ${navContractWrites} (esperado 1).`);
need(!navBlock.includes('currentView=view;'),'trUiNavigate() conserva la escritura directa legacy currentView=view.');
need(navBlock.includes("return trUiAction('navigation.navigate',()=>{globalThis.TradingResearchCurrentViewNavigationWriteContract.navigate(view);render();return true;});"),'trUiNavigate() no conserva action/render/return alrededor del contrato de navegación.');
need(navBlock.includes("if(typeof TR_VALID_VIEWS!=='undefined'&&!TR_VALID_VIEWS.has(view))return false;"),'Cambió la validación de vista en trUiNavigate() fuera de alcance.');

need(bundledAppStage.includes(`Object.defineProperty(globalThis,'${WRITE_CONTRACT}'`),'El build transform no publica Navigation Current View Write Contract.');
need(bundledAppStage.includes('navigate:view=>{currentView=view;}'),'Navigation Current View Write Contract no conserva la asignación exacta currentView=view.');
need((stateRuntime.match(/TradingResearchCurrentViewNavigationWriteContract/g)||[]).length===1,'Navigation Current View Write Contract debe tener un único consumidor runtime en Batch 47.');
need(!structural.includes(WRITE_CONTRACT),'Batch 47 no debe usar Navigation Write Contract desde Structural Runtime.');

need(bundledAppStage.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewReadContract'"),'Desapareció Current View Read Contract.');
need(bundledAppStage.includes('current:()=>currentView'),'Current View Read Contract dejó de ser lectura tardía.');
need(!/TradingResearchCurrentViewReadContract[\s\S]{0,180}\b(?:set|navigate)\s*:/.test(bundledAppStage),'Current View Read Contract debe seguir siendo estrictamente read-only.');
need(structural.includes("if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))currentView=ui.currentView;"),'Cambió boot restore currentView fuera de alcance.');
need(structural.includes("currentView='dashboard';"),'Cambió router fallback currentView fuera de alcance.');
need(stateRuntime.includes("currentView='dashboard';"),'Cambió switchPlanAndOpen currentView fuera de alcance.');

if(fail.length){
  console.error('Current View Navigation Write Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Navigation Write Boundary verification OK');
console.log(' - trUiNavigate: 1 direct write -> 1 navigation write-contract');
console.log(' - validation, UI action, render and return semantics preserved');
console.log(' - read contract remains read-only');
console.log(' - boot restore, router fallback and plan-switch-open writes preserved');
