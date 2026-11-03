import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { annualizedBuybackYield, validateHypeBuybacks } from '../js/hype-buybacks.js';

const data=validateHypeBuybacks(JSON.parse(readFileSync(new URL('../data/hype-buybacks.json',import.meta.url))));

test('HYPE buyback snapshot exposes official cumulative and recent burn metrics',()=>{
  assert.ok(data.burnedHype>47_000_000);
  assert.ok(data.cumulativeSpendUsd>1_000_000_000);
  assert.ok(data.averageBuyPriceUsd>0);
  assert.ok(data.burnedMaxSupplyPct>4);
  assert.ok(data.recent['1d'].hype>0);
  assert.ok(data.recent['30d'].usd>=data.recent['7d'].usd);
  assert.ok(data.dailyActivity.length>=7);
});

test('annualized HYPE buyback yield uses the live market cap denominator',()=>{
  assert.equal(annualizedBuybackYield(30_000_000,3_650_000_000),10);
  assert.equal(annualizedBuybackYield(30_000_000,0),null);
  assert.equal(annualizedBuybackYield(null,3_650_000_000),null);
});

import { selectHypeDays, summarizeHypePeriods } from '../js/hype-buybacks.js';
test('period windows include the current UTC day and do not fabricate missing days',()=>{
  const rows=['2025-11-02','2025-11-03','2026-08-05','2026-10-04','2026-11-02','2026-11-03'].map(date=>({date,usd:10,hype:2,partial:false}));
  assert.deepEqual(selectHypeDays(rows,30,'2026-11-02T03:00:00Z').map(r=>r.date),['2026-10-04','2026-11-02']);
  assert.equal(selectHypeDays(rows,90,'2026-11-02T03:00:00Z').length,3);
  assert.equal(selectHypeDays(rows,365,'2026-11-02T03:00:00Z')[0].date,'2025-11-03');
  assert.equal(selectHypeDays(rows,null,'2026-11-02T03:00:00Z').length,5);
});
test('weekly and monthly totals use volume-weighted price and UTC Monday boundaries',()=>{
  const rows=[{date:'2026-10-31',usd:100,hype:1,partial:false},{date:'2026-11-01',usd:900,hype:3,partial:false},{date:'2026-11-02',usd:0,hype:0,partial:true}];
  const week=summarizeHypePeriods(rows,'week');
  assert.equal(week[0].key,'2026-11-02');assert.equal(week[0].average,null);
  assert.equal(week[1].key,'2026-10-26');assert.equal(week[1].usd,1000);assert.equal(week[1].hype,4);assert.equal(week[1].average,250);assert.equal(week[1].partial,true);
  const months=summarizeHypePeriods(rows,'month');assert.equal(months[0].average,300);assert.equal(months[1].average,100);
  for(const unit of ['week','month'])assert.equal(summarizeHypePeriods(rows,unit).reduce((sum,r)=>sum+r.usd,0),1000);
});
test('complete leap month and cross-year week are not marked partial',()=>{
  const rows=Array.from({length:29},(_,i)=>({date:`2024-02-${String(i+1).padStart(2,'0')}`,usd:10,hype:1,partial:false}));
  assert.equal(summarizeHypePeriods(rows,'month')[0].partial,false);
  assert.equal(summarizeHypePeriods([{...rows[0],date:'2027-01-01'}],'week')[0].key,'2026-12-28');
});

test('daily bars keep one day per bucket and all grouping units preserve totals',()=>{
 const rows=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2026,9,25+i)).toISOString().slice(0,10),usd:i+1,hype:2,partial:false}));
 const daily=summarizeHypePeriods(rows,'day');assert.equal(daily.length,40);assert.equal(daily[0].days,1);assert.equal(daily[0].partial,false);
 for(const unit of ['day','week','month']){
  const buckets=summarizeHypePeriods(rows,unit);
  assert.equal(buckets.reduce((s,r)=>s+r.usd,0),820);assert.equal(buckets.reduce((s,r)=>s+r.hype,0),80);
 }
 const partial=summarizeHypePeriods(rows.slice(0,1),'week')[0];assert.equal(partial.partial,true);assert.equal(partial.usd,1);
});
