import fs from 'node:fs';

const files={
  security:fs.readFileSync('security-runtime.js','utf8'),
  event:fs.readFileSync('event-runtime.js','utf8'),
  csp:fs.readFileSync('csp-runtime.js','utf8'),
  style:fs.readFileSync('style-runtime.js','utf8'),
  renderClosure:fs.readFileSync('render-closure-runtime.js','utf8'),
  backup:fs.readFileSync('backup-v2-runtime.js','utf8'),
  cloud:fs.readFileSync('cloud-v10-runtime.js','utf8'),
  transform:fs.readFileSync('render-source-transform.mjs','utf8')
};
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const directCurrentView=src=>(src.match(/\bcurrentView\b/g)||[]).length;
const contractCalls=src=>(src.match(/globalThis\.TradingResearchCurrentViewReadContract\.current\(\)/g)||[]).length;

for(const [name,src] of Object.entries({security:files.security,event:files.event,csp:files.csp,style:files.style,renderClosure:files.renderClosure})){
  need(directCurrentView(src)===0,`${name} todavía contiene lecturas directas de currentView.`);
}
need(contractCalls(files.security)===1,'Security Runtime debe tener exactamente 1 lectura por Current View Read Contract.');
need(contractCalls(files.event)===1,'Event Runtime debe tener exactamente 1 lectura por Current View Read Contract.');
need(contractCalls(files.csp)===1,'CSP Runtime debe tener exactamente 1 lectura por Current View Read Contract.');
need(contractCalls(files.style)===3,'Style Runtime debe tener exactamente 3 lecturas por Current View Read Contract.');
need(contractCalls(files.renderClosure)===1,'Render Closure Runtime debe tener exactamente 1 lectura por Current View Read Contract.');

need(files.security.includes("if(globalThis.TradingResearchCurrentViewReadContract.current()==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='data')setTimeout(()=>render(),0);"),'Cambió el refresh guard de Security Runtime fuera de alcance.');
need(files.event.includes("if(globalThis.TradingResearchCurrentViewReadContract.current()==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='data')setTimeout(()=>render(),0);"),'Cambió el refresh guard de Event Runtime fuera de alcance.');
need(files.csp.includes("try{if(globalThis.TradingResearchCurrentViewReadContract.current()==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='data')render();}catch(_){}"),'Cambió el refresh post-probe de CSP fuera de alcance.');
need(files.style.includes("function trStyleScope(el){let view='unknown';try{if(globalThis.TradingResearchCurrentViewReadContract.current())view=String(globalThis.TradingResearchCurrentViewReadContract.current());}catch(_){}"),'Cambió la etiqueta diagnóstica de scope de Style Runtime fuera de alcance.');
need(files.style.includes("try{window.TradingResearchStyleAttrs?.rescan?.();}catch(_){}try{if(globalThis.TradingResearchCurrentViewReadContract.current()==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='data')render();}catch(_){}"),'Cambió el refresh de reset de Style Runtime fuera de alcance.');
need(files.renderClosure.includes("if(globalThis.TradingResearchCurrentViewReadContract.current()==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='data')setTimeout(()=>window.render(),0);"),'Cambió el refresh guard de Render Closure fuera de alcance.');

need(files.transform.includes("Object.defineProperty(globalThis,'TradingResearchCurrentViewReadContract',{value:Object.freeze({current:()=>currentView}),writable:false,enumerable:false,configurable:false});"),'El Current View Read Contract dejó de ser read-only o cambió de forma.');

/* Sensitive currentView writes remain deliberately outside Batch 52. */
need(files.backup.includes("currentView='config';globalThis.TradingResearchConfigTabStateContract.set('data');render();"),'Cambió la escritura currentView de Restore V2 fuera de alcance.');
need(files.cloud.includes("currentView='dashboard';render();"),'Cambió la escritura currentView de Cloud Pull fuera de alcance.');
need(files.cloud.includes("currentView==='config'&&globalThis.TradingResearchConfigTabStateContract.current()==='cloud'"),'Cambió la lectura currentView de Cloud Push fuera de alcance.');

if(fail.length){
  console.error('Diagnostics Current View Read Closure verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Diagnostics Current View Read Closure verification OK');
console.log(' - Security/Event/CSP/Style/Render Closure direct currentView reads: closed');
console.log(' - 7 effective reads use the existing read-only Current View contract');
console.log(' - diagnostics refresh and Style scope semantics preserved');
console.log(' - Restore V2 and Cloud currentView boundaries remain untouched');
