/* TR-VIS PR4 — composition only. Original nodes and actions are moved, not copied.
 * No canonical calculations, data, persistence or environment permissions change. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchVisualPR4)return;
const stateOf={};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const viewIds=['plans','review','journal','journalops','journaldashboard','journalreflections','journalstatements','quality','decision','goals','compliance','mistakes','changes','reports'];
function details(documentRoot,name,label,content,initiallyOpen=false){
 const el=document.createElement('details');
 el.className='trvis4-details trvis4-'+name;
 el.dataset.trvis4Disclosure=name;
 el.open=Object.hasOwn(stateOf,name)?stateOf[name]:initiallyOpen;
 const summary=document.createElement('summary');
 summary.textContent=label;
 const holder=document.createElement('div');holder.className='trvis4-details-content';
 el.append(summary,holder);
 for(const node of content){if(node)holder.append(node);}
 return el;
}
function foldOriginal(node,root,name,label,initiallyOpen=false){
 const placeholder=document.createComment('trvis4-fold');
 node.before(placeholder);
 const panel=details(root,name,label,[node],initiallyOpen);
 placeholder.replaceWith(panel);
 return panel;
}
function moveBefore(target,node){if(target&&node&&target!==node)target.before(node);}
function moveAfter(target,node){if(target&&node&&target!==node)target.after(node);}
function plans(root){
 const cards=root.querySelectorAll('.plan-card');
 for(const card of cards){
  const head=card.querySelector('.plan-card-head'),title=head?.querySelector('.plan-title'),
   actions=card.querySelector('.plan-actions'),metrics=card.querySelector('.plan-metrics');
  if(!head||!title||!actions||!metrics)continue;
  card.classList.add('trvis4-plan-card');
  head.querySelector('.config-meta')?.classList.add('trvis4-plan-context');
  title.classList.add('trvis4-plan-title');
  card.querySelector(':scope > p')?.classList.add('trvis4-plan-description');
  const extras=[...metrics.children].slice(2);
  const count=typeof state!=='undefined'&&Array.isArray(state.operations)?
   state.operations.filter(x=>x.tradingPlanId===card.dataset.trPlanCardId).length:null;
  const base=Number(metrics.children[0]?.querySelector('strong')?.textContent||0);
  const context=document.createElement('small');context.className='trvis4-plan-sample';
  context.textContent=count===null?'Muestra del plan: '+base:
   count+' registros · '+base+' operaciones en estadísticas';
  metrics.before(context);
  if(extras.length){
   const more=details(root,'plan-metrics-'+String(card.dataset.trPlanCardId||''),'Más métricas del plan',extras,false);
   metrics.after(more);
  }
  const buttons=[...actions.querySelectorAll(':scope > button')];
  if(buttons.length>2){
   const more=details(root,'plan-actions-'+String(card.dataset.trPlanCardId||''),'Administrar plan',buttons.slice(2),false);
   actions.append(more);
  }
  actions.classList.add('trvis4-plan-primary-actions');
 }
 const comparison=root.querySelector('.plan-validation-group');
 if(comparison)comparison.classList.add('trvis4-plan-groups');
}
function review(root){
 for(const card of root.querySelectorAll('.review-card')){
  const body=card.querySelector('.review-body'),metrics=card.querySelector('.review-metrics');
  if(body&&metrics)moveBefore(metrics,body);
  const actions=card.querySelector('.review-actions');
  const maintenance=[...actions?.querySelectorAll('button')||[]].filter(b=>/Duplicar|Eliminar/.test(b.textContent||''));
  if(actions&&maintenance.length)actions.append(details(root,'review-actions-'+String(card.querySelector('h3')?.textContent||''),'Más acciones',maintenance));
  card.classList.add('trvis4-writing-card');
  card.querySelector('.review-card-foot')?.classList.add('trvis4-followup');
 }
 const filter=root.querySelector('.review-filter'),list=root.querySelector('.review-list'),
  kpis=root.querySelector('.review-kpis');
 if(filter)foldOriginal(filter,root,'review-filter','Buscar y filtrar hallazgos');
 if(list&&kpis)moveAfter(list,kpis);
}
function journal(root){
 const filter=root.querySelector('.filter-hub'),list=root.querySelector('.journal-kpis'),
  operations=root.querySelector('.journal-charts'),table=root.querySelector('.card.panel:has(.journal-table),.card.panel:has(table)');
 if(filter)foldOriginal(filter,root,'journal-filter','Filtrar diario emocional');
 if(table&&operations)moveAfter(table,operations);
 if(operations&&list)moveAfter(operations,list);
 else if(table&&list)moveAfter(table,list);
 root.querySelector('.journal-kpis')?.classList.add('trvis4-secondary-metrics');
}

function journalSessions(root){
 const cards=root.querySelector('.journal-kpis'),panel=root.querySelector('.journal-sessions-panel,.emotional-sessions-panel,.session-list,.journal-session-grid');
 if(panel&&cards)moveAfter(panel,cards);
 cards?.classList.add('trvis4-secondary-metrics');
}
function journalReflections(root){
 const history=root.querySelector('.reflection-history');
 const kpis=root.querySelector('.reflection-kpis');
 if(history&&kpis)moveAfter(history,kpis);
 const text=root.querySelector('.perspective-focus-card blockquote');
 if(text)text.classList.add('trvis4-perspective-text');
 for(const card of root.querySelectorAll('.reflection-card')){
  card.classList.add('trvis4-writing-card');
  card.querySelector('.reflection-body')?.classList.add('trvis4-reflection-body');
 }
 const author=root.querySelector('.perspective-focus-author'),source=root.querySelector('.perspective-focus-source');
 author?.classList.add('trvis4-source-author');
 source?.classList.add('trvis4-source-citation');
}
function journalDashboard(root){
 const activity=root.querySelector('.emotional-dashboard-activity,.emotional-dashboard-activity-list,.emotional-dashboard-events,.emotional-dashboard-activity-panel');
 activity?.classList.add('trvis4-writing-priority');
}
function quality(root){
 const hero=root.querySelector('.dq-hero'),issues=root.querySelector('.dq-anomalies'),
  repair=root.querySelector('.dq-repair'),coverage=root.querySelector('.dq-coverage');
 hero?.classList.add('trvis4-compact-status');
 issues?.classList.add('trvis4-quality-priorities');
 if(issues&&hero)moveAfter(hero,issues);
 if(issues&&repair)moveAfter(issues,repair);
 if(repair&&coverage)moveAfter(repair,coverage);
 if(issues){
  const list=issues.querySelector('.dq-issue-grid');
  if(list){
   const priority=node=>node.classList.contains('error')?0:node.classList.contains('warning')?1:2;
   const items=[...list.children].sort((a,b)=>priority(a)-priority(b));
   list.append(...items);
  }
 }
 const score=hero?.querySelector('.dq-score');
 if(score)score.title='Indicador de preparación técnica; no mide el edge ni sustituye la revisión de incidencias.';
}
function decision(root){
 const hero=root.querySelector('.decision-hero'),priorities=root.querySelector('.decision-section');
 hero?.classList.add('trvis4-compact-status');
 priorities?.classList.add('trvis4-decision-priorities');
 if(hero&&priorities)moveAfter(hero,priorities);
 if(priorities&&!priorities.querySelector('.decision-priority-grid')?.children.length){
  const neutral=document.createElement('div');neutral.className='empty trvis4-neutral-empty';
  neutral.textContent='No hay prioridades evaluables con la muestra disponible.';
  priorities.append(neutral);
 }
 const ops=typeof currentOps==='function'?currentOps():[];
 if(hero&&ops.length===0){
  hero.classList.remove('high','medium','good');
  hero.classList.add('trvis4-no-sample');
  const h=hero.querySelector('h2');
  if(h)h.textContent='Sin muestra que evaluar';
  const desc=hero.querySelector('p');
  if(desc)desc.textContent='Añade o selecciona operaciones antes de interpretar prioridades, calidad o estabilidad del plan.';
 }
 const access=root.querySelector('.decision-two-col');
 access?.classList.add('trvis4-direct-access');
}
function goals(root){
 const list=root.querySelector('.goal-grid'),filter=root.querySelector('.filter-hub'),kpis=root.querySelector('.review-kpis');
 if(filter)foldOriginal(filter,root,'goal-filter','Filtros de objetivos');
 if(list&&kpis)moveAfter(list,kpis);
 for(const card of root.querySelectorAll('.goal-card')){
  card.classList.add('trvis4-goal-card');
  card.querySelector('.goal-progress')?.setAttribute('aria-label','Progreso hacia el objetivo');
 }
}
function compliance(root){
 const filters=root.querySelector('.compliance-filter'),kpis=root.querySelector('.compliance-kpis'),
 impact=root.querySelector('.compliance-impact');
 if(kpis)kpis.classList.add('trvis4-compliance-kpis');
 if(filters)foldOriginal(filters,root,'compliance-filter','Filtros de cumplimiento');
 if(impact&&kpis)moveAfter(kpis,impact);
 const coverage=kpis?.querySelector(':scope > :first-child');
 if(coverage)coverage.classList.add('trvis4-coverage-primary');
}
function mistakes(root){
 const kpis=root.querySelector('.mistakes-kpis'),panels=root.querySelector('.mistakes-grid');
 if(panels&&kpis)moveAfter(panels,kpis);
 kpis?.classList.add('trvis4-secondary-metrics');
 root.querySelector('.mistakes-grid')?.classList.add('trvis4-errors-main');
}
function changes(root){
 const timeline=root.querySelector('.research-timeline'),kpis=root.querySelector('.review-kpis'),
  filter=root.querySelector('.research-change-filters');
 if(filter)foldOriginal(filter,root,'changes-filter','Filtrar cambios y alertas');
 if(timeline&&kpis)moveAfter(timeline,kpis);
 timeline?.classList.add('trvis4-change-history');
 const buttons=[...root.querySelectorAll('.topbar .actions button,.page-head button,.page-header button')];
 const maintenance=buttons.filter(b=>/Actualizar referencia|Limpiar historial/.test(b.textContent||''));
 if(maintenance.length){
  const container=maintenance[0].parentElement;
  container?.append(details(root,'changes-maintenance','Mantenimiento del historial',maintenance));
 }
}
function reports(root){
 if(root.querySelector('.reports-tabs .active')?.textContent?.includes('Comparar'))return;
 const document=root.querySelector('.report-document');
 const config=root.querySelector('.report-builder-toolbar'),presets=root.querySelector('.report-presets');
 if(!document||!config)return;
 const print=config.querySelector('.report-actions button[data-tr-onclick*="v313PrintReport"]');
 const introduction=document.createElement('div');introduction.className='trvis4-report-reader-title';
 introduction.innerHTML='<div><h3>Vista previa del informe</h3><small>Lectura editorial con las secciones y métricas actuales de este Trading Plan.</small></div>';
 if(print){print.classList.add('trvis4-print-action');introduction.append(print);}
 document.before(introduction);
 const configDetails=details(root,'reports-config','Configurar contenido, alcance y plantilla',[config],false);
 document.before(configDetails);
 if(presets)foldOriginal(presets,root,'reports-presets','Plantillas guardadas');
 document.classList.add('trvis4-report-document');
}
function decorate(view,html){
 if(!viewIds.includes(view)||typeof html!=='string')return html;
 const template=document.createElement('template');template.innerHTML=html;
 const root=template.content;
 const inputs=[...root.querySelectorAll('input,select,textarea')].map(x=>x.id||x.name||x.getAttribute('data-tr-onchange')||'');
 const actions=[...root.querySelectorAll('button,[data-tr-action-click]')];
 switch(view){
  case 'plans':plans(root);break;
  case 'review':review(root);break;
  case 'journal':journalSessions(root);break;
  case 'journalops':journal(root);break;
  case 'journaldashboard':journalDashboard(root);break;
  case 'journalreflections':journalReflections(root);break;
  case 'journalstatements':journalReflections(root);break;
  case 'quality':quality(root);break;
  case 'decision':decision(root);break;
  case 'goals':goals(root);break;
  case 'compliance':compliance(root);break;
  case 'mistakes':mistakes(root);break;
  case 'changes':changes(root);break;
  case 'reports':reports(root);break;
 }
 const newInputs=[...root.querySelectorAll('input,select,textarea')].map(x=>x.id||x.name||x.getAttribute('data-tr-onchange')||'');
 const remaining=new Set(root.querySelectorAll('button,[data-tr-action-click]'));
 if(JSON.stringify(inputs)!==JSON.stringify(newInputs)&&inputs.length){
  // Order can change when moving existing controls. Compare exact multiset.
  if([...inputs].sort().join('\0')!==[...newInputs].sort().join('\0'))throw Error('PR4 input inventory modified in '+view);
 }
 if(actions.some(a=>!remaining.has(a)))throw Error('PR4 action inventory lost in '+view);
 return template.innerHTML;
}
const previous=typeof trRenderViewHtml==='function'?trRenderViewHtml:null;
if(previous)trRenderViewHtml=function(view){
 const html=previous.apply(this,arguments);
 return decorate(view,html);
};
document.addEventListener('click',event=>{
 const summary=event.target?.closest?.('summary');
 const item=summary?.closest?.('[data-trvis4-disclosure]');
 if(item)stateOf[item.dataset.trvis4Disclosure]=!item.open;
},true);
document.addEventListener('toggle',event=>{
 const item=event.target;
 if(item?.matches?.('[data-trvis4-disclosure]')&&item.isConnected){
  stateOf[item.dataset.trvis4Disclosure]=item.open;
 }
},true);
globalThis.TradingResearchVisualPR4=Object.freeze({decorate,version:'0.1'});
})();
