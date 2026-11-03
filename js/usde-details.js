import {normalizeUsdeObservation,USDE_CURRENT_URL} from './usde-observation.js?v=1';
const valid=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
export function normalizeUsdeDetails(raw,now=Date.now()) {
  const base=normalizeUsdeObservation(raw,now),m=raw.market_data;
  return {...base,volume:valid(m.total_volume?.usd),high:valid(m.high_24h?.usd),low:valid(m.low_24h?.usd),priceChange:valid(m.price_change_percentage_24h),capChange:valid(m.market_cap_change_percentage_24h),totalSupply:valid(m.total_supply),pegDeviation:(base.price-1)*100};
}
export async function loadUsdeDetails(signal){
 const response=await fetch(USDE_CURRENT_URL,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('USDe quote unavailable');return normalizeUsdeDetails(await response.json());
}
export function renderUsdeDetails(data,en=false,failed=false){
 const stale=!data||Date.now()-data.observedAt>3600000;
 const usd=(v,digits=0)=>v===null||v===undefined?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:digits,minimumFractionDigits:digits}).format(v);
 const num=v=>v===null||v===undefined?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v);
 const pct=v=>v===null||v===undefined?'—':`${v>0?'+':''}${v.toFixed(3)}%`;
 const rows=data?[[en?'Current price':'현재 가격',usd(data.price,4)],[en?'Current market cap':'현재 시가총액',usd(data.cap)],[en?'Circulating supply':'유통량',num(data.supply)+' USDe'],[en?'24h volume':'24시간 거래량',usd(data.volume)],[en?'24h high / low':'24시간 최고 / 최저',usd(data.high,4)+' / '+usd(data.low,4)],[en?'24h price change':'24시간 가격 변화',pct(data.priceChange)],[en?'24h market cap change':'24시간 시총 변화',pct(data.capChange)],[en?'Deviation from $1':'$1 대비 괴리율',pct(data.pegDeviation)]]:[];
 return `<section class="usde-live"><h4>${en?'USDe market details':'USDe 현재 시장 상세'}</h4><p role="status">${stale||failed?(en?'Latest lookup unavailable; previous quote may be delayed.':'최신 조회 실패·지연 가능 · 이전 관측값은 참고용.'):en?'CoinGecko latest quote':'CoinGecko 최신 관측'}${data?' · '+new Date(data.observedAt).toLocaleString(en?'en-US':'ko-KR',{timeZone:'Asia/Seoul'})+' KST':''}</p><div class="usde-detail-grid">${rows.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div><p>${en?'Refreshes on opening and every 5 minutes while visible. Provider quotes may lag. Daily history below uses DefiLlama; do not compare across providers as a time-series change.':'접속 시·화면 표시 중 5분마다 조회 · 제공처 갱신 지연 가능. 아래 일별 이력은 DefiLlama 자료로, 현재 관측값과 출처·시각이 다릅니다.'}</p><a href="https://coinmarketcap.com/currencies/ethena-usde/" target="_blank" rel="noopener noreferrer">CoinMarketCap · USDe ↗</a> · <a href="https://www.coingecko.com/en/coins/ethena-usde" target="_blank" rel="noopener noreferrer">CoinGecko ↗</a></section>`;
}
