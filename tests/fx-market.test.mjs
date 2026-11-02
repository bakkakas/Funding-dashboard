import test from 'node:test';import assert from 'node:assert/strict';
import {parseBankFx,parseMarketFx} from '../js/fx-data.js';
const now=Date.parse('2026-11-02T05:45:00Z');
const row={reutersCode:'FX_USDKRW',unit:'KRW',closePrice:'1,341.60',localTradedAt:'2026-11-02T14:42:44+09:00',degreeCount:406};
test('latest bank notice carries actual provider timestamp, not fetch time',()=>{
 const d=parseBankFx({exchangeInfo:row},now);assert.equal(d.rate,1341.6);assert.equal(d.at,Date.parse(row.localTradedAt));assert.equal(d.round,406);assert.equal(parseMarketFx(d,now).kind,'bank-reference');
});
test('reject missing, wrong pair, stale, future, invalid quotes',()=>{
 for(const patch of [{reutersCode:'FX_JPYKRW'},{unit:'USD'},{closePrice:null},{closePrice:'Infinity'},{localTradedAt:'bad'},{localTradedAt:'2026-10-20T00:00:00Z'},{localTradedAt:'2026-11-03T00:00:00Z'}])assert.throws(()=>parseBankFx({exchangeInfo:{...row,...patch}},now));
 assert.throws(()=>parseMarketFx({rate:1341,at:now,source:'unknown'},now));
});
test('weekend last quote remains dated rather than fabricated live',()=>{
 const d=parseBankFx({exchangeInfo:{...row,localTradedAt:'2026-10-30T18:00:00+09:00'}},now);assert.equal(d.at,Date.parse('2026-10-30T18:00:00+09:00'));
});
