import fs from 'node:fs';
import crypto from 'node:crypto';

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const required=['brand-logo-runtime.js','brand-logo.css','emit-brand-logos.mjs','inject-brand-logo-build.mjs','verify-brand-logos-build.mjs','brand-logo-theme-dark.png','brand-logo-theme-light.png'];
for(const file of required)need(fs.existsSync(file),`missing ${file}`);
const hash=file=>fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):'';
need(hash('brand-logo-theme-dark.png')==='c1d9f082e1e6ca2735fda2bcffbe0fe7fd4df34bb028de6ae7866f42a5c3e531','dark-theme original PNG hash mismatch');
need(hash('brand-logo-theme-light.png')==='391db80af4509cce4e29c5211634d26a53253f2033863edcee2f88505d276199','light-theme original PNG hash mismatch');
const runtime=fs.existsSync('brand-logo-runtime.js')?fs.readFileSync('brand-logo-runtime.js','utf8'):'';
const css=fs.existsSync('brand-logo.css')?fs.readFileSync('brand-logo.css','utf8'):'';
const pkg=fs.existsSync('package.json')?fs.readFileSync('package.json','utf8'):'';
need(runtime.includes('/brand-logo-theme-dark.png')&&runtime.includes('/brand-logo-theme-light.png'),'runtime missing theme assets');
need(runtime.includes("getAttribute('data-theme')"),'runtime missing theme boundary');
need(runtime.includes("document.querySelector('.brand')"),'runtime must target the existing .brand host');
need(runtime.includes("includes('Dashboard')"),'brand home control must route through existing Dashboard navigation');
need(!/favicon/i.test(runtime),'brand runtime must not touch favicon');
need(css.includes('.tr-brand-logo')&&css.includes('object-fit:contain'),'brand CSS must preserve original aspect ratio');
need(!/url\(/i.test(css),'brand CSS must not reinterpret/select artwork through CSS URLs');
need(pkg.includes('emit-brand-logos.mjs')&&pkg.includes('inject-brand-logo-build.mjs')&&pkg.includes('verify-brand-logos-build.mjs'),'build pipeline missing brand integration stages');
if(fail.length){console.error('Theme Brand Logos gate: FAIL');for(const item of fail)console.error('- '+item);process.exit(1);}
console.log('Theme Brand Logos gate: PASS');
console.log(' - exact original PNG hashes verified');
console.log(' - dark/light theme mapping verified');
console.log(' - sidebar brand host only; favicon untouched');
