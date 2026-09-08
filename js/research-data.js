export const numberOrNull = value => value === null || value === undefined || value === '' || typeof value === 'boolean'
  ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export const localize = (value, language = 'ko') => typeof value === 'string' ? value : value?.[language] ?? value?.ko ?? value?.en ?? '';
export const decisionStorageKey = id => `fundingInvestmentDecision.${id}.v1`;
export const safeUrl = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
export function validateCatalog(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.assets) || !data.assets.length) throw new Error('Invalid research catalog');
  const ids = new Set();
  for (const asset of data.assets) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(asset.id) || ids.has(asset.id) || !asset.name || !asset.symbol) throw new Error('Invalid or duplicate asset');
    ids.add(asset.id);
  }
  return data.assets;
}
export function validateAsset(data, id) {
  if (data?.schemaVersion !== 1 || data.id !== id || !data.name || !data.symbol) throw new Error('Invalid asset identity');
  const unlock = data.unlock ?? { status: 'unknown' };
  if (!['unknown','scheduled','complete'].includes(unlock.status)) throw new Error('Invalid unlock status');
  const events = [...(unlock.events ?? [])];
  if (unlock.status !== 'scheduled' && events.length) throw new Error('Only scheduled unlocks may contain future events');
  const dates = new Set();
  for (const event of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !Number.isFinite(Date.parse(event.date)) || new Date(event.date).toISOString().slice(0,10) !== event.date || numberOrNull(event.amount) === null || event.amount < 0 || dates.has(event.date)) throw new Error('Invalid unlock event');
    dates.add(event.date);
  }
  return {...data,market:data.market ?? {},metrics:data.metrics ?? {},copy:data.copy ?? {},links:data.links ?? [],drivers:data.drivers ?? [],news:data.news ?? [],ruleSources:data.ruleSources ?? {},unlock:{...unlock,events:events.sort((a,b)=>a.date.localeCompare(b.date)),sources:unlock.sources ?? []}};
}
export function selectAssetId(catalog, requested) {
  return catalog.find(asset => asset.id === requested)?.id ?? catalog[0]?.id ?? null;
}
export function unlockSummary(asset, today) {
  const upcoming = asset.unlock.events.filter(event => event.date >= today);
  const next = upcoming[0] ?? null;
  const completed = asset.unlock.status === 'complete';
  const known = completed || (asset.unlock.status === 'scheduled' && Boolean(next));
  return {upcoming,next,known,completed,remaining:known?upcoming.reduce((sum,event)=>sum+Number(event.amount),0):null};
}
export function resolveProfile(asset, profiles) {
  const profile = profiles[asset.evaluation?.profile];
  return profile && profile.category === asset.category && (!profile.assetIds || profile.assetIds.includes(asset.id)) ? profile : null;
}
export async function fetchJson(url, {signal, fetchImpl=fetch} = {}) {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetchImpl(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export async function loadProtocolMetrics(asset, {signal,fetchImpl=fetch} = {}) {
  if (!asset.metrics.defillamaSlug) return {metrics:null,partial:false};
  const slug=encodeURIComponent(asset.metrics.defillamaSlug);
  const base='https://api.llama.fi';
  const results=await Promise.allSettled([
    fetchJson(`${base}/protocol/${slug}`,{signal,fetchImpl}),
    ...['dailyFees','dailyRevenue','dailyHoldersRevenue'].map(type=>fetchJson(`${base}/summary/fees/${slug}?dataType=${type}`,{signal,fetchImpl})),
  ]);
  const value=index=>results[index].status==='fulfilled'?results[index].value:null;
  const rows=(Array.isArray(value(0)?.tvl)?value(0).tvl:[]).filter(row=>numberOrNull(row.date)!==null && numberOrNull(row.totalLiquidityUSD)!==null).sort((a,b)=>a.date-b.date);
  const fresh=rows.length && Date.now()/1000-rows.at(-1).date <= 3*86400;
  return {partial:results.some(result=>result.status==='rejected') || !fresh,metrics:{tvlRows:fresh?rows:[],fees30d:numberOrNull(value(1)?.total30d),protocolRevenue30d:numberOrNull(value(2)?.total30d),holderRevenue30d:numberOrNull(value(3)?.total30d)}};
}
