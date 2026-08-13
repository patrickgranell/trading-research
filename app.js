const STORAGE_KEY = 'tradingResearchState_v1';
const DB_NAME = 'tradingResearchFiles';
const DB_VERSION = 1;
const IMG_STORE = 'images';

const defaultState = {
  operations: [],
  opportunities: [],
  settings: {
    setups: ['Continuación','Estructura','Facilidad','Giro'],
    vd: ['RECH','A1','B3','ENV'],
    nr: ['Max Europe','Min Europe','Max America','Min America','Dynamic Pivot','Punto de Control','GAP'],
    hypotheses: [
      {id:'H1', name:'Hipótesis 1', description:''},
      {id:'H2', name:'Hipótesis 2', description:''},
      {id:'H3', name:'Hipótesis 3', description:''}
    ],
    riskStrategies: [
      {id:'R1', name:'Estrategia 1', atrMin:0, atrMax:0.5, instrument:'CL', contracts:1, stopTicks:10, targetMode:'R2', targetR:2, targetText:'R2 / zona próxima de liquidez'},
      {id:'R2', name:'Estrategia 2', atrMin:0.51, atrMax:1.0, instrument:'MCL', contracts:2, stopTicks:20, targetMode:'R2', targetR:2, targetText:'R2'},
      {id:'R3', name:'Estrategia 3', atrMin:1.1, atrMax:1.5, instrument:'MCL', contracts:1, stopTicks:30, targetMode:'R2', targetR:2, targetText:'R2'}
    ]
  }
};

let state = loadState();
let currentView = 'dashboard';
let editingId = null;

function loadState(){
  try{ return {...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'), settings:{...defaultState.settings,...(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}').settings||{})}} }catch(e){ return structuredClone(defaultState); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
const money = v => new Intl.NumberFormat('es-ES',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(v)||0);
const pct = v => `${(Number(v)||0).toFixed(1)}%`;
const fmtDate = iso => { if(!iso) return '—'; const d=new Date(iso); return isNaN(d)?iso:d.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}); };
const esc = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const uid = p => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;

function calcStats(ops){
  const n=ops.length, wins=ops.filter(o=>o.result==='win').length, losses=ops.filter(o=>o.result==='loss').length;
  const rs=ops.map(o=>Number(o.rMultiple)||0), sumR=rs.reduce((a,b)=>a+b,0), gains=rs.filter(r=>r>0).reduce((a,b)=>a+b,0), lossesR=Math.abs(rs.filter(r=>r<0).reduce((a,b)=>a+b,0));
  let eq=0, peak=0, maxDD=0; const equity=[]; for(const r of rs){eq+=r; peak=Math.max(peak,eq); maxDD=Math.min(maxDD,eq-peak); equity.push(eq);}
  return {n,wins,losses,winRate:n?wins/n*100:0,sumR,expectancy:n?sumR/n:0,pf:lossesR?gains/lossesR:0,maxDD,avgMfe:n?ops.reduce((a,o)=>a+(Number(o.mfe)||0),0)/n:0,avgMae:n?ops.reduce((a,o)=>a+(Number(o.mae)||0),0)/n:0,equity};
}
function resultClass(o){return o.result==='win'?'win':o.result==='loss'?'loss':''}

function shell(){
  return `<div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-dot"></div><div><h1>Trading Research</h1><small>Backtest & Trade Lab</small></div></div>
      <nav class="nav">
        ${navBtn('dashboard','◈','Dashboard')}
        ${navBtn('operations','▤','Operaciones')}
        ${navBtn('blocks','▦','Bloques')}
        ${navBtn('config','⚙','Configuración')}
      </nav>
      <div class="side-bottom"><div class="mini-card"><div class="mini-label">Modo actual</div><div class="mini-value">V1 · Prototipo local</div><div class="help">Los datos de esta primera versión se guardan en este navegador.</div></div></div>
    </aside>
    <main class="main"><div id="view"></div></main>
  </div>`;
}
function navBtn(id,icon,label){return `<button class="${currentView===id?'active':''}" onclick="navigate('${id}')"><span class="icon">${icon}</span><span>${label}</span></button>`}
function pageHead(title,desc,actions=''){return `<div class="topbar"><div class="page-title"><h2>${title}</h2><p>${desc}</p></div><div class="actions">${actions}</div></div>`}

function dashboard(){
  const stats=calcStats(state.operations);
  const bySetup={}; state.operations.forEach(o=>bySetup[o.setup]=(bySetup[o.setup]||0)+1);
  const top=Object.entries(bySetup).sort((a,b)=>b[1]-a[1]).slice(0,6); const max=top[0]?.[1]||1;
  const labels=stats.equity.map((_,i)=>i+1);
  const pts=stats.equity; let svg=''; if(pts.length){ const min=Math.min(...pts,0), maxE=Math.max(...pts,0), range=(maxE-min)||1; const W=760,H=250; const coords=pts.map((v,i)=>`${(i/(Math.max(pts.length-1,1)))*W},${H-((v-min)/range)*H}`).join(' '); const area=`0,${H} ${coords} ${W},${H}`; svg=`<svg class="equity-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line class="axis" x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"/><polygon class="area" points="${area}"/><polyline class="line" points="${coords}"/></svg>`; } else svg='<div class="empty">Registra tu primera operación para ver la curva de equity.</div>';
  return `${pageHead('Dashboard','Vista global del diario, rendimiento y estructura de investigación.',`<button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button><button class="btn" onclick="document.getElementById('importFile').click()">Importar Ankora</button>`)}
  <div class="kpis">
    ${kpi('Operaciones',stats.n,'universo actual')}${kpi('Win rate',pct(stats.winRate),'resultado cerrado')}${kpi('Expectancy',`${stats.expectancy>=0?'+':''}${stats.expectancy.toFixed(2)}R`,'por operación')}${kpi('Profit Factor',stats.pf.toFixed(2),'ganancia / pérdida')}${kpi('Drawdown',`${stats.maxDD.toFixed(2)}R`,'máximo actual')}${kpi('Bloques',Math.ceil(stats.n/20),'de 20 operaciones')}
  </div>
  <div class="grid two">
    <section class="card panel"><div class="panel-title"><h3>Equity en R</h3><span>${stats.n ? `${stats.sumR>=0?'+':''}${stats.sumR.toFixed(2)}R acumulado` : 'sin datos'}</span></div><div class="chart-wrap">${svg}</div></section>
    <section class="card panel"><div class="panel-title"><h3>Operaciones por setup</h3><span>universo actual</span></div><div class="bar-list">${top.length?top.map(([k,v])=>`<div class="bar-row"><div>${esc(k||'Sin setup')}</div><div class="bar"><span style="width:${(v/max)*100}%"></span></div><div class="value-right">${v}</div></div>`).join(''):'<div class="empty">Aún no hay operaciones.</div>'}</div></section>
  </div>
  <div class="grid three" style="margin-top:16px">
    <section class="card panel"><div class="panel-title"><h3>MFE medio</h3><span>R</span></div><div class="kpi value">${stats.avgMfe.toFixed(2)}R</div><div class="help">Base para estudiar potencial favorable y salidas.</div></section>
    <section class="card panel"><div class="panel-title"><h3>MAE medio</h3><span>R</span></div><div class="kpi value">${stats.avgMae.toFixed(2)}R</div><div class="help">Base para estudiar excursión adversa y stops.</div></section>
    <section class="card panel"><div class="panel-title"><h3>Bloque actual</h3><span>20 trades</span></div><div class="kpi value">${stats.n?Math.floor((stats.n-1)/20)+1:0}</div><div class="help">La aplicación agrupa automáticamente por bloques cronológicos de 20.</div></section>
  </div>`;
}
function kpi(label,value,sub){return `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`}

function operations(){
  const ops=[...state.operations].sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate));
  return `${pageHead('Operaciones','Registro manual e importación. Cada trade conserva su estructura original y sus variables analíticas.',`<button class="btn" onclick="document.getElementById('importFile').click()">Importar Ankora</button><button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button>`)}
  <div class="card panel"><div class="toolbar"><div class="filters"><input id="searchOps" class="input" placeholder="Buscar símbolo, setup, VD, NR…" oninput="filterOperations()"><select id="filterRisk" class="select" onchange="filterOperations()"><option value="">Todos los regímenes</option>${state.settings.riskStrategies.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select><select id="filterResult" class="select" onchange="filterOperations()"><option value="">Todos</option><option value="win">Ganadoras</option><option value="loss">Perdedoras</option></select></div><span class="help">${ops.length} operaciones</span></div><div id="opsTable">${opsTable(ops)}</div></div>`;
}
function opsTable(ops){if(!ops.length)return '<div class="empty">No hay operaciones con estos filtros.</div>'; return `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Símbolo</th><th>Dirección</th><th>Setup</th><th>VD</th><th>NR</th><th>Hipótesis</th><th>Régimen</th><th>Resultado</th><th>R</th><th>MFE</th><th>MAE</th><th>Acciones</th></tr></thead><tbody>${ops.map(o=>`<tr><td>${fmtDate(o.entryDate)}</td><td>${esc(o.contract||o.instrument||'—')}</td><td>${esc(o.direction||'—')}</td><td>${esc(o.setup||'—')}</td><td>${esc(o.vd||'—')}</td><td>${esc(o.nr||'—')}</td><td>${esc(o.hypothesis||'—')}</td><td>${esc(o.riskStrategyName||o.riskStrategyId||'—')}</td><td><span class="badge ${resultClass(o)}">${o.result==='win'?'Ganadora':o.result==='loss'?'Perdedora':'Pendiente'}</span></td><td>${Number(o.rMultiple||0)>=0?'+':''}${Number(o.rMultiple||0).toFixed(2)}R</td><td>${Number(o.mfe||0).toFixed(2)}R</td><td>${Number(o.mae||0).toFixed(2)}R</td><td><button class="btn small" onclick="viewOperation('${o.id}')">Ver</button> <button class="btn small" onclick="editOperation('${o.id}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`}
function filterOperations(){const q=(document.getElementById('searchOps')?.value||'').toLowerCase(); const risk=document.getElementById('filterRisk')?.value||''; const result=document.getElementById('filterResult')?.value||''; const ops=state.operations.filter(o=>{const text=JSON.stringify(o).toLowerCase();return (!q||text.includes(q))&&(!risk||o.riskStrategyId===risk)&&(!result||o.result===result)}).sort((a,b)=>new Date(b.entryDate)-new Date(a.entryDate)); document.getElementById('opsTable').innerHTML=opsTable(ops)}

function blocks(){
  const ops=[...state.operations].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)); if(!ops.length)return `${pageHead('Bloques','Unidad estándar de revisión. Por defecto, 20 operaciones cronológicas.',`<button class="btn primary" onclick="openOperationModal()">+ Nueva operación</button>`)}<div class="block-grid">${Array.from({length:Math.ceil(ops.length/20)},(_,i)=>{const slice=ops.slice(i*20,i*20+20),s=calcStats(slice),from=i*20+1,to=i*20+slice.length;return `<section class="card block-card"><div class="block-top"><div class="block-num">Bloque ${String(i+1).padStart(2,'0')}</div><div class="block-range">${from}–${to}</div></div><div class="metric-row"><span>Operaciones</span><strong>${s.n}</strong></div><div class="metric-row"><span>Win rate</span><strong>${pct(s.winRate)}</strong></div><div class="metric-row"><span>Expectancy</span><strong class="${s.expectancy>=0?'positive':'negative'}">${s.expectancy>=0?'+':''}${s.expectancy.toFixed(2)}R</strong></div><div class="metric-row"><span>Resultado</span><strong class="${s.sumR>=0?'positive':'negative'}">${s.sumR>=0?'+':''}${s.sumR.toFixed(2)}R</strong></div><div class="metric-row"><span>PF</span><strong>${s.pf.toFixed(2)}</strong></div><div class="metric-row"><span>Max DD</span><strong>${s.maxDD.toFixed(2)}R</strong></div><div style="margin-top:12px"><button class="btn small" onclick="showBlock(${i})">Ver operaciones</button></div></section>`}).join('')}</div>`;
}
function showBlock(i){const ops=[...state.operations].sort((a,b)=>new Date(a.entryDate)-new Date(b.entryDate)).slice(i*20,i*20+20); currentView='operations'; render(); setTimeout(()=>{document.getElementById('opsTable').innerHTML=opsTable(ops)},0)}

function config(){return `${pageHead('Configuración','El sistema debe adaptarse a tu estrategia. Estas categorías son editables y no bloquean el histórico.',`<button class="btn" onclick="resetConfig()">Restaurar base</button>`)}
  <div class="grid two">
    ${configCard('Setups','Clasificaciones libres de patrón',['setups'])}
    ${configCard('VD','Tipo de vela / disparador',['vd'])}
    ${configCard('NR','Referencia de nivel / liquidez',['nr'])}
    <section class="card panel"><div class="panel-title"><h3>Hipótesis</h3><span>3 hipótesis plausibles por sesión</span></div><div class="config-list">${state.settings.hypotheses.map(h=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(h.name)} <span class="badge">${esc(h.id)}</span></div><div class="config-meta">${esc(h.description||'Sin descripción')}</div></div><button class="btn small" onclick="editHyp('${h.id}')">Editar</button></div>`).join('')}</div></section>
    <section class="card panel" style="grid-column:1/-1"><div class="panel-title"><h3>Regímenes de gestión de riesgo</h3><span>ATR → instrumento → contratos → stop → objetivo</span></div><div class="config-list">${state.settings.riskStrategies.map(r=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(r.name)} <span class="badge">${esc(r.id)}</span></div><div class="config-meta">ATR ${r.atrMin}–${r.atrMax} · ${esc(r.instrument)} · ${r.contracts} contratos · SL ${r.stopTicks} ticks · ${esc(r.targetText)}</div></div><button class="btn small" onclick="editRisk('${r.id}')">Editar</button></div>`).join('')}</div></section>
  </div>`}
function configCard(title,desc,keys){const key=keys[0], arr=state.settings[key]; return `<section class="card panel"><div class="panel-title"><h3>${title}</h3><span>${desc}</span></div><div class="config-list">${arr.map((x,i)=>`<div class="config-row"><div class="config-main"><div class="config-name">${esc(x)}</div><div class="config-meta">Disponible para registro y análisis</div></div><button class="btn small danger" onclick="removeConfig('${key}',${i})">Eliminar</button></div>`).join('')}</div><div style="margin-top:10px;display:flex;gap:8px"><input id="new-${key}" class="input" placeholder="Añadir categoría…"><button class="btn small" onclick="addConfig('${key}')">Añadir</button></div></section>`}
function addConfig(key){const el=document.getElementById(`new-${key}`); const v=el.value.trim(); if(v&&!state.settings[key].includes(v)){state.settings[key].push(v);saveState();}}
function removeConfig(key,i){if(confirm('Eliminar esta categoría de las opciones futuras? No se modificarán operaciones antiguas.')){state.settings[key].splice(i,1);saveState()}}
function resetConfig(){if(confirm('Restaurar la configuración base?')){state.settings=structuredClone(defaultState.settings);saveState()}}

function modalShell(title,body,footer){return `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="btn small" onclick="closeModal()">✕</button></div><div class="modal-body">${body}</div><div class="modal-foot">${footer}</div></div></div>`}
function openOperationModal(id=null){ editingId=id; const o=id?state.operations.find(x=>x.id===id):null; const r=o?.riskStrategyId?state.settings.riskStrategies.find(x=>x.id===o.riskStrategyId):state.settings.riskStrategies[1]||state.settings.riskStrategies[0]; document.body.insertAdjacentHTML('beforeend',modalShell(id?'Editar operación':'Nueva operación',operationForm(o,r),`<button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveOperationFromForm()">Guardar operación</button>`)); }
function operationForm(o,r){const v=(k,d='')=>esc(o?.[k]??d); const riskOptions=state.settings.riskStrategies.map(x=>`<option value="${esc(x.id)}" ${x.id===(o?.riskStrategyId||r?.id)?'selected':''}>${esc(x.name)}</option>`).join('');
  return `<form id="operationForm" onsubmit="return false">
    <div class="form-section"><h4>1 · Sesión y régimen</h4><div class="form-grid">
      ${field('Fecha/hora de entrada','entryDate','datetime-local',v('entryDate',new Date().toISOString().slice(0,16)),false)}
      ${field('Fecha/hora de salida','exitDate','datetime-local',v('exitDate',''))}
      ${selectField('Muestra','sample',['A','B'],v('sample','B'))}
      ${selectField('Régimen de gestión','riskStrategyId',state.settings.riskStrategies.map(x=>x.id),o?.riskStrategyId||r?.id,'riskStrategyName')}
      ${field('ATR observado','atr','number',v('atr',''))}
      ${selectField('Hipótesis','hypothesis',state.settings.hypotheses.map(x=>x.id),v('hypothesis','H3'))}
      ${field('Contexto H4','h4Context','text',v('h4Context',''))}
      ${selectField('Fase H4','h4Phase',['Impulso','Retroceso','No definida'],v('h4Phase','Impulso'))}
    </div></div>
    <div class="form-section"><h4>2 · Oportunidad</h4><div class="form-grid">
      ${selectOrText('Setup','setup',state.settings.setups,v('setup','Estructura'))}
      ${selectOrText('VD','vd',state.settings.vd,v('vd','RECH'))}
      ${selectOrText('NR','nr',state.settings.nr,v('nr','Max Europe'))}
      ${selectField('Tipo de operación','tradeType',['Rápida','Liquidez','Otra'],v('tradeType','Rápida'))}
      ${selectField('Dirección','direction',['LONG','SHORT'],v('direction','LONG'))}
      ${field('Timeframe','timeframe','text',v('timeframe','5M'))}
      ${field('Precio dinámico / objetivo','dtPrice','number',v('dtPrice',''))}
      ${field('Notas','notes','textarea',v('notes',''),'full')}
    </div></div>
    <div class="form-section"><h4>3 · Ejecución</h4><div class="form-grid">
      ${field('Contrato','contract','text',v('contract','MCL 08-26'))}
      ${field('Contratos','contracts','number',v('contracts',r?.contracts||1))}
      ${selectField('Tipo de entrada','entryType',['LMT','STP'],v('entryType','LMT'))}
      ${field('Precio de entrada','entryPrice','number',v('entryPrice',''))}
      ${field('Stop (ticks)','stopTicks','number',v('stopTicks',r?.stopTicks||20))}
      ${selectField('Target','targetMode',['R2','Liquidez','Discrecional'],v('targetMode',r?.targetMode||'R2'))}
      ${field('R objetivo','targetR','number',v('targetR',r?.targetR||2))}
      ${field('Ticks resultado','resultTicks','number',v('resultTicks',''))}
      ${field('Comisiones ($)','commission','number',v('commission',''))}
      ${field('MFE (R)','mfe','number',v('mfe',''))}
      ${field('MAE (R)','mae','number',v('mae',''))}
      ${selectField('Disciplina','discipline',['Sí','No'],v('discipline','Sí'))}
      ${field('Motivo de indisciplina','disciplineReason','text',v('disciplineReason',''),'span2')}
    </div></div>
    <div class="form-section"><h4>4 · Resultado</h4><div class="form-grid">
      ${selectField('Resultado','result',['win','loss','pending'],v('result',v('resultTicks')&&Number(v('resultTicks'))>0?'win':v('resultTicks')&&Number(v('resultTicks'))<0?'loss':'pending'))}
      ${field('R múltiple','rMultiple','number',v('rMultiple',''))}
      ${field('P&L neto ($)','pnlNet','number',v('pnlNet',''))}
      <div class="field span2"><label>Capturas</label><input id="screens" class="input" type="file" accept="image/png,image/jpeg,image/webp" multiple><div class="help">En V1 se guardará el nombre y una vista previa local. Supabase será la capa permanente en la siguiente fase.</div></div>
    </div></div>
  </form>`}
function field(label,name,type,value='',span=''){return `<div class="field ${span==='full'?'full':span==='span2'?'span2':''}"><label>${label}</label>${type==='textarea'?`<textarea id="f-${name}" class="textarea">${value}</textarea>`:`<input id="f-${name}" class="input" type="${type}" value="${value}">`}</div>`}
function selectField(label,name,options,value,cls=''){return `<div class="field"><label>${label}</label><select id="f-${name}" class="select ${cls}">${options.map(x=>`<option value="${esc(x)}" ${String(x)===String(value)?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`}
function selectOrText(label,name,options,value){return selectField(label,name,options,value)}
function closeModal(){document.querySelector('.modal-backdrop')?.remove();editingId=null}

function saveOperationFromForm(){
  const get=n=>document.getElementById(`f-${n}`)?.value||''; const riskId=get('riskStrategyId'); const risk=state.settings.riskStrategies.find(r=>r.id===riskId);
  const resultTicks=Number(get('resultTicks')||0), rMultiple=get('rMultiple')!==''?Number(get('rMultiple')):(Number(get('stopTicks')||risk?.stopTicks||1)>0?resultTicks/Number(get('stopTicks')||risk?.stopTicks||1):0);
  const op={id:editingId||uid('op'),entryDate:get('entryDate'),exitDate:get('exitDate'),sample:get('sample'),riskStrategyId:riskId,riskStrategyName:risk?.name||'',atr:Number(get('atr')||0)||null,hypothesis:get('hypothesis'),h4Context:get('h4Context'),h4Phase:get('h4Phase'),setup:get('setup'),vd:get('vd'),nr:get('nr'),tradeType:get('tradeType'),direction:get('direction'),timeframe:get('timeframe'),dtPrice:Number(get('dtPrice')||0)||null,notes:get('notes'),contract:get('contract'),contracts:Number(get('contracts')||0),entryType:get('entryType'),entryPrice:Number(get('entryPrice')||0)||null,stopTicks:Number(get('stopTicks')||0),targetMode:get('targetMode'),targetR:Number(get('targetR')||0)||0,resultTicks,pnlNet:Number(get('pnlNet')||0)||0,commission:Number(get('commission')||0)||0,mfe:Number(get('mfe')||0)||0,mae:Number(get('mae')||0)||0,discipline:get('discipline')==='Sí',disciplineReason:get('disciplineReason'),result:get('result'),rMultiple:Number(rMultiple)||0,raw:{source:'manual'},updatedAt:new Date().toISOString()};
  const existing=state.operations.findIndex(x=>x.id===op.id); if(existing>=0)state.operations[existing]=op;else state.operations.push(op); saveState(); closeModal();
}

function viewOperation(id){const o=state.operations.find(x=>x.id===id);if(!o)return; alert(`Trade ${o.contract||''}\n${fmtDate(o.entryDate)}\n${o.direction} · ${o.setup} · ${o.vd}\nResultado: ${o.rMultiple>=0?'+':''}${Number(o.rMultiple).toFixed(2)}R\nRégimen: ${o.riskStrategyName||'—'}`)}
function editOperation(id){openOperationModal(id)}

function editHyp(id){const h=state.settings.hypotheses.find(x=>x.id===id);const name=prompt('Nombre',h.name);if(name===null)return;const desc=prompt('Descripción / lógica de la hipótesis',h.description||'');h.name=name.trim()||h.name;h.description=desc??h.description;saveState()}
function editRisk(id){const r=state.settings.riskStrategies.find(x=>x.id===id);const name=prompt('Nombre',r.name);if(name===null)return;const instrument=prompt('Instrumento',r.instrument);const contracts=prompt('Contratos',r.contracts);const stop=prompt('Stop (ticks)',r.stopTicks);const target=prompt('Objetivo (R2 / Liquidez / Discrecional)',r.targetMode);r.name=name.trim()||r.name;r.instrument=instrument||r.instrument;r.contracts=Number(contracts)||r.contracts;r.stopTicks=Number(stop)||r.stopTicks;r.targetMode=target||r.targetMode;r.targetText=r.targetMode;saveState()}

function handleImport(file){const reader=new FileReader();reader.onload=()=>{try{const text=String(reader.result).replace(/^\uFEFF/,'').trim();const lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('No hay filas de datos');const header=lines[0].split('|');const rows=lines.slice(1).map(line=>{const vals=line.split('|');const o={raw:{source:'ankora',line},id:uid('imp')};header.forEach((h,i)=>o[h]=vals[i]??'');
  const d=parseDateTime(o.EntryDateTime); o.entryDate=d; o.exitDate=parseDateTime(o.ExitDateTime);o.direction=o.BuySell==='BUY'?'LONG':o.BuySell==='SELL'?'SHORT':o.BuySell;o.contract=o.Contract;o.timeframe=o.TimeFrame;o.contracts=Number(o.TotQuantity)||0;o.setup=o.Setup;o.vd=o.VD;o.nr=o.NR;o.hypothesis=o.Hypothesis?`H${o.Hypothesis}`:'';o.resultTicks=(Number(o.Lot1Ticks)||0)+(Number(o.Lot2Ticks)||0);o.stopTicks=Number(o.StopLossTicks)||0;o.targetMode='R2';o.targetR=o.stopTicks?2:0;o.rMultiple=o.stopTicks?o.resultTicks/o.stopTicks:0;o.result=o.resultTicks>0?'win':o.resultTicks<0?'loss':'pending';o.riskStrategyId='';o.riskStrategyName='Importado';o.h4Context=o.Custom1||'';o.tradeType=o.Custom2||'';o.notes=o.Notes||'';o.mfe=0;o.mae=0;o.pnlNet=0;o.sample='';o.discipline=o.TPCompliance==='True'; return o;}); state.operations.push(...rows); saveState(); alert(`Importación completada: ${rows.length} operación(es).`); navigate('operations');}catch(e){alert('No se pudo importar: '+e.message)}};reader.readAsText(file,'utf-8')}
function parseDateTime(v){if(!v)return ''; const [date,time='00:00:00']=String(v).split(' ');const [dd,mm,yyyy]=date.split('/');return `${yyyy}-${mm}-${dd}T${time.slice(0,5)}`}
document.getElementById('importFile').addEventListener('change',e=>{if(e.target.files[0])handleImport(e.target.files[0]);e.target.value=''})

function navigate(view){currentView=view;render()}
function render(){document.getElementById('app').innerHTML=shell();const view=document.getElementById('view');view.innerHTML=currentView==='dashboard'?dashboard():currentView==='operations'?operations():currentView==='blocks'?blocks():config();}
render();
window.navigate=navigate;window.openOperationModal=openOperationModal;window.closeModal=closeModal;window.saveOperationFromForm=saveOperationFromForm;window.filterOperations=filterOperations;window.editOperation=editOperation;window.viewOperation=viewOperation;window.showBlock=showBlock;window.addConfig=addConfig;window.removeConfig=removeConfig;window.resetConfig=resetConfig;window.editHyp=editHyp;window.editRisk=editRisk;
