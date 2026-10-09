import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const html=fs.readFileSync('dist/index.html','utf8');
const v=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const opener='<script data-tr-render-closure-runtime="'+v+'">';
const from=html.indexOf(opener),to=html.indexOf('</script>',from);
assert(from>=0&&to>from,'Astra Lote 4 CSP-bundled script missing');
const script=html.slice(from+opener.length,to);
for(const symbol of ['TradingResearchAstraLote4Dialog','trHelpDetailHtml','glossaryBackToResults','tr4-perspective-workspace','tr4-emotional-tabs','emotionalConfigQuestionSelect']){
 assert(script.includes(symbol),'Missing Lote 4 feature: '+symbol);
}
assert(!/src=["']astra-lote4-accessibility-runtime\.js["']/.test(html),'No extra CSP-external runtime');
const csp=JSON.parse(fs.readFileSync('dist/csp-manifest.json','utf8'));
assert.equal(csp.scriptHashes.length,19,'Existing 19 CSP hashes must remain');
const app=fs.readFileSync('app.js','utf8');
assert(!app.includes('Detalle + 20 operaciones'),'Block count must come from actual sample');
assert(app.includes("terms:['máx. ganancia'"),'Maximum must not use average glossary definition');
console.log('Astra Lote 4 bundle PASS: glossary, scope, keyboard, perspective editor and CSP boundary');
const css=fs.readFileSync('styles.css','utf8');
const runtime=fs.readFileSync('astra-lote4-accessibility-runtime.js','utf8');
const setup="window.closeModal=function(){document.querySelector('.modal-backdrop')?.remove();};\nwindow.decision=false;window.confirmCalls=0;\nwindow.confirm=function(){confirmCalls++;return decision;};\nwindow.openHelp=function(){\ndocument.body.insertAdjacentHTML('beforeend','<div class=\"modal-backdrop\"><div class=\"modal\" role=\"dialog\"><div class=\"modal-head\"><h3>Glosario</h3></div><div class=\"modal-body\"><input id=\"glossary-search\" aria-label=\"Buscar\"></div><div class=\"modal-foot\"><button id=\"help-close\" onclick=\"closeModal()\">Cerrar</button></div></div></div>');\n};\nwindow.openTrade=function(){\ndocument.body.insertAdjacentHTML('beforeend','<div class=\"modal-backdrop\"><div class=\"modal\" role=\"dialog\"><div class=\"modal-head\"><h3>Nueva operación</h3></div><div class=\"modal-body\"><form id=\"operationForm\"><div class=\"field\"><label>Notas</label><input id=\"trade-notes\"></div></form></div><div class=\"modal-foot\"><button id=\"trade-cancel\" data-tr-onclick=\"closeModal()\">Cancelar</button><button id=\"trade-save\" type=\"button\">Guardar</button></div></div></div>');\ndocument.getElementById('trade-cancel').addEventListener('click',()=>closeModal());\n};";
const inspect="(async()=>{\nconst pause=()=>new Promise(r=>setTimeout(r,35));\nconst out={};\ndocument.getElementById('open-help').click();await pause();\nout.helpOpened=!!document.querySelector('.modal-backdrop');\nout.initialFocus=document.activeElement?.id;\nconst close=document.getElementById('help-close');\nclose.focus();close.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));\nout.wrapForward=document.activeElement?.id;\nconst search=document.getElementById('glossary-search');\nsearch.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));\nout.wrapBackward=document.activeElement?.id;\ndocument.getElementById('open-help').focus();out.trapped=!!document.activeElement?.closest('.modal-backdrop');\nsearch.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await pause();\nout.escapeClosed=!document.querySelector('.modal-backdrop');\nout.focusRestored=document.activeElement?.id;\ndocument.getElementById('open-trade').click();await pause();\nout.tradeFocus=document.activeElement?.id;\nout.fieldLabel=document.querySelector('#operationForm label')?.htmlFor;\ndocument.getElementById('trade-notes').value='unsaved edit';\ndocument.getElementById('trade-cancel').click();await pause();\nout.preventDiscard=!!document.querySelector('.modal-backdrop');\nout.confirmedOnce=confirmCalls===1;\ndecision=true;document.getElementById('trade-cancel').click();await pause();\nout.discardClosed=!document.querySelector('.modal-backdrop');\nout.tradeFocusRestored=document.activeElement?.id;\ndocument.body.dataset.l4Result=encodeURIComponent(JSON.stringify(out));\n})();";
const page='<html lang="es"><head><meta charset="utf-8"><style>'+css+'</style></head><body><button id="open-help" onclick="openHelp()">Abrir Glosario</button><button id="open-trade" onclick="openTrade()">Nueva operación</button><script>'+setup+'</script><script>'+runtime+'</script><script>'+inspect+'</script></body></html>';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr-l4-'));
try{
 const file=path.join(dir,'test.html');fs.writeFileSync(file,page);
 let chromium=null;
 for(const bin of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)){
  if(spawnSync(bin,['--version'],{encoding:'utf8'}).status===0){chromium=bin;break;}
 }
 assert(chromium,'Chromium required for Lote 4 keyboard regression');
 const p=spawnSync(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1280,900','--virtual-time-budget=3000','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:3000000});
 assert.equal(p.status,0,p.stderr?.slice(-800));
 const raw=p.stdout.match(/data-l4-result="([^"]+)"/)?.[1];
 assert(raw,'No browser assertion result. '+p.stderr?.slice(-800));
 const out=JSON.parse(decodeURIComponent(raw));
 assert(out.helpOpened,'Glossary did not open');
 assert.equal(out.initialFocus,'glossary-search');
 assert.equal(out.wrapForward,'glossary-search');
 assert.equal(out.wrapBackward,'help-close');
 assert(out.trapped,'Focus escaped to background');
 assert(out.escapeClosed,'Escape failed to close read-only glossary');
 assert.equal(out.focusRestored,'open-help','Focus not restored to glossary trigger');
 assert.equal(out.tradeFocus,'trade-notes');
 assert.equal(out.fieldLabel,'trade-notes');
 assert(out.preventDiscard&&out.confirmedOnce,'Unsaved form cancel was not protected');
 assert(out.discardClosed,'Confirmed discard failed to close form');
 assert.equal(out.tradeFocusRestored,'open-trade');
 console.log('Astra Lote 4 Chromium PASS: focus, Tab/Shift+Tab, Escape, dirty cancel, labels and return');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
