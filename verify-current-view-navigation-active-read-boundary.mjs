import fs from 'node:fs';

const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const start=structural.indexOf('function trRenderSyncSidebar(){');
const end=structural.indexOf('\nfunction trRenderAfterView(){',start);
need(start>=0&&end>start,'No se pudo aislar trRenderSyncSidebar().');
const block=start>=0&&end>start?structural.slice(start,end):'';
const contractReads=(block.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
const directReads=(block.match(/\bcurrentView\b/g)||[]).length;

need(contractReads===4,`Lecturas Current View Read Contract en trRenderSyncSidebar(): ${contractReads} (esperado 4).`);
need(directReads===0,`Persisten ${directReads} lecturas directas currentView en trRenderSyncSidebar().`);
need(block.includes('groupForView(globalThis.TradingResearchCurrentViewReadContract.current())'),
  'El grupo activo del sidebar no usa Current View Read Contract.');
need(block.includes('setLastView(globalThis.TradingResearchCurrentViewReadContract.current())'),
  'Navigation Runtime lastView no usa Current View Read Contract.');
need((block.match(/btn\.dataset\.view===globalThis\.TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length===2,
  'Los dos marcadores visuales de vista activa no usan Current View Read Contract.');
need(block.includes("globalThis.TradingResearchNavigationRuntimeStateContract.ensureGroupOpen(activeGroup)"),
  'La apertura automática del grupo activo cambió fuera de alcance.');
need(block.includes('globalThis.TradingResearchNavigationStateContract.saveOpenGroups()'),
  'La persistencia de grupos abiertos cambió fuera de alcance.');

if(fail.length){
  console.error('Current View Navigation Active Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Navigation Active Read Boundary verification OK');
console.log(' - trRenderSyncSidebar currentView reads: 4 direct -> 4 read-contract');
console.log(' - group activation, lastView, active button and has-active group behavior preserved');
await import('./verify-current-view-render-diagnostics-read-boundary.mjs');
