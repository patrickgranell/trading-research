import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const match=html.match(/<link\s+rel=["']icon["'][^>]*href=["']data:image\/png;base64,([^"']+)["'][^>]*>/i)
  || html.match(/<link\s+[^>]*href=["']data:image\/png;base64,([^"']+)["'][^>]*rel=["']icon["'][^>]*>/i);
need(!!match,'Falta favicon PNG embebido en index.html.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*type=["']image\/png["'][^>]*>/i.test(html),'El favicon debe declarar type=image/png.');
need(/<link\s+[^>]*rel=["']icon["'][^>]*sizes=["']64x64["'][^>]*>/i.test(html),'El favicon debe declarar sizes=64x64.');
need(!/<link\s+[^>]*rel=["']icon["'][^>]*href=["']https?:\/\//i.test(html),'El favicon no debe depender de una URL externa.');

if(match){
  let bytes=null;
  try{bytes=Buffer.from(match[1],'base64');}catch{}
  need(bytes&&bytes.length>=512,'El favicon embebido parece vacío o inválido.');
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
console.log(' - embedded transparent PNG favicon: 64x64');
console.log(' - no external favicon dependency');
