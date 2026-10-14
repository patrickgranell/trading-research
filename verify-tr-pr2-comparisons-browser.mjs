/* TR-VIS PR2 dashboard comparisons: Chromium on real app bundle and canonical engine. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync('dist/index.html','utf8');
const probe=String.raw`(async()=>{
 const o={},sleep=ms=>new Promise(done=>setTimeout(done,ms));
 try{
  await sleep(200);
  const plan=getCurrentPlan();
  if(!plan)throw Error('Trading Plan missing');
  state.operations=state.operations.filter(op=>op.tradingPlanId!==plan.id);
  for(let i=0;i<5;i++){
   const year=i===4?'2025':'2026',month=i===3?'08':'07',day=i===4?'13':String(13+i).padStart(2,'0'),hour=i%2?'11':'10';
   state.operations.push({
    id:'PR2_COMPARISON_'+i,tradingPlanId:plan.id,entryDate:year+'-'+month+'-'+day+'T'+hour+':00',
    exitDate:year+'-'+month+'-'+day+'T'+hour+':15',contract:'MCL',riskStrategyName:i<3?'Gestión A':'Gestión B',
    resultTicks:i%2===0?20:-10,rMultiple:i%2===0?2:-1,pnlGross:i%2===0?20:-10,
    pnlNet:i%2===0?18:-12,commission:2,result:i%2===0?'win':'loss',
    executionMode:'lots',executionLots:[
      {id:'l1',quantity:1,status:'closed',resultTicks:i%2===0?10:-5,totalTicks:i%2===0?10:-5},
      {id:'l2',quantity:1,status:'closed',resultTicks:i%2===0?10:-5,totalTicks:i%2===0?10:-5}
    ]
   });
  }
  const before=JSON.stringify(state.operations);
  window.TradingResearchActions.navigate('dashboard');await sleep(400);
  const widgets=[...document.querySelectorAll('#view [data-trcomp-widget]')];
  o.widgetKeys=widgets.map(w=>w.dataset.trcompWidget);
  o.gridParents=widgets.every(w=>w.parentElement.matches('.dashboard-panel-grid'));
  o.management=document.querySelector('[data-trcomp-widget="management"] [data-trcomp-body]')?.textContent;
  o.managementRows=document.querySelectorAll('[data-trcomp-widget="management"] .trcomp-bar-row').length;
  for(const kind of ['lots','hour','weekday','month','year']){
   const w=document.querySelector('[data-trcomp-widget="'+kind+'"]');
   o[kind]={rows:w?.querySelectorAll('.trcomp-bar-row').length,unit:w?.querySelector('[data-trcomp-unit-label]')?.textContent,text:w?.querySelector('[data-trcomp-body]')?.textContent};
  }
  o.dataIntact=JSON.stringify(state.operations)===before;
  openDashboardCustomizer();await sleep(170);
  o.customizerToggle=document.querySelectorAll('.modal [data-trcomp-enabled]').length;
  o.customizerSizing=document.querySelectorAll('.modal [data-trcomp-size]').length;
  closeModal();
 }catch(e){o.error=String(e?.stack||e);}
 document.body.dataset.trCompProbe=encodeURIComponent(JSON.stringify(o));
})();`;
const page=source.replace('</body>','<script>'+probe+'</script></body>');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr2-comp-'));
try{
 const file=path.join(dir,'index.html');fs.writeFileSync(file,page);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const r=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1550,1000','--virtual-time-budget=8500','--user-data-dir='+path.join(dir,'profile'),'--dump-dom','file://'+file],{encoding:'utf8',timeout:55000,maxBuffer:16000000});
 assert.equal(r.status,0,r.stderr?.slice(-1000));
 const encoded=r.stdout.match(/data-tr-comp-probe="([^"]+)"/)?.[1];
 assert(encoded,'Missing dashboard comparison result: '+r.stderr?.slice(-1200));
 const o=JSON.parse(decodeURIComponent(encoded));console.log('PR2 comparative Dashboard',JSON.stringify(o));
 assert(!o.error,o.error);
 assert.deepEqual(o.widgetKeys,['management','lots','hour','weekday','month','year']);
 assert.equal(o.gridParents,true);
 assert.equal(o.managementRows,2);
 assert(o.management.includes('Gestión A')&&o.management.includes('Gestión B'));
 assert.equal(o.lots.rows,4);
 assert.equal(o.lots.unit,'ticks-contrato');
 assert(o.lots.text.includes('Gestión A')&&o.lots.text.includes('Gestión B'));
 assert.equal(o.hour.rows,2);
 assert(o.weekday.rows>=2);
 assert(o.month.rows,3);
 assert.equal(o.year.rows,2);
 assert.equal(o.dataIntact,true);
 assert.equal(o.customizerToggle,6);
 assert.equal(o.customizerSizing,6);
 console.log('TR-VIS PR2 Dashboard comparisons PASS: management, lots, entry hours, weekdays, months, years, canonical unit and no data writes.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
