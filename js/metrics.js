import { COMPARISON_INTERVAL_HOURS } from './config.js';

export function fundingFeeValue(latest){
  if(latest.rawFundingRate != null) return Number(latest.rawFundingRate);
  return latest.lastFundingRate == null ? null : Number(latest.lastFundingRate);
}

export function feeTone(value){
  if(value == null || Number.isNaN(value)) return 'warn';
  return value >= 0 ? 'good' : 'bad';
}

export function feeDirection(value){
  if(value == null || Number.isNaN(value)) return '-';
  return value >= 0 ? 'Long -> Short' : 'Short -> Long';
}

export function intervalHoursFor(pair, latest={}){
  if(latest.fundingIntervalHours) return Number(latest.fundingIntervalHours);
  if(pair.fundingIntervalHours) return Number(pair.fundingIntervalHours);
  return pair.exchange === 'Hyperliquid' ? 1 : 8;
}

export function fmtIntervalHours(hours){
  const value = Number(hours);
  if(!Number.isFinite(value)) return '-';
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/,'')}H`;
}

export function annualizedFromFee(pair, fee, latest={}){
  if(fee == null || Number.isNaN(fee)) return null;
  return fee * (24 / intervalHoursFor(pair, latest)) * 365 * 100;
}

export function comparableFeeFromAnnualized(annualizedPct){
  const value=Number(annualizedPct);
  if(!Number.isFinite(value)) return null;
  return value / 100 / (24 / COMPARISON_INTERVAL_HOURS * 365);
}

export function periodFundingFee(summary){
  if(!summary || summary.avgFundingRate == null || Number.isNaN(summary.avgFundingRate)) return null;
  return Number(summary.avgFundingRate);
}

export function comparisonAnnualized(pair, latest, selectedWindow){
  const fee = fundingFeeValue(latest);
  const annualized = annualizedFromFee(pair, fee, latest);
  if(annualized != null && !Number.isNaN(annualized)) return annualized;
  const summary = pair.windows && pair.windows[selectedWindow];
  return summary ? summary.annualizedPct : null;
}

export function metricEntryToComparisonItem({ entry, data, getLatestForPair }){
  const pair=data.pairs[entry.pairKey];
  if(!pair) return null;
  return {
    pairKey:entry.pairKey,
    pair,
    latest:getLatestForPair(entry.pairKey, pair),
    fee:entry.longFundingFee8h,
    shortFee:entry.shortFundingFee8h,
    rawFee:entry.rawLongFundingFee,
    rawShortFee:entry.rawShortFundingFee,
    annualized:entry.annualizedPct,
    shortAnnualized:entry.shortAnnualizedPct,
    reliabilityStatus:entry.reliabilityStatus,
  };
}

export function serverAssetMetrics(data, asset){
  return data && data.assetMetrics ? data.assetMetrics[asset] : null;
}

export function serverPeriodComparisonStats({ data, asset, windowKey, getLatestForPair }){
  const metrics=serverAssetMetrics(data, asset);
  const entries=metrics && metrics.windows && metrics.windows[windowKey] ? metrics.windows[windowKey].exchanges : null;
  if(!entries || !entries.length) return null;
  return entries.map(entry=>metricEntryToComparisonItem({ entry, data, getLatestForPair })).filter(Boolean);
}

export function serverCurrentComparisonStats({ data, asset, getLatestForPair }){
  const metrics=serverAssetMetrics(data, asset);
  const entries=metrics && metrics.current ? metrics.current.exchanges : null;
  if(!entries || !entries.length) return null;
  return entries.map(entry=>metricEntryToComparisonItem({ entry, data, getLatestForPair })).filter(Boolean);
}

export function currentComparisonStats({ data, selectedPair, selectedAsset, selectedWindow, liveLatestByPair, getPairsForAsset, getLatestForPair }){
  const hasLiveForAsset=getPairsForAsset(selectedAsset).some(([pairKey])=>liveLatestByPair[pairKey]);
  const serverStats=hasLiveForAsset ? null : serverCurrentComparisonStats({ data, asset:selectedAsset, getLatestForPair });
  if(serverStats) return serverStats;
  return getPairsForAsset(selectedAsset).map(([pairKey, pair])=>{
    const latest=getLatestForPair(pairKey, pair);
    const rawFee=fundingFeeValue(latest);
    const annualized=comparisonAnnualized(pair, latest, selectedWindow);
    const fee=comparableFeeFromAnnualized(annualized);
    return {
      pairKey,
      pair,
      latest,
      fee,
      shortFee:fee,
      rawFee,
      rawShortFee:rawFee,
      annualized,
      shortAnnualized:annualized,
    };
  }).filter(item=>item.fee != null && !Number.isNaN(item.fee));
}

export function periodComparisonStats({ data, selectedPair, selectedAsset, windowKey, getPairsForAsset, getLatestForPair }){
  const serverStats=serverPeriodComparisonStats({ data, asset:selectedAsset, windowKey, getLatestForPair });
  if(serverStats) return serverStats;
  return getPairsForAsset(selectedAsset).map(([pairKey, pair])=>{
    const summary=pair.windows && pair.windows[windowKey];
    if(!summary || !summary.count) return null;
    const longAnnualized=summary.annualizedPct;
    const longFee=comparableFeeFromAnnualized(longAnnualized);
    if(longFee == null || Number.isNaN(longFee)) return null;
    const rawFee=periodFundingFee(summary);
    return {
      pairKey,
      pair,
      fee:longFee,
      shortFee:longFee,
      rawFee,
      rawShortFee:rawFee,
      annualized:longAnnualized,
      shortAnnualized:longAnnualized,
      count:summary.count || 0,
    };
  }).filter(Boolean);
}
