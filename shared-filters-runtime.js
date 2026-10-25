/* Audit R3 / PR1: one selection per TP/version/environment, contextual recipes,
 * existing savedStudies and frozen forwardTests. No mutation during rendering. */
(()=>{
'use strict';
if(typeof document==='undefined'||globalThis.TradingResearchSharedFilters)return;
const M=globalThis.TradingResearchSharedFiltersModel,A=globalThis.TradingResearchActions;
const storeKey='tradingResearchSharedSelectionV1';
const taxRead=globalThis.TradingResearchTaxonomySelectionReadContract;
const plan=()=>globalThis.TradingResearchPlanReadContract.current();
const route=()=>globalThis.TradingResearchCurrentViewReadContract.current();
const universe=(p=plan())=>(state.operations||[]).filter(o=>o.tradingPlanId===p?.id);
const esc=v=>globalThis.TradingResearchContentEncodingContract.html(String(v??''));
const args=v=>encodeURIComponent(JSON.stringify(v));
const button=(label,name,values=[],className='btn small')=>`<button type="button" class="${className}" data-tr-action-click="${name}" data-tr-args-click="${args(values)}">${esc(label)}</button>`;
let saved={contexts:{},recipes:{}};
try{const parsed=JSON.parse(localStorage.getItem(storeKey)||'null');if(parsed&&parsed.contexts&&parsed.recipes)saved=parsed;}catch{}
let key='',selection=M.normalize(),activeView='',activeOos='',open=false,query='',storageError='';
let builderKey='',builderActive='',builderOos='';
let pendingSave=null,pendingFreeze=null;
let searchTimer;
const groupsOpen=new Set(['Tiempo','Clasificación técnica']);
function saveUi(){
 if(key)saved.contexts[key]={filters:M.normalize(selection),activeView,activeOos,unit:labState.unit,basis:labState.basis,imageLabel:galleryViewState.label||''};
 try{localStorage.setItem(storeKey,JSON.stringify(saved));storageError='';}catch{storageError='No se pudo conservar la selección en este navegador.';}
}
function sync(){
 Object.assign(opsViewState,M.copy(selection));Object.assign(labState,M.copy(selection));
}
function ensureContext(){
 const next=M.context(plan());if(next===key)return;
 if(key)saveUi();key=next;
 const prior=saved.contexts[key];
 // Import existing in-memory filters once; never carry them into another TP.
 selection=M.normalize(prior?.filters||(!Object.keys(saved.contexts).length?opsViewState:{}));
 activeView=prior?.activeView||'';activeOos=prior?.activeOos||'';
 const unit=prior?.unit||'ticks',basis=prior?.basis||'net';
 labState.unit=opsViewState.unit=calendarState.unit=unit;labState.basis=opsViewState.basis=calendarState.basis=basis;window.__trDashboardUnit=unit;
 Object.assign(galleryViewState,{q:'',setup:'',vd:'',nr:'',result:'',direction:'',context:'',label:prior?.imageLabel||''});
 if(typeof labStudiesUi!=='undefined'){labStudiesUi.activeId=activeView;labStudiesUi.selectedId=activeView;labStudiesUi.compareId='';}
 sync();saveUi();
}
function builder(){
 const bridge=globalThis.TradingResearchBuilderSelectionContract;
 if(!bridge||route()!=='tpbuilder')return null;
 const info=bridge.read(),p=getPlan(info.sourcePlanId);if(!p)return null;
 const next=M.context(p);
 if(next!==builderKey){
  builderKey=next;const prior=saved.recipes[next];
  if(prior)bridge.apply(prior.filters);
  builderActive=prior?.activeView||'';builderOos=prior?.activeOos||'';
 }
 return {plan:p,key:next,filters:M.normalize(bridge.read().filters),activeView:builderActive,activeOos:builderOos,recipe:true};
}
function context(){ensureContext();const c=builder()||{plan:plan(),key,filters:M.normalize(selection),activeView,activeOos,recipe:false};return {...c,unit:c.recipe?'r':labState.unit,basis:c.recipe?'net':labState.basis};}
function commit(filters,{viewId, oosId}={}){
 const c=context(),f=M.normalize(filters);
 if(c.recipe){
  globalThis.TradingResearchBuilderSelectionContract.apply(f);
  if(viewId!==undefined)builderActive=viewId;if(oosId!==undefined)builderOos=oosId;
  saved.recipes[c.key]={filters:f,activeView:builderActive,activeOos:builderOos};
 }else{
  selection=f;if(viewId!==undefined)activeView=viewId;if(oosId!==undefined)activeOos=oosId;
  labStudiesUi.activeId=activeView;sync();
 }
 saveUi();
}
function selectFor(p,filters,rows=universe(p)){
 const f=M.normalize(filters),blocks=new Map([...rows].sort(v3194CompareOps).map((o,i)=>[o.id,Math.floor(i/20)+1]));
 let result=taxRead.filter(f,rows,blocks);
 if(f.riskPolicy==='plan')result=applyRiskManagementRules(result,p).included;
 return result.filter(o=>{
  if(f.context&&String(o.h4Context||'')!==f.context)return false;
  const d=new Date(o.entryDate),hour=String(d.getHours()).padStart(2,'0')+':00';
  if(f.hour&&hour!==f.hour)return false;
  if(f.focus&&String(o.emotional?.focus||'')!==f.focus)return false;
  if(f.stress&&String(o.emotional?.stress||'')!==f.stress)return false;
  if(f.rMin!==''||f.rMax!==''){
   const value=opMetricValue(o,'r',filters.basis||labState.basis);
   if(!Number.isFinite(value)||o.result==='pending')return false;
   if(f.rMin!==''&&value<Number(f.rMin))return false;if(f.rMax!==''&&value>Number(f.rMax))return false;
  }
  return true;
 }).sort(v3194CompareOps);
}
const sample=()=>{ensureContext();return selectFor(plan(),selection);};
// Widgets and their charts receive the same explicit unit/base and sample.
function dashboardContext(ctx){
 const stats=calcMetricStats(ctx.ops,ctx.unit,labState.basis);
 return {...ctx,metricStats:stats,baseStats:{...ctx.baseStats,n:stats.n,winRate:stats.winRate,wins:stats.wins,losses:stats.losses}};
}
const dashboardKpiBase=dashboardKpiHtml,dashboardPanelBase=dashboardPanelHtml;
dashboardKpiHtml=(id,ctx)=>dashboardKpiBase(id,dashboardContext(ctx));
dashboardPanelHtml=(id,ctx)=>dashboardPanelBase(id,dashboardContext(ctx));
dashboardGroupedMetric=function(ops,key,unit){
 const groups=new Map();for(const o of ops){const label=String((key==='context'?o.h4Context:o[key])||'').trim()||('Sin '+(key==='context'?'contexto':key));if(!groups.has(label))groups.set(label,[]);groups.get(label).push(o);}
 return [...groups].map(([label,rows])=>({label,n:rows.length,value:calcMetricStats(rows,unit,labState.basis).expectancy})).sort((a,b)=>b.n-a.n).slice(0,7);
};
// Preserve the full universe for imports, plan configuration, baseline IDs and OOS.
filteredOps=()=>[...sample()].reverse();
labFilteredOps=sample;
const calendarBase=calendarMonthOps;
calendarMonthOps=function(){const ids=new Set(sample().map(o=>o.id));return calendarBase().filter(o=>ids.has(o.id));};
const galleryBase=galleryFilteredOps;
galleryFilteredOps=function(){const ids=new Set(sample().map(o=>o.id));return galleryBase().filter(o=>ids.has(o.id));};
// A frozen hypothesis always evaluates its own snapshot, independently of UI filters.
const labDefaultBase=labStudyDefaultState;
labStudyDefaultState=function(){return {...labDefaultBase(),layer:''};};
labFilteredOpsForState=function(f={}){return selectFor(plan(),{...f,basis:f.basis||'net'});};
const frozenOpsBase=forwardFrozenOps;
forwardFrozenOps=function(t){
 // Closing with no eligible OOS trades freezes an empty set as well.
 if(t?.status==='closed'&&Array.isArray(t.finalOpIds)&&!t.finalOpIds.length)return [];
 return frozenOpsBase(t);
};

function adoptLab(){selection=M.normalize(labState);activeView=labStudiesUi.activeId||'';sync();saveUi();}
function adoptOps(){selection=M.normalize(opsViewState);sync();saveUi();}
// Graph interactions still mutate their established view state; adopt before render.
let lastLab='',lastOps='';
function signatures(){lastLab=M.signature(labState);lastOps=M.signature(opsViewState);}
function beforeRender(){
 const old=key;ensureContext();
 if(route()==='tpbuilder')builder();
 if(old===key){
  if(lastLab&&lastLab!==M.signature(labState))adoptLab();
  else if(lastOps&&lastOps!==M.signature(opsViewState))adoptOps();
 }
 signatures();
}
globalThis.TradingResearchRender.subscribe({before:beforeRender,after:decorateActual});
const readOpsBase=readOpsFilters;
readOpsFilters=function(){if(document.getElementById('searchOps')){readOpsBase();adoptOps();}else sync();};
A.readOpsFilters=readOpsFilters;
// Legacy filter actions remain supported, but absent controls cannot clear selection.
filterOperations=function(){readOpsFilters();render();};A.filterOperations=filterOperations;
resetOpsFilters=function(){commit({}, {viewId:'',oosId:''});signatures();render();};A.resetOpsFilters=resetOpsFilters;
labReset=function(){commit({}, {viewId:'',oosId:''});if(typeof labInteractionState!=='undefined')labInteractionState={focusStress:null,behavior:null,rBin:null,edge:null};signatures();render();};A.labReset=labReset;
const refreshBase=refreshOpsAnalytics;
refreshOpsAnalytics=function(read=true){if(read)readOpsFilters();adoptOps();signatures();const out=refreshBase(false);decorateActual();return out;};
// Study loading through any old entry point also joins the shared selection.
const applyStudyBase=applyStudySnapshot;
applyStudySnapshot=function(s){applyStudyBase(s);adoptLab();};
const loadOosBase=loadForwardFilters;
loadForwardFilters=function(id){loadOosBase(id);adoptLab();activeOos=id;activeView='';saveUi();render();};
A.loadForwardFilters=loadForwardFilters;
const saveStudyBase=saveCurrentStudy;
saveCurrentStudy=function(){sync();saveStudyBase();activeView=labStudiesUi.activeId||'';saveUi();decorateActual();};A.saveCurrentStudy=saveCurrentStudy;

function field(name,label,type='text',values=null,group='Tiempo',current=context().filters){
 const value=String(current[name]??''),attr=`data-gf-field="${esc(name)}"`,id='gf-'+name;
 let control;
 if(values){
  const list=values.map(v=>Array.isArray(v)?v:[String(v),String(v)]);
  if(value&&!list.some(([id])=>String(id)===value))list.unshift([value,value+' · histórico']);
  control=`<select id="${id}" class="select" ${attr}><option value="">Todos</option>${list.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===value?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
 }else control=`<input id="${id}" class="input" type="${type}" value="${esc(value)}" ${attr} ${type==='number'?'step="any"':''}>`;
 return {group,label,html:`<label class="gf-field"><span>${esc(label)}</span>${control}</label>`};
}
function fields(c){
 const p=c.plan,f=c.filters,ops=universe(p),unique=key=>uniqueSorted(ops.map(o=>typeof key==='function'?key(o):o[key]));
 const out=[field('q','Buscar operaciones','search',null,'Tiempo',f),field('dateFrom','Desde','date',null,'Tiempo',f),field('dateTo','Hasta','date',null,'Tiempo',f),field('timeFrom','Hora desde','time',null,'Tiempo',f),field('timeTo','Hora hasta','time',null,'Tiempo',f)];
 out.push(field('month','Mes','',MONTH_LABELS.map((n,i)=>[i+1,n]),'Tiempo',f),field('year','Año','',unique(o=>new Date(o.entryDate).getFullYear()),'Tiempo',f),field('hour','Hora seleccionada','time',null,'Tiempo',f));
 out.push(field('contract','Instrumento','',unique(o=>String(o.contract||o.instrumentSnapshot?.symbol||'').trim().split(/\s+/)[0]),'Instrumento y ejecución',f),field('direction','Dirección','',['LONG','SHORT'],'Instrumento y ejecución',f),field('risk','Régimen de gestión','',(p?.riskStrategies||[]).map(r=>[r.id,r.name]),'Gestión y resultado',f),field('layer','Ámbito de ejecución','',[['backtest','Backtesting'],['live','Live'],['sim','SIM'],['replay','Market Replay'],['manual','Manual'],['pending','Pendiente de vinculación NT'],['unclassified','Sin clasificar']],'Instrumento y ejecución',f));
 for(const tax of p?.taxonomyRegistry||[]){
  const selected=f.taxonomyFilters[tax.id];if(tax.status==='archived'&&!selected)continue;
  const vals=taxRead.options(tax).map(v=>[v.id,v.name]);
  out.push(field('tax:'+tax.id,tax.name+(tax.status==='archived'?' · archivada':''),'',vals,'Clasificación técnica',{['tax:'+tax.id]:selected||''}));
 }
 for(const [id,value] of Object.entries(f.taxonomyFilters))if(!(p?.taxonomyRegistry||[]).some(t=>t.id===id))out.push(field('tax:'+id,'Taxonomía no disponible · '+id,'',[[value,value]],'Clasificación técnica',{['tax:'+id]:value}));
 // Keep legacy snapshots readable without duplicating canonical taxonomy controls.
 for(const [k,label,opKey] of [['setup','Setup','setup'],['vd','VD','vd'],['nr','NR','nr'],['hypothesis','Hipótesis','hypothesis'],['context','Contexto H4','h4Context']]){
  if(f[k])out.push(field(k,label+' · criterio anterior','',unique(opKey),'Clasificación técnica',f));
 }
 out.push(field('result','Resultado','',[['win','Ganadoras'],['loss','Perdedoras'],['flat','Cero medido'],['pending','Pendientes']],'Gestión y resultado',f),field('rMin','R mínima','number',null,'Gestión y resultado',f),field('rMax','R máxima','number',null,'Gestión y resultado',f));
 {
  out.push(field('source','Origen','',unique(o=>o.raw?.source||'manual'),'Gestión y resultado',f),field('block','Bloque','',Array.from({length:Math.ceil(ops.length/20)},(_,i)=>[i+1,'Bloque '+(i+1)]),'Gestión y resultado',f));
  if(globalThis.TradingResearchOperationSemanticsContract.planEnvironment(p)!=='backtest'||['emotion','behavior','emotionStatus','focus','stress'].some(k=>f[k])){
   out.push(field('emotion','Emoción','',uniqueSorted(ops.flatMap(operationEmotionValues)),'Diario de operaciones',f),field('behavior','Comportamiento','',uniqueSorted(ops.flatMap(o=>o.emotional?.behaviors||[])),'Diario de operaciones',f),field('emotionStatus','Cobertura del diario','',[['complete','Completado'],['pending','Pendiente']],'Diario de operaciones',f),field('focus','Foco','',[1,2,3,4,5],'Diario de operaciones',f),field('stress','Estrés','',[1,2,3,4,5],'Diario de operaciones',f));
  }
 }
 return out;
}
function unitBar(){return `<div class="gf-units" role="group" aria-label="Unidad y base de resultados"><div><span>Unidad</span>${[['ticks','Ticks'],['r','R'],['usd','USD']].map(([u,l])=>button(l,'gfUnit',[u],'seg-btn '+(labState.unit===u?'active':''))).join('')}</div><div><span>Base</span>${[['gross','Bruto'],['net','Neto']].map(([u,l])=>button(l,'gfBasis',[u],'seg-btn '+(labState.basis===u?'active':''))).join('')}</div></div>`;}
function scopeText(c){
 if(c.recipe)return 'Receta de derivación · origen '+planLabel(c.plan)+'. Resultado y límites de R en neto. La selección compartida del TP activo se conserva.';
 if(['config','plans','market'].includes(route()))return 'La selección afecta a operaciones. Esta pantalla conserva su ámbito de configuración y sus fuentes.';
 if(route().startsWith('journal'))return 'La selección común se conserva. Las sesiones y notas del Diario usan su propio alcance; no se eliminan por filtrar operaciones.';
 if(['reports','blocks','goals','decision','changes','review','quality'].includes(route()))return 'La selección común se conserva. Este apartado mantiene su alcance propio, indicado junto al contenido.';
 return 'Operaciones, gráficos, Laboratorio, Dashboard y Calendario comparten esta selección. Cada análisis indica su muestra evaluable.';
}
function panelHtml(c){
 const f=c.filters,all=universe(c.plan),rows=selectFor(c.plan,{...f,basis:c.basis},all),list=fields(c),groups=[...new Set(list.map(x=>x.group))];
 const studies=c.plan?.savedStudies||[],forward=c.plan?.forwardTests||[],view=studies.find(x=>x.id===c.activeView),oos=forward.find(x=>x.id===c.activeOos);
 const sameSnapshot=s=>M.signature(s.lab)===M.signature(f)&&(s.lab?.unit||'r')===c.unit&&(s.lab?.basis||'net')===c.basis;
 const changed=view?!sameSnapshot(view):false;
 const oosChanged=oos?!sameSnapshot(oos):false;
 const chips=list.filter(x=>{const t=document.createElement('template');t.innerHTML=x.html;return !!t.content.querySelector('input,select')?.value;}).map(x=>{
  const t=document.createElement('template');t.innerHTML=x.html;const control=t.content.querySelector('input,select'),value=control.tagName==='SELECT'?control.selectedOptions[0]?.textContent:control.value;
  return button(x.label+': '+value+' ×','gfClear',[control.dataset.gfField],'gf-chip');
 });
 if(f.days.length)chips.push(button('Días: '+f.days.map(d=>DOW_LABELS[d]).join(', ')+' ×','gfClear',['days'],'gf-chip'));
 return `<header class="gf-head"><div><h2 id="gf-title">${c.recipe?'Filtros · Constructor':'Filtros'}</h2><p>${esc(planLabel(c.plan))} · ${esc(globalThis.TradingResearchOperationSemanticsContract.planEnvironmentLabel(c.plan))}</p></div>${button('Cerrar ×','gfClose',[],'btn small')}</header>
 <div class="gf-body"><p class="gf-scope">${esc(scopeText(c))}</p><p class="gf-count" role="status">${rows.length} de ${all.length} operaciones · ${M.count(f)} filtros${f.riskPolicy==='plan'?' · reglas de gestión TP':''}</p>
 ${storageError?`<p class="notice warn">${esc(storageError)}</p>`:''}
 <section class="gf-saved"><label for="gf-view">Vista guardada</label><select id="gf-view" class="select"><option value="">Selección de trabajo</option>${studies.map(s=>`<option value="${esc(s.id)}" ${s.id===c.activeView?'selected':''}>${esc(s.name)}</option>`).join('')}</select><small>${view?(changed?'Cambios sin guardar':'Vista recuperada sin cambios'):'Los filtros de trabajo se conservan automáticamente en este navegador.'}</small><div class="gf-actions">${button('Guardar como nueva','gfSave')}${button('Actualizar vista','gfUpdate',[],view?'btn small':'btn small gf-disabled')}</div></section>
 <div class="gf-active">${chips.join('')||'<small>Sin filtros de muestra</small>'}${button('Restablecer','gfReset')}</div>
 <label class="gf-field"><span>Buscar un filtro</span><input id="gf-search" type="search" class="input" value="${esc(query)}" placeholder="Fecha, taxonomía, resultado…"></label>
 ${groups.map(group=>{const matching=list.filter(x=>x.group===group&&(!query||(group+' '+x.label).toLowerCase().includes(query.toLowerCase())));if(!matching.length&&group!=='Tiempo')return '';return `<details class="gf-family" data-gf-group="${esc(group)}" ${query||groupsOpen.has(group)?'open':''}><summary>${esc(group)}</summary><div class="gf-grid">${matching.map(x=>x.html).join('')}${group==='Tiempo'?`<div class="gf-week"><span>Días de entrada</span><div>${[1,2,3,4,5,6,0].map(d=>`<button type="button" class="filter-chip ${f.days.includes(d)?'active':''}" aria-pressed="${f.days.includes(d)}" data-gf-day="${d}">${esc(DOW_LABELS[d])}</button>`).join('')}</div></div>`:''}</div></details>`;}).join('')}
 <label class="gf-field gf-policy"><span>Política de gestión · no cuenta como filtro</span><select id="gf-policy" class="select"><option value="raw" ${f.riskPolicy==='raw'?'selected':''}>Sin recorte</option><option value="plan" ${f.riskPolicy==='plan'?'selected':''}>Aplicar reglas del plan</option></select></label>
 ${!c.recipe?unitBar():''}
 <section class="gf-oos"><h3>Hipótesis OOS</h3><select id="gf-oos" class="select" aria-label="Recuperar filtros de hipótesis OOS"><option value="">Seleccionar hipótesis…</option>${forward.map(t=>`<option value="${esc(t.id)}" ${t.id===c.activeOos?'selected':''}>${esc(t.name)} · ${t.status==='closed'?'cerrada':'en seguimiento'}</option>`).join('')}</select>${oos?`<small>Congelada ${esc(fmtDate(oos.createdAt))} · ${oosChanged?'La selección tiene cambios sin congelar':'Criterios iguales a la hipótesis'} · ${oos.baselineOpIds?.length||0} operaciones de descubrimiento</small>`:'<small>Una vista se puede actualizar. Una hipótesis congelada mantiene su definición original.</small>'}<div class="gf-actions">${button('Congelar nueva hipótesis','gfFreeze')}${button('Abrir seguimiento OOS','gfOos')}</div></section>
 <section id="gf-contextual" class="gf-contextual"><h3>Solo en esta pantalla</h3><p>Estos controles conservan su alcance propio.</p></section></div>`;
}
function shell(){
 let trigger=document.getElementById('gf-trigger');
 if(!trigger){
  trigger=document.createElement('button');trigger.id='gf-trigger';trigger.type='button';trigger.className='btn gf-trigger';trigger.dataset.trActionClick='gfToggle';trigger.setAttribute('aria-controls','gf-panel');document.body.append(trigger);
  const backdrop=document.createElement('div');backdrop.id='gf-backdrop';backdrop.hidden=true;backdrop.dataset.trActionClick='gfClose';document.body.append(backdrop);
  const panel=document.createElement('aside');panel.id='gf-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','gf-title');document.body.append(panel);
 }
 return trigger;
}
const contextualSelectors='.review-filter,.research-change-filters,.compliance-filter,.mistakes-filter,.journal-filter,.emotional-notes-filter,.report-scope-grid,.filter-hub';
function moveContextual(root){
 const holder=document.querySelector('#gf-contextual');if(!holder)return;
 for(const node of root.querySelectorAll(contextualSelectors)){
  if(node.closest('.modal-backdrop'))continue;
  const wrap=node.closest('.trvis4-details');holder.append(node);if(wrap&&!wrap.querySelector('input,select,button'))wrap.remove();
 }
 // Keep filtering controls alive even while the common drawer is closed.
 holder.hidden=!holder.querySelector('input,select,button');
}
function decorateActual(){
 const root=document.getElementById('view');if(!root)return;
 const c=context(),trigger=shell();
 trigger.textContent=(c.recipe?'Filtros · receta':'Filtros')+(M.count(c.filters)?' · '+M.count(c.filters):'');trigger.setAttribute('aria-expanded',String(open));
 const panel=document.getElementById('gf-panel'),scroll=panel.querySelector('.gf-body')?.scrollTop||0;
 const focused=panel.contains(document.activeElement)?document.activeElement:null,focusId=focused?.id;
 if(focused?.closest('.gf-family')?.open)groupsOpen.add(focused.closest('.gf-family').dataset.gfGroup);
 const focusDay=focused?.dataset.gfDay,focusAction=focused?.dataset.trActionClick,focusArgs=focused?.dataset.trArgsClick;
 const caret=focused?.tagName==='INPUT'&&['text','search'].includes(focused.type)?focused.selectionStart:null;
 // Retain original contextual controls across analytics-only/partial renders.
 const previous=[...panel.querySelectorAll('#gf-contextual > *')].filter(x=>!['H3','P'].includes(x.tagName));
 panel.innerHTML=panelHtml(c);panel.querySelector('.gf-body').scrollTop=scroll;
 if(!['gallery','tpbuilder','operations','lab'].includes(route())&&root.dataset.gfContext===route()&&!root.querySelector(contextualSelectors))for(const node of previous)panel.querySelector('#gf-contextual').append(node);
 root.dataset.gfContext=route();
 let moduleButtons=[];
 if(['operations','lab'].includes(route())){
  moduleButtons=[...root.querySelectorAll('.filter-hub [data-module-chip]')];
  for(const node of root.querySelectorAll('.filter-hub,.trvis3-lab-filters,.tr5-filter-status'))node.remove();
  // Old partial-render region may persist as an empty anchor; it occupies no space.
  const unit=root.querySelector('.trvis3-lab-unitbar');if(unit)unit.remove();
 }else if(route()==='gallery'){
  root.querySelector('.trvis3-gallery-filters')?.remove();root.querySelector('.filter-hub')?.remove();
  // Only image-specific filters stay contextual; technical selection is shared.
  const f=galleryViewState;
  panel.querySelector('#gf-contextual').insertAdjacentHTML('beforeend',field('imageLabel','Tipo de imagen · solo Biblioteca','',uniqueSorted(universe().flatMap(o=>(o.images||[]).map(x=>x.label))),'',{imageLabel:f.label}).html);
 }else if(route()==='tpbuilder'){
  const card=root.querySelector('#tpb-date-from')?.closest('.card.panel');if(card)card.remove();
  for(const node of root.querySelectorAll('.trvis3-builder-filters'))node.remove();
 }else moveContextual(root);
 const holder=panel.querySelector('#gf-contextual');holder.hidden=!holder.querySelector('input,select,button');
 for(const node of root.querySelectorAll('.trvis4-details'))if(!node.querySelector('input,select,button')&&/filter/.test(node.dataset.trvis4Disclosure||''))node.remove();
 const bar=root.querySelector('.gf-contextbar')||document.createElement('div');bar.className='gf-contextbar';
 const all=universe(c.plan),rows=selectFor(c.plan,{...c.filters,basis:c.basis},all),eligible=calcMetricStats(rows,labState.unit,labState.basis).n;
 const applies=['operations','lab','dashboard','calendar','gallery'].includes(route());
 bar.innerHTML=`<span>${c.recipe?'Receta del origen · ':applies?'Selección · ':'Selección conservada · '}${rows.length}/${all.length} operaciones · ${M.count(c.filters)} filtros${c.filters.riskPolicy==='plan'?' · gestión TP aplicada':''}${applies?' · '+eligible+' evaluables en '+esc(metricUnitLabel(labState.unit)):''}${!applies&&!c.recipe?' · esta pantalla mantiene su alcance propio':''}</span>${['operations','lab','dashboard','calendar'].includes(route())?unitBar():''}`;
 const top=root.querySelector('.topbar');if(top)top.after(bar);else root.prepend(bar);
 if(moduleButtons.length){const controls=root.querySelector('.gf-analysis-controls')||document.createElement('details');controls.className='gf-analysis-controls';const title=document.createElement('summary');title.textContent='Módulos del análisis gráfico';const content=document.createElement('div');content.append(...moduleButtons);controls.replaceChildren(title,content);bar.after(controls);}
 if(['operations','lab','dashboard','calendar'].includes(route()))for(const old of root.querySelectorAll('.metric-switch')){
  const labels=[...old.querySelectorAll('button')].map(b=>b.textContent.trim());if(labels.includes('Ticks')&&labels.includes('R'))old.remove();
 }
 // Preserve the active analysis and its controls. Only remove stale sample badges.
 const line=root.querySelector('.tr6-context-line');if(line){for(const s of line.querySelectorAll('span'))if(/filtros|operaciones de|Todos los filtros/.test(s.textContent))s.remove();}
 if(route()==='dashboard'){
  for(const card of root.querySelectorAll('.dashboard-kpis-custom .kpi'))if(card.querySelector('.label')?.textContent.trim().startsWith('Operaciones')){
   const value=card.querySelector('.value'),sub=card.querySelector('.sub');if(value)value.textContent=String(rows.length);if(sub)sub.textContent=eligible+'/'+rows.length+' evaluables · selección común';
  }
 }
 // One canonical dimension per semantic taxonomy, retaining saved legacy values.
 for(const select of root.querySelectorAll('#filterDimension')){
  const seen=new Map();for(const option of [...select.options]){
   const name=option.value.replace(/^tax:/,'').replace(/^h4Context$/,'context');
   const earlier=seen.get(name);if(!earlier){seen.set(name,option);continue;}
   if(option.selected){earlier.remove();seen.set(name,option);}else option.remove();
  }
 }
 signatures();setOpen(open,false);
 if(open&&focusId){const el=document.getElementById(focusId);el?.focus({preventScroll:true});if(caret!=null)el?.setSelectionRange(caret,caret);}
 else if(open&&focused){const match=[...panel.querySelectorAll('button')].find(b=>focusDay!==undefined?b.dataset.gfDay===focusDay:b.dataset.trActionClick===focusAction&&b.dataset.trArgsClick===focusArgs);match?.focus({preventScroll:true});}
}
// Render Dashboard against the selection without changing the universe contract.
const viewRenderer=trRenderViewHtml;
trRenderViewHtml=function(view){
 ensureContext();if(view!=='dashboard')return viewRenderer(view);
 const original=currentOps,rows=sample();currentOps=()=>rows;
 try{return viewRenderer(view);}finally{currentOps=original;}
};
function setOpen(value,focus=true){
 open=!!value;shell();document.getElementById('gf-panel').hidden=!open;document.getElementById('gf-backdrop').hidden=!open;
 document.getElementById('gf-trigger').setAttribute('aria-expanded',String(open));
 document.getElementById('gf-trigger').tabIndex=open?-1:0;
 document.getElementById('app')?.toggleAttribute('inert',open);
 if(focus)(open?document.querySelector('#gf-panel [data-tr-action-click="gfClose"]'):document.getElementById('gf-trigger'))?.focus();
}
A.gfToggle=()=>{decorateActual();setOpen(!open);};A.gfClose=()=>setOpen(false);A.gfReset=()=>{commit({}, {viewId:'',oosId:''});signatures();render();};
A.gfClear=name=>{const c=context(),f=c.filters;if(name.startsWith('tax:'))delete f.taxonomyFilters[name.slice(4)];else f[name]=name==='days'?[]:'';commit(f);signatures();render();};
A.gfUnit=unit=>{if(!['ticks','r','usd'].includes(unit))return;labState.unit=unit;opsViewState.unit=unit;calendarState.unit=unit;window.__trDashboardUnit=unit;saveUi();render();};
A.gfBasis=basis=>{if(!['gross','net'].includes(basis))return;labState.basis=basis;opsViewState.basis=basis;calendarState.basis=basis;saveUi();render();};
A.gfSave=()=>{
 const c=context();pendingSave={planId:c.plan.id,key:c.key,recipe:c.recipe,snapshot:{...currentStudySnapshot(),lab:{...currentStudySnapshot().lab,...M.copy(c.filters),unit:c.unit,basis:c.basis}}};
 setOpen(false);
 const body=`<label class="gf-field"><span>Nombre de la vista</span><input id="gf-save-name" class="input" required maxlength="120"></label><p>Se guardarán los criterios y la unidad/base en ${esc(planLabel(c.plan))}. Las operaciones se consultan sin duplicarlas.</p>`;
 document.body.insertAdjacentHTML('beforeend',modalShell('Guardar vista de filtros',body,button('Cancelar','closeModal')+button('Guardar vista','gfSaveCommit',[],'btn primary')));
};
A.gfSaveCommit=()=>{
 const name=document.getElementById('gf-save-name')?.value.trim(),p=getPlan(pendingSave?.planId);if(!name||!p)return;
 const now=new Date().toISOString(),s={id:uid('STUDY'),name,description:'',createdAt:now,updatedAt:now,...pendingSave.snapshot};
 TRDomainStore.commit('shared-filters.save-view',()=>{p.savedStudies.unshift(s);p.updatedAt=now;},{persist:true,render:false});
 commit(s.lab,{viewId:s.id,oosId:''});pendingSave=null;closeModal();render();
};
A.gfUpdate=()=>{
 const c=context(),s=(c.plan?.savedStudies||[]).find(x=>x.id===c.activeView);if(!s)return;
 if(!confirm('Actualizar la vista “'+s.name+'”? Las hipótesis OOS permanecerán intactas.'))return;
 TRDomainStore.commit('shared-filters.update-view',()=>{Object.assign(s,{...currentStudySnapshot(),lab:{...currentStudySnapshot().lab,...M.copy(c.filters),unit:c.unit,basis:c.basis}},{updatedAt:new Date().toISOString()});c.plan.updatedAt=s.updatedAt;},{persist:true,render:false});render();
};
A.gfFreeze=()=>{
 const c=context();if(!c.recipe){setOpen(false);sync();openFreezeHypothesisModal();return;}
 pendingFreeze={planId:c.plan.id,lab:{...currentStudySnapshot().lab,...M.copy(c.filters),unit:c.unit,basis:c.basis},viewId:c.activeView};setOpen(false);
 const body='<label class="gf-field"><span>Nombre de la hipótesis</span><input id="gf-freeze-name" class="input" required></label><p>Se congelará la receta sobre el TP de origen, con 50 operaciones futuras como objetivo. Los criterios originales permanecerán intactos.</p>';
 document.body.insertAdjacentHTML('beforeend',modalShell('Congelar receta del origen',body,button('Cancelar','closeModal')+button('Congelar hipótesis','gfFreezeCommit',[],'btn primary')));
};
A.gfFreezeCommit=()=>{
 const name=document.getElementById('gf-freeze-name')?.value.trim(),p=getPlan(pendingFreeze?.planId);if(!name||!p)return;
 const now=new Date().toISOString(),lab=M.copy(pendingFreeze.lab),ops=selectFor(p,lab);
 const t={id:uid('FWD'),name,description:'',status:'active',createdAt:now,closedAt:'',targetN:50,lab,baselineOpIds:universe(p).map(o=>o.id),finalOpIds:[],sourceStudyId:pendingFreeze.viewId,sourceStudyName:(p.savedStudies||[]).find(s=>s.id===pendingFreeze.viewId)?.name||'',discoveryStats:compactStatsSnapshot(calcMetricStats(ops,lab.unit,lab.basis))};
 TRDomainStore.commit('shared-filters.freeze-recipe',()=>{p.forwardTests.unshift(t);p.updatedAt=now;},{persist:true,render:false});pendingFreeze=null;closeModal();render();
};
A.gfOos=()=>{const c=context();setOpen(false);if(c.recipe&&c.plan.id!==plan().id)A.switchPlan(c.plan.id);A.navigate('lab');A.tr6LabGroup('oos');};
function snapshotUnits(lab={}){
 const unit=['ticks','r','usd'].includes(lab.unit)?lab.unit:'r',basis=lab.basis==='gross'?'gross':'net';
 labState.unit=opsViewState.unit=calendarState.unit=unit;labState.basis=opsViewState.basis=calendarState.basis=basis;window.__trDashboardUnit=unit;
}
document.addEventListener('change',event=>{
 const el=event.target;if(!el.closest?.('#gf-panel'))return;
 const c=context(),f=c.filters,name=el.dataset.gfField;
 if(name==='imageLabel'){galleryViewState.label=el.value;saveUi();render();return;}
 if(name){if(name.startsWith('tax:'))f.taxonomyFilters[name.slice(4)]=el.value;else f[name]=el.value;commit(f);signatures();render();return;}
 if(el.id==='gf-policy'){f.riskPolicy=el.value;commit(f);signatures();render();}
 if(el.id==='gf-view'){
  const s=(c.plan?.savedStudies||[]).find(x=>x.id===el.value);if(!s){commit(f,{viewId:'',oosId:''});render();return;}
  if(!c.recipe){applyStudyBase(s);snapshotUnits(s.lab);}
  commit(s.lab||{},{viewId:s.id,oosId:''});signatures();render();
 }
 if(el.id==='gf-oos'){
  const t=(c.plan?.forwardTests||[]).find(x=>x.id===el.value);if(t){if(!c.recipe)snapshotUnits(t.lab);commit(t.lab||{},{viewId:'',oosId:t.id});signatures();render();}
 }
});
document.addEventListener('click',event=>{const el=event.target.closest?.('[data-gf-day]');if(!el)return;const c=context(),d=Number(el.dataset.gfDay);c.filters.days=c.filters.days.includes(d)?c.filters.days.filter(x=>x!==d):[...c.filters.days,d];commit(c.filters);signatures();render();});
document.addEventListener('input',event=>{
 if(event.target.id!=='gf-search')return;query=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{decorateActual();const el=document.getElementById('gf-search');el?.focus();el?.setSelectionRange(query.length,query.length);},180);
});
document.addEventListener('toggle',event=>{const el=event.target;if(!el.matches?.('.gf-family'))return;if(el.open)groupsOpen.add(el.dataset.gfGroup);else groupsOpen.delete(el.dataset.gfGroup);},true);
document.addEventListener('keydown',event=>{
 if(!open||document.querySelector('.modal-backdrop'))return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);return;}
 if(event.key==='Tab'){
  const nodes=[...document.querySelectorAll('#gf-panel button,#gf-panel input,#gf-panel select,#gf-panel summary')].filter(x=>!x.disabled&&x.getClientRects().length);
  const first=nodes[0],last=nodes.at(-1);if(!document.getElementById('gf-panel').contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
},true);
globalThis.TradingResearchSharedFilters=Object.freeze({version:1,snapshot:()=>{const c=context();return {planId:c.plan?.id,key:c.key,filters:M.copy(c.filters),activeView:c.activeView,activeOos:c.activeOos,recipe:c.recipe,unit:c.unit,basis:c.basis};},sample,selectFor,apply:f=>{commit(f);signatures();render();},count:()=>M.count(context().filters)});
function hydrated(){
 key='';ensureContext();signatures();render();
}
if(globalThis.TradingResearchCoreHydrationReadContract.ready())hydrated();
else addEventListener('tradingresearch:core-hydrated',()=>setTimeout(hydrated,0),{once:true});
})();
