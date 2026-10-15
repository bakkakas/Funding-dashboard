const amount = value => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

export function cashBalances(asset = {}) {
  const hasSplitBalances = Object.prototype.hasOwnProperty.call(asset, 'cash_amount_krw')
    || Object.prototype.hasOwnProperty.call(asset, 'cash_amount_usd');

  if (hasSplitBalances) {
    return {
      krw: amount(asset.cash_amount_krw),
      usd: amount(asset.cash_amount_usd),
    };
  }

  const legacy = amount(asset.quantity);
  return asset.currency === 'USD'
    ? { krw: 0, usd: legacy }
    : { krw: legacy, usd: 0 };
}

export function cashValueKrw(asset, usdKrw) {
  const balances = cashBalances(asset);
  const rate = amount(usdKrw);
  return balances.krw + balances.usd * rate;
}

export function formatCashBalances(asset, locale = 'ko-KR') {
  const balances = cashBalances(asset);
  const krw = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(balances.krw);
  const usd = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(balances.usd);
  return { krw: `₩${krw}`, usd: `$${usd}` };
}
