import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const html=fs.readFileSync('dist/index.html','utf8');
const v=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const opener='<script data-tr-render-closure-runtime="'+v+'">';
const from=html.indexOf(opener),to=html.indexOf('</script>',from);
assert(from>=0&&to>from,'Astra Lote 4 CSP-bundled script missing');
const script=html.slice(from+opener.length,to);
for(const symbol of ['TradingResearchAstraLote4Dialog','trHelpDetailHtml','glossary-detail','tr4-perspective-workspace','tr4-emotional-tabs','emotionalConfigQuestionSelect']){
 assert(html.includes(symbol),'Missing Lote 4 feature: '+symbol);
}
assert(script.includes('TradingResearchAstraLote4Dialog'),'Lote 4 accessibility boundary must remain in final bundled script');
assert(!/src=["']astra-lote4-accessibility-runtime\.js["']/.test(html),'No extra CSP-external runtime');
const csp=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert.equal(csp.scriptHashes.length,19,'Existing 19 CSP hashes must remain');
const app=fs.readFileSync('app.js','utf8');
assert(!app.includes('Detalle + 20 operaciones'),'Block count must come from actual sample');
assert(app.includes("terms:['máx. ganancia'"),'Maximum must not use average glossary definition');
console.log('Astra Lote 4 bundle PASS: glossary, scope, keyboard, perspective editor and CSP boundary');

