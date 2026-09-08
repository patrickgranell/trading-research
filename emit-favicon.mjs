import fs from 'node:fs';

const source=fs.readFileSync('favicon.png.base64','utf8').trim();
const bytes=Buffer.from(source,'base64');
if(bytes.length<512)throw new Error('favicon source is empty or invalid');
if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('favicon source is not PNG');
if(bytes.readUInt32BE(16)!==64||bytes.readUInt32BE(20)!==64)throw new Error('favicon source must be 64x64');
fs.writeFileSync('dist/favicon.png',bytes);
console.log(`Generated favicon -> dist/favicon.png (${bytes.length} bytes)`);
