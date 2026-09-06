import fs from 'node:fs';

const structural=fs.readFileSync('structural-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const renderStart=structural.indexOf('render=function(){');
const renderEnd=structural.indexOf('\n};\nwindow.render=render;',renderStart);
need(renderStart>=0&&renderEnd>renderStart,'No se pudo aislar el coordinador central render().');
const renderBlock=renderStart>=0&&renderEnd>renderStart?structural.slice(renderStart,renderEnd+3):'';
const contractReads=(renderBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
const directReads=(renderBlock.match(/\bcurrentView\b/g)||[]).length;
need(contractReads===9,`Lecturas Current View Read Contract en render(): ${contractReads} (esperado 9).`);
need(directReads===0,`Referencias directas legacy currentView en render(): ${directReads} (esperado 0).`);

need(renderBlock.includes("const previous=view.dataset.trView||trRenderLastView||'',sameView=previous===globalThis.TradingResearchCurrentViewReadContract.current();"),'El cálculo sameView no usa el read-contract.');
need(renderBlock.includes("if(sameView&&globalThis.TradingResearchCurrentViewReadContract.current()==='operations'&&trPartialRenderOperations()){trRenderLastView=globalThis.TradingResearchCurrentViewReadContract.current();trRenderLastError='';return;}"),'Cambió o no quedó contract-bound la ruta parcial de Operaciones.');
need(renderBlock.includes("if(sameView&&globalThis.TradingResearchCurrentViewReadContract.current()==='market'&&trPartialRenderMarket()){trRenderLastView=globalThis.TradingResearchCurrentViewReadContract.current();trRenderLastError='';return;}"),'Cambió o no quedó contract-bound la ruta parcial de Market Data.');
need(renderBlock.includes('view.innerHTML=trRenderViewHtml(globalThis.TradingResearchCurrentViewReadContract.current());view.dataset.trView=globalThis.TradingResearchCurrentViewReadContract.current();'),'Cambió o no quedó contract-bound la composición principal de vista.');
need(renderBlock.includes('trRenderViewRenders++;trRenderLastView=globalThis.TradingResearchCurrentViewReadContract.current();trRenderLastAt=new Date().toISOString();trRenderLastError=\'\';'),'Cambió o no quedó contract-bound el lastView del render completo.');
need(renderBlock.includes('globalThis.TradingResearchContentEncodingContract.html(globalThis.TradingResearchCurrentViewReadContract.current())'),'El mensaje de error del render no usa el read-contract.');
need(renderBlock.includes('trRenderSyncSidebar();trUiRememberView();'),'Cambió la sincronización sidebar/session fuera de alcance.');
need(renderBlock.includes('const continuity=sameView?trRenderCaptureInputContinuity(view):null;'),'Cambió la continuidad de inputs fuera de alcance.');
need(renderBlock.includes('trPartialPrepareCurrentView(view);'),'Cambió la preparación parcial fuera de alcance.');
need(renderBlock.includes('if(continuity)trRenderRestoreInputContinuity(continuity,view);'),'Cambió la restauración de continuidad fuera de alcance.');
need(renderBlock.includes('trRenderAfterView();'),'Cambió el post-render fuera de alcance.');
need(!/const\s+(?:activeView|viewName|renderView)\s*=\s*globalThis\.TradingResearchCurrentViewReadContract\.current\(\)/.test(renderBlock),'No se permite snapshot local de currentView en el coordinador: deben preservarse las 9 lecturas temporales.');

need(structural.includes("if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))currentView=ui.currentView;"),'Cambió la escritura de restauración de currentView en boot fuera de alcance.');
need(structural.includes("currentView='dashboard';"),'Cambió la escritura fallback del router fuera de alcance.');
need(stateRuntime.includes("currentView='dashboard';"),'Cambió switchPlanAndOpen/currentView fuera de alcance.');
need(stateRuntime.includes('currentView=view;render();return true;'),'Cambió trUiNavigate/currentView fuera de alcance.');

if(fail.length){
  console.error('Current View Central Render Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Central Render Read Boundary verification OK');
console.log(' - central render(): 9 direct -> 9 read-contract');
console.log(' - repeated read timing preserved; no local currentView snapshot introduced');
console.log(' - partial/full render, continuity and error paths preserved');
console.log(' - boot/router/navigation currentView writes preserved');
await import('./verify-current-view-navigation-write-boundary.mjs');
