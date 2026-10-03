/* Batch 76 · Desktop-only source transformer.
 * The verified Web artifact is copied before transformation; no Web source or
 * Cloudflare response is mutated here. Anchor checks abort on upstream drift.
 */
import fs from 'node:fs';
const source='desktop-dist/index.html';
if(!fs.existsSync(source))throw new Error('Desktop artifact missing');
const html=fs.readFileSync(source,'utf8');
const start=html.indexOf('<script data-tr-build=');
if(start<0)throw new Error('Desktop build app script anchor missing');
const open=html.indexOf('>',start)+1,end=html.indexOf('</script>',open);
if(!open||end<0)throw new Error('Desktop build app script boundary missing');
const app=html.slice(open,end);
if(!app.includes('trCoreBootstrap();')||!app.includes('async function trCoreBootstrap()')||!app.includes('function trCoreQueueStateWrite('))throw new Error('Desktop authority injection anchor drift');
console.log('Batch 76 Desktop-only source transform: core anchors located; implementation remains RED until authority hook is integrated.');
