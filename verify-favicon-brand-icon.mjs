import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const emitter=fs.readFileSync('emit-favicon.mjs','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["'][^>]*>/i.test(html),'index.html debe referenciar /favicon.png como recurso same-origin.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*type=["']image\/png["'][^>]*>/i.test(html),'El favicon debe declarar type=image/png.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*sizes=["']64x64["'][^>]*>/i.test(html),'El favicon debe declarar sizes=64x64.');
need(!/href=["']data:image\//i.test(html),'No se admite favicon data: porque el CSP de producción no permite data: en img-src.');
need(!/<link\s+[^>]*rel=["']icon["'][^>]*href=["']https?:\/\//i.test(html),'El favicon no debe depender de una URL externa.');
need(fs.existsSync('favicon.png.base64'),'Falta favicon.png.base64.');
need(fs.existsSync('emit-favicon.mjs'),'Falta emit-favicon.mjs.');
need(String(pkg?.scripts?.build||'').includes('node emit-favicon.mjs'),'npm run build debe generar el favicon antes de finalizar.');
need(/writeFileSync\(\s*["']dist\/favicon\.png["']\s*,\s*bytes\s*\)/.test(emitter),'emit-favicon.mjs debe escribir dist/favicon.png.');
need(build.includes("img-src 'self' blob:"),'La CSP de build debe permitir imágenes same-origin para /favicon.png.');

if(fs.existsSync('favicon.png.base64')){
  let bytes=null;
  try{bytes=Buffer.from(fs.readFileSync('favicon.png.base64','utf8').trim(),'base64');}catch{}
  need(bytes&&bytes.length>=512,'La fuente base64 del favicon parece vacía o inválida.');
  if(bytes&&bytes.length>=24){
    need(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'El favicon no tiene firma PNG válida.');
    need(bytes.readUInt32BE(16)===64&&bytes.readUInt32BE(20)===64,`El favicon debe ser 64x64; obtuvo ${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}.`);
  }
}

if(fail.length){
  console.error('Favicon brand icon gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Favicon brand icon gate OK');
console.log(' - same-origin /favicon.png: 64x64 PNG');
console.log(' - deterministic source: favicon.png.base64');
console.log(' - npm build emits dist/favicon.png');
console.log(" - CSP keeps img-src 'self'");
console.log(' - no data: or external favicon dependency');
