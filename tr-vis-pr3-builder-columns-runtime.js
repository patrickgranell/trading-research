/* TR-VIS PR3 — independent column picker for Constructor preview.
 * Operates only on filtered operations received from original Builder closure.
 * No changes to filtering, domain, source TP, saved study or derivation. */
(()=>{
'use strict';
if(globalThis.TradingResearchBuilderColumnContract)return;
const STORAGE='tradingResearchBuilderPreviewColumnsV1';
const columns=[
 ['entryDate','Fecha entrada'],['entryTime','Hora entrada'],
 ['exitDate','Fecha salida'],['exitTime','Hora salida'],
 ['weekday','Día'],['contract','Contrato / vencimiento'],
 ['contracts','N.º contratos'],['direction','Dirección'],
 ['setup','Setup'],['vd','VD'],['nr','NR'],['hypothesis','Hipótesis'],
 ['context','Contexto H4'],['phase','Fase H4'],['type','Tipo de operación'],
 ['regime','Régimen de gestión'],['origin','Origen del registro'],
 ['result','Resultado'],['ticks','Ticks totales'],
 ['rNet','R neta'],['pnlGross','P&L bruto'],['pnlNet','P&L neto'],
 ['commission','Comisión'],['lots','Desglose lotes'],
 ['lot1','Lote 1 (ticks/ct)'],['lot2','Lote 2 (ticks/ct)']
];
const keys=columns.map(([id])=>id),labels=Object.fromEntries(columns);
const shownByDefault=['entryDate','direction','setup','vd','context','result','rNet'];
let previewOps=[],previewPlanId='none',pickerOpen=false,dragKey='';
const e=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const money=(n,unit='USD')=>Number.isFinite(Number(n))&&n!==''&&n!==null&&n!==undefined?
 Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(unit==='EUR'?'€':'US$'):'—';
const signed=(n,suffix='')=>Number.isFinite(Number(n))&&n!==''&&n!==null&&n!==undefined?
 (Number(n)>0?'+':'')+String(Number(Number(n).toFixed(3)))+suffix:'—';
const value=op=>op===null||op===undefined||op===''?'—':String(op);
const datePart=(s,part)=>{const v=String(s||'');if(!v)return '—';return part==='time'?v.slice(11,16)||'—':v.slice(0,10)||'—';};
const weekdays=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const D=op=>{const t=String(op.entryDate||'').slice(0,10).split('-').map(Number);return t.length===3&&t.every(Number.isFinite)?weekdays[new Date(Date.UTC(t[0],t[1]-1,t[2])).getUTCDay()]||'—':'—';};
function lotValue(op,index){
 const lot=Array.isArray(op.executionLots)?op.executionLots[index]:null;
 if(!lot||lot.resultTicks===null||lot.resultTicks===undefined||lot.status==='open')return '—';
 const n=Number(lot.resultTicks),qty=Number(lot.quantity);
 return Number.isFinite(n)?signed(n,'t/ct')+(qty>0?' ×'+qty:''):'—';
}
function lotSummary(op){
 if(!Array.isArray(op.executionLots)||!op.executionLots.length)return '—';
 return op.executionLots.map((x,i)=>'L'+(i+1)+': '+lotValue(op,i)).join(' · ');
}
function cell(op,key){
 switch(key){
  case 'entryDate': return datePart(op.entryDate,'date');
  case 'entryTime': return datePart(op.entryDate,'time');
  case 'exitDate': return datePart(op.exitDate||op.executionEvidence?.exitDate,'date');
  case 'exitTime': return datePart(op.exitDate||op.executionEvidence?.exitDate,'time');
  case 'weekday':return D(op);
  case 'contract':return value(op.contract||op.instrumentSnapshot?.symbol);
  case 'contracts':{
   const lots=Array.isArray(op.executionLots)?op.executionLots:[];
   const count=lots.length?lots.reduce((a,l)=>a+Number(l.quantity||0),0):Number(op.contracts);
   return Number.isInteger(count)&&count>0?String(count):'—';
  }
  case 'direction':return value(op.direction);
  case 'setup':return value(op.setup);
  case 'vd':return value(op.vd);
  case 'nr':return value(op.nr);
  case 'hypothesis':return value(op.hypothesis);
  case 'context':return value(op.h4Context);
  case 'phase':return value(op.h4Phase);
  case 'type':return value(op.tradeType);
  case 'regime':return value(op.riskStrategyName);
  case 'origin':return value(op.raw?.source||op.origin||'Manual');
  case 'result':return {win:'Ganadora',loss:'Perdedora',pending:'Pendiente',flat:'Neutra'}[op.result]||value(op.result);
  case 'ticks':return signed(op.resultTicks,'t');
  case 'rNet':{
   const n=typeof opMetricValue==='function'?opMetricValue(op,'r','net'):op.rMultiple;
   return signed(n,'R');
  }
  case 'pnlGross':return money(op.pnlGross,op.instrumentSnapshot?.currency);
  case 'pnlNet':return money(op.pnlNet,op.instrumentSnapshot?.currency);
  case 'commission':return money(op.commission,op.instrumentSnapshot?.currency);
  case 'lots':return lotSummary(op);
  case 'lot1':return lotValue(op,0);
  case 'lot2':return lotValue(op,1);
  default:return '—';
 }
}
function persisted(planId){
 try{
  const root=JSON.parse(localStorage.getItem(STORAGE)||'{}');
  return root&&typeof root==='object'?root[planId]:null;
 }catch{return null;}
}
function pref(planId){
 const saved=persisted(planId);
 const order=[...new Set(Array.isArray(saved?.order)?saved.order.filter(k=>keys.includes(k)):keys)];
 for(const key of keys)if(!order.includes(key))order.push(key);
 const hidden=Array.isArray(saved?.hidden)?
  [...new Set(saved.hidden.filter(k=>keys.includes(k)))]:keys.filter(k=>!shownByDefault.includes(k));
 if(hidden.length===keys.length)hidden.splice(hidden.indexOf('entryDate'),1);
 return {order,hidden};
}
function save(p){
 const valid={order:[...p.order],hidden:[...p.hidden]};
 try{
  const all=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};
  all[previewPlanId]=valid;localStorage.setItem(STORAGE,JSON.stringify(all));
 }catch(error){console.warn('Constructor: preferencias locales de columnas no guardadas',error);}
}
function chooser(p){
 return '<div class="trvis3-bc-picker-items" role="group" aria-label="Columnas disponibles del Constructor">'+p.order.map((key,index)=>
  '<div class="trvis3-bc-picker-item"><label><input type="checkbox" data-trvis3-bc-visible="'+key+'" '+(p.hidden.includes(key)?'':'checked')+'><span>'+e(labels[key])+'</span></label>'+
  '<div class="trvis3-bc-sort"><button type="button" class="btn tiny ghost" data-trvis3-bc-move="'+key+'" data-delta="-1" '+(!index?'disabled':'')+' aria-label="Subir '+e(labels[key])+'">↑</button>'+
  '<button type="button" class="btn tiny ghost" data-trvis3-bc-move="'+key+'" data-delta="1" '+(index===p.order.length-1?'disabled':'')+' aria-label="Bajar '+e(labels[key])+'">↓</button></div></div>'
 ).join('')+'</div><button type="button" class="btn small" data-trvis3-bc-reset>Restaurar columnas predeterminadas</button>';
}
function renderTable(ops,plan){
 previewOps=Array.isArray(ops)?ops:[];previewPlanId=String(plan?.id||'none');
 const p=pref(previewPlanId),visible=p.order.filter(x=>!p.hidden.includes(x));
 const list=[...previewOps].sort((a,b)=>v3194CompareOps(b,a)).slice(0,60);
 const head='<tr>'+visible.map(key=>'<th draggable="true" data-trvis3-bc-th="'+key+'" title="Arrastrar para reordenar" aria-label="'+e(labels[key])+'; arrastrable">'+e(labels[key])+'</th>').join('')+'</tr>';
 const body=list.map(op=>'<tr>'+visible.map(key=>{
  const v=cell(op,key),n=key==='rNet'?Number.parseFloat(v):null,tone=Number.isFinite(n)?n>0?'positive':n<0?'negative':'':'';
  return '<td class="'+tone+'">'+e(v)+'</td>';
 }).join('')+'</tr>').join('');
 const count=visible.length+'/'+keys.length;
 return '<div class="trvis3-bc-root" data-trvis3-bc-root>'+
 '<div class="trvis3-bc-toolbar"><div><button type="button" class="btn small" data-trvis3-bc-toggle aria-expanded="'+(pickerOpen?'true':'false')+'">⚙ Columnas ('+count+')</button>'+
 '<small>Selecciona, oculta y reordena columnas; arrastra los encabezados o utiliza las flechas.</small></div>'+
 '<span>'+list.length+' de '+previewOps.length+' operaciones visibles</span></div>'+
 '<div class="trvis3-bc-picker" '+(pickerOpen?'':'hidden')+' data-trvis3-bc-panel>'+chooser(p)+'</div>'+
 (list.length?'<div class="table-wrap trvis3-bc-scroll"><table class="table trvis3-bc-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>':
 '<div class="empty">La muestra actual no contiene operaciones. Puedes configurar sus columnas antes de aplicar filtros.</div>')+
 '</div>';
}
function refresh(){
 const host=document.querySelector('#view #tp-builder-view .trvis3-bc-root');
 if(host)host.outerHTML=renderTable(previewOps,{id:previewPlanId});
}
document.addEventListener('click',event=>{
 const target=event.target?.closest?.('[data-trvis3-bc-toggle],[data-trvis3-bc-move],[data-trvis3-bc-reset]');
 if(!target||!target.closest('#view #tp-builder-view'))return;
 if(target.hasAttribute('data-trvis3-bc-toggle')){pickerOpen=!pickerOpen;refresh();return;}
 const p=pref(previewPlanId);
 if(target.hasAttribute('data-trvis3-bc-reset')){
  save({order:[...keys],hidden:keys.filter(x=>!shownByDefault.includes(x))});refresh();return;
 }
 const key=target.dataset.trvis3BcMove,from=p.order.indexOf(key),to=from+Number(target.dataset.delta);
 if(from<0||to<0||to>=p.order.length)return;
 p.order.splice(from,1);p.order.splice(to,0,key);save(p);refresh();
},true);
document.addEventListener('change',event=>{
 const target=event.target;
 if(!target?.matches?.('[data-trvis3-bc-visible]')||!target.closest('#view #tp-builder-view'))return;
 const key=target.dataset.trvis3BcVisible,p=pref(previewPlanId);
 p.hidden=p.hidden.filter(x=>x!==key);
 if(!target.checked)p.hidden.push(key);
 if(p.hidden.length===keys.length){target.checked=true;return;}
 save(p);refresh();
},true);
document.addEventListener('dragstart',event=>{
 const th=event.target?.closest?.('#view #tp-builder-view th[data-trvis3-bc-th]');
 if(!th)return;
 dragKey=th.dataset.trvis3BcTh;
 event.dataTransfer?.setData('text/plain',dragKey);
 if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
},true);
document.addEventListener('dragover',event=>{
 const th=event.target?.closest?.('#view #tp-builder-view th[data-trvis3-bc-th]');
 if(th&&dragKey)event.preventDefault();
},true);
document.addEventListener('drop',event=>{
 const th=event.target?.closest?.('#view #tp-builder-view th[data-trvis3-bc-th]');
 if(!th||!dragKey)return;
 event.preventDefault();
 const p=pref(previewPlanId),from=p.order.indexOf(dragKey),to=p.order.indexOf(th.dataset.trvis3BcTh);
 dragKey='';
 if(from===to||from<0||to<0)return;
 const moved=p.order.splice(from,1)[0];p.order.splice(to,0,moved);
 save(p);refresh();
},true);
document.addEventListener('dragend',()=>{dragKey='';},true);
globalThis.TradingResearchBuilderColumnContract=Object.freeze({
 render:renderTable,read:planId=>pref(String(planId||previewPlanId)),get count(){return keys.length;},version:'1'
});
})();