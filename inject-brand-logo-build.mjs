import fs from 'node:fs';
import crypto from 'node:crypto';

const version='31.25.0';
const htmlPath='dist/index.html';
const headersPath='dist/_headers';
const css=fs.readFileSync('brand-logo.css','utf8');
const runtime=fs.readFileSync('brand-logo-runtime.js','utf8');
const cspHash=text=>`'sha256-${crypto.createHash('sha256').update(text,'utf8').digest('base64')}'`;

let html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('data-tr-brand-logo-style='))html=html.replace('</head>',`  <style data-tr-brand-logo-style="${version}">${css}</style>\n</head>`);
if(!html.includes('data-tr-brand-logo-runtime='))html=html.replace('</body>',`  <script data-tr-brand-logo-runtime="${version}">${runtime}</script>\n</body>`);
fs.writeFileSync(htmlPath,html);

let headers=fs.readFileSync(headersPath,'utf8');
const scriptHash=cspHash(runtime),styleHash=cspHash(css);
if(!headers.includes(scriptHash))headers=headers.replace('script-src-elem ','script-src-elem '+scriptHash+' ');
if(!headers.includes(styleHash))headers=headers.replace('style-src-elem ','style-src-elem '+styleHash+' ');
fs.writeFileSync(headersPath,headers);
console.log('Theme brand logo runtime/style injected with CSP hashes.');
