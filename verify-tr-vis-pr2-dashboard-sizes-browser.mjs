/* TR-VIS PR2 real bundled application size selector regression. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync('dist/index.html','utf8');
const script="(async()=>{\n const o={},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));\n try{\n  await sleep(220);\n  const plan=getCurrentPlan();if(!plan)throw Error('Missing Trading Plan');\n  const profiles=v311EnsureDashboardProfiles(plan);\n  const profile=profiles.find(x=>x.id===plan.activeDashboardProfileId)||profiles[0];\n  if(!profile)throw Error('Missing Dashboard profile');\n  const pId=profile.id;\n  // Source-proven fixture: ten Replay operations with tick outcomes,\n  // isolated in this ephemeral Chromium profile, no persistent app changes.\n  state.operations=state.operations.filter(op=>op.tradingPlanId!==plan.id);\n  for(let i=0;i<10;i++){\n   const time=new Date('2026-07-13T'+String(10+i).padStart(2,'0')+':00:00');\n   state.operations.push({\n    id:'PR2_EQ_RESIZE_'+i,tradingPlanId:plan.id,\n    entryDate:time.toISOString(),exitDate:new Date(time.valueOf()+300000).toISOString(),\n    contract:'MCL 08-26',direction:i<5?'LONG':'SHORT',\n    setup:i%2?'Continuación':'Estructura',\n    result:i<3?'win':'loss',rMultiple:null,\n    resultTicks:i<3?20:-10,commission:1.6,\n    pnlGross:i<3?20:-10,pnlNet:i<3?18.4:-11.6,\n    recordClass:'replay',executionIntent:'replay'\n   });\n  }\n  window.__trDashboardUnit='ticks';\n  profile.config.panels=['equity','setupCount'];\n  profile.config.kpis=['operations','winRate','expectancy','pf','drawdown','blocks'];\n  profile.config.secondary=['mfe','mae','currentBlock'];\n  profile.sizes.panels.equity=8;\n  profile.sizes.panels.setupCount=4;\n  profile.sizes.kpis.operations=3;\n  const display=async()=>{window.TradingResearchActions.navigate('dashboard');await sleep(450);};\n  const read=()=>{\n   const grid=document.querySelector('#view .dashboard-panel-grid');\n   const equity=grid?.querySelector('[data-dashboard-widget=\"equity\"]');\n   const sibling=grid?.querySelector('[data-dashboard-widget=\"setupCount\"]');\n   const kpi=document.querySelector('#view .dashboard-kpis-custom [data-dashboard-widget=\"operations\"]');\n   const span=el=>[...el?.classList||[]].find(x=>x.startsWith('dashboard-span-'))||'';\n   return {grid:!!grid?.classList.contains('dashboard-flex-grid'),\n    order:[...grid?.querySelectorAll(':scope > .dashboard-widget')||[]].map(el=>el.dataset.dashboardWidget),\n    equityClass:span(equity),siblingClass:span(sibling),kpiClass:span(kpi),\n    equityWidth:equity?.getBoundingClientRect().width||0,\n    siblingWidth:sibling?.getBoundingClientRect().width||0,\n    graphPresent:!!equity?.querySelector('svg.dashboard-equity-svg'),\n    chartWidth:Math.round(equity?.querySelector('.chart-wrap')?.getBoundingClientRect().width||0),\n    svgWidth:Math.round(equity?.querySelector('svg.dashboard-equity-svg')?.getBoundingClientRect().width||0),\n    viewBoxWidth:Math.round(equity?.querySelector('svg.dashboard-equity-svg')?.viewBox?.baseVal?.width||0),\n    lastPointX:Number((equity?.querySelector('polyline.line')?.getAttribute('points')||'').trim().split(/\\\\s+/).at(-1)?.split(',')[0]||0),\n    widgets:document.querySelectorAll('.dashboard-kpis-custom .dashboard-widget').length};\n  };\n  await display();o.first=read();\n  openDashboardCustomizer();\n  const row=[...document.querySelectorAll('.modal .dashboard-config-row')].find(x=>x.querySelector('label')?.textContent.includes('Curva de equity'));\n  const select=row?.querySelector('.dashboard-size-select');\n  if(!select)throw Error('Equity size selector not found');\n  o.options=[...select.options].map(x=>Number(x.value));\n  select.value='12';select.dispatchEvent(new Event('change',{bubbles:true}));\n  await sleep(80);\n  o.selected=[...document.querySelectorAll('.modal .dashboard-config-row')].find(x=>x.querySelector('label')?.textContent.includes('Curva de equity'))?.querySelector('.dashboard-size-select')?.value;\n  saveDashboardCustomization();await sleep(450);\n  o.persisted=v311ActiveDashboardProfile().sizes.panels.equity;\n  o.full=read();\n  openDashboardCustomizer();v311DashboardSetSize('panels','equity','4');saveDashboardCustomization();await sleep(450);\n  o.third=read();o.sameProfile=v311ActiveDashboardProfile().id===pId;\n }catch(e){o.error=String(e?.stack||e);}\n document.body.dataset.tr2Widths=encodeURIComponent(JSON.stringify(o));\n})();";
const html=source.replace('</body>','<script>'+script+'</script></body>');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr2-size-'));
try{
 const page=path.join(dir,'index.html');fs.writeFileSync(page,html);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const result=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1550,1000','--virtual-time-budget=5000','--user-data-dir='+path.join(dir,'profile'),'--dump-dom','file://'+page],{encoding:'utf8',timeout:45000,maxBuffer:12500000});
 assert.equal(result.status,0,result.stderr?.slice(-1000));
 const encoded=result.stdout.match(/data-tr2-widths="([^"]+)"/)?.[1];
 assert(encoded,'Missing width fixture: '+result.stderr?.slice(-1200));
 const o=JSON.parse(decodeURIComponent(encoded));
 console.log('TR-VIS PR2 real Dashboard widths',JSON.stringify(o));
 assert(!o.error,o.error);
 assert.deepEqual(o.options,[4,6,8,12]);
 assert.equal(o.selected,'12');
 assert.equal(o.persisted,12);
 assert.equal(o.sameProfile,true);
 assert.equal(o.first.grid,true);
 assert.equal(o.first.equityClass,'dashboard-span-8');
 assert.equal(o.first.siblingClass,'dashboard-span-4');
 assert.equal(o.first.kpiClass,'dashboard-span-3');
 assert(o.first.equityWidth>o.first.siblingWidth*1.6,'2/3 width should exceed 1/3');
 assert.deepEqual(o.first.order,['equity','setupCount']);
 assert.equal(o.full.grid,true);
 assert.equal(o.full.equityClass,'dashboard-span-12');
 assert(o.full.equityWidth>o.first.equityWidth*1.3,'Full row must exceed 2/3');
 assert.equal(o.third.equityClass,'dashboard-span-4');
 assert(o.third.equityWidth<o.first.equityWidth*0.75,'1/3 should be narrower than 2/3');
 assert(o.first.graphPresent&&o.full.graphPresent&&o.third.graphPresent);
 // A card changing width is not enough: the curve must actually fill it.
 for(const [size,detail] of [['2/3',o.first],['full',o.full],['1/3',o.third]]){
  assert(detail.chartWidth>200,size+' needs a visible chart area');
  assert(Math.abs(detail.chartWidth-detail.svgWidth)<=3,size+' SVG must fill the card');
  assert(Math.abs(detail.chartWidth-detail.viewBoxWidth)<=3,size+' data viewBox must match live width');
  assert(detail.lastPointX>=detail.chartWidth-20,size+' last equity point must reach right plot edge');
 }
 assert(o.full.lastPointX>o.first.lastPointX*1.3,'The drawing, not just the card, must expand');

 console.log('TR-VIS PR2 Dashboard widths PASS: size selector + save 1/3, 2/3, full row.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
