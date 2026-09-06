import fs from 'node:fs';

const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const cursorStart=structural.indexOf('v315SetCursor=function(v){');
const cursorEnd=structural.indexOf('\n};\nwindow.v315SetCursor=v315SetCursor;',cursorStart);
need(cursorStart>=0&&cursorEnd>cursorStart,'No se pudo aislar v315SetCursor().');
const cursorBlock=cursorStart>=0&&cursorEnd>cursorStart?structural.slice(cursorStart,cursorEnd+3):'';
const contractReads=(cursorBlock.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
need(contractReads===1,`Lecturas Current View Read Contract en v315SetCursor(): ${contractReads} (esperado 1).`);
need(!cursorBlock.includes("currentView!=='market'"),'v315SetCursor() conserva lectura directa legacy de currentView.');
need(cursorBlock.includes("globalThis.TradingResearchCurrentViewReadContract.current()!=='market'"),'v315SetCursor() no usa Current View Read Contract para el guard de Market Data.');
need(cursorBlock.includes('const series=v315RunningUi.series;'),'Cambió la fuente de series Running P&L fuera de alcance.');
need(cursorBlock.includes("v316Ui?.tab!=='running'"),'Cambió el guard de pestaña Running fuera de alcance.');
need(cursorBlock.includes('return trV315SetCursorBase(v);'),'Cambió el fallback al cursor base fuera de alcance.');
need(cursorBlock.includes('v315RunningUi.cursor=Math.max(0,Math.min(Number(v)||0,series.points.length-1));'),'Cambió el clamp del cursor fuera de alcance.');
need(cursorBlock.includes("document.getElementById('tr-market-body-region')"),'Cambió la región DOM de Market Data fuera de alcance.');
need(cursorBlock.includes('globalThis.TradingResearchRunningChartPresentationContract.render(result,series)'),'Cambió el render del Running Chart fuera de alcance.');
need(cursorBlock.includes("panel.querySelector('.rp-inspect-grid')"),'Cambió el inspector Running P&L fuera de alcance.');
need(cursorBlock.includes("trPartialRecord('market.cursor')"),'Cambió la instrumentación de cursor parcial fuera de alcance.');

need(structural.includes('/* Final runtime coordinator. This is the only render() used after bootstrap completes. */'),'Cambió el ancla del coordinador central render fuera de alcance.');
need(structural.includes("if(ui?.currentView&&TR_VALID_VIEWS.has(ui.currentView))globalThis.TradingResearchCurrentViewSessionRestoreWriteContract.restore(ui.currentView);"),'Cambió la restauración de currentView en boot fuera de alcance.');
need(structural.includes('globalThis.TradingResearchCurrentViewRouterFallbackWriteContract.toDashboard();'),'Cambió el fallback de router currentView fuera de alcance.');

if(fail.length){
  console.error('Current View Market Cursor Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Market Cursor Read Boundary verification OK');
console.log(' - v315SetCursor Market Data guard: 1 direct -> 1 read-contract');
console.log(' - Running P&L cursor/chart/inspector behavior preserved');
console.log(' - central render anchor, boot restore write boundary and router fallback write boundary preserved');
await import('./verify-current-view-central-render-read-boundary.mjs');
