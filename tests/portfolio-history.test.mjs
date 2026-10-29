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
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    inProgress: false,
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

 test('calendar month boundaries do not manufacture missing boundary valuations', () => {
 const rows=buildMonthlyPortfolioHistory([{snapshot_date:'2026-09-07',total_value_krw:100},{snapshot_date:'2026-09-19',total_value_krw:120},{snapshot_date:'2026-10-29',total_value_krw:140}],new Date('2026-10-28T15:00:00Z'));
 assert.equal(rows[0].periodStart,'2026-09-01');assert.equal(rows[0].periodEnd,'2026-09-30');
 assert.equal(rows[0].startDate,'2026-09-07');assert.equal(rows[0].endDate,'2026-09-19');assert.equal(rows[0].changeValue,20);
 assert.equal(rows[1].inProgress,true);assert.equal(rows[1].periodEnd,'2026-10-31');
 const leap=buildMonthlyPortfolioHistory([{snapshot_date:'2024-02-15',total_value_krw:10}]);assert.equal(leap[0].periodEnd,'2024-02-29');
 assert.deepEqual(buildMonthlyPortfolioHistory([{snapshot_date:'2026-02-30',total_value_krw:10},{snapshot_date:'2026-09-01',total_value_krw:null}]),[]);
 });
