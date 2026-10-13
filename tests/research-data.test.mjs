import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numberOrNull, validateCatalog, validateAsset, selectAssetId, decisionStorageKey, unlockSummary, resolveProfile, loadProtocolMetrics, safeUrl } from '../js/research-data.js';
import { evaluateInvestmentDecision, seriesChange } from '../js/investment-score.js';
const json=name=>JSON.parse(readFileSync(new URL('../data/research/'+name+'.json',import.meta.url)));
const profiles=json('profiles');
const asset=validateAsset(json('ethfi'),'ethfi');
const profile=resolveProfile(asset,profiles);
test('requested assets have distinct verified market mappings, sourced bilingual content and no inherited score',()=>{
  const mapping={ena:'ethena',mon:'monad',stx:'blockstack',cake:'pancakeswap-token',bnb:'binancecoin',ondo:'ondo-finance',inj:'injective-protocol',xpl:'plasma',pyth:'pyth-network'};
  const catalog=validateCatalog(json('index'));
  for(const [id,cg] of Object.entries(mapping)) {
    assert.ok(catalog.some(item=>item.id===id));
    const doc=validateAsset(json(id),id);
    assert.equal(doc.market.coingeckoId,cg);
    assert.equal(resolveProfile(doc,profiles),null);
    assert.ok(doc.chart.symbol.endsWith(doc.symbol+'USDT'));
    for(const key of ['heroSummary','overviewBody','tokenRoleValue','supplyValue','insiderUnlock','unlockNote']) {
      assert.ok(doc.copy[key].ko);assert.ok(doc.copy[key].en);
    }
    assert.ok(doc.drivers.length>=2);assert.ok(doc.news.length>=1);
    for(const item of doc.drivers) assert.ok(item.sources.every(source=>safeUrl(source.url)));
    for(const item of doc.news) {assert.match(item.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(safeUrl(item.source.url));}
    if(['mon','stx','inj','xpl'].includes(id)) assert.equal(doc.market.maxSupply,null);
    if(!['ena','cake'].includes(id)) assert.equal(doc.metrics.defillamaSlug,null);
    assert.equal(doc.unlock.status,id==='inj'?'complete':id==='pyth'?'scheduled':'unknown');
  }
  assert.equal(json('cake').market.maxSupply,400000000);
  assert.equal(json('mon').chart.symbol,'BYBIT:MONUSDT');
});
test('published catalog and documents validate; ids resolve and legacy key survives',()=>{
  const catalog=validateCatalog(json('index'));
  for(const item of catalog) assert.equal(validateAsset(json(item.id),item.id).id,item.id);
  assert.equal(selectAssetId(catalog,'missing'),catalog[0].id);
  assert.equal(decisionStorageKey('ethfi'),'fundingInvestmentDecision.ethfi.v1');
  assert.notEqual(decisionStorageKey('ethfi'),decisionStorageKey('second'));
});
test('Ethena documents the complete USDe issuance and redemption path with official sources',()=>{
  const ena=validateAsset(json('ena'),'ena');
  assert.equal(ena.mechanism.steps.length,6);
  for(const step of ena.mechanism.steps) {
    assert.ok(step.title.ko);assert.ok(step.title.en);
    assert.ok(step.body.ko);assert.ok(step.body.en);
    assert.ok(step.sources.length);
    assert.ok(step.sources.every(source=>safeUrl(source.url)));
  }
  assert.match(ena.mechanism.steps[0].body.ko,/KYC\/KYB/);
  assert.match(ena.mechanism.steps[3].body.ko,/소각/);
  assert.match(ena.mechanism.steps[5].body.ko,/자동/);
});
test('Stacks documents BTC protocol bonds without hiding pooled custody or emission tradeoffs',()=>{
  const stx=validateAsset(json('stx'),'stx');
  assert.equal(stx.updatedAt,'2026-10-13');
  assert.equal(stx.mechanism.steps.length,6);
  assert.match(stx.mechanism.intro.ko,/전통 채권이나 BTC 대출이 아니라/);
  assert.match(stx.mechanism.steps[0].body.ko,/OP_CHECKLOCKTIMEVERIFY/);
  assert.match(stx.mechanism.steps[1].body.ko,/약 5%/);
  assert.match(stx.mechanism.steps[1].body.ko,/풀 운영자가.*대신.*STX/);
  assert.match(stx.mechanism.steps[2].body.ko,/85%/);
  assert.match(stx.mechanism.steps[2].body.ko,/보장 이자가 아니며/);
  assert.match(stx.mechanism.steps[3].body.ko,/25,200 Bitcoin 블록/);
  assert.match(stx.mechanism.steps[3].body.ko,/24회/);
  assert.match(stx.mechanism.steps[4].body.ko,/다시 유통 가능/);
  assert.match(stx.mechanism.steps[4].body.ko,/약 1주 전에/);
  assert.match(stx.mechanism.steps[5].body.ko,/670만 STX/);
  assert.ok(stx.mechanism.steps.every(step=>step.sources.length && step.sources.every(source=>safeUrl(source.url))));
  const bondDriver=stx.drivers.find(driver=>driver.title.ko.includes('BTC Bond'));
  assert.ok(bondDriver);
  assert.match(bondDriver.body.ko,/1,000 STX 발행 부담/);
  assert.match(bondDriver.body.ko,/신규·재가입 락업이 만기 해제분보다 커야/);
  assert.equal(stx.news[0].date,'2026-10-12');
});
test('every value-driver card explains a demand or supply path and its limiting condition',()=>{
  for(const id of ['ethfi','ena','mon','stx','cake','bnb','ondo','inj','xpl','pyth']) {
    const doc=validateAsset(json(id),id);
    assert.equal(doc.updatedAt,'2026-10-13');
    for(const driver of doc.drivers) {
      assert.ok(driver.body.ko.length>=95,`${id} Korean driver is too terse`);
      assert.ok(driver.body.en.length>=120,`${id} English driver is too terse`);
      assert.ok(driver.sources.length>0,`${id} driver lost its source`);
      assert.ok(driver.sources.every(source=>safeUrl(source.url)),`${id} driver has unsafe source`);
    }
  }
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
