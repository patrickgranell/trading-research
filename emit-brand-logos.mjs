import fs from 'node:fs';
import crypto from 'node:crypto';

const assets=[
  {src:'brand-logo-theme-dark.png',dst:'dist/brand-logo-theme-dark.png',sha256:'c1d9f082e1e6ca2735fda2bcffbe0fe7fd4df34bb028de6ae7866f42a5c3e531'},
  {src:'brand-logo-theme-light.png',dst:'dist/brand-logo-theme-light.png',sha256:'391db80af4509cce4e29c5211634d26a53253f2033863edcee2f88505d276199'}
];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(!fs.existsSync('dist'))throw new Error('dist/ missing: run the main build first.');
for(const asset of assets){
  if(!fs.existsSync(asset.src))throw new Error(`Missing original brand asset: ${asset.src}`);
  const sourceHash=hash(asset.src);
  if(sourceHash!==asset.sha256)throw new Error(`Original brand asset changed: ${asset.src} (${sourceHash})`);
  fs.copyFileSync(asset.src,asset.dst);
  const distHash=hash(asset.dst);
  if(distHash!==asset.sha256)throw new Error(`Emitted brand asset changed: ${asset.dst} (${distHash})`);
}
console.log('Theme brand logos emitted byte-for-byte from the user originals.');
