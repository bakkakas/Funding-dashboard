import test from 'node:test';
import assert from 'node:assert/strict';
import { cashBalances, cashValueKrw, formatCashBalances } from '../js/cash-balances.js';

test('combines KRW and USD balances using the current exchange rate', () => {
  const asset = { cash_amount_krw: 1_000_000, cash_amount_usd: 2_000 };
  assert.equal(cashValueKrw(asset, 1_350), 3_700_000);
});

test('keeps legacy single-currency cash rows compatible', () => {
  assert.deepEqual(cashBalances({ quantity: 500_000, currency: 'KRW' }), { krw: 500_000, usd: 0 });
  assert.deepEqual(cashBalances({ quantity: 750, currency: 'USD' }), { krw: 0, usd: 750 });
});

test('formats both balances for one cash account row', () => {
  assert.deepEqual(
    formatCashBalances({ cash_amount_krw: 1_234_567, cash_amount_usd: 890.5 }),
    { krw: '₩1,234,567', usd: '$890.5' },
  );
});
