import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyPortfolioHistory,
  formatPortfolioAxisKrw,
  formatPortfolioKrw
} from '../js/portfolio-history.js';

test('formats portfolio history values as exact KRW amounts', () => {
  assert.equal(formatPortfolioKrw(123456789, 'ko'), '₩123,456,789');
});

test('returns a placeholder for invalid history values', () => {
  assert.equal(formatPortfolioKrw(undefined, 'ko'), '-');
});

test('formats chart axes with compact but precise KRW values', () => {
  assert.match(formatPortfolioAxisKrw(763535766, 'ko'), /^₩7\.64억$/);
  assert.match(formatPortfolioAxisKrw(693099138, 'en'), /^₩693\.1M$/);
});

test('builds monthly portfolio rows from each month first and last snapshot', () => {
  const rows = buildMonthlyPortfolioHistory([
    {snapshot_date: '2026-09-19', total_value_krw: '748656230.89'},
    {snapshot_date: '2026-08-28', total_value_krw: 739357776.61},
    {snapshot_date: '2026-09-01', total_value_krw: 730638956.19},
    {snapshot_date: '2026-08-21', total_value_krw: 763535766.37},
    {snapshot_date: '2026-10-14', total_value_krw: 693099138.22}
  ]);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    month: '2026-08',
    startDate: '2026-08-21',
    endDate: '2026-08-28',
    startValue: 763535766.37,
    endValue: 739357776.61,
    changeValue: -24177989.75999999,
    changeRate: -24177989.75999999 / 763535766.37 * 100,
    observations: 2
  });
  assert.equal(rows[1].startDate, '2026-09-01');
  assert.equal(rows[1].endDate, '2026-09-19');
  assert.equal(rows[2].observations, 1);
  assert.equal(rows[2].changeValue, 0);
});

test('skips malformed snapshots and does not invent a rate from zero', () => {
  const rows = buildMonthlyPortfolioHistory([
    {snapshot_date: 'bad', total_value_krw: 10},
    {snapshot_date: '2026-08-01', total_value_krw: 0},
    {snapshot_date: '2026-08-31', total_value_krw: 100}
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].changeRate, null);
});
