/* Audit R3 / PR1: real bundled application, isolated ephemeral browser data. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const probe=String.raw`(async()=>{
 const out={},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(yes,message)=>{if(!yes)throw Error(message);};
 const el=id=>document.getElementById(id);
 const change=(id,value)=>{const e=el(id);check(e,'Missing '+id);if(e.closest('details'))e.closest('details').open=true;e.focus();e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
 try{
  await wait(650);
  if(localStorage.getItem('GF_TEST_RELOAD')){
   const f=TradingResearchSharedFilters;
   check(f.snapshot().filters.direction==='SHORT','Selection restored after real reload');
   check(f.snapshot().unit==='usd'&&f.snapshot().basis==='net','Unit/base restored after reload');
   check(getCurrentPlan().savedStudies.some(s=>s.name==='GF saved SHORT'),'Saved view survives reload');
   const hypothesis=getCurrentPlan().forwardTests.find(t=>t.name==='GF frozen LONG');
   check(hypothesis?.lab.direction==='LONG','Frozen criteria survive reload');
   TradingResearchActions.navigate('tpbuilder');
   check(f.snapshot().recipe&&f.snapshot().filters.direction==='LONG'&&f.snapshot().filters.days.includes(1),'Recipe restored independently after reload');
   TradingResearchActions.navigate('operations');check(f.snapshot().filters.direction==='SHORT','Recipe reload does not leak into selection');
   out.reload=true;out.pass=true;document.body.setAttribute('data-gf-probe',encodeURIComponent(JSON.stringify(out)));return;
  }
  const F=TradingResearchSharedFilters,A=TradingResearchActions,p=getCurrentPlan(),pid=p.id;
  p.planEnvironment='backtest';
  const fixture=Array.from({length:8},(_,i)=>({id:'GF_FIX_'+i,tradingPlanId:pid,
   entryDate:'2026-10-'+String(12+i).padStart(2,'0')+'T19:00:00',
   ...(i?{exitDate:'2026-10-'+String(12+i).padStart(2,'0')+'T19:30:00',result:i<4?'win':'loss',resultTicks:i<4?20:-10,rMultiple:i<4?2:-1,pnlGross:i<4?10:-5,pnlNet:i<4?9:-6}: {result:'pending'}),
   direction:i<4?'LONG':'SHORT',contract:'MYM',commission:1,riskTickExposure:10,
   instrumentSnapshot:{symbol:'MYM',tickValue:.5},raw:{source:'manual'},images:i%2?[{id:'GF_IMG_'+i,label:i<4?'Entrada':'Salida'}]:[],taxonomyValues:{}}));
  state.operations.push(...fixture);persist();A.navigate('operations');await wait(80);
  F.apply({direction:'LONG'});await wait(60);
  out.raw=universeCount();function universeCount(){return state.operations.filter(o=>o.tradingPlanId===pid).length;}
  check(F.sample().length===4,'LONG selection must retain four records including pending');
  const domainBeforeRead=JSON.stringify(state.tradingPlans);F.sample();check(JSON.stringify(state.tradingPlans)===domainBeforeRead,'Reading selection must not normalize or mutate plans');
  check(calcMetricStats(F.sample(),'ticks','net').n===3,'Only three LONG trades are eligible');
  const tax=TradingResearchTaxonomyDomain;
  TRDomainStore.commit('fixture.shared-taxonomy',()=>{
   tax.createTaxonomy(p,{id:'GF_CUSTOM',name:'GF custom'});tax.addValue(p,'GF_CUSTOM',{id:'GF_VALUE',name:'GF value'});
   state.operations.find(o=>o.id==='GF_FIX_1').taxonomyValues.GF_CUSTOM='GF_VALUE';
  },{persist:true,render:false});
  F.apply({taxonomyFilters:{GF_CUSTOM:'GF_VALUE'}});check(F.sample().length===1,'Custom taxonomy filters the common sample');
  TRDomainStore.commit('fixture.archive-taxonomy',()=>{tax.renameTaxonomy(p,'GF_CUSTOM','GF renamed');tax.archiveTaxonomy(p,'GF_CUSTOM',true);},{persist:true,render:false});
  render();check(F.sample().length===1,'Archived selection retains its meaning');check(document.querySelectorAll('[data-gf-field="tax:GF_CUSTOM"]').length===1,'One visible canonical taxonomy criterion');
  F.apply({direction:'LONG'});
  out.views={};
  for(const view of ['operations','lab','dashboard','calendar','gallery','config','journal','tpbuilder']){
   A.navigate(view);await wait(85);
   check(!!el('gf-trigger'),'Universal trigger '+view);
   check(!document.querySelector('#view .filter-hub,#view .trvis3-lab-filters'),'Local filter blocks removed '+view);
   if(view!=='tpbuilder')check(F.snapshot().filters.direction==='LONG','Selection retained '+view);
   out.views[view]=true;
  }
  A.navigate('operations');await wait(60);A.gfToggle();
  check(!el('gf-panel').hidden&&el('app').hasAttribute('inert'),'Drawer isolates background');
  change('gf-direction','SHORT');await wait(40);check(F.sample().length===4,'Actual control changes selection');
  check(document.activeElement.id==='gf-direction','Focus survives changing filters');
  A.gfClose();check(document.activeElement.id==='gf-trigger','Closing returns focus');
  check(el('gf-panel').hidden&&F.snapshot().filters.direction==='SHORT','Closing retains filters');
  A.gfToggle();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check(el('gf-panel').hidden,'Escape closes');
  A.gfSave();el('gf-save-name').value='GF saved SHORT';A.gfSaveCommit();await wait(80);
  const study=p.savedStudies.find(s=>s.name==='GF saved SHORT');check(study&&study.lab.direction==='SHORT','Saved view uses existing durable studies');
  F.apply({direction:'LONG'});A.gfToggle();change('gf-view',study.id);await wait(30);check(F.snapshot().filters.direction==='SHORT','Recover exact saved view');
  A.gfClose();
  F.apply({direction:'LONG'});A.gfFreeze();el('f-forward-name').value='GF frozen LONG';A.freezeCurrentHypothesis();await wait(80);
  const frozen=p.forwardTests.find(t=>t.name==='GF frozen LONG');check(frozen,'Hypothesis created');
  const frozenJson=JSON.stringify(frozen),frozenCriteria=JSON.stringify(frozen.lab),baseline=frozen.baselineOpIds.length;
  F.apply({direction:'SHORT'});check(JSON.stringify(frozen)===frozenJson,'Working filters cannot rewrite OOS');
  const later={...fixture[1],id:'GF_FUTURE_LONG',entryDate:'2026-10-21T19:00:00',exitDate:'2026-10-21T19:30:00'};
  state.operations.push(later);persist();
  check(forwardFrozenOps(frozen).map(o=>o.id).join(',')===later.id,'OOS uses frozen LONG criteria despite current SHORT');
  check(frozen.baselineOpIds.length===baseline&&JSON.stringify(frozen.lab)===frozenCriteria,'Baseline and criteria immutable');
  A.gfToggle();change('gf-oos',frozen.id);await wait(40);check(F.snapshot().filters.direction==='LONG','Recover OOS criteria');
  change('gf-direction','SHORT');check(el('gf-panel').textContent.includes('cambios sin congelar'),'OOS divergence is visible');A.gfClose();
  const emptyClosed={...frozen,status:'closed',finalOpIds:[]};check(forwardFrozenOps(emptyClosed).length===0,'An empty closed OOS stays empty');
  A.gfReset();check(F.count()===0,'Reset');
  A.gfToggle();change('gf-policy','raw');check(F.count()===0,'Sin recorte is not counted');A.gfClose();
  F.apply({direction:'SHORT'});A.navigate('gallery');A.gfToggle();change('gf-imageLabel','Entrada');A.gfClose();
  check(galleryFilteredOps().length===0,'Image-specific filter only limits gallery');
  A.navigate('dashboard');check(F.sample().length===4,'Image criterion does not cut equity');
  A.gfUnit('usd');A.gfBasis('net');await wait(80);
  const resultCard=[...document.querySelectorAll('.dashboard-kpis-custom .kpi')].find(c=>c.querySelector('.label')?.textContent.startsWith('Expectancy'));
  check(resultCard?.querySelector('.value')?.textContent.includes('6'),'Dashboard metrics use selected SHORT net values');
  const second=clone(p);second.id='GF_OTHER_TP';second.name='GF Other';second.savedStudies=[];second.forwardTests=[];state.tradingPlans.push(second);persist();
  A.switchPlan(second.id);check(F.count()===0,'No incompatible TP filters carried');A.switchPlan(pid);check(F.snapshot().filters.direction==='SHORT','Original TP selection restored');
  const before=F.snapshot().filters;
  A.navigate('tpbuilder');F.apply({direction:'LONG',days:[1]});await wait(70);
  check(F.snapshot().recipe,'Builder has an explicit recipe');check(F.snapshot().filters.direction==='LONG','Recipe edited');
  const recipe=TradingResearchBuilderSelectionContract.read();check(recipe.filters.days[0]===1,'Recipe state used by builder');
  A.gfSave();el('gf-save-name').value='GF recipe';A.gfSaveCommit();check(p.savedStudies.some(s=>s.name==='GF recipe'&&s.lab.days.includes(1)),'Builder can save its view');
  A.navigate('operations');check(JSON.stringify(F.snapshot().filters)===JSON.stringify(before),'Builder does not alter common selection');
  A.navigate('lab');A.tr6LabGroup('oos');await wait(40);
  check(document.querySelector('.tr6-task-tabs [role=tab]:last-child').getAttribute('aria-controls')==='tr6-lab-oos','OOS remains last');
  check(!!document.querySelector('[data-tr6-group=oos] .forward-panel'),'OOS tracking preserved');
  A.navigate('operations');A.gfToggle();
  const days=[...document.querySelectorAll('#gf-panel [data-gf-day]')];check(days.map(b=>b.dataset.gfDay).join(',')==='1,2,3,4,5,6,0','Monday first');
  out.themes={};
  for(const theme of ['dark','light']){document.documentElement.dataset.theme=theme;await wait(20);const rect=el('gf-panel').getBoundingClientRect();check(rect.width<=innerWidth&&rect.right<=innerWidth+1,'Panel fits '+theme);check(el('gf-panel').scrollWidth<=el('gf-panel').clientWidth+1,'No drawer horizontal overflow');out.themes[theme]=getComputedStyle(el('gf-panel')).backgroundColor;}
  A.gfClose();
  check(TradingResearchRender.diagnostics().canonicalEntry,'Canonical renderer ownership retained');
  check(!document.querySelector('#view .notice.danger'),'No render error');
  const stored=JSON.parse(localStorage.getItem('tradingResearchSharedSelectionV1'));check(Object.values(stored.contexts).some(x=>x.filters.direction==='SHORT'),'Selection persisted for reload');
  await trCoreFlush();
  localStorage.setItem('GF_TEST_RELOAD','1');
  out.pending=3;out.oos=true;out.saved=true;out.isolation=true;out.focus=true;out.pass=true;
 }catch(e){out.error=String(e?.stack||e);}
 document.body.setAttribute('data-gf-probe',encodeURIComponent(JSON.stringify(out)));
})();`;
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-shared-filters-'));
try{
 const file=path.join(folder,'index.html');fs.writeFileSync(file,fs.readFileSync('dist/index.html','utf8').replace('</body>','<script>'+probe+'</script></body>'));
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);assert(chrome,'Chromium required');
 for(const size of ['1366,900','1920,1080'])for(const phase of ['initial','reload']){
  const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size='+size,'--virtual-time-budget=18000','--user-data-dir='+path.join(folder,size),'--dump-dom','file://'+file],{encoding:'utf8',timeout:60000,maxBuffer:24000000});
  assert.equal(run.status,0,run.stderr?.slice(-1000));const match=run.stdout.match(/data-gf-probe="([^"]+)"/);assert(match,'Missing shared filter output '+run.stderr?.slice(-500));const out=JSON.parse(decodeURIComponent(match[1]));console.log(size,phase,JSON.stringify(out));assert(!out.error,out.error);assert(out.pass);if(phase==='reload')assert(out.reload);else assert.notEqual(out.themes.dark,out.themes.light);
 }
 console.log('Shared filters Chromium PASS: routes, pending eligibility, views, OOS immutability, recipe/TP isolation, image scope, unit/base, focus and both themes/resolutions.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
