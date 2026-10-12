import fs from 'node:fs';
import assert from 'node:assert/strict';
const runtime=fs.readFileSync('astra-lote7-navigation-runtime.js','utf8');
const html=fs.readFileSync('dist/index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert(html.includes('TradingResearchAstraLote7'),'Lote 7 must be in CSP-hashed HTML');
assert.equal(manifest.scriptHashes.length,19,'Must preserve the 19 CSP script hashes');
assert(!/<script[^>]+src=["']astra-lote7-navigation-runtime\.js/.test(html),'No extra un-hashed script');
for(const symbol of ['V318_NAV_GROUPS','v318GroupHtml','originalShell','currentView','isBacktest','quality','market','blocks']){
 assert(runtime.includes(symbol),'Missing menu-only dependency '+symbol);
}
assert(!/state\.(?:operations|tradingPlans)\s*=|savedStudies\s*=|v314Store(?:Delete|Put)\(/.test(runtime),'Lote 7 cannot alter operations or Market Data');
const app=fs.readFileSync('app.js','utf8');
assert(app.includes("['blocks','▦','Bloques']"),'Source Blocks route must survive');
console.log('Astra Lote 7 bundle PASS: 19 CSP hashes, original Blocks and Market Data routes preserved, no data mutation');
