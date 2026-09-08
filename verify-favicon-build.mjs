import fs from 'node:fs';

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
need(fs.existsSync('dist/index.html'),'Falta dist/index.html.');
need(fs.existsSync('dist/favicon.ico'),'Falta dist/favicon.ico.');
need(fs.existsSync('dist/favicon.png'),'Falta dist/favicon.png.');

if(fs.existsSync('dist/index.html')){
  const html=fs.readFileSync('dist/index.html','utf8');
  need(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.ico["'][^>]*>/i.test(html),'dist/index.html no referencia /favicon.ico.');
  need(/<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.png["'][^>]*>/i.test(html),'dist/index.html no conserva /favicon.png fallback.');
}

if(fs.existsSync('dist/favicon.png')){
  const png=fs.readFileSync('dist/favicon.png');
  need(png.length>=512,'dist/favicon.png parece vacío.');
  if(png.length>=24){
    need(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'dist/favicon.png no tiene firma PNG válida.');
    need(png.readUInt32BE(16)===64&&png.readUInt32BE(20)===64,'dist/favicon.png no es 64x64.');
  }
}

if(fs.existsSync('dist/favicon.ico')){
  const ico=fs.readFileSync('dist/favicon.ico');
  need(ico.length>=534,'dist/favicon.ico parece vacío.');
  if(ico.length>=30){
    need(ico.readUInt16LE(0)===0&&ico.readUInt16LE(2)===1,'dist/favicon.ico no tiene cabecera ICO válida.');
    need(ico.readUInt16LE(4)>=1,'dist/favicon.ico no contiene imágenes.');
    const offset=ico.readUInt32LE(18);
    need(offset>=22&&offset+8<=ico.length,'dist/favicon.ico tiene offset de imagen inválido.');
    if(offset>=22&&offset+8<=ico.length){
      need(ico.subarray(offset,offset+8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'dist/favicon.ico no contiene payload PNG válido.');
    }
  }
}

if(fail.length){
  console.error('Favicon build artifact gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Favicon build artifact gate OK');
console.log(' - dist/index.html -> /favicon.ico + /favicon.png');
console.log(' - dist/favicon.ico contains PNG-compressed icon payload');
console.log(' - dist/favicon.png valid 64x64 PNG');
