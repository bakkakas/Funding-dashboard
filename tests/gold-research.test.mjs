import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateGold,goldWindow,performance} from '../js/gold-research-data.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/gold-research.json',import.meta.url)));
test('gold snapshot is valid and real-yield selection limits common history without filling prior years',()=>{
 validateGold(data);const all=goldWindow(data),real=goldWindow(data,{rate:'DFII10'});
 assert.equal(all.start,'1971-02');assert.equal(real.start,'2003-01');assert.equal(all.rows.gold.indexed[0],100);
 assert.equal(all.rows.sp500.indexed[0],100);assert.ok(all.months.length>600);
});
test('hidden comparisons leave the gold window independent and absent from table/chart',()=>{
 const w=goldWindow(data,{visible:{rate:false,sp500:false,NASDAQCOM:false}});
 assert.equal(w.start,'1960-01');assert.deepEqual(w.keys,['gold']);assert.equal(w.end,data.series.gold.values.at(-1)[0]);
});
test('month gaps remain null and rates may be negative or zero without becoming missing',()=>{
 const small={series:{gold:{values:[['2020-01',100],['2020-03',80],['2020-04',120]]},DFII10:{values:[['2020-01',0],['2020-02',-1],['2020-03',-2],['2020-04',1]]}}};
 const w=goldWindow(small,{rate:'DFII10',visible:{rate:true,sp500:false,NASDAQCOM:false}});
 assert.deepEqual(w.rows.gold.raw,[100,null,80,120]);assert.deepEqual(w.rows.DFII10.raw,[0,-1,-2,1]);assert.equal(w.rows.DFII10.rateChange,1);
 assert.ok(Math.abs(w.rows.gold.mdd+20)<1e-10);
});
test('custom ranges, short windows and invalid ranges do not fabricate results',()=>{
 assert.equal(goldWindow(data,{period:'custom',from:'2020-01',to:'2019-01'}).months.length,0);
 assert.equal(goldWindow(data,{period:'custom',from:'2020-01',to:'2020-01'}).months.length,0);
 assert.equal(goldWindow(data,{period:'1'}).months.length,13);
 assert.deepEqual(performance([null,10]),{change:null,mdd:null});
 assert.ok(Math.abs(performance([100,200,100,150]).mdd+50)<1e-10);
 assert.equal(performance([100,200,100,150]).change,50);
});
test('corrupt zero gold prices and duplicate dates fail validation',()=>{
 const bad=structuredClone(data);bad.series.gold.values[0][1]=0;assert.throws(()=>validateGold(bad));
 const duplicate=structuredClone(data);duplicate.series.gold.values[1][0]=duplicate.series.gold.values[0][0];assert.throws(()=>validateGold(duplicate));
});

test('correlation uses paired consecutive returns and rate differences',async()=>{
 const {goldCorrelations}=await import('../js/gold-research-data.js');
 const w={keys:['gold','sp500','DGS10'],rows:{gold:{raw:[100,110,99,118.8]},sp500:{raw:[200,220,198,237.6]},DGS10:{raw:[1,1.1,1,1.2]}}};
 const c=goldCorrelations(w);
 assert.ok(Math.abs(c.sp500.value-1)<1e-10);assert.ok(Math.abs(c.DGS10.value-1)<1e-10);assert.equal(c.sp500.n,3);
 w.rows.sp500.raw[1]=null;assert.equal(goldCorrelations(w).sp500.n,1);assert.equal(goldCorrelations(w).sp500.value,null);
 w.rows.sp500.raw=[1,1,1,1];assert.equal(goldCorrelations(w).sp500.value,null);
});

test('correlation strength uses absolute unrounded values and explicit directions',async()=>{
 const {correlationMeaning:m}=await import('../js/gold-research-data.js');
 assert.equal(m(0.8),'강한 같은 방향 관계');assert.equal(m(-0.8),'강한 반대 방향 관계');
 assert.equal(m(0),'매우 약한 선형 관계');assert.equal(m(0.1999),'매우 약한 선형 관계');
 assert.equal(m(-0.2),'약한 반대 방향 관계');assert.equal(m(0.4),'보통 수준의 같은 방향 관계');
 assert.equal(m(-0.6999),'보통 수준의 반대 방향 관계');assert.equal(m(-0.7),'강한 반대 방향 관계');
 assert.equal(m(null),'계산 불가');
});

test('Fed target and Treasury coexist on raw percentage scale with separate pp correlations',async()=>{
 const {goldCorrelations}=await import('../js/gold-research-data.js');
 const w=goldWindow(data,{visible:{fed:true,rate:true,sp500:true,NASDAQCOM:true}});
 assert.equal(w.start,'1982-10');assert.equal(w.keys.length,5);
 assert.equal(w.rows.FEDTARGET.indexed,null);assert.equal(w.rows.DGS10.indexed,null);
 assert.equal(w.rows.FEDTARGET.mdd,null);
 const correlations=goldCorrelations(w);assert.equal(Object.keys(correlations).length,4);assert.ok(Number.isFinite(correlations.FEDTARGET.value));
 const small={keys:['gold','DGS10','FEDTARGET'],rows:{gold:{raw:[100,110,99,118.8]},DGS10:{raw:[1,1.1,1,1.2]},FEDTARGET:{raw:[0,0.1,0,0.2]}}};
 assert.ok(Math.abs(goldCorrelations(small).FEDTARGET.value-1)<1e-10);
 const bad=structuredClone(data);bad.series.FEDTARGET.latestRange.lower=999;assert.throws(()=>validateGold(bad));
});
