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

/* TR-FEAT-OPS-01 · User-configurable operation register columns.
 * The pre-existing register table is the single source of cell contents and
 * actions. Only reorders/hides existing DOM cells; no domain or filter edits.
 * Browser-local preferences scoped per Trading Plan (not sent to cloud). */
const TR_COLUMNS=[
 ['entryDate','Fecha entrada'],['entryTime','Hora entrada'],
 ['exitDate','Fecha salida'],['exitTime','Hora salida'],
 ['weekday','Día'],['symbol','Símbolo'],['direction','Dirección'],
 ['setup','Setup'],['vd','VD'],['nr','NR'],['hypothesis','Hipótesis'],
 ['regime','Régimen'],['source','Origen'],['result','Resultado'],
 ['metric','Resultado en unidad'],['ticks','Ticks'],['netPnl','P&L neto'],
 ['commission','Comisión'],['actions','Acciones']
];
const TR_COL_STORE='tradingResearchOperationColumnsV1';
const TR_COL_KEYS=TR_COLUMNS.map(x=>x[0]),TR_FIXED='actions';
const TR_COL_EDITABLE=TR_COL_KEYS.filter(x=>x!==TR_FIXED);
const trColLabel=Object.fromEntries(TR_COLUMNS);
let trDraggedColumn='';
function trColumnPlanId(){
 const plan=globalThis.TradingResearchPlanReadContract?.current?.();
 return String(plan?.id||'none');
}
function trColumnReadStore(){
 try{
  const stored=JSON.parse(localStorage.getItem(TR_COL_STORE)||'{}');
  return stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
 }catch{return {};}
}
function trColumnNormalize(config){
 const order=Array.isArray(config?.order)?config.order.filter(x=>TR_COL_EDITABLE.includes(x)):[];
 const unique=[...new Set(order),...TR_COL_EDITABLE.filter(x=>!order.includes(x))];
 const hidden=Array.isArray(config?.hidden)?[...new Set(config.hidden.filter(x=>TR_COL_EDITABLE.includes(x)))]:[];
 if(hidden.length===TR_COL_EDITABLE.length)hidden.pop();
 return {order:unique,hidden};
}
function trColumnGet(){
 return trColumnNormalize(trColumnReadStore()[trColumnPlanId()]);
}
function trColumnSave(config){
 const fresh=trColumnNormalize(config);
 try{
  const store=trColumnReadStore();
  store[trColumnPlanId()]=fresh;
  localStorage.setItem(TR_COL_STORE,JSON.stringify(store));
 }catch(e){console.warn('[Trading Research · columnas] No se han podido guardar las preferencias locales.',e);}
 return fresh;
}
function trColumnChooser(pref){
 return '<div class="tr-colprefs-list" role="group" aria-label="Columnas disponibles">'+
 pref.order.map((key,index)=>{
  const checked=!pref.hidden.includes(key);
  const name=trColLabel[key];
  return '<div class="tr-colprefs-item" data-tr-cols-item="'+key+'">'+
   '<label><input type="checkbox" data-tr-cols-visible="'+key+'" '+(checked?'checked':'')+'><span>'+name+'</span></label>'+
   '<div class="tr-colprefs-order">'+
    '<button type="button" class="btn tiny ghost" data-tr-cols-move="'+key+'" data-tr-cols-delta="-1" aria-label="Mover '+name+' arriba" '+(index===0?'disabled':'')+'>↑</button>'+
    '<button type="button" class="btn tiny ghost" data-tr-cols-move="'+key+'" data-tr-cols-delta="1" aria-label="Mover '+name+' abajo" '+(index===pref.order.length-1?'disabled':'')+'>↓</button>'+
   '</div></div>';
 }).join('')+'</div>'+
 '<div class="tr-colprefs-footer"><small>«Acciones» permanece visible y fija al final.</small>'+
 '<button type="button" class="btn small" data-tr-cols-reset>Restaurar columnas</button></div>';
}
function trColumnApply(root,pref){
 const table=root?.querySelector('table.analytics-table.tr-ops-entry-exit');
 if(!table)return;
 const rows=[table.tHead?.rows?.[0],...table.querySelectorAll('tbody tr')].filter(Boolean);
 if(rows.some(row=>row.cells.length!==TR_COL_KEYS.length))return;
 const order=[...pref.order,TR_FIXED];
 for(const row of rows){
  const cells=[...row.cells];
  // Source render returns canonical cell order. Previous configuration is
  // reapplied to a fresh DOM or keys identify cells after an in-place change.
  cells.forEach((cell,i)=>{if(!cell.dataset.trColsKey)cell.dataset.trColsKey=TR_COL_KEYS[i];});
  const map=new Map(cells.map(c=>[c.dataset.trColsKey,c]));
  if(map.size!==TR_COL_KEYS.length)continue;
  for(const key of order){
   const cell=map.get(key);
   cell.classList.toggle('tr-cols-hidden',pref.hidden.includes(key));
   if(cell.tagName==='TH'&&key!==TR_FIXED){
    cell.draggable=true;cell.title='Arrastrar para mover «'+trColLabel[key]+'»';
    cell.setAttribute('aria-label',trColLabel[key]+' · arrastrable');
   }
   row.append(cell);
  }
 }
 table.dataset.trColumnsReady='1';
}
function trColumnRender(html){
 if(typeof html!=='string'||!html.includes('tr-ops-entry-exit'))return html;
 const template=document.createElement('template');template.innerHTML=html;
 const table=template.content.querySelector('.tr-ops-entry-exit.analytics-table');
 if(!table?.tHead?.rows?.[0]||table.tHead.rows[0].cells.length!==TR_COL_KEYS.length)return html;
 const pref=trColumnGet();
 trColumnApply(template.content,pref);
 const bar=document.createElement('div');bar.className='tr-colprefs';
 bar.innerHTML='<div class="tr-colprefs-top">'+
  '<div><button type="button" class="btn small tr-colprefs-toggle" data-tr-cols-toggle aria-expanded="false" aria-controls="tr-columns-chooser">⚙ Columnas <span>('+TR_COL_EDITABLE.filter(x=>!pref.hidden.includes(x)).length+'/'+TR_COL_EDITABLE.length+')</span></button>'+
  '<small>Arrastra los títulos de columna para ordenarlos, o usa las flechas del selector.</small></div></div>'+
  '<div class="tr-colprefs-panel" id="tr-columns-chooser" data-tr-cols-panel hidden>'+trColumnChooser(pref)+'</div>';
 template.content.prepend(bar);
 return template.innerHTML;
}
function trColumnUpdate(root){
 const bar=root.closest('.tr-colprefs');
 const pref=trColumnGet();
 if(bar){
  const open=bar.querySelector('[data-tr-cols-panel]')?.hidden===false;
  const panel=bar.querySelector('[data-tr-cols-panel]');
  if(panel){panel.innerHTML=trColumnChooser(pref);panel.hidden=!open;}
  const toggle=bar.querySelector('[data-tr-cols-toggle]');
  if(toggle){
   toggle.setAttribute('aria-expanded',String(open));
   const count=toggle.querySelector('span');
   if(count)count.textContent='('+TR_COL_EDITABLE.filter(x=>!pref.hidden.includes(x)).length+'/'+TR_COL_EDITABLE.length+')';
  }
 }
 const area=bar?.parentElement||document.getElementById('opsAnalyticsArea');
 if(area)trColumnApply(area,pref);
}
const trColumnBase=window.opsTable;
window.opsTable=function(...args){
 const html=trColumnBase.apply(this,args);
 if(globalThis.TradingResearchCurrentViewReadContract?.current?.()!=='operations')return html;
 return trColumnRender(html);
};
// Only our namespaced controls are handled here; existing native table
// "Ver/Editar" action delegation remains untouched.
document.addEventListener('click',event=>{
 const control=event.target?.closest?.('[data-tr-cols-toggle],[data-tr-cols-move],[data-tr-cols-reset]');
 if(!control||!control.closest('#view'))return;
 if(control.matches('[data-tr-cols-toggle]')){
  const bar=control.closest('.tr-colprefs'),panel=bar?.querySelector('[data-tr-cols-panel]');
  if(panel){panel.hidden=!panel.hidden;control.setAttribute('aria-expanded',String(!panel.hidden));}
  return;
 }
 if(control.matches('[data-tr-cols-reset]')){
  trColumnSave({order:TR_COL_EDITABLE,hidden:[]});
  trColumnUpdate(control);
  return;
 }
 if(control.matches('[data-tr-cols-move]')){
  const key=control.dataset.trColsMove,delta=Number(control.dataset.trColsDelta);
  const pref=trColumnGet(),from=pref.order.indexOf(key),to=from+delta;
  if(from<0||to<0||to>=pref.order.length)return;
  pref.order.splice(from,1);pref.order.splice(to,0,key);
  trColumnSave(pref);trColumnUpdate(control);
 }
});
document.addEventListener('change',event=>{
 const control=event.target;
 if(!control?.matches?.('[data-tr-cols-visible]')||!control.closest('#view'))return;
 const key=control.dataset.trColsVisible;
 if(!TR_COL_EDITABLE.includes(key))return;
 const pref=trColumnGet();
 pref.hidden=pref.hidden.filter(x=>x!==key);
 if(!control.checked)pref.hidden.push(key);
 if(pref.hidden.length===TR_COL_EDITABLE.length){control.checked=true;return;}
 trColumnSave(pref);trColumnUpdate(control);
});
document.addEventListener('dragstart',event=>{
 const cell=event.target?.closest?.('#view .tr-ops-entry-exit th[data-tr-cols-key]');
 if(!cell||cell.dataset.trColsKey===TR_FIXED)return;
 trDraggedColumn=cell.dataset.trColsKey;
 event.dataTransfer?.setData('text/plain',trDraggedColumn);
 if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
 cell.classList.add('tr-cols-dragging');
});
document.addEventListener('dragover',event=>{
 const cell=event.target?.closest?.('#view .tr-ops-entry-exit th[data-tr-cols-key]');
 if(cell&&trDraggedColumn&&cell.dataset.trColsKey!==TR_FIXED)event.preventDefault();
});
document.addEventListener('drop',event=>{
 const cell=event.target?.closest?.('#view .tr-ops-entry-exit th[data-tr-cols-key]');
 const fromKey=trDraggedColumn,toKey=cell?.dataset.trColsKey;
 if(!cell||!fromKey||!toKey||toKey===TR_FIXED)return;
 event.preventDefault();
 trDraggedColumn='';
 const pref=trColumnGet(),from=pref.order.indexOf(fromKey),to=pref.order.indexOf(toKey);
 if(from<0||to<0||from===to)return;
 pref.order.splice(from,1);pref.order.splice(to,0,fromKey);
 trColumnSave(pref);
 const bar=cell.closest('.table-module')?.querySelector('.tr-colprefs')||cell.closest('#view')?.querySelector('.tr-colprefs');
 if(bar)trColumnUpdate(bar.querySelector('[data-tr-cols-toggle]'));
});
document.addEventListener('dragend',()=>{
 trDraggedColumn='';
 document.querySelectorAll('.tr-cols-dragging').forEach(el=>el.classList.remove('tr-cols-dragging'));
});
globalThis.TradingResearchOperationColumns=Object.freeze({
 read:()=>trColumnGet(),count:TR_COL_EDITABLE.length,version:'1'
});

})();
