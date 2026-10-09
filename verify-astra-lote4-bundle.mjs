import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('dist/index.html','utf8');
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const marker='<script data-tr-render-closure-runtime="'+version+'">';
const start=html.indexOf(marker),end=html.indexOf('</script>',start);
assert(start>=0&&end>start,'No final runtime CSP bundle');
const body=html.slice(start+marker.length,end);
for(const n of ['TradingResearchAstraLote4','tr4EmotionTab','tr4EmotionSearch','tr4-glossary-detail','modalInitial','Revisar calidad del dataset'])
 assert(body.includes(n),'Lote 4 missing from hashed script: '+n);
assert(!/src=["']astra-lote4-accessibility-runtime\.js["']/.test(html),'External Lote 4 script in production');
const csp=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert(csp.scriptHashes.length===19,'CSP hash inventory changed');
assert(fs.readFileSync('astra-lote2-config-runtime.js','utf8').includes('TradingResearchAstraLote4?.decorateEmotional'),'Lote 2 editor integration missing');
console.log('Astra Lote 4 bundle PASS: no extra CSP script, emotional editor integration intact');
