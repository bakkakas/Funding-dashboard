import {test} from 'node:test';
import assert from 'node:assert/strict';
import {valuePortfolio,snapshotDate} from '../js/portfolio-snapshot.js';
const assets=[
 {id:'cash',asset_class:'cash',cash_amount_krw:1000,cash_amount_usd:2},
 {id:'stock',asset_class:'stock',quantity:3,currency:'USD'},
 {id:'coin',asset_class:'crypto',quantity:4,currency:'USD'},
 {id:'excluded',asset_class:'stock',quantity:10,currency:'KRW',excluded_from_total:true},
];
test('daily valuation matches cash, exclusions and selected crypto source without double counting',async()=>{
 const args={assets,fx:1000,quote:()=>10,cryptoEntries:[{id:'detail',quantity:2,currency:'USD'}]};
 const summary=await valuePortfolio(args),detail=await valuePortfolio({...args,cryptoTotalSource:'details'});
 assert.equal(summary.total_value_krw,73000);assert.equal(detail.total_value_krw,53000);
 assert.equal(summary.class_values.stock,30100);assert.equal(summary.class_values.cash,3000);
});
test('incomplete market data and invalid FX fail closed instead of recording zero',async()=>{
 await assert.rejects(valuePortfolio({assets,fx:NaN,quote:()=>1}),/환율/);
 await assert.rejects(valuePortfolio({assets,fx:1000,quote:()=>undefined}),/시세/);
 await assert.rejects(valuePortfolio({assets,fx:1000,quote:()=>{throw Error('provider failed')}}),/provider/);
});
test('KST midnight changes daily key, not UTC midnight',()=>{
 assert.equal(snapshotDate(new Date('2026-10-29T14:59:59Z')),'2026-10-29');
 assert.equal(snapshotDate(new Date('2026-10-29T15:00:00Z')),'2026-10-30');
});
