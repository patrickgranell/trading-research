/* TR-FEAT-OPS-01: register column order, show/hide, persistence, scope and action safety. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const css=fs.readFileSync('styles.css','utf8');
const runtime=fs.readFileSync('operations-register-presentation-runtime.js','utf8');
const setup=String.raw`
let plan={id:'replay-plan'},route='operations';
window.TradingResearchPlanReadContract={current:()=>plan};
window.TradingResearchCurrentViewReadContract={current:()=>route};
const original=['Fecha','Hora','Día','Bloque','Símbolo','Dirección','Setup','VD','NR','Hipótesis','Régimen','Origen','Resultado','Ticks bruto','Ticks','P&L neto','Comisión','Acciones'];
window.opsTable=function(ops){
 return '<div class="table-wrap"><table class="table analytics-table"><thead><tr>'+
 original.map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+
 ops.map((op,i)=>'<tr>'+original.map((t,j)=>'<td>'+(j===17?'Ver Editar':j===0?'13/7/2026':j===1?'18:23':j===2?'Lun':j===3?'B01':j===4?'MCL':t)+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div>';
};
`;
const probe=String.raw`
try{
const ops=[{id:'1',entryDate:'2026-07-13T18:23:00',exitDate:'2026-07-13T18:28:00',result:'win'},{id:'2',entryDate:'2026-07-13T18:24:00',exitDate:'2026-07-13T18:29:00',result:'loss'}];
const root=document.querySelector('#view');
const mount=()=>{root.innerHTML=window.opsTable(ops);};
const keys=()=>[...root.querySelectorAll('.analytics-table thead th')].map(th=>th.dataset.trColsKey);
const hidden=()=>[...root.querySelectorAll('.analytics-table thead th.tr-cols-hidden')].map(th=>th.dataset.trColsKey);
const result={};
mount();
result.total=keys().length;
result.initial=keys();
result.actionsPinnned=keys().at(-1)==='actions';
result.fixedOriginalActions=[...root.querySelectorAll('tbody tr')].every(r=>r.cells[r.cells.length-1].textContent.includes('Ver Editar'));
const toggle=root.querySelector('[data-tr-cols-toggle]');
toggle.click();
result.panelOpen=!root.querySelector('[data-tr-cols-panel]').hidden;
const uncheck=root.querySelector('[data-tr-cols-visible="entryTime"]');
uncheck.checked=false;uncheck.dispatchEvent(new Event('change',{bubbles:true}));
result.hiddenTime=hidden().includes('entryTime')&&[...root.querySelectorAll('tbody tr')].every(row=>[...row.cells].some(c=>c.dataset.trColsKey==='entryTime'&&c.classList.contains('tr-cols-hidden')));
root.querySelector('[data-tr-cols-move="symbol"][data-tr-cols-delta="-1"]').click();
result.moved=keys().indexOf('symbol')===4;
const drag=()=>root.querySelector('[data-tr-cols-key="setup"]');
drag().dispatchEvent(new Event('dragstart',{bubbles:true,cancelable:true}));
root.querySelector('thead [data-tr-cols-key="weekday"]').dispatchEvent(new Event('drop',{bubbles:true,cancelable:true}));
result.dragReordered=keys().indexOf('setup')===keys().indexOf('weekday')-1;
const pref=window.TradingResearchOperationColumns.read();
result.persisted=pref.hidden.includes('entryTime')&&pref.order.indexOf('symbol')===4;
const beforeKeys=keys().join(',');
mount();
result.reopenedPreserved=keys().join(',')===beforeKeys&&hidden().includes('entryTime');
result.rowCounts=[...root.querySelectorAll('tbody tr')].map(row=>row.cells.length);
const original=keys().join(',');
plan={id:'different-plan'};
mount();
result.otherPlanDefault=!hidden().length&&keys().indexOf('symbol')===5;
plan={id:'replay-plan'};
mount();
result.samePlanRestored=keys().join(',')===original&&hidden().includes('entryTime');
route='lab';const lab=window.opsTable(ops);
result.labNotModified=!lab.includes('tr-colprefs')&&!lab.includes('tr-ops-entry-exit');
route='operations';mount();
result.lightDark={};
for(const theme of ['dark','light']){
 document.documentElement.dataset.theme=theme;
 result.lightDark[theme]=getComputedStyle(root.querySelector('.tr-colprefs-panel')).backgroundColor;
}
root.querySelector('[data-tr-cols-toggle]').click();
root.querySelector('[data-tr-cols-reset]').click();
result.reset=!hidden().length&&keys().indexOf('symbol')===5;
result.actionsIntact=[...root.querySelectorAll('tbody tr')].every(row=>row.lastElementChild.dataset.trColsKey==='actions'&&row.lastElementChild.textContent.includes('Ver Editar'));
document.body.dataset.trColumnsResults=encodeURIComponent(JSON.stringify(result));
}catch(e){
 document.body.dataset.trColumnsResults=encodeURIComponent(JSON.stringify({error:String(e?.stack||e)}));
}
`;
const html='<!doctype html><html lang="es" data-theme="dark"><head><meta charset="utf-8"><style>'+css+'</style></head><body><main id="view"></main><script>'+setup+'</script><script>'+runtime+'</script><script>'+probe+'</script></body></html>';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-cols-'));
try{
 const file=path.join(folder,'index.html');fs.writeFileSync(file,html);
 const browser=['google-chrome','chromium','chromium-browser'].find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(browser,'Chromium required');
 const run=spawnSync(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1250,860','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:6000000});
 assert.equal(run.status,0,run.stderr?.slice(-1000));
 const encoded=run.stdout.match(/data-tr-columns-results="([^"]+)"/)?.[1];assert(encoded,'No column fixture result: '+run.stderr?.slice(-1300));
 const result=JSON.parse(decodeURIComponent(encoded));
 console.log('Columns Chromium',JSON.stringify(result));
 assert.equal(result.total,19);
 for(const key of ['actionsPinnned','fixedOriginalActions','panelOpen','hiddenTime','moved','dragReordered','persisted','reopenedPreserved','otherPlanDefault','samePlanRestored','labNotModified','reset','actionsIntact']){
  assert.equal(result[key],true,key+' failed');
 }
 assert.deepEqual(result.rowCounts,[19,19]);
 assert.notEqual(result.lightDark.dark,result.lightDark.light);
 console.log('TR-FEAT-OPS-01 PASS: 19 fields, reorder by arrows/drag, hide, persistence per TP, fixed actions and light/dark.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
