/* PR4 display-only guard: pending emotional group has no statistical expectancy. */
export function guardEmptyJournalStats(source){
 const before="${r.s.expectancy>=0?'+':''}${r.s.expectancy.toFixed(2)}R";
 const after="${typeof r.s.expectancy==='number'&&Number.isFinite(r.s.expectancy)?(r.s.expectancy>=0?'+':'')+r.s.expectancy.toFixed(2)+'R':'—'}";
 if(source.split(before).length!==2)throw new Error('Expected exactly one Journal group expectancy readout');
 let output=source.replace(before,after);
 for(const key of ['stress','focus','intensity']){
  const target="st."+key+".toFixed(1)+'/5'";
  if(output.split(target).length!==2)throw new Error('Unexpected Journal '+key+' display readout');
  const safe="(typeof st."+key+"==='number'&&Number.isFinite(st."+key+")?st."+key+".toFixed(1)+'/5':'—')";
  output=output.replace(target,safe);
 }
 return {source:output,injected:true};
}
