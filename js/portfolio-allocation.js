export const ASSET_CLASSES = ['stock', 'crypto', 'commodity', 'cash'];
export function allocationClass(asset) {
  return ASSET_CLASSES.includes(asset.allocation_class) ? asset.allocation_class : asset.asset_class;
}
// Allocation is presentation only: never alter quotes, quantities or total-source selection.
export function calculateAllocation({assets = [], cryptoEntries = [], cryptoTotalSource = 'assets', assetValue = () => 0, cryptoValue = () => 0, fx = 1} = {}) {
  const groups = Object.fromEntries(ASSET_CLASSES.map(key => [key, 0]));
  let stable = 0;
  const add = (key, value, stableValue = 0) => {
    if (!ASSET_CLASSES.includes(key)) return;
    const amount = Math.max(0, Number(value) || 0);
    const cashPart = Math.min(amount, Math.max(0, Number(stableValue) || 0));
    groups[key] += amount - cashPart;
    groups.cash += cashPart;
    stable += cashPart;
  };
  for (const asset of assets) {
    if (cryptoTotalSource === 'details' && asset.asset_class === 'crypto') continue;
    add(allocationClass(asset), assetValue(asset), (Number(asset.stable_amount_krw) || 0) * (asset.stable_currency === 'USD' ? fx : 1));
  }
  if (cryptoTotalSource === 'details') {
    // Only explicitly recognised stablecoin identities; do not infer from a ticker alone.
    const stableQuotes = new Set(['FIXED:USD', 'CG:tether', 'CG:usd-coin', 'CG:ethena-usde', 'CG:dai']);
    for (const entry of cryptoEntries) {
      const value = cryptoValue(entry);
      add('crypto', value, stableQuotes.has(entry.quote_symbol) ? value : 0);
    }
  }
  return {groups, stable};
}
