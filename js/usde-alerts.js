// Self-contained so the same tested evaluator can be embedded in the scheduler.
// The scheduler owns durable state and delivery; this function has no side effects.
export function evaluateUsdeMilestones(observation, previous = {}, now = Date.now()) {
  const levels = [5, 6, 7, 7.5, 9, 10, 11, 13, 15, 17, 19, 20, 22, 24, 25].map(value => value * 1e9);
  const o = observation;
  if (!o || o.source !== 'CoinGecko' || ![o.cap, o.supply, o.observedAt].every(Number.isFinite) || o.cap <= 0 || o.supply <= 0 || now - o.observedAt > 3600000 || o.observedAt > now + 300000) throw new Error('Invalid or stale USDe observation; no alert state changed');
  if (previous.lastObservedAt && o.observedAt < previous.lastObservedAt) throw new Error('Regressed USDe source timestamp; no alert state changed');
  const seen = Array.isArray(previous.notified) ? previous.notified.filter(value => levels.includes(value)) : [];
  const initial = !previous.initialized;
  // Initial levels already exceeded are a baseline, not a new crossing.
  const crossed = levels.filter(level => o.cap >= level && !seen.includes(level));
  const state = { initialized: true, notified: [...new Set([...seen, ...crossed])], lastCap: o.cap,
    lastSupply: o.supply, lastObservedAt: o.observedAt, lastCheckedAt: now,
    completed: levels.every(level => seen.includes(level) || crossed.includes(level)) };
  if (initial || crossed.length === 0) return { state };
  const usd = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  const observed = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(o.observedAt);
  return { state, notify: `🔔 로디, USDe 시총 ${crossed.map(level => '$' + level / 1e9 + 'B').join(' · ')} 도달을 확인했어.\n현재 시총: ${usd(o.cap)}\n유통량: ${(o.supply / 1e9).toFixed(3)}B USDe\n관측: ${observed} KST · CoinGecko\n바이백 기준은 유통량 7.5B USDe부터이며, 이 시총 알림은 실제 바이백 집행 확인이 아니야.\nhttps://bakkakas.github.io/Funding-dashboard/investment-setup.html?asset=ena` };
}
