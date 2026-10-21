import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wiseEarnings,yahooEarnings,earningsDelta,fourQuarterTrend} from '../js/earnings-data.js';
import {financialQuarters} from '../js/stock-data.js';
import {STOCKS} from '../js/asset-identity.js';
const fixture=name=>readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8');
test('WiseReport maps same-quarter pre-announcement estimate to preliminary actual, not future zero',()=>{
 const rows=wiseEarnings([{label:'영업이익',data:JSON.parse(fixture('wise-earnings.json'))}]);
 assert.equal(rows.length,4);assert.equal(rows[0].period,'2026-12');assert.equal(rows[0].metrics[0].actual,null);
 const r=rows.find(r=>r.period==='2026-09').metrics[0];assert.equal(r.estimate,1060029.4);assert.equal(r.actual,1074000);assert.equal(r.announcedAt,'2026-10-08');
 assert.match(rows[1].basis,/잠정/);
});
test('Yahoo pairs matching history columns and preserves original DKK and selected accounting basis',()=>{
 const rows=yahooEarnings(fixture('yahoo-earnings.html'));assert.equal(rows.length,4);
 assert.equal(rows[0].period,'2026-06-30');assert.equal(rows[0].metrics[0].estimate,4.98);assert.equal(rows[0].metrics[0].actual,6.18);assert.equal(rows[0].metrics[0].unit,'DKK / 주');assert.equal(rows[0].basis,'조정 EPS (Normalized)');
 const gaap=fixture('yahoo-earnings.html').replace(/\schecked/g,'').replace('value="gaap"','checked value="gaap"');assert.equal(yahooEarnings(gaap)[0].basis,'GAAP EPS');
 assert.throws(()=>yahooEarnings(fixture('yahoo-earnings.html').replace('Currency in DKK','Currency unknown')),/currency/);
 assert.throws(()=>yahooEarnings('<html>Rate limited</html>'),/not provided/);
});
test('surprise handles negative estimates, zero and missing without fake percentages',()=>{
 assert.deepEqual(earningsDelta(-1,-2),{amount:1,percent:50});assert.deepEqual(earningsDelta(1,0),{amount:1,percent:null});assert.deepEqual(earningsDelta(1,null),{amount:null,percent:null});
});
test('four quarters are actuals only, chronological, and comparisons do not bridge gaps or zero/negative bases',()=>{
 const q=financialQuarters({trTitleList:['202503','202506','202509','202512','202603','202606'].map((key,i)=>({key,title:key,isConsensus:i===5?'Y':'N'})),rowList:[{title:'매출액',columns:Object.fromEntries(['202503','202506','202509','202512','202603','202606'].map((key,i)=>[key,{value:[100,0,-10,20,30,999][i]}]))}]});
 const r=fourQuarterTrend(q,'revenue');assert.deepEqual(r.map(x=>x.key),['202506','202509','202512','202603']);assert.equal(r[0].percent,-100);assert.equal(r[1].percent,null);assert.equal(r[2].percent,null);assert.equal(r[3].percent,50);
 assert.equal(fourQuarterTrend(q.filter(x=>x.key!=='202512'),'revenue').at(-1).delta,null);
 assert.ok(fourQuarterTrend(q,'operating').every(x=>x.value===null));
});
test('new stock catalogue entries use issuer logo URLs, not ETF images',()=>{
 assert.ok(STOCKS.every(s=>s.logo===`https://ssl.pstatic.net/imgstock/fn/real/logo/png/stock/Stock${s.code}.png`));
});

test('grouped domestic trend matches month and parent-net metric, keeps finalized actual and missing estimates',async()=>{
 const {comparisonTrend}=await import('../js/earnings-data.js');
 const q=['202509','202512','202603','202606'].map((key,i)=>({key,period:key,metrics:[{label:'매출액',value:100+i},{label:'순이익',value:20},{label:'지배주주순이익',value:15}]}));
 const records=[{period:'2026-06',basis:'IFRS 연결 · 최초 발표치(잠정 포함)',metrics:[{label:'매출액',actual:102,estimate:99,unit:'억 KRW'},{label:'지배주주 순이익',actual:14,estimate:12,unit:'억 KRW'}]},{period:'2026-09',basis:'IFRS 연결',metrics:[{label:'매출액',actual:null,estimate:500,unit:'억 KRW'}]}];
 const r=comparisonTrend(q,records,'revenue','금액: 억 KRW');assert.equal(r.length,4);assert.equal(r.at(-1).value,103);assert.equal(r.at(-1).estimate,99);assert.equal(r[0].estimate,null);
 assert.equal(comparisonTrend(q,records,'parentNet','억 KRW').at(-1).value,15);assert.equal(comparisonTrend(q,records,'parentNet','억 KRW').at(-1).estimate,12);
 assert.equal(comparisonTrend(q,records,'net','억 KRW').at(-1).estimate,null);
 assert.ok(comparisonTrend(q,records,'revenue','USD(백만)').every(x=>x.estimate===null));
 assert.ok(comparisonTrend(q,records.map(r=>({...r,basis:'별도'})),'revenue','억 KRW').every(x=>x.estimate===null));
});
test('EPS trend uses four announced quarters with source currency and accounting basis, not unrelated income EPS',async()=>{
 const {comparisonTrend}=await import('../js/earnings-data.js');
 const rows=yahooEarnings(fixture('yahoo-earnings.html'));
 const r=comparisonTrend([],rows,'eps');assert.equal(r.length,4);assert.equal(r.at(-1).value,6.18);assert.equal(r.at(-1).estimate,4.98);assert.equal(r[0].unit,'DKK / 주');
 const future={period:'2026-09-30',basis:rows[0].basis,metrics:[{label:'EPS',estimate:10,actual:null,unit:'DKK / 주'}]};assert.deepEqual(comparisonTrend([], [future,...rows], 'eps'),r);
 const mixed=structuredClone(rows);mixed[1].metrics[0].unit='USD / 주';mixed[2].basis='GAAP EPS';mixed[3].metrics[0].estimate=0;
 const filtered=comparisonTrend([],mixed,'eps');assert.equal(filtered.length,2);assert.equal(filtered[0].estimate,0);
 assert.deepEqual(comparisonTrend([],[],'eps'),[]);
});
