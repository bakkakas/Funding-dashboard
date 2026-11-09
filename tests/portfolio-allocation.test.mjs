import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateAllocation,allocationClass} from '../js/portfolio-allocation.js';
import {valuePortfolio} from '../js/portfolio-snapshot.js';
const value=a=>a.value;
test('Stable transfers from crypto to Cash once, preserving allocation sum',()=>{
const result=calculateAllocation({assets:[{asset_class:'crypto',value:1000,stable_amount_krw:200},{asset_class:'cash',value:300,stable_amount_krw:100}],assetValue:value});
assert.deepEqual(result.groups,{stock:0,crypto:800,commodity:0,cash:500});assert.equal(result.stable,300);
assert.equal(Object.values(result.groups).reduce((a,b)=>a+b),1300);
});
test('USD stable caps at position value and excluded positions stay in allocation',()=>{
const result=calculateAllocation({assets:[{asset_class:'crypto',value:1000,stable_amount_krw:2,stable_currency:'USD',excluded_from_total:true}],assetValue:value,fx:1000});
assert.equal(result.groups.crypto,0);assert.equal(result.groups.cash,1000);
});
test('details source ignores replaced asset annotations and only transfers recognised stable entries',()=>{
const result=calculateAllocation({assets:[{asset_class:'crypto',value:1000,stable_amount_krw:1000},{asset_class:'cash',value:50}],cryptoEntries:[{quote_symbol:'CG:tether',value:200},{quote_symbol:'CG:bitcoin',value:500}],cryptoTotalSource:'details',assetValue:value,cryptoValue:value});
assert.deepEqual(result.groups,{stock:0,crypto:500,commodity:0,cash:250});
});
test('classification overrides do not change pricing or total-source identity',async()=>{
const assets=[{id:'coin',asset_class:'crypto',allocation_class:'stock',quantity:2,currency:'USD',stable_amount_krw:500},{id:'cash',asset_class:'cash',allocation_class:'commodity',cash_amount_krw:100,cash_amount_usd:1}];
assert.equal(allocationClass(assets[0]),'stock');
const result=await valuePortfolio({assets,fx:1000,quote:()=>10});
assert.equal(result.total_value_krw,21100);assert.deepEqual(result.class_values,{stock:19500,crypto:0,commodity:1100,cash:500,stable:500});
});
