import fs from 'node:fs';

const structural=fs.readFileSync('structural-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const start=structural.indexOf('function trRenderDiagnostics(){');
const end=structural.indexOf('\nfunction trRenderRuntimePanel(){',start);
need(start>=0&&end>start,'No se pudo aislar trRenderDiagnostics().');
const block=start>=0&&end>start?structural.slice(start,end):'';
const contractReads=(block.match(/TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;
const directShorthand=(block.match(/(?:\{|,)\s*currentView\s*(?=,|\})/g)||[]).length;

need(contractReads===1,`Lecturas Current View Read Contract en trRenderDiagnostics(): ${contractReads} (esperado 1).`);
need(directShorthand===0,`Persisten ${directShorthand} lecturas shorthand directas de currentView en trRenderDiagnostics().`);
need(block.includes('currentView:globalThis.TradingResearchCurrentViewReadContract.current()'),
  'El campo currentView de diagnostics no usa Current View Read Contract.');
need(block.includes("runtime:TR_RENDER_RUNTIME_VERSION"),'Cambió el runtime de diagnostics fuera de alcance.');
need(block.includes("shell:'persistent'"),'Cambió el shell marker de diagnostics fuera de alcance.');
need(block.includes('lastView:trRenderLastView'),'Cambió lastView de diagnostics fuera de alcance.');
need(block.includes("draftRecovery:'session'"),'Cambió draftRecovery de diagnostics fuera de alcance.');

if(fail.length){
  console.error('Current View Render Diagnostics Read Boundary verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Current View Render Diagnostics Read Boundary verification OK');
console.log(' - trRenderDiagnostics currentView read: 1 direct shorthand -> 1 read-contract');
console.log(' - diagnostics shape and non-currentView fields preserved');
