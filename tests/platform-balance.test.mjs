import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectivePortfolio,validBalance} from '../js/platform-balance.js';
import {valuePortfolio} from '../js/portfolio-snapshot.js';
const assets=[{id:'a',nickname:'Mirae',asset_class:'stock',quantity:2,currency:'KRW',stable_amount_krw:3},{id:'b',nickname:'Mirae',asset_class:'cash',cash_amount_krw:10,excluded_from_total:true},{id:'c',nickname:'Other',asset_class:'stock',quantity:1,currency:'KRW'}];
const balance={enabled:true,amount:100,currency:'KRW',asset_class:'stock',excluded_from_total:false};
const run=platformBalances=>valuePortfolio({assets,platformBalances,fx:1000,quote:()=>10});
test('enabled balance replaces mixed details, Stable and exclusions; disabled exactly restores legacy totals',async()=>{
 const original=JSON.stringify(assets);
 assert.deepEqual(await run({Mirae:balance}),{total_value_krw:110,class_values:{stock:110,crypto:0,commodity:0,cash:0,stable:0}});
 assert.deepEqual(await run({Mirae:{...balance,enabled:false}}),await run({}));
 assert.equal(JSON.stringify(assets),original);
});
test('USD override converts once; zero is valid; total exclusion keeps allocation',async()=>{
 assert.equal((await run({Mirae:{...balance,currency:'USD'}})).total_value_krw,100010);
 assert.equal((await run({Mirae:{...balance,amount:0}})).total_value_krw,10);
 const result=await run({Mirae:{...balance,excluded_from_total:true}});
 assert.equal(result.total_value_krw,10);assert.equal(result.class_values.stock,110);
});
test('manual crypto remains counted with either source; matching detail wallet is not double counted',async()=>{
 for(const cryptoTotalSource of ['assets','details']){
 const result=await valuePortfolio({assets:[{id:'x',nickname:'Wallet',asset_class:'crypto',quantity:5,currency:'USD'}],cryptoEntries:[{id:'e',location:'Wallet',quantity:8,currency:'USD'}],cryptoTotalSource,platformBalances:{Wallet:{...balance,asset_class:'crypto',currency:'USD'}},fx:1000,quote:()=>{throw Error('replaced quotes must not run')}});
 assert.equal(result.total_value_krw,100000);assert.equal(result.class_values.crypto,100000);
 }
});
test('other wallet detail still counted and source does not fall back after override',async()=>{
 const result=await valuePortfolio({assets:[...assets,{id:'coin',nickname:'Else',asset_class:'crypto',quantity:99,currency:'USD'}],cryptoEntries:[{id:'d',location:'Mirae',quantity:8,currency:'USD'}],cryptoTotalSource:'details',platformBalances:{Mirae:balance},fx:1000,quote:()=>10});
 assert.equal(result.total_value_krw,110);
});
test('unknown platform settings do not create phantom holdings, malformed enabled data fails closed',()=>{
 assert.deepEqual(effectivePortfolio({assets,platformBalances:{Missing:balance}}).assets,assets);
 assert.throws(()=>effectivePortfolio({assets,platformBalances:{Mirae:{...balance,amount:-1}}}));
 for(const amount of [-1,NaN,Infinity,'100',null,1e16])assert.equal(validBalance({...balance,amount}),false);
});
test('original quote failure still blocks snapshot when manual mode disabled',async()=>{
 await assert.rejects(valuePortfolio({assets,platformBalances:{Mirae:{...balance,enabled:false}},fx:1000,quote:()=>{throw Error('failed')}}));
});
const auto={...balance,mode:'auto_cash',amount:1000000,currency:'USD'};
test('one million USD splits 500k crypto and 500k automatic cash without duplicate cash rows',async()=>{
 const sample=[{id:'btc',nickname:'Bybit',asset_class:'crypto',quote_symbol:'CG:bitcoin',quantity:10,currency:'USD'},{id:'cash',nickname:'Bybit',asset_class:'cash',cash_amount_usd:500000},{id:'usdt',nickname:'Bybit',asset_class:'crypto',quote_symbol:'CG:tether',quantity:500000,currency:'USD'}];
 const original=JSON.stringify(sample);
 const result=await valuePortfolio({assets:sample,platformBalances:{Bybit:auto},fx:1400,quote:a=>{assert.equal(a.id,'btc');return 50000}});
 assert.equal(result.total_value_krw,1400000000);assert.equal(result.class_values.crypto,700000000);assert.equal(result.class_values.cash,700000000);assert.equal(result.class_values.stable,700000000);assert.equal(JSON.stringify(sample),original);
});
test('auto mode uses selected detailed crypto source and preserves other platforms',async()=>{
 const sample=[{id:'old',nickname:'Bybit',asset_class:'crypto',quantity:999,currency:'USD'},...assets];
 const entries=[{id:'new',location:'Bybit',quote_symbol:'CG:bitcoin',quantity:4,currency:'USD'},{id:'stable',location:'Bybit',quote_symbol:'CG:usd-coin',quantity:100000,currency:'USD'},{id:'other',location:'Another',quote_symbol:'CG:ethereum',quantity:1,currency:'USD'}];
 const result=await valuePortfolio({assets:sample,cryptoEntries:entries,cryptoTotalSource:'details',platformBalances:{Bybit:auto},fx:1000,quote:a=>{assert.notEqual(a.id,'old');assert.notEqual(a.id,'stable');return a.id==='new'?50000:10}});
 assert.equal(result.total_value_krw,1000010030);assert.equal(result.class_values.crypto,200010000);assert.equal(result.class_values.cash,800000013);
});
test('auto mode tracks price changes while total stays fixed, honors platform exclusion, applies per-row Stable once',async()=>{
 for(const price of [10,20]){
 const result=await valuePortfolio({assets,platformBalances:{Mirae:{...auto,amount:100,currency:'KRW',excluded_from_total:true}},fx:1000,quote:()=>price});
 assert.equal(result.total_value_krw,price);assert.equal(result.class_values.stock,price*3-3);assert.equal(result.class_values.cash,100-price*2+3);
 }
});
test('auto mode rejects detail overshoot and missing quotes, never invents negative/false cash or snapshots',async()=>{
 await assert.rejects(valuePortfolio({assets,platformBalances:{Mirae:{...auto,amount:5,currency:'KRW'}},fx:1000,quote:()=>10}),/초과/);
 await assert.rejects(valuePortfolio({assets,platformBalances:{Mirae:auto},fx:1000,quote:()=>NaN}),/시세/);
 await assert.rejects(valuePortfolio({assets,platformBalances:{Mirae:auto},fx:NaN,quote:()=>10}),/환율/);
});
test('auto cash can be exactly zero; disabling restores detailed sums',async()=>{
 const b={...auto,amount:17,currency:'KRW'};
 assert.equal((await run({Mirae:b})).class_values.cash,0);
 assert.deepEqual(await run({Mirae:{...b,enabled:false}}),await run({}));
 assert.equal(validBalance({...auto,mode:'unknown'}),false);
});
