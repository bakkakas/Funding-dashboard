import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {comparisonRecords,comparisonTrend,earningsDelta,earningsPercent} from '../js/earnings-data.js';
const load=(code,suffix='')=>JSON.parse(fs.readFileSync(new URL(`../data/earnings-comparison/stock-${code}${suffix}.json`,import.meta.url)));
const expected={
 '005930':[[1952532,2025725,'+13.9%','+126.9%','-3.6%'],[1074405,1079059,'+20.1%','+783.1%','-0.4%'],[752081,891483,'+5%','+515.2%','-15.6%']],
 '000660':[[1046155,973416,'+31.9%','+327.9%','+7.5%'],[833338,762713,'+37.6%','+632.1%','+9.3%'],[395344,607278,'-57.9%','+213.8%','-34.9%']],
};
for(const code of Object.keys(expected))test(`${code} reported 2026Q3 values and exact QoQ/YoY/consensus percentages`,()=>{
 const supplement=load(code,'-fundamentals'),records=comparisonRecords(null,load(code),supplement);
 assert.equal(supplement.rows.length,5);
 assert.equal(records.find(r=>r.period==='2026-09'&&r.metrics.some(m=>m.label==='매출액')).metrics.find(m=>m.label==='매출액').actual,expected[code][0][0]);
 assert.equal(records.filter(r=>r.period==='2026-09'&&r.metrics.some(m=>m.label==='매출액')).length,1);
 for(const [i,metric] of ['revenue','operating','net'].entries()){
  const r=comparisonTrend([],records,metric,'억 KRW').find(r=>r.period==='2026-09');
  assert.deepEqual([r.value,r.estimate,earningsPercent(r.qoq.percent),earningsPercent(r.yoy.percent),earningsPercent(earningsDelta(r.value,r.estimate).percent)],expected[code][i]);
  assert.equal(r.preliminary,true);assert.equal(r.actualSource,'사용자 제공 공시 요약');
 }
});
test('prior forecasts and live future forecasts survive while current supplied estimate wins',()=>{
 const supplement=load('005930','-fundamentals'),cache=load('005930');
 const live={source:'Live',asOf:'2026-10-30',rows:[{period:'2026-12',basis:'IFRS 연결 · 최초 발표치(잠정 포함)',metrics:[{label:'매출액',unit:'억 KRW',estimate:3000000,actual:null}]},{period:'2026-09',basis:'IFRS 연결',metrics:[{label:'매출액',unit:'억 KRW',estimate:1,actual:1}]}]};
 const records=comparisonRecords(live,cache,supplement),rows=comparisonTrend([],records,'revenue','억 KRW');
 assert.equal(rows.find(r=>r.period==='2026-06').estimate,1743470.5);
 assert.equal(rows.find(r=>r.period==='2026-09').estimate,2025725);
 assert.equal(rows.find(r=>r.period==='2026-12').estimate,3000000);
 const previous=rows.find(r=>r.period==='2026-06');assert.equal(previous.estimateSource,'WiseReport · FnGuide');assert.equal(previous.estimateAsOf,cache.asOf);
});
test('total net income is never filled from parent-shareholder net income and annual data unchanged',()=>{
 const supplement=load('000660','-fundamentals'),cache=load('000660'),records=comparisonRecords(null,cache,supplement);
 assert.equal(comparisonTrend([],records,'net','억 KRW').find(r=>r.period==='2026-06').estimate,null);
 assert.equal(records.filter(r=>r.directComparison).some(r=>r.metrics.some(m=>m.label==='지배주주 순이익')),false);
 const annual=load('000660','-annual');assert.deepEqual(comparisonRecords(annual,null,supplement.annual),comparisonRecords(annual));
});
