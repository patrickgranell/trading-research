/* PR3 visual review regressions: full viewport media, independent final OOS
 * and column editor in TP Builder. All fixtures live only in disposable Chrome. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const html=fs.readFileSync('dist/index.html','utf8');
const check=String.raw`(async()=>{
 const o={},wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  await wait(400);
  TradingResearchActions.navigate('lab');await wait(95);
  o.tabs=[...document.querySelectorAll('.tr6-task-tabs [role=tab]')].map(b=>b.getAttribute('aria-controls'));
  TradingResearchActions.tr6LabGroup('validation');await wait(70);
  o.validationNoOos=!document.querySelector('[data-tr6-group=validation] .forward-panel');
  TradingResearchActions.tr6LabGroup('oos');await wait(70);
  o.oosVisible=!!document.querySelector('[data-tr6-group=oos] .forward-panel')&&
   document.querySelector('[data-tr6-group=oos]')?.hidden===false;
  o.oosIntro=!!document.querySelector('[data-tr6-group=oos] .trvis3-oos-intro');
  TradingResearchActions.navigate('tpbuilder');await wait(95);
  const plan=getCurrentPlan();
  const demo=[
   {id:'_BC_1',entryDate:'2026-10-10T17:00',exitDate:'2026-10-10T18:00',
    tradingPlanId:plan.id,contract:'MCL',contracts:2,direction:'LONG',setup:'Estructura',vd:'REC',h4Context:'EA Norm',
    result:'win',resultTicks:60,rMultiple:2,pnlGross:60,pnlNet:56.8,commission:3.2,
    executionLots:[{quantity:1,resultTicks:20,status:'closed'},{quantity:1,resultTicks:40,status:'closed'}]},
   {id:'_BC_2',entryDate:'2026-10-11T17:00',tradingPlanId:plan.id,contract:'MCL',
    direction:'SHORT',setup:'Giro',result:'pending'}
  ];
  const contract=globalThis.TradingResearchBuilderColumnContract;
  o.columnContract=!!contract;
  const original=document.querySelector('#view #tp-builder-view .trvis3-bc-root');
  o.originalPreview=!!original;
  if(original)original.outerHTML=contract.render(demo,plan);
  let base=document.querySelector('#view #tp-builder-view .trvis3-bc-root');
  o.columnCount=contract.count;
  o.defaultColumns=[...base.querySelectorAll('th')].map(t=>t.textContent);
  base.querySelector('[data-trvis3-bc-toggle]')?.click();
  base=document.querySelector('#view #tp-builder-view .trvis3-bc-root');
  o.pickerOpen=!base.querySelector('[data-trvis3-bc-panel]')?.hidden;
  o.available=base.querySelectorAll('[data-trvis3-bc-visible]').length;
  const qty=base.querySelector('[data-trvis3-bc-visible=contracts]');
  o.addedOption=!!qty&&!qty.checked;
  qty.checked=true;qty.dispatchEvent(new Event('change',{bubbles:true}));
  base=document.querySelector('#view #tp-builder-view .trvis3-bc-root');
  o.contractsVisible=[...base.querySelectorAll('th')].some(t=>t.textContent==='N.º contratos');
  o.contractValue=[...base.querySelectorAll('tbody tr')].some(row=>[...row.cells].some(td=>td.textContent==='2'));
  const lot=base.querySelector('[data-trvis3-bc-visible=lot1]');
  lot.checked=true;lot.dispatchEvent(new Event('change',{bubbles:true}));
  base=document.querySelector('#view #tp-builder-view .trvis3-bc-root');
  o.lotVisible=[...base.querySelectorAll('th')].some(t=>t.textContent.includes('Lote 1'));
  o.lotValue=[...base.querySelectorAll('tbody tr')].some(row=>row.textContent.includes('20t/ct'));
  const before=contract.read(plan.id).order.indexOf('contracts');
  base.querySelector('[data-trvis3-bc-move=contracts][data-delta="-1"]')?.click();
  const after=contract.read(plan.id).order.indexOf('contracts');
  o.reordered=after===before-1;
  o.persisted=JSON.parse(localStorage.getItem('tradingResearchBuilderPreviewColumnsV1')||'{}')[plan.id]?.order?.includes('contracts');
  base=document.querySelector('#view #tp-builder-view .trvis3-bc-root');
  base.querySelector('[data-trvis3-bc-visible=contracts]').checked=false;
  base.querySelector('[data-trvis3-bc-visible=contracts]').dispatchEvent(new Event('change',{bubbles:true}));
  o.hiddenAgain=![...document.querySelectorAll('#view #tp-builder-view .trvis3-bc-table th')].some(t=>t.textContent==='N.º contratos');
  // Fullscreen image presentation works even when image bytes are absent
  // from this isolated profile; object-fit must preserve actual image aspect.
  TradingResearchActions.navigate('gallery');await wait(90);
  openImageLightbox('_TRVIS3_TEST_IMAGE_','Prueba imagen completa');await wait(75);
  let modal=document.querySelector('.modal-backdrop:has(.lightbox-wrap)>.modal');
  const size=modal?.getBoundingClientRect();
  o.single={width:size?.width/innerWidth,height:size?.height/innerHeight,
   fit:modal?.querySelector('.lightbox-image')?getComputedStyle(modal.querySelector('.lightbox-image')).objectFit:null};
  closeModal();
  const demos=Array.from({length:4},(_,i)=>({id:'_TRVIS3_FULLSCREEN_'+i,
   tradingPlanId:plan.id,contract:'MCL',direction:'LONG',entryDate:'2026-09-0'+(i+1)+'T18:00',
   rMultiple:2,images:[{id:'_TRVIS3_CAPTURE_'+i,label:'Entrada'}]}));
  state.operations.push(...demos);
  for(const n of [2,3,4]){
   gallerySelected.splice(0,gallerySelected.length,...demos.slice(0,n).map(x=>x.id));
   openGalleryCompare();await wait(55);
   const overlay=document.querySelector('.modal-backdrop:has(.compare-grid .compare-trade)');
   const m=overlay?.querySelector('.modal'),b=m?.getBoundingClientRect();
   const grid=m?.querySelector('.tr5-compare-grid')||m?.querySelector('.compare-grid');
   o['compare'+n]={width:b?.width/innerWidth,height:b?.height/innerHeight,
    count:m?.querySelectorAll('.compare-trade').length,
    fit:m?.querySelector('.tr5-primary-capture img')?getComputedStyle(m.querySelector('.tr5-primary-capture img')).objectFit:null,
    columns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:null};
   closeModal();
  }
  state.operations.splice(state.operations.findIndex(x=>x.id===demos[0].id),demos.length);
 }catch(e){o.error=String(e?.stack||e)}
 document.body.setAttribute('data-trvis3-review',encodeURIComponent(JSON.stringify(o)));
})();`;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'trvis3-review-'));
try{
 const filename=path.join(tmp,'index.html');fs.writeFileSync(filename,html.replace('</body>','<script>'+check+'</script></body>'));
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(cmd=>spawnSync(cmd,['--version'],{encoding:'utf8'}).status===0);assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,950','--virtual-time-budget=11000','--user-data-dir='+path.join(tmp,'profile'),'--dump-dom','file://'+filename],{encoding:'utf8',timeout:60000,maxBuffer:18000000});
 assert.equal(run.status,0,run.stderr?.slice(-1500));
 const encoded=run.stdout.match(/data-trvis3-review="([^"]+)"/)?.[1];
 assert(encoded,'Missing PR3 review diagnostic: '+run.stderr?.slice(-1200));
 const o=JSON.parse(decodeURIComponent(encoded));console.log('PR3 review',JSON.stringify(o));
 assert(!o.error,o.error);
 assert.equal(o.tabs.length,6);assert.deepEqual(o.tabs.slice(-2),['tr6-lab-risk','tr6-lab-oos']);
 assert(o.validationNoOos&&o.oosVisible&&o.oosIntro);
 assert(o.columnContract&&o.originalPreview&&o.columnCount>=25);
 assert(o.defaultColumns.length===7);
 for(const k of ['pickerOpen','addedOption','contractsVisible','contractValue','lotVisible','lotValue','reordered','persisted','hiddenAgain'])assert(o[k],k+' failed');
 assert(o.available>=25);
 assert(o.single.width>=.92&&o.single.height>=.92);
 assert.equal(o.single.fit,'contain');
 for(const n of [2,3,4]){
  const c=o['compare'+n];
  assert(c?.width>=.92&&c.height>=.92,'full screen comparison '+n);
  assert.equal(c.count,n);assert.equal(c.fit,'contain');
  assert.equal(c.columns,n===4?2:n);
 }
 console.log('PR3 review PASS: OOS independent after Risk, per-source column visibility/order, viewport media, comparisons 2/3/4');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
