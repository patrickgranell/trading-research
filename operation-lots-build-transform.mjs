/* TR-VIS PR2 · compile-time extension of operation save/view presentation.
 * Audited app.js remains byte-identical. This transform runs on the built
 * source after canonical architecture source validation and contracts.
 * Fail closed if upstream signatures change: do not silently miscompute P&L. */
function once(src,from,to,label){
 const occurrences=src.split(from).length-1;
 if(occurrences!==1)throw Error('TR PR2 Lots transform '+label+': expected 1 match; found '+occurrences);
 return src.replace(from,to);
}
export function injectOperationLots(source){
 let out=String(source);
 if(out.includes('TR_PR2_COMPILED_LOT_RESULT'))throw Error('TR PR2 Lot transform already applied');
 out=once(out,
  "inst=c.inst,resultTicksRaw=String(get('resultTicks')??'').trim(),hasResult=resultTicksRaw!==''",
  "inst=c.inst,lotSave=globalThis.TradingResearchLotExecution?.prepareForSave?.(risk),resultTicksRaw=lotSave?.mode==='lots'?lotSave.resultTicksString:String(get('resultTicks')??'').trim(),hasResult=resultTicksRaw!==''",
  'weighted source result');
 out=once(out,
  "if(hasResult&&!Number.isFinite(ticks))return alert('El resultado en ticks no es un número válido.');",
  "if(lotSave?.error)return alert(lotSave.error);if(hasResult&&!Number.isFinite(ticks))return alert('El resultado en ticks no es un número válido.');",
  'lot errors fail before write');
 out=once(out,
  "strategyPlanSnapshot:strategySnapshot(risk),instrumentId:",
  "strategyPlanSnapshot:strategySnapshot(risk),executionMode:lotSave?.mode||previous?.executionMode||'aggregated',executionLots:lotSave?.mode==='lots'?lotSave.lots:lotSave?.mode==='aggregated'?[]:clone(previous?.executionLots||[]),instrumentId:",
  'atomic lot data persistence');
 out=once(out,
  '</section><section class="form-section"><div class="panel-title"><div><h3>Capturas de la operación</h3>',
  '</section>\${globalThis.TradingResearchLotExecution?.detailHtml?.(o)||\'\'}<section class="form-section"><div class="panel-title"><div><h3>Capturas de la operación</h3>',
  'lot executions visible in operation detail');
 return {source:out+'\n/* TR_PR2_COMPILED_LOT_RESULT */\n'};
}


/* The V31 taxonomy runtime owns the effective manual operation form/save,
   overriding the old app.js handler. Patch that active implementation too. */
export function injectTaxonomyOperationLots(source){
 let out=String(source);
 if(out.includes('TR_PR2_TAXONOMY_LOT_RESULT'))throw Error('TR PR2 Taxonomy Lot transform already applied');
 out=once(out,
  "inst=c.inst,resultTicksRaw=String(get('resultTicks')??'').trim(),hasResult=resultTicksRaw!==''",
  "inst=c.inst,lotSave=globalThis.TradingResearchLotExecution?.prepareForSave?.(risk),resultTicksRaw=lotSave?.mode==='lots'?lotSave.resultTicksString:String(get('resultTicks')??'').trim(),hasResult=resultTicksRaw!==''",
  'active taxonomy save weighted result');
 out=once(out,
  "if(hasResult&&!Number.isFinite(ticks))return alert('El resultado en ticks no es un número válido.');",
  "if(lotSave?.error)return alert(lotSave.error);if(hasResult&&!Number.isFinite(ticks))return alert('El resultado en ticks no es un número válido.');",
  'active taxonomy save validation');
 out=once(out,
  "strategyPlanSnapshot:strategySnapshot(risk),instrumentId:",
  "strategyPlanSnapshot:strategySnapshot(risk),executionMode:lotSave?.mode||previous?.executionMode||'aggregated',executionLots:lotSave?.mode==='lots'?lotSave.lots:lotSave?.mode==='aggregated'?[]:trTaxCopy(previous?.executionLots||[]),instrumentId:",
  'active taxonomy save lot metadata');
 return {source:out+'\n/* TR_PR2_TAXONOMY_LOT_RESULT */\n'};
}
