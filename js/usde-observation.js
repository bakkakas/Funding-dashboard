export const USDE_CURRENT_URL = 'https://api.coingecko.com/api/v3/coins/ethena-usde?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false';
export const BUYBACK_MILESTONES = [
  { supply: 7.5e9, rate: 5 }, { supply: 10e9, rate: 10 },
  { supply: 15e9, rate: 15 }, { supply: 20e9, rate: 20 }, { supply: 25e9, rate: 25 },
];
export const CAP_MILESTONES = [5e9, 6e9, 7e9, 7.5e9];
export const BUYBACK_SOURCE = 'https://gov.ethenafoundation.com/t/ena-fee-switch-activation/830';

export function normalizeUsdeObservation(data, now = Date.now()) {
  if (data?.id !== 'ethena-usde') throw new Error('Unexpected asset; expected USDe');
  const cap = data.market_data?.market_cap?.usd;
  const supply = data.market_data?.circulating_supply;
  const price = data.market_data?.current_price?.usd;
  const observedAt = Date.parse(data.last_updated);
  if (![cap, supply, price].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) throw new Error('Missing USDe market data');
  if (!Number.isFinite(observedAt) || now - observedAt > 3600000 || observedAt > now + 300000) throw new Error('USDe source is stale or future-dated');
  return { cap, supply, price, observedAt, fetchedAt: now, source: 'CoinGecko' };
}

export async function fetchUsdeObservation({ signal, fetchImpl = fetch, now } = {}) {
  const timeout = AbortSignal.timeout(12000);
  const response = await fetchImpl(USDE_CURRENT_URL, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`USDe source HTTP ${response.status}`);
  return normalizeUsdeObservation(await response.json(), now ?? Date.now());
}

export function milestoneProgress(value, thresholds) {
  const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
  return thresholds.map(threshold => ({ threshold, reached: valid && value >= threshold,
    remaining: valid ? Math.max(0, threshold - value) : null,
    percent: valid ? Math.min(100, value / threshold * 100) : null }));
}
