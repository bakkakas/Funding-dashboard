import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numberOrNull, validateCatalog, validateAsset, selectAssetId, decisionStorageKey, unlockSummary, resolveProfile, loadProtocolMetrics, safeUrl } from '../js/research-data.js';
import { evaluateInvestmentDecision, seriesChange } from '../js/investment-score.js';
const json=name=>JSON.parse(readFileSync(new URL('../data/research/'+name+'.json',import.meta.url)));
const profiles=json('profiles');
const asset=validateAsset(json('ethfi'),'ethfi');
const profile=resolveProfile(asset,profiles);
test('published catalog and documents validate; ids resolve and legacy key survives',()=>{
  const catalog=validateCatalog(json('index'));
  for(const item of catalog) assert.equal(validateAsset(json(item.id),item.id).id,item.id);
  assert.equal(selectAssetId(catalog,'missing'),catalog[0].id);
  assert.equal(decisionStorageKey('ethfi'),'fundingInvestmentDecision.ethfi.v1');
  assert.notEqual(decisionStorageKey('ethfi'),decisionStorageKey('second'));
});
test('ten assets, duplicate identities and traversal paths',()=>{
  const assets=Array.from({length:10},(_,i)=>({id:'asset-'+i,name:'Project '+i,symbol:'T'+i}));
  assert.equal(validateCatalog({schemaVersion:1,assets}).length,10);
  assert.equal(selectAssetId(assets,'asset-9'),'asset-9');
  assert.throws(()=>validateCatalog({schemaVersion:1,assets:[assets[0],assets[0]]}));
  assert.throws(()=>validateCatalog({schemaVersion:1,assets:[{...assets[0],id:'../other'}]}));
  assert.throws(()=>validateAsset(asset,'other'));
});
test('no asset gets ETHFI rules by default or just by sharing a sector',()=>{
  assert.equal(resolveProfile({...asset,id:'second'},profiles),null);
  assert.equal(resolveProfile({...asset,category:'dex'},profiles),null);
  const result=evaluateInvestmentDecision({tvl30dChange:20,holderRevenue30d:10},null);
  assert.equal(result.score,null);assert.equal(result.coverage,0);assert.equal(result.signal,'pending');
});
test('null or blank metrics never become zero or free points',()=>{
  for(const value of [null,undefined,'',false]) assert.equal(numberOrNull(value),null);
  assert.equal(numberOrNull(0),0);
  const result=evaluateInvestmentDecision({tvl30dChange:null,holderRevenue30d:null,nextUnlockToCirculatingPct:null},profile);
  assert.equal(result.score,null);assert.equal(result.coverage,0);
  const partial=evaluateInvestmentDecision({tvl30dChange:20},profile);
  assert.equal(partial.coverage,25);assert.equal(partial.signal,'pending');
});
test('unknown or exhausted schedules are not complete; explicit complete is zero',()=>{
  assert.equal(unlockSummary(asset,'2026-09-08').next.date,'2026-09-15');
  assert.equal(unlockSummary(asset,'2028-01-01').remaining,null);
  assert.equal(unlockSummary(validateAsset({...asset,unlock:{status:'unknown'}},asset.id),'2026-09-08').known,false);
  assert.equal(unlockSummary(validateAsset({...asset,unlock:{status:'complete'}},asset.id),'2026-09-08').remaining,0);
  assert.throws(()=>validateAsset({...asset,unlock:{status:'scheduled',events:[{date:'2026-02-31',amount:1}]}},asset.id));
});
test('one failed metric source preserves independent successful metrics',async()=>{
  const result=await loadProtocolMetrics(asset,{fetchImpl:async url=>{
    if(url.includes('dailyHoldersRevenue'))return {ok:false,status:503};
    return {ok:true,json:async()=>url.includes('/protocol/')?{tvl:[{date:1,totalLiquidityUSD:100}]}:{total30d:1000}};
  }});
  assert.equal(result.partial,true);assert.equal(result.metrics.protocolRevenue30d,1000);assert.equal(result.metrics.holderRevenue30d,null);
});
test('profile changes apply through shared engine and thresholds',()=>{
  const input={tvl30dChange:0,nextUnlockToCirculatingPct:2};
  const first=evaluateInvestmentDecision(input,profile);
  const changed=evaluateInvestmentDecision(input,{...profile,thresholds:{...profile.thresholds,unlockRisk:1.5}});
  assert.equal(first.rules.find(r=>r.key==='unlockPressure').status,'watch');
  assert.equal(changed.rules.find(r=>r.key==='unlockPressure').status,'danger');
  assert.throws(()=>evaluateInvestmentDecision(input,{...profile,weights:{...profile.weights,valuation:100}}));
});
test('links reject script URLs',()=>{
  assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('https://example.com/'),'https://example.com/');
});
test('short history is not misrepresented as 30 day growth',()=>{
  const now=Math.floor(Date.now()/1000);
  assert.equal(seriesChange([{date:now-86400,totalLiquidityUSD:100},{date:now,totalLiquidityUSD:120}],30),null);
});
