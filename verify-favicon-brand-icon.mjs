import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const emitter=fs.readFileSync('emit-favicon.mjs','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.ico["'][^>]*>/i.test(html),'index.html debe referenciar /favicon.ico como favicon primario same-origin.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["'][^>]*>/i.test(html),'index.html debe conservar /favicon.png como fallback same-origin.');
need(!/href=["']data:image\//i.test(html),'No se admite favicon data: porque el CSP de producción no permite data: en img-src.');
need(!/<link\s+[^>]*rel=["']icon["'][^>]*href=["']https?:\/\//i.test(html),'El favicon no debe depender de una URL externa.');
need(fs.existsSync('favicon.png.base64'),'Falta favicon.png.base64.');
need(fs.existsSync('emit-favicon.mjs'),'Falta emit-favicon.mjs.');
need(fs.existsSync('verify-favicon-build.mjs'),'Falta verify-favicon-build.mjs para validar el artefacto dist real.');
need(String(pkg?.scripts?.build||'').includes('node emit-favicon.mjs'),'npm run build debe generar los favicons antes de finalizar.');
need(String(pkg?.scripts?.build||'').includes('node verify-favicon-build.mjs'),'npm run build debe verificar los favicons emitidos en dist.');
need(/writeFileSync\(\s*["']dist\/favicon\.ico["']\s*,\s*ico\s*\)/.test(emitter),'emit-favicon.mjs debe escribir dist/favicon.ico.');
need(/writeFileSync\(\s*["']dist\/favicon\.png["']\s*,\s*png\s*\)/.test(emitter),'emit-favicon.mjs debe escribir dist/favicon.png.');
need(/Buffer\.concat\(\[icoHeader,png\]\)/.test(emitter),'El ICO debe construirse desde el PNG validado.');
need(build.includes("img-src 'self' blob:"),'La CSP de build debe permitir imágenes same-origin para los favicons.');

if(fs.existsSync('favicon.png.base64')){
  let bytes=null;
  try{bytes=Buffer.from(fs.readFileSync('favicon.png.base64','utf8').trim(),'base64');}catch{}
  need(bytes&&bytes.length>=512,'La fuente PNG parece vacía o inválida.');
  if(bytes&&bytes.length>=24){
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
console.log(' - primary same-origin /favicon.ico + PNG fallback');
console.log(' - ICO deterministically wraps the validated 64x64 PNG');
console.log(' - npm build emits and post-validates dist favicons');
console.log(" - CSP keeps img-src 'self'");
console.log(' - no data: or external favicon dependency');
