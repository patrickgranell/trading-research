/* Auditoría R3 / PR2: reorganización del formulario sin crear ni alterar campos. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchAuditR3Pr2Form)return;
const section=(form,name)=>[...form.querySelectorAll(':scope > .form-section')]
 .find(node=>node.querySelector(':scope > h4')?.textContent.includes(name));
const field=(form,id)=>form.querySelector('#f-'+id)?.closest('.field')||null;
function reflow(){
 for(const form of document.querySelectorAll('.modal-backdrop #operationForm')){
  const plan=section(form,'Trading Plan'),session=section(form,'Sesión y régimen');
  const execution=section(form,'Ejecución y resultado'),opportunity=section(form,'Oportunidad');
  if(!session||!execution||!opportunity)continue;
  const target=plan||form.firstElementChild;
  if(target?.nextElementSibling!==execution)target.after(execution);
  if(execution.nextElementSibling!==session)execution.after(session);
  if(session.nextElementSibling!==opportunity)session.after(opportunity);
  const grid=execution.querySelector(':scope > .form-grid');
  if(grid){
   const first=['entryDate','direction','riskStrategyId'].map(id=>field(form,id)).filter(Boolean);
   if(first.some((node,i)=>grid.children[i]!==node))
    for(const node of [...first].reverse())grid.prepend(node);
   const exit=field(form,'exitDate'),result=field(form,'resultTicks');
   if(exit&&result&&result.nextElementSibling!==exit)result.after(exit);
  }
  const hyp=field(form,'hypothesis'),opGrid=opportunity.querySelector(':scope > .form-grid');
  if(hyp&&opGrid&&hyp.parentElement!==opGrid)opGrid.prepend(hyp);
  const preview=form.querySelector('#opRiskPreview'),lots=form.querySelector('.tr-lot-editor');
  if(preview&&preview.parentElement!==execution)execution.append(preview);
  if(lots&&lots.parentElement!==execution)execution.append(lots);
  for(const [node,label] of [[execution,'1 · Operación · entrada, salida y resultado'],
    [session,'2 · Contexto y gestión'],[opportunity,'3 · Clasificación técnica y notas']]){
   const h=node.querySelector(':scope > h4');if(h&&h.textContent!==label)h.textContent=label;
  }
  execution.classList.add('tr-r3-primary-operation');
  session.classList.add('tr-r3-secondary-context');
  opportunity.classList.add('tr-r3-secondary-classification');
  form.dataset.trR3Pr2='1';
 }
}
new MutationObserver(records=>{
 if(records.some(r=>r.addedNodes.length))reflow();
}).observe(document.body,{subtree:true,childList:true});
reflow();
globalThis.TradingResearchAuditR3Pr2Form=Object.freeze({reflow,version:'1'});
})();