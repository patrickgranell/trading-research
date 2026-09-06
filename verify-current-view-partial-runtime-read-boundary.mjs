import fs from 'node:fs';

const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const prepareStart=structural.indexOf("function trPartialPrepareCurrentView(view=document.getElementById('view')){");
const prepareEnd=structural.indexOf('\n}\n\n/* Count the partial analytics path',prepareStart);
need(prepareStart>=0&&prepareEnd>prepareStart,'No se pudo aislar trPartialPrepareCurrentView().');
const prepareBlock=prepareStart>=0&&prepareEnd>prepareStart?structural.slice(prepareStart,prepareEnd+2):'';
const prepareContractReads=(prepareBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
need(prepareContractReads===2,`Lecturas Current View Read Contract en trPartialPrepareCurrentView(): ${prepareContractReads} (esperado 2).`);
need(!prepareBlock.includes("currentView==='operations'"),'trPartialPrepareCurrentView() conserva lectura directa legacy para operations.');
need(!prepareBlock.includes("currentView==='market'"),'trPartialPrepareCurrentView() conserva lectura directa legacy para market.');
need(prepareBlock.includes("globalThis.TradingResearchCurrentViewReadContract.current()==='operations'"),'Falta read-contract para routing parcial de operations.');
need(prepareBlock.includes("globalThis.TradingResearchCurrentViewReadContract.current()==='market'"),'Falta read-contract para routing parcial de market.');
need(prepareBlock.includes('trPartialPrepareOperations(view)'),'Cambió el dispatch de preparación de Operaciones fuera de alcance.');
need(prepareBlock.includes('trPartialPrepareMarket(view)'),'Cambió el dispatch de preparación de Market Data fuera de alcance.');

const analyticsMarker='trOpsAnalyticsRefreshContract.replace(function(read=true)';
const analyticsStart=structural.indexOf(analyticsMarker);
const analyticsEnd=structural.indexOf('\n\n/* Cursor movement must never replace',analyticsStart);
need(analyticsStart>=0&&analyticsEnd>analyticsStart,'No se pudo aislar el wrapper de analytics de Operaciones.');
const analyticsBlock=analyticsStart>=0&&analyticsEnd>analyticsStart?structural.slice(analyticsStart,analyticsEnd):'';
const analyticsContractReads=(analyticsBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
need(analyticsContractReads===1,`Lecturas Current View Read Contract en wrapper analytics: ${analyticsContractReads} (esperado 1).`);
need(!analyticsBlock.includes("if(currentView==='operations'&&before)"),'El wrapper analytics conserva lectura directa legacy de currentView.');
need(analyticsBlock.includes("if(globalThis.TradingResearchCurrentViewReadContract.current()==='operations'&&before)"),'El wrapper analytics no usa Current View Read Contract.');
need(analyticsBlock.includes('const out=trRefreshOpsAnalyticsBase(read);'),'Cambió la llamada analytics base fuera de alcance.');
need(analyticsBlock.includes("trPartialRecord('operations.analytics')"),'Cambió el contador parcial de analytics fuera de alcance.');

need(structural.includes("const series=v315RunningUi.series;if(!series?.points?.length||globalThis.TradingResearchCurrentViewReadContract.current()!=='market'||globalThis.TradingResearchMarketUiStateReadContract.tab()!=='running')return trV315SetCursorBase(v);"),'Cambió v315SetCursor/currentView o el guard Market UI fuera de alcance.');
need(structural.includes('/* Final runtime coordinator. This is the only render() used after bootstrap completes. */'),'Cambió el coordinador central render fuera de alcance.');
need(structural.includes("if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))globalThis.TradingResearchCurrentViewSessionRestoreWriteContract.restore(ui.currentView);"),'Cambió la restauración de currentView en boot fuera de alcance.');

if(fail.length){
  console.error('Current View Partial Runtime Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Partial Runtime Read Boundary verification OK');
console.log(' - trPartialPrepareCurrentView: 2 direct -> 2 read-contract');
console.log(' - Operations analytics wrapper: 1 direct -> 1 read-contract');
console.log(' - cursor, Market UI tab guard, central render anchor and currentView writes preserved');
await import('./verify-current-view-market-cursor-read-boundary.mjs');
