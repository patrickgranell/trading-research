import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

function extractFunction(src,name){
  const start=src.indexOf('function '+name+'(');
  if(start<0)throw new Error('No se encuentra '+name);
  const brace=src.indexOf('{',start);let depth=0,quote='',template=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i],p=src[i-1];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote&&p!=='\\')quote='';continue;}
    if(template){if(c==='\\'){i++;continue;}if(c==='\`'&&p!=='\\')template=false;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}if(c==='\`'){template=true;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('Función sin cierre: '+name);
}

function actualLedgerApi(){
  const context={
    uid:(p)=>p+'-TEST-'+(++context.__uid),
    __uid:0,
    v314CsvSplit:line=>String(line).split(','),
    v314ParseWallDate:s=>Number(s),
    v314Num:s=>Number(s),
    v314NormInstrument:s=>String(s||'').trim().replace(/\s+/g,' ').toUpperCase(),
    v314DetectExecutionEnvironment:()=> 'sim'
  };
  vm.createContext(context);
  const names=['v314ExecutionSide','v314LedgerPositionKey','v314LedgerFill','v314LedgerOpenPosition','v314LedgerFinalizePosition','v314BuildPositionLedger','v314ParseExecutionCsv'];
  const source=names.map(n=>extractFunction(app,n)).join('\n')+';globalThis.__api={parse:v314ParseExecutionCsv,build:v314BuildPositionLedger,side:v314ExecutionSide};';
  vm.runInContext(source,context);
  return context.__api;
}
const api=actualLedgerApi(),parse=api.parse;
const header='Instrumento,Acción,Cantidad,Precio,Tiempo,E/X,Cuenta,Conexión,ID';
const csv=rows=>[header,...rows].join('\n');
const row=(instrument,action,qty,price,time,exType,account,id)=>[instrument,action,qty,price,time,exType,account,'Simulated',id].join(',');

let scale=null;
try{scale=parse(csv([
  row('MNQ 09-26','Comprar',1,100,1,'Entrada','SimA','E1'),
  row('MNQ 09-26','Comprar',1,102,2,'Entrada','SimA','E2'),
  row('MNQ 09-26','Vender',2,104,3,'Salida','SimA','X1')
]),'scale.csv');}catch(e){fail.push('Scale-in fixture lanzó: '+e.message);}
if(scale){
  need(scale.unclosed===0,`D05 scale-in: posición final esperada 0, unclosed=${scale.unclosed}`);
  need(scale.trades.length===1,`D05 scale-in: esperado 1 trade, obtenido ${scale.trades.length}`);
  if(scale.trades[0]){
    need(Number(scale.trades[0].quantity)===2,`D05 scale-in: quantity esperada 2, obtenida ${scale.trades[0].quantity}`);
    need(Math.abs(Number(scale.trades[0].entryPrice)-101)<1e-9,`D05 scale-in: weighted entry esperado 101, obtenido ${scale.trades[0].entryPrice}`);
  }
}

let accounts=null;
try{accounts=parse(csv([
  row('MNQ 09-26','Comprar',1,100,1,'Entrada','Account-A','A1'),
  row('MNQ 09-26','Comprar',1,200,2,'Entrada','Account-B','B1'),
  row('MNQ 09-26','Vender',1,110,3,'Salida','Account-A','A2')
]),'accounts.csv');}catch(e){fail.push('Account isolation fixture lanzó: '+e.message);}
if(accounts){
  need(accounts.trades.length===1,'D05 account isolation: debe cerrar exactamente la cuenta A.');
  need(accounts.trades[0]?.entryRows?.[0]?.account==='Account-A',
    `D05 account isolation: se cerró ${accounts.trades[0]?.entryRows?.[0]?.account||'ninguna'} en vez de Account-A`);
  need(accounts.unclosed===1,`D05 account isolation: Account-B debe seguir abierta; unclosed=${accounts.unclosed}`);
}

let reversal=null;
try{reversal=parse(csv([
  row('MNQ 09-26','Comprar',1,100,1,'Entrada','SimA','R1'),
  row('MNQ 09-26','Vender',2,99,2,'Salida','SimA','R2')
]),'reversal.csv');}catch(e){fail.push('Reversal fixture lanzó: '+e.message);}
if(reversal){
  need(reversal.trades.length===1,'D05 reversal: la posición LONG original debe quedar cerrada una vez.');
  need(reversal.unclosed===1,`D05 reversal: debe quedar SHORT 1 abierta; unclosed=${reversal.unclosed}`);
  need(Number(reversal.trades[0]?.exitRows?.[0]?.qty)===1,
    `D05 reversal: el fill de cierre debe partirse a qty 1, obtenido ${reversal.trades[0]?.exitRows?.[0]?.qty}`);
  need(reversal.openPositions?.[0]?.direction==='SHORT'&&Number(reversal.openPositions?.[0]?.openQuantity)===1,
    'D05 reversal: el remainder no quedó como SHORT 1 en el ledger.');
}

let scaleOut=null;
try{scaleOut=parse(csv([
  row('MNQ 09-26','Comprar',2,100,1,'Entrada','SimA','P1'),
  row('MNQ 09-26','Vender',1,102,2,'Salida','SimA','P2'),
  row('MNQ 09-26','Vender',1,104,3,'Salida','SimA','P3')
]),'scaleout.csv');}catch(e){fail.push('Scale-out fixture lanzó: '+e.message);}
if(scaleOut){
  need(scaleOut.unclosed===0&&scaleOut.trades.length===1,'D05 scale-out: BUY2 + SELL1 + SELL1 debe quedar flat con un trade.');
  need(scaleOut.trades[0]?.exitRows?.length===2,'D05 scale-out: deben conservarse los dos fills de salida.');
  need(Math.abs(Number(scaleOut.trades[0]?.exitPrice)-103)<1e-9,`D05 scale-out: exit VWAP esperado 103, obtenido ${scaleOut.trades[0]?.exitPrice}`);
  need((scaleOut.trades[0]?.realizedMatches||[]).length===2,'D05 scale-out: faltan realizedMatches por fill.');
}

let instruments=null;
try{instruments=parse(csv([
  row('MNQ 09-26','Comprar',1,100,1,'Entrada','SimA','I1'),
  row('MCL 10-26','Comprar',1,70,2,'Entrada','SimA','I2'),
  row('MNQ 09-26','Vender',1,101,3,'Salida','SimA','I3')
]),'instruments.csv');}catch(e){fail.push('Instrument isolation fixture lanzó: '+e.message);}
if(instruments){
  need(instruments.trades.length===1&&instruments.trades[0]?.instrument==='MNQ 09-26','D05 instrument isolation: se cerró el instrumento incorrecto.');
  need(instruments.unclosed===1&&instruments.openPositions?.[0]?.instrument==='MCL 10-26','D05 instrument isolation: MCL debe permanecer abierto.');
}

let unknownRejected=false;
try{parse(csv([
  row('MNQ 09-26','MANTENER',1,100,1,'Entrada','SimA','U1'),
  row('MNQ 09-26','Comprar',1,99,2,'Salida','SimA','U2')
]),'unknown.csv');}catch(e){unknownRejected=true;}
need(unknownRejected,'D05 unknown action: una acción desconocida no fue rechazada y puede degradarse a SHORT.');

need(app.includes('function v314BuildPositionLedger('),'Falta el Position Ledger V31.24.');
need(app.includes('function v314LedgerPositionKey(')&&app.includes("account+'\\u0000'+instrument"),'Position key no es account + instrument.');
need(app.includes('weightedEntryPrice')&&app.includes('openQuantity'),'Estado del ledger incompleto.');
need(app.includes('realizedMatches')&&app.includes('invalidRows'),'Ledger no conserva matches realizados / filas inválidas.');
need(app.includes("throw new Error(`Acción de ejecución no reconocida"),'Acción desconocida no cancela explícitamente la importación.');
need(!app.includes("const dir=r.action.toLowerCase().startsWith('compr')?'LONG':'SHORT'"),
  'El parser histórico aún contiene unknown action → SHORT.');
need(app.includes('if(Array.isArray(trade?.realizedMatches)&&trade.realizedMatches.length)'),
  'El P&L agregado no consume realizedMatches del ledger.');

if(fail.length){
  console.error('Market Data Position Ledger verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Market Data Position Ledger verification OK');
console.log(' - BUY1 + BUY1 + SELL2 => flat, one trade, weighted entry');
console.log(' - BUY2 + SELL1 + SELL1 => partial exits preserved');
console.log(' - account + instrument isolation');
console.log(' - reversal splits closing quantity and opens opposite remainder');
console.log(' - unknown action => rejected, never inferred SHORT');
