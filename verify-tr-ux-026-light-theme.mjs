import fs from 'node:fs';
import assert from 'node:assert/strict';

// TR-UX-026: deterministic WCAG AA text checks for the documented theme
// surfaces. This is a stylesheet regression gate, not a browser accessibility audit.
const css=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');
function rule(selector,source=css){
  const exact=source.lastIndexOf(selector+'{');
  const group=source.lastIndexOf(selector+',');
  const start=Math.max(exact,group);
  assert(start>=0,'Missing CSS selector: '+selector);
  const open=source.indexOf('{',start);
  const end=source.indexOf('}',start);
  assert(open>start&&end>open,'Unterminated CSS rule: '+selector);
  return source.slice(open+1,end);
}
function value(selector,property){
  const decl=rule(selector).split(';').map(x=>x.trim()).find(x=>x.startsWith(property+':'));
  assert(decl,'Missing '+property+' in '+selector);
  return decl.slice(property.length+1).trim();
}
function rgb(hex){
  assert(/^#[\da-f]{6}$/i.test(hex),'Expected opaque sRGB hex, got '+hex);
  return hex.match(/[\da-f]{2}/gi).map(x=>parseInt(x,16)/255);
}
function luminance(hex){
  const a=rgb(hex).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  return .2126*a[0]+.7152*a[1]+.0722*a[2];
}
function contrast(a,b){
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (hi+.05)/(lo+.05);
}
function check(name,foreground,background,minimum=4.5){
  const ratio=contrast(foreground,background);
  assert(ratio>=minimum,name+': contrast '+ratio.toFixed(2)+' < '+minimum);
  console.log(' - '+name+': '+ratio.toFixed(2)+':1');
}
const light='html[data-theme="light"] ';
const headerBg=value(light+'.block-detail-head','background');
const kpiBg=value(light+'.block-detail-kpis>div','background');
const headerText=value(light+'.block-detail-head','color');
const neutral=value(light+'.block-detail-kpis strong','color');
const kpiCaption=value(light+'.block-detail-kpis span','color');
check('Blocks · header values',headerText,headerBg);
check('Blocks · neutral KPI values',neutral,kpiBg);
check('Blocks · KPI labels',kpiCaption,kpiBg);
const gradient=value(light+'.perspective-focus-card','background').match(/#[\da-f]{6}/gi);
assert.equal(gradient?.length,2,'Perspective must have two explicit opaque gradient endpoints');
const prose=value(light+'.perspective-focus-card','color');
const secondary=value(light+'.perspective-focus-source','color');
for(const end of gradient){
  check('Perspective · quote/author on '+end,prose,end);
  check('Perspective · source/metadata on '+end,secondary,end);
  check('Perspective · Configurar biblioteca on '+end,value(light+'.perspective-focus-actions .btn.ghost','color'),end);
}
const contextBg=value(light+'.perspective-focus-context','background');
check('Perspective · context text',value(light+'.perspective-focus-context','color'),contextBg);
check('Perspective · context caption',value(light+'.perspective-focus-context span','color'),contextBg);
check('Nueva operación · form labels',value(light+'.field label','color'),'#f8fafc');
check('Review & Notes · secondary captions',value(light+'.kpi .sub','color'),'#ffffff');
check('Calendario · metadata on strongest white background',value(light+'.calendar-day-meta','color'),'#ffffff');
const amber=value(light+'.rp-level-label.exit','fill');
check('Market Data · Salida annotation on white',amber,'#ffffff');
check('Market Data · Salida annotation on chart off-white',amber,'#eef3fa');
assert.equal(value(light+'.rp-exit-level','stroke'),amber,'Exit marker and exit label must match');
assert(rule(light+'.rp-exit,\n'+light+'.be-actual').includes('fill:'+amber),'Execution & Best Exit markers must share the amber color');
assert(rule(light+'.rp-legend i.exit,\n'+light+'.be-legend i.be-actual-dot').includes('background:'+amber),'Exit legends must share the amber color');
assert(rule(light+'.perspective-focus-actions .btn:focus-visible,\n'+light+'.block-detail-head .btn:focus-visible').includes('outline:2px solid'),'Keyboard focus must remain visible');
// Light-only changes: existing dark surfaces/semantic classes remain authored.
const baseCss=css.slice(0,css.indexOf('/* ===== TR-UX-026'));
function firstBaseRule(selector){
  const start=baseCss.indexOf(selector+'{');
  assert(start>=0,'Missing original dark rule: '+selector);
  const end=baseCss.indexOf('}',start);
  return baseCss.slice(start+selector.length+1,end);
}
assert(firstBaseRule('.block-detail-head').includes('background:#0a182a'),'Dark Blocks header must remain unchanged');
assert(firstBaseRule('.block-detail-kpis>div').includes('background:#09111f'),'Dark Blocks metrics must remain unchanged');
assert(firstBaseRule('.perspective-focus-card').includes('#0b1220'),'Dark Perspective gradient must remain unchanged');
assert(css.includes('html[data-theme="light"] .positive')&&css.includes('html[data-theme="light"] .negative'),'Financial semantics must remain theme-aware');
console.log('TR-UX-026 Light Theme · targeted contrast & invariants PASS');
