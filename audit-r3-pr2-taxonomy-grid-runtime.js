/* Auditoría R3 / PR2 · taxonomías canónicas en Desglose y Research Grid.
 * No changes to stored operations, statistical calculations or frozen OOS. */
(()=>{
'use strict';
if(globalThis.TradingResearchAuditR3Grid||typeof document==='undefined')return;
const api=globalThis.TradingResearchTaxonomyDomain;
if(!api||typeof breakdownModule!=='function'||typeof researchGridModule!=='function')return;
const activePlan=()=>globalThis.TradingResearchPlanReadContract?.current?.()||getCurrentPlan();
const allOps=()=>globalThis.TradingResearchOperationsReadContract?.current?.()||[];
const taxonomies=()=>{
 const p=activePlan();if(!p)return [];
 const saved=allOps().filter(o=>String(o.tradingPlanId)===String(p.id));
 return (p.taxonomyRegistry||[]).filter(t=>t.status!=='archived'||
  saved.some(o=>o.taxonomyValues?.[t.id]||
   (t.legacyKey&&o[t.legacyKey]!==undefined&&String(o[t.legacyKey]).trim()!=='')));
};
const taxByDim=(dim,p=activePlan())=>
 String(dim).startsWith('tax:')?(p?.taxonomyRegistry||[]).find(t=>String(t.id)===String(dim).slice(4)):null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const human=t=>t.name+(t.status==='archived'?' · histórica':'');
const forOp=(op,dim)=>{
 const p=typeof getPlan==='function'?getPlan(op.tradingPlanId):activePlan(),tax=taxByDim(dim,p);
 return tax?api.operationValue(tax,op):null;
};
const originalBreakdown=breakdownModule;
breakdownModule=function(ops){
 const html=originalBreakdown(ops),node=document.createElement('template');node.innerHTML=html;
 const select=node.content.querySelector('select#filterDimension');if(!select)return html;
 const selected=String(opsViewState.dimension||'setup');
 for(const tax of taxonomies()){
  const id='tax:'+tax.id,existing=[...select.options].find(o=>o.value===id);
  const fixed=tax.legacyKey?[...select.options].find(o=>o.value===tax.legacyKey):null;
  if(tax.kind==='core'&&fixed){
   // Keep the selected representation for historical filter views; offer
   // one semantic dimension, not both core + legacy under the same label.
   if(selected===id){fixed.remove();if(!existing)select.add(new Option(human(tax),id));}
   else existing?.remove();
   continue;
  }
  if(!existing)select.add(new Option(human(tax),id));
  else existing.textContent=human(tax);
 }
 const available=[...select.options];
 const current=available.find(o=>o.value===selected);
 if(current){
  for(const option of available){
   const chosen=option===current;option.selected=chosen;
   if(chosen)option.setAttribute('selected','');else option.removeAttribute('selected');
  }
 }
 return node.innerHTML;
};
const baseDimValues=researchDimValues;
researchDimValues=function(op,dim){
 if(!String(dim).startsWith('tax:'))return baseDimValues(op,dim);
 const value=forOp(op,dim);
 // Missing classifications are not silently represented as a measured class.
 return value?.id?[String(value.id)]:[];
};
const baseDisplay=researchDisplayValue;
researchDisplayValue=function(dim,val){
 if(!String(dim).startsWith('tax:'))return baseDisplay(dim,val);
 const tax=taxByDim(dim),value=(tax?.values||[]).find(v=>String(v.id)===String(val));
 return value?.name||value?.legacyValue||'Sin clasificar';
};
const baseDimLabel=researchDimLabel;
researchDimLabel=function(dim){return taxByDim(dim)?.name||baseDimLabel(dim);};
// Research Grid selection must feed the same lab taxonomy filter used by
// saved studies. A copy of the map is captured/restored by the native cell flow.
const baseLabField=researchLabField;
researchLabField=function(dim){return String(dim).startsWith('tax:')?'taxonomyFilters':baseLabField(dim);};
const baseCurrent=researchCurrentDimValue;
researchCurrentDimValue=function(dim){
 return String(dim).startsWith('tax:')?String(labState.taxonomyFilters?.[String(dim).slice(4)]||''):baseCurrent(dim);
};
const baseSet=researchSetLabDim;
researchSetLabDim=function(dim,val){
 if(!String(dim).startsWith('tax:'))return baseSet(dim,val);
 const tax=taxByDim(dim),id=String(dim).slice(4);
 if(!tax||!String(val))return false;
 labState.taxonomyFilters={...(labState.taxonomyFilters||{}),[id]:String(val)};
 return true;
};
const originalGrid=researchGridModule;
researchGridModule=function(ops){
 const html=originalGrid(ops),node=document.createElement('template');node.innerHTML=html;
 // The canonical event binder can replace data-tr-onchange with an opaque ID.
 // Row and column are the first two controls; later selects are metric/sample.
 const axes=[...node.content.querySelectorAll('.research-grid-controls select')].slice(0,2);
 const tax=taxonomies().filter(t=>t.kind==='custom');
 const opts=tax.map(t=>['tax:'+t.id,human(t)]);
 for(const [i,select] of axes.entries()){
  const selected=i===0?String(researchGridState.rowDim):String(researchGridState.colDim);
  for(const [id,label] of opts)if(![...select.options].some(o=>o.value===id))
   select.add(new Option(label,id));
  const match=[...select.options].find(o=>o.value===selected);
  if(match){for(const o of select.options){
   o.selected=o===match;if(o===match)o.setAttribute('selected','');else o.removeAttribute('selected');
  }}
 }
 // Explicit coverage note: a taxonomy axis only has categories where a
 // value was recorded; 'missing' must never be passed off as a zero result.
 if(axes.length&&[researchGridState.rowDim,researchGridState.colDim].some(d=>String(d).startsWith('tax:'))){
  const complete=ops.filter(o=>[researchGridState.rowDim,researchGridState.colDim]
   .every(dim=>!String(dim).startsWith('tax:')||!!forOp(o,dim))).length;
  const note=document.createElement('small');note.className='tr-r3-grid-coverage';
  note.textContent='Ejes de taxonomía · '+complete+' de '+ops.length+
    ' operaciones clasificadas; las restantes no forman categorías de ese eje.';
  node.content.querySelector('.research-grid-controls')?.after(note);
 }
 return node.innerHTML;
};
globalThis.TradingResearchAuditR3Grid=Object.freeze({
 version:'1',taxonomies,labels:()=>taxonomies().map(t=>({id:t.id,name:t.name,status:t.status||'active'}))
});
})();