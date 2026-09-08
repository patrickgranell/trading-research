import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const emitter=fs.readFileSync('emit-favicon.mjs','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(/<link\s+[^>]*rel=["']icon["'][^>]*sizes=["']32x32["'][^>]*href=["']\/favicon-32\.png["'][^>]*>/i.test(html),'index.html debe referenciar /favicon-32.png como favicon de pestaña 32x32.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*sizes=["']16x16["'][^>]*href=["']\/favicon-16\.png["'][^>]*>/i.test(html),'index.html debe referenciar /favicon-16.png como favicon de pestaña 16x16.');
need(/<link\s+[^>]*rel=["']shortcut icon["'][^>]*href=["']\/favicon\.ico["'][^>]*>/i.test(html),'index.html debe conservar /favicon.ico como fallback clásico.');
need(!/href=["']data:image\//i.test(html),'No se admite favicon data: porque el CSP de producción no permite data: en img-src.');
need(!/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']https?:\/\//i.test(html),'El favicon no debe depender de una URL externa.');
for(const file of ['favicon-16.png.base64','favicon-32.png.base64','favicon.png.base64'])need(fs.existsSync(file),`Falta ${file}.`);
need(fs.existsSync('emit-favicon.mjs'),'Falta emit-favicon.mjs.');
need(fs.existsSync('verify-favicon-build.mjs'),'Falta verify-favicon-build.mjs para validar el artefacto dist real.');
need(String(pkg?.scripts?.build||'').includes('node emit-favicon.mjs'),'npm run build debe generar los favicons antes de finalizar.');
need(String(pkg?.scripts?.build||'').includes('node verify-favicon-build.mjs'),'npm run build debe verificar los favicons emitidos en dist.');
need(emitter.includes("readPng('favicon-16.png.base64',16)"),'emit-favicon.mjs debe consumir la fuente 16x16.');
need(emitter.includes("readPng('favicon-32.png.base64',32)"),'emit-favicon.mjs debe consumir la fuente 32x32.');
need(emitter.includes("readPng('favicon.png.base64',64)"),'emit-favicon.mjs debe conservar la fuente 64x64.');
need(emitter.includes("const images=[{size:16,png:png16},{size:32,png:png32}]"),'El ICO debe contener entradas 16px y 32px.');
need(build.includes("img-src 'self' blob:"),'La CSP de build debe permitir imágenes same-origin para los favicons.');

const expected=[['favicon-16.png.base64',16],['favicon-32.png.base64',32],['favicon.png.base64',64]];
for(const [file,size] of expected){
  if(!fs.existsSync(file))continue;
  let bytes=null;
  try{bytes=Buffer.from(fs.readFileSync(file,'utf8').trim(),'base64');}catch{}
  need(bytes&&bytes.length>=128,`${file} parece vacío o inválido.`);
  if(bytes&&bytes.length>=24){
    need(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`${file} no tiene firma PNG válida.`);
    need(bytes.readUInt32BE(16)===size&&bytes.readUInt32BE(20)===size,`${file} debe ser ${size}x${size}.`);
  }
}

if(fail.length){
  console.error('Favicon brand icon gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Favicon brand icon gate OK');
console.log(' - dedicated browser-tab PNGs: 16x16 + 32x32');
console.log(' - classic ICO fallback contains 16px + 32px payloads');
console.log(' - tightly cropped 64px brand source retained');
console.log(" - CSP keeps img-src 'self'");
console.log(' - no data: or external favicon dependency');
