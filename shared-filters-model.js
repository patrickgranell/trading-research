/* Shared selection schema. UI preferences only; never rewrites operations. */
(()=>{
'use strict';
const textFields=['q','dateFrom','dateTo','timeFrom','timeTo','month','year','direction','setup','vd','nr','hypothesis','context','hour','risk','layer','source','result','contract','block','emotion','behavior','emotionStatus','focus','stress','rMin','rMax'];
const copy=value=>JSON.parse(JSON.stringify(value));
function normalize(value={}){
 const out=Object.fromEntries(textFields.map(k=>[k,String(value[k]??'')]));
 out.days=[...new Set((Array.isArray(value.days)?value.days:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))].sort((a,b)=>a-b);
 out.taxonomyFilters=Object.fromEntries(Object.entries(value.taxonomyFilters||{}).filter(([k,v])=>k&&v!==''&&v!=null).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,String(v)]));
 out.riskPolicy=value.riskPolicy==='plan'?'plan':'raw';
 return out;
}
const signature=value=>JSON.stringify(normalize(value));
const count=value=>{const f=normalize(value);return textFields.filter(k=>f[k]!=='').length+(f.days.length?1:0)+Object.keys(f.taxonomyFilters).length;};
const context=plan=>JSON.stringify([String(plan?.id||''),String(plan?.version||''),String(plan?.planEnvironment||'unclassified')]);
const api=Object.freeze({textFields:Object.freeze(textFields),normalize,signature,count,context,copy});
Object.defineProperty(globalThis,'TradingResearchSharedFiltersModel',{value:api});
})();
