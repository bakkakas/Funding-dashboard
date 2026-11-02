import {parseMarketFx} from './fx-data.js?v=1';
// Latest Hana Bank notice via Naver, with an explicitly labeled daily fallback.
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
      let quote, fallback=false;
      try {
        const config=window.FUNDING_SUPABASE;
        if(!config?.functionsBaseUrl||!config?.anonKey)throw Error('FX service not configured');
        const response=await fetch(config.functionsBaseUrl+'/market-fx',{method:'POST',headers:{'Authorization':'Bearer '+config.anonKey,'apikey':config.anonKey,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error('FX service unavailable');
        quote=parseMarketFx(await response.json());
      } catch {
        const response=await fetch(FX_URL,{cache:'no-store',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error('FX fallback failed');
        quote=parseFx(await response.json());fallback=true;
      }
      const {rate,at}=quote;
      ticker.replaceChildren();
      const a = document.createElement('a');
      a.href = fallback?'https://www.exchangerate-api.com/docs/free':'https://m.stock.naver.com/marketindex/exchange/FX_USDKRW'; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.style.color = 'inherit'; a.style.textDecoration = 'none';
      const stamp = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(at);
      a.textContent = `USD/KRW ${rate.toLocaleString('ko-KR', {minimumFractionDigits:2,maximumFractionDigits:2})} · ${fallback?'일일 참고환율 · 최신 조회 실패':'하나은행 고시'} (${stamp} KST)`;
      a.title = fallback?'최신 은행 고시환율 조회 실패로 일일 참고환율 표시.':'네이버 제공 하나은행 최신 매매기준율. 접속·탭 복귀 시 및 1분마다 조회(서버 캐시 최대 30초). 휴일·비고시 시간에는 마지막 고시값. 현찰/송금 적용환율·실시간 체결가와 다름.';
      ticker.append(a); ticker.className = 'fx-ticker'; ticker.dataset.state = fallback?'fallback':'ready';
    } catch {
      ticker.textContent = 'USD/KRW 기준환율 조회 실패'; ticker.className = 'fx-ticker warn'; ticker.dataset.state = 'failed';
    } finally { busy = false; }
  }
  refresh();
  const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60 * 1000);
  const onVisible=()=>{if(!document.hidden)refresh();};
  document.addEventListener('visibilitychange',onVisible);
  return () => {clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
}
