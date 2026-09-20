import fs from 'node:fs';

const fail=(message)=>{throw new Error('Desktop offline gate: '+message);};
const htmlPath='desktop-dist/index.html';
if(!fs.existsSync(htmlPath))fail('desktop-dist/index.html is missing.');

const html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('name="trading-research-desktop-channel" content="0.1.0"'))fail('desktop channel marker is missing.');
if(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/i.test(html))fail('Supabase CDN SDK remains in the Desktop artifact.');
if(/<(?:script|img|link)[^>]+(?:src|href)=["']https?:\/\//i.test(html))fail('an external HTTP(S) asset remains in the Desktop HTML.');

const config=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
if(config.productName!=='Trading Research')fail('unexpected Tauri productName.');
if(config.version!=='0.1.0')fail('unexpected Desktop version.');
if(config.build?.frontendDist!=='../desktop-dist')fail('Tauri frontendDist must point at ../desktop-dist.');
const targets=Array.isArray(config.bundle?.targets)?config.bundle.targets:[config.bundle?.targets].filter(Boolean);
if(!targets.includes('nsis'))fail('NSIS bundle target is required.');

console.log('Desktop offline gate OK: local frontend, no external HTTP(S) assets, NSIS target configured.');
