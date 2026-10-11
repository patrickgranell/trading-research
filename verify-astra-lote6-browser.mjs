import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="https:\/\/cdn\.jsdelivr\.net[^"]*"[^>]*><\/script>/,'');
const check=String.raw`(async()=>{
 const out={};
 try{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  await wait(120);
  out.adapter=!!globalThis.TradingResearchAstraLote6;out.initialRoute=globalThis.TradingResearchCurrentViewReadContract?.current?.();
  TradingResearchActions.navigate('lab');await wait(90);
  out.tabs=document.querySelectorAll('.tr6-task-tabs [role="tab"]').length===5;out.labRoute=globalThis.TradingResearchCurrentViewReadContract?.current?.();out.labHtml=document.querySelector('#view')?.textContent?.slice(0,100);
  out.studiesInSummary=!!document.querySelector('[data-tr6-group="summary"] .saved-studies-panel');
  const originalFilters=JSON.stringify(labState),count=labFilteredOps().length;
  TradingResearchActions.tr6LabGroup('validation');await wait(70);
  out.oosInValidation=!!document.querySelector('[data-tr6-group="validation"] .forward-panel');
  out.validationVisible=document.querySelector('[data-tr6-group="validation"]')?.hidden===false;
  TradingResearchActions.tr6LabGroup('segmentation');await wait(70);
  out.filtersPreserved=JSON.stringify(labState)===originalFilters&&labFilteredOps().length===count;
  const fake={id:'_tr6',entryDate:'2026-10-01T17:00:00',exitDate:'2026-10-01T17:05:00',setup:'Setup test',h4Context:'Contexto test',direction:'LONG',result:'win',rMultiple:2,resultTicks:40,pnlGross:40,pnlNet:38,commission:2};
  const research=researchGridModule([fake]);
  const t=document.createElement('template');t.innerHTML=research;
  const button=t.content.querySelector('td.research-cell button.tr6-grid-button');
  out.gridNativeButton=!!button&&button.tagName==='BUTTON'&&button.getAttribute('data-tr-action-click')==='tr6SelectResearchCell';
  out.gridAccessible=!!button?.getAttribute('aria-label')?.includes('n=1');
  if(button){document.body.append(button);button.focus();out.keyboardFocus=document.activeElement===button;button.remove();}
  const pid=getCurrentPlan()?.id;
  if(pid){reportsViewState.compareA=pid;reportsViewState.compareB=pid;reportsViewState.tab='compare';TradingResearchActions.navigate('reports');await wait(70);
   out.samePlanExplained=!!document.querySelector('.tr6-compare-unavailable')&&document.querySelector('.tr6-compare-unavailable').textContent.includes('Comparación idéntica');
   out.noFakeZeros=!document.querySelector('.compare-main .compare-table');
   out.comparisonEligibleCountExplained=/\\d+ elegibles de \\d+ registros/.test(document.querySelector('.tr6-compare-universes')?.textContent||'');
  }else{out.samePlanExplained=false;out.noFakeZeros=false;out.comparisonEligibleCountExplained=false;}
  TradingResearchActions.navigate('market');await wait(70);
  out.marketNavigation=document.querySelectorAll('.tr6-market-tabs [role="tab"]').length===4;
  out.marketContext=!!document.querySelector('.tr6-market-context');
  out.marketNoNumericSteps=![...document.querySelectorAll('.tr6-market-tabs strong')].some(x=>/^\\d+/.test(x.textContent));
  TradingResearchActions.tr6MarketTab('running');await wait(70);
  out.marketTabActive=!!document.querySelector('.tr6-market-tabs [aria-selected="true"]');
  out.marketMissingGuidance=!!document.querySelector('.tr6-prerequisites')||!!document.querySelector('.tr6-source-status');
  document.documentElement.dataset.theme='light';
  out.lightContrastCss=!!document.querySelector('.tr6-market-tabs [role=tab]')&&getComputedStyle(document.querySelector('.tr6-market-tabs [role=tab]')).display!=='none';
 }catch(e){out.error=String(e?.stack||e);}
 document.body.setAttribute('data-tr6-browser',encodeURIComponent(JSON.stringify(out)));
})();`;
html=html.replace('</body>','<script>'+check.replace(/<\/script/gi,'<\\/script')+'</script></body>');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-lote6-'));
try{
 const file=path.join(folder,'index.html');fs.writeFileSync(file,html);
 let chrome=null;
 for(const bin of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean))if(spawnSync(bin,['--version'],{encoding:'utf8'}).status===0){chrome=bin;break;}
 assert(chrome,'Chromium required for Lote 6 acceptance');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1360,920','--virtual-time-budget=5000','--dump-dom','file://'+file],{encoding:'utf8',timeout:45000,maxBuffer:6000000});
 assert.equal(run.status,0,run.stderr?.slice(-800));
 const match=run.stdout.match(/data-tr6-browser="([^"]+)"/);
 assert(match,'Chromium missing Lote 6 diagnostic: '+run.stderr?.slice(-900));
 const result=JSON.parse(decodeURIComponent(match[1]));
 console.log('Lote 6 Chromium diagnostics:',JSON.stringify(result));
 for(const field of ['adapter','tabs','studiesInSummary','oosInValidation','validationVisible','filtersPreserved','gridNativeButton','gridAccessible','keyboardFocus','samePlanExplained','noFakeZeros','comparisonEligibleCountExplained','marketNavigation','marketContext','marketNoNumericSteps','marketTabActive','marketMissingGuidance','lightContrastCss'])assert(result[field],field+' FAIL: '+JSON.stringify(result));
 console.log('Astra Lote 6 Chromium PASS: tasks, OOS, context, grid keyboard and comparison/Market Data'); 
}finally{fs.rmSync(folder,{recursive:true,force:true});}
