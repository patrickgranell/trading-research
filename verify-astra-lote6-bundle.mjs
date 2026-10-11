import fs from 'node:fs';
import assert from 'node:assert/strict';
const script=fs.readFileSync('astra-lote6-research-runtime.js','utf8');
const html=fs.readFileSync('dist/index.html','utf8');
const csp=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
for(const required of [
 'tr6LabGroup','tr6EdgePreset','tr6SelectResearchCell','tr6OpenHistory',
 'tr6MarketTab','tr6OpenLinked','tr6ImportGrid','tr6ImportTicks',
 'tr6-compare-universes','tr6-prerequisites','tr6-grid-button',
 "const originalGrid=researchGridModule","const originalLab=analyticsLab",
 "const originalCompare=v313CompareView","const originalMarket=v316MarketDataView"
])assert(script.includes(required),'Lote 6 contract missing: '+required);
assert(html.includes('TradingResearchAstraLote6'),'Lote 6 adapter is missing from final bundle');
assert(!/<script[^>]+src=["']astra-lote6-research-runtime\.js/.test(html),'Lote 6 must be within original CSP hashed script');
assert.equal(csp.scriptHashes.length,19,'CSP script hash count changed');
assert(!/state\.operations\s*=|state\.tradingPlans\s*=|savedStudies\s*=/.test(script),'Lote 6 adapter mutates records or studies');
assert(!/v316ApplyLink\(|v314RecalculateExec\(|v314DeleteMarket\(|v314DeleteExec\(/.test(script),'Lote 6 adapter must not modify market data or links');
console.log('Astra Lote 6 bundle PASS: four isolated adapters, intact records, CSP 19 hashes');