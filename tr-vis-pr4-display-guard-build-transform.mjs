/* PR4 display-only guard: pending emotional group has no statistical expectancy. */
export function guardEmptyJournalStats(source){
 const before="${r.s.expectancy>=0?'+':''}${r.s.expectancy.toFixed(2)}R";
 const after="${typeof r.s.expectancy==='number'&&Number.isFinite(r.s.expectancy)?(r.s.expectancy>=0?'+':'')+r.s.expectancy.toFixed(2)+'R':'—'}";
 if(source.split(before).length!==2)throw new Error('Expected exactly one Journal group expectancy readout');
 return {source:source.replace(before,after),injected:true};
}
