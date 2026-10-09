import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const runtime=fs.readFileSync('astra-lote4-accessibility-runtime.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const setup=`
window.render=()=>{};window.TradingResearchActions={
 closeModal(){document.querySelector('.modal-backdrop')?.remove();},
 openContextHelp(id){document.body.insertAdjacentHTML('beforeend','<div class="modal-backdrop"><div class="modal"><section class="context-help-modal"><p>Qué significa</p><p>Para qué sirve</p></section></div></div>');}
};
`;
const checks=`
const panel=document.querySelector('#config');
panel.innerHTML='<section class="card panel"><div class="panel-title"><h3>Emocional</h3></div><div class="emotion-config-grid">Estados</div><section class="session-taxonomy-section"><div class="session-question-list">'+[0,1,2].map(i=>'<div class="form-grid"><input value="Pregunta '+i+'"></div>').join('')+'</div></section><section class="perspective-config-section"><div class="perspective-config-list">'+Array.from({length:18},(_,i)=>'<article class="perspective-config-card"><header><strong>Autor '+i+'</strong></header><blockquote>Frase '+i+'</blockquote><div class="perspective-config-meta"><strong>Contexto '+i+'</strong></div></article>').join('')+'</div></section></section>';
window.TradingResearchAstraLote4.decorateEmotional(panel);
const questions=panel.querySelectorAll('.tr4-local-tab').length;
const questionVisible=[...panel.querySelectorAll('.session-question-list>.form-grid')].filter(x=>!x.hidden).length;
window.TradingResearchActions.tr4EmotionTab('library');
panel.innerHTML='<section class="card panel"><div class="panel-title"><h3>Emocional</h3></div><div class="emotion-config-grid">Estados</div><section class="session-taxonomy-section"></section><section class="perspective-config-section"><div class="perspective-config-list">'+Array.from({length:18},(_,i)=>'<article class="perspective-config-card"><header><strong>Autor '+i+'</strong></header><blockquote>Frase '+i+'</blockquote><div class="perspective-config-meta"><strong>Contexto '+i+'</strong></div></article>').join('')+'</div></section></section>';
window.TradingResearchAstraLote4.decorateEmotional(panel);
const shown=[...panel.querySelectorAll('.perspective-config-card')].filter(x=>!x.hidden).length;
const search=panel.querySelector('.tr4-library-toolbar input');
search.value='Autor 17';
window.TradingResearchActions.tr4EmotionSearch.call(search);
const found=[...panel.querySelectorAll('.perspective-config-card')].filter(x=>!x.hidden);
const match=found.length===1&&found[0].querySelector('header strong')?.textContent==='Autor 17';
document.body.insertAdjacentHTML('beforeend','<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>Glosario</h3></div><div class="glossary-search"><input id="glossary-search" value="win"></div><div id="glossary-list"><button>Win rate</button></div></div></div>');
window.TradingResearchActions.openContextHelp('wr');
const modalCount=document.querySelectorAll('.modal-backdrop').length;
const detail=!!document.querySelector('.tr4-glossary-detail');
document.querySelector('.tr4-glossary-back')?.click();
const recovered=document.querySelector('#glossary-search')?.value==='win'&&!document.querySelector('#glossary-list').hidden;
document.body.setAttribute('data-smoke',encodeURIComponent(JSON.stringify({questions,questionVisible,shown,match,modalCount,detail,recovered})));
`;
const page='<html><head><style>'+css+'</style></head><body><div id="config"></div><script>'+setup+'</script><script>'+runtime+'</script><script>'+checks+'</script></body></html>';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr-l4-'));
try{
 const file=path.join(dir,'suite.html');fs.writeFileSync(file,page);
 const chrome=['google-chrome','chromium','chromium-browser'].find(b=>spawnSync(b,['--version']).status===0);
 assert(chrome,'Chromium unavailable');
 const r=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--virtual-time-budget=500','--dump-dom','file://'+file],{encoding:'utf8',timeout:25000,maxBuffer:3000000});
 assert.equal(r.status,0,r.stderr?.slice(-900));
 const encoded=r.stdout.match(/data-smoke="([^"]+)"/)?.[1];assert(encoded,'Browser snapshot missing');
 const obj=JSON.parse(decodeURIComponent(encoded));
 assert.equal(obj.questions,3);assert.equal(obj.questionVisible,1);assert.equal(obj.shown,1);assert(obj.match,'Search must reveal matching author editor');
 assert.equal(obj.modalCount,1);assert(obj.detail&&obj.recovered);
 console.log('Lote 4 Chromium PASS: 3 tabs, one perspective editor, one glossary modal, search restoration');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
