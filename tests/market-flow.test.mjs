import test from 'node:test';
import assert from 'node:assert/strict';
import {periodRows,cumulativeValues} from '../js/flow-panel.js';
import {orderedIds,moveId} from '../js/research-order.js';
test('new assets append, obsolete and duplicate order entries disappear',()=>{assert.deepEqual(orderedIds(['a','b','c'],['b','old','b']),['b','a','c']);});
test('drag can move before/after while preserving hidden assets',()=>{assert.deepEqual(moveId(['a','hidden','b','c'],'c','a'),['c','a','hidden','b']);assert.deepEqual(moveId(['a','hidden','b','c'],'a','b',true),['hidden','b','a','c']);assert.deepEqual(moveId(['a','b'],'a','a'),['a','b']);});
test('market KRW is converted once, signed cumulative resets to selected range',()=>{const rows=[{date:'2020-01-01',v:9e8},{date:'2026-11-02',v:2e8},{date:'2026-11-09',v:-3e8}];assert.deepEqual(cumulativeValues(periodRows(rows,'30D'),'v',1e8),[2,-1]);assert.equal(periodRows(rows,'5Y').length,2);assert.equal(periodRows(rows,'10Y').length,3);});
test('missing flow values invalidate subsequent cumulative totals',()=>{assert.deepEqual(cumulativeValues([{v:10},{v:null},{v:-4}],'v'),[10,null,null]);});

test('table truncates toward zero including negatives and negative zero',async()=>{const {formatInteger}=await import('../js/flow-panel.js');assert.equal(formatInteger(1234.99),'1,234');assert.equal(formatInteger(-1234.99),'-1,234');assert.equal(formatInteger(-.99),'0');assert.equal(formatInteger(null),'—');assert.equal(formatInteger(999.99),'999');});
test('cumulative uses raw amounts before truncation',async()=>{const {formatInteger}=await import('../js/flow-panel.js');const values=cumulativeValues([{v:190000000},{v:190000000}],'v',1e8);assert.equal(formatInteger(values.at(-1)),'3');});
test('raw accumulation avoids truncating a floating point near-integer below its true value',async()=>{const {formatInteger}=await import('../js/flow-panel.js');const values=cumulativeValues(Array.from({length:10},()=>({v:10000000})),'v',1e8);assert.equal(formatInteger(values.at(-1)),'1');});
