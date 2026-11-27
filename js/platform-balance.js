// A manual platform balance replaces holdings; persisted detail rows stay untouched.
export const balanceName = a => String(a.nickname || '').trim();
export function validBalance(b) {
  return b && typeof b.enabled === 'boolean' && typeof b.amount === 'number' && Number.isFinite(b.amount) && b.amount >= 0 && b.amount <= 1e15 && ['KRW','USD'].includes(b.currency) && ['stock','crypto','commodity','cash'].includes(b.asset_class) && typeof b.excluded_from_total === 'boolean';
}
export function activeBalances(assets, balances = {}) {
  const names = new Set(assets.map(balanceName));
  return Object.entries(balances).filter(([name,b]) => names.has(name) && b?.enabled === true).map(([name,b]) => {
    if (!validBalance(b)) throw Error('수동 잔액 설정이 올바르지 않습니다.');
    return [name,b];
  });
}
export function effectivePortfolio({assets=[],cryptoEntries=[],platformBalances={}}={}) {
  const active = activeBalances(assets, platformBalances), names = new Set(active.map(([name])=>name));
  return {
    assets: [...assets.filter(a=>!names.has(balanceName(a))), ...active.map(([name,b])=>({
      id:`platform-balance:${name}`, nickname:name, manual_platform:true,
      // Cash storage avoids the legacy crypto-source switch removing this replacement.
      asset_class:'cash', allocation_class:b.asset_class, currency:b.currency,
      cash_amount_krw:b.currency==='KRW'?b.amount:0,cash_amount_usd:b.currency==='USD'?b.amount:0,
      excluded_from_total:b.excluded_from_total,
    }))],
    cryptoEntries:cryptoEntries.filter(e=>!names.has(String(e.location||'').trim())),
  };
}
