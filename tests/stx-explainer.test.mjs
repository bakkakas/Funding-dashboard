import test from 'node:test';
import assert from 'node:assert/strict';
import { bondWaterfall } from '../js/stx-explainer.js';
test('85/15 split applies only to the residual after bonds',()=>{
  const r=bondWaterfall(10,2);
  assert.equal(r.bonds,2);assert.equal(r.stxOnly,6.8);assert.equal(r.reserve,1.2);assert.equal(r.shortfall,0);
});
test('shortfall does not spend unavailable reserves or create negative excess',()=>{
  assert.deepEqual(bondWaterfall(1,2),{bonds:1,stxOnly:0,reserve:0,shortfall:1});
  assert.deepEqual(bondWaterfall(0,2),{bonds:0,stxOnly:0,reserve:0,shortfall:2});
  assert.deepEqual(bondWaterfall(2,2),{bonds:2,stxOnly:0,reserve:0,shortfall:0});
});
test('allocation conserves all incoming BTC across fractional scenarios',()=>{
  for(const amount of [0,.0001,.1,1.99,2,2.01,10,100])for(const due of [0,.0002,2,50]){
    const r=bondWaterfall(amount,due);
    assert.ok(Math.abs(r.bonds+r.stxOnly+r.reserve-amount)<1e-10);
    assert.ok(Math.abs(r.bonds+r.shortfall-due)<1e-10);
    assert.ok(Object.values(r).every(v=>v>=0));
  }
});
test('invalid scenario inputs never become displayed zero rewards',()=>{
  for(const value of [-1,NaN,Infinity,null,'1',undefined]){
    assert.throws(()=>bondWaterfall(value,2));assert.throws(()=>bondWaterfall(10,value));
  }
});
