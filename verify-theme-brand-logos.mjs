import fs from 'node:fs';
import crypto from 'node:crypto';
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};
const specs=[
  {theme:'dark',prefix:'brand-logo-theme-dark.png.base64.part',sha:'c1d9f082e1e6ca2735fda2bcffbe0fe7fd4df34bb028de6ae7866f42a5c3e531',bytes:184522},
  {theme:'light',prefix:'brand-logo-theme-light.png.base64.part',sha:'391db80af4509cce4e29c5211634d26a53253f2033863edcee2f88505d276199',bytes:195047}
];
for(const s of specs){const parts=fs.readdirSync('.').filter(f=>f.startsWith(s.prefix)).sort();need(parts.length>0,`missing ${s.theme} parts`);if(parts.length){const encoded=parts.map(f=>fs.readFileSync(f,'utf8')).join('').replace(/\s+/g,'');const buf=Buffer.from(encoded,'base64');need(buf.length===s.bytes,`${s.theme} bytes ${buf.length}/${s.bytes}`);need(crypto.createHash('sha256').update(buf).digest('hex')===s.sha,`${s.theme} hash mismatch`);}}
const apply=fs.existsSync('apply-brand-logos.mjs')?fs.readFileSync('apply-brand-logos.mjs','utf8'):'';
const pkg=fs.existsSync('package.json')?fs.readFileSync('package.json','utf8'):'';
need(apply.includes("dark:{prefix:'brand-logo-theme-dark.png.base64.part',sha256:'c1d9f082"),'dark theme must map to white/lime original');
need(apply.includes("light:{prefix:'brand-logo-theme-light.png.base64.part',sha256:'391db80a"),'light theme must map to black/red original');
need(apply.includes('object-fit:contain'),'logo aspect ratio contract missing');
need(apply.includes('data-theme="light"'),'theme-aware CSS missing');
need(apply.includes('Dashboard'),'Dashboard affordance missing');
need(!/favicon/i.test(apply),'brand implementation must not touch favicon');
need(pkg.includes('node apply-brand-logos.mjs'),'build does not apply brand logos');
if(fail.length){console.error('Theme Brand Logos source gate: FAIL');for(const f of fail)console.error(' - '+f);process.exit(1);}console.log('Theme Brand Logos source gate: PASS');
