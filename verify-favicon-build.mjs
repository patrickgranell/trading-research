import fs from 'node:fs';

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
need(fs.existsSync('dist/index.html'),'Falta dist/index.html.');
for(const file of ['dist/favicon.ico','dist/favicon-16.png','dist/favicon-32.png','dist/favicon-64.png','dist/favicon.png'])need(fs.existsSync(file),`Falta ${file}.`);

if(fs.existsSync('dist/index.html')){
  const html=fs.readFileSync('dist/index.html','utf8');
  need(/<link\s+[^>]*rel=["']icon["'][^>]*sizes=["']32x32["'][^>]*href=["']\/favicon-32\.png["'][^>]*>/i.test(html),'dist/index.html no referencia /favicon-32.png.');
  need(/<link\s+[^>]*rel=["']icon["'][^>]*sizes=["']16x16["'][^>]*href=["']\/favicon-16\.png["'][^>]*>/i.test(html),'dist/index.html no referencia /favicon-16.png.');
  need(/<link\s+[^>]*rel=["']shortcut icon["'][^>]*href=["']\/favicon\.ico["'][^>]*>/i.test(html),'dist/index.html no referencia /favicon.ico.');
}

const PNG_SIG=Buffer.from([137,80,78,71,13,10,26,10]);
function verifyPng(path,size){
  if(!fs.existsSync(path))return;
  const png=fs.readFileSync(path);
  need(png.length>=128,`${path} parece vacío.`);
  if(png.length>=24){
    need(png.subarray(0,8).equals(PNG_SIG),`${path} no tiene firma PNG válida.`);
    need(png.readUInt32BE(16)===size&&png.readUInt32BE(20)===size,`${path} no es ${size}x${size}.`);
  }
}
verifyPng('dist/favicon-16.png',16);
verifyPng('dist/favicon-32.png',32);
verifyPng('dist/favicon-64.png',64);
verifyPng('dist/favicon.png',32);

if(fs.existsSync('dist/favicon.ico')){
  const ico=fs.readFileSync('dist/favicon.ico');
  need(ico.length>=38,'dist/favicon.ico parece vacío.');
  if(ico.length>=38){
    need(ico.readUInt16LE(0)===0&&ico.readUInt16LE(2)===1,'dist/favicon.ico no tiene cabecera ICO válida.');
    need(ico.readUInt16LE(4)===2,'dist/favicon.ico debe contener exactamente 2 imágenes.');
    const expected=[16,32];
    for(let i=0;i<2;i++){
      const p=6+(i*16),size=ico.readUInt8(p)||256,bytes=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12);
      need(size===expected[i],`Entrada ICO ${i} debería ser ${expected[i]}px y es ${size}px.`);
      need(offset>=38&&offset+bytes<=ico.length,`Entrada ICO ${i} tiene rango inválido.`);
      if(offset>=38&&offset+8<=ico.length)need(ico.subarray(offset,offset+8).equals(PNG_SIG),`Entrada ICO ${i} no contiene payload PNG válido.`);
    }
  }
}

if(fs.existsSync('dist/favicon.png')&&fs.existsSync('dist/favicon-32.png')){
  need(fs.readFileSync('dist/favicon.png').equals(fs.readFileSync('dist/favicon-32.png')),'dist/favicon.png debe ser alias byte-for-byte del favicon 32px.');
}

if(fail.length){
  console.error('Favicon build artifact gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Favicon build artifact gate OK');
console.log(' - dist/index.html -> 32px + 16px PNG + classic ICO');
console.log(' - dist/favicon.ico contains 16px + 32px PNG-compressed entries');
console.log(' - dist/favicon.png aliases the 32px browser-tab asset');
