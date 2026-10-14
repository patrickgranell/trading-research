/* PR4: print/PDF smoke for the existing editable report preview and multi-page layout.
 * Chrome operates on disposable file:// data with no persistent writes. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="https:\/\/cdn\.jsdelivr\.net[^"]*"[^>]*><\/script>/,'');
const inject=String.raw`(async()=>{
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 await wait(370);
 try{
  reportsViewState.tab='builder';
  TradingResearchActions.navigate('reports');await wait(110);
  const documentNode=document.querySelector('#view .trvis4-report-document');
  if(!documentNode)throw Error('Canonical report document missing');
  const section=document.createElement('section');
  section.className='report-section trvis4-multipage-fixture';
  section.innerHTML='<h3>Prueba de composición editorial</h3><p>Texto de prueba no persistente del navegador de validación. No refleja operaciones reales.</p>'+
    '<div class="report-fixture-rows">'+Array.from({length:18},(_,i)=>'<p>Fila '+(i+1)+' · Lectura de muestra y desglose. El documento debe conservar tamaño y márgenes al imprimir.</p>').join('')+'</div>';
  for(let i=0;i<8;i++)documentNode.appendChild(section.cloneNode(true));
  document.body.dataset.trvis4PrintReady='1';
 }catch(err){document.body.dataset.trvis4PrintFailure=String(err);}
})();`;
html=html.replace('</body>','<script>'+inject+'</script></body>');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trvis4-print-'));
try{
 const file=path.join(dir,'report.html'),pdf=path.join(dir,'report.pdf');
 fs.writeFileSync(file,html);
 const chrome=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean).find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chrome,'Chromium required');
 const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1440,950',
  '--no-pdf-header-footer','--virtual-time-budget=14000','--user-data-dir='+path.join(dir,'chrome'),
  '--print-to-pdf='+pdf,'file://'+file];
 const run=spawnSync(chrome,args,{encoding:'utf8',timeout:75000,maxBuffer:5000000});
 assert.equal(run.status,0,run.stderr?.slice(-1500));
 assert(fs.existsSync(pdf),'Chromium did not generate the PDF');
 const bytes=fs.readFileSync(pdf);
 assert(bytes.subarray(0,5).toString()==='%PDF-','Invalid PDF magic');
 assert(bytes.length>15000,'Unexpectedly small document: '+bytes.length);
 const info=spawnSync('pdfinfo',[pdf],{encoding:'utf8'});
 let pages=null;
 if(info.status===0){
  const found=info.stdout.match(/^Pages:\s+(\d+)/m);pages=found?Number(found[1]):null;
  assert(pages>=2,'Report PDF must paginate into multiple pages; actual '+pages);
 }
 const txt=spawnSync('pdftotext',[pdf,'-'],{encoding:'utf8'});
 if(txt.status===0){
  assert(txt.stdout.includes('Prueba de composición editorial'),'Report fixture is absent in PDF');
  assert(txt.stdout.includes('Fila 18'),'Report content clipped during print');
 }
 console.log('PR4 report PDF smoke PASS: bytes='+bytes.length+', pages='+(pages??'PDF metadata tool unavailable')+', document content printed.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
