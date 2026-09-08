import fs from 'node:fs';
import crypto from 'node:crypto';
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};
const h=fs.readFileSync('dist/index.html','utf8');
const specs=[['dark','dist/brand-logo-theme-dark.png',184522,'c1d9f082e1e6ca2735fda2bcffbe0fe7fd4df34bb028de6ae7866f42a5c3e531'],['light','dist/brand-logo-theme-light.png',195047,'391db80af4509cce4e29c5211634d26a53253f2033863edcee2f88505d276199']];
for(const [theme,file,bytes,sha] of specs){need(fs.existsSync(file),`${theme} dist asset missing`);if(fs.existsSync(file)){const b=fs.readFileSync(file);need(b.length===bytes,`${theme} dist bytes ${b.length}/${bytes}`);need(crypto.createHash('sha256').update(b).digest('hex')===sha,`${theme} dist hash mismatch`);}}
need(h.includes('class="brand tr-brand-logo"'),'brand markup missing');
need(!h.includes('<h1>Trading Research</h1><small>Backtest &amp; Trade Lab</small>'),'legacy brand text remains');
need(h.includes('tr-brand-logo-image-dark')&&h.includes('/brand-logo-theme-dark.png'),'dark-theme image missing');
need(h.includes('tr-brand-logo-image-light')&&h.includes('/brand-logo-theme-light.png'),'light-theme image missing');
need(h.includes('html[data-theme="light"] .tr-brand-logo-image-dark{display:none}'),'light theme hide-dark rule missing');
need(h.includes('html[data-theme="light"] .tr-brand-logo-image-light{display:block}'),'light theme show-light rule missing');
need(h.includes('.tr-brand-logo-button'),'Dashboard brand control missing');
if(fail.length){console.error('Theme Brand Logos build gate: FAIL');for(const f of fail)console.error(' - '+f);process.exit(1);}console.log('Theme Brand Logos build gate: PASS');
