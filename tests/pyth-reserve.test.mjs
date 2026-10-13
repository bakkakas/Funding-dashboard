import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { annualizedBuybackRate, validatePythReserve } from '../js/pyth-reserve.js';

const data=validatePythReserve(JSON.parse(readFileSync(new URL('../data/pyth-reserve.json',import.meta.url))));

test('PYTH Reserve separates product revenue, DAO funding and executed market purchases',()=>{
  assert.equal(data.latestMonth,'2026-09');
  assert.equal(data.latestGrossRevenueUsd,916471);
  assert.equal(data.latestDaoShareUsd,553693);
  assert.equal(data.annualizedReserveFundingUsd,553693*12);
  assert.ok(data.openMarketPurchasedPyth>20_500_000);
  assert.ok(data.reserveBalancePyth>data.openMarketPurchasedPyth);
  assert.equal(data.monthlyRevenue.at(-1).daoShareUsd,data.latestDaoShareUsd);
});

test('annualized buyback funding rate uses live market cap and rejects invalid denominators',()=>{
  assert.equal(annualizedBuybackRate(6_000_000,600_000_000),1);
  assert.equal(annualizedBuybackRate(6_000_000,0),null);
  assert.equal(annualizedBuybackRate(6_000_000,null),null);
});
