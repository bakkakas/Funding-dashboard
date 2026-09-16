import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, normalizeUsdeHistory, summarizeUsde, USDE_HISTORY_URL } from '../js/usde-market-cap.js';

const now = Date.UTC(2026, 8, 16);
const row = (days, cap, supply = 999999) => ({date: (now - days * DAY) / 1000, totalCirculatingUSD: {peggedUSD: cap}, totalCirculating: {peggedUSD: supply}});

test('USDe uses the dedicated all-chain USD market cap, never supply, ENA or TVL', () => {
  assert.match(USDE_HISTORY_URL, /all\?stablecoin=146$/);
  const history = normalizeUsdeHistory([row(0, 120), row(365, 50), row(30, 150), row(7, 100), row(1, 110)], now);
  const result = summarizeUsde(history, now);
  assert.equal(result.latest.cap, 120);
  assert.equal(result.stale, false);
  assert.deepEqual(result.changes.map(r => r.amount), [10, 20, -30, 70]);
  assert.ok(Math.abs(result.changes[0].percent - 100 / 11) < 1e-9);
  assert.ok(Math.abs(result.changes[2].percent + 20) < 1e-9);
  assert.equal(result.changes[3].percent, 140);
});

test('missing exact days and insufficient one-year history remain unavailable', () => {
  const result = summarizeUsde(normalizeUsdeHistory([row(0, 120), row(2, 100), row(364, 50)], now), now);
  assert.ok(result.changes.every(r => r.amount === null && r.percent === null));
});

test('zero baseline does not produce infinite percentage; zero current cap is valid', () => {
  const result = summarizeUsde(normalizeUsdeHistory([row(0, 0), row(1, 100), row(7, 0)], now), now);
  assert.equal(result.changes[0].percent, -100);
  assert.equal(result.changes[1].amount, 0);
  assert.equal(result.changes[1].percent, null);
});

test('invalid, missing USD valuations and future rows are excluded, duplicate dates sorted', () => {
  const input = [row(0, null), row(1, 10), row(1, 11), row(2, -1), row(-1, 12), row(3, ''), row(4, Infinity), null, {date: now / 1000, totalCirculating: {peggedUSD: 90}}];
  assert.deepEqual(normalizeUsdeHistory(input, now), [{time: now - DAY, cap: 11}]);
  assert.throws(() => normalizeUsdeHistory({}));
});

test('stale and empty data are explicit, changes anchored to observation not wall clock', () => {
  const history = normalizeUsdeHistory([row(4, 100), row(5, 80)], now);
  const result = summarizeUsde(history, now);
  assert.equal(result.stale, true);
  assert.equal(result.changes[0].percent, 25);
  assert.equal(summarizeUsde([], now).latest, null);
  assert.equal(summarizeUsde([], now).stale, true);
});
