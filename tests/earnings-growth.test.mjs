import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actualComparisons,comparisonTrend,earningsPeriodLabel} from '../js/earnings-data.js';
const row=(period,value,extra={})=>({period,value,unit:'USD (백만)',basis:'same',source:'same',...extra});
test('QoQ and YoY use exact comparable periods and negative denominators use absolute values',()=>{
 const result=actualComparisons([row('2025-09',-100),row('2026-06',-80),row('2026-09',-60)]).at(-1);
 assert.deepEqual(result.qoq,{amount:20,percent:25});assert.deepEqual(result.yoy,{amount:40,percent:40});
});
test('missing periods, basis/currency/source mismatch, forecast and zero baseline are not invented',()=>{
 for(const prior of [row('2026-03',10),row('2026-06',10,{basis:'other'}),row('2026-06',10,{unit:'KRW'}),row('2026-06',10,{source:'other'})])assert.equal(actualComparisons([prior,row('2026-09',20)]).at(-1).qoq.amount,null);
 assert.deepEqual(actualComparisons([row('2026-06',0),row('2026-09',20)]).at(-1).qoq,{amount:20,percent:null});
 assert.equal(actualComparisons([row('2026-06',10),row('2026-09',null)]).at(-1).qoq.amount,null);
});
test('growth uses history outside the four visible quarters and annual has only YoY',()=>{
 const rows=['2025-03','2025-06','2025-09','2025-12','2026-03'].map((period,i)=>({period,basis:'same',directComparison:true,metrics:[{label:'매출액',actual:100+i*10,estimate:100,unit:'USD (백만)'}]}));
 const chart=comparisonTrend([],rows,'revenue','USD (백만)');assert.equal(chart.length,4);assert.deepEqual(chart.at(-1).yoy,{amount:40,percent:40});
 const annual=actualComparisons([row('2025',100),row('2026',120)],true).at(-1);assert.equal(annual.qoq.amount,null);assert.equal(annual.yoy.percent,20);
});
test('quarter labels respect explicit fiscal periods and Nike May fiscal year end',()=>{
 assert.equal(earningsPeriodLabel(row('2026-09',1)),'26.3Q');
 assert.equal(earningsPeriodLabel(row('2026-08',1),false,5),'27.1Q');
 assert.equal(earningsPeriodLabel(row('2026-02',1),false,5),'26.3Q');
 assert.equal(earningsPeriodLabel(row('2026-09',1,{fiscalPeriod:'2027-Q1'})),'27.1Q');
});
