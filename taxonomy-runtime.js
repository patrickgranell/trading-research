(()=>{
'use strict';

const TR_TAXONOMY_RUNTIME_VERSION='31.26.0';
const TR_TAXONOMY_SCHEMA=1;
const TR_TAXONOMY_CORE=Object.freeze([
  {id:'setup',name:'Setup',legacyKey:'setup',source:'setups'},
  {id:'vd',name:'VD',legacyKey:'vd',source:'vd'},
  {id:'nr',name:'NR',legacyKey:'nr',source:'nr'},
  {id:'hypothesis',name:'Hipótesis',legacyKey:'hypothesis',source:'hypotheses'},
  {id:'context',name:'Contexto',legacyKey:'h4Context',source:'contextDefinitions'},
  {id:'tradeType',name:'Tipo de operación',legacyKey:'tradeType',source:'tradeTypeDefaults'}
]);

function trTaxNow(){return new Date().toISOString();}
function trTaxCopy(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function trTaxText(v){return String(v??'').trim();}
function trTaxUniq(values){return [...new Set((values||[]).map(trTaxText).filter(Boolean))];}
function trTaxHash(text){
  let h=2166136261;
  for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36);
}
function trTaxStableValueId(taxonomyId,raw){return `TV_${String(taxonomyId).replace(/[^A-Za-z0-9_-]/g,'_')}_${trTaxHash(raw)}`;}
function trTaxCoreSpec(id){return TR_TAXONOMY_CORE.find(x=>x.id===id)||null;}
function trTaxNormalizeValue(tax,value){
  const name=trTaxText(value?.name||value?.legacyValue||'Sin valor');
  const legacyValue=trTaxText(value?.legacyValue||'');
  return {
    id:trTaxText(value?.id)||trTaxStableValueId(tax.id,legacyValue||name),
    name,
    status:value?.status==='archived'?'archived':'active',
    legacyValue,
    aliases:trTaxUniq([...(value?.aliases||[]),legacyValue,name]),
    createdAt:value?.createdAt||trTaxNow(),
    updatedAt:value?.updatedAt||value?.createdAt||trTaxNow()
  };
}
function trTaxNormalizeTaxonomy(tax){
  const spec=trTaxCoreSpec(tax?.id);
  const id=trTaxText(tax?.id);
  return {
    id,
    name:trTaxText(tax?.name)||spec?.name||'Taxonomía',
    kind:spec?'core':'custom',
    legacyKey:spec?.legacyKey||trTaxText(tax?.legacyKey),
    status:tax?.status==='archived'?'archived':'active',
    values:[],
    createdAt:tax?.createdAt||trTaxNow(),
    updatedAt:tax?.updatedAt||tax?.createdAt||trTaxNow()
  };
}
function trTaxSourceEntries(plan,spec){
  if(spec.id==='setup')return (plan.setups||[]).map(x=>({legacyValue:trTaxText(x),name:trTaxText(x)})).filter(x=>x.legacyValue);
  if(spec.id==='vd')return (plan.vd||[]).map(x=>({legacyValue:trTaxText(x),name:trTaxText(x)})).filter(x=>x.legacyValue);
  if(spec.id==='nr')return (plan.nr||[]).map(x=>({legacyValue:trTaxText(x),name:trTaxText(x)})).filter(x=>x.legacyValue);
  if(spec.id==='hypothesis')return (plan.hypotheses||[]).map(x=>({legacyValue:trTaxText(x?.id||x?.name),name:trTaxText(x?.name||x?.id)})).filter(x=>x.legacyValue);
  if(spec.id==='context')return (plan.contextDefinitions||[]).map(x=>({legacyValue:trTaxText(x?.key||x?.name),name:trTaxText(x?.title||x?.key||x?.name)})).filter(x=>x.legacyValue);
  return [];
}
function trTaxValueMatchesRaw(value,raw){
  raw=trTaxText(raw);if(!raw)return false;
  return trTaxText(value?.legacyValue)===raw||trTaxText(value?.name)===raw||(value?.aliases||[]).some(x=>trTaxText(x)===raw);
}
function trTaxSyncCoreValues(plan,tax,spec,isNew){
  const entries=spec.id==='tradeType'&&isNew
    ? ['Rápida','Liquidez','Otra'].map(x=>({legacyValue:x,name:x}))
    : trTaxSourceEntries(plan,spec);
  if(spec.id==='tradeType'&&!isNew)return;
  const seen=new Set();
  for(const entry of entries){
    let value=(tax.values||[]).find(v=>trTaxValueMatchesRaw(v,entry.legacyValue));
    if(!value){
      value=trTaxNormalizeValue(tax,{
        id:trTaxStableValueId(tax.id,entry.legacyValue),
        name:entry.name,
        legacyValue:entry.legacyValue,
        aliases:[entry.legacyValue,entry.name],
        status:'active'
      });
      tax.values.push(value);
    }else{
      if(!value.legacyValue)value.legacyValue=entry.legacyValue;
      value.aliases=trTaxUniq([...(value.aliases||[]),entry.legacyValue,entry.name,value.legacyValue]);
      if(value.name===value.legacyValue||value.name===''||spec.id==='hypothesis')value.name=entry.name||value.name;
    }
    seen.add(value.id);
  }
  if(isNew)return;
  for(const value of tax.values||[]){
    if(!seen.has(value.id)&&value.status==='active')value.status='archived';
  }
}
function ensurePlan(plan){
  if(!plan||typeof plan!=='object')return plan;
  plan.taxonomyRegistry=Array.isArray(plan.taxonomyRegistry)?plan.taxonomyRegistry:[];
  const normalized=[];
  for(const raw of plan.taxonomyRegistry){
    if(!raw||!trTaxText(raw.id)||normalized.some(x=>x.id===trTaxText(raw.id)))continue;
    const tax=trTaxNormalizeTaxonomy(raw);
    tax.values=(Array.isArray(raw.values)?raw.values:[]).map(v=>trTaxNormalizeValue(tax,v));
    normalized.push(tax);
  }
  plan.taxonomyRegistry=normalized;
  for(const spec of TR_TAXONOMY_CORE){
    let tax=plan.taxonomyRegistry.find(x=>x.id===spec.id);
    const isNew=!tax;
    if(!tax){
      tax=trTaxNormalizeTaxonomy({id:spec.id,name:spec.name,kind:'core',legacyKey:spec.legacyKey,status:'active',values:[]});
      plan.taxonomyRegistry.push(tax);
    }
    tax.kind='core';tax.legacyKey=spec.legacyKey;
    tax.values=(tax.values||[]).map(v=>trTaxNormalizeValue(tax,v));
    trTaxSyncCoreValues(plan,tax,spec,isNew);
  }
  plan.taxonomySchema=TR_TAXONOMY_SCHEMA;
  return plan;
}
function taxonomyById(plan,id){ensurePlan(plan);return (plan?.taxonomyRegistry||[]).find(x=>x.id===id)||null;}
function activeTaxonomies(plan){ensurePlan(plan);return (plan?.taxonomyRegistry||[]).filter(x=>x.status!=='archived');}
function valueById(tax,id){return (tax?.values||[]).find(v=>String(v.id)===String(id))||null;}
function operationValue(tax,op){
  if(!tax||!op)return null;
  const explicit=op.taxonomyValues?.[tax.id];
  if(explicit){
    const value=valueById(tax,explicit);
    return value||{id:String(explicit),name:String(explicit),status:'historical',virtual:true,aliases:[],legacyValue:''};
  }
  if(tax.legacyKey){
    const raw=trTaxText(op[tax.legacyKey]);
    if(raw){
      const value=(tax.values||[]).find(v=>trTaxValueMatchesRaw(v,raw));
      if(value)return value;
      return {id:`legacy:${tax.id}:${trTaxHash(raw)}`,name:raw,status:'historical',virtual:true,aliases:[raw],legacyValue:raw};
    }
  }
  return null;
}
function resolveOperationValueId(op,tax){return operationValue(tax,op)?.id||'';}
function operationValueLabel(op,tax){return operationValue(tax,op)?.name||'';}
function matchesFilters(op,plan,filters={}){
  ensurePlan(plan);
  for(const [taxId,expected] of Object.entries(filters||{})){
    if(expected===undefined||expected===null||String(expected)==='')continue;
    const tax=taxonomyById(plan,taxId);if(!tax)return false;
    if(String(resolveOperationValueId(op,tax))!==String(expected))return false;
  }
  return true;
}
function trTaxPlanOperations(plan,operations){return (operations||[]).filter(o=>!plan?.id||!o?.tradingPlanId||o.tradingPlanId===plan.id);}
function trTaxTaxonomyReferenced(plan,tax,operations){
  if(!tax)return false;
  return trTaxPlanOperations(plan,operations).some(o=>{
    if(o?.taxonomyValues&&Object.prototype.hasOwnProperty.call(o.taxonomyValues,tax.id)&&o.taxonomyValues[tax.id])return true;
    if(tax.legacyKey&&trTaxText(o?.[tax.legacyKey])){
      const raw=trTaxText(o[tax.legacyKey]);
      return (tax.values||[]).some(v=>trTaxValueMatchesRaw(v,raw))||tax.kind==='core';
    }
    return false;
  });
}
function trTaxValueReferenced(plan,tax,value,operations){
  return trTaxPlanOperations(plan,operations).some(o=>{
    if(String(o?.taxonomyValues?.[tax.id]||'')===String(value.id))return true;
    return !!(tax.legacyKey&&trTaxText(o?.[tax.legacyKey])&&trTaxValueMatchesRaw(value,o[tax.legacyKey]));
  });
}
function canDeleteTaxonomy(plan,id,operations=[]){
  const tax=taxonomyById(plan,id);if(!tax||tax.kind==='core')return false;
  return !trTaxTaxonomyReferenced(plan,tax,operations);
}
function deleteTaxonomy(plan,id,operations=[]){
  if(!canDeleteTaxonomy(plan,id,operations))return false;
  plan.taxonomyRegistry=(plan.taxonomyRegistry||[]).filter(x=>x.id!==id);return true;
}
function createTaxonomy(plan,{id,name}={}){
  ensurePlan(plan);id=trTaxText(id)||`TX_${trTaxHash(`${name||'tax'}:${trTaxNow()}`)}`;name=trTaxText(name);
  if(!name||taxonomyById(plan,id)||(plan.taxonomyRegistry||[]).some(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return null;
  const tax=trTaxNormalizeTaxonomy({id,name,kind:'custom',status:'active',values:[]});
  plan.taxonomyRegistry.push(tax);return tax;
}
function trTaxReplaceArrayValue(arr,oldValue,newValue){
  if(!Array.isArray(arr))return;
  for(let i=0;i<arr.length;i++)if(trTaxText(arr[i])===oldValue)arr[i]=newValue;
}
function trTaxUpdateVisualKeys(plan,kind,oldValue,newValue){
  for(const r of plan.visualReferences||[])if(r?.kind===kind&&trTaxText(r.key)===oldValue)r.key=newValue;
}
function trTaxRenameCoreSource(plan,tax,value,newName){
  const oldLegacy=trTaxText(value.legacyValue||value.name);
  if(tax.id==='setup'){
    trTaxReplaceArrayValue(plan.setups,oldLegacy,newName);
    for(const d of plan.setupDefinitions||[])if(trTaxText(d.key)===oldLegacy){d.key=newName;if(!d.title||d.title===oldLegacy)d.title=newName;}
    trTaxUpdateVisualKeys(plan,'setup',oldLegacy,newName);
    value.legacyValue=newName;
  }else if(tax.id==='vd'){
    trTaxReplaceArrayValue(plan.vd,oldLegacy,newName);
    for(const d of plan.vdDefinitions||[])if(trTaxText(d.key)===oldLegacy){d.key=newName;if(!d.title||d.title===oldLegacy)d.title=newName;}
    trTaxUpdateVisualKeys(plan,'vd',oldLegacy,newName);
    value.legacyValue=newName;
  }else if(tax.id==='nr'){
    trTaxReplaceArrayValue(plan.nr,oldLegacy,newName);trTaxUpdateVisualKeys(plan,'nr',oldLegacy,newName);value.legacyValue=newName;
  }else if(tax.id==='context'){
    for(const d of plan.contextDefinitions||[])if(trTaxText(d.key)===oldLegacy){d.key=newName;if(!d.title||d.title===oldLegacy)d.title=newName;}
    trTaxUpdateVisualKeys(plan,'context',oldLegacy,newName);value.legacyValue=newName;
  }else if(tax.id==='hypothesis'){
    const h=(plan.hypotheses||[]).find(x=>trTaxText(x?.id||x?.name)===oldLegacy);if(h)h.name=newName;
  }else if(tax.id==='tradeType')value.legacyValue=newName;
}
function renameTaxonomy(plan,id,newName){
  const tax=taxonomyById(plan,id);newName=trTaxText(newName);if(!tax||!newName)return false;
  if((plan.taxonomyRegistry||[]).some(t=>t.id!==id&&t.name.toLocaleLowerCase()===newName.toLocaleLowerCase()))return false;
  tax.name=newName;tax.updatedAt=trTaxNow();return true;
}
function renameValue(plan,taxId,valueId,newName){
  const tax=taxonomyById(plan,taxId),value=valueById(tax,valueId);newName=trTaxText(newName);
  if(!tax||!value||!newName)return false;
  if((tax.values||[]).some(v=>v.id!==value.id&&v.name.toLocaleLowerCase()===newName.toLocaleLowerCase()))return false;
  const oldName=value.name,oldLegacy=value.legacyValue;
  value.aliases=trTaxUniq([...(value.aliases||[]),oldName,oldLegacy]);
  if(tax.kind==='core')trTaxRenameCoreSource(plan,tax,value,newName);
  value.name=newName;value.aliases=trTaxUniq([...(value.aliases||[]),newName,value.legacyValue]);value.updatedAt=trTaxNow();tax.updatedAt=value.updatedAt;
  return true;
}
function trTaxAppendCoreSource(plan,tax,value){
  const name=value.name,legacy=value.legacyValue||name;
  if(tax.id==='setup'){plan.setups=trTaxUniq([...(plan.setups||[]),legacy]);}
  else if(tax.id==='vd'){plan.vd=trTaxUniq([...(plan.vd||[]),legacy]);}
  else if(tax.id==='nr'){plan.nr=trTaxUniq([...(plan.nr||[]),legacy]);}
  else if(tax.id==='hypothesis'){
    plan.hypotheses=Array.isArray(plan.hypotheses)?plan.hypotheses:[];
    if(!plan.hypotheses.some(h=>trTaxText(h?.id||h?.name)===legacy))plan.hypotheses.push({id:legacy,name,description:''});
  }else if(tax.id==='context'){
    plan.contextDefinitions=Array.isArray(plan.contextDefinitions)?plan.contextDefinitions:[];
    if(!plan.contextDefinitions.some(d=>trTaxText(d?.key||d?.name)===legacy))plan.contextDefinitions.push({id:`CTX_${trTaxHash(legacy)}`,key:legacy,title:name,description:'',specs:'',timeframes:[],images:[],updatedAt:trTaxNow()});
  }
}
function addValue(plan,taxId,{id,name,legacyValue}={}){
  const tax=taxonomyById(plan,taxId);name=trTaxText(name);if(!tax||!name)return null;
  if((tax.values||[]).some(v=>v.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return null;
  let legacy=trTaxText(legacyValue);
  if(tax.kind==='core'){
    if(tax.id==='hypothesis')legacy=legacy||`H_${trTaxHash(`${id||name}:${trTaxNow()}`)}`;
    else legacy=legacy||name;
  }
  const value=trTaxNormalizeValue(tax,{id:trTaxText(id)||trTaxStableValueId(tax.id,legacy||`${name}:${trTaxNow()}`),name,legacyValue:legacy,aliases:[legacy,name],status:'active'});
  tax.values.push(value);tax.updatedAt=trTaxNow();if(tax.kind==='core')trTaxAppendCoreSource(plan,tax,value);return value;
}
function archiveTaxonomy(plan,id,archived=true){const tax=taxonomyById(plan,id);if(!tax)return false;tax.status=archived?'archived':'active';tax.updatedAt=trTaxNow();return true;}
function archiveValue(plan,taxId,valueId,archived=true){const tax=taxonomyById(plan,taxId),value=valueById(tax,valueId);if(!value)return false;value.status=archived?'archived':'active';value.updatedAt=trTaxNow();tax.updatedAt=value.updatedAt;return true;}
function canDeleteValue(plan,taxId,valueId,operations=[]){const tax=taxonomyById(plan,taxId),value=valueById(tax,valueId);if(!tax||!value||tax.kind==='core')return false;return !trTaxValueReferenced(plan,tax,value,operations);}
function deleteValue(plan,taxId,valueId,operations=[]){
  const tax=taxonomyById(plan,taxId),value=valueById(tax,valueId);if(!tax||!value||!canDeleteValue(plan,taxId,valueId,operations))return false;
  tax.values=tax.values.filter(v=>v.id!==valueId);tax.updatedAt=trTaxNow();return true;
}
function filterOptions(plan,tax,operations=[]){
  ensurePlan(plan);const map=new Map();
  for(const value of tax?.values||[])if(value.status!=='archived')map.set(value.id,{...value});
  for(const op of trTaxPlanOperations(plan,operations)){
    const value=operationValue(tax,op);if(value&&!map.has(value.id))map.set(value.id,{...value});
  }
  return [...map.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'es',{numeric:true}));
}

const api=Object.freeze({
  version:TR_TAXONOMY_RUNTIME_VERSION,schema:TR_TAXONOMY_SCHEMA,core:TR_TAXONOMY_CORE,
  ensurePlan,taxonomyById,activeTaxonomies,valueById,operationValue,resolveOperationValueId,operationValueLabel,matchesFilters,
  createTaxonomy,renameTaxonomy,renameValue,addValue,archiveTaxonomy,archiveValue,
  canDeleteTaxonomy,deleteTaxonomy,canDeleteValue,deleteValue,filterOptions
});
globalThis.TradingResearchTaxonomyDomain=api;

if(typeof window==='undefined'||!window.document)return;

/* ---------- Browser integration ---------- */
const registry=window.TradingResearchActions&&typeof window.TradingResearchActions==='object'
  ? window.TradingResearchActions
  : (window.TradingResearchActions=Object.create(null));
const domain=globalThis.TradingResearchStores?.domain;

function trTaxCommit(label,fn,{render:trueRender=true}={}){
  if(domain?.commit)return domain.commit(label,fn,{persist:true,render:trueRender});
  const out=fn();if(typeof persist==='function')persist();if(trueRender&&typeof render==='function')render();return out;
}
function trTaxCurrentPlan(){return typeof getCurrentPlan==='function'?getCurrentPlan():null;}
function trTaxOpsForPlan(p){return (state?.operations||[]).filter(o=>!p?.id||o.tradingPlanId===p.id);}
function trTaxEsc(value){return typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* Close taxonomy schema as part of every existing plan normalization without
 * replacing the legacy Setup/VD/Context rich-definition machinery. */
const trTaxEnsurePlanV8Base=typeof ensurePlanV8Structure==='function'?ensurePlanV8Structure:null;
if(trTaxEnsurePlanV8Base){
  ensurePlanV8Structure=function(p){const out=trTaxEnsurePlanV8Base(p);api.ensurePlan(out);return out;};
}
const trTaxMakeBlankPlanBase=typeof makeBlankPlan==='function'?makeBlankPlan:null;
if(trTaxMakeBlankPlanBase){
  makeBlankPlan=function(meta={}){const p=trTaxMakeBlankPlanBase(meta);api.ensurePlan(p);return p;};
}
const trTaxNormalizePlanBase=typeof normalizePlan==='function'?normalizePlan:null;
if(trTaxNormalizePlanBase){
  normalizePlan=function(p,instruments){const out=trTaxNormalizePlanBase(p,instruments);api.ensurePlan(out);return out;};
}

if(domain?.commit&&Array.isArray(state?.tradingPlans)){
  domain.commit('taxonomy.schema.ensure',()=>{for(const p of state.tradingPlans)api.ensurePlan(p);},{persist:true,render:false});
}else if(Array.isArray(state?.tradingPlans)){
  for(const p of state.tradingPlans)api.ensurePlan(p);
}

/* ---------- Config UI ---------- */
function trTaxManagerPanel(p){
  api.ensurePlan(p);
  const cards=(p.taxonomyRegistry||[]).map(t=>{
    const active=(t.values||[]).filter(v=>v.status!=='archived').length;
    return `<div class="config-row"><div class="config-main"><div class="config-name">${trTaxEsc(t.name)} <span class="badge">${t.kind==='core'?'Core':'Personalizada'}</span> ${t.status==='archived'?'<span class="badge">Archivada</span>':''}</div><div class="config-meta">${active} valor(es) activos · ${(t.values||[]).length} totales · ID ${trTaxEsc(t.id)}</div></div><div class="actions"><button class="btn small" data-taxonomy-id="${trTaxEsc(t.id)}" data-tr-onclick="trTaxOpenEditor(this.dataset.taxonomyId)">Editar</button><button class="btn small" data-taxonomy-id="${trTaxEsc(t.id)}" data-tr-onclick="trTaxToggleTaxonomy(this.dataset.taxonomyId)">${t.status==='archived'?'Reactivar':'Archivar'}</button>${t.kind==='custom'?`<button class="btn small danger" data-taxonomy-id="${trTaxEsc(t.id)}" data-tr-onclick="trTaxDeleteTaxonomy(this.dataset.taxonomyId)">Borrar</button>`:''}</div></div>`;
  }).join('');
  return `<section class="card panel config-wide"><div class="panel-title"><div><h3>Taxonomías del Trading Plan</h3><div class="help">Cada taxonomía activa se convierte automáticamente en campo de clasificación de la operación, filtro de Operaciones/Laboratorio y dimensión analítica. Archivar oculta uso futuro sin borrar histórico.</div></div><button class="btn primary small" data-tr-onclick="trTaxCreateTaxonomy()">+ Nueva taxonomía</button></div><div class="config-list">${cards||'<div class="empty">Sin taxonomías.</div>'}</div><div class="notice"><strong>Histórico protegido:</strong> renombrar conserva aliases de los valores antiguos. Las taxonomías y valores core se retiran mediante archivo; el borrado definitivo solo se permite en elementos personalizados sin referencias históricas.</div></section>`;
}
const trTaxConfigPanelBase=typeof configTaxonomyPanel==='function'?configTaxonomyPanel:null;
if(trTaxConfigPanelBase){
  configTaxonomyPanel=function(p){return `<div class="taxonomy-layout">${trTaxManagerPanel(p)}<section class="card panel config-wide"><div class="panel-title"><div><h3>Fichas técnicas especializadas</h3><div class="help">Setup, VD y Contexto conservan sus descripciones, timeframes e imágenes. El dominio genérico superior controla su clasificación y análisis.</div></div></div></section>${trTaxConfigPanelBase(p)}</div>`;};
}
function trTaxCreateTaxonomy(){
  const p=trTaxCurrentPlan();if(!p)return;
  const name=trTaxText(prompt('Nombre de la nueva taxonomía (ej.: Confirmación, Tipo de pivote):',''));if(!name)return;
  trTaxCommit('taxonomy.create',()=>{
    const tax=api.createTaxonomy(p,{id:typeof uid==='function'?uid('TX'):undefined,name});
    if(!tax)return alert('Ya existe una taxonomía con ese nombre.');
    p.updatedAt=trTaxNow();
  });
}
function trTaxOpenEditor(id){
  const p=trTaxCurrentPlan(),tax=api.taxonomyById(p,id);if(!tax)return;
  const values=(tax.values||[]).map(v=>`<div class="config-row"><div class="config-main"><label class="field"><span>Valor</span><input class="input" data-tax-value-name="${trTaxEsc(v.id)}" value="${trTaxEsc(v.name)}"></label><div class="config-meta">ID ${trTaxEsc(v.id)}${v.status==='archived'?' · archivado':''}</div></div><div class="actions"><button type="button" class="btn small" data-taxonomy-id="${trTaxEsc(tax.id)}" data-tax-value-id="${trTaxEsc(v.id)}" data-tr-onclick="trTaxToggleValue(this.dataset.taxonomyId,this.dataset.taxValueId)">${v.status==='archived'?'Reactivar':'Archivar'}</button>${tax.kind==='custom'?`<button type="button" class="btn small danger" data-taxonomy-id="${trTaxEsc(tax.id)}" data-tax-value-id="${trTaxEsc(v.id)}" data-tr-onclick="trTaxDeleteValue(this.dataset.taxonomyId,this.dataset.taxValueId)">Borrar</button>`:''}</div></div>`).join('');
  const body=`<form id="trTaxEditorForm" data-tr-onsubmit="return false"><div class="form-section"><div class="form-grid"><label class="field span2"><span>Nombre de la taxonomía</span><input id="trTaxonomyName" class="input" value="${trTaxEsc(tax.name)}"></label></div></div><div class="form-section"><div class="panel-title"><div><h3>Valores</h3><small>Archivar conserva las operaciones históricas.</small></div><button type="button" class="btn small" data-taxonomy-id="${trTaxEsc(tax.id)}" data-tr-onclick="trTaxAddValue(this.dataset.taxonomyId)">+ Añadir valor</button></div><div class="config-list">${values||'<div class="empty">Sin valores. Añade el primero para poder clasificar operaciones.</div>'}</div></div></form>`;
  document.body.insertAdjacentHTML('beforeend',modalShell(`Taxonomía · ${trTaxEsc(tax.name)}`,body,`<button class="btn" data-tr-onclick="closeModal()">Cancelar</button><button class="btn primary" data-taxonomy-id="${trTaxEsc(tax.id)}" data-tr-onclick="trTaxSaveEditor(this.dataset.taxonomyId)">Guardar</button>`));
}
function trTaxSaveEditor(id){
  const p=trTaxCurrentPlan(),tax=api.taxonomyById(p,id);if(!tax)return;
  const name=trTaxText(document.getElementById('trTaxonomyName')?.value);
  const rows=[...document.querySelectorAll('[data-tax-value-name]')].map(el=>({id:el.dataset.taxValueName,name:trTaxText(el.value)}));
  trTaxCommit('taxonomy.update',()=>{
    if(name&&!api.renameTaxonomy(p,id,name))return alert('No se pudo renombrar: comprueba que el nombre no esté repetido.');
    for(const row of rows)if(row.name&&!api.renameValue(p,id,row.id,row.name))alert(`No se pudo renombrar el valor “${row.name}”; puede estar repetido.`);
    p.updatedAt=trTaxNow();closeModal();
  });
}
function trTaxAddValue(id){
  const p=trTaxCurrentPlan(),tax=api.taxonomyById(p,id);if(!tax)return;
  const name=trTaxText(prompt(`Nuevo valor para “${tax.name}”:`,''));if(!name)return;
  trTaxCommit('taxonomy.value.create',()=>{
    const legacyValue=tax.id==='hypothesis'?(typeof uid==='function'?uid('H'):undefined):undefined;
    const value=api.addValue(p,id,{id:typeof uid==='function'?uid('TV'):undefined,name,legacyValue});
    if(!value)return alert('Ese valor ya existe.');
    p.updatedAt=trTaxNow();closeModal();setTimeout(()=>trTaxOpenEditor(id),0);
  });
}
function trTaxToggleTaxonomy(id){
  const p=trTaxCurrentPlan(),tax=api.taxonomyById(p,id);if(!tax)return;
  const archive=tax.status!=='archived';
  if(archive&&!confirm(`¿Archivar “${tax.name}”? Dejará de aparecer en nuevas operaciones y filtros activos, pero el histórico se conservará.`))return;
  trTaxCommit('taxonomy.archive',()=>{api.archiveTaxonomy(p,id,archive);p.updatedAt=trTaxNow();});
}
function trTaxDeleteTaxonomy(id){
  const p=trTaxCurrentPlan(),tax=api.taxonomyById(p,id);if(!tax)return;
  const ops=trTaxOpsForPlan(p);
  if(!api.canDeleteTaxonomy(p,id,ops))return alert('No se puede borrar definitivamente: esta taxonomía es core o todavía está referenciada por operaciones. Archívala en su lugar.');
  if(!confirm(`¿Borrar definitivamente la taxonomía “${tax.name}”? Solo se permite porque no tiene referencias históricas.`))return;
  trTaxCommit('taxonomy.delete',()=>{api.deleteTaxonomy(p,id,ops);p.updatedAt=trTaxNow();});
}
function trTaxToggleValue(taxId,valueId){
  const p=trTaxCurrentPlan(),tax=api.taxonomyById(p,taxId),value=api.valueById(tax,valueId);if(!value)return;
  const archive=value.status!=='archived';
  trTaxCommit('taxonomy.value.archive',()=>{api.archiveValue(p,taxId,valueId,archive);p.updatedAt=trTaxNow();closeModal();setTimeout(()=>trTaxOpenEditor(taxId),0);});
}
function trTaxDeleteValue(taxId,valueId){
  const p=trTaxCurrentPlan(),tax=api.taxonomyById(p,taxId),value=api.valueById(tax,valueId);if(!value)return;
  const ops=trTaxOpsForPlan(p);
  if(!api.canDeleteValue(p,taxId,valueId,ops))return alert(tax.kind==='core'?'Los valores core se retiran mediante Archivo para conservar fichas y compatibilidad histórica.':'Ese valor ya está usado por el histórico. Archívalo para retirarlo sin destruir la clasificación registrada.');
  if(!confirm(`¿Borrar definitivamente “${value.name}”? No hay operaciones que lo referencien.`))return;
  trTaxCommit('taxonomy.value.delete',()=>{api.deleteValue(p,taxId,valueId,ops);p.updatedAt=trTaxNow();closeModal();setTimeout(()=>trTaxOpenEditor(taxId),0);});
}

/* ---------- Operation editor / durable classification ---------- */
function trTaxOperationSelect(tax,o,p){
  const ops=trTaxOpsForPlan(p),selected=api.resolveOperationValueId(o||{},tax);
  const values=api.filterOptions(p,tax,ops);
  const current=selected?api.operationValue(tax,o||{}):null;
  if(current&&!values.some(v=>v.id===current.id))values.unshift(current);
  const active=values.filter(v=>v.status!=='archived'||v.id===selected);
  const defaultValue=selected||(tax.kind==='core'?active.find(v=>v.status!=='archived')?.id:'')||'';
  const options=[`<option value="">Sin clasificar</option>`,...active.map(v=>`<option value="${trTaxEsc(v.id)}" ${String(v.id)===String(defaultValue)?'selected':''}>${trTaxEsc(v.name)}${v.status==='archived'?' · archivado':''}</option>`)].join('');
  return `<label class="field"><span>${trTaxEsc(tax.name)}</span><select id="f-tx_${trTaxEsc(tax.id)}" name="tx_${trTaxEsc(tax.id)}" class="select">${options}</select></label>`;
}
function trTaxOperationFields(o,p){api.ensurePlan(p);return api.activeTaxonomies(p).map(t=>trTaxOperationSelect(t,o,p)).join('');}
const trTaxOperationFormBase=typeof operationForm==='function'?operationForm:null;
if(trTaxOperationFormBase){
  operationForm=function(o,r,p){
    ensurePlanV8Structure(p);
    const v=(k,d='')=>trTaxEsc(o?.[k]??d),riskOptions=p.riskStrategies.filter(x=>x.active||x.id===o?.riskStrategyId).map(x=>({value:x.id,label:x.name}));
    return `<form id="operationForm" data-tr-onsubmit="return false"><div class="form-section"><h4>0 · Trading Plan</h4><div class="plan-readonly"><strong>${trTaxEsc(planLabel(p))}</strong><span>${trTaxEsc(p.description||'Sin descripción')}</span></div></div><div class="form-section"><h4>1 · Sesión y régimen</h4><div class="form-grid">${field('Fecha/hora de entrada','entryDate','datetime-local',v('entryDate',new Date().toISOString().slice(0,16)))}${field('Fecha/hora de salida','exitDate','datetime-local',v('exitDate',''))}${selectField('Muestra','sample',['A','B'],v('sample','B'))}${selectObjField('Régimen de gestión','riskStrategyId',riskOptions,o?.riskStrategyId||r?.id,`data-tr-onchange="applyRiskToOperation(true)"`)}${field('ATR observado (opcional)','atr','number',v('atr',''),'','step="any"')}${selectField('Fase H4','h4Phase',['Impulso','Retroceso','No definida'],v('h4Phase','Impulso'))}</div><div id="opRiskPreview" class="strategy-preview"></div></div><div class="form-section"><h4>2 · Clasificación de la oportunidad</h4><div class="form-grid">${trTaxOperationFields(o,p)}${selectField('Dirección','direction',['LONG','SHORT'],v('direction','LONG'))}${field('Timeframe','timeframe','text',v('timeframe','5M'))}${field('Precio dinámico / objetivo','dtPrice','number',v('dtPrice',''),'','step="any"')}${field('Notas','notes','textarea',v('notes',''),'full')}</div></div><div class="form-section"><h4>3 · Ejecución y resultado</h4><div class="form-grid">${field('Contrato / vencimiento','contract','text',v('contract',getInstrument(r?.instrumentId)?.symbol||''))}${field('Contratos totales','contracts','number',v('contracts',riskCalc(r).contracts),'','readonly')}${selectField('Tipo de entrada','entryType',['LMT','STP'],v('entryType','LMT'))}${field('Precio de entrada','entryPrice','number',v('entryPrice',''),'','step="any"')}${field('Ticks resultado agregados','resultTicks','number',v('resultTicks',''),'','step="any" data-tr-oninput="recalcOperation()"')}${field('Comisiones','commission','number',v('commission',''),'','readonly step="any"')}${field('P&L bruto','pnlGross','number',v('pnlGross',''),'','readonly step="any"')}${field('P&L neto','pnlNet','number',v('pnlNet',''),'','readonly step="any"')}${field('R múltiple bruta','rMultiple','number',v('rMultiple',''),'','readonly step="any"')}${field('MFE (R)','mfe','number',v('mfe',''),'','step="any"')}${field('MAE (R)','mae','number',v('mae',''),'','step="any"')}${selectField('Disciplina','discipline',['Sí','No'],v('discipline','Sí'))}${field('Motivo de indisciplina','disciplineReason','text',v('disciplineReason',''),'span2')}<div class="field span2"><label>Nuevas capturas</label><input id="screens" name="screens" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="image-upload-meta"><select id="screenCategory" name="screenCategory" class="select">${imageLabelOptions('Contexto')}</select><input id="screenCaption" name="screenCaption" class="input" placeholder="Nota común para estas imágenes (opcional)"></div><div class="help">Puedes añadir varias imágenes. Se guardan localmente en IndexedDB hasta conectar Supabase.</div>${o?.images?.length?`<div class="existing-images"><span>${o.images.length} imagen(es) ya asociadas</span><div class="thumb-strip">${o.images.map(x=>imageThumb(x,'mini')).join('')}</div></div>`:''}</div></div><div class="notice">La R mostrada aquí es bruta: relación entre ticks obtenidos y riesgo inicial. Las comisiones se conservan separadas para las métricas netas.</div></div></form>`;
  };
}

async function trTaxSaveOperationCore(){
  const p=trTaxCurrentPlan(),form=document.getElementById('operationForm'),fd=formDataFrom(form),get=n=>formDataValue(fd,n),risk=getRisk(get('riskStrategyId'),p),c=riskCalc(risk),inst=c.inst,resultTicksRaw=String(get('resultTicks')??'').trim(),hasResult=resultTicksRaw!=='',ticks=hasResult?Number(resultTicksRaw):null;
  if(hasResult&&!Number.isFinite(ticks))return alert('El resultado en ticks no es un número válido.');
  const gross=hasResult?ticks*(Number(inst?.tickValue)||0):null,commission=c.commission,net=hasResult?gross-commission:null,rMultiple=hasResult&&c.riskTickExposure?ticks/c.riskTickExposure:null,result=hasResult?(ticks>0?'win':ticks<0?'loss':'pending'):'pending',previous=state.operations.find(x=>x.id===(editingId||'')),images=trTaxCopy(previous?.images||[]);
  const files=fd?[...fd.getAll('screens')].filter(x=>typeof File!=='undefined'&&x instanceof File&&x.size):[...(document.getElementById('screens')?.files||[])],label=formDataValue(fd,'screenCategory','Contexto')||'Contexto',caption=formDataValue(fd,'screenCaption','').trim();
  for(const file of files){const id=uid('IMG');await storeImageFile(file,id);images.push({id,label,caption:caption||file.name,name:file.name,type:file.type,createdAt:trTaxNow()});}
  api.ensurePlan(p);
  const taxonomyValues=trTaxCopy(previous?.taxonomyValues||{});
  const legacy={hypothesis:previous?.hypothesis||'',h4Context:previous?.h4Context||'',setup:previous?.setup||'',vd:previous?.vd||'',nr:previous?.nr||'',tradeType:previous?.tradeType||''};
  for(const tax of api.activeTaxonomies(p)){
    const selected=trTaxText(get(`tx_${tax.id}`));
    if(!selected){delete taxonomyValues[tax.id];if(tax.legacyKey)legacy[tax.legacyKey]='';continue;}
    const value=api.valueById(tax,selected);
    if(value){
      taxonomyValues[tax.id]=value.id;
      if(tax.legacyKey){
        const same=previous&&api.resolveOperationValueId(previous,tax)===value.id&&trTaxText(previous[tax.legacyKey]);
        legacy[tax.legacyKey]=same?previous[tax.legacyKey]:(value.legacyValue||value.name);
      }
    }else if(selected.startsWith('legacy:')){
      delete taxonomyValues[tax.id];
    }else taxonomyValues[tax.id]=selected;
  }
  const op={id:editingId||uid('op'),tradingPlanId:p.id,tradingPlanName:p.name,tradingPlanVersion:p.version,tradingPlanSnapshot:planSnapshot(p),entryDate:get('entryDate'),exitDate:get('exitDate'),sample:get('sample'),riskStrategyId:risk?.id||'',riskStrategyName:risk?.name||'',strategyPlanSnapshot:strategySnapshot(risk),instrumentId:inst?.id||'',instrumentSnapshot:instrumentSnapshot(inst),atr:Number(get('atr')||0)||null,hypothesis:legacy.hypothesis,h4Context:legacy.h4Context,h4Phase:get('h4Phase'),setup:legacy.setup,vd:legacy.vd,nr:legacy.nr,tradeType:legacy.tradeType,taxonomyValues,direction:get('direction'),timeframe:get('timeframe'),dtPrice:Number(get('dtPrice')||0)||null,notes:get('notes'),contract:get('contract'),contracts:c.contracts,entryType:get('entryType'),entryPrice:Number(get('entryPrice')||0)||null,resultTicks:ticks,riskTickExposure:c.riskTickExposure,riskUsd:c.riskUsd,pnlGross:gross,commission,pnlNet:net,mfe:Number(get('mfe')||0)||0,mae:Number(get('mae')||0)||0,discipline:get('discipline')==='Sí',disciplineReason:get('disciplineReason'),result,rMultiple,emotional:trTaxCopy(previous?.emotional||{}),images,raw:previous?.raw||{source:'manual'},updatedAt:trTaxNow()};
  const idx=state.operations.findIndex(x=>x.id===op.id);if(idx>=0)state.operations[idx]=op;else state.operations.push(op);persist();closeModal();render();
}
saveOperationFromForm=function(){
  if(domain?.command)return domain.command(editingId?'operation.update':'operation.create',()=>trTaxSaveOperationCore(),{persist:true,render:true});
  return trTaxSaveOperationCore();
};

/* ---------- Shared dynamic filters ---------- */
function trTaxCollectFilterMap(selector){
  const out={};for(const el of document.querySelectorAll(selector)){const id=el.dataset.taxonomyId||'';if(id)out[id]=el.value||'';}return out;
}
function trTaxStripLegacyFilters(html,ids){
  for(const id of ids){
    const re=new RegExp(`<label class="filter-field"><span>[^<]*<\\/span><select id="${id}"[\\s\\S]*?<\\/select><\\/label>`,'g');
    html=html.replace(re,'');
  }
  return html;
}
function trTaxFilterFields(p,ops,current={},target='ops'){
  api.ensurePlan(p);
  return api.activeTaxonomies(p).map(t=>{
    const values=api.filterOptions(p,t,ops),id=`trTax${target==='ops'?'Ops':'Lab'}_${t.id}`;
    const options=`<option value="">Todos</option>${values.map(v=>`<option value="${trTaxEsc(v.id)}" ${String(current?.[t.id]||'')===String(v.id)?'selected':''}>${trTaxEsc(v.name)}${v.status==='archived'?' · archivado':''}</option>`).join('')}`;
    if(target==='ops')return `<label class="filter-field"><span>${trTaxEsc(t.name)}</span><select id="${trTaxEsc(id)}" data-taxonomy-id="${trTaxEsc(t.id)}" data-tax-filter-ops="1" class="select" data-tr-onchange="filterOperations()">${options}</select></label>`;
    return `<label class="filter-field"><span>${trTaxEsc(t.name)}</span><select id="${trTaxEsc(id)}" data-taxonomy-id="${trTaxEsc(t.id)}" data-tax-filter-lab="1" class="select" data-tr-onchange="labReadFilters()">${options}</select></label>`;
  }).join('');
}
if(typeof opsViewState!=='undefined')opsViewState.taxonomyFilters=opsViewState.taxonomyFilters&&typeof opsViewState.taxonomyFilters==='object'?opsViewState.taxonomyFilters:{};
if(typeof labState!=='undefined')labState.taxonomyFilters=labState.taxonomyFilters&&typeof labState.taxonomyFilters==='object'?labState.taxonomyFilters:{};

const trTaxReadOpsFiltersBase=typeof readOpsFilters==='function'?readOpsFilters:null;
if(trTaxReadOpsFiltersBase){
  readOpsFilters=function(){trTaxReadOpsFiltersBase();opsViewState.taxonomyFilters=trTaxCollectFilterMap('[data-tax-filter-ops]');};
}
const trTaxBaseFilteredOpsBase=typeof baseFilteredOps==='function'?baseFilteredOps:null;
if(trTaxBaseFilteredOpsBase){
  baseFilteredOps=function(f=opsViewState,ops=currentOps(),blockMap=opBlockMap()){
    const base=trTaxBaseFilteredOpsBase(f,ops,blockMap);
    const filters=f?.taxonomyFilters||{};
    return base.filter(o=>api.matchesFilters(o,typeof getPlan==='function'?getPlan(o.tradingPlanId):trTaxCurrentPlan(),filters));
  };
}
const trTaxOperationsFilterPanelBase=typeof operationsFilterPanel==='function'?operationsFilterPanel:null;
if(trTaxOperationsFilterPanelBase){
  operationsFilterPanel=function(){
    const p=trTaxCurrentPlan(),ops=currentOps();let html=trTaxOperationsFilterPanelBase();
    html=trTaxStripLegacyFilters(html,['filterSetup','filterVD','filterNR','filterHypothesis']);
    const dynamic=trTaxFilterFields(p,ops,opsViewState.taxonomyFilters,'ops');
    return html.replace('</div><div class="day-filter-row">',`${dynamic}</div><div class="day-filter-row">`);
  };
}
const trTaxResetOpsBase=typeof resetOpsFilters==='function'?resetOpsFilters:null;
if(trTaxResetOpsBase){resetOpsFilters=function(){opsViewState.taxonomyFilters={};return trTaxResetOpsBase();};}

const trTaxLabStudyDefaultBase=typeof labStudyDefaultState==='function'?labStudyDefaultState:null;
if(trTaxLabStudyDefaultBase){
  labStudyDefaultState=function(){return {...trTaxLabStudyDefaultBase(),taxonomyFilters:{}};};
}
const trTaxLabReadBase=typeof labReadFilters==='function'?labReadFilters:null;
if(trTaxLabReadBase){
  labReadFilters=function(){labState.taxonomyFilters=trTaxCollectFilterMap('[data-tax-filter-lab]');return trTaxLabReadBase();};
}
const trTaxLabFilterPanelBase=typeof labFilterPanel==='function'?labFilterPanel:null;
if(trTaxLabFilterPanelBase){
  labFilterPanel=function(){
    const p=trTaxCurrentPlan(),ops=currentOps();let html=trTaxLabFilterPanelBase();
    html=trTaxStripLegacyFilters(html,['labSetup','labVD','labNR','labHypothesis','labContext']);
    const dynamic=trTaxFilterFields(p,ops,labState.taxonomyFilters,'lab');
    return html.replace('</div><div class="day-filter-row">',`${dynamic}</div><div class="day-filter-row">`);
  };
}
const trTaxLabResetBase=typeof labReset==='function'?labReset:null;
if(trTaxLabResetBase){labReset=function(){labState.taxonomyFilters={};return trTaxLabResetBase();};}

/* ---------- Dynamic analytical breakdown ---------- */
const trTaxDimensionItemBase=typeof dimensionItem==='function'?dimensionItem:null;
if(trTaxDimensionItemBase){
  dimensionItem=function(o,dim){
    if(String(dim).startsWith('tax:')){
      const taxId=String(dim).slice(4),p=typeof getPlan==='function'?getPlan(o.tradingPlanId):trTaxCurrentPlan(),tax=api.taxonomyById(p,taxId),value=api.operationValue(tax,o);
      return {key:value?.id||'',label:value?.name||`Sin ${tax?.name||'clasificar'}`};
    }
    return trTaxDimensionItemBase(o,dim);
  };
}
const trTaxOpsDimValueBase=typeof opsDimensionFilterValue==='function'?opsDimensionFilterValue:null;
if(trTaxOpsDimValueBase){
  opsDimensionFilterValue=function(dim){if(String(dim).startsWith('tax:'))return opsViewState.taxonomyFilters?.[String(dim).slice(4)]||'';return trTaxOpsDimValueBase(dim);};
}
const trTaxApplyDimBase=typeof applyDimensionFilter==='function'?applyDimensionFilter:null;
if(trTaxApplyDimBase){
  applyDimensionFilter=function(dim,val){if(String(dim).startsWith('tax:')){opsViewState.taxonomyFilters=opsViewState.taxonomyFilters||{};opsViewState.taxonomyFilters[String(dim).slice(4)]=val;render();return;}return trTaxApplyDimBase(dim,val);};
}
const trTaxClearDimBase=typeof clearDimensionSelection==='function'?clearDimensionSelection:null;
if(trTaxClearDimBase){
  clearDimensionSelection=function(dim){if(String(dim).startsWith('tax:')){opsViewState.taxonomyFilters=opsViewState.taxonomyFilters||{};delete opsViewState.taxonomyFilters[String(dim).slice(4)];render();return;}return trTaxClearDimBase(dim);};
}
const trTaxBreakdownBase=typeof breakdownModule==='function'?breakdownModule:null;
if(trTaxBreakdownBase){
  breakdownModule=function(ops){
    let html=trTaxBreakdownBase(ops),p=trTaxCurrentPlan(),dim=opsViewState.dimension||'setup';
    const options=api.activeTaxonomies(p).map(t=>`<option value="tax:${trTaxEsc(t.id)}" ${dim===`tax:${t.id}`?'selected':''}>${trTaxEsc(t.name)}</option>`).join('');
    return html.replace('</select>',`${options}</select>`);
  };
}

/* ---------- Detail view: expose all current/historical classifications ---------- */
const trTaxViewOperationBase=typeof viewOperation==='function'?viewOperation:null;
if(trTaxViewOperationBase){
  viewOperation=function(id){
    const o=state.operations.find(x=>x.id===id);if(!o)return trTaxViewOperationBase(id);
    const p=typeof getPlan==='function'?getPlan(o.tradingPlanId):trTaxCurrentPlan();api.ensurePlan(p);
    const rows=(p.taxonomyRegistry||[]).map(t=>{const value=api.operationValue(t,o);return value?`<div><span>${trTaxEsc(t.name)}</span><strong>${trTaxEsc(value.name)}${t.status==='archived'?' · taxonomía archivada':''}</strong></div>`:'';}).join('');
    trTaxViewOperationBase(id);
    const modal=document.querySelector('.modal-backdrop .modal-body');if(modal&&rows){
      const anchor=[...modal.querySelectorAll('.form-section')].find(x=>x.textContent.includes('Capturas de la operación'));
      const section=document.createElement('section');section.className='form-section';section.innerHTML=`<div class="panel-title"><div><h3>Clasificación del estudio</h3><small>Taxonomías actuales e históricas del Trading Plan</small></div></div><div class="trade-facts">${rows}</div>`;
      if(anchor)modal.insertBefore(section,anchor);else modal.appendChild(section);
    }
  };
}

Object.assign(registry,{
  saveOperationFromForm,readOpsFilters,labReadFilters,resetOpsFilters,labReset,viewOperation,
  applyDimensionFilter,clearDimensionSelection,
  trTaxCreateTaxonomy,trTaxOpenEditor,trTaxSaveEditor,trTaxAddValue,trTaxToggleTaxonomy,trTaxDeleteTaxonomy,trTaxToggleValue,trTaxDeleteValue
});

globalThis.TradingResearchTaxonomyRuntime=Object.freeze({
  version:TR_TAXONOMY_RUNTIME_VERSION,
  diagnostics:()=>({schema:TR_TAXONOMY_SCHEMA,plans:(state?.tradingPlans||[]).length,active:trTaxCurrentPlan()?api.activeTaxonomies(trTaxCurrentPlan()).length:0})
});
if(typeof render==='function')render();
})();
