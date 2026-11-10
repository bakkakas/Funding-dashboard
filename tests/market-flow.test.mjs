import test from 'node:test';
import assert from 'node:assert/strict';
import {periodRows,cumulativeValues} from '../js/flow-panel.js';
import {orderedIds,moveId} from '../js/research-order.js';
test('new assets append, obsolete and duplicate order entries disappear',()=>{assert.deepEqual(orderedIds(['a','b','c'],['b','old','b']),['b','a','c']);});
test('drag can move before/after while preserving hidden assets',()=>{assert.deepEqual(moveId(['a','hidden','b','c'],'c','a'),['c','a','hidden','b']);assert.deepEqual(moveId(['a','hidden','b','c'],'a','b',true),['hidden','b','a','c']);assert.deepEqual(moveId(['a','b'],'a','a'),['a','b']);});
test('market KRW is converted once, signed cumulative resets to selected range',()=>{const rows=[{date:'2020-01-01',v:9e8},{date:'2026-11-02',v:2e8},{date:'2026-11-09',v:-3e8}];assert.deepEqual(cumulativeValues(periodRows(rows,'30D'),'v',1e8),[2,-1]);assert.equal(periodRows(rows,'5Y').length,2);assert.equal(periodRows(rows,'10Y').length,3);});
test('missing flow values do not become zero or reset accumulated total',()=>{assert.deepEqual(cumulativeValues([{v:10},{v:null},{v:-4}],'v'),[10,null,6]);});
