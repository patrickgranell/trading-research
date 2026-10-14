/* PR3 — targeted build-time extension of the existing Builder previewTable.
   The canonical source TP, filter engine and derivation stay untouched. */
export function injectBuilderPreviewColumns(source){
 const marker='const previewTable=ops=>{';
 if(source.split(marker).length!==2)throw new Error('PR3 Builder previewTable anchor missing or duplicated');
 const replacement=marker+"\n    if(globalThis.TradingResearchBuilderColumnContract?.render)return globalThis.TradingResearchBuilderColumnContract.render(ops,ensureSource());";
 return {source:source.replace(marker,replacement),injected:true};
}
