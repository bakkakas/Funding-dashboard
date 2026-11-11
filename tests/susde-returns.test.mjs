import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {annualizedRate,rollingAnnualized,returnWindow,validateSusdeReturns} from '../js/susde-returns.js';
const rows=Array.from({length:366},(_,i)=>({date:new Date(Date.UTC(2025,10,10+i)).toISOString().slice(0,10),timestamp:new Date(Date.UTC(2025,10,10+i,23)).toISOString(),rate:1.2*(1+i*.0001)}));
const snapshot=()=>({schemaVersion:1,asset:'sUSDe',unit:'USDe per sUSDe',fetchedAt:'2026-11-11T01:00:00Z',through:'2026-11-10',rows:structuredClone(rows)});
const now=Date.UTC(2026,10,11,3);
test('holding return uses rate ratio, not APY or absolute rate gain; exact N-day endpoints',()=>{
 const w=returnWindow(rows,365);assert.equal(w.rows.length,366);assert.equal(w.days,365);assert.ok(Math.abs(w.value-3.65)<1e-10);assert.equal(w.rows[0].average,0);
 const m=returnWindow(rows,30);assert.equal(m.rows.length,31);assert.ok(Math.abs(m.value-(1.0365/1.0335-1)*100)<1e-10);
});
test('missing endpoints unavailable, internal gaps retained, custom date exact and selection resets baseline',()=>{
 assert.equal(returnWindow(rows.slice(1),365),null);assert.equal(returnWindow(rows,0,'2027-01-01'),null);assert.equal(returnWindow(rows,0,rows.at(-1).date),null);
 const g=returnWindow(rows.filter((_,i)=>i!==5),365);assert.equal(g.rows.length,365);assert.equal(g.value,returnWindow(rows,365).value);
 assert.equal(returnWindow(rows,365,rows[100].date).days,265);assert.equal(returnWindow([],30),null);
});
test('flat and negative historical changes are not coerced into positive rewards',()=>{
 const r=rows.slice(0,3).map(r=>({...r,rate:1.2}));assert.equal(returnWindow(r).value,0);r[2].rate=1.1;assert.ok(returnWindow(r).value<0);
});
test('rate validation rejects bad units, zero, duplicate, future/current-day and inconsistent timestamps',()=>{
 validateSusdeReturns(snapshot(),now);
 for(const mutate of [d=>d.unit='USD',d=>d.rows[0].rate=0,d=>d.rows[0].rate=null,d=>d.rows[0].rate=Infinity,d=>d.rows[0].date='2025-02-30',d=>d.rows[1].date=d.rows[0].date,d=>d.rows[0].timestamp='invalid',d=>d.rows[0].timestamp=d.rows[1].timestamp,d=>d.through='2026-11-11',d=>d.fetchedAt='2027-01-01',d=>d.rows.at(-1).date='2026-11-11']){const d=snapshot();mutate(d);assert.throws(()=>validateSusdeReturns(d,now));}
});
test('official snapshot 1-year return reconciles to source endpoints and is not headline APY',()=>{
 const d=validateSusdeReturns(JSON.parse(fs.readFileSync(new URL('../data/susde-returns.json',import.meta.url),'utf8')));
 const w=returnWindow(d.rows,365);assert.ok(w);assert.equal(w.value,(w.end.rate/w.start.rate-1)*100);assert.equal(w.days,365);
});

test('annualization compounds the measured period instead of multiplying by 12 or averaging APYs',()=>{
 assert.ok(Math.abs(annualizedRate(1,1.01,30)-(Math.pow(1.01,365/30)-1)*100)<1e-10);
 assert.ok(Math.abs(annualizedRate(1,1.05,365)-5)<1e-10);
 assert.equal(annualizedRate(1,1,30),0);assert.ok(annualizedRate(1,.99,30)<0);
 for(const args of [[1,1,0],[0,1,30],[1,null,30],[1,Infinity,30]])assert.equal(annualizedRate(...args),null);
});
test('rolling 30D APY uses history before clipping and does not rebase to chart start',()=>{
 const growth=rows.map((r,i)=>({...r,rate:1.2*Math.pow(1.05,i/365)}));
 const all=rollingAnnualized(growth);
 assert.equal(all[29].average,null);
 for(const r of all.slice(30))assert.ok(Math.abs(r.average-5)<1e-9);
 const selected=all.filter(r=>r.date>=growth[200].date);assert.ok(Math.abs(selected[0].average-5)<1e-9);
 assert.ok(Math.abs(returnWindow(growth,90).apy-5)<1e-9);
});
test('missing rolling endpoint is unavailable while interior gaps do not change the endpoint ratio',()=>{
 const incomplete=rows.filter((_,i)=>i!==100),rolled=rollingAnnualized(incomplete);
 assert.equal(rolled.find(r=>r.date===rows[130].date).average,null);
 assert.equal(rolled.find(r=>r.date===rows[110].date).average,rollingAnnualized(rows)[110].average);
});
