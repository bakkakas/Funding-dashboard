import test from 'node:test';
import assert from 'node:assert/strict';
import {movingSpend} from '../js/hype-overview.js';
import {summarizeHypePeriods} from '../js/hype-buybacks.js';
import {normalizeUsdeDetails} from '../js/usde-details.js';
test('moving spend requires full calendar windows, rejects missing/partial USD',()=>{
 const rows=Array.from({length:31},(_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),usd:i+1,partial:false}));
 assert.equal(movingSpend(rows,7)[5],null);assert.equal(movingSpend(rows,7)[6],4);assert.equal(movingSpend(rows,30)[29],15.5);
 rows[4].usd=null;assert.equal(movingSpend(rows,7)[6],null);assert.equal(movingSpend(rows,7)[12],10);
 rows[30].partial=true;assert.equal(movingSpend(rows,30)[30],null);
 assert.equal(movingSpend(rows.filter((_,i)=>i!==25),7).at(-2),null);
});
test('unknown USD does not become a misleading weighted average',()=>{
 const [row]=summarizeHypePeriods([{date:'2026-01-01',hype:10,usd:100,partial:false},{date:'2026-01-02',hype:20,usd:null,partial:false}],'month');
 assert.equal(row.usd,100);assert.equal(row.hype,30);assert.equal(row.average,null);assert.equal(row.missingUsd,true);
});
test('USDe quote separates price, market cap, supply, volume and optional missing metrics',()=>{
 const now=Date.now(),r={id:'ethena-usde',last_updated:new Date(now).toISOString(),market_data:{market_cap:{usd:500},current_price:{usd:.999},circulating_supply:501,total_volume:{usd:20},price_change_percentage_24h:-.1}};
 const o=normalizeUsdeDetails(r,now);assert.equal(o.cap,500);assert.equal(o.supply,501);assert.equal(o.volume,20);assert.equal(o.high,null);assert.ok(Math.abs(o.pegDeviation+.1)<1e-8);
 assert.throws(()=>normalizeUsdeDetails({...r,last_updated:'2020-01-01'},now));
});
