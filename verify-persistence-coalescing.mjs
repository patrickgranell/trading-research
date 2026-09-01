import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const app=fs.readFileSync('app.js','utf8');
const runtime=fs.readFileSync('persistence-coalescing-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const runtimeCode=runtime.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
const fail=[];const need=(c,m)=>{if(!c)fail.push(m);};

need(pkg.version==='31.25.0',`Versión inesperada ${pkg.version}`);
need(index.includes('<script src="persistence-coalescing-runtime.js"></script>'),'index.html no carga persistence-coalescing-runtime.js.');
need(index.indexOf('persistence-coalescing-runtime.js')>index.indexOf('state-runtime.js'),'Persistence coalescer debe cargar después de State Runtime.');
need(index.indexOf('persistence-coalescing-runtime.js')<index.indexOf('security-runtime.js'),'Persistence coalescer debe instalarse antes del runtime de seguridad/diagnóstico.');
const queueStart=app.indexOf("function trCoreQueueStateWrite(reason='persist'){");
const queueEnd=queueStart<0?-1:app.indexOf("\nfunction trCorePersistStateBridge",queueStart);
const queueSource=queueStart>=0&&queueEnd>queueStart?app.slice(queueStart,queueEnd):'';
need(queueSource.includes('const snapshot=clone(state);'),'La deuda histórica que motiva el boundary cambió: revisar la estrategia de coalescing.');
need(runtime.includes("const TR_PERSIST_COALESCE_VERSION='31.23.55'"),'Falta versión del persistence coalescer.');
need(runtime.includes('const TR_PERSIST_DEBOUNCE_MS=200'),'El debounce de persistencia no está fijado en 200ms.');
need(runtime.includes('const trPersistBridgeBase=trCorePersistStateBridge'),'No se captura el bridge histórico antes de sustituirlo.');
need(runtime.includes("trCorePersistStateBridge=function(reason='persist'){return trPersistSchedule(reason);}"),'persist() no queda dirigido al scheduler sincrónicamente barato.');
need(runtime.includes('trPersistTimer=setTimeout(()=>{void trPersistRunPending();},TR_PERSIST_DEBOUNCE_MS)'),'No se difiere la escritura hasta el final del debounce.');
need(runtime.includes('const ok=trPersistBridgeBase(pending.reason)'),'El snapshot histórico no se ejecuta dentro de la fase diferida.');
need(!runtimeCode.includes('clone(state)'),'El runtime de coalescing no debe volver a clonar el workspace por petición.');
need(runtime.includes("trCorePersistNow=async function(reason='persist')"),'Falta semántica de persistencia inmediata.');
need(runtime.includes('trPersistCancelPendingAsSuperseded();return trPersistNowBase(reason)'),'PersistNow no cancela una escritura legacy redundante antes del snapshot inmediato.');
need(runtime.includes('trCoreFlush=async function()')&&runtime.includes('await trPersistRunPending()')&&runtime.includes('return trFlushBase()'),'Flush no fuerza el debounce pendiente antes de esperar IndexedDB.');
need(runtime.includes("document.addEventListener('visibilitychange'")&&runtime.includes("addEventListener('pagehide'"),'Falta flush preventivo al ocultar/salir de la página.');
need(runtime.includes('writeCoalescing:{version:TR_PERSIST_COALESCE_VERSION'),'Persistencia no expone diagnóstico del coalescer.');
need(!/\bwindow\s*\./.test(runtimeCode),'El runtime de coalescing no debe reabrir superficie global explícita.');

if(fail.length){console.error('Persistence coalescing verification FAILED');for(const f of fail)console.error(' - '+f);process.exit(1);}
console.log('Persistence coalescing verification OK');
console.log(' - Legacy persist requests: debounce before historical clone(state)');
console.log(' - Controlled DomainStore commands: immediate historical bridge unchanged');
console.log(' - Debounce: 200ms; explicit flush drains pending write');
console.log(' - Lifecycle: hidden/pagehide starts pending write');
console.log(' - New explicit window globals: 0');
