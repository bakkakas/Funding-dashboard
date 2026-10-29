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

export function buildMonthlyPortfolioHistory(snapshots = [], now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const rows = snapshots
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.snapshot_date)) && row?.total_value_krw != null && row.total_value_krw !== '' && Number.isFinite(Number(row.total_value_krw)) && row.snapshot_date <= today && Number.isFinite(Date.parse(row.snapshot_date+'T00:00:00Z')) && new Date(row.snapshot_date+'T00:00:00Z').toISOString().slice(0,10) === row.snapshot_date)
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
      periodStart: entry.month+'-01',
      periodEnd: new Date(Date.UTC(Number(entry.month.slice(0,4)),Number(entry.month.slice(5,7)),0)).toISOString().slice(0,10),
      inProgress: entry.month === today.slice(0,7),
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
