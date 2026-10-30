import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wiseEarnings,yahooEarnings,earningsDelta,fourQuarterTrend,comparisonRecords,comparisonTrend} from '../js/earnings-data.js';
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
 const r=comparisonTrend(q,records,'revenue','금액: 억 KRW');assert.equal(r.length,5);assert.equal(r.at(-2).value,103);assert.equal(r.at(-2).estimate,99);assert.equal(r.at(-1).value,null);assert.equal(r.at(-1).estimate,500);assert.equal(r[0].estimate,null);
 assert.equal(comparisonTrend(q,records,'parentNet','억 KRW').at(-1).value,15);assert.equal(comparisonTrend(q,records,'parentNet','억 KRW').at(-1).estimate,12);
 assert.equal(comparisonTrend(q,records,'net','억 KRW').at(-1).estimate,null);
 assert.ok(comparisonTrend(q,records,'revenue','USD(백만)').every(x=>x.estimate===null));
 assert.ok(comparisonTrend(q,records.map(r=>({...r,basis:'별도'})),'revenue','억 KRW').every(x=>x.estimate===null));
});
test('EPS trend uses four announced quarters with source currency and accounting basis, not unrelated income EPS',async()=>{
 const {comparisonTrend}=await import('../js/earnings-data.js');
 const rows=yahooEarnings(fixture('yahoo-earnings.html'));
 const r=comparisonTrend([],rows,'eps');assert.equal(r.length,4);assert.equal(r.at(-1).value,6.18);assert.equal(r.at(-1).estimate,4.98);assert.equal(r[0].unit,'DKK / 주');
 const future={period:'2026-09-30',basis:rows[0].basis,metrics:[{label:'EPS',estimate:10,actual:null,unit:'DKK / 주'}]};const withFuture=comparisonTrend([], [future,...rows], 'eps');assert.deepEqual(withFuture.slice(0,4),r);assert.equal(withFuture.at(-1).estimate,10);assert.equal(withFuture.at(-1).value,null);
 const mixed=structuredClone(rows);mixed[1].metrics[0].unit='USD / 주';mixed[2].basis='GAAP EPS';mixed[3].metrics[0].estimate=0;
 const filtered=comparisonTrend([],mixed,'eps');assert.equal(filtered.length,2);assert.equal(filtered[0].estimate,0);
 assert.deepEqual(comparisonTrend([],[],'eps'),[]);
});

test('partial/empty live responses retain cached pairs and their true collection dates',()=>{
 const cache={source:'WiseReport',asOf:'2026-10-20',rows:[{period:'2026-06',basis:'IFRS 연결',metrics:[{label:'매출액',unit:'억 KRW',actual:100,estimate:90},{label:'영업이익',unit:'억 KRW',actual:20,estimate:10}]}]};
 const live={source:'WiseReport',asOf:'2026-10-27',rows:[{period:'2026-06',basis:'IFRS 연결',metrics:[{label:'매출액',unit:'억 KRW',actual:101,estimate:null}]}]};
 const merged=comparisonRecords(live,cache);assert.equal(merged[0].metrics.length,2);assert.equal(merged[0].metrics[0].actual,100);assert.equal(merged[0].metrics[0].estimate,90);assert.equal(merged[0].metrics[0].asOf,'2026-10-20');
 assert.equal(comparisonRecords({rows:[]},cache)[0].metrics.length,2);
 live.rows[0].metrics[0].estimate=91;const fresh=comparisonRecords(live,cache)[0].metrics;assert.equal(fresh[0].actual,101);assert.equal(fresh[0].asOf,'2026-10-27');assert.equal(fresh[1].asOf,'2026-10-20');
});
test('all four overseas snapshots provide coherent source pairs, never replace operating profit with EBIT',()=>{
 for(const id of ['googl','amzn','nke','novo-nordisk']) {
  const snapshot=JSON.parse(readFileSync(new URL(`../data/earnings-comparison/stock-${id}-fundamentals.json`,import.meta.url)));
  const records=comparisonRecords(null,null,snapshot);
  const wrongActual=[{key:'202606',period:'2026-06',metrics:[{label:'매출액',value:999999},{label:'영업이익',value:456}]}];
  for(const metric of ['revenue','net','ebit']) {
   const rows=comparisonTrend(wrongActual,records,metric,'USD(백만)');
   assert.equal(rows.length,6);assert.equal(rows.filter(r=>r.value!=null).length,4);assert.ok(rows.every(r=>r.estimate!=null));assert.ok(rows.every(r=>r.value!==999999));
   assert.equal(rows.at(-1).value,null);assert.deepEqual(earningsDelta(rows.at(-1).value,rows.at(-1).estimate),{amount:null,percent:null});
   assert.ok(rows.every(r=>r.unit===(id==='novo-nordisk'?'DKK(백만)':'USD(백만)')));
  }
  const operating=comparisonTrend(wrongActual,records,'operating','USD(백만)');assert.equal(operating[0].value,456);assert.equal(operating[0].estimate,null);
 }
 const nike=JSON.parse(readFileSync(new URL('../data/earnings-comparison/stock-nke-fundamentals.json',import.meta.url)));
 assert.equal(nike.rows.find(r=>r.fiscalPeriod==='FY2027 Q1').period,'2026-08');
});
test('KR cache preserves available consensus; an all-announced cache needs no future forecast',()=>{
 for(const code of ['005380','263750','005930','000660']) {
  const cache=JSON.parse(readFileSync(new URL(`../data/earnings-comparison/stock-${code}.json`,import.meta.url)));
  const records=comparisonRecords({rows:[]},cache);
  for(const metric of ['revenue','operating','parentNet']) {
   const rows=comparisonTrend([],records,metric,'억 KRW');assert.ok(rows.some(r=>r.estimate!=null));
   // A refreshed cache can contain only announced quarters. Never invent a future row.
   const label={revenue:'매출액',operating:'영업이익',parentNet:'지배주주 순이익'}[metric];
   for(const row of rows) {
    const source=records.find(r=>r.period===row.period)?.metrics.find(m=>m.label===label);
    assert.ok(source);assert.equal(row.value,source.actual);assert.equal(row.estimate,source.estimate);
   }
  }
 }
});

test('hundred-million formatting preserves currency scale and EPS per-share semantics',async()=>{
 const {earningsAmount,earningsUnit,earningsPercent}=await import('../js/earnings-data.js');
 assert.equal(earningsAmount(1000,'억 KRW'),'1,000억');assert.equal(earningsAmount(148,'억 KRW',true),'+148억');
 assert.equal(earningsAmount(100000,'USD(백만)'),'100,000백만');assert.equal(earningsAmount(-14800,'DKK(백만)',true),'-148억');
 assert.equal(earningsAmount(3.2,'USD / 주'),'3.2');assert.equal(earningsAmount(null,'억 KRW'),'미제공');assert.equal(earningsAmount(0,'억 KRW',true),'0억');
 assert.equal(earningsPercent(12.54),'+12.5%');assert.equal(earningsPercent(-12.54),'-12.5%');assert.equal(earningsPercent(null),'—');assert.equal(earningsUnit('USD(백만)'),'금액: 백만 USD');
});
test('annual data uses annual actual/consensus, never sums an incomplete quarter series',()=>{
 for(const id of ['005380','263750','005930','000660']) {
  const cache=JSON.parse(readFileSync(new URL(`../data/earnings-comparison/stock-${id}-annual.json`,import.meta.url)));
  const rows=comparisonTrend(cache.quarters,comparisonRecords(cache),'revenue',cache.financialUnit);
  assert.ok(rows.every(r=>/^20\d{2}$/.test(r.period)));assert.ok(rows.some(r=>r.value!=null&&r.estimate!=null));
  // A source refresh need not retain an unannounced year; test null handling with a stable fixture below.
  const future={period:'2099',basis:'IFRS 연결',metrics:[{label:'매출액',actual:null,estimate:123,unit:'억 KRW'}]};
  const futureRow=comparisonTrend([], [future], 'revenue', '억 KRW', true).find(r=>r.period==='2099');
  assert.equal(futureRow.value,null);assert.equal(futureRow.estimate,123);
  assert.ok(fourQuarterTrend(cache.quarters,'revenue').at(-1).delta!=null);
 }
 const nike=JSON.parse(readFileSync(new URL('../data/earnings-comparison/stock-nke-fundamentals.json',import.meta.url))).annual;
 const annual=comparisonTrend([],comparisonRecords(nike),'revenue','USD(백만)');
 assert.equal(annual.find(r=>r.period==='2026').value,46398);assert.match(annual[0].fiscalPeriod,/5월 결산/);
 assert.equal(comparisonTrend([],comparisonRecords(nike),'eps')[0].unit,'USD / 주');
});

test('amounts truncate eok toward zero and switch to trillion only at the threshold',async()=>{
 const {earningsAmount}=await import('../js/earnings-data.js');
 for(const [value,expected] of [[100.5,'100억'],[-100.5,'-100억'],[-.9,'0억'],[9999.99,'9,999억'],[10000,'1.00조'],[18900,'1.89조'],[-18900,'-1.89조'],[18956,'1.90조']])assert.equal(earningsAmount(value,'억 KRW'),expected);
 assert.equal(earningsAmount(1890000,'USD(백만)'),'1,890,000백만');assert.equal(earningsAmount(100.5,'USD / 주'),'100.5');assert.equal(earningsAmount(148.9,'억 KRW',true),'+148억');assert.equal(earningsAmount(null,'억 KRW'),'미제공');
});
test('annual axes contain exactly five shared consecutive years and never fabricate missing amounts',async()=>{
 const {fiveYearWindow}=await import('../js/earnings-data.js');
 const rows=[{period:'2025',value:100,estimate:90,unit:'억 KRW'},{period:'2026',value:null,estimate:110,unit:'억 KRW'}];
 const window=fiveYearWindow(rows,['2023','2024','2025','2026'],'억 KRW');
 assert.deepEqual(window.map(r=>r.period),['2022','2023','2024','2025','2026']);assert.equal(window[0].missing,true);assert.equal(window[0].value,null);assert.equal(window[0].estimate,null);assert.equal(window.at(-1).missing,false);
 assert.deepEqual(fiveYearWindow([],[]),[]);
 const q=Array.from({length:7},(_,i)=>({key:String(2019+i),period:String(2019+i),metrics:[{label:'영업이익',value:i+1}]}));
 assert.deepEqual(comparisonTrend(q,[],'operating','억 KRW',true).map(r=>r.value),[3,4,5,6,7]);
 for(const id of ['005380','263750','005930','000660','googl','amzn','nke','novo-nordisk']){
  const cache=JSON.parse(readFileSync(new URL(`../data/earnings-comparison/stock-${id}-annual.json`,import.meta.url)));
  const extra=/^\d/.test(id)?null:JSON.parse(readFileSync(new URL(`../data/earnings-comparison/stock-${id}-fundamentals.json`,import.meta.url))).annual;
  const records=comparisonRecords(cache,null,extra);
  const revenue=comparisonTrend(cache.quarters,records,'revenue',cache.financialUnit,true),operating=comparisonTrend(cache.quarters,records,'operating',cache.financialUnit,true);
  assert.equal(revenue.length,5);assert.deepEqual(revenue.map(r=>r.period),operating.map(r=>r.period));
 }
});

test('USD millions preserve small values, raw currency scale, signed deltas and per-share exclusions',async()=>{
 const {earningsAmount,earningsUnit}=await import('../js/earnings-data.js');
 for(const [value,unit,want] of [[100.5,'USD(백만)','100.5백만'],[.5,'USD(백만)','0.5백만'],[-.009,'USD(백만)','-0.01백만'],[-.001,'USD(백만)','0백만'],[100500000,'USD','100.5백만'],[1.005,'억 USD','100.5백만'],[1,'조 USD','1,000,000백만']])assert.equal(earningsAmount(value,unit),want);
 assert.equal(earningsAmount(1.234,'USD(백만)',true),'+1.23백만');assert.equal(earningsAmount(-1.234,'USD(백만)',true),'-1.23백만');
 assert.equal(earningsAmount(null,'USD(백만)'),'미제공');assert.equal(earningsAmount(.5,'USD / 주'),'0.5');assert.equal(earningsUnit('USD / 주'),'USD / 주');
 assert.equal(earningsAmount(100.5,'억 KRW'),'100억');assert.equal(earningsAmount(1890000,'DKK(백만)'),'1.89조');
 assert.equal(earningsDelta(100.5,100).percent,.5);
});

test('OTLY TradingView pairs render quarterly and five annual years without mixing Naver basis',()=>{
 const source=JSON.parse(fixture('otly-comparison.json'));
 const records=comparisonRecords(null,null,source);
 const revenue=comparisonTrend([],records,'revenue','USD(백만)');
 assert.equal(revenue.length,6);assert.ok(revenue.every(r=>r.estimate!=null));
 assert.equal(revenue.find(r=>r.period==='2026-09').value,243.054);
 const eps=comparisonTrend([],records,'eps','USD(백만)');assert.ok(eps.every(r=>/ADS/.test(r.unit)));
 const annual=comparisonTrend([],comparisonRecords(null,null,source.annual),'revenue','USD(백만)',true);
 assert.equal(annual.length,5);assert.ok(annual.every(r=>r.estimate!=null));
 assert.ok(comparisonTrend([],records,'operating').every(r=>r.estimate==null));
});
