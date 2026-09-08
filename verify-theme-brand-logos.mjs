import fs from 'node:fs';

const fail=[];
const mustFile=(file)=>{if(!fs.existsSync(file))fail.push(`missing ${file}`);};
[
  'brand-logo-runtime.js',
  'brand-logo.css',
  'emit-brand-logos.mjs',
  'brand-logo-dark.png.base64',
  'brand-logo-light.png.base64'
].forEach(mustFile);

const read=(file)=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
const runtime=read('brand-logo-runtime.js');
const css=read('brand-logo.css');
const index=read('index.html');
const pkg=read('package.json');
const emitter=read('emit-brand-logos.mjs');

if(runtime){
  if(!runtime.includes('/brand-logo-dark.png'))fail.push('runtime missing dark brand asset');
  if(!runtime.includes('/brand-logo-light.png'))fail.push('runtime missing light brand asset');
  if(!/data-theme|getAttribute\(['"]data-theme['"]\)|dataset\.theme/.test(runtime))fail.push('runtime missing theme boundary');
  if(!runtime.includes('.brand'))fail.push('runtime must target only the existing .brand host');
  if(/data:image\//i.test(runtime))fail.push('brand runtime must not embed data-image URLs');
  if(/favicon/i.test(runtime))fail.push('brand runtime must not touch favicon');
}
if(css){
  if(!css.includes('.tr-brand-logo'))fail.push('brand CSS missing .tr-brand-logo');
  if(/url\(/i.test(css))fail.push('brand CSS must not select brand assets via CSS URLs');
}
if(index&&!/brand-logo-runtime\.js/.test(index))fail.push('index.html missing brand-logo-runtime.js');
if(pkg){
  if(!pkg.includes('emit-brand-logos.mjs'))fail.push('build pipeline missing brand logo emitter');
  if(!pkg.includes('verify-brand-logos-build.mjs'))fail.push('build pipeline missing brand logo build verifier');
}
if(emitter){
  if(!emitter.includes('brand-logo-dark.png.base64'))fail.push('emitter missing original dark source');
  if(!emitter.includes('brand-logo-light.png.base64'))fail.push('emitter missing original light source');
  if(!emitter.includes('brand-logo-dark.png'))fail.push('emitter missing dark dist asset');
  if(!emitter.includes('brand-logo-light.png'))fail.push('emitter missing light dist asset');
}

if(fail.length){
  console.error('Theme Brand Logos gate: FAIL');
  for(const item of fail)console.error(`- ${item}`);
  process.exit(1);
}
console.log('Theme Brand Logos gate: PASS');
