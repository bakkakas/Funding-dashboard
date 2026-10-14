export function formatPortfolioKrw(value, language = 'ko') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatPortfolioAxisKrw(value, language = 'ko') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR', {
    style: 'currency',
    currency: 'KRW',
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(amount);
}

export function buildMonthlyPortfolioHistory(snapshots = []) {
  const rows = snapshots
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.snapshot_date)) && Number.isFinite(Number(row?.total_value_krw)))
    .sort((left, right) => left.snapshot_date.localeCompare(right.snapshot_date));
  const months = new Map();

  rows.forEach(row => {
    const month = row.snapshot_date.slice(0, 7);
    const normalized = {...row, total_value_krw: Number(row.total_value_krw)};
    if (!months.has(month)) months.set(month, {month, first: normalized, last: normalized, observations: 1});
    else {
      const entry = months.get(month);
      entry.last = normalized;
      entry.observations += 1;
    }
  });

  return [...months.values()].map(entry => {
    const startValue = entry.first.total_value_krw;
    const endValue = entry.last.total_value_krw;
    const changeValue = endValue - startValue;
    return {
      month: entry.month,
      startDate: entry.first.snapshot_date,
      endDate: entry.last.snapshot_date,
      startValue,
      endValue,
      changeValue,
      changeRate: startValue === 0 ? null : changeValue / startValue * 100,
      observations: entry.observations
    };
  });
}
