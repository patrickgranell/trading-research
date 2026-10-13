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
  await wait(200);
  const plan=getCurrentPlan();if(!plan)throw Error('Missing fixture Trading Plan');
  const before=state.operations.length;
  state.operations=state.operations.filter(o=>o.tradingPlanId!==plan.id);
  const day='2026-07-13';
  for(let i=0;i<10;i++){
   const time=new Date(day+'T'+String(10+i).padStart(2,'0')+':00:00');
   state.operations.push({
    id:'TR_VIS_COUNT_'+i,tradingPlanId:plan.id,entryDate:time.toISOString(),
    exitDate:new Date(time.valueOf()+300000).toISOString(),
    contract:'MCL 08-26',direction:i<5?'LONG':'SHORT',setup:i%2?'Continuación':'Estructura',
    result:i<3?'win':'loss',rMultiple:i<3?2:-1,commission:1.6,
    resultTicks:i<3?20:-10,pnlGross:i<3?20:-10,pnlNet:i<3?18.4:-11.6,
    recordClass:'backtest',executionIntent:'backtest'
   });
  }
  out.source=currentOps().length;
  out.sourceIds=currentOps().map(o=>o.id).sort();
  window.TradingResearchActions.navigate('dashboard');await wait(180);
  out.dashboard=document.querySelector('.dashboard-widget-kpis[data-dashboard-widget="operations"] .kpi .value')?.textContent?.trim()||'';
  out.wins=document.querySelector('.dashboard-widget-kpis[data-dashboard-widget="avgWin"] .kpi .sub')?.textContent?.trim()||'';
  out.dashboardHTML=document.querySelector('#view')?.innerHTML.includes('TR_VIS_COUNT_')||false;
  const widget=document.querySelector('[data-dashboard-widget="operations"]');
  out.widgetLabel=widget?.querySelector('.kpi .label')?.textContent?.trim()||'';
  out.widgetCount=Number(widget?.querySelector('.kpi .value')?.textContent?.trim());
  window.TradingResearchActions.navigate('operations');await wait(220);
  try{resetOpsFilters();await wait(120);}catch(e){out.resetIssue=String(e);}
  out.filtered=typeof filteredOps==='function'?filteredOps().length:null;
  out.tableRows=document.querySelectorAll('#view .analytics-table tbody tr').length;
  out.rawSourceAfter=state.operations.length;
  out.removedBase=before;
 }catch(e){out.error=String(e?.stack||e);}
 document.body.dataset.trVisCounts=encodeURIComponent(JSON.stringify(out));
})();`;
const src=html.replace('</body>','<script>'+script+'</script></body>');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-vis-counts-'));
try{
 const file=path.join(folder,'index.html');fs.writeFileSync(file,src);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,900','--virtual-time-budget=4000','--dump-dom','file://'+file],{encoding:'utf8',timeout:45000,maxBuffer:9500000});
 assert.equal(run.status,0,run.stderr?.slice(-2000));
 const encoded=run.stdout.match(/data-tr-vis-counts="([^"]+)"/)?.[1];assert(encoded,'Missing count fixture output: '+run.stderr?.slice(-1500));
 const out=JSON.parse(decodeURIComponent(encoded));console.log('TR-VIS count fixture',JSON.stringify(out));
 assert(!out.error,'Fixture error: '+out.error);
 assert.equal(out.source,10);
 assert.equal(out.widgetLabel,'Operaciones');
 assert.equal(out.widgetCount,10,'Dashboard count must equal all operations in current Trading Plan');
 assert.equal(out.filtered,10,'Unfiltered Register must share Dashboard source');
 assert.equal(out.tableRows,10,'Visible Register must contain the same 10 rows');
 console.log('TR-VIS PR1 count parity PASS: 10 source trades, Dashboard KPI 10, Register 10.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
