import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
let html=fs.readFileSync('dist/index.html','utf8');
const check=String.raw`(async()=>{
 const results={};
 try{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  await sleep(100);
  results.adapter=!!globalThis.TradingResearchAstraLote7;
  const nav=()=>document.querySelector('.sidebar .nav-organized');
  const count=view=>nav()?.querySelectorAll('[data-view="'+view+'"]').length||0;
  const menuGroup=view=>nav()?.querySelector('[data-view="'+view+'"]')?.closest('.nav-group')?.dataset.navGroup||'';
  const marketElement=()=>nav()?.querySelector('[data-view="market"]');
  const marketVisible=()=>{const el=marketElement();return !!el&&!el.hidden&&getComputedStyle(el).display!=='none';};
  const route=()=>globalThis.TradingResearchCurrentViewReadContract?.current?.();
  const base=getCurrentPlan();
  const initialCount=state.operations.length;
  const plans={};
  for(const env of ['backtest','live','sim','replay','unclassified']){
   const id='TR7_TEST_'+env;
   state.tradingPlans.push({...base,id,name:'Lote 7 '+env,planEnvironment:env,status:'active',version:'v1'});
   plans[env]=id;
  }
  const change=async env=>{TradingResearchActions.switchPlan(plans[env]);await sleep(120);};
  await change('backtest');
  // Replicate the reported UI: Datos y ejecución is expanded.
  nav().querySelector('[data-nav-group="data"]')?.classList.add('open');
  results.blocksMoved=count('blocks')===1&&menuGroup('blocks')==='operativa';
  results.blocksNotInControl=!nav().querySelector('[data-nav-group="control"] [data-view="blocks"]');
  results.marketHiddenBacktest=!marketVisible()&&(count('market')===0||(marketElement()?.hidden===true&&getComputedStyle(marketElement()).display==='none'));
  results.marketReallyAbsentFromLayout=!marketElement()||marketElement().getClientRects().length===0;
  results.dataGroupNonEmpty=!!nav().querySelector('[data-nav-group="data"] [data-view="quality"]');
  const checkAllowed=[];
  for(const env of ['live','sim','replay','unclassified']){
   await change(env);
   checkAllowed.push(marketVisible()&&menuGroup('market')==='data'&&count('blocks')===1);
  }
  results.marketVisibleOtherEnvironments=checkAllowed.every(Boolean);
  await change('replay');
  TradingResearchActions.navigate('market');await sleep(100);
  results.marketReachable=route()==='market';
  await change('backtest');
  results.marketRedirectOnSwitch=route()==='quality'&&!marketVisible();
  TradingResearchActions.navigate('market');await sleep(100);
  results.marketRouteGuard=route()==='quality';
  TradingResearchActions.navigate('blocks');await sleep(100);
  results.blocksActive=route()==='blocks'&&nav().querySelector('[data-nav-group="operativa"] [data-view="blocks"]')?.classList.contains('active');
  results.blocksAncestor=!!nav().querySelector('[data-nav-group="operativa"].has-active');
  results.blocksContent=!!document.getElementById('view')?.textContent?.includes('Bloques');
  results.operationsIntact=state.operations.length===initialCount;
  for(const theme of ['dark','light']){document.documentElement.dataset.theme=theme;await sleep(40);results['theme_'+theme]=getComputedStyle(nav().querySelector('[data-view="blocks"]')).display!=='none';}
  results.groups=TradingResearchAstraLote7.groups().map(g=>g.id+':'+g.items.join(','));
 }catch(err){results.error=String(err?.stack||err);}
 document.body.setAttribute('data-tr7-result',encodeURIComponent(JSON.stringify(results)));
})();`;
html=html.replace('</body>','<script>'+check+'</script></body>');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tr-lote7-'));
try{
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,html);
 let chrome=null;
 for(const bin of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)){
  if(spawnSync(bin,['--version'],{encoding:'utf8'}).status===0){chrome=bin;break;}
 }
 assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1360,920','--virtual-time-budget=7500','--dump-dom','file://'+file],{encoding:'utf8',timeout:50000,maxBuffer:6500000});
 assert.equal(run.status,0,run.stderr?.slice(-700));
 const match=run.stdout.match(/data-tr7-result="([^"]+)"/);
 assert(match,'No Lote 7 browser data: '+run.stderr?.slice(-500));
 const r=JSON.parse(decodeURIComponent(match[1]));console.log('Lote 7 Chromium diagnostics:',JSON.stringify(r));
 for(const key of ['adapter','blocksMoved','blocksNotInControl','marketHiddenBacktest','marketReallyAbsentFromLayout','dataGroupNonEmpty','marketVisibleOtherEnvironments','marketReachable','marketRedirectOnSwitch','marketRouteGuard','blocksActive','blocksAncestor','blocksContent','operationsIntact','theme_dark','theme_light'])assert(r[key],key+' FAIL');
 assert.equal(r.groups.filter(g=>g.includes('blocks')).length,1,'Blocks appears in more than one group');
 console.log('Astra Lote 7 Chromium PASS: relocated Blocks, contextual Market Data, route fallback, TP changes and both themes');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
