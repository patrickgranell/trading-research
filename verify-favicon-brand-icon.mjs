import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["'][^>]*>/i.test(html),'index.html debe referenciar /favicon.png como recurso same-origin.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*type=["']image\/png["'][^>]*>/i.test(html),'El favicon debe declarar type=image/png.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*sizes=["']64x64["'][^>]*>/i.test(html),'El favicon debe declarar sizes=64x64.');
need(!/href=["']data:image\//i.test(html),'No se admite favicon data: porque el CSP de producción no permite data: en img-src.');
need(!/<link\s+[^>]*rel=["']icon["'][^>]*href=["']https?:\/\//i.test(html),'El favicon no debe depender de una URL externa.');
need(fs.existsSync('favicon.png'),'Falta el recurso fuente favicon.png.');
need(/copyFileSync\(\s*["']favicon\.png["']\s*,\s*["']dist\/favicon\.png["']\s*\)/.test(build),'build.mjs debe copiar favicon.png a dist/favicon.png.');

if(fs.existsSync('favicon.png')){
  const bytes=fs.readFileSync('favicon.png');
  need(bytes.length>=512,'favicon.png parece vacío o inválido.');
  if(bytes.length>=24){
    need(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'favicon.png no tiene firma PNG válida.');
    need(bytes.readUInt32BE(16)===64&&bytes.readUInt32BE(20)===64,`favicon.png debe ser 64x64; obtuvo ${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}.`);
  }
}

if(fail.length){
  console.error('Favicon brand icon gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Favicon brand icon gate OK');
console.log(' - same-origin /favicon.png: 64x64 PNG');
console.log(' - build copies favicon.png -> dist/favicon.png');
console.log(' - no data: or external favicon dependency');
