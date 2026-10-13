import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { annualizedBuybackYield, validateHypeBuybacks } from '../js/hype-buybacks.js';

const data=validateHypeBuybacks(JSON.parse(readFileSync(new URL('../data/hype-buybacks.json',import.meta.url))));

test('HYPE buyback snapshot exposes official cumulative and recent burn metrics',()=>{
  assert.ok(data.burnedHype>47_000_000);
  assert.ok(data.cumulativeSpendUsd>1_000_000_000);
  assert.ok(data.averageBuyPriceUsd>0);
  assert.ok(data.burnedMaxSupplyPct>4);
  assert.ok(data.recent['1d'].hype>0);
  assert.ok(data.recent['30d'].usd>=data.recent['7d'].usd);
  assert.ok(data.dailyActivity.length>=7);
});

test('annualized HYPE buyback yield uses the live market cap denominator',()=>{
  assert.equal(annualizedBuybackYield(30_000_000,3_650_000_000),10);
  assert.equal(annualizedBuybackYield(30_000_000,0),null);
  assert.equal(annualizedBuybackYield(null,3_650_000_000),null);
});
