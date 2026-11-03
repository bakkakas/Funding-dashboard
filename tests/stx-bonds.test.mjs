import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atomicAmount,bondTiming,activeBondTotals,validateStxBonds} from '../js/stx-bonds.js';
const data=JSON.parse(readFileSync(new URL('../data/stx-bonds.json',import.meta.url)));
test('bond units distinguish satoshis, micro-STX and missing values',()=>{
 assert.equal(atomicAmount('50509730314',8),505.09730314);
 assert.equal(atomicAmount('6752782920045',6),6752782.920045);
 assert.equal(atomicAmount('0',8),0);
 for(const value of [null,'','-1','NaN',undefined])assert.throws(()=>atomicAmount(value,8));
});
test('confirmed start takes precedence; BTC minimum differs from STX end',()=>{
 const b={schedule:{activation:{time_iso:'2026-09-10T10:59:21Z',projected_time_iso:'2026-09-09T00:00:00Z'},unlock:{bitcoin_height:991550,projected_time_iso:'2027-03-02T09:47:06Z'}}};
 const t=bondTiming(b);assert.equal(t.startDate,b.schedule.activation.time_iso);assert.equal(t.startEstimated,false);assert.equal(t.btcHeight,990500);assert.equal(t.btcDate,'2027-02-23T02:47:06.000Z');
 assert.equal(t.stxEstimated,true);
 b.schedule.unlock={bitcoin_height:991550,time_iso:'2027-03-02T09:47:06Z'};
 assert.equal(bondTiming(b).btcDate,null); // do not invent historical BTC unlock from STX confirmation
});
test('active totals exclude upcoming commitments and capacity',()=>{
 const row=(status,btc,stx)=>({status,balances:{locked:{btc,stx}},parameters:{btc_capacity:'999999999999'}});
 assert.deepEqual(activeBondTotals([row('active','100000000','2000000'),row('upcoming','9900000000','99000000'),row('ended','100000000','1000000')]),{btc:1,stx:2});
});
test('published bond snapshot validates and rejects duplicate or missing data',()=>{
 assert.equal(validateStxBonds(data),data);
 const bad=structuredClone(data);bad.bonds.push(bad.bonds[0]);assert.throws(()=>validateStxBonds(bad));
 const missing=structuredClone(data);missing.bonds[0].balances.locked.btc=null;assert.throws(()=>validateStxBonds(missing));
});
