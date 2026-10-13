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
let ops=[{id:'1',entryDate:'2026-07-13T18:23:00',exitDate:'2026-07-13T18:28:00',result:'win'},{id:'2',entryDate:'2026-07-13T18:24:00',exitDate:'2026-07-13T18:29:00',result:'loss'}];
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
// Laboratorio shares exactly the same capabilities but not Operaciones' saved layout.
route='lab';mount();
result.labHasConfigurator=!!root.querySelector('[data-tr-cols-toggle]')&&root.querySelector('table.tr-ops-entry-exit')!==null;
result.labIndependentDefault=!hidden().length&&keys().indexOf('symbol')===5;
result.labActionsFixed=keys().at(-1)==='actions'&&[...root.querySelectorAll('tbody tr')].every(row=>row.cells[row.cells.length-1].textContent.includes('Ver Editar'));
root.querySelector('[data-tr-cols-toggle]').click();
const labHide=root.querySelector('[data-tr-cols-visible="entryDate"]');
labHide.checked=false;labHide.dispatchEvent(new Event('change',{bubbles:true}));
root.querySelector('[data-tr-cols-move="setup"][data-tr-cols-delta="-1"]').click();
result.labEdited=hidden().includes('entryDate')&&keys().indexOf('setup')===6;
const labOrder=keys().join(',');
route='operations';mount();
result.opsUnchangedByLab=!hidden().includes('entryDate')&&hidden().includes('entryTime')&&keys().join(',')===original;
route='lab';mount();
result.labPersisted=hidden().includes('entryDate')&&keys().join(',')===labOrder;
plan={id:'other-tp'};mount();
result.labOtherPlanDefault=!hidden().length&&keys().indexOf('setup')===7;
plan={id:'replay-plan'};
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
// PR2: contracts are shown; executed lot results are exposed as independent opt-in columns.
// No separate operations, no invented lot history for aggregated records.
plan={id:'lots-plan',riskStrategies:[{id:'risk-a',lots:[{id:'a'},{id:'b'}]}]};
ops=[
 {id:'lot-a',tradingPlanId:plan.id,contracts:2,executionMode:'lots',
  executionLots:[{id:'a',quantity:1,resultTicks:20,status:'closed'},{id:'b',quantity:1,resultTicks:40,status:'closed'}]},
 {id:'lot-b',tradingPlanId:plan.id,contracts:3,executionMode:'lots',
  executionLots:[{id:'a',quantity:2,resultTicks:-10,status:'closed'},{id:'b',quantity:1,resultTicks:null,status:'open'}]},
 {id:'aggregated',tradingPlanId:plan.id,contracts:1,executionMode:'aggregated',resultTicks:15}
];
mount();
result.dynamicKeys=keys().filter(x=>x==='contracts'||x==='lots'||/^lot[1-9]/.test(x));
result.lotsDefaultHidden=hidden().includes('lot1')&&hidden().includes('lot2')&&!hidden().includes('contracts')&&!hidden().includes('lots');
result.contractAmounts=[...root.querySelectorAll('tbody tr')].map(r=>r.querySelector('[data-tr-cols-key="contracts"]')?.textContent);
result.lotSummary=[...root.querySelectorAll('tbody tr')].map(r=>r.querySelector('[data-tr-cols-key="lots"]')?.textContent);
result.lotCount=keys().length;
result.lotActionFixed=[...root.querySelectorAll('tbody tr')].every(r=>r.cells.length===23&&r.lastElementChild.dataset.trColsKey==='actions');
root.querySelector('[data-tr-cols-toggle]').click();
for(const name of ['lot1','lot2']){
 const control=root.querySelector('[data-tr-cols-visible="'+name+'"]');
 control.checked=true;control.dispatchEvent(new Event('change',{bubbles:true}));
}
result.lotsEnabled=!hidden().includes('lot1')&&!hidden().includes('lot2');
result.lot1=[...root.querySelectorAll('tbody tr')].map(r=>r.querySelector('[data-tr-cols-key="lot1"]')?.textContent);
result.lot2=[...root.querySelectorAll('tbody tr')].map(r=>r.querySelector('[data-tr-cols-key="lot2"]')?.textContent);
mount();
result.lotsPersisted=!hidden().includes('lot1')&&!hidden().includes('lot2')&&keys().at(-1)==='actions';
result.oldPlanLayoutPreserved=window.TradingResearchOperationColumns.read().order.includes('lot1');

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
 assert.equal(result.total,21);
 for(const key of ['actionsPinnned','fixedOriginalActions','panelOpen','hiddenTime','moved','dragReordered','persisted','reopenedPreserved','otherPlanDefault','samePlanRestored','labHasConfigurator','labIndependentDefault','labActionsFixed','labEdited','opsUnchangedByLab','labPersisted','labOtherPlanDefault','reset','actionsIntact']){
  assert.equal(result[key],true,key+' failed');
 }
 assert.deepEqual(result.rowCounts,[21,21]);
 assert.notEqual(result.lightDark.dark,result.lightDark.light);
 assert.deepEqual(result.dynamicKeys,['contracts','lots','lot1','lot2']);
 assert.equal(result.lotCount,23);
 assert.equal(result.lotsDefaultHidden,true);
 assert.deepEqual(result.contractAmounts,['2','3','1']);
 assert.deepEqual(result.lotSummary,['L1 +20t/ct ×1 · L2 +40t/ct ×1','L1 -10t/ct ×2 · L2 Pend.','Agregado']);
 assert.equal(result.lotActionFixed,true);
 assert.equal(result.lotsEnabled,true);
 assert.deepEqual(result.lot1,['+20t/ct ×1','-10t/ct ×2','—']);
 assert.deepEqual(result.lot2,['+40t/ct ×1','Pend.','—']);
 assert.equal(result.lotsPersisted,true);
 console.log('TR-FEAT-OPS-01 / TR-VIS PR2 PASS: 21 base columns + dynamically configured executed lots, contracts, pending and aggregated, persisted preferences, fixed actions.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
