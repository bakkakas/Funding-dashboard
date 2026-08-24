import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPortfolioKrw } from '../js/portfolio-history.js';

test('formats portfolio history values as exact KRW amounts', () => {
  assert.equal(formatPortfolioKrw(123456789, 'ko'), '₩123,456,789');
});

test('returns a placeholder for invalid history values', () => {
  assert.equal(formatPortfolioKrw(undefined, 'ko'), '-');
});
