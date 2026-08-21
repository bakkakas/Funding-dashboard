import {
  ASTER_PREMIUM_INDEX_URL,
  BINANCE_PREMIUM_INDEX_URL,
  BYBIT_TICKERS_URL,
  HYPERLIQUID_INFO_URL,
  LIVE_REFRESH_MS,
  OKX_FUNDING_RATE_URL,
  OKX_INDEX_TICKER_URL,
  OKX_MARK_PRICE_URL,
  ORBS_PERPS_AGGREGATED_FUNDING_URL,
  ORBS_PERPS_PREMIUM_INDEX_URL,
  VARIATIONAL_STATS_URL,
} from './config.js';
import { orbsPerpsFundingCache, state, variationalStatsCache } from './state.js';
import { fundingIntervalHoursBetween } from './funding-catalog.js?v=3';

function applyFundingInterval(pair, latest, hours){
  const interval=Number(hours);
  if(!Number.isFinite(interval) || interval <= 0) return latest;
  pair.fundingIntervalHours=interval;
  pair.fundingPeriodsPerDay=24 / interval;
  latest.fundingIntervalHours=interval;
  return latest;
}

async function getVariationalListings(){
  const now = Date.now();
  if(variationalStatsCache.promise && now - variationalStatsCache.time < LIVE_REFRESH_MS){
    return variationalStatsCache.promise;
  }
  variationalStatsCache.time = now;
  variationalStatsCache.promise = fetch(VARIATIONAL_STATS_URL).then(res=>{
    if(!res.ok) throw new Error('variational stats fetch failed');
    return res.json();
  }).then(json=>json.listings || []);
  return variationalStatsCache.promise;
}

async function getOrbsPerpsFundingData(){
  const now = Date.now();
  if(orbsPerpsFundingCache.promise && now - orbsPerpsFundingCache.time < LIVE_REFRESH_MS){
    return orbsPerpsFundingCache.promise;
  }
  orbsPerpsFundingCache.time = now;
  orbsPerpsFundingCache.promise = fetch(ORBS_PERPS_AGGREGATED_FUNDING_URL, { cache:'no-store' }).then(res=>{
    if(!res.ok) throw new Error('orbs perps aggregated funding fetch failed');
    return res.json();
  }).then(json=>json.PERPS_HUB || {});
  return orbsPerpsFundingCache.promise;
}

export async function fetchLiveLatest(pairKey, pair){
  if(pair.exchange === 'Binance'){
    const res = await fetch(`${BINANCE_PREMIUM_INDEX_URL}?symbol=${pair.symbol}`);
    if(!res.ok) throw new Error(`premiumIndex fetch failed: ${pairKey}`);
    const row = await res.json();
    state.liveLatestByPair[pairKey] = applyFundingInterval(pair, {
      markPrice: Number(row.markPrice),
      indexPrice: Number(row.indexPrice),
      lastFundingRate: Number(row.lastFundingRate),
      nextFundingTime: Number(row.nextFundingTime),
      time: Number(row.time),
      available: true,
    }, pair.fundingIntervalHours || 8);
    return;
  }
  if(pair.exchange === 'Bybit'){
    const res = await fetch(`${BYBIT_TICKERS_URL}?category=linear&symbol=${pair.symbol}`);
    if(!res.ok) throw new Error(`bybit ticker fetch failed: ${pairKey}`);
    const json = await res.json();
    const row = json.result.list[0];
    state.liveLatestByPair[pairKey] = applyFundingInterval(pair, {
      markPrice: Number(row.markPrice),
      indexPrice: Number(row.indexPrice),
      lastFundingRate: Number(row.fundingRate),
      nextFundingTime: Number(row.nextFundingTime),
      time: Number(json.time),
      available: true,
    }, pair.fundingIntervalHours || 8);
    return;
  }
  if(pair.exchange === 'Hyperliquid'){
    const payload = { type: 'metaAndAssetCtxs' };
    if(pair.dex) payload.dex = pair.dex;
    const res = await fetch(HYPERLIQUID_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if(!res.ok) throw new Error(`hyperliquid info fetch failed: ${pairKey}`);
    const [meta, ctxs] = await res.json();
    const idx = meta.universe.findIndex(asset => asset.name === pair.symbol);
    if(idx < 0) throw new Error(`hyperliquid asset not found: ${pair.symbol}`);
    const row = ctxs[idx];
    const now = Date.now();
    state.liveLatestByPair[pairKey] = applyFundingInterval(pair, {
      markPrice: Number(row.markPx),
      indexPrice: Number(row.oraclePx),
      lastFundingRate: Number(row.funding),
      premium: Number(row.premium),
      nextFundingTime: (Math.floor(now / 3600000) + 1) * 3600000,
      time: now,
      openInterest: Number(row.openInterest),
      dayNtlVlm: Number(row.dayNtlVlm),
      available: true,
    }, 1);
    return;
  }
  if(pair.exchange === 'Aster'){
    const res = await fetch(`${ASTER_PREMIUM_INDEX_URL}?symbol=${pair.symbol}`);
    if(!res.ok) throw new Error(`aster premiumIndex fetch failed: ${pairKey}`);
    const row = await res.json();
    state.liveLatestByPair[pairKey] = applyFundingInterval(pair, {
      markPrice: Number(row.markPrice),
      indexPrice: Number(row.indexPrice),
      lastFundingRate: Number(row.lastFundingRate),
      nextFundingTime: Number(row.nextFundingTime),
      time: Number(row.time) || Date.now(),
      available: true,
    }, pair.fundingIntervalHours || 8);
    return;
  }
  if(pair.exchange === 'OKX'){
    const [fundingRes, markRes, indexRes] = await Promise.all([
      fetch(`${OKX_FUNDING_RATE_URL}?instId=${encodeURIComponent(pair.symbol)}`),
      fetch(`${OKX_MARK_PRICE_URL}?instType=SWAP&instId=${encodeURIComponent(pair.symbol)}`),
      fetch(`${OKX_INDEX_TICKER_URL}?instId=${encodeURIComponent(pair.symbol.replace('-SWAP',''))}`),
    ]);
    if(!fundingRes.ok || !markRes.ok || !indexRes.ok) throw new Error(`okx funding fetch failed: ${pairKey}`);
    const fundingJson = await fundingRes.json();
    const markJson = await markRes.json();
    const indexJson = await indexRes.json();
    const funding = fundingJson.data && fundingJson.data[0] ? fundingJson.data[0] : {};
    const mark = markJson.data && markJson.data[0] ? markJson.data[0] : {};
    const index = indexJson.data && indexJson.data[0] ? indexJson.data[0] : {};
    const fundingTime=Number(funding.fundingTime);
    const nextFundingTime=Number(funding.nextFundingTime || funding.nextFundingTimeMs);
    const intervalHours=fundingIntervalHoursBetween(fundingTime, nextFundingTime, pair.fundingIntervalHours || 8);
    state.liveLatestByPair[pairKey] = applyFundingInterval(pair, {
      markPrice: Number(mark.markPx || funding.markPx),
      indexPrice: Number(index.idxPx),
      lastFundingRate: Number(funding.fundingRate),
      nextFundingTime,
      time: Number(funding.ts) || Date.now(),
      available: true,
    }, intervalHours);
    return;
  }
  if(pair.exchange === 'Variational'){
    const listings = await getVariationalListings();
    const row = listings.find(item => String(item.ticker).toUpperCase() === pair.displaySymbol.toUpperCase());
    if(!row) throw new Error(`variational listing not found: ${pair.displaySymbol}`);
    const intervalHours = Number(row.funding_interval_s || 28800) / 3600;
    const paymentsPerYear = (24 / intervalHours) * 365;
    const updatedAt = row.quotes && row.quotes.updated_at ? Date.parse(row.quotes.updated_at) : Date.now();
    state.liveLatestByPair[pairKey] = {
      markPrice: Number(row.mark_price),
      indexPrice: Number(row.mark_price),
      lastFundingRate: Number(row.funding_rate) / paymentsPerYear,
      nextFundingTime: updatedAt + intervalHours * 3600000,
      fundingIntervalHours: intervalHours,
      time: updatedAt,
      available: true,
    };
    return;
  }
  if(pair.exchange === 'Orbs Perps Hub'){
    const [res, aggregated] = await Promise.all([
      fetch(`${ORBS_PERPS_PREMIUM_INDEX_URL}?symbol=${pair.symbol}`),
      getOrbsPerpsFundingData(),
    ]);
    if(!res.ok) throw new Error(`orbs perps premiumIndex fetch failed: ${pairKey}`);
    const row = await res.json();
    const funding = aggregated[pair.symbol] || {};
    state.liveLatestByPair[pairKey] = {
      markPrice: Number(row.markPrice),
      indexPrice: Number(row.indexPrice),
      rawFundingRate: Number(row.lastFundingRate),
      lastFundingRate: Number(row.lastFundingRate),
      longFundingFee: Number(row.lastFundingRate),
      shortFundingFee: Number(row.lastFundingRate),
      nextFundingTime: Number(funding.next_funding_time || row.nextFundingTime),
      time: Number(row.time) || Date.now(),
      available: true,
    };
    return;
  }
  throw new Error(`Unsupported exchange: ${pair.exchange}`);
}

export async function loadDashboardData(){
  const res = await fetch(`./funding_data.json?ts=${Date.now()}`, { cache: 'no-store' });
  return res.json();
}
