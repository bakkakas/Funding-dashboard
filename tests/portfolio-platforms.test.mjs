import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPlatformAssets, platformTotals } from '../js/portfolio-platforms.js';
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
