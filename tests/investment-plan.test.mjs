import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlan,seoulDate,isDue,filterPlans,validDate} from '../js/investment-plan-model.js';
const base={title:'금리 상승',category:'macro',kind:'fact',impact:-2,importance:4};
test('six signed levels only; default entire portfolio; fact and forecast explicit',()=>{
 for(const impact of [-3,-2,-1,1,2,3])assert.equal(normalizePlan({...base,impact}).impact,impact);
 for(const impact of [0,'',4,-4,NaN])assert.throws(()=>normalizePlan({...base,impact}));
 assert.throws(()=>normalizePlan({...base,kind:''}));assert.equal(normalizePlan(base).scope,'all');
 assert.equal(normalizePlan({...base,kind:'forecast'}).kind,'forecast');
});
test('scoped targets required, global target cleared; whitespace blocked',()=>{
 assert.throws(()=>normalizePlan({...base,scope:'industry',target:' '}));
 assert.equal(normalizePlan({...base,scope:'industry',target:' 반도체 '}).target,'반도체');
 assert.equal(normalizePlan({...base,target:'old'}).target,'');
 assert.throws(()=>normalizePlan({...base,title:'  '}));
});
test('personal cash optional, zero differs from missing; switching category clears fields',()=>{
 assert.equal(normalizePlan({...base,category:'personal'}).cash_amount,null);
 assert.equal(normalizePlan({...base,category:'personal',cash_amount:'0',liquidity:'room'}).cash_amount,0);
 assert.throws(()=>normalizePlan({...base,category:'personal',cash_amount:'oops'}));
 assert.throws(()=>normalizePlan({...base,category:'personal',cash_amount:-1}));
 const plain=normalizePlan({...base,cash_amount:500,cash_date:'2027-03-01',liquidity:'tight'});
 assert.equal(plain.cash_amount,null);assert.equal(plain.cash_date,null);assert.equal(plain.liquidity,'unsure');
});
test('expiry starts Korean midnight, not next day; resolved items never due',()=>{
 assert.equal(seoulDate(new Date('2026-10-22T14:59:59Z')),'2026-10-22');
 assert.equal(seoulDate(new Date('2026-10-22T15:00:00Z')),'2026-10-23');
 assert.equal(isDue({state:'active',expires_on:'2026-10-23'},'2026-10-23'),true);
 assert.equal(isDue({state:'resolved',expires_on:'2026-10-22'},'2026-10-23'),false);
 assert.equal(isDue({state:'active',expires_on:null},'2026-10-23'),false);
});
test('dates validated; expiration is optional and past dates permitted for review',()=>{
 assert.equal(validDate('2027-02-29'),false);assert.equal(validDate('2028-02-29'),true);
 assert.throws(()=>normalizePlan({...base,expires_on:'2026-13-01'}));
 assert.equal(normalizePlan({...base,expires_on:'2020-01-01'}).expires_on,'2020-01-01');
 assert.equal(normalizePlan(base).expires_on,null);
});
test('target filtering includes global context; due first, then importance; resolved isolated',()=>{
 const a={...normalizePlan(base),id:'global',created_at:'2026-01-01'};
 const b={...a,id:'semi',scope:'industry',target:'반도체',importance:1,expires_on:'2026-10-23'};
 const c={...a,id:'crypto',scope:'asset_class',target:'크립토'};
 const d={...a,id:'done',state:'resolved'};
 assert.deepEqual(filterPlans([a,b,c,d],{target:'반도체'},'2026-10-23').map(x=>x.id),['semi','global']);
 assert.deepEqual(filterPlans([a,b,c,d],{state:'due'},'2026-10-23').map(x=>x.id),['semi']);
 assert.deepEqual(filterPlans([a,b,c,d],{state:'resolved'},'2026-10-23').map(x=>x.id),['done']);
});
