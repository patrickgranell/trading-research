import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const runtime=fs.readFileSync('operation-cleanup-runtime.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const a='/* PLAN DELETION TESTABLE CORE START */',b='/* PLAN DELETION TESTABLE CORE END */';
assert(runtime.includes(a)&&runtime.includes(b),'Missing plan-deletion testable core');
const src=runtime.split(a)[1].split(b)[0];
const projection=vm.runInNewContext(src+'; trPlanDeletionProjection',{}, {timeout:1000});
const seed={
 tradingPlans:[{id:'a',status:'active'},{id:'b',status:'archived'},{id:'c',status:'active'}],currentPlanId:'a',
 operations:[{id:'o1',tradingPlanId:'a',importBatchId:'i1'},{id:'o2',tradingPlanId:'b'},{id:'o3',tradingPlanId:'c'}],
 importBatches:[{id:'i1',tradingPlanId:'a'},{id:'i2',tradingPlanId:'c'}],
 opportunities:[{id:'p1',tradingPlanId:'a'},{id:'p2',tradingPlanId:'c'}]
};
const clean=x=>JSON.parse(JSON.stringify(x));
const p=clean(projection(seed,['a']));
assert.deepEqual(p.next.tradingPlans.map(x=>x.id),['b','c']);
assert.deepEqual(p.next.operations.map(x=>x.id),['o2','o3']);
assert.deepEqual(p.next.importBatches.map(x=>x.id),['i2']);
assert.deepEqual(p.next.opportunities.map(x=>x.id),['p2']);
assert.equal(p.next.currentPlanId,'c');
assert.deepEqual(p.removedOperations.map(x=>x.id),['o1']);
assert.throws(()=>projection(seed,['a','b','c']),/al menos un Trading Plan/);
assert.throws(()=>projection(seed,['missing']),/no existe/);
const foreign=clean(seed);foreign.operations[0].tradingPlanId='c';
assert.throws(()=>projection(foreign,['a']),/otro Trading Plan/);
const foreignBatch=clean(seed);foreignBatch.operations[0].importBatchId='i2';
assert.throws(()=>projection(foreignBatch,['a']),/otro Trading Plan/);
assert(runtime.includes('trBackupV2BuildPayload')&&runtime.includes('trBackupV2Preflight'),'Deletion requires a certified complete backup');
assert(runtime.includes('plan-delete-rollback'),'Desktop rollback backup label missing');
assert(runtime.includes('trCoreFlush')&&runtime.includes('TRDomainStore.exclusive'),'Durable commit boundary missing');
assert(app.includes('data-tr-plan-delete-id')&&app.includes('data-tr-plan-delete-selected')&&app.includes('data-tr-plan-select'),'Single and bulk deletion UI missing');
assert(runtime.includes('trPlanDeleteMarketReferences'),'External Market Data reference guard missing');
console.log('Plan-deletion gate OK: projection, last-plan guard, foreign references, Backup V2, single/bulk actions.');
