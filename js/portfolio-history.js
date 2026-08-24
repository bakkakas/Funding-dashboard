export function formatPortfolioKrw(value, language = 'ko') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(amount);
}
