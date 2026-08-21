import test from 'node:test';
import assert from 'node:assert/strict';

import { fundingIntervalHoursBetween } from '../js/funding-catalog.js';

test('derives 4-hour funding intervals from exchange timestamps', () => {
  assert.equal(fundingIntervalHoursBetween(1_000, 1_000 + 4 * 3_600_000), 4);
});

test('derives 1-hour funding intervals from exchange timestamps', () => {
  assert.equal(fundingIntervalHoursBetween(1_000, 1_000 + 3_600_000), 1);
});

test('uses the provided fallback for invalid timestamps', () => {
  assert.equal(fundingIntervalHoursBetween(null, null, 8), 8);
  assert.equal(fundingIntervalHoursBetween(2_000, 1_000, 4), 4);
});
