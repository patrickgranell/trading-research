import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const css=fs.readFileSync('styles.css','utf8'),runtime=fs.readFileSync('astra-lote3-navigation-runtime.js','utf8');
const setup=[
 'let current="dashboard",environment="live",calls=0,opsTouched=0;',
 'const p={id:"tp1",name:"prova1",version:"v1",validationGroupId:"group1"};',
 'const unchanged=JSON.stringify(p);',
 'window.TradingResearchActions={navigate:v=>{current=v;window.render();}};',
 'window.TradingResearchCurrentViewReadContract={current:()=>current};',
 'window.TradingResearchPlanReadContract={current:()=>p};',
 'window.TradingResearchOperationSemanticsContract={planEnvironment:()=>environment};',
 'window.TradingResearchEmotionalJournal={sessions:()=>[]};',
 'window.TradingResearchContentEncodingContract={html:x=>String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")};',
 'function trRenderViewHtml(view){const headings={decision:"Research Decision Center",changes:"Research Alerts & Change Tracking",mistakes:"Mistakes Analysis",review:"Review & Notes"};',
 ' const h=headings[view]||view;',
 ' const extra=view==="journal"?"<div class=\\"notice\\">Define el entorno del Trading Plan</div>":view==="journalstreaks"?"<div class=\\"notice\\">Sin Backtesting vinculado</div>":view==="mistakes"?"<div class=\\"notice\\">"+("Texto metodológico ".repeat(35))+"</div>":"";',
 ' return "<div class=\\"topbar\\"><div class=\\"page-title\\"><h2>"+h+"</h2><p>Ejemplo</p></div></div><div class=\\"plan-banner\\">TP: prova1 · v1</div>"+extra+"<span class=\\"badge\\">unclassified</span>";',
 '}',
 'function trRenderSyncSidebar(){const now=current;document.querySelectorAll(".nav-child").forEach(b=>b.classList.toggle("active",b.dataset.view===now));}',
 'window.render=function(){calls++;trRenderSyncSidebar();document.getElementById("view").innerHTML=trRenderViewHtml(current);};',
].join('\n');
const sidebar=[
 '<div class="shell"><aside class="sidebar">',
 '<div class="brand"><h1>Trading Research</h1></div>',
 '<div class="plan-switch"><select><option>prova1</option></select></div>',
 '<div class="theme-switch"><span class="theme-switch-label">Apariencia</span><div class="theme-switch-buttons"><button class="theme-btn">Oscuro</button><button class="theme-btn">Claro</button></div></div>',
 '<nav class="nav nav-organized"><button class="active">Dashboard</button>',
 ...['operativa','emotional','research','control','data','system'].map((g,i)=>{
  const values={
   operativa:[['operations','Operaciones'],['calendar','Calendario']],
   emotional:[['journaldashboard','Dashboard'],['journal','Sesiones'],['journalops','Registro'],['journalreflections','Perspectiva'],['journalweekly','Semanal']],
   research:[['decision','Centro Research'],['changes','Cambios'],['review','Review & Notes']],
   control:[['compliance','Cumplimiento'],['mistakes','Errores']],
   data:[['quality','Calidad']],
   system:[['plans','Trading Plans'],['config','Configuración']]
  };
  return '<section class="nav-group open" data-nav-group="'+g+'"><button class="nav-group-toggle"><span class="nav-group-label">'+g+'</span></button><div class="nav-group-items">'+values[g].map(([id,label])=>'<button class="nav-child" data-view="'+id+'"><span class="nav-child-label">'+label+'</span></button>').join('')+'</div></section>';
 }),
 '</nav><div class="side-bottom"><div class="mini-card">Modo actual</div></div></aside><main class="main"><div id="view"></div></main></div>'
].join('');
const inspect=[
 'const out={};window.render();',
 'function take(view){window.TradingResearchActions.navigate(view);const nav=document.querySelector(".sidebar .nav-organized");',
 ' const active=[...nav.querySelectorAll("button.active")].map(x=>x.dataset.view||"dashboard");',
 ' const headings=document.querySelector("#view .page-title h2")?.textContent;',
 ' return {active,heading:headings,local:[...document.querySelectorAll("#view .tr3-journal-link")].map(x=>x.textContent),',
 '  current:document.querySelector("#view [aria-current=page]")?.textContent,html:document.getElementById("view").innerHTML};}',
 'out.dashboard=take("dashboard");out.decision=take("decision");out.changes=take("changes");out.review=take("review");',
 'out.mistakes=take("mistakes");out.compliance=take("compliance");',
 'out.siblings=[...document.querySelectorAll(".tr3-execution-nav button")].map(b=>b.textContent);',
 'out.streaks=take("journalstreaks");out.streaksCta=out.streaks.html.includes("Revisar grupo / Backtesting de referencia");',
 'window.TradingResearchActions.trAstraL3Prerequisite("plans");out.plans=take("plans");',
 'out.hasReturn=out.plans.html.includes("Volver a Diario emocional");window.TradingResearchActions.trAstraL3Return();out.returned=current;',
 'out.confidence=take("journalconfidence");out.sessionsCta=out.confidence.html.includes("Abrir sesiones");',
 'environment="unclassified";out.session=take("journal");out.envCta=out.session.html.includes("Definir entorno");',
 'environment="backtest";out.blocked=take("journal");environment="live";',
 'out.sidebar={client:document.querySelector(".sidebar").clientWidth,scroll:document.querySelector(".sidebar").scrollWidth,nav:document.querySelector(".nav-organized").scrollWidth,navClient:document.querySelector(".nav-organized").clientWidth,appearance:!!document.querySelector(".tr3-appearance"),buttons:document.querySelectorAll(".sidebar .theme-btn").length};',
 'const themes={};for(const theme of ["dark","light"]){document.documentElement.dataset.theme=theme;take("compliance");const b=document.querySelector(".tr3-execution-link.is-current");themes[theme]={background:getComputedStyle(b).backgroundColor,color:getComputedStyle(b).color};}',
 'out.themes=themes;out.unchanged=JSON.stringify(p)===unchanged;out.calls=calls;',
 'document.body.setAttribute("data-l3-result",encodeURIComponent(JSON.stringify(out)));'
].join('\n');
const page='<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+sidebar+'<script>'+setup+'</script><script>'+runtime+'</script><script>'+inspect+'</script></body></html>';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-l3-'));
try{
 const file=path.join(folder,'test.html');fs.writeFileSync(file,page);
 let chromium=null;for(const bin of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean)){if(spawnSync(bin,['--version'],{encoding:'utf8'}).status===0){chromium=bin;break;}}
 assert(chromium,'Chromium required for UI regression');
 const p=spawnSync(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1280,900','--allow-file-access-from-files','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:3000000});
 assert.equal(p.status,0,p.stderr?.slice(-800));
 const raw=p.stdout.match(/data-l3-result="([^"]+)"/)?.[1];assert(raw,'No L3 browser result. '+p.stderr?.slice(-800));
 const v=JSON.parse(decodeURIComponent(raw));
 assert.deepEqual(v.dashboard.active,['dashboard']);
 for(const target of ['decision','changes','review','mistakes','compliance'])assert.deepEqual(v[target].active,[target],target+' duplicate active route');
 assert.equal(v.decision.heading,'Centro de investigación');
 assert.equal(v.changes.heading,'Cambios y alertas');
 assert.equal(v.review.heading,'Hallazgos y decisiones');
 assert.equal(v.mistakes.heading,'Análisis de errores');
 assert.deepEqual(v.siblings,['Cumplimiento','Análisis de errores']);
 assert.equal(v.streaks.local.length,8);
 assert.equal(v.streaks.current,'Rachas');
 assert(v.streaksCta&&v.hasReturn&&v.returned==='journalstreaks');
 assert(v.sessionsCta&&v.envCta);
 assert(!v.blocked.html.includes('tr3-journal-nav'),'Backtesting must not gain emotional links');
 assert(v.sidebar.appearance&&v.sidebar.buttons===2);
 assert(v.sidebar.scroll<=v.sidebar.client+1,'Sidebar overflows horizontally');
 assert(v.sidebar.nav<=v.sidebar.navClient+1,'Navigation overflows horizontally');
 assert(v.themes.dark.background!==v.themes.light.background);
 assert(v.unchanged,'Navigation mutated plan');
 console.log('Lote 3 Chromium PASS: single active, 8 journal tabs, prerequisite/return, execution siblings, no horizontal scroll, themes');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
