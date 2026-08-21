import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { FUNDING_SUPABASE:{} };

const {
  annualizedFromFee,
  feeDirection,
  feeTone,
  fundingFeeValue,
  periodFundingFee,
} = await import('../js/metrics.js');

test('preserves the exchange funding-rate sign', () => {
  assert.equal(fundingFeeValue({ lastFundingRate:0.0001 }), 0.0001);
  assert.equal(fundingFeeValue({ lastFundingRate:-0.0001 }), -0.0001);
});

test('maps positive to Long -> Short and green', () => {
  assert.equal(feeDirection(0.0001), 'Long -> Short');
  assert.equal(feeTone(0.0001), 'good');
});

test('maps negative to Short -> Long and red', () => {
  assert.equal(feeDirection(-0.0001), 'Short -> Long');
  assert.equal(feeTone(-0.0001), 'bad');
});

test('keeps period and annualized metrics on the standard sign', () => {
  assert.equal(periodFundingFee({ avgFundingRate:0.0001 }), 0.0001);
  assert.ok(Math.abs(annualizedFromFee({ fundingIntervalHours:8 }, 0.0001) - 10.95) < 1e-12);
});
