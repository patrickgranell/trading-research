/* Expose the existing Constructor recipe through a bounded adapter. */
export function injectSharedBuilderSelection(source){
 const anchor='  actions.tpBuilderRender=renderBuilder;';
 if(source.split(anchor).length!==2)throw Error('Constructor selection anchor changed');
 const resultAnchor='    const p=ensureSource(),f=ui.filters;if(!p)return [];';
 if(source.split(resultAnchor).length!==2)throw Error('Constructor result selection anchor changed');
 const recentAnchor="s=calcMetricStats(recent,unit,'gross')";
 if(source.split(recentAnchor).length!==2)throw Error('Dashboard recent sample anchor changed');
 return source.replace(recentAnchor,"s=calcMetricStats(recent,unit,globalThis.TradingResearchSharedFilters?.snapshot?.().basis||'gross')")
 .replace(resultAnchor,resultAnchor+`\n    if(globalThis.TradingResearchSharedFilters)return globalThis.TradingResearchSharedFilters.selectFor(p,{...f,basis:'net'},sourceOps());`)
 .replace(anchor,`  Object.defineProperty(globalThis,'TradingResearchBuilderSelectionContract',{value:Object.freeze({
    read:()=>({sourcePlanId:ensureSource()?.id||'',filters:clone(ui.filters)}),
    apply:filters=>{ensureSource();ui.filters={...blankFilters(),...clone(filters)};},
    setSource:id=>{if(!plansWithData().some(p=>p.id===id))return false;ui.sourcePlanId=id;ui.filters=blankFilters();return true;}
  })});
`+anchor);
}
