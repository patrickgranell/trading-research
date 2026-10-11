/* LOTE 6 — Research UX presentation. Non-mutating adapters; no analytics or source changes. */
(()=>{
'use strict';
const registry=window.TradingResearchActions;
if(!registry)return;
const groups=[
 ['summary','Resumen','Estudios y muestra'],
 ['segmentation','Segmentación','Grid, Edge y categorías'],
 ['exits','Salidas','Excursiones y escenarios'],
 ['validation','Validación','OOS, confianza y robustez'],
 ['risk','Riesgo','Límites y sensibilidad']
];
let labGroup='summary';
const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const args=v=>encodeURIComponent(JSON.stringify(v));
const action=(name,values)=>`data-tr-action-click="${name}" data-tr-args-click="${args(values)}"`;
const fragment=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};
function environment(p){
 const e=globalThis.TradingResearchOperationSemanticsContract?.planEnvironment?.(p)||p?.environment||p?.executionEnvironment||'unclassified';
 return ({backtest:'Backtesting',replay:'Market Replay',sim:'SIM',live:'Live',unclassified:'Sin clasificar'})[e]||String(e);
}
function announce(message){
 let live=document.getElementById('tr6-live-status');
 if(!live){live=document.createElement('div');live.id='tr6-live-status';live.className='tr6-sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');document.body.append(live);}
 live.textContent=message;
}
function groupFor(node){
 const title=(node.querySelector('h3,h4')?.textContent||'').toLowerCase();
 const cls=node.className||'';
 if(/research.grid|matriz de edge|foco.*estrés|comportamientos|trades del estudio/i.test(title)||String(cls).includes('research-grid-module'))return 'segmentation';
 if(/exit lab|salidas|mfe.*mae|mae.*mfe|scatter/i.test(title))return 'exits';
 if(/forward|oos|walk.forward|monte carlo|robustez|confianza|estabilidad/i.test(title))return 'validation';
 if(/riesgo|risk.*stress|simulador.*reglas/i.test(title))return 'risk';
 return 'summary';
}
const originalGrid=researchGridModule;
researchGridModule=function(ops){
 const tpl=fragment(originalGrid(ops));
 const cells=[...tpl.content.querySelectorAll('.research-grid-table tbody tr')];
 const rowDim=researchGridState.rowDim,colDim=researchGridState.colDim;
 const rows=researchCategoryCounts(ops,rowDim),cols=researchCategoryCounts(ops,colDim);
 for(let i=0;i<rows.length;i++){
  for(let j=0;j<cols.length;j++){
   const td=cells[i]?.querySelectorAll('td.research-cell')?.[j];
   if(!td)continue;
   const nText=td.querySelector('small')?.textContent||'n=0',metric=td.querySelector('strong')?.textContent||'—';
   if(!td.classList.contains('empty-cell')){
    const button=document.createElement('button');button.type='button';button.className='tr6-grid-button';
    button.setAttribute('aria-label',`${researchDimLabel(rowDim)}: ${researchDisplayValue(rowDim,rows[i])}; ${researchDimLabel(colDim)}: ${researchDisplayValue(colDim,cols[j])}; ${metric}; ${nText}`);
    button.setAttribute('title',td.getAttribute('title')||'Filtrar combinación');
    button.setAttribute('data-tr-action-click','tr6SelectResearchCell');
    button.setAttribute('data-tr-args-click',args([rowDim,rows[i],colDim,cols[j]]));
    const selected=td.classList.contains('lab-selected-cell');button.setAttribute('aria-pressed',selected?'true':'false');
    button.innerHTML=td.innerHTML;td.replaceChildren(button);
   }
   for(const name of ['data-tr-action-click','data-tr-onclick','data-tr-args-click'])td.removeAttribute(name);
  }
 }
 const control=tpl.content.querySelector('.research-grid-controls');
 if(control){
  const preset=document.createElement('button');preset.type='button';preset.className='btn small ghost tr6-grid-preset';preset.textContent='Vista compacta · Setup × Contexto';
  preset.setAttribute('data-tr-action-click','tr6EdgePreset');
  preset.setAttribute('title','Preset de Research Grid; la Matriz de Edge original se mantiene');
  control.append(preset);
 }
 const table=tpl.content.querySelector('.research-grid-table');
 if(table){
  table.setAttribute('aria-label','Research Grid: combinación de categorías y muestra');
  const wrap=table.closest('.research-grid-wrap');
  if(wrap){const status=document.createElement('p');status.className='tr6-grid-access-note';status.textContent='Tab: recorrer combinaciones. Enter o Espacio: filtrar. Restablecer selección: recuperar el universo anterior.';wrap.after(status);}
 }
 return tpl.innerHTML;
};
registry.tr6SelectResearchCell=function(rowDim,rowVal,colDim,colVal){
 const count=labFilteredOps().length;
 researchApplyCell(rowDim,rowVal,colDim,colVal);
 announce(`Filtro aplicado: ${researchDimLabel(rowDim)} ${researchDisplayValue(rowDim,rowVal)} y ${researchDimLabel(colDim)} ${researchDisplayValue(colDim,colVal)}. ${labFilteredOps().length} operaciones, antes ${count}.`);
};
const originalClear=registry.researchClearSelection;
if(typeof originalClear==='function')registry.researchClearSelection=function(...v){const out=originalClear(...v);announce(`Selección retirada. ${labFilteredOps().length} operaciones en el estudio.`);return out;};
registry.tr6EdgePreset=function(){Object.assign(researchGridState,{rowDim:'setup',colDim:'context',metric:'expectancy',minN:1,maxCats:8});render();announce('Research Grid: vista compacta Setup por Contexto. La Matriz de Edge sigue disponible.');};
registry.tr6LabGroup=function(value){if(!groups.some(x=>x[0]===value))return;labGroup=value;render();};
const originalLab=analyticsLab;
analyticsLab=function(){
 const tpl=fragment(originalLab()),root=tpl.content,grid=root.querySelector('.lab-grid'),p=getCurrentPlan();
 if(!grid)return tpl.innerHTML;
 const ops=labFilteredOps();
 const sections=new Map(groups.map(([id])=>[id,document.createElement('div')]));
 for(const [id,el] of sections){el.className='lab-grid tr6-lab-panels';el.dataset.tr6Group=id;el.setAttribute('role','tabpanel');el.id='tr6-lab-'+id;el.hidden=id!==labGroup;}
 for(const item of [...grid.children])sections.get(groupFor(item)).append(item);
 const studies=root.querySelector('.saved-studies-panel'),oos=root.querySelector('.forward-panel, .forward-validation-panel, .forward-oos-panel');
 if(studies)sections.get('summary').prepend(studies);
 if(oos)sections.get('validation').prepend(oos);
 grid.className='tr6-lab-group-container';
 for(const section of sections.values())grid.append(section);
 const toolbar=document.createElement('div');toolbar.className='tr6-lab-navigation';
 const studyLabel=labStudiesUi?.activeId?' · Estudio cargado':' · Investigación retrospectiva';
 const filterCount=Object.entries(labState).filter(([k,v])=>['q','dateFrom','dateTo','setup','vd','nr','hypothesis','context','direction','risk','source','result','contract','block','focus','stress','behavior','emotion','rMin','rMax'].includes(k)&&v!==''&&v!=null).length;
 toolbar.innerHTML=`<div class="tr6-context-line"><strong>${safe(planLabel(p))}</strong><span>${safe(environment(p))}</span><span>${ops.length} operaciones de ${currentOps().length}</span><span>${filterCount} filtros</span><span>${safe(metricUnitLabel(labState.unit))} · ${labState.basis==='net'?'Neto':'Bruto'}</span><span>${studyLabel}</span></div><div role="tablist" aria-label="Herramientas del Laboratorio" class="tr6-task-tabs">${groups.map(([id,label,desc])=>`<button type="button" role="tab" class="${labGroup===id?'active':''}" aria-selected="${labGroup===id}" aria-controls="tr6-lab-${id}" ${action('tr6LabGroup',[id])}><strong>${label}</strong><small>${desc}</small></button>`).join('')}</div>`;
 grid.before(toolbar);
 return tpl.innerHTML;
};
function ownHistory(id){const p=getPlan(id),ops=v313PlanOps(id);return `<div class="tr6-history"><strong>${safe(planLabel(p))}</strong><span>${safe(environment(p))} · ${ops.length} operaciones · ${safe(v313DateRangeText(ops))}</span><button class="btn small" ${action('tr6OpenHistory',[id])}>Abrir registro propio</button></div>`;}
registry.tr6OpenHistory=function(id){if(!getPlan(id))return;state.currentPlanId=id;if(typeof persist==='function')persist();navigate('operations');};
const originalCompare=v313CompareView;
v313CompareView=function(){
 const pa=getPlan(reportsViewState.compareA),pb=getPlan(reportsViewState.compareB);
 const a=v313PlanOps(pa?.id),b=v313PlanOps(pb?.id);
 const same=!!pa&&!!pb&&pa.id===pb.id;
 const win=!same?v313OverlapWindow(a,b):null;
 const noCommon=!same&&!win;
 const periodUnavailable=reportsViewState.compareWindow==='overlap'&&noCommon;
 const empty=!a.length||!b.length;
 const tpl=fragment(originalCompare());
 const panel=tpl.content.querySelector('.compare-main'),detail=tpl.content.querySelector('.compare-grid'),hero=tpl.content.querySelector('.compare-hero'),controls=tpl.content.querySelector('.compare-controls');
 if(!controls)return tpl.innerHTML;
 const mode=reportsViewState.compareWindow==='overlap'?'Periodo calendario común':'Histórico completo independiente';
 const context=document.createElement('section');context.className='card panel tr6-compare-context';
 context.innerHTML=`<h3>Universos A y B</h3><div class="tr6-compare-universes">${[pa,pb].map((p,i)=>{const ops=i?b:a;return `<div><strong>${i?'B':'A'} · ${safe(planLabel(p))}</strong><small>${safe(environment(p))} · ${safe(mode)} · ${safe(v313DateRangeText(ops))}</small><span>n=${ops.length} · ${safe(metricUnitLabel(reportsViewState.unit))} · ${reportsViewState.basis==='net'?'Neto':'Bruto'}</span></div>`;}).join('')}</div><p>Δ = B − A. Cada lado utiliza el mismo criterio de ventana y unidad/base. No hay filtros independientes por lado en este comparador.</p>`;
 controls.after(context);
 if(same||periodUnavailable||empty){
  const message=same?'Comparación idéntica: se ha elegido exactamente el mismo Trading Plan y versión con las mismas condiciones. No constituye un hallazgo.':empty?'Comparación no disponible: al menos un plan carece de operaciones en el universo elegido.':'Sin periodo calendario común: no existe una comparación temporal disponible. Los ceros no representan equivalencia estadística.';
  const note=document.createElement('section');note.className='card panel tr6-compare-unavailable';note.setAttribute('role','status');
  note.innerHTML=`<h3>${safe(message)}</h3><p>Selecciona otro plan o consulta el histórico individual. No se presentan métricas comparativas para muestras no comparables.</p><div class="tr6-histories">${[...new Set([pa?.id,pb?.id].filter(Boolean))].map(ownHistory).join('')}</div>`;
  (detail||panel||hero||context).after(note);
  panel?.remove();detail?.remove();hero?.remove();
 }else if(noCommon){
  const notice=document.createElement('div');notice.className='notice warn-notice tr6-compare-warning';
  notice.textContent='Sin periodo calendario común. Esta vista compara descriptivamente los históricos propios de cada plan; no permite inferir diferencias contemporáneas.';
  context.after(notice);
 }
 return tpl.innerHTML;
};
const originalMarketTabs=v316MarketTabs;
v316MarketTabs=function(){
 const defs=[['calibration','Calibración','Fuentes y calidad'],['running','Recorrido','Last y fills'],['reconcile','Vinculación','Journal y ejecución'],['bestexit','Best Exit','Bid/Ask y escenarios']];
 return `<div class="md-phase-tabs tr6-market-tabs" role="tablist" aria-label="Herramientas Market Data">${defs.map(([id,title,desc])=>`<button type="button" role="tab" aria-selected="${v316Ui.tab===id}" class="${v316Ui.tab===id?'active':''}" ${action('tr6MarketTab',[id])}><strong>${title}</strong><span>${desc}</span></button>`).join('')}</div>`;
};
registry.tr6MarketTab=function(tab){v316SetTab(tab);};
registry.tr6ImportTicks=function(){document.getElementById('v314-market-file')?.click();};
registry.tr6ImportGrid=function(){document.getElementById('v314-exec-file')?.click();};
registry.tr6OpenLinked=function(id){if(state.operations.some(o=>o.id===id))viewOperation(id);};
const originalMarketCard=v314MarketMetaCard,originalExecCard=v314ExecSetCard;
const stamp=x=>x?new Date(x).toLocaleDateString('es-ES'):'Fecha desconocida';
v314MarketMetaCard=function(m){
 const tpl=fragment(originalMarketCard(m));const target=tpl.content.querySelector('.md-dataset-main');
 if(target){const info=document.createElement('small');info.className='tr6-source-detail';info.textContent=`ID ${String(m.id).slice(-8)} · ${m.sourceFile||'Origen no informado'} · Importado ${stamp(m.createdAt||m.importedAt)} · ${m.id===v314MarketUi.activeMarketId?'Seleccionado':'Disponible'}`;target.append(info);}
 return tpl.innerHTML;
};
v314ExecSetCard=function(s){
 const tpl=fragment(originalExecCard(s));const target=tpl.content.querySelector('.md-dataset-main');
 if(target){const info=document.createElement('small');info.className='tr6-source-detail';info.textContent=`ID ${String(s.id).slice(-8)} · ${s.sourceFile||'Origen no informado'} · Importado ${stamp(s.createdAt||s.importedAt)} · ${s.id===v314MarketUi.activeExecId?'Seleccionado':'Disponible'}`;target.append(info);}
 return tpl.innerHTML;
};
const originalMarket=v316MarketDataView;
v316MarketDataView=function(){
 const tpl=fragment(originalMarket()),tabs=tpl.content.querySelector('.md-phase-tabs');if(!tabs)return tpl.innerHTML;
 const meta=v314MarketUi.metas.find(m=>m.id===v314MarketUi.activeMarketId)||null;
 const set=v314MarketUi.execSets.find(s=>s.id===v314MarketUi.activeExecId)||null;
 const linked=meta&&set?.marketDatasetId?String(set.marketDatasetId)===String(meta.id):false;
 const hasMarket=!!meta,hasGrid=!!set,calibrated=!!set?.results?.length;
 const current=v316Ui.tab;
 const info=document.createElement('section');info.className='card panel tr6-market-context';
 info.innerHTML=`<h3>Fuente y requisitos · ${safe(({calibration:'Calibración',running:'Recorrido',reconcile:'Vinculación',bestexit:'Best Exit'})[current]||current)}</h3>
 <p>Calibración y Vinculación son herramientas distintas. Recorrido y Best Exit necesitan un Grid con ejecuciones calibradas y su histórico Tick; Best Exit requiere además Bid/Ask utilizable para cierres marketables.</p>
 <div class="tr6-source-status"><div><strong>Histórico seleccionado</strong><span>${meta?safe(meta.sourceFile||meta.instrument||meta.id):'Ninguno'}</span><small>${meta?`ID ${safe(String(meta.id).slice(-8))} · ${safe(stamp(meta.createdAt||meta.importedAt))}`:'Importa o selecciona un histórico'}</small></div>
 <div><strong>Grid seleccionado</strong><span>${set?safe(set.sourceFile||set.id):'Ninguno'}</span><small>${set?`ID ${safe(String(set.id).slice(-8))} · ${safe(stamp(set.createdAt||set.importedAt))} · ${safe(V316_ENV_LABELS[v316EnvForSet(set)]||v316EnvForSet(set))}`:'Importa o selecciona ejecuciones'}</small></div>
 <div><strong>Histórico activo del Grid</strong><span>${set?.marketDatasetId?safe(v314MarketUi.metas.find(m=>m.id===set.marketDatasetId)?.sourceFile||String(set.marketDatasetId).slice(-8)):'Sin asociar'}</span><small>${hasMarket&&hasGrid?(linked?'Coincide con el seleccionado':'Revisa la fuente del Grid antes de interpretar el recorrido'):'No disponible'}</small></div></div>`;
 if((current==='running'||current==='bestexit')&&(!hasMarket||!hasGrid||!calibrated||!linked)){
  const req=document.createElement('div');req.className='notice tr6-prerequisites';req.setAttribute('role','status');
  req.innerHTML=`<strong>Requisitos pendientes:</strong> ${[!hasMarket?'histórico Tick':null,!hasGrid?'Grid de ejecuciones':null,hasGrid&&!calibrated?'calibración con resultados':null,hasGrid&&hasMarket&&!linked?'seleccionar el histórico asociado al Grid':null].filter(Boolean).join(', ')||'Revisa la calidad de la fuente'}.
  <div class="actions"><button class="btn small" ${action('tr6MarketTab',['calibration'])}>Abrir Calibración</button><button class="btn small" ${action('tr6ImportTicks',[])}>Importar histórico</button><button class="btn small" ${action('tr6ImportGrid',[])}>Importar Grid</button></div>`;
  info.append(req);
 }
 tabs.after(info);
 const reconciliation=tpl.content.querySelector('.reconcile-table tbody');
 if(reconciliation&&set){
  const rows=set.results?.length?set.results:set.trades||[];
  for(let i=0;i<rows.length;i++){
   const tr=reconciliation.rows[i],op=v316LinkedOpFor(set,rows[i]);if(!tr||!op)continue;
   const cell=tr.cells[tr.cells.length-1];if(!cell)continue;
   const btn=document.createElement('button');btn.type='button';btn.className='btn tiny tr6-linked-op';btn.textContent='Ver operación';btn.setAttribute('data-tr-action-click','tr6OpenLinked');btn.setAttribute('data-tr-args-click',args([op.id]));cell.append(btn);
   const note=document.createElement('small');const snapshot=op.executionEvidence?.contextSnapshot?.h4Context;
   note.textContent=snapshot&&snapshot!==op.h4Context?`Contexto actual: ${op.h4Context||'Sin clasificar'} · Instantánea del vínculo: ${snapshot}`:`Contexto actual: ${op.h4Context||'Sin clasificar'} · Instantánea: ${snapshot||'No disponible'}`;
   cell.append(note);
  }
 }
 return tpl.innerHTML;
};
Object.assign(registry,{tr6LabGroup:registry.tr6LabGroup,tr6MarketTab:registry.tr6MarketTab});
globalThis.TradingResearchAstraLote6=Object.freeze({version:'1.0',groups:groups.map(g=>g[0]),diagnostics:()=>({labGroup,comparisonsGuarded:true,marketSourcesOnly:true,gridKeyboard:true})});
})();