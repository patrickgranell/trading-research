import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
const packageJson=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8'));
const tag='<script data-tr-render-closure-runtime="'+packageJson.version+'">';
assert(html.includes(tag),'Final render closure bundle missing');
const start=html.indexOf(tag),end=html.indexOf('</script>',start);
assert(start>=0&&end>start,'Final render closure script invalid');
const body=html.slice(start+tag.length,end);
for(const x of ['TradingResearchStatisticalUX','tr-analytic-context','Sin resultados por filtros','Muestra insuficiente','trCanonicalOperationRows','confidenceSplit']){
  assert(body.includes(x),'Astra Lote 1 runtime not bundled in CSP-hashed final script: '+x);
}
assert(!/src=["']statistical-ux-runtime\.js["']/.test(html),'Production must not rely on a non-deployed external UX script');
const manifest=JSON.parse(fs.readFileSync(new URL('./dist/csp-manifest.json',import.meta.url),'utf8'));
assert(Array.isArray(manifest.scriptHashes)&&manifest.scriptHashes.length===19,'Existing CSP script inventory must remain stable');
console.log('Astra Lote 1 production bundling PASS (CSP hash inventory and final inline runtime)');
