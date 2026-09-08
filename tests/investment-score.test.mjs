import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyDecisionScenario,
  evaluateInvestmentDecision as evaluate,
  percentChange,
  seriesChange,
} from '../js/investment-score.js';
const profile=JSON.parse(readFileSync(new URL('../data/research/profiles.json',import.meta.url)))['ethfi-beta-v1'];
const evaluateInvestmentDecision=input=>evaluate(input,profile);

const healthyInput = {
  tvl30dChange: 12,
  holderRevenue30d: 1_000_000,
  nextUnlockToCirculatingPct: 0.9,
  marketCap: 500_000_000,
  protocolRevenue30d: 5_000_000,
  securityIncident: false,
};

test('calculates percent and nearest-series changes', () => {
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(1, 0), null);
  const latest = 2_000_000;
  assert.equal(seriesChange([
    { date: latest - 31 * 86_400, totalLiquidityUSD: 100 },
    { date: latest, totalLiquidityUSD: 125 },
  ], 30), 25);
});

test('scores complete healthy data as priority', () => {
  const result = evaluateInvestmentDecision(healthyInput);
  assert.equal(result.coverage, 100);
  assert.equal(result.score, 100);
  assert.equal(result.signal, 'priority');
  assert.equal(result.invalidated, false);
});

test('does not treat missing risk data as neutral', () => {
  const result = evaluateInvestmentDecision({ ...healthyInput, securityIncident: null });
  assert.equal(result.coverage, 85);
  assert.equal(result.categories.find(item => item.key === 'securityGovernance').assessed, false);
});

test('warning scenario lowers rules without mutating input', () => {
  const input = { ...healthyInput };
  const scenario = applyDecisionScenario(input, 'warning');
  const result = evaluateInvestmentDecision(scenario);
  assert.equal(input.tvl30dChange, 12);
  assert.equal(result.simulated, true);
  assert.equal(result.rules.find(rule => rule.key === 'growth').status, 'danger');
  assert.equal(result.rules.find(rule => rule.key === 'unlockPressure').status, 'danger');
});

test('critical invalidation overrides the numeric score', () => {
  const result = evaluateInvestmentDecision(applyDecisionScenario(healthyInput, 'invalidated'));
  assert.equal(result.invalidated, true);
  assert.equal(result.signal, 'invalidated');
  assert.equal(result.rules.find(rule => rule.key === 'criticalRisk').status, 'invalidated');
});
