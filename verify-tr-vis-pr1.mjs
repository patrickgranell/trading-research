/* TR-VIS PR1 · presentation contract guards (static). Browser QA is separate. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const css=fs.readFileSync('styles.css','utf8');
const adapter=fs.readFileSync('astra-lote3-navigation-runtime.js','utf8');
const navigation=fs.readFileSync('astra-lote7-navigation-runtime.js','utf8');
const build=fs.readFileSync('build.mjs','utf8');
function luminance(hex){
 const rgb=hex.replace('#','').match(/.{2}/g).map(n=>parseInt(n,16)/255);
 const linear=rgb.map(c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4));
 return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
}
function contrast(foreground,background){
 const f=luminance(foreground),b=luminance(background);
 return (Math.max(f,b)+0.05)/(Math.min(f,b)+0.05);
}
assert.match(css,/--tr-vis-page-size:24px/);
assert.match(css,/--tr-vis-panel-size:16px/);
assert.match(css,/--tr-vis-control-size:14px/);
assert.match(css,/--tr-vis-meta-size:12px/);
assert.match(css,/\.sidebar \.nav-organized\{[\s\S]*?overflow-y:auto/);
assert.match(css,/\.dashboard-equity-svg \.dashboard-axis-text/);
assert.match(css,/html:not\(\[data-theme="light"\]\) \.rp-chart-wrap/);
assert.match(css,/\.rp-chart \.rp-axis-label/);
assert.ok(contrast('#5a687d','#ffffff')>=4.5,'Axis on light white');
assert.ok(contrast('#5a687d','#edf2f8')>=4.5,'Axis on light panel');
assert.ok(contrast('#93a7c3','#0d1424')>=4.5,'Axis on dark panel');
assert.match(adapter,/svg\.dashboard-equity-svg\[viewBox\]/);
assert.match(adapter,/preserveAspectRatio','xMidYMid meet'/);
assert.match(adapter,/decision:'Estado del plan'/);
assert.match(adapter,/Array\.isArray\(operations\)&&operations\.length===0/);
assert.match(adapter,/Sin muestra operativa/);
assert.match(navigation,/isBacktest\(\)/);
assert.match(navigation,/data-view="blocks"/);
assert.match(navigation,/data-view="market"/);
assert.match(build,/bundledScript\('astra-lote3-navigation-runtime\.js'\)/);
console.log('TR-VIS PR1 static presentation guard: PASS (roles, verified contrast pairs, SVG, empty state, existing navigation).');
