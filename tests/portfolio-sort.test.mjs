import test from 'node:test';
import assert from 'node:assert/strict';
import { sortAssetsByValue } from '../js/portfolio-sort.js';

const assets=[
  {id:'small',value:100},
  {id:'large',value:900},
  {id:'medium',value:500}
];
const valueOf=asset=>asset.value;

test('sorts portfolio assets by valuation descending',()=>{
  assert.deepEqual(sortAssetsByValue(assets,'desc',valueOf).map(asset=>asset.id),['large','medium','small']);
});

test('sorts portfolio assets by valuation ascending',()=>{
  assert.deepEqual(sortAssetsByValue(assets,'asc',valueOf).map(asset=>asset.id),['small','medium','large']);
});

test('preserves source order and does not mutate when sorting is off',()=>{
  assert.deepEqual(sortAssetsByValue(assets,null,valueOf).map(asset=>asset.id),['small','large','medium']);
  assert.deepEqual(assets.map(asset=>asset.id),['small','large','medium']);
});
