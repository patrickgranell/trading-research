/* Lote 7 · navegación contextual. No altera planes, operaciones ni Market Data. */
(()=>{
'use strict';
const contract=globalThis.TradingResearchOperationSemanticsContract;
if(!contract||typeof V318_NAV_GROUPS==='undefined'||typeof v318GroupHtml!=='function'||typeof shell!=='function')return;
const environment=()=>contract.planEnvironment(globalThis.TradingResearchPlanReadContract?.current?.());
const isBacktest=()=>environment()==='backtest';
const operational=V318_NAV_GROUPS.find(g=>g.id==='operativa');
const control=V318_NAV_GROUPS.find(g=>g.id==='control');
const data=V318_NAV_GROUPS.find(g=>g.id==='data');
if(!operational||!control||!data)throw Error('Lote 7: agrupación de navegación inesperada');
const matches=V318_NAV_GROUPS.flatMap(g=>g.items.filter(i=>i[0]==='blocks').map(i=>({group:g,item:i})));
if(matches.length!==1)throw Error('Lote 7: Bloques debe tener exactamente un destino');
const previousGroup=matches[0].group;
if(previousGroup.id!=='operativa'){
 previousGroup.items.splice(previousGroup.items.indexOf(matches[0].item),1);
 operational.items.splice(operational.items.findIndex(i=>i[0]==='operations')+1,0,matches[0].item);
}
// Retain the original route IDs and handlers. Backtesting hides *only* Market Data.
const originalGroupHtml=v318GroupHtml;
v318GroupHtml=function(group){
 if(group.id==='data'&&isBacktest()){
  const allowed=group.items.filter(item=>item[0]!=='market');
  if(!allowed.length)return '';
  return originalGroupHtml({...group,items:allowed});
 }
 return originalGroupHtml(group);
};
// A TP switch can occur while the user is inside Market Data. Guard the route
// at the shell boundary, before the view HTML is built, including deep links.
const originalShell=shell;
shell=function(...args){
 if(isBacktest()&&currentView==='market')currentView='quality';
 return originalShell.apply(this,args);
};
globalThis.TradingResearchAstraLote7=Object.freeze({
 version:'1.0',environment,visibility:view=>view!=='market'||!isBacktest(),
 groups:()=>V318_NAV_GROUPS.map(g=>({id:g.id,items:g.items.map(i=>i[0])})),
 fallback:'quality'
});
queueMicrotask(()=>{try{globalThis.render?.();}catch(e){console.error('[Astra Lote 7]',e);}});
})();
