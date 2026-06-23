import { fmtNumber } from '../formatters.js';
import { t } from '../i18n.js';
import { state } from '../state.js';

function currentPricePairForAsset(selected, deps){
  const pairs=deps.getPairsForAsset(deps.assetId(selected));
  return pairs.find(([_, pair])=>pair.exchange === 'Binance')
    || pairs.find(([_, pair])=>pair.exchange === 'Orbs Perps Hub')
    || pairs[0];
}

export function renderAssetSummary(selected, deps){
  const pricePair=currentPricePairForAsset(selected, deps);
  const [pricePairKey, pairForPrice]=pricePair || [state.selectedPair, selected];
  const latest=deps.getLatestForPair(pricePairKey, pairForPrice);
  const symbol=deps.assetId(selected);
  const logo=document.getElementById('assetLogo');
  const logoUrl=deps.assetLogoUrl(symbol);
  deps.setLogoImage(logo, logoUrl, deps.assetLogoFallbackUrl(symbol));
  document.getElementById('assetLogoMark').textContent=symbol.slice(0,2).toUpperCase();
  document.getElementById('assetHeaderSymbol').textContent=deps.displaySymbol(selected);
  document.getElementById('assetHeaderName').textContent=deps.assetName(selected);
  document.getElementById('assetHeaderPrice').textContent=latest.markPrice == null ? '-' : fmtNumber(latest.markPrice);
  document.getElementById('assetHeaderPriceMeta').textContent=latest.markPrice == null
    ? '-'
    : `${pairForPrice.exchange} ${t('mark')}`;
}
