/* Astra UX Lote 3 · navigation and copy only; no state or metric migration. */
(()=>{
'use strict';
const emotional=['journaldashboard','journal','journalops','journalconfidence','journalstreaks','journaldrift','journalreflections','journalweekly','journallibrary','journalnotes','journalstatements'];
const tabs=[
 ['journaldashboard','Resumen'],['journal','Sesiones'],['journalops','Registro emocional'],['journalconfidence','Confianza'],
 ['journalstreaks','Rachas'],['journaldrift','Deriva'],['journalreflections','Perspectiva'],['journalweekly','Revisión semanal']
];
const canonical=Object.freeze({
 dashboard:'Dashboard',decision:'Centro de investigación',changes:'Cambios y alertas',review:'Hallazgos y decisiones',
 mistakes:'Análisis de errores',compliance:'Cumplimiento',journaldashboard:'Diario emocional · Resumen',
 journal:'Diario emocional · Sesiones',journalops:'Diario emocional · Registro emocional',
 journalconfidence:'Diario emocional · Confianza',journalstreaks:'Diario emocional · Rachas',
 journaldrift:'Diario emocional · Deriva',journalreflections:'Diario emocional · Perspectiva',
 journalweekly:'Diario emocional · Revisión semanal'
});
const compactName=Object.freeze({decision:'Centro de investigación',changes:'Cambios y alertas',review:'Hallazgos y decisiones',mistakes:'Análisis de errores',journalops:'Registro emocional',journaldashboard:'Resumen'});
const resultCode=Object.freeze({win:'Ganadora',loss:'Perdedora',pending:'Pendiente',unclassified:'Sin clasificar',flat:'Flat'});
const registry=window.TradingResearchActions;
const read=()=>window.TradingResearchCurrentViewReadContract?.current?.()||'dashboard';
const plan=()=>window.TradingResearchPlanReadContract?.current?.()||null;
const env=p=>window.TradingResearchOperationSemanticsContract?.planEnvironment?.(p)||'unclassified';
const safe=v=>window.TradingResearchContentEncodingContract?.html?.(String(v??''))||String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const arg=a=>encodeURIComponent(JSON.stringify(a));
const link=(label,target,kind='trAstraL3Go',mode='')=>'<button type="button" class="tr3-link" data-tr-action-click="'+kind+'" data-tr-args-click="'+arg(mode?[target,mode]:[target])+'">'+safe(label)+'</button>';
let returnFromPrereq=null;
function go(target){
 if(!target||typeof registry.navigate!=='function')return;
 // Backtesting is intentionally excluded from all emotional-journal views.
 if(emotional.includes(target)&&env(plan())==='backtest')return;
 registry.navigate(target);
}
registry.trAstraL3Go=go;
registry.trAstraL3Prerequisite=function(target,mode=''){
 const origin=read();if(!emotional.includes(origin))return;
 returnFromPrereq={view:origin,planId:plan()?.id||''};
 go(target);
 if(mode==='environment'&&typeof registry.openPlanModal==='function')registry.openPlanModal(plan()?.id||null);
};
registry.trAstraL3Return=function(){
 const back=returnFromPrereq;
 if(!back)return;
 returnFromPrereq=null;
 if(back.planId===plan()?.id&&env(plan())!=='backtest')go(back.view);
 else go('plans'); // no stale plan or forbidden journal navigation
};
function caption(view,fragment){
 const name=canonical[view];if(!name)return;
 const heading=fragment.querySelector('.topbar .page-title h2');
 if(heading)heading.textContent=name;
}
// Display-only translation: options keep the stored value attribute unchanged.
function resultLabels(fragment){
 fragment.querySelectorAll('span.badge,span.tag,select option').forEach(el=>{
   if(el.children.length||el.closest('pre,code'))return;
   const old=el.textContent.trim(),newValue=resultCode[old];
   if(newValue)el.textContent=newValue;
 });
}
function journalNavigation(view,fragment){
 const bar=fragment.querySelector('.topbar');if(!bar)return;
 const nav=document.createElement('nav');nav.className='tr3-journal-nav';nav.setAttribute('aria-label','Navegación del Diario emocional');
 for(const [id,label] of tabs){
   const b=document.createElement('button');b.type='button';b.className='tr3-journal-link'+((view==='journalnotes'||view==='journalstatements'?'journalops':view==='journallibrary'?'journalreflections':view)===id?' is-current':'');
   b.textContent=label;b.dataset.trActionClick='trAstraL3Go';b.dataset.trArgsClick=arg([id]);
   if((view==='journalnotes'||view==='journalstatements'?'journalops':view==='journallibrary'?'journalreflections':view)===id)b.setAttribute('aria-current','page');nav.appendChild(b);
 }
 bar.after(nav);
 const p=plan(),known=!!p&&['live','sim','replay'].includes(env(p));
 const sessions=p?.id?window.TradingResearchEmotionalJournal?.sessions?.(p.id)||[]:[];
 const notices=[];
 if(view==='journal'&&!known){
   notices.push(['El entorno del Trading Plan está sin definir. Para iniciar sesiones es necesario seleccionar Live, SIM o Replay.','Definir entorno','plans','environment']);
 }
 if(view==='journalstreaks'&&fragment.textContent.includes('Sin Backtesting vinculado')){
   notices.push(['Este TP no tiene Backtesting de referencia vinculado. Revisa el grupo de validación en Trading Plans; el umbral manual sigue disponible.','Revisar grupo / Backtesting de referencia','plans']);
 }
 if((view==='journalconfidence'||view==='journaldrift')&&!sessions.length){
   notices.push(['Todavía no hay sesiones emocionales para este TP. Puedes registrarlas sin modificar las operaciones existentes.','Abrir sesiones','journal']);
 }
 if(notices.length){
  const box=document.createElement('div');box.className='tr3-prerequisite-list';
  for(const [message,cta,dest,mode] of notices){
    const item=document.createElement('section');item.className='tr3-prerequisite';item.innerHTML='<div><strong>Para continuar</strong><p>'+safe(message)+'</p></div><div>'+link(cta,dest,dest==='plans'?'trAstraL3Prerequisite':'trAstraL3Go',mode||'')+'</div>';box.appendChild(item);
  }
  nav.after(box);
 }
}
function executionNavigation(view,fragment){
 const title=fragment.querySelector('.topbar');
 if(!title)return;
 const nav=document.createElement('nav');nav.className='tr3-execution-nav';nav.setAttribute('aria-label','Revisión de ejecución');
 const left='<span class="tr3-execution-label">Revisión de ejecución</span>';
 nav.innerHTML=left+[['compliance','Cumplimiento'],['mistakes','Análisis de errores']].map(([id,name])=>
  '<button type="button" class="tr3-execution-link'+(id===view?' is-current':'')+'" data-tr-action-click="trAstraL3Go" data-tr-args-click="'+arg([id])+'"'+(id===view?' aria-current="page"':'')+'>'+safe(name)+'</button>').join('');
 title.after(nav);
 const notes=[...fragment.querySelectorAll('.notice')].filter(x=>x.textContent.trim().length>330&&!x.querySelector('button,input,select'));
 for(const note of notes.slice(0,2)){
   const details=document.createElement('details');details.className='tr3-method';
   const summ=document.createElement('summary');summ.textContent='Ver metodología completa';
   note.replaceWith(details);details.append(summ,note);
 }
}
function returnLink(view,fragment){
 if(view!=='plans'||!returnFromPrereq)return;
 const p=plan();const place=fragment.querySelector('.topbar');if(!place)return;
 const box=document.createElement('div');box.className='tr3-return-context';
 const available=returnFromPrereq.planId===p?.id&&env(p)!=='backtest';
 box.innerHTML='<strong>Volver al Diario emocional</strong><p>El enlace solo cambia la navegación: no modifica entornos ni vinculaciones.</p>'+
 (available?link('Volver a '+(canonical[returnFromPrereq.view]||'Diario emocional'),'','trAstraL3Return'):'<small>Selecciona primero el TP original con un entorno compatible.</small>');
 place.after(box);
}
function decorate(view,html){
 if(typeof document==='undefined'||typeof html!=='string'||!html)return html;
 if(emotional.includes(view)&&env(plan())==='backtest')return html;
 const template=document.createElement('template');template.innerHTML=html;
 caption(view,template.content);
 resultLabels(template.content);
 if(emotional.includes(view))journalNavigation(view,template.content);
 if(view==='compliance'||view==='mistakes')executionNavigation(view,template.content);
 if(view==='plans')returnLink(view,template.content);
 return template.innerHTML;
}
function syncSidebar(){
 const nav=document.querySelector('.sidebar .nav-organized');
 if(!nav)return;
 const current=read();
 // The persistent shell did not previously clear Dashboard's "active" class.
 const direct=nav.querySelector(':scope > button');
 if(direct){
  direct.dataset.view='dashboard';
  direct.classList.toggle('active',current==='dashboard');
  direct.setAttribute('aria-current',current==='dashboard'?'page':'false');
 }
 nav.querySelectorAll('.nav-child[data-view]').forEach(item=>{
   const active=item.dataset.view===current;
   item.classList.toggle('active',active);
   if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
   const label=item.querySelector('.nav-child-label');
   if(label&&compactName[item.dataset.view])label.textContent=compactName[item.dataset.view];
 });
 nav.querySelectorAll('.nav-group').forEach(g=>{
   const active=(g.dataset.navGroup==='emotional'&&emotional.includes(current))||[...g.querySelectorAll('.nav-child')].some(b=>b.dataset.view===current);
   g.classList.toggle('tr3-ancestor',active);
   const toggle=g.querySelector(':scope > .nav-group-toggle');
   if(toggle){if(active)toggle.setAttribute('data-tr-parent-of-active','');else toggle.removeAttribute('data-tr-parent-of-active');}
 });
 // Keep appearance available without leaving a permanent tall settings card.
 const sidebar=document.querySelector('.sidebar');
 const appearance=sidebar?.querySelector(':scope > .theme-switch');
 if(appearance&&!sidebar.querySelector(':scope > .tr3-appearance')){
  const details=document.createElement('details');details.className='tr3-appearance';
  const summary=document.createElement('summary');summary.textContent='Apariencia';
  appearance.before(details);details.append(summary,appearance);
 }
}
// Wrap the established structural presentation boundary rather than replacing
// router or navigation state; all plan/sample/study state is left untouched.
if(typeof trRenderViewHtml==='function'){
 const base=trRenderViewHtml;
 trRenderViewHtml=function(view){return decorate(view??read(),base(view));};
}
if(typeof trRenderSyncSidebar==='function'){
 const base=trRenderSyncSidebar;
 trRenderSyncSidebar=function(){base();syncSidebar();};
}
window.TradingResearchAstraLote3=Object.freeze({names:canonical,decorate,syncSidebar,emotionalViews:emotional.slice(),getReturn:()=>returnFromPrereq});
queueMicrotask(()=>{try{if(window.TradingResearchCurrentViewReadContract?.current?.())window.render?.();}catch(e){console.error('[Astra Lote 3]',e);}});
})();