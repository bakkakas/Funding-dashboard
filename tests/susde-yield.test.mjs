import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY,movingYield,selectYieldRows,validateSusdeYield,yieldStatus,yieldPath} from '../js/susde-yield.js';
const now = Date.UTC(2026,10,9);
const rows = Array.from({length:40},(_,i)=>({date:new Date(now-(39-i)*DAY).toISOString().slice(0,10),apy:i===39?8:1}));
const snapshot = () => ({schemaVersion:1,asset:'sUSDe',seriesName:'sUSDe Yield',fetchedAt:new Date(now).toISOString(),through:'2026-11-09',current:Object.fromEntries(['apy','avg30d','avg90d'].map(k=>[k,{date:'2026-11-09',value:2}])),rows:structuredClone(rows)});

test('headline reconciles to 7D mean, never latest daily or indicative yield',()=>{
  const d=validateSusdeYield(snapshot(),now);
  assert.equal(d.rows.at(-1).apy,8);assert.equal(d.current.apy.value,2);
  const wrong=snapshot();wrong.seriesName='Indicative sUSDe APY';assert.throws(()=>validateSusdeYield(wrong,now));
  wrong.seriesName='sUSDe Yield';wrong.current.apy.value=8;assert.throws(()=>validateSusdeYield(wrong,now));
});
test('calendar means preserve negative and zero observations without compounding APY again',()=>{
  const r=rows.slice(-7).map((r,i)=>({...r,apy:i===0?-6:1}));
  assert.equal(movingYield(r).at(-1).average,0);
  assert.equal(movingYield(r)[5].average,null);
});
test('a missing day breaks the whole window, and charts break rather than bridge gaps',()=>{
  const r=rows.filter((_,i)=>i!==35),m=movingYield(r);
  assert.equal(m.at(-1).average,null);
  assert.equal((yieldPath([{date:'2026-11-01',average:1},{date:'2026-11-03',average:2}],()=>1,v=>v).match(/M/g)||[]).length,2);
  assert.equal((yieldPath([{date:'2026-11-01',average:1},{date:'2026-11-02',average:null},{date:'2026-11-03',average:2}],()=>1,v=>v).match(/M/g)||[]).length,2);
});
test('range uses exact inclusive calendar days; averages computed before clipping',()=>{
  const selected=selectYieldRows(movingYield(rows),7);
  assert.equal(selected.length,7);assert.equal(selected[0].average,1);
  assert.equal(selectYieldRows(rows,0).length,40);
});
test('source age and collection age have independent clocks and weekly publication tolerance',()=>{
  const d=snapshot();d.current.apy.date='2026-11-04';
  assert.deepEqual(yieldStatus(d,now),{sourceStale:false,collectionStale:false});
  assert.equal(yieldStatus(d,now+3*DAY).collectionStale,true);
  d.fetchedAt=new Date(now+6*DAY).toISOString();assert.equal(yieldStatus(d,now+6*DAY).sourceStale,true);
});
test('malformed/future/duplicate/nonfinite values are rejected instead of zero-filled',()=>{
  for(const mutate of [d=>d.rows[0].apy=null,d=>d.rows[0].apy=NaN,d=>d.rows[0].date='2026-02-30',d=>d.rows[1].date=d.rows[0].date,d=>d.current.avg30d.value=null,d=>d.through='2026-11-10',d=>d.fetchedAt='2026-11-10T00:00:00Z']){
    const d=snapshot();mutate(d);assert.throws(()=>validateSusdeYield(d,now));
  }
});
