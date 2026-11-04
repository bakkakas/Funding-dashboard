import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUniBurns,selectUniDays,summarizeUni,uniWindow,uniAnnualized,groupUniDays,uniMovingAverage} from '../js/uni-burns.js';
const data=JSON.parse(readFileSync(new URL('../data/uni-burns.json',import.meta.url)));
const rows=Array.from({length:31},(_,i)=>({date:new Date(Date.UTC(2026,9,i+1)).toISOString().slice(0,10),uni:10,price:2,usdValue:20,partial:false}));
test('UNI daily source excludes treasury and does not add mainnet settlements',()=>{
 validateUniBurns(data);const sum=summarizeUni(data.rows);
 assert.ok(Math.abs(sum.uni-data.chains.reduce((n,c)=>n+c.uni,0))<.01);
 assert.ok(sum.uni<data.mainnet.documentedTreasuryUni);
 assert.throws(()=>validateUniBurns({...data,rows:[data.rows[0],data.rows[0]]}));
 const bad=structuredClone(data);bad.rows[0].usdValue+=1;assert.throws(()=>validateUniBurns(bad));
});
test('30-day valuation annualization is not total treasury burn annualization',()=>{
 const window=uniWindow(rows,30,'2026-10-31');assert.equal(window.uni,300);assert.equal(window.usdValue,600);
 assert.equal(uniAnnualized(window.usdValue,73000),10);
 for(const cap of [null,0,undefined,NaN])assert.equal(uniAnnualized(600,cap),null);
 assert.equal(uniAnnualized(null,73000),null);
});
test('missing history and partial days cannot produce complete moving averages',()=>{
 const missing=rows.filter(r=>r.date!=='2026-10-25');assert.equal(uniWindow(missing,7,'2026-10-31').usdValue,null);
 const gap=structuredClone(rows);gap[25].usdValue=null;assert.equal(uniMovingAverage(gap,7).at(-1),null);
 const partial=structuredClone(rows);partial.at(-1).partial=true;assert.equal(uniWindow(partial,30,'2026-10-31').usdValue,null);
 assert.equal(uniMovingAverage(rows,7)[5],null);assert.equal(uniMovingAverage(rows,7)[6],20);
});
test('UTC week/month grouping conserves recorded value and marks range boundaries',()=>{
 const month=groupUniDays(rows,'month');assert.equal(month.length,1);assert.equal(month[0].uni,310);assert.equal(month[0].partial,false);
 const weeks=groupUniDays(rows,'week');assert.equal(weeks[0].date,'2026-09-28');assert.equal(weeks[0].partial,true);assert.equal(weeks[1].partial,false);
 for(const days of [30,90,365,null])for(const unit of ['day','week','month']){const selected=selectUniDays(rows,days,'2026-10-31');assert.equal(groupUniDays(selected,unit).reduce((n,r)=>n+r.uni,0),selected.length*10);}
 const absent=structuredClone(rows);absent[0].uni=null;absent[0].usdValue=null;assert.equal(groupUniDays(absent,'month')[0].uni,null);
});
