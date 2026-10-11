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
// Some consolidated render paths publish a previously captured sidebar template.
// Synchronize the *effective DOM* too, as in Lote 3; the source group IDs stay stable.
const actions=globalThis.TradingResearchActions;
const readView=()=>globalThis.TradingResearchCurrentViewReadContract?.current?.()||'dashboard';
function tr7GoAllowed(){
 if(isBacktest()&&readView()==='market'){
  if(typeof actions?.navigate==='function')actions.navigate('quality');
  return false;
 }
 return true;
}
if(typeof actions?.navigate==='function'){
 const baseNavigate=actions.navigate;
 actions.navigate=function(view,...args){return baseNavigate.call(this,view==='market'&&isBacktest()?'quality':view,...args);};
}
if(typeof actions?.switchPlan==='function'){
 const baseSwitch=actions.switchPlan;
 actions.switchPlan=function(id,...args){
  const next=globalThis.TradingResearchPlanReadContract?.byId?.(id);
  if(next&&contract.planEnvironment(next)==='backtest'&&readView()==='market'){
   globalThis.TradingResearchCurrentViewNavigationWriteContract?.navigate?.('quality');
  }
  const value=baseSwitch.call(this,id,...args);
  tr7ScheduleSidebarSync();
  return value;
 };
}
function tr7SyncSidebar(){
 const nav=document.querySelector('.sidebar .nav-organized');if(!nav)return;
 const op=nav.querySelector('.nav-group[data-nav-group="operativa"]');
 const controlGroup=nav.querySelector('.nav-group[data-nav-group="control"]');
 const block=nav.querySelector('[data-view="blocks"]');
 const target=op?.querySelector(':scope > .nav-group-items');
 if(block&&target&&block.parentElement!==target){
  const calendar=target.querySelector(':scope > [data-view="calendar"]');
  if(calendar)calendar.before(block);else target.append(block);
 }
 const market=nav.querySelector('[data-view="market"]');
 if(market){
  const hide=isBacktest();
  if(market.hidden!==hide)market.hidden=hide;
  if(market.disabled!==hide)market.disabled=hide;
  if(hide){market.classList.remove('active');market.removeAttribute('aria-current');}
 }
 const active=readView()==='blocks';
 if(block){
  block.classList.toggle('active',active);
  if(active)block.setAttribute('aria-current','page');else block.removeAttribute('aria-current');
 }
 if(active&&op){
  op.classList.add('has-active','tr3-ancestor','open');
  const toggle=op.querySelector(':scope > .nav-group-toggle');
  toggle?.setAttribute('aria-expanded','true');
  globalThis.TradingResearchNavigationRuntimeStateContract?.ensureGroupOpen?.('operativa');
 }
 if(controlGroup&&!controlGroup.querySelector('.nav-child.active')){
  controlGroup.classList.remove('has-active','tr3-ancestor');
  controlGroup.querySelector(':scope > .nav-group-toggle')?.removeAttribute('data-tr-parent-of-active');
 }
 tr7GoAllowed();
}
let tr7Scheduled=false;
function tr7ScheduleSidebarSync(){
 if(tr7Scheduled)return;
 tr7Scheduled=true;
 queueMicrotask(()=>{
  tr7Scheduled=false;
  try{tr7SyncSidebar();}catch(e){console.error('[Astra Lote 7 · sidebar]',e);}
 });
}
const tr7Observer=new MutationObserver(tr7ScheduleSidebarSync);
tr7Observer.observe(document.body,{childList:true,subtree:true});
tr7ScheduleSidebarSync();

globalThis.TradingResearchAstraLote7=Object.freeze({
 version:'1.0',environment,visibility:view=>view!=='market'||!isBacktest(),
 groups:()=>V318_NAV_GROUPS.map(g=>({id:g.id,items:g.items.map(i=>i[0])})),
 fallback:'quality'
});
queueMicrotask(()=>{try{globalThis.render?.();}catch(e){console.error('[Astra Lote 7]',e);}});
})();
