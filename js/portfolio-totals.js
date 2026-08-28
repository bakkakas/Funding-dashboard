export function calculatePortfolioTotals({
  assets = [],
  cryptoEntries = [],
  cryptoTotalSource = 'assets',
  assetValue = () => 0,
  cryptoValue = () => 0,
} = {}) {
  const includedAssets = assets.filter(asset => !asset.excluded_from_total);
  const nonCryptoTotal = includedAssets
    .filter(asset => asset.asset_class !== 'crypto')
    .reduce((sum, asset) => sum + Number(assetValue(asset) || 0), 0);
  const assetCryptoTotal = includedAssets
    .filter(asset => asset.asset_class === 'crypto')
    .reduce((sum, asset) => sum + Number(assetValue(asset) || 0), 0);
  const detailCryptoTotal = cryptoEntries
    .reduce((sum, entry) => sum + Number(cryptoValue(entry) || 0), 0);
  const useDetails = cryptoTotalSource === 'details';
  const cryptoTotal = useDetails ? detailCryptoTotal : assetCryptoTotal;

  return {
    total: nonCryptoTotal + cryptoTotal,
    nonCryptoTotal,
    assetCryptoTotal,
    detailCryptoTotal,
    cryptoTotal,
    source: useDetails ? 'details' : 'assets',
  };
}
