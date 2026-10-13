/* TR-VIS PR2 · Trade lots end-to-end on real bundled application. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';
const html=fs.readFileSync('dist/index.html','utf8');
const body="(async()=>{\n const o={};const sleep=ms=>new Promise(r=>setTimeout(r,ms));\n const input=(sel,val,event='input')=>{\n  const el=document.querySelector(sel);if(!el)throw Error('Missing input '+sel);\n  el.value=val;el.dispatchEvent(new Event(event,{bubbles:true}));return el;\n };\n const fields=()=>[...document.querySelectorAll('#operationForm .tr-lot-result')];\n try{\n  await sleep(180);\n  const p=getCurrentPlan(),inst=state.settings.instruments.find(x=>x.symbol==='MCL')||state.settings.instruments[0];\n  if(!p||!inst)throw Error('No plan/instrument in fresh app');\n  const baseCount=state.operations.filter(x=>x.tradingPlanId===p.id).length;\n  p.riskStrategies=[\n   {id:'PR2_TWOTRANCHE',name:'proba 1',active:true,instrumentId:inst.id,lots:[\n    {id:'PR2_LOT1',quantity:1,stopTicks:10,targetType:'ticks',targetTicks:20},\n    {id:'PR2_LOT2',quantity:1,stopTicks:10,targetType:'ticks',targetTicks:40}\n   ]},\n   {id:'PR2_SINGLE',name:'solo un contrato',active:true,instrumentId:inst.id,lots:[\n    {id:'PR2_ONLY',quantity:1,stopTicks:10,targetType:'ticks',targetTicks:20}\n   ]}\n  ];\n  window.TradingResearchActions.navigate('operations');await sleep(120);\n  window.TradingResearchActions.openOperationModal();await sleep(240);\n  o.opened=!!document.querySelector('#operationForm');\n  o.defaultMode=document.querySelector('.tr-lots-mode')?.value;\n  o.initialRows=fields().length;\n  o.planned=[...document.querySelectorAll('.tr-lot-description span')].map(x=>x.textContent);\n  input('#f-entryDate','2026-07-13T10:00','change');\n  input('#f-exitDate','2026-07-13T10:15','change');\n  input('.tr-lot-execution-row:nth-child(1) .tr-lot-result','20');\n  input('.tr-lot-execution-row:nth-child(2) .tr-lot-result','40');\n  await sleep(110);\n  o.totalPreview=document.querySelector('#f-resultTicks')?.value;\n  o.readOnly=document.querySelector('#f-resultTicks')?.readOnly;\n  o.grossPreview=document.querySelector('#f-pnlGross')?.value;\n  o.rPreview=document.querySelector('#f-rMultiple')?.value;\n  o.commissionPreview=document.querySelector('#f-commission')?.value;\n  o.expectedGross=60*Number(inst.tickValue);\n  o.expectedCommission=2*Number(inst.commission);\n  await window.TradingResearchActions.saveOperationFromForm();await sleep(150);\n  const list=state.operations.filter(x=>x.tradingPlanId===p.id);\n  const saved=list.at(-1);if(!saved)throw Error('Save did not produce operation');\n  o.savedCount=list.length-baseCount;\n  o.saved={mode:saved.executionMode,lots:saved.executionLots,resultTicks:saved.resultTicks,commission:saved.commission,\n   gross:saved.pnlGross,net:saved.pnlNet,r:saved.rMultiple,result:saved.result};\n  o.persistedInAppStorage=!!localStorage.getItem('tradingResearchState')||!!localStorage.getItem('trading-research-state');\n  viewOperation(saved.id);await sleep(50);\n  o.study=!![...document.querySelectorAll('.modal h3')].find(x=>x.textContent==='Ejecución real por lotes');\n  o.studyRows=document.querySelectorAll('.tr-lot-detail tbody tr').length;\n  closeModal();\n  window.TradingResearchActions.openOperationModal(saved.id);await sleep(160);\n  o.editValues=fields().map(el=>el.value);\n  input('.tr-lot-execution-row:nth-child(2) .tr-lot-result','-10');\n  o.editTotal=document.querySelector('#f-resultTicks').value;\n  await window.TradingResearchActions.saveOperationFromForm();await sleep(150);\n  const edited=state.operations.find(x=>x.id===saved.id);\n  o.edited={lot2:edited.executionLots?.[1]?.resultTicks,aggregate:edited.resultTicks,count:state.operations.filter(x=>x.id===saved.id).length};\n  window.TradingResearchActions.openOperationModal(saved.id);await sleep(140);\n  input('.tr-lots-mode','aggregated','change');await sleep(40);\n  o.aggregatedEditable=!document.querySelector('#f-resultTicks').readOnly;\n  input('#f-resultTicks','15');\n  await window.TradingResearchActions.saveOperationFromForm();await sleep(150);\n  const aggregate=state.operations.find(x=>x.id===saved.id);\n  o.aggregated={mode:aggregate.executionMode,lots:aggregate.executionLots?.length,ticks:aggregate.resultTicks};\n  window.TradingResearchActions.openOperationModal();await sleep(130);\n  input('#f-entryDate','2026-07-14T10:00','change');\n  input('#f-exitDate','2026-07-14T10:08','change');\n  input('.tr-lot-execution-row:nth-child(1) .tr-lot-result','20');\n  o.partialPreview=document.querySelector('#f-resultTicks').value;\n  await window.TradingResearchActions.saveOperationFromForm();await sleep(150);\n  const pending=state.operations.filter(x=>x.tradingPlanId===p.id).at(-1);\n  o.pending={mode:pending.executionMode,lots:pending.executionLots?.map(l=>l.status),resultTicks:pending.resultTicks,\n   gross:pending.pnlGross,r:pending.rMultiple,outcome:pending.result};\n  o.totalAdded=state.operations.filter(x=>x.tradingPlanId===p.id).length-baseCount;\n  window.TradingResearchActions.openOperationModal();await sleep(130);\n  const riskSelect=document.querySelector('#f-riskStrategyId');riskSelect.value='PR2_SINGLE';\n  riskSelect.dispatchEvent(new Event('change',{bubbles:true}));await sleep(170);\n  o.changeStrategy={riskId:document.querySelector('.tr-lot-editor')?.dataset.riskId,rows:fields().length,\n   totalContracts:document.querySelector('#f-contracts')?.value};\n  closeModal();\n }catch(e){o.error=String(e?.stack||e);}\n document.body.setAttribute('data-tr-pr2-lot-check',encodeURIComponent(JSON.stringify(o)));\n})();";
const page=html.replace('</body>','<script>'+body+'</script></body>');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr2-lots-'));
try{
 const file=path.join(dir,'index.html');fs.writeFileSync(file,page);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--window-size=1550,1100','--virtual-time-budget=8500','--user-data-dir='+path.join(dir,'chrome'),
  '--dump-dom','file://'+file],{encoding:'utf8',timeout:55000,maxBuffer:16000000});
 assert.equal(run.status,0,run.stderr?.slice(-1800));
 const encoded=run.stdout.match(/data-tr-pr2-lot-check="([^"]+)"/)?.[1];
 assert(encoded,'Lot fixture missing: '+run.stderr?.slice(-2200));
 const o=JSON.parse(decodeURIComponent(encoded));console.log('PR2 lot execution fixture',JSON.stringify(o));
 assert(!o.error,o.error);
 assert.equal(o.opened,true);
 assert.equal(o.defaultMode,'lots');
 assert.equal(o.initialRows,2);
 assert(o.planned[0].includes('20t')&&o.planned[1].includes('40t'));
 assert.equal(o.totalPreview,'60');
 assert.equal(o.readOnly,true);
 assert.equal(Number(o.grossPreview),o.expectedGross);
 assert.equal(Number(o.commissionPreview),o.expectedCommission);
 assert.equal(Number(o.rPreview),3);
 assert.equal(o.savedCount,1);
 assert.equal(o.saved.mode,'lots');
 assert.equal(o.saved.lots.length,2);
 assert.deepEqual(o.saved.lots.map(x=>x.resultTicks),[20,40]);
 assert.deepEqual(o.saved.lots.map(x=>x.status),['closed','closed']);
 assert.equal(o.saved.resultTicks,60);
 assert.equal(o.saved.gross,o.expectedGross);
 assert.equal(o.saved.commission,o.expectedCommission);
 assert.equal(o.saved.net,o.expectedGross-o.expectedCommission);
 assert.equal(o.saved.r,3);
 assert.equal(o.saved.result,'win');
 assert.equal(o.study,true);
 assert.equal(o.studyRows,2);
 assert.deepEqual(o.editValues,['20','40']);
 assert.equal(o.editTotal,'10');
 assert.equal(o.edited.lot2,-10);
 assert.equal(o.edited.aggregate,10);
 assert.equal(o.edited.count,1);
 assert.equal(o.aggregatedEditable,true);
 assert.deepEqual(o.aggregated,{mode:'aggregated',lots:0,ticks:15});
 assert.equal(o.partialPreview,'');
 assert.deepEqual(o.pending,{mode:'lots',lots:['closed','open'],resultTicks:null,gross:null,r:null,outcome:'pending'});
 assert.equal(o.totalAdded,2,'Partial lots must not create duplicate trade rows');
 assert.equal(o.changeStrategy.riskId,'PR2_SINGLE');
 assert.equal(o.changeStrategy.rows,1);
 assert.equal(o.changeStrategy.totalContracts,'1');
 console.log('TR-VIS PR2 Lots PASS: aggregate 1+1, actual exits, edit, study, legacy mode, open lot, strategy switch.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
