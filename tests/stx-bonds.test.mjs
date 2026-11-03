import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bondFunding,bondUsd,atomicAmount,bondTiming,activeBondTotals,validateStxBonds} from '../js/stx-bonds.js';
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

test('funding uses actual deposits and cap, never rewards or registration count',()=>{
 const b=structuredClone(data.bonds[0]);b.balances.locked.btc='2500000000';b.parameters.btc_capacity='10000000000';
 assert.equal(bondFunding(b).percent,25);
 b.balances.locked.btc='10000000000';assert.equal(bondFunding(b).percent,100);
 b.balances.locked.btc='11000000000';assert.equal(bondFunding(b).percent,100);
 b.parameters.btc_capacity='0';assert.equal(bondFunding(b).percent,null);
});
test('USD valuation rejects missing, stale and invalid prices but keeps true zero balances',()=>{
 const now=Date.now(),q={price:100000,time:now};
 assert.equal(bondUsd(2,q,now),200000);assert.equal(bondUsd(0,q,now),0);
 for(const quote of [null,{price:0,time:now},{price:NaN,time:now},{price:1,time:now-3600001},{price:1,time:now+120000}])assert.equal(bondUsd(2,quote,now),null);
});
