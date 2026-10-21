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
