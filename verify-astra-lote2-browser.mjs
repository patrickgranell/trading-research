import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const css=fs.readFileSync('styles.css','utf8'),runtime=fs.readFileSync('astra-lote2-config-runtime.js','utf8');
const setup=[
'window.TradingResearchActions={trTaxOpenValueFicha:(t,v)=>{window.opened=[t,v];}};',
'let active="taxonomy",renders=0;',
'const p={id:"tp1",name:"prova1",version:"v1",taxonomyRegistry:[',
'{id:"setup",name:"Setup",status:"active",values:[{id:"s1",name:"Estructura",legacyValue:"Estructura",status:"active",aliases:[]}]},',
'{id:"custom",name:"Patrón privado",status:"active",values:[{id:"x1",name:"Imagen antigua",legacyValue:"Antigua",status:"archived",aliases:["Histórico"]}]}],',
'setupDefinitions:[{key:"Estructura",description:"Rechazo",specs:"Máximo",timeframes:["5M"],imagesLong:[{id:"img1",label:"LONG"}],imagesShort:[{id:"img2",label:"SHORT"}]}],',
'visualReferences:[{id:"legacy",kind:"legacy",key:"old",title:"Referencia heredada",note:"Antes",images:[]}]};',
'const original=JSON.stringify(p);',
'window.TradingResearchContentEncodingContract={html:s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")};',
'window.TradingResearchPlanReadContract={current:()=>p,label:x=>x.name+" · "+x.version};',
'window.TradingResearchConfigTabStateContract={current:()=>active,set:x=>{active=x;}};',
'window.render=()=>{renders++;};',
'function panel(name,body="Contenido"){return "<section class=\\"card panel config-wide\\"><div class=\\"panel-title\\"><h3>"+name+"</h3></div>"+body+"</section>";}',
'function sample(){',
'let body;if(active==="taxonomy")body="<div class=\\"taxonomy-layout\\">"+panel("Taxonomías del Trading Plan")+panel("Setup","<button>Editar Setup</button>")+panel("Patrón privado","<button>Editar patrón</button>")+"</div>";',
'else if(active==="data")body="<div class=\\"data-security-layout\\">"+panel("Motor de render")+panel("Integridad del dataset","<button>Auditar</button>")+panel("Persistencia del workspace")+panel("Copias de seguridad","<button id=\\"backup\\">Exportar copia completa</button><button>Restaurar copia</button>")+panel("CSP y seguridad")+"</div>";',
'else if(active==="cloud")body=panel("Snapshots locales de seguridad","<button>Crear snapshot</button>")+panel("Sincronización");',
'else if(active==="visual")body=panel("Vista anterior duplicada");else body=panel("Editor actual","<button>Editar</button>");',
'return "<div class=\\"topbar\\"><div class=\\"actions\\"><button>Restaurar estructura base del plan</button></div></div><div class=\\"config-tabs\\">Once destinos</div><div class=\\"config-tab-content\\">"+body+"</div>";',
'}'
].join('\n');
const inspect=[
'function draw(){document.getElementById("mount").innerHTML=window.TradingResearchAstraLote2.renderConfig(sample());return document.getElementById("mount");}',
'let x=draw();const tax={scopes:x.querySelectorAll(".tr2-scope-switch>button").length,subtabs:x.querySelectorAll(".tr2-subnav>button").length,selectors:x.querySelectorAll(".tr2-tax-choice").length,details:x.querySelectorAll(".tr2-tax-detail>.card").length,other:x.innerHTML.includes("Editar patrón"),owner:x.innerHTML.includes("prova1")};',
'window.TradingResearchActions.trAstraL2Tab("visual");x=draw();const gallery={cards:x.querySelectorAll(".tr2-ref-card").length,images:x.innerHTML.includes("data-img-id=\\"img1\\"")&&x.innerHTML.includes("data-img-id=\\"img2\\""),canonical:x.innerHTML.includes("Abrir ficha canónica"),duplicated:x.innerHTML.includes("Vista anterior duplicada")};',
'window.TradingResearchActions.trAstraL2Edit("setup","s1");gallery.opened=window.opened;',
'window.TradingResearchActions.trAstraL2Tab("data");x=draw();const data={heads:[...x.querySelectorAll(".tr2-data-primary h3")].map(n=>n.textContent),advanced:x.querySelectorAll(".tr2-advanced").length,backup:x.querySelectorAll("#backup").length,advancedRenderer:x.innerHTML.includes("Motor de render"),cross:x.innerHTML.includes("Nube y snapshots")};',
'const styles={};for(const mode of ["light","dark"]){document.documentElement.dataset.theme=mode;const y=x.querySelector(".tr2-scope-switch>.is-active");styles[mode]={bg:getComputedStyle(y).backgroundColor,color:getComputedStyle(y).color};}',
'window.TradingResearchActions.trAstraL2Tab("cloud");x=draw();const cloud={cross:x.innerHTML.includes("Ir a copias"),snapshot:x.innerHTML.includes("Crear snapshot")};',
'window.TradingResearchActions.trAstraL2Tab("instruments");x=draw();const shared={reset:x.innerHTML.includes("Restaurar estructura base")};',
'document.body.setAttribute("data-l2-result",encodeURIComponent(JSON.stringify({tax,gallery,data,cloud,shared,styles,unchanged:JSON.stringify(p)===original,renders})));'
].join('\n');
const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><style>'+css+'</style></head><body><div id="mount"></div><script>'+setup+'</script><script>'+runtime+'</script><script>'+inspect+'</script></body></html>';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'astral2-'));
try{
 const file=path.join(dir,'lote2.html');fs.writeFileSync(file,html);
 let chrome=null;for(const b of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean))if(spawnSync(b,['--version'],{encoding:'utf8'}).status===0){chrome=b;break;}
 assert(chrome,'Chromium is required');
 const r=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:3500000});
 assert.equal(r.status,0,r.stderr?.slice(-650));
 const a=r.stdout.match(/data-l2-result="([^"]+)"/)?.[1];assert(a,'Lote2 UI did not run: '+r.stderr?.slice(-500));
 const v=JSON.parse(decodeURIComponent(a));
 assert.deepEqual([v.tax.scopes,v.tax.subtabs,v.tax.selectors,v.tax.details],[3,6,2,1]);
 assert(!v.tax.other&&v.tax.owner);
 assert.equal(v.gallery.cards,3);assert(v.gallery.images&&v.gallery.canonical&&!v.gallery.duplicated);assert.deepEqual(v.gallery.opened,['setup','s1']);
 assert.equal(v.data.heads[1],'Copias de seguridad');assert(v.data.heads.indexOf('Copias de seguridad')<v.data.heads.indexOf('Integridad del dataset'));
 assert(v.data.advanced===1&&v.data.backup===1&&v.data.advancedRenderer&&v.data.cross);
 assert(v.cloud.cross&&v.cloud.snapshot&&!v.shared.reset&&v.unchanged&&v.renders>=4);
 assert.notEqual(v.styles.light.bg,v.styles.dark.bg);
 console.log('Lote 2 Chromium PASS: all scopes, single taxonomy detail, gallery, backup-first, cloud crosslinks, both themes');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
