/* TR-VIS PR1 · one Trading Plan, one operation universe across Dashboard and Register. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const html=fs.readFileSync('dist/index.html','utf8');
const script=String.raw`(async()=>{
 const out={};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  await wait(470); // Allow asynchronous startup to finish before constructing the disposable fixture.
  const plan=getCurrentPlan();if(!plan)throw Error('Missing fixture Trading Plan');
  state.operations=state.operations.filter(o=>o.tradingPlanId!==plan.id);
  const day='2026-07-13';
  for(let i=0;i<10;i++){
   const time=new Date(day+'T'+String(10+i).padStart(2,'0')+':00:00');
   state.operations.push({
    id:'TR_VIS_COUNT_'+i,tradingPlanId:plan.id,entryDate:time.toISOString(),
    exitDate:new Date(time.valueOf()+300000).toISOString(),
    contract:'MCL 08-26',direction:i<5?'LONG':'SHORT',setup:i%2?'Continuación':'Estructura',
    result:i<3?'win':'loss',rMultiple:i<3?(i===0?2:-1):null,commission:1.6,
    resultTicks:i<3?20:-10,pnlGross:i<3?20:-10,pnlNet:i<3?18.4:-11.6,
    recordClass:'replay',executionIntent:'replay'
   });
  }
  if(typeof persist==='function')persist(); // Keep synthetic operations across rerenders in the isolated file:// profile.
  out.source=currentOps().length;
  window.TradingResearchActions.navigate('dashboard');await wait(180);
  const widget=[...document.querySelectorAll('#view .kpi')].find(card=>card.querySelector('.label')?.textContent.trim().startsWith('Operaciones'));
  out.widgetLabel=widget?.querySelector('.label')?.firstChild?.textContent?.trim()||'';
  out.widgetCount=Number(widget?.querySelector('.value')?.textContent?.trim());
  out.widgetSub=widget?.querySelector('.sub')?.textContent?.trim()||'';
  const rate=[...document.querySelectorAll('#view .kpi')].find(card=>card.querySelector('.label')?.textContent.trim().startsWith('Win rate'));
  out.winRate=rate?.querySelector('.value')?.textContent?.trim()||'';
  out.winSub=rate?.querySelector('.sub')?.textContent?.trim()||'';
  window.TradingResearchActions.navigate('operations');await wait(220);
  try{resetOpsFilters();await wait(120);}catch(e){out.resetIssue=String(e);}
  out.filtered=typeof filteredOps==='function'?filteredOps().length:null;
  out.tableRows=document.querySelectorAll('#view .analytics-table tbody tr').length;
  out.rawSourceAfter=state.operations.length;
 }catch(e){out.error=String(e?.stack||e);}
 document.body.dataset.trVisCounts=encodeURIComponent(JSON.stringify(out));
})();`;
const src=html.replace('</body>','<script>'+script+'</script></body>');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-vis-counts-'));
try{
 const file=path.join(folder,'index.html');fs.writeFileSync(file,src);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900','--user-data-dir='+path.join(folder,'chrome-profile'),'--virtual-time-budget=4000','--dump-dom','file://'+file],{encoding:'utf8',timeout:45000,maxBuffer:9500000});
 assert.equal(run.status,0,run.stderr?.slice(-2000));
 const encoded=run.stdout.match(/data-tr-vis-counts="([^"]+)"/)?.[1];assert(encoded,'Missing count fixture output: '+run.stderr?.slice(-1500));
 const out=JSON.parse(decodeURIComponent(encoded));console.log('TR-VIS count fixture',JSON.stringify(out));
 assert(!out.error,'Fixture error: '+out.error);
 assert.equal(out.source,10);
 assert.equal(out.widgetLabel,'Operaciones');
 assert.equal(out.widgetCount,10,'Dashboard count must equal all operations in current Trading Plan');
 assert.equal(out.winRate,'30.0%','Tick win rate must use its 10 eligible operations, not 3 with R');
 assert(out.widgetSub.includes('total del')&&out.winSub.includes('10/10'), 'Sample coverage must be visible');
 assert.equal(out.filtered,10,'Unfiltered Register must share Dashboard source');
 assert.equal(out.tableRows,10,'Visible Register must contain the same 10 rows');
 console.log('TR-VIS PR1 count parity PASS: 10 Replay source trades, only 3 R-eligible, Dashboard total 10, tick win rate 30%, Register 10.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
