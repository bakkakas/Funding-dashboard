import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlan,seoulDate,isDue,filterPlans,validDate,impactScore,planScores,overallScore} from '../js/investment-plan-model.js';
const base={title:'금리 상승',category:'macro',kind:'fact',impact:-2};
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
test('target filtering includes global context; due first, then newest; resolved isolated',()=>{
 const a={...normalizePlan(base),id:'global',created_at:'2026-01-01'};
 const b={...a,id:'semi',scope:'industry',target:'반도체',importance:1,expires_on:'2026-10-23'};
 const c={...a,id:'crypto',scope:'asset_class',target:'크립토'};
 const d={...a,id:'done',state:'resolved'};
 assert.deepEqual(filterPlans([a,b,c,d],{target:'반도체'},'2026-10-23').map(x=>x.id),['semi','global']);
 assert.deepEqual(filterPlans([a,b,c,d],{state:'due'},'2026-10-23').map(x=>x.id),['semi']);
 assert.deepEqual(filterPlans([a,b,c,d],{state:'resolved'},'2026-10-23').map(x=>x.id),['done']);
});

test('scores use signed impacts from -3 through +3; importance ignored',()=>{
 assert.deepEqual([-3,-2,-1,1,2,3].map(impactScore),[-3,-2,-1,1,2,3]);
 assert.equal(impactScore(0),null);
 assert.equal('importance' in normalizePlan({...base,importance:5}),false);
 const make=importance=>({...normalizePlan(base),importance});
 assert.deepEqual(planScores([make(1)]),planScores([make(5)]));
});
test('global plus exact target; industries do not contaminate others or global',()=>{
 const make=(impact,scope='all',target='',extra={})=>({...normalizePlan({...base,impact,scope,target}),...extra});
 const rows=[make(2),make(1),make(-3,'industry','반도체'),make(3,'industry','에너지'),make(-2,'asset_class','반도체')];
 const scores=planScores(rows,'2026-10-23');const global=scores[0];
 assert.equal(global.total,3);assert.equal(global.count,2);assert.equal(global.average,1.5);
 const semi=scores.find(s=>s.scope==='industry'&&s.target==='반도체');
 assert.equal(semi.total,0);assert.equal(semi.count,3);assert.equal(semi.average,0);assert.equal(semi.max,9);
 assert.equal(scores.find(s=>s.target==='에너지').total,6);
 assert.equal(scores.find(s=>s.scope==='asset_class').total,1);
 assert.deepEqual(filterPlans(rows,{target:'반도체',scope:'industry'}).map(x=>x.scope).sort(),['all','all','industry']);
});
test('zero inputs show no average; expired/resolved excluded; personal context included',()=>{
 assert.equal(planScores([])[0].average,null);assert.equal(planScores([])[0].count,0);
 const row={...normalizePlan({...base,category:'personal',impact:3})};
 const excluded=[{...row,expires_on:'2026-10-23'},{...row,state:'resolved'}];
 const score=planScores([row,...excluded],'2026-10-23')[0];
 assert.equal(score.total,3);assert.equal(score.count,1);assert.equal(score.average,3);
 const invalid={...row,impact:0};assert.equal(planScores([invalid])[0].count,0);
});

test('overall counts each eligible item once across scopes, balanced and empty differ',()=>{
 const make=(impact,extra={})=>({...normalizePlan({...base,impact}),...extra});
 const rows=[make(3),make(-3,{scope:'industry',target:'반도체'}),make(2,{category:'personal'}),make(-2,{state:'resolved'}),make(-3,{expires_on:'2026-10-23'})];
 const score=overallScore(rows,'2026-10-23');
 assert.equal(score.total,2);assert.equal(score.count,3);assert.equal(score.average,2/3);
 assert.equal(overallScore([make(-3)]).position,0);assert.equal(overallScore([make(3)]).position,100);
 assert.equal(overallScore([make(-3)]).intensity,1);
 assert.equal(overallScore([make(-1)]).intensity,1/3);
 assert.equal(overallScore([make(3),make(-3)]).average,0);
 assert.equal(overallScore([]).average,null);assert.equal(overallScore([]).position,50);
});
