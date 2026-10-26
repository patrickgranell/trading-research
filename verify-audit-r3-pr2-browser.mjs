/* Auditoría R3 PR2: form composition, columns, plan-scoped prefs, compliance list. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const html=fs.readFileSync('dist/index.html','utf8');
const ankoraFixture=fs.readFileSync('fixtures/audit-r3-pr2-ankora-SYNTHETIC.txt','utf8');
const probe=String.raw`(async()=>{
 const out={};const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  await sleep(1800);
  const p=getCurrentPlan(),instrument=state.settings.instruments[0];
  if(!p||!instrument)throw Error('Sin plan o instrumento de prueba');
  p.riskStrategies=[{id:'R3_Fixture_Risk',name:'Riesgo ficticio',instrumentId:instrument.id,active:true,
    lots:[{id:'R3_L1',quantity:1,stopTicks:10,targetType:'ticks',targetTicks:20},
      {id:'R3_L2',quantity:1,stopTicks:10,targetType:'ticks',targetTicks:40}]}];
  TradingResearchActions.navigate('operations');await sleep(150);
  TradingResearchActions.openOperationModal();await sleep(240);
  const form=document.querySelector('#operationForm');
  const main=form&&[...form.querySelectorAll(':scope > .form-section > h4')].map(h=>h.textContent);
  out.formLoaded=!!form&&!!globalThis.TradingResearchAuditR3Pr2Form;
  out.order=!!main&&main[1]?.startsWith('1 · Operación')&&
    main[2]?.startsWith('2 · Contexto')&&main[3]?.startsWith('3 · Clasificación');
  const primary=form?.querySelector('.tr-r3-primary-operation');
  out.fieldFirst=['entryDate','direction','riskStrategyId','resultTicks','exitDate'].every(id=>primary?.querySelector('#f-'+id));
  out.lotsNested=!!primary?.querySelector('.tr-lot-editor .tr-lot-execution-row');
  out.noDuplicateFields=!!form&&new Set([...form.querySelectorAll('[id]')].map(n=>n.id)).size===form.querySelectorAll('[id]').length;
  out.taxonomyControls=[...form.querySelectorAll('[id^="f-tx_"]')].length;
  closeModal();
  const existing=state.operations.length;
  const tax={id:'audit_r3_feature',name:'Clasificación dinámica',kind:'custom',status:'active',
    values:[{id:'quality_A',name:'Ejecución A',legacyValue:'',status:'active',aliases:[]}]};
  p.taxonomyRegistry=(p.taxonomyRegistry||[]).filter(x=>x.id!==tax.id).concat(tax);
  const operation={id:'R3_ComplianceFixture',tradingPlanId:p.id,entryDate:'2026-10-01T19:00:00',
    exitDate:'2026-10-01T19:15:00',result:'win',setup:'Setup R3',h4Context:'Alcista',
    direction:'SHORT',contracts:2,contract:'MYM',entryPrice:46950,
    resultTicks:20,pnlGross:70,pnlNet:65,commission:5,rMultiple:2,mfeTicks:0,maeTicks:null,
    taxonomyValues:{audit_r3_feature:'quality_A'},raw:{source:'manual'},
    compliance:{evaluated:true,strict:true,score:100,responses:[{id:'R3_rule',name:'Regla R3',checked:true,required:true}]}};
  state.operations.push(operation);
  TradingResearchActions.navigate('operations');await sleep(170);
  out.taxColumn=!!document.querySelector('[data-tr-cols-visible="tax:audit_r3_feature"]');
  TradingResearchActions.navigate('compliance');await sleep(180);
  const root=()=>document.querySelector('#view .compliance-ops-panel');
  out.complianceLoaded=!!globalThis.TradingResearchAuditR3Compliance&&!!root();
  out.complianceRows=root()?.querySelectorAll('tbody tr').length||0;
  out.complianceHeaderCount=root()?.querySelectorAll('thead th').length||0;
  out.originalButtons=!![...root()?.querySelectorAll('tbody tr td:last-child button')||[]].find(b=>b.textContent.trim()==='Ver');
  const originalValue=JSON.stringify(operation);
  root()?.querySelector('[data-r3c-toggle]')?.click();
  out.opened=!!root()?.querySelector('.tr-r3-compliance-panel:not([hidden])');
  const choose=id=>{
    const el=root()?.querySelector('[data-r3c-visible="'+id+'"]');
    if(!el)throw Error('Columna no encontrada '+id);
    el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  choose('direction');await sleep(90);
  out.addedDirection=root()?.querySelector('tbody [data-r3c-col="direction"]')?.textContent?.trim()==='SHORT'&&
   !root()?.querySelector('thead [data-r3c-col="direction"]')?.hidden;
  choose('tax:audit_r3_feature');await sleep(90);
  out.addedTaxonomy=root()?.querySelector('tbody [data-r3c-col="tax:audit_r3_feature"]')?.textContent?.trim()==='Ejecución A';
  const prefs=globalThis.TradingResearchAuditR3Compliance?.prefs();
  out.saved=!!prefs&&!prefs.hidden.includes('direction')&&!prefs.hidden.includes('tax:audit_r3_feature');
  out.unchanged=JSON.stringify(operation)===originalValue;
  out.count=state.operations.length-existing;
  const parsed=buildPreviewFromText(ankoraFixture,{name:'R3-SYNTHETIC.txt'},p);
  out.ankoraParsed=parsed.drafts.length===2&&parsed.drafts.every(d=>d.importDisposition==='insert');
  const baseline=operationFromDraft(parsed.drafts[0],p,'R3-IMPORT',null);
  baseline.notes='Nota enriquecida manualmente';baseline.h4Context='Contexto local';
  baseline.taxonomyValues={audit_r3_feature:'quality_A'};
  state.operations.push(baseline);
  const repeat=buildPreviewFromText(ankoraFixture,{name:'R3-SYNTHETIC.txt'},p);
  out.ankoraSkip=repeat.drafts[0].importDisposition==='skip';
  const lines=ankoraFixture.trimEnd().split('\n'),names=lines[0].split('|'),row=lines[1].split('|');
  row[names.indexOf('Lot1Ticks')]='25';lines[1]=row.join('|');
  const changed=buildPreviewFromText(lines.join('\n')+'\n',{name:'R3-SYNTHETIC-v2.txt'},p);
  out.ankoraReclassified=changed.drafts[0].importDisposition==='update'&&
     changed.drafts[0].existingOperationId===baseline.id;
  const updated=operationFromDraft(changed.drafts[0],p,'R3-V2',baseline);
  out.ankoraEnrichment=updated.id===baseline.id&&updated.resultTicks===65&&
    updated.notes==='Nota enriquecida manualmente'&&updated.h4Context==='Contexto local'&&
    updated.taxonomyValues?.audit_r3_feature==='quality_A'&&
    updated.raw.sourceFingerprint!==baseline.raw.sourceFingerprint;
  out.ankoraZeroMeasured=operationFromDraft(parsed.drafts[1],p,'R3-ZERO',null).result==='flat';
  state.operations.pop();

 }catch(error){out.error=String(error?.stack||error);}
 document.body.setAttribute('data-r3pr2-check',encodeURIComponent(JSON.stringify(out)));
})();`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'audit-r3-pr2-'));
try{
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html.replace('</body>','<script>const ankoraFixture='+JSON.stringify(ankoraFixture)+';\n'+probe+'</script></body>'));
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)
  .find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium requerido');
 const p=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--window-size=1366,900','--virtual-time-budget=14000','--dump-dom','file://'+file],
  {encoding:'utf8',timeout:50000,maxBuffer:10000000});
 assert.equal(p.status,0,p.stderr?.slice(-1600));
 const encoded=p.stdout.match(/data-r3pr2-check="([^"]+)"/)?.[1];
 assert(encoded,'Prueba no completada: '+p.stderr?.slice(-1000));
 const o=JSON.parse(decodeURIComponent(encoded));
 console.log('Audit R3 PR2 fixture',JSON.stringify(o));
 assert(!o.error,o.error);
 for(const key of ['formLoaded','order','fieldFirst','lotsNested','noDuplicateFields',
   'complianceLoaded','originalButtons','opened','addedDirection','addedTaxonomy',
   'saved','unchanged','taxColumn','ankoraParsed','ankoraSkip','ankoraReclassified','ankoraEnrichment','ankoraZeroMeasured'])assert.equal(o[key],true,key+' regresión');
 assert(o.complianceHeaderCount>=19,'Falta catálogo de columnas en Cumplimiento');
 assert(o.complianceRows>=1,'Sin fila evaluada');
 assert.equal(o.count,1,'La visualización no debe crear operaciones adicionales');
 console.log('Audit R3 PR2 Chromium PASS: ficha, lotes, taxonomías, Cumplimiento y preferencias.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
