import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('dist/index.html','utf8');
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const opening='<script data-tr-render-closure-runtime="'+version+'">';
const start=html.indexOf(opening),end=html.indexOf('</script>',start);
assert(start>=0&&end>start,'Production render closure bundle missing');
const body=html.slice(start+opening.length,end);
for(const needle of ['TradingResearchAstraLote3','trAstraL3Prerequisite','trAstraL3Return','tr3-journal-nav','Análisis de errores','Centro de investigación','Apariencia']){
 assert(body.includes(needle),'Lote 3 code not found in bundled runtime: '+needle);
}
assert(!/src=["']astra-lote3-navigation-runtime\.js["']/.test(html),'Lote 3 source must not be fetched separately');
const csp=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert(csp.scriptHashes.length===19,'Do not change the established 19 script-hash CSP inventory');
const app=fs.readFileSync('app.js','utf8');
assert(!app.includes('trAstraL3Go'),'Navigation must not modify app.js or its persisted data structures');
console.log('Astra Lote 3 production bundle PASS: canonical navigation and prereqs within stable CSP boundary');
