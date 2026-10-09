/* TR-UX-003 / #104 · register presentation only. No data, metrics or persistence changes. */
(()=>{
'use strict';
const base=window.opsTable;
if(typeof base!=='function')return;
const hasExitTimestamp=o=>o?.result!=='pending';
function closedAt(o){
  if(!hasExitTimestamp(o))return null;
  // Prefer the stored exit. Reconciliation evidence/import metadata are only
  // fallbacks when they supply an actual complete timestamp.
  const value=o?.exitDate||o?.executionEvidence?.exitDate||o?.raw?.columns?.ExitDateTime;
  if(!value)return null;
  const d=value instanceof Date?value:new Date(value);
  return Number.isFinite(d.getTime())?d:null;
}
const displayExit=o=>{
  const d=closedAt(o);
  if(!d)return ['—','—'];
  return [d.toLocaleDateString('es-ES'),d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})];
};
const newCell=(tag,content)=>{
  const el=document.createElement(tag);
  el.textContent=content;
  return el;
};
function transformRegister(html,ops){
  if(!Array.isArray(ops)||!ops.length||typeof html!=='string')return html;
  const fragment=document.createElement('template');
  fragment.innerHTML=html;
  const table=fragment.content.querySelector('table.analytics-table');
  const heading=table?.tHead?.rows?.[0],rows=table?.tBodies?.[0]?.rows;
  if(!heading||!rows||rows.length!==ops.length)return html;
  // Both classic and V31.9 renderers place Bloque in column 4.
  if(heading.cells.length<6||heading.cells[0].textContent.trim()!=='Fecha'||
    heading.cells[1].textContent.trim()!=='Hora'||
    heading.cells[3].textContent.trim()!=='Bloque')return html;
  const resultIndex=[...heading.cells].findIndex(c=>c.textContent.trim()==='Resultado');
  if(resultIndex<0||resultIndex!==heading.cells.length-6)return html;
  // Confirm the entire table shape before editing the detached fragment.
  if([...rows].some(row=>row.cells.length!==heading.cells.length))return html;
  heading.cells[0].textContent='Fecha entrada';
  heading.cells[1].textContent='Hora entrada';
  heading.cells[3].remove();
  heading.cells[1].after(newCell('th','Fecha salida'),newCell('th','Hora salida'));
  [...rows].forEach((row,i)=>{
    const [date,time]=displayExit(ops[i]);
    row.cells[3].remove();
    const day=date==='—'?newCell('td','—'):newCell('td',date);
    const hour=newCell('td',time);
    day.className='tr-ops-exit-date'+(date==='—'?' tr-ops-exit-empty':'');
    hour.className='tr-ops-exit-hour'+(time==='—'?' tr-ops-exit-empty':'');
    row.cells[1].after(day,hour);
  });
  table.classList.add('tr-ops-entry-exit');
  return fragment.innerHTML;
}
window.opsTable=function(...args){
  const html=base.apply(this,args);
  if(globalThis.TradingResearchCurrentViewReadContract?.current?.()!=='operations')return html;
  return transformRegister(html,args[0]);
};
})();
