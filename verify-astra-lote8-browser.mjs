import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const baseHtml=fs.readFileSync('dist/index.html','utf8');
const check=String.raw`(async()=>{
 const out={};
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  await sleep(1500); // Headless startup may asynchronously reload initial state. Wait before adding disposable fixtures.
  out.installed=!!globalThis.TradingResearchAstraLote8;
  const plan=getCurrentPlan();
  const opsBefore=state.operations.length;
  const weekdays=[[1,'2026-10-12T17:00:00'],[3,'2026-10-14T17:00:00']];
  for(const [day,at] of weekdays){
   state.operations.push({id:'TR8_FIXTURE_'+day,tradingPlanId:plan.id,entryDate:at,exitDate:at,
    result:'win',resultTicks:20,rMultiple:2,pnlNet:35,pnlGross:40,commission:5,
    setup:'TR8 Setup',direction:'LONG',recordClass:'backtest',executionIntent:'backtest'});
  }
  // The test runs under a unique file:// origin. Persisting fixtures here
  // prevents late state-hydration from discarding them during visual rerenders.
  if(typeof persist==='function')persist();
  await sleep(160);
  TradingResearchActions.navigate('tpbuilder');await sleep(220);
  const root=()=>document.querySelector('#tp-builder-view');
  const group=()=>root()?.querySelector('.tr8-week-selector');
  const buttons=()=>[...(group()?.querySelectorAll('button[data-day]')||[])];
  out.week=!!group()&&buttons().length===7;
  out.order=buttons().map(x=>x.dataset.day).join(',')==='0,1,2,3,4,5,6';
  out.names=buttons().every((b,i)=>b.getAttribute('aria-label')===['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][i]);
  out.unselected=buttons().every(b=>b.getAttribute('aria-pressed')==='false');
  out.originalAction=buttons().every(b=>b.dataset.trActionClick==='tpBuilderToggleDay');
  out.equalSizes=buttons().every(b=>Math.abs(b.getBoundingClientRect().width-buttons()[0].getBoundingClientRect().width)<2);
  out.minimumDayWidth=buttons().every(b=>b.getBoundingClientRect().width>=32);
  out.responsiveColumns=getComputedStyle(group()).gridTemplateColumns.split(' ').length;
  const buttonDay=d=>root().querySelector('.tr8-week-day[data-day="'+d+'"]');
  const resultCount=()=>{const s=root()?.querySelector('[data-tr-action-click="tpBuilderOpenCreate"]')?.textContent||'';const m=s.match(/([0-9]+) trades/);return m?Number(m[1]):-1;};
  out.before=resultCount();
  buttonDay(1)?.click();await sleep(110);
  out.firstSelected=buttonDay(1)?.getAttribute('aria-pressed')==='true'&&buttonDay(1)?.classList.contains('active');
  out.oneFiltered=resultCount();
  buttonDay(3)?.click();await sleep(110);
  out.multiSelected=buttonDay(1)?.getAttribute('aria-pressed')==='true'&&buttonDay(3)?.getAttribute('aria-pressed')==='true';
  out.multiCount=resultCount();
  buttonDay(1)?.click();await sleep(110);
  out.deselected=buttonDay(1)?.getAttribute('aria-pressed')==='false'&&buttonDay(3)?.getAttribute('aria-pressed')==='true';
  out.endCount=resultCount();
  const focus=buttonDay(3);
  focus?.focus();await sleep(15);
  out.focus=focus===document.activeElement&&getComputedStyle(focus).outlineStyle!=='none';
  out.hitTargets=buttons().every(b=>b.getBoundingClientRect().height>=32);
  out.weekMeasurements={groupScroll:group().scrollWidth,groupClient:group().clientWidth,rowScroll:group().parentElement.scrollWidth,rowClient:group().parentElement.clientWidth};
  out.weekOverflow=group().scrollWidth<=group().clientWidth+2&&group().parentElement.scrollWidth<=group().parentElement.clientWidth+2;
  out.dayDataUntouched=state.operations.length===opsBefore+2;
  const fixture=document.createElement('section');
  fixture.innerHTML='<div class="page-title"><h2>Curva de Equity</h2></div><div class="panel-title"><h3>Confianza estadística</h3></div><div class="block-core-grid"><span>MFE medio</span></div><table class="table"><thead><tr><th>MAE medio</th></tr></thead></table>';
  document.body.append(fixture);
  globalThis.TradingResearchContextHelpPresentationContract.apply();
  const icons=[...fixture.querySelectorAll('.info-dot')];
  out.iconExamples=icons.length===4;
  out.iconTarget=icons.every(el=>Math.round(el.getBoundingClientRect().width)>=28&&Math.round(el.getBoundingClientRect().height)>=28);
  out.iconScale=icons.map(el=>Math.round(parseFloat(getComputedStyle(el,'::before').width)));
  out.typographicHierarchy=out.iconScale[0]>out.iconScale[1]&&out.iconScale[1]>out.iconScale[2]&&out.iconScale[2]===out.iconScale[3];
  out.noLargeTextWrap=icons.every(el=>parseFloat(getComputedStyle(el,'::before').width)<20);
  out.accessibleNames=icons.every(el=>el.tagName==='BUTTON'&&!!el.getAttribute('aria-label')&&!!el.dataset.helpId);
  const help=icons[1];help.focus();
  out.iconFocus=help===document.activeElement&&getComputedStyle(help).outlineStyle!=='none';
  help.click();await sleep(45);
  out.tooltipContent=!!document.querySelector('.context-help-modal');
  const modal=document.querySelector('.modal-backdrop');if(modal)modal.remove();
  out.themeWidth={};
  for(const t of ['dark','light']){
   document.documentElement.dataset.theme=t;
   const active=buttonDay(3),inactive=buttonDay(1);
   out.themeWidth[t]={active:getComputedStyle(active).backgroundColor,inactive:getComputedStyle(inactive).backgroundColor,focus:getComputedStyle(active).outlineColor};
  }
  out.themesDiffer=Object.values(out.themeWidth).every(x=>x.active!==x.inactive);
  fixture.remove();
  TradingResearchActions.navigate('operations');await sleep(150);
  const opsWeek=document.querySelector('#view .day-filter-row .tr8-week-selector');
  out.operationsWeek=!!opsWeek&&opsWeek.querySelectorAll('button[data-day-chip]').length===7;
  out.operationsOrder=[...(opsWeek?.querySelectorAll('button[data-day-chip]')||[])].map(b=>b.dataset.dayChip).join(',')==='1,2,3,4,5,6,0';
  const opsMonday=opsWeek?.querySelector('button[data-day-chip="1"]');
  out.operationsOriginalAction=!!opsMonday&&(!!opsMonday.dataset.trActionClick||!!opsMonday.dataset.trOnclick);
  opsMonday?.click();await sleep(80);
  out.operationsPressed=opsMonday?.getAttribute('aria-pressed')==='true'&&opsMonday?.classList.contains('active');
  opsMonday?.click();await sleep(80);
  out.operationsDeselected=opsMonday?.getAttribute('aria-pressed')==='false'&&!opsMonday?.classList.contains('active');

 }catch(e){out.error=String(e?.stack||e);}
 document.body.setAttribute('data-tr8-results',encodeURIComponent(JSON.stringify(out)));
})();`;
const file=baseHtml.replace('</body>','<script>'+check+'</script></body>');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tr-lote8-'));
try{
 const source=path.join(tmp,'index.html');fs.writeFileSync(source,file);
 let chrome=null;
 for(const b of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)){
  if(spawnSync(b,['--version'],{encoding:'utf8'}).status===0){chrome=b;break;}
 }
 assert(chrome,'Chromium required for Lote 8 visual certification');
 for(const width of [1280,500]){
  const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--window-size=${width},920`,'--virtual-time-budget=12000','--dump-dom','file://'+source],{encoding:'utf8',timeout:45000,maxBuffer:8500000});
  assert.equal(run.status,0,run.stderr?.slice(-1000));
  const match=run.stdout.match(/data-tr8-results="([^"]+)"/);
  assert(match,'Missing Chromium Lote 8 output: '+run.stderr?.slice(-1000));
  const out=JSON.parse(decodeURIComponent(match[1]));
  console.log('Lote 8 Chromium',width,JSON.stringify(out));
  for(const key of ['installed','week','order','names','unselected','originalAction','equalSizes','minimumDayWidth','firstSelected','multiSelected','deselected','focus','hitTargets','weekOverflow','dayDataUntouched','iconExamples','iconTarget','typographicHierarchy','noLargeTextWrap','accessibleNames','iconFocus','tooltipContent','themesDiffer','operationsWeek','operationsOrder','operationsOriginalAction','operationsPressed','operationsDeselected']){
   assert.equal(out[key],true,key+' FAIL: '+JSON.stringify(out));
  }
  assert.equal(out.iconScale.length,4);
  assert(out.before>=2,'Need source trades for test');
  assert.equal(out.oneFiltered,1,'Monday filter must include exactly the Monday fixture');
  assert.equal(out.multiCount,2,'Multi-selected weekdays must restore both fixtures');
  assert.equal(out.endCount,1,'Deselecting Monday must keep Wednesday');
 }
 console.log('Astra Lote 8 Chromium PASS: dark/light info hierarchy, tooltip and 28px hit, weekday multi-selection and responsive');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
