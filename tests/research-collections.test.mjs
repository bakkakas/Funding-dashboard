import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assetsForResearchFilter,
  createResearchList,
  deleteResearchList,
  normalizeResearchCollections,
  renameResearchList,
  toggleAssetInResearchList,
  toggleFavorite,
} from '../js/research-collections.js';

test('normalizes malformed and duplicated collection data', () => {
  assert.deepEqual(normalizeResearchCollections({
    favorites:['ethfi', 'ethfi', null],
    lists:[{id:'defi', name:' DeFi ', assetIds:['ethfi', 'ethfi']}, {id:'defi', name:'duplicate'}],
  }), {
    version:1,
    favorites:['ethfi'],
    lists:[{id:'defi', name:'DeFi', assetIds:['ethfi']}],
  });
});

test('toggles favorites and list membership without duplicates', () => {
  let state = toggleFavorite({}, 'ethfi');
  assert.deepEqual(state.favorites, ['ethfi']);
  state = toggleFavorite(state, 'ethfi');
  assert.deepEqual(state.favorites, []);
  state = createResearchList(state, 'DeFi', 'list-1');
  state = toggleAssetInResearchList(state, 'list-1', 'ethfi');
  state = toggleAssetInResearchList(state, 'list-1', 'ethfi');
  assert.deepEqual(state.lists[0].assetIds, []);
});

test('creates, renames, filters and deletes lists', () => {
  let state = createResearchList({}, 'Watch', 'list-1');
  state = createResearchList(state, 'watch', 'list-2');
  assert.equal(state.lists.length, 1);
  state = renameResearchList(state, 'list-1', 'Core');
  state = toggleAssetInResearchList(state, 'list-1', 'ethfi');
  assert.deepEqual(assetsForResearchFilter(state, 'list-1', ['ethfi', 'arb']), ['ethfi']);
  state = deleteResearchList(state, 'list-1');
  assert.deepEqual(state.lists, []);
});
