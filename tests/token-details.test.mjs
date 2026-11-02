import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockMetrics,unlockedPercent} from '../js/token-details.js';
test('unlock valuation uses actual cap and FDV, not maximum supply proxy',()=>{
 assert.deepEqual(unlockMetrics(100,{price:2,marketCap:1000,fdv:4000}),{usd:200,circPercent:20,fdvPercent:5});
 assert.deepEqual(unlockMetrics(100,{price:2,marketCap:null,fdv:0}),{usd:200,circPercent:null,fdvPercent:null});
 assert.deepEqual(unlockMetrics(100,{price:null,marketCap:1000,fdv:4000}),{usd:null,circPercent:null,fdvPercent:null});
});
test('unlocked percentage requires a complete schedule; same-day event remains pending',()=>{
 const asset={market:{maxSupply:1000},unlock:{status:'scheduled',completeSchedule:true,events:[{date:'2026-11-02',amount:200}]}};
 assert.equal(unlockedPercent(asset,'2026-11-02'),80);
 assert.equal(unlockedPercent(asset,'2026-11-03'),100);
 asset.unlock.completeSchedule=false;assert.equal(unlockedPercent(asset,'2026-11-03'),null);
 asset.unlock.status='complete';assert.equal(unlockedPercent(asset,'2026-11-03'),100);
});
import {readFileSync} from 'node:fs';
test('XPL future projection ends at official third anniversary and remains partial',()=>{
 const a=JSON.parse(readFileSync(new URL('../data/research/xpl.json',import.meta.url)));
 assert.equal(a.unlock.events[0].date,'2026-11-25');
 assert.equal(a.unlock.events.at(-1).date,'2028-09-25');
 assert.ok(Math.abs(a.unlock.events[0].amount-(3200000000/36+5000000000*2/3/24))<1e-6);
 assert.equal(unlockedPercent(a,'2026-11-02'),null);
});
test('BNB reported totals do not double count pioneer or BEP95 burns',()=>{
 const d=JSON.parse(readFileSync(new URL('../data/bnb-burns.json',import.meta.url)));
 assert.equal(d.events.length,4);
 assert.equal(d.events.find(e=>e.number===34).amount,1371803.77);
 assert.equal(d.events.find(e=>e.number===37).amount,1646196.44);
 for(const e of d.events){assert.match(e.source,/^https:\/\/www.bnbchain.org\/en\/blog\/\d+th-bnb-burn$/);assert.ok(e.amount>0);assert.ok(e.usd>0);}
});
