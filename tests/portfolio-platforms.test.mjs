import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPlatformAssets, platformTotals, platformUsdTotals } from '../js/portfolio-platforms.js';
test('platform grouping keeps distinct holdings and cash intact without mutating legacy names',()=>{
 const assets=[{id:1,nickname:'미래에셋',asset_class:'stock',value:100},{id:2,nickname:'미래에셋',asset_class:'stock',value:200},{id:3,nickname:' 미래에셋 ',asset_class:'cash',value:300},{id:4,nickname:'미래에셋 ISA',value:400},{id:5,nickname:''},{id:6}];
 const before=JSON.stringify(assets),groups=groupPlatformAssets(assets);
 assert.deepEqual(groups.map(g=>[g.name,g.assets.map(a=>a.id)]),[['미래에셋',[1,2,3]],['미래에셋 ISA',[4]],['',[5,6]]]);
 assert.equal(platformTotals(groups[0].assets,a=>a.value).value,600);assert.equal(JSON.stringify(assets),before);
});
test('platform included subtotal respects exclusions and original pricing source, Stable is not added again',()=>{
 const assets=[{asset_class:'stock',value:100},{asset_class:'cash',value:300},{asset_class:'crypto',allocation_class:'cash',value:500,stable_amount_krw:200},{asset_class:'stock',value:50,excluded_from_total:true}];
 assert.deepEqual(platformTotals(assets,a=>a.value),{value:950,included:900});
 assert.deepEqual(platformTotals(assets,a=>a.value,'details'),{value:950,included:400});
});
test('per-holding labels never rename or split a platform or merge duplicate assets',()=>{const holdings=[{id:1,nickname:'미래에셋',asset_label:'장기 보유',symbol:'005930',value:100},{id:2,nickname:'미래에셋',asset_label:'단기 매매',symbol:'005930',value:200}];const groups=groupPlatformAssets(holdings);assert.equal(groups.length,1);assert.equal(groups[0].name,'미래에셋');assert.equal(groups[0].assets.length,2);assert.equal(platformTotals(groups[0].assets,a=>a.value).value,300);});

test('USD platforms include split USD cash and preserve excluded subtotal without adding Stable twice',()=>{
 const rows=[{asset_class:'crypto',currency:'USD',quantity:2,price:100,stable_amount_krw:50},{asset_class:'cash',currency:'KRW',cash_amount_krw:0,cash_amount_usd:30},{asset_class:'stock',currency:'USD',quantity:3,price:10,excluded_from_total:true}];
 assert.deepEqual(platformUsdTotals(rows,a=>a.price),{value:260,included:230});
 assert.deepEqual(platformUsdTotals(rows,a=>a.price,'details'),{value:260,included:30});
 assert.equal(platformUsdTotals([...rows,{asset_class:'cash',cash_amount_krw:1,cash_amount_usd:0}],a=>a.price),null);
 assert.equal(platformUsdTotals([...rows,{asset_class:'stock',currency:'KRW',quantity:0}],a=>a.price),null);
 assert.equal(platformUsdTotals([],()=>0),null);
 assert.deepEqual(platformUsdTotals([{asset_class:'cash',currency:'USD',quantity:12.34}],()=>0),{value:12.34,included:12.34});
});
