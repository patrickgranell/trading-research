/* PR4: presentation-only composition, controls/actions retained in all affected views */
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="https:\/\/cdn\.jsdelivr\.net[^"]*"[^>]*><\/script>/,'');
const probe=String.raw`(async()=>{
 const o={};const wait=ms=>new Promise(done=>setTimeout(done,ms));
 try{
  await wait(460);
  const adapter=window.TradingResearchVisualPR4;if(!adapter)throw Error('PR4 adapter missing');
  const parse=content=>{const t=document.createElement('template');t.innerHTML=content;return t.content;};
  const original={
   plans:plansView(),review:reviewView(),journal:journal(),
   quality:dataQualityView(),decision:researchDecisionCenter(),
   goals:goalsView(),compliance:complianceView(),mistakes:mistakesView(),changes:researchChangesView()
  };
  reportsViewState.tab='builder';original.reports=reportsView();
  const fields=root=>[...root.querySelectorAll('input,select,textarea')].map(x=>x.id||x.name||x.getAttribute('data-tr-onchange')||'').sort();
  const actions=root=>[...root.querySelectorAll('button')].map(x=>x.getAttribute('data-tr-onclick')||x.getAttribute('data-tr-action-click')||x.textContent.trim()).sort();
  o.inventory={};o.checks={};
  for(const [name,markup] of Object.entries(original)){
   const src=parse(markup),dest=parse(adapter.decorate(name,markup));
   o.inventory[name]={originalFields:fields(src).length,originalActions:actions(src).length,
    fieldsSame:JSON.stringify(fields(src))===JSON.stringify(fields(dest)),
    actionsSame:JSON.stringify(actions(src))===JSON.stringify(actions(dest))};
   if(name==='plans'){
    const cards=[...dest.querySelectorAll('.trvis4-plan-card')];
    o.checks.plans={cards:cards.length,meta:cards.every(x=>x.querySelector('.trvis4-plan-sample')),
     primary:cards.every(x=>x.querySelector('.plan-actions>.btn.primary')),
     edit:cards.every(x=>x.querySelector('.plan-actions>.btn:not(.primary)')),
     maintenance:cards.every(x=>x.querySelector('.plan-actions .trvis4-details button'))};
   }
   if(name==='review')o.checks.review={filter:!!dest.querySelector('.trvis4-review-filter .review-filter'),list:!!dest.querySelector('.review-list')};
   if(name==='journal')o.checks.journal={metrics:!!dest.querySelector('.journal-kpis'),controlsPreserved:JSON.stringify(fields(src))===JSON.stringify(fields(dest))};
   if(name==='quality'){
    const a=dest.querySelector('.dq-hero'),b=dest.querySelector('.dq-anomalies'),c=dest.querySelector('.dq-repair'),d=dest.querySelector('.dq-coverage');
    const before=(x,y)=>!!x&&!!y&&!!(x.compareDocumentPosition(y)&Node.DOCUMENT_POSITION_FOLLOWING);
    o.checks.quality={hero:!!a,issue:!!b,repair:!!c,coverage:!!d,priority:before(a,b),queue:before(b,c),secondary:before(c,d)};
   }
   if(name==='decision')o.checks.decision={hero:!!dest.querySelector('.trvis4-compact-status'),priority:!!dest.querySelector('.trvis4-decision-priorities')};
   if(name==='goals')o.checks.goals={list:!!dest.querySelector('.goal-grid'),filter:!!dest.querySelector('.trvis4-goal-filter')};
   if(name==='compliance')o.checks.compliance={filter:!!dest.querySelector('.trvis4-compliance-filter'),coverage:!!dest.querySelector('.trvis4-coverage-primary')};
   if(name==='mistakes')o.checks.mistakes={frequency:!!dest.querySelector('.trvis4-errors-main'),statistics:!!dest.querySelector('.trvis4-secondary-metrics')};
   if(name==='changes')o.checks.changes={history:!!dest.querySelector('.trvis4-change-history'),filter:!!dest.querySelector('.trvis4-changes-filter')};
   if(name==='reports')o.checks.reports={document:!!dest.querySelector('.trvis4-report-document'),
     config:!!dest.querySelector('.trvis4-reports-config'),presets:!!dest.querySelector('.trvis4-reports-presets'),
     print:!!dest.querySelector('.trvis4-print-action')};
  }
  const journalRecord=parse(adapter.decorate('journalops',original.journal));
  o.checks.journalops={filter:!!journalRecord.querySelector('.trvis4-journal-filter .filter-hub')};
  const reflectionFixture='<div class="reflection-kpis"><button type="button" data-tr-action-click="noop">Indicadores</button></div>'+
   '<section class="reflection-history"><div class="reflection-feed"><article class="reflection-card">'+
   '<header>14 octubre 2026</header><div class="reflection-body"><p>Texto completo de una reflexión de prueba.</p></div>'+
   '<footer><button type="button" data-tr-action-click="noop">Editar</button></footer></article></div></section>';
  const reflectionBase=parse(reflectionFixture),reflectionResult=parse(adapter.decorate('journalreflections',reflectionFixture));
  o.checks.reflections={history:!!reflectionResult.querySelector('.reflection-history'),
   cards:!!reflectionResult.querySelector('.trvis4-writing-card'),
   textBeforeKpi:!!(reflectionResult.querySelector('.reflection-history')?.compareDocumentPosition(reflectionResult.querySelector('.reflection-kpis'))&Node.DOCUMENT_POSITION_FOLLOWING),
   actionsUnchanged:JSON.stringify(actions(reflectionBase))===JSON.stringify(actions(reflectionResult))};
  const perspectiveFixture='<section class="perspective-focus-card"><blockquote>Perspectiva completa de prueba.</blockquote>'+
   '<div class="perspective-focus-author">Autor</div><div class="perspective-focus-source">Fuente</div>'+
   '<button type="button" data-tr-action-click="noop">Otra perspectiva</button></section>';
  const perspectiveResult=parse(adapter.decorate('journalreflections',perspectiveFixture));
  o.checks.perspectives={quote:!!perspectiveResult.querySelector('.trvis4-perspective-text'),
   author:!!perspectiveResult.querySelector('.trvis4-source-author'),
   source:!!perspectiveResult.querySelector('.trvis4-source-citation')};
  TradingResearchActions.navigate('plans');await wait(120);
  o.livePlans=document.querySelectorAll('#view .trvis4-plan-card').length;
  const expansion=document.querySelector('#view .plan-card .plan-actions details');
  o.liveActionCount=document.querySelectorAll('#view .plan-card .plan-actions button').length;
  o.liveDetailsCount=document.querySelectorAll('#view .plan-card .plan-actions details').length;
  o.maintenanceOpened=false;
  if(expansion){expansion.querySelector('summary')?.click();o.maintenanceOpened=expansion.open;}
 }catch(e){o.error=String(e?.stack||e)}
 document.body.dataset.trvis4Probe=encodeURIComponent(JSON.stringify(o));
})();`;
html=html.replace('</body>','<script>'+probe+'</script></body>');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trvis4-'));
try{
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,950','--virtual-time-budget=12500','--user-data-dir='+path.join(dir,'profile'),'--dump-dom','file://'+file],{encoding:'utf8',timeout:60000,maxBuffer:21000000});
 assert.equal(run.status,0,run.stderr?.slice(-1300));
 const diagnostic=run.stdout.match(/data-trvis4-probe="([^"]+)"/)?.[1];
 assert(diagnostic,'Missing PR4 diagnostic: '+run.stderr?.slice(-1000));
 const o=JSON.parse(decodeURIComponent(diagnostic));console.log('TR-VIS PR4:',JSON.stringify(o));
 assert(!o.error,o.error);
 for(const [name,entry] of Object.entries(o.inventory)){
  assert(entry.fieldsSame&&entry.actionsSame,'Input/button inventory mutated in '+name);
 }
 for(const [name,checks] of Object.entries(o.checks)){
  for(const [key,value] of Object.entries(checks)){
   if(typeof value==='boolean')assert(value,'Missing '+key+' in '+name);
  }
 }
 assert(o.checks.plans.cards>=1);
 assert(o.livePlans>=1&&o.maintenanceOpened);
 console.log('TR-VIS PR4 PASS: ten view configurations, inventories, plan maintenance and editorial preview');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
