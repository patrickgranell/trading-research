import fs from 'node:fs';
import crypto from 'node:crypto';
const app=fs.readFileSync('app.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const baseline=JSON.parse(fs.readFileSync('financial-regression-baseline.json','utf8'));
const fail=[];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const chunk=(start,end)=>{const a=app.indexOf(start),b=a<0?-1:app.indexOf(end,a+start.length);if(a<0||b<0){fail.push(`No se encuentra región ${start}`);return '';}return app.slice(a,b);};
if(pkg.version!=='31.11.0')fail.push(`Versión inesperada: ${pkg.version}`);
if(!app.includes("const TR_CORE_DB_NAME='tradingResearchCoreV1'"))fail.push('Falta IndexedDB core.');
if(!app.includes("function persist(){return trCorePersistStateBridge('persist');}"))fail.push('persist() no usa el bridge durable.');
if(/localStorage\.setItem\(STORAGE_KEY/.test(app))fail.push('Queda una escritura directa del estado a localStorage.');
if(!app.includes('trCoreBootstrap();'))fail.push('Falta bootstrap IndexedDB.');
for(const [name,[start,end]] of Object.entries(baseline.regions)){const got=sha(chunk(start,end)),want=baseline.hashes[name];if(got!==want)fail.push(`REGRESIÓN FINANCIERA: ${name} cambió (${got.slice(0,10)} != ${want.slice(0,10)}).`);}
if(fail.length){console.error('\nStructural verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('Structural verification OK');
console.log(' - Core state: IndexedDB');
console.log(' - Direct state localStorage writes: 0');
console.log(` - Financial regions unchanged vs ${baseline.sourceVersion}: ${Object.keys(baseline.hashes).length}/${Object.keys(baseline.hashes).length}`);
