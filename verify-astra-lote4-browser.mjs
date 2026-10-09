import fs from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const css=fs.readFileSync('styles.css','utf8'),runtime=fs.readFileSync('astra-lote4-visual-runtime.js','utf8');
const prep=[
 'window.TradingResearchActions={};',
 'window.TradingResearchCurrentViewReadContract={current:()=>"config"};',
 'window.TradingResearchConfigTabStateContract={current:()=>"emotional"};',
 'window.TradingResearchContentEncodingContract={html:s=>String(s)};',
 'const CONTEXT_HELP=[{title:"WR",summary:"Aciertos",body:"Ratio de ganadoras",use:"Medir efectividad"},{title:"PF",summary:"Ganancias versus pérdidas",body:"Relación de beneficios",use:"Medir ventaja"}];',
 'let closed=0;function closeModal(){document.querySelector(".modal-backdrop")?.remove();closed++;}',
 'function trRenderViewHtml(){',
 ' const p=(id,author,disabled)=>"<article class=\\"perspective-config-card "+(disabled?"inactive":"")+"\\"><header><strong>"+author+"</strong></header><blockquote>Contexto "+id+"</blockquote><button data-perspective-id=\\""+id+"\\">Editar</button></article>";',
 ' return "<div class=\\"config-tab-content\\"><section class=\\"card panel\\"><header class=\\"panel-title\\">Configuración emocional</header><div class=\\"emotion-config-grid\\">Categorías originales</div><section class=\\"session-taxonomy-section\\"><label>Pregunta <input id=\\"question\\" value=\\"Nivel de confianza\\"></label></section><section class=\\"perspective-config-section\\"><header>Perspectivas</header><div class=\\"perspective-config-list\\">"+p("a","Autor A",false)+p("b","Autor B",false)+p("c","Autor C",true)+"</div></section></section></div>";',
 '}'
].join('\n');
const inspect=[
 '(async()=>{',
 'document.querySelector("#view").innerHTML=trRenderViewHtml("config");',
 'const scope=document.querySelector(".config-tab-content");',
 'const output={tabs:scope.querySelectorAll(".l4-emotional-tab").length,initial:scope.querySelectorAll(".l4-emotional-panel:not([hidden])").length,preserved:!!scope.querySelector("#question")};',
 'window.TradingResearchActions.trAstraL4EmotionTab.call(scope.querySelector("[data-l4-tab=library]"));',
 'output.library={visible:scope.querySelectorAll(".l4-emotional-panel:not([hidden])").length,records:scope.querySelectorAll(".perspective-config-card").length,oneVisible:scope.querySelectorAll(".perspective-config-card:not([hidden])").length};',
 'const filter=scope.querySelector(".l4-perspective-controls input");filter.value="Autor C";window.TradingResearchActions.trAstraL4PerspectiveFilter.call(filter);',
 'output.selected=scope.querySelector(".l4-perspective-select").value;',
 'document.querySelector("#launcher").click();',
 'document.body.insertAdjacentHTML("beforeend", "<div class=\\"modal-backdrop\\"><div class=\\"modal\\" role=\\"dialog\\"><div class=\\"modal-head\\"><h3>Glosario</h3></div><div class=\\"modal-body\\"><div class=\\"glossary-search\\"><input id=\\"glossary-search\\" value=\\"pérdidas\\"></div><div id=\\"glossary-list\\"><button id=\\"wr\\">WR</button><button id=\\"pf\\">PF</button></div></div><div class=\\"modal-foot\\"><button id=\\"close\\">Cerrar</button></div></div></div>");',
 'await new Promise(done=>setTimeout(done,1));',
 'const modal=document.querySelector(".modal"),search=modal.querySelector("#glossary-search");',
 'output.start=document.activeElement.id;',
 'modal.querySelector("#pf").click();',
 'output.detail={count:document.querySelectorAll(".modal-backdrop").length,text:modal.querySelector(".l4-glossary-detail")?.textContent||""};',
 'window.TradingResearchActions.trAstraL4GlossaryBack();',
 'output.returned={search:search.value,focus:document.activeElement.id};',
 'modal.querySelector("#close").focus();modal.querySelector("#close").dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:"Tab"}));output.tabFocus=document.activeElement.id;',
 'search.focus();search.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:"Tab",shiftKey:true}));output.shiftFocus=document.activeElement.id;',
 'document.querySelector("#outside").focus();output.trapped=modal.contains(document.activeElement);',
 'search.focus();search.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:"Escape"}));await new Promise(done=>setTimeout(done,1));',
 'output.closed={closed,focus:document.activeElement.id,backdrops:document.querySelectorAll(".modal-backdrop").length};',
 'document.querySelector("#launcher").click();',
 'document.body.insertAdjacentHTML("beforeend", "<div class=\\"modal-backdrop\\"><div class=\\"modal\\" role=\\"dialog\\"><div class=\\"modal-head\\"><h3>Nueva operación</h3></div><div class=\\"modal-body\\"><form><label>Fecha/hora de entrada <input id=\\"new-op-entry\\" value=\\"2026-10-09 19:00\\"></label><label>Notas <textarea id=\\"new-op-notes\\"></textarea></label></form></div><div class=\\"modal-foot\\"><button id=\\"op-cancel\\">Cancelar</button><button id=\\"op-save\\">Guardar operación</button></div></div></div>");',
 'await new Promise(done=>setTimeout(done,1));',
 'const opDialog=document.querySelector(".modal"),entry=opDialog.querySelector("#new-op-entry"),cancel=opDialog.querySelector("#op-cancel");',
 'output.operation={start:document.activeElement.id,role:opDialog.getAttribute("role"),labelledBy:opDialog.getAttribute("aria-labelledby")};',
 'entry.value="2026-10-09 19:05";let dismissed=0;window.confirm=()=>false;cancel.addEventListener("click",()=>{dismissed++;closeModal();});cancel.click();output.operation.protected=!!opDialog.isConnected&&dismissed===0;',
 'window.confirm=()=>true;cancel.click();await new Promise(done=>setTimeout(done,1));output.operation.confirmed=dismissed===1&&!opDialog.isConnected;output.operation.restore=document.activeElement.id;',
 'for(const theme of ["dark","light"]){document.documentElement.dataset.theme=theme;output[theme]=getComputedStyle(scope.querySelector(".l4-emotional-tab.is-current")).backgroundColor;const t=document.querySelector(".research-grid-module .research-cell");const val=t.querySelector("strong");output[theme+"Heat"]={cellOpacity:getComputedStyle(t).opacity,color:getComputedStyle(val).color,bg:getComputedStyle(val).backgroundColor};}',
 'output.hit=getComputedStyle(document.querySelector(".info-dot")).minHeight;',
 'document.body.setAttribute("data-l4-result",encodeURIComponent(JSON.stringify(output)));',
 '})().catch(e=>document.body.setAttribute("data-l4-error",String(e.stack||e)));'
].join('\n');
const page='<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head><body><button id="launcher">Abrir</button><button id="outside">Detrás</button><button class="info-dot">i</button><div class="research-grid-module"><table><tbody><tr><td class="research-cell low-sample" style="background:rgba(120,210,155,.75)"><strong>+25.4t</strong><small>n=2 · baja</small></td></tr></tbody></table></div><div id="view"></div><script>'+prep+'</script><script>'+runtime+'</script><script>'+inspect+'</script></body></html>';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr-l4-'));
try{
 const file=path.join(dir,'l4.html');fs.writeFileSync(file,page);
 let bin=null;for(const x of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean))if(spawnSync(x,['--version'],{encoding:'utf8'}).status===0){bin=x;break;}
 assert(bin,'Chromium required');
 const r=spawnSync(bin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--virtual-time-budget=1300','--dump-dom','file://'+file],{encoding:'utf8',timeout:32000,maxBuffer:4000000});
 assert.equal(r.status,0,r.stderr?.slice(-700));
 const err=r.stdout.match(/data-l4-error="([^"]+)"/)?.[1];assert(!err,err);
 const matched=r.stdout.match(/data-l4-result="([^"]+)"/)?.[1];assert(matched,'Missing DOM snapshot: '+r.stderr?.slice(-600));
 const o=JSON.parse(decodeURIComponent(matched));
 assert(o.tabs===3&&o.initial===1&&o.preserved);
 assert(o.library.visible===1&&o.library.records===3&&o.library.oneVisible===1&&o.selected==='c');
 assert(o.start==='glossary-search'&&o.detail.count===1&&o.detail.text.includes('Qué significa')&&o.detail.text.includes('Para qué sirve'));
 assert(o.returned.search==='pérdidas'&&o.returned.focus==='pf');
 assert(o.tabFocus==='glossary-search'&&o.shiftFocus==='close'&&o.trapped);
 assert(o.closed.closed===1&&o.closed.focus==='launcher'&&o.closed.backdrops===0);
 assert(o.operation.start==='new-op-entry'&&o.operation.role==='dialog'&&o.operation.labelledBy);
 assert(o.operation.protected&&o.operation.confirmed&&o.operation.restore==='launcher');
 assert(o.darkHeat.cellOpacity==='1'&&o.lightHeat.cellOpacity==='1');
 assert(o.darkHeat.color==='rgb(249, 251, 255)'&&o.lightHeat.color==='rgb(23, 43, 68)');
 assert(o.darkHeat.bg!==o.lightHeat.bg);
 assert(o.dark!==o.light&&o.hit==='30px');
 console.log('Astra Lote4 Chromium PASS: tabs, one perspective, glossary, focus/Tab/Escape and themes');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
