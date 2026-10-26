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
function trExtraCell(op,key){
 if(key.startsWith('tax:')){
  const plan=globalThis.TradingResearchPlanReadContract?.current?.();
  const id=key.slice(4),tax=(plan?.taxonomyRegistry||[]).find(t=>String(t.id)===id);
  if(!tax)return '—';
  const selected=op.taxonomyValues?.[id],match=(tax.values||[]).find(x=>String(x.id)===String(selected));
  return match?.name||match?.legacyValue||(tax.legacyKey?String(op[tax.legacyKey]||'—'):'—');
 }
 const raw=x=>x===null||x===undefined||String(x).trim()===''?'—':String(x);
 const num=(x,suffix='',dec=2)=>{
  if(x===null||x===undefined||String(x).trim()===''||!Number.isFinite(Number(x)))return '—';
  const n=Number(x);return (n>0?'+':'')+n.toLocaleString('es-ES',{maximumFractionDigits:dec})+suffix;
 };
 if(key==='context')return raw(op.h4Context);
 if(key==='h4Phase')return raw(op.h4Phase);
 if(key==='tradeType')return raw(op.tradeType);
 if(key==='entryPrice')return raw(op.entryPrice);
 if(key==='mfeTicks'||key==='maeTicks'){
  const metric=key==='mfeTicks'?'mfe':'mae';
  const status=typeof dqMetricStatus==='function'?dqMetricStatus(op,metric):
    op[key]===null||op[key]===undefined?'missing':'measured';
  return status==='na'?'N/A':status==='measured'?num(op[key],' t',3):'—';
 }
 if(key==='rNet'){
  if(op.result==='pending')return '—';
  return num(typeof opMetricValue==='function'?opMetricValue(op,'r','net'):op.rMultiple,' R',3);
 }
 if(key==='pnlGross')return op.result==='pending'?'—':num(op.pnlGross,' '+(op.instrumentSnapshot?.currency||'USD'));
 return '—';
}
function transformRegister(html,ops){
  if(!Array.isArray(ops)||typeof html!=='string')return html;
  const fragment=document.createElement('template');
  fragment.innerHTML=html;
  const table=fragment.content.querySelector('table.analytics-table');
  const heading=table?.tHead?.rows?.[0],rows=table?.tBodies?.[0]?.rows;
  if(!heading||!rows||rows.length!==ops.length)return html;
  // Both classic and V31.9 renderers place Bloque in column 4; 
 // normalize both Operaciones and Laboratorio to the same register schema.
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
  trColumnRefresh(ops);
  [...rows].forEach((row,i)=>{
    const [date,time]=displayExit(ops[i]);
    row.cells[3].remove();
    const day=date==='—'?newCell('td','—'):newCell('td',date);
    const hour=newCell('td',time);
    day.className='tr-ops-exit-date'+(date==='—'?' tr-ops-exit-empty':'');
    hour.className='tr-ops-exit-hour'+(time==='—'?' tr-ops-exit-empty':'');
    row.cells[1].after(day,hour);
  });
  // Presentation only: show execution snapshots, never the planned TP as a result.
  const newColumns=TR_COL_KEYS.slice(18,-1);
  heading.lastElementChild.before(...newColumns.map(key=>newCell('th',trColLabel[key])));
  [...rows].forEach((row,i)=>{
    const op=ops[i]||{},lotData=Array.isArray(op.executionLots)?op.executionLots:[];
    const summary=lotData.length
      ?lotData.map((lot,j)=>'L'+(j+1)+' '+trLotDisplay(lot)).join(' · ')
      :(op.executionMode==='aggregated'||op.resultTicks!==undefined?'Agregado':'—');
    const cells=newColumns.map(key=>{
      const match=/^lot([1-9][0-9]*)$/.exec(key);
      const lot=match?lotData[Number(match[1])-1]:null;
      const value=key==='contracts'?trContractsDisplay(op):
        key==='lots'?summary:match?(lot?trLotDisplay(lot):'—'):trExtraCell(op,key);
      const cell=newCell('td',value);
      cell.className='tr-ops-'+(key==='contracts'?'contracts':key==='lots'?'lot-summary':'lot-detail');
      if(key==='lots'&&lotData.length)cell.title='Resultado real por lote (ticks/contrato, no TP previsto)';
      if(match&&lot)cell.title='Lote '+match[1]+' · '+(lot.quantity||'—')+' contrato(s) · resultado real en ticks/contrato';
      return cell;
    });
    row.lastElementChild.before(...cells);
  });
  table.classList.add('tr-ops-entry-exit');
  return fragment.innerHTML;
}
window.opsTable=function(...args){
  const html=base.apply(this,args);
  if(!['operations','lab'].includes(globalThis.TradingResearchCurrentViewReadContract?.current?.()))return html;
  return transformRegister(html,args[0]);
};

/* TR-FEAT-OPS-01 · User-configurable columns for Operaciones and Laboratorio.
 * The pre-existing register table is the single source of cell contents and
 * actions. Only reorders/hides existing DOM cells; no domain or filter edits.
 * Browser-local preferences scoped per Trading Plan and screen (not sent to cloud). */
const TR_BASE_COLUMNS=[
 ['entryDate','Fecha entrada'],['entryTime','Hora entrada'],
 ['exitDate','Fecha salida'],['exitTime','Hora salida'],
 ['weekday','Día'],['symbol','Símbolo'],['direction','Dirección'],
 ['setup','Setup'],['vd','VD'],['nr','NR'],['hypothesis','Hipótesis'],
 ['regime','Régimen'],['source','Origen'],['result','Resultado'],
 ['metric','Resultado en unidad'],['ticks','Ticks'],['netPnl','P&L neto'],
 ['commission','Comisión'],['contracts','Contratos'],['lots','Desglose lotes'],
 ['context','Contexto H4'],['h4Phase','Fase H4'],['tradeType','Tipo de operación'],
 ['entryPrice','Precio de entrada'],['mfeTicks','MFE (ticks)'],['maeTicks','MAE (ticks)'],
 ['rNet','R neta'],['pnlGross','P&L bruto'],['actions','Acciones']
];
const TR_COL_STORE='tradingResearchOperationColumnsV1';
const TR_OPTIONAL_COLUMNS=new Set(['context','h4Phase','tradeType','entryPrice','mfeTicks','maeTicks','rNet','pnlGross']);
const TR_FIXED='actions';
let TR_COLUMNS=TR_BASE_COLUMNS,TR_COL_KEYS=TR_COLUMNS.map(x=>x[0]);
let TR_COL_EDITABLE=TR_COL_KEYS.filter(x=>x!==TR_FIXED);
let trColLabel=Object.fromEntries(TR_COLUMNS);
let trDraggedColumn='';
function trColumnRefresh(ops=[]){
 const plan=globalThis.TradingResearchPlanReadContract?.current?.();
 const all=globalThis.TradingResearchOperationsReadContract?.current?.();
 const saved=Array.isArray(all)?all.filter(o=>String(o.tradingPlanId||'')===String(plan?.id||'')):[];
 const risks=Array.isArray(plan?.riskStrategies)?plan.riskStrategies:[];
 const count=Math.max(0,...risks.map(r=>Array.isArray(r.lots)?r.lots.length:0),
   ...[...ops,...saved].map(o=>Array.isArray(o?.executionLots)?o.executionLots.length:0));
 const taxonomyCols=(plan?.taxonomyRegistry||[]).filter(t=>t.kind==='custom'&&
   (t.status!=='archived'||saved.some(o=>o.taxonomyValues?.[t.id]))).map(t=>
   ['tax:'+t.id,t.name+(t.status==='archived'?' (archivada)':'')]);
 TR_COLUMNS=[...TR_BASE_COLUMNS.slice(0,-1),
   ...Array.from({length:count},(_,i)=>['lot'+(i+1),'Lote '+(i+1)+' (ticks/ct)']),
   ...taxonomyCols,
   TR_BASE_COLUMNS.at(-1)];
 TR_COL_KEYS=TR_COLUMNS.map(x=>x[0]);
 TR_COL_EDITABLE=TR_COL_KEYS.filter(x=>x!==TR_FIXED);
 trColLabel=Object.fromEntries(TR_COLUMNS);
}
function trLotDisplay(lot){
 if(!lot||lot.resultTicks===null||lot.resultTicks===undefined||lot.status==='open')return 'Pend.';
 const n=Number(lot.resultTicks),qty=Number(lot.quantity);
 if(!Number.isFinite(n))return '—';
 return (n>0?'+':'')+String(Number(n.toFixed(5)))+'t/ct'+(Number.isInteger(qty)&&qty>0?' ×'+qty:'');
}
function trContractsDisplay(op){
 const lots=Array.isArray(op?.executionLots)?op.executionLots:[];
 const qty=lots.length?lots.reduce((sum,l)=>sum+Number(l.quantity||0),0):Number(op?.contracts);
 return Number.isSafeInteger(qty)&&qty>0?String(qty):'—';
}
function trColumnPlanId(){
 const plan=globalThis.TradingResearchPlanReadContract?.current?.();
 const view=globalThis.TradingResearchCurrentViewReadContract?.current?.();
 // Preserve existing Operaciones keys; Laboratorio owns a separate layout.
 return String(plan?.id||'none')+(view==='lab'?':lab':'');
}
function trColumnReadStore(){
 try{
  const stored=JSON.parse(localStorage.getItem(TR_COL_STORE)||'{}');
  return stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
 }catch{return {};}
}
function trColumnNormalize(config){
 const explicitOrder=Array.isArray(config?.order)?config.order.filter(x=>TR_COL_EDITABLE.includes(x)):[];
 const order=explicitOrder;
 const unique=[...new Set(order),...TR_COL_EDITABLE.filter(x=>!order.includes(x))];
 // Place the two immediately useful fields beside identity and results on old
 // and fresh layouts; never move columns the user has deliberately arranged.
 const after=(key,anchor)=>{
  if(explicitOrder.includes(key)||!unique.includes(key)||!unique.includes(anchor))return;
  unique.splice(unique.indexOf(key),1);
  unique.splice(unique.indexOf(anchor)+1,0,key);
 };
 after('contracts','symbol');
 after('lots','ticks');
 for(const key of TR_COL_EDITABLE.filter(x=>/^lot[1-9][0-9]*$/.test(x)).reverse())after(key,'lots');
 const hidden=Array.isArray(config?.hidden)?[...new Set(config.hidden.filter(x=>TR_COL_EDITABLE.includes(x)))]:[];
 // Per-lot columns are opt-in; old saved layouts keep their original visibility.
 for(const key of TR_COL_EDITABLE.filter(x=>/^lot[1-9][0-9]*$/.test(x)||TR_OPTIONAL_COLUMNS.has(x)||x.startsWith('tax:'))){
  if(!explicitOrder.includes(key)&&!hidden.includes(key))hidden.push(key);
 }
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
const trColEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function trColFamily(key){
 if(key.startsWith('tax:'))return 'Taxonomías personalizadas';
 if(['entryDate','entryTime','exitDate','exitTime','weekday','symbol','contracts','direction'].includes(key))return 'Identificación';
 if(['setup','vd','nr','hypothesis','context','h4Phase','tradeType'].includes(key))return 'Oportunidad y clasificación';
 if(['regime','entryPrice'].includes(key))return 'Entrada y riesgo previsto';
 if(['lots','mfeTicks','maeTicks'].includes(key)||/^lot[1-9][0-9]*$/.test(key))return 'Salida, lotes y excursiones';
 if(['result','metric','ticks','rNet','netPnl','pnlGross','commission'].includes(key))return 'Resultado y costes';
 return 'Revisión y origen';
}
function trColumnChooser(pref){
 return '<div class="tr-colprefs-list" role="group" aria-label="Columnas disponibles">'+
 pref.order.map((key,index)=>{
  const checked=!pref.hidden.includes(key);
  const name=trColEscape(trColLabel[key]),family=trColFamily(key);
  const previous=index?trColFamily(pref.order[index-1]):'';
  return (family!==previous?'<div class="tr-colprefs-family">'+family+'</div>':'')+
   '<div class="tr-colprefs-item" data-tr-cols-item="'+key+'">'+
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
 if(!['operations','lab'].includes(globalThis.TradingResearchCurrentViewReadContract?.current?.()))return html;
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
  trColumnSave({order:[],hidden:TR_COL_EDITABLE.filter(x=>/^lot[1-9][0-9]*$/.test(x))});
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
 read:()=>trColumnGet(),get count(){return TR_COL_EDITABLE.length;},version:'2'
});

})();
