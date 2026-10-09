import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8'));
const marker='<script data-tr-render-closure-runtime="'+pkg.version+'">';
const i=html.indexOf(marker),end=html.indexOf('</script>',i);
assert(i>=0&&end>i,'The final production render script must be present');
const body=html.slice(i+marker.length,end);
for(const s of ['tr-ops-entry-exit','Fecha entrada','Hora entrada','Fecha salida','Hora salida','opsTable','Bloque']){
  assert(body.includes(s),'Missing UX-104 scoped presentation code: '+s);
}
assert(!/src=["']operations-register-presentation-runtime\.js["']/.test(html),'No production network script allowed');
const manifest=JSON.parse(fs.readFileSync(new URL('./dist/csp-manifest.json',import.meta.url),'utf8'));
assert(Array.isArray(manifest.scriptHashes)&&manifest.scriptHashes.length===19,'CSP hash inventory must not change');
console.log('UX-104 bundled presentation PASS: same CSP-hashed script, no extra network file');
