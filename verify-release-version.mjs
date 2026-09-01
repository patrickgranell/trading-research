import fs from 'node:fs';

const EXPECTED='31.25.0';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const index=fs.readFileSync('index.html','utf8');
const render=fs.readFileSync('render-closure-runtime.js','utf8');
const fail=[];

if(pkg.version!==EXPECTED)fail.push(`package.json version = ${pkg.version}, expected ${EXPECTED}`);
if(!index.includes(`name="trading-research-source-version" content="${EXPECTED}"`))fail.push('index source-version no coincide con V31.25.0');
if(!render.includes(`const TR_RELEASE_VERSION='${EXPECTED}'`))fail.push('falta TR_RELEASE_VERSION V31.25.0');
if(!render.includes("const TR_RELEASE_LABEL='V31.25 · Reaudit Hardening'"))fail.push('falta label global V31.25');
if(!render.includes("<small>Modo actual</small><strong>V${TR_RELEASE_VERSION}</strong>"))fail.push('Modo actual no usa la versión global de release');
if(render.includes("<small>Modo actual</small><strong>V${TR_SOURCE_CONSOLIDATION_PHASE}</strong>"))fail.push('Modo actual sigue acoplado a Source Consolidation');
if(!render.includes("<span>Release</span><strong>V${esc(d.releaseVersion)}</strong>"))fail.push('Source Consolidation no expone la versión global');
if(!render.includes("releaseVersion:TR_RELEASE_VERSION"))fail.push('diagnóstico Source Consolidation no publica releaseVersion');

if(fail.length){
  console.error('\nRelease version verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Release version verification OK');
console.log(' - product release = V31.25.0');
console.log(' - package/index/runtime visible version aligned');
console.log(' - component phase labels remain independent');
