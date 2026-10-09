/* Astra UI/UX Lote 2 · scoped configuration, recovery access and canonical reference gallery.
   Presentation only: no persistence writes, taxonomy schema changes, or backup actions. */
(()=>{
'use strict';
const groups=Object.freeze({
 plan:{title:'Ajustes del plan',desc:'Reglas y clasificación del Trading Plan seleccionado',
  tabs:[['management','Gestión'],['taxonomy','Taxonomías'],['checklist','Checklist'],['mistakes','Errores'],['riskrules','Riesgo'],['emotional','Emocional']]},
 shared:{title:'Recursos compartidos',desc:'Catálogos y materiales que puedes reutilizar',
  tabs:[['instruments','Contratos'],['library','Biblioteca'],['visual','Referencias visuales']]},
 app:{title:'Aplicación y datos',desc:'Estado, copias, sincronización y mantenimiento',
  tabs:[['data','Copias y datos'],['cloud','Nube y sincronización']]}
});
const typeName=id=>groups[id]?.title||'Configuración';
const groupFor=tab=>Object.keys(groups).find(key=>groups[key].tabs.some(([id])=>id===tab))||'plan';
const esc=v=>globalThis.TradingResearchContentEncodingContract?.html?.(String(v??''))||String(v??'');
const args=values=>encodeURIComponent(JSON.stringify(values));
const plan=()=>globalThis.TradingResearchPlanReadContract?.current?.()||null;
const planLabel=p=>p?(globalThis.TradingResearchPlanReadContract?.label?.(p)||String(p.name||'Trading Plan')):'Sin Trading Plan';
const tab=()=>String(globalThis.TradingResearchConfigTabStateContract?.current?.()||'management');
const actions=globalThis.TradingResearchActions;
let chosenTaxonomy='setup',galleryCategory='',galleryQuery='',galleryWithImages=false;
const safeFrame=markup=>{const frame=document.createElement('template');frame.innerHTML=markup;return frame;};
const go=target=>{
 if(!Object.values(groups).some(g=>g.tabs.some(([id])=>id===target)))return;
 globalThis.TradingResearchConfigTabStateContract.set(target);window.render();
};
actions.trAstraL2Tab=target=>go(target);
actions.trAstraL2Group=key=>{if(groups[key])go(groups[key].tabs[0][0]);};
actions.trAstraL2Tax=function(){chosenTaxonomy=String(this.dataset.taxonomyId||'setup');window.render();};
actions.trAstraL2RefCategory=function(){galleryCategory=String(this.value||'');window.render();};
actions.trAstraL2RefSearch=function(){galleryQuery=String(this.value||'');window.render();};
actions.trAstraL2RefImages=function(){galleryWithImages=!!this.checked;window.render();};
actions.trAstraL2Edit=function(taxId,valueId){
 const p=plan(),tax=p?.taxonomyRegistry?.find(t=>t.id===taxId),value=tax?.values?.find(v=>v.id===valueId);
 if(!tax||!value)return;
 const fn=actions.trTaxOpenValueFicha;if(typeof fn!=='function')return;
 fn(taxId,valueId);
};
actions.trAstraL2Image=function(id,title){
 if(typeof actions.openImageLightbox==='function')actions.openImageLightbox(id,encodeURIComponent(String(title||'Referencia')));
};
actions.trAstraL2Legacy=function(id){
 if(typeof actions.openVisualReferenceModal==='function')actions.openVisualReferenceModal(id);
};
function button(text,action,params,active=false){
 return '<button type="button" class="tr2-nav-button'+(active?' is-active':'')+'" data-tr-action-click="'+action+'" data-tr-args-click="'+args(params)+'"'+(active?' aria-current="page"':'')+'>'+esc(text)+'</button>';
}
function navHeader(scope,current,p){
 const root=document.createElement('div');root.className='tr2-config-nav';
 const bar=document.createElement('div');bar.className='tr2-scope-switch';bar.setAttribute('role','group');bar.setAttribute('aria-label','Ámbito de configuración');
 for(const [key,g] of Object.entries(groups))bar.insertAdjacentHTML('beforeend',button(g.title,'trAstraL2Group',[key],key===scope));
 root.append(bar);
 const head=document.createElement('div');head.className='tr2-scope-label';
 let owner=scope==='plan'?'Este Trading Plan · '+planLabel(p):scope==='app'?'Workspace del navegador · copias y sincronización':'Recursos globales y referencias consultables';
 head.innerHTML='<div><strong>'+esc(groups[scope].title)+'</strong><span>'+esc(groups[scope].desc)+'</span></div><small>'+esc(owner)+'</small>';
 root.append(head);
 const subtabs=document.createElement('div');subtabs.className='tr2-subnav';subtabs.setAttribute('role','group');subtabs.setAttribute('aria-label','Herramientas del ámbito');
 for(const [id,label] of groups[scope].tabs)subtabs.insertAdjacentHTML('beforeend',button(label,'trAstraL2Tab',[id],id===current));
 root.append(subtabs);
 return root;
}
function scopeNotice(scope,current,p){
 const n=document.createElement('div');n.className='tr2-editor-target';
 if(scope==='plan')n.innerHTML='<strong>Destino de edición:</strong> '+esc(planLabel(p))+' · Sus ajustes y referencias no se aplican automáticamente a otros TP.';
 else if(current==='visual')n.innerHTML='<strong>Consulta visual:</strong> referencias del TP '+esc(planLabel(p))+'; la ficha editable pertenece a Taxonomías. Las capturas reales de operaciones son independientes.';
 else if(current==='instruments')n.innerHTML='<strong>Catálogo global:</strong> tick size, valor del tick y comisiones reutilizados por todos los Trading Plans.';
 else if(current==='library')n.innerHTML='<strong>Biblioteca compartida:</strong> plantillas y recursos guardados para reutilizar. La aplicación de una plantilla a un plan tiene su propio comando.';
 else n.innerHTML='<strong>Alcance:</strong> workspace y conexión del dispositivo. Consultar estado no modifica datos; restaurar o sustituirlos exige confirmación.';
 return n;
}
function taxonomyView(content,p){
 const holder=content.querySelector('.taxonomy-layout');if(!holder)return;
 const sections=[...holder.children].filter(el=>el.matches?.('section.card.panel'));
 const taxes=Array.isArray(p?.taxonomyRegistry)?p.taxonomyRegistry:[];
 if(sections.length<2||taxes.length!==sections.length-1)return; // preserve original when contract unexpectedly changes
 if(!taxes.some(t=>t.id===chosenTaxonomy))chosenTaxonomy=taxes[0]?.id||'setup';
 const at=taxes.findIndex(t=>t.id===chosenTaxonomy);
 const main=sections[0],detail=sections[at+1];
 const layout=document.createElement('div');layout.className='tr2-tax-layout';
 const side=document.createElement('nav');side.className='tr2-tax-select';side.setAttribute('aria-label','Seleccionar taxonomía');
 side.innerHTML='<strong>Taxonomías del plan</strong><small>Selecciona una para ver sus valores y abrir la ficha completa.</small>';
 taxes.forEach(t=>{
  const count=(t.values||[]).length;
  const b=document.createElement('button');b.type='button';b.className='tr2-tax-choice'+(t.id===chosenTaxonomy?' is-active':'');
  b.dataset.taxonomyId=t.id;b.setAttribute('data-tr-action-click','trAstraL2Tax');
  b.innerHTML='<span>'+esc(t.name)+'</span><small>'+count+' valores'+(t.status==='archived'?' · archivada':'')+'</small>';side.append(b);
 });
 const right=document.createElement('div');right.className='tr2-tax-detail';right.append(detail);
 layout.append(side,right);
 holder.replaceChildren(main,layout);
 const bottom=document.createElement('p');bottom.className='tr2-tax-gallery-link';
 bottom.innerHTML=button('Abrir galería de consulta →','trAstraL2Tab',['visual']);
 holder.append(bottom);
}
function valueDetails(p,t,v){
 const raw=String(v.legacyValue||v.name||'');
 let def=null;
 if(t.id==='setup')def=(p.setupDefinitions||[]).find(x=>x.key===raw);
 else if(t.id==='vd')def=(p.vdDefinitions||[]).find(x=>x.key===raw);
 else if(t.id==='context')def=(p.contextDefinitions||[]).find(x=>x.key===raw);
 else if(t.id==='hypothesis')def=(p.hypotheses||[]).find(x=>x.id===raw||x.name===v.name);
 const ref=(p.visualReferences||[]).find(x=>x.kind==='taxonomy'&&x.taxonomyId===t.id&&x.valueId===v.id)
   ||(p.visualReferences||[]).find(x=>x.kind===t.id&&x.key===raw);
 return {
  description:def?.description||ref?.note||'',
  specs:def?.specs||ref?.specs||'',
  timeframe:(def?.timeframes||[]).join(' / ')||ref?.timeframe||'',
  long:def?.imagesLong||[],
  short:def?.imagesShort||[],
  images:def?.images||ref?.images||[]
 };
}
function mediaHTML(images,label){
 if(!images?.length)return '';
 const media=images.filter(x=>x?.id).map(x=>{
  const id=String(x.id),title=String(x.caption||x.name||x.label||label);
  return '<button type="button" class="tr2-ref-thumb" data-tr-action-click="trAstraL2Image" data-tr-args-click="'+args([id,title])+'" title="'+esc(title)+'"><img data-img-id="'+esc(id)+'" alt="'+esc(title)+'"><span>'+esc(x.label||label)+'</span></button>';
 }).join('');
 return media?'<div class="tr2-ref-media"><small>'+esc(label)+'</small><div>'+media+'</div></div>':'';
}
function galleryView(content,p){
 const tax=p?.taxonomyRegistry||[];
 const existing=new Set();
 const cards=[];
 for(const t of tax){
  for(const v of t.values||[]){
   const info=valueDetails(p,t,v),images=[...info.long,...info.short,...info.images].filter(x=>x?.id);
   const query=[t.name,v.name,v.legacyValue,info.description,info.specs,info.timeframe,(v.aliases||[]).join(' ')].join(' ').toLocaleLowerCase('es');
   if(galleryCategory&&t.id!==galleryCategory)continue;
   if(galleryQuery&&!query.includes(galleryQuery.trim().toLocaleLowerCase('es')))continue;
   if(galleryWithImages&&!images.length)continue;
   existing.add(t.id+':'+String(v.legacyValue||v.name));
   const meta='<span class="badge">'+esc(t.name)+'</span> <span class="tr2-ref-meta">'+esc(info.timeframe||'Sin temporalidad')+'</span>';
   const imgs=mediaHTML(info.long,'LONG')+mediaHTML(info.short,'SHORT')+mediaHTML(info.images,'Referencia');
   const card='<article class="tr2-ref-card"><div class="tr2-ref-top"><div>'+meta+'<h3>'+esc(v.name)+'</h3></div>'+
     (v.status==='archived'?'<span class="badge">Histórica</span>':'')+'</div>'+
     (info.description?'<p>'+esc(info.description)+'</p>':'<p class="tr2-muted">Sin descripción.</p>')+
     (info.specs?'<div class="tr2-ref-specs"><strong>Qué buscar:</strong> '+esc(info.specs)+'</div>':'')+
     (imgs||'<p class="tr2-muted">Sin imagen de referencia.</p>')+
     '<div class="tr2-ref-actions">'+button('Abrir ficha canónica','trAstraL2Edit',[t.id,v.id])+'</div></article>';
   cards.push(card);
  }
 }
 // Genuine historical legacy references, which have no taxonomy-value identity,
 // retain their original IDs and their existing legacy editor.
 for(const r of p?.visualReferences||[]){
  if(r.kind==='taxonomy'||['setup','vd','context'].includes(r.kind)&&existing.has(r.kind+':'+String(r.key)))continue;
  if(r.kind==='taxonomy')continue;
  const query=[r.kind,r.key,r.title,r.note,r.specs].join(' ').toLocaleLowerCase('es');
  if(galleryCategory&&galleryCategory!=='legacy')continue;
  if(galleryQuery&&!query.includes(galleryQuery.trim().toLocaleLowerCase('es')))continue;
  if(galleryWithImages&&!(r.images||[]).some(x=>x?.id))continue;
  cards.push('<article class="tr2-ref-card"><div class="tr2-ref-top"><div><span class="badge">Referencia histórica</span><h3>'+esc(r.title||r.key)+'</h3></div></div><p>'+esc(r.note||'Sin descripción.')+'</p>'+mediaHTML(r.images,'Referencia heredada')+
  '<div class="tr2-ref-actions">'+button('Abrir editor heredado','trAstraL2Legacy',[r.id])+'</div></article>');
 }
 const controls='<section class="card panel tr2-gallery-intro"><div><h3>Galería de referencias · '+esc(planLabel(p))+'</h3><p>Consulta las condiciones que buscas. Cada imagen pertenece a su ficha técnica; las capturas de operaciones documentan ejecuciones reales en otra biblioteca.</p></div>'+
 '<div class="tr2-gallery-filters"><label>Categoría<select class="select" data-tr-action-change="trAstraL2RefCategory"><option value="">Todas</option>'+
 tax.map(t=>'<option value="'+esc(t.id)+'"'+(galleryCategory===t.id?' selected':'')+'>'+esc(t.name)+'</option>').join('')+
 '<option value="legacy"'+(galleryCategory==='legacy'?' selected':'')+'>Históricas sin taxonomía</option></select></label>'+
 '<label>Buscar referencia<input type="search" class="input" placeholder="Setup, condición, temporalidad..." value="'+esc(galleryQuery)+'" data-tr-action-input="trAstraL2RefSearch"></label>'+
 '<label class="tr2-gallery-check"><input type="checkbox"'+(galleryWithImages?' checked':'')+' data-tr-action-change="trAstraL2RefImages"> Solo con imagen</label></div>'+
 '<div class="tr2-gallery-count">'+cards.length+' referencia(s) encontradas · '+button('Administrar taxonomías →','trAstraL2Tab',['taxonomy'])+'</div></section>';
 content.innerHTML=controls+'<div class="tr2-ref-grid">'+(cards.join('')||'<div class="card panel">No hay referencias que coincidan. Cambia los filtros.</div>')+'</div>';
}
function dataView(content){
 const all=[...content.querySelectorAll('section.card.panel')];
 if(!all.length)return;
 const byName=(el)=>el.querySelector('.panel-title h3')?.textContent?.trim()||'';
 const use=['Copias de seguridad','Persistencia del workspace','Integridad del dataset','Snapshots locales de seguridad'];
 const chosen=[];
 for(const name of use){const card=all.find(el=>byName(el).startsWith(name));if(card)chosen.push(card);}
 const prim=document.createElement('div');prim.className='tr2-data-primary';
 const info=document.createElement('section');info.className='card panel tr2-data-overview';
 info.innerHTML='<div><h3>Estado y recuperación de tus datos</h3><p>Primero, guarda una copia externa; después consulta persistencia e integridad. La última descarga de backup no está registrada en este dispositivo: no se infiere su existencia.</p></div><div>'+button('Nube y snapshots →','trAstraL2Tab',['cloud'])+'</div>';
 prim.append(info);chosen.forEach(x=>prim.append(x));
 const advanced=document.createElement('details');advanced.className='tr2-advanced';
 const summary=document.createElement('summary');summary.textContent='Diagnóstico y soporte técnico · '+(all.length-chosen.length)+' panel(es)';advanced.append(summary);
 const body=document.createElement('div');body.className='tr2-advanced-body';
 all.filter(x=>!chosen.includes(x)).forEach(x=>body.append(x));
 advanced.append(body);
 // Preserve any non-panel UI such as hidden backup file inputs.
 const remainder=document.createElement('div');remainder.className='tr2-data-remaining';
 while(content.firstChild)remainder.append(content.firstChild);
 content.append(prim,advanced,remainder);
}
function cloudView(content){
 const note=document.createElement('section');note.className='card panel tr2-data-overview';
 note.innerHTML='<div><h3>Sincronización y snapshots</h3><p>La descarga remota sustituye datos locales solo tras confirmación. Consulta las copias descargables y la integridad en Datos.</p></div><div>'+
 button('Ir a copias y datos →','trAstraL2Tab',['data'])+'</div>';
 content.prepend(note);
}
function renderConfig(markup){
 if(typeof document==='undefined'||typeof markup!=='string')return markup;
 const frame=safeFrame(markup),root=frame.content,p=plan(),current=tab(),scope=groupFor(current);
 const oldNav=root.querySelector('.config-tabs'),content=root.querySelector('.config-tab-content');
 if(!oldNav||!content)return markup;
 const topbar=root.querySelector('.topbar');
 if(topbar&&scope!=='plan'){
  const reset=[...topbar.querySelectorAll('button')].find(x=>x.textContent.includes('Restaurar estructura base'));
  if(reset)reset.remove();
 }
 const nav=navHeader(scope,current,p);
 oldNav.replaceWith(nav);
 if(current==='taxonomy')taxonomyView(content,p);
 if(current==='visual')galleryView(content,p);
 if(current==='data')dataView(content);
 if(current==='cloud')cloudView(content);
 content.prepend(scopeNotice(scope,current,p));
 return frame.innerHTML;
}
globalThis.TradingResearchAstraLote2=Object.freeze({renderConfig,groups,scopeFor:groupFor});
})();
