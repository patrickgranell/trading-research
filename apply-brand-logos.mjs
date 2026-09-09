import fs from 'node:fs';
import crypto from 'node:crypto';

const EXPECTED={
  dark:{src:'brand-logo-dark.png',sha256:'391db80af4509cce4e29c5211634d26a53253f2033863edcee2f88505d276199',bytes:195047,dst:'dist/brand-logo-theme-dark.png'},
  light:{src:'brand-logo-light.png',sha256:'c1d9f082e1e6ca2735fda2bcffbe0fe7fd4df34bb028de6ae7866f42a5c3e531',bytes:184522,dst:'dist/brand-logo-theme-light.png'}
};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const cspHash=s=>`'sha256-${crypto.createHash('sha256').update(s,'utf8').digest('base64')}'`;
function copyAsset(theme){
  const spec=EXPECTED[theme];
  if(!fs.existsSync(spec.src))throw new Error(`Missing ${theme}-theme source logo: ${spec.src}`);
  const bytes=fs.readFileSync(spec.src);
  if(bytes.length!==spec.bytes)throw new Error(`${theme}: ${bytes.length} bytes; expected ${spec.bytes}.`);
  const digest=hash(bytes);
  if(digest!==spec.sha256)throw new Error(`${theme}: SHA-256 ${digest}; expected ${spec.sha256}.`);
  fs.writeFileSync(spec.dst,bytes);
  return bytes;
}
const dark=copyAsset('dark');
const light=copyAsset('light');
let html=fs.readFileSync('dist/index.html','utf8');
const brandMarkup='<div class="brand tr-brand-logo"><button class="tr-brand-logo-button" type="button" aria-label="Ir al Dashboard"><img class="tr-brand-logo-image tr-brand-logo-image-dark" src="/brand-logo-theme-dark.png" alt="Trading Research"><img class="tr-brand-logo-image tr-brand-logo-image-light" src="/brand-logo-theme-light.png" alt="Trading Research"></button></div>';
const legacy=/<div class="brand"><div class="brand-dot"><\/div><div><h1>Trading Research<\/h1><small>Backtest &(?:amp;)? Trade Lab<\/small><\/div><\/div>/g;
let replacements=0;
html=html.replace(legacy,()=>{replacements++;return brandMarkup;});
if(!replacements)throw new Error('Legacy sidebar brand block not found.');
const css=`\n/* Batch 70 · Theme Brand Logos */\n.brand.tr-brand-logo{display:block;padding:4px 4px 18px;min-width:0}\n.tr-brand-logo-button{display:block;width:100%;border:0;background:transparent;padding:0;margin:0;text-align:left;cursor:pointer;border-radius:10px}\n.tr-brand-logo-button:focus-visible{outline:2px solid var(--accent);outline-offset:4px}\n.tr-brand-logo-image{display:block;width:100%;height:auto;max-height:72px;object-fit:contain;object-position:left center}\n.tr-brand-logo-image-light{display:none}\nhtml[data-theme="light"] .tr-brand-logo-image-dark{display:none}\nhtml[data-theme="light"] .tr-brand-logo-image-light{display:block}\n@media(max-height:760px){.brand.tr-brand-logo{padding-bottom:12px}.tr-brand-logo-image{max-height:60px}}\n`;
const styleRe=/(<style\s+data-tr-build="[^"]+">)([\s\S]*?)(<\/style>)/i;
if(!styleRe.test(html))throw new Error('Main build style block not found.');
html=html.replace(styleRe,(m,a,b,c)=>a+b+css+c);
const js=`\n/* Batch 70 · sidebar brand Dashboard affordance */\ndocument.addEventListener('click',function trBrandDashboardClick(event){const trigger=event.target&&event.target.closest?event.target.closest('.tr-brand-logo-button'):null;if(!trigger)return;const dashboard=[...document.querySelectorAll('.nav button')].find(button=>/\\bDashboard\\b/.test(button.textContent||''));if(dashboard)dashboard.click();});\n`;
const appScriptRe=/(<script\s+data-tr-build="[^"]+">)([\s\S]*?)(<\/script>)/i;
if(!appScriptRe.test(html))throw new Error('Main build script block not found.');
html=html.replace(appScriptRe,(m,a,b,c)=>a+b+js+c);
fs.writeFileSync('dist/index.html',html);
const scripts=[...html.matchAll(/<script\s+([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>/data-tr-(?:build|style-attr-runtime|reports-purity-runtime|structural-runtime|state-runtime|taxonomy-runtime|persistence-coalescing-runtime|backup-v2-runtime|security-runtime|event-runtime|cloud-v10-runtime|canonical-metrics-runtime|exit-lab-runtime|csp-runtime|style-runtime|operation-cleanup-runtime|blob-lifecycle-runtime|render-closure-runtime)=/.test(m[1]));
const styles=[...html.matchAll(/<style\s+([^>]*)>([\s\S]*?)<\/style>/gi)].filter(m=>/data-tr-build=/.test(m[1]));
if(scripts.length!==18||styles.length!==1)throw new Error(`Unexpected CSP surface scripts=${scripts.length}, styles=${styles.length}.`);
const scriptHashes=scripts.map(m=>cspHash(m[2])),styleHash=cspHash(styles[0][2]);
const manifest=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
const supabasePath=manifest.supabasePath||'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/';
const csp=["default-src 'none'","base-uri 'none'","object-src 'none'","frame-ancestors 'none'","form-action 'self'","script-src 'none'",`script-src-elem ${scriptHashes.join(' ')} ${supabasePath}`,"script-src-attr 'none'","style-src 'none'",`style-src-elem ${styleHash}`,"style-src-attr 'none'","img-src 'self' blob: https://*.supabase.co","connect-src 'self' https://*.supabase.co wss://*.supabase.co","font-src 'self'","media-src 'none'","frame-src 'none'","worker-src 'none'","manifest-src 'self'","upgrade-insecure-requests"].join('; ')+';';
let headers=fs.readFileSync('dist/_headers','utf8');
headers=headers.replace(/(Content-Security-Policy:\s*).*/,(m,p)=>p+csp);
fs.writeFileSync('dist/_headers',headers);
fs.writeFileSync('dist/csp-manifest.json',JSON.stringify({...manifest,scriptHashes,styleHash,csp},null,2)+'\n');
console.log(`Theme Brand Logos applied: dark ${dark.length} bytes, light ${light.length} bytes; ${replacements} brand replacement(s).`);
