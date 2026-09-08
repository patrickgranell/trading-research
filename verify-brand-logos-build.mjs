import fs from 'node:fs';
import crypto from 'node:crypto';

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const hash=file=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):'';
const expected={
  'dist/brand-logo-theme-dark.png':'c1d9f082e1e6ca2735fda2bcffbe0fe7fd4df34bb028de6ae7866f42a5c3e531',
  'dist/brand-logo-theme-light.png':'391db80af4509cce4e29c5211634d26a53253f2033863edcee2f88505d276199'
};
for(const [file,sha] of Object.entries(expected)){
  need(fs.existsSync(file),`missing ${file}`);
  if(fs.existsSync(file))need(hash(file)===sha,`${file} does not match the user original`);
}
const html=fs.existsSync('dist/index.html')?fs.readFileSync('dist/index.html','utf8'):'';
const headers=fs.existsSync('dist/_headers')?fs.readFileSync('dist/_headers','utf8'):'';
const runtime=fs.readFileSync('brand-logo-runtime.js','utf8');
const css=fs.readFileSync('brand-logo.css','utf8');
const cspHash=text=>`'sha256-${crypto.createHash('sha256').update(text,'utf8').digest('base64')}'`;
need(html.includes('data-tr-brand-logo-runtime="31.25.0"'),'bundle missing brand logo runtime');
need(html.includes('data-tr-brand-logo-style="31.25.0"'),'bundle missing brand logo CSS');
need(html.includes('/brand-logo-theme-dark.png'),'bundle missing dark-theme brand asset reference');
need(html.includes('/brand-logo-theme-light.png'),'bundle missing light-theme brand asset reference');
need(headers.includes(cspHash(runtime)),'CSP missing exact brand runtime hash');
need(headers.includes(cspHash(css)),'CSP missing exact brand CSS hash');
need(!html.includes('data:image/png;base64'),'brand logo must not be embedded as a data URL');
if(fail.length){console.error('Theme Brand Logos build verification FAILED');for(const item of fail)console.error(' - '+item);process.exit(1);}
console.log('Theme Brand Logos build verification OK');
console.log(' - dark/light assets match user originals byte-for-byte');
console.log(' - responsive logo runtime/style present');
console.log(' - CSP hashes present; same-origin PNG references only');
