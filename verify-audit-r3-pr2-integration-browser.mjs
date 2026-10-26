/* Auditoría R3 PR2: real Chromium integration of taxonomy flow and Ankora UI. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const html=fs.readFileSync('dist/index.html','utf8');
const source=fs.readFileSync('fixtures/audit-r3-pr2-ankora-SYNTHETIC.txt','utf8');
const browserProbe=String.raw`(async()=>{
 const alerts=[];window.alert=message=>{alerts.push(String(message));};
 const x={},sleep=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  await sleep(1800);
  const p=getCurrentPlan(),domain=globalThis.TradingResearchTaxonomyDomain;
  if(!p||!domain)throw Error('No se cargaron Trading Plan y taxonomías canónicas');
  const id='R3_GRID_CUSTOM',valueId='R3_CAT_A';
  p.taxonomyRegistry=(p.taxonomyRegistry||[]).filter(t=>t.id!==id);
  p.taxonomyRegistry.push({id,name:'Calidad de ejecución',kind:'custom',status:'active',
    values:[{id:valueId,name:'Calidad A',status:'active',aliases:[]}]});
  const trade={
   id:'R3_GRID_TRADE',tradingPlanId:p.id,entryDate:'2026-10-01T19:00',
   exitDate:'2026-10-01T19:15',direction:'SHORT',contract:'MYM',
   setup:'Setup A',result:'win',resultTicks:20,rMultiple:2,
   pnlGross:40,pnlNet:37,commission:3,contracts:1,
   taxonomyValues:{[id]:valueId},raw:{source:'manual'}
  };
  state.operations.push(trade);
  TradingResearchActions.navigate('operations');await sleep(160);
  const panel=document.querySelector('#view .tr-colprefs');
  x.registryHasTax=!!panel?.querySelector('[data-tr-cols-visible="tax:'+id+'"]');
  panel?.querySelector('[data-tr-cols-toggle]')?.click();
  const family=[...panel?.querySelectorAll('[data-tr-cols-family]')||[]]
   .find(b=>b.dataset.trColsFamily==='Oportunidad y clasificación');
  const wasHidden=TradingResearchOperationColumns.read().hidden.includes('context');
  family?.click();
  x.familyToggle=wasHidden&&!TradingResearchOperationColumns.read().hidden.includes('context');
  const options=()=>[...new DOMParser().parseFromString(breakdownModule([trade]),'text/html')
   .querySelectorAll('#filterDimension option')].map(o=>o.value);
  const core=p.taxonomyRegistry.find(t=>t.kind==='core'&&t.legacyKey==='setup');
  x.dedupedCore=!!core&&options().includes('setup')&&!options().includes('tax:'+core.id);
  x.breakdownCustom=options().includes('tax:'+id);
  opsViewState.dimension='tax:'+id;
  x.breakdownLabel=breakdownModule([trade]).includes('Calidad A');
  const gridOptions=()=>[...new DOMParser().parseFromString(researchGridModule([trade]),'text/html')
   .querySelectorAll('.research-grid-controls select option')].map(o=>o.value);
  x.gridAxis=gridOptions().includes('tax:'+id);
  researchGridState.rowDim='tax:'+id;
  researchGridState.colDim='direction';
  const gridHtml=researchGridModule([trade]);
  x.gridMarkup=gridHtml.slice(0,1900);
  x.gridContract=!!globalThis.TradingResearchAuditR3Grid;
  x.gridData=gridHtml.includes('Calidad A')&&gridHtml.includes('1 de 1 operaciones clasificadas');
  const beforeFilters=JSON.stringify(labState.taxonomyFilters||{});
  researchApplyCell('tax:'+id,valueId,'direction','SHORT');await sleep(130);
  x.cellFilters=labState.taxonomyFilters?.[id]===valueId;
  researchClearSelection();await sleep(130);
  x.cellRestored=JSON.stringify(labState.taxonomyFilters||{})===beforeFilters;
  p.taxonomyRegistry.find(t=>t.id===id).name='Calidad renombrada';
  p.taxonomyRegistry.find(t=>t.id===id).status='archived';
  x.archivedGrid=gridOptions().includes('tax:'+id)&&
   researchGridModule([trade]).includes('Calidad renombrada');
  TradingResearchActions.navigate('operations');await sleep(120);
  x.archivedRegister=!!document.querySelector('[data-tr-cols-visible="tax:'+id+'"]');
  // Complete RAW import cycle using the real FileReader + inspector + saved editor.
  const before=state.operations.length;
  const file=(data,name)=>new File([data],name,{type:'text/plain'});
  x.planForImport={current:state.currentPlanId,p:p.id,pending:typeof pendingImportPlanId==='undefined'?'UNDEF':pendingImportPlanId};
  handleImport(file(syntheticAnkora,'R3-SYNTHETIC.txt'));await sleep(440);
  x.importDiagnostic={preview:typeof pendingImportPreview==='undefined'?'UNDEF':pendingImportPreview?.drafts?.length,modalTitles:[...document.querySelectorAll('.modal-head h3')].map(e=>e.textContent),alerts:[...alerts]};
  x.inspector=!!document.querySelector('.modal-backdrop')?.textContent.includes('Inspector de importación Ankora');
  const confirm=[...document.querySelectorAll('.modal-backdrop button')]
    .find(b=>b.textContent.includes('Confirmar importación'));
  confirm?.click();await sleep(250);
  let imported=state.operations.filter(o=>o.tradingPlanId===p.id&&o.raw?.source==='ankora');
  x.imported=imported.length===2&&state.operations.length===before+2;
  x.importAfterDiagnostic={imported:imported.length,operations:state.operations.length,before,alerts:[...alerts]};
  const first=imported.find(o=>o.raw.columns.EntryDateTime==='01/10/2026 19:05:00');
  x.rawFirst=!!first&&first.raw?.columns.Lot1Ticks==='20';
  closeModal();
  if(!first)throw Error('No se insertó operación importada');
  openImportedRowEditor(first.id);await sleep(70);
  const edit=document.getElementById('f-imp-notes');
  x.editor=!!edit&&!!document.getElementById('f-imp-context');
  if(edit)edit.value='Nota enriquecida después de importar';
  const context=document.getElementById('f-imp-context');
  if(context)context.value='Contexto enriquecido';
  const saveBtn=[...document.querySelectorAll('.modal-backdrop button')]
   .find(b=>b.textContent.includes('Guardar corrección'));
  saveBtn?.click();await sleep(230);
  x.savedEdit=state.operations.find(o=>o.id===first.id)?.notes==='Nota enriquecida después de importar';
  closeModal();
  handleImport(file(syntheticAnkora,'R3-SYNTHETIC.txt'));await sleep(230);
  x.repeatSkipped=!!document.querySelector('.modal-backdrop')?.textContent.includes('Ya importada · omitir');
  cancelImportPreview();await sleep(80);
  const lines=syntheticAnkora.trimEnd().split('\n'),head=lines[0].split('|'),fields=lines[1].split('|');
  fields[head.indexOf('Lot1Ticks')]='25';lines[1]=fields.join('|');
  const changed=lines.join('\n')+'\n';
  handleImport(file(changed,'R3-SYNTHETIC-v2.txt'));await sleep(230);
  x.updateOffered=!!document.querySelector('.modal-backdrop')?.textContent.includes('Actualiza');
  const updateBtn=[...document.querySelectorAll('.modal-backdrop button')]
   .find(b=>b.textContent.includes('Confirmar importación'));
  updateBtn?.click();await sleep(230);
  const after=state.operations.find(o=>o.id===first.id);
  x.updatePreserved=!!after&&state.operations.length===before+2&&
   after.resultTicks===65&&after.notes==='Nota enriquecida después de importar'&&
   after.h4Context==='Contexto enriquecido'&&after.raw.columns.Lot1Ticks==='25';
  x.originalTradeUnchanged=state.operations.find(o=>o.id===trade.id)?.taxonomyValues?.[id]===valueId;
  closeModal();
 }catch(e){x.error=String(e?.stack||e);}
 document.body.setAttribute('data-r3-integration',encodeURIComponent(JSON.stringify(x)));
})();`;
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-r3-cycle-'));
try{
 const file=path.join(folder,'index.html');
 fs.writeFileSync(file,html.replace('</body>','<script>const syntheticAnkora='+JSON.stringify(source)+';\n'+browserProbe+'</script></body>'));
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)
  .find(c=>spawnSync(c,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--window-size=1550,950','--virtual-time-budget=16000','--dump-dom','file://'+file],
  {encoding:'utf8',timeout:60000,maxBuffer:12500000});
 assert.equal(run.status,0,run.stderr?.slice(-1300));
 const encoded=run.stdout.match(/data-r3-integration="([^"]+)"/)?.[1];
 assert(encoded,'Missing R3 integration result: '+run.stderr?.slice(-1500));
 const result=JSON.parse(decodeURIComponent(encoded));
 console.log('R3 full synthetic cycle',JSON.stringify(result));
 assert(!result.error,result.error);
 for(const name of ['registryHasTax','familyToggle','dedupedCore','breakdownCustom','breakdownLabel',
  'gridAxis','gridData','cellFilters','cellRestored','archivedGrid','archivedRegister',
  'inspector','imported','rawFirst','editor','savedEdit','repeatSkipped',
  'updateOffered','updatePreserved','originalTradeUnchanged']){
  assert.equal(result[name],true,name+' regression');
 }
 console.log('Audit R3 PR2 integrated PASS: taxonomy → columns → breakdown → Grid → filter/revert, archive, synthetic FileReader import → enrich → reimport/update.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
