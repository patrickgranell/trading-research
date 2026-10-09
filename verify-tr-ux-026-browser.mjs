import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

// Representative fixture loaded in an actual Chromium renderer using the
// production stylesheet, in both themes, with no app data or network access.
const css=fs.readFileSync(new URL('./styles.css',import.meta.url),'utf8');
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="modal"><div class="block-detail-head"><div><b>Bloque 07</b><span>121–124</span></div></div>
<div class="block-detail-kpis"><div><span>Operaciones</span><strong>3</strong></div><div><span>Comisiones</span><strong>0.00</strong></div></div></div>
<section class="perspective-focus-card"><div class="perspective-focus-label">PERSPECTIVA</div>
<blockquote>Una frase de perspectiva con lectura protagonista.</blockquote>
<div class="perspective-focus-author">Brett Steenbarger</div>
<div class="perspective-focus-source">Fuente de la reflexión</div>
<div class="perspective-focus-context"><span>Puede ayudarte cuando</span><strong>Contexto emocional</strong></div>
<div class="perspective-focus-actions"><button class="btn small" disabled>← Anterior</button><span>1 / 18</span>
<button class="btn small primary">Otra perspectiva →</button>
<button class="btn small ghost">Configurar biblioteca</button></div></section>
<div class="field"><label>Fecha/hora de entrada</label><input class="input"></div>
<section class="card kpi"><div class="sub">Texto secundario KPI</div></section>
<div class="calendar-day positive-day" style="--calendar-strength:1"><div class="calendar-day-meta">WR 45% / Disc 100%</div></div>
<svg width="300" height="40"><text x="4" y="18" class="rp-level-label exit">Salida</text><line class="rp-exit-level" x1="50" y1="30" x2="240" y2="30"/></svg>
<script>
function snapshot(theme){
 document.documentElement.dataset.theme=theme;
 const get=(q,property)=>getComputedStyle(document.querySelector(q))[property];
 return {
  headBackground:get('.block-detail-head','backgroundColor'),
  headText:get('.block-detail-head','color'),
  neutralText:get('.block-detail-kpis strong','color'),
  metricBackground:get('.block-detail-kpis>div','backgroundColor'),
  perspectiveGradient:get('.perspective-focus-card','backgroundImage'),
  perspectiveText:get('.perspective-focus-card blockquote','color'),
  perspectiveSource:get('.perspective-focus-source','color'),
  perspectiveButton:get('.perspective-focus-actions .btn.ghost','color'),
  perspectiveDisabled:get('.perspective-focus-actions .btn:disabled','opacity'),
  fieldLabel:get('.field label','color'),
  calendarText:get('.calendar-day-meta','color'),
  exitLabel:get('.rp-level-label.exit','fill'),
  exitLine:get('.rp-exit-level','stroke')
 };
}
document.body.setAttribute('data-tr-browser-results',encodeURIComponent(JSON.stringify({light:snapshot('light'),dark:snapshot('dark')})));
</script></body></html>`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tr-ux026-'));
try{
 const filename=path.join(dir,'theme.html');
 fs.writeFileSync(filename,html);
 const binaries=[process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean);
 let chrome=null;
 for(const b of binaries){if(spawnSync(b,['--version'],{encoding:'utf8'}).status===0){chrome=b;break;}}
 assert(chrome,'Chromium/Chrome is required for this browser-level smoke test');
 const result=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--dump-dom','file://'+filename],{encoding:'utf8',timeout:25000,maxBuffer:2000000});
 assert.equal(result.status,0,result.stderr?.slice(-600)||'Chrome failed');
 const encoded=result.stdout.match(/data-tr-browser-results="([^"]+)"/)?.[1];
 assert(encoded,'The fixture did not produce browser computed styles');
 const {light,dark}=JSON.parse(decodeURIComponent(encoded));
 assert.equal(light.headBackground,'rgb(238, 244, 250)');
 assert.equal(light.headText,'rgb(23, 32, 51)');
 assert.equal(light.metricBackground,'rgb(247, 249, 252)');
 assert.equal(light.neutralText,'rgb(23, 32, 51)');
 assert(light.perspectiveGradient.includes('rgb(238, 243, 250)'),light.perspectiveGradient);
 assert.equal(light.perspectiveText,'rgb(23, 32, 51)');
 assert.equal(light.perspectiveSource,'rgb(80, 100, 126)');
 assert.equal(light.perspectiveButton,'rgb(38, 59, 86)');
 assert.equal(light.perspectiveDisabled,'0.5');
 assert.equal(light.fieldLabel,'rgb(65, 85, 113)');
 assert.equal(light.calendarText,'rgb(59, 79, 105)');
 assert.equal(light.exitLabel,'rgb(138, 83, 0)');
 assert.equal(light.exitLine,'rgb(138, 83, 0)');
 assert.equal(dark.headBackground,'rgb(10, 24, 42)');
 assert.equal(dark.metricBackground,'rgb(9, 17, 31)');
 assert(dark.perspectiveGradient.includes('rgb(11, 18, 32)'),dark.perspectiveGradient);
 assert.equal(dark.exitLabel,'rgb(216, 151, 34)');
 console.log('TR-UX-026 Chromium computed-style smoke: PASS (light & dark, 14 checks)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
