/* TR-VIS PR3 research composition: Chromium smoke + structural regression.
   All trade fixtures are browser-only; no persistent state writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="https:\/\/cdn\.jsdelivr\.net[^"]*"[^>]*><\/script>/,'');
const probe=String.raw`(async()=>{
 const out={};const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  await wait(180);
  const nav=view=>TradingResearchActions.navigate(view);
  out.adapter=!!window.TradingResearchVisualPR3;
  nav('lab');await wait(120);
  let root=document.querySelector('#view'),wrap=root.querySelector('.trvis3-lab-filters');
  const original=document.createElement('template');original.innerHTML=labFilterPanel();
  const baseIds=[...original.content.querySelectorAll('input[id],select[id]')].map(el=>el.id);
  const actualIds=[...wrap?.querySelectorAll('input[id],select[id]')||[]].map(el=>el.id);
  out.lab={wrap:!!wrap,closed:wrap?.open===false,tabs:root.querySelectorAll('.tr6-task-tabs [role="tab"]').length,
   ahead:!!root.querySelector('.tr6-lab-navigation')&&root.querySelector('.tr6-lab-navigation').compareDocumentPosition(wrap)&Node.DOCUMENT_POSITION_FOLLOWING,
   inputIdsEqual:JSON.stringify(baseIds)===JSON.stringify(actualIds),
   unitVisible:!!root.querySelector('.trvis3-lab-unitbar .metric-switch'),
   sampleText:root.querySelector('.tr6-context-line')?.textContent||'',
   filterStatus:root.querySelector('.trvis3-lab-filter-summary')?.textContent||''};
  wrap.open=true;await wait(70);
  TradingResearchActions.tr6LabGroup('validation');await wait(100);
  root=document.querySelector('#view');
  out.validation={open:root.querySelector('.trvis3-lab-filters')?.open===true,
   note:!!root.querySelector('.trvis3-validation-explanation'),
   source:!!root.querySelector('[data-tr6-group="validation"] .forward-panel'),
   tabSelected:root.querySelector('.tr6-task-tabs [aria-selected="true"]')?.textContent||'',
   layout:root.querySelector('[data-tr6-group="validation"]')?.classList.contains('trvis3-validation-layout')};
  TradingResearchActions.tr6LabGroup('segmentation');await wait(80);
  out.segment={legend:!!document.querySelector('#view .trvis3-grid-legend'),
   tabSelected:document.querySelector('#view .tr6-task-tabs [aria-selected="true"]')?.textContent||''};
  nav('tpbuilder');await wait(110);root=document.querySelector('#view');
  const baseOpt=String(root.querySelector('#tpb-layer')?.value||'');
  out.builder={exists:!!root.querySelector('#tp-builder-view'),source:!!root.querySelector('.trvis3-builder-source-field #tpb-source'),
   filters:!!root.querySelector('.trvis3-builder-filters #tpb-date-from'),
   comparison:!!root.querySelector('.trvis3-builder-comparison'),
   action:!!root.querySelector('.trvis3-builder-create-row [data-tr-action-click="tpBuilderOpenCreate"]'),
   preservedRaw:root.querySelector('#tpb-layer')?.value===baseOpt,
   noDuplicate:root.querySelectorAll('#tpb-date-from').length===1};
  nav('gallery');await wait(110);root=document.querySelector('#view');
  out.gallery={details:!!root.querySelector('.trvis3-gallery-filters'),hidden:root.querySelector('.trvis3-gallery-filters')?.open===false,
   selection:!!root.querySelector('#galleryCompareCount'),filters:root.querySelectorAll('.trvis3-gallery-filters :is(input,select)').length,
   controlsUnique:root.querySelectorAll('#galQ').length===1};
  const pid=getCurrentPlan()?.id;
  if(pid){
   const examples=Array.from({length:4},(_,i)=>({
    id:'_PR3_CAPTURE_'+i,tradingPlanId:pid,contract:'MCL',direction:'LONG',
    entryDate:'2026-09-'+String(10+i).padStart(2,'0')+'T18:00:00',
    result:'win',rMultiple:2,images:[{id:'_PR3_IMAGE_'+i,label:'Contexto',caption:'Imagen de prueba '+i}]
   }));
   state.operations.push(...examples);
   for(const n of [2,3,4]){
    gallerySelected.splice(0,gallerySelected.length,...examples.slice(0,n).map(x=>x.id));
    openGalleryCompare();
    const overlay=[...document.querySelectorAll('.modal-backdrop,.modal-overlay')].at(-1)||document;
    out['compare'+n]={count:overlay.querySelectorAll('.compare-trade').length,images:overlay.querySelectorAll('.compare-trade img').length};
    closeModal();
   }
   state.operations.splice(state.operations.findIndex(x=>x.id===examples[0].id),examples.length);
  }
  nav('market');await wait(110);root=document.querySelector('#view');
  out.market={tabs:root.querySelectorAll('.tr6-market-tabs [role="tab"]').length,
   source:!!root.querySelector('.trvis3-market-sources'),
   introMoved:!!root.querySelector('.trvis3-market-source-content .notice'),
   preserved:!!root.querySelector('.tr6-market-source-content,.tr6-market-context')};
 }catch(e){out.error=String(e?.stack||e)}
 document.body.setAttribute('data-trvis3-probe',encodeURIComponent(JSON.stringify(out)));
})();`;
html=html.replace('</body>','<script>'+probe.replace(/<\/script/gi,'<\\/script')+'</script></body>');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-vis3-'));
try{
 const filename=path.join(folder,'index.html');fs.writeFileSync(filename,html);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,950','--virtual-time-budget=9000','--user-data-dir='+path.join(folder,'profile'),'--dump-dom','file://'+filename],{encoding:'utf8',timeout:60000,maxBuffer:18000000});
 assert.equal(run.status,0,run.stderr?.slice(-1400));
 const match=run.stdout.match(/data-trvis3-probe="([^"]+)"/);
 assert(match,'Missing PR3 result: '+run.stderr?.slice(-1500));
 const o=JSON.parse(decodeURIComponent(match[1]));console.log('TR-VIS PR3',JSON.stringify(o));
 assert(!o.error,o.error);
 assert(o.adapter);
 for(const field of ['wrap','closed','ahead','inputIdsEqual','unitVisible'])assert(o.lab[field],'lab.'+field);
 assert.equal(o.lab.tabs,5);
 assert(o.lab.sampleText.includes('operaciones'));
 assert(o.validation.open&&o.validation.note&&o.validation.source&&o.validation.layout);
 assert(o.segment.legend);
 for(const field of ['exists','source','filters','comparison','action','preservedRaw','noDuplicate'])assert(o.builder[field],'builder.'+field);
 for(const field of ['details','hidden','selection','controlsUnique'])assert(o.gallery[field],'gallery.'+field);
 assert(o.gallery.filters>=8);
 for(const n of [2,3,4]){
  assert.equal(o['compare'+n]?.count,n,'comparison '+n);
  assert.equal(o['compare'+n]?.images,n,'image count '+n);
 }
 assert.equal(o.market.tabs,4);assert(o.market.source&&o.market.preserved);
 console.log('TR-VIS PR3 PASS — 3A Lab, 3B builder, 3C gallery comparison 2/3/4, Market Data');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
