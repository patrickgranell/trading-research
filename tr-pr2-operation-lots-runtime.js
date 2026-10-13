/* TR-VIS PR2 · Actual per-lot execution, without duplicating operations.
   Strategy lots represent planned management. executionLots represent what
   actually closed. Weighted resultTicks is the canonical contract-tick sum;
   a partially open position has null total until every lot closes. */
(()=>{
'use strict';
if(globalThis.TradingResearchLotExecution)return;

const asNumber=x=>x===null||x===undefined||String(x).trim()===''?null:Number(x);
const format=n=>String(Number(n.toFixed(5)));
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentPlan=()=>globalThis.TradingResearchPlanReadContract?.current?.()||null;
const selectedRisk=()=>currentPlan()?.riskStrategies?.find(x=>String(x.id)===document.getElementById('f-riskStrategyId')?.value)||null;
function editingOperation(){
 try{
  const id=typeof editingId==='undefined'?null:editingId;
  if(!id)return null;
  const all=typeof state==='undefined'?[]:state.operations||[];
  return all.find(x=>x.id===id)||null;
 }catch{return null;}
}
const lotsOf=risk=>Array.isArray(risk?.lots)?risk.lots:[];
function inputRows(form){return [...form.querySelectorAll('.tr-lot-execution-row')];}
function modeOf(form){return form?.querySelector('.tr-lots-mode')?.value==='lots'?'lots':'aggregated';}
/* Global exit reflects the final actual lot exit, not a manually guessed timestamp.
 * An open lot has no final trade exit. Older lot records without timestamps
 * retain the former manual exit input so historical edits are not destroyed. */
function lotExitInfo(form){
 if(modeOf(form)!=='lots')return {mode:'aggregated',exitDate:null};
 const rows=inputRows(form);
 if(!rows.length)return {mode:'lots',exitDate:null};
 const completed=rows.every(row=>{
  const input=row.querySelector('.tr-lot-result');
  return input?.value.trim()!==''&&!input?.validity.badInput&&Number.isFinite(Number(input.value));
 });
 if(!completed)return {mode:'lots',exitDate:'',reason:'open'};
 const exits=rows.map(row=>row.querySelector('.tr-lot-exit-date')?.value||'');
 const recorded=exits.filter(Boolean).sort();
 if(!recorded.length)return {mode:'lots',exitDate:null,reason:'undated'};
 return {mode:'lots',exitDate:recorded.at(-1),reason:recorded.length===rows.length?'last-lot':'partial-dated',undated:rows.length-recorded.length};
}
function syncOperationExit(form){
 const field=form?.querySelector('#f-exitDate');
 const info=lotExitInfo(form);
 if(!field)return info;
 const lock=field.dataset.trLotExitLock==='1';
 if(info.mode==='lots'&&info.exitDate!==null){
  if(!lock)field.dataset.trLotExitBefore=field.value;
  field.value=info.exitDate;
  field.readOnly=true;field.setAttribute('aria-readonly','true');
  field.title=info.reason==='partial-dated'?'Última salida registrada: faltan fechas de otros lotes':info.reason==='last-lot'?'Salida del último lote cerrado':'Pendiente: todavía hay lotes abiertos';
  field.dataset.trLotExitLock='1';
 }else{
  if(lock)field.value=field.dataset.trLotExitBefore||'';
  field.readOnly=false;field.removeAttribute('aria-readonly');
  field.removeAttribute('title');
  delete field.dataset.trLotExitLock;
  delete field.dataset.trLotExitBefore;
 }
 return info;
}
function refreshSummary(form){
 if(!form)return;
 const totalInput=form.querySelector('#f-resultTicks');
 const summary=form.querySelector('.tr-lots-summary');
 const manual=modeOf(form)==='aggregated';
 const rows=inputRows(form);
 const section=form.querySelector('.tr-lot-row-list');
 if(section)section.hidden=manual;
 if(totalInput){
  if(manual){
   if(totalInput.dataset.trLotReadonly==='1'){
    totalInput.readOnly=false;
    totalInput.removeAttribute('aria-readonly');
    totalInput.value=totalInput.dataset.trPreviousAggregate||'';
   }
   delete totalInput.dataset.trLotReadonly;
  }else{
   if(totalInput.dataset.trLotReadonly!=='1')totalInput.dataset.trPreviousAggregate=totalInput.value;
   totalInput.dataset.trLotReadonly='1';
   totalInput.readOnly=true;
   totalInput.setAttribute('aria-readonly','true');
   const complete=rows.length>0&&rows.every(row=>row.querySelector('.tr-lot-result')?.value.trim()!==''&&!row.querySelector('.tr-lot-result')?.validity.badInput);
   const ticks=rows.reduce((sum,row)=>{
    const n=asNumber(row.querySelector('.tr-lot-result')?.value);
    const qty=Number(row.dataset.quantity);
    return sum+(Number.isFinite(n)?qty*n:0);
   },0);
   totalInput.value=complete?format(ticks):'';
   if(summary){
    const closed=rows.filter(row=>row.querySelector('.tr-lot-result')?.value.trim()!=='').length;
    summary.textContent=complete?'Total cerrado: '+format(ticks)+' ticks-contrato · '+closed+'/'+rows.length+' lotes cerrados'
      :closed+'/'+rows.length+' lotes cerrados · operación pendiente hasta cerrar todos los lotes';
   }
  }
 }
 const exitInfo=syncOperationExit(form);
 if(summary&&!manual&&['last-lot','partial-dated'].includes(exitInfo.reason)){
  summary.textContent+=' · Cierre general: '+exitInfo.exitDate.replace('T',' ')+(exitInfo.reason==='partial-dated'?' (última salida registrada: faltan '+exitInfo.undated+' fecha(s) de lotes)':' (último lote)');
 }
 form.querySelector('.tr-lot-editor')?.classList.toggle('tr-lots-aggregated',manual);
 if(manual&&summary)summary.textContent='Registro agregado: indica los ticks-contrato totales de la operación en «Ticks resultado agregados».';
 // Continue using existing gross / net / R calculation, not a new engine.
 if(typeof recalcOperation==='function')recalcOperation();
}
function lotRowsHtml(risk,previous){
 const saved=Array.isArray(previous?.executionLots)?previous.executionLots:[];
 return lotsOf(risk).map((lot,i)=>{
  const id=String(lot.id||'');
  const prior=saved.find(x=>String(x.id)===id)||(!id?saved[i]:null);
  const qty=Number(lot.quantity)||1;
  const tick=prior?.resultTicks===null||prior?.resultTicks===undefined?'':String(prior.resultTicks);
  const at=prior?.exitDate||'';
  const target=lot.targetType==='discretionary'?lot.targetRule||'Discrecional':String(lot.targetTicks??0)+'t';
  return '<div class="tr-lot-execution-row" data-lot-id="'+escapeText(id)+'" data-quantity="'+qty+'">'+
   '<div class="tr-lot-description"><strong>Lote '+(i+1)+'</strong><span>'+qty+' contrato'+(qty===1?'':'s')+' · SL '+escapeText(lot.stopTicks)+'t · TP previsto '+escapeText(target)+'</span></div>'+
   '<label>Resultado real (ticks/contrato)<input class="input tr-lot-result" type="number" step="any" placeholder="Pendiente" value="'+escapeText(tick)+'" aria-label="Resultado real en ticks del lote '+(i+1)+'"></label>'+
   '<label>Salida del lote (opcional)<input class="input tr-lot-exit-date" type="datetime-local" value="'+escapeText(at)+'" aria-label="Fecha y hora de salida del lote '+(i+1)+'"></label>'+
   '</div>';
 }).join('');
}
function drawEditor(form,force=false){
 if(!form?.isConnected)return;
 const risk=selectedRisk();
 if(!risk)return;
 const group=form.querySelector('#opRiskPreview');
 if(!group)return;
 let editor=form.querySelector('.tr-lot-editor');
 if(!editor){
  editor=document.createElement('section');
  editor.className='tr-lot-editor';
  editor.innerHTML=
   '<div class="tr-lot-header"><div><h4>Resultado por lotes</h4><small>Los objetivos de Gestión son previstos; aquí se registran las salidas reales.</small></div>'+
   '<label>Modalidad de registro<select class="select tr-lots-mode" aria-label="Modalidad de registro de lotes">'+
   '<option value="lots">Por lotes</option><option value="aggregated">Agregado</option></select></label></div>'+
   '<div class="tr-lot-row-list"></div><div class="tr-lots-summary" role="status" aria-live="polite"></div>'+
   '<small class="tr-lots-chronology-note">La salida general utiliza la última hora registrada. Las salidas anteriores se introducen cuando se conocen: la aplicación no inventa horas reales.</small>';
  group.insertAdjacentElement('afterend',editor);
  const op=editingOperation();
  const mode=op?((op.executionMode==='lots'&&Array.isArray(op.executionLots))?'lots':'aggregated'):
    lotsOf(risk).length>1?'lots':'aggregated';
  editor.querySelector('.tr-lots-mode').value=mode;
 }
 const key=String(risk.id);
 if(editor.dataset.riskId!==key||force){
  editor.dataset.riskId=key;
  const existing=editingOperation();
  const previous=existing?.riskStrategyId===risk.id?existing:null;
  editor.querySelector('.tr-lot-row-list').innerHTML=lotRowsHtml(risk,previous);
  const totalInput=form.querySelector('#f-resultTicks');
  if(totalInput&&totalInput.dataset.trLotReadonly==='1'){
   // Switching strategy discards aggregate derived from the previous strategy,
   // not the manually-entered fallback kept for aggregate mode.
   totalInput.value='';
  }
 }
 refreshSummary(form);
}
function prepareForSave(risk){
 const form=document.querySelector('.modal-backdrop #operationForm');
 if(!form)return null;
 const editor=form.querySelector('.tr-lot-editor');
 if(!editor)return null;
 const mode=modeOf(form);
 if(mode==='aggregated')return {mode:'aggregated'};
 if(String(editor.dataset.riskId)!==String(risk?.id))return {mode:'lots',error:'El régimen de gestión ha cambiado. Revisa los resultados de los lotes antes de guardar.'};
 const planned=lotsOf(risk),rows=inputRows(form);
 if(!planned.length||planned.length!==rows.length)return {mode:'lots',error:'Los lotes no coinciden con la estrategia seleccionada.'};
 const saved=[];let sum=0,closed=0;
 for(let i=0;i<planned.length;i++){
  const plan=planned[i],row=rows[i];
  if(String(row.dataset.lotId)!==String(plan.id||''))return {mode:'lots',error:'La distribución de lotes ha cambiado. Revisa la operación.'};
  const qty=Number(plan.quantity),field=row.querySelector('.tr-lot-result'),raw=field.value.trim(),exit=row.querySelector('.tr-lot-exit-date')?.value||'';
  if(!Number.isInteger(qty)||qty<=0)return {mode:'lots',error:'La cantidad de contratos del lote '+(i+1)+' no es válida.'};
  if(field.validity.badInput||raw!==''&&!Number.isFinite(Number(raw)))return {mode:'lots',error:'El resultado del lote '+(i+1)+' no es válido.'};
  if(raw===''&&exit)return {mode:'lots',error:'El lote '+(i+1)+' tiene fecha de salida, pero no resultado en ticks.'};
  const hasResult=raw!=='',value=hasResult?Number(raw):null;
  if(hasResult){closed++;sum+=value*qty;}
  saved.push({
   id:String(plan.id||''),quantity:qty,
   stopTicks:Number(plan.stopTicks)||0,
   targetType:plan.targetType==='discretionary'?'discretionary':'ticks',
   targetTicks:plan.targetType==='discretionary'?null:Number(plan.targetTicks)||0,
   targetRule:String(plan.targetRule||''),
   resultTicks:value,totalTicks:hasResult?Number((value*qty).toFixed(5)):null,
   exitDate:exit||null,status:hasResult?'closed':'open'
  });
 }
 const isComplete=closed===planned.length;
 const entry=form.querySelector('#f-entryDate')?.value||'';
 for(let i=0;i<saved.length;i++)if(saved[i].exitDate&&entry&&saved[i].exitDate<entry)return {mode:'lots',error:'La salida del lote '+(i+1)+' no puede preceder la entrada.'};
 const exitInfo=syncOperationExit(form);
 return {mode:'lots',lots:saved,resultTicksString:isComplete?format(sum):'',
  exitDate:exitInfo.exitDate,closedLots:closed,totalLots:planned.length};
}
function detailHtml(op){
 if(!Array.isArray(op?.executionLots)||!op.executionLots.length)return '';
 const rows=op.executionLots.map((lot,i)=>{
  const value=lot.status==='closed'&&lot.resultTicks!==null&&lot.resultTicks!==undefined;
  return '<tr><td>Lote '+(i+1)+'</td><td>'+escapeText(lot.quantity)+'</td><td>'+
   escapeText(lot.targetType==='discretionary'?lot.targetRule:lot.targetTicks+' ticks')+'</td><td>'+
   (value?escapeText(format(Number(lot.resultTicks)))+'t / contrato':'Pendiente')+'</td><td>'+
   (value?escapeText(format(Number(lot.totalTicks)))+' ticks-contrato':'—')+'</td><td>'+
   escapeText(lot.exitDate||'—')+'</td></tr>';
 }).join('');
 return '<section class="form-section tr-lot-detail"><div class="panel-title"><div><h3>Ejecución real por lotes</h3>'+
 '<small>Una operación, '+op.executionLots.length+' lotes. Cada resultado conserva su cantidad y salida real.</small></div></div>'+
 '<div class="table-wrap"><table class="table"><thead><tr><th>Lote</th><th>Contratos</th><th>TP previsto</th><th>Resultado real</th><th>Aportación</th><th>Salida</th></tr></thead>'+
 '<tbody>'+rows+'</tbody></table></div></section>';
}
document.addEventListener('change',ev=>{
 const field=ev.target;
 const form=field?.closest?.('#operationForm');
 if(!form)return;
 if(field.matches('#f-riskStrategyId')){
  drawEditor(form,true);
  requestAnimationFrame(()=>drawEditor(form));
 }else if(field.matches('.tr-lots-mode')){
  refreshSummary(form);
 }else if(field.matches('.tr-lot-result,.tr-lot-exit-date')){
  refreshSummary(form);
 }
},true);
document.addEventListener('input',ev=>{
 const field=ev.target;
 if(field?.matches?.('#operationForm .tr-lot-result')){
  refreshSummary(field.closest('#operationForm'));
 }
},true);
const mutation=new MutationObserver(changes=>{
 if(!changes.some(change=>change.addedNodes.length))return;
 for(const form of document.querySelectorAll('.modal-backdrop #operationForm')){
  if(!form.querySelector('.tr-lot-editor'))drawEditor(form);
 }
});
mutation.observe(document.body,{childList:true,subtree:true});
globalThis.TradingResearchLotExecution=Object.freeze({prepareForSave,detailHtml,drawEditor,refreshSummary,lotExitInfo,version:'2'});
for(const form of document.querySelectorAll('.modal-backdrop #operationForm'))drawEditor(form);
})();