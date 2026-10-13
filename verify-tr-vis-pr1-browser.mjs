/* TR-VIS PR1: actual Chromium render & CSS regression; no application data mutated. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const css=fs.readFileSync('styles.css','utf8');
const adapter=fs.readFileSync('astra-lote3-navigation-runtime.js','utf8');
const setup=String.raw`
let current='dashboard',ops=[];
const plan={id:'fixture-tp'};
function currentOps(){return ops;}
window.TradingResearchActions={navigate(view){current=view;window.render();}};
window.TradingResearchCurrentViewReadContract={current:()=>current};
window.TradingResearchPlanReadContract={current:()=>plan};
window.TradingResearchOperationSemanticsContract={planEnvironment:()=> 'live'};
window.TradingResearchContentEncodingContract={html:value=>String(value)};
function trRenderViewHtml(view){
 if(view==='dashboard')return '<div class="topbar"><div class="page-title"><h2>Dashboard</h2></div></div><div class="chart-wrap"><svg class="equity-svg dashboard-equity-svg" viewBox="0 0 760 250" preserveAspectRatio="none"><text class="dashboard-axis-text" x="10" y="20">0 R</text></svg></div>';
 if(view==='decision')return '<div class="topbar"><div class="page-title"><h2>Research Decision Center</h2></div></div><section class="card panel decision-hero high"><div><h2>Prioridades críticas</h2><p>Alertas</p></div><div class="decision-hero-kpis"><div><strong>0/100</strong></div></div></section><section class="decision-section"><div class="decision-section-head"><span>2 altas</span></div><div class="decision-priority-grid"><article>0/0 checklist</article></div></section>';
 return '<div></div>';
}
window.render=function(){document.querySelector('#view').innerHTML=trRenderViewHtml(current);};
`;
const inspect=String.raw`
const out={};window.render();
const svg=document.querySelector('.dashboard-equity-svg');
out.ratio=svg.getAttribute('preserveAspectRatio');
out.svgLabel=svg.getAttribute('aria-label');
const axis=svg.querySelector('.dashboard-axis-text');
document.documentElement.dataset.theme='dark';
out.darkAxis=getComputedStyle(axis).fill;
const box=document.createElement('div');box.className='rp-chart-wrap';document.body.append(box);
out.darkIntratrade=getComputedStyle(box).backgroundColor;
document.documentElement.dataset.theme='light';
out.lightAxis=getComputedStyle(axis).fill;
out.lightIntratrade=getComputedStyle(box).backgroundColor;
current='decision';window.render();
out.emptyTitle=document.querySelector('.decision-hero h2')?.textContent;
out.emptyPriority=document.querySelector('.decision-priority-grid')?.textContent;
out.emptyStatus=document.querySelector('.decision-section-head >span')?.textContent;
out.emptyQuality=document.querySelector('.decision-hero-kpis strong')?.textContent;
ops=[{id:'fixture-op'}];window.render();
out.populatedTitle=document.querySelector('.decision-hero h2')?.textContent;
out.populatedPriority=document.querySelector('.decision-priority-grid')?.textContent;
const nav=document.querySelector('.sidebar .nav-organized');
out.navOverflow=getComputedStyle(nav).overflowY;
out.navScrollable=nav.scrollHeight>nav.clientHeight+2;
out.planVisible=document.querySelector('.plan-switch').getBoundingClientRect().top>=0;
document.body.dataset.trVisResult=encodeURIComponent(JSON.stringify(out));
`;
const many=Array.from({length:45},(_,i)=>'<button class="nav-child">Destino '+i+'</button>').join('');
const page='<!doctype html><html lang="es" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div class="shell"><aside class="sidebar"><div class="brand"><h1>Trading Research</h1></div><div class="plan-switch"><label>Trading Plan</label><select class="select"><option>Fixture</option></select></div><nav class="nav nav-organized">'+many+'</nav><div class="side-bottom">Modo</div></aside><main class="main"><div id="view"></div></main></div><script>'+setup+'</script><script>'+adapter+'</script><script>'+inspect+'</script></body></html>';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tr-vis-'));
try{
 const file=path.join(folder,'page.html');fs.writeFileSync(file,page);
 const chromium=['google-chrome','chromium','chromium-browser'].find(bin=>spawnSync(bin,['--version'],{encoding:'utf8'}).status===0);
 assert(chromium,'Chromium is required');
 const run=spawnSync(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--window-size=1280,700','--allow-file-access-from-files','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:3000000});
 assert.equal(run.status,0,run.stderr?.slice(-1200));
 const encoded=run.stdout.match(/data-tr-vis-result="([^"]+)"/)?.[1];assert(encoded,'No browser result: '+run.stderr?.slice(-1200));
 const v=JSON.parse(decodeURIComponent(encoded));
 assert.equal(v.ratio,'xMidYMid meet');
 assert.equal(v.svgLabel,'Curva de equity del plan seleccionado');
 assert.equal(v.darkAxis,'rgb(147, 167, 195)');
 assert.equal(v.lightAxis,'rgb(90, 104, 125)');
 assert.equal(v.darkIntratrade,'rgb(11, 18, 32)');
 assert.equal(v.lightIntratrade,'rgb(255, 255, 255)');
 assert.equal(v.emptyTitle,'Sin muestra operativa');
 assert.equal(v.emptyStatus,'Sin evaluación');
 assert.equal(v.emptyQuality,'—');
 assert(v.emptyPriority.includes('Sin prioridades estadísticas')&&!v.emptyPriority.includes('0/0'));
 assert.equal(v.populatedTitle,'Prioridades críticas');
 assert(v.populatedPriority.includes('0/0 checklist'),'Only a real zero sample may be neutralized');
 assert.equal(v.navOverflow,'auto');
 assert(v.navScrollable&&v.planVisible,'Sidebar destinations must scroll independently under a stable TP header');
 console.log('TR-VIS PR1 Chromium PASS: SVG geometry, axis colours in both themes, dark intratrade, neutral empty, scrollable navigation');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
