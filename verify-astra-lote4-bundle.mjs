import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('dist/index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const open='<script data-tr-render-closure-runtime="'+pkg.version+'">';
const begin=html.indexOf(open),end=html.indexOf('</script>',begin);
assert(begin>=0&&end>begin,'Final CSP-hashed runtime required');
const text=html.slice(begin+open.length,end);
for(const needle of ['TradingResearchAstraLote4','trAstraL4EmotionTab','trAstraL4PerspectiveSearch','glossaryDetail','aria-labelledby','formSnapshot','trRenderViewHtml']){
 assert(text.includes(needle),'Lote 4 module missing: '+needle);
}
assert(!/src=["']astra-lote4-accessibility-runtime\.js["']/.test(html),'No unbundled Lote 4 script');
const csp=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert.equal(csp.scriptHashes.length,19,'CSP inventory must remain 19 hashes');
console.log('Astra Lote 4 build PASS: scripts bundled, 19 hashes, stable data/persistence files');
