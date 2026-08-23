/* ===== V31.22 RUNTIME · Security Foundation V · Strict Style Attribute Boundary ===== */
(()=>{
'use strict';
const TR_STYLE_ATTR_VERSION='31.22.0';
const TR_STYLE_ATTR_SOURCE='data-tr-style';
const TR_STYLE_ATTR_MAX_LEN=1600;
const TR_STYLE_ATTR_MAX_DECLS=24;
const TR_RELEASE_READINESS_BRIDGE_VERSION='31.23.53';
let trStyleAttrObserver=null;
const trStyleAttrStats={hydrated:0,declarations:0,rejected:0,ignoredEmpty:0,lastProperty:'',lastError:''};
let trLabStateBridgeInstalled=false;

function trInstallLabStateBridge(){
  const registry=(window.TradingResearchActions&&typeof window.TradingResearchActions==='object')?window.TradingResearchActions:(window.TradingResearchActions=Object.create(null));
  if(typeof labState==='undefined'||!labState||typeof labState!=='object')return false;
  const facade=Object.create(null);
  Object.defineProperties(facade,{
    nr:{enumerable:true,get:()=>labState.nr,set:value=>{labState.nr=String(value??'');}},
    hypothesis:{enumerable:true,get:()=>labState.hypothesis,set:value=>{labState.hypothesis=String(value??'');}}
  });
  Object.preventExtensions(facade);
  registry.labState=facade;
  trLabStateBridgeInstalled=true;
  return true;
}

function trStyleAttrSafeProperty(name){
  const p=String(name||'').trim().toLowerCase();
  if(!/^(?:--[a-z0-9_-]{1,80}|[a-z][a-z0-9-]{0,80})$/.test(p))return '';
  if(p==='behavior'||p==='-moz-binding')return '';
  return p;
}
function trStyleAttrSafeValue(value){
  const v=String(value??'').trim();
  if(!v||v.length>500)return '';
  if(/[<>]/.test(v))return '';
  if(/(?:url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|@import|-moz-binding|behavior\s*:)/i.test(v))return '';
  return v;
}
function trStyleAttrCamel(prop){return prop.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());}
function trStyleAttrApply(el,prop,value){
  if(prop.startsWith('--')){el.style.setProperty(prop,value);return;}
  const camel=trStyleAttrCamel(prop);
  if(camel in el.style)el.style[camel]=value;
  else el.style.setProperty(prop,value);
}
function trStyleAttrHydrate(el){
  if(!(el instanceof Element)||!el.hasAttribute(TR_STYLE_ATTR_SOURCE))return;
  const raw=String(el.getAttribute(TR_STYLE_ATTR_SOURCE)||'');
  el.removeAttribute(TR_STYLE_ATTR_SOURCE);
  if(!raw){trStyleAttrStats.ignoredEmpty++;return;}
  if(raw.length>TR_STYLE_ATTR_MAX_LEN){trStyleAttrStats.rejected++;trStyleAttrStats.lastError='Atributo demasiado largo';return;}
  const decls=raw.split(';').map(x=>x.trim()).filter(Boolean).slice(0,TR_STYLE_ATTR_MAX_DECLS);
  let applied=0;
  for(const decl of decls){
    const i=decl.indexOf(':');
    if(i<=0){trStyleAttrStats.rejected++;continue;}
    const prop=trStyleAttrSafeProperty(decl.slice(0,i));
    if(!prop){trStyleAttrStats.rejected++;continue;}
    const rawValue=String(decl.slice(i+1)??'').trim();
    if(!rawValue){trStyleAttrStats.ignoredEmpty++;continue;}
    const value=trStyleAttrSafeValue(rawValue);
    if(!value){trStyleAttrStats.rejected++;continue;}
    try{trStyleAttrApply(el,prop,value);applied++;trStyleAttrStats.declarations++;trStyleAttrStats.lastProperty=prop;}
    catch(e){trStyleAttrStats.rejected++;trStyleAttrStats.lastError=e?.message||String(e);}
  }
  if(applied)trStyleAttrStats.hydrated++;
}
function trStyleAttrScan(root=document){
  if(root instanceof Element&&root.hasAttribute(TR_STYLE_ATTR_SOURCE))trStyleAttrHydrate(root);
  try{root.querySelectorAll?.(`[${TR_STYLE_ATTR_SOURCE}]`).forEach(trStyleAttrHydrate);}catch(_){/* boundary remains fail-closed */}
}
function trStyleAttrMutations(records){
  for(const rec of records){
    if(rec.type==='attributes'&&rec.attributeName===TR_STYLE_ATTR_SOURCE){trStyleAttrHydrate(rec.target);continue;}
    if(rec.type==='childList')rec.addedNodes.forEach(node=>{if(node instanceof Element)trStyleAttrScan(node);});
  }
}
function trStyleAttrDiagnostics(){
  const pending=document.querySelectorAll?.(`[${TR_STYLE_ATTR_SOURCE}]`)?.length||0;
  return {version:TR_STYLE_ATTR_VERSION,releaseReadinessBridge:TR_RELEASE_READINESS_BRIDGE_VERSION,hydrated:trStyleAttrStats.hydrated,declarations:trStyleAttrStats.declarations,rejected:trStyleAttrStats.rejected,ignoredEmpty:trStyleAttrStats.ignoredEmpty,pending,lastProperty:trStyleAttrStats.lastProperty,lastError:trStyleAttrStats.lastError,labStateBridgeInstalled:trLabStateBridgeInstalled,strictStyleAttrBoundary:true,ok:pending===0&&trStyleAttrStats.rejected===0};
}
function trStyleAttrStart(){
  trStyleAttrScan(document);
  if(trStyleAttrObserver)return;
  trStyleAttrObserver=new MutationObserver(trStyleAttrMutations);
  trStyleAttrObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:[TR_STYLE_ATTR_SOURCE]});
}

/* V31.23.53 release-readiness closure: the only remaining lexical-state handlers
 * address labState.nr / labState.hypothesis. Publish a narrow, non-extensible facade
 * in TradingResearchActions so delegated events never reopen window.labState. */
trInstallLabStateBridge();

/* V31.23.5: diagnostics stay behind the namespaced public API; the duplicate
 * window.trStyleAttrDiagnostics alias is no longer required. */
window.TradingResearchStyleAttrs=Object.freeze({version:TR_STYLE_ATTR_VERSION,diagnostics:trStyleAttrDiagnostics,rescan:()=>trStyleAttrScan(document)});
trStyleAttrStart();
})();
/* ===== END V31.22 STYLE ATTRIBUTE BOUNDARY ===== */