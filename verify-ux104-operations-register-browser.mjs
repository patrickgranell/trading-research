import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('./operations-register-presentation-runtime.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');
const first=app.indexOf('function opsTable(');
const firstEnd=app.indexOf('function opsAnalyticsHtml(',first);
const effective=app.indexOf('opsTable=function(');
const effectiveEnd=app.indexOf('/* In reconciliation, "eligible"',effective);
assert(first>0&&firstEnd>first&&effective>firstEnd&&effectiveEnd>effective,'Original and effective table source required');
const base=app.slice(first,firstEnd);
const later=app.slice(effective,effectiveEnd);
const setup=[
 'const opsViewState={unit:"r",basis:"gross"};',
 'const opBlockMap=()=>new Map([["won",7],["pending",7],["evidence",7]]);',
 'const fmtDateOnly=v=>new Date(v).toLocaleDateString("es-ES");',
 'const DOW_LABELS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];',
 'const esc=v=>String(v);',
 'const opMetricValue=o=>o.rMultiple||0;',
 'const metricUnitLabel=()=> "R";',
 'const metricStatText=()=> "0R";',
 'const money=()=> "0 USD";',
 'const v319MissingJournalFields=()=>[];',
 'const v319SourceLabel=()=> "Manual";',
 'const resultClass=o=>o.result==="win"?"win":o.result==="loss"?"loss":o.result==="flat"?"flat":"";',
 'window.TradingResearchOperationSemanticsContract={label:()=> "Backtesting"};',
 'let view="operations";window.TradingResearchCurrentViewReadContract={current:()=>view};'
].join('\n');
const probe=[
 'const samples=[',
 ' {id:"won",entryDate:"2026-08-14T21:56:00",exitDate:"2026-08-15T01:22:00",result:"win",rMultiple:2},',
 ' {id:"pending",entryDate:"2026-08-13T20:39:00",exitDate:"",result:"pending",rMultiple:0},',
 ' {id:"evidence",entryDate:"2026-08-14T19:11:00",exitDate:"",result:"win",rMultiple:1,executionEvidence:{exitDate:"2026-08-15T02:10:00"}}',
 '];',
 'const unchanged=JSON.stringify(samples);',
 'const changed=window.opsTable(samples);',
 'const mount=document.createElement("div");mount.innerHTML=changed;document.body.appendChild(mount);',
 'const table=mount.querySelector(".analytics-table");',
 'const headings=[...table.tHead.rows[0].cells].map(c=>c.textContent.trim());',
 'const records=[...table.tBodies[0].rows].map(row=>[...row.cells].map(c=>c.textContent.trim()));',
 'const testStyles=theme=>{document.documentElement.dataset.theme=theme;',
 ' const p=table.tBodies[0].rows[1];const w=table.tBodies[0].rows[0];',
 ' return {mark:getComputedStyle(p.cells[0],"::after").content,amber:getComputedStyle(p.querySelector("td:nth-last-child(6)>.badge")).color,',
 '         markerColor:getComputedStyle(p.cells[0],"::after").color,winner:getComputedStyle(w.querySelector("td:nth-last-child(6)>.badge")).color};',
 '};',
 'const dark=testStyles("dark"),light=testStyles("light");',
 'view="lab";const lab=window.opsTable(samples);',
 'document.body.setAttribute("data-tr-ux104",encodeURIComponent(JSON.stringify({headings,records,dark,light,labContainsBlock:lab.includes("<th>Bloque</th>"),unchanged:JSON.stringify(samples)===unchanged})));'
].join('\n');
const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><style>'+css+'</style></head><body>'+
 '<script>'+setup+'\n'+base+'\n'+later+'\n'+runtime+'\n'+probe+'</script></body></html>';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr-ux104-'));
try{
 const file=path.join(dir,'register.html');
 fs.writeFileSync(file,html);
 let chrome;
 for(const bin of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)){
   if(spawnSync(bin,['--version'],{encoding:'utf8'}).status===0){chrome=bin;break;}
 }
 assert(chrome,'Chromium required for real table rendering verification');
 const p=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--dump-dom','file://'+file],{encoding:'utf8',timeout:28000,maxBuffer:3000000});
 assert.equal(p.status,0,p.stderr?.slice(-1000));
 const attr=p.stdout.match(/data-tr-ux104="([^"]+)"/)?.[1];
 assert(attr,'Browser failed to render actual V31.9 operations table: '+p.stdout.slice(-600));
 const v=JSON.parse(decodeURIComponent(attr));
 assert.deepEqual(v.headings.slice(0,5),['Fecha entrada','Hora entrada','Fecha salida','Hora salida','Día']);
 assert(!v.headings.includes('Bloque'),'Obsolete block column must be absent');
 assert.equal(v.headings.length,19,'Expected 18 original columns +2 exit −1 block');
 assert.equal(v.records[0][2],'15/8/2026','Overnight exit date incorrect');
 assert.equal(v.records[0][3],'01:22','Overnight exit time incorrect');
 assert.equal(v.records[1][2],'—');
 assert.equal(v.records[1][3],'—');
 assert.equal(v.records[2][2],'15/8/2026','Evidence exit timestamp missing');
 assert.equal(v.records[2][3],'02:10');
 assert(v.unchanged,'Source records were mutated by presentation');
 assert(v.labContainsBlock,'Other views must keep their old operations table');
 assert(v.dark.mark.includes('Pendiente')&&v.light.mark.includes('Pendiente'));
 assert.equal(v.dark.amber,'rgb(255, 209, 106)');
 assert.equal(v.light.amber,'rgb(117, 71, 0)');
 assert.notEqual(v.dark.winner,v.dark.amber,'Closed winner must keep semantic color');
 console.log('UX-104 Chromium PASS: overnight exit, pending null, evidence fallback, scoped Bloque removal and light/dark pending');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
