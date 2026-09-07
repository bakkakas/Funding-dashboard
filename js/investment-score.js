const CATEGORY_WEIGHTS = Object.freeze({
  protocolGrowth: 25,
  tokenValueCapture: 25,
  supplyUnlock: 20,
  valuation: 15,
  securityGovernance: 15,
});

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

export function percentChange(current, previous) {
  const currentValue = finite(current);
  const previousValue = finite(previous);
  if (currentValue === null || previousValue === null || previousValue === 0) return null;
  return (currentValue - previousValue) / previousValue * 100;
}

export function seriesChange(rows, days) {
  const valid = (Array.isArray(rows) ? rows : [])
    .map(row => ({ date: finite(row?.date), value: finite(row?.totalLiquidityUSD) }))
    .filter(row => row.date !== null && row.value !== null)
    .sort((a, b) => a.date - b.date);
  if (valid.length < 2) return null;
  const latest = valid.at(-1);
  const target = latest.date - Number(days) * 86_400;
  const previous = valid.reduce((best, row) => Math.abs(row.date - target) < Math.abs(best.date - target) ? row : best, valid[0]);
  return percentChange(latest.value, previous.value);
}

function category(key, rawScore, value, note) {
  const weight = CATEGORY_WEIGHTS[key];
  const assessed = rawScore !== null;
  return {
    key,
    weight,
    rawScore,
    assessed,
    points: assessed ? weight * rawScore / 2 : null,
    value,
    note,
    tone: !assessed ? 'pending' : rawScore === 2 ? 'good' : rawScore === 1 ? 'watch' : 'bad',
  };
}

export function applyDecisionScenario(input, scenario = 'live') {
  const base = { ...input };
  if (scenario === 'warning') {
    return {
      ...base,
      tvl30dChange: -12.4,
      holderRevenue30d: 0,
      nextUnlockToCirculatingPct: 4.2,
      securityIncident: false,
      simulated: true,
    };
  }
  if (scenario === 'invalidated') {
    return {
      ...base,
      securityIncident: true,
      simulated: true,
    };
  }
  return { ...base, simulated: false };
}

export function evaluateInvestmentDecision(input = {}) {
  const tvl30dChange = finite(input.tvl30dChange);
  const holderRevenue30d = finite(input.holderRevenue30d);
  const nextUnlockToCirculatingPct = finite(input.nextUnlockToCirculatingPct);
  const marketCap = finite(input.marketCap);
  const protocolRevenue30d = finite(input.protocolRevenue30d);
  const securityIncident = typeof input.securityIncident === 'boolean' ? input.securityIncident : null;
  const revenueMultiple = marketCap !== null && protocolRevenue30d !== null && protocolRevenue30d > 0
    ? marketCap / (protocolRevenue30d * 12)
    : null;

  const categories = [
    category(
      'protocolGrowth',
      tvl30dChange === null ? null : tvl30dChange >= 0 ? 2 : tvl30dChange > -10 ? 1 : 0,
      tvl30dChange,
      'tvl30dChange',
    ),
    category(
      'tokenValueCapture',
      holderRevenue30d === null ? null : holderRevenue30d > 0 ? 2 : 0,
      holderRevenue30d,
      'holderRevenue30d',
    ),
    category(
      'supplyUnlock',
      nextUnlockToCirculatingPct === null ? null : nextUnlockToCirculatingPct <= 1 ? 2 : nextUnlockToCirculatingPct <= 3 ? 1 : 0,
      nextUnlockToCirculatingPct,
      'nextUnlockToCirculatingPct',
    ),
    category(
      'valuation',
      revenueMultiple === null ? null : revenueMultiple <= 10 ? 2 : revenueMultiple <= 20 ? 1 : 0,
      revenueMultiple,
      'marketCapToAnnualizedRevenue',
    ),
    category(
      'securityGovernance',
      securityIncident === null ? null : securityIncident ? 0 : 2,
      securityIncident,
      securityIncident === null ? 'manualReviewRequired' : 'securityIncident',
    ),
  ];

  const assessedWeight = categories.reduce((sum, item) => sum + (item.assessed ? item.weight : 0), 0);
  const earnedPoints = categories.reduce((sum, item) => sum + (item.points || 0), 0);
  const score = assessedWeight ? Math.round(earnedPoints / assessedWeight * 100) : null;
  const coverage = Math.round(assessedWeight);
  const invalidated = securityIncident === true;
  const signal = invalidated
    ? 'invalidated'
    : score === null ? 'pending'
    : score >= 75 && coverage >= 80 ? 'priority'
    : score >= 60 ? 'watch'
    : 'low';

  const rules = [
    {
      key: 'growth',
      status: tvl30dChange === null ? 'pending' : tvl30dChange <= -10 ? 'danger' : tvl30dChange < 0 ? 'watch' : 'pass',
      value: tvl30dChange,
      source: 'DefiLlama',
    },
    {
      key: 'valueCapture',
      status: holderRevenue30d === null ? 'pending' : holderRevenue30d > 0 ? 'pass' : 'watch',
      value: holderRevenue30d,
      source: 'DefiLlama',
    },
    {
      key: 'unlockPressure',
      status: nextUnlockToCirculatingPct === null ? 'pending' : nextUnlockToCirculatingPct > 3 ? 'danger' : nextUnlockToCirculatingPct > 1 ? 'watch' : 'pass',
      value: nextUnlockToCirculatingPct,
      source: 'Tokenomics.com · CoinGecko',
    },
    {
      key: 'criticalRisk',
      status: securityIncident === null ? 'pending' : securityIncident ? 'invalidated' : 'pass',
      value: securityIncident,
      source: 'Manual review',
    },
  ];

  return { categories, rules, score, coverage, signal, invalidated, simulated: Boolean(input.simulated) };
}

export { CATEGORY_WEIGHTS };
