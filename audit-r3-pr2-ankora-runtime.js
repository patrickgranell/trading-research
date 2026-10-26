/* R3 PR2 · Ankora: preserve manually enriched fields on source-only reimports. */
(()=>{
'use strict';
if(typeof operationFromDraft!=='function'||globalThis.TradingResearchAuditR3Ankora)return;
const source=operationFromDraft;
const fields={
 notes:'Notes',setup:'Setup',vd:'VD',nr:'NR',hypothesis:'Hypothesis',
 h4Context:'Custom1',tradeType:'Custom2'
};
const preserve=(previous,next)=>{
 if(!previous?.raw?.columns)return next;
 const prior=previous.raw.columns;
 for(const [key,column] of Object.entries(fields)){
  if(!(column in prior))continue;
  const original=String(prior[column]??'').trim();
  const baseline=key==='hypothesis'&&original?(original.startsWith('H')?original:'H'+original):original;
  if(String(previous[key]??'').trim()!==baseline)next[key]=previous[key];
 }
 return next;
};
operationFromDraft=function(d,plan,batchId,existing=null){
 const op=preserve(existing,source(d,plan,batchId,existing));
 if(op.resultTicks===0&&String(d.exitDate||'').trim())op.result='flat';
 return op;
};
globalThis.TradingResearchAuditR3Ankora=Object.freeze({version:'1',fields:Object.freeze(Object.keys(fields))});
})();