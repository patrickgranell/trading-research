/* Auditoría R3 PR2 / CP-06: columnas de Cumplimiento, sin alterar sus resultados. */
(()=>{
'use strict';
if(typeof document==='undefined'||typeof complianceOpsTable!=='function'||
 globalThis.TradingResearchAuditR3Compliance)return;
const original=complianceOpsTable,storageKey='tradingResearchComplianceColumnsR3V1';
const fixed=[['date','Fecha'],['setup','Setup'],['context','Contexto H4'],
 ['checklist','Checklist'],['strict','Obligatorias'],['metric','Resultado'],
 ['discipline','Disciplina'],['actions','Acciones']];
const extras=[['direction','Dirección'],['contract','Contrato / vencimiento'],
 ['contracts','N.º contratos'],['entryPrice','Precio entrada'],['exitDate','Fecha salida'],
 ['result','Estado'],['ticks','Ticks'],['rNet','R neta'],
 ['mfeTicks','MFE (ticks)'],['maeTicks','MAE (ticks)'],['origin','Origen']];
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentPlan=()=>globalThis.TradingResearchPlanReadContract?.current?.()||null;
const catalog=()=>{
 const plan=currentPlan(),archivedOps=globalThis.TradingResearchOperationsReadContract?.current?.()||[];
 const taxes=(plan?.taxonomyRegistry||[]).filter(t=>t.kind==='custom'&&
  (t.status!=='archived'||archivedOps.some(o=>o.taxonomyValues?.[t.id])))
  .map(t=>['tax:'+t.id,t.name+(t.status==='archived'?' (archivada)':'')]);
 return [...fixed.slice(0,-1),...extras,...taxes,fixed.at(-1)];
};
const readAll=()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{return {};}};
const context=()=>String(currentPlan()?.id||'none')+':compliance';
const pref=()=>{
 const keys=catalog().map(([id])=>id).filter(id=>id!=='actions'),
 saved=readAll()[context()]||{},prior=Array.isArray(saved.order)?saved.order.filter(x=>keys.includes(x)):[];
 const order=[...new Set([...prior,...keys])];
 const hidden=Array.isArray(saved.hidden)?saved.hidden.filter(x=>keys.includes(x)):[];
 for(const id of keys)if(!prior.includes(id)&&!fixed.some(([k])=>k===id)&&!hidden.includes(id))hidden.push(id);
 if(hidden.length>=order.length)hidden.pop();
 return {order,hidden};
};
const save=p=>{try{const all=readAll();all[context()]={order:p.order,hidden:p.hidden};localStorage.setItem(storageKey,JSON.stringify(all));}catch(err){console.warn('Cumplimiento: columnas no guardadas',err);}};
const fmt=(n,suffix='')=>n===null||n===undefined||n===''||!Number.isFinite(Number(n))?'—':(Number(n)>0?'+':'')+Number(n).toLocaleString('es-ES',{maximumFractionDigits:3})+suffix;
const value=(op,id)=>{
 if(id.startsWith('tax:')){
  const tax=(currentPlan()?.taxonomyRegistry||[]).find(t=>String(t.id)===id.slice(4));
  const item=(tax?.values||[]).find(v=>String(v.id)===String(op.taxonomyValues?.[tax.id]));
  return item?.name||item?.legacyValue||(tax?.legacyKey?String(op[tax.legacyKey]||'—'):'—');
 }
 if(id==='direction')return op.direction||'—';
 if(id==='contract')return op.contract||op.instrumentSnapshot?.symbol||'—';
 if(id==='contracts')return fmt(op.contracts);
 if(id==='entryPrice')return fmt(op.entryPrice);
 if(id==='exitDate')return op.exitDate?String(op.exitDate).replace('T',' '):'—';
 if(id==='result')return {win:'Ganadora',loss:'Perdedora',pending:'Pendiente',flat:'Neutra'}[op.result]||String(op.result||'—');
 if(id==='ticks')return op.result==='pending'?'—':fmt(op.resultTicks,' t');
 if(id==='rNet')return op.result==='pending'?'—':fmt(typeof opMetricValue==='function'?opMetricValue(op,'r','net'):op.rMultiple,' R');
 if(id==='origin')return op.raw?.source||op.origin||'Manual';
 if(id==='mfeTicks'||id==='maeTicks'){
  const status=typeof dqMetricStatus==='function'?dqMetricStatus(op,id==='mfeTicks'?'mfe':'mae'):op[id]===null||op[id]===undefined?'missing':'measured';
  return status==='na'?'N/A':status==='measured'?fmt(op[id],' t'):'—';
 }
 return '—';
};
const orderedOps=ops=>{
 let out=ops.filter(o=>o?.compliance?.evaluated);
 const ruleId=typeof complianceViewState!=='undefined'?complianceViewState.ruleId:'';
 if(ruleId){const id=decodeURIComponent(ruleId);out=out.filter(o=>(o.compliance.responses||[]).some(r=>String(r.id||r.name)===String(id)&&!r.checked));}
 return out.slice().sort((a,b)=>v3194CompareOps(b,a));
};
const group=id=>id.startsWith('tax:')?'Taxonomías personalizadas':
 ['date','exitDate','direction','contract','contracts'].includes(id)?'Identificación':
 ['setup','context'].includes(id)?'Clasificación':
 ['checklist','strict','discipline'].includes(id)?'Evaluación':
 ['metric','result','ticks','rNet','mfeTicks','maeTicks'].includes(id)?'Resultado y excursiones':'Entrada y procedencia';
let open=false,drag='';
const chooser=p=>{
 const labels=Object.fromEntries(catalog());
 return '<div class="tr-r3-compliance-choices">'+p.order.map((id,i)=>{
  const title=escape(labels[id]||id),family=group(id);
  return (i===0||family!==group(p.order[i-1])?'<div class="tr-r3-compliance-family"><span>'+escape(family)+'</span>'+
  '<button type="button" class="btn tiny ghost" data-r3c-family="'+escape(family)+'">Grupo ±</button></div>':'')+
  '<div class="tr-r3-compliance-choice"><label><input data-r3c-visible="'+escape(id)+'" type="checkbox" '+(p.hidden.includes(id)?'':'checked')+'><span>'+title+'</span></label>'+
  '<div><button class="btn tiny ghost" type="button" data-r3c-move="'+escape(id)+'" data-shift="-1" '+(i===0?'disabled':'')+' aria-label="Subir '+title+'">↑</button>'+
  '<button class="btn tiny ghost" type="button" data-r3c-move="'+escape(id)+'" data-shift="1" '+(i===p.order.length-1?'disabled':'')+' aria-label="Bajar '+title+'">↓</button></div></div>';
 }).join('')+'</div><button class="btn small" type="button" data-r3c-reset>Restaurar columnas</button>';
};
complianceOpsTable=function(ops,ruleRows){
 const html=original(ops,ruleRows),fragment=document.createElement('template');fragment.innerHTML=html;
 const panel=fragment.content.querySelector('.compliance-ops-panel'),table=panel?.querySelector('table'),head=table?.tHead?.rows?.[0];
 if(!panel||!head||head.cells.length!==fixed.length)return html;
 const rows=orderedOps(ops),body=[...table.tBodies[0].rows];
 if(rows.length&&body.length!==rows.length)return html;
 const extraFields=catalog().filter(([id])=>!fixed.some(([fixedId])=>fixedId===id));
 const ids=fixed.map(([id])=>id);
 const actionHead=head.cells[fixed.length-1];
 for(const [id,name] of extraFields){
  const th=document.createElement('th');th.textContent=name;th.dataset.r3cCol=id;actionHead.before(th);
 }
 for(const [i,c] of [...head.cells].entries())if(!c.dataset.r3cCol)c.dataset.r3cCol=ids[i===head.cells.length-1?ids.length-1:i]||'actions';
 if(rows.length){
  body.forEach((tr,i)=>{
   const cells=[...tr.cells];cells.forEach((td,j)=>td.dataset.r3cCol=ids[j]);
   const action=cells.at(-1);
   for(const [id] of extraFields){
    const td=document.createElement('td');td.dataset.r3cCol=id;td.textContent=value(rows[i],id);action.before(td);
   }
  });
 }else body[0]?.cells?.[0]?.setAttribute('colspan',String(catalog().length));
 const prefs=pref(),ordering=[...prefs.order,'actions'];
 for(const tr of [head,...(rows.length?body:[])]){
  const cells=new Map([...tr.cells].map(cell=>[cell.dataset.r3cCol,cell]));
  for(const id of ordering){
   const cell=cells.get(id);if(!cell)continue;
   cell.hidden=prefs.hidden.includes(id);
   if(cell.tagName==='TH'&&id!=='actions'){cell.draggable=true;cell.setAttribute('aria-label',String(Object.fromEntries(catalog())[id])+' · arrastrable');}
   tr.append(cell);
  }
 }
 const bar=document.createElement('div');bar.className='tr-r3-compliance-tools';
 bar.innerHTML='<button class="btn small" type="button" data-r3c-toggle aria-expanded="'+open+'">⚙ Columnas ('+(prefs.order.length-prefs.hidden.length)+'/'+prefs.order.length+')</button>'+
 '<small>Elige columnas, arrastra cabeceras o usa las flechas. Acciones queda fija.</small>'+
 '<div class="tr-r3-compliance-panel" '+(open?'':'hidden')+'>'+chooser(prefs)+'</div>';
 panel.querySelector('.table-wrap')?.before(bar);
 return fragment.innerHTML;
};
document.addEventListener('click',e=>{
 const control=e.target?.closest?.('[data-r3c-toggle],[data-r3c-move],[data-r3c-reset],[data-r3c-family]');
 if(!control||!control.closest('#view .compliance-ops-panel'))return;
 if(control.matches('[data-r3c-toggle]')){
  const p=control.closest('.tr-r3-compliance-tools')?.querySelector('.tr-r3-compliance-panel');
  if(p){open=p.hidden;p.hidden=!open;control.setAttribute('aria-expanded',String(open));}
  return;
 }
 const p=pref();
 if(control.matches('[data-r3c-family]')){
  const groupName=control.dataset.r3cFamily,groupKeys=p.order.filter(id=>group(id)===groupName);
  const alreadyAll=groupKeys.every(id=>!p.hidden.includes(id));
  const hidden=new Set(p.hidden);
  groupKeys.forEach(id=>alreadyAll?hidden.add(id):hidden.delete(id));
  if(hidden.size===p.order.length)return;
  p.hidden=[...hidden];save(p);render();return;
 }
 if(control.matches('[data-r3c-reset]')){
  const keys=catalog().map(([id])=>id).filter(id=>id!=='actions');
  p.order=keys;p.hidden=keys.filter(id=>!fixed.some(([k])=>k===id));
 }else{
  const id=control.dataset.r3cMove,from=p.order.indexOf(id),to=from+Number(control.dataset.shift);
  if(from<0||to<0||to>=p.order.length)return;
  p.order.splice(from,1);p.order.splice(to,0,id);
 }
 save(p);render();
});
document.addEventListener('change',e=>{
 const el=e.target;if(!el?.matches?.('[data-r3c-visible]')||!el.closest('#view .compliance-ops-panel'))return;
 const p=pref(),id=el.dataset.r3cVisible;p.hidden=p.hidden.filter(x=>x!==id);
 if(!el.checked)p.hidden.push(id);
 if(p.hidden.length===p.order.length){el.checked=true;return;}
 save(p);render();
});
document.addEventListener('dragstart',e=>{
 const th=e.target?.closest?.('#view .compliance-ops-panel th[data-r3c-col]');
 if(!th||th.dataset.r3cCol==='actions')return;
 drag=th.dataset.r3cCol;e.dataTransfer?.setData('text/plain',drag);
});
document.addEventListener('dragover',e=>{
 const th=e.target?.closest?.('#view .compliance-ops-panel th[data-r3c-col]');
 if(th&&drag&&th.dataset.r3cCol!=='actions')e.preventDefault();
});
document.addEventListener('drop',e=>{
 const th=e.target?.closest?.('#view .compliance-ops-panel th[data-r3c-col]');
 const from=drag,to=th?.dataset.r3cCol;drag='';
 if(!from||!to||to==='actions'||from===to)return;
 e.preventDefault();const p=pref(),at=p.order.indexOf(from),next=p.order.indexOf(to);
 if(at<0||next<0)return;
 p.order.splice(at,1);p.order.splice(next,0,from);save(p);render();
});
document.addEventListener('dragend',()=>{drag='';});
globalThis.TradingResearchAuditR3Compliance=Object.freeze({catalog,prefs:pref,version:'1'});
})();