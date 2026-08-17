import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const v=pkg.version;
const file='dist/index.html';
if(!fs.existsSync(file)){console.error('Build verification FAILED: dist/index.html missing');process.exit(1);}
const h=fs.readFileSync(file,'utf8');
const failures=[];
const count=s=>h.split(s).length-1;
const expectedMarkers=[['data-tr-build',2],['data-tr-style-attr-runtime',1],['data-tr-reports-purity-runtime',1],['data-tr-structural-runtime',1],['data-tr-state-runtime',1],['data-tr-security-runtime',1],['data-tr-event-runtime',1],['data-tr-csp-runtime',1],['data-tr-style-runtime',1],['data-tr-render-closure-runtime',1]];
for(const [marker,expected] of expectedMarkers){const n=count(`${marker}="${v}"`);if(n!==expected)failures.push(`${marker}: expected ${expected}, got ${n}`);}
if(count('<!doctype html>')!==1)failures.push(`doctype duplicated: ${count('<!doctype html>')}`);
if(count('function modalShell(title,body,footer)')!==1)failures.push(`app.js duplicated/corrupted: modalShell count ${count('function modalShell(title,body,footer)')}`);
if(/<script\s+src=["'](?:app|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|security-runtime|event-runtime|csp-runtime|style-runtime|render-closure-runtime)\.js["']/i.test(h))failures.push('local runtime script src remains after bundling');
if(/<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']/i.test(h))failures.push('styles.css link remains after bundling');
const size=Buffer.byteLength(h);if(size>3_000_000)failures.push(`bundle unexpectedly large: ${size} bytes`);
const scripts=[...h.matchAll(/<script\s+([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>/data-tr-(?:build|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|security-runtime|event-runtime|csp-runtime|style-runtime|render-closure-runtime)=/.test(m[1]));
if(scripts.length!==10)failures.push(`expected 10 bundled JS blocks, got ${scripts.length}`);
if(!fs.existsSync('dist/render-inventory.json'))failures.push('dist/render-inventory.json missing');
else{
  const inv=JSON.parse(fs.readFileSync('dist/render-inventory.json','utf8'));
  if(inv.source?.assignments!==12)failures.push(`source render assignment inventory changed: ${inv.source?.assignments}`);
  if(inv.source?.declarations!==1)failures.push(`source render declaration inventory changed: ${inv.source?.declarations}`);
  if(inv.bundled?.assignments!==0)failures.push(`bundled legacy render assignments remain: ${inv.bundled?.assignments}`);
  if(inv.bundled?.declarations!==1)failures.push(`bundled bootstrap render declaration count unexpected: ${inv.bundled?.declarations}`);
  if(inv.removedAssignments!==12)failures.push(`expected 12 removed render assignments, got ${inv.removedAssignments}`);
  if(inv.closureRuntime!=='render-closure-runtime.js')failures.push('render inventory does not identify canonical closure runtime');
}
const appBlock=scripts.find(m=>/data-tr-build=/.test(m[1]));
if(appBlock){
  const legacyBundled=(appBlock[2].match(/\brender\s*=\s*function\s*\(/g)||[]).length;
  if(legacyBundled!==0)failures.push(`bundled app still contains ${legacyBundled} render=function assignments`);
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tr-build-check-'));
try{
  scripts.forEach((m,i)=>{
    const p=path.join(tmp,`block-${i}.js`);fs.writeFileSync(p,m[2].replace(/<\\\/script/gi,'</script'));
    const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
    if(r.status!==0)failures.push(`inline JS block ${i} syntax error: ${(r.stderr||r.stdout||'').trim().split('\n')[0]}`);
  });
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
if(failures.length){console.error('Build verification FAILED');for(const f of failures)console.error(' - '+f);process.exit(1);}
console.log('Build verification OK');
console.log(' - Single HTML document: yes');
console.log(' - Bundled JS blocks: 10/10, syntax OK');
console.log(' - Canonical render closure: bundled + inventoried');
console.log(' - Legacy render reassignments in bundled app: 0');
console.log(' - Strict style attribute runtime: bundled');
console.log(' - app.js occurrence: 1');
console.log(` - Output size: ${size} bytes`);