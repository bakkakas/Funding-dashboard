import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsdeObservation, milestoneProgress, BUYBACK_MILESTONES, CAP_MILESTONES, fetchUsdeObservation } from '../js/usde-observation.js';
import { evaluateUsdeMilestones } from '../js/usde-alerts.js';
import { buildUsdeMonitorScript } from '../scripts/usde-monitor-script.mjs';

const now = Date.UTC(2026, 8, 16, 12);
const observation = cap => ({cap, supply:cap / .99, observedAt:now, fetchedAt:now, source:'CoinGecko'});
const data = {id:'ethena-usde',last_updated:new Date(now).toISOString(),market_data:{market_cap:{usd:4.95e9},circulating_supply:5e9,current_price:{usd:.99}}};

test('market cap and circulating supply stay distinct; official tiers include 25B+', () => {
  const o=normalizeUsdeObservation(data,now);
  assert.equal(o.cap,4.95e9);assert.equal(o.supply,5e9);
  assert.equal(milestoneProgress(o.cap,CAP_MILESTONES)[0].reached,false);
  assert.deepEqual(BUYBACK_MILESTONES.map(x=>[x.supply,x.rate]),[[7.5e9,5],[10e9,10],[15e9,15],[20e9,20],[25e9,25]]);
  assert.equal(milestoneProgress(7.5e9,BUYBACK_MILESTONES.map(x=>x.supply))[0].percent,100);
  assert.equal(milestoneProgress(null,CAP_MILESTONES)[0].remaining,null);
});
test('rejects ENA, invalid values, stale and future observations', () => {
  for(const bad of [{...data,id:'ethena'},{...data,last_updated:new Date(now-3600001).toISOString()},{...data,last_updated:new Date(now+300001).toISOString()},{...data,market_data:{...data.market_data,market_cap:{usd:null}}}]) assert.throws(()=>normalizeUsdeObservation(bad,now));
});
test('HTTP errors do not become an observation',async()=>{
  await assert.rejects(fetchUsdeObservation({now,fetchImpl:async()=>({ok:false,status:429})}),/429/);
});
test('first sample establishes baseline; threshold crossing sends once, not again after recross', () => {
  const first=evaluateUsdeMilestones(observation(4.7e9),{},now);
  assert.equal(first.notify,undefined);
  const second=evaluateUsdeMilestones(observation(5e9),first.state,now);
  assert.match(second.notify,/\$5B/);
  const down=evaluateUsdeMilestones(observation(4.8e9),second.state,now);
  assert.equal(down.notify,undefined);
  const back=evaluateUsdeMilestones(observation(5.1e9),down.state,now);
  assert.equal(back.notify,undefined);
  assert.deepEqual(back.state.notified,[5e9]);
});
test('multiple milestones crossed between checks are bundled; frozen state never mutated', () => {
  const previous=Object.freeze({initialized:true,notified:Object.freeze([5e9]),lastObservedAt:now});
  const result=evaluateUsdeMilestones(observation(7.6e9),previous,now);
  assert.deepEqual(result.state.notified,[5e9,6e9,7e9,7.5e9]);
  assert.match(result.notify,/\$6B · \$7B · \$7.5B/);
  assert.deepEqual(previous.notified,[5e9]);
  assert.equal(evaluateUsdeMilestones(observation(8e9),result.state,now).notify,undefined);
});
test('already exceeded on initial setup is not a newly reached milestone',()=>{
  const first=evaluateUsdeMilestones(observation(6.1e9),{},now);
  assert.equal(first.notify,undefined);assert.deepEqual(first.state.notified,[5e9,6e9]);
});
test('stale, invalid or regressed observation cannot change alert state',()=>{
  assert.throws(()=>evaluateUsdeMilestones(observation(5e9),{},now+3600001));
  assert.throws(()=>evaluateUsdeMilestones({...observation(5e9),cap:NaN},{},now));
  assert.throws(()=>evaluateUsdeMilestones(observation(5e9),{lastObservedAt:now+1},now));
});

test('all 15 requested levels fire once and completion waits for the final threshold',()=>{
  const levels=[5,6,7,7.5,9,10,11,13,15,17,19,20,22,24,25];
  let previous=evaluateUsdeMilestones(observation(4.7e9),{},now).state;
  for(const [index,level] of levels.entries()) {
    const result=evaluateUsdeMilestones(observation(level*1e9),previous,now);
    assert.ok(result.notify.includes('$'+level+'B'));
    assert.equal(result.state.completed,index===levels.length-1);
    assert.equal(result.state.notified.length,index+1);
    assert.equal(evaluateUsdeMilestones(observation(level*1e9),result.state,now).notify,undefined);
    previous=result.state;
  }
  assert.deepEqual(previous.notified,levels.map(value=>value*1e9));
});

test('scheduler retries failed DM, then removes itself only after final delivery, with no more source calls',async()=>{
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const run=new AsyncFunction('trigger','automations','exec','json',buildUsdeMonitorScript('test-job','collector',{initialized:true,notified:[]}));
  const pending={initialized:true,completed:true,pendingNotify:'final alert'};
  let result;
  const noFetch=async()=>{throw Error('Unexpected source call');};
  await run({state:pending},async()=>({state:{lastDelivered:false}}),noFetch,r=>{result=r;});
  assert.equal(result.notify,'final alert');
  assert.deepEqual(pending,{initialized:true,completed:true,pendingNotify:'final alert'});
  const calls=[];
  await run({state:pending},async args=>{calls.push(args);return {state:{lastDelivered:true}};},noFetch,r=>{result=r;});
  assert.deepEqual(calls,[{action:'get',jobId:'test-job'},{action:'remove',jobId:'test-job'}]);
  assert.deepEqual(result,{});
});
