import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const sec=fs.readFileSync('security-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const fail=[];
const need=(cond,msg)=>{if(!cond)fail.push(msg);};
const region=(start,end)=>{const a=app.indexOf(start),b=a<0?-1:app.indexOf(end,a+start.length);return a>=0&&b>=0?app.slice(a,b):'';};

need(pkg.version==='31.22.0',`Versión inesperada ${pkg.version}`);
need(index.includes('<script src="security-runtime.js"></script>'),'index.html no carga security-runtime.js.');
need(index.includes('<script src="event-runtime.js"></script>'),'index.html no carga event-runtime.js.');
need(index.includes('trading-research-source-version" content="31.22.0"'),'source-version no es 31.22.0.');
need(app.includes('function inlineUriToken(value){return globalThis.encodeURIComponent'), 'Falta token URI seguro para contexto inline.');
need(app.includes(".replace(/'/g,'%27')"),'inlineUriToken no codifica el apóstrofo.');
need(app.includes('function modalShell(title,body,footer){return `<div class="modal-backdrop"')&&app.includes('<div class="modal-head"><h3>${esc(title)}</h3>'),'modalShell no escapa el título en el sink.');
need(app.includes("function openImageLightbox(id,title=''){const safeTitle=decodeURIComponent(title||'Imagen');"),'Lightbox no entrega el título al sink de modal seguro.');
need(app.includes("inlineUriToken(meta.caption||meta.name||meta.label||'Imagen')"),'Caption de imagen no usa token seguro en el handler declarativo.');

need(app.includes('function formDataFrom(')&&app.includes('function formDataValue('),'Faltan helpers FormData.');
need(app.includes('name="${esc(name)}" class="input"')&&app.includes('name="${esc(name)}" class="select"'),'Los field helpers no publican name para FormData.');
need(app.includes('name="ref-kind"')&&app.includes('name="ref-key"'),'Referencia visual incompleta para FormData.');
need(app.includes('name="review-target"'),'Review target no participa en FormData.');
need(app.includes('function ratingField(label,name,value){return `<div class="field"><label>${label} · 1–5</label><input id="f-${name}" name="${esc(name)}"'),'ratingField no participa en FormData.');
need(app.includes('const body=`<form data-tr-onsubmit="return false"><div class="trade-context-strip">'),'Diario emocional no está envuelto en form.');
need(app.includes('const body=`<form data-tr-onsubmit="return false"><div class="form-section"><h4>Límites diarios</h4>'),'Gestión de riesgo no está envuelta en form.');

const savers=[
  ['saveVisualReference','async function saveVisualReference','function deleteVisualReference'],
  ['saveRiskManagement','function saveRiskManagement','function journalFilteredOps'],
  ['saveEmotionalEditor','function saveEmotionalEditor','function shell'],
  ['savePlan','function savePlan','function openInstrumentModal'],
  ['saveInstrument','function saveInstrument','function openRiskModal'],
  ['saveOperationFromForm','async function saveOperationFromForm','function editOperation'],
  ['saveReviewNote','function saveReviewNote','function deleteReviewNote']
];
for(const [name,start,end] of savers){const r=region(start,end);need(r&&r.includes('formDataFrom('),`${name} no usa FormData.`);}

need(sec.includes("const TR_SECURITY_RUNTIME_VERSION='31.18.0'"),'Security runtime tiene versión incorrecta.');
for(const probe of ['trSecurityProbeEscaping','trSecurityProbeModalTitle','trSecurityProbeInlineToken','trSecurityProbeFormData'])need(sec.includes(`function ${probe}(`),`Falta sonda ${probe}.`);
need(sec.includes('const trSecurityDataSecurityBase=dataSecurityPanel'),'Security runtime no se integra en Datos y seguridad.');
need(sec.includes('<strong>V31.18</strong>'),'Mode card no anuncia V31.18.');
need(sec.includes('inlineHandlersLegacy:false')&&sec.includes('eventDelegationReady:true')&&sec.includes('strictCspReady:false'),'El estado Event Delegation/CSP base no está declarado correctamente.');

const rawEncode=(app.match(/(?<![.\w])encodeURIComponent\s*\(/g)||[]).length;
need(rawEncode===0,`Quedan ${rawEncode} encodeURIComponent directos fuera del boundary inlineUriToken.`);
const inlineHandlers=(app.match(/\s(?:onclick|onchange|oninput|onsubmit)\s*=/g)||[]).length;
need(inlineHandlers===0,`Quedan ${inlineHandlers} handlers DOM0 ejecutables en app.js.`);

if(fail.length){console.error('\nSecurity verification FAILED');for(const x of fail)console.error(' - '+x);process.exit(1);}
console.log('Security verification OK');
console.log(' - Modal title sink: escaped');
console.log(' - Dynamic URI tokens in delegated handler payloads: apostrophe-safe');
console.log(' - Core FormData boundaries: 7/7');
console.log(` - Executable inline handlers remaining: ${inlineHandlers}`);
console.log(' - Event delegation: verified separately; CSP verified by verify-csp');
