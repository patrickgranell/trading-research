import fs from 'node:fs';
import crypto from 'node:crypto';

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const hash=file=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):'';
const h=fs.existsSync('dist/index.html')?fs.readFileSync('dist/index.html','utf8'):'';
const expected={
  'dist/brand-logo-theme-dark.png':'c1d9f082e1e6ca2735fda2bcffbe0fe7fd4df34bb028de6ae7866f42a5c3e531',
  'dist/brand-logo-theme-light.png':'391db80af4509cce4e29c5211634d26a53253f2033863edcee2f88505d276199'
};
for(const [file,sha] of Object.entries(expected)){
  need(fs.existsSync(file),`missing ${file}`);
  if(fs.existsSync(file))need(hash(file)===sha,`${file} does not match the user original`);
}
need(h.includes('/brand-logo-theme-dark.png'),'bundle missing dark-theme brand asset reference');
need(h.includes('/brand-logo-theme-light.png'),'bundle missing light-theme brand asset reference');
need(h.includes('tr-brand-logo'),'bundle missing brand logo runtime marker');
need(!h.includes('data:image/png;base64'),'brand logo must not be embedded as a data URL');
if(fail.length){console.error('Theme Brand Logos build verification FAILED');for(const item of fail)console.error(' - '+item);process.exit(1);}
console.log('Theme Brand Logos build verification OK');
console.log(' - dark theme asset: exact user original');
console.log(' - light theme asset: exact user original');
console.log(' - same-origin static PNG references present');
