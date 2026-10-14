/* TR-VIS PR2 · Chromium presentation audit; no persistent source modifications. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const css=fs.readFileSync('styles.css','utf8');
const runtime=fs.readFileSync('tr-vis-pr2-operativa-runtime.js','utf8');
const setup="const state={view:'dashboard'};\nwindow.TradingResearchOperationsReadContract={current:()=>Array.from({length:45},(_,i)=>({id:i+1}))};\nfunction trRenderViewHtml(view){\n if(view==='dashboard'){\n  const ids=['operations','winRate','result','expectancy','pf','drawdown'];\n  const widget=id=>'<div class=\"dashboard-widget dashboard-widget-kpis dashboard-span-2\" data-dashboard-widget=\"'+id+'\"><div class=\"kpi\"><div class=\"label\">'+id+'</div><div class=\"value\">12.00</div></div></div>';\n  return '<div class=\"topbar\">Dashboard</div><div class=\"dashboard-flex-grid dashboard-kpis-custom\">'+ids.map(widget).join('')+'</div><div class=\"dashboard-flex-grid dashboard-panel-grid\"><div class=\"dashboard-widget dashboard-span-6\" data-dashboard-widget=\"equity\"><section class=\"card panel dashboard-custom-panel\"><div class=\"panel-title dashboard-equity-title\"><h3>Equity</h3></div><div class=\"chart-wrap\"><svg class=\"dashboard-equity-svg\" viewBox=\"0 0 760 250\"></svg></div></section></div><div class=\"dashboard-widget dashboard-span-6\" data-dashboard-widget=\"setupCount\">Setup</div></div>';\n }\n if(view==='operations'){\n  const keys=['entryDate','entryTime','exitDate','exitTime','weekday','symbol','direction','setup','vd','nr','hypothesis','regime','source','result','metric','ticks','netPnl','commission','actions'];\n  const table='<table class=\"tr-ops-entry-exit\"><thead><tr>'+keys.map(k=>'<th data-tr-cols-key=\"'+k+'\">'+k+'</th>').join('')+'</tr></thead><tbody><tr>'+keys.map(k=>'<td data-tr-cols-key=\"'+k+'\">'+k+'</td>').join('')+'</tr></tbody></table>';\n  return '<div class=\"tr5-ops-register\"><section class=\"table-module\"><div class=\"panel-title\">Registro filtrado</div><div class=\"tr-colprefs-top\"><span>Columnas</span></div>'+table+'</section></div>';\n }\n if(view==='blocks'){\n  const names=['Ops','WR','Resultado','Expectancy','PF','Max DD','Comisión'];\n  const card='<section class=\"card block-card v5-block\"><div class=\"block-top\"><div>Bloque</div></div><div class=\"block-spark\"><svg viewBox=\"0 0 300 70\"></svg></div><div class=\"block-core-grid\">'+names.map(t=>'<div><span>'+t+'</span><strong>1</strong></div>').join('')+'</div><div class=\"block-actions\"><button>Detalle</button></div></section>';\n  return '<div class=\"block-grid v5-block-grid\">'+card+card+card+'</div><section class=\"block-compare\">Comparativa</section>';\n }\n if(view==='calendar'){\n  const day=(n,val,tone)=>'<button class=\"calendar-cell calendar-day '+tone+'\"><div class=\"calendar-day-head\"><strong>1</strong><span>'+(n?n+' trades':'')+'</span></div><div class=\"calendar-day-result\">'+val+'</div><div class=\"calendar-day-meta\"><span>WR 50%</span><span>Disc</span></div></button>';\n  const days=day(0,'—','empty-day')+day(2,'—','flat-day')+day(1,'0.0t','flat-day')+Array.from({length:39},()=>day(0,'—','empty-day')).join('');\n  return '<section class=\"calendar-panel\"><div class=\"calendar-month-kpis\"><div><span>Operaciones</span><strong>3</strong></div><div><span>Resultado</span><strong>0</strong></div><div><span>Win rate</span><strong>50%</strong></div></div><div class=\"calendar-grid\">'+days+'</div><div class=\"calendar-legend\"><span><i></i> neutro / sin muestra</span></div></section>';\n }\n return '<section id=\"labOriginal\">Original lab</section>';\n}";
const probe="try{\n const root=document.querySelector('#view'), results={};\n const render=view=>{root.innerHTML=trRenderViewHtml(view);};\n render('dashboard');\n results.dashboardPrimary=[...root.querySelectorAll('.tr2-primary-kpi')].map(x=>x.dataset.dashboardWidget);\n results.dashboardSpans=[...root.querySelectorAll('.dashboard-widget')].map(x=>[x.dataset.dashboardWidget,[...x.classList].find(c=>c.startsWith('dashboard-span-'))]);\n results.equity=!!root.querySelector('.tr2-equity-widget .dashboard-equity-svg');\n const curveToggle=root.querySelector('[data-tr2-equity-expand]');\n results.equityToggle=!!curveToggle;\n if(curveToggle){\n  curveToggle.click();results.equityExpanded=!!root.querySelector('.tr2-equity-expanded');\n  results.equityExpandedStyle=getComputedStyle(root.querySelector('[data-dashboard-widget=\"equity\"]')).gridColumnStart;\n  curveToggle.click();results.equityUnchanged=!root.querySelector('.tr2-equity-expanded');\n }\n render('operations');\n const c=root.querySelector('[data-tr2-compact-switch]');\n results.operationToggle=!!c;results.colsBefore=root.querySelectorAll('tbody td').length;\n c.click();\n results.compactHidden=getComputedStyle(root.querySelector('[data-tr-cols-key=\"entryTime\"]')).display;\n results.compactDateTime=root.querySelector('td[data-tr-cols-key=\"entryDate\"]')?.dataset.tr2Time;\n results.compactHasIdentity=getComputedStyle(root.querySelector('th[data-tr-cols-key=\"symbol\"]')).display;\n c.click();\n results.fullRestored=getComputedStyle(root.querySelector('th[data-tr-cols-key=\"entryTime\"]')).display;\n results.colsAfter=root.querySelectorAll('tbody td').length;\n render('blocks');\n results.blocks=Array.from(root.querySelectorAll('.v5-block')).map(card=>({\n  primary:[...card.querySelectorAll(':scope > .block-core-grid > div > span')].map(x=>x.textContent),\n  more:card.querySelector('.tr2-block-more')?.querySelectorAll('.tr2-block-more-grid > div').length,\n  chart:!!card.querySelector('.block-spark svg')\n }));\n results.blockIncomplete=root.querySelectorAll('.tr2-block-incomplete').length;\n results.blockText=root.querySelector('.tr2-block-incomplete')?.textContent;\n render('calendar');\n results.days=root.querySelectorAll('.calendar-day').length;\n results.dayEmpty=root.querySelectorAll('.tr2-calendar-empty').length;\n results.dayUnevaluated=root.querySelectorAll('.tr2-calendar-unevaluated').length;\n results.dayZero=root.querySelectorAll('.tr2-calendar-zero').length;\n results.count=root.querySelectorAll('.calendar-day')[1].querySelector('.calendar-day-head span').textContent;\n results.calendarLegend=root.querySelector('.calendar-legend').textContent;\n window.calendarState={year:2026,month:6,unit:'ticks',basis:'gross',metric:'result'};\n window.calendarMonthOps=()=>[{id:1}];\n window.calendarDayOps=ops=>ops;\n window.calcMetricStats=()=>({n:0});\n render('calendar');\n results.pendingNeverZero=!!root.querySelectorAll('.calendar-day')[2].classList.contains('tr2-calendar-unevaluated');\n results.pendingClosureLabel=root.querySelectorAll('.calendar-day')[2].querySelector('.calendar-day-result')?.textContent;\n delete window.calendarState;delete window.calendarMonthOps;delete window.calendarDayOps;delete window.calcMetricStats;\n render('lab');results.labUntouched=!!root.querySelector('#labOriginal')&&!root.querySelector('.tr2-equity-widget');\n document.body.insertAdjacentHTML('beforeend','<div class=\"modal-backdrop\"><div class=\"modal\"><div class=\"modal-head\">Operación</div><div class=\"modal-body\"><form id=\"operationForm\"><section class=\"form-section\"><h4>0 Trading Plan</h4><div class=\"plan-readonly\">TP</div></section><section class=\"form-section\"><div class=\"form-grid\"><div class=\"field\"><label>Setup</label><input class=\"input\"></div></div></section></form></div><div class=\"modal-foot\"><button>Cancelar</button><button>Guardar</button></div></div></div>');\n TradingResearchVisualPR2.enhanceOperationModal();\n results.modal=!!document.querySelector('.tr2-operation-modal');\n results.modalInput=document.querySelectorAll('#operationForm input').length;\n results.modalActions=[...document.querySelectorAll('.tr2-operation-modal .modal-foot button')].map(x=>x.textContent);\n document.body.setAttribute('data-tr2-browser-result',encodeURIComponent(JSON.stringify(results)));\n}catch(e){document.body.setAttribute('data-tr2-browser-result',encodeURIComponent(JSON.stringify({error:String(e?.stack||e)})));}";
const html='<!doctype html><html lang="es" data-theme="dark"><head><meta charset="utf-8"><style>'+css+'</style></head><body><main id="view"></main><script>'+setup+'</script><script>'+runtime+'</script><script>'+probe+'</script></body></html>';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr2-'));
try{
 const file=path.join(folder,'index.html');fs.writeFileSync(file,html);
 const chromium=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chromium,'Chromium required');
 const run=spawnSync(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1280,850','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:8000000});
 assert.equal(run.status,0,run.stderr?.slice(-1000));
 const encoded=run.stdout.match(/data-tr2-browser-result="([^"]+)"/)?.[1];
 assert(encoded,'No PR2 browser result: '+run.stderr?.slice(-1600));
 const out=JSON.parse(decodeURIComponent(encoded));console.log('TR-VIS PR2 scenario',JSON.stringify(out));
 assert(!out.error,out.error);
 assert.deepEqual(out.dashboardPrimary,['result','expectancy','pf','drawdown']);
 assert(out.dashboardSpans.some(pair=>pair[0]==='equity'&&pair[1]==='dashboard-span-6'),'Dashboard profile span must be preserved');
 assert.equal(out.equity,true);
 assert.equal(out.equityToggle,true);
 assert.equal(out.equityExpanded,true);
 assert.equal(out.equityExpandedStyle,'span 8');
 assert.equal(out.equityUnchanged,true);
 assert.equal(out.operationToggle,true);
 assert.equal(out.colsBefore,19);
 assert.equal(out.colsAfter,19);
 assert.equal(out.compactHidden,'none');
 assert.equal(out.compactDateTime,'entryTime');
 assert.notEqual(out.compactHasIdentity,'none');
 assert.notEqual(out.fullRestored,'none');
 assert.equal(out.blocks.length,3);
 for(const block of out.blocks){
  assert.deepEqual(block.primary,['Ops','Resultado','Expectancy','Max DD']);
  assert.equal(block.more,3);
  assert(block.chart);
 }
 assert.equal(out.blockIncomplete,1);
 assert(out.blockText.includes('5/20'));
 assert.equal(out.days,42);
 assert.equal(out.dayUnevaluated,1);
 assert.equal(out.dayZero,1);
 assert.equal(out.dayEmpty,40);
 assert.equal(out.count,'n=2');
 assert(out.calendarLegend.includes('No evaluado'));
 assert.equal(out.pendingNeverZero,true,'A pending, ineligible day must not masquerade as real zero');
 assert.equal(out.pendingClosureLabel,'Pendiente de cierre');
 assert.equal(out.labUntouched,true);
 assert.equal(out.modal,true);
 assert.equal(out.modalInput,1);
 assert.deepEqual(out.modalActions,['Cancelar','Guardar']);
 console.log('TR-VIS PR2 Chromium PASS: Dashboard, register compact/full, Blocks, six-week Calendar, operation modal.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
