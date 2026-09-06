import fs from 'node:fs';

const state=fs.readFileSync('state-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const uiStart=state.indexOf('function trUiSnapshot(){');
const uiEnd=state.indexOf('\nfunction trUiPublish(',uiStart);
need(uiStart>=0&&uiEnd>uiStart,'No se pudo aislar trUiSnapshot().');
const uiBlock=uiStart>=0&&uiEnd>uiStart?state.slice(uiStart,uiEnd):'';
const uiContractReads=(uiBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
need(uiContractReads===1,`Lecturas Current View Read Contract en trUiSnapshot(): ${uiContractReads} (esperado 1).`);
need(!uiBlock.includes("currentView:typeof currentView!=='undefined'?currentView:''"),'trUiSnapshot() conserva la lectura directa legacy de currentView.');
need(uiBlock.includes('currentView:globalThis.TradingResearchCurrentViewReadContract.current()'),'La instantánea UI no usa Current View Read Contract.');
need(uiBlock.includes("configTab:typeof configTab!=='undefined'?configTab:''"),'Cambió configTab en la instantánea UI fuera de alcance.');
need(uiBlock.includes('theme:globalThis.TradingResearchThemeReadContract.current()'),'Cambió theme en la instantánea UI fuera de alcance.');

const renderStart=state.indexOf('const trStateRenderBase=render;');
const renderEnd=state.indexOf('\nwindow.render=render;',renderStart);
need(renderStart>=0&&renderEnd>renderStart,'No se pudo aislar el wrapper render de State Runtime.');
const renderBlock=renderStart>=0&&renderEnd>renderStart?state.slice(renderStart,renderEnd):'';
const renderContractReads=(renderBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
need(renderContractReads===1,`Lecturas Current View Read Contract en el wrapper render: ${renderContractReads} (esperado 1).`);
need(!renderBlock.includes("${currentView||'view'} · writes revertidas"),'La etiqueta de side-effects conserva la lectura directa legacy de currentView.');
need(renderBlock.includes("${globalThis.TradingResearchCurrentViewReadContract.current()||'view'} · writes revertidas"),'La etiqueta de side-effects no usa Current View Read Contract.');
need(renderBlock.includes("trUiCapture(trUiActiveAction||'legacy.render.before')"),'Cambió la captura UI previa al render fuera de alcance.');
need(renderBlock.includes("trUiCapture(trUiActiveAction||'legacy.render.after')"),'Cambió la captura UI posterior al render fuera de alcance.');

need(state.includes("currentView='dashboard';"),'Cambió la escritura currentView de switchPlanAndOpen fuera de alcance.');
need(state.includes("globalThis.TradingResearchCurrentViewNavigationWriteContract.navigate(view);render();return true;"),'Cambió la frontera de escritura currentView de navegación fuera de alcance.');

if(fail.length){
  console.error('Current View State Runtime Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View State Runtime Read Boundary verification OK');
console.log(' - trUiSnapshot currentView read: 1 direct -> 1 read-contract');
console.log(' - render side-effect label currentView read: 1 direct -> 1 read-contract');
console.log(' - navigation write boundary and non-currentView snapshot/render behavior preserved');
await import('./verify-current-view-operation-draft-origin-read-boundary.mjs');
