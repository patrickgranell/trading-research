import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync('app.js','utf8');
const emotional=fs.readFileSync('emotional-runtime.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const backup=fs.readFileSync('backup-v2-runtime.js','utf8');
const cloud=fs.readFileSync('cloud-v10-runtime.js','utf8');
const cleanup=fs.readFileSync('operation-cleanup-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const migration=fs.readFileSync('supabase/migrations/202610060001_v31_29_emotional_journal.sql','utf8');

assert(app.includes("emotionalJournal: {schemaVersion:1,sessions:[],entries:[],streakEpisodes:[],weeklyReviews:[]}"),'Workspace default lacks emotionalJournal root');
assert(app.includes('out.emotionalJournal={'),'normalizeState does not preserve emotionalJournal');
assert(index.includes('<script src="emotional-runtime.js"></script>'),'Emotional runtime is not loaded');
assert(index.indexOf('emotional-runtime.js')>index.indexOf('cloud-v10-runtime.js'),'Emotional runtime must load after Cloud V10');
assert(index.indexOf('emotional-runtime.js')<index.indexOf('render-closure-runtime.js'),'Emotional runtime must load before render closure');

assert(emotional.includes("function trEEligible(o){return trELayer(o)!=='backtest';}"),'Backtesting-only exclusion contract changed');
assert(emotional.includes("['live','Live'],['sim','Sim'],['replay','Market Replay']"),'Session environment choices must be Live/Sim/Market Replay only');
assert(!emotional.includes("['backtest','Backtest']"),'Backtesting must not be selectable as an emotional session');
assert(emotional.includes("['very_low','Muy baja']")&&emotional.includes("['very_high','Muy alta']"),'Five-level confidence scale missing');
assert(emotional.includes("['low','Bajo'],['medium','Medio'],['high','Alto']"),'Three-level subjective scale missing');
assert(emotional.includes("confidencePersonal:cv(raw.confidencePersonal)")&&emotional.includes("stress:sv(raw.stress)"),'Null-safe session normalization missing');
assert(emotional.includes("tradingPlanId:String(raw.tradingPlanId||'')"),'Sessions cannot exist without a Trading Plan');
assert(emotional.includes("endedAt=String(raw.endedAt||'')"),'Sessions cannot remain open');
assert(emotional.includes("Diario emocional sobre ejecución; Backtesting está excluido."),'Coverage contract does not state Backtesting exclusion');
assert(emotional.includes("goal?.metric!=='journal'"),'Goal journal denominator is not specialized');
assert(emotional.includes("['journal','focus','stress','behavior','emotion']"),'Data Quality emotional denominator is not specialized');

assert(structural.includes('TradingResearchEmotionalJournalPresentationContract?.render?.()'),'Structural router does not use V31.29 journal presentation');

assert(backup.includes('emotionalSessions:workspace?.emotionalJournal?.sessions?.length||0'),'Backup V2 manifest does not count emotional sessions');
assert(backup.includes('Manifest count emotionalSessions no coincide'),'Backup V2 preflight does not verify emotional sessions');

assert(cloud.includes('emotionalJournal:'),'Cloud V10 bundle does not include emotionalJournal');
assert(cloud.includes('emotional_journal'),'Cloud V10 remote workspace does not include emotional_journal');
assert(cloud.includes("emotionalJournal:ws.emotional_journal"),'Cloud pull does not restore emotionalJournal');

assert(/add column if not exists emotional_journal jsonb/i.test(migration),'V31.29 migration does not add emotional_journal');
assert(migration.includes("p_bundle->'emotionalJournal'"),'Atomic RPC does not publish emotionalJournal');
assert(/emotional_journal=excluded\.emotional_journal/i.test(migration),'Atomic RPC does not update emotional_journal');

assert(cleanup.includes("selected.has(String(session.tradingPlanId||''))?{...session,tradingPlanId:''}:session"),'Plan deletion does not detach emotional sessions');
assert(cleanup.includes('state.emotionalJournal=projected.next.emotionalJournal'),'Plan deletion does not commit detached journal');

console.log('Emotional Journal Foundation V31.29 verification OK');
console.log(' - Backtesting excluded; Live/Sim/Replay supported');
console.log(' - categorical confidence + simple subjective levels, missing remains missing');
console.log(' - sessions independent from trades and optional Trading Plan');
console.log(' - journal coverage denominators exclude Backtesting');
console.log(' - Backup V2 + Cloud V10 + safe plan deletion include emotional sessions');
