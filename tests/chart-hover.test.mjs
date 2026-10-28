import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestPoint, dateTickRows } from '../js/chart-hover.js';
import { UsdeMarketCapPanel, DAY } from '../js/usde-market-cap.js';

test('nearest time follows x only, clamps endpoints and keeps missing periods selectable', () => {
  const points = [{x:80,text:'actual'}, {x:250,text:'missing'}, {x:780,text:'forecast'}];
  assert.equal(nearestPoint(points, -100), points[0]);
  assert.equal(nearestPoint(points, 400), points[1]);
  assert.equal(nearestPoint(points, 2000), points[2]);
  assert.equal(nearestPoint([], 0), null);
});
test('date ticks include endpoints and intermediate actual observations without duplication', () => {
  for (const size of [0,1,2,8,31,366,1000]) {
    const rows=Array.from({length:size},(_,time)=>({time})),ticks=dateTickRows(rows);
    assert.equal(ticks.length,Math.min(5,size));
    assert.equal(new Set(ticks).size,ticks.length);
    if(size) {assert.equal(ticks[0],rows[0]);assert.equal(ticks.at(-1),rows.at(-1));}
  }
});
test('USDe seven-day chart uses real observations and exact USD hover values', () => {
  const panel=Object.create(UsdeMarketCapPanel.prototype);
  panel.history=Array.from({length:40},(_,i)=>({time:Date.UTC(2026,9,1)+i*DAY,cap:1000000+i}));
  panel.range=7;
  const svg=panel.chart({chart:'USDe',title:'시가총액'},t=>new Date(t).toISOString().slice(0,10),v=>`$${v}`);
  assert.equal(panel.hoverPoints.length,8); // seven elapsed days plus the baseline
  assert.equal((svg.match(/data-date-tick/g)||[]).length,5);
  assert.match(panel.hoverPoints.at(-1).text,/시가총액: \$1000039/);
  panel.history=[]; panel.chart({},String,String);
  assert.deepEqual(panel.hoverPoints,[]);
});
