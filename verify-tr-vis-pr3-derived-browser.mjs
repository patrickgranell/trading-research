/* PR3: Derivation must freeze an independent copy without mutating the source.
   Isolated ephemeral Chromium file:// profile; the fixture is not real user data. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="https:\/\/cdn\.jsdelivr\.net[^"]*"[^>]*><\/script>/,'');
const probe=String.raw`(async()=>{
 const out={},wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  await wait(450);
  const p=getCurrentPlan();if(!p)throw Error('Source TP missing');
  const originals=state.operations.filter(o=>o.tradingPlanId===p.id).map(o=>o.id);
  const fixture=[
   {id:'_TRVIS3_DERIVE_1',tradingPlanId:p.id,entryDate:'2026-10-01T18:00:00',exitDate:'2026-10-01T18:12:00',contract:'MCL',direction:'LONG',result:'win',resultTicks:20,rMultiple:2,pnlGross:20,pnlNet:19},
   {id:'_TRVIS3_DERIVE_2',tradingPlanId:p.id,entryDate:'2026-10-02T18:00:00',exitDate:'2026-10-02T18:12:00',contract:'MCL',direction:'SHORT',result:'loss',resultTicks:-10,rMultiple:-1,pnlGross:-10,pnlNet:-11}
  ];
  state.operations.push(...fixture);
  if(typeof persist==='function')persist();
  TradingResearchActions.navigate('tpbuilder');await wait(160);
  const source=document.querySelector('#tpb-source');
  if(!source)throw Error('Source selector absent');
  source.value=p.id;source.dispatchEvent(new Event('change',{bubbles:true}));await wait(100);
  const target=state.operations.filter(o=>fixture.some(f=>f.id===o.id)).map(o=>JSON.parse(JSON.stringify(o)));
  const basePlan=JSON.parse(JSON.stringify(p));
  out.sourceCount=target.length;
  out.cta=!!document.querySelector('.trvis3-builder-create-row [data-tr-action-click="tpBuilderOpenCreate"]');
  TradingResearchActions.tpBuilderOpenCreate();await wait(50);
  const name=document.querySelector('#f-tpb-new-name');if(!name)throw Error('Create form absent');
  name.value='TRVIS3 Fixture Derived';
  out.committed=TradingResearchActions.tpBuilderCommit();
  await wait(140);
  const child=state.tradingPlans.find(x=>x.name==='TRVIS3 Fixture Derived');
  const copies=state.operations.filter(x=>x.tradingPlanId===child?.id);
  const sourceAfter=state.operations.filter(o=>fixture.some(f=>f.id===o.id));
  out.derived={exists:!!child,count:copies.length,newIds:copies.every(x=>!fixture.some(f=>f.id===x.id)),
   ownPlan:copies.every(x=>x.tradingPlanId===child?.id),
   trace:copies.every(x=>fixture.some(f=>f.id===x.derivedFromOperationId)),
   sourceCount:child?.derivation?.sourceCount,
   includedCount:child?.derivation?.includedCount,
   independentArrays:child?.setups!==p.setups};
  out.unchanged=JSON.stringify(sourceAfter)===JSON.stringify(target)&&JSON.stringify(p)===JSON.stringify(basePlan);
  out.sourceIdsRetained=fixture.every(f=>state.operations.some(x=>x.id===f.id&&x.tradingPlanId===p.id));
  out.originalExistingCount=originals.length;
 }catch(e){out.error=String(e?.stack||e)}
 document.body.dataset.trvis3Derived=encodeURIComponent(JSON.stringify(out));
})();`;
html=html.replace('</body>','<script>'+probe+'</script></body>');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'trvis3-derive-'));
try{
 const file=path.join(folder,'index.html');fs.writeFileSync(file,html);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const r=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=11500','--window-size=1366,900','--user-data-dir='+path.join(folder,'profile'),'--dump-dom','file://'+file],{encoding:'utf8',timeout:60000,maxBuffer:17000000});
 assert.equal(r.status,0,r.stderr?.slice(-1000));
 const encoded=r.stdout.match(/data-trvis3-derived="([^"]+)"/i)?.[1];
 assert(encoded,'Missing derived fixture diagnostic: '+r.stderr?.slice(-1200));
 const o=JSON.parse(decodeURIComponent(encoded));console.log('TR-VIS PR3 derivation',JSON.stringify(o));
 assert(!o.error,o.error);
 assert.equal(o.sourceCount,2);
 assert.equal(o.cta,true);
 assert.equal(o.committed,true);
 assert.equal(o.derived.exists,true);
 assert(o.derived.count>=2);
 assert(o.derived.newIds&&o.derived.ownPlan&&o.derived.trace&&o.derived.independentArrays);
 assert(o.unchanged&&o.sourceIdsRetained);
 console.log('TR-VIS PR3 PASS: filter-derived TP freezes independent cloned operations without mutating source.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
