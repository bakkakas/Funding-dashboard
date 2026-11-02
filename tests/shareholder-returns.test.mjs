import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFx} from '../js/fx-rate.js';
import {quarterlyYield,renderShareholderReturns,dividendStats} from '../js/shareholder-returns.js';
const now=Date.UTC(2026,10,2);
test('FX rejects stale, future, nonpositive and unsuccessful reference data',()=>{
 const base={result:'success',rates:{KRW:1332.76},time_last_update_unix:now/1000};
 assert.equal(parseFx(base,now).rate,1332.76);
 for(const changes of [{result:'error'},{rates:{KRW:0}},{rates:{KRW:'bad'}},{time_last_update_unix:now/1000-4*86400},{time_last_update_unix:now/1000+86400}])assert.throws(()=>parseFx({...base,...changes},now));
});
test('quarterly yield is not annualized and never divides mixed currencies',()=>{
 assert.equal(quarterlyYield({dps:4601,currency:'KRW'},230050,'KRW'),2);
 assert.equal(quarterlyYield({dps:4601,currency:'KRW'},200,'USD'),null);
 assert.equal(quarterlyYield({dps:4601,currency:'KRW'},0,'KRW'),null);
 assert.equal(quarterlyYield({dps:0,currency:'KRW'},100,'KRW'),0);
});
test('policy source excerpts are escaped, invalid links rejected and missing policy never means zero',()=>{
 const html=renderShareholderReturns({documents:[{title:'<script>x</script>',url:'javascript:alert(1)',paragraphs:['<img onerror=x>']}],monitor:{status:'failed'}},{currency:'KRW'},100);
 assert(!html.includes('<script>'));assert(!html.includes('href="javascript:'));assert(html.includes('&lt;img'));assert(html.includes('무배당·환원 없음이라는 뜻이 아닙니다'));
});
test('provider annual dividend and latest quarter remain different metrics',()=>{
 const result=dividendStats([{label:'배당수익률',asOf:'2025.12',value:'1.5%'}]);
 assert.equal(result[0].value,'1.5%');assert(result[0].asOf.includes('2025.12'));assert(result[0].asOf.includes('별도'));
});
