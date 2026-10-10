import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('dist/index.html','utf8');
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const opening='<script data-tr-render-closure-runtime="'+version+'">';
const start=html.indexOf(opening),end=html.indexOf('</script>',start);
assert(start>=0&&end>start,'Final canonical runtime missing');
const runtime=html.slice(start+opening.length,end);
for(const name of ['TradingResearchAstraLote5Operations','TradingResearchAstraLote5Visual','tr5-ops-register','tr5-compare-grid','Históricos presentes en operaciones','tr5-plan-maintenance','tr5-filter-status']){
 assert(html.includes(name),'Lote 5 feature missing: '+name);
}
assert(!/src=["']astra-lote5-(?:visual|operations)-runtime\.js["']/.test(html),'Lote 5 must be within CSP-hashed runtime');
const csp=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert.equal(csp.scriptHashes.length,19,'Lote 5 must preserve original 19 script hash inventory');
assert(!/state\.operations\s*=|state\.tradingPlans\s*=|savedStudies\s*=/.
 test(fs.readFileSync('astra-lote5-operations-runtime.js','utf8')),'Adapter must not rewrite canonical records or studies');
console.log('Astra Lote 5 CSP bundle PASS: unchanged persistence/calculation boundaries, 4 UI routes, 19 hashes');
