import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyBook,ledger,valuation,assetKey,periodSummary,periodKey,validateBook} from '../js/trade-journal-model.js';
const asset={symbol:'A',name:'Example A',asset_class:'stock',quote_symbol:'NAVER:A.O',currency:'USD'};
const now=Date.parse('2026-11-20T12:00:00Z');
const t=(id,side,qty,price,fee=0,at='2026-11-19T01:00:00Z',extra={})=>({id,side,qty,price,fee,at,asset,...extra});
const book=(trades,USD=1000)=>({initial:{KRW:100000,USD},trades});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('moving average includes buy/sell costs and partial sales',()=>{
 const r=ledger(book([t('1','buy',10,10,2),t('2','buy',10,20,2),t('3','sell',5,30,1)]),'real',now);
 near(r.positions[0].qty,15);near(r.positions[0].cost,228);near(r.realized.USD,73);near(r.rows[2].basis,76);
});
test('full close then reopen resets remaining average, retains realized',()=>{
 const r=ledger(book([t('1','buy',2,100,2),t('2','sell',2,80,2),t('3','buy',1,50)]),'real',now);
 near(r.realized.USD,-44);assert.equal(r.rows[1].closed,true);near(r.positions[0].cost,50);near(r.positions[0].qty,1);
});
test('paper cash constraint and no short sales',()=>{
 const quote={source:'test',as_of:'2026-11-19',fetched_at:'2026-11-19T01:00:00Z'};
 assert.throws(()=>ledger(book([t('1','buy',11,100,0,undefined,{quote})]),'paper',now),/부족/);
 assert.throws(()=>ledger(book([t('1','sell',1,10)]),'real',now),/보유/);
 assert.throws(()=>ledger(book([t('1','buy',1,10),t('2','sell',2,10)]),'real',now),/보유/);
});
test('KRW and USD cash remain independent',()=>{
 const quote={source:'test',as_of:'2026-11-19',fetched_at:'2026-11-19T01:00:00Z'};
 assert.throws(()=>ledger(book([t('1','buy',1,10,0,undefined,{quote})],0),'paper',now),/부족/);
});
test('historical edits replay chronologically and may invalidate sells',()=>{
 const trades=[t('sell','sell',1,120,0,'2026-11-19T02:00:00Z'),t('buy','buy',2,100)];
 near(ledger(book(trades),'real',now).realized.USD,20);
 assert.throws(()=>ledger(book([trades[0]]),'real',now),/보유/);
});
test('same timestamp preserves recorded order',()=>{
 near(ledger(book([t('1','buy',1,100),t('2','sell',1,110)]),'real',now).realized.USD,10);
 assert.throws(()=>ledger(book([t('2','sell',1,110),t('1','buy',1,100)]),'real',now),/보유/);
});
test('KST day, Monday week and year-boundary month buckets',()=>{
 assert.equal(periodKey('2026-11-19T15:00:00Z','day'),'2026-11-20');
 assert.equal(periodKey('2026-11-22T15:00:00Z','week'),'2026-11-23');
 assert.equal(periodKey('2026-12-31T15:00:00Z','month'),'2027-01');
});
test('period realized only, denomination and date filters',()=>{
 const r=ledger(book([t('1','buy',2,100),t('2','sell',1,110,1),t('3','sell',1,90,1,'2026-11-20T01:00:00Z')]),'real',now);
 assert.deepEqual(periodSummary(r.rows,'day','USD').map(x=>x.profit),[9,-11]);
 assert.equal(periodSummary(r.rows,'week','USD')[0].profit,-2);
 assert.equal(periodSummary(r.rows,'day','KRW').length,0);
 assert.equal(periodSummary(r.rows,'day','USD','2026-11-20','2026-11-20')[0].profit,-11);
});
test('missing quotes are unknown not zero; fully closed book has no unrealized PnL',()=>{
 const r=ledger(book([t('1','buy',2,100,2)]),'real',now);
 assert.equal(valuation(r,{},'USD').unrealized,null);
 near(valuation(r,{[assetKey(asset)]:{price:120}},'USD').unrealized,38);
 const closed=ledger(book([t('1','buy',1,100),t('2','sell',1,110)]),'real',now);
 assert.equal(valuation(closed,{},'USD').unrealized,0);
});
test('reject malformed, duplicate, future, invalid SL, nonfinite and zero price',()=>{
 for(const extra of [{qty:0},{price:0},{price:Infinity},{fee:-1},{sl:100},{at:'2028-01-01'},{asset:{...asset,currency:'USDT'}},{qty:null}])assert.throws(()=>ledger(book([t('1','buy',1,100,0,undefined,extra)]),'real',now));
 assert.throws(()=>validateBook(book([t('1','buy',1,100),t('1','buy',1,100)]),'real',now),/중복/);
});
test('fractional purchases closed without phantom residual',()=>{
 const r=ledger(book([t('1','buy',.1,10),t('2','buy',.2,10),t('3','sell',.3,12)]),'real',now);
 assert.equal(r.positions[0].qty,0);near(r.realized.USD,.6);
});
test('paper requires quote; empty book is valid without invented funding',()=>{
 assert.throws(()=>ledger(book([t('1','buy',1,100)]),'paper',now),/시세/);
 assert.deepEqual(ledger(emptyBook(),'paper',now).cash,{KRW:0,USD:0});
});
test('closed round trip aggregates partial realizations and starts a new cycle',()=>{
 const r=ledger(book([t('1','buy',2,100,1),t('2','sell',1,120,1),t('3','sell',1,120,1),t('4','buy',1,50),t('5','sell',1,45)]),'real',now);
 near(r.rows[2].closed_profit,37);near(r.rows[4].closed_profit,-5);near(r.realized.USD,32);
});
