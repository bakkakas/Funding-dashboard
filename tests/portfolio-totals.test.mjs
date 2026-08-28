import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePortfolioTotals } from '../js/portfolio-totals.js';

const assets = [
  { id: 'stock', asset_class: 'stock', value: 1000 },
  { id: 'crypto-total', asset_class: 'crypto', value: 500 },
  { id: 'excluded', asset_class: 'cash', value: 900, excluded_from_total: true },
];
const details = [
  { id: 'btc-bybit', value: 300 },
  { id: 'eth-wallet', value: 400 },
];

test('uses the existing crypto holdings by default', () => {
  const result = calculatePortfolioTotals({
    assets,
    cryptoEntries: details,
    assetValue: item => item.value,
    cryptoValue: item => item.value,
  });
  assert.equal(result.total, 1500);
  assert.equal(result.cryptoTotal, 500);
  assert.equal(result.source, 'assets');
});

test('replaces existing crypto holdings with detail portfolio total', () => {
  const result = calculatePortfolioTotals({
    assets,
    cryptoEntries: details,
    cryptoTotalSource: 'details',
    assetValue: item => item.value,
    cryptoValue: item => item.value,
  });
  assert.equal(result.total, 1700);
  assert.equal(result.assetCryptoTotal, 500);
  assert.equal(result.detailCryptoTotal, 700);
  assert.equal(result.source, 'details');
});
