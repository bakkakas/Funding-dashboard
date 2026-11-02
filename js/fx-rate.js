// Daily reference rate, never a cross-provider pseudo daily return.
export const FX_URL = 'https://open.er-api.com/v6/latest/USD';
export function parseFx(data, now = Date.now()) {
  const rate = Number(data?.rates?.KRW), at = Number(data?.time_last_update_unix) * 1000;
  if (data?.result !== 'success' || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(at) || at <= 0 || at > now + 300000 || now - at > 3 * 86400000) throw Error('FX reference unavailable or stale');
  return { rate, at };
}
export function setupFxTicker(ticker) {
  if (!ticker) return;
  let busy = false;
  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      const response = await fetch(FX_URL, {cache: 'no-store', signal: AbortSignal.timeout(12000)});
      if (!response.ok) throw Error('FX request failed');
      const {rate, at} = parseFx(await response.json());
      ticker.replaceChildren();
      const a = document.createElement('a');
      a.href = 'https://www.exchangerate-api.com/docs/free'; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.style.color = 'inherit'; a.style.textDecoration = 'none';
      const stamp = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(at);
      a.textContent = `USD/KRW ${rate.toLocaleString('ko-KR', {minimumFractionDigits:2,maximumFractionDigits:2})} · 기준환율 (${stamp} KST)`;
      a.title = 'ExchangeRate-API · 일 1회 갱신되는 참고 환율. 실시간 시장가/은행 매매환율 아님. 화면은 30분마다 재조회.';
      ticker.append(a); ticker.className = 'fx-ticker'; ticker.dataset.state = 'ready';
    } catch {
      ticker.textContent = 'USD/KRW 기준환율 조회 실패'; ticker.className = 'fx-ticker warn'; ticker.dataset.state = 'failed';
    } finally { busy = false; }
  }
  refresh();
  const timer = setInterval(() => { if (!document.hidden) refresh(); }, 30 * 60 * 1000);
  return () => clearInterval(timer);
}
