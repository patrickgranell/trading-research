import fs from 'node:fs';

const source=fs.readFileSync('favicon.png.base64','utf8').trim();
const png=Buffer.from(source,'base64');
if(png.length<512)throw new Error('favicon source is empty or invalid');
if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('favicon source is not PNG');
if(png.readUInt32BE(16)!==64||png.readUInt32BE(20)!==64)throw new Error('favicon source must be 64x64');

fs.writeFileSync('dist/favicon.png',png);

// ICO header + one directory entry whose payload is the validated 64x64 PNG.
// Modern browsers support PNG-compressed images inside ICO containers.
const icoHeader=Buffer.alloc(22);
icoHeader.writeUInt16LE(0,0);      // reserved
icoHeader.writeUInt16LE(1,2);      // type: icon
icoHeader.writeUInt16LE(1,4);      // one image
icoHeader.writeUInt8(64,6);        // width
icoHeader.writeUInt8(64,7);        // height
icoHeader.writeUInt8(0,8);         // palette
icoHeader.writeUInt8(0,9);         // reserved
icoHeader.writeUInt16LE(1,10);     // color planes
icoHeader.writeUInt16LE(32,12);    // bit depth
icoHeader.writeUInt32LE(png.length,14);
icoHeader.writeUInt32LE(22,18);    // payload offset
const ico=Buffer.concat([icoHeader,png]);
fs.writeFileSync('dist/favicon.ico',ico);

console.log(`Generated favicons -> dist/favicon.ico (${ico.length} bytes), dist/favicon.png (${png.length} bytes)`);
