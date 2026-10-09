import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('dist/index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const tag='<script data-tr-render-closure-runtime="'+pkg.version+'">';
const start=html.indexOf(tag),end=html.indexOf('</script>',start);
assert(start>=0&&end>start,'Final CSP runtime missing');
const body=html.slice(start+tag.length,end);
for(const term of ['TradingResearchAstraLote4','trAstraL4GlossaryBack','trAstraL4EmotionTab','MutationObserver','Escape']){
 assert(body.includes(term),'Missing Lote 4 integration '+term);
}
assert(!/src=["']astra-lote4-visual-runtime\.js["']/.test(html),'No additional JS resources allowed in production');
const manifest=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert(manifest.scriptHashes.length===19,'CSP inventory changed');
console.log('Astra Lote 4 build PASS: adapter in existing CSP-hashed script; no new asset request');