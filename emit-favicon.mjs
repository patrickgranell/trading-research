import fs from 'node:fs';

const PNG_SIG=Buffer.from([137,80,78,71,13,10,26,10]);
function readPng(path,size){
  const source=fs.readFileSync(path,'utf8').trim();
  const png=Buffer.from(source,'base64');
  if(png.length<128)throw new Error(`${path}: favicon source is empty or invalid`);
  if(!png.subarray(0,8).equals(PNG_SIG))throw new Error(`${path}: source is not PNG`);
  if(png.readUInt32BE(16)!==size||png.readUInt32BE(20)!==size)throw new Error(`${path}: expected ${size}x${size}`);
  return png;
}

const png16=readPng('favicon-16.png.base64',16);
const png32=readPng('favicon-32.png.base64',32);
const png64=readPng('favicon.png.base64',64);

fs.writeFileSync('dist/favicon-16.png',png16);
fs.writeFileSync('dist/favicon-32.png',png32);
fs.writeFileSync('dist/favicon-64.png',png64);
// Conventional PNG fallback points at the browser-tab-optimized 32px source.
fs.writeFileSync('dist/favicon.png',png32);

// Standard multi-image ICO: 16px + 32px PNG-compressed payloads.
const images=[{size:16,png:png16},{size:32,png:png32}];
const directorySize=6+(16*images.length);
const header=Buffer.alloc(directorySize);
header.writeUInt16LE(0,0); // reserved
header.writeUInt16LE(1,2); // type: icon
header.writeUInt16LE(images.length,4);
let offset=directorySize;
images.forEach((image,index)=>{
  const p=6+(index*16);
  header.writeUInt8(image.size===256?0:image.size,p);
  header.writeUInt8(image.size===256?0:image.size,p+1);
  header.writeUInt8(0,p+2); // palette
  header.writeUInt8(0,p+3); // reserved
  header.writeUInt16LE(1,p+4); // planes
  header.writeUInt16LE(32,p+6); // bit depth
  header.writeUInt32LE(image.png.length,p+8);
  header.writeUInt32LE(offset,p+12);
  offset+=image.png.length;
});
const ico=Buffer.concat([header,...images.map(x=>x.png)]);
fs.writeFileSync('dist/favicon.ico',ico);

console.log(`Generated favicons -> 16px ${png16.length} bytes, 32px ${png32.length} bytes, 64px ${png64.length} bytes, ICO ${ico.length} bytes`);
