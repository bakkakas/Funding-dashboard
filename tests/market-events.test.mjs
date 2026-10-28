import test from 'node:test';
import assert from 'node:assert/strict';
import {koreaDate,upcomingEvents,eventLabel,nextKoreanMidnight} from '../js/market-events.js';
const item=(date,id=date)=>({id,series:id,name:'미국 CPI',date,status:'confirmed'});
test('D-30 inclusive, D-31 hidden, event day retained, D+1 removed in Korea',()=>{
 const now=new Date('2026-10-28T09:00:00Z');
 const result=upcomingEvents([item('2026-11-28'),item('2026-11-27'),item('2026-10-28'),item('2026-10-27')],now);
 assert.deepEqual(result.map(e=>e.daysLeft),[0,30]);assert.equal(eventLabel(result[1]),'D-30 미국 CPI(11월27일)');
 assert.equal(upcomingEvents([item('2026-10-28')],new Date('2026-10-28T14:59:59Z')).length,1);
 assert.equal(upcomingEvents([item('2026-10-28')],new Date('2026-10-28T15:00:00Z')).length,0);
});
test('month, year, leap day and midnight use calendar days not local machine timezone',()=>{
 assert.equal(koreaDate(new Date('2026-12-31T15:00:00Z')),'2027-01-01');
 assert.equal(upcomingEvents([item('2028-02-29')],new Date('2028-02-28T03:00:00Z'))[0].daysLeft,1);
 assert.equal(new Date(nextKoreanMidnight(new Date('2026-10-28T09:00:00Z'))).toISOString(),'2026-10-28T15:00:00.000Z');
});
test('invalid dates rejected and same event not duplicated, same day different events retained',()=>{
 assert.deepEqual(upcomingEvents([item('2027-02-29'),item('bad'),item('2026-13-01')]),[]);
 const a=item('2026-10-29','cpi');const b={...a,id:'cpi-second-source'};
 assert.equal(upcomingEvents([a,b,item('2026-10-29','ecb')],new Date('2026-10-28T00:00:00Z')).length,2);
 assert.match(eventLabel({...a,daysLeft:1,status:'estimated'}),/예정/);
});
